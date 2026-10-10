#!/usr/bin/env python3
"""Build the three Coloring Worlds print PDFs (70 pages each, 7 worlds x 10).
Page order = js/data.js order (farm, wild, halloween, princess, baby, dino,
construction). Format matches the 2026-10-09 PDFs: square 768x768 pt pages
(1024px images at 96 dpi).
"""
import os, sys
from PIL import Image

ROOT = os.path.expanduser("~/workspace/kids-coloring-app")
OUT = os.path.expanduser("~/workspace/goals/kids-coloring-app/files")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from detail_manifest import PAGES, THEME_ORDER

TIERS = [
    ("", "coloring-3-5-preschool.pdf"),          # regular <id>.png
    ("simple-", "coloring-0-2-toddlers.pdf"),    # simple-<id>.png
    ("detail-", "coloring-6-8-kids.pdf"),        # detail-<id>.png
]


def build(prefix, outname):
    paths = []
    for theme in THEME_ORDER:
        for pid, *_ in PAGES[theme]:
            p = os.path.join(ROOT, "assets", "pages", theme, "%s%s.png" % (prefix, pid))
            if not os.path.exists(p):
                raise SystemExit("missing: " + p)
            paths.append(p)
    imgs = [Image.open(p).convert("RGB") for p in paths]
    dst = os.path.join(OUT, outname)
    imgs[0].save(dst, "PDF", save_all=True, append_images=imgs[1:],
                 resolution=96.0, quality=88, title=outname[:-4])
    print(dst, len(imgs), "pages,", round(os.path.getsize(dst) / 1e6, 1), "MB")


if __name__ == "__main__":
    for prefix, outname in TIERS:
        build(prefix, outname)
