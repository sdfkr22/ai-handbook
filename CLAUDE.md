# AI Handbook (`ai-handbook`)

Teknik yazıları yayınlayan **statik** bir site. Veritabanı yok, build aracı yok, bağımlılık yok —
sadece HTML/CSS/JS ve tek bir Node script'i.

## En önemli kural

Siteye yeni bir sayfa eklenirken **her zaman ilgili skill kullanılır**; sayfa elle, skill atlanarak
yazılmaz. Hangisinin kullanılacağı elde kaynak olup olmamasına bağlıdır:

| Durum | Skill |
|---|---|
| Kullanıcı bir link paylaştı ("şunu özetle" veya sadece URL) ya da dosya yükledi (PDF/md/docx) | `summarize-source` |
| Kullanıcı sadece bir konu başlığı verdi ("slash command'larla ilgili bir html hazırla") | `topic-page` |

İkisi de aynı şablonu (`templates/page-template.html`), aynı çıktı klasörünü (`posts/`) ve aynı
build adımını kullanır — bu yüzden tüm sayfalar birebir aynı görünür. Sayfalar arasında "özet" /
"rehber" gibi bir tür ayrımı **yoktur**; hepsi eşit statüde birer yazıdır.

## Sayfa dili ve çerçevesi

- İçerik Türkçedir; teknik terimler ve bölüm başlıkları orijinal dilinde bırakılır.
- **Dosya ve klasör adları İngilizcedir** — ASCII, kebab-case (`posts/hooks-guide.html` gibi).
  Türkçe karakter veya Türkçe sözcük kullanılmaz; içerik Türkçe kalır, adlar İngilizce.
- **Hiçbir yerde gradient kullanılmaz.** Arka planlar, kartlar, düğmeler — hepsi düz renk
  (`var(--bg)`, `var(--panel)` gibi). `linear-gradient` / `radial-gradient` eklenmez.
- **Sayfayı "özet", "çeviri", "derleme rehber" diye etiketleme.** `<title>`, kicker ve footer'da
  "Türkçe Özet", "Bu sayfanın Türkçe özetidir" gibi ibareler kullanılmaz — sayfa kendi başına bir
  içerik olarak durur. Kaynak yalnızca `.source` satırında ve footer'da link olarak verilir.

## Yapı

```
index.html                        Katalog sayfası: kategori filtresi + arama. Elle düzenlenir.
assets/site.css                   Katalog stili (sayfalarla aynı editoryal tema, koyu + açık).
assets/site.js                    Tema düğmesi + filtre/arama mantığı. window.YAZILAR dizisini okur.
posts/*.html                      Her sayfa ayrı, kendi kendine yeten tek dosya.
archive/*.html                    Yayından çıkarılmış sayfalar. Build taramaz, katalogda görünmez.
templates/page-template.html      Ortak HTML/CSS şablonu — iki skill de bunu kullanır.
data/posts.js                     window.YAZILAR — OTOMATİK ÜRETİLİR, elle düzenleme.
data/posts.json                   Aynı veri, JSON olarak. OTOMATİK ÜRETİLİR.
scripts/build.mjs                 posts/ klasörünü tarar, data/ dosyalarını üretir.
.claude/skills/summarize-source/  Kaynaktan Türkçe sayfa üretir.
.claude/skills/topic-page/        Konu başlığından özgün sayfa üretir.
```

## Katalog nasıl besleniyor

Her sayfa kendi meta bilgisini `<head>` içinde taşır; ayrı bir kayıt defteri yok:

```html
<meta name="yazi:baslik"    content="…">
<meta name="yazi:aciklama"  content="…">
<meta name="yazi:kategori"  content="Claude Code">
<meta name="yazi:etiketler" content="virgülle, ayrılmış">
<meta name="yazi:kaynak"    content="https://…">   <!-- tek kaynak yoksa boş -->
<meta name="yazi:tarih"     content="YYYY-AA-GG">
```

`node scripts/build.mjs` bu etiketleri toplayıp `data/posts.js` dosyasını yeniden yazar.
Meta eksikse script `<title>`, `.lede` ve `.source` linkinden tahmin eder ve uyarı basar.
Ayrıca her sayfaya ortak kabuğu enjekte eder (idempotent; blok değişmişse günceller):
"← Tüm yazılar" geri linki, açık tema override'ları ve tema düğmesi.

**Yeni bir sayfa ekledikten sonra `node scripts/build.mjs` çalıştırmak zorunludur** — aksi halde
sayfa sitede görünmez.

## Kategoriler

Kategori listesi sabit değil; dosyalardaki `yazi:kategori` değerlerinden türetilir.
Yeni sayfa eklerken önce `data/posts.json` içindeki mevcut kategorilere bak ve uyanı
**birebir aynı yazımla** kullan. Kategori sayısını şişirme — konu başlığı seviyesinde tut.

## Yerel önizleme

`index.html` dosyasını doğrudan tarayıcıda açmak yeterlidir (veri `.js` olarak yüklendiği için
`file://` üzerinde de çalışır, CORS sorunu yok). İstersen: `npx serve .` veya `python -m http.server`.
