// GEÇİCİ: Cloudflare'den Uyumsoft erişim kontrolü. Yalnızca sorgu (IsEInvoiceUser) yapar, fatura KESMEZ. Kontrolden sonra silinecek.
import { isEInvoiceUser } from "../_uyumsoft.js";

async function check(env) {
  const t = Date.now();
  try { return { ok: true, value: await isEInvoiceUser(env, "2951167976"), ms: Date.now() - t }; }
  catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160), ms: Date.now() - t }; }
}

export async function onRequestGet({ env }) {
  const test = await check({});
  const live = env.UYUMSOFT_USER && env.UYUMSOFT_PASSWORD
    ? await check({ UYUMSOFT_ENV: "live", UYUMSOFT_USER: env.UYUMSOFT_USER, UYUMSOFT_PASSWORD: env.UYUMSOFT_PASSWORD })
    : { ok: false, error: "canlı kullanıcı/şifre tanımlı değil" };
  return Response.json({ test, live, liveMode: env.UYUMSOFT_ENV === "live" });
}
