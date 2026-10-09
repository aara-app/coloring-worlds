#!/usr/bin/env python3
"""Process premium-overhaul generations in gen/ into production assets:
white flood-fill knockout (enclosed whites survive), sheet slicing,
cart normalization onto a shared canvas, and engine cab-window measurement.
"""
import os, glob
from collections import deque
from PIL import Image, ImageFilter

ROOT = os.path.expanduser("~/workspace/kids-coloring-app")
GEN = os.path.join(ROOT, "gen")
WHITE = 242


def gen_file(substr):
    for f in sorted(glob.glob(os.path.join(GEN, "*.png"))):
        if substr in f:
            return f
    raise SystemExit("missing gen: " + substr)


def knockout(im):
    """Return RGBA with border-connected near-white made transparent."""
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
    # soften the cut edge slightly
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


def save(im, rel):
    dst = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, optimize=True)
    print(rel, im.size)


def scaled(im, target_h=None, target_w=None):
    if target_h:
        s = target_h / im.height
        return im.resize((round(im.width * s), target_h), Image.LANCZOS)
    if target_w:
        s = target_w / im.width
        return im.resize((target_w, round(im.height * s)), Image.LANCZOS)
    return im


def main():
    # ---- engine: knockout, measure cab window + chimney for CSS slots ----
    eng = knockout(Image.open(gen_file("premium-engine")))
    eng = content_crop(eng)
    save(eng, "assets/train/engine.png")
    W, H = eng.size
    px = eng.convert("RGB").load()
    # cab window = dark navy blob in the back (right) portion of the body
    xs, ys = [], []
    for y in range(int(H * 0.2), int(H * 0.75)):
        for x in range(int(W * 0.52), int(W * 0.9)):
            r, g, b = px[x, y]
            if r < 45 and g < 75 and b > 80 and b > r + 40:
                xs.append(x); ys.append(y)
    if xs:
        print("WINDOW frac: left=%.3f top=%.3f w=%.3f h=%.3f" % (
            min(xs) / W, min(ys) / H, (max(xs) - min(xs)) / W, (max(ys) - min(ys)) / H))
    # chimney: tallest content in the front-top area (x 18%..45%)
    top_y = H
    alpha = eng.getchannel("A").load()
    for y in range(H):
        row_has = any(alpha[x, y] > 40 for x in range(int(W * 0.18), int(W * 0.45)))
        if row_has:
            top_y = y
            break
    # chimney x-center: scan the top row band
    xs2 = [x for x in range(int(W * 0.15), int(W * 0.5)) if alpha[x, top_y + 4] > 40]
    if xs2:
        print("CHIMNEY frac: cx=%.3f top=%.3f" % ((sum(xs2) / len(xs2)) / W, top_y / H))
    print("ENGINE size:", eng.size)

    # ---- wheel / sun / rainbow ----
    save(scaled(content_crop(knockout(Image.open(gen_file("premium-wheel")))), target_h=380),
         "assets/train/wheel.png")
    save(scaled(content_crop(knockout(Image.open(gen_file("premium-sun")))), target_h=340),
         "assets/train/sun.png")
    save(scaled(content_crop(knockout(Image.open(gen_file("premium-rainbow")))), target_w=1150),
         "assets/train/rainbow.png")

    # ---- scene layers ----
    hills = content_crop(knockout(Image.open(gen_file("premium-hills"))), pad=2)
    save(scaled(hills, target_w=1440), "assets/train/hills.png")
    clouds = content_crop(knockout(Image.open(gen_file("premium-clouds"))), pad=2)
    save(scaled(clouds, target_w=1440), "assets/train/clouds.png")

    # ---- carts: normalize onto a shared canvas, bottom-anchored ----
    CW, CH = 980, 680
    for theme, gen in (("farm", "premium-cart-farm"), ("wild", "premium-cart-wild2"),
                       ("princess", "premium-cart-princess"), ("baby", "premium-cart-baby"),
                       ("dino", "premium-cart-dino"), ("construction", "premium-cart-construction")):
        im = content_crop(knockout(Image.open(gen_file(gen))))
        s = min(950 / im.width, 655 / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((CW - im.width) // 2, CH - im.height))
        save(canvas, "assets/train/cart-%s.png" % theme)

    # ---- onboarding characters + mascot + ages (overwrite old files) ----
    save(scaled(content_crop(knockout(Image.open(gen_file("premium-boy")))), target_h=780),
         "assets/boy-icon.png")
    save(scaled(content_crop(knockout(Image.open(gen_file("premium-girl")))), target_h=780),
         "assets/girl-icon.png")
    save(scaled(content_crop(knockout(Image.open(gen_file("premium-mascot")))), target_h=780),
         "assets/mascot.png")
    for name in ("duckling", "monkey", "lion"):
        save(scaled(content_crop(knockout(Image.open(gen_file("premium-age-" + name)))), target_h=560),
             "assets/age-%s.png" % name)

    # ---- icon sheets: slice 3x3, per-cell knockout, square-pad ----
    sheets = {
        "premium-sheet-tools": ["check", "brush", "bucket", "wand", "eraser", "undo", "trash", "back", "home"],
        "premium-sheet-system": ["lock", "unlock", "star", "close", "sound-on", "sound-off", "grownups", "pencil", "gallery"],
        "premium-sheet-interests": ["interest-cars", "interest-dinos", "interest-princess", "interest-animals",
                                    "interest-space", "interest-ocean", "restore", "crayon", "palette"],
        "premium-sheet-fx": ["fx-rainbow", "fx-dots", "fx-stripes", "fx-droplet", "fx-glitter",
                             "fx-sparkle", "fx-lollipop", "fx-heart", "fx-music"],
    }
    for gen, names in sheets.items():
        sheet = Image.open(gen_file(gen)).convert("RGB")
        w, h = sheet.size
        for i, name in enumerate(names):
            cx, cy = (i % 3) * w // 3, (i // 3) * h // 3
            cell = sheet.crop((cx, cy, cx + w // 3, cy + h // 3))
            icon = content_crop(knockout(cell), pad=4)
            side = 340
            s = min((side - 16) / icon.width, (side - 16) / icon.height)
            icon = icon.resize((round(icon.width * s), round(icon.height * s)), Image.LANCZOS)
            canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            canvas.alpha_composite(icon, ((side - icon.width) // 2, (side - icon.height) // 2))
            save(canvas, "assets/ui/%s.png" % name)


if __name__ == "__main__":
    main()
