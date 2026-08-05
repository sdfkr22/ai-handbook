// Tema düğmesi — sistem tercihi varsayılan, seçim localStorage'da saklanır.
(function () {
  var kok = document.documentElement;
  var btn = document.getElementById("temaBtn");
  if (!btn) return;

  function aktif() {
    if (kok.dataset.theme) return kok.dataset.theme;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function ciz() {
    btn.textContent = aktif() === "light" ? "☾" : "☀";
  }

  btn.addEventListener("click", function () {
    var yeni = aktif() === "light" ? "dark" : "light";
    kok.dataset.theme = yeni;
    try { localStorage.setItem("tema", yeni); } catch (e) {}
    ciz();
  });

  ciz();
})();

// Katalog filtreleme — bağımlılık yok, dosya:// üzerinden de çalışır.
(function () {
  var yazilar = (window.YAZILAR || []).slice();
  var aktifKategori = "hepsi";
  var arama = "";

  var grid = document.getElementById("grid");
  var filters = document.getElementById("filters");
  var input = document.getElementById("q");
  var count = document.getElementById("count");
  var updated = document.getElementById("updated");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function host(url) {
    if (!url) return "";
    var m = String(url).match(/^https?:\/\/([^/]+)/i);
    return m ? m[1].replace(/^www\./, "") : "";
  }

  function tarihTR(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    var aylar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear();
  }

  // --- Kategori sekmeleri ---
  function kategoriler() {
    var sayac = {};
    yazilar.forEach(function (y) {
      var k = y.kategori || "Diğer";
      sayac[k] = (sayac[k] || 0) + 1;
    });
    return Object.keys(sayac)
      .sort(function (a, b) { return a.localeCompare(b, "tr"); })
      .map(function (k) { return { ad: k, adet: sayac[k] }; });
  }

  function filtreleriCiz() {
    var list = kategoriler();
    var html = '<button class="chip" data-kat="hepsi" aria-pressed="true">Tümü<span class="n">' + yazilar.length + "</span></button>";
    list.forEach(function (k) {
      html += '<button class="chip" data-kat="' + esc(k.ad) + '" aria-pressed="false">' + esc(k.ad) + '<span class="n">' + k.adet + "</span></button>";
    });
    filters.innerHTML = html;
  }

  // --- Kartlar ---
  function eslesir(y) {
    if (aktifKategori !== "hepsi" && (y.kategori || "Diğer") !== aktifKategori) return false;
    if (!arama) return true;
    var hay = [y.baslik, y.aciklama, y.kategori, (y.etiketler || []).join(" "), y.kaynak]
      .join(" ")
      .toLocaleLowerCase("tr");
    return arama
      .toLocaleLowerCase("tr")
      .split(/\s+/)
      .filter(Boolean)
      .every(function (kelime) { return hay.indexOf(kelime) !== -1; });
  }

  function ciz() {
    var gorunen = yazilar.filter(eslesir);
    count.textContent = gorunen.length + " / " + yazilar.length + " YAZI";

    if (!gorunen.length) {
      grid.innerHTML = '<div class="empty">Eşleşen yazı yok. Aramayı veya kategoriyi değiştir.</div>';
      return;
    }

    grid.innerHTML = gorunen
      .map(function (y) {
        var etiketler = (y.etiketler || [])
          .slice(0, 5)
          .map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; })
          .join("");
        return (
          '<a class="card-link" href="' + esc(y.dosya) + '">' +
            '<article class="card">' +
              '<p class="cat">' + esc(y.kategori || "Diğer") + "</p>" +
              "<h2>" + esc(y.baslik) + "</h2>" +
              "<p>" + esc(y.aciklama) + "</p>" +
              (etiketler ? '<div class="tags">' + etiketler + "</div>" : "") +
              '<div class="meta">' +
                '<span class="src">' + esc(host(y.kaynak)) + "</span>" +
                "<span>" + esc(tarihTR(y.tarih)) + "</span>" +
              "</div>" +
            "</article>" +
          "</a>"
        );
      })
      .join("");
  }

  // --- Olaylar ---
  filters.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    aktifKategori = btn.dataset.kat;
    Array.prototype.forEach.call(filters.querySelectorAll(".chip"), function (c) {
      c.setAttribute("aria-pressed", String(c === btn));
    });
    ciz();
  });

  input.addEventListener("input", function () {
    arama = input.value.trim();
    ciz();
  });

  // Yeniden eskiye sırala
  yazilar.sort(function (a, b) { return String(b.tarih || "").localeCompare(String(a.tarih || "")); });

  if (updated && window.YAZILAR_GUNCELLEME) {
    updated.textContent = "Son güncelleme: " + tarihTR(window.YAZILAR_GUNCELLEME);
  }

  filtreleriCiz();
  ciz();
})();
