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
   * Returns number of pixels filled (0 = tap was on an outline / outside).
   */
  function floodFillRegion(colorImg, lineImg, sx, sy, r, g, b) {
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

  /* ---------------- Canvas wrapper (browser only) ---------------- */
  function ColoringEngine(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.size = SIZE;
    this.tool = opts.defaultTool || "brush"; // brush | fill | eraser
    this.color = opts.defaultColor || "#ff3b30";
    this.brushSize = opts.defaultBrush || 26;
    this.onChange = opts.onChange || function () {};
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
      self.pushUndo();
      self.drawing = true;
      self.lastPt = p;
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

  ColoringEngine.prototype._tapFill = function (x, y) {
    if (!this.lineImageData) { // free-draw: paint a blob instead
      this.pushUndo();
      var ctx = this.colorCtx;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(x, y, this.brushSize * 1.4, 0, Math.PI * 2); ctx.fill();
      this.render(); this.onChange();
      return;
    }
    var colorImg = this.colorCtx.getImageData(0, 0, SIZE, SIZE);
    var rgb = hexToRgb(this.color);
    var n = floodFillRegion(colorImg, this.lineImageData, x | 0, y | 0, rgb[0], rgb[1], rgb[2]);
    if (n > 0) {
      this.pushUndo();
      this.colorCtx.putImageData(colorImg, 0, 0);
      this.render(); this.onChange();
      try { if (window.CW_SFX) window.CW_SFX.pop(); } catch (e) {}
    }
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
    this.tapMode = !!opts.tapMode;
    this.drawing = false;
    this.lastPt = null;
    this.magicHue = 0;
    this.undoStack = [];
    this.lineImageData = null;
    this.colorCtx.globalCompositeOperation = "source-over";
    this.colorCtx.clearRect(0, 0, SIZE, SIZE);
    this.lineCtx.globalCompositeOperation = "source-over";
    this.lineCtx.clearRect(0, 0, SIZE, SIZE);
    this.render();
  };

  ColoringEngine.prototype.setColor = function (hex) { this.color = hex; if (this.tool === "eraser") this.tool = "brush"; };
  ColoringEngine.prototype.setTool = function (t) { this.tool = t; };
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
    ColoringEngine: ColoringEngine
  };
  if (typeof window !== "undefined") window.CW_COLOR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
