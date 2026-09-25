// GET  /api/auth/me — oturumdaki müşteri (yoksa null)
// POST /api/auth/me — profil güncelleme (ad, kullanıcı adı, telefon, adres, şehir)
import { json, readJson, currentUser, publicUser, normUsername, validUsername, normPhone, now } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  const u = env.DB ? await currentUser(env, request) : null;
  return json({ user: publicUser(u) });
}

export async function onRequestPost({ request, env }) {
  const u = env.DB ? await currentUser(env, request) : null;
  if (!u) return json({ error: "Oturum açmanız gerekiyor." }, 401);
  const b = await readJson(request); if (!b) return json({ error: "Geçersiz istek." }, 400);
  const name = String(b.name ?? u.name).trim().slice(0, 80) || u.name;
  const username = b.username === undefined ? (u.username || "") : normUsername(b.username);
  if (username && !validUsername(username)) return json({ error: "Kullanıcı adı 3–24 karakter olmalı; yalnızca harf, rakam, nokta ve alt çizgi." }, 400);
  if (username && username !== u.username) {
    const taken = await env.DB.prepare("SELECT 1 FROM users WHERE username = ? AND id != ?").bind(username, u.id).first();
    if (taken) return json({ error: "Bu kullanıcı adı alınmış." }, 409);
  }
  const phone = b.phone === undefined ? (u.phone || "") : (b.phone ? normPhone(b.phone) : "");
  if (b.phone && !phone) return json({ error: "Telefonu 05xx xxx xx xx biçiminde girin." }, 400);
  if (phone && phone !== u.phone) {
    const pt = await env.DB.prepare("SELECT 1 FROM users WHERE phone = ? AND id != ?").bind(phone, u.id).first();
    if (pt) return json({ error: "Bu telefon numarası başka bir hesapta kayıtlı." }, 409);
  }
  const address = String(b.address ?? u.address ?? "").trim().slice(0, 200);
  const city = String(b.city ?? u.city ?? "").trim().slice(0, 40);
  await env.DB.prepare("UPDATE users SET name = ?, username = ?, phone = ?, address = ?, city = ?, updated_at = ? WHERE id = ?")
    .bind(name, username || null, phone || null, address || null, city || null, now(), u.id).run();
  const fresh = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
  return json({ ok: true, user: publicUser(fresh) });
}
