#!/usr/bin/env python3
"""Normalize coloring-page art for Coloring Worlds.

- Line art (<slug>.png): threshold to pure B/W (kills gray shading),
  slight dilation to close tiny outline gaps (helps flood fill),
  contain-fit on white 1024x1024.
- Thumbnails (<slug>-thumb.png): contain-fit on white 384x384.
Idempotent: safe to re-run.
"""
import os
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.expanduser("~/workspace/kids-coloring-app/assets/pages")
LINE_SIZE = 1024
THUMB_SIZE = 384

def contain_fit(im, size):
    im = im.convert("RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas

def normalize_line(path):
    im = Image.open(path).convert("L")
    # threshold: kill grays -> pure black/white
    im = im.point(lambda v: 0 if v < 180 else 255, mode="1").convert("L")
    # slight dilation closes 1px gaps in outlines
    im = im.filter(ImageFilter.MaxFilter(3))
    im = contain_fit(im, LINE_SIZE)
    im.save(path, optimize=True)

def normalize_thumb(path):
    im = Image.open(path)
    im = contain_fit(im, THUMB_SIZE)
    im.save(path, optimize=True)

def main():
    n_line = n_thumb = 0
    for theme in sorted(os.listdir(ROOT)):
        tdir = os.path.join(ROOT, theme)
        if not os.path.isdir(tdir):
            continue
        for f in sorted(os.listdir(tdir)):
            if not f.endswith(".png") or f.startswith("media-generation"):
                continue
            p = os.path.join(tdir, f)
            if f.endswith("-thumb.png"):
                normalize_thumb(p); n_thumb += 1
            else:
                normalize_line(p); n_line += 1
    print(f"normalized: {n_line} line-art, {n_thumb} thumbnails")

if __name__ == "__main__":
    main()
