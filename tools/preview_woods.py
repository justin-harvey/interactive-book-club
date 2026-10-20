#!/usr/bin/env python3
"""Offline sanity-render of the woods map: composite floor+walls+overhead tiles
from modern_exterior plus the Cainos scenery sprites, so we can eyeball scale and
placement without a browser. Writes tools/woods_preview.png. Not used at runtime.
"""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
TS = 16  # tile size
SHEET = Image.open(os.path.join(ROOT, 'src/assets/tiles/modern_exterior.png')).convert('RGBA')
SHEET_COLS = SHEET.width // TS
MAP = json.load(open(os.path.join(ROOT, 'src/assets/tilemap/woods_map.json')))
W, H = MAP['width'], MAP['height']

canvas = Image.new('RGBA', (W * TS, H * TS), (30, 30, 30, 255))

def tile_img(gid):
    idx = gid - 1
    sx, sy = (idx % SHEET_COLS) * TS, (idx // SHEET_COLS) * TS
    return SHEET.crop((sx, sy, sx + TS, sy + TS))

def draw_tiles(name):
    layer = next((l for l in MAP['layers'] if l.get('name') == name), None)
    if not layer or layer['type'] != 'tilelayer':
        return
    for i, g in enumerate(layer['data']):
        if g:
            x, y = (i % W) * TS, (i // W) * TS
            canvas.alpha_composite(tile_img(g), (x, y))

# tile layers, painter's order
for n in ('floor', 'walls', 'overhead'):
    draw_tiles(n)

# scenery sprites (same mapping WoodsScene uses)
FILES = {
    'tree': ['tree-1', 'tree-2', 'tree-3'], 'rock': ['rock-1'],
    'bush': ['bush-3', 'bush-4', 'bush-6'], 'signpost': ['signpost'], 'grass': ['grass-3'],
}
TW = {'tree': 2, 'rock': 1.4, 'bush': 1.1, 'signpost': 1, 'grass': 1}
sc = next((l for l in MAP['layers'] if l.get('name') == 'scenery'), None)
for idx, obj in enumerate(sc['objects']):
    kind = obj['name']
    props = {p['name']: p['value'] for p in obj.get('properties', [])}
    keys = FILES[kind]
    variant = ((props.get('variant', idx + 1) - 1) if 'variant' in props else idx) % len(keys)
    spr = Image.open(os.path.join(ROOT, 'src/assets/woods', keys[variant] + '.png')).convert('RGBA')
    tw = props.get('tw', TW[kind])
    scale = (tw * TS) / spr.width
    spr = spr.resize((max(1, round(spr.width * scale)), max(1, round(spr.height * scale))))
    px, py = round(obj['x']), round(obj['y'])           # bottom-centre anchor
    canvas.alpha_composite(spr, (px - spr.width // 2, py - spr.height))

out = os.path.join(HERE, 'woods_preview.png')
canvas.convert('RGB').resize((W * TS * 2, H * TS * 2), Image.NEAREST).save(out)
print('wrote', os.path.relpath(out), f'({W}x{H} tiles)')
