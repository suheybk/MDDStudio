// GET /api/auth/verify?t=... — e-posta doğrulama bağlantısı
import { consumeToken, now } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get("t");
  let ok = false;
  if (env.DB && t) {
    const uid = await consumeToken(env, t, "verify");
    if (uid) {
      await env.DB.prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?").bind(now(), uid).run();
      ok = true;
    }
  }
  return new Response(null, { status: 302, headers: { Location: ok ? "/?hesap=dogrulandi" : "/?hesap=dogrulama-gecersiz" } });
}
