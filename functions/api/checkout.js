import { CATALOG, sealOrder } from "../_order.js";

// POST /api/checkout  — iyzico CheckoutForm başlatma (sunucu tarafı, anahtarlar env'den)
// Anahtarlar Cloudflare Pages > Settings > Environment variables içinde ŞİFRELİ tutulur:
//   IYZICO_API_KEY, IYZICO_SECRET_KEY  (opsiyonel: IYZICO_BASE_URL prod için)

// Sunucu tarafı fiyat kaynağı — istemciden gelen fiyata GÜVENİLMEZ, id+adet ile ../_order.js içindeki CATALOG'dan hesaplanır.

export async function onRequestPost({ request, env }) {
  const apiKey = env.IYZICO_API_KEY, secretKey = env.IYZICO_SECRET_KEY;
  const BASE = (env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  if (!apiKey || !secretKey) return json({ error: "Ödeme yapılandırması eksik (env değişkenleri)." }, 500);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Geçersiz istek." }, 400); }

  // ---- IP kontrolü ----
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return json({ error: "İstek doğrulanamadı." }, 400);
  const country = (request.cf && request.cf.country) || "";
  if (country === "T1") return json({ error: "Bu ağ üzerinden ödeme yapılamıyor." }, 403); // Tor çıkış düğümü
  const allowed = (env.ALLOWED_COUNTRIES || "").split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(country)) return json({ error: "Bu ülkeden ödeme kabul edilmiyor." }, 403);
  const blocked = (env.BLOCKED_IPS || "").split(",").map(x => x.trim()).filter(Boolean);
  if (blocked.includes(ip)) return json({ error: "İstek reddedildi." }, 403);

  // ---- CAPTCHA (Cloudflare Turnstile) ----
  // TURNSTILE_SECRET tanımlıysa zorunludur; tanımlı değilse (kurulum tamamlanana kadar) atlanır.
  if (env.TURNSTILE_SECRET) {
    const fd = new FormData();
    fd.append("secret", env.TURNSTILE_SECRET);
    fd.append("response", String(payload.cfToken || ""));
    fd.append("remoteip", ip);
    let ts = null;
    try { ts = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd })).json(); } catch {}
    if (!ts || !ts.success) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayıp tekrar deneyin." }, 403);
  }
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const b = payload.buyer || {};

  const basketItems = [];
  const orderLines = [];
  let total = 0;
  for (const it of rawItems) {
    const prod = CATALOG[it && it.id];
    const qty = Math.max(1, Math.min(99, parseInt(it && it.qty) || 0));
    if (!prod) continue;
    const line = prod.p * qty;
    total += line;
    orderLines.push([String(it.id), qty]);
    basketItems.push({
      id: String(it.id),
      name: qty > 1 ? `${prod.n} x${qty}` : prod.n,
      category1: "İslami Tasarım",
      itemType: "PHYSICAL",
      price: line.toFixed(2),
    });
  }
  if (!basketItems.length) return json({ error: "Sepet boş veya geçersiz." }, 400);
  const priceStr = total.toFixed(2);

  const origin = new URL(request.url).origin;
  const clip = (v, n, d) => (v == null ? d : String(v)).slice(0, n);
  const name = clip(b.name, 50, "Misafir");
  const surname = clip(b.surname, 50, "Müşteri");
  const email = clip(b.email, 80, "musteri@mddstudio.co");
  const phone = clip(b.phone, 20, "+905000000000");
  const address = clip(b.address, 200, "Keçiören, Ankara");
  const city = clip(b.city, 40, "Ankara");
  const now = Date.now();
  const addr = { contactName: `${name} ${surname}`.trim(), city, country: "Turkey", address };

  // Sipariş maili için müşteri bilgisi şifrelenip dönüş adresine eklenir (bkz. callback.js)
  const sealed = await sealOrder(secretKey, { b: { n: name, s: surname, e: email, p: phone, a: address, c: city }, i: orderLines });

  const reqBody = {
    locale: "tr",
    conversationId: "mdd-" + now,
    price: priceStr,
    paidPrice: priceStr,
    currency: "TRY",
    basketId: "B" + now,
    paymentGroup: "PRODUCT",
    callbackUrl: origin + "/api/callback?o=" + sealed,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: "BY" + now, name, surname, gsmNumber: phone, email,
      identityNumber: "11111111111",
      registrationAddress: address, ip, city, country: "Turkey",
    },
    shippingAddress: addr,
    billingAddress: addr,
    basketItems,
  };

  const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
  const bodyStr = JSON.stringify(reqBody);
  const { authorization, rnd } = await iyziAuth(apiKey, secretKey, uriPath, bodyStr);

  let data;
  try {
    const resp = await fetch(BASE + uriPath, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authorization, "x-iyzi-rnd": rnd },
      body: bodyStr,
    });
    data = await resp.json();
  } catch (e) {
    return json({ error: "iyzico'ya ulaşılamadı." }, 502);
  }

  if (data.status !== "success") {
    return json({ error: data.errorMessage || "Ödeme başlatılamadı.", code: data.errorCode || null }, 400);
  }
  return json({ paymentPageUrl: data.paymentPageUrl, token: data.token });
}

/* ---- iyzico IYZWSv2 imzalama (Web Crypto) ---- */
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
function toHex(buf) { return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function b64(s) { return btoa(String.fromCharCode(...new TextEncoder().encode(s))); }
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
async function iyziAuth(apiKey, secretKey, uriPath, bodyStr) {
  const rnd = toHex(crypto.getRandomValues(new Uint8Array(8)));
  const signature = await hmacHex(secretKey, rnd + uriPath + bodyStr);
  const authorization = "IYZWSv2 " + b64(`apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`);
  return { authorization, rnd };
}
