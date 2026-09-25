// POST /api/auth/login — e-posta veya kullanıcı adı + şifre
import { json, readJson, requireDb, normEmail, normUsername, verifyPassword, createSession, rateLimit, clientIp, turnstileOk, publicUser } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env); if (noDb) return noDb;
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  const ip = clientIp(request);
  const login = String(b.login || "").trim();
  if (!login || !b.password) return json({ error: "E-posta/kullanıcı adı ve şifre gerekli." }, 400);
  if (!(await rateLimit(env, "login-ip:" + ip, 20, 900))) return json({ error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." }, 429);
  if (!(await rateLimit(env, "login-id:" + login.toLowerCase(), 8, 900))) return json({ error: "Bu hesap için çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin." }, 429);
  if (!(await turnstileOk(env, b.cfToken, ip))) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayın." }, 403);

  const user = login.includes("@")
    ? await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normEmail(login)).first()
    : await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(normUsername(login)).first();
  const ok = await verifyPassword(String(b.password), user);
  if (!ok) {
    if (user && !user.pass_hash && user.google_sub) {
      return json({ error: "Bu hesap Google ile açılmış. \"Google ile devam et\" düğmesini kullanın ya da şifre belirlemek için \"Şifremi unuttum\"a tıklayın." }, 401);
    }
    return json({ error: "E-posta/kullanıcı adı ya da şifre hatalı." }, 401);
  }
  return json({ ok: true, user: publicUser(user) }, 200, { "Set-Cookie": await createSession(env, user.id) });
}
