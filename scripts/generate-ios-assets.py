"""Generates the iOS app icon and launch screen from the brand artwork.

Usage (Python 3 + Pillow):
    python scripts/generate-ios-assets.py [path/to/icon-1024.png]

- With a 1024x1024 source: used as is for the App Store icon (alpha removed,
  flattened on white — Apple rejects transparent icons).
- Without one: falls back to store-assets/play-icon-512.png, upscaled.
The launch screen is the compass mark on the app's ivory background, centred
so it survives the aspect-fill crop on every iPhone.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "ios/App/App/Assets.xcassets"
ICON_OUT = ASSETS / "AppIcon.appiconset/AppIcon-512@2x.png"
SPLASH_DIR = ASSETS / "Splash.imageset"
IVORY = (246, 242, 234)


def flatten(img: Image.Image, bg=(255, 255, 255)) -> Image.Image:
    img = img.convert("RGBA")
    base = Image.new("RGBA", img.size, bg + (255,))
    base.alpha_composite(img)
    return base.convert("RGB")


def make_icon(source: Path) -> None:
    img = flatten(Image.open(source))
    if img.size != (1024, 1024):
        img = img.resize((1024, 1024), Image.LANCZOS)
    img.save(ICON_OUT, optimize=True)
    print(f"icon  {ICON_OUT.relative_to(ROOT)} <- {source.relative_to(ROOT) if source.is_relative_to(ROOT) else source}")


def make_splash() -> None:
    mark = Image.open(ROOT / "src/assets/logo-mark.png").convert("RGBA")
    bbox = mark.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    size = 620
    scale = size / max(mark.size)
    mark = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (2732, 2732), IVORY + (255,))
    canvas.alpha_composite(mark, ((2732 - mark.width) // 2, (2732 - mark.height) // 2))
    out = canvas.convert("RGB")
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        out.save(SPLASH_DIR / name, optimize=True)
    print(f"splash {SPLASH_DIR.relative_to(ROOT)} (3 files)")


if __name__ == "__main__":
    src = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "store-assets/play-icon-512.png"
    make_icon(src)
    make_splash()
