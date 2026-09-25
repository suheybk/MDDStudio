// GEÇİCİ: Cloudflare'den Uyumsoft TEST servisine erişim kontrolü (herkese açık test kullanıcısıyla). Kontrolden sonra silinecek.
import { isEInvoiceUser } from "../_uyumsoft.js";

export async function onRequestGet() {
  const t = Date.now();
  try {
    const v = await isEInvoiceUser({}, "9000068418");
    return Response.json({ ok: true, isEInvoiceUser: v, ms: Date.now() - t });
  } catch (e) {
    return Response.json({ ok: false, error: String(e && e.message || e), ms: Date.now() - t }, { status: 424 });
  }
}
