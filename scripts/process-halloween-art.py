#!/usr/bin/env python3
"""Process Halloween generations in gen/ into production assets:
- pages: threshold to pure B/W, contain-fit 1024x1024 white RGB + 384 thumbs
  (mirrors normalize.py, without MaxFilter so detail lines survive)
- cart: white border flood-fill knockout -> 980x680 RGBA canvas, bottom-anchored
  (mirrors process-premium-art.py)
"""
import os, glob, sys
from collections import deque
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.expanduser("~/workspace/kids-coloring-app")
GEN = os.path.join(ROOT, "gen")
PAGES = os.path.join(ROOT, "assets", "pages", "halloween")

PAGES_LIST = ["pumpkin", "ghost", "witch", "blackcat", "candybucket",
              "hauntedhouse", "bat", "owl", "mummy", "trickortreat"]


def gen_file(substr):
    hits = sorted(glob.glob(os.path.join(GEN, "media-generation-%s-0-*.png" % substr)))
    if not hits:
        raise SystemExit("missing gen: " + substr)
    return hits[-1]


def contain_fit(im, size):
    im = im.convert("RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas


def process_page(src, dst):
    # resize in grayscale FIRST, then threshold, then paste unscaled onto the
    # white canvas — keeps full-size pages pure B/W like the existing themes
    im = Image.open(src).convert("L")
    im.thumbnail((1024, 1024), Image.LANCZOS)
    im = im.point(lambda v: 0 if v < 180 else 255, mode="1").convert("L")
    canvas = Image.new("L", (1024, 1024), 255)
    canvas.paste(im, ((1024 - im.width) // 2, (1024 - im.height) // 2))
    im = canvas.convert("RGB")
    im.save(dst, optimize=True)
    thumb = contain_fit(im, 384)
    base = dst[:-4] + "-thumb.png"
    thumb.save(base, optimize=True)
    print(os.path.relpath(dst, ROOT), os.path.relpath(base, ROOT))


WHITE = 242


def knockout(im):
    im = im.convert("RGB")
    if max(im.size) > 1400:
        s = 1400 / max(im.size)
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
    for y in range(h):
        base = y * w
        for x in range(w):
            if seen[base + x]:
                r, g, b, _ = opx[x, y]
                opx[x, y] = (r, g, b, 0)
    a = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    out.putalpha(a)
    return out


def content_crop(im, pad=6):
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        return im
    l = max(0, bbox[0] - pad); u = max(0, bbox[1] - pad)
    r = min(im.width, bbox[2] + pad); d = min(im.height, bbox[3] + pad)
    return im.crop((l, u, r, d))


def process_cart():
    im = content_crop(knockout(Image.open(gen_file("hw-cart-halloween"))))
    CW, CH = 980, 680
    s = min(950 / im.width, 655 / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((CW - im.width) // 2, CH - im.height))
    dst = os.path.join(ROOT, "assets", "train", "cart-halloween.png")
    canvas.save(dst, optimize=True)
    print(os.path.relpath(dst, ROOT), canvas.size, canvas.mode)


def main():
    os.makedirs(PAGES, exist_ok=True)
    for pid in PAGES_LIST:
        process_page(gen_file("hw-regular-" + pid), os.path.join(PAGES, pid + ".png"))
        process_page(gen_file("hw-simple-" + pid), os.path.join(PAGES, "simple-" + pid + ".png"))
        process_page(gen_file("hw-detail-" + pid), os.path.join(PAGES, "detail-" + pid + ".png"))
    process_cart()


if __name__ == "__main__":
    main()
