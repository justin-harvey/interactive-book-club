#!/usr/bin/env python3
"""Placeholder art for the six flame-test Elementals (desert Lesson Three).

These are stand-ins until real pixel art arrives (see ART-NEEDED.md): a little
flame creature in each element's signature flame-test colour — thematically right
for a flame-test puzzle, and the colour makes them tell-apart-able. Drawn at a
small logical resolution and nearest-neighbour upscaled to 1024px so they match the
other Elementals' art size (the game scales elemental art by ELEMENTAL_ART_SCALE).

Run:  python3 tools/gen_placeholder_elementals.py
Writes src/assets/elementals/{potassium,copper,barium,lithium,strontium,calcium}.png
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'assets', 'elementals')
LOGICAL = 64          # draw small, upscale for chunky pixels
UPSCALE = 16          # -> 1024x1024

# id -> (flame hex, how many spark dots, flame-tip peak y) for a little variety
CREATURES = {
    'potassium': ('b060e0', 3, 4),   # lilac
    'copper':    ('3fae57', 2, 6),   # green
    'barium':    ('7fd651', 1, 8),   # pale green
    'lithium':   ('e23b4e', 2, 5),   # crimson
    'strontium': ('ff4d2e', 3, 3),   # scarlet
    'calcium':   ('ff7a1a', 1, 7),   # orange
}

def hx(h):
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def shade(rgb, f):
    return tuple(max(0, min(255, int(c * f))) for c in rgb)

def draw_creature(hex_color, sparks, peak_y):
    main = hx(hex_color)
    dark = shade(main, 0.55)
    light = shade(main, 1.4)
    img = Image.new('RGBA', (LOGICAL, LOGICAL), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = 32

    # little feet (dark ovals) first, so the body overlaps them
    d.ellipse([24, 52, 30, 58], fill=dark)
    d.ellipse([34, 52, 40, 58], fill=dark)

    # --- dark outline silhouette (belly + flame tip, slightly larger) ---
    d.ellipse([14, 24, 50, 58], fill=dark)
    d.polygon([(cx, peak_y - 2), (47, 30), (cx, 38), (17, 30)], fill=dark)

    # --- main body colour ---
    d.ellipse([16, 26, 48, 56], fill=main)
    d.polygon([(cx, peak_y), (45, 30), (cx, 36), (19, 30)], fill=main)

    # --- inner flame highlight (upper-left light source) ---
    d.ellipse([22, 32, 40, 50], fill=light)
    d.polygon([(cx, peak_y + 8), (40, 31), (cx, 34), (24, 31)], fill=light)

    # --- face: two eyes + pupils + a small mouth ---
    for ex in (26, 38):
        d.ellipse([ex - 4, 37, ex + 4, 45], fill=(255, 255, 255, 255))
        d.ellipse([ex - 2, 40, ex + 1, 44], fill=(30, 20, 40, 255))
        d.point((ex - 2, 39), fill=(255, 255, 255, 255))
    d.arc([28, 45, 36, 51], start=10, end=170, fill=dark, width=1)

    # --- floating spark dots in the flame colour for a bit of individuality ---
    spark_spots = [(12, 20), (52, 22), (10, 36), (54, 38), (32, 2)]
    for i in range(sparks):
        sx, sy = spark_spots[i]
        d.ellipse([sx - 1, sy - 1, sx + 2, sy + 2], fill=light)

    return img.resize((LOGICAL * UPSCALE, LOGICAL * UPSCALE), Image.NEAREST)

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (hexc, sparks, peak) in CREATURES.items():
        out = os.path.join(OUT, f'{name}.png')
        draw_creature(hexc, sparks, peak).save(out)
        print('wrote', os.path.relpath(out))

if __name__ == '__main__':
    main()
