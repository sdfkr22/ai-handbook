---
name: summarize-source
description: "Bir web sayfasını, dokümanı veya makaleyi Türkçe olarak özetleyip bu sitenin arşivine (posts/ klasörü) tek dosyalık bir HTML sayfa olarak eklemek için bu skill'i kullan. Kullanıcı bir URL paylaşıp 'bunu özetle', 'Türkçe özet çıkar', 'bunu da ekle', 'siteye ekle' dediğinde veya sadece çıplak bir link yapıştırdığında MUTLAKA tetikle. Teknik dokümantasyon, API sayfaları, makaleler, blog yazıları ve uzun metinler için özellikle uygundur. Kullanıcı sadece 'özetle' dese bile bu skill'i kullan. Ortada özetlenecek bir kaynak YOKSA, sadece bir konu başlığı verilip sayfa isteniyorsa bunun yerine topic-page skill'ini kullan."
---

# Kaynaktan Türkçe Sayfa Üretme

Bir kaynağı (web sayfası, doküman, makale) Türkçeleştirip özetler ve bu projedeki **statik siteye**
yeni bir sayfa olarak ekler.

Elinde bir kaynak (URL/dosya/metin) yoksa, yani kullanıcı sadece bir **konu başlığı** verip sayfa
istiyorsa, bu skill değil `topic-page` skill'i kullanılır.

Site yapısı:

```
index.html                    -> katalog (kategori filtresi + arama) — ELLE DÜZENLEME
posts/*.html                -> her sayfa ayrı bir dosya  <-- senin çıktın buraya
templates/page-template.html -> ortak HTML/CSS şablonu
data/posts.js               -> katalog verisi — OTOMATİK ÜRETİLİR, elle düzenleme
scripts/build.mjs             -> posts/ klasörünü tarayıp data/ dosyalarını üretir
```

## İş akışı

### 1. Kaynağı al
- **URL ise:** `WebFetch` ile çek. Snippet yetmezse asıl sayfanın tamamını getir; sayfa uzunsa birden fazla istek yapmaktan çekinme.
- **Yüklenmiş dosya ise:** `Read` ile oku (PDF için `pages` parametresi). İçerik zaten context'teyse tekrar okuma.
- **Doğrudan metin ise:** verilen metni kullan.

### 2. İçeriği analiz et ve en önemli noktaları seç
Sayfa, kaynağın **en kritik ve aksiyon alınabilir** noktalarını içermeli:
- Ana kavramlar, tanımlar, "nasıl çalışır" mantığı.
- **Sık atlanan ama kritik detaylar:** varsayılan değerler, sürüm/model farkları, sınırlamalar, hata durumları, fiyatlandırma, uyumsuzluklar.
- Kod örnekleri ve parametreler (kısa ve net biçimde aktar).
- Uyarılar ve "önemli" notlar — bunları görsel olarak ayrıştır (`.note.warn`).

Bir bölümü yazarken kendine sor: "Okuyucunun bu konuyu uygulamak için bilmesi gereken ama metni hızlı okuyunca kaçıracağı şey ne?" — onu mutlaka ekle.

### 3. HTML'i üret
- `templates/page-template.html` şablonunu kullan. **Stil bloğunu (CSS) olduğu gibi koru**; sadece `<head>` içindeki meta bilgilerini ve `<body>` içeriğini doldur.
- Dosya adı: kısa, İngilizce/ASCII, kebab-case slug → `posts/<slug>.html`
  (ör. `prompt-caching.html`, `mcp-server-guide.html`). Türkçe karakter ve boşluk kullanma.
- Aynı konuda bir sayfa zaten varsa yeni dosya açma, mevcudunu güncelle.

### 3b. Başlıkları çarpıcı yaz (KURAL)

Kataloğa bakan biri kartlar arasından hangisini açacağına başlığa göre karar veriyor. Kaynağın
başlığını olduğu gibi çevirip geçme — kaynak "Context windows" diyorsa sen daha iyisini yaz.

**Sayfa başlığı** (`<title>`, `yazi:baslik` ve `h1` — üçü de aynı metin olsun): okuyucuda bir
merak, gerilim veya karşıtlık uyandırsın. `h1` içinde vurgulu kısmı `<em>` ile ayır. Konuya
uygun düşüyorsa `!!` gibi bir ünlem, soru işareti veya kısa bir söz oyunu serbest.

| Yerine | Bunu yaz |
|---|---|
| "Context windows" | "Context window dolduğunda!!" |
| "Hooks reference" | "Talimat rica eder, hook zorlar" |
| "Prompt caching" | "Aynı prompt'u iki kez ödeme" |
| "Sub-agents" | "Kendi subagent'ını yazmak" |

**Bölüm başlıkları** (`h2`): kaynağın bölüm başlığı zaten net ve teknikse (`Best practices`,
`Rate limits`) onu koru — kural 1 geçerli. Ama başlık çıplak bir etiketse, okuyucuya bir şey
*söyleyen* bir hale getir: "Auto-compact" yerine "Auto-compact sırtını sıvazlar". `nav.toc`
metinlerini `h2` ile birebir aynı tut.

Sınır: teknik terimler orijinal dilinde kalır (`context window`, `hooks`, `subagent`) ve başlık
içeriği yanlış temsil etmez — clickbait değil, net ve iştah açıcı.

### 4. Katalog meta etiketlerini doldur (ZORUNLU)
`<head>` içine şu 6 etiketi eksiksiz yaz — katalog sayfası bunları okur:

```html
<meta name="yazi:baslik"    content="Kartta görünecek kısa başlık">
<meta name="yazi:aciklama"  content="1-2 cümle, en fazla ~220 karakter. Kartta görünür.">
<meta name="yazi:kategori"  content="Claude Code">
<meta name="yazi:etiketler" content="virgülle, ayrılmış, anahtar, kelimeler">
<meta name="yazi:kaynak"    content="https://orijinal-kaynak-linki">
<meta name="yazi:tarih"     content="YYYY-AA-GG">
```

**Başlık seçimi:** `yazi:baslik` için **adım 3b'deki kurala uy** — `<title>` ve `h1` ile aynı metin olsun, kaynağın başlığının düz çevirisi değil çarpıcı bir cümle olsun.

**Kategori seçimi:** Önce `data/posts.json` dosyasındaki mevcut kategorilere bak ve uyanı **birebir aynı yazımla** kullan (filtre butonları metne göre gruplanır). Hiçbiri uymuyorsa yeni ve geniş bir kategori aç — kategori sayısını şişirme, konu başlığı seviyesinde tut (ör. "Claude Code", "Claude API", "MCP", "Prompt Engineering", "Agent Tasarımı").

`yazi:tarih` = kaynağın yayın tarihi; bilinmiyorsa sayfanın hazırlandığı gün.

### 5. Katalogu yeniden üret
```bash
node scripts/build.mjs
```
Bu komut `data/posts.js` + `data/posts.json` dosyalarını yeniler ve sayfaya "← Tüm yazılar" geri linkini enjekte eder. Çıktıdaki **uyarı satırlarını oku** — eksik meta veya bozuk karakter varsa düzelt ve tekrar çalıştır. Bu adımı atlama; atlarsan sayfa sitede görünmez.

### 6. Sun
Kullanıcıya yazılan dosya yolunu ve `index.html`'i tarayıcıda açabileceğini söyle, ardından 2-4 cümleyle en kritik çıkarımları belirt.

## KRİTİK KURALLAR

1. **Teknik bölüm başlıklarını orijinal dilinde bırak.** Kaynaktaki teknik başlıkları (ör. "Summarized Thinking", "Best practices") Türkçeye çevirme — orijinal terim aranabilirliği ve doğruluğu korur. Sadece açıklama metnini Türkçeleştir. Kullanıcı aksini istemedikçe bu varsayılandır. **Bu kural sayfanın kendi başlığını kapsamaz**: `<title>` / `yazi:baslik` / `h1` her zaman Türkçe ve çarpıcı yazılır (adım 3b).

2. **Sayfayı "özet" veya "çeviri" diye etiketleme.** Başlıkta, kicker'da ve footer'da "Türkçe Özet", "Bu sayfanın Türkçe özetidir" gibi ibareler kullanma; sayfa kendi başına bir içerik olarak durur. Kaynağı yalnızca `.source` satırında ve footer'da link olarak ver.

3. **Türkçe karakterleri DOĞRUDAN UTF-8 olarak yaz.** `&scaron;`, `&#351;` gibi entity kullanma — yanlış karaktere (š) yol açar. `ş ğ ı İ ç ö ü Ş Ğ Ç Ö Ü` harflerini düz metin yaz. `<head>` içinde `<meta charset="UTF-8">` mutlaka bulunsun. `build.mjs` bunu kontrol eder ve entity görürse uyarır.

4. **Kilit noktaları atlama.** Kısa olsun diye kritik bir detayı (varsayılan değer, sınır, uyarı) düşürme. Şüphedeysen ekle.

5. **Aşırı biçimlendirmeden kaçın ama yapı kur.** İçindekiler menüsü, numaralı bölümler, kod blokları ve uyarı kutuları okunabilirliği artırır. Şablon bunları zaten içerir.

6. **Şablonun CSS'ini değiştirme.** Yeni bir bileşene ihtiyaç duyarsan mevcutlardan (`.card`, `.note`, `table`) türet. **Hiçbir yerde gradient kullanma** — arka plan, kart, düğme hepsi düz renk (`var(--bg)`, `var(--panel)` gibi); `linear-gradient` / `radial-gradient` yazma.

7. **`data/` ve `index.html` dosyalarına elle dokunma.** Katalog tamamen `build.mjs` üzerinden güncellenir.

## Şablon bileşenleri

`templates/page-template.html` koyu temalı editoryal bir tasarım sunar:
- `header.hero` — kicker + başlık + `.lede` giriş + `.source` kaynak linki
- `nav.toc` — içindekiler (bölümlere `#m1`, `#m2`… ile bağlanır)
- `section` + `h2 .num` — numaralı bölümler
- `.note` ve `.note.warn` — normal ve uyarı kutuları, `.tag` etiketiyle
- `.card` — vurgulanmış bilgi kartı
- `pre code` + `.k`/`.s`/`.c` span'leri — kod blokları (anahtar kelime/string/yorum)
- `.table-scroll` + `table` — karşılaştırma tabloları
- `ul`/`li` — özel madde işaretli listeler

Geri linkini elle ekleme; `build.mjs` `<body>`'den hemen sonra otomatik enjekte eder.
