# MDD Studio — mddstudio.co

مدد · **Midad** (mürekkep) · **Müddet** (süre) · **Meded** (yardım)

Estetik ile imanı buluşturan İslami tasarım markası MDD Studio'nun web sitesi.
Tek dosyalık statik site (TR/EN/AR, three.js 3D hero, sepet, iyzico entegrasyonu planlı).
DİDA Tasarım Ajansı Ltd. Şti.

## Yapı
- `index.html` — sitenin kendisi (hosting varsayılan olarak bunu sunar)
- `mdd-studio-site.html` — aynı içeriğin kaynak/yedek kopyası
- `robots.txt`, `sitemap.xml` — SEO

## Cloudflare Pages ile yayınlama
Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → bu repo:
- **Framework preset:** None
- **Build command:** (boş bırak)
- **Build output directory:** `/`

Her `main` push'unda otomatik yayınlanır. Özel alan adı (`mddstudio.co`) Pages → Custom domains'ten bağlanır.
