// POST /api/checkout  — iyzico CheckoutForm başlatma (sunucu tarafı, anahtarlar env'den)
// Anahtarlar Cloudflare Pages > Settings > Environment variables içinde ŞİFRELİ tutulur:
//   IYZICO_API_KEY, IYZICO_SECRET_KEY  (opsiyonel: IYZICO_BASE_URL prod için)

// Sunucu tarafı fiyat kaynağı — istemciden gelen fiyata GÜVENİLMEZ, id+adet ile buradan hesaplanır.
const CATALOG = {
  m1:{n:"Ödül Sticker Seti — Aferin/Maşallah/Tebrikler (Kız)", p:99},
  m2:{n:"Kuran Okuyorum Sticker Seti (Erkek)",                 p:89},
  m3:{n:"Journaling Sticker Sayfası — Today, Choose Peace",    p:129},
  m4:{n:"Summer Vibes — Sarı & Mavi",                          p:79},
  m5:{n:"Summer Vibes — Mint & Yeşil",                         p:79},
  m6:{n:"Hanımlar — Modest Lifestyle Sticker",                p:99},
  m7:{n:"Bloom Softly — Çiçek Sticker (A5)",                  p:89},
  m8:{n:"Küçük Müslüman — Kız Çocuk Sticker",                 p:89},
  u1:{n:"Namaz Takip Defteri",                                p:179},
  u2:{n:"90 Günlük Hatim Planlayıcısı",                        p:199},
  u3:{n:"Rûznâme — Bullet Journal",                           p:249},
  u4:{n:"İbadet Alışkanlık Çizelgesi",                         p:149},
  e1:{n:"Dua Kartı — It's Just Dunya",                        p:49},
  e2:{n:"Ayet Kartı — Duha Suresi (93:1-2)",                  p:59},
};

export async function onRequestPost({ request, env }) {
  const apiKey = env.IYZICO_API_KEY, secretKey = env.IYZICO_SECRET_KEY;
  const BASE = (env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  if (!apiKey || !secretKey) return json({ error: "Ödeme yapılandırması eksik (env değişkenleri)." }, 500);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Geçersiz istek." }, 400); }
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const b = payload.buyer || {};

  const basketItems = [];
  let total = 0;
  for (const it of rawItems) {
    const prod = CATALOG[it && it.id];
    const qty = Math.max(1, Math.min(99, parseInt(it && it.qty) || 0));
    if (!prod) continue;
    const line = prod.p * qty;
    total += line;
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
  const ip = request.headers.get("cf-connecting-ip") || "85.34.78.112";
  const clip = (v, n, d) => (v == null ? d : String(v)).slice(0, n);
  const name = clip(b.name, 50, "Misafir");
  const surname = clip(b.surname, 50, "Müşteri");
  const email = clip(b.email, 80, "musteri@mddstudio.co");
  const phone = clip(b.phone, 20, "+905000000000");
  const address = clip(b.address, 200, "Keçiören, Ankara");
  const city = clip(b.city, 40, "Ankara");
  const now = Date.now();
  const addr = { contactName: `${name} ${surname}`.trim(), city, country: "Turkey", address };

  const reqBody = {
    locale: "tr",
    conversationId: "mdd-" + now,
    price: priceStr,
    paidPrice: priceStr,
    currency: "TRY",
    basketId: "B" + now,
    paymentGroup: "PRODUCT",
    callbackUrl: origin + "/api/callback",
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
