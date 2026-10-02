/* Coloring Worlds — procedural sound effects (Web Audio API, zero audio files).
 * Cheerful kid-friendly tones, generated on the fly. COPPA-clean: no network.
 * window.CW_SFX = { tap, select, pop, colorPick, stroke, undo, error, fanfare,
 *                   toggleMute, isMuted, unlockAudio } */
(function () {
  "use strict";

  var LS_MUTED = "cw_muted_v1";
  var ctx = null;
  var master = null;
  var muted = false;
  try { muted = localStorage.getItem(LS_MUTED) === "1"; } catch (e) {}

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* Play a note: freq (Hz) or [from,to] slide, dur seconds, type, delay, gain. */
  function note(freq, dur, type, delay, gain) {
    var c = ac();
    if (!c || muted) return;
    type = type || "sine";
    delay = delay || 0;
    gain = gain == null ? 0.5 : gain;
    var t0 = c.currentTime + delay;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type;
    if (Array.isArray(freq)) {
      o.frequency.setValueAtTime(freq[0], t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq[1]), t0 + dur);
    } else {
      o.frequency.setValueAtTime(freq, t0);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /* Soft filtered noise swish (brush strokes). */
  function swish(dur, gain) {
    var c = ac();
    if (!c || muted) return;
    dur = dur || 0.18;
    gain = gain == null ? 0.10 : gain;
    var t0 = c.currentTime;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.8;
    var g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  var api = {
    /* short cheerful blip for generic button taps */
    tap: function () { note(720, 0.09, "sine", 0, 0.35); },
    /* happy two-note for selections / confirmations */
    select: function () { note(523, 0.10, "triangle", 0, 0.4); note(784, 0.14, "triangle", 0.09, 0.4); },
    /* tap-to-fill pop */
    pop: function () { note([500, 950], 0.12, "triangle", 0, 0.45); },
    /* soft chime when picking a color */
    colorPick: function () { note(880, 0.10, "sine", 0, 0.3); note(1320, 0.12, "sine", 0.06, 0.22); },
    /* subtle swish at the start of a brush stroke */
    stroke: function () { swish(0.16, 0.08); },
    /* descending blip for undo */
    undo: function () { note([600, 320], 0.14, "sine", 0, 0.35); },
    /* gentle low buzz for wrong/locked */
    error: function () { note([220, 160], 0.18, "sine", 0, 0.3); },
    /* completion fanfare: rising C-E-G-C arpeggio + sparkle */
    fanfare: function () {
      var seq = [523, 659, 784, 1047];
      for (var i = 0; i < seq.length; i++) note(seq[i], 0.22, "triangle", i * 0.11, 0.42);
      note(1568, 0.35, "sine", 0.46, 0.25);
      note(2093, 0.4, "sine", 0.55, 0.18);
    },
    toggleMute: function () {
      muted = !muted;
      try { localStorage.setItem(LS_MUTED, muted ? "1" : "0"); } catch (e) {}
      return muted;
    },
    isMuted: function () { return muted; },
    /* call from the first user gesture so later sounds are allowed */
    unlockAudio: function () { ac(); }
  };

  /* iOS/Safari: unlock the AudioContext on the first touch anywhere. */
  function unlockOnce() {
    api.unlockAudio();
    document.removeEventListener("pointerdown", unlockOnce);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("pointerdown", unlockOnce);
  }

  if (typeof window !== "undefined") window.CW_SFX = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
