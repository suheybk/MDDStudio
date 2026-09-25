# MDD Studio — mddstudio.co

مدد · **Midad** (mürekkep) · **Müddet** (süre) · **Meded** (yardım)

Estetik ile imanı buluşturan İslami tasarım markası MDD Studio'nun web sitesi.
Tek dosyalık statik mağaza (kawaii tasarım, kategori şeridi, büyüteçli ürün galerisi, sepet, müşteri hesapları, sipariş talebi). Çevrimiçi ödeme: Vakıf Katılım sanal POS (entegrasyon bekleniyor).
DİDA Tasarım Ajansı Ltd. Şti.

## Yapı
- `index.html` — sitenin kendisi (hosting varsayılan olarak bunu sunar)
- `brand/` — logo dosyaları (SVG)
- `products/sahne/` — ürünlerin masa ve defter sahneleri (`*-masa.jpg`, `*-defter.jpg`); `products/*.jpg` tasarımın kendisi
- `functions/api/order.js` — sipariş talebi (mağazaya ve müşteriye mail). Ürün id ve fiyatları `functions/_order.js` içindeki `CATALOG` ile `index.html` içindeki `P` listesinde aynı olmalı.
- `functions/api/auth/` — müşteri hesapları (D1 binding `DB`, şema: `schema.sql`).
- `robots.txt`, `sitemap.xml` — SEO

## Cloudflare Pages ile yayınlama
Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → bu repo:
- **Framework preset:** None
- **Build command:** (boş bırak)
- **Build output directory:** `/`

Her `main` push'unda otomatik yayınlanır. Özel alan adı (`mddstudio.co`) Pages → Custom domains'ten bağlanır.
