# Art to download for the two new biomes

Both packs are itch.io "pay-what-you-want" (you can enter **$0** or tip the
creator — your call). Download them in your browser and unzip each one into the
matching drop folder below. I'll inspect them, slice the props, and generate the
maps + scenes from there — you don't need to rename or sort anything.

This mirrors how the woods pack was dropped into `sprites/woods/`.

## Level 2 — Desert
- **Pack:** PixelWorlds Desert Tileset by GrayCatGames
- **URL:** https://graycatgames.itch.io/desert-tileset
- **License:** free, commercial use OK, modify/sell works made with it
- **Unzip the whole thing into:** `sprites/desert/`

## Level 3 — Jungle / Rainforest
- **Pack:** Lost Valleys Jungle (16x16 top-down) by ilmenite
- **URL:** https://ilmenite.itch.io/lost-valleys-jungle
- **License:** confirm on the download page before shipping (grab the LICENSE/README
  from the zip too — just leave it in the folder and I'll check it)
- **Unzip the whole thing into:** `sprites/jungle/`

## After you drop them
Tell me they're in, and I'll:
1. Inspect the tilesheets, confirm they're 16x16 (and re-grid if not).
2. Slice ground/floor tiles into `src/assets/tiles/` and props into
   `src/assets/desert/` + `src/assets/jungle/`.
3. Write `tools/gen_desert.py` / `tools/gen_jungle.py` to build ~80x50 Tiled maps
   (floor / walls / overhead layers + a scenery object layer, like `gen_woods.py`).
4. Embed them (`node tools/embed-maps.mjs`) and add `DesertScene` / `JungleScene`
   (registered in `game.ts` + the `SceneName` enum).
5. Link them into the world (doors) and add both to the Dev Warp menu.

The Dev Warp overlay is already built — see below.
