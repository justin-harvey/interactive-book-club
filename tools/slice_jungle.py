#!/usr/bin/env python3
"""Slice the Lost Valleys jungle pack into game-ready art.

The pack ships ground as separate 7x7 autotile sheets (grass/dirt/stone) plus an
animated water sheet, and props as multi-sprite object PNGs. Unlike the desert
pack (one pre-composed scene sheet) there's no single ground tileset, so we
COMPOSE one: `src/assets/tiles/jungle_tileset.png`, a small fixed grid holding
just the fill tiles gen_jungle.py stamps (grass + baked grass variants, dirt,
stone, deep water). Props (trees, ferns, rocks, moss decals) are cut to tight
bounding boxes via connected-component analysis and saved to src/assets/jungle/
for DesertScene-style sprite placement.

Run:  python3 tools/slice_jungle.py
"""
import os
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.join(HERE, '..', 'sprites', 'jungle', 'Lost_Valleys_Main_Free')
TILES_OUT = os.path.join(HERE, '..', 'src', 'assets', 'tiles', 'jungle_tileset.png')
PROPS_OUT = os.path.join(HERE, '..', 'src', 'assets', 'jungle')
TS = 16

def load(rel):
    return Image.open(os.path.join(PACK, rel)).convert('RGBA')

def cell(im, c, r):
    return im.crop((c * TS, r * TS, c * TS + TS, r * TS + TS))

def flatten(tile, amount):
    """Blend every pixel toward the tile's mean colour by `amount` (0..1), muting
    internal detail. Used to calm the desert cracked-dirt so it reads as plainer
    earth in the jungle (amount 0.75 = cracks ~75% less busy)."""
    px = tile.load(); W, H = tile.size
    rs = gs = bs = n = 0
    for y in range(H):
        for x in range(W):
            R, G, B, A = px[x, y]
            if A > 8: rs += R; gs += G; bs += B; n += 1
    if n == 0: return tile
    mr, mg, mb = rs // n, gs // n, bs // n
    out = tile.copy(); opx = out.load()
    for y in range(H):
        for x in range(W):
            R, G, B, A = px[x, y]
            opx[x, y] = (int(R + (mr - R) * amount), int(G + (mg - G) * amount),
                         int(B + (mb - B) * amount), A)
    return out

def tint(tile, mr, mg, mb):
    """Multiply a tile's RGB (keep alpha) -> recolour. The pack's grass is a
    bright lime meadow; we deepen it toward a rainforest green."""
    out = tile.copy(); px = out.load()
    W, H = out.size
    for y in range(H):
        for x in range(W):
            R, G, B, A = px[x, y]
            px[x, y] = (min(255, int(R * mr)), min(255, int(G * mg)), min(255, int(B * mb)), A)
    return out

# --- compose the ground sheet --------------------------------------------------
grass = load('Tilesets/Standart_Tilesets/Grass_Tileset_Standart_1.png')
stone = load('Tilesets/Standart_Tilesets/StoneGround_Tileset_Standart_1.png')

# Dirt + water are borrowed from the DESERT tileset so the biomes feel of a piece
# (the desert's cracked earth + teal oasis water read better here than the pack's
# own pinkish clay / flat water). desert_tileset.png is 14 cols @16px.
DESERT = Image.open(os.path.join(HERE, '..', 'src', 'assets', 'tiles', 'desert_tileset.png')).convert('RGBA')
def dcell(c, r): return DESERT.crop((c * TS, r * TS, c * TS + TS, r * TS + TS))

# Grass: deepen the lime meadow to a rainforest green, then make two subtle
# brightness variants of that fill for patchy texture (no edge detail = no seams).
grass_fill = tint(cell(grass, 0, 3), 0.60, 0.74, 0.50)   # r3c0: only opaque grass
grass_v1 = tint(grass_fill, 0.88, 0.90, 0.86)            # a touch darker
grass_v2 = tint(grass_fill, 1.10, 1.07, 1.05)            # a touch lighter
dirt_fill = flatten(dcell(1, 6), 0.75)  # desert cracked-dirt, cracks muted 75%
dirt_v    = flatten(dcell(2, 7), 0.75)
stone_fill = cell(stone, 1, 1)          # solid stone centre (unused by the map now)
water_fill = dcell(4, 2)                # desert oasis deep water
water_v    = dcell(5, 1)

COMPOSED = [grass_fill, grass_v1, grass_v2, dirt_fill, dirt_v, stone_fill, water_fill, water_v]
sheet = Image.new('RGBA', (len(COMPOSED) * TS, TS), (0, 0, 0, 0))
for i, t in enumerate(COMPOSED):
    sheet.paste(t, (i * TS, 0))
sheet.save(TILES_OUT)
print('wrote', os.path.relpath(TILES_OUT), f'({len(COMPOSED)}x1 @ {TS})')

# --- connected-component slicer for prop sheets --------------------------------
def components(im, athresh=16, minpx=40):
    W, H = im.size; px = im.load()
    seen = bytearray(W * H)
    boxes = []
    for y0 in range(H):
        for x0 in range(W):
            if seen[y0 * W + x0] or px[x0, y0][3] <= athresh:
                seen[y0 * W + x0] = 1; continue
            q = deque([(x0, y0)]); seen[y0 * W + x0] = 1
            minx = maxx = x0; miny = maxy = y0; cnt = 0
            while q:
                x, y = q.popleft(); cnt += 1
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and px[nx, ny][3] > athresh:
                        seen[ny * W + nx] = 1; q.append((nx, ny))
            if cnt >= minpx:
                boxes.append((minx, miny, maxx + 1, maxy + 1, cnt))
    return boxes

def save_crops(im, boxes, prefix, order):
    """Save each bbox as prefix-N.png (tight-trimmed). `order` maps output index
    -> source bbox index, letting us rename by appearance (e.g. greenest tree)."""
    for out_i, src_i in enumerate(order, 1):
        b = boxes[src_i]
        crop = im.crop((b[0], b[1], b[2], b[3]))
        path = os.path.join(PROPS_OUT, f'{prefix}-{out_i}.png')
        crop.save(path)
    return len(order)

os.makedirs(PROPS_OUT, exist_ok=True)

# Trees: 4 in a 2x2 grid. CC order is top-left, top-right, bottom-left, bottom-right.
# Reorder so greens come first (scene biases toward them for a lush jungle):
#   TL=orange TR=green BL=red BR=yellow-green  ->  green, yellow-green, orange, red
trees = load('Objects/Plants/Tree_1.png')
tb = components(trees, minpx=200)
tb.sort(key=lambda b: (b[1] // 32, b[0]))     # row-major: TL,TR,BL,BR
save_crops(trees, tb, 'tree', [1, 3, 0, 2])
print(f'  trees: {len(tb)} found -> tree-1..4 (green-first)')

# Ferns / small plants: keep all, left-to-right top-to-bottom.
plants = load('Objects/Plants/Plants_1.png')
pb = components(plants, minpx=50)
pb.sort(key=lambda b: (b[1] // 12, b[0]))
save_crops(plants, pb, 'fern', list(range(len(pb))))
print(f'  ferns: {len(pb)} -> fern-1..{len(pb)}')

# Rocks: the two top rows are full rocks (~14px); the lower speckles are pebbles.
# Take the top-row rocks (y < 16) with real mass; keep up to 8 distinct.
rocks = load('Objects/Stone/Rock_1.png')
rb = [b for b in components(rocks, minpx=100) if b[1] < 16]
rb.sort(key=lambda b: b[0])
rb = rb[:8]
save_crops(rocks, rb, 'rock', list(range(len(rb))))
print(f'  rocks: {len(rb)} -> rock-1..{len(rb)}')

# Moss / grass-decor decals: the big clusters (px > 1500) only.
moss = load('Objects/Tileset_Top_Decor/Grass_Decor/Decor_Grass_1.png')
mb = [b for b in components(moss, minpx=300) if b[4] > 1500]
mb.sort(key=lambda b: (b[1] // 40, b[0]))
save_crops(moss, mb, 'moss', list(range(len(mb))))
print(f'  moss decals: {len(mb)} -> moss-1..{len(mb)}')

# Fauna: copy the teal-slime spritesheet into game assets (dist copies src/assets
# only, not sprites/). JungleScene loads it as an animated 4x4 sheet of 36x28 cells.
load('Characters/Enemy/Slime_1-Sheet.png').save(os.path.join(PROPS_OUT, 'slime-sheet.png'))
print('  fauna sheet: slime-sheet')
