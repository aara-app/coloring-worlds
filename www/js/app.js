/* Coloring Worlds — app controller: onboarding, navigation, parent gate, save */
(function () {
  "use strict";

  var LS_PROFILE = "cw_profile_v1";
  var LS_UNLOCKED = "cw_unlocked_v1";
  var BRUSH_PX = { s: 12, m: 26, l: 48 };

  var LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" fill="#fff"/></svg>';

  function isUnlocked() {
    try { return localStorage.getItem(LS_UNLOCKED) === "1"; } catch (e) { return false; }
  }

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
  /* Gender-adaptive app theme: pink/purple for girls, blue/green for boys. */
  function applyGenderTheme() {
    document.body.classList.remove("girl", "boy");
    if (profile && (profile.gender === "girl" || profile.gender === "boy")) {
      document.body.classList.add(profile.gender);
    }
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
  /* Safe sound wrapper: no-op if the sound engine isn't loaded. */
  function sfx(name) {
    try {
      var S = window.CW_SFX;
      if (S && typeof S[name] === "function") S[name]();
    } catch (e) {}
  }

  /* ================= onboarding ================= */
  function initOnboarding() {
    document.querySelectorAll("#s-ob1 .ob-big").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#s-ob1 .ob-big").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        obState.gender = b.getAttribute("data-gender");
        sfx("select");
        setTimeout(function () { show("s-ob2"); }, 220);
      });
    });
    /* Bimi-style age picker: tap a circle to select, then Next (or Skip). */
    document.querySelectorAll("#s-ob2 .age-circle").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#s-ob2 .age-circle").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        obState.age = b.getAttribute("data-age");
        $("ob-age-next").disabled = false;
        sfx("select");
      });
    });
    $("ob-age-next").addEventListener("click", function () {
      if (!obState.age) return;
      sfx("tap");
      show("s-ob3");
    });
    $("ob-age-skip").addEventListener("click", function () {
      obState.age = "3-5"; // sensible default when skipped
      sfx("tap");
      show("s-ob3");
    });
    document.querySelectorAll(".back-btn").forEach(function (b) {
      b.addEventListener("click", function () { sfx("tap"); show(b.getAttribute("data-back")); });
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
        sfx("tap");
        $("ob-start").disabled = obState.interests.length === 0;
      });
      grid.appendChild(btn);
    });
    $("ob-start").addEventListener("click", function () {
      profile = { gender: obState.gender, age: obState.age, interests: obState.interests.slice() };
      saveProfile();
      applyGenderTheme();
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
    var unlocked = isUnlocked();
    $("home-greeting").textContent = "Pick a world!";
    themes.forEach(function (t) {
      var locked = !t.free && !unlocked;
      var card = document.createElement("button");
      card.className = "theme-card";
      card.style.background = t.gradient;
      card.innerHTML = '<span class="lock-badge"' + (locked ? "" : " hidden") + ">" + LOCK_SVG + '</span>' +
        '<img class="tart" alt="" loading="lazy"><span class="tname"></span><span class="tcount"></span>';
      card.querySelector("img").src = themeIcon(t);
      card.querySelector(".tname").textContent = t.title;
      card.querySelector(".tcount").textContent = t.pages.length + " pictures";
      card.addEventListener("click", function () { sfx("select"); openTheme(t.id); });
      grid.appendChild(card);
    });
    show("s-home");
  }

  /* ================= page picker (carousel) ================= */
  function openTheme(themeId) {
    currentTheme = window.CW_DATA.themeById(themeId);
    var themeLocked = !currentTheme.free && !isUnlocked();
    $("pages-title").textContent = currentTheme.title;
    var grid = $("page-grid");
    grid.innerHTML = "";
    currentTheme.pages.forEach(function (p) {
      var card = document.createElement("button");
      card.className = "page-card";
      card.setAttribute("aria-label", p.title + (themeLocked ? " (locked)" : ""));
      var img = document.createElement("img");
      img.src = (isToddler() && p.sthumb) ? p.sthumb : p.thumb; // colored reference thumbnail (simple for 0-2)
      img.alt = p.title;
      img.loading = "lazy";
      card.appendChild(img);
      if (themeLocked) {
        var badge = document.createElement("span");
        badge.className = "lock-badge";
        badge.innerHTML = LOCK_SVG;
        card.appendChild(badge);
      }
      var label = document.createElement("span");
      label.className = "ptitle";
      label.textContent = p.title;
      card.appendChild(label);
      card.addEventListener("click", function () {
        if (themeLocked) { sfx("error"); toast("Ask a grown-up to unlock!"); return; }
        sfx("tap");
        card.classList.add("sel");
        setTimeout(function () { openColor(p); }, 140);
      });
      grid.appendChild(card);
    });
    var hint = $("carousel-hint");
    if (hint) hint.style.display = currentTheme.pages.length > 1 ? "" : "none";
    show("s-pages");
    grid.scrollLeft = 0;
  }

  /* ================= coloring studio ================= */
  var PALETTE = window.CW_DATA.PALETTE; // free colors (default palette)
  var PALETTE_FREE = window.CW_DATA.PALETTE_FREE;
  var PALETTE_LOCKED = window.CW_DATA.PALETTE_LOCKED;
  var currentColor = PALETTE_FREE[0];

  function setColorDot(hex) {
    var dot = $("color-dot-inner");
    if (dot) {
      dot.style.background = hex;
      dot.style.borderColor = (hex.toLowerCase() === "#ffffff") ? "#c9c2d4" : "rgba(0,0,0,.12)";
    }
  }

  function buildColorGrid() {
    var grid = $("color-grid");
    grid.innerHTML = "";
    var unlocked = isUnlocked();
    function cell(hex, locked) {
      var b = document.createElement("button");
      b.className = "color-cell" + (locked ? " locked" : "") + (hex.toLowerCase() === "#ffffff" ? " is-white" : "");
      b.style.background = hex;
      b.setAttribute("aria-label", "color " + hex + (locked ? " (locked)" : ""));
      if (hex === currentColor && !locked) b.classList.add("sel");
      if (locked) {
        var veil = document.createElement("span");
        veil.className = "lock-veil";
        veil.innerHTML = LOCK_SVG;
        b.appendChild(veil);
      }
      b.addEventListener("click", function () {
        if (locked) { sfx("error"); toast("Unlock for more colors!"); return; }
        currentColor = hex;
        if (engine) engine.setColor(hex);
        setColorDot(hex);
        sfx("colorPick");
        grid.querySelectorAll(".color-cell").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        $("color-modal").classList.add("hidden");
      });
      grid.appendChild(b);
    }
    PALETTE_FREE.forEach(function (hex) { cell(hex, false); });
    PALETTE_LOCKED.forEach(function (hex) { cell(hex, !unlocked); });
    $("color-note").textContent = unlocked ? "All colors unlocked!" : "More colors with Unlock All!";
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
      var el = $("tool-" + t);
      if (el) el.classList.toggle("sel", t === name);
    });
    var fx = $("tool-fx");
    if (fx) fx.classList.toggle("sel", name === "magic" || name === "glitter" || name === "sparkle");
  }

  /* ---- premium magic brush effects popup ---- */
  var FX_TOOLS = [
    { id: "magic", label: "Magic",
      cls: "fx-magic",
      svg: '<svg viewBox="0 0 24 24"><path d="M4 20l3-3 1.5 1.5L5.5 21.5 4 20z" fill="#fff"/><path d="M12 2l2.2 4.6L19 8.8l-4.8 2.2L12 15.6l-2.2-4.6L5 8.8l4.8-2.2L12 2z" fill="#fff"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="#fff"/></svg>' },
    { id: "glitter", label: "Glitter",
      cls: "fx-glitter",
      svg: '<svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.4" fill="#fff"/><circle cx="15" cy="6" r="1.8" fill="#fff"/><circle cx="18" cy="14" r="2.6" fill="#fff"/><circle cx="10" cy="16" r="1.6" fill="#fff"/><circle cx="5" cy="18" r="1.4" fill="#fff"/><path d="M13 12l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9.9-1.9z" fill="#fff"/></svg>' },
    { id: "sparkle", label: "Sparkle",
      cls: "fx-sparkle",
      svg: '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 5.2L20 10.6l-5.6 2.4L12 18.2l-2.4-5.2L4 10.6l5.6-2.4L12 3z" fill="#fff"/><path d="M19 15l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1 1-2.2z" fill="#fff"/></svg>' }
  ];
  function toggleFxPop(force) {
    var pop = $("fx-pop");
    var showIt = typeof force === "boolean" ? force : pop.classList.contains("hidden");
    if (showIt) buildFxPop();
    pop.classList.toggle("hidden", !showIt);
  }
  function buildFxPop() {
    var pop = $("fx-pop");
    pop.innerHTML = "";
    var unlocked = isUnlocked();
    var activeTool = engine ? engine.tool : null;
    FX_TOOLS.forEach(function (fx) {
      var b = document.createElement("button");
      b.className = "fx-btn " + fx.cls + ((activeTool === fx.id) ? " sel" : "");
      b.innerHTML = '<span class="fx-ico">' + fx.svg + "</span><span>" + fx.label + "</span>" +
        (unlocked ? "" : '<span class="fx-lock">' + LOCK_SVG + "</span>");
      b.addEventListener("click", function () {
        if (!unlocked) { sfx("error"); toast("Unlock for magic brushes!"); return; }
        if (engine) engine.setTool(fx.id);
        setToolUI(fx.id);
        sfx("select");
        toggleSizePop(false);
        toggleFxPop(false);
      });
      pop.appendChild(b);
    });
  }

  function toggleSizePop(force) {
    var pop = $("size-pop");
    var showIt = typeof force === "boolean" ? force : pop.classList.contains("hidden");
    pop.classList.toggle("hidden", !showIt);
    if (showIt) {
      pop.querySelectorAll(".size-btn").forEach(function (b) {
        b.classList.toggle("sel", BRUSH_PX[b.getAttribute("data-size")] === (engine ? engine.brushSize : 26));
      });
    }
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
        defaultColor: currentColor,
        defaultBrush: tapMode ? 40 : 26,
        onChange: scheduleWipSave
      });
    } else {
      engine.reset({
        tapMode: tapMode,
        defaultTool: tapMode ? "fill" : "brush",
        defaultColor: currentColor,
        defaultBrush: tapMode ? 40 : 26
      });
    }
    buildColorGrid();
    setColorDot(currentColor);
    setToolUI(tapMode ? "fill" : "brush");
    toggleSizePop(false);
    toggleFxPop(false);

    // age-adaptive toolbar: toddlers only get tap-to-fill
    var brushBtn = $("tool-brush");
    if (brushBtn) brushBtn.style.display = tapMode ? "none" : "";
    var fxBtn = $("tool-fx");
    if (fxBtn) fxBtn.style.display = tapMode ? "none" : "";

    // WIP key for autosave: unique per page + art variant (toddler simple vs regular)
    wipPageKey = page
      ? ("page:" + (currentTheme ? currentTheme.id : "?") + ":" + page.id + (tapMode ? ":toddler" : ""))
      : "freedraw";

    requestAnimationFrame(function () {
      fitCanvas();
      if (page && artFile) {
        engine.loadLineArt(artFile, function (err) {
          if (err) {
            // Fallback: blank canvas so the kid can still draw instead of a dead screen
            engine.blank();
            toast("Could not load the picture — free draw instead!");
          }
          restoreWip();
          fitCanvas();
        });
      } else {
        engine.blank();
        restoreWip();
      }
    });
  }

  /* ================= work-in-progress autosave =================
   * Every finished stroke is snapshotted to localStorage under the current
   * page key, so leaving mid-picture never loses work. Restored on reopen. */
  var WIP_KEY = "cw_wip_v1";
  var wipPageKey = null;
  function scheduleWipSave() {
    if (!engine || !wipPageKey) return;
    try {
      var url = engine.colorCanvas.toDataURL("image/png");
      var payload = JSON.stringify({ key: wipPageKey, dataUrl: url, at: Date.now() });
      try { localStorage.setItem(WIP_KEY, payload); }
      catch (e) { try { localStorage.removeItem(WIP_KEY); } catch (e2) {} } // storage full: drop it
    } catch (e) {}
  }
  function clearWip() { try { localStorage.removeItem(WIP_KEY); } catch (e) {} }
  function restoreWip() {
    if (!engine || !wipPageKey) return;
    var raw = null;
    try { raw = localStorage.getItem(WIP_KEY); } catch (e) {}
    if (!raw) return;
    try {
      var wip = JSON.parse(raw);
      if (!wip || wip.key !== wipPageKey || !wip.dataUrl) return;
      if (Date.now() - (wip.at || 0) > 7 * 24 * 3600 * 1000) { clearWip(); return; } // stale
      engine.loadPainting(wip.dataUrl);
    } catch (e) {}
  }

  function initStudio() {
    $("tool-brush").addEventListener("click", function () {
      if (engine && engine.tool === "brush") { toggleSizePop(); return; } // tap again => sizes
      if (engine) engine.setTool("brush");
      setToolUI("brush");
      sfx("tap");
      toggleSizePop(false);
      toggleFxPop(false);
    });
    $("tool-fill").addEventListener("click", function () {
      if (engine) engine.setTool("fill");
      setToolUI("fill");
      sfx("tap");
      toggleSizePop(false);
      toggleFxPop(false);
    });
    $("tool-eraser").addEventListener("click", function () {
      if (engine) engine.setTool("eraser");
      setToolUI("eraser");
      sfx("tap");
      toggleSizePop(false);
      toggleFxPop(false);
    });
    $("tool-fx").addEventListener("click", function () {
      sfx("tap");
      toggleSizePop(false);
      toggleFxPop();
    });
    $("btn-color").addEventListener("click", function () {
      sfx("tap");
      buildColorGrid();
      $("color-modal").classList.remove("hidden");
    });
    $("color-close").addEventListener("click", function () { $("color-modal").classList.add("hidden"); });
    $("color-modal").addEventListener("click", function (e) {
      if (e.target === $("color-modal")) $("color-modal").classList.add("hidden");
    });
    $("tool-undo").addEventListener("click", function () {
      if (engine && engine.undo()) { sfx("undo"); } else { toast("Nothing to undo"); }
    });
    $("tool-clear").addEventListener("click", function () {
      if (engine) { engine.clear(true); clearWip(); toast("Cleared!"); }
    });
    $("tool-done").addEventListener("click", doneAndSave);
    document.querySelectorAll("#size-pop .size-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#size-pop .size-btn").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        if (engine) engine.setBrushSize(BRUSH_PX[b.getAttribute("data-size")] || 26);
        toggleSizePop(false);
      });
    });
    // tap outside the popups closes them
    document.addEventListener("pointerdown", function (e) {
      var pop = $("size-pop");
      if (!pop.classList.contains("hidden") &&
          !pop.contains(e.target) && e.target.closest("#tool-brush") === null) {
        toggleSizePop(false);
      }
      var fx = $("fx-pop");
      if (!fx.classList.contains("hidden") &&
          !fx.contains(e.target) && e.target.closest("#tool-fx") === null) {
        toggleFxPop(false);
      }
    });
    $("color-back").addEventListener("click", function () { show("s-pages"); });
    $("pages-back").addEventListener("click", function () { enterHome(); });
  }

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  /* One tap on Done = finished picture saved straight to the photo gallery.
   * No share sheet, no confirmation dialog. */
  var saving = false;
  function doneAndSave() {
    if (saving) return;
    if (!engine) { show("s-pages"); return; }
    saving = true;
    saveToGallery().then(
      function () { sfx("fanfare"); toast("Saved to photos!"); },
      function () { toast("Couldn't save this time"); }
    ).then(function () { saving = false; show("s-pages"); });
  }

  function saveToGallery() {
    var dataUrl;
    try { dataUrl = engine.exportPNG().toDataURL("image/png"); }
    catch (e) { return Promise.reject(e); }
    if (isNative()) return saveNative(dataUrl);
    return saveWeb(dataUrl);
  }

  function saveNative(dataUrl) {
    var plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
    var filename = "coloring-worlds-" + Date.now() + ".png";
    // Preferred: GallerySave native plugin -> straight into the photo album
    if (plugins.GallerySave && plugins.GallerySave.saveImage) {
      return plugins.GallerySave.saveImage({ base64: dataUrl, filename: filename, album: "Coloring Worlds" });
    }
    // Fallback: Filesystem plugin to shared storage
    if (plugins.Filesystem && plugins.Filesystem.writeFile) {
      return plugins.Filesystem.writeFile({
        path: "Pictures/ColoringWorlds/" + filename,
        data: dataUrl.split(",")[1],
        directory: "EXTERNAL_STORAGE"
      });
    }
    return Promise.reject(new Error("no native save path"));
  }

  function saveWeb(dataUrl) {
    return new Promise(function (resolve, reject) {
      try {
        var a = document.createElement("a");
        a.href = dataUrl;
        a.download = "coloring-worlds-" + Date.now() + ".png";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); resolve(); }, 600);
      } catch (e) { reject(e); }
    });
  }

  /* ================= sound toggle (grown-ups) ================= */
  function initSoundToggle() {
    var btn = $("btn-sound-toggle");
    function paint() {
      var muted = false;
      try { muted = window.CW_SFX && window.CW_SFX.isMuted(); } catch (e) {}
      btn.textContent = muted ? "Sound: Off" : "Sound: On";
    }
    btn.addEventListener("click", function () {
      try { window.CW_SFX.toggleMute(); } catch (e) {}
      paint();
      sfx("tap");
    });
    paint();
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
    $("btn-unlock-home").addEventListener("click", function () { toast("Purchases coming soon"); });
    $("btn-restore-home").addEventListener("click", function () { toast("Nothing to restore yet"); });
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
  /* Number-pad parent gate: type the answer, e.g. 60 + 5 = __ */
  var mathA = 0, mathB = 0, mathAns = 0, mathEntry = "";
  function renderMathEntry() {
    $("math-q").innerHTML = mathA + " + " + mathB + " = " +
      "<span>" + mathEntry + "</span>" + '<span class="caret"></span>';
  }
  function checkMath() {
    if (mathEntry !== "" && parseInt(mathEntry, 10) === mathAns) {
      $("math-modal").classList.add("hidden");
      mathEntry = "";
      sfx("select");
      openGrownups();
    } else {
      sfx("error");
      var box = $("math-q");
      box.classList.remove("shake");
      void box.offsetWidth; // restart the animation
      box.classList.add("shake");
      mathEntry = "";
      setTimeout(renderMathEntry, 200);
    }
  }
  function openMath() {
    $("gate-modal").classList.add("hidden");
    mathA = 20 + Math.floor(Math.random() * 41); // 20..60 (like 60 + 5)
    mathB = 2 + Math.floor(Math.random() * 8);   // 2..9
    mathAns = mathA + mathB;
    mathEntry = "";
    renderMathEntry();
    $("math-modal").classList.remove("hidden");
  }
  function initNumpad() {
    document.querySelectorAll("#numpad button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-k");
        if (k === "back") { mathEntry = mathEntry.slice(0, -1); }
        else if (k === "ok") { checkMath(); return; }
        else if (mathEntry.length < 3) { mathEntry += k; }
        sfx("tap");
        renderMathEntry();
      });
    });
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
    initNumpad();
    initSoundToggle();
    applyGenderTheme();
    $("btn-welcome-start").addEventListener("click", function () {
      sfx("select");
      show("s-ob1");
    });
    $("btn-freedraw").addEventListener("click", function () { sfx("tap"); openColor(null); });
    $("btn-freedraw-top").addEventListener("click", function () { sfx("tap"); openColor(null); });
    if (profile && profile.gender && profile.age) enterHome();
    else show("s-welcome");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
