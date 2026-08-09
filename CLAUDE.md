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
- **Gradient yok** — arka plan, kart, düğme hepsi düz renk (`var(--bg)`, `var(--panel)` gibi).
- **Sayfayı "özet", "çeviri", "derleme rehber" diye etiketleme.** `<title>`, kicker ve footer'da
  "Türkçe Özet", "Bu sayfanın Türkçe özetidir" gibi ibareler kullanılmaz — sayfa kendi başına bir
  içerik olarak durur. Kaynak yalnızca `.source` satırında ve footer'da link olarak verilir.

## Yapı

```
index.html                    Katalog: kategori filtresi + arama. Sayfa eklerken dokunulmaz.
assets/                       Katalog stili (site.css) ve tema + filtre mantığı (site.js).
posts/*.html                  Her sayfa ayrı, kendi kendine yeten tek dosya.
archive/*.html                Yayından çıkarılmış sayfalar. Build taramaz, katalogda görünmez.
templates/page-template.html  Ortak HTML/CSS şablonu — iki skill de bunu kullanır.
data/posts.js|.json           Katalog verisi. OTOMATİK ÜRETİLİR, elle düzenleme.
scripts/build.mjs             posts/ tarar, data/ üretir, sayfalara ortak kabuğu enjekte eder.
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

`yazi:kategori` için önce `data/posts.json` içindeki mevcut kategorilere bak, uyanı **birebir aynı
yazımla** kullan. Kategori sayısını şişirme — konu başlığı seviyesinde tut.

**Yeni bir sayfa ekledikten sonra `node scripts/build.mjs` çalıştırmak zorunludur** — aksi halde
sayfa sitede görünmez. Script ortak kabuğu da enjekte eder (idempotent): geri linki, tema düğmesi,
açık tema override'ları, okuma süresi ve sayfa sonundaki önceki/sonraki + ilgili yazılar bloğu.
Eksik meta için uyarı basar.
