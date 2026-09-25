// POST /api/auth/logout
import { json, destroySession, clearSessionCookie } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  if (env.DB) await destroySession(env, request);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
