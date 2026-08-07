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

  var gecisZaman;
  btn.addEventListener("click", function () {
    var yeni = aktif() === "light" ? "dark" : "light";
    // Renkler anlık sıçramasın; sınıf kısa süre kalır (bkz. .yazi-tema-gecis).
    kok.classList.add("yazi-tema-gecis");
    clearTimeout(gecisZaman);
    gecisZaman = setTimeout(function () { kok.classList.remove("yazi-tema-gecis"); }, 280);
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
  var aktifEtiket = "";
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

  function kucult(s) {
    return String(s == null ? "" : s).toLocaleLowerCase("tr");
  }

  // Aramadaki kelimeler; her çizimden önce bir kez hesaplanır.
  var kelimeler = [];
  function kelimeleriTazele() {
    kelimeler = kucult(arama).split(/\s+/).filter(Boolean);
  }

  /**
   * Eşleşen kelimeleri <mark> ile sarar. Metin önce eşleşme aralıklarına
   * bölünür, sonra her parça ayrı ayrı escape edilir — böylece &amp; gibi
   * diziler ortadan bölünmez ve HTML enjeksiyonu mümkün olmaz.
   */
  function vurgula(metin, sozler) {
    var s = String(metin == null ? "" : metin);
    if (!sozler.length || !s) return esc(s);

    var kucuk = kucult(s);
    // Türkçe küçültme uzunluğu değiştirirse konum eşlemesi güvenilmez olur.
    if (kucuk.length !== s.length) return esc(s);

    var isaret = [];
    sozler.forEach(function (k) {
      var i = kucuk.indexOf(k);
      while (i !== -1) {
        for (var j = i; j < i + k.length; j++) isaret[j] = true;
        i = kucuk.indexOf(k, i + k.length);
      }
    });

    var cikti = "", bas = 0;
    while (bas < s.length) {
      var son = bas + 1;
      while (son < s.length && !isaret[son] === !isaret[bas]) son++;
      var parca = esc(s.slice(bas, son));
      cikti += isaret[bas] ? "<mark>" + parca + "</mark>" : parca;
      bas = son;
    }
    return cikti;
  }

  // --- Filtre satırı: kategoriler + aktif etiket ---
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
    var html = "";
    // Tek kategori varsa sekmeler hiçbir şeyi ayırmıyor demektir; yer kaplamasın.
    // İkinci kategori eklendiği anda kendiliğinden geri gelir.
    if (list.length > 1) {
      html +=
        '<button class="chip" data-kat="hepsi" aria-pressed="' + (aktifKategori === "hepsi") +
        '">Tümü<span class="n">' + yazilar.length + "</span></button>";
      list.forEach(function (k) {
        html +=
          '<button class="chip" data-kat="' + esc(k.ad) + '" aria-pressed="' + (aktifKategori === k.ad) + '">' +
          esc(k.ad) + '<span class="n">' + k.adet + "</span></button>";
      });
    }
    if (aktifEtiket) {
      html +=
        '<button class="chip etiket-chip" data-etiket-sil="1" aria-pressed="true" ' +
        'title="Etiket filtresini kaldır" aria-label="Etiket filtresini kaldır: ' + esc(aktifEtiket) + '">#' +
        esc(aktifEtiket) + '<span class="x" aria-hidden="true">×</span></button>';
    }
    filters.innerHTML = html;
    filters.hidden = !html;
  }

  // --- Eşleşme ---
  function eslesir(y) {
    if (aktifKategori !== "hepsi" && (y.kategori || "Diğer") !== aktifKategori) return false;
    if (aktifEtiket) {
      var hedef = kucult(aktifEtiket);
      var var_ = (y.etiketler || []).some(function (t) { return kucult(t) === hedef; });
      if (!var_) return false;
    }
    if (!kelimeler.length) return true;
    // Bölüm başlıkları da samanlığa dahil: arama yazının gövdesini de görür.
    var hay = kucult(
      [
        y.baslik,
        y.aciklama,
        y.kategori,
        (y.etiketler || []).join(" "),
        y.kaynak,
        (y.bolumler || []).map(function (b) { return b.ad; }).join(" "),
      ].join(" ")
    );
    return kelimeler.every(function (k) { return hay.indexOf(k) !== -1; });
  }

  // Aramayla eşleşen bölümler — karttan doğrudan #mN bağlantısı verilir.
  function eslesenBolumler(y) {
    if (!kelimeler.length) return [];
    return (y.bolumler || []).filter(function (b) {
      var h = kucult(b.ad);
      return kelimeler.some(function (k) { return h.indexOf(k) !== -1; });
    });
  }

  function azHareket() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // --- FLIP: filtre değişiminde kartlar zıplamasın, yeni yerlerine kaysın ---
  function konumlariOlc() {
    var harita = {};
    Array.prototype.forEach.call(grid.querySelectorAll(".card"), function (el) {
      harita[el.dataset.dosya] = el.getBoundingClientRect();
    });
    return harita;
  }

  function gecisiOynat(eskiKonumlar) {
    Array.prototype.forEach.call(grid.querySelectorAll(".card"), function (el, i) {
      var o = eskiKonumlar[el.dataset.dosya];
      if (!o) {
        // Listeye yeni giren kart: kayacak eski konumu yok, belirerek gelsin.
        el.style.animationDelay = Math.min(i, 12) * 28 + "ms";
        el.classList.add("giris");
        return;
      }
      var y = el.getBoundingClientRect();
      var dx = o.left - y.left, dy = o.top - y.top;
      if (!dx && !dy) return;
      el.animate(
        [{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }],
        { duration: 320, easing: "cubic-bezier(.22,.61,.36,1)" }
      );
    });
  }

  function kartHtml(y) {
    var etiketler = (y.etiketler || [])
      .slice(0, 5)
      .map(function (t) {
        return '<button type="button" class="tag" data-etiket="' + esc(t) + '">' + esc(t) + "</button>";
      })
      .join("");

    var bolumler = eslesenBolumler(y);
    var bolumHtml = "";
    if (bolumler.length) {
      bolumHtml =
        '<div class="bolumler">' +
        bolumler
          .slice(0, 4)
          .map(function (b) {
            return (
              '<a class="bolum" href="' + esc(y.dosya) + "#" + esc(b.id) + '">' +
              '<span class="n">' + esc(b.no) + "</span>" + vurgula(b.ad, kelimeler) + "</a>"
            );
          })
          .join("") +
        (bolumler.length > 4 ? '<span class="bolum-daha">+' + (bolumler.length - 4) + " bölüm daha</span>" : "") +
        "</div>";
    }

    return (
      '<article class="card" data-dosya="' + esc(y.dosya) + '">' +
        '<p class="cat">' + esc(y.kategori || "Diğer") + "</p>" +
        '<h2><a class="card-link" href="' + esc(y.dosya) + '">' + vurgula(y.baslik, kelimeler) + "</a></h2>" +
        "<p>" + vurgula(y.aciklama, kelimeler) + "</p>" +
        bolumHtml +
        (etiketler ? '<div class="tags">' + etiketler + "</div>" : "") +
        '<div class="meta">' +
          '<span class="src">' + esc(host(y.kaynak)) + "</span>" +
          "<span>" + (y.sure ? y.sure + " dk · " : "") + esc(tarihTR(y.tarih)) + "</span>" +
        "</div>" +
      "</article>"
    );
  }

  var ilkCizim = true;

  // animasyonlu=true ise geçiş oynatılır. Arama yazarken false geçilir: her tuş
  // vuruşunda ızgara yeniden çizildiği için animasyon takılma gibi görünür.
  function ciz(animasyonlu) {
    kelimeleriTazele();
    var oyna = animasyonlu && !azHareket();
    var eskiKonumlar = oyna && !ilkCizim ? konumlariOlc() : null;

    var gorunen = yazilar.filter(eslesir);
    count.textContent = gorunen.length + " / " + yazilar.length + " YAZI";

    if (!gorunen.length) {
      grid.innerHTML =
        '<div class="empty">Eşleşen yazı yok. Aramayı, etiketi veya kategoriyi değiştir.</div>';
      return;
    }

    grid.innerHTML = gorunen.map(kartHtml).join("");
    if (!oyna) return;

    if (eskiKonumlar) {
      gecisiOynat(eskiKonumlar);
    } else {
      // İlk çizim: kartlar sırayla belirsin. Gecikme 12. karttan sonra
      // sabitlenir, uzun listelerde kuyruk beklenmesin.
      Array.prototype.forEach.call(grid.children, function (el, i) {
        el.style.animationDelay = Math.min(i, 12) * 34 + "ms";
        el.classList.add("giris");
      });
    }
    ilkCizim = false;
  }

  // --- Olaylar ---
  filters.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    if (btn.dataset.etiketSil) {
      aktifEtiket = "";
    } else {
      aktifKategori = btn.dataset.kat;
    }
    filtreleriCiz();
    ciz(true);
  });

  // Kartlardaki etiketlere tıklayınca o etikete filtrele.
  grid.addEventListener("click", function (e) {
    var t = e.target.closest(".tag");
    if (!t) return;
    e.preventDefault();
    var ad = t.dataset.etiket;
    aktifEtiket = kucult(aktifEtiket) === kucult(ad) ? "" : ad;
    filtreleriCiz();
    ciz(true);
    // Filtre satırı yukarıda; seçim görünmeden değişmesin.
    if (aktifEtiket) filters.scrollIntoView({ block: "nearest" });
  });

  input.addEventListener("input", function () {
    arama = input.value.trim();
    ciz(false);
  });

  // Yeniden eskiye sırala
  yazilar.sort(function (a, b) { return String(b.tarih || "").localeCompare(String(a.tarih || "")); });

  if (updated && window.YAZILAR_GUNCELLEME) {
    updated.textContent = "Son güncelleme: " + tarihTR(window.YAZILAR_GUNCELLEME);
  }

  filtreleriCiz();
  ciz(true);
})();

// Klavye gezinmesi: "/" aramaya odaklanır, Esc temizler,
// ↑ ↓ kartlar arasında gezer, Enter kartı açar (bağlantı olduğu için kendiliğinden).
(function () {
  var input = document.getElementById("q");
  var grid = document.getElementById("grid");
  if (!input || !grid) return;

  function kartlar() {
    return grid.querySelectorAll(".card-link");
  }

  function odakla(el) {
    if (!el) return;
    el.focus();
    // Bağlantı başlıkta; kartın tamamı görünsün diye kartı kaydır.
    (el.closest(".card") || el).scrollIntoView({ block: "nearest" });
  }

  function yazilabilir(el) {
    if (!el || !el.tagName) return false;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
  }

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var hedef = e.target;

    if (e.key === "/" && !yazilabilir(hedef)) {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }

    if (e.key === "Escape") {
      if (hedef === input) {
        e.preventDefault();
        // Dolu kutuyu önce boşalt, ikinci Esc'te odağı bırak.
        if (input.value) {
          input.value = "";
          input.dispatchEvent(new Event("input"));
        } else {
          input.blur();
        }
      } else if (hedef.blur) {
        hedef.blur();
      }
      return;
    }

    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    var list = kartlar();
    if (!list.length) return;

    if (hedef === input) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        odakla(list[0]);
      }
      return;
    }
    if (yazilabilir(hedef)) return;

    var i = Array.prototype.indexOf.call(list, hedef);
    if (i === -1) {
      // Odak ızgaranın dışında: aşağı ok listeye girer, yukarı ok yoksayılır.
      if (e.key === "ArrowDown") {
        e.preventDefault();
        odakla(list[0]);
      }
      return;
    }

    e.preventDefault();
    if (e.key === "ArrowUp" && i === 0) {
      input.focus();
      input.select();
      return;
    }
    odakla(list[e.key === "ArrowDown" ? Math.min(i + 1, list.length - 1) : i - 1]);
  });
})();

// Başlığı komut satırında yazılıyormuş gibi harf harf gösterir.
// Harfler en baştan yer kaplar (görünürlük kapatılır, kaldırılmaz), böylece
// animasyon boyunca satır sarması ve sayfa düzeni hiç oynamaz.
// JS kapalıysa veya reduced-motion açıksa başlık olduğu gibi görünür.
(function () {
  var kok = document.documentElement;
  function ac() { kok.classList.remove("yazi-yazim"); }

  try {
    var h1 = document.querySelector("header.hero h1");
    if (!h1) { ac(); return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { ac(); return; }

    // Etiketi innerText'ten alma: başlık o an gizli olduğu için boş dönebilir.
    // <br> yerine boşluk koyup metni doğrudan çıkar.
    var gecici = document.createElement("div");
    gecici.innerHTML = h1.innerHTML.replace(/<br\s*\/?>/gi, " ");
    h1.setAttribute("aria-label", (gecici.textContent || "").replace(/\s+/g, " ").trim());

    var gez = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT), dugumler = [], d;
    while ((d = gez.nextNode())) dugumler.push(d);

    var harfler = [];
    dugumler.forEach(function (tn) {
      var parca = document.createDocumentFragment();
      tn.nodeValue.split("").forEach(function (h) {
        var s = document.createElement("span");
        s.textContent = h;
        s.style.visibility = "hidden";
        s.setAttribute("aria-hidden", "true");
        parca.appendChild(s);
        harfler.push(s);
      });
      tn.parentNode.replaceChild(parca, tn);
    });
    if (!harfler.length) { ac(); return; }

    var imlec = document.createElement("span");
    imlec.className = "yazi-imlec";
    imlec.setAttribute("aria-hidden", "true");

    ac();

    var i = 0;
    (function tik() {
      if (i >= harfler.length) {
        setTimeout(function () { if (imlec.parentNode) imlec.parentNode.removeChild(imlec); }, 2600);
        return;
      }
      var s = harfler[i++];
      s.style.visibility = "visible";
      s.parentNode.insertBefore(imlec, s.nextSibling);
      setTimeout(tik, /[,.:?!]/.test(s.textContent) ? 190 : 38);
    })();
  } catch (e) { ac(); }
})();
