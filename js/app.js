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
      // small corner badge only — the cart art stays fully visible
      var badge = document.createElement("span");
      badge.className = "cart-lock-badge";
      badge.innerHTML = LOCK_SVG;
      cart.appendChild(badge);
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
  var trainAnim = { running: false, lastSl: 0, vel: 0, lastPuff: 0, travelBoost: 0, rollUntil: 0, rolling: false, hintGone: false };
  /* The hint retires for good once the child has really dragged the train. */
  function dismissTrainHint() {
    if (trainAnim.hintGone) return;
    trainAnim.hintGone = true;
    var hint = $("train-hint");
    if (hint) hint.classList.add("hint-hide");
  }
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
    var scene = $("train-scene");
    var sl = vp.scrollLeft;
    var vel = sl - trainAnim.lastSl;
    trainAnim.lastSl = sl;
    trainAnim.vel = trainAnim.vel * 0.82 + vel * 0.18;
    var speed = Math.abs(trainAnim.vel);
    // Motion design: at rest the train sits perfectly still — the bounce
    // exists ONLY while the train is actually rolling (drag/scroll) or
    // travelling into a world.
    if (speed > 1.4) trainAnim.rollUntil = ts + 240;
    var rolling = ts < trainAnim.rollUntil || scene.classList.contains("traveling");
    if (rolling !== trainAnim.rolling) {
      trainAnim.rolling = rolling;
      scene.classList.toggle("rolling", rolling);
    }
    if (!trainAnim.hintGone && Math.abs(sl) > 30) dismissTrainHint();
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
    dismissTrainHint();
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
      // true state of this page: done > halfway (real WIP snapshot) > line art
      var wipUrl = doneUrl ? null : wipThumbForPage(currentTheme.id, p.id);
      var card = document.createElement("button");
      card.className = "page-card";
      card.setAttribute("aria-label",
        p.title + (themeLocked ? " (locked)" : doneUrl ? " (finished)" : wipUrl ? " (in progress)" : ""));
      var img = document.createElement("img");
      img.src = doneUrl || wipUrl || tierThumb(p);
      img.alt = p.title;
      img.loading = "lazy";
      card.appendChild(img);
      if (doneUrl && !themeLocked) {
        var star = document.createElement("span");
        star.className = "done-badge";
        star.innerHTML = '<img src="assets/ui/star.png" alt="">';
        card.appendChild(star);
      }
      if (wipUrl && !themeLocked) {
        var prog = document.createElement("span");
        prog.className = "wip-badge";
        prog.innerHTML = '<img src="assets/ui/crayon.png" alt="">';
        card.appendChild(prog);
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

  /* The big color circle on the rail reflects the active paint: solid,
   * rainbow, a magic gradient, glitter (sparkles over the hue) or a
   * pattern (white dots over the hue). */
  function setColorDot() {
    var dot = $("color-dot-inner");
    if (!dot) return;
    var hex = currentColor;
    dot.style.backgroundImage = "none";
    dot.style.backgroundColor = hex;
    if (fillModeSel === "rainbow") {
      dot.style.backgroundColor = "transparent";
      dot.style.backgroundImage = "linear-gradient(135deg,#ff3b30,#ff9500,#ffcc00,#34c759,#0a84ff,#bf5af2)";
    } else if (fillModeSel.indexOf("grad-") === 0) {
      var grads = window.CW_DATA.GRADIENTS || [];
      for (var i = 0; i < grads.length; i++) {
        if (grads[i].id === fillModeSel) {
          dot.style.backgroundColor = "transparent";
          dot.style.backgroundImage = "linear-gradient(135deg," + grads[i].stops.join(",") + ")";
          break;
        }
      }
    } else if (fillModeSel === "glitter") {
      dot.style.backgroundImage =
        "radial-gradient(circle at 30% 28%, #ffffff 0 3px, transparent 4.5px)," +
        "radial-gradient(circle at 68% 55%, #fff3a6 0 2.6px, transparent 4px)," +
        "radial-gradient(circle at 45% 78%, #ffffff 0 2.2px, transparent 3.6px)," +
        "radial-gradient(circle at 80% 22%, #ffffff 0 2px, transparent 3.4px)";
    } else if (fillModeSel !== "solid") {
      dot.style.backgroundImage =
        "radial-gradient(circle at 32% 32%, rgba(255,255,255,.95) 0 4px, transparent 5.5px)," +
        "radial-gradient(circle at 70% 68%, rgba(255,255,255,.95) 0 4px, transparent 5.5px)";
    }
    dot.style.borderColor = (hex.toLowerCase() === "#ffffff" && fillModeSel === "solid") ? "#c9c2d4" : "rgba(0,0,0,.12)";
  }

  /* ============ palette popup: Solids / Magic / Glitter / Patterns ============ */
  var colorTab = "solids";

  function closeColorModal() { $("color-modal").classList.add("hidden"); }

  function lockVeil() {
    var veil = document.createElement("span");
    veil.className = "lock-veil";
    veil.innerHTML = LOCK_SVG;
    return veil;
  }

  /* Choosing any special paint (magic / glitter / pattern) arms the
   * bucket with it — one tap on a region fills with the special paint. */
  function applyFillStyle(mode) {
    fillModeSel = mode;
    if (engine) {
      engine.setFillMode(mode);
      engine.setTool("fill");
      // the pattern brush trails the same shape the bucket would fill
      if (mode === "dots" || mode === "stars" || mode === "hearts") engine.setPatternShape(mode);
    }
    setToolUI("fill");
    setColorDot();
    sfx("colorPick");
    closeColorModal();
  }

  function pickSolid(hex) {
    currentColor = hex;
    fillModeSel = "solid";
    if (engine) { engine.setColor(hex); engine.setFillMode("solid"); }
    setColorDot();
    sfx("colorPick");
    closeColorModal();
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
      if (hex === currentColor && fillModeSel === "solid" && !locked) b.classList.add("sel");
      if (locked) b.appendChild(lockVeil());
      b.addEventListener("click", function () {
        if (locked) { sfx("error"); toast("Unlock for more colors!"); return; }
        pickSolid(hex);
      });
      grid.appendChild(b);
    }
    PALETTE_FREE.forEach(function (hex) { cell(hex, false); });
    PALETTE_LOCKED.forEach(function (hex) { cell(hex, !unlocked); });
  }

  function buildMagicList() {
    var list = $("magic-list");
    list.innerHTML = "";
    var unlocked = isUnlocked();
    function sw(id, label, bg) {
      var b = document.createElement("button");
      b.className = "magic-sw" + (fillModeSel === id ? " sel" : "");
      b.innerHTML = '<span class="magic-chip" style="background:' + bg + '"></span><span class="magic-label">' + label + "</span>";
      if (!unlocked) b.appendChild(lockVeil());
      b.addEventListener("click", function () {
        if (!unlocked) { sfx("error"); toast("Unlock for magic colors!"); return; }
        applyFillStyle(id);
      });
      list.appendChild(b);
    }
    sw("rainbow", "Rainbow", "linear-gradient(90deg,#ff3b30,#ff9500,#ffcc00,#34c759,#0a84ff,#bf5af2)");
    window.CW_DATA.GRADIENTS.forEach(function (g) {
      sw(g.id, g.label, "linear-gradient(90deg," + g.stops.join(",") + ")");
    });
  }

  function buildGlitterGrid() {
    var grid = $("glitter-grid");
    grid.innerHTML = "";
    var unlocked = isUnlocked();
    window.CW_DATA.GLITTER_HUES.forEach(function (hex) {
      var b = document.createElement("button");
      b.className = "color-cell glitter-cell" + (!unlocked ? " locked" : "");
      b.style.backgroundColor = hex;
      b.setAttribute("aria-label", "glitter " + hex);
      if (fillModeSel === "glitter" && currentColor === hex && unlocked) b.classList.add("sel");
      if (!unlocked) b.appendChild(lockVeil());
      b.addEventListener("click", function () {
        if (!unlocked) { sfx("error"); toast("Unlock for glitter colors!"); return; }
        currentColor = hex;
        if (engine) engine.setColor(hex);
        applyFillStyle("glitter");
      });
      grid.appendChild(b);
    });
  }

  var PATTERN_DEFS = [
    { id: "dots", label: "Dots", icon: "assets/ui/fx-dots.png" },
    { id: "stars", label: "Stars", icon: "assets/ui/star.png" },
    { id: "stripes", label: "Stripes", icon: "assets/ui/fx-stripes.png" },
    { id: "hearts", label: "Hearts", icon: "assets/ui/fx-heart.png" },
    { id: "bubbles", label: "Bubbles", icon: "assets/ui/fx-droplet.png" }
  ];
  function buildPatternList() {
    var list = $("pattern-list");
    list.innerHTML = "";
    var unlocked = isUnlocked();
    PATTERN_DEFS.forEach(function (pd) {
      var b = document.createElement("button");
      b.className = "magic-sw pattern-sw" + (fillModeSel === pd.id ? " sel" : "");
      b.innerHTML = '<span class="pattern-chip" style="background:' + currentColor + '">' +
        '<img src="' + pd.icon + '" alt=""></span><span class="magic-label">' + pd.label + "</span>";
      if (!unlocked) b.appendChild(lockVeil());
      b.addEventListener("click", function () {
        if (!unlocked) { sfx("error"); toast("Unlock for pattern fills!"); return; }
        applyFillStyle(pd.id);
      });
      list.appendChild(b);
    });
  }

  function updateColorNote() {
    var unlocked = isUnlocked();
    var notes = {
      solids: unlocked ? "All colors unlocked!" : "More colors with Unlock All!",
      magic: unlocked ? "Tap a picture part to fill it with magic!" : "Magic colors with Unlock All!",
      glitter: unlocked ? "Tap a picture part to fill it with glitter!" : "Glitter colors with Unlock All!",
      patterns: unlocked ? "Patterns paint in your picked color!" : "Pattern fills with Unlock All!"
    };
    $("color-note").textContent = notes[colorTab] || "";
  }

  function showColorTab(tab) {
    colorTab = tab;
    document.querySelectorAll("#color-tabs .ctab").forEach(function (b) {
      b.classList.toggle("sel", b.getAttribute("data-tab") === tab);
    });
    ["solids", "magic", "glitter", "patterns"].forEach(function (t) {
      $("pane-" + t).classList.toggle("hidden", t !== tab);
    });
    if (tab === "solids") buildColorGrid();
    else if (tab === "magic") buildMagicList();
    else if (tab === "glitter") buildGlitterGrid();
    else if (tab === "patterns") buildPatternList();
    updateColorNote();
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

  /* ============ tools: one big rail button + tool picker popup ============ */
  var TOOL_DEFS = [
    { id: "fill", label: "Bucket", icon: "assets/ui/bucket.png" },
    { id: "crayon", label: "Crayon", icon: "assets/ui/crayon.png" },
    { id: "pencil", label: "Pencil", icon: "assets/ui/pencil.png" },
    { id: "marker", label: "Marker", icon: "assets/ui/brush.png" },
    { id: "spray", label: "Spray", icon: "assets/ui/spray.png" },
    { id: "watercolor", label: "Watercolor", icon: "assets/ui/palette.png" },
    { id: "pattern", label: "Patterns", icon: "assets/ui/fx-dots.png" },
    { id: "eraser", label: "Eraser", icon: "assets/ui/eraser.png" },
    { id: "magic", label: "Rainbow", icon: "assets/ui/fx-rainbow.png", premium: true },
    { id: "neon", label: "Neon", icon: "assets/ui/fx-sparkle.png", premium: true },
    { id: "glitter", label: "Glitter", icon: "assets/ui/fx-glitter.png", premium: true },
    { id: "sparkle", label: "Sparkles", icon: "assets/ui/star.png", premium: true },
    { id: "stamp", label: "Stamps", icon: "assets/ui/fx-heart.png", premium: true }
  ];
  function toolIcon(id) {
    for (var i = 0; i < TOOL_DEFS.length; i++) if (TOOL_DEFS[i].id === id) return TOOL_DEFS[i].icon;
    return "assets/ui/brush.png";
  }

  /* ---- stamps: tap-to-place pictures from the premium icon set ---- */
  var STAMP_DEFS = [
    { id: "star", label: "Star", icon: "assets/ui/star.png" },
    { id: "heart", label: "Heart", icon: "assets/ui/fx-heart.png" },
    { id: "flower", label: "Flower", icon: "assets/ui/stamp-flower.png" },
    { id: "butterfly", label: "Butterfly", icon: "assets/ui/stamp-butterfly.png" },
    { id: "rainbow", label: "Rainbow", icon: "assets/ui/fx-rainbow.png" },
    { id: "sun", label: "Sun", icon: "assets/train/sun.png" },
    { id: "music", label: "Music", icon: "assets/ui/fx-music.png" }
  ];
  var stampImgs = {};
  var currentStamp = "star";
  function preloadStamps() {
    STAMP_DEFS.forEach(function (sd) {
      var im = new Image();
      im.src = sd.icon;
      stampImgs[sd.id] = im;
    });
  }
  function stampIcon(id) {
    for (var i = 0; i < STAMP_DEFS.length; i++) if (STAMP_DEFS[i].id === id) return STAMP_DEFS[i].icon;
    return STAMP_DEFS[0].icon;
  }
  /* Stamp size follows the S/M/L brush-size choice (canvas px). */
  function stampSizePx() {
    if (!engine) return 92;
    if (engine.brushSize <= BRUSH_PX.s) return 68;
    if (engine.brushSize <= BRUSH_PX.m) return 92;
    return 118;
  }
  function applyStampToEngine() {
    if (engine) engine.setStamp(stampImgs[currentStamp], stampSizePx());
  }
  function toggleStampPop(force) {
    var pop = $("stamp-pop");
    if (!pop) return;
    var showIt = typeof force === "boolean" ? force : pop.classList.contains("hidden");
    if (showIt) buildStampPop();
    pop.classList.toggle("hidden", !showIt);
  }
  function buildStampPop() {
    var pop = $("stamp-pop");
    pop.innerHTML = "";
    var title = document.createElement("div");
    title.className = "stamp-pop-title";
    title.textContent = "Pick a stamp!";
    pop.appendChild(title);
    var grid = document.createElement("div");
    grid.className = "tools-grid stamp-grid";
    STAMP_DEFS.forEach(function (sd) {
      var b = document.createElement("button");
      b.className = "tool-btn" + (currentStamp === sd.id ? " sel" : "");
      b.innerHTML = '<span class="tool-ico"><img src="' + sd.icon + '" alt=""></span><span>' + sd.label + "</span>";
      b.addEventListener("click", function () {
        currentStamp = sd.id;
        applyStampToEngine();
        setToolUI("stamp");
        sfx("select");
        toggleStampPop(false);
      });
      grid.appendChild(b);
    });
    pop.appendChild(grid);
  }

  /* The rail's big tool button always shows the current tool's icon. */
  function setToolUI(name) {
    var img = $("tool-current-img");
    if (img) img.src = name === "stamp" ? stampIcon(currentStamp) : toolIcon(name);
    var er = $("tool-eraser");
    if (er) er.classList.toggle("sel", name === "eraser");
    var tc = $("tool-current");
    if (tc) tc.classList.toggle("sel", name !== "eraser");
  }

  function pickTool(id) {
    if (engine) {
      engine.setTool(id);
      if (id === "stamp") applyStampToEngine();
      if (id === "pattern") {
        // the pattern brush trails whichever pattern is picked (or stars)
        if (fillModeSel === "dots" || fillModeSel === "stars" || fillModeSel === "hearts") {
          engine.setPatternShape(fillModeSel);
        }
      }
    }
    setToolUI(id);
    sfx("select");
  }

  function toggleToolsPop(force) {
    var pop = $("tools-pop");
    if (!pop) return;
    var showIt = typeof force === "boolean" ? force : pop.classList.contains("hidden");
    if (showIt) buildToolsPop();
    pop.classList.toggle("hidden", !showIt);
  }
  function buildToolsPop() {
    var pop = $("tools-pop");
    pop.innerHTML = "";
    var unlocked = isUnlocked();
    var grid = document.createElement("div");
    grid.className = "tools-grid";
    TOOL_DEFS.forEach(function (td) {
      var b = document.createElement("button");
      b.className = "tool-btn" + (engine && engine.tool === td.id ? " sel" : "");
      b.innerHTML = '<span class="tool-ico"><img src="' + td.icon + '" alt=""></span><span>' + td.label + "</span>" +
        (td.premium && !unlocked ? '<span class="fx-lock">' + LOCK_SVG + "</span>" : "");
      b.addEventListener("click", function () {
        if (td.premium && !unlocked) { sfx("error"); toast("Unlock for magic tools!"); return; }
        pickTool(td.id);
        toggleToolsPop(false);
        if (td.id === "stamp") toggleStampPop(true); // choose which stamp to place
      });
      grid.appendChild(b);
    });
    pop.appendChild(grid);
    var sizes = document.createElement("div");
    sizes.className = "tools-sizes";
    var lab = document.createElement("span");
    lab.className = "tools-sizes-label";
    lab.textContent = "Size";
    sizes.appendChild(lab);
    [["s", "dot-s"], ["m", "dot-m"], ["l", "dot-l"]].forEach(function (sz) {
      var b = document.createElement("button");
      b.className = "size-btn" + (engine && BRUSH_PX[sz[0]] === engine.brushSize ? " sel" : "");
      b.setAttribute("aria-label", "Brush size " + sz[0]);
      b.innerHTML = '<span class="dot ' + sz[1] + '"></span>';
      b.addEventListener("click", function () {
        if (engine) { engine.setBrushSize(BRUSH_PX[sz[0]]); applyStampToEngine(); }
        sizes.querySelectorAll(".size-btn").forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
        sfx("tap");
      });
      sizes.appendChild(b);
    });
    pop.appendChild(sizes);
  }

  /* Undo / Clear sit at the rail bottom, dimmed when they can't do anything. */
  function refreshRail() {
    if (!engine) return;
    var undoBtn = $("tool-undo"), clearBtn = $("tool-clear");
    if (undoBtn) undoBtn.classList.toggle("dim", !(engine.undoStack && engine.undoStack.length));
    if (clearBtn) clearBtn.classList.toggle("dim", engine.isBlank());
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

  function openColor(page) {
    // page may be null => free draw
    flushWipSave(); // bank any pending autosave from the previous picture
    currentPage = page || null;
    wipMuted = true; // engine resets/loads fire onChange — not user painting
    $("color-title").textContent = page ? page.title : "Free Draw";
    show("s-color");
    // line art for the child's age tier (simple / regular / detail)
    var artFile = page ? tierFile(page) : null;

    // NEVER remove the canvas element from the DOM — reuse it across opens.
    // Create the engine once, then reset its state for each new page.
    // The studio is the SAME for every age (Raji, 2026-10-10): full tool
    // rail, all 13 tools, eraser, and every palette tab — only the art
    // tier differs by age. No toddler tap-mode or hidden controls.
    var cv = $("color-canvas");
    if (!engine) {
      engine = new window.CW_COLOR.ColoringEngine(cv, {
        defaultTool: "marker",
        defaultColor: currentColor,
        defaultBrush: 26,
        onChange: function () { scheduleWipSave(); refreshRail(); },
        onFill: function (x, y) { sparkleBurst(x, y); }
      });
    } else {
      engine.reset({
        defaultTool: "marker",
        defaultColor: currentColor,
        defaultBrush: 26
      });
    }
    engine.setFillMode(fillModeSel);
    setColorDot();
    setToolUI("marker");
    toggleToolsPop(false);
    toggleStampPop(false);
    refreshRail();

    // WIP key for autosave: unique per page + art tier variant
    wipPageKey = page && currentTheme ? wipKeyFor(currentTheme.id, page.id) : "freedraw";

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
          wipMuted = false;
        });
      } else {
        engine.blank();
        restoreWip();
        wipMuted = false;
      }
      setTimeout(refreshRail, 500); // after any restored WIP has landed
      setTimeout(fitCanvas, 150);   // settle pass once layout is final
    });
  }

  /* ================= work-in-progress autosave =================
   * Every finished stroke is snapshotted per page, so leaving a picture
   * half-done never loses it — and every display (world cards, train-cart
   * passengers) can show the page's TRUE state: not started (line art),
   * halfway (the child's real half-colored snapshot) or done (finished
   * store). Two stores, both keyed by the page's WIP key:
   *   cw_wip_map_v1     — paint layer at 512px PNG (restorable) + timestamp
   *   cw_wip_thumbs_v1  — composited 168px JPEG thumbnail for displays
   * A blank canvas REMOVES the page's entries (it is "not started" again).
   * The legacy single-slot cw_wip_v1 is migrated into the map on boot. */
  var WIP_KEY = "cw_wip_v1";
  var WIP_MAP_KEY = "cw_wip_map_v1";
  var WIP_THUMB_KEY = "cw_wip_thumbs_v1";
  var WIP_STORE_SIZE = 512;
  var WIP_MAX_AGE = 7 * 24 * 3600 * 1000;
  var wipPageKey = null;
  var wipMuted = false;     // true while a page is opening/restoring
  var wipSaveTimer = null;

  function loadWipMap() {
    try { return JSON.parse(localStorage.getItem(WIP_MAP_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveWipMap(map) {
    try { localStorage.setItem(WIP_MAP_KEY, JSON.stringify(map)); return; } catch (e) {}
    // quota tight: drop the oldest half and retry once
    var keys = Object.keys(map).sort(function (a, b) { return (map[a].at || 0) - (map[b].at || 0); });
    keys.slice(0, Math.ceil(keys.length / 2)).forEach(function (k) { delete map[k]; });
    try { localStorage.setItem(WIP_MAP_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function loadWipThumbs() {
    try { return JSON.parse(localStorage.getItem(WIP_THUMB_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveWipThumbs(map) {
    try { localStorage.setItem(WIP_THUMB_KEY, JSON.stringify(map)); return; } catch (e) {}
    var keys = Object.keys(map).sort(function (a, b) { return (map[a].at || 0) - (map[b].at || 0); });
    keys.slice(0, Math.ceil(keys.length / 2)).forEach(function (k) { delete map[k]; });
    try { localStorage.setItem(WIP_THUMB_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function migrateLegacyWip() {
    try {
      var raw = localStorage.getItem(WIP_KEY);
      if (!raw) return;
      var wip = JSON.parse(raw);
      if (wip && wip.key && wip.dataUrl) {
        var map = loadWipMap();
        if (!map[wip.key]) {
          map[wip.key] = { dataUrl: wip.dataUrl, at: wip.at || Date.now() };
          saveWipMap(map);
        }
      }
      localStorage.removeItem(WIP_KEY);
    } catch (e) {}
  }
  /* The WIP key for a page under the CURRENT profile's art tier. */
  function wipKeyFor(themeId, pageId) {
    var suffix = ageTier() === "simple" ? ":toddler" : ageTier() === "detail" ? ":detail" : "";
    return "page:" + themeId + ":" + pageId + suffix;
  }
  /* Display thumbnail of the half-done picture for a page (or null). */
  function wipThumbForPage(themeId, pageId) {
    var entry = loadWipThumbs()[wipKeyFor(themeId, pageId)];
    if (entry && entry.src && Date.now() - (entry.at || 0) <= WIP_MAX_AGE) return entry.src;
    return null;
  }
  /* Any in-progress thumbnail in a theme (train-cart passenger). */
  function wipThumbFor(themeId) {
    var thumbs = loadWipThumbs();
    var prefix = "page:" + themeId + ":";
    var best = null;
    Object.keys(thumbs).forEach(function (k) {
      if (k.indexOf(prefix) !== 0) return;
      var e = thumbs[k];
      if (e && e.src && Date.now() - (e.at || 0) <= WIP_MAX_AGE) {
        if (!best || (e.at || 0) > (best.at || 0)) best = e;
      }
    });
    return best ? best.src : null;
  }

  function scheduleWipSave() {
    if (!engine || !wipPageKey || wipMuted) return;
    if (wipSaveTimer) clearTimeout(wipSaveTimer);
    wipSaveTimer = setTimeout(writeWip, 350);
  }
  function writeWip() {
    wipSaveTimer = null;
    if (!engine || !wipPageKey) return;
    var map = loadWipMap();
    var thumbs = loadWipThumbs();
    if (engine.isBlank()) {
      // nothing painted (fresh open, full undo, cleared): not started
      if (map[wipPageKey] || thumbs[wipPageKey]) {
        delete map[wipPageKey]; delete thumbs[wipPageKey];
        saveWipMap(map); saveWipThumbs(thumbs);
      }
      return;
    }
    try {
      var c = document.createElement("canvas");
      c.width = WIP_STORE_SIZE; c.height = WIP_STORE_SIZE;
      c.getContext("2d").drawImage(engine.colorCanvas, 0, 0, WIP_STORE_SIZE, WIP_STORE_SIZE);
      map[wipPageKey] = { dataUrl: c.toDataURL("image/png"), at: Date.now() };
      saveWipMap(map);
    } catch (e) {}
    if (wipPageKey !== "freedraw") {
      try {
        var full = engine.exportPNG();
        var t = document.createElement("canvas");
        t.width = 168; t.height = 168;
        t.getContext("2d").drawImage(full, 0, 0, 168, 168);
        thumbs[wipPageKey] = { src: t.toDataURL("image/jpeg", 0.72), at: Date.now() };
        saveWipThumbs(thumbs);
      } catch (e) {}
    }
  }
  /* Flush a pending autosave right away (e.g. leaving the studio). */
  function flushWipSave() {
    if (wipSaveTimer) { clearTimeout(wipSaveTimer); writeWip(); }
  }
  function clearWip() {
    if (wipSaveTimer) { clearTimeout(wipSaveTimer); wipSaveTimer = null; }
    try { localStorage.removeItem(WIP_KEY); } catch (e) {}
    if (!wipPageKey) return;
    var map = loadWipMap();
    var thumbs = loadWipThumbs();
    if (map[wipPageKey] || thumbs[wipPageKey]) {
      delete map[wipPageKey]; delete thumbs[wipPageKey];
      saveWipMap(map); saveWipThumbs(thumbs);
    }
  }
  function restoreWip() {
    if (!engine || !wipPageKey) return;
    var entry = loadWipMap()[wipPageKey];
    if (!entry || !entry.dataUrl) return;
    if (Date.now() - (entry.at || 0) > WIP_MAX_AGE) { clearWip(); return; } // stale
    engine.loadPainting(entry.dataUrl);
  }

  function initStudio() {
    $("tool-current").addEventListener("click", function () {
      sfx("tap");
      toggleToolsPop();
    });
    $("tool-eraser").addEventListener("click", function () {
      pickTool("eraser");
      toggleToolsPop(false);
    });
    $("btn-color").addEventListener("click", function () {
      sfx("tap");
      showColorTab(colorTab);
      $("color-modal").classList.remove("hidden");
    });
    document.querySelectorAll("#color-tabs .ctab").forEach(function (b) {
      b.addEventListener("click", function () { sfx("tap"); showColorTab(b.getAttribute("data-tab")); });
    });
    $("color-close").addEventListener("click", function () { $("color-modal").classList.add("hidden"); });
    $("color-modal").addEventListener("click", function (e) {
      if (e.target === $("color-modal")) $("color-modal").classList.add("hidden");
    });
    $("tool-undo").addEventListener("click", function () {
      if (engine && engine.undo()) { sfx("undo"); } else { toast("Nothing to undo"); }
      setTimeout(refreshRail, 120);
    });
    $("tool-clear").addEventListener("click", function () {
      if (engine) { engine.clear(true); clearWip(); toast("Cleared!"); refreshRail(); }
    });
    $("tool-done").addEventListener("click", doneAndSave);
    $("tool-save").addEventListener("click", saveOnly);
    // tap outside the tool picker closes it (pointerdown for touch,
    // mousedown as a fallback for webviews that only send mouse events)
    function dismissToolsPop(e) {
      var pop = $("tools-pop");
      if (pop && !pop.classList.contains("hidden") && e.target && e.target.closest &&
          !pop.contains(e.target) && e.target.closest("#tool-current") === null) {
        toggleToolsPop(false);
      }
      var spop = $("stamp-pop");
      if (spop && !spop.classList.contains("hidden") && e.target && e.target.closest &&
          !spop.contains(e.target) && e.target.closest("#tool-current") === null) {
        toggleStampPop(false);
      }
    }
    document.addEventListener("pointerdown", dismissToolsPop);
    document.addEventListener("mousedown", dismissToolsPop);
    // Canvas fit: refit on ANY change of the canvas area's size (rotation,
    // browser chrome showing/hiding, rail changes) — not just window resize.
    if (window.ResizeObserver) {
      var wrapEl = $("canvas-wrap");
      if (wrapEl) new ResizeObserver(function () { fitCanvas(); }).observe(wrapEl);
    }
    $("color-back").addEventListener("click", function () {
      flushWipSave(); // the world screen must already show the halfway state
      if (currentTheme) openTheme(currentTheme.id); // rebuild cards with true states
      else enterHome();
    });
    $("pages-back").addEventListener("click", function () { enterHome(); });
  }

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  /* One tap on Done = finished picture saved straight to the photo gallery.
   * No share sheet, no confirmation dialog. A confetti celebration plays,
   * and the finished picture becomes a passenger in its world's cart. */
  var saving = false;
  /* Save button: snapshot to the photo gallery, stay in the studio. */
  function saveOnly() {
    if (saving || !engine) return;
    saving = true;
    saveToGallery().then(
      function () { sfx("fanfare"); toast("Saved to photos!"); saving = false; },
      function () { toast("Couldn't save this time"); saving = false; }
    );
  }
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
    migrateLegacyWip();
    preloadStamps();
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
