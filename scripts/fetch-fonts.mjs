#!/usr/bin/env node
/**
 * Google Fonts'tan woff2 dosyalarını indirip assets/fonts/ altına koyar ve
 * assets/fonts.css üretir. Amaç siteyi dış bağımlılıktan kurtarmak: sayfalar
 * çevrimdışı da doğru yazı tipiyle açılsın, ilk boyama üçüncü taraf isteğe
 * takılmasın, okuyucunun IP'si Google'a gitmesin.
 *
 * Yalnızca gerektiğinde elle çalıştırılır (font sürümü yükseltmek gibi); çıktısı
 * repoya commit edilir. Normal `node scripts/build.mjs` akışının parçası değildir.
 *
 * Kullanım: node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = path.join(ROOT, "assets", "fonts");

/* Sayfalarda kullanılan üç aile. Ağırlıklar, site.css ve sayfaların kendi
   <style> bloklarındaki font-weight kullanımıyla birebir eşleşir — Fraunces
   yalnızca başlıklarda ve yalnızca 600'de geçiyor, diğer üç ağırlık ~370 KB
   boşuna yer kaplıyordu. Yeni bir ağırlık kullanılırsa buraya da eklenmeli.
   İtalik hiç istenmiyor (h1 em); tarayıcı eğimi kendisi türetiyor — bu, Google
   Fonts sürümündeki davranışın aynısı. */
const ISTEK =
  "https://fonts.googleapis.com/css2" +
  "?family=Fraunces:opsz,wght@9..144,600" +
  "&family=IBM+Plex+Sans:wght@400;500;600" +
  "&family=JetBrains+Mono:wght@400;500" +
  "&display=swap";

/* Türkçe için latin yetmiyor: ğ ş İ ı latin-ext'te. Diğer altkümeler (kiril,
   yunan, vietnamca) yüzlerce KB tutuyor ve bu sitede hiç kullanılmıyor. */
const ALTKUMELER = new Set(["latin", "latin-ext"]);

// Tarayıcı UA'sı gönderilmezse Google eski ttf/woff sürümünü döndürür.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Safari/537.36";

const slug = (s) =>
  s.toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  console.log("Google Fonts CSS'i alınıyor…");
  const yanit = await fetch(ISTEK, { headers: { "User-Agent": UA } });
  if (!yanit.ok) throw new Error(`CSS alınamadı: HTTP ${yanit.status}`);
  const css = await yanit.text();

  /* CSS "/* altküme *​/ @font-face{…}" blokları hâlinde geliyor; altküme adı
     yalnızca bloğun üstündeki yorumda yazıyor, o yüzden ikisi birlikte okunur. */
  const blokRe = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/gi;
  const bloklar = [];
  let m;
  while ((m = blokRe.exec(css))) bloklar.push({ altkume: m[1], govde: m[2] });
  if (!bloklar.length) throw new Error("CSS içinde @font-face bloğu bulunamadı.");

  const secilen = bloklar.filter((b) => ALTKUMELER.has(b.altkume));
  console.log(`${bloklar.length} blok bulundu, ${secilen.length} tanesi alınacak (latin, latin-ext).`);

  await mkdir(FONT_DIR, { recursive: true });
  // Eski woff2'ler kalmasın: aile/sürüm değişince dosya adı da değişiyor.
  for (const f of await readdir(FONT_DIR).catch(() => [])) {
    if (f.endsWith(".woff2")) await rm(path.join(FONT_DIR, f));
  }

  const parcalar = [];
  const sayac = {};
  let toplam = 0;

  for (const { altkume, govde } of secilen) {
    const aile = (govde.match(/font-family:\s*([^;]+);/i) || [])[1] || "";
    const agirlik = ((govde.match(/font-weight:\s*([^;]+);/i) || [])[1] || "400").trim();
    const kaynak = (govde.match(/src:\s*url\(([^)]+)\)/i) || [])[1];
    if (!kaynak) continue;

    /* Aynı aile+ağırlık+altküme birden çok blokta gelirse (Google bazen böler)
       dosya adları çakışmasın. */
    const taban = `${slug(aile)}-${slug(agirlik)}-${altkume}`;
    sayac[taban] = (sayac[taban] || 0) + 1;
    const ad = sayac[taban] > 1 ? `${taban}-${sayac[taban]}.woff2` : `${taban}.woff2`;

    const f = await fetch(kaynak, { headers: { "User-Agent": UA } });
    if (!f.ok) throw new Error(`${ad} indirilemedi: HTTP ${f.status}`);
    const veri = Buffer.from(await f.arrayBuffer());
    await writeFile(path.join(FONT_DIR, ad), veri);
    toplam += veri.length;
    console.log(`  + ${ad} (${(veri.length / 1024).toFixed(1)} KB)`);

    // src dışındaki tüm descriptor'lar (unicode-range, font-display…) korunur.
    parcalar.push(
      govde
        .replace(/src:\s*url\([^)]+\)/i, `src: url(fonts/${ad})`)
        .replace(/@font-face\s*\{/, `/* ${altkume} */\n@font-face {`)
    );
  }

  const cikti =
    `/* OTOMATİK ÜRETİLDİ (scripts/fetch-fonts.mjs) — elle düzenleme.\n` +
    `   Google Fonts'tan indirilmiş woff2 dosyaları; hepsi SIL Open Font License 1.1\n` +
    `   altında (bkz. assets/fonts/README.md). Yenilemek için:\n` +
    `     node scripts/fetch-fonts.mjs */\n\n` +
    parcalar.join("\n\n") +
    "\n";

  await writeFile(path.join(ROOT, "assets", "fonts.css"), cikti, "utf8");
  console.log(`\n✓ assets/fonts.css yazıldı — ${parcalar.length} yüz, toplam ${(toplam / 1024).toFixed(0)} KB.`);
}

main().catch((e) => {
  console.error(`Hata: ${e.message}`);
  process.exit(1);
});
