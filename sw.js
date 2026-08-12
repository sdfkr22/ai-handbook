/* OTOMATİK ÜRETİLDİ (scripts/build.mjs) — elle düzenleme.
   Çevrimdışı okuma için service worker. Sürüm damgası önbellekteki dosyaların
   içeriğinden türer; içerik değiştiğinde eski önbellek atılır. */
const SURUM = "3c5c711ce007";
const AD = "ai-handbook-" + SURUM;
const ONBELLEK = [
  "./",
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "assets/site.css",
  "assets/site.js",
  "assets/fonts.css",
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-512-maskable.png",
  "data/posts.js",
  "assets/fonts/fraunces-600-latin-ext.woff2",
  "assets/fonts/fraunces-600-latin.woff2",
  "assets/fonts/ibm-plex-sans-400-latin-ext.woff2",
  "assets/fonts/ibm-plex-sans-400-latin.woff2",
  "assets/fonts/ibm-plex-sans-500-latin-ext.woff2",
  "assets/fonts/ibm-plex-sans-500-latin.woff2",
  "assets/fonts/ibm-plex-sans-600-latin-ext.woff2",
  "assets/fonts/ibm-plex-sans-600-latin.woff2",
  "assets/fonts/jetbrains-mono-400-latin-ext.woff2",
  "assets/fonts/jetbrains-mono-400-latin.woff2",
  "assets/fonts/jetbrains-mono-500-latin-ext.woff2",
  "assets/fonts/jetbrains-mono-500-latin.woff2",
  "posts/claude-code-steering-handbook.html",
  "posts/claude-code-web-mobile-guide.html",
  "posts/context-management-guide.html",
  "posts/creating-subagents-guide.html",
  "posts/doctor-command-guide.html",
  "posts/hooks-guide.html",
  "posts/loop-scheduled-tasks-guide.html",
  "posts/mcp-servers-guide.html",
  "posts/output-styles-guide.html",
  "posts/permissions-settings-guide.html",
  "posts/plan-mode-guide.html",
  "posts/plugins-guide.html",
  "posts/rewind-checkpoints-guide.html",
  "posts/statusline-guide.html",
  "posts/writing-skills-guide.html"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(AD).then((c) => c.addAll(ONBELLEK)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(
        adlar.filter((n) => n.startsWith("ai-handbook-") && n !== AD).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

function sakla(istek, yanit) {
  if (!yanit || !yanit.ok || yanit.type !== "basic") return yanit;
  const kopya = yanit.clone();
  caches.open(AD).then((c) => c.put(istek, kopya));
  return yanit;
}

self.addEventListener("fetch", (e) => {
  const istek = e.request;
  if (istek.method !== "GET") return;
  if (new URL(istek.url).origin !== location.origin) return;

  /* Sayfalar: önce ağ. Yayına yeni çıkmış bir yazı, eski önbellek yüzünden
     gizlenmemeli; çevrimdışıyken önbellek devreye girer. */
  if (istek.mode === "navigate") {
    e.respondWith(
      fetch(istek)
        .then((y) => sakla(istek, y))
        .catch(() => caches.match(istek).then((c) => c || caches.match("offline.html")))
    );
    return;
  }

  /* Varlıklar: önce önbellek (anında açılsın), arka planda tazele. */
  e.respondWith(
    caches.match(istek).then((c) => {
      const ag = fetch(istek).then((y) => sakla(istek, y)).catch(() => c);
      return c || ag;
    })
  );
});
