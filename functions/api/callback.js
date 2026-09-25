// POST /api/callback — ödeme sağlayıcısı ödeme sonrası buraya token ile döner.
// Sonuç sağlayıcıdan sorgulanır (geçici hatalarda 3 deneme). Ödeme başarılıysa info@mddstudio.co'ya "SİPARİŞ",
// sonuç sorgulanamazsa "SİPARİŞ – KONTROL EDİN" maili gider; müşteriye kesin olmayan durumda "tamamlanamadı" denmez.
import { openOrder, sendOrderMail } from "../_order.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const apiKey = env.IYZICO_API_KEY, secretKey = env.IYZICO_SECRET_KEY;
  const BASE = (env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  const live = !BASE.includes("sandbox");

  let token = "";
  try { const fd = await request.formData(); token = fd.get("token") || ""; } catch {}
  if (!token || !apiKey || !secretKey) return page("fail", "Ödeme bilgisi alınamadı. Kartınızdan çekim yapılmadıysa sepetinizden tekrar deneyebilirsiniz.");

  const sealed = new URL(request.url).searchParams.get("o");
  const order = sealed ? await openOrder(secretKey, sealed) : null;
  const mail = (payment, unverified) => {
    const job = sendOrderMail(env, { payment, order, live, unverified, token: String(token) })
      .catch(e => console.log("order mail failed", e && e.message));
    if (typeof waitUntil === "function") waitUntil(job); else return job;
  };

  const uriPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";
  const bodyStr = JSON.stringify({ locale: "tr", conversationId: "mdd-cb", token: String(token) });

  // Geçici ağ/SSL hatalarında (ör. 5xx, 525) kısa aralıklarla yeniden dene
  let data = null, lastErr = "";
  for (let attempt = 0; attempt < 3 && !data; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 700 * attempt));
    try {
      const { authorization, rnd } = await iyziAuth(apiKey, secretKey, uriPath, bodyStr);
      const resp = await fetch(BASE + uriPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authorization, "x-iyzi-rnd": rnd },
        body: bodyStr,
      });
      const raw = await resp.text();
      if (resp.status >= 500) { lastErr = `HTTP ${resp.status}`; continue; }
      data = JSON.parse(raw);
    } catch (e) { lastErr = String(e && e.message || e); }
  }

  if (!data) {
    console.log("payment detail unreachable", lastErr);
    await mail({ paymentId: "", paidPrice: "" }, true);
    return page("pending",
      "Ödemenizin sonucunu şu an doğrulayamadık. Kartınızdan çekim yapıldıysa siparişiniz alınmıştır; " +
      "en kısa sürede e-posta ile size dönüş yapacağız. Lütfen tekrar ödeme yapmayın.");
  }

  const ok = data.status === "success" && data.paymentStatus === "SUCCESS";
  if (ok) {
    await mail(data, false);
    return page("ok", `Siparişiniz alındı. Sipariş numaranız: <b>${esc(data.paymentId || "")}</b><br>Tutar: <b>${esc(data.paidPrice || "")} ₺</b>`);
  }
  return page("fail", esc(data.errorMessage || "Ödeme tamamlanamadı. Kartınızdan çekim yapılmadı; sepetinizden tekrar deneyebilirsiniz."));
}

export async function onRequestGet() {
  return new Response(null, { status: 302, headers: { Location: "/" } });
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function page(state, msg) {
  const T = {
    ok:      { title: "Siparişiniz alındı, teşekkürler", icon: "✓", bg: "#9DB89A" },
    pending: { title: "Ödemeniz kontrol ediliyor",      icon: "…", bg: "#AFA2E0" },
    fail:    { title: "Ödeme tamamlanamadı",            icon: "!", bg: "#C2789E" },
  }[state];
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${T.title} · MDD Studio</title>
<link rel="icon" href="/brand/mdd-icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&family=Nunito:wght@400;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}
body{background:#FDE7EF;color:#1F2A56;font:16px/1.6 "Nunito",system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.box{max-width:460px;width:100%;background:#FFFCF7;border:2px solid #F1DCE6;border-radius:28px;padding:36px 28px;text-align:center;box-shadow:0 6px 0 rgba(31,42,86,.07)}
.logo{width:150px;height:auto;margin:0 auto 6px;display:block}
.badge{width:64px;height:64px;border-radius:50%;margin:10px auto 16px;display:flex;align-items:center;justify-content:center;font:700 32px "Quicksand",sans-serif;color:#fff;background:${T.bg}}
h1{font:700 1.35rem "Quicksand",sans-serif;margin-bottom:10px}
p{color:#3A4577;margin-bottom:24px}
a{display:inline-block;background:#1F2A56;color:#FFFCF7;text-decoration:none;padding:12px 24px;border-radius:999px;font:700 .95rem "Quicksand",sans-serif;box-shadow:0 4px 0 #C2789E}
small{display:block;margin-top:18px;color:#6B6F8E;font-size:.82rem}
</style></head><body>
<div class="box">
<img class="logo" src="/brand/mdd-logo-horizontal.svg" alt="MDD Studio">
<div class="badge">${T.icon}</div>
<h1>${T.title}</h1>
<p>${msg}</p>
<a href="/">Mağazaya dön</a>
<small>Sorunuz için: info@mddstudio.co · 0533 486 28 99</small>
</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
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
