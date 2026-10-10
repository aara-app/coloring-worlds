/* Coloring Worlds — canvas coloring engine.
 * Layers: colorLayer (user paint, transparent) under lineLayer (line art, white bg).
 * Display composites with 'multiply' so white line-art bg doesn't cover paint.
 * Flood-fill core is DOM-free and unit-testable in node.
 */
(function () {
  "use strict";

  var SIZE = 1024;          // working canvas resolution (square)
  var BARRIER_LUMA = 140;   // line-art pixels darker than this block flood fill
  var MAX_UNDO = 25;

  function lumaAt(d, i) { return (d[i] + d[i + 1] + d[i + 2]) / 3; }

  /* Scanline flood fill.
   * colorImg: {width,height,data} Uint8ClampedArray — mutated in place.
   * lineImg:  {width,height,data} — barrier map (dark = outline).
   * Fills the connected non-barrier region containing (sx,sy) with (r,g,b,255).
   * Optional painter(x, y, data, idx): per-pixel override (rainbow / patterns);
   * when given, it replaces the solid (r,g,b) write and must set alpha too.
   * Returns number of pixels filled (0 = tap was on an outline / outside).
   */
  function floodFillRegion(colorImg, lineImg, sx, sy, r, g, b, painter) {
    var w = colorImg.width, h = colorImg.height;
    if (w !== lineImg.width || h !== lineImg.height) return 0;
    sx |= 0; sy |= 0;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return 0;

    var cd = colorImg.data, ld = lineImg.data;
    var startIdx = (sy * w + sx) * 4;
    if (lumaAt(ld, startIdx) < BARRIER_LUMA) return 0; // tapped on a line

    var visited = new Uint8Array(w * h);
    var stack = [sx, sy];
    var filled = 0;

    function barrier(x, y) {
      var i = (y * w + x) * 4;
      return lumaAt(ld, i) < BARRIER_LUMA;
    }
    function paint(x, y) {
      var i = (y * w + x) * 4;
      if (painter) { painter(x, y, cd, i); return; }
      cd[i] = r; cd[i + 1] = g; cd[i + 2] = b; cd[i + 3] = 255;
    }

    while (stack.length) {
      var y = stack.pop(), x = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      var vi = y * w + x;
      if (visited[vi] || barrier(x, y)) continue;
      // scan left
      var xl = x;
      while (xl >= 0 && !visited[y * w + xl] && !barrier(xl, y)) xl--;
      xl++;
      // scan right, painting the span and queuing rows above/below
      var xr = x;
      while (xr < w && !visited[y * w + xr] && !barrier(xr, y)) xr++;
      xr--;
      for (var xi = xl; xi <= xr; xi++) {
        visited[y * w + xi] = 1;
        paint(xi, y);
        filled++;
      }
      for (var xi2 = xl; xi2 <= xr; xi2++) {
        if (y > 0 && !visited[(y - 1) * w + xi2] && !barrier(xi2, y - 1)) { stack.push(xi2, y - 1); }
        if (y < h - 1 && !visited[(y + 1) * w + xi2] && !barrier(xi2, y + 1)) { stack.push(xi2, y + 1); }
      }
    }
    return filled;
  }

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /* h: 0..360, s/l: 0..100 -> [r,g,b] 0..255 */
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h * 6) % 2 - 1));
    var m = l - c / 2;
    var rgb = h < 1 / 6 ? [c, x, 0] : h < 2 / 6 ? [x, c, 0] : h < 3 / 6 ? [0, c, x]
      : h < 4 / 6 ? [0, x, c] : h < 5 / 6 ? [x, 0, c] : [c, 0, x];
    return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
  }

  /* ---------------- Canvas wrapper (browser only) ---------------- */
  function ColoringEngine(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.size = SIZE;
    this.tool = opts.defaultTool || "brush"; // brush | fill | eraser
    this.color = opts.defaultColor || "#ff3b30";
    this.brushSize = opts.defaultBrush || 26;
    this.onChange = opts.onChange || function () {};
    this.onFill = opts.onFill || function () {}; // (x, y) after a successful fill — for sparkle bursts
    this.fillMode = "solid"; // solid | rainbow | dots | stars | stripes
    this._patternCache = {}; // fillMode+color -> full-frame ImageData.data
    this.tapMode = !!opts.tapMode; // 0-2: everything is tap-to-fill

    canvas.width = SIZE; canvas.height = SIZE;
    this.displayCtx = canvas.getContext("2d");

    this.colorCanvas = document.createElement("canvas");
    this.colorCanvas.width = SIZE; this.colorCanvas.height = SIZE;
    this.colorCtx = this.colorCanvas.getContext("2d");

    this.lineCanvas = document.createElement("canvas");
    this.lineCanvas.width = SIZE; this.lineCanvas.height = SIZE;
    this.lineCtx = this.lineCanvas.getContext("2d");

    this.lineImageData = null; // barrier map
    this.undoStack = [];
    this.drawing = false;
    this.lastPt = null;
    this.magicHue = 0; // rainbow cycle position for the magic brush
    this.patternShape = "stars"; // shape trailed by the pattern brush: dots | stars | hearts
    this._patAcc = 0; // distance accumulator for pattern-brush spacing
    this.stampImg = null; // HTMLImageElement placed by the stamp tool
    this.stampSize = 92; // stamp edge length in canvas px

    this._bindPointer();
    this.render();
  }

  ColoringEngine.prototype._bindPointer = function () {
    var self = this, cv = this.canvas;
    function pos(e) {
      var r = cv.getBoundingClientRect();
      var cx = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
      var cy = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
      return {
        x: Math.max(0, Math.min(SIZE - 1, (cx - r.left) / r.width * SIZE)),
        y: Math.max(0, Math.min(SIZE - 1, (cy - r.top) / r.height * SIZE))
      };
    }
    cv.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var p = pos(e);
      if (self.tapMode || self.tool === "fill") { self._tapFill(p.x, p.y); return; }
      if (self.tool === "stamp") {
        // tap-to-place: one stamp per tap, undone/redone like any stroke
        if (!self.stampImg) return;
        self.pushUndo();
        self.placeStamp(p.x, p.y);
        self.onChange();
        try { if (window.CW_SFX) window.CW_SFX.pop(); } catch (err) {}
        return;
      }
      self.pushUndo();
      self.drawing = true;
      self.lastPt = p;
      self._patAcc = 0;
      try { if (window.CW_SFX) window.CW_SFX.stroke(); } catch (err) {}
      self._strokeTo(p); // dot on tap
    });
    cv.addEventListener("pointermove", function (e) {
      if (!self.drawing) return;
      e.preventDefault();
      var p = pos(e);
      self._strokeTo(p);
    });
    function end(e) {
      if (!self.drawing) return;
      self.drawing = false; self.lastPt = null;
      self.onChange();
    }
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", end);
  };

  ColoringEngine.prototype._strokeTo = function (p) {
    var ctx = this.colorCtx;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (this.tool === "magic") { this._strokeMagic(p); return; }
    if (this.tool === "glitter") { this._strokeGlitter(p); return; }
    if (this.tool === "sparkle") { this._strokeSparkle(p); return; }
    if (this.tool === "spray") { this._strokeSpray(p); return; }
    if (this.tool === "watercolor") { this._strokeWatercolor(p); return; }
    if (this.tool === "neon") { this._strokeNeon(p); return; }
    if (this.tool === "pattern") { this._strokePattern(p); return; }
    if (this.tool === "crayon") { this._strokeCrayon(p); return; }
    if (this.tool === "pencil") { this._strokeFine(p, Math.max(3, Math.min(11, this.brushSize * 0.2)), 0.92); return; }
    if (this.tool === "marker") { this._strokeFine(p, this.brushSize * 1.55, 0.88); return; }
    if (this.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = this.color;
    }
    ctx.lineWidth = this.tool === "eraser" ? this.brushSize * 1.6 : this.brushSize;
    ctx.beginPath();
    if (this.lastPt) { ctx.moveTo(this.lastPt.x, this.lastPt.y); }
    else { ctx.moveTo(p.x, p.y); }
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    this.lastPt = p;
    this.render();
  };

  /* ---- freehand drawing tools (pencil / marker / crayon) ----
   * All of them paint onto colorCtx, so undo snapshots, WIP autosave and
   * the flattened export treat them exactly like fills and brush strokes. */

  /* Thin hard stroke (pencil) or thick smooth stroke (marker). */
  ColoringEngine.prototype._strokeFine = function (p, width, alpha) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = width;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (this.lastPt) { ctx.moveTo(this.lastPt.x, this.lastPt.y); }
    else { ctx.moveTo(p.x, p.y); }
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.globalAlpha = 1;
    this.lastPt = p;
    this.render();
  };

  /* Crayon: waxy, grainy stroke. A translucent core line plus many small
   * jittered grain stamps along the segment, so edges look broken and
   * speckled like real crayon on paper. */
  ColoringEngine.prototype._strokeCrayon = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    var from = this.lastPt || p;
    var dx = p.x - from.x, dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var w = this.brushSize;
    // translucent core (lighter in the middle of the stroke)
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = w * 0.82;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // grain stamps
    ctx.fillStyle = this.color;
    var steps = Math.max(1, Math.floor(dist / 3.5));
    for (var i = 0; i <= steps; i++) {
      var t = steps === 0 ? 0 : i / steps;
      var cx = from.x + dx * t, cy = from.y + dy * t;
      var grains = 5;
      for (var k = 0; k < grains; k++) {
        var gx = cx + (Math.random() - 0.5) * w * 0.96;
        var gy = cy + (Math.random() - 0.5) * w * 0.96;
        var r = 1 + Math.random() * Math.max(1.6, w * 0.1);
        ctx.globalAlpha = 0.3 + Math.random() * 0.55;
        ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill();
      }
      // occasional paper-white fleck for the broken-wax look
      if (Math.random() < 0.5) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx + (Math.random() - 0.5) * w * 0.7, cy + (Math.random() - 0.5) * w * 0.7,
          1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.color;
      }
    }
    ctx.globalAlpha = 1;
    this.lastPt = p;
    this.render();
  };

  /* True when the paint layer has no visible paint (sampled cheaply). */
  ColoringEngine.prototype.isBlank = function () {
    if (!this._blankCv) {
      this._blankCv = document.createElement("canvas");
      this._blankCv.width = 24; this._blankCv.height = 24;
    }
    var c = this._blankCv.getContext("2d");
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, 24, 24);
    c.drawImage(this.colorCanvas, 0, 0, 24, 24);
    var d = c.getImageData(0, 0, 24, 24).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] > 12) return false;
    return true;
  };

  /* ---- premium effect brushes (magic / glitter / sparkle) ---- */

  /* Magic brush: stroke cycles through rainbow hues as you draw. */
  ColoringEngine.prototype._strokeMagic = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = this.brushSize;
    var from = this.lastPt || p;
    var dx = p.x - from.x, dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.floor(dist / 8));
    for (var i = 1; i <= steps; i++) {
      var t0 = (i - 1) / steps, t1 = i / steps;
      this.magicHue = (this.magicHue + 7) % 360;
      ctx.strokeStyle = "hsl(" + (this.magicHue | 0) + ",95%,60%)";
      ctx.beginPath();
      ctx.moveTo(from.x + dx * t0, from.y + dy * t0);
      ctx.lineTo(from.x + dx * t1 + 0.01, from.y + dy * t1 + 0.01);
      ctx.stroke();
    }
    this.lastPt = p;
    this.render();
  };

  var GLITTER_COLORS = ["#ffd93d", "#ff6b9d", "#4dabff", "#3ddc97", "#bf5af2", "#ffffff", "#ff9500"];

  /* Glitter brush: trail of tiny multicolor sparkle dots along the stroke. */
  ColoringEngine.prototype._strokeGlitter = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    var from = this.lastPt || p;
    var dx = p.x - from.x, dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.floor(dist / 10));
    var spread = this.brushSize * 1.6;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var x = from.x + dx * t, y = from.y + dy * t;
      for (var k = 0; k < 3; k++) {
        var px = x + (Math.random() - 0.5) * spread;
        var py = y + (Math.random() - 0.5) * spread;
        var r = 2 + Math.random() * Math.max(3, this.brushSize * 0.16);
        ctx.fillStyle = GLITTER_COLORS[(Math.random() * GLITTER_COLORS.length) | 0];
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    this.lastPt = p;
    this.render();
  };

  /* 4-point sparkle star stamp, drawn with curved points. */
  ColoringEngine.prototype._sparkleStar = function (ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  };

  var SPARKLE_COLORS = ["#ffd93d", "#ffffff", "#ffb3d9", "#fff3b0"];

  /* Sparkle effect: big star stamps scattered along the stroke. */
  ColoringEngine.prototype._strokeSparkle = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    var from = this.lastPt || p;
    var dx = p.x - from.x, dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.floor(dist / 26));
    var base = Math.max(10, this.brushSize * 0.7);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var x = from.x + dx * t + (Math.random() - 0.5) * base;
      var y = from.y + dy * t + (Math.random() - 0.5) * base;
      var r = base * (0.5 + Math.random() * 0.8);
      this._sparkleStar(ctx, x, y, r, SPARKLE_COLORS[(Math.random() * SPARKLE_COLORS.length) | 0]);
    }
    this.lastPt = p;
    this.render();
  };

  /* ---- more freehand tools: spray / watercolor / neon / pattern / stamps ----
   * Same contract as the other brushes: paint onto colorCtx only, so undo
   * snapshots, WIP autosave and the flattened export all include them. */

  /* Spray can: soft cloud of tiny translucent particles along the stroke. */
  ColoringEngine.prototype._strokeSpray = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    var from = this.lastPt || p;
    var dx = p.x - from.x, dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var radius = Math.max(10, this.brushSize * 1.05);
    var steps = Math.max(1, Math.floor(dist / 7));
    ctx.fillStyle = this.color;
    for (var i = 0; i <= steps; i++) {
      var t = steps === 0 ? 0 : i / steps;
      var cx = from.x + dx * t, cy = from.y + dy * t;
      for (var k = 0; k < 16; k++) {
        // denser in the middle: radius shrinks with sqrt(random)
        var ang = Math.random() * Math.PI * 2;
        var rr = Math.sqrt(Math.random()) * radius;
        ctx.globalAlpha = 0.14 + Math.random() * 0.3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 0.8 + Math.random() * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.lastPt = p;
    this.render();
  };

  /* Watercolor: very translucent wide stroke + an even softer bleed halo,
   * so color builds up in washes where strokes overlap. */
  ColoringEngine.prototype._strokeWatercolor = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = this.color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var from = this.lastPt || p;
    var passes = [
      { w: this.brushSize * 2.1, a: 0.05 },  // bleed halo
      { w: this.brushSize * 1.45, a: 0.13 }  // wash body
    ];
    for (var i = 0; i < passes.length; i++) {
      ctx.globalAlpha = passes[i].a;
      ctx.lineWidth = passes[i].w;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.lastPt = p;
    this.render();
  };

  /* Neon glow: a glowing colored halo (shadow blur) + a bright hot core. */
  ColoringEngine.prototype._strokeNeon = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var from = this.lastPt || p;
    function seg(w, style, blur, alpha) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = blur;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
    seg.call(this, this.brushSize * 1.15, this.color, this.brushSize * 0.9, 0.85);
    var rgb = hexToRgb(this.color);
    var core = "rgb(" + Math.round(rgb[0] + (255 - rgb[0]) * 0.72) + "," +
      Math.round(rgb[1] + (255 - rgb[1]) * 0.72) + "," +
      Math.round(rgb[2] + (255 - rgb[2]) * 0.72) + ")";
    seg.call(this, Math.max(3, this.brushSize * 0.36), core, this.brushSize * 0.35, 0.95);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    this.lastPt = p;
    this.render();
  };

  /* Heart outline path centered on (x, y), s = half-width in px. */
  ColoringEngine.prototype._heartPath = function (ctx, x, y, s) {
    var u = s / 16;
    ctx.beginPath();
    ctx.moveTo(x, y + 10 * u);
    ctx.bezierCurveTo(x - 16 * u, y - 4 * u, x - 9 * u, y - 16 * u, x, y - 7 * u);
    ctx.bezierCurveTo(x + 9 * u, y - 16 * u, x + 16 * u, y - 4 * u, x, y + 10 * u);
    ctx.closePath();
  };

  /* Pattern brush: a trail of small shapes (dots / stars / hearts) in the
   * current color instead of a plain line, evenly spaced along the stroke. */
  ColoringEngine.prototype._strokePattern = function (p) {
    var ctx = this.colorCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    var from = this.lastPt || p;
    var dx = p.x - from.x, dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var size = Math.max(9, Math.min(30, this.brushSize * 0.62));
    var spacing = size * 1.25;
    var shape = this.patternShape || "stars";
    var self = this;
    function stampAt(x, y) {
      if (shape === "dots") {
        ctx.beginPath(); ctx.arc(x, y, size * 0.5, 0, Math.PI * 2); ctx.fill();
      } else if (shape === "hearts") {
        self._heartPath(ctx, x, y, size * 0.72); ctx.fill();
      } else {
        self._sparkleStar(ctx, x, y, size * 0.72, self.color);
      }
    }
    if (dist < 0.01) {
      stampAt(p.x, p.y); // a tap (or a held-still point) still stamps once
      this._patAcc = 0;
    } else {
      var travelled = spacing - this._patAcc;
      while (travelled <= dist) {
        var t = travelled / dist;
        stampAt(from.x + dx * t, from.y + dy * t);
        travelled += spacing;
      }
      this._patAcc = (this._patAcc + dist) % spacing;
    }
    this.lastPt = p;
    this.render();
  };

  /* Stamps: place the current stamp image centered on (x, y) with a slight
   * playful tilt. The image is drawn onto the paint layer itself. */
  ColoringEngine.prototype.placeStamp = function (x, y) {
    if (!this.stampImg) return;
    var ctx = this.colorCtx;
    var s = this.stampSize || 92;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.22);
    try { ctx.drawImage(this.stampImg, -s / 2, -s / 2, s, s); } catch (e) {}
    ctx.restore();
    this.render();
  };

  ColoringEngine.prototype.setStamp = function (img, sizePx) {
    this.stampImg = img || null;
    if (sizePx) this.stampSize = sizePx;
  };

  ColoringEngine.prototype._tapFill = function (x, y) {
    if (!this.lineImageData) { // free-draw: paint a blob instead
      this.pushUndo();
      var ctx = this.colorCtx;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(x, y, this.brushSize * 1.4, 0, Math.PI * 2); ctx.fill();
      this.render(); this.onChange(); this.onFill(x, y);
      return;
    }
    var colorImg = this.colorCtx.getImageData(0, 0, SIZE, SIZE);
    var rgb = hexToRgb(this.color);
    var painter = this.fillMode !== "solid" ? this._makePainter() : null;
    var n = floodFillRegion(colorImg, this.lineImageData, x | 0, y | 0, rgb[0], rgb[1], rgb[2], painter);
    if (n > 0) {
      this.pushUndo();
      this.colorCtx.putImageData(colorImg, 0, 0);
      this.render(); this.onChange(); this.onFill(x, y);
      try { if (window.CW_SFX) window.CW_SFX.pop(); } catch (e) {}
    }
  };

  /* Build the per-pixel painter for the current fillMode.
   * Rainbow: diagonal hue bands (precomputed per x+y diagonal for speed).
   * Patterns: current color as the base with white shapes, tiled full-frame
   * into a cached ImageData the painter copies from. Null if unavailable. */
  ColoringEngine.prototype._makePainter = function () {
    if (this.fillMode === "rainbow") {
      var diag = [];
      for (var d = 0; d <= 2 * (SIZE - 1); d++) diag.push(hslToRgb(d * 0.32, 92, 60));
      return function (x, y, cd, i) {
        var rgb = diag[x + y];
        cd[i] = rgb[0]; cd[i + 1] = rgb[1]; cd[i + 2] = rgb[2]; cd[i + 3] = 255;
      };
    }
    if (this.fillMode.indexOf("grad-") === 0) {
      // Magic gradient fills: diagonal multi-stop blend, precomputed per diagonal.
      var grads = (typeof window !== "undefined" && window.CW_DATA && window.CW_DATA.GRADIENTS) || [];
      var stops = null;
      for (var gi = 0; gi < grads.length; gi++) {
        if (grads[gi].id === this.fillMode) { stops = grads[gi].stops; break; }
      }
      if (!stops) return null;
      var cols = stops.map(hexToRgb);
      var gdiag = [];
      var maxD = 2 * (SIZE - 1);
      for (var gd = 0; gd <= maxD; gd++) {
        var gt = gd / maxD * (cols.length - 1);
        var i0 = Math.min(cols.length - 2, Math.floor(gt));
        var gf = gt - i0, ca = cols[i0], cb = cols[i0 + 1];
        gdiag.push([
          Math.round(ca[0] + (cb[0] - ca[0]) * gf),
          Math.round(ca[1] + (cb[1] - ca[1]) * gf),
          Math.round(ca[2] + (cb[2] - ca[2]) * gf)
        ]);
      }
      return function (x, y, cd, i) {
        var rgb = gdiag[x + y];
        cd[i] = rgb[0]; cd[i + 1] = rgb[1]; cd[i + 2] = rgb[2]; cd[i + 3] = 255;
      };
    }
    var data = this._patternData(this.fillMode);
    if (!data) return null;
    return function (x, y, cd, i) {
      cd[i] = data[i]; cd[i + 1] = data[i + 1]; cd[i + 2] = data[i + 2]; cd[i + 3] = 255;
    };
  };

  /* Full-frame (SIZE x SIZE) pattern pixels for a pattern fill mode,
   * drawn once per (mode, color) and cached (max 4 entries). */
  ColoringEngine.prototype._patternData = function (mode) {
    var key = mode + ":" + this.color;
    if (this._patternCache[key]) return this._patternCache[key];
    var tile = 96;
    var tc = document.createElement("canvas");
    tc.width = tile; tc.height = tile;
    var t = tc.getContext("2d");
    t.fillStyle = this.color;
    t.fillRect(0, 0, tile, tile);
    t.fillStyle = "#ffffff";
    var i, j;
    if (mode === "dots") {
      for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
        t.beginPath(); t.arc(i * 48 + 24, j * 48 + 24, 10, 0, Math.PI * 2); t.fill();
        t.beginPath(); t.arc(i * 48, j * 48, 10, 0, Math.PI * 2); t.fill();
      }
    } else if (mode === "stripes") {
      t.save();
      t.translate(tile / 2, tile / 2); t.rotate(Math.PI / 4); t.translate(-tile, -tile);
      for (i = 0; i < 6; i++) t.fillRect(0, i * 32, tile * 2, 13);
      t.restore();
    } else if (mode === "stars") {
      this._sparkleStar(t, 24, 24, 15, "#ffffff");
      this._sparkleStar(t, 72, 72, 15, "#ffffff");
      this._sparkleStar(t, 72, 24, 9, "#ffffff");
      this._sparkleStar(t, 24, 72, 9, "#ffffff");
    } else if (mode === "hearts") {
      var heart = function (cx, cy, s) {
        t.save(); t.translate(cx, cy); t.scale(s, s);
        t.beginPath();
        t.moveTo(0, 10);
        t.bezierCurveTo(-16, -4, -9, -16, 0, -7);
        t.bezierCurveTo(9, -16, 16, -4, 0, 10);
        t.fill(); t.restore();
      };
      heart(26, 30, 1.05); heart(74, 78, 1.05);
      heart(76, 28, 0.62); heart(26, 80, 0.62);
    } else if (mode === "bubbles") {
      var bubble = function (cx, cy, r) {
        t.beginPath(); t.arc(cx, cy, r, 0, Math.PI * 2);
        t.fillStyle = "rgba(255,255,255,0.28)"; t.fill();
        t.lineWidth = 3; t.strokeStyle = "#ffffff"; t.stroke();
        t.beginPath(); t.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
        t.fillStyle = "#ffffff"; t.fill();
      };
      bubble(28, 28, 15); bubble(72, 66, 19);
      bubble(74, 22, 9); bubble(24, 76, 10);
      t.fillStyle = "#ffffff";
    } else if (mode === "glitter") {
      // Base hue + dense sparkle speckles (white / pale gold / light tint
      // of the base) + a few twinkle stars. Seeded RNG so the tile is
      // identical every time it is generated for a given hue.
      var seed = 1234567;
      var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      var base = hexToRgb(this.color);
      var tint = [
        Math.min(255, Math.round(base[0] + (255 - base[0]) * 0.55)),
        Math.min(255, Math.round(base[1] + (255 - base[1]) * 0.55)),
        Math.min(255, Math.round(base[2] + (255 - base[2]) * 0.55))
      ];
      var speck = ["#ffffff", "#fff3a6", "rgb(" + tint[0] + "," + tint[1] + "," + tint[2] + ")"];
      for (i = 0; i < 260; i++) {
        t.fillStyle = speck[(rnd() * 3) | 0];
        t.globalAlpha = 0.5 + rnd() * 0.5;
        t.beginPath();
        t.arc(rnd() * tile, rnd() * tile, 0.8 + rnd() * 1.7, 0, Math.PI * 2);
        t.fill();
      }
      t.globalAlpha = 1;
      this._sparkleStar(t, 26, 30, 8, "#ffffff");
      this._sparkleStar(t, 70, 74, 10, "#fff3a6");
      this._sparkleStar(t, 74, 22, 6, "#ffffff");
      t.fillStyle = "#ffffff";
    } else {
      return null;
    }
    var full = document.createElement("canvas");
    full.width = SIZE; full.height = SIZE;
    var f = full.getContext("2d");
    f.fillStyle = f.createPattern(tc, "repeat");
    f.fillRect(0, 0, SIZE, SIZE);
    var data = f.getImageData(0, 0, SIZE, SIZE).data;
    var keys = Object.keys(this._patternCache);
    if (keys.length >= 4) delete this._patternCache[keys[0]];
    this._patternCache[key] = data;
    return data;
  };

  ColoringEngine.prototype.render = function () {
    var ctx = this.displayCtx;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.colorCanvas, 0, 0);
    if (this.lineImageData) {
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(this.lineCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
  };

  ColoringEngine.prototype.loadLineArt = function (url, done) {
    var self = this;
    var img = new Image();
    img.onload = function () {
      self.lineCtx.globalCompositeOperation = "source-over";
      self.lineCtx.fillStyle = "#ffffff";
      self.lineCtx.fillRect(0, 0, SIZE, SIZE);
      // contain-fit
      var s = Math.min(SIZE / img.width, SIZE / img.height);
      var dw = img.width * s, dh = img.height * s;
      self.lineCtx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
      self.lineImageData = self.lineCtx.getImageData(0, 0, SIZE, SIZE);
      self.clear(false);
      self.render();
      if (done) done();
    };
    img.onerror = function () { if (done) done(new Error("art failed to load")); };
    img.src = url;
  };

  ColoringEngine.prototype.blank = function () {
    this.lineImageData = null;
    this.lineCtx.clearRect(0, 0, SIZE, SIZE);
    this.clear(false);
    this.render();
  };

  ColoringEngine.prototype.pushUndo = function () {
    try {
      this.undoStack.push(this.colorCanvas.toDataURL("image/png"));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    } catch (e) { /* ignore */ }
  };

  ColoringEngine.prototype.undo = function () {
    var self = this;
    var url = this.undoStack.pop();
    if (!url) return false;
    var img = new Image();
    img.onload = function () {
      self.colorCtx.globalCompositeOperation = "source-over";
      self.colorCtx.clearRect(0, 0, SIZE, SIZE);
      self.colorCtx.drawImage(img, 0, 0);
      self.render(); self.onChange();
    };
    img.src = url;
    return true;
  };

  ColoringEngine.prototype.clear = function (withUndo) {
    if (withUndo !== false) this.pushUndo();
    this.colorCtx.globalCompositeOperation = "source-over";
    this.colorCtx.clearRect(0, 0, SIZE, SIZE);
    this.undoStack = withUndo === false ? [] : this.undoStack;
    this.render();
    this.onChange();
  };

  /* Reset all paint state without touching the DOM canvas element.
   * Used when opening a new page: reuses the same canvas. */
  ColoringEngine.prototype.reset = function (opts) {
    opts = opts || {};
    this.tool = opts.defaultTool || "brush";
    this.color = opts.defaultColor || "#ff3b30";
    this.brushSize = opts.defaultBrush || 26;
    this.fillMode = "solid";
    this.tapMode = !!opts.tapMode;
    this.drawing = false;
    this.lastPt = null;
    this.magicHue = 0;
    this._patAcc = 0;
    this.undoStack = [];
    this.lineImageData = null;
    this.colorCtx.globalCompositeOperation = "source-over";
    this.colorCtx.clearRect(0, 0, SIZE, SIZE);
    this.lineCtx.globalCompositeOperation = "source-over";
    this.lineCtx.clearRect(0, 0, SIZE, SIZE);
    this.render();
  };

  ColoringEngine.prototype.setColor = function (hex) { this.color = hex; if (this.tool === "eraser") this.tool = "marker"; };
  ColoringEngine.prototype.setTool = function (t) { this.tool = t; };
  ColoringEngine.prototype.setFillMode = function (m) { this.fillMode = m || "solid"; };
  ColoringEngine.prototype.setPatternShape = function (s) {
    if (s === "dots" || s === "stars" || s === "hearts") this.patternShape = s;
  };
  ColoringEngine.prototype.setBrushSize = function (px) { this.brushSize = px; };

  /* Export a finished picture: white bg + paint + lines, flattened. */
  ColoringEngine.prototype.exportPNG = function () {
    var out = document.createElement("canvas");
    out.width = SIZE; out.height = SIZE;
    var ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.colorCanvas, 0, 0);
    if (this.lineImageData) {
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(this.lineCanvas, 0, 0);
    }
    return out;
  };

  /* Restore a previously saved painting (work-in-progress) onto the paint layer. */
  ColoringEngine.prototype.loadPainting = function (dataUrl, done) {
    var self = this;
    var img = new Image();
    img.onload = function () {
      self.colorCtx.globalCompositeOperation = "source-over";
      self.colorCtx.clearRect(0, 0, SIZE, SIZE);
      self.colorCtx.drawImage(img, 0, 0, SIZE, SIZE);
      self.render();
      if (done) done();
    };
    img.onerror = function () { if (done) done(new Error("wip load failed")); };
    img.src = dataUrl;
  };

  var api = {
    SIZE: SIZE,
    floodFillRegion: floodFillRegion,
    hexToRgb: hexToRgb,
    hslToRgb: hslToRgb,
    ColoringEngine: ColoringEngine
  };
  if (typeof window !== "undefined") window.CW_COLOR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
