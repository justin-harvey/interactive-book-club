#!/usr/bin/env python3
"""Extract the canonical shared WATER texture used across every zone.

Texture-consistency initiative: water should read identically in every level.
The jungle water is the canonical look — cells 6 & 7 of the composed
`src/assets/tiles/jungle_tileset.png` (which slice_jungle.py borrows from the
desert oasis, `desert_tileset.png`). This tool lifts those exact pixels into a
standalone, power-of-two `src/assets/tiles/water.png` (32x32 = a 2x2 of the two
water cells) so a Phaser TileSprite can tile it cleanly (POT => GL REPEAT, no
bleed) wherever a drawn body of water is needed — today the Town lake
(TestScene.drawLake), extensible to the desert oasis / other zones later.

Re-run after slice_jungle.py; idempotent.

    python3 tools/slice_water.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, '..', 'src', 'assets', 'tiles')
TS = 16

jungle = Image.open(os.path.join(TILES, 'jungle_tileset.png')).convert('RGBA')

def cell(i):
    return jungle.crop((i * TS, 0, i * TS + TS, TS))

# Cells 6 & 7 are the two water variants (see slice_jungle.COMPOSED). Lay them in
# a 2x2 so the tiled result doesn't read as a dead-flat grid; both are seamless
# fills, so any arrangement tiles.
a, b = cell(6), cell(7)
out = Image.new('RGBA', (TS * 2, TS * 2), (0, 0, 0, 0))
out.paste(a, (0, 0)); out.paste(b, (TS, 0))
out.paste(b, (0, TS)); out.paste(a, (TS, TS))

dst = os.path.join(TILES, 'water.png')
out.save(dst)
print('wrote', os.path.relpath(dst), f'({out.width}x{out.height})')
