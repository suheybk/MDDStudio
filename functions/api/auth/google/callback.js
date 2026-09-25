// GET /api/auth/google/callback — Google dönüşü: kodu jetonla değiştirir, hesabı bulur/bağlar/oluşturur, oturum açar.
import { readCookie, createSession, newId, now, normEmail, siteUrl } from "../../../_auth.js";

const back = (loc, extra = []) => {
  const h = new Headers({ Location: loc });
  h.append("Set-Cookie", "mdd_gstate=; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  extra.forEach(c => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
};

function decodeJwtPayload(jwt) {
  const p = String(jwt || "").split(".")[1];
  if (!p) return null;
  const s = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0))));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return back("/?hesap=google-iptal");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = readCookie(request, "mdd_gstate");
  if (!code || !state || !saved || state !== saved) return back("/?hesap=google-hata");
  if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return back("/?hesap=google-kapali");

  let tok;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: siteUrl(env, request) + "/api/auth/google/callback", grant_type: "authorization_code",
      }),
    });
    tok = await r.json();
    if (!r.ok) { console.log("google token error", r.status, tok && tok.error); return back("/?hesap=google-hata"); }
  } catch (e) { console.log("google token fetch failed", e && e.message); return back("/?hesap=google-hata"); }

  // id_token doğrudan Google'ın jeton uç noktasından TLS ile alındığı için imza ayrıca doğrulanmadan kullanılabilir (OIDC 3.1.3.7)
  const c = decodeJwtPayload(tok.id_token);
  if (!c || c.aud !== env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(c.iss) || c.exp < now()) {
    return back("/?hesap=google-hata");
  }
  if (!c.email || !c.email_verified) return back("/?hesap=google-dogrulanmamis");

  const email = normEmail(c.email);
  let user = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ?").bind(c.sub).first();
  if (!user) {
    user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (user) {
      // aynı e-postayla açılmış hesabı Google'a bağla (Google e-postayı doğruladı)
      await env.DB.prepare("UPDATE users SET google_sub = ?, email_verified = 1, updated_at = ? WHERE id = ?").bind(c.sub, now(), user.id).run();
    } else {
      const id = newId(), t = now();
      await env.DB.prepare("INSERT INTO users (id, email, name, google_sub, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
        .bind(id, email, String(c.name || email.split("@")[0]).slice(0, 80), c.sub, t, t).run();
      user = { id };
    }
  }
  return back("/?hesap=google", [await createSession(env, user.id)]);
}
