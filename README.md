# AI Handbook

Teknik yazılar için konu başlığına göre filtrelenebilir, aranabilir statik bir site.
Veritabanı yok; her sayfa kendi meta bilgisini taşıyan tek dosyalık HTML.

## Kullanım

**Bir kaynaktan sayfa üretmek (Claude Code ile):**

```
> https://ornek.com/makale bunu özetle
```

`summarize-source` skill'i devreye girer, sayfayı çeker, `posts/` altına Türkçe bir HTML yazar ve
katalogu günceller.

**Kaynaksız, konu başlığından sayfa hazırlatmak:**

```
> Claude Code slash command'larıyla ilgili bir html hazırla
```

`topic-page` skill'i devreye girer: konuyu resmi dokümanlardan doğrulayıp aynı şablonla özgün bir
sayfa yazar.

**Mevcut sayfaları denetletmek:**

```
> sayfaları kontrol et
```

`page-auditor` subagent'i bilgi doğruluğunu, metaları, şablon uyumunu ve linkleri denetler,
bulduğunu düzeltir.

**Katalogu elle yenilemek:**

```bash
node scripts/build.mjs
```

**Önizleme:** `index.html` dosyasını tarayıcıda aç (çift tıklama yeterli). Çevrimdışı okumayı /
kurulabilirliği denemek için http gerekir: `python -m http.server` ya da `npx serve`.

## Yayınlama

Site tamamen statik — build adımı yok, herhangi bir statik hosting'e olduğu gibi yüklenebilir.

**GitHub Pages:** değişiklikleri `main`'e push et; **Settings → Pages → Deploy from a branch →
main / (root)** açıkken site `https://sdfkr22.github.io/ai-handbook/` adresinde yayına girer.

**Netlify / Cloudflare Pages:** repoyu bağla; build command boş, publish directory `.`

**Adres değişirse:** canonical, Open Graph, `sitemap.xml` ve `feed.xml` içindeki mutlak adresler
`scripts/build.mjs` içindeki `SITE` sabitinden üretilir. Başka bir alan adına taşırken orayı
güncelle ya da tek seferlik olarak `SITE_URL=https://ornek.com node scripts/build.mjs` çalıştır.

`robots.txt` de üretilir; ancak GitHub Pages'te proje siteleri alt dizinde durduğu için
tarayıcılar `sdfkr22.github.io/robots.txt` adresine bakar, bizimkini okumaz. Özel alan adında
(veya Netlify/Cloudflare'de) geçerli olur. Sitemap'i her hâlükârda Search Console'a doğrudan
verebilirsin: `…/ai-handbook/sitemap.xml`.

## Katkı

`main` korumalıdır — doğrudan push kapalı. Değişiklik için branch aç ve PR gönder; merge için
`.github/CODEOWNERS` uyarınca **@sdfkr22'nin onayı** gerekir.

Sayfa ekleyen/değiştiren PR'larda `node scripts/build.mjs` çıktısını da commit'e dahil et
(`data/`, `sitemap.xml`, `feed.xml`, `robots.txt`, `manifest.webmanifest`, `sw.js`, `offline.html`
ve script'in dokunduğu `posts/*.html` ile `index.html`) — aksi halde sayfa katalogda görünmez ve
çevrimdışı önbellek eski kalır.

## Yapı

| Yol | Ne işe yarar |
|---|---|
| `index.html` | Katalog: kategori filtresi + arama |
| `assets/` | Katalog stili (`site.css`), tema + filtre mantığı (`site.js`), ikonlar |
| `assets/fonts/` + `fonts.css` | Yerel yazı tipleri — **otomatik üretilir** (`fetch-fonts.mjs`) |
| `posts/*.html` | Sayfalar (her biri kendi kendine yeten tek dosya) |
| `archive/*.html` | Yayından çıkarılmış sayfalar — build taramaz |
| `templates/page-template.html` | Ortak HTML/CSS şablonu |
| `data/posts.js` + `.json` | Katalog verisi — **otomatik üretilir** |
| `sitemap.xml`, `feed.xml`, `robots.txt` | Arama motoru + RSS çıktısı — **otomatik üretilir** |
| `manifest.webmanifest`, `sw.js`, `offline.html` | Çevrimdışı okuma / PWA — **otomatik üretilir** |
| `scripts/fetch-fonts.mjs` | Yazı tiplerini indirir (yalnızca sürüm değişince) |
| `scripts/make-icons.mjs` | PWA PNG ikonlarını üretir (yalnızca işaret değişince) |
| `scripts/build.mjs` | `posts/` tarar, `data/` üretir, sayfalara ortak kabuğu enjekte eder |
| `.claude/skills/` | Sayfa üreten iki skill: `summarize-source`, `topic-page` |
| `.claude/agents/` | `page-auditor` — mevcut sayfaları denetler |

`build.mjs` her sayfaya geri linki, tema düğmesi, okuma süresi, kod bloğu dil etiketleri ve sayfa
sonundaki önceki/sonraki + ilgili yazılar bloğunu ekler; `<head>` tarafına da canonical, Open Graph,
Twitter, favicon, manifest ve feed bağlantılarını yazar. Çalıştırılmazsa yeni sayfa katalogda
görünmez.

## Okuma deneyimi

- **Çevrimdışı okuma:** site ilk açılışta tüm arşivi önbelleğe alır (`sw.js`); sonrasında bağlantı
  olmadan da okunur, telefona uygulama gibi kurulabilir. Sayfalar önce ağdan istenir, yani
  çevrimiçiyken hep güncel içerik gelir. `file://` üzerinden açıldığında service worker devreye
  girmez.
- **Okuma durumu:** kaldığın yer tarayıcıda saklanır — katalogda kartlarda "okundu"/yüzde rozeti,
  yazıda "kaldığın yere dön" satırı. Veri hiçbir yere gönderilmez, temizlemek için tarayıcı site
  verisini silmek yeterli.
- **Sıralama:** yeni→eski (varsayılan), eski→yeni ve okuma süresine göre; seçim hatırlanır.
- **Yazı tipleri yereldir:** site font için dışarıya istek atmaz.

Detaylar için `CLAUDE.md`.
