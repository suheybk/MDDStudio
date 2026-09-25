// POST /api/order — sipariş talebi (çevrimiçi ödeme altyapısı bağlanana kadar).
// Sepet sunucuda katalogla doğrulanır, mağazaya "SİPARİŞ TALEBİ" ve müşteriye onay maili gider.
// Korumalar: gerçek IP zorunlu, Tor engeli, ülke/IP kısıtı, Turnstile CAPTCHA, IP başına deneme sınırı.
import { priceCart, sendOrderRequestMails } from "../_order.js";
import { json, readJson, turnstileOk, rateLimit, normEmail, validEmail, normPhone } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  if (!b) return json({ error: "Geçersiz istek." }, 400);

  // ---- IP kontrolü ----
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return json({ error: "İstek doğrulanamadı." }, 400);
  const country = (request.cf && request.cf.country) || "";
  if (country === "T1") return json({ error: "Bu ağ üzerinden sipariş verilemiyor." }, 403);
  const allowed = (env.ALLOWED_COUNTRIES || "").split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(country)) return json({ error: "Bu ülkeden sipariş kabul edilmiyor." }, 403);
  const blocked = (env.BLOCKED_IPS || "").split(",").map(x => x.trim()).filter(Boolean);
  if (blocked.includes(ip)) return json({ error: "İstek reddedildi." }, 403);
  if (env.DB && !(await rateLimit(env, "order-ip:" + ip, 10, 3600))) return json({ error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." }, 429);

  // ---- CAPTCHA ----
  if (!(await turnstileOk(env, b.cfToken, ip))) return json({ error: "Güvenlik doğrulaması başarısız. Lütfen doğrulamayı tamamlayıp tekrar deneyin." }, 403);

  // ---- sepet ve alıcı ----
  const { lines, total } = priceCart(b.items, env);
  if (!lines.length) return json({ error: "Sepet boş veya geçersiz." }, 400);
  const clip = (v, n) => String(v ?? "").trim().slice(0, n);
  const buyer = {
    name: clip(b.buyer && b.buyer.name, 50), surname: clip(b.buyer && b.buyer.surname, 50),
    email: normEmail(b.buyer && b.buyer.email), phone: clip(b.buyer && b.buyer.phone, 20),
    address: clip(b.buyer && b.buyer.address, 200), city: clip(b.buyer && b.buyer.city, 40),
  };
  if (!buyer.name || !buyer.surname || !buyer.address || !buyer.city) return json({ error: "Lütfen ad, soyad, adres ve şehir bilgilerini doldurun." }, 400);
  if (!validEmail(buyer.email)) return json({ error: "Geçerli bir e-posta adresi girin." }, 400);
  if (!normPhone(buyer.phone)) return json({ error: "Telefonu 05xx xxx xx xx biçiminde girin." }, 400);

  const orderNo = "MDD" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 90 + 10);
  await sendOrderRequestMails(env, { orderNo, buyer, lines, total });
  return json({ ok: true, orderNo, total });
}
