// Müşteri hesapları için ortak yardımcılar (D1 binding: DB).
// "_" ile başladığı için Pages bu dosyayı bir adres olarak yayınlamaz.

const enc = new TextEncoder();
export const SESSION_COOKIE = "mdd_sid";
export const SESSION_DAYS = 30;
// Cloudflare Workers PBKDF2 için en fazla 100.000 tur destekler.
const PBKDF2_ITER = 100000;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const now = () => Math.floor(Date.now() / 1000);
export const newId = () => crypto.randomUUID();
export const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
export const sha256 = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

export function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export function siteUrl(env, request) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

// ---- şifre ----
async function derive(password, saltHex, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}
export async function hashPassword(password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { pass_hash: await derive(password, salt, PBKDF2_ITER), pass_salt: salt, pass_iter: PBKDF2_ITER };
}
export async function verifyPassword(password, user) {
  if (!user || !user.pass_hash) return false;
  const h = await derive(password, user.pass_salt, user.pass_iter || PBKDF2_ITER);
  // sabit zamanlı karşılaştırma
  if (h.length !== user.pass_hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ user.pass_hash.charCodeAt(i);
  return diff === 0;
}

// ---- doğrulama kuralları ----
export const normEmail = e => String(e || "").trim().toLowerCase();
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
export const normUsername = u => String(u || "").trim().toLowerCase();
export const validUsername = u => /^[a-z0-9_.]{3,24}$/.test(u);
export function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.length === 10 ? d : "";
}
export function passwordProblem(p) {
  p = String(p || "");
  if (p.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (p.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(p) || !/\d/.test(p)) return "Şifre en az bir harf ve bir rakam içermeli.";
  return "";
}

// ---- oturum ----
function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export async function createSession(env, userId) {
  const token = randomToken();
  const t = now();
  await env.DB.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, t, t + SESSION_DAYS * 86400).run();
  return cookie(SESSION_COOKIE, token, SESSION_DAYS * 86400);
}
export const clearSessionCookie = () => cookie(SESSION_COOKIE, "", 0);

export function readCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : "";
}

export async function currentUser(env, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ?"
  ).bind(await sha256(token), now()).first();
  return row || null;
}

export async function destroySession(env, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(token)).run();
}

export function publicUser(u) {
  if (!u) return null;
  return {
    name: u.name, email: u.email, username: u.username || "", phone: u.phone || "",
    address: u.address || "", city: u.city || "", emailVerified: !!u.email_verified,
    hasPassword: !!u.pass_hash, google: !!u.google_sub,
  };
}

// ---- tek kullanımlık bağlantılar (şifre sıfırlama, e-posta doğrulama) ----
export async function issueToken(env, userId, kind, ttlSec) {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO tokens (id_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, kind, now() + ttlSec).run();
  return token;
}
export async function consumeToken(env, token, kind) {
  if (!token) return null;
  const h = await sha256(token);
  const row = await env.DB.prepare("SELECT * FROM tokens WHERE id_hash = ? AND kind = ? AND used = 0 AND expires_at > ?")
    .bind(h, kind, now()).first();
  if (!row) return null;
  await env.DB.prepare("UPDATE tokens SET used = 1 WHERE id_hash = ?").bind(h).run();
  return row.user_id;
}

// ---- deneme sınırı ----
// limit: pencere içinde izin verilen istek sayısı; true = izin var
export async function rateLimit(env, key, limit, windowSec) {
  const t = now();
  const row = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || t - row.window_start >= windowSec) {
    await env.DB.prepare("INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)").bind(key, t).run();
    // Ara sıra temizlik: 24 saatten eski deneme kayıtları, süresi dolmuş oturum ve bağlantılar silinir
    if (Math.random() < 0.05) await cleanup(env, t).catch(() => {});
    return true;
  }
  if (row.count >= limit) return false;
  await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}
async function cleanup(env, t) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(t - 86400),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t),
    env.DB.prepare("DELETE FROM tokens WHERE expires_at < ?").bind(t - 86400),
  ]);
}
export const clientIp = request => request.headers.get("cf-connecting-ip") || "0.0.0.0";

// ---- CAPTCHA (Turnstile) ----
export async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // kurulmamışsa atla
  const fd = new FormData();
  fd.append("secret", env.TURNSTILE_SECRET);
  fd.append("response", String(token || ""));
  fd.append("remoteip", ip);
  try {
    const r = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd })).json();
    return !!r.success;
  } catch { return false; }
}

export function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  const m = s => s.length <= 2 ? s[0] + "*" : s[0] + "*".repeat(Math.min(s.length - 2, 6)) + s[s.length - 1];
  const parts = domain.split(".");
  return `${m(local)}@${m(parts[0])}.${parts.slice(1).join(".")}`;
}

export function requireDb(env) {
  return env.DB ? null : json({ error: "Hesap sistemi henüz yapılandırılmadı." }, 424);
}
