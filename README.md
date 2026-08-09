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

**Önizleme:** `index.html` dosyasını tarayıcıda aç (çift tıklama yeterli).

## Yayınlama

Site tamamen statik — build adımı yok, herhangi bir statik hosting'e olduğu gibi yüklenebilir.

**GitHub Pages:** değişiklikleri `main`'e push et; **Settings → Pages → Deploy from a branch →
main / (root)** açıkken site `https://sdfkr22.github.io/ai-handbook/` adresinde yayına girer.

**Netlify / Cloudflare Pages:** repoyu bağla; build command boş, publish directory `.`

## Yapı

| Yol | Ne işe yarar |
|---|---|
| `index.html` | Katalog: kategori filtresi + arama |
| `assets/` | Katalog stili (`site.css`) ve tema + filtre mantığı (`site.js`) |
| `posts/*.html` | Sayfalar (her biri kendi kendine yeten tek dosya) |
| `archive/*.html` | Yayından çıkarılmış sayfalar — build taramaz |
| `templates/page-template.html` | Ortak HTML/CSS şablonu |
| `data/posts.js` + `.json` | Katalog verisi — **otomatik üretilir** |
| `scripts/build.mjs` | `posts/` tarar, `data/` üretir, sayfalara ortak kabuğu enjekte eder |
| `.claude/skills/` | Sayfa üreten iki skill: `summarize-source`, `topic-page` |
| `.claude/agents/` | `page-auditor` — mevcut sayfaları denetler |

`build.mjs` her sayfaya geri linki, tema düğmesi, okuma süresi ve sayfa sonundaki
önceki/sonraki + ilgili yazılar bloğunu ekler. Çalıştırılmazsa yeni sayfa katalogda görünmez.

Detaylar için `CLAUDE.md`.
