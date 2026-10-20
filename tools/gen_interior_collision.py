#!/usr/bin/env python3
"""Convert painted collision masks into per-room tilemaps for ALL interiors.

Supersedes gen_museum_collision.py. Each room's art is stretched over a grid
(city/museum = 22x12 landscape, town = 16x16 square; both 64px cells). The painter
fills NON-walkable cells with solid colour on the *_PAINT-ME.png canvas:
  RED    -> wall / pit (blocked)
  GREEN  -> exit / ascend portal (leave the room, or up one museum floor)
  BLUE   -> descend portal (down one museum floor)
  PURPLE -> custom portal (museum B4 -> Atlantis sanctum; key-gated in code)
Green/blue/purple tiles stay walkable and become scene-switch triggers.

Emits src/assets/tilemap/<key>.json per room and src/data/interiorNav.ts
(start tile + typed portal tiles per room). Rooms with no painted file fall back
to an open room so the project keeps building. Re-run any time; idempotent.

    python3 tools/gen_interior_collision.py
    node tools/embed-maps.mjs && npm run build
"""
import json, os
from collections import deque
from PIL import Image, ImageDraw, ImageEnhance, ImageOps
import numpy as np

WALK_GID, WALL_GID = 1, 2
BLOCK_FRAC = 0.35

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
TILEMAP_DIR = os.path.join(ROOT, 'src', 'assets', 'tilemap')
ROOMS_DIR = os.path.join(ROOT, 'src', 'assets', 'rooms')
OVERLAY_DIR = '/tmp/interior_grid'
MUSEUM_PAINT = '/home/nah/museum-collision'
INTERIOR_PAINT = '/home/nah/interior-collision'

# map key -> (room art name, painted-file path, (grid W, H))
def paint(dirp, art):
    return os.path.join(dirp, f'{art}_PAINT-ME.png')

ROOMS = {
    # Museum (landscape, painted earlier)
    'museum_ground': ('museum-interior', paint(MUSEUM_PAINT, 'museum-interior'), (22, 12)),
    'museum_b1': ('museum-level-1', paint(MUSEUM_PAINT, 'museum-level-1'), (22, 12)),
    'museum_b2': ('museum-level-2', paint(MUSEUM_PAINT, 'museum-level-2'), (22, 12)),
    'museum_b3': ('museum-level-3', paint(MUSEUM_PAINT, 'museum-level-3'), (22, 12)),
    'museum_b4': ('museum-level-4', paint(MUSEUM_PAINT, 'museum-level-4'), (22, 12)),
    # City buildings (landscape)
    'room_finance': ('finance-interior', paint(INTERIOR_PAINT, 'finance-interior'), (22, 12)),
    'room_large_tower': ('large-tower-interior', paint(INTERIOR_PAINT, 'large-tower-interior'), (22, 12)),
    'room_church': ('church-interior', paint(INTERIOR_PAINT, 'church-interior'), (22, 12)),
    'room_fashion': ('fashion-interior', paint(INTERIOR_PAINT, 'fashion-interior'), (22, 12)),
    'room_power_tower': ('power-tower-interior', paint(INTERIOR_PAINT, 'power-tower-interior'), (22, 12)),
    'room_radio_tower': ('radio-tower-interior', paint(INTERIOR_PAINT, 'radio-tower-interior'), (22, 12)),
    'room_power_station': ('power-station-interior', paint(INTERIOR_PAINT, 'power-station-interior'), (22, 12)),
    'room_radio_tower2': ('radio-tower-2-interior', paint(INTERIOR_PAINT, 'radio-tower-2-interior'), (22, 12)),
    # Town shops (square)
    'room_cafe': ('cafe-interior', paint(INTERIOR_PAINT, 'cafe-interior'), (16, 16)),
    'room_library': ('library-interior', paint(INTERIOR_PAINT, 'library-interior'), (16, 16)),
    'room_home': ('home-interior', paint(INTERIOR_PAINT, 'home-interior'), (16, 16)),
    'room_treats': ('treats-interior', paint(INTERIOR_PAINT, 'treats-interior'), (16, 16)),
}


def build_mask(paint_path, W, H):
    if not os.path.exists(paint_path):
        return None, None
    p = np.asarray(Image.open(paint_path).convert('RGB').resize((W*64, H*64))).astype(int)
    R, G, B = p[:, :, 0], p[:, :, 1], p[:, :, 2]
    masks = {
        'block':   (R > 150) & (G < 90) & (B < 90),
        'ascend':  (G > 150) & (R < 90) & (B < 90),
        'descend': (B > 150) & (R < 90) & (G < 90),
        'custom':  (R > 110) & (B > 110) & (G < 100),
    }
    walk = np.ones((H, W), bool)
    portals = []
    for r in range(H):
        for c in range(W):
            sl = (slice(r*64, (r+1)*64), slice(c*64, (c+1)*64))
            border = c in (0, W-1) or r in (0, H-1)
            fracs = {k: m[sl].mean() for k, m in masks.items()}
            kind = max(fracs, key=fracs.get)
            if fracs[kind] < BLOCK_FRAC:
                kind = None
            is_portal = kind in ('ascend', 'descend', 'custom')
            # Portals are walkable even on the border (an exit is naturally painted
            # on the room's edge); everything else on the border stays a wall.
            walk[r, c] = is_portal or (not border and kind != 'block')
            if is_portal:
                portals.append((kind, c, r))
    return walk, portals


def collapse_and_land(portals, walk, W, H):
    """Reduce each portal TYPE to a single trigger tile (nearest the type's
    centroid) and precompute a walkable, non-portal landing tile beside it — where
    the dog spawns on arrival so it never sits on a trigger (which caused an
    infinite portal loop). Other painted portal cells stay walkable floor."""
    portal_cells = {(c, r) for (_, c, r) in portals}
    by_kind = {}
    for (k, c, r) in portals:
        by_kind.setdefault(k, []).append((c, r))
    result = []
    for k, cells in by_kind.items():
        cx = sum(c for c, r in cells) / len(cells)
        cy = sum(r for c, r in cells) / len(cells)
        px, py = min(cells, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
        # BFS over walkable tiles from the portal to the nearest walkable
        # NON-portal tile — the dog's landing spot, guaranteed off any trigger.
        seen = {(px, py)}
        q = deque([(px, py)])
        land = (px, py)   # fallback: the portal itself if truly boxed in
        while q:
            x, y = q.popleft()
            if (x, y) not in portal_cells:
                land = (x, y); break
            for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and walk[ny, nx]:
                    seen.add((nx, ny)); q.append((nx, ny))
        result.append({"type": k, "x": px, "y": py, "land": {"x": land[0], "y": land[1]}})
    return result


def open_room_mask(W, H):
    walk = np.zeros((H, W), bool)
    for r in range(H):
        for c in range(W):
            walk[r, c] = not (c in (0, W-1) or r in (0, H-1))
    return walk


def largest_region(walk, portals, W, H):
    portal_cells = {(c, r) for (_, c, r) in portals}
    cx, cy = W // 2, H // 2
    seen, regions = {}, []
    rid = 0
    for y in range(H):
        for x in range(W):
            if walk[y, x] and (x, y) not in seen:
                rid += 1
                q = deque([(x, y)]); seen[(x, y)] = rid; cells = [(x, y)]
                while q:
                    ax, ay = q.popleft()
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = ax+dx, ay+dy
                        if 0 <= nx < W and 0 <= ny < H and walk[ny, nx] and (nx, ny) not in seen:
                            seen[(nx, ny)] = rid; cells.append((nx, ny)); q.append((nx, ny))
                regions.append(cells)
    if not regions:
        return set(), {"x": cx, "y": cy}
    best = max(regions, key=lambda cs: (sum(1 for c in cs if c in portal_cells), len(cs)))
    region = set(best)
    cands = [c for c in region if c not in portal_cells] or list(region)
    sx, sy = min(cands, key=lambda c: (c[0]-cx)**2 + (c[1]-cy)**2)
    return region, {"x": sx, "y": sy}


def tilemap(walk, W, H):
    floor = [WALK_GID] * (W * H)
    walls = [0 if walk[i // W, i % W] else WALL_GID for i in range(W * H)]

    def layer(nm, data, lid):
        return {"data": data, "height": H, "width": W, "id": lid, "name": nm,
                "opacity": 1, "type": "tilelayer", "visible": True, "x": 0, "y": 0}
    return {
        "compressionlevel": -1, "infinite": False, "orientation": "orthogonal",
        "renderorder": "right-down", "tiledversion": "1.9.0", "type": "map",
        "version": "1.9", "width": W, "height": H, "tilewidth": 16, "tileheight": 16,
        "nextlayerid": 3, "nextobjectid": 1,
        "layers": [layer("floor", floor, 1), layer("walls", walls, 2)],
        "tilesets": [{
            "columns": 2, "firstgid": 1, "image": "../assets/tiles/blank16.png",
            "imagewidth": 32, "imageheight": 16, "margin": 0, "spacing": 0,
            "name": "blank16", "tilecount": 2, "tilewidth": 16, "tileheight": 16,
            "tiles": [{"id": 1, "properties": [
                {"name": "ge_collide", "type": "bool", "value": True}]}],
        }],
    }


def save_overlay(art, walk, portals, W, H):
    os.makedirs(OVERLAY_DIR, exist_ok=True)
    ptype = {(c, r): t for (t, c, r) in (portals or [])}
    letter = {'ascend': 'A', 'descend': 'D', 'custom': 'C'}
    pfill = {'ascend': (0, 220, 0, 150), 'descend': (0, 120, 255, 150), 'custom': (220, 0, 255, 150)}
    im = Image.open(os.path.join(ROOMS_DIR, f'{art}.png')).convert('RGB').resize((W*64, H*64))
    vis = ImageOps.autocontrast(ImageEnhance.Brightness(im).enhance(1.4)).convert('RGBA')
    ov = Image.new('RGBA', vis.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for r in range(H):
        for c in range(W):
            x0, y0 = c*64, r*64
            if (c, r) in ptype:
                t = ptype[(c, r)]
                d.rectangle([x0, y0, x0+64, y0+64], fill=pfill[t], outline=(255, 255, 255, 220), width=2)
                d.text((x0+26, y0+22), letter[t], fill=(255, 255, 255, 255))
            elif walk[r, c]:
                d.rectangle([x0, y0, x0+64, y0+64], fill=(0, 160, 160, 55), outline=(255, 255, 255, 70))
            else:
                d.rectangle([x0, y0, x0+64, y0+64], fill=(255, 0, 0, 110), outline=(255, 255, 255, 70))
    out = Image.alpha_composite(vis, ov).convert('RGB')
    p = os.path.join(OVERLAY_DIR, f'{art}_verify.png'); out.save(p); return p


def emit_nav_module(nav):
    lines = [
        "// AUTO-GENERATED by tools/gen_interior_collision.py from painted masks.",
        "// Do not edit by hand. Portal `type` -> target is resolved in the scene:",
        "// ascend=exit/up, descend=down, custom=Atlantis sanctum (key-gated).",
        "/* eslint-disable */",
        "export interface InteriorPortal { type: 'ascend' | 'descend' | 'custom'; x: number; y: number; land: { x: number; y: number }; }",
        "export interface InteriorFloorNav { start: { x: number; y: number }; portals: InteriorPortal[]; }",
        "export const INTERIOR_NAV: Record<string, InteriorFloorNav> = {",
    ]
    for key, data in nav.items():
        ps = ", ".join(
            f"{{ type: '{p['type']}', x: {p['x']}, y: {p['y']}, "
            f"land: {{ x: {p['land']['x']}, y: {p['land']['y']} }} }}"
            for p in data['portals'])
        lines.append(f"    {key}: {{ start: {{ x: {data['start']['x']}, y: {data['start']['y']} }}, "
                     f"portals: [{ps}] }},")
    lines.append("};")
    with open(os.path.join(ROOT, 'src', 'data', 'interiorNav.ts'), 'w') as f:
        f.write("\n".join(lines) + "\n")
    print("wrote src/data/interiorNav.ts")


def main():
    print("Generating interior collision tilemaps...")
    nav = {}
    for key, (art, paint_path, (W, H)) in ROOMS.items():
        walk, portals = build_mask(paint_path, W, H)
        painted = walk is not None
        if not painted:
            walk = open_room_mask(W, H); portals = []
        region, start = largest_region(walk, portals, W, H)
        walk[start['y'], start['x']] = True
        with open(os.path.join(TILEMAP_DIR, f'{key}.json'), 'w') as f:
            json.dump(tilemap(walk, W, H), f)
        collapsed = collapse_and_land(portals, walk, W, H)
        nav[key] = {"start": start, "portals": collapsed}
        tag = "painted" if painted else "OPEN ROOM (not painted)"
        reach = sum(1 for p in collapsed if (p['x'], p['y']) in region)
        summary = ", ".join(f"{p['type']}@({p['x']},{p['y']})→land({p['land']['x']},{p['land']['y']})"
                            for p in collapsed)
        print(f"- {key}.json [{tag}] walkable={int(walk.sum()):>3} start={start} "
              f"portals={len(collapsed)} reachable={reach}/{len(collapsed)}")
        if collapsed:
            print(f"    {summary}")
        if collapsed and reach < len(collapsed):
            print(f"    !! WARNING: {len(collapsed)-reach} portal(s) stranded off the start region on {key}.")
        if painted:
            print(f"    verify: {save_overlay(art, walk, portals, W, H)}")
    emit_nav_module(nav)
    print("\nNext: node tools/embed-maps.mjs && npm run build")


if __name__ == '__main__':
    main()
