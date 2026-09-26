// Sipariş yardımcıları: sunucu tarafı ürün kataloğu ve sipariş mailleri.
// "_" ile başladığı için Pages bu dosyayı bir adres (route) olarak yayınlamaz.
import { sendMail, brandedHtml } from "./_mail.js";

// Fiyatların tek kaynağı: istemciden gelen fiyata güvenilmez. id'ler index.html'deki P listesiyle aynı olmalı.
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

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// KDV oranı (%) ürün grubuna göre: m = sticker, u = defter, e = kart. Fiyatlar KDV dâhildir.
// Muhasebenin bildireceği oranlar Cloudflare'de KDV_RATES ile verilir, örn. {"m":20,"u":10,"e":20}
export function kdvRate(env, id) {
  let rates = {};
  try { rates = JSON.parse((env && env.KDV_RATES) || "{}"); } catch {}
  const r = rates[id] ?? rates[String(id)[0]] ?? rates.default ?? 20;
  return Number(r);
}

// Sepeti katalogla doğrular: [{id, qty}] → satırlar ve toplam
export function priceCart(items, env) {
  const lines = [];
  for (const it of Array.isArray(items) ? items : []) {
    const prod = CATALOG[it && it.id];
    const q = Math.max(1, Math.min(99, parseInt(it && it.qty) || 0));
    if (prod) lines.push({ id: String(it.id), n: prod.n, q, p: prod.p * q, kdv: kdvRate(env, it.id) });
  }
  return { lines, total: lines.reduce((a, l) => a + l.p, 0) };
}

// Mağazaya giden "SİPARİŞ TALEBİ" maili ve müşteriye giden onay maili
export async function sendOrderRequestMails(env, { orderNo, buyer: b, lines, total }) {
  const to = env.ORDER_EMAIL_TO || "info@mddstudio.co";
  const who = `${b.name} ${b.surname}`.trim();
  const when = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const rows = lines.map(l => `<tr><td style="padding:6px 0;border-bottom:1px solid #F1DCE6">${esc(l.n)}</td><td style="text-align:center;border-bottom:1px solid #F1DCE6">× ${l.q}</td><td style="text-align:right;border-bottom:1px solid #F1DCE6">${l.p} ₺</td></tr>`).join("");
  const table = `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows}<tr><td colspan="2" style="padding:8px 0"><b>Toplam</b></td><td style="text-align:right"><b>${total} ₺</b></td></tr></table>`;

  await sendMail(env, {
    to, from: env.ORDER_EMAIL_FROM || "siparis@mddstudio.co",
    subject: `SİPARİŞ TALEBİ · ${who} · ${total} ₺ · #${orderNo}`,
    text: [`YENİ SİPARİŞ TALEBİ (ödeme henüz alınmadı)`, `Sipariş no: ${orderNo}   Tarih: ${when}`, `Tutar: ${total} ₺`, "",
      "Müşteri", who, `E-posta: ${b.email}`, `Telefon: ${b.phone}`, "", "Teslimat adresi", b.address, b.city, "",
      "Ürünler", ...lines.map(l => `- ${l.n} × ${l.q} = ${l.p} ₺`), "", "Müşteriye ödeme bilgisini iletmeyi unutmayın."].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#1F2A56;max-width:560px">
<h2 style="margin:0 0 4px">Yeni sipariş talebi</h2>
<p style="margin:0 0 14px;padding:10px 12px;background:#FFF1C9;border-radius:8px">Ödeme henüz alınmadı. Müşteriye ödeme bilgisini iletin.</p>
<p style="margin:0 0 16px;color:#6B6F8E">Sipariş no <b>${esc(orderNo)}</b> · ${esc(when)}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<tr><td style="padding:6px 0;color:#6B6F8E;width:120px">Müşteri</td><td><b>${esc(who)}</b></td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">E-posta</td><td>${esc(b.email)}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">Telefon</td><td>${esc(b.phone)}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E;vertical-align:top">Adres</td><td>${esc(b.address)}<br>${esc(b.city)}</td></tr>
</table><h3 style="margin:18px 0 6px">Ürünler</h3>${table}</div>`,
  }).catch(e => console.log("shop order mail failed", e && e.message));

  await sendMail(env, {
    to: b.email, subject: `MDD Studio siparişiniz alındı · #${orderNo}`,
    text: `Merhaba ${b.name},\n\nSiparişiniz bize ulaştı (no: ${orderNo}, tutar: ${total} ₺). Ödeme bilgilerini en kısa sürede bu adrese ileteceğiz; ödemeniz alındıktan sonra siparişiniz hazırlanıp kargoya verilecek.\n\n` +
      lines.map(l => `- ${l.n} × ${l.q} = ${l.p} ₺`).join("\n") + `\n\nSorunuz için: info@mddstudio.co · 0533 486 28 99`,
    html: brandedHtml("Siparişiniz alındı, teşekkürler!", `<p>Merhaba ${esc(b.name)},</p><p>Siparişiniz bize ulaştı. <b>Sipariş no: ${esc(orderNo)}</b></p>${table}<p style="margin-top:14px">Ödeme bilgilerini en kısa sürede bu adrese ileteceğiz; ödemeniz alındıktan sonra siparişiniz hazırlanıp kargoya verilecek.</p><p style="font-size:13px;color:#6B6F8E">Teslimat: ${esc(b.address)}, ${esc(b.city)}</p>`),
  }).catch(e => console.log("customer order mail failed", e && e.message));
}
