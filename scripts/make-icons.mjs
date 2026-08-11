#!/usr/bin/env node
/**
 * assets/favicon.svg ile aynı işareti PNG olarak üretir — PWA manifesti SVG
 * ikonla her tarayıcıda "yüklenebilir" sayılmıyor, 192 ve 512 piksellik PNG
 * istiyor.
 *
 * Repoda bağımlılık yok, o yüzden rasterizasyon elde yapılıyor: şekiller işaretli
 * uzaklık fonksiyonlarıyla (SDF) çiziliyor, kenar yumuşatma piksel başına örtüşme
 * oranından geliyor. PNG'yi de zlib (Node'un içinde) ile kendimiz paketliyoruz.
 *
 * Yalnızca işaret değişirse elle çalıştırılır; çıktısı repoya commit edilir.
 * Aynı girdi için bayt bayt aynı dosyayı üretir.
 *
 * Kullanım: node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* favicon.svg ile aynı renkler ve aynı 32 birimlik koordinat sistemi. */
const ZEMIN = [14, 13, 11];      // #0e0d0b
const VURGU = [232, 163, 61];    // #e8a33d
const KUTU = 32;

/* ---------- PNG paketleme ---------- */

const CRC_TABLO = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLO[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parca(tip, veri) {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length);
  const govde = Buffer.concat([Buffer.from(tip, "latin1"), veri]);
  const kontrol = Buffer.alloc(4);
  kontrol.writeUInt32BE(crc32(govde));
  return Buffer.concat([uzunluk, govde, kontrol]);
}

function png(en, boy, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0);
  ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8;   // bit derinliği
  ihdr[9] = 6;   // renk tipi: RGBA
  // 10,11,12: sıkıştırma / filtre / interlace = 0

  /* Her satırın başına filtre baytı (0 = filtresiz). Basit ama bu boyutta
     fark etmiyor; belirlenimci çıktı önemli. */
  const satirlar = Buffer.alloc(boy * (en * 4 + 1));
  for (let y = 0; y < boy; y++) {
    satirlar[y * (en * 4 + 1)] = 0;
    rgba.copy(satirlar, y * (en * 4 + 1) + 1, y * en * 4, (y + 1) * en * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca("IHDR", ihdr),
    parca("IDAT", deflateSync(satirlar, { level: 9 })),
    parca("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- şekiller ---------- */

const kis = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Yuvarlatılmış dikdörtgenin işaretli uzaklığı (içeride negatif). */
function sdfDikdortgen(px, py, cx, cy, yariEn, yariBoy, r) {
  const dx = Math.abs(px - cx) - (yariEn - r);
  const dy = Math.abs(py - cy) - (yariBoy - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

/** Bir noktanın [a,b] doğru parçasına uzaklığı — yuvarlak uçlu çizgi bundan çıkar. */
function sdfParca(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = kis((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/** src rengini hedefin üstüne alfa ile karıştır (premultiply yok, düz "over"). */
function bindir(hedef, i, renk, alfa) {
  if (alfa <= 0) return;
  const a0 = hedef[i + 3] / 255;
  const a1 = alfa + a0 * (1 - alfa);
  for (let k = 0; k < 3; k++) {
    hedef[i + k] = Math.round((renk[k] * alfa + hedef[i + k] * a0 * (1 - alfa)) / (a1 || 1));
  }
  hedef[i + 3] = Math.round(a1 * 255);
}

/**
 * @param boyut   Piksel cinsinden kenar uzunluğu.
 * @param maskeli Android maskeli ikonu: zemin köşesiz (maske kendi kesecek),
 *                işaret güvenli bölgeye sığsın diye küçültülür.
 */
function ciz(boyut, maskeli) {
  const rgba = Buffer.alloc(boyut * boyut * 4);
  const birim = KUTU / boyut;            // bir pikselin birim cinsinden boyu
  const yuvarlaklik = maskeli ? 0 : 7;
  const olcek = maskeli ? 0.62 : 1;

  // İşaret koordinatları, merkeze göre ölçeklenir.
  const d = (x, y) => [(x - 16) * olcek + 16, (y - 16) * olcek + 16];
  const [c1x, c1y] = d(9, 10.5), [c2x, c2y] = d(15.5, 16), [c3x, c3y] = d(9, 21.5);
  const [b1x, b1y] = d(18.5, 21.5), [b2x, b2y] = d(23.5, 21.5);
  const kalinlik = 1.5 * olcek;          // 3 birimlik çizginin yarısı

  for (let y = 0; y < boyut; y++) {
    for (let x = 0; x < boyut; x++) {
      const px = (x + 0.5) * birim, py = (y + 0.5) * birim;
      const i = (y * boyut + x) * 4;

      // Zemin
      bindir(rgba, i, ZEMIN, kis(0.5 - sdfDikdortgen(px, py, 16, 16, 16, 16, yuvarlaklik) / birim, 0, 1));

      // ❯ işareti
      const cev = Math.min(
        sdfParca(px, py, c1x, c1y, c2x, c2y),
        sdfParca(px, py, c2x, c2y, c3x, c3y)
      ) - kalinlik;
      bindir(rgba, i, VURGU, kis(0.5 - cev / birim, 0, 1));

      // İmleç çizgisi (yarı saydam)
      const cizgi = sdfParca(px, py, b1x, b1y, b2x, b2y) - kalinlik;
      bindir(rgba, i, VURGU, kis(0.5 - cizgi / birim, 0, 1) * 0.5);
    }
  }
  return png(boyut, boyut, rgba);
}

const uretilecek = [
  ["assets/icon-192.png", 192, false],
  ["assets/icon-512.png", 512, false],
  ["assets/icon-512-maskable.png", 512, true],
];

for (const [ad, boyut, maskeli] of uretilecek) {
  const veri = ciz(boyut, maskeli);
  await writeFile(path.join(ROOT, ad), veri);
  console.log(`  + ${ad} (${(veri.length / 1024).toFixed(1)} KB)`);
}
console.log("\n✓ ikonlar üretildi.");
