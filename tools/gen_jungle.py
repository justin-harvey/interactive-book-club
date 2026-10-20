#!/usr/bin/env python3
"""Generate the Jungle (level 3) tilemap (jungle_map.json) from jungle_tileset.png.

A dense rainforest reached north from the Desert. Built from the Lost Valleys
jungle pack, composed by tools/slice_jungle.py into one small ground sheet
(src/assets/tiles/jungle_tileset.png, 8x1 @16px: grass, 2 grass variants, dirt,
dirt variant, stone, 2 deep-water). The map is a grass expanse carved with
dirt clearings and a couple of stone shelves, dotted with water ponds, and
blanketed in trees — a thick wall of jungle around the edges thinning to open
clearings inside. Props (trees, ferns, rocks, moss) are placed as sprites via
the scenery object layer (see JungleScene), exactly like the desert/woods.

Collision: water blocks (invisible collide tile over each pond cell); trees and
the larger rocks drop an invisible collide tile under their base. Grass, dirt,
stone, ferns and moss stay walkable. A south exit pad leads back to the Desert.

Run:  python3 tools/gen_jungle.py   (writes src/assets/tilemap/jungle_map.json)
"""
import json, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
COLS, ROWS, TS = 8, 1, 16
def dgid(c, r=0): return r * COLS + c + 1

# Composed-sheet columns -> gids (firstgid 1).
GRASS, GRASS_V1, GRASS_V2 = dgid(0), dgid(1), dgid(2)
DIRT, DIRT_V = dgid(3), dgid(4)
STONE = dgid(5)
WATER, WATER_V = dgid(6), dgid(7)
GRASS_VARS = [GRASS_V1, GRASS_V2]

# Second tileset: blank16 (transparent + a collide tile) for invisible collision
# under props and over water. firstgid follows the 8 ground tiles.
BLANK_FIRST = COLS * ROWS + 1          # 9
BLANK_COLLIDE = BLANK_FIRST + 1        # 10  (blank16 local id 1 = ge_collide)

W, H = 80, 50
floor = [GRASS] * (W * H)
walls = [0] * (W * H)
overhead = [0] * (W * H)
collide = set()
scenery = []
random.seed(21)

def put(layer, tx, ty, g):
    if 0 <= tx < W and 0 <= ty < H:
        layer[ty * W + tx] = g
def at(layer, tx, ty):
    return layer[ty * W + tx] if 0 <= tx < W and 0 <= ty < H else -1

# --- grass texture: sprinkle baked variants over the flat base -----------------
for i in range(W * H):
    if random.random() < 0.10:
        floor[i] = random.choice(GRASS_VARS)

# --- south exit + protected spawn clearing -------------------------------------
EXIT_COL, EXIT_ROW = W // 2, H - 1
START = (W // 2, H - 3)
def near_exit(tx, ty):
    return abs(tx - EXIT_COL) <= 4 and ty >= H - 7

def blob(cx, cy, rx, ry, jitter=0.22):
    """An organic ellipse of cells (jittered edge) — natural clearings/ponds
    instead of hard rectangles."""
    cells = set()
    for dy in range(-ry - 2, ry + 3):
        for dx in range(-rx - 2, rx + 3):
            nd = (dx / (rx + 0.5)) ** 2 + (dy / (ry + 0.5)) ** 2
            if nd <= 1.0 + random.uniform(-jitter, jitter):
                x, y = cx + dx, cy + dy
                if 0 <= x < W and 0 <= y < H:
                    cells.add((x, y))
    return cells

# dirt clearings (walkable) — the open "rooms" of the jungle (cx, cy, rx, ry)
CLEARINGS = [(14, 11, 5, 4), (58, 10, 5, 4), (38, 23, 6, 4),
             (20, 35, 5, 4), (64, 37, 5, 4), (EXIT_COL, H - 4, 5, 3)]
for (cx, cy, rx, ry) in CLEARINGS:
    for (x, y) in blob(cx, cy, rx, ry):
        put(floor, x, y, DIRT_V if random.random() < 0.18 else DIRT)

# water ponds (blocking). Keep each pond's cell set so we can ring + guard them.
PONDS = [(27, 16, 3, 3), (53, 24, 4, 3), (11, 42, 3, 2), (68, 26, 3, 3)]
pond_cells = set()
for (cx, cy, rx, ry) in PONDS:
    cells = blob(cx, cy, rx, ry, jitter=0.15)
    pond_cells |= cells
    for (x, y) in cells:
        put(floor, x, y, WATER_V if random.random() < 0.25 else WATER)
        put(walls, x, y, BLANK_COLLIDE)

def is_pond_cell(tx, ty):
    return (tx, ty) in pond_cells

def is_open_grass_or_dirt(tx, ty):
    """A walkable cell free of water and other props (walls layer clear)."""
    if not (0 <= tx < W and 0 <= ty < H): return False
    if at(walls, tx, ty) != 0: return False
    return not is_pond_cell(tx, ty)

# --- scenery props -------------------------------------------------------------
def add_prop(name, tx, ty, variant, tw, block):
    if not is_open_grass_or_dirt(tx, ty): return False
    if near_exit(tx, ty): return False
    scenery.append((name, tx, ty, {'variant': variant, 'tw': tw}))
    if block:
        put(walls, tx, ty, BLANK_COLLIDE)
    return True

def floor_is_grass(tx, ty):
    return at(floor, tx, ty) in (GRASS, GRASS_V1, GRASS_V2)

# ring the ponds with ferns + rocks to soften the shoreline
border = set()
for (x, y) in pond_cells:
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
        n = (x + dx, y + dy)
        if n not in pond_cells:
            border.add(n)
for i, (rx, ry) in enumerate(sorted(border)):
    if i % 2 == 0:
        add_prop('rock', rx, ry, i % 8, 1.0, True)
    else:
        add_prop('fern', rx, ry, i % 6, 1.0, False)

# trees — a thick jungle wall at the edges thinning to open clearings inside.
# probability rises toward the map border; capped so the scene stays light.
TREE_CAP = 125
def edge_p(tx, ty):
    d = min(tx, ty, W - 1 - tx, H - 1 - ty)       # distance to nearest border
    if d <= 1:  return 0.85
    if d <= 3:  return 0.50
    if d <= 6:  return 0.22
    return 0.04
trees = 0
order = [(tx, ty) for ty in range(H) for tx in range(W)]
random.shuffle(order)
for (tx, ty) in order:
    if trees >= TREE_CAP: break
    if not floor_is_grass(tx, ty): continue       # keep clearings/ponds open
    if random.random() < edge_p(tx, ty):
        # woods trees (variants 0,1,2) dominate for a look shared with the North
        # Woods; the two green jungle trees (3,4) are accents.
        v = random.choice([0, 0, 0, 1, 1, 1, 2, 2, 3, 4])
        if add_prop('tree', tx, ty, v, 3.0, True):
            trees += 1

# ferns scattered through the grass (non-blocking ground cover)
random.seed(7)
for _ in range(140):
    tx, ty = random.randint(1, W - 2), random.randint(1, H - 2)
    if floor_is_grass(tx, ty):
        add_prop('fern', tx, ty, random.randint(0, 5), 1.0, False)

# loose rocks scattered through the grass (blocking)
for _ in range(45):
    tx, ty = random.randint(1, W - 2), random.randint(1, H - 2)
    if floor_is_grass(tx, ty):
        add_prop('rock', tx, ty, random.randint(0, 7), 1.0, True)

# big moss decals, sparse (non-blocking, sits under the player)
for _ in range(8):
    tx, ty = random.randint(2, W - 9), random.randint(2, H - 6)
    if floor_is_grass(tx, ty):
        scenery.append(('moss', tx, ty, {'variant': random.randint(0, 2), 'tw': 7.0}))

# --- emit Tiled JSON -----------------------------------------------------------
def scenery_obj(oid, item):
    name, tx, ty, props = item
    tw = props.get('tw', 1)
    def ptype(v): return "int" if isinstance(v, int) else ("float" if isinstance(v, float) else "string")
    return {
        "id": oid, "name": name, "type": name, "rotation": 0, "visible": True,
        "x": (tx + tw / 2) * 16, "y": (ty + 1) * 16, "width": 0, "height": 0, "point": True,
        "properties": [{"name": k, "type": ptype(v), "value": v} for k, v in props.items()],
    }

def tilelayer(name, data, lid):
    return {"data": data, "height": H, "id": lid, "name": name, "opacity": 1,
            "type": "tilelayer", "visible": True, "width": W, "x": 0, "y": 0}

tilemap = {
    "compressionlevel": -1, "infinite": False, "orientation": "orthogonal",
    "renderorder": "right-down", "tiledversion": "1.9.0", "type": "map",
    "version": "1.9", "width": W, "height": H, "tilewidth": 16, "tileheight": 16,
    "nextlayerid": 6, "nextobjectid": len(scenery) + 1,
    "layers": [tilelayer("floor", floor, 1), tilelayer("walls", walls, 2),
               tilelayer("overhead", overhead, 3),
               {"id": 5, "name": "scenery", "type": "objectgroup", "opacity": 1,
                "visible": True, "x": 0, "y": 0, "draworder": "topdown",
                "objects": [scenery_obj(i + 1, it) for i, it in enumerate(scenery)]}],
    "tilesets": [
        {"columns": COLS, "firstgid": 1, "image": "../assets/tiles/jungle_tileset.png",
         "imagewidth": COLS * TS, "imageheight": ROWS * TS, "margin": 0, "spacing": 0,
         "name": "jungle_tileset", "tilecount": COLS * ROWS, "tilewidth": TS, "tileheight": TS,
         "tiles": []},
        {"columns": 2, "firstgid": BLANK_FIRST, "image": "../assets/tiles/blank16.png",
         "imagewidth": 32, "imageheight": 16, "margin": 0, "spacing": 0,
         "name": "blank16", "tilecount": 2, "tilewidth": TS, "tileheight": TS,
         "tiles": [{"id": 1, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}]},
    ],
}

out = os.path.join(HERE, '..', 'src', 'assets', 'tilemap', 'jungle_map.json')
with open(out, 'w') as f:
    json.dump(tilemap, f)
print("wrote", os.path.relpath(out),
      f"| {W}x{H} | trees:{trees} | scenery:{len(scenery)} | ponds:{len(PONDS)}")
