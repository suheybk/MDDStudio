// POST /api/auth/forgot-email {phone | username} — hesaba kayıtlı e-postanın maskelenmiş hâlini gösterir
// (ör. s****k@g***l.com). Tam adres asla gösterilmez; CAPTCHA ve sıkı deneme sınırı uygulanır.
import { json, readJson, requireDb, normPhone, normUsername, rateLimit, clientIp, turnstileOk, maskEmail } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env); if (noDb) return noDb;
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  const ip = clientIp(request);
  const q = String(b.query || "").trim();
  if (!q) return json({ error: "Kayıtlı telefon numaranızı ya da kullanıcı adınızı girin." }, 400);
  if (!(await rateLimit(env, "fe-ip:" + ip, 5, 3600))) return json({ error: "Çok fazla deneme. Lütfen bir saat sonra tekrar deneyin." }, 429);
  if (!(await turnstileOk(env, b.cfToken, ip))) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayın." }, 403);

  const phone = normPhone(q);
  const user = phone
    ? await env.DB.prepare("SELECT email FROM users WHERE phone = ?").bind(phone).first()
    : await env.DB.prepare("SELECT email FROM users WHERE username = ?").bind(normUsername(q)).first();
  if (!user) return json({ ok: false, message: "Bu bilgiyle eşleşen bir hesap bulamadık. Farklı bir telefon numarası ya da kullanıcı adı deneyin; olmazsa info@mddstudio.co adresine yazın." });
  return json({ ok: true, hint: maskEmail(user.email), message: `Hesabınız şu e-posta adresine kayıtlı: ${maskEmail(user.email)}` });
}
