#!/usr/bin/env python3
"""Process generated train art: knock out the white background (border flood
fill so white fur/bellies enclosed by outlines survive), crop to content,
and save production assets:
  gen/*driver*      -> assets/driver.png          (swappable driver)
  gen/*cart-<t>*    -> assets/train/cart-<t>.png  (cart riders per world)
Also installs the fox+rainbow sample as assets/icon.png.
"""
import os
from collections import deque
from PIL import Image

ROOT = os.path.expanduser("~/workspace/kids-coloring-app")
GEN = os.path.join(ROOT, "gen")
WHITE = 242  # channels >= this count as background white


def knockout(src, dst, target_h):
    im = Image.open(src).convert("RGB")
    # work at a modest size: fast flood fill, plenty for on-screen display
    if max(im.size) > 1000:
        s = 1000 / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    w, h = im.size
    px = im.load()

    def is_white(x, y):
        r, g, b = px[x, y]
        return r >= WHITE and g >= WHITE and b >= WHITE

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_white(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_white(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_white(nx, ny):
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    out = im.convert("RGBA")
    opx = out.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        base = y * w
        for x in range(w):
            if seen[base + x]:
                r, g, b, _ = opx[x, y]
                opx[x, y] = (r, g, b, 0)
            else:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    pad = 8
    box = (max(0, minx - pad), max(0, miny - pad),
           min(w, maxx + pad + 1), min(h, maxy + pad + 1))
    out = out.crop(box)
    scale = target_h / out.height
    out = out.resize((round(out.width * scale), target_h), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    out.save(dst, optimize=True)
    print(os.path.basename(dst), out.size)


def find_gen(substr):
    for f in sorted(os.listdir(GEN)):
        if substr in f and f.endswith(".png"):
            return os.path.join(GEN, f)
    raise SystemExit("missing gen file: " + substr)


def main():
    # Driver CONFIRMED by Raji: the baby elephant mascot (assets/mascot.png),
    # flat conductor version. Single swappable file: assets/driver.png.
    knockout(find_gen("driver-elephant-raw"), os.path.join(ROOT, "assets/driver.png"), 620)
    for theme in ("farm", "wild", "princess", "baby", "dino", "construction"):
        knockout(find_gen("cart-%s-raw" % theme),
                 os.path.join(ROOT, "assets/train/cart-%s.png" % theme), 470)
    # App icon CONFIRMED by Raji: clean rainbow elephant icon.
    icon_src = os.path.join(ROOT, "samples",
                            "media-generation-coloring-train-icon-elephant-c-0-aa02ee1d-650f-4e44-a5b3-3c1a9aa27c89.png")
    icon = Image.open(icon_src).convert("RGB")
    icon.save(os.path.join(ROOT, "assets/icon.png"), optimize=True)
    print("icon.png", icon.size)


if __name__ == "__main__":
    main()
