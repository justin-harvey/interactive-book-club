#!/usr/bin/env python3
"""Compose the Jungle "Canopy Energy Network" totem sprites (placeholder art).

One carved stone totem per lesson-two totem (data/aufbau.ts TOTEMS): a tapered
monolith with NW-light step/bevel shading (same lighting model as gen_pyramid.py),
segmented into stacked blocks, mossed on its shaded side, with a round GEM SOCKET
near the top (the spirit's "eye" — the game lights it in the totem's gem colour once
the element is configured) and the element SYMBOL carved into the lower block.

Dormant = cold grey stone (the scene adds the coloured gem glow on solve). These are
PLACEHOLDER art — nicer carved-animal-spirit totems can overwrite the same filenames
with no code change (see ART-NEEDED.md). Emits, per totem:

  * src/assets/jungle/totem-<id>.png     -- the stone totem (origin bottom-centre in-world)
Plus tools/totems_preview.png for a quick visual check.

The gem socket sits at horizontal centre, ~GEM_FRAC down from the sprite top; the
scene positions its glow with the same fraction (JungleScene.GEM_FRAC). Keep in sync.

Run:  python3 tools/gen_totems.py
"""
import os, random
from PIL import Image, ImageDraw, ImageChops, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', 'src', 'assets', 'jungle')
FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# (id, element symbol) — mirrors data/aufbau.ts TOTEMS (order only matters for preview).
TOTEMS = [
    ('carbon', 'C'), ('nitrogen', 'N'), ('oxygen', 'O'), ('neon', 'Ne'),
    ('sodium', 'Na'), ('aluminum', 'Al'), ('sulfur', 'S'),
    ('scandium', 'Sc'), ('iron', 'Fe'),
    # 3p-block fill-ins (appended so the original nine keep their seeds/art):
    ('silicon', 'Si'), ('phosphorus', 'P'), ('chlorine', 'Cl'), ('argon', 'Ar'),
]

W, H = 48, 76                      # native px (scaled up in-game)
CX = W // 2
TOP, BOT = 6, 70                   # pillar extent
TOPW, BOTW = 28, 36               # tapered widths (narrow top, wide base)
GEM_CY = 20                        # gem socket centre y
GEM_R = 6                          # gem socket radius
GEM_FRAC = GEM_CY / H             # printed for the scene to reuse

STONE = (124, 128, 112)           # warm grey-green granite
HILITE = (186, 190, 170)
SHADOW = (66, 70, 58)
OUTLINE = (38, 42, 32, 255)
MOSS = [(78, 128, 64), (104, 150, 78), (60, 104, 52)]


def _xedge(y):
    """Half-width of the tapered pillar at scan-row y (linear taper top->base)."""
    t = (y - TOP) / max(1, (BOT - TOP))
    w = TOPW + (BOTW - TOPW) * t
    return w / 2


def build_totem(symbol, seed):
    random.seed(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    silh = Image.new('L', (W, H), 0)
    sd = ImageDraw.Draw(silh)

    # 1) solid tapered body + silhouette
    for y in range(TOP, BOT):
        hw = _xedge(y)
        d.line((CX - hw, y, CX + hw, y), fill=(*STONE, 255))
        sd.line((CX - hw, y, CX + hw, y), fill=255)

    # 2) NW-light bevel: left/top lit, right/bottom shaded
    for y in range(TOP, BOT):
        hw = _xedge(y)
        d.line((CX - hw, y, CX - hw + 3, y), fill=(*HILITE, 120))          # left highlight
        d.line((CX + hw - 2, y, CX + hw, y), fill=(*SHADOW, 150))          # right shade
    d.line((CX - _xedge(TOP), TOP, CX + _xedge(TOP), TOP), fill=(*HILITE, 160))
    d.rectangle((CX - BOTW // 2, BOT - 3, CX + BOTW // 2, BOT - 1), fill=(*SHADOW, 150))

    # 3) stacked-block grooves (three totem segments)
    for gy in (34, 52):
        hw = int(_xedge(gy))
        d.line((CX - hw + 2, gy, CX + hw - 2, gy), fill=(*SHADOW, 190))
        d.line((CX - hw + 2, gy + 1, CX + hw - 2, gy + 1), fill=(*HILITE, 90))

    # 4) carved "face" panel + gem socket in the top block
    d.rounded_rectangle((CX - 9, GEM_CY - 10, CX + 9, GEM_CY + 10), radius=3,
                        outline=(*SHADOW, 180), width=1)
    # two small carved eye notches flanking the socket
    for ex in (-6, 6):
        d.ellipse((CX + ex - 2, GEM_CY - 6, CX + ex + 1, GEM_CY - 3), fill=(*SHADOW, 220))
    # the gem socket itself (dark + a faint inner rim; the scene lights it)
    d.ellipse((CX - GEM_R, GEM_CY - GEM_R, CX + GEM_R, GEM_CY + GEM_R), fill=(28, 32, 26, 255))
    d.ellipse((CX - GEM_R + 1, GEM_CY - GEM_R + 1, CX + GEM_R, GEM_CY + GEM_R),
              outline=(*HILITE, 70), width=1)

    # 5) carved element symbol in the middle block (engraved: dark + top highlight)
    try:
        fs = 15 if len(symbol) == 1 else 12
        font = ImageFont.truetype(FONT_PATH, fs)
    except Exception:
        font = ImageFont.load_default()
    bb = d.textbbox((0, 0), symbol, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx, ty = CX - tw // 2 - bb[0], 43 - th // 2 - bb[1]
    d.text((tx, ty + 1), symbol, font=font, fill=(*HILITE, 90))            # carved highlight below
    d.text((tx, ty), symbol, font=font, fill=(34, 38, 30, 255))           # engraved face

    # 6) moss on the shaded (right) side + a few top specks
    for _ in range(26):
        y = random.randint(TOP + 2, BOT - 3)
        hw = _xedge(y)
        x = random.randint(int(CX + hw - 7), int(CX + hw - 1))
        if random.random() < 0.6:
            d.point((x, y), fill=(*random.choice(MOSS), 230))
            d.point((x - 1, y), fill=(*random.choice(MOSS), 150))

    # 7) clip to silhouette + base contact shadow
    img.putalpha(ImageChops.multiply(img.getchannel('A'), silh))
    out = Image.new('RGBA', (W, H + 4), (0, 0, 0, 0))
    base = silh.crop((0, H - 6, W, H - 1)).point(lambda a: 90 if a > 0 else 0)
    sh = Image.new('RGBA', (W, 5), (0, 0, 0, 0)); sh.putalpha(base)
    out.alpha_composite(sh, (3, H - 2))
    out.alpha_composite(img, (0, 0))
    return out.crop(out.getbbox())


def _preview(sprites):
    TS = 16
    cols = len(sprites)
    bw = max(s.width for _, s in sprites) + 8
    bh = max(s.height for _, s in sprites) + 14
    bg = Image.new('RGBA', (cols * bw, bh), (24, 40, 26, 255))
    d = ImageDraw.Draw(bg)
    for i, (sid, s) in enumerate(sprites):
        x = i * bw + (bw - s.width) // 2
        bg.alpha_composite(s, (x, bh - s.height - 10))
        d.text((i * bw + 4, 2), sid[:8], fill=(200, 230, 190, 255))
    return bg.resize((bg.width * 4, bg.height * 4), Image.NEAREST)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sprites = []
    for i, (sid, sym) in enumerate(TOTEMS):
        s = build_totem(sym, seed=100 + i)
        s.save(os.path.join(OUT_DIR, f'totem-{sid}.png'))
        sprites.append((sid, s))
    _preview(sprites).save(os.path.join(HERE, 'totems_preview.png'))
    print('wrote %d totems to src/assets/jungle/totem-*.png' % len(sprites))
    print('GEM_FRAC = %.4f  (gem socket y / sprite height, for JungleScene)' % GEM_FRAC)
    print('native size per totem ~ %dx%d px' % (sprites[0][1].width, sprites[0][1].height))


if __name__ == '__main__':
    main()
