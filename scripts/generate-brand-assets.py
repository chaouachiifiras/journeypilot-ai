"""Draws the JourneyPilot AI icon ("C1 - trajet classique") and writes every platform asset.

Usage (Python 3 + Pillow):
    python scripts/generate-brand-assets.py

Artwork, in a 130x130 design space: a cream compass rose with a copper north point on deep
green, crossed by a dashed gold route from a gold start dot to a copper destination.
Outputs: store icons, Android launcher + adaptive icons + splash screens, the in-app logo mark
(light-background variant), the web favicon and the iOS 1024 icon. Run
`python scripts/generate-ios-assets.py store-assets/icon-1024.png` afterwards for the iOS
icon and launch screen.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/app/src/main/res"

GREEN = (15, 74, 62)
GOLD = (195, 148, 67)
COPPER = (192, 96, 46)
CREAM = (251, 248, 242)
IVORY = (246, 242, 234)
SS = 4  # supersampling factor

STAR = [(65, 27), (71.5, 58.5), (103, 65), (71.5, 71.5), (65, 103), (58.5, 71.5), (27, 65), (58.5, 58.5)]
NORTH = [(65, 27), (71.5, 58.5), (65, 65), (58.5, 58.5)]
ROUTE = ((20, 106), (30, 40), (102, 28))  # quadratic Bezier
START, DEST = (20, 106), (102, 28)


def _quad(p0, p1, p2, t):
    a = (1 - t) ** 2
    b = 2 * (1 - t) * t
    c = t * t
    return (a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1])


def _dashed_route(draw, tf, scale, color, width=3.5, dash=6.0, gap=6.0):
    pts = [_quad(*ROUTE, i / 600) for i in range(601)]
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.dist(a, b))
    w = width * scale
    # Leave room around the start dot and the destination marker so no dash stub touches them.
    pos, stop, on = 9.0, cum[-1] - 11.0, True
    while pos < stop:
        end = min(pos + (dash if on else gap), stop)
        if on:
            # Stamp round dots along the dash: PIL's wide polylines leave hairline gaps at joints.
            for x, y in (tf(p) for p, c in zip(pts, cum) if pos <= c <= end):
                draw.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=color)
        pos, on = end, not on


def draw_artwork(img, box, palette):
    """Draws the rose + route into `box` (x, y, size) of an RGBA image, 130-unit design space."""
    x0, y0, size = box
    s = size / 130
    tf = lambda p: (x0 + p[0] * s, y0 + p[1] * s)
    d = ImageDraw.Draw(img)
    _dashed_route(d, tf, s, palette["route"])
    cx, cy = tf(START)
    r = 5 * s
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=palette["route"])
    d.polygon([tf(p) for p in STAR], fill=palette["star"])
    d.polygon([tf(p) for p in NORTH], fill=COPPER)
    cx, cy = tf(DEST)
    for rad, col in ((8, COPPER), (3.2, palette["dot"])):
        r = rad * s
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)


ON_DARK = {"route": GOLD, "star": CREAM, "dot": CREAM}
ON_LIGHT = {"route": GOLD, "star": GREEN, "dot": CREAM}


# Background: diagonal gradient, lighter green top-left to deep green bottom-right.
GRADIENT = ((52, 160, 136), (15, 90, 74))


def gradient(size, colors=None):
    """Square image with a top-left -> bottom-right linear gradient."""
    (r1, g1, b1), (r2, g2, b2) = colors or GRADIENT
    small = Image.new("RGB", (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            t = (x + y) / 510
            px[x, y] = (round(r1 + (r2 - r1) * t), round(g1 + (g2 - g1) * t), round(b1 + (b2 - b1) * t))
    return small.resize((size, size), Image.BICUBIC).convert("RGBA")


def render(size, shape="square", art_scale=1.0, palette=ON_DARK, transparent=False):
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if not transparent:
        mask = Image.new("L", (big, big), 0)
        d = ImageDraw.Draw(mask)
        if shape == "square":
            d.rectangle((0, 0, big, big), fill=255)
        elif shape == "rounded":
            d.rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * 30 / 130), fill=255)
        elif shape == "circle":
            d.ellipse((0, 0, big - 1, big - 1), fill=255)
        img.paste(gradient(big), (0, 0), mask)
    art = big * art_scale
    draw_artwork(img, ((big - art) / 2, (big - art) / 2, art), palette)
    return img.resize((size, size), Image.LANCZOS)


def save(img, path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert("RGB") if rgb else img).save(path, optimize=True)
    print("wrote", path.relative_to(ROOT))


def main():
    save(render(1024), ROOT / "store-assets/icon-1024.png", rgb=True)
    save(render(512), ROOT / "store-assets/play-icon-512.png", rgb=True)

    # In-app logo mark, drawn for light backgrounds (header, auth dialog).
    save(render(512, transparent=True, art_scale=0.92, palette=ON_LIGHT), ROOT / "src/assets/logo-mark.png")

    # Favicon: rounded tile, multi-size .ico.
    fav = render(256, shape="rounded")
    fav.save(ROOT / "public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
    print("wrote public/favicon.ico")

    # Android launcher icons. Adaptive foreground keeps the artwork inside the 66dp safe zone.
    for density, legacy in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        folder = RES / f"mipmap-{density}"
        save(render(legacy, shape="rounded"), folder / "ic_launcher.png")
        save(render(legacy, shape="circle", art_scale=0.9), folder / "ic_launcher_round.png")
        layer = legacy * 108 // 48
        save(render(layer, transparent=True, art_scale=68 / 108), folder / "ic_launcher_foreground.png")
        save(gradient(layer), folder / "ic_launcher_background.png", rgb=True)
    # Adaptive icons use the gradient bitmap as background layer.
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        xml = RES / "mipmap-anydpi-v26" / name
        xml.write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
            "</adaptive-icon>\n",
            encoding="utf-8",
        )
        print("wrote", xml.relative_to(ROOT))
    bg_xml = RES / "values/ic_launcher_background.xml"
    bg_xml.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#1E7A64</color>\n</resources>\n',
        encoding="utf-8",
    )
    print("wrote", bg_xml.relative_to(ROOT))

    # Android splash screens: the rounded icon centred on the app's ivory background.
    for splash in RES.glob("drawable*/splash.png"):
        w, h = Image.open(splash).size
        tile = round(min(w, h) * 0.28)
        canvas = Image.new("RGBA", (w, h), IVORY + (255,))
        canvas.alpha_composite(render(tile, shape="rounded"), ((w - tile) // 2, (h - tile) // 2))
        save(canvas, splash, rgb=True)


if __name__ == "__main__":
    main()
