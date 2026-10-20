#!/usr/bin/env python3
"""Generate paintable grid canvases for interior collision authoring.

For each interior, bakes its collision grid (cyan lines + col,row labels) onto the
room art at native resolution so the painter can fill NON-walkable cells with solid
red and drop a green exit tile. City interiors use a 22x12 grid over 1408x768 art;
town interiors use 16x16 over 1024x1024. Output goes to /home/nah/interior-collision/.
Re-run any time; it never touches already-painted files' pixels (writes *_PAINT-ME
copies + pristine references only).
"""
import os
from PIL import Image, ImageDraw

OUT = '/home/nah/interior-collision'
ORIG = os.path.join(OUT, '_canvas_original')
ROOMS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'assets', 'rooms')

# name -> (grid W, H). City = 22x12 landscape, town = 16x16 square.
CANVASES = {
    'power-tower-interior': (22, 12), 'finance-interior': (22, 12),
    'large-tower-interior': (22, 12), 'church-interior': (22, 12),
    'fashion-interior': (22, 12), 'radio-tower-interior': (22, 12),
    'power-station-interior': (22, 12), 'radio-tower-2-interior': (22, 12),
    'treats-interior': (16, 16), 'cafe-interior': (16, 16),
    'library-interior': (16, 16), 'home-interior': (16, 16),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ORIG, exist_ok=True)
    for name, (W, H) in CANVASES.items():
        im = Image.open(os.path.join(ROOMS, f'{name}.png')).convert('RGB')
        w, h = im.size
        d = ImageDraw.Draw(im)
        for c in range(W + 1):
            x = round(c * w / W); d.line([(x, 0), (x, h)], fill=(0, 255, 255), width=1)
        for r in range(H + 1):
            y = round(r * h / H); d.line([(0, y), (w, y)], fill=(0, 255, 255), width=1)
        for c in range(W):
            for r in range(H):
                d.text((round(c*w/W)+2, round(r*h/H)+1), f"{c},{r}", fill=(0, 255, 255))
        im.save(os.path.join(ORIG, f'{name}.png'))
        im.save(os.path.join(OUT, f'{name}_PAINT-ME.png'))
        print(f"{name}: {W}x{H} grid over {w}x{h}")
    print(f"\ncanvases -> {OUT}/*_PAINT-ME.png")


if __name__ == '__main__':
    main()
