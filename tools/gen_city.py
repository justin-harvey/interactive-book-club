#!/usr/bin/env python3
"""Generate the walkable City tilemap (city_map.json).

The next-map-expansion city you reach across the bridge from the woods lookout.
A light-pavement (sidewalk) city with a grid of darker asphalt roads, a central
cobblestone plaza, and street trees. Nine city buildings sit in a loose 3x3 grid;
three of them (power-tower, large-church, power-station) are doubled in size, so
the map is spaced out to fit their tall footprints without overlapping neighbours.

Each building is an invisible-but-solid collision footprint (blank16),
bottom-anchored to its base row and sized to the (cropped) art, so the overlay
images drawn in CityScene line up with what blocks the dog.

Keep the constants below in sync with CityScene.ts. Run:
    python3 tools/gen_city.py   (writes src/assets/tilemap/city_map.json)
"""
import json, os
from PIL import Image

SHEET_COLS = 141
def gid(col, row): return row * SHEET_COLS + col + 1

W, H = 52, 72
SIDEWALK = gid(43, 2)                      # light cream pavement (base)
ROAD     = gid(34, 6)                      # dark asphalt (road grid)
PLAZA    = gid(17, 1)                      # grey cobblestone (central plaza)
TREE = dict(sc=16, sr=3, w=2, h=3)         # 2x3 tree, trunk row blocks

BLANK_FIRST = SHEET_COLS * 118 + 1
BLANK_SOLID = BLANK_FIRST + 1

_HERE = os.path.dirname(os.path.abspath(__file__))
def art_aspect(name):
    im = Image.open(os.path.join(_HERE, '..', 'src', 'assets', 'city', name + '.png'))
    return im.height / im.width

# (id, centre_col, base_row, width_tiles). Cols 12 / 28 / 44; base rows 24 / 50 /
# 66. power-tower, large-church and power-station are 2x their old width.
PLACEMENTS = [
    ('power-tower',     12, 24, 10.0),
    ('finance-tower',   28, 24, 10.0),
    ('large-tower',     44, 24,  6.0),
    ('museum',          12, 50, 10.0),
    ('large-church',    28, 50, 11.0),
    ('fashion-district',44, 50, 10.0),
    ('radio-tower',     12, 66,  3.5),
    ('power-station',   28, 66, 16.0),
    ('radio-tower-2',   44, 66,  3.5),
]
H_ROADS = (25, 26, 51, 52, 67, 68)
V_ROADS = (0, 1, 18, 19, 36, 37, 50, 51)
PLAZA_RECT = (20, 53, 36, 58)              # cols 20-35, rows 53-57
PLAZA_TREES = [(22, 55), (33, 55)]         # flank the plaza (centre left open)
STREET_TREES = [(6, 32), (6, 46), (46, 32), (46, 46), (16, 46), (38, 46)]

floor = [SIDEWALK] * (W * H)
walls = [0] * (W * H)
collide = set()

def put(layer, tx, ty, g):
    if 0 <= tx < W and 0 <= ty < H:
        layer[ty * W + tx] = g

# --- asphalt road grid ---
for ty in H_ROADS:
    for tx in range(W):
        put(floor, tx, ty, ROAD)
for tx in V_ROADS:
    for ty in range(H):
        put(floor, tx, ty, ROAD)

# --- central cobblestone plaza ---
for ty in range(PLAZA_RECT[1], PLAZA_RECT[3]):
    for tx in range(PLAZA_RECT[0], PLAZA_RECT[2]):
        put(floor, tx, ty, PLAZA)

# --- buildings: invisible solid footprints, bottom-anchored to the base row ---
for (name, cx, base, wt) in PLACEMENTS:
    coll_w = max(1, round(wt))
    coll_h = max(1, round(wt * art_aspect(name)))
    left = cx - coll_w // 2
    top = base - coll_h + 1
    for ty in range(top, base + 1):
        for tx in range(left, left + coll_w):
            put(walls, tx, ty, BLANK_SOLID)

# --- trees (plaza + along the streets); trunk row blocks ---
def plant_tree(ox, oy):
    for dy in range(TREE['h']):
        for dx in range(TREE['w']):
            g = gid(TREE['sc'] + dx, TREE['sr'] + dy)
            put(walls, ox + dx, oy + dy, g)
            if dy == TREE['h'] - 1:
                collide.add(g)
for (ox, oy) in PLAZA_TREES + STREET_TREES:
    plant_tree(ox, oy)

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
        "tilecount": 141 * 118, "tilewidth": 16, "tileheight": 16, "tiles": tileset_tiles,
    }, {
        "columns": 2, "firstgid": BLANK_FIRST,
        "image": "../assets/tiles/blank16.png",
        "imagewidth": 32, "imageheight": 16,
        "margin": 0, "spacing": 0, "name": "blank16",
        "tilecount": 2, "tilewidth": 16, "tileheight": 16,
        "tiles": [{"id": 1, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}],
    }],
}

out = os.path.join(_HERE, '..', 'src', 'assets', 'tilemap', 'city_map.json')
with open(out, 'w') as f:
    json.dump(tilemap, f)
print("wrote", os.path.relpath(out), f"({W}x{H})")
