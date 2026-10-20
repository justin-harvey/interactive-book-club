# Elemental Sprite Batch Playbook

How to take a fresh drop of creature art (a creature on a flat orange field, one
file per element) all the way into the shipped game — cut out, framed, wired to
the roster, questioned, placed, tracked, and built. Follow it top to bottom and
nothing gets missed. Last run: **2026-10-09** (Zn–Rb, atomic #30–37).

> One command does the art prep per sprite; the rest is editing five files +
> `npm run build`. Budget ~20 min for a batch of 8.

---

## 0. Inputs & where things live

| Thing | Location |
|---|---|
| Raw art drops | `~/Downloads/<Name>.jpeg` (newest batch = newest mtime) |
| Background-removal tool | `tools/remove_bg.py` |
| **One-step prep (bg + framing)** | `tools/prep_elemental_sprite.py` |
| Finished sprite | `src/assets/elementals/<id>.png` (1024×1024, transparent) |
| Roster | `src/data/elements.ts` (`ELEMENTS` array) |
| Art registry | `src/data/elementalArt.ts` (`ART_IDS` set) |
| Questions | `src/data/questions.ts` (`QUESTIONS` array) |
| World placement | a scene's spawn list (City = `src/Scenes/CityScene.ts` `CITY_ELEMENTALS`) |
| Isotopedex hints | `src/data/elementalLocations.ts` |
| Tracker | `isotopia-sprite-tracker.csv` |

**Naming:** `id` is the lowercase element name (`zinc`, `rubidium`). The art
filename is always `<id>.png`. The `monster` display name is whatever the art
file was called (`Zincoat`, `Rubi-Clock`) — keep it.

---

## 1. Find the new sprites

```bash
ls -lat ~/Downloads/*.jpeg | head -20
```

The newest batch is a run of files with adjacent mtimes. Map each filename to its
element + atomic number — the drops come in roster order, filling the next gap in
`isotopia-sprite-tracker.csv` (the "Needs monster design + sprite" rows). Confirm
against the tracker which atomic numbers are still missing so you grab the right run.

**Sanity-check before processing** (format the tools assume):
```bash
file ~/Downloads/<Name>.jpeg          # expect JPEG, a few hundred KB
```
Open one or two (Read the image) and confirm: a **single creature** on a **flat,
solid background**, roughly centred. If the background isn't flat/solid, `remove_bg`
won't key cleanly — stop and flag it.

---

## 2. Cut out + frame each sprite (the one easy-to-miss step)

For **each** file, one command — it removes the background **and** normalises the
framing:

```bash
cd ~/Claudia/isotopia
python3 tools/prep_elemental_sprite.py ~/Downloads/<Name>.jpeg src/assets/elementals/<id>.png
```

Example batch:
```bash
python3 tools/prep_elemental_sprite.py ~/Downloads/zincoat.jpeg      src/assets/elementals/zinc.png
python3 tools/prep_elemental_sprite.py ~/Downloads/Galli-Melt.jpeg   src/assets/elementals/gallium.png
# ...one per element...
```

**Why the framing step is NOT optional:** the game renders art at a fixed scale on
the texture's *native* pixels (`ELEMENTAL_ART_SCALE = 0.05` in
`src/Scenes/GameScene.ts`). Art drops vary in frame size and how much of the frame
the creature fills (the 2026-10-09 batch was 1408×768 with the creature small and
off to the right). If you only run `remove_bg.py` and skip normalising, that
creature renders **tiny and shoved to one side of its tile**. `prep_elemental_sprite.py`
crops to the creature, centres it on a square canvas (~82% fill), and resizes to
1024×1024 so every creature reads at a consistent size. The output print should
show a centred bbox (~`(88, …, 936, …)`).

**Verify the cutouts** — Read a couple of the output PNGs and confirm: clean edges,
no orange halo/fringe, creature centred, nothing clipped. (`remove_bg` keys off the
four corners and erodes the halo; a busy or non-solid background is the usual cause
of a bad cut.)

---

## 3. Add to the roster — `src/data/elements.ts`

Append one line per creature to the `ELEMENTS` array (keep the batch together with
a comment). `tint` is only the fallback colour if the PNG ever fails to load — pick
something close to the art.

```ts
{ id: 'zinc', symbol: 'Zn', name: 'Zinc', monster: 'Zincoat', number: 30, tint: 0xb0bec5 },
```

Fields: `id` (== filename stem), `symbol`, `name`, `monster` (art's name), `number`
(atomic #), `tint` (0xRRGGBB fallback).

---

## 4. Register the art — `src/data/elementalArt.ts`

Add each `id` to the `ART_IDS` set. **Without this the roster entry still works but
renders as a tinted placeholder NPC, not the real art.**

```ts
'zinc', 'gallium', 'germanium', 'arsenic', 'selenium', 'bromine', 'krypton', 'rubidium',
```

---

## 5. Write 3 questions each — `src/data/questions.ts`

Three MCQs per creature, appended to `QUESTIONS` (3 is the shipped minimum per
Elemental; re-catching redraws from these). Match the existing shape exactly:

```ts
{ elementId: 'zinc', angle: 'protons', prompt: "Zinc's atomic number is 30. How many protons does it have?", choices: ['15', '28', '30', '60'], correctIndex: 2, quarterTheme: 'starter' },
```

Rules: **exactly 4 choices**, `correctIndex` is 0-based, vary the three `angle`s
per creature (protons / neutrons / electrons / valence / ion / symbol / config /
classify / property / mass …), and keep them grade-appropriate. Double-check every
fact and that `correctIndex` points at the right choice.

---

## 6. Place them in the world (so scheduled releases actually spawn)

A roster entry is schedulable but invisible until it's spawned in a scene. Advanced
elements (past the starter town/woods/jungle/desert) live in the **City**
(`CITY_ELEMENTALS` in `src/Scenes/CityScene.ts`) — a `[id, x, y]` tile list.

Tiles must be **reachable** and **3×3-clear** on the `walls` layer of
`src/assets/tilemap/city_map.json` (0 = walkable), spaced ≥3 tiles from every other
elemental, the start (24,70) and the exit (30,71). Find good tiles automatically:

```bash
python3 - <<'PY'
import json
from collections import deque
m=json.load(open('src/assets/tilemap/city_map.json'))
W,H=m['width'],m['height']
walls={L['name']:L['data'] for L in m['layers'] if L.get('type')=='tilelayer'}['walls']
def blocked(x,y): return x<0 or y<0 or x>=W or y>=H or walls[y*W+x]!=0
seen={(24,70)}; q=deque(seen)                       # flood-fill reachable from START
while q:
    x,y=q.popleft()
    for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
        n=(x+dx,y+dy)
        if n not in seen and not blocked(*n): seen.add(n); q.append(n)
clear3=lambda x,y: all(not blocked(x+dx,y+dy) for dx in(-1,0,1) for dy in(-1,0,1))
occ=[(6,28),(36,40),(6,44),(46,58),(16,60),(36,60),(4,12),(34,16),(18,20),
     (18,30),(18,40),(18,50),(24,70),(30,71)]        # + any already-placed tiles
far=lambda x,y:all(max(abs(x-a),abs(y-b))>=3 for a,b in occ)
cand=[(x,y) for (x,y) in seen if 2<=x<W-2 and 2<=y<H-2 and clear3(x,y) and far(x,y)]
picked=[]
pool=set(cand)
for _ in range(8):                                   # pick 8, max-spread
    b=max(pool,key=lambda p:min(max(abs(p[0]-a),abs(p[1]-c)) for a,c in occ+picked))
    picked.append(b); pool.discard(b)
for p in sorted(picked,key=lambda p:(p[1],p[0])): print(p)
PY
```

Add the chosen tiles to `CITY_ELEMENTALS`, then add a one-line hint per creature to
`ELEMENTAL_LOCATION` in `src/data/elementalLocations.ts` (used by the Rad Finder /
Isotopedex so kids never get stuck).

> If a batch belongs in a different zone (e.g. a lesson set-piece), place it in that
> scene's spawn list instead and adjust the hint. Keep the reachability/3×3 check.

---

## 7. Teacher release scheduling — nothing to do

The teacher portal's release table iterates `ELEMENTS` (`src/teacher.ts`), so every
new creature **automatically** appears with an "Unlock day (1–40)" input. No code.

Behaviour to know (`src/data/classConfig.ts`): `DEFAULT_SETTINGS.releaseAllNow =
true`, so by default new creatures are visible immediately. A teacher who turns
"Release everything now" OFF must assign each creature an unlock day **and** set a
unit start date — anything with no reached day stays hidden.

---

## 8. Update the tracker — `isotopia-sprite-tracker.csv`

Flip the batch's rows from "Needs monster design + sprite" to Done:

```
30,Zn,Zinc,Zincoat,Yes,Yes,src/assets/elementals/zinc.png,Done
```
Columns: `Atomic #,Symbol,Element,Monster Name,In Playable Roster,Has Sprite,Sprite File,Status`.

> ⚠️ The CSV is often open in LibreOffice (look for `.~lock.isotopia-sprite-tracker.csv#`).
> Editing it on disk while it's open means LibreOffice will overwrite your change on
> its next save. Either close it first, or tell the user to reload it after you edit.

---

## 9. Build & verify

```bash
npm run build                 # must be clean (compiles TS + copies src/assets -> dist/assets)
```

Confirm the new PNGs reached the served copy and the data is consistent:

```bash
ls dist/assets/elementals/ | grep -E 'zinc|gallium|...'      # assets copied by rollup

python3 - <<'PY'
import re,os
ids=['zinc','gallium','germanium','arsenic','selenium','bromine','krypton','rubidium']
els=open('src/data/elements.ts').read(); art=open('src/data/elementalArt.ts').read()
q=open('src/data/questions.ts').read()
for i in ids:
    ok=(f"id: '{i}'" in els, f"'{i}'" in art, os.path.exists(f'src/assets/elementals/{i}.png'),
        len(re.findall(rf"elementId: '{i}'",q)))
    print(i, ok, 'OK' if all(ok[:3]) and ok[3]==3 else 'PROBLEM')
PY
```

Each row should read `(True, True, True, 3)`. Then — ideally — boot the game and
confirm one new creature renders at the right size in the City and its quiz fires.

---

## Quick checklist

- [ ] Grabbed the newest `~/Downloads/*.jpeg` run; mapped each to element + atomic #
- [ ] `prep_elemental_sprite.py` run per file → `src/assets/elementals/<id>.png` (centred 1024²)
- [ ] Eyeballed cutouts (clean edges, centred, no halo)
- [ ] `ELEMENTS` entry per creature (`elements.ts`)
- [ ] `ART_IDS` entry per creature (`elementalArt.ts`)
- [ ] 3 questions each, 4 choices, correct index verified (`questions.ts`)
- [ ] Placed in a scene at reachable 3×3-clear tiles (`CityScene.ts`) + hints (`elementalLocations.ts`)
- [ ] Tracker rows flipped to Done (mind the LibreOffice lock)
- [ ] `npm run build` clean; PNGs in `dist/`; integrity check all `(True,True,True,3)`
