#!/usr/bin/env node
/**
 * posts/ klasöründeki HTML sayfaları tarar, meta bilgilerini çıkarır ve
 * katalog verisini üretir:
 *   data/posts.js    -> window.YAZILAR (file:// üzerinden de çalışır)
 *   data/posts.json  -> aynı veri, başka araçlar için
 *
 * Ayrıca her sayfaya ortak kabuğu enjekte eder — "← Tüm yazılar" geri linki,
 * açık/koyu tema override'ları ve tema düğmesi (idempotent: blok zaten varsa ve
 * içeriği değiştiyse güncellenir, aynıysa dokunulmaz).
 *
 * Kullanım: node scripts/build.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YAZI_DIR = path.join(ROOT, "posts");
const DATA_DIR = path.join(ROOT, "data");

const uyarilar = [];

/* ---------- yardımcılar ---------- */

const decode = (s) =>
  String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

const metinle = (html) => decode(String(html).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

function meta(html, ad) {
  const re = new RegExp(`<meta\\s+name=["']${ad}["']\\s+content=["']([\\s\\S]*?)["']\\s*/?>`, "i");
  const m = html.match(re);
  return m ? decode(m[1]).trim() : "";
}

function kirp(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

/* ---------- ortak kabuk enjeksiyonu (geri linki + tema) ---------- */

const KABUK_BASLA = "<!-- yazi:kabuk -->";
const KABUK_BITIR = "<!-- /yazi:kabuk -->";

/**
 * Açık tema kuralları. Sayfaların kendi <style> bloğu koyu temayı :root üzerinde
 * tanımlar; buradaki seçiciler daha yüksek özgüllüğe sahip olduğu için sıradan
 * bağımsız olarak kazanır. Aynı kurallar iki kez üretilir:
 *   1) :root[data-theme="light"]        -> kullanıcı düğmeyle açık temayı seçti
 *   2) :root:not([data-theme="dark"])   -> sistem açık tema ve kullanıcı koyuyu seçmedi
 */
function isikKurallari(kok) {
  return `${kok}{
    --bg:#fdf7ec; --panel:#fffdf8; --panel-2:#fdf0dc; --table-bg:#fffcf5;
    --card:#fbf5e9; --card-line:#ecdfc8;
    --ink:#1c1710; --ink-soft:#4b4234; --ink-mute:#7b7060;
    --line:#efdcc0; --accent:#b8480a; --accent-2:#2f7d32; --danger:#c62f1f;
    --code-bg:#fcf3e3; --code-ink:#2b251b;
  }
  ${kok} body{background:var(--bg);}
  ${kok} .note{background:rgba(184,72,10,.09);}
  ${kok} .note.warn{background:rgba(198,47,31,.08);}
  ${kok} .card{background:var(--card);border-color:var(--card-line);box-shadow:none;}
  ${kok} .card code{background:#fffcf3;border-color:rgba(184,72,10,.22);}
  ${kok} .toc{box-shadow:0 1px 2px rgba(122,74,20,.06);}
  ${kok} pre{background:var(--code-bg);border-color:#eddec2;}
  ${kok} code{border-color:rgba(184,72,10,.20);}`;
}

const KABUK = `${KABUK_BASLA}
<script>/* Kayıtlı tema tercihini boyamadan önce uygula (FOUC yok). */
(function(){try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();</script>
<style>
  ${isikKurallari(':root[data-theme="light"]')}
  @media (prefers-color-scheme: light){
  ${isikKurallari(":root:not([data-theme=\"dark\"])")}
  }
  .yazi-geri{position:fixed;top:18px;left:18px;z-index:99;font-family:"JetBrains Mono",monospace;
    font-size:12px;letter-spacing:.06em;text-decoration:none;color:var(--ink-soft);background:var(--panel);
    border:1px solid var(--line);border-radius:999px;padding:8px 14px;backdrop-filter:blur(6px);transition:all .15s;}
  .yazi-geri:hover{color:var(--accent);border-color:var(--accent);}
  .tema-btn{position:fixed;top:18px;right:18px;z-index:99;width:36px;height:36px;
    display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;
    color:var(--ink-soft);background:var(--panel);border:1px solid var(--line);border-radius:999px;
    backdrop-filter:blur(6px);transition:color .15s,border-color .15s;}
  .tema-btn:hover{color:var(--accent);border-color:var(--accent);}
  @media (max-width:900px){
    .yazi-geri{position:static;display:inline-block;margin:16px 0 0 20px;}
    .tema-btn{top:12px;right:12px;width:32px;height:32px;font-size:14px;}
  }
</style>
<a class="yazi-geri" href="../index.html">&#8592; Tüm yazılar</a>
<button class="tema-btn" id="temaBtn" type="button" aria-label="Temayı değiştir" title="Temayı değiştir"></button>
<script>
(function(){
  var kok=document.documentElement,btn=document.getElementById("temaBtn");
  function aktif(){return kok.dataset.theme||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");}
  function ciz(){btn.textContent=aktif()==="light"?"☾":"☀";}
  btn.addEventListener("click",function(){
    var yeni=aktif()==="light"?"dark":"light";
    kok.dataset.theme=yeni;
    try{localStorage.setItem("tema",yeni);}catch(e){}
    ciz();
  });
  ciz();
})();
</script>
${KABUK_BITIR}`;

// Eski sürümlerden kalan blokları da yakalar.
const ESKI_BLOKLAR = [
  /<!-- ozet:geri -->[\s\S]*?<!-- \/ozet:geri -->\n?/,
  /<!-- yazi:geri -->[\s\S]*?<!-- \/yazi:geri -->\n?/,
];
const MEVCUT_BLOK = /<!-- yazi:kabuk -->[\s\S]*?<!-- \/yazi:kabuk -->/;

async function kabuguEkle(dosyaYolu, html) {
  let yeni = html;
  for (const eski of ESKI_BLOKLAR) yeni = yeni.replace(eski, "");

  if (MEVCUT_BLOK.test(yeni)) {
    yeni = yeni.replace(MEVCUT_BLOK, KABUK);
  } else {
    const eklenmis = yeni.replace(/(<body[^>]*>)/i, `$1\n${KABUK}\n`);
    if (eklenmis === yeni) {
      uyarilar.push(`${path.basename(dosyaYolu)}: <body> etiketi bulunamadı, ortak kabuk eklenmedi.`);
      return yeni;
    }
    yeni = eklenmis;
  }

  if (yeni !== html) {
    await writeFile(dosyaYolu, yeni, "utf8");
    console.log(`  + kabuk güncellendi: ${path.basename(dosyaYolu)}`);
  }
  return yeni;
}

/* ---------- tek dosyayı çözümle ---------- */

async function cozumle(dosyaAdi) {
  const tamYol = path.join(YAZI_DIR, dosyaAdi);
  let html = await readFile(tamYol, "utf8");
  html = await kabuguEkle(tamYol, html);

  // Başlık: yazi:baslik > <h1> > <title>
  let baslik = meta(html, "yazi:baslik");
  if (!baslik) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) baslik = metinle(h1[1].replace(/<br\s*\/?>/gi, " "));
  }
  if (!baslik) {
    const t = html.match(/<title>([\s\S]*?)<\/title>/i);
    baslik = t ? metinle(t[1]) : dosyaAdi.replace(/\.html?$/i, "");
  }

  // Açıklama: yazi:aciklama > .lede
  let aciklama = meta(html, "yazi:aciklama");
  if (!aciklama) {
    const lede = html.match(/<p[^>]*class=["'][^"']*\blede\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    if (lede) aciklama = kirp(metinle(lede[1]), 220);
  }
  if (!aciklama) uyarilar.push(`${dosyaAdi}: açıklama yok (yazi:aciklama meta veya .lede ekle).`);

  // Kaynak: yazi:kaynak > .source içindeki ilk link
  let kaynak = meta(html, "yazi:kaynak");
  if (!kaynak) {
    const src = html.match(/<p[^>]*class=["'][^"']*\bsource\b[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["']/i);
    if (src) kaynak = decode(src[1]);
  }

  // Kategori
  const kategori = meta(html, "yazi:kategori") || "Diğer";
  if (kategori === "Diğer") uyarilar.push(`${dosyaAdi}: kategori yok (yazi:kategori meta ekle).`);

  // Etiketler
  const etiketler = (meta(html, "yazi:etiketler") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Tarih: yazi:tarih > dosya değiştirilme tarihi
  const tarih = meta(html, "yazi:tarih") || statSync(tamYol).mtime.toISOString().slice(0, 10);

  // Türkçe karakter kontrolü
  if (/&(scaron|#351|#287|#305|ccedil|ouml|uuml|Scaron|#350);/.test(html)) {
    uyarilar.push(`${dosyaAdi}: HTML entity tespit edildi — Türkçe karakterler düz UTF-8 olmalı.`);
  }

  return {
    dosya: `posts/${dosyaAdi}`,
    baslik,
    aciklama: aciklama || "",
    kategori,
    etiketler,
    kaynak: kaynak || "",
    tarih,
  };
}

/* ---------- ana akış ---------- */

const dosyalar = (await readdir(YAZI_DIR)).filter((f) => /\.html?$/i.test(f)).sort();

if (!dosyalar.length) {
  console.error("posts/ klasöründe HTML bulunamadı.");
  process.exit(1);
}

console.log(`${dosyalar.length} sayfa taranıyor…`);
const kayitlar = [];
for (const f of dosyalar) kayitlar.push(await cozumle(f));

kayitlar.sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));

const guncelleme = new Date().toISOString().slice(0, 10);
const json = JSON.stringify(kayitlar, null, 2);

await writeFile(
  path.join(DATA_DIR, "posts.js"),
  `// OTOMATİK ÜRETİLDİ — elle düzenleme. Yenilemek için: node scripts/build.mjs\n` +
    `window.YAZILAR = ${json};\n` +
    `window.YAZILAR_GUNCELLEME = ${JSON.stringify(guncelleme)};\n`,
  "utf8"
);
await writeFile(path.join(DATA_DIR, "posts.json"), json + "\n", "utf8");

const kategoriler = [...new Set(kayitlar.map((k) => k.kategori))].sort((a, b) => a.localeCompare(b, "tr"));
console.log(`\n✓ data/posts.js ve data/posts.json güncellendi.`);
console.log(`  ${kayitlar.length} sayfa · ${kategoriler.length} kategori: ${kategoriler.join(", ")}`);

if (uyarilar.length) {
  console.log("\nUyarılar:");
  for (const u of uyarilar) console.log(`  ! ${u}`);
}
