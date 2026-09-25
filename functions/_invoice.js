// Ödeme onaylandıktan sonra: Uyumsoft'ta e-Arşiv fatura kes → PDF'i al → müşteriye ve mağazaya mail.
// Yalnızca ödeme sağlayıcısı (Vakıf Katılım) "başarılı" dönüşünü doğruladıktan sonra çağrılmalıdır.
// "_" ile başladığı için Pages bu dosyayı bir adres olarak yayınlamaz.
import { sendInvoice, getInvoicePdf, invoiceStatus, invoiceLink, uyumConfig } from "./_uyumsoft.js";
import { sendMail, brandedHtml } from "./_mail.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Fatura imzalanıp PDF'i hazır olana kadar kısa süre bekler (en fazla ~40 sn).
async function waitForPdf(env, uuid, tries = 8, delay = 5000) {
  for (let i = 0; i < tries; i++) {
    const st = await invoiceStatus(env, uuid).catch(() => ({}));
    if (st.code === 2000 || st.code === 1200) throw new Error(`Fatura hata durumunda: ${st.message || st.status}`);
    if (st.code >= 300) return await getInvoicePdf(env, uuid).catch(() => null);
    await sleep(delay);
  }
  return null;
}

// order: { orderNo, buyer, lines:[{n,q,p,kdv}], total, paidAt, paymentMidier?, paymentType? }
export async function invoiceAndNotify(env, order) {
  const shopTo = env.ORDER_EMAIL_TO || "info@mddstudio.co";
  const who = `${order.buyer.name} ${order.buyer.surname}`.trim();
  const test = !uyumConfig(env).live;
  const tag = test ? "[TEST] " : "";
  let inv = null, pdf = null, err = null;

  try {
    inv = await sendInvoice(env, { ...order, uuid: order.uuid || crypto.randomUUID() });
    pdf = await waitForPdf(env, inv.uuid);
  } catch (e) { err = e && e.message || String(e); }

  const rows = order.lines.map(l => `<tr><td style="padding:6px 0;border-bottom:1px solid #F1DCE6">${esc(l.n)}</td><td style="text-align:center;border-bottom:1px solid #F1DCE6">× ${l.q}</td><td style="text-align:right;border-bottom:1px solid #F1DCE6">${l.p} ₺</td></tr>`).join("");
  const table = `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows}<tr><td colspan="2" style="padding:8px 0"><b>Toplam</b></td><td style="text-align:right"><b>${order.total} ₺</b></td></tr></table>`;
  const attachments = pdf ? [{ filename: `Fatura-${inv.number}.pdf`, content: pdf, type: "application/pdf" }] : [];
  const invLine = inv
    ? (pdf ? `<p>e-Arşiv faturanız (<b>${esc(inv.number)}</b>) bu e-postanın ekindedir.</p>`
           : `<p>e-Arşiv faturanız (<b>${esc(inv.number)}</b>) hazırlanıyor; <a href="${invoiceLink(inv.uuid)}">buradan görüntüleyebilirsiniz</a>.</p>`)
    : `<p>Faturanız en kısa sürede ayrıca e-postanıza gönderilecektir.</p>`;

  // Müşteriye
  await sendMail(env, {
    to: order.buyer.email,
    subject: `${tag}MDD Studio ödemeniz alındı · #${order.orderNo}`,
    text: `Merhaba ${order.buyer.name},\n\nÖdemeniz alındı, siparişiniz hazırlanıyor (no: ${order.orderNo}, tutar: ${order.total} ₺).\n` +
      (inv ? `e-Arşiv fatura no: ${inv.number}${pdf ? " (ekte)" : " — " + invoiceLink(inv.uuid)}\n` : "Faturanız ayrıca gönderilecektir.\n") +
      "\n" + order.lines.map(l => `- ${l.n} × ${l.q} = ${l.p} ₺`).join("\n") + `\n\nSorunuz için: info@mddstudio.co · 0533 486 28 99`,
    html: brandedHtml("Ödemeniz alındı, teşekkürler!", `<p>Merhaba ${esc(order.buyer.name)},</p><p>Siparişiniz hazırlanıyor. <b>Sipariş no: ${esc(order.orderNo)}</b></p>${table}${invLine}<p style="font-size:13px;color:#6B6F8E">Teslimat: ${esc(order.buyer.address)}, ${esc(order.buyer.city)}</p>`),
    attachments,
  }).catch(e => console.log("customer paid mail failed", e && e.message));

  // Mağazaya
  await sendMail(env, {
    to: shopTo, from: env.ORDER_EMAIL_FROM || "siparis@mddstudio.co",
    subject: `${tag}SİPARİŞ · ${who} · ${order.total} ₺ · #${order.orderNo}${err ? " · FATURA KESİLEMEDİ" : ""}`,
    text: [`ÖDEME ALINDI — siparişi hazırlayın`, `Sipariş no: ${order.orderNo}   Tutar: ${order.total} ₺`,
      err ? `!!! Fatura otomatik kesilemedi: ${err}\nUyumsoft portalından elle kesip müşteriye gönderin.` : `e-Arşiv fatura: ${inv.number} (ETTN ${inv.uuid})${pdf ? "" : " — PDF henüz hazır değildi, müşteriye bağlantı gönderildi"}`,
      "", "Müşteri", who, `E-posta: ${order.buyer.email}`, `Telefon: ${order.buyer.phone}`, "", "Teslimat adresi", order.buyer.address, order.buyer.city, "",
      "Ürünler", ...order.lines.map(l => `- ${l.n} × ${l.q} = ${l.p} ₺`)].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#1F2A56;max-width:560px">
<h2 style="margin:0 0 4px">Yeni sipariş — ödeme alındı</h2>
${err ? `<p style="margin:0 0 14px;padding:10px 12px;background:#FFD9D9;border-radius:8px"><b>Fatura otomatik kesilemedi.</b> Uyumsoft portalından elle kesin.<br><small>${esc(err)}</small></p>`
      : `<p style="margin:0 0 14px;padding:10px 12px;background:#DDF3E4;border-radius:8px">e-Arşiv fatura <b>${esc(inv.number)}</b> kesildi${pdf ? " ve müşteriye gönderildi (ekte)" : "; PDF henüz hazır değildi"}.</p>`}
<p style="margin:0 0 16px;color:#6B6F8E">Sipariş no <b>${esc(order.orderNo)}</b></p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<tr><td style="padding:6px 0;color:#6B6F8E;width:120px">Müşteri</td><td><b>${esc(who)}</b></td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">E-posta</td><td>${esc(order.buyer.email)}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E">Telefon</td><td>${esc(order.buyer.phone)}</td></tr>
<tr><td style="padding:6px 0;color:#6B6F8E;vertical-align:top">Adres</td><td>${esc(order.buyer.address)}<br>${esc(order.buyer.city)}</td></tr>
</table><h3 style="margin:18px 0 6px">Ürünler</h3>${table}</div>`,
    attachments,
  }).catch(e => console.log("shop paid mail failed", e && e.message));

  return { invoice: inv, pdf: !!pdf, error: err };
}
