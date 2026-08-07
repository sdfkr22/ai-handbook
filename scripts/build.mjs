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

/* ---------- bölümler, okuma süresi, ilgili yazılar ---------- */

/**
 * Sayfadaki <section id="…"> bloklarının h2 başlıklarını sırayla döndürür.
 * Katalog aramasının yazı gövdesini görebilmesi bu listeye dayanır.
 */
function bolumleriCikar(html, dosyaAdi) {
  const bolumler = [];
  const re = /<section[^>]*\bid=["']([^"']+)["'][^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const numRe = /<span[^>]*class=["'][^"']*\bnum\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
  let m;
  while ((m = re.exec(html))) {
    const ic = m[2];
    const no = metinle((ic.match(numRe) || [, ""])[1]);
    const ad = metinle(ic.replace(numRe, ""));
    if (ad) bolumler.push({ id: m[1], no, ad });
  }
  const toplam = (html.match(/<section[^>]*\bid=/gi) || []).length;
  if (toplam !== bolumler.length) {
    uyarilar.push(`${dosyaAdi}: ${toplam} bölümün yalnızca ${bolumler.length} tanesinin h2 başlığı okunabildi.`);
  }
  return bolumler;
}

/**
 * Okuma süresi. Yalnızca <section> içeriği sayılır — başlık alanı, içindekiler
 * ve enjekte edilen kabuk hesaba katılmaz. Dakikada 200 kelime varsayılır.
 */
function okumaSuresi(html) {
  let govde = "";
  const re = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let m;
  while ((m = re.exec(html))) govde += " " + m[1];
  const kelime = metinle(govde.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ""))
    .split(/\s+/)
    .filter(Boolean).length;
  return { kelime, sure: Math.max(1, Math.round(kelime / 200)) };
}

/** Ortak etiket sayısına göre en yakın yazılar. Hiç ortak etiket yoksa boş döner. */
function ilgiliBul(kayit, hepsi, adet = 3) {
  const kume = new Set(kayit.etiketler.map((t) => t.toLocaleLowerCase("tr")));
  if (!kume.size) return [];
  return hepsi
    .filter((k) => k.dosya !== kayit.dosya)
    .map((k) => ({ k, ortak: k.etiketler.filter((t) => kume.has(t.toLocaleLowerCase("tr"))).length }))
    .filter((x) => x.ortak > 0)
    .sort((a, b) => b.ortak - a.ortak || String(b.k.tarih).localeCompare(String(a.k.tarih)))
    .slice(0, adet)
    .map((x) => ({ dosya: path.basename(x.k.dosya), baslik: x.k.baslik }));
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
<script>/* Kayıtlı tema tercihini boyamadan önce uygula (FOUC yok).
   Aynı yerde .yazi-yazim sınıfı eklenir: başlık, daktilo animasyonu hazırlanana
   kadar gizli kalsın diye. JS kapalıysa sınıf hiç eklenmez, başlık normal görünür. */
(function(){try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}
document.documentElement.classList.add("yazi-yazim");})();</script>
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
  /* --- Başlık: komut satırı görünümü --- */
  .yazi-yazim header.hero h1{visibility:hidden;}
  header.hero h1{
    font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-weight:500;font-size:clamp(21px,5.2vw,46px);line-height:1.32;letter-spacing:-.02em;}
  header.hero h1 em{font-style:normal;}
  /* Karakter düz yazılır: "\\276F " biçiminde yazılırsa sondaki boşluk hex
     kaçışın sonlandırıcısı sayılır ve içeriğe boşluk olarak geçmez. */
  header.hero h1::before{content:"❯ ";color:var(--accent);opacity:.5;}
  .yazi-imlec{display:inline-block;width:0;height:1em;vertical-align:-.12em;position:relative;}
  .yazi-imlec::after{content:"";position:absolute;left:.04em;bottom:0;width:.52em;height:1em;
    background:var(--accent);animation:yazi-imlec-yanip 1.05s steps(1) infinite;}
  @keyframes yazi-imlec-yanip{0%,50%{opacity:1;}50.01%,100%{opacity:0;}}
  @media (prefers-reduced-motion: reduce){.yazi-imlec::after{animation:none;}}
  @media (max-width:900px){
    .yazi-geri{position:static;display:inline-block;margin:16px 0 0 20px;}
    .tema-btn{top:12px;right:12px;width:32px;height:32px;font-size:14px;}
  }
  /* --- Okuma ilerleme çubuğu --- */
  .yazi-ilerleme{position:fixed;top:0;left:0;z-index:100;height:2px;width:100%;
    background:var(--accent);transform:scaleX(0);transform-origin:0 50%;will-change:transform;}
  /* --- Kod bloğu kopyala düğmesi ---
     pre'nin kendisi yatay kayabildiği için düğme, pre'yi saran ayrı bir
     kapsayıcıya konur; böylece kod sağa kaydırılınca düğme yerinde kalır. */
  .yazi-pre-sar{position:relative;}
  .yazi-kopyala{position:absolute;top:10px;right:10px;z-index:2;
    font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.06em;line-height:1;
    color:var(--ink-mute);background:var(--panel);border:1px solid var(--line);border-radius:7px;
    padding:6px 10px;cursor:pointer;opacity:0;transition:opacity .15s,color .15s,border-color .15s;}
  .yazi-pre-sar:hover .yazi-kopyala,.yazi-kopyala:focus-visible{opacity:1;}
  .yazi-kopyala:hover{color:var(--accent);border-color:var(--accent);}
  .yazi-kopyala.ok{opacity:1;color:var(--accent-2);border-color:var(--accent-2);}
  @media (hover:none){.yazi-kopyala{opacity:.7;}}
  /* --- İçindekiler: okunan bölümün vurgulanması ---
     Geniş ekranda liste sol boşluğa sabitlenir ve okurken yerinde kalır;
     dar ekranda normal akıştaki kutu görünümünü korur. */
  .toc a{transition:color .18s,border-color .18s;}
  .toc a.aktif{color:var(--accent);}
  @media (min-width:1400px){
    .toc{position:fixed;top:92px;left:calc(50vw - 676px);width:212px;
      margin:0;padding:0;background:none;border:none;
      max-height:calc(100vh - 150px);overflow-y:auto;}
    .toc ol{columns:1;}
    .toc li{margin-bottom:0;}
    .toc a{font-size:13px;line-height:1.45;padding:5px 0 5px 12px;border-left:1px solid var(--line);}
    .toc a.aktif{border-left-color:var(--accent);}
  }
  /* Dar ekranda içindekiler katlanır ve kapalı başlar; 12 maddelik liste
     yoksa içeriği ekran boyu aşağı itiyor. Etiket bölüm sayısını verir. */
  .yazi-toc-ac{display:none;}
  @media (max-width:900px){
    .yazi-toc-ac{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;
      font-family:"JetBrains Mono",monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
      color:var(--ink-mute);background:none;border:none;padding:0;cursor:pointer;}
    .yazi-toc-ac .ok{transition:transform .2s;font-size:14px;}
    .toc[data-kapali="1"] ol{display:none;}
    .toc:not([data-kapali="1"]) .yazi-toc-ac{margin-bottom:16px;}
    .toc:not([data-kapali="1"]) .yazi-toc-ac .ok{transform:rotate(180deg);}
  }
  /* --- Bölüm başlığı anchor'ı --- */
  h2 .yazi-anchor{font-family:"JetBrains Mono",monospace;font-size:.46em;flex:none;
    color:var(--ink-mute);text-decoration:none;opacity:0;transition:opacity .15s,color .15s;}
  h2:hover .yazi-anchor,.yazi-anchor:focus-visible{opacity:1;}
  .yazi-anchor:hover{color:var(--accent);}
  section.yazi-parla{animation:yazi-parla 1.3s ease-out;}
  @keyframes yazi-parla{from{background:rgba(232,163,61,.13);}to{background:transparent;}}
  @media (prefers-reduced-motion: reduce){section.yazi-parla{animation:none;}}
  /* --- Yukarı dön --- */
  .yazi-yukari{position:fixed;right:18px;bottom:18px;z-index:99;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;
    color:var(--ink-soft);background:var(--panel);border:1px solid var(--line);border-radius:999px;
    backdrop-filter:blur(6px);opacity:0;pointer-events:none;transform:translateY(6px);
    transition:opacity .2s,transform .2s,color .15s,border-color .15s;}
  .yazi-yukari.gorunur{opacity:1;pointer-events:auto;transform:none;}
  .yazi-yukari:hover{color:var(--accent);border-color:var(--accent);}
  /* --- Sayfa sonu gezinme --- */
  .yazi-gezinme{margin-top:72px;padding-top:28px;border-top:1px solid var(--line);}
  .yazi-komsu{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .yazi-komsu-bag{display:flex;flex-direction:column;gap:6px;text-decoration:none;
    background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;
    transition:border-color .15s,transform .15s;}
  .yazi-komsu-bag:hover{border-color:var(--accent);transform:translateY(-2px);}
  .yazi-komsu-bag .yon{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--accent);}
  .yazi-komsu-bag .ad{color:var(--ink);font-weight:600;font-size:15px;line-height:1.35;}
  .yazi-komsu-bag.sag{text-align:right;align-items:flex-end;}
  .yazi-ilgili{margin-top:18px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
  .yazi-ilgili-baslik{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--ink-mute);margin:0 4px 0 0;}
  .yazi-ilgili a{font-size:13.5px;color:var(--ink-soft);text-decoration:none;
    border:1px solid var(--line);border-radius:999px;padding:6px 14px;
    transition:color .15s,border-color .15s;}
  .yazi-ilgili a:hover{color:var(--accent);border-color:var(--accent);}
  .yazi-sure{font-family:"JetBrains Mono",monospace;font-size:12px;letter-spacing:.1em;
    text-transform:uppercase;color:var(--ink-mute);margin:16px 0 0;}
  @media (max-width:620px){
    .yazi-komsu{grid-template-columns:1fr;}
    .yazi-komsu-bag.sag{text-align:left;align-items:flex-start;}
  }
  /* --- Tema geçişi ---
     Sınıf yalnızca düğmeye basıldığı anda eklenir; sürekli açık kalsa
     sıradan hover'lar da yavaşlardı. */
  :root.yazi-tema-gecis,:root.yazi-tema-gecis *{
    transition:background-color .22s,border-color .22s,color .22s !important;}
  @media (prefers-reduced-motion: reduce){
    :root.yazi-tema-gecis,:root.yazi-tema-gecis *{transition:none !important;}
  }
  /* --- Yazdırma ---
     :root[data-theme] seçicisi tema override'larıyla aynı özgüllükte ve
     daha sonra geldiği için kazanır; yoksa koyu tema kâğıda basılırdı. */
  @media print{
    :root,:root[data-theme]{
      --bg:#fff; --panel:#fff; --panel-2:#f2f2f2; --table-bg:#fff;
      --card:#fff; --card-line:#bbb;
      --ink:#000; --ink-soft:#1c1c1c; --ink-mute:#555;
      --line:#bbb; --accent:#7a3c00; --accent-2:#1d5c20; --danger:#a01c10;
      --code-bg:#f6f6f6; --code-ink:#111;
    }
    .yazi-geri,.tema-btn,.yazi-ilerleme,.yazi-kopyala,.yazi-yukari,.yazi-gezinme,.yazi-toc-ac{display:none !important;}
    /* Daktilo animasyonu sürerken yazdırılırsa başlık eksik basılırdı:
       harfler görünürlüğü kapalı halde bekliyor. Kâğıtta hepsi görünür. */
    .yazi-imlec{display:none !important;}
    .yazi-yazim header.hero h1,header.hero h1 span{visibility:visible !important;}
    body{background:#fff !important;color:#000;font-size:10.5pt;}
    .wrap{max-width:none;padding:0;}
    .toc{position:static !important;left:auto !important;top:auto !important;width:auto !important;
      max-height:none !important;overflow:visible !important;
      border:1px solid #bbb !important;padding:16px 20px !important;margin-bottom:28px !important;}
    /* Kâğıt dar olsa da içindekiler açık basılır: katlama yalnızca ekran içindir. */
    .toc[data-kapali="1"] ol{display:block !important;}
    .toc ol{columns:2 !important;}
    .toc a{border-left:none !important;padding-left:0 !important;}
    h2,h3{break-after:avoid;}
    pre,.card,.note,.table-scroll,figure{break-inside:avoid;}
    a[href^="http"]::after{content:" (" attr(href) ")";font-size:8.5pt;color:#555;word-break:break-all;}
  }
</style>
<a class="yazi-geri" href="../index.html">&#8592; Tüm yazılar</a>
<button class="tema-btn" id="temaBtn" type="button" aria-label="Temayı değiştir" title="Temayı değiştir"></button>
<script>
(function(){
  var kok=document.documentElement,btn=document.getElementById("temaBtn");
  function aktif(){return kok.dataset.theme||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");}
  function ciz(){btn.textContent=aktif()==="light"?"☾":"☀";}
  var gecisZaman;
  btn.addEventListener("click",function(){
    var yeni=aktif()==="light"?"dark":"light";
    /* Renkler anlık sıçramasın; sınıf kısa süre kalır (bkz. .yazi-tema-gecis). */
    kok.classList.add("yazi-tema-gecis");
    clearTimeout(gecisZaman);
    gecisZaman=setTimeout(function(){kok.classList.remove("yazi-tema-gecis");},280);
    kok.dataset.theme=yeni;
    try{localStorage.setItem("tema",yeni);}catch(e){}
    ciz();
  });
  ciz();
})();
</script>
<script>
/* Başlığı komut satırında yazılıyormuş gibi harf harf gösterir.
   Harfler en baştan yer kaplar (görünürlük kapatılır, kaldırılmaz), böylece
   animasyon boyunca satır sarması ve sayfa düzeni hiç oynamaz.
   JS kapalıysa veya reduced-motion açıksa başlık olduğu gibi görünür. */
(function(){
  var kok=document.documentElement;
  function ac(){kok.classList.remove("yazi-yazim");}
  function baslat(){
    try{
      var h1=document.querySelector("header.hero h1");
      if(!h1){ac();return;}
      if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){ac();return;}
      /* Etiketi innerText'ten alma: başlık o an gizli olduğu için boş dönebilir.
         <br> yerine boşluk koyup metni doğrudan çıkar. */
      var gecici=document.createElement("div");
      gecici.innerHTML=h1.innerHTML.replace(/<br\\s*\\/?>/gi," ");
      h1.setAttribute("aria-label",(gecici.textContent||"").replace(/\\s+/g," ").trim());
      var gez=document.createTreeWalker(h1,NodeFilter.SHOW_TEXT),dugumler=[],d;
      while(d=gez.nextNode())dugumler.push(d);
      var harfler=[];
      dugumler.forEach(function(tn){
        var parca=document.createDocumentFragment();
        tn.nodeValue.split("").forEach(function(h){
          var s=document.createElement("span");
          s.textContent=h;s.style.visibility="hidden";s.setAttribute("aria-hidden","true");
          parca.appendChild(s);harfler.push(s);
        });
        tn.parentNode.replaceChild(parca,tn);
      });
      if(!harfler.length){ac();return;}
      var imlec=document.createElement("span");
      imlec.className="yazi-imlec";imlec.setAttribute("aria-hidden","true");
      ac();
      var i=0;
      (function tik(){
        if(i>=harfler.length){
          setTimeout(function(){if(imlec.parentNode)imlec.parentNode.removeChild(imlec);},2600);
          return;
        }
        var s=harfler[i++];
        s.style.visibility="visible";
        s.parentNode.insertBefore(imlec,s.nextSibling);
        setTimeout(tik,/[,.:?!]/.test(s.textContent)?190:38);
      })();
    }catch(e){ac();}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",baslat);
  else baslat();
})();
</script>
<script>
/* Üstteki ilerleme çubuğu + içindekilerde o an okunan bölümün vurgulanması.
   İkisi de aynı scroll dinleyicisinden beslenir, rAF ile tek karede güncellenir. */
(function(){
  function baslat(){
    var cubuk=document.createElement("div");
    cubuk.className="yazi-ilerleme";
    cubuk.setAttribute("aria-hidden","true");
    document.body.appendChild(cubuk);

    var baglar=[],hedefler=[];
    Array.prototype.forEach.call(document.querySelectorAll(".toc a[href^='#']"),function(a){
      var el=document.getElementById(a.getAttribute("href").slice(1));
      if(el){baglar.push(a);hedefler.push(el);}
    });

    var bekliyor=false,sonAktif=-1;
    function guncelle(){
      bekliyor=false;
      var yol=document.documentElement.scrollHeight-window.innerHeight;
      var oran=yol>0?Math.min(1,Math.max(0,window.scrollY/yol)):0;
      cubuk.style.transform="scaleX("+oran+")";
      if(!hedefler.length)return;
      /* Üst kenarın 120px altını geçmiş son bölüm aktif sayılır. */
      var s=0;
      for(var i=0;i<hedefler.length;i++){
        if(hedefler[i].getBoundingClientRect().top<=120)s=i;
      }
      /* Son bölüm kısaysa dibe inince hiç aktifleşmeyebilir; en altta onu seç. */
      if(yol>0&&window.scrollY>=yol-4)s=hedefler.length-1;
      if(s!==sonAktif){
        if(sonAktif>-1)baglar[sonAktif].classList.remove("aktif");
        baglar[s].classList.add("aktif");
        sonAktif=s;
      }
    }
    function tetikle(){if(!bekliyor){bekliyor=true;requestAnimationFrame(guncelle);}}
    window.addEventListener("scroll",tetikle,{passive:true});
    window.addEventListener("resize",tetikle);
    guncelle();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",baslat);
  else baslat();
})();
</script>
<script>
/* Her kod bloğuna kopyala düğmesi. Sözdizimi renklendirmesi <span>'lerle
   yapıldığı için textContent düz metni doğru verir. clipboard API yoksa
   (veya izin vermezse) execCommand ile geri düşülür. */
(function(){
  function kopyala(metin){
    if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(metin);
    return new Promise(function(coz,red){
      var a=document.createElement("textarea");
      a.value=metin;a.setAttribute("readonly","");
      a.style.position="fixed";a.style.top="-1000px";
      document.body.appendChild(a);a.select();
      var ok=false;
      try{ok=document.execCommand("copy");}catch(e){ok=false;}
      document.body.removeChild(a);
      ok?coz():red();
    });
  }
  function baslat(){
    Array.prototype.forEach.call(document.querySelectorAll("pre"),function(pre){
      if(pre.parentNode&&pre.parentNode.classList.contains("yazi-pre-sar"))return;
      var sar=document.createElement("div");
      sar.className="yazi-pre-sar";
      pre.parentNode.insertBefore(sar,pre);
      sar.appendChild(pre);

      var btn=document.createElement("button");
      btn.type="button";
      btn.className="yazi-kopyala";
      btn.textContent="kopyala";
      btn.setAttribute("aria-label","Kod bloğunu kopyala");
      sar.appendChild(btn);

      var zaman;
      btn.addEventListener("click",function(){
        var kod=pre.querySelector("code")||pre;
        /* Kaynak dosyalar CRLF olabiliyor; panoya LF gitsin ki kod
           doğrudan terminale yapıştırılabilsin. */
        var metin=String(kod.textContent).replace(/\\r\\n?/g,"\\n").replace(/\\s+$/,"");
        kopyala(metin).then(function(){
          btn.textContent="kopyalandı ✓";btn.classList.add("ok");
        },function(){
          btn.textContent="kopyalanamadı";btn.classList.remove("ok");
        });
        clearTimeout(zaman);
        zaman=setTimeout(function(){btn.textContent="kopyala";btn.classList.remove("ok");},1800);
      });
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",baslat);
  else baslat();
})();
</script>
<script>
/* Sayfaya özel veriden (window.YAZI_VERI, build.mjs üretir) beslenen parçalar:
   okuma süresi ve sayfa sonundaki gezinme bloğu. Veri yoksa hiçbiri basılmaz. */
(function(){
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function komsuBag(k,yon,sinif){
    return '<a class="yazi-komsu-bag '+sinif+'" href="'+esc(k.dosya)+'">'+
      '<span class="yon">'+esc(yon)+'</span><span class="ad">'+esc(k.baslik)+'</span></a>';
  }
  function baslat(){
    var v=window.YAZI_VERI||{};

    var lede=document.querySelector("header.hero .lede");
    if(v.sure&&lede&&!document.querySelector(".yazi-sure")){
      var s=document.createElement("p");
      s.className="yazi-sure";
      s.textContent="~"+v.sure+" dakikalık okuma";
      lede.parentNode.insertBefore(s,lede.nextSibling);
    }

    var footer=document.querySelector(".wrap > footer");
    if(!footer||document.querySelector(".yazi-gezinme"))return;
    var ilgili=v.ilgili||[];
    if(!v.yeni&&!v.eski&&!ilgili.length)return;

    var html="";
    if(v.yeni||v.eski){
      /* Sıralama yeniden eskiye; komşuları tarih diliyle adlandırmak
         "önceki/sonraki"den daha az kafa karıştırıyor. */
      html+='<div class="yazi-komsu">'+
        (v.yeni?komsuBag(v.yeni,"← Daha yeni",""):"<span></span>")+
        (v.eski?komsuBag(v.eski,"Daha eski →","sag"):"<span></span>")+
      "</div>";
    }
    if(ilgili.length){
      html+='<div class="yazi-ilgili"><p class="yazi-ilgili-baslik">İlgili</p>'+
        ilgili.map(function(k){
          return '<a href="'+esc(k.dosya)+'">'+esc(k.baslik)+"</a>";
        }).join("")+"</div>";
    }

    var nav=document.createElement("nav");
    nav.className="yazi-gezinme";
    nav.setAttribute("aria-label","Diğer yazılar");
    nav.innerHTML=html;
    footer.parentNode.insertBefore(nav,footer);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",baslat);
  else baslat();
})();
</script>
<script>
/* Bölüm başlığı anchor'ları, yukarı dön düğmesi ve dar ekranda katlanan
   içindekiler. Üçü de sayfa içeriğinden bağımsız, tamamen DOM üstünde çalışır. */
(function(){
  function parlat(id){
    var el=document.getElementById(id);
    if(!el)return;
    el.classList.remove("yazi-parla");
    void el.offsetWidth;           /* animasyonu yeniden tetiklemek için */
    el.classList.add("yazi-parla");
  }

  function anchorlar(){
    Array.prototype.forEach.call(document.querySelectorAll("section[id] > h2"),function(h2){
      if(h2.querySelector(".yazi-anchor"))return;
      var id=h2.parentNode.id;
      var a=document.createElement("a");
      a.className="yazi-anchor";
      a.href="#"+id;
      a.textContent="#";
      a.setAttribute("aria-label","Bu bölüme bağlantı");
      h2.appendChild(a);
      a.addEventListener("click",function(){setTimeout(function(){parlat(id);},380);});
    });
  }

  function yukariDugmesi(){
    var btn=document.createElement("button");
    btn.type="button";
    btn.className="yazi-yukari";
    btn.textContent="↑";
    btn.setAttribute("aria-label","Sayfanın başına dön");
    document.body.appendChild(btn);
    btn.addEventListener("click",function(){
      window.scrollTo({top:0,behavior:"smooth"});
      var h1=document.querySelector("header.hero h1");
      if(h1){h1.setAttribute("tabindex","-1");h1.focus({preventScroll:true});}
    });
    var bekliyor=false;
    function guncelle(){
      bekliyor=false;
      btn.classList.toggle("gorunur",window.scrollY>600);
    }
    window.addEventListener("scroll",function(){
      if(!bekliyor){bekliyor=true;requestAnimationFrame(guncelle);}
    },{passive:true});
    guncelle();
  }

  function katlanabilirToc(){
    var toc=document.querySelector(".toc");
    var ol=toc&&toc.querySelector("ol");
    if(!toc||!ol||toc.querySelector(".yazi-toc-ac"))return;
    var adet=ol.querySelectorAll("li").length;
    var btn=document.createElement("button");
    btn.type="button";
    btn.className="yazi-toc-ac";
    btn.innerHTML='<span>'+adet+' bölüm</span><span class="ok" aria-hidden="true">▾</span>';
    btn.setAttribute("aria-expanded","false");
    toc.insertBefore(btn,ol);
    toc.dataset.kapali="1";
    btn.addEventListener("click",function(){
      var kapali=toc.dataset.kapali==="1";
      if(kapali)delete toc.dataset.kapali; else toc.dataset.kapali="1";
      btn.setAttribute("aria-expanded",String(kapali));
    });
    /* Bir bölüme gidilince liste yine kapansın, içerik hemen görünsün. */
    ol.addEventListener("click",function(e){
      if(e.target.closest("a")&&window.matchMedia("(max-width:900px)").matches){
        toc.dataset.kapali="1";
        btn.setAttribute("aria-expanded","false");
      }
    });
  }

  function baslat(){
    anchorlar();
    yukariDugmesi();
    katlanabilirToc();
    /* Sayfa doğrudan #mN ile açıldıysa hedef bölüm bir an vurgulansın. */
    if(location.hash.length>1)setTimeout(function(){parlat(location.hash.slice(1));},300);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",baslat);
  else baslat();
})();
</script>
${KABUK_BITIR}`;

/* ---------- sayfaya özel veri bloğu ----------
 * Kabuk her sayfada birebir aynı olmak zorunda (tek yerden yönetiliyor), ama
 * okuma süresi / önceki-sonraki / ilgili yazılar sayfaya göre değişiyor.
 * Bu yüzden değişken kısım ayrı bir blokta window.YAZI_VERI olarak yazılır;
 * kabuk JS'i onu okur. Böylece kabuk sabit kalır.
 */
const VERI_BASLA = "<!-- yazi:veri -->";
const VERI_BITIR = "<!-- /yazi:veri -->";

function veriBlogu(veri) {
  return `${VERI_BASLA}
<script>/* OTOMATİK ÜRETİLDİ (scripts/build.mjs) — elle düzenleme.
   Sayfaya özel veri; ortak kabuk bunu okuyup okuma süresini ve sayfa sonundaki
   gezinme bloğunu basar. */
window.YAZI_VERI=${JSON.stringify(veri)};</script>
${VERI_BITIR}`;
}

// Eski sürümlerden kalan blokları da yakalar.
const ESKI_BLOKLAR = [
  /<!-- ozet:geri -->[\s\S]*?<!-- \/ozet:geri -->\n?/,
  /<!-- yazi:geri -->[\s\S]*?<!-- \/yazi:geri -->\n?/,
];
const MEVCUT_BLOK = /<!-- yazi:kabuk -->[\s\S]*?<!-- \/yazi:kabuk -->/;
const MEVCUT_VERI = /<!-- yazi:veri -->[\s\S]*?<!-- \/yazi:veri -->/;

/**
 * Yönetilen blokları önce tamamen söküp sonra yeniden yazar — bu yüzden
 * idempotent: içerik değişmediyse dosyaya dokunulmaz.
 */
async function sayfayiGuncelle(dosyaYolu, html, veri) {
  let yeni = html;
  for (const eski of ESKI_BLOKLAR) yeni = yeni.replace(eski, "");
  yeni = yeni.replace(MEVCUT_VERI, "").replace(MEVCUT_BLOK, "");
  yeni = yeni.replace(/(<body[^>]*>)\s*\n/i, "$1\n");

  const blok = `${veriBlogu(veri)}\n${KABUK}`;
  const eklenmis = yeni.replace(/(<body[^>]*>)/i, `$1\n${blok}\n`);
  if (eklenmis === yeni) {
    uyarilar.push(`${path.basename(dosyaYolu)}: <body> etiketi bulunamadı, ortak kabuk eklenmedi.`);
    return html;
  }

  if (eklenmis !== html) {
    await writeFile(dosyaYolu, eklenmis, "utf8");
    console.log(`  + güncellendi: ${path.basename(dosyaYolu)}`);
  }
  return eklenmis;
}

/* ---------- tek dosyayı çözümle ---------- */

async function cozumle(dosyaAdi) {
  const tamYol = path.join(YAZI_DIR, dosyaAdi);
  const html = await readFile(tamYol, "utf8");

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

  const { kelime, sure } = okumaSuresi(html);

  return {
    tamYol,
    html,
    kelime,
    kayit: {
      dosya: `posts/${dosyaAdi}`,
      baslik,
      aciklama: aciklama || "",
      kategori,
      etiketler,
      kaynak: kaynak || "",
      tarih,
      sure,
      bolumler: bolumleriCikar(html, dosyaAdi),
    },
  };
}

/* ---------- ana akış ---------- */

const dosyalar = (await readdir(YAZI_DIR)).filter((f) => /\.html?$/i.test(f)).sort();

if (!dosyalar.length) {
  console.error("posts/ klasöründe HTML bulunamadı.");
  process.exit(1);
}

console.log(`${dosyalar.length} sayfa taranıyor…`);

// 1. geçiş: oku ve çözümle. Sayfaya yazmak için tüm kayıtların bilinmesi
// gerekiyor (önceki/sonraki ve ilgili yazılar), o yüzden yazma 2. geçişte.
const cozumlenen = [];
for (const f of dosyalar) cozumlenen.push(await cozumle(f));

cozumlenen.sort((a, b) => String(b.kayit.tarih).localeCompare(String(a.kayit.tarih)));
const kayitlar = cozumlenen.map((c) => c.kayit);

// 2. geçiş: her sayfaya kendi verisini ve ortak kabuğu yaz.
// Sıra yeniden-eskiye olduğu için "önceki" listede sonraki (daha eski) yazıdır.
for (let i = 0; i < cozumlenen.length; i++) {
  const { tamYol, html, kayit } = cozumlenen[i];
  const komsu = (k) => (k ? { dosya: path.basename(k.dosya), baslik: k.baslik } : null);
  await sayfayiGuncelle(tamYol, html, {
    sure: kayit.sure,
    yeni: komsu(kayitlar[i - 1]),
    eski: komsu(kayitlar[i + 1]),
    ilgili: ilgiliBul(kayit, kayitlar),
  });
}

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
const etiketler = [...new Set(kayitlar.flatMap((k) => k.etiketler))];
const bolumSayisi = kayitlar.reduce((n, k) => n + k.bolumler.length, 0);
console.log(`\n✓ data/posts.js ve data/posts.json güncellendi.`);
console.log(`  ${kayitlar.length} sayfa · ${bolumSayisi} bölüm · ${etiketler.length} etiket`);
console.log(`  ${kategoriler.length} kategori: ${kategoriler.join(", ")}`);

if (uyarilar.length) {
  console.log("\nUyarılar:");
  for (const u of uyarilar) console.log(`  ! ${u}`);
}
