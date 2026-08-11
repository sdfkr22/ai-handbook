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
index.html                    Katalog: arama, kategori filtresi, sıralama. Sayfa eklerken dokunulmaz.
assets/                       Katalog stili (site.css), tema + filtre mantığı (site.js), ikonlar.
assets/fonts/ fonts.css       Yerel yazı tipleri. fetch-fonts.mjs üretir, elle düzenleme.
posts/*.html                  Her sayfa ayrı, kendi kendine yeten tek dosya.
archive/*.html                Yayından çıkarılmış sayfalar. Build taramaz, katalogda görünmez.
templates/page-template.html  Ortak HTML/CSS şablonu — iki skill de bunu kullanır.
data/posts.js|.json           Katalog verisi. OTOMATİK ÜRETİLİR, elle düzenleme.
sitemap.xml feed.xml          Arama motoru ve RSS çıktısı. OTOMATİK ÜRETİLİR.
robots.txt manifest.webmanifest
sw.js offline.html            Hepsi OTOMATİK ÜRETİLİR, elle düzenleme.
scripts/build.mjs             posts/ tarar, data/ üretir, sayfalara ortak kabuğu enjekte eder.
scripts/fetch-fonts.mjs       Yazı tiplerini indirir. Yalnızca font sürümü değişince çalıştırılır.
scripts/make-icons.mjs        PWA PNG ikonlarını üretir. Yalnızca işaret değişince çalıştırılır.
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
<meta name="yazi:gorsel"   content="assets/og/…png">   <!-- isteğe bağlı, paylaşım görseli -->
```

`yazi:gorsel` yoksa sayfa küçük (görselsiz) paylaşım kartıyla görünür — sorun değil, uydurma bir
görsel eklemekten iyidir.

`yazi:kategori` için önce `data/posts.json` içindeki mevcut kategorilere bak, uyanı **birebir aynı
yazımla** kullan. Kategori sayısını şişirme — konu başlığı seviyesinde tut.

**Yeni bir sayfa ekledikten sonra `node scripts/build.mjs` çalıştırmak zorunludur** — aksi halde
sayfa sitede görünmez. Script ortak kabuğu da enjekte eder (idempotent): geri linki, tema düğmesi,
açık tema override'ları, okuma süresi ve sayfa sonundaki önceki/sonraki + ilgili yazılar bloğu.
Eksik meta için uyarı basar.

Ayrıca `</head>` öncesine yönetilen bir paylaşım bloğu (`<!-- yazi:bas -->`) yazar — canonical,
Open Graph, Twitter, favicon, manifest, yerel font stylesheet'i ve feed bağlantısı — ve kök dizine
`sitemap.xml`, `feed.xml`, `robots.txt`, `manifest.webmanifest`, `sw.js`, `offline.html` üretir.
Mutlak adresler tek bir yerden, `build.mjs` içindeki `SITE` sabitinden gelir; sayfaların içine elle
adres yazma. Başka bir alan adına yayınlarken: `SITE_URL=https://ornek.com node scripts/build.mjs`.

Sayfalara elle **Google Fonts link'i ekleme** — fontlar `assets/fonts/` altından geliyor, build
kalan Google link'lerini zaten söküyor.

## Kod blokları

Kopyala düğmesinin yanındaki dil etiketini build üretir: JSON, YAML, frontmatter'lı markdown,
kabuk ve PowerShell blokları tanınır, tanınmayan blok **etiketsiz kalır**. Bu sitedeki blokların
bir kısmı düz Türkçe istem metni veya slash command satırı; yanlış etiket, etiketsizlikten kötüdür.
Etiket şartsa açıkça ver: `<pre data-dil="python">`.

## Okuma durumu

Yazı sayfaları okuma ilerlemesini `localStorage`'daki `okuma` anahtarına yazar; katalog bunu okuyup
kartlara "okundu"/yüzde rozeti basar, yazı sayfası da "kaldığın yere dön" satırını gösterir. Veri
tarayıcıda kalır, hiçbir yere gönderilmez. Bir yazı bir kez sona kadar okunduysa işaret geri
alınmaz — sayfaya tekrar bakmak rozeti düşürmez.
