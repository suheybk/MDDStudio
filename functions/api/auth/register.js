// POST /api/auth/register — e-posta + şifre ile hesap oluşturur, oturum açar, doğrulama maili gönderir.
import { json, readJson, requireDb, normEmail, validEmail, normUsername, validUsername, normPhone, passwordProblem,
  hashPassword, createSession, newId, now, rateLimit, clientIp, turnstileOk, publicUser, issueToken, siteUrl } from "../../_auth.js";
import { sendMail, brandedHtml, button } from "../../_mail.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env); if (noDb) return noDb;
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  const ip = clientIp(request);
  if (!(await rateLimit(env, "reg:" + ip, 5, 3600))) return json({ error: "Çok fazla deneme. Lütfen bir saat sonra tekrar deneyin." }, 429);
  if (!(await turnstileOk(env, b.cfToken, ip))) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayın." }, 403);

  const name = String(b.name || "").trim().slice(0, 80);
  const email = normEmail(b.email);
  const username = normUsername(b.username);
  const phone = b.phone ? normPhone(b.phone) : "";
  if (!name) return json({ error: "Ad soyad gerekli." }, 400);
  if (!validEmail(email)) return json({ error: "Geçerli bir e-posta adresi girin." }, 400);
  if (username && !validUsername(username)) return json({ error: "Kullanıcı adı 3–24 karakter olmalı; yalnızca harf, rakam, nokta ve alt çizgi." }, 400);
  if (b.phone && !phone) return json({ error: "Telefonu 05xx xxx xx xx biçiminde girin." }, 400);
  const pp = passwordProblem(b.password); if (pp) return json({ error: pp }, 400);
  if (!b.kvkk) return json({ error: "Devam etmek için KVKK Aydınlatma Metni'ni onaylayın." }, 400);

  const exists = await env.DB.prepare("SELECT email, username FROM users WHERE email = ? OR (username IS NOT NULL AND username = ?)")
    .bind(email, username || "\u0000").first();
  if (exists) {
    return json({ error: exists.email === email
      ? "Bu e-posta ile zaten bir hesap var. Giriş yapın ya da şifrenizi sıfırlayın."
      : "Bu kullanıcı adı alınmış, başka bir tane deneyin." }, 409);
  }
  if (phone) {
    const pt = await env.DB.prepare("SELECT 1 FROM users WHERE phone = ?").bind(phone).first();
    if (pt) return json({ error: "Bu telefon numarası başka bir hesapta kayıtlı." }, 409);
  }

  const id = newId(), t = now();
  const ph = await hashPassword(String(b.password));
  await env.DB.prepare(`INSERT INTO users (id, email, username, name, phone, pass_hash, pass_salt, pass_iter, email_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
    .bind(id, email, username || null, name, phone || null, ph.pass_hash, ph.pass_salt, ph.pass_iter, t, t).run();

  const vt = await issueToken(env, id, "verify", 7 * 86400);
  const link = `${siteUrl(env, request)}/api/auth/verify?t=${vt}`;
  await sendMail(env, {
    to: email, subject: "MDD Studio hesabınızı doğrulayın",
    text: `Merhaba ${name},\n\nMDD Studio'ya hoş geldiniz. E-posta adresinizi doğrulamak için bu bağlantıyı açın:\n${link}\n\nBağlantı 7 gün geçerlidir.`,
    html: brandedHtml("Hoş geldiniz!", `<p>Merhaba ${esc(name)},</p><p>MDD Studio hesabınız oluşturuldu. E-posta adresinizi doğrulamak için aşağıdaki düğmeye dokunun.</p>${button(link, "E-postamı doğrula")}<p style="font-size:13px;color:#6B6F8E">Bağlantı 7 gün geçerlidir.</p>`),
  }).catch(() => {});

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return json({ ok: true, user: publicUser(user) }, 200, { "Set-Cookie": await createSession(env, id) });
}
