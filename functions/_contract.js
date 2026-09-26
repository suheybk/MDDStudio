// Sipariş sonrası tüketiciye kalıcı veri saklayıcısıyla gönderilen belge:
// sipariş özeti + Ön Bilgilendirme Formu + Mesafeli Satış Sözleşmesi + İade & Teslimat (cayma formu dâhil).
// Metinlerin tek kaynağı legal/texts.js (sitedeki metinlerle aynı).
import "../legal/texts.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function contractHtml({ orderNo, buyer: b, lines, total, payMethod = "Havale / EFT" }) {
  const L = globalThis.MDD_LEGAL || {};
  const when = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const doc = k => L[k] ? `<section><h2>${esc(L[k][0])}</h2>${L[k][1]}</section>` : "";
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>MDD Studio · Sipariş ${esc(orderNo)} · Sözleşme ve bilgilendirme</title>
<style>body{font:14px/1.6 Arial,sans-serif;color:#1F2A56;max-width:760px;margin:24px auto;padding:0 16px}h1{font-size:20px}h2{font-size:17px;border-top:2px solid #F1DCE6;padding-top:18px;margin-top:28px}h4{margin:14px 0 4px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #F1DCE6;padding:6px 4px;text-align:left}</style></head><body>
<h1>MDD Studio — Sipariş ${esc(orderNo)}</h1>
<p>Bu belge, ${esc(when)} tarihinde verdiğiniz siparişe ait Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'nin kalıcı bir kopyasıdır. Lütfen saklayın.</p>
<h2>Sipariş özeti</h2>
<table><tr><th>Ürün</th><th>Adet</th><th>Tutar (KDV dâhil)</th></tr>
${lines.map(l => `<tr><td>${esc(l.n)}</td><td>${l.q}</td><td>${l.p} ₺</td></tr>`).join("")}
<tr><td colspan="2"><b>Toplam</b> (ayrıca kargo bedeli yoktur)</td><td><b>${total} ₺</b></td></tr></table>
<p><b>Alıcı:</b> ${esc(b.name)} ${esc(b.surname)} · ${esc(b.email)} · ${esc(b.phone)}<br><b>Teslimat adresi:</b> ${esc(b.address)}, ${esc(b.city)}<br><b>Ödeme yöntemi:</b> ${esc(payMethod)}</p>
${doc("onbilgi")}${doc("mesafeli")}${doc("iade")}
</body></html>`;
}

// E-posta eki olarak (base64)
export function contractAttachment(order) {
  const bytes = new TextEncoder().encode(contractHtml(order));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { filename: `MDD-Studio-Siparis-${order.orderNo}-Sozlesme.html`, content: btoa(bin), type: "text/html" };
}
