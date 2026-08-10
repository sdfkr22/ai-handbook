# Yazı tipleri

Bu klasördeki `.woff2` dosyaları Google Fonts'tan indirilmiştir; site artık font için dışarıya
istek atmaz. Böylece sayfalar çevrimdışı da doğru görünür, ilk boyama üçüncü taraf bir isteğe
takılmaz ve okuyucunun IP'si Google'a gitmez.

Yenilemek (ör. sürüm yükseltmek) için:

```bash
node scripts/fetch-fonts.mjs
```

Script `assets/fonts.css` dosyasını da yeniden üretir — o dosya **elle düzenlenmez**.

## İçerik

| Aile | Ağırlık | Nerede kullanılıyor |
|---|---|---|
| Fraunces | 600 | Başlıklar (`h1`, `h2`, kart başlıkları) |
| IBM Plex Sans | 400, 500, 600 | Gövde metni |
| JetBrains Mono | 400, 500 | Kod, kicker, meta satırları |

Yalnızca `latin` ve `latin-ext` altkümeleri indirilir — Türkçe için `latin-ext` şart (ğ, ş, İ, ı),
kiril/yunan/vietnamca altkümeleri bu sitede hiç kullanılmıyor.

Yeni bir ağırlık kullanmaya başlarsan `scripts/fetch-fonts.mjs` içindeki istek adresine de eklemen
gerekir; yoksa tarayıcı o ağırlığı taklit ederek çizer.

## Lisans

Üç aile de **SIL Open Font License 1.1** altında dağıtılıyor. Lisans metinleri aileye özgü telif
satırlarıyla birlikte bu klasörde:

- `OFL-fraunces.txt` — Copyright 2018 The Fraunces Project Authors
- `OFL-ibmplexsans.txt` — Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"
- `OFL-jetbrainsmono.txt` — Copyright 2020 The JetBrains Mono Project Authors

OFL, yazı tipi dosyaları yeniden dağıtıldığında lisans metninin de birlikte dağıtılmasını
şart koşar; bu dosyalar o yüzden repoda duruyor, silinmemeli.
