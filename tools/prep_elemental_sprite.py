#!/usr/bin/env python3
"""Prepare ONE raw Elemental art file for the game, in a single step.

The AI art drops arrive as a creature on a flat orange field, but the frame size
and the creature's position/size within it vary from batch to batch (e.g. the
2026-10-09 batch was 1408x768 landscape with the creature small and off-centre,
while earlier batches were ~1024x1024 square). The game renders Elemental art at
a FIXED scale on the texture's NATIVE pixels (ELEMENTAL_ART_SCALE = 0.05 in
src/Scenes/GameScene.ts), so an un-normalised frame makes the creature render
tiny and/or shoved to one side of its tile.

This chains the two steps so neither is ever skipped:
  1. remove_bg  — flood-fill the flat background to transparent + erode the halo
                  (reuses tools/remove_bg.py).
  2. normalise  — crop to the creature's alpha box, centre it on a square canvas
                  with a consistent margin, resize to 1024x1024 (matches the
                  existing roster's framing, so every creature reads the same size).

Usage:
    python3 tools/prep_elemental_sprite.py IN.jpeg src/assets/elementals/<id>.png

Then register <id> (see SPRITE-BATCH-PLAYBOOK.md) and `npm run build`.
"""
import sys
from PIL import Image
from remove_bg import remove_bg

# Fraction of the square canvas the creature's larger side should fill. ~0.82
# matches the existing roster (copper's creature fills ~0.76, iron ~0.94).
FILL = 0.82
CANVAS = 1024  # final native size; keep square + equal to the rest of the roster


def normalise(path):
    im = Image.open(path).convert("RGBA")
    bb = im.getbbox()
    if not bb:
        raise SystemExit(f"{path}: image is fully transparent after bg removal — "
                         "check the source has a flat, solid background.")
    crop = im.crop(bb)
    bw, bh = crop.size
    side = int(round(max(bw, bh) / FILL))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - bw) // 2, (side - bh) // 2), crop)
    canvas = canvas.resize((CANVAS, CANVAS), Image.LANCZOS)
    canvas.save(path)
    print(f"normalised {path}  creature {bw}x{bh} -> centred {CANVAS}x{CANVAS}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: prep_elemental_sprite.py IN.(jpeg|png) OUT.png")
    in_path, out_path = sys.argv[1], sys.argv[2]
    remove_bg(in_path, out_path)   # writes OUT.png with a transparent background
    normalise(out_path)            # crop + centre + resize in place
