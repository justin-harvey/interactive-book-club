#!/usr/bin/env python3
"""Compose the Desert pyramid monument sprite(s) from the existing desert tileset.

No new art needed: the pyramid is a stepped ziggurat built from the GrayCatGames
PixelWorlds Desert sand tiles (the same tiles gen_desert.py uses), stacked as
concentric tiers and given crisp STEP SHADING in code — NW light, so each step's
top/left reads as a lit tread and its bottom/right as a shadowed riser, with a thin
outline. That reads cleaner than stamping the tileset's organic mesa-rim pieces.
On top we carve an apex aperture (for the Solar Prism sunbeam) and a front doorway
(the way into PyramidScene). Two states are emitted for the desert "pyramid rise":

  * src/assets/desert/pyramid.png         -- full risen monument (the hero sprite)
  * src/assets/desert/pyramid-buried.png  -- just the apex poking from cracked sand
                                             (the subtle pre-rise marker in the desert)
Plus tools/pyramid_preview.png for a quick visual check (like jungle_preview.png).

Placed in-world like any scenery sprite (origin bottom-centre, width set in tiles) —
wire into DesertScene / PyramidScene in Phase 1. Stepped look is intentional and
tile-native; a smoother hand-drawn pyramid can replace these PNGs later with no code
change (same filenames). See DESERT-LESSON3-PLAN.md.

Run:  python3 tools/gen_pyramid.py
"""
import os, random
from PIL import Image, ImageDraw, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'src', 'assets', 'tiles', 'desert_tileset.png')
OUT_DIR = os.path.join(HERE, '..', 'src', 'assets', 'desert')
TS = 16
random.seed(11)

_sheet = Image.open(SHEET).convert('RGBA')
def tile(c, r):
    return _sheet.crop((c * TS, r * TS, c * TS + TS, r * TS + TS))

# Confirmed sand tiles (from gen_desert's BASE_SAND/SAND_VARS gids) and cracked
# earth (the dirt-pit block, cols 0-3 rows 5-8) for the buried-state disturbed ring.
SAND = [tile(9, 1), tile(11, 1), tile(12, 1), tile(11, 2), tile(12, 2), tile(9, 3), tile(10, 3)]
DIRT = [tile(0, 6), tile(1, 7), tile(2, 6), tile(3, 7), tile(1, 5), tile(2, 8)]

# --- stepped-pyramid geometry (in tiles): (width, height, bottom_row), centered ---
# Five concentric tiers shrinking to a 4-wide apex. Tuned so each tier shows ~a step.
TIERS = [(22, 5, 18), (18, 5, 15), (14, 5, 12), (10, 5, 9), (6, 5, 6)]
CANVAS_W = TIERS[0][0] + 4          # a little margin
CANVAS_H = TIERS[0][2] + 2
CENTER = CANVAS_W // 2

RISER = 10                           # px depth of the shadowed step riser
OUTLINE = (46, 28, 14, 255)
SHADOW = (38, 22, 10)
HILITE = (255, 247, 216)
TONE = (120, 78, 38)                 # warm sandstone wash so the pyramid != ground sand


def _overlay(canvas, box, color, alpha):
    ov = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle(box, fill=(*color, alpha))
    canvas.alpha_composite(ov)


def _tier_box(w, h, bottom):
    x0 = (CENTER - w // 2) * TS
    x1 = (CENTER - w // 2 + w) * TS - 1
    y1 = bottom * TS - 1
    y0 = (bottom - h) * TS
    return x0, y0, x1, y1


def build_pyramid(tiers, carve=True):
    """Return (sprite, meta) where meta has apex/door pixel rects for wiring."""
    W, H = CANVAS_W * TS, CANVAS_H * TS
    mon = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    silh = Image.new('L', (W, H), 0)
    sdraw = ImageDraw.Draw(silh)

    # 1) stamp sand for every tier (big -> small), tile-aligned
    for w, h, bottom in tiers:
        x0 = CENTER - w // 2
        for ty in range(bottom - h, bottom):
            for tx in range(x0, x0 + w):
                mon.alpha_composite(random.choice(SAND), (tx * TS, ty * TS))
        bx = _tier_box(w, h, bottom)
        sdraw.rectangle(bx, fill=255)

    # 1b) warm sandstone wash over the whole silhouette so it reads darker/warmer
    # than the bright ground sand (the proto read as solid for exactly this reason).
    _overlay(mon, (0, 0, W, H), TONE, 70)

    # 2) crisp step shading per tier (small drawn last so risers land on lower tread)
    d = ImageDraw.Draw(mon)
    for w, h, bottom in tiers:
        x0, y0, x1, y1 = _tier_box(w, h, bottom)
        _overlay(mon, (x0, y1 - RISER, x1, y1), SHADOW, 165)       # bottom riser (strong)
        _overlay(mon, (x1 - RISER, y0, x1, y1), SHADOW, 120)       # right riser
        _overlay(mon, (x0, y0, x1, y0 + 3), HILITE, 85)            # top tread highlight
        _overlay(mon, (x0, y0, x0 + 3, y1), HILITE, 48)            # left highlight
        d.rectangle((x0, y0, x1, y1), outline=OUTLINE, width=2)

    meta = {}
    if carve:
        # apex aperture on the top tier's tread (sunbeam opening)
        tw, th, tb = tiers[-1]
        ax0, ay0, ax1, ay1 = _tier_box(tw, th, tb)
        aw = int(TS * 1.7)
        acx = (ax0 + ax1) // 2
        apex = (acx - aw // 2, ay0 + 6, acx + aw // 2, ay0 + 6 + int(TS * 1.3))
        _overlay(mon, apex, (18, 14, 22), 255)
        d.rectangle(apex, outline=(52, 34, 20, 255), width=1)
        _overlay(mon, (apex[0], apex[1], apex[2], apex[1] + 3), (150, 205, 225), 150)  # sky/beam glint
        meta['apex'] = apex

        # front doorway at the base tier, centred
        bw, bh, bb = tiers[0]
        bx0, by0, bx1, by1 = _tier_box(bw, bh, bb)
        dw = int(TS * 1.9)
        dh = int(TS * 2.4)
        dcx = (bx0 + bx1) // 2
        door = (dcx - dw // 2, by1 - dh, dcx + dw // 2, by1 - 2)
        _overlay(mon, (door[0] - 3, door[1] - 4, door[2] + 3, door[1]), (60, 40, 22), 255)  # lintel
        ov = Image.new('RGBA', mon.size, (0, 0, 0, 0))
        og = ImageDraw.Draw(ov)
        for i in range(door[1], door[3]):                           # deepening gradient
            t = (i - door[1]) / max(1, (door[3] - door[1]))
            og.line((door[0], i, door[2], i), fill=(16, 11, 10, int(170 + 70 * t)))
        mon.alpha_composite(ov)
        d.rectangle(door, outline=(44, 28, 16, 255), width=1)
        # a couple of lit threshold steps leading up to the door
        for k in range(2):
            sy = by1 - 2 + k * 3
            _overlay(mon, (dcx - dw // 2 - 2 - k * 3, sy, dcx + dw // 2 + 2 + k * 3, sy + 3), HILITE, 40)
        meta['door'] = door

    # 3) clip anything that bled outside the silhouette
    mon.putalpha(ImageChops.multiply(mon.getchannel('A'), silh))

    # subtle contact shadow hugging the base, offset SE, so it isn't floating
    full = Image.new('RGBA', (W, H + 6), (0, 0, 0, 0))
    sh = Image.new('RGBA', (W, H + 6), (0, 0, 0, 0))
    base = silh.crop((0, H - TS, W, H)).point(lambda a: 110 if a > 0 else 0)
    shimg = Image.new('RGBA', (W, TS), (0, 0, 0, 0))
    shimg.putalpha(base)
    full.alpha_composite(shimg, (5, H - TS + 8))
    full.alpha_composite(mon, (0, 0))
    bbox = full.getbbox()
    return full.crop(bbox), meta


def build_buried(tiers):
    """Apex poking from a ring of cracked/disturbed earth — the pre-rise marker."""
    # keep only the top two tiers, re-based near the bottom of a small canvas
    top = tiers[-2:]
    shift = top[0][2] - top[-1][2]  # unused; keep apex geometry as-is
    sprite, _ = build_pyramid(top, carve=True)
    # disturbed-earth ellipse behind/around the apex base
    W = sprite.width + 10 * TS
    H = sprite.height + 3 * TS
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ring = Image.new('L', (W, H), 0)
    rd = ImageDraw.Draw(ring)
    cx, cy = W // 2, H - int(2.2 * TS)
    rx, ry = int(4.5 * TS), int(1.8 * TS)
    rd.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    dirt = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for ty in range(0, H // TS):
        for tx in range(0, W // TS):
            dirt.alpha_composite(random.choice(DIRT), (tx * TS, ty * TS))
    dirt.putalpha(ImageChops.multiply(dirt.getchannel('A'), ring))
    canvas.alpha_composite(dirt)
    canvas.alpha_composite(sprite, ((W - sprite.width) // 2, H - sprite.height - int(1.2 * TS)))
    return canvas.crop(canvas.getbbox())


def _preview(risen, buried):
    pad = 3
    W = (risen.width + buried.width) // TS + 8
    H = max(risen.height, buried.height) // TS + 5
    bg = Image.new('RGBA', (W * TS, H * TS), (0, 0, 0, 0))
    for ty in range(H):
        for tx in range(W):
            bg.alpha_composite(random.choice(SAND), (tx * TS, ty * TS))
    bg.alpha_composite(risen, (2 * TS, (H * TS - risen.height) - 2 * TS))
    bg.alpha_composite(buried, (risen.width + 4 * TS, (H * TS - buried.height) - 2 * TS))
    d = ImageDraw.Draw(bg)
    d.rectangle((1 * TS, (H - 2) * TS, 2 * TS - 1, (H - 1) * TS - 1), outline=(220, 40, 40, 255), width=1)
    d.text((1 * TS, (H - 2) * TS - 9), "~dog", fill=(220, 40, 40, 255))
    d.text((2 * TS, TS), "RISEN", fill=(40, 30, 20, 255))
    d.text((risen.width + 4 * TS, TS), "BURIED (pre-rise)", fill=(40, 30, 20, 255))
    Z = 4
    return bg.resize((bg.width * Z, bg.height * Z), Image.NEAREST)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    risen, meta = build_pyramid(TIERS, carve=True)
    buried = build_buried(TIERS)
    risen.save(os.path.join(OUT_DIR, 'pyramid.png'))
    buried.save(os.path.join(OUT_DIR, 'pyramid-buried.png'))
    _preview(risen, buried).save(os.path.join(HERE, 'pyramid_preview.png'))
    print('risen   %dx%d  (~%.0fx%.0f tiles)' % (risen.width, risen.height, risen.width / TS, risen.height / TS))
    print('buried  %dx%d' % (buried.width, buried.height))
    print('apex/door px rects:', meta)
    print('wrote src/assets/desert/pyramid.png + pyramid-buried.png + tools/pyramid_preview.png')


if __name__ == '__main__':
    main()
