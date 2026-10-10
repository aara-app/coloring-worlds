#!/usr/bin/env python3
"""Process detail-restyle generations (gen/media-generation-dt2-<theme>-<id>-0-*.png)
into production assets/pages/<theme>/detail-<id>.png + detail-<id>-thumb.png.
Mirrors process-halloween-art.process_page: grayscale resize <=1024, threshold
<180 -> pure B/W, centered on white 1024 canvas; thumb = contain-fit 384.

Usage:
  python3 scripts/process-detail-restyle.py <theme> <id> [<id> ...]
  python3 scripts/process-detail-restyle.py <theme> ALL
  python3 scripts/process-detail-restyle.py sheet <theme>   # QA contact sheet
  python3 scripts/process-detail-restyle.py check <theme>   # verify all 10 pure B/W 1024
"""
import os, glob, sys
from PIL import Image

ROOT = os.path.expanduser("~/workspace/kids-coloring-app")
GEN = os.path.join(ROOT, "gen")
PAGES = os.path.join(ROOT, "assets", "pages")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from detail_manifest import PAGES as MANIFEST


def gen_file(theme, pid):
    hits = glob.glob(os.path.join(GEN, "media-generation-dt2-%s-%s-0-*.png" % (theme, pid)))
    if not hits:
        raise SystemExit("missing gen for %s/%s" % (theme, pid))
    hits.sort(key=os.path.getmtime)  # newest generation wins
    return hits[-1]


def contain_fit(im, size):
    im = im.convert("RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas


def process_page(src, dst):
    im = Image.open(src).convert("L")
    im.thumbnail((1024, 1024), Image.LANCZOS)
    im = im.point(lambda v: 0 if v < 180 else 255, mode="1").convert("L")
    canvas = Image.new("L", (1024, 1024), 255)
    canvas.paste(im, ((1024 - im.width) // 2, (1024 - im.height) // 2))
    im = canvas.convert("RGB")
    im.save(dst, optimize=True)
    thumb = contain_fit(im, 384)
    thumb.save(dst[:-4] + "-thumb.png", optimize=True)


def process(theme, ids):
    tdir = os.path.join(PAGES, theme)
    for pid in ids:
        dst = os.path.join(tdir, "detail-%s.png" % pid)
        process_page(gen_file(theme, pid), dst)
        print("ok", theme, pid)


def sheet(theme):
    ids = [p[0] for p in MANIFEST[theme]]
    cell = 500
    cols, rows = 2, 5
    out = Image.new("RGB", (cols * cell, rows * cell), "white")
    for i, pid in enumerate(ids):
        p = os.path.join(PAGES, theme, "detail-%s.png" % pid)
        im = Image.open(p).convert("RGB")
        im.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
        out.paste(im, ((i % cols) * cell + 4, (i // cols) * cell + 4))
    dst = os.path.join(GEN, "qa-sheet-%s.png" % theme)
    out.save(dst)
    print(dst)


def check(theme):
    bad = []
    for pid, *_ in MANIFEST[theme]:
        p = os.path.join(PAGES, theme, "detail-%s.png" % pid)
        im = Image.open(p)
        colors = im.convert("L").getcolors(300000)
        vals = sorted(set(v for _, v in colors)) if colors else []
        if im.size != (1024, 1024) or vals != [0, 255]:
            bad.append((pid, im.size, vals[:5]))
        t = Image.open(os.path.join(PAGES, theme, "detail-%s-thumb.png" % pid))
        if t.size != (384, 384):
            bad.append((pid + "-thumb", t.size, []))
    print(theme, "BAD:", bad if bad else "none — all 10 pure B/W 1024 + 384 thumbs")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "sheet":
        sheet(sys.argv[2])
    elif cmd == "check":
        check(sys.argv[2])
    else:
        theme = cmd
        ids = [p[0] for p in MANIFEST[theme]] if sys.argv[2] == "ALL" else sys.argv[2:]
        process(theme, ids)
