// GET /api/auth/google — Google ile giriş başlatır (OAuth 2.0 / OpenID Connect, authorization code akışı).
// Gerekli ayarlar: GOOGLE_CLIENT_ID (Text), GOOGLE_CLIENT_SECRET (Secret).
// Google Cloud'da yetkili yönlendirme adresi: https://mddstudio.co/api/auth/google/callback
import { randomToken, siteUrl } from "../../../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response(null, { status: 302, headers: { Location: "/?hesap=google-kapali" } });
  }
  const state = randomToken();
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  u.searchParams.set("redirect_uri", siteUrl(env, request) + "/api/auth/google/callback");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return new Response(null, {
    status: 302,
    headers: {
      Location: u.toString(),
      "Set-Cookie": `mdd_gstate=${state}; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
