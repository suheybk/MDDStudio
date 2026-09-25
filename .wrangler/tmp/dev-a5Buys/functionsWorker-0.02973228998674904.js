var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-JPIjDg/functionsWorker-0.02973228998674904.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var CATALOG = {
  m1: { n: "\xD6d\xFCl Sticker Seti \u2014 Aferin/Ma\u015Fallah/Tebrikler (K\u0131z)", p: 99 },
  m2: { n: "Kuran Okuyorum Sticker Seti (Erkek)", p: 89 },
  m3: { n: "Journaling Sticker Sayfas\u0131 \u2014 Today, Choose Peace", p: 129 },
  m4: { n: "Summer Vibes \u2014 Sar\u0131 & Mavi", p: 79 },
  m5: { n: "Summer Vibes \u2014 Mint & Ye\u015Fil", p: 79 },
  m6: { n: "Han\u0131mlar \u2014 Modest Lifestyle Sticker", p: 99 },
  m7: { n: "Bloom Softly \u2014 \xC7i\xE7ek Sticker (A5)", p: 89 },
  m8: { n: "K\xFC\xE7\xFCk M\xFCsl\xFCman \u2014 K\u0131z \xC7ocuk Sticker", p: 89 },
  u1: { n: "Namaz Takip Defteri", p: 179 },
  u2: { n: "90 G\xFCnl\xFCk Hatim Planlay\u0131c\u0131s\u0131", p: 199 },
  u3: { n: "R\xFBzn\xE2me \u2014 Bullet Journal", p: 249 },
  u4: { n: "\u0130badet Al\u0131\u015Fkanl\u0131k \xC7izelgesi", p: 149 },
  e1: { n: "Dua Kart\u0131 \u2014 It's Just Dunya", p: 49 },
  e2: { n: "Ayet Kart\u0131 \u2014 Duha Suresi (93:1-2)", p: 59 }
};
var enc = new TextEncoder();
var dec = new TextDecoder();
var b64u = /* @__PURE__ */ __name2((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64u");
var unb64u = /* @__PURE__ */ __name2((s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)), "unb64u");
async function aesKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret + "|mdd-order"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(aesKey, "aesKey");
__name2(aesKey, "aesKey");
async function sealOrder(secret, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(JSON.stringify(data)));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return b64u(out);
}
__name(sealOrder, "sealOrder");
__name2(sealOrder, "sealOrder");
async function openOrder(secret, token) {
  try {
    const bytes = unb64u(token);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await aesKey(secret), bytes.slice(12));
    return JSON.parse(dec.decode(pt));
  } catch {
    return null;
  }
}
__name(openOrder, "openOrder");
__name2(openOrder, "openOrder");
var esc = /* @__PURE__ */ __name2((s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), "esc");
async function sendOrderMail(env, { payment, order, live }) {
  const to = env.ORDER_EMAIL_TO || "info@mddstudio.co";
  const from = env.ORDER_EMAIL_FROM || "siparis@mddstudio.co";
  const b = order && order.b || {};
  const lines = (order && order.i ? order.i : (payment.itemTransactions || []).map((t) => [t.itemId, 1])).map(([id, q]) => ({ id, q, n: (CATALOG[id] || {}).n || id, p: ((CATALOG[id] || {}).p || 0) * q }));
  const who = [b.n, b.s].filter(Boolean).join(" ") || "M\xFC\u015Fteri";
  const amount = payment.paidPrice || lines.reduce((a, l) => a + l.p, 0);
  const subject = `${live ? "" : "[TEST] "}S\u0130PAR\u0130\u015E \xB7 ${who} \xB7 ${amount} \u20BA \xB7 #${payment.paymentId || ""}`;
  const when = (/* @__PURE__ */ new Date()).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const text = [
    `YEN\u0130 S\u0130PAR\u0130\u015E${live ? "" : " (iyzico test modu)"}`,
    `Sipari\u015F no: ${payment.paymentId || "-"}   Tarih: ${when}`,
    `Tutar: ${amount} \u20BA`,
    "",
    "M\xFC\u015Fteri",
    `${who}`,
    `E-posta: ${b.e || "-"}`,
    `Telefon: ${b.p || "-"}`,
    "",
    "Teslimat adresi",
    `${b.a || "-"}`,
    `${b.c || ""}`,
    "",
    "\xDCr\xFCnler",
    ...lines.map((l) => `- ${l.n} \xD7 ${l.q} = ${l.p} \u20BA`)
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#1F2A56;max-width:560px">
<h2 style="margin:0 0 4px">Yeni sipari\u015F${live ? "" : " <span style='color:#C2789E'>(test modu)</span>"}</h2>
<p style="margin:0 0 16px;color:#6B6F8E">Sipari\u015F no <b>${esc(payment.paymentId)}</b> \xB7 ${esc(when)}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<tr><td style="padding:6px 0;color:#6B6F8E;width:120px">M\xFC\u015Fteri</td><td><b>${esc(who)}</b></td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">E-posta</td><td>${esc(b.e || "-")}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">Telefon</td><td>${esc(b.p || "-")}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E;vertical-align:top">Adres</td><td>${esc(b.a || "-")}<br>${esc(b.c || "")}</td></tr>
</table>
<h3 style="margin:18px 0 6px">\xDCr\xFCnler</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px">
${lines.map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #F1DCE6">${esc(l.n)}</td><td style="text-align:center;border-bottom:1px solid #F1DCE6">\xD7 ${l.q}</td><td style="text-align:right;border-bottom:1px solid #F1DCE6">${l.p} \u20BA</td></tr>`).join("")}
<tr><td colspan="2" style="padding:8px 0"><b>Toplam</b></td><td style="text-align:right"><b>${esc(amount)} \u20BA</b></td></tr>
</table></div>`;
  const msg = { to, from, subject, text, html };
  if (env.EMAIL && typeof env.EMAIL.send === "function") {
    await env.EMAIL.send(msg);
    return true;
  }
  if (!env.CF_EMAIL_TOKEN) return false;
  const account = env.CF_ACCOUNT_ID || "07a66e46f94888850bd39f0f732d9556";
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.CF_EMAIL_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(msg)
  });
  return r.ok;
}
__name(sendOrderMail, "sendOrderMail");
__name2(sendOrderMail, "sendOrderMail");
async function onRequestPost({ request, env, waitUntil }) {
  const apiKey = env.IYZICO_API_KEY, secretKey = env.IYZICO_SECRET_KEY;
  const BASE = (env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  let token = "";
  try {
    const fd = await request.formData();
    token = fd.get("token") || "";
  } catch {
  }
  if (!token || !apiKey || !secretKey) return page(false, "\xD6deme do\u011Frulanamad\u0131 (eksik bilgi).");
  const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
  const bodyStr = JSON.stringify({ locale: "tr", conversationId: "mdd-cb", token: String(token) });
  const { authorization, rnd } = await iyziAuth(apiKey, secretKey, uriPath, bodyStr);
  let data;
  try {
    const resp = await fetch(BASE + uriPath, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authorization, "x-iyzi-rnd": rnd },
      body: bodyStr
    });
    data = await resp.json();
  } catch {
    return page(false, "iyzico'ya ula\u015F\u0131lamad\u0131.");
  }
  const ok = data.status === "success" && data.paymentStatus === "SUCCESS";
  if (ok) {
    const sealed = new URL(request.url).searchParams.get("o");
    const order = sealed ? await openOrder(secretKey, sealed) : null;
    const live = !BASE.includes("sandbox");
    const job = sendOrderMail(env, { payment: data, order, live }).catch((e) => console.log("order mail failed", e && e.message));
    if (typeof waitUntil === "function") waitUntil(job);
    else await job;
  }
  const detail = ok ? `\xD6demeniz al\u0131nd\u0131. Sipari\u015F referans\u0131: <b>${esc2(data.paymentId || data.token)}</b><br>Tutar: <b>${esc2(data.paidPrice || "")} \u20BA</b>` : esc2(data.errorMessage || (data.paymentStatus ? "\xD6deme tamamlanamad\u0131: " + data.paymentStatus : "\xD6deme tamamlanamad\u0131."));
  return page(ok, detail);
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestGet() {
  return page(false, "Bu sayfa yaln\u0131zca \xF6deme d\xF6n\xFC\u015F\xFC i\xE7indir.");
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
function esc2(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
__name(esc2, "esc2");
__name2(esc2, "esc");
function page(ok, msg) {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? "\xD6deme Ba\u015Far\u0131l\u0131" : "\xD6deme Sonucu"} \u2014 MDD Studio</title>
<style>
:root{--paper:#f3f1ec;--ink:#141414;--muted:#8a857c;--line:#dedacf;--ok:#57724a;--bad:#a2483a;--gold:#a9843a}
*{margin:0;box-sizing:border-box}body{background:var(--paper);color:var(--ink);
font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh;
display:flex;align-items:center;justify-content:center;padding:24px}
.box{max-width:460px;width:100%;background:#fbfaf5;border:1px solid var(--line);border-radius:16px;
padding:40px 32px;text-align:center;box-shadow:0 14px 34px rgba(20,20,20,.08)}
.ar{font-family:"Amiri",Georgia,serif;font-size:44px;color:var(--gold);line-height:1}
.badge{width:64px;height:64px;border-radius:50%;margin:14px auto 18px;display:flex;
align-items:center;justify-content:center;font-size:34px;color:#fff;background:${ok ? "var(--ok)" : "var(--bad)"}}
h1{font-size:20px;letter-spacing:.02em;margin-bottom:12px}
p{color:#3a352b;line-height:1.7;font-size:15px;margin-bottom:24px}
a{display:inline-block;border:1px solid var(--ink);color:var(--ink);text-decoration:none;
padding:11px 26px;border-radius:100px;font-size:13px;letter-spacing:.12em;text-transform:uppercase}
a:hover{background:var(--ink);color:var(--paper)}
</style></head><body>
<div class="box">
<div class="ar">\u0645\u062F\u062F</div>
<div class="badge">${ok ? "\u2713" : "!"}</div>
<h1>${ok ? "\xD6demeniz Al\u0131nd\u0131, te\u015Fekk\xFCrler" : "\xD6deme Tamamlanamad\u0131"}</h1>
<p>${msg}</p>
<a href="/">Ma\u011Fazaya D\xF6n</a>
</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(page, "page");
__name2(page, "page");
function toHex(buf) {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
__name2(toHex, "toHex");
function b64(s) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
__name(b64, "b64");
__name2(b64, "b64");
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
__name(hmacHex, "hmacHex");
__name2(hmacHex, "hmacHex");
async function iyziAuth(apiKey, secretKey, uriPath, bodyStr) {
  const rnd = toHex(crypto.getRandomValues(new Uint8Array(8)));
  const signature = await hmacHex(secretKey, rnd + uriPath + bodyStr);
  const authorization = "IYZWSv2 " + b64(`apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`);
  return { authorization, rnd };
}
__name(iyziAuth, "iyziAuth");
__name2(iyziAuth, "iyziAuth");
async function onRequestPost2({ request, env }) {
  const apiKey = env.IYZICO_API_KEY, secretKey = env.IYZICO_SECRET_KEY;
  const BASE = (env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  if (!apiKey || !secretKey) return json({ error: "\xD6deme yap\u0131land\u0131rmas\u0131 eksik (env de\u011Fi\u015Fkenleri)." }, 500);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Ge\xE7ersiz istek." }, 400);
  }
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return json({ error: "\u0130stek do\u011Frulanamad\u0131." }, 400);
  const country = request.cf && request.cf.country || "";
  if (country === "T1") return json({ error: "Bu a\u011F \xFCzerinden \xF6deme yap\u0131lam\u0131yor." }, 403);
  const allowed = (env.ALLOWED_COUNTRIES || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(country)) return json({ error: "Bu \xFClkeden \xF6deme kabul edilmiyor." }, 403);
  const blocked = (env.BLOCKED_IPS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (blocked.includes(ip)) return json({ error: "\u0130stek reddedildi." }, 403);
  if (env.TURNSTILE_SECRET) {
    const fd = new FormData();
    fd.append("secret", env.TURNSTILE_SECRET);
    fd.append("response", String(payload.cfToken || ""));
    fd.append("remoteip", ip);
    let ts = null;
    try {
      ts = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd })).json();
    } catch {
    }
    if (!ts || !ts.success) return json({ error: "G\xFCvenlik do\u011Frulamas\u0131 ba\u015Far\u0131s\u0131z. L\xFCtfen do\u011Frulamay\u0131 tamamlay\u0131p tekrar deneyin." }, 403);
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
      category1: "\u0130slami Tasar\u0131m",
      itemType: "PHYSICAL",
      price: line.toFixed(2)
    });
  }
  if (!basketItems.length) return json({ error: "Sepet bo\u015F veya ge\xE7ersiz." }, 400);
  const priceStr = total.toFixed(2);
  const origin = new URL(request.url).origin;
  const clip = /* @__PURE__ */ __name2((v, n, d) => (v == null ? d : String(v)).slice(0, n), "clip");
  const name = clip(b.name, 50, "Misafir");
  const surname = clip(b.surname, 50, "M\xFC\u015Fteri");
  const email = clip(b.email, 80, "musteri@mddstudio.co");
  const phone = clip(b.phone, 20, "+905000000000");
  const address = clip(b.address, 200, "Ke\xE7i\xF6ren, Ankara");
  const city = clip(b.city, 40, "Ankara");
  const now = Date.now();
  const addr = { contactName: `${name} ${surname}`.trim(), city, country: "Turkey", address };
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
      id: "BY" + now,
      name,
      surname,
      gsmNumber: phone,
      email,
      identityNumber: "11111111111",
      registrationAddress: address,
      ip,
      city,
      country: "Turkey"
    },
    shippingAddress: addr,
    billingAddress: addr,
    basketItems
  };
  const uriPath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
  const bodyStr = JSON.stringify(reqBody);
  const { authorization, rnd } = await iyziAuth2(apiKey, secretKey, uriPath, bodyStr);
  let data, resp, raw = "";
  try {
    resp = await fetch(BASE + uriPath, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authorization, "x-iyzi-rnd": rnd },
      body: bodyStr
    });
    raw = await resp.text();
    data = JSON.parse(raw);
  } catch (e) {
    const detail = resp ? `HTTP ${resp.status}: ${raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)}` : String(e && e.message || e);
    console.log("iyzico init failed", BASE, detail);
    return json({ error: "\xD6deme sa\u011Flay\u0131c\u0131s\u0131na \u015Fu an ula\u015F\u0131lam\u0131yor, l\xFCtfen biraz sonra tekrar deneyin.", code: "PAY_UPSTREAM", detail }, 424);
  }
  if (data.status !== "success") {
    return json({ error: data.errorMessage || "\xD6deme ba\u015Flat\u0131lamad\u0131.", code: data.errorCode || null }, 400);
  }
  return json({ paymentPageUrl: data.paymentPageUrl, token: data.token });
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
__name(json, "json");
__name2(json, "json");
function toHex2(buf) {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(toHex2, "toHex2");
__name2(toHex2, "toHex");
function b642(s) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
__name(b642, "b642");
__name2(b642, "b64");
async function hmacHex2(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex2(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
__name(hmacHex2, "hmacHex2");
__name2(hmacHex2, "hmacHex");
async function iyziAuth2(apiKey, secretKey, uriPath, bodyStr) {
  const rnd = toHex2(crypto.getRandomValues(new Uint8Array(8)));
  const signature = await hmacHex2(secretKey, rnd + uriPath + bodyStr);
  const authorization = "IYZWSv2 " + b642(`apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`);
  return { authorization, rnd };
}
__name(iyziAuth2, "iyziAuth2");
__name2(iyziAuth2, "iyziAuth");
async function onRequestGet2({ env }) {
  return new Response(JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
var routes = [
  {
    routePath: "/api/callback",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/callback",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/checkout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/config",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-N4JVzm/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-N4JVzm/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.02973228998674904.js.map
