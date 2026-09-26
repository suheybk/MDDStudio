// POST /api/order — havale/EFT ile sipariş.
// Sepet sunucuda katalogla doğrulanır, sipariş veritabanına yazılır; müşteriye IBAN'lı onay, mağazaya
// "Ödeme geldi → faturayı kes" bağlantılı sipariş maili gider (bkz. functions/api/admin/order.js).
// Korumalar: gerçek IP zorunlu, Tor engeli, ülke/IP kısıtı, Turnstile CAPTCHA, IP başına deneme sınırı.
import { priceCart, sendHavaleOrderMails, payee } from "../_order.js";
import { json, readJson, turnstileOk, rateLimit, normEmail, validEmail, normPhone, randomToken, sha256, now, currentUser, siteUrl } from "../_auth.js";

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
  // Siparişi kaydet; mağaza e-postasındaki yönetim bağlantısı için tek kullanımlık olmayan gizli anahtar
  let adminUrl = null;
  if (env.DB) {
    try {
      const token = randomToken(), t = now();
      const user = await currentUser(env, request).catch(() => null);
      await env.DB.prepare(`INSERT INTO orders (id, created_at, updated_at, status, pay_method, user_id, buyer_json, lines_json, total, admin_token_hash)
        VALUES (?, ?, ?, 'awaiting_payment', 'havale', ?, ?, ?, ?, ?)`)
        .bind(orderNo, t, t, user ? user.id : null, JSON.stringify(buyer), JSON.stringify(lines), total, await sha256(token)).run();
      adminUrl = `${siteUrl(env, request)}/api/admin/order?no=${encodeURIComponent(orderNo)}&t=${token}`;
    } catch (e) { console.log("order save failed", e && e.message); }
  }
  await sendHavaleOrderMails(env, { orderNo, buyer, lines, total, adminUrl });
  const p = payee(env);
  return json({ ok: true, orderNo, total, payee: { iban: p.iban, name: p.name, bank: p.bank } });
}
