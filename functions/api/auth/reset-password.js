// POST /api/auth/reset-password {token, password} — tek kullanımlık bağlantıyla yeni şifre belirler,
// diğer tüm oturumları kapatır ve yeni oturum açar.
import { json, readJson, requireDb, passwordProblem, hashPassword, consumeToken, createSession, now, rateLimit, clientIp, publicUser } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env); if (noDb) return noDb;
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  if (!(await rateLimit(env, "rp-ip:" + clientIp(request), 20, 3600))) return json({ error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." }, 429);
  const pp = passwordProblem(b.password); if (pp) return json({ error: pp }, 400);
  const uid = await consumeToken(env, String(b.token || ""), "reset");
  if (!uid) return json({ error: "Bağlantının süresi dolmuş ya da daha önce kullanılmış. \"Şifremi unuttum\" ile yeni bağlantı isteyin." }, 400);
  const ph = await hashPassword(String(b.password));
  // bağlantı e-postaya geldiği için adres de doğrulanmış sayılır
  await env.DB.prepare("UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iter = ?, email_verified = 1, updated_at = ? WHERE id = ?")
    .bind(ph.pass_hash, ph.pass_salt, ph.pass_iter, now(), uid).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid).run();
  await env.DB.prepare("UPDATE tokens SET used = 1 WHERE user_id = ? AND kind = 'reset'").bind(uid).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first();
  return json({ ok: true, user: publicUser(user) }, 200, { "Set-Cookie": await createSession(env, uid) });
}
