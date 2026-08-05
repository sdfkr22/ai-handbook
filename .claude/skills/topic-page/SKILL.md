---
name: topic-page
description: "Belirli bir konuda sıfırdan Türkçe rehber/anlatım HTML sayfası hazırlayıp bu sitenin arşivine (posts/ klasörü) eklemek için bu skill'i kullan. Kullanıcı ortada tek bir kaynak linki YOKKEN bir konu adı verip sayfa istediğinde MUTLAKA tetikle: 'Claude Code slash command'larıyla ilgili bir html hazırla', 'X konusunda rehber sayfa oluştur', 'şu konuyu anlatan bir sayfa yap', 'buna dair bir cheatsheet hazırla', 'diğerleri gibi bir sayfa ekle'. Ortada özetlenecek bir URL/dosya varsa bunun yerine summarize-source skill'ini kullan."
---

# Konu Sayfası — Özgün Rehber Üretme

Kullanıcının verdiği bir **konu başlığından** yola çıkarak, diğer sayfalarla birebir aynı tasarımda
Türkçe bir rehber HTML'i yazar ve siteye ekler.

`summarize-source` ile farkı: orada tek bir kaynağı özetlersin, burada konuyu **derleyip anlatırsın**.
Şablon, meta etiketleri, çıktı klasörü ve build adımı ikisinde de aynıdır.

Site yapısı:

```
index.html                    -> katalog — ELLE DÜZENLEME
posts/*.html                -> her sayfa ayrı dosya  <-- senin çıktın buraya
templates/page-template.html -> ortak HTML/CSS şablonu
data/posts.js               -> katalog verisi — OTOMATİK ÜRETİLİR
scripts/build.mjs             -> posts/ tarar, data/ üretir
```

## İş akışı

### 1. Kapsamı netleştir (kısa tut)
Konu geniş veya belirsizse **tek bir soruyla** daralt (ör. "sadece yerleşik komutlar mı, özel
slash command yazımı da dahil mi?"). Cevap belirgin şekilde tek bir yorumu işaret ediyorsa sorma,
varsayımını sayfanın girişinde belirt ve yaz.

### 2. Bilgiyi doğrula — ezberden yazma
Sayfanın tamamı doğrulanabilir olmalı:
- **Claude / Anthropic konularında** (Claude Code, Claude API, model isimleri, fiyatlandırma,
  MCP, skills, hooks…) önce `claude-api` skill'ini oku; ürün davranışı için `WebFetch` ile
  `docs.claude.com` / `claude.com/blog` üzerindeki resmi sayfaya bak.
- Bu projede zaten ilgili bir özet varsa (`data/posts.json`'a bak) onu `Read` ile oku ve
  tutarlı kal; aynı bilgiyi çelişkili anlatan iki sayfa çıkmasın.
- Repoda karşılığı olan bir konuysa (komut, ayar, dosya adı) `Grep`/`Glob` ile gerçek durumu kontrol et.
- **Emin olmadığın komut, bayrak, varsayılan değer veya fiyat yazma.** Doğrulayamadıysan ya sayfadan
  çıkar ya da "sürüme göre değişebilir" notuyla açıkça işaretle. Uydurulmuş bir `--flag`, sayfanın
  tamamının güvenilirliğini götürür.

### 3. Sayfayı yaz
- `templates/page-template.html` şablonunu kullan. **Stil bloğunu (CSS) olduğu gibi koru**;
  sadece meta bilgilerini ve `<body>` içeriğini doldur. Yeni renk/font ekleme — sayfalar arası
  tutarlılık bu şablona bağlı.
- Dosya adı: kısa, ASCII, kebab-case → `posts/<slug>.html` (ör. `slash-commands-guide.html`).
- Yapı: `header.hero` → `nav.toc` → numaralı `section`'lar → `footer`.
  6-12 bölüm iyi bir aralıktır; her bölüm tek bir alt konuyu kapatsın.
- İçerik dengesi: **çalıştırılabilir örnek > tanım.** Her bölümde en az bir somut şey olsun —
  komut, kod bloğu, tablo satırı veya "şu durumda şunu seç" kararı.
- Referans niteliğindeki konularda (komut listesi, ayar listesi) `.table-scroll` + `table`
  kullan; okuyucu tarayarak bulabilsin.
- Tuzakları `.note.warn` kutularına al: sık yapılan hatalar, sessizce çalışmayan durumlar, sınırlar.
- Girişte "bu sayfa neyi kapsıyor / kapsamıyor" bir cümleyle belli olsun.
- **Başlıklar dikkat çekici olsun** — aşağıdaki kurala bak.

### 3b. Başlıkları çarpıcı yaz (KURAL)

Kataloğa bakan biri kartlar arasından hangisini açacağına başlığa göre karar veriyor. Konu adını
etikete çevirip geçme.

**Sayfa başlığı** (`<title>`, `yazi:baslik` ve `h1` — üçü de aynı metin olsun): okuyucuda bir
merak, gerilim veya karşıtlık uyandırsın. `h1` içinde vurgulu kısmı `<em>` ile ayır. Konuya
uygun düşüyorsa `!!` gibi bir ünlem, soru işareti veya kısa bir söz oyunu serbest.

| Yerine | Bunu yaz |
|---|---|
| "Context yönetimi" | "Context window dolduğunda!!" |
| "Hooks kullanımı" | "Talimat rica eder, hook zorlar" |
| "CLAUDE.md, skills, rules, hooks" | "Skills? Rules? Hooks? Hangisi ne zaman?" |
| "Subagent oluşturma" | "Kendi subagent'ını yazmak" |

**Bölüm başlıkları** (`h2`): çıplak etiket değil, bir şey *söylesin* — soru sorsun, bir iddia
kursun veya okuyucuya seslensin. "Auto-compact" yerine "Auto-compact sırtını sıvazlar",
"Senaryolar ve aksiyonlar" yerine "Tıkandığın anlar". `nav.toc` metinlerini `h2` ile birebir aynı
tut.

Sınır: teknik terimler yine orijinal dilinde kalır (`context window`, `hooks`, `subagent`) ve
başlık içeriği yanlış temsil etmez — clickbait değil, net ve iştah açıcı.

### 4. Katalog meta etiketlerini doldur (ZORUNLU)
```html
<meta name="yazi:baslik"    content="Kartta görünecek kısa başlık">
<meta name="yazi:aciklama"  content="1-2 cümle, ~220 karakteri geçmesin.">
<meta name="yazi:kategori"  content="Claude Code">
<meta name="yazi:etiketler" content="virgülle, ayrılmış, anahtar, kelimeler">
<meta name="yazi:kaynak"    content="">
<meta name="yazi:tarih"     content="YYYY-AA-GG">
```

- `yazi:baslik`: kartta görünen başlık. **Adım 3b'deki kurala uy** — `<title>` ve `h1` ile aynı
  metin olsun, konu etiketi gibi değil çarpıcı bir cümle gibi dursun.
- `yazi:kaynak`: tek bir kaynak yoksa boş bırak; ağırlıklı olarak bir resmi dokümana dayanıyorsa
  onun URL'ini yaz. Kullandığın kaynakları sayfanın `footer`'ında listele.
- **Kategori:** önce `data/posts.json` içindeki mevcut kategorilere bak, uyanı **birebir aynı
  yazımla** kullan; hiçbiri uymuyorsa geniş bir yeni kategori aç.
- `yazi:tarih` = sayfayı yazdığın gün.

### 5. Katalogu yeniden üret
```bash
node scripts/build.mjs
```
`data/posts.js` + `.json` yenilenir, sayfaya "← Tüm yazılar" geri linki enjekte edilir.
Çıktıdaki **uyarı satırlarını oku**, eksik varsa düzelt ve tekrar çalıştır. Bu adımı atlarsan
sayfa sitede görünmez.

### 6. Sun
Dosya yolunu söyle, `index.html`'i tarayıcıda açabileceğini belirt ve sayfanın kapsamını
2-3 cümleyle özetle. Doğrulayamadığın için dışarıda bıraktığın bir şey varsa burada açıkça söyle.

## KRİTİK KURALLAR

1. **Teknik terimleri orijinal dilinde bırak.** Bölüm başlıkları ve terimler (`slash command`,
   `hooks`, `subagent`, `output styles`) çevrilmez; anlatım Türkçedir.

2. **Sayfayı "rehber", "derleme" veya "çeviri" diye etiketleme.** Başlıkta, kicker'da ve footer'da
   "Türkçe Rehber", "Bu sayfa bir derleme rehberdir" gibi ibareler kullanma; sayfa kendi başına bir
   içerik olarak durur. Kaynakları yalnızca `.source` satırında ve footer'da link olarak ver.

3. **Türkçe karakterleri DOĞRUDAN UTF-8 yaz.** `&scaron;`, `&#351;` gibi entity kullanma —
   yanlış karaktere yol açar. `<meta charset="UTF-8">` mutlaka bulunsun. `build.mjs` bunu denetler.

4. **Şablonun CSS'ini değiştirme.** Yeni bir bileşene ihtiyaç duyarsan mevcutlardan (`.card`,
   `.note`, `table`) türet. Tema değişikliği isteniyorsa tüm sayfalarda birden yapılmalı — kullanıcıya sor.

5. **`data/` ve `index.html` dosyalarına elle dokunma.** Katalog yalnızca `build.mjs` ile güncellenir.

6. **Uzunluk hedef değil.** Doldurmak için genel geçer paragraf yazma; okuyucunun uygulayabileceği
   bilgi yoksa o bölüm olmasın.

## Şablon bileşenleri

- `header.hero` — kicker + başlık (`<em>` ile vurgulu kısım) + `.lede` giriş + `.source` künye
- `nav.toc` — içindekiler (`#m1`, `#m2`… bağlantıları)
- `section` + `h2 .num` — numaralı bölümler
- `.note` / `.note.warn` — bilgi ve uyarı kutuları, `.tag` etiketiyle
- `.card` — vurgulanmış bilgi kartı
- `pre code` + `.k`/`.s`/`.c` — kod blokları (anahtar kelime / string / yorum renkleri)
- `.table-scroll` + `table` — referans ve karşılaştırma tabloları
- `ul`/`li` — özel madde işaretli listeler

Geri linkini elle ekleme; `build.mjs` otomatik enjekte eder.
