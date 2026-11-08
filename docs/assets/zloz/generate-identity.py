"""Generate final assets from selected geometry and the family's installed Inter font.

Run: uv run --with fonttools==4.60.1 --with brotli==1.1.0 docs/assets/zloz/generate-identity.py
"""

from pathlib import Path
import re
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

root = Path(__file__).resolve().parents[3]
assets = Path(__file__).resolve().parent
output = assets / "final"
output.mkdir(exist_ok=True)
source = (assets / "nested-frame.svg").read_text()
geometry = "\n".join(re.findall(r"  <path[^>]+/>", source))
font_dir = root / "apps/promo/node_modules/@fontsource-variable/inter"
font = instantiateVariableFont(TTFont(font_dir / "files/inter-latin-wght-normal.woff2"), {"wght": 740})
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 25 / font["head"].unitsPerEm
x = 44.0
letters = []
for character in "Foldkit Zloz":
    name = cmap[ord(character)]
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(pen)
    path = pen.getCommands()
    if path:
        letters.append(f'<path transform="translate({x:.3f} 29) scale({scale:.8f} {-scale:.8f})" d="{path}"/>')
    x += font["hmtx"][name][0] * scale - 0.6
width = round(x + 4)

def svg(body, wordmark=False):
    size = f'{width} 40' if wordmark else '32 32'
    dimensions = f'width="{width}" height="40"' if wordmark else 'width="32" height="32"'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size}" {dimensions} role="img" aria-label="Foldkit Zloz">\n  <title>Foldkit Zloz — Nested frame</title>\n{body}\n</svg>\n'

palettes = {
    "light": {"blue": "#3d79fa", "gold": "#f5ce60", "coral": "#fa8b79"},
    "dark": {"blue": "#4485ff", "gold": "#ffda66", "coral": "#ff9485"},
}
for variant in ["adaptive", "light", "dark", "mono"]:
    paths = geometry
    if variant == "mono":
        paths = re.sub(r'fill="var\([^"]+\)"', 'fill="currentColor"', paths)
    elif variant != "adaptive":
        for name, value in palettes[variant].items():
            paths = re.sub(rf'var\(--{name}, [^)]+\)', value, paths)
    suffix = "" if variant == "adaptive" else f"-{variant}"
    (output / f"mark{suffix}.svg").write_text(svg(paths))
    ink = {"light": "#151619", "dark": "#f4f2ed"}.get(variant, "currentColor")
    lettering = f'<g fill="{ink}">' + "".join(letters) + '</g>'
    (output / f"wordmark{suffix}.svg").write_text(svg(f'<g transform="translate(4 4)">{paths}</g>\n{lettering}', True))

favicon = svg('<style>@media(prefers-color-scheme:dark){:root{--blue:#4485ff;--gold:#ffda66;--coral:#ff9485}}</style>\n' + geometry)
(output / "favicon.svg").write_text(favicon)
public = root / "apps/zloz-demo/public"
public.mkdir(exist_ok=True)
(public / "favicon.svg").write_text(favicon)
(output / "Inter-OFL.txt").write_text((font_dir / "LICENSE").read_text())
