// GET /api/config — ön yüzün ihtiyaç duyduğu herkese açık ayarlar.
// TURNSTILE_SITE_KEY ve GOOGLE_CLIENT_ID herkese açık değerlerdir (gizli değildir).
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    googleLogin: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    accounts: !!env.DB,
  }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
