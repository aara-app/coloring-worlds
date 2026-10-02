/* Coloring Worlds — app controller: onboarding, navigation, parent gate, save */
(function () {
  "use strict";

  var LS_PROFILE = "cw_profile_v1";
  var BRUSH_PX = { s: 12, m: 26, l: 48 };

  var profile = loadProfile();
  var engine = null;
  var currentTheme = null;
  var obState = { gender: null, age: null, interests: [] };

  function $(id) { return document.getElementById(id); }
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(LS_PROFILE) || "null"); }
    catch (e) { return null; }
  }
  function saveProfile() {
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(profile)); } catch (e) {}
  }
  function show(id) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $(id).classList.add("active");
    $(id).scrollTop = 0;
  }
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 2200);
  }

  /* ================= onboarding ================= */
  function initOnboarding() {
    document.querySelectorAll("#s-ob1 .ob-big").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#s-ob1 .ob-big").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        obState.gender = b.getAttribute("data-gender");
        setTimeout(function () { show("s-ob2"); }, 220);
      });
    });
    document.querySelectorAll("#s-ob2 .ob-age").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#s-ob2 .ob-age").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        obState.age = b.getAttribute("data-age");
        setTimeout(function () { show("s-ob3"); }, 220);
      });
    });
    document.querySelectorAll(".back-btn").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-back")); });
    });
    var grid = $("interest-grid");
    window.CW_DATA.INTERESTS.forEach(function (it) {
      var btn = document.createElement("button");
      btn.className = "interest-btn";
      btn.setAttribute("data-id", it.id);
      btn.innerHTML = it.svg + "<span>" + it.label + "</span>";
      btn.addEventListener("click", function () {
        var i = obState.interests.indexOf(it.id);
        if (i >= 0) { obState.interests.splice(i, 1); btn.classList.remove("sel"); }
        else if (obState.interests.length < 3) { obState.interests.push(it.id); btn.classList.add("sel"); }
        else { toast("Pick up to 3"); return; }
        $("ob-start").disabled = obState.interests.length === 0;
      });
      grid.appendChild(btn);
    });
    $("ob-start").addEventListener("click", function () {
      profile = { gender: obState.gender, age: obState.age, interests: obState.interests.slice() };
      saveProfile();
      enterHome();
    });
  }

  /* ================= home / themes ================= */
  function isToddler() { return profile && profile.age === "0-2"; }
  function themeIcon(theme) {
    var p = theme.pages[0];
    for (var i = 0; i < theme.pages.length; i++) {
      if (theme.pages[i].id === theme.iconPage) { p = theme.pages[i]; break; }
    }
    // 0-2 kids see the simple bold thumbnails everywhere
    return (isToddler() && p.sthumb) ? p.sthumb : p.thumb;
  }
  function enterHome() {
    var grid = $("theme-grid");
    grid.innerHTML = "";
    var themes = window.CW_DATA.visibleThemes(profile.gender, profile.interests);
    $("home-greeting").textContent = "Pick a world!";
    themes.forEach(function (t) {
      var card = document.createElement("button");
      card.className = "theme-card";
      card.innerHTML = '<img alt="" loading="lazy"><span class="tname"></span><span class="tcount"></span>';
      card.querySelector("img").src = themeIcon(t);
      card.querySelector(".tname").textContent = t.title;
      card.querySelector(".tcount").textContent = t.pages.length + " pictures";
      card.addEventListener("click", function () { openTheme(t.id); });
      grid.appendChild(card);
    });
    show("s-home");
  }

  /* ================= page picker ================= */
  function openTheme(themeId) {
    currentTheme = window.CW_DATA.themeById(themeId);
    $("pages-title").textContent = currentTheme.title;
    var grid = $("page-grid");
    grid.innerHTML = "";
    currentTheme.pages.forEach(function (p) {
      var card = document.createElement("button");
      card.className = "page-card";
      card.setAttribute("aria-label", p.title);
      var img = document.createElement("img");
      img.src = (isToddler() && p.sthumb) ? p.sthumb : p.thumb; // colored reference thumbnail (simple for 0-2)
      img.alt = p.title;
      img.loading = "lazy";
      card.appendChild(img);
      card.addEventListener("click", function () { openColor(p); });
      grid.appendChild(card);
    });
    show("s-pages");
  }

  /* ================= coloring studio ================= */
  var PALETTE = window.CW_DATA.PALETTE;

  function buildPalette() {
    var pal = $("palette");
    pal.innerHTML = "";
    PALETTE.forEach(function (hex, i) {
      var b = document.createElement("button");
      b.className = "swatch" + (i === 0 ? " sel" : "");
      b.style.background = hex;
      b.setAttribute("aria-label", "color " + hex);
      b.addEventListener("click", function () {
        pal.querySelectorAll(".swatch").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        if (engine) engine.setColor(hex);
      });
      pal.appendChild(b);
    });
  }

  function fitCanvas() {
    if (!engine) return;
    var wrap = $("canvas-wrap");
    var w = wrap.clientWidth, h = wrap.clientHeight;
    var side = Math.max(50, Math.min(w, h));
    var cv = $("color-canvas");
    cv.style.width = side + "px";
    cv.style.height = side + "px";
  }
  window.addEventListener("resize", fitCanvas);
  window.addEventListener("orientationchange", function () { setTimeout(fitCanvas, 300); });

  function setToolUI(name) {
    ["brush", "fill", "eraser"].forEach(function (t) {
      $("tool-" + t).classList.toggle("sel", t === name);
    });
  }

  function openColor(page) {
    // page may be null => free draw
    $("color-title").textContent = page ? page.title : "Free Draw";
    show("s-color");
    var tapMode = profile && profile.age === "0-2";
    // 0-2 kids get the ultra-simple bold line art
    var artFile = page ? (tapMode && page.sfile ? page.sfile : page.file) : null;

    // NEVER remove the canvas element from the DOM — reuse it across opens.
    // Create the engine once, then reset its state for each new page.
    var cv = $("color-canvas");
    if (!engine) {
      engine = new window.CW_COLOR.ColoringEngine(cv, {
        tapMode: tapMode,
        defaultTool: tapMode ? "fill" : "brush",
        defaultColor: PALETTE[0],
        defaultBrush: tapMode ? 40 : 26
      });
    } else {
      engine.reset({
        tapMode: tapMode,
        defaultTool: tapMode ? "fill" : "brush",
        defaultColor: PALETTE[0],
        defaultBrush: tapMode ? 40 : 26
      });
    }
    buildPalette();
    setToolUI(tapMode ? "fill" : "brush");

    // age-adaptive toolbar
    $("tool-fill").style.display = "";
    $("tool-brush").style.display = tapMode ? "none" : "";
    $("brush-sizes").style.display = tapMode ? "none" : "";
    if (!tapMode) {
      document.querySelectorAll(".size-btn").forEach(function (b) {
        b.classList.toggle("sel", b.getAttribute("data-size") === "m");
      });
    }

    requestAnimationFrame(function () {
      fitCanvas();
      if (page && artFile) {
        engine.loadLineArt(artFile, function (err) {
          if (err) {
            // Fallback: blank canvas so the kid can still draw instead of a dead screen
            engine.blank();
            toast("Could not load the picture — free draw instead!");
          }
          fitCanvas();
        });
      } else {
        engine.blank();
      }
    });
  }

  function initStudio() {
    $("tool-brush").addEventListener("click", function () { engine && engine.setTool("brush"); setToolUI("brush"); });
    $("tool-fill").addEventListener("click", function () { engine && engine.setTool("fill"); setToolUI("fill"); });
    $("tool-eraser").addEventListener("click", function () { engine && engine.setTool("eraser"); setToolUI("eraser"); });
    $("tool-undo").addEventListener("click", function () {
      if (engine && !engine.undo()) toast("Nothing to undo");
    });
    $("tool-clear").addEventListener("click", function () {
      if (engine) { engine.clear(true); toast("Cleared!"); }
    });
    document.querySelectorAll(".size-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".size-btn").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        if (engine) engine.setBrushSize(BRUSH_PX[b.getAttribute("data-size")] || 26);
      });
    });
    $("btn-save").addEventListener("click", saveArtwork);
    $("color-back").addEventListener("click", function () { show("s-pages"); });
    $("pages-back").addEventListener("click", function () { enterHome(); });
  }

  function saveArtwork() {
    if (!engine) return;
    toast("Saving...");
    try {
      engine.exportPNG().toBlob(function (blob) {
        if (!blob) { toast("Save failed"); return; }
        var file = new File([blob], "coloring-worlds.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "My coloring!" }).catch(function () {});
        } else {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "coloring-worlds-" + Date.now() + ".png";
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
          toast("Saved!");
        }
      }, "image/png");
    } catch (e) { toast("Save failed"); }
  }

  /* ================= parent gate ================= */
  var holdTimer = null, holdStart = 0;
  function initGate() {
    $("btn-grown").addEventListener("click", function () {
      $("gate-modal").classList.remove("hidden");
      $("gate-bar").style.width = "0%";
    });
    $("gate-cancel").addEventListener("click", function () { $("gate-modal").classList.add("hidden"); stopHold(); });
    var holdBtn = $("gate-hold");
    holdBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      holdStart = Date.now();
      $("gate-bar").style.transition = "none";
      (function tick() {
        var p = Math.min(1, (Date.now() - holdStart) / 3000);
        $("gate-bar").style.width = (p * 100) + "%";
        if (p >= 1) { stopHold(); openMath(); return; }
        holdTimer = requestAnimationFrame(tick);
      })();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      holdBtn.addEventListener(ev, stopHold);
    });
    $("math-cancel").addEventListener("click", function () { $("math-modal").classList.add("hidden"); });
    $("grown-back").addEventListener("click", function () { enterHome(); });
    $("btn-unlock").addEventListener("click", function () { toast("Purchases coming soon"); });
    $("btn-restore").addEventListener("click", function () { toast("Nothing to restore yet"); });
    $("btn-reset-profile").addEventListener("click", function () {
      if (confirm("Start setup over?")) {
        try { localStorage.removeItem(LS_PROFILE); } catch (e) {}
        profile = null;
        obState = { gender: null, age: null, interests: [] };
        location.reload();
      }
    });
  }
  function stopHold() {
    if (holdTimer) cancelAnimationFrame(holdTimer);
    holdTimer = null;
    var bar = $("gate-bar");
    if (bar) { bar.style.transition = "width .2s"; bar.style.width = "0%"; }
  }
  function openMath() {
    $("gate-modal").classList.add("hidden");
    var a = 2 + Math.floor(Math.random() * 7), b = 2 + Math.floor(Math.random() * 7);
    var ans = a + b;
    $("math-q").textContent = "What is " + a + " + " + b + "?";
    var opts = [ans];
    while (opts.length < 3) {
      var w = ans + (Math.floor(Math.random() * 5) - 2);
      if (w > 0 && opts.indexOf(w) < 0) opts.push(w);
    }
    opts.sort(function () { return Math.random() - 0.5; });
    var box = $("math-answers");
    box.innerHTML = "";
    opts.forEach(function (v) {
      var btn = document.createElement("button");
      btn.textContent = v;
      btn.addEventListener("click", function () {
        if (v === ans) {
          $("math-modal").classList.add("hidden");
          openGrownups();
        } else { toast("Try again"); }
      });
      box.appendChild(btn);
    });
    $("math-modal").classList.remove("hidden");
  }
  function openGrownups() {
    var p = profile || {};
    $("profile-summary").textContent =
      "Child: " + (p.gender || "?") + ", age " + (p.age || "?") +
      (p.interests && p.interests.length ? " — loves " + p.interests.join(", ") : "");
    show("s-grown");
  }

  /* ================= boot ================= */
  function init() {
    initOnboarding();
    initStudio();
    initGate();
    $("btn-freedraw").addEventListener("click", function () { openColor(null); });
    $("btn-freedraw-top").addEventListener("click", function () { openColor(null); });
    if (profile && profile.gender && profile.age) enterHome();
    else show("s-ob1");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
