// POST /api/auth/forgot-password {login} — e-posta ya da kullanıcı adıyla şifre sıfırlama bağlantısı gönderir.
// Hesap olsun olmasın aynı yanıt döner (hangi adreslerin kayıtlı olduğu dışarıdan anlaşılamasın).
import { json, readJson, requireDb, normEmail, normUsername, rateLimit, clientIp, turnstileOk, issueToken, siteUrl } from "../../_auth.js";
import { sendMail, brandedHtml, button } from "../../_mail.js";

const GENERIC = "Bu bilgilerle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısını hesabın e-posta adresine gönderdik. Gelen kutunuzu (ve istenmeyen klasörünü) kontrol edin.";

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env); if (noDb) return noDb;
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  const ip = clientIp(request);
  const login = String(b.login || "").trim();
  if (!login) return json({ error: "E-posta adresinizi ya da kullanıcı adınızı girin." }, 400);
  if (!(await rateLimit(env, "fp-ip:" + ip, 10, 3600))) return json({ error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." }, 429);
  if (!(await turnstileOk(env, b.cfToken, ip))) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayın." }, 403);

  const user = login.includes("@")
    ? await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normEmail(login)).first()
    : await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(normUsername(login)).first();

  // aynı hesaba saatte en fazla 3 mail
  if (user && await rateLimit(env, "fp-user:" + user.id, 3, 3600)) {
    const token = await issueToken(env, user.id, "reset", 3600);
    const link = `${siteUrl(env, request)}/?sifre=${token}`;
    const title = user.pass_hash ? "Şifrenizi sıfırlayın" : "Şifre belirleyin";
    await sendMail(env, {
      to: user.email, subject: "MDD Studio şifre sıfırlama",
      text: `Merhaba ${user.name},\n\nŞifrenizi sıfırlamak için bu bağlantıyı açın (1 saat geçerli):\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.`,
      html: brandedHtml(title, `<p>Merhaba ${esc(user.name)},</p><p>Hesabınız için yeni bir şifre belirlemek üzere aşağıdaki düğmeye dokunun. Bağlantı <b>1 saat</b> geçerlidir ve yalnızca bir kez kullanılabilir.</p>${button(link, "Yeni şifre belirle")}<p style="font-size:13px;color:#6B6F8E">Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.</p>`),
    }).catch(() => {});
  }
  return json({ ok: true, message: GENERIC });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
