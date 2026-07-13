// POST /api/callback — iyzico ödeme sonrası buraya token ile döner; sonucu doğrulayıp sayfa gösterir.
export async function onRequestPost({ request, env }) {
  const apiKey = env.IYZICO_API_KEY, secretKey = env.IYZICO_SECRET_KEY;
  const BASE = (env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");

  let token = "";
  try { const fd = await request.formData(); token = fd.get("token") || ""; } catch {}
  if (!token || !apiKey || !secretKey) return page(false, "Ödeme doğrulanamadı (eksik bilgi).");

  const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
  const bodyStr = JSON.stringify({ locale: "tr", conversationId: "mdd-cb", token: String(token) });
  const { authorization, rnd } = await iyziAuth(apiKey, secretKey, uriPath, bodyStr);

  let data;
  try {
    const resp = await fetch(BASE + uriPath, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authorization, "x-iyzi-rnd": rnd },
      body: bodyStr,
    });
    data = await resp.json();
  } catch { return page(false, "iyzico'ya ulaşılamadı."); }

  const ok = data.status === "success" && data.paymentStatus === "SUCCESS";
  const detail = ok
    ? `Ödemeniz alındı. Sipariş referansı: <b>${esc(data.paymentId || data.token)}</b><br>Tutar: <b>${esc(data.paidPrice || "")} ₺</b>`
    : esc(data.errorMessage || (data.paymentStatus ? "Ödeme tamamlanamadı: " + data.paymentStatus : "Ödeme tamamlanamadı."));
  return page(ok, detail);
}

export async function onRequestGet() {
  // doğrudan ziyaret edilirse ana sayfaya yönlendir
  return page(false, "Bu sayfa yalnızca ödeme dönüşü içindir.");
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function page(ok, msg) {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? "Ödeme Başarılı" : "Ödeme Sonucu"} — MDD Studio</title>
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
<div class="ar">مدد</div>
<div class="badge">${ok ? "✓" : "!"}</div>
<h1>${ok ? "Ödemeniz Alındı, teşekkürler" : "Ödeme Tamamlanamadı"}</h1>
<p>${msg}</p>
<a href="/">Mağazaya Dön</a>
</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* ---- iyzico IYZWSv2 imzalama ---- */
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
