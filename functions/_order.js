// Ortak yardımcılar: sipariş bilgisini şifreleyip iyzico dönüşüne taşımak ve sipariş maili göndermek.
// "_" ile başladığı için Pages bu dosyayı bir adres (route) olarak yayınlamaz.

export const CATALOG = {
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

const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function aesKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret + "|mdd-order"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Müşteri bilgisi URL'de açık metin olarak durmasın diye AES-GCM ile şifrelenir.
export async function sealOrder(secret, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(JSON.stringify(data)));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv); out.set(new Uint8Array(ct), 12);
  return b64u(out);
}

export async function openOrder(secret, token) {
  try {
    const bytes = unb64u(token);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await aesKey(secret), bytes.slice(12));
    return JSON.parse(dec.decode(pt));
  } catch { return null; }
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Sipariş maili. Önce Pages'e bağlanmış EMAIL (send_email) bağlantısını, yoksa Email Service REST API'sini kullanır.
// Gerekli ayar (Cloudflare Pages > mdd-studio > Settings > Variables and secrets):
//   CF_EMAIL_TOKEN  : "Email Sending" izni olan API token (secret)
//   CF_ACCOUNT_ID   : (opsiyonel) varsayılan aşağıda
//   ORDER_EMAIL_TO  : (opsiyonel) varsayılan info@mddstudio.co
//   ORDER_EMAIL_FROM: (opsiyonel) varsayılan siparis@mddstudio.co
export async function sendOrderMail(env, { payment, order, live }) {
  const to = env.ORDER_EMAIL_TO || "info@mddstudio.co";
  const from = env.ORDER_EMAIL_FROM || "siparis@mddstudio.co";
  const b = (order && order.b) || {};
  const lines = (order && order.i ? order.i : (payment.itemTransactions || []).map(t => [t.itemId, 1]))
    .map(([id, q]) => ({ id, q, n: (CATALOG[id] || {}).n || id, p: ((CATALOG[id] || {}).p || 0) * q }));
  const who = [b.n, b.s].filter(Boolean).join(" ") || "Müşteri";
  const amount = payment.paidPrice || lines.reduce((a, l) => a + l.p, 0);
  const subject = `${live ? "" : "[TEST] "}SİPARİŞ · ${who} · ${amount} ₺ · #${payment.paymentId || ""}`;
  const when = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  const text = [
    `YENİ SİPARİŞ${live ? "" : " (iyzico test modu)"}`,
    `Sipariş no: ${payment.paymentId || "-"}   Tarih: ${when}`,
    `Tutar: ${amount} ₺`, "",
    "Müşteri", `${who}`, `E-posta: ${b.e || "-"}`, `Telefon: ${b.p || "-"}`, "",
    "Teslimat adresi", `${b.a || "-"}`, `${b.c || ""}`, "",
    "Ürünler", ...lines.map(l => `- ${l.n} × ${l.q} = ${l.p} ₺`),
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#1F2A56;max-width:560px">
<h2 style="margin:0 0 4px">Yeni sipariş${live ? "" : " <span style='color:#C2789E'>(test modu)</span>"}</h2>
<p style="margin:0 0 16px;color:#6B6F8E">Sipariş no <b>${esc(payment.paymentId)}</b> · ${esc(when)}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<tr><td style="padding:6px 0;color:#6B6F8E;width:120px">Müşteri</td><td><b>${esc(who)}</b></td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">E-posta</td><td>${esc(b.e || "-")}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">Telefon</td><td>${esc(b.p || "-")}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E;vertical-align:top">Adres</td><td>${esc(b.a || "-")}<br>${esc(b.c || "")}</td></tr>
</table>
<h3 style="margin:18px 0 6px">Ürünler</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px">
${lines.map(l => `<tr><td style="padding:6px 0;border-bottom:1px solid #F1DCE6">${esc(l.n)}</td><td style="text-align:center;border-bottom:1px solid #F1DCE6">× ${l.q}</td><td style="text-align:right;border-bottom:1px solid #F1DCE6">${l.p} ₺</td></tr>`).join("")}
<tr><td colspan="2" style="padding:8px 0"><b>Toplam</b></td><td style="text-align:right"><b>${esc(amount)} ₺</b></td></tr>
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
    body: JSON.stringify(msg),
  });
  return r.ok;
}
