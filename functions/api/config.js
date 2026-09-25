// GET /api/config — ön yüzün ihtiyaç duyduğu herkese açık ayarlar.
// TURNSTILE_SITE_KEY herkese açık bir anahtardır (gizli değildir); Cloudflare Pages > Settings > Variables altında tanımlanır.
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
