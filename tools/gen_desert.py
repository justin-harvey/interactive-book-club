#!/usr/bin/env python3
"""Generate the Desert (level 2) tilemap (desert_map.json) from desert_tileset.png.

A large open desert reached from the city. Built from GrayCatGames' PixelWorlds
Desert tileset (src/assets/tiles/desert_tileset.png, 14x13 @16px). The sheet is
laid out as little pre-composed scenes, so instead of hand-picking edge tiles we
STAMP rectangular blocks (oasis, cracked-dirt pit, rock butte) and skip any fully
transparent cell in the block — that reproduces the artist's shapes on top of a
sand base. Props (palm, cacti, boulders, shrubs) are placed as sprites via the
scenery object layer (see DesertScene), exactly like the woods trees.

Collision: water (oasis) and rock buttes block; blocking props drop an invisible
collide tile (blank16) under their base. Sand/dirt/shrubs stay walkable. The map
bounds contain the player; a south exit leads back to the city.

Run:  python3 tools/gen_desert.py   (writes src/assets/tilemap/desert_map.json)
"""
import json, os, random
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'src', 'assets', 'tiles', 'desert_tileset.png')
COLS, ROWS, TS = 14, 13, 16
def dgid(c, r): return r * COLS + c + 1

# Second tileset: blank16 (transparent, with a collide tile) for invisible
# collision under props and over water. firstgid follows the 182 desert tiles.
BLANK_FIRST = COLS * ROWS + 1          # 183
BLANK_COLLIDE = BLANK_FIRST + 1        # 184  (blank16 local id 1 = ge_collide)

W, H = 80, 50
BASE_SAND = 24
SAND_VARS = [26, 27, 40, 41, 52, 53]

# --- read the sheet so we can skip transparent cells and detect water ----------
_img = Image.open(SHEET).convert('RGBA'); _px = _img.load()
def _tile_stats(c, r):
    rs = gs = bs = n = op = 0
    for y in range(r * TS, r * TS + TS):
        for x in range(c * TS, c * TS + TS):
            R, G, B, A = _px[x, y]
            if A > 8: rs += R; gs += G; bs += B; n += 1
            if A > 180: op += 1
    if n == 0: return None
    return (rs // n, gs // n, bs // n, op)
def is_empty(c, r): return _tile_stats(c, r) is None
def is_water(c, r):
    s = _tile_stats(c, r)
    return s is not None and s[2] > s[0] and s[2] > 90   # blue dominant

floor = [BASE_SAND] * (W * H)
walls = [0] * (W * H)
overhead = [0] * (W * H)
collide = set()
scenery = []
random.seed(12)

def put(layer, tx, ty, g):
    if 0 <= tx < W and 0 <= ty < H:
        layer[ty * W + tx] = g
def at(layer, tx, ty):
    return layer[ty * W + tx] if 0 <= tx < W and 0 <= ty < H else -1

# --- sand texture: sprinkle variant tiles over the flat base -------------------
for i in range(W * H):
    if random.random() < 0.08:
        floor[i] = random.choice(SAND_VARS)

# --- block stamps (tileset col/row ranges, inclusive) --------------------------
OASIS  = (0, 0, 6, 3)    # water pool with sandy shore
DIRT_A = (0, 5, 3, 8)    # cracked-dirt pit, rocky rim
DIRT_B = (7, 5, 10, 8)   # cracked-dirt pit, sandy transition
CLIFF  = (8, 9, 11, 12)  # rock butte (blocks)

def footprint(block):
    c0, r0, c1, r1 = block
    return (c1 - c0 + 1, r1 - r0 + 1)

def stamp_ground(block, mx, my):
    """Stamp onto the floor layer; water cells also get a collide tile."""
    c0, r0, c1, r1 = block
    for dr in range(r1 - r0 + 1):
        for dc in range(c1 - c0 + 1):
            c, r = c0 + dc, r0 + dr
            if is_empty(c, r): continue
            put(floor, mx + dc, my + dr, dgid(c, r))
            if is_water(c, r):
                put(walls, mx + dc, my + dr, BLANK_COLLIDE)

def stamp_cliff(mx, my):
    """Stamp the rock butte onto the walls layer (renders above sand, blocks)."""
    c0, r0, c1, r1 = CLIFF
    for dr in range(r1 - r0 + 1):
        for dc in range(c1 - c0 + 1):
            c, r = c0 + dc, r0 + dr
            if is_empty(c, r): continue
            g = dgid(c, r)
            put(walls, mx + dc, my + dr, g); collide.add(g)

# --- composition: exit + protected spawn apron at the south edge ---------------
EXIT_COL, EXIT_ROW = W // 2, H - 1
START = (W // 2, H - 3)
def near_exit(tx, ty):
    return abs(tx - EXIT_COL) <= 3 and ty >= H - 6

# oases (7x4 each) — a few scattered pools, with palms clustered around them
OASES = [(9, 6), (58, 8), (47, 33), (18, 32), (64, 29)]
for (mx, my) in OASES:
    stamp_ground(OASIS, mx, my)

# cracked-dirt pits (4x4) alternating the two variants
DIRTS = [(26, 10), (40, 7), (55, 17), (14, 20), (33, 24),
         (60, 40), (21, 41), (46, 42), (6, 34), (70, 13)]
for i, (mx, my) in enumerate(DIRTS):
    if not near_exit(mx, my):
        stamp_ground(DIRT_A if i % 2 == 0 else DIRT_B, mx, my)

# rock buttes (4x4) framing the north edge, sides, and a couple inland
CLIFFS = [(4, 0), (16, 1), (30, 0), (50, 0), (63, 1), (72, 0),
          (0, 13), (76, 19), (0, 31), (74, 37), (36, 15), (57, 26), (10, 44), (68, 45)]
for (mx, my) in CLIFFS:
    if not near_exit(mx, my):
        stamp_cliff(mx, my)

# --- scenery props (sprites placed by DesertScene) -----------------------------
# tw = sprite width in tiles (keeps art at its natural size, no stretching).
def add_prop(name, tx, ty, variant, tw, block):
    if not (0 <= tx < W and 0 <= ty < H): return False
    if near_exit(tx, ty): return False
    if at(walls, tx, ty) != 0 or is_water_floor(tx, ty): return False
    scenery.append((name, tx, ty, {'variant': variant, 'tw': tw}))
    if block:
        put(walls, tx, ty, BLANK_COLLIDE)
    return True

def is_water_floor(tx, ty):
    g = at(floor, tx, ty)
    # a stamped water tile sits on floor; detect by re-deriving its sheet cell
    if g <= 0 or g > COLS * ROWS: return False
    c, r = (g - 1) % COLS, (g - 1) // COLS
    return is_water(c, r)

# palms hug the oasis edges
for (mx, my) in OASES:
    for (dx, dy) in [(-1, 3), (7, 2), (3, 4), (-1, 1)]:
        add_prop('palm', mx + dx, my + dy, 0, 3.0, True)

# scatter cacti, boulders, shrubs across open sand
random.seed(5)
SCATTER = [('cactus', 0, 1.0, True, 26), ('cactus', 1, 1.0, True, 22),
           ('boulder', 0, 3.0, True, 16), ('boulder', 1, 2.0, True, 16),
           ('shrub', 0, 2.25, False, 34), ('shrub', 1, 1.0, False, 26)]
for (name, variant, tw, block, count) in SCATTER:
    placed = 0; tries = 0
    while placed < count and tries < count * 40:
        tries += 1
        tx, ty = random.randint(1, W - 2), random.randint(1, H - 2)
        if at(floor, tx, ty) != BASE_SAND and at(floor, tx, ty) not in SAND_VARS:
            continue   # keep props on open sand, off dirt/water
        if add_prop(name, tx, ty, variant, tw, block):
            placed += 1

# --- emit Tiled JSON -----------------------------------------------------------
desert_tiles = [{"id": g - 1, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}
                for g in sorted(collide)]

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
        {"columns": COLS, "firstgid": 1, "image": "../assets/tiles/desert_tileset.png",
         "imagewidth": COLS * TS, "imageheight": ROWS * TS, "margin": 0, "spacing": 0,
         "name": "desert_tileset", "tilecount": COLS * ROWS, "tilewidth": TS, "tileheight": TS,
         "tiles": desert_tiles},
        {"columns": 2, "firstgid": BLANK_FIRST, "image": "../assets/tiles/blank16.png",
         "imagewidth": 32, "imageheight": 16, "margin": 0, "spacing": 0,
         "name": "blank16", "tilecount": 2, "tilewidth": TS, "tileheight": TS,
         "tiles": [{"id": 1, "properties": [{"name": "ge_collide", "type": "bool", "value": True}]}]},
    ],
}

out = os.path.join(HERE, '..', 'src', 'assets', 'tilemap', 'desert_map.json')
with open(out, 'w') as f:
    json.dump(tilemap, f)
print("wrote", os.path.relpath(out), f"| {W}x{H} | scenery:{len(scenery)} | collide gids:{len(collide)}")
