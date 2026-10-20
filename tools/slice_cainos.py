#!/usr/bin/env python3
"""Slice the Cainos "Pixel Art Top Down - Basic" sheets into individual trimmed
sprites for the woods scene.

The pack packs many objects onto one transparent sheet (trees + bushes + grass on
TX Plant.png; rocks/barrels/crates/signs/etc. on TX Props.png). We find each
object as a connected blob of non-transparent pixels (dilated a little so a tree's
canopy and trunk, or a clump of grass blades, count as one), crop it tight, and
write it out to src/assets/woods/ with a stable, human-readable name.

Re-run any time:  python3 tools/slice_cainos.py
Writes: src/assets/woods/<name>.png  and prints a manifest (name, WxH).
"""
import os
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.join(HERE, '..', 'sprites', 'woods',
                    'Pixel Art Top Down - Basic v1.2.3', 'Texture')
OUT = os.path.join(HERE, '..', 'src', 'assets', 'woods')
os.makedirs(OUT, exist_ok=True)

ALPHA = 16      # pixels with alpha above this count as "solid"
DILATE = 6      # merge blobs whose solid pixels are within this many px
MIN_AREA = 40   # ignore specks smaller than this many solid pixels


def solid_mask(im):
    px = im.load()
    w, h = im.size
    return [[px[x, y][3] > ALPHA for x in range(w)] for y in range(h)], w, h


def dilate(mask, w, h, r):
    out = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            for dy in range(-r, r + 1):
                yy = y + dy
                if 0 <= yy < h:
                    row = out[yy]
                    for dx in range(-r, r + 1):
                        xx = x + dx
                        if 0 <= xx < w:
                            row[xx] = True
    return out


def blobs(dmask, base, w, h):
    """Connected components on the dilated mask; bbox measured on the *base*
    (undilated) solid pixels so crops stay tight."""
    seen = [[False] * w for _ in range(h)]
    comps = []
    for sy in range(h):
        for sx in range(w):
            if not dmask[sy][sx] or seen[sy][sx]:
                continue
            q = deque([(sx, sy)])
            seen[sy][sx] = True
            minx = miny = 10 ** 9
            maxx = maxy = -1
            area = 0
            while q:
                x, y = q.popleft()
                if base[y][x]:
                    area += 1
                    minx, miny = min(minx, x), min(miny, y)
                    maxx, maxy = max(maxx, x), max(maxy, y)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and dmask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if area >= MIN_AREA and maxx >= 0:
                comps.append((minx, miny, maxx + 1, maxy + 1, area))
    return comps


def extract(sheet):
    im = Image.open(os.path.join(PACK, sheet)).convert('RGBA')
    base, w, h = solid_mask(im)
    dmask = dilate(base, w, h, DILATE)
    comps = blobs(dmask, base, w, h)
    return im, comps


def row_sort(comps, row_tol=24):
    """Order blobs top-to-bottom, then left-to-right, grouping into rough rows."""
    comps = sorted(comps, key=lambda c: c[1])
    rows, cur, cy = [], [], None
    for c in comps:
        if cy is None or abs(c[1] - cy) <= row_tol:
            cur.append(c)
            cy = c[1] if cy is None else cy
        else:
            rows.append(sorted(cur, key=lambda c: c[0]))
            cur, cy = [c], c[1]
    if cur:
        rows.append(sorted(cur, key=lambda c: c[0]))
    return rows


def save(im, box, name, manifest):
    crop = im.crop(box[:4])
    crop.save(os.path.join(OUT, name + '.png'))
    manifest.append((name, crop.width, crop.height))


def main():
    manifest = []

    # --- TX Plant.png : row0 = trees, row1 = bushes, lower-left = grass tufts
    im, comps = extract('TX Plant.png')
    rows = row_sort(im and comps, row_tol=40)
    if rows:
        for i, box in enumerate(rows[0], 1):
            save(im, box, f'tree-{i}', manifest)
    if len(rows) > 1:
        for i, box in enumerate(rows[1], 1):
            save(im, box, f'bush-{i}', manifest)
    # everything below the bush row: small grass tufts
    tuft = 1
    for row in rows[2:]:
        for box in row:
            save(im, box, f'grass-{tuft}', manifest)
            tuft += 1

    # --- TX Props.png : keep the useful woods props by their grid position.
    im, comps = extract('TX Props.png')
    rows = row_sort(comps, row_tol=24)
    # The bottom two rows of the sheet are loose rocks/stones.
    rock = 1
    for row in rows[-2:]:
        for box in row:
            save(im, box, f'rock-{rock}', manifest)
            rock += 1
    # A few named accents picked from the upper prop grid (left-to-right within
    # their row). These indices match the v1.2.3 sheet layout.
    named = {
        (0, 1): 'barrel',      # round wooden barrel
        (0, 2): 'crate-small', # small crate
        (1, 0): 'signpost',    # wooden signpost
        (2, 1): 'pot',         # ceramic pot
    }
    for (ri, ci), nm in named.items():
        if ri < len(rows) - 2 and ci < len(rows[ri]):
            save(im, rows[ri][ci], nm, manifest)

    manifest.sort()
    print(f"wrote {len(manifest)} sprites to src/assets/woods/")
    for nm, w, h in manifest:
        print(f"  {nm:<12} {w}x{h}")


if __name__ == '__main__':
    main()
