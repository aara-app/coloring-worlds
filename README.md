# Coloring Worlds — Kids' Coloring Book App (v1)

Safe, offline coloring book for kids ages 0–8. Parent sets up once (girl/boy → age → interests);
the kid just colors. No accounts, no ads, no tracking, no network calls in the kids' area.

## What's inside

- **Web app** (`index.html` + `css/` + `js/`): onboarding, theme picker, page picker
  (colored thumbnails), coloring studio, free draw, parent gate, grown-ups section.
- **Coloring engine** (`js/coloring.js`): canvas layers (paint under line art, composited
  with `multiply`), scanline flood fill for tap-to-fill, brush/eraser, undo (25 steps),
  clear, PNG export. Flood-fill core is DOM-free and unit-tested (`node -e` test in build notes).
- **Art** (`assets/pages/<theme>/`): 40 line-art pages + 40 colored thumbnails,
  6 themes × 10 pages. Line art normalized to pure B/W 1024px (see `scripts/normalize.py`).
- **Age modes**: 0–2 → tap-to-fill only; 3–5 / 6–8 → brush + paint bucket + eraser.

## Quick test (web)

```bash
cd ~/workspace/kids-coloring-app
python3 -m http.server 8080
# open http://localhost:8080/ on a phone/tablet on the same network,
# or use any static server. All assets are relative paths.
```

Walkthrough: pick Girl/Boy → age → up to 3 interests → Start Coloring → pick a
world → tap a colored thumbnail → color it (bucket for 0–2, brush otherwise).
"Grown-ups" (footer) → hold 3s → math check → grown-ups section.

## Capacitor (iOS + Android)

```bash
cd ~/workspace/kids-coloring-app
npm install
npm run build        # copies index.html/css/js/assets -> www/
npx cap add ios      # needs macOS + Xcode to build the .ipa
npx cap add android  # needs Android SDK to build the .apk/.aab
npx cap sync
npx cap open ios     # / android
```

- `capacitor.config.json`: appId `com.aara.coloringworlds`, appName `Coloring Worlds`,
  `webDir: www`. **No `server.url`** — the app is fully bundled and works offline.
- App icon source: `assets/icon.png` (1600×1600). Generate native icon sets with
  `npx capacitor-assets` or Xcode/Android Studio image asset tools.
- IAP is a **placeholder** in v1 ("Coming Soon" in Grown-ups). Wire StoreKit 2 /
  Play Billing in a later step before adding paid unlocks.

## Regenerating / adding art

1. Generate line art (bold B/W outlines, white bg) → `assets/pages/<theme>/<slug>.png`
2. Generate colored version from the line art → `<slug>-thumb.png`
3. Run `python3 scripts/normalize.py` (thresholds line art, pads to 1024/384)
4. Add the page entry in `js/data.js` (`pg("<theme>", "<slug>", "Title")`)

## Project layout

```
index.html  css/style.css  js/{data,app,coloring}.js
assets/pages/{farm,wild,princess,baby,dino,construction}/<slug>{,-thumb}.png
assets/icon.png
scripts/{build-www.js, normalize.py}
capacitor.config.json  package.json
```

## Privacy posture (v1)

COPPA-oriented: no signup, no analytics, no ads, no third-party requests.
Profile (gender/age/interests) lives in `localStorage` only. Artwork is saved
via the OS share sheet / download — nothing is uploaded anywhere.
