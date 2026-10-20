#!/usr/bin/env python3
"""Generate the landscape City-interior collision tilemap (city_interior.json).

The city building interiors are wide 1408x768 (~11:6) room images, unlike the
square 1024x1024 town rooms. Reusing the square interior_room grid would squish
them, so city interiors get their own 22x12 grid (matches the art aspect exactly:
22/12 = 1.833 = 1408/768) with a plain open floor and a one-tile wall border.

Doors are placed in code (CityInteriorScene), not here: a bottom-centre EXIT/UP
door in every room, plus a top-centre DOWN door for the museum's basement chain.

Two invisible layers over the transparent `blank16` tileset:
  * floor: a walkable tile in every cell (grid-engine blocks empty cells).
  * walls: a colliding tile on the 1-tile border so the dog stays in the room.

Run:  python3 tools/gen_city_interior.py
"""
import json, os

W, H = 22, 12                # 22x12 grid over the 1408x768 art (64px per cell)

# blank16 tileset: id0 (gid 1) = walkable, id1 (gid 2) = colliding. Both transparent.
WALK_GID, WALL_GID = 1, 2

def is_wall(c, r):
    return c == 0 or c == W - 1 or r == 0 or r == H - 1

floor = [WALK_GID] * (W * H)                                   # ground everywhere
walls = [WALL_GID if is_wall(i % W, i // W) else 0 for i in range(W * H)]

def tilelayer(name, data, lid):
    return {"data": data, "height": H, "width": W, "id": lid, "name": name,
            "opacity": 1, "type": "tilelayer", "visible": True, "x": 0, "y": 0}

tilemap = {
    "compressionlevel": -1, "infinite": False, "orientation": "orthogonal",
    "renderorder": "right-down", "tiledversion": "1.9.0", "type": "map",
    "version": "1.9", "width": W, "height": H, "tilewidth": 16, "tileheight": 16,
    "nextlayerid": 3, "nextobjectid": 1,
    "layers": [tilelayer("floor", floor, 1), tilelayer("walls", walls, 2)],
    "tilesets": [{
        "columns": 2, "firstgid": 1, "image": "../assets/tiles/blank16.png",
        "imagewidth": 32, "imageheight": 16, "margin": 0, "spacing": 0,
        "name": "blank16", "tilecount": 2, "tilewidth": 16, "tileheight": 16,
        "tiles": [{"id": 1, "properties": [
            {"name": "ge_collide", "type": "bool", "value": True}]}],
    }],
}

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'src', 'assets', 'tilemap', 'city_interior.json')
with open(out, 'w') as f:
    json.dump(tilemap, f)
print("wrote", os.path.relpath(out), f"({W}x{H})")
