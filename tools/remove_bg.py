#!/usr/bin/env python3
"""Remove the solid orange background from an Elemental sprite.

The low-res pixel-art sprites (sprites/*low res*.png, neonu reeves.png) sit on a
flat orange field. We flood-fill inward from the border so orange *inside* the
character (if any) is kept, then erode the anti-aliased orange halo a couple of
passes so no fringe is left when the sprite is drawn on the game map.

No numpy in this env — pure PIL + a scanline stack flood fill (fast enough for
1024x1024). Usage:  python3 tools/remove_bg.py IN.png OUT.png
"""
import sys
from collections import deque
from PIL import Image


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def remove_bg(in_path, out_path, tol=64, halo_tol=120, halo_passes=2):
    im = Image.open(in_path).convert("RGBA")
    w, h = im.size
    px = list(im.getdata())  # flat list of (r,g,b,a)

    # Background colour = median-ish of the four corners (they're all the field).
    corners = [px[0], px[w - 1], px[(h - 1) * w], px[h * w - 1]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    tol2 = tol * tol
    transparent = bytearray(w * h)  # 1 = cleared

    # Flood fill from every border pixel that matches the background.
    stack = deque()

    def consider(i):
        if not transparent[i] and dist2(px[i], bg) <= tol2:
            transparent[i] = 1
            stack.append(i)

    for x in range(w):
        consider(x)                    # top row
        consider((h - 1) * w + x)      # bottom row
    for y in range(h):
        consider(y * w)                # left col
        consider(y * w + w - 1)        # right col

    while stack:
        i = stack.popleft()
        x = i % w
        if x > 0:
            consider(i - 1)
        if x < w - 1:
            consider(i + 1)
        if i >= w:
            consider(i - w)
        if i < (h - 1) * w:
            consider(i + w)

    # Erode the orange anti-aliased halo: any orange-ish pixel touching cleared
    # space gets cleared too. Repeat a few passes to peel the fringe.
    halo2 = halo_tol * halo_tol
    for _ in range(halo_passes):
        edge = []
        for i in range(w * h):
            if transparent[i]:
                continue
            if dist2(px[i], bg) > halo2:
                continue
            x = i % w
            if ((x > 0 and transparent[i - 1]) or
                    (x < w - 1 and transparent[i + 1]) or
                    (i >= w and transparent[i - w]) or
                    (i < (h - 1) * w and transparent[i + w])):
                edge.append(i)
        if not edge:
            break
        for i in edge:
            transparent[i] = 1

    # Kill leftover decorative orange flecks (e.g. the little corner sparkle):
    # any *small* isolated blob of surviving pixels whose mean colour is still
    # orange-ish. Size-gated so a genuinely orange character (oxyroo) — one big
    # connected blob — is never touched, and colour-gated so non-orange bits
    # (the disco-ray shine) survive.
    min_keep = int(w * h * 0.01)          # blobs under 1% of the image
    orange2 = (halo_tol + 10) ** 2
    seen = bytearray(transparent)         # treat cleared pixels as visited
    for start in range(w * h):
        if seen[start]:
            continue
        comp = []
        q = deque([start])
        seen[start] = 1
        rs = gs = bs = 0
        while q:
            i = q.popleft()
            comp.append(i)
            rs += px[i][0]; gs += px[i][1]; bs += px[i][2]
            x = i % w
            for j in ((i - 1) if x > 0 else -1,
                      (i + 1) if x < w - 1 else -1,
                      (i - w) if i >= w else -1,
                      (i + w) if i < (h - 1) * w else -1):
                if j >= 0 and not seen[j]:
                    seen[j] = 1
                    q.append(j)
        n = len(comp)
        if n < min_keep:
            mean = (rs // n, gs // n, bs // n)
            if dist2(mean, bg) <= orange2:
                for i in comp:
                    transparent[i] = 1

    out = [(0, 0, 0, 0) if transparent[i] else px[i] for i in range(w * h)]
    im.putdata(out)
    im.save(out_path)
    print(f"{in_path} -> {out_path}  bg~{bg}  cleared {sum(transparent)}/{w*h}px")


if __name__ == "__main__":
    remove_bg(sys.argv[1], sys.argv[2])
