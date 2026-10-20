#!/usr/bin/env python3
"""Generate the outdoor Town tilemap (test_map.json) from the modern_exterior sheet.

The town is themed on **Gray, Maine (04039)**: five enterable storefronts
(HOME, HARDWARE, HANNAFORD, LIBRARY, AUTO) plus a decorative **lake**. Buildings
are copied wholesale as rectangular GID blocks from a small set of reused facade
models (same tileset, so gid = row*COLS + col + 1). Collision (ge_collide) is
added per-GID to every building/tree/water tile except the door columns, which
stay walkable so the Door objects placed in TestScene can trigger a scene switch.

The signs/doors/Elemental spawns live on the TypeScript side (TestScene.ts) —
keep the constants there in sync with the PLACEMENTS / LAKE below. This script
prints the door tiles it computed to make that easy.

Run:  python3 tools/gen_town.py   (writes src/assets/tilemap/test_map.json)
"""
import json, os
from PIL import Image

# Every venue maps to a building image (cropped tight to its content). WIDTH_TILES
# is the building's on-screen width in tiles; the collision block is bottom-anchored
# to the door row, centred on the door, and only as tall as the scaled art (no
# invisible wall of grass above short storefronts). The wide storefronts are sized
# up so they don't look small beside the (square) hardware store — keep in sync
# with TestScene's BUILDINGS `widthTiles`.
ART_FILE = {'hardware': 'hardware', 'hannaford': 'grocery', 'library': 'library',
            'home': 'home', 'auto': 'auto'}
WIDTH_TILES = {'hardware': 6.3, 'hannaford': 9.8, 'library': 8.6,
               'home': 9.8, 'auto': 9.8}
_HERE = os.path.dirname(os.path.abspath(__file__))

def art_aspect(name):
    im = Image.open(os.path.join(_HERE, '..', 'src', 'assets', 'buildings',
                                 ART_FILE[name] + '.png'))
    return im.height / im.width   # tall/wide ratio (cropped = true content)

SHEET_COLS = 141                      # modern_exterior.png is 141 tiles wide
def gid(col, row): return row * SHEET_COLS + col + 1

W, H = 40, 24                         # town size in tiles (was 28x16 — ~2.1x area)
GRASS = gid(8, 2)                     # solid grass
PATH  = gid(17, 1)                    # grey cobblestone
# A GID reused only for the lake's collision cells. Its art is hidden under the
# blue "LAKE" graphic drawn in TestScene, so the exact tile doesn't matter — it
# just has to be a GID used nowhere else (collision is per-GID and global).
WATER = gid(0, 50)

# Second tileset: blank16.png (a 2-tile transparent strip; tile 1 collides).
# Buildings that now use real overlay art (drawn in TestScene) stamp this
# invisible-but-solid tile instead of facade art, so the old modern_exterior
# facades don't peek out from behind the new images. AUTO has no art yet, so it
# keeps its tiled facade.
BLANK_FIRST = SHEET_COLS * 118 + 1        # firstgid after modern_exterior (141x118)
BLANK_SOLID = BLANK_FIRST + 1             # blank16 tile id 1 = transparent + ge_collide
NEW_ART = {'hardware', 'hannaford', 'library', 'home', 'auto'}

# --- reused facade models copied from the sheet: (sheet_col0, row0, w, h, door_local_col)
FACADES = {
    'red':   dict(sc=41, sr=88, w=8, h=8, door=5),   # red MARKET facade
    'blue':  dict(sc=58, sr=88, w=7, h=8, door=3),   # blue MARKET facade
    'brown': dict(sc=72, sr=88, w=8, h=8, door=4),   # brown MARKET facade
}
# Each Gray, Maine venue: (key, facade, town_col, town_row). Facades are reused
# across venues (the sign plaques in TestScene tell them apart).
PLACEMENTS = [
    ('hardware',  'red',   1,  1),
    ('hannaford', 'red',   11, 1),
    ('library',   'blue',  21, 1),
    ('home',      'brown', 30, 1),
    ('auto',      'brown', 1,  13),
]
# tree model: 2 wide x 3 tall, trunk on bottom row
TREE = dict(sc=16, sr=3, w=2, h=3)
# (col 9 is kept clear for the north trail out of town, so the old (9,11) tree
# moved west to (2,12).)
TREE_SPOTS = [(2, 12), (19, 11), (38, 3), (12, 21), (19, 21)]
# lake: a rectangular pond in the lower-right, drawn blue in TestScene
LAKE = dict(x=24, y=15, w=14, h=7)

floor = [GRASS] * (W * H)
walls = [0] * (W * H)
collide = set()          # gids that should block the player

def put(layer, tx, ty, g):
    if 0 <= tx < W and 0 <= ty < H:
        layer[ty * W + tx] = g

# Each venue's door sits at the horizontal centre of its footprint (the building
# art has a central door), so entry lines up with the picture.
def door_col_of(ox, w): return ox + w // 2

# ground: grass everywhere, then cobblestone stubs below each door + a plaza.
for (name, facade, ox, oy) in PLACEMENTS:
    b = FACADES[facade]
    door_col = door_col_of(ox, b['w'])
    door_row = oy + b['h'] - 1
    for ry in range(door_row + 1, door_row + 3):   # short path stub below each door
        put(floor, door_col, ry, PATH)
for tx in range(2, 38):               # horizontal walkway across the plaza
    put(floor, tx, 11, PATH)
for ry in range(11, 21):              # vertical path linking the AUTO shop to the plaza
    put(floor, 5, ry, PATH)
for ry in range(1, 11):               # north trail: up the hardware/grocery gap to the woods
    put(floor, 9, ry, PATH)

# buildings: stamp an invisible solid block sized to the (scaled) art and
# bottom-anchored to the door row — no invisible grass above short storefronts —
# centred on the door column so it lines up with the overlay image. The door
# column stays walkable so the Door object can trigger the switch.
for (name, facade, ox, oy) in PLACEMENTS:
    b = FACADES[facade]
    door_col = door_col_of(ox, b['w'])
    door_row = oy + b['h'] - 1
    wt = WIDTH_TILES[name]
    coll_w = max(1, round(wt))
    coll_h = max(1, round(wt * art_aspect(name)))
    left = door_col - coll_w // 2
    top_row = door_row - coll_h + 1
    for ty in range(top_row, door_row + 1):
        for tx in range(left, left + coll_w):
            if tx == door_col:        # door column stays walkable
                continue
            put(walls, tx, ty, BLANK_SOLID)

# trees: decorative; only the trunk row (bottom) blocks
for (ox, oy) in TREE_SPOTS:
    for dy in range(TREE['h']):
        for dx in range(TREE['w']):
            g = gid(TREE['sc'] + dx, TREE['sr'] + dy)
            put(walls, ox + dx, oy + dy, g)
            if dy == TREE['h'] - 1:
                collide.add(g)

# lake: every water cell blocks. Art is hidden by TestScene's blue "LAKE" graphic.
for ly in range(LAKE['y'], LAKE['y'] + LAKE['h']):
    for lx in range(LAKE['x'], LAKE['x'] + LAKE['w']):
        put(walls, lx, ly, WATER)
collide.add(WATER)

tileset_tiles = [
    {"id": g - 1, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}
    for g in sorted(collide)
]

def tilelayer(name, data, lid):
    return {"data": data, "height": H, "id": lid, "name": name, "opacity": 1,
            "type": "tilelayer", "visible": True, "width": W, "x": 0, "y": 0}

tilemap = {
    "compressionlevel": -1, "infinite": False, "orientation": "orthogonal",
    "renderorder": "right-down", "tiledversion": "1.9.0", "type": "map",
    "version": "1.9", "width": W, "height": H, "tilewidth": 16, "tileheight": 16,
    "nextlayerid": 4, "nextobjectid": 1,
    "layers": [tilelayer("floor", floor, 1), tilelayer("walls", walls, 2)],
    "tilesets": [{
        "columns": SHEET_COLS, "firstgid": 1,
        "image": "../assets/tiles/modern_exterior.png",
        "imagewidth": 2256, "imageheight": 1888,
        "margin": 0, "spacing": 0, "name": "modern_exterior",
        "tilecount": 141 * 118, "tilewidth": 16, "tileheight": 16,
        "tiles": tileset_tiles,
    }, {
        "columns": 2, "firstgid": BLANK_FIRST,
        "image": "../assets/tiles/blank16.png",
        "imagewidth": 32, "imageheight": 16,
        "margin": 0, "spacing": 0, "name": "blank16",
        "tilecount": 2, "tilewidth": 16, "tileheight": 16,
        "tiles": [{"id": 1, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}],
    }],
}

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'src', 'assets', 'tilemap', 'test_map.json')
with open(out, 'w') as f:
    json.dump(tilemap, f)

# door tiles for TestScene wiring (town col,row of each door's bottom tile)
doors = {name: (door_col_of(ox, FACADES[facade]['w']), oy + FACADES[facade]['h'] - 1)
         for (name, facade, ox, oy) in PLACEMENTS}
print("wrote", os.path.relpath(out))
print("collide gids:", len(collide))
print("door tiles:", doors)
