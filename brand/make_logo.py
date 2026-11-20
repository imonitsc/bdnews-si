"""Builds the BD Situation Intelligence logo set as outlined SVGs (Inter Display, OFL)."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FONTS = '/usr/share/fonts/opentype/inter/'
AMBER = '#FFA31A'


class Face:
    def __init__(self, file):
        self.f = TTFont(FONTS + file)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f['head'].unitsPerEm
        self.cap = self.f['OS/2'].sCapHeight

    def text(self, s, size, x, baseline, tracking=0.0):
        """Return (svg path d, advance width) for s, size in px, tracking in em."""
        scale = size / self.upm
        pen = SVGPathPen(self.gs)
        cx = x
        for ch in s:
            g = self.cmap[ord(ch)]
            tp = TransformPen(pen, (scale, 0, 0, -scale, cx, baseline))
            self.gs[g].draw(tp)
            cx += self.gs[g].width * scale + tracking * size
        width = cx - x - tracking * size
        return pen.getCommands(), width

    def cap_px(self, size):
        return self.cap * size / self.upm


black = Face('InterDisplay-Black.otf')
medium = Face('InterDisplay-Medium.otf')


def lockup(fg, bg=None, name='logo'):
    """Horizontal lockup: BD + amber cursor block + 'Situation Intelligence'."""
    size_bd = 100
    cap = black.cap_px(size_bd)
    pad = 24
    base = pad + cap
    bd_d, bd_w = black.text('BD', size_bd, pad, base, tracking=-0.02)
    # Terminal cursor block: same height as the caps, sits right after BD.
    gap = 8
    blk_w = cap * 0.24
    blk_x = pad + bd_w + gap
    # Words: medium weight, cap height aligned to the bottom half, one line.
    size_w = 46
    cap_w = medium.cap_px(size_w)
    words_x = blk_x + blk_w + 26
    w_d, w_w = medium.text('Situation Intelligence', size_w, words_x, base, tracking=-0.01)
    W = round(words_x + w_w + pad)
    H = round(base + pad)
    rect = f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else ''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="BD Situation Intelligence">
<title>BD Situation Intelligence</title>{rect}
<path fill="{fg}" d="{bd_d}"/>
<rect x="{blk_x:.1f}" y="{base - blk_w:.1f}" width="{blk_w:.1f}" height="{blk_w:.1f}" fill="{AMBER}"/>
<path fill="{fg}" d="{w_d}"/>
</svg>'''
    open(f'{OUT}/{name}.svg', 'w').write(svg)
    return W, H


def stacked(fg, bg=None, name='logo-stacked'):
    """Stacked lockup: BD + cursor on top, words below."""
    size_bd = 140
    cap = black.cap_px(size_bd)
    pad = 32
    base = pad + cap
    bd_d, bd_w = black.text('BD', size_bd, pad, base, tracking=-0.02)
    blk_w = cap * 0.24
    blk_x = pad + bd_w + 10
    size_w = 34
    base2 = base + 30 + medium.cap_px(size_w)
    l1, w1 = medium.text('Situation', size_w, pad + 4, base2, tracking=0.0)
    base3 = base2 + medium.cap_px(size_w) + 16
    l2, w2 = medium.text('Intelligence', size_w, pad + 4, base3, tracking=0.0)
    W = round(max(blk_x + blk_w, pad + 4 + max(w1, w2)) + pad)
    H = round(base3 + pad)
    rect = f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else ''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="BD Situation Intelligence">
<title>BD Situation Intelligence</title>{rect}
<path fill="{fg}" d="{bd_d}"/>
<rect x="{blk_x:.1f}" y="{base - blk_w:.1f}" width="{blk_w:.1f}" height="{blk_w:.1f}" fill="{AMBER}"/>
<path fill="{fg}" d="{l1}"/>
<path fill="{fg}" d="{l2}"/>
</svg>'''
    open(f'{OUT}/{name}.svg', 'w').write(svg)


def icon(name='icon'):
    """Square app icon / favicon: black tile, white BD, amber cursor block."""
    S = 512
    size = 230
    cap = black.cap_px(size)
    d, w = black.text('BD', size, 0, 0, tracking=-0.02)
    blk_w = cap * 0.24
    gap = 12
    total = w + gap + blk_w
    x0 = (S - total) / 2
    base = (S + cap) / 2
    d, w = black.text('BD', size, x0, base, tracking=-0.02)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}" role="img" aria-label="BD Situation Intelligence">
<title>BD Situation Intelligence</title>
<rect width="{S}" height="{S}" fill="#000"/>
<path fill="#fff" d="{d}"/>
<rect x="{x0 + w + gap:.1f}" y="{base - blk_w:.1f}" width="{blk_w:.1f}" height="{blk_w:.1f}" fill="{AMBER}"/>
</svg>'''
    open(f'{OUT}/{name}.svg', 'w').write(svg)


print(lockup('#000', name='logo-black'))
lockup('#fff', name='logo-white')
stacked('#000', name='logo-stacked-black')
stacked('#fff', name='logo-stacked-white')
icon()


def mark(name='mark'):
    """'BD.' mark only, transparent, text in currentColor."""
    size = 100
    cap = black.cap_px(size)
    d, w = black.text('BD', size, 0, cap, tracking=-0.02)
    blk_w = cap * 0.24
    W = w + 8 + blk_w
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {cap:.1f}" role="img" aria-label="BD Situation Intelligence"><path fill="currentColor" d="{d}"/><rect x="{w + 8:.1f}" y="{cap - blk_w:.1f}" width="{blk_w:.1f}" height="{blk_w:.1f}" fill="{AMBER}"/></svg>'''
    open(f'{OUT}/{name}.svg', 'w').write(svg)


def header(name='header-logo'):
    """Horizontal lockup, tightly cropped, text in currentColor for the site header."""
    size_bd = 100
    cap = black.cap_px(size_bd)
    bd_d, bd_w = black.text('BD', size_bd, 0, cap, tracking=-0.02)
    blk_w = cap * 0.24
    blk_x = bd_w + 8
    words_x = blk_x + blk_w + 26
    w_d, w_w = medium.text('Situation Intelligence', 46, words_x, cap, tracking=-0.01)
    W = words_x + w_w
    # Descender of 'g' drops below the baseline; leave room for it.
    H = cap + 46 * 0.22
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" role="img" aria-label="BD Situation Intelligence"><path fill="currentColor" d="{bd_d}"/><rect x="{blk_x:.1f}" y="{cap - blk_w:.1f}" width="{blk_w:.1f}" height="{blk_w:.1f}" fill="{AMBER}"/><path fill="currentColor" d="{w_d}"/></svg>'''
    open(f'{OUT}/{name}.svg', 'w').write(svg)


def og(name='og-image'):
    """1200x630 link preview: black, white lockup centred, amber rule."""
    W, H = 1200, 630
    size_bd = 200
    cap = black.cap_px(size_bd)
    bd_d, bd_w = black.text('BD', size_bd, 0, 0, tracking=-0.02)
    blk_w = cap * 0.24
    size_w = 64
    _, w_w = medium.text('Situation Intelligence', size_w, 0, 0)
    total_h = cap + 60 + medium.cap_px(size_w)
    top = (H - total_h) / 2
    base = top + cap
    x_bd = (W - (bd_w + 14 + blk_w)) / 2
    bd_d, _ = black.text('BD', size_bd, x_bd, base, tracking=-0.02)
    base2 = base + 60 + medium.cap_px(size_w)
    w_d, _ = medium.text('Situation Intelligence', size_w, (W - w_w) / 2, base2)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#000"/><rect x="0" y="{H-10}" width="{W}" height="10" fill="{AMBER}"/><path fill="#fff" d="{bd_d}"/><rect x="{x_bd + bd_w + 14:.1f}" y="{base - blk_w:.1f}" width="{blk_w:.1f}" height="{blk_w:.1f}" fill="{AMBER}"/><path fill="#fff" d="{w_d}"/></svg>'''
    open(f'{OUT}/{name}.svg', 'w').write(svg)


mark()
header()
og()
