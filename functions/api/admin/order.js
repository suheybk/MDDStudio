// /api/admin/order?no=...&t=... — mağaza e-postasındaki "Ödeme geldi → faturayı kes" bağlantısı.
// GET yalnızca siparişi gösterir (e-posta tarayıcılarının önizlemesi bir şey tetiklemesin diye);
// işlem, sayfadaki düğmeyle yapılan POST ile olur: ödeme alındı olarak işaretlenir, e-Arşiv fatura kesilir,
// müşteriye faturalı "ödemeniz alındı" e-postası gider. Fatura kesilemezse aynı sayfadan yeniden denenebilir.
import { sha256, now } from "../../_auth.js";
import { invoiceAndNotify } from "../../_invoice.js";
import { uyumConfig } from "../../_uyumsoft.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STATUS = { awaiting_payment: "Havale bekleniyor", paid: "Ödeme alındı (fatura kesilemedi)", invoiced: "Ödendi · faturalandı", cancelled: "İptal" };

function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · MDD Studio</title>
<style>body{margin:0;background:#FDE7EF;font:15px/1.55 Arial,sans-serif;color:#1F2A56;padding:24px 14px}.b{max-width:560px;margin:0 auto;background:#FFFCF7;border-radius:18px;padding:24px}
h1{font:bold 20px Georgia,serif;margin:0 0 14px}table{border-collapse:collapse;width:100%}td{padding:6px 0;border-bottom:1px solid #F1DCE6;vertical-align:top}.m{color:#6B6F8E}
.s{display:inline-block;padding:4px 10px;border-radius:999px;background:#FFF1C9;font-weight:bold}.ok{background:#DDF3E4}.err{background:#FFD9D9;padding:10px 12px;border-radius:10px}
button{margin-top:18px;background:#1F2A56;color:#fff;border:0;border-radius:999px;padding:13px 22px;font-weight:bold;font-size:15px;cursor:pointer}.t{background:#FFF1C9;padding:8px 12px;border-radius:10px;font-size:13px}</style></head>
<body><div class="b">${body}</div></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
}

async function load(env, url) {
  const no = url.searchParams.get("no") || "", t = url.searchParams.get("t") || "";
  if (!env.DB || !no || !t) return null;
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(no).first();
  if (!o || o.admin_token_hash !== await sha256(t)) return null;
  return o;
}

function view(env, o, url, note = "") {
  const b = JSON.parse(o.buyer_json), lines = JSON.parse(o.lines_json);
  const test = !uyumConfig(env).live;
  const canInvoice = o.status === "awaiting_payment" || (o.status === "paid" && !o.invoice_no);
  return page(`#${o.id}`, `<h1>Sipariş #${esc(o.id)}</h1>
<p><span class="s ${o.status === "invoiced" ? "ok" : ""}">${esc(STATUS[o.status] || o.status)}</span> <span class="m">${new Date(o.created_at * 1000).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</span></p>
${note}
<table><tr><td class="m" style="width:110px">Müşteri</td><td><b>${esc(b.name)} ${esc(b.surname)}</b><br>${esc(b.email)} · ${esc(b.phone)}</td></tr>
<tr><td class="m">Adres</td><td>${esc(b.address)}, ${esc(b.city)}</td></tr>
${lines.map(l => `<tr><td class="m">× ${l.q}</td><td>${esc(l.n)} — ${l.p} ₺</td></tr>`).join("")}
<tr><td class="m">Toplam</td><td><b>${o.total} ₺</b> (havale açıklaması: ${esc(o.id)})</td></tr>
${o.invoice_no ? `<tr><td class="m">Fatura</td><td>${esc(o.invoice_no)}</td></tr>` : ""}
${o.invoice_error ? `<tr><td class="m">Son hata</td><td>${esc(o.invoice_error)}</td></tr>` : ""}</table>
${canInvoice ? `<form method="post" action="${esc(url.pathname + url.search)}">
${test ? `<p class="t">Fatura şu an <b>TEST</b> modunda (Uyumsoft test ortamı) — gerçek fatura kesilmez. Canlıya almak için Cloudflare'de UYUMSOFT_ENV=live.</p>` : ""}
<button type="submit">${o.status === "awaiting_payment" ? `${o.total} ₺ hesaba geçti — faturayı kes ve müşteriye bildir` : "Faturayı yeniden dene"}</button>
<p class="m" style="font-size:13px">Tutarı ve açıklamadaki sipariş numarasını banka hesabınızda kontrol ettikten sonra basın. İşlem 20–40 saniye sürebilir.</p></form>` : ""}`);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const o = await load(env, url);
  if (!o) return page("Bulunamadı", "<h1>Bağlantı geçersiz</h1><p>Sipariş bulunamadı ya da bağlantı hatalı.</p>", 404);
  return view(env, o, url);
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const o = await load(env, url);
  if (!o) return page("Bulunamadı", "<h1>Bağlantı geçersiz</h1>", 404);
  const t = now();
  // Aynı anda iki kez basılırsa yalnızca biri işlesin
  const claim = await env.DB.prepare(
    "UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ?, invoice_error = 'işleniyor' WHERE id = ? AND (status = 'awaiting_payment' OR (status = 'paid' AND invoice_no IS NULL AND (invoice_error IS NULL OR invoice_error <> 'işleniyor' OR updated_at < ?)))"
  ).bind(t, t, o.id, t - 120).run();
  if (!claim.meta || !claim.meta.changes) {
    const cur = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first();
    return view(env, cur, url, `<p class="err">Bu sipariş zaten işlenmiş ya da şu an işleniyor.</p>`);
  }
  const paidAt = new Date((o.paid_at || t) * 1000);
  const r = await invoiceAndNotify(env, {
    orderNo: o.id, buyer: JSON.parse(o.buyer_json), lines: JSON.parse(o.lines_json), total: o.total,
    paidAt, paymentType: "EFT/HAVALE", paymentMidier: "Vakıf Katılım (havale/EFT)",
  });
  if (r.invoice) {
    await env.DB.prepare("UPDATE orders SET status = 'invoiced', invoice_no = ?, invoice_uuid = ?, invoice_error = NULL, updated_at = ? WHERE id = ?")
      .bind(r.invoice.number, r.invoice.uuid, now(), o.id).run();
  } else {
    await env.DB.prepare("UPDATE orders SET invoice_error = ?, updated_at = ? WHERE id = ?").bind(String(r.error || "bilinmeyen hata").slice(0, 300), now(), o.id).run();
  }
  const cur = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first();
  const note = r.invoice
    ? `<p class="s ok" style="display:block;border-radius:10px;padding:10px 12px">Fatura ${esc(r.invoice.number)} kesildi; müşteriye "ödemeniz alındı" e-postası${r.pdf ? " faturasıyla" : ""} gönderildi. Siparişi hazırlayabilirsiniz.</p>`
    : `<p class="err">Ödeme alındı olarak işaretlendi, ancak fatura kesilemedi: ${esc(r.error)}. Müşteriye "ödemeniz alındı" e-postası gitti. Aşağıdan yeniden deneyin ya da Uyumsoft portalından elle kesin.</p>`;
  return view(env, cur, url, note);
}
