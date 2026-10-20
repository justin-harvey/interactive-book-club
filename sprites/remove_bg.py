#!/usr/bin/env python3
"""Remove solid-color backgrounds from the 9.11 character art via border flood-fill.

Only background pixels connected to the image border are removed, so interior
colors that happen to match the background are preserved. Edges get a small
feather to avoid a hard halo.
"""
import os
import sys
from collections import deque
import numpy as np
from PIL import Image

SRC = "/home/nah/Claudia/elemonsters/sprites/9.11"
DST = "/home/nah/Claudia/elemonsters/sprites/transparent"

# color distance tolerance for "is this the background color"
TOL = 42.0


def bg_color(arr):
    """Estimate background color from the four corners (median per channel)."""
    h, w, _ = arr.shape
    s = max(2, min(h, w) // 40)  # corner patch size
    corners = np.concatenate([
        arr[:s, :s].reshape(-1, 3),
        arr[:s, -s:].reshape(-1, 3),
        arr[-s:, :s].reshape(-1, 3),
        arr[-s:, -s:].reshape(-1, 3),
    ], axis=0).astype(np.float32)
    return np.median(corners, axis=0)


def remove_bg(path, out_path):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.float32)
    h, w, _ = rgb.shape

    bg = bg_color(rgb)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    is_bg = dist < TOL

    # BFS flood fill from every border pixel that looks like background
    visited = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg[y, x] and not visited[y, x]:
                visited[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg[y, x] and not visited[y, x]:
                visited[y, x] = True
                dq.append((y, x))

    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg[ny, nx]:
                visited[ny, nx] = True
                dq.append((ny, nx))

    # visited == background to strip. Feather edges: pixels near the bg color that
    # border the removed region get partial alpha scaled by color distance.
    alpha = arr[:, :, 3].astype(np.float32)
    alpha[visited] = 0.0

    # soften a 1px transition band using distance ramp for kept pixels adjacent to holes
    ramp = np.clip((dist - TOL) / TOL, 0.0, 1.0) * 255.0
    border_kept = (~visited) & (dist < 2 * TOL)
    # only apply near removed region
    from_removed = np.zeros((h, w), dtype=bool)
    from_removed[1:, :] |= visited[:-1, :]
    from_removed[:-1, :] |= visited[1:, :]
    from_removed[:, 1:] |= visited[:, :-1]
    from_removed[:, :-1] |= visited[:, 1:]
    soft = border_kept & from_removed
    alpha[soft] = np.minimum(alpha[soft], ramp[soft])

    arr[:, :, 3] = alpha.astype(np.uint8)

    # Drop floating specks (corner sparkles etc): keep only the largest opaque
    # connected component (the character), erase everything else.
    opaque = arr[:, :, 3] > 8
    label = np.zeros((h, w), dtype=np.int32)
    cur = 0
    best_label, best_size = 0, 0
    for sy in range(h):
        for sx in range(w):
            if opaque[sy, sx] and label[sy, sx] == 0:
                cur += 1
                size = 0
                stack = [(sy, sx)]
                label[sy, sx] = cur
                while stack:
                    y, x = stack.pop()
                    size += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and opaque[ny, nx] and label[ny, nx] == 0:
                            label[ny, nx] = cur
                            stack.append((ny, nx))
                if size > best_size:
                    best_size, best_label = size, cur
    speck = opaque & (label != best_label)
    arr[:, :, 3][speck] = 0

    Image.fromarray(arr, "RGBA").save(out_path)
    removed = int(visited.sum())
    print(f"  bg={bg.astype(int).tolist()} removed {removed} px ({100*removed/(h*w):.1f}%), "
          f"cleared {int(speck.sum())} speck px")


def main():
    os.makedirs(DST, exist_ok=True)
    for name in sorted(os.listdir(SRC)):
        if not name.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        base = os.path.splitext(name)[0]
        out = os.path.join(DST, base + ".png")
        print(f"{name} -> {os.path.basename(out)}")
        remove_bg(os.path.join(SRC, name), out)


if __name__ == "__main__":
    main()
