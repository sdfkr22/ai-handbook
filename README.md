# AI Handbook

Teknik yazılar için konu başlığına göre filtrelenebilir, aranabilir statik bir site.
Veritabanı yok; her sayfa kendi meta bilgisini taşıyan tek dosyalık HTML.

## Kullanım

**Bir kaynaktan sayfa üretmek (Claude Code ile):**

```
> https://ornek.com/makale bunu özetle
```

`summarize-source` skill'i devreye girer, sayfayı çeker, `posts/` altına Türkçe bir HTML yazar ve
katalogu günceller. Sonraki linklerde de aynı akış otomatik çalışır.

**Kaynaksız, konu başlığından sayfa hazırlatmak:**

```
> Claude Code slash command'larıyla ilgili bir html hazırla
```

`topic-page` skill'i devreye girer: konuyu resmi dokümanlardan doğrulayıp aynı şablonla özgün bir
sayfa yazar.

**Katalogu elle yenilemek:**

```bash
node scripts/build.mjs
```

**Önizleme:** `index.html` dosyasını tarayıcıda aç (çift tıklama yeterli).

## Yayınlama

Site tamamen statik — herhangi bir statik hosting'e olduğu gibi yüklenebilir.

**GitHub Pages:**

```bash
git init && git add -A && git commit -m "AI Handbook"
gh repo create ai-handbook --public --source=. --push
```

Sonra repo ayarlarından **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Site `https://<kullanici>.github.io/ai-handbook/` adresinde yayına girer.

**Netlify / Cloudflare Pages:** repoyu bağla; build command boş, publish directory `.`

## Yapı

| Yol | Ne işe yarar |
|---|---|
| `index.html` | Katalog: kategori filtresi + arama |
| `posts/*.html` | Sayfalar (her biri kendi kendine yeten tek dosya) |
| `archive/*.html` | Yayından çıkarılmış sayfalar — build taramaz |
| `templates/page-template.html` | Ortak HTML/CSS şablonu |
| `data/posts.js` | Katalog verisi — **otomatik üretilir** |
| `scripts/build.mjs` | `posts/` tarar, `data/` üretir, geri linkini enjekte eder |
| `.claude/skills/summarize-source/` | Kaynaktan sayfa üretir |
| `.claude/skills/topic-page/` | Konu başlığından sayfa üretir |

Detaylar için `CLAUDE.md`.
