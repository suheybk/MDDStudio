// POST /api/auth/forgot-username {email} — kullanıcı adını hesabın e-postasına gönderir.
import { json, readJson, requireDb, normEmail, validEmail, rateLimit, clientIp, turnstileOk, siteUrl } from "../../_auth.js";
import { sendMail, brandedHtml, button } from "../../_mail.js";

const GENERIC = "Bu e-posta ile kayıtlı bir hesap varsa, kullanıcı adınızı bu adrese gönderdik.";

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env); if (noDb) return noDb;
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  const ip = clientIp(request);
  const email = normEmail(b.email);
  if (!validEmail(email)) return json({ error: "Geçerli bir e-posta adresi girin." }, 400);
  if (!(await rateLimit(env, "fu-ip:" + ip, 10, 3600))) return json({ error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." }, 429);
  if (!(await turnstileOk(env, b.cfToken, ip))) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayın." }, 403);

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (user && await rateLimit(env, "fu-user:" + user.id, 3, 3600)) {
    const site = siteUrl(env, request);
    const uname = user.username
      ? `<p>Kullanıcı adınız: <b style="font-size:17px">${esc(user.username)}</b></p><p>Giriş yaparken kullanıcı adınızı ya da e-posta adresinizi kullanabilirsiniz.</p>`
      : `<p>Hesabınızda bir kullanıcı adı tanımlı değil. Giriş yaparken e-posta adresinizi (<b>${esc(user.email)}</b>) kullanın. İsterseniz hesabım sayfasından bir kullanıcı adı belirleyebilirsiniz.</p>`;
    await sendMail(env, {
      to: user.email, subject: "MDD Studio kullanıcı adınız",
      text: `Merhaba ${user.name},\n\n` + (user.username ? `Kullanıcı adınız: ${user.username}\n` : `Hesabınızda kullanıcı adı yok; e-posta adresinizle giriş yapın: ${user.email}\n`) + `\nGiriş: ${site}/?giris=1`,
      html: brandedHtml("Kullanıcı adınız", `<p>Merhaba ${esc(user.name)},</p>${uname}${button(site + "/?giris=1", "Giriş yap")}`),
    }).catch(() => {});
  }
  return json({ ok: true, message: GENERIC });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
