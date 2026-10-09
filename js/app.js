/* Coloring Worlds — app controller: onboarding, navigation, parent gate, save */
(function () {
  "use strict";

  var LS_PROFILE = "cw_profile_v1";
  var LS_UNLOCKED = "cw_unlocked_v1";
  var BRUSH_PX = { s: 12, m: 26, l: 48 };

  var LOCK_SVG = '<img class="lock-img" src="assets/ui/lock.png" alt="">';

  function isUnlocked() {
    try { return localStorage.getItem(LS_UNLOCKED) === "1"; } catch (e) { return false; }
  }

  var profile = loadProfile();
  var engine = null;
  var currentTheme = null;
  var currentPage = null;      // page open in the studio (null = free draw)
  var studioTapMode = false;   // true while a 0-2 profile is in the studio
  var fillModeSel = "solid";   // chosen fill style: solid | rainbow | dots | stars | stripes
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

  /* ================= finished pictures =================
   * When a child taps Done, a small thumbnail of the finished picture is
   * kept on-device: it rides as a "passenger" in that world's train cart
   * and replaces the line-art thumbnail on the world screen. */
  var FIN_KEY = "cw_finished_v1";
  function finKey(themeId, pageId) { return themeId + ":" + pageId; }
  function loadFinished() {
    try { return JSON.parse(localStorage.getItem(FIN_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveFinishedMap(map) {
    try { localStorage.setItem(FIN_KEY, JSON.stringify(map)); return; } catch (e) {}
    // quota tight: drop the oldest half and retry once
    var keys = Object.keys(map);
    keys.slice(0, Math.ceil(keys.length / 2)).forEach(function (k) { delete map[k]; });
    try { localStorage.setItem(FIN_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function recordFinished() {
    if (!engine || !currentPage || !currentTheme) return;
    try {
      var full = engine.exportPNG();
      var t = document.createElement("canvas");
      t.width = 108; t.height = 108;
      t.getContext("2d").drawImage(full, 0, 0, 108, 108);
      var map = loadFinished();
      map[finKey(currentTheme.id, currentPage.id)] = t.toDataURL("image/jpeg", 0.72);
      saveFinishedMap(map);
    } catch (e) {}
  }
  function finishedThumb(themeId, pageId) {
    var map = loadFinished();
    return map[finKey(themeId, pageId)] || null;
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
  /* Age band selects the art tier: 0-2 simple, 3-5 regular, 6-8 detail */
  function ageTier() {
    if (!profile) return "regular";
    if (profile.age === "0-2") return "simple";
    if (profile.age === "6-8") return "detail";
    return "regular";
  }
  function tierThumb(p) {
    var t = ageTier();
    if (t === "simple" && p.sthumb) return p.sthumb;
    if (t === "detail" && p.dthumb) return p.dthumb;
    return p.thumb;
  }
  function tierFile(p) {
    var t = ageTier();
    if (t === "simple" && p.sfile) return p.sfile;
    if (t === "detail" && p.dfile) return p.dfile;
    return p.file;
  }
  function themeIcon(theme) {
    var p = theme.pages[0];
    for (var i = 0; i < theme.pages.length; i++) {
      if (theme.pages[i].id === theme.iconPage) { p = theme.pages[i]; break; }
    }
    // kids see thumbnails for their age tier everywhere
    return tierThumb(p);
  }
  /* ================= home: the coloring train =================
   * Engine + one cart per world. Kids drag the train sideways; tapping an
   * unlocked cart makes the train "travel" into that world. Finished
   * pictures ride in the carts as tiny passengers. */
  var WHEEL_IMG = '<img class="wheel" src="assets/train/wheel.png" alt="">';
  var WHEEL_IMG_BIG = '<img class="wheel w-big" src="assets/train/wheel.png" alt="">';
  var PUFF_COLORS = ["#ff6b9d", "#ffd93d", "#4dabff", "#3ddc97", "#a78bfa", "#ff9f43"];

  function cartPassengers(theme) {
    // finished pictures (+ any in-progress one) riding in this cart
    var thumbs = [];
    var fin = loadFinished();
    theme.pages.forEach(function (p) {
      var url = fin[finKey(theme.id, p.id)];
      if (url) thumbs.push(url);
    });
    var wip = wipThumbFor(theme.id);
    if (wip && thumbs.indexOf(wip) === -1) thumbs.push(wip);
    return thumbs.slice(0, 4);
  }

  function buildCart(t, locked) {
    var cart = document.createElement("button");
    cart.className = "cart" + (locked ? " locked" : "");
    cart.setAttribute("aria-label", t.title + (locked ? " (locked)" : ""));
    var scene = document.createElement("span");
    scene.className = "cart-scene";
    var simg = document.createElement("img");
    simg.src = "assets/train/cart-" + t.id + ".png";
    simg.alt = "";
    simg.loading = "lazy";
    scene.appendChild(simg);
    cart.appendChild(scene);
    var name = document.createElement("span");
    name.className = "cart-name";
    name.textContent = t.title;
    cart.appendChild(name);
    var pass = cartPassengers(t);
    if (pass.length) {
      var strip = document.createElement("span");
      strip.className = "cart-passengers";
      pass.forEach(function (url) {
        var im = document.createElement("img");
        im.src = url; im.alt = "";
        strip.appendChild(im);
      });
      cart.appendChild(strip);
    }
    if (locked) {
      var cover = document.createElement("span");
      cover.className = "cart-cover";
      cover.innerHTML = '<span class="cover-lock">' + LOCK_SVG + '</span><span class="cover-zzz">Z z z</span>';
      cart.appendChild(cover);
    }
    var wheels = document.createElement("span");
    wheels.className = "cart-wheels";
    wheels.innerHTML = WHEEL_IMG + WHEEL_IMG;
    cart.appendChild(wheels);
    cart.addEventListener("click", function () {
      if (locked) {
        sfx("error");
        toast("Ask a grown-up to unlock!");
        cart.classList.remove("shake-it");
        void cart.offsetWidth;
        cart.classList.add("shake-it");
        return;
      }
      travelTo(t, cart);
    });
    return cart;
  }

  function enterHome() {
    var train = $("train");
    train.innerHTML = "";
    var themes = window.CW_DATA.visibleThemes(profile.gender, profile.interests);
    var unlocked = isUnlocked();
    $("home-greeting").textContent = "Pick a world!";
    // --- engine with the elephant driver in the cab ---
    var eng = document.createElement("div");
    eng.className = "engine";
    eng.innerHTML =
      '<span class="eng-smoke" id="eng-smoke"></span>' +
      '<span class="eng-art"><img class="eng-body" src="assets/train/engine.png" alt="">' +
      '<span class="eng-cab"><img src="assets/driver.png" alt="Your train driver"></span></span>' +
      '<span class="eng-wheels">' + WHEEL_IMG_BIG + WHEEL_IMG + WHEEL_IMG + '</span>';
    train.appendChild(eng);
    themes.forEach(function (t) {
      train.appendChild(buildCart(t, !t.free && !unlocked));
    });
    show("s-home");
    var vp = $("train-viewport");
    vp.scrollLeft = 0;
    trainAnim.lastSl = 0;
    startTrainLoop();
  }

  /* ---- train motion: parallax, wheel spin, smoke puffs ---- */
  var trainAnim = { running: false, lastSl: 0, vel: 0, lastPuff: 0, travelBoost: 0 };
  function startTrainLoop() {
    if (trainAnim.running) return;
    trainAnim.running = true;
    trainAnim.lastTs = 0;
    requestAnimationFrame(trainLoop);
  }
  function trainLoop(ts) {
    var home = $("s-home");
    if (!home || !home.classList.contains("active")) { trainAnim.running = false; return; }
    var vp = $("train-viewport");
    var sl = vp.scrollLeft;
    var vel = sl - trainAnim.lastSl;
    trainAnim.lastSl = sl;
    trainAnim.vel = trainAnim.vel * 0.82 + vel * 0.18;
    var speed = Math.abs(trainAnim.vel);
    // wheels: one full turn per ~215px of travel
    $("train").style.setProperty("--wrot", ((sl * 360 / 215) % 360).toFixed(1) + "deg");
    // parallax: far layers drift slower than the train
    var boost = trainAnim.travelBoost;
    $("ts-clouds").style.backgroundPositionX = (-(sl * 0.22 + boost * 0.5)).toFixed(1) + "px";
    $("ts-hills").style.backgroundPositionX = (-(sl * 0.5 + boost)).toFixed(1) + "px";
    var rb = $("ts-rainbow");
    if (rb) rb.style.transform = "translateX(" + (-(sl * 0.1 + boost * 0.25)).toFixed(1) + "px)";
    if (trainAnim.travelBoost > 0) trainAnim.travelBoost *= 0.94;
    // smoke puffs: gentle idle rate, a little faster while rolling
    var interval = speed > 4 ? 230 : 640;
    if (!trainAnim.lastTs || ts - trainAnim.lastPuff > interval) {
      spawnPuff(speed);
      trainAnim.lastPuff = ts;
    }
    trainAnim.lastTs = ts;
    requestAnimationFrame(trainLoop);
  }
  function spawnPuff(speed) {
    var layer = $("puff-layer"), anchor = $("eng-smoke"), scene = $("train-scene");
    if (!layer || !anchor || !scene) return;
    if (layer.childElementCount > 14) return;
    var sr = scene.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    var puff = document.createElement("span");
    puff.className = "puff";
    var size = 15 + Math.random() * 15 + Math.min(10, speed * 0.7);
    puff.style.width = size + "px";
    puff.style.height = size + "px";
    puff.style.background = PUFF_COLORS[(Math.random() * PUFF_COLORS.length) | 0];
    puff.style.left = (ar.left - sr.left + ar.width / 2 - size / 2) + "px";
    puff.style.top = (ar.top - sr.top - size * 0.4) + "px";
    layer.appendChild(puff);
    var drift = -14 - Math.random() * 22 - speed * 1.5;
    var rise = 74 + Math.random() * 46;
    var anim = puff.animate([
      { transform: "translate(0,0) scale(.55)", opacity: 0.85 },
      { transform: "translate(" + drift + "px," + (-rise) + "px) scale(1.65)", opacity: 0 }
    ], { duration: 1500 + Math.random() * 500, easing: "ease-out" });
    anim.onfinish = function () { puff.remove(); };
  }

  /* Mouse drag-to-scroll for the train (touch uses native momentum
   * scrolling). A real drag suppresses the cart click on release. */
  (function initTrainDrag() {
    var vp = $("train-viewport");
    if (!vp) return;
    var down = null;
    vp.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = { x: e.clientX, sl: vp.scrollLeft, moved: false };
    });
    vp.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (Math.abs(dx) > 8) down.moved = true;
      if (down.moved) vp.scrollLeft = down.sl - dx;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      vp.addEventListener(ev, function () {
        if (down && down.moved) {
          var suppress = function (ce) { ce.stopPropagation(); ce.preventDefault(); };
          vp.addEventListener("click", suppress, { capture: true, once: true });
          setTimeout(function () { vp.removeEventListener("click", suppress, { capture: true }); }, 120);
        }
        down = null;
      });
    });
  })();

  /* ---- travel transition: the train rushes, then the world opens ---- */
  var traveling = false;
  function travelTo(theme, cartEl) {
    if (traveling) return;
    traveling = true;
    sfx("whoosh");
    var scene = $("train-scene"), vp = $("train-viewport");
    scene.classList.add("traveling");
    // roll the train so the chosen cart glides to the middle
    var target = Math.max(0, cartEl.offsetLeft - vp.clientWidth / 2 + cartEl.clientWidth / 2);
    var start = vp.scrollLeft, t0 = performance.now(), dur = 1050;
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = t * t * (3 - 2 * t); // smoothstep
      vp.scrollLeft = start + (target - start) * e;
      trainAnim.travelBoost += 26 * (1 - t);
      if (t < 1) requestAnimationFrame(step);
    })(t0);
    setTimeout(function () {
      scene.classList.remove("traveling");
      traveling = false;
      openTheme(theme.id);
    }, 1180);
  }

  /* ================= world screen (picture picker) =================
   * Full-bleed world color, big rounded title, the 10 pictures as big
   * white cards in two horizontal scrolling rows. Finished pictures
   * show their colored version with a gold star. */
  function openTheme(themeId) {
    currentTheme = window.CW_DATA.themeById(themeId);
    if (!currentTheme) { enterHome(); return; }
    var themeLocked = !currentTheme.free && !isUnlocked();
    var scr = $("s-pages");
    scr.style.background = currentTheme.gradient;
    $("pages-title").textContent = currentTheme.title;
    var pm = $("pages-mascot");
    if (pm) pm.src = "assets/train/cart-" + currentTheme.id + ".png";
    var fin = loadFinished();
    var rows = [$("page-row-1"), $("page-row-2")];
    rows.forEach(function (r) { r.innerHTML = ""; });
    currentTheme.pages.forEach(function (p, idx) {
      var doneUrl = fin[finKey(currentTheme.id, p.id)];
      var card = document.createElement("button");
      card.className = "page-card";
      card.setAttribute("aria-label", p.title + (themeLocked ? " (locked)" : ""));
      var img = document.createElement("img");
      img.src = doneUrl || tierThumb(p); // finished art wins over line art
      img.alt = p.title;
      img.loading = "lazy";
      card.appendChild(img);
      if (doneUrl && !themeLocked) {
        var star = document.createElement("span");
        star.className = "done-badge";
        star.innerHTML = '<img src="assets/ui/star.png" alt="">';
        card.appendChild(star);
      }
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
      rows[idx < 5 ? 0 : 1].appendChild(card);
    });
    show("s-pages");
    rows.forEach(function (r) { r.scrollLeft = 0; });
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
      svg: '<img src="assets/ui/wand.png" alt="">' },
    { id: "glitter", label: "Glitter",
      cls: "fx-glitter",
      svg: '<img src="assets/ui/fx-glitter.png" alt="">' },
    { id: "sparkle", label: "Sparkle",
      cls: "fx-sparkle",
      svg: '<img src="assets/ui/fx-sparkle.png" alt="">' }
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

  /* ---- fill styles popup: solid free; rainbow + patterns premium ---- */
  var FILL_STYLES = [
    { id: "solid", label: "Solid", cls: "fill-solid",
      svg: '<img src="assets/ui/fx-droplet.png" alt="">' },
    { id: "rainbow", label: "Rainbow", cls: "fill-rainbow",
      svg: '<img src="assets/ui/fx-rainbow.png" alt="">' },
    { id: "dots", label: "Dots", cls: "fill-dots",
      svg: '<img src="assets/ui/fx-dots.png" alt="">' },
    { id: "stars", label: "Stars", cls: "fill-stars",
      svg: '<img src="assets/ui/star.png" alt="">' },
    { id: "stripes", label: "Stripes", cls: "fill-stripes",
      svg: '<img src="assets/ui/fx-stripes.png" alt="">' }
  ];
  function toggleFillPop(force) {
    var pop = $("fill-pop");
    if (!pop) return;
    var showIt = typeof force === "boolean" ? force : pop.classList.contains("hidden");
    if (showIt) buildFillPop();
    pop.classList.toggle("hidden", !showIt);
  }
  function buildFillPop() {
    var pop = $("fill-pop");
    pop.innerHTML = "";
    var unlocked = isUnlocked();
    FILL_STYLES.forEach(function (fs) {
      var premium = fs.id !== "solid";
      var b = document.createElement("button");
      b.className = "fx-btn " + fs.cls + (fillModeSel === fs.id ? " sel" : "");
      b.innerHTML = '<span class="fx-ico">' + fs.svg + "</span><span>" + fs.label + "</span>" +
        (premium && !unlocked ? '<span class="fx-lock">' + LOCK_SVG + "</span>" : "");
      b.addEventListener("click", function () {
        if (premium && !unlocked) { sfx("error"); toast("Unlock for rainbow & pattern fills!"); return; }
        fillModeSel = fs.id;
        if (engine) engine.setFillMode(fillModeSel);
        sfx("select");
        toggleFillPop(false);
      });
      pop.appendChild(b);
    });
  }

  /* ---- sparkle burst where a fill lands (DOM particles over canvas) ---- */
  var SPARK_COLORS = ["#ffd93d", "#ffffff", "#ff6b9d", "#4dabff", "#3ddc97", "#a78bfa"];
  function sparkleBurst(x, y) {
    var wrap = $("canvas-wrap"), layer = $("fx-layer"), cv = $("color-canvas");
    if (!wrap || !layer || !cv) return;
    var wr = wrap.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    if (!cr.width) return;
    var px = cr.left - wr.left + (x / 1024) * cr.width;
    var py = cr.top - wr.top + (y / 1024) * cr.height;
    for (var i = 0; i < 12; i++) {
      var s = document.createElement("span");
      s.className = "spark";
      s.style.background = SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0];
      s.style.left = px + "px";
      s.style.top = py + "px";
      layer.appendChild(s);
      var ang = Math.random() * Math.PI * 2;
      var dist = 22 + Math.random() * 46;
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 12;
      var anim = s.animate([
        { transform: "rotate(45deg) scale(1)", opacity: 1 },
        { transform: "translate(" + dx.toFixed(0) + "px," + dy.toFixed(0) + "px) rotate(215deg) scale(.15)", opacity: 0 }
      ], { duration: 460 + Math.random() * 280, easing: "cubic-bezier(.17,.67,.35,1)" });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(s);
    }
  }

  /* ---- confetti celebration when a picture is finished ---- */
  function celebrate() {
    var layer = $("confetti-layer");
    if (!layer) return;
    for (var i = 0; i < 42; i++) {
      var p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.background = SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0];
      p.style.left = (Math.random() * 100).toFixed(1) + "vw";
      if (Math.random() < 0.4) p.style.borderRadius = "50%";
      layer.appendChild(p);
      var drift = (Math.random() * 170 - 85).toFixed(0);
      var fall = Math.round(window.innerHeight * (0.78 + Math.random() * 0.28));
      var spin = 320 + Math.random() * 420;
      var anim = p.animate([
        { transform: "translate(0,-4vh) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + drift + "px," + fall + "px) rotate(" + spin.toFixed(0) + "deg)", opacity: 0.92 }
      ], { duration: 1250 + Math.random() * 650, delay: Math.random() * 180, easing: "cubic-bezier(.2,.6,.4,1)" });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
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
    currentPage = page || null;
    $("color-title").textContent = page ? page.title : "Free Draw";
    show("s-color");
    var tapMode = profile && profile.age === "0-2";
    studioTapMode = !!tapMode;
    // line art for the child's age tier (simple / regular / detail)
    var artFile = page ? tierFile(page) : null;

    // NEVER remove the canvas element from the DOM — reuse it across opens.
    // Create the engine once, then reset its state for each new page.
    var cv = $("color-canvas");
    if (!engine) {
      engine = new window.CW_COLOR.ColoringEngine(cv, {
        tapMode: tapMode,
        defaultTool: tapMode ? "fill" : "brush",
        defaultColor: currentColor,
        defaultBrush: tapMode ? 40 : 26,
        onChange: scheduleWipSave,
        onFill: function (x, y) { sparkleBurst(x, y); }
      });
    } else {
      engine.reset({
        tapMode: tapMode,
        defaultTool: tapMode ? "fill" : "brush",
        defaultColor: currentColor,
        defaultBrush: tapMode ? 40 : 26
      });
    }
    engine.setFillMode(fillModeSel);
    buildColorGrid();
    setColorDot(currentColor);
    setToolUI(tapMode ? "fill" : "brush");
    toggleSizePop(false);
    toggleFxPop(false);
    toggleFillPop(false);

    // age-adaptive toolbar: toddlers only get tap-to-fill
    var brushBtn = $("tool-brush");
    if (brushBtn) brushBtn.style.display = tapMode ? "none" : "";
    var fxBtn = $("tool-fx");
    if (fxBtn) fxBtn.style.display = tapMode ? "none" : "";

    // WIP key for autosave: unique per page + art tier variant
    var tierSuffix = ageTier() === "simple" ? ":toddler" : ageTier() === "detail" ? ":detail" : "";
    wipPageKey = page
      ? ("page:" + (currentTheme ? currentTheme.id : "?") + ":" + page.id + tierSuffix)
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
  /* Thumbnail of the in-progress picture for a theme (train passenger). */
  function wipThumbFor(themeId) {
    try {
      var wip = JSON.parse(localStorage.getItem(WIP_KEY) || "null");
      if (wip && wip.dataUrl && wip.key && wip.key.indexOf("page:" + themeId + ":") === 0) {
        if (Date.now() - (wip.at || 0) <= 7 * 24 * 3600 * 1000) return wip.dataUrl;
      }
    } catch (e) {}
    return null;
  }
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
      toggleFillPop(false);
    });
    $("tool-fill").addEventListener("click", function () {
      if (engine && engine.tool === "fill" && !studioTapMode) { toggleFillPop(); return; } // tap again => fill styles
      if (engine) engine.setTool("fill");
      setToolUI("fill");
      sfx("tap");
      toggleSizePop(false);
      toggleFxPop(false);
      toggleFillPop(false);
    });
    $("tool-eraser").addEventListener("click", function () {
      if (engine) engine.setTool("eraser");
      setToolUI("eraser");
      sfx("tap");
      toggleSizePop(false);
      toggleFxPop(false);
      toggleFillPop(false);
    });
    $("tool-fx").addEventListener("click", function () {
      sfx("tap");
      toggleSizePop(false);
      toggleFillPop(false);
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
      var fp = $("fill-pop");
      if (fp && !fp.classList.contains("hidden") &&
          !fp.contains(e.target) && e.target.closest("#tool-fill") === null) {
        toggleFillPop(false);
      }
    });
    $("color-back").addEventListener("click", function () { show("s-pages"); });
    $("pages-back").addEventListener("click", function () { enterHome(); });
  }

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  /* One tap on Done = finished picture saved straight to the photo gallery.
   * No share sheet, no confirmation dialog. A confetti celebration plays,
   * and the finished picture becomes a passenger in its world's cart. */
  var saving = false;
  function backToPicker() {
    if (currentTheme) openTheme(currentTheme.id); // rebuild: colored thumb + star
    else enterHome();
  }
  function doneAndSave() {
    if (saving) return;
    if (!engine) { show("s-pages"); return; }
    saving = true;
    saveToGallery().then(
      function () {
        sfx("fanfare");
        recordFinished();
        clearWip();
        celebrate();
        toast("Saved to photos!");
        setTimeout(function () { saving = false; backToPicker(); }, 1150);
      },
      function () {
        toast("Couldn't save this time");
        saving = false;
        show("s-pages");
      }
    );
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
