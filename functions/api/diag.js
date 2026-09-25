// GEÇİCİ: Cloudflare'den ödeme sağlayıcılarına bağlantı testi. Ölçümden sonra silinecek.
export async function onRequestGet({ request }) {
  if (new URL(request.url).searchParams.get("k") !== "b2b1b639225cba6b") return new Response("not found", { status: 404 });
  const targets = {
    iyzico_sandbox: "https://sandbox-api.iyzipay.com/payment/test",
    iyzico_live: "https://api.iyzipay.com/payment/test",
    vakifkatilim_gateway: "https://boa.vakifkatilim.com.tr/VirtualPOS.Gateway/Home/ThreeDModelPayGate",
    vakifkatilim_common: "https://boa.vakifkatilim.com.tr/VirtualPOS.Gateway/CommonPaymentPage/CommonPaymentPage",
  };
  const out = {};
  for (const [name, url] of Object.entries(targets)) {
    const t = Date.now();
    try { const r = await fetch(url, { method: "GET", redirect: "manual" }); out[name] = r.status + " (" + (Date.now() - t) + " ms)"; }
    catch (e) { out[name] = "HATA: " + String(e && e.message || e).slice(0, 100); }
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
