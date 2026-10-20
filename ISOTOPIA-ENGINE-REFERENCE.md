# Isotopia — Session Handoff

A running summary of what this is and where it stands, so work can resume after a
context reset. Last updated 2026-10-04.

## ▶ NEXT SESSION — planned work (Justin, 2026-10-02)
Open asks below with root cause, exact files, and a recommended path. Task #2 (totem trim) is DONE +
merged. Tasks #1 (water) and #3 (gameplay redesign) are not started. A pre-reset content audit
(art / questions / gameplay) is captured in the next section.

## 📋 Pre-reset content audit (2026-10-02)
Snapshot of roster health + a gameplay critique Justin asked for before a context reset.

### Elemental ("elemonster") art — 26 real / 0 placeholder / 0 missing ✅
26 creatures defined in `data/elements.ts`; every one is registered in `data/elementalArt.ts` `ART_IDS`,
so none fall back to the bare tinted-NPC sprite. **All 26 now have real art** (no placeholders left):
- **Real art (26):** hydrogen, helium, carbon, nitrogen, oxygen, fluorine, neon, sodium, magnesium,
  aluminum, silicon, phosphorus, sulfur, chlorine, argon, scandium, iron, uranium, beryllium, boron,
  plus the flame-test metals **potassium, copper, barium, lithium, strontium, calcium**.
  (Si/P/Cl/Ar are real Gemini art with the orange bg stripped, added 2026-10-01i.)
- **Flame-test six — real art shipped 2026-10-04:** potassium (Kaliflare), copper (Cupragleam),
  barium (Bariglow), lithium (Lithflare), strontium (Stronflare), calcium (Calciglow). Gemini art,
  orange bg stripped via `tools/remove_bg.py` → `src/assets/elementals/<id>.png`. The procedural
  placeholders they replaced can be regenerated with `tools/gen_placeholder_elementals.py`.
- **Stray file:** `src/assets/elementals/neonu-reeves.png` exists on disk but is NOT in `ART_IDS`
  (27 files, 26 mapped) — an unused alt/easter-egg sprite; harmless, left as-is.
- **Totem art (separate from creatures): all placeholder.** Carved-stone monoliths from
  `tools/gen_totems.py`; real animal-spirit art is nice-to-have. After the 8-totem trim only 8 totem
  PNGs are used (carbon, neon, sodium, aluminum, silicon, argon, scandium, iron); the other 5
  (nitrogen, oxygen, phosphorus, sulfur, chlorine) remain on disk but **unplaced**.

### Questions — every creature meets the ≥3 minimum ✅
All **26 elements have exactly 3** seed questions (78 total) in `data/questions.ts`. **None are
deficient** — no creature needs more to clear the bar. Notes:
- Teachers can add/override via Firebase RTDB `questions` node (`data/questionSource.ts`), so the bank
  can grow without code.
- Optional (not required): all 78 are 4-option MCQ (one modality) and re-catching an Elemental redraws
  from just its 3, so repeats come quickly. Bumping the hero/early creatures to 4–5 and adding
  non-MCQ item types would reduce fatigue (ties into the gameplay redesign below).

### Gameplay critique (jungle + desert tests) — "repetitive, hardly memorable"
Honest read of the two lesson set-pieces as learning-for-kids:
- **Core catch loop:** walk up to a wild Elemental → one 4-option MCQ → caught. Clean, but it's the
  same modality every time (see questions note).
- **Jungle "Canopy Energy Network" (`CanopyOverlay`) — the weakest.** Every totem is the *identical*
  interaction: +/- step electron-seeds up the lattice rung by rung, confirm each rung, repeat. Only the
  target numbers change. Trimming 13→8 helped the length, but it's still the same stepper 8×.
  Pedagogically sound (drills Aufbau) but mechanically monotonous and low on memory hooks — no stakes,
  no per-creature personality beyond a blurb, no spatial/visual mnemonic.
- **Desert "Flame-Test Beacons" (`BeaconOverlay`) — the stronger one.** A deduction puzzle: match a
  caught element's flame colour to each beacon, with teachable collisions (multiple greens/reds) and
  decoys (sulfur blue, magnesium white), plus a cloaked hidden-creature hunt (Rad Finder). Genuinely
  more memorable; the pyramid-rise payoff is a nice beat.

**Recommended direction (new task #3 below):** keep the strong bones (desert deduction, hidden hunt,
visible payoffs); attack the jungle's monotony by *varying the interaction* instead of repeating one
stepper, giving each spirit a tiny memorable reaction, and making most totems optional (3 required,
rest bonus). Add retrieval callbacks (an element met in town → configured in jungle → burned in desert)
and a couple of non-MCQ question types. Full task spec in **### 3** below.

**Bug found during the audit (desert beacons, 3-vs-5):** the puzzle actually **requires all 5** beacons
(`BeaconOverlay.solved()` = `litCount() === BEACONS.length`, meter label "N of 5"), and the README is
correct (5). BUT `BeaconOverlay`'s meter hard-codes `aria-valuemax="3"` (a11y bug — should be
`BEACONS.length`), and `DesertScene.ts` still has stale "three cold flame-test beacons" / "Match all
three" comments (and its header lists Sulfur=blue as a beacon colour, but it's a decoy). Comment/a11y
only, not a logic bug. Quick fix worth doing with task #3.

### 1. Remove the yellow/orange "triangle" texture from ALL water
**Symptom (Justin):** every body of water shows repeating orange/tan triangular blobs; worst in the
**Town lake** at the first town, where it tiles on an obvious grid.
**Root cause (traced this session — one source, three surfaces):** the orange specks are baked into
the **desert oasis** water art — `src/assets/tiles/desert_tileset.png` cells **(4,2)** and **(5,1)**.
Each 16px cell is ~11% orange/tan pixels (sandy-shore speckle; RGB ≈ (183,134,67), (203,149,69),
(212,155,71)) over a teal body (≈ (96,159,159) / lighter (98,192,196)). That one art propagates to
every water surface in the game:
- **Town lake** → `TestScene.drawLake()` tiles `src/assets/tiles/water.png`, which
  `tools/slice_water.py` lifts from `jungle_tileset.png` cells **6 & 7** (= the same oasis cells),
  laid 2×2 into a 32×32 POT tile → the blobs repeat on a grid (why the lake is the worst case).
- **Jungle ponds** → `JungleScene` paints tilemap water from `jungle_tileset.png` cells 6 & 7, which
  `tools/slice_jungle.py` sets to `water_fill = dcell(4,2)` / `water_v = dcell(5,1)` (borrowed oasis).
- **Desert oasis** → `DesertScene` uses `desert_tileset.png` oasis cells directly.
So **fixing the source fixes all three.**
**Recommended fix (single source → rebuild chain):**
1. De-speckle the two oasis water cells — mask the orange/tan range and fill with the surrounding
   teal (flat teal, or nearest-neighbour fill). Cleanest as a small step in/alongside
   `tools/slice_water.py` (or a new `tools/clean_water.py`) so it's idempotent and re-runnable.
   *Alternative:* swap to the pack's dedicated clean jungle water at
   `sprites/jungle/Lost_Valleys_Main_Free/Tilesets/Standart_Tilesets/Water_Tileset_Standart_1-Sheet.png`
   (or `Dual_Tilesets/Water_Dual_1.png`) as a fresh source — nicer/animatable, but a bigger re-slice
   and a palette shift across levels.
2. Propagate to the tilemap surfaces (jungle ponds + desert oasis read the *tileset* cells, not
   `water.png`): re-slice the cleaned cells into `jungle_tileset.png` (`slice_jungle.py`) and the
   desert tileset, then **re-embed maps** (`tools/embed-maps.mjs`) if the tilesets changed — OR repaint
   those bodies as drawn TileSprites off the clean `water.png`, the way the Town lake already does.
3. Re-run `slice_jungle.py` → `slice_water.py` → `npm run build`, copy assets to `dist/`, and
   visual/E2E-check the Town lake + a jungle pond + the desert oasis all read as flat clean water
   (0 orange pixels — the pixel-count probe from this session can confirm).
**Open decision:** patch-the-pixels (minimal, keeps the exact teal palette + texture-consistency) vs
swap to the Lost_Valleys clean-water tileset. **Recommend patch-the-pixels for v1.**
This extends the existing "🎨 Texture consistency" open item below (which already noted the oasis
cells (4,2)/(5,1) as the shared water source).

### 2. ✅ DONE (2026-10-02) — trimmed the jungle totem test from 13 to 8 (kept the d-block climax)
**Goal (Justin):** the Canopy Energy Network test was too long/repetitive at **13 totems**. Shorten it.
**Decision (Justin, 2026-10-02):** cut to **8 totems**, and **keep the 4s-before-3d swap as the
finale** (Scandium + Iron). This supersedes the earlier sketch in this slot, which had proposed a
harder cut to **2 totems + exposition/dialogue**; that is NOT what shipped. No guide-NPC / extra
exposition copy was added (the eight distinct totems carry the lesson), so that idea stays available
as a future polish if wanted.
**Why it was low-risk:** everything keys off the **`TOTEMS` array in `src/data/aufbau.ts`** and
`TOTEMS.length`, so completion, the power meter, "Totem X of N", and "N / M totems configured" all
re-derive automatically. A grep confirmed no hard-coded count (only comments said 13/9).
**What shipped:**
1. `src/data/aufbau.ts` — reduced `TOTEMS` to a curated **8-totem arc**, each a distinct lesson beat,
   ending on the d-block swap: Carbon (2p²) → Neon (full 2p⁶, noble) → Sodium (3s) → Aluminum (3p¹) →
   Silicon (3p²) → Argon (full 3p⁶, noble) → **Scandium** → **Iron** (the 4s-before-3d finale).
   Dropped as totems: Nitrogen, Oxygen, Phosphorus, Sulfur, Chlorine.
2. `src/Scenes/JungleScene.ts` — `TOTEM_TILES` re-spaced from 13 coords to **8**, spread the full
   corridor length (y45 → y4) so the shorter set still climbs south→north to the Desert pad rather
   than bunching at the entrance; every y is drawn from the originally verified-walkable set.
3. **Dropped elements stay catchable:** Si/P/Cl/Ar remain jungle wild-spawns
   (`JungleScene.createNpcs` / `WILD_ELEMENTALS`) and valid dex Elementals; P and Cl simply no longer
   have totems. Their generated totem PNGs on disk are harmless when unplaced. The wild-Elemental
   comment in `JungleScene` was updated to say so honestly.
**Verified:** `npm run build` clean (Node 22). **Shipped — merged to `main` 2026-10-02 (PR #2, squash
commit `a72d0a5`); Netlify auto-deploying to is0topia.netlify.app.** NOT yet E2E-driven or
real-browser-checked this change — a follow-up should confirm the jungle boots with exactly 8 totems
placed and configuring all eight → banner / "8/8 totems configured" / Canopy Key / grove celebration
with 0 console errors. (`?e2e` trips the dormant-until-caught bypass, so also confirm the "sleeps until
caught" gate in a real browser; and Scandium/Iron must have been caught earlier or their totems stay
dormant. Service-worker/PWA cache can serve the old 13-totem bundle until a hard refresh.)

### 3. Make the lesson gameplay less repetitive + more memorable for kids (NOT started)
**Goal (Justin, 2026-10-02):** the jungle/desert tests feel repetitive and aren't memorable enough for
kids. Rework toward variety + memory hooks. See the "Gameplay critique" in the audit section above for
the full read. This is a design task — recommend scoping a small v1 rather than a big rewrite.
**Suggested v1 scope (pick a subset, ship incrementally, each headless-verifiable):**
1. **Break the jungle's one-stepper monotony (`CanopyOverlay`).** Don't repeat the identical fill 8×.
   e.g. keep the guided stepper for the first 1–2 totems to teach it, then switch later totems to a
   *recognition* variant (pick the correct config from 4 options) and make the Sc/Fe finale a distinct
   "catch the 4s-before-3d trap" beat. Variety is the point.
2. **Fewer required, more optional.** Make ~3 totems required to power the network and the rest bonus
   (right now all 8 are required). Keep Sc/Fe reachable as the finale. Lets a kid finish faster but
   rewards curiosity.
3. **Per-spirit memory hook.** On waking a totem, play a 1-line in-character reaction + a small distinct
   animation (the `blurb` strings already exist; add a spoken beat + unique cue) so element↔animal pairs
   stick.
4. **Retrieval callbacks across levels.** Reuse the same roster deliberately: when you configure/burn an
   element you met earlier, surface a one-liner ("You met Sodium in town — now watch it burn yellow").
   The shared roster already supports this; just add the callbacks.
5. **Non-MCQ question types in the catch loop (`QuizOverlay`).** Add true/false, symbol↔name match, or
   "tap the element on a mini periodic table" so encounters aren't all identical 4-option MCQ. Ties to
   the questions-audit note (more variety per creature).
6. **Fold in the beacon fixes** from the audit (meter `aria-valuemax` → `BEACONS.length`; refresh the
   stale "three beacons" comments + decoy wording in `DesertScene.ts`).
**Files:** `src/ui/CanopyOverlay.ts`, `src/data/aufbau.ts` (required-vs-bonus flag), `src/ui/QuizOverlay.ts`
+ `src/data/questions.ts` (item types), `src/ui/BeaconOverlay.ts` / `src/Scenes/DesertScene.ts` (beacon
fixes), `src/Scenes/JungleScene.ts` (per-spirit reaction). **Verify:** `npm run build` + the `?e2e`
harness per lesson.

## Shipped (2026-10-02) — jungle lesson + 4 Elementals merged to `main` → deploying
The 2026-10-01g/h/i work below — the Jungle **"Canopy Energy Network"** lesson (Phases 0–4) plus the
four new 3p-block Elementals **Si/P/Cl/Ar** — was reviewed on **PR #1** and **merged to `main`**
(fast-forward, commit `982480a`); Netlify is auto-deploying it to is0topia.netlify.app (`FIREBASE_*`
env already set). The merged `jungle-canopy-lesson` branch was deleted. This supersedes the
"NOT committed/pushed" notes in the three entries below. Only non-art follow-ups remain: real
animal-spirit totem art (placeholders are in place), a possible label-density tweak (the corridor was
since trimmed to 8 totems — see NEXT SESSION task #2), and a real-browser check of the
dormant-until-caught gate (`?e2e` can't exercise it).

## New this session (2026-10-01i) — 4 new Elementals (Si/P/Cl/Ar) complete the 3p block + jungle grows to 13 totems
Added the four roster gaps in Z1–20 as real, catchable Elementals with **real Gemini art** (Justin
made them; I stripped the orange backgrounds via border flood-fill — `/tmp/pw/strip_orange.py` —
preserving Argon's intentional detached cloud puffs). This completes the 3p progression Al→Si→P→S→
Cl→Ar, so the jungle lesson's totem corridor is now a full period-2-and-3 electron-config tour.
- **Elementals:** `data/elements.ts` +silicon(14, Silichip, blue-grey), +phosphorus(15, Phosflare,
  amber), +chlorine(17, Chlorofizz, yellow-green — **revived from retirement**), +argon(18,
  Argosnooze, lavender). Registered in `data/elementalArt.ts` `ART_IDS`; art at
  `src/assets/elementals/<id>.png`. **Chlorine already had 3 quiz questions** (old name "Chlorzap")
  so only the comment changed; silicon/phosphorus/argon got **3 questions each** (incl. a `config`
  angle tying to the jungle lesson) in `data/questions.ts`. Rad-Finder hints in
  `data/elementalLocations.ts` (all four = roaming the Jungle).
- **Wild spawns:** `JungleScene.createNpcs()` (was an empty stub) now spawns the four cloaked in the
  jungle clearings off the totem corridor (`WILD_ELEMENTALS` + `SPAWN_CANDIDATES`, walkability-
  filtered like the desert); loads the NPC sheet + their art in `loadElementalImages()`. So you catch
  them in the jungle, then wake their totems.
- **Totems 9 → 13:** `data/aufbau.ts` `TOTEMS` gains Silicon(Beetle), Phosphorus(Lanternfly),
  Chlorine(Mantis), Argon(Sloth — sleepy/inert, a nice fit) inserted in Aufbau order; Argon is a
  second noble-gas "full shell" capstone mirroring Neon. `JungleScene.TOTEM_TILES` expanded to 13
  verified-walkable corridor tiles (Carbon y45 → Iron y4). `tools/gen_totems.py` regenerated the
  carved-stone totem sprites for all 13 (new ids appended so the original 9 keep their seeds/art).
- **Verified:** `npm run build` clean (Node 18) + **E2E headless** (chromium-1243 + Node 22 CDP,
  `/tmp/pw/canopy-verify4.mjs`): jungle boots with **13 totems placed + 13 carved sprites**, all 4
  new **elemental art + totem art textures load**, all **4 wild Elementals spawn** (grid chars =
  player + 4 + 2 doors; `/tmp/pw/chk-spawns.mjs` lists npc7–10); driving the whole network =
  **exactly 60 Aufbau-ordered rung confirms** (vs 40 before) → banner, "13/13 totems configured",
  100%, 13 gems lit, awakening cue fired, store+Canopy-Key persisted, **0 console errors**. Overworld
  shot `/tmp/pw/jungle-3p-totems.png` shows the new totems in order. (Dex-card render wasn't captured
  — a synthetic DEX-button click didn't open the overlay headlessly; cosmetic only, the art is the
  same PNG the dex `<img>` shows.)
- **Shipped — merged to `main` 2026-10-02 (PR #1, `982480a`).** Minor polish noted: with 13 totems ~3–4 tiles apart the big floor spirit-
  labels read a bit dense at play zoom (the carved symbol + overlay already name each) — could shrink
  or drop the labels later. `isotopia-next-batch.csv` Si/P/Cl/Ar marked DONE.

## New this session (2026-10-01h) — Jungle Lesson Two Phase 4: polish + art (totems, fireflies, awakening cue)
Finished `JUNGLE-LESSON2-PLAN.md` **Phase 4** on top of the 2026-10-01g build (below). The totems are
no longer bare step-on pads — they're carved stone shrines, with ambient life and a completion payoff.
- **Totem sprites (`tools/gen_totems.py` → `src/assets/jungle/totem-<id>.png`, 9 files):** procedurally
  composed carved-granite monoliths (NW-light bevel like `gen_pyramid.py`), each with a **gem socket
  "spirit eye"** and the **element symbol carved in** (C, N, O, Ne, Na, Al, S, Sc, Fe), mossed on the
  shaded side. PLACEHOLDER art (nicer animal-spirit totems welcome — now tracked in `ART-NEEDED.md`
  🟢; overwrite the PNG + rebuild, no code change). Preview: `tools/totems_preview.png`.
- **`JungleScene` wiring:** `loadTotemImages()` loads them; `placeTotems()` now stands each totem
  **just north of its trigger tile** (base at the tile's top edge, depth `CHAR_DEPTH-1`) so the dog
  is never hidden when you step on the pad, keeps the `drawDoorCue` floor affordance, and positions
  the lit gem on the carved face via `GEM_FRAC` (= the socket's y-fraction, printed by the tool —
  **keep in sync**). Missing art falls back gracefully (cue still works).
- **Ambient electron-seed fireflies:** `spawnTotemFireflies()` drifts two amber `canopy_seed` glows
  (in-scene generated texture, no asset) up from each totem, looping; **skipped under
  prefers-reduced-motion**.
- **Gem glow on solve:** `lightTotem()` now lights a pulsing gem in the totem's colour **on its face**
  (was a floor circle), relit on load for returning players.
- **Completion cue = the Canopy Key payoff (resolves plan open-decision #4):** `celebrateCanopy()`
  fires once when the overlay closes after the final totem — all totems light (persistent "grove of
  light"), a **green camera flash + staggered gem bursts + a "The Canopy Energy Network awakens!"
  title**. It is a **bonus, not a gate** (the Jungle→Desert pad was always open). No new zone is
  unlocked (none exists; out of scope) — decision #4 settled as this cosmetic grove + the dex card.
  Reduced-motion shows just the title + lit totems. A returning player who already finished sees the
  lit grove with **no replay** (`canopyCelebrated` set on load).
- **Verified:** `npm run build` clean (Node 18) + **E2E headless** (chromium-1243 + Node 22 CDP,
  `/tmp/pw/canopy-drive3.mjs`): jungle boots with **9 totem sprites placed** (texture loaded) + cues
  intact; driving the whole network = 40 rung confirms → banner/100%/store/key as before, **9 gems
  lit**, `canopyCelebrated:true`, awakening **title rendered**, **0 console errors**; a reload relights
  all **9 gems on load** (`/tmp/pw/relight-check.mjs`, 0 errors). Overworld screenshot
  `/tmp/pw/jungle-totems.png` (carved totems + lit gems + fireflies along the corridor).
- **Shipped — merged to `main` 2026-10-02 (PR #1).** The jungle lesson is now feature-complete (Phases 0–4). Nice-to-haves
  left: real animal-spirit totem art (placeholder in place), optional s/p/d/f ruin landmark props
  (dropped from scope — the totems carry the lesson), and the still-unobservable-headlessly no-catch
  gate (the `?e2e` flag trips the dev bypass) — worth a real-browser confirm.

## New this session (2026-10-01g) — Jungle Lesson Two BUILT: the "Canopy Energy Network" (electron configuration)
**The jungle lesson/test is live in code (Phases 0–3 of `JUNGLE-LESSON2-PLAN.md`).** The jungle was
explore-only; it now teaches **electron configuration** via dormant animal-spirit **totems** that line
the northward corridor — a near-clone of the sanctum forge, exactly as the plan mapped.
- **Phase 0 — data (`src/data/aufbau.ts`):** `CAPACITY` (s2/p6/d10/f14), `FILL_ORDER` (encodes the
  4s-before-3d swap), `configFor(z)` (ground-state config as ordered rungs), `configString(z)`
  ("1s² 2s² 2p²"), `isAufbauSwap`, and `TOTEMS` (9 caught-elsewhere Elementals w/ spirit name+gem:
  Carbon/Jaguar … Iron/Panther). Configs are DERIVED from `elements.ts` atomic numbers, never
  authored. Unit-checked against C/O/Ne/Na/Al/S/Ar/Sc/Fe (all pass incl. the 4s-before-3d swap).
- **Phase 0 — flag (`progress.ts`):** canopy store `isotopia.canopy.v1` (`attuneTotem`/`isTotemAttuned`/
  `attunedTotemCount`/`markCanopyAttuned`/`isCanopyAttuned`), own local-only key like resonance/items;
  completing all totems grants the **`CANOPY_KEY`** item (back-filled on load). Same schema-safety
  pattern (kept out of the cloud `students/{uid}` object).
- **Phase 1 — the overlay (`src/ui/CanopyOverlay.ts` + `.canopy-*` in `index.css`):** cloned from
  `ResonanceOverlay`. A one-totem-at-a-time puzzle: channel electron-seeds up a **vertical orbital
  lattice** (1s roots at the bottom → crowns at the top), one rung at a time, **in Aufbau order** (next
  rung locked until the current is full), press-and-hold ＋/− steppers, a live config readout, and
  confirm-when-exact. Overfilling a partial final sublevel fizzles + teaches ("Carbon's electrons run
  out here; p could hold 6"). The 4s-before-3d rung surfaces an "⚡ Aufbau surprise" note. Jungle
  palette (green panel, amber bioluminescent seeds). All totems done → "network powered" summary +
  banner. The verticality lives in the OVERLAY (the overworld stays top-down — you walk between totems).
- **Phases 2–3 — totems + reward (`JungleScene.ts`, `Isotopedex.ts`):** 9 totems on **verified-walkable**
  tiles up the central corridor (col 40, y44→y5; Carbon at the entrance, Iron by the Desert pad),
  `drawDoorCue(spirit, '✦')`. `movementStopped` → `onApproachTotem`: already-configured → a dialog
  echoing its config; else **dormant until you've CAUGHT that element** (`?dev`/`?debug`/`?e2e` bypass);
  woken → opens the overlay; a soft gem-coloured aura lights each configured totem (relit on load).
  Completing the set awards a **"Canopy Key" secret dex card** (`makeCanopyKeyCard`, green, outside the
  "/N caught" tally; adds to the ✦ secrets count). **The Jungle→Desert pad stays open regardless** —
  the lesson is **rewarded, not required** (decision #2; desert is already gated by `GIZA_CRYSTAL`).
- **Verified** `npm run build` clean (Node 18) + **E2E headless** (chromium-1243 + Node 22 CDP,
  `?e2e&dev`, `/tmp/pw/canopy-drive.mjs`): jungle boots with **9 totems placed** + CITY/DESERT cues
  intact; driving the whole network through the overlay DOM made **exactly 40 Aufbau-ordered rung
  confirmations** (3+3+3+3+4+5+5+7+7, incl. Sc/Fe 4s-before-3d) → banner shown, "9/9 totems configured",
  "Network power 100%", store `complete:true` + all 9 attuned, `canopy-key` granted; after a **reload**
  the store + key persist and all 9 totem glows relight; **0 console errors**. Screenshot
  `/tmp/pw/canopy-summary.png` (overlay renders behind the undismissed boot intro — cosmetic only).
- **Shipped — merged to `main` 2026-10-02 (PR #1); Phase 4 followed (see the 2026-10-01h entry).** At the time of writing the remaining item was **Phase 4 (polish/art):** totem spirit art
  (currently just the `drawDoorCue` pad + a glow; see `ART-NEEDED.md`), electron-seed/firefly particles,
  s/p/d/f ruin landmark props, a short "gate rises" cue, and deciding what (if anything) the Canopy Key
  bonus unlocks (open decision #4 in the plan — today it's the dex card + flag). The no-catch gate path
  is unobservable headlessly (the `?e2e` flag also trips the dev bypass, same as the desert altar) —
  worth a real-browser check that a totem stays dormant until its element is caught.

## New this session (2026-10-01f) — level progression rewired to City → Jungle → Desert + Lesson-2 plan
**Walk order is now Town → Woods → City → Jungle → Desert** (was City → Desert → Jungle). Justin's
call so the pedagogy flows L1 sanctum → **L2 jungle (electron config)** → L3 desert (emission). This
supersedes the "Chain is now … City → Desert → Jungle" lines in the older 2026-09-30 biome notes
below. Link-only change (pads teleport; the jungle map stays geographically north of the desert):
- **City** `(18,71)` pad → **Jungle** (was Desert), relabelled `JUNGLE ▼` (`CityScene`).
- **Jungle**: south pad `(40,49)` → **City** (relabelled `CITY ▼`; = the arrival/entrance); **new**
  north pad `(40,0)` → **Desert** (`DESERT ▲`) so you traverse the jungle to the finale (`JungleScene`).
- **Desert**: south pad `(40,49)` → **Jungle** (was City; the back-link, relabelled `JUNGLE ▼`); the
  old north `(40,0)` → Jungle pad was **removed** (the desert is the end — no onward exit) (`DesertScene`).
- **Desert gate unchanged:** still only `GIZA_CRYSTAL` (the sanctum). The jungle is NOT a desert
  prerequisite (Justin: "already gated by completing the sanctum"), so the Jungle→Desert pad stays
  open regardless of any jungle lesson. DevWarp already lists Jungle (lvl2) before Desert (lvl3).
- **Verified** headless (chromium-1243 + Node 22 CDP, `?e2e&dev`): build clean; each modified scene
  boots ready with **0 errors** and its door CUES match the new graph — city = `WOODS ▼` + `JUNGLE ▼`,
  jungle = `CITY ▼` + `DESERT ▲`, desert = `JUNGLE ▼` only (`/tmp/pw/boot-scenes.mjs`). Each cue is
  paired with its Door's `nextScene`, so matching cues = correct links. The live scene-to-scene
  *switch* itself isn't observable headlessly (swiftshader saturates the renderer during the heavy
  80×50/52×72 map loads and wedges CDP — same limitation as the pyramid-rise); worth a 30s
  real-browser smoke test (`npm run watch` → City south `JUNGLE` pad → Jungle north `DESERT` pad).
- **Lesson-2 design mapped:** `JUNGLE-LESSON2-PLAN.md` — the "Canopy Energy Network" (electron
  configuration: s/p/d/f capacities, Aufbau order, block puzzles) as a **clone of the sanctum forge**
  (`ResonanceOverlay`/`resonance.ts` → `CanopyOverlay`/`aufbau.ts`), totems = caught Elementals,
  verticality lives in the overlay (top-down game, no platforming). Not built yet; Phase 0 = the data
  backbone (`configFor(z)`).

## New this session (2026-10-01e) — texture consistency: Town lake uses the Jungle water
First task of the **texture-consistency initiative** (Open items) shipped: the **Town lake now uses
the canonical jungle/oasis water texture** instead of its old flat-blue drawn fill. New
`tools/slice_water.py` lifts the two water cells (6 & 7) out of the composed `jungle_tileset.png`
into a power-of-two `src/assets/tiles/water.png` (32×32 = a 2×2 of the water variants, so a
TileSprite tiles it cleanly with GL REPEAT, no bleed). `TestScene.drawLake()` now lays a
`tileSprite('water_tex')` over the lake rect, clipped by a rounded-rect geometry mask (same
stylised pond shape, grass still shows in the corners) with a dark-teal rim; the faux-ripple
highlights are gone, the LAKE label stays. **Verified** headless (chromium-1243 + Node 22 CDP,
`?e2e&dev`): build clean, `water_tex` loads, the TileSprite sits exactly on the lake cells
(384,240,224×112), renders as teal textured water, **0 console errors** (`/tmp/pw/lake-shot.mjs` →
`/tmp/pw/town-lake.png`). The texture is identical pixels to the jungle ponds. *(Cosmetic note: a
big rectangular lake makes the 32px tile's repeat a bit visible as a diagonal; the jungle's small
organic ponds hide it. Fine for now; a bigger/organic water tile or a shoreline would soften it.)*
**Next in the initiative:** extend the same `water.png` to the desert oasis, then audit dirt/grass/
stone/paths so every zone shares one palette.

## New this session (2026-10-01d) — level renumber (Jungle = 2, Desert = 3) + elementals hidden
- **Levels swapped:** the **Jungle is now level 2** and the **Desert is level 3** (the Desert holds
  the crystal-gated Lesson-Three flame-test finale, so it's the higher tier). This is a
  **label/numbering change only** — DevWarp labels (jungle listed first now), scene comments,
  README, credits. The physical walk-adjacency is unchanged (City→Desert→Jungle on the map); the
  "level" now reflects content tier, not walk order. *(Open option if wanted: rewire so you walk
  City→Jungle→Desert — bigger change, needs a second jungle door; not done.)*
- **Flame Elementals hidden:** the 6 metals now spawn tucked beside the desert's features (oasis
  edges, cliff feet, dirt pits, corners) instead of open sand, and `spawnElemental` already cloaks
  them (near-invisible by eye; the Rad Finder homes in) — so catching all six is a real hunt.
  `DesertScene.SPAWN_CANDIDATES` (12 tucked tiles, walkability-filtered to the first 6). Verified
  headless: all 6 still spawn, 5-beacon puzzle solves → rise, 0 errors.

## New this session (2026-10-01c) — 6 flame-test Elementals added (real art shipped 2026-10-04)
Added the six classic flame-test metals as real, catchable Elementals so the beacon puzzle uses
the authentic palette: **Potassium, Copper, Barium, Lithium, Strontium, Calcium** (`data/elements.ts`,
18 new quiz questions incl. a `flame`-colour angle, placed as wild spawns in `DesertScene.createNpcs`
on walkability-filtered sand). The beacon puzzle expanded from 3 to **5 beacons** (yellow/green/lilac/
red/orange) with the Cu/Ba/B "all green" and Li/Sr "both red" collisions as teachable gotchas; S(blue)
and Mg(white) are now distractors. **Art status: REAL art shipped 2026-10-04** — Gemini pixel art
(orange bg stripped via `tools/remove_bg.py`) replaced the earlier placeholders in
`src/assets/elementals/{potassium,copper,barium,lithium,strontium,calcium}.png`; already in
`elementalArt.ts` ART_IDS, so no code change. The old placeholders can be regenerated with
`tools/gen_placeholder_elementals.py`. Tracked as ✅ DONE in `ART-NEEDED.md`.
Verified headless (`?e2e&dev`): all 6 spawn + load as art, 5 beacons solve → rise, **0 console errors**.
Deploy note: they spawn by default (`releaseAllNow:true`); a scheduled class must release them.

## New this session (2026-10-01b) — Flame-test puzzle raises the pyramid (model pivot)
**The flame-test puzzle is OUTSIDE in the desert and solving it raises the pyramid.** Justin
pivoted the design mid-build: the earlier plan put the flame test *inside* a risen pyramid
interior; that interior (`PyramidScene`) was built then **deleted**. There is no pyramid
interior — do not rebuild one unless asked. Shipped (Phase 2 / Puzzle A, see
`DESERT-LESSON3-PLAN.md`):
- **Flame-test fuels = Elementals you've CAUGHT** (not dusts, not new creatures). Beacons use
  roster elements with real flame colours: **Na→yellow, B→green, S→blue** (**Mg→white** =
  distractor). Data: `src/data/flameTest.ts`.
- **Puzzle UI:** `src/ui/BeaconOverlay.ts` (pure DOM, cloned from `ResonanceOverlay`): tap a
  beacon, tap one of your caught Elementals to "burn" it; match lights the beacon, mismatch
  fizzles + teaches. All three lit → "Raise the pyramid ▸" → runs the rise. CSS `.beacon-*`
  in `src/index.css` (warm sandstone/fire theme). Dev/e2e sees all fuels.
- **Gate = the sanctum crystal.** `DesertScene.onApproachAltar()` (renamed from
  `tryRaisePyramid`) opens the puzzle only if `hasItem(GIZA_CRYSTAL)` (dev bypass); solving it
  (overlay `onSolved`) calls the existing `playPyramidRise()`. Three `beacon_orb` braziers sit
  dark by the buried apex and `lightBeacons()` catches them in colour as the pyramid rises.
- **Verified:** `npm run build` clean; headless (chrome-1243 + Node 22 CDP, `?e2e&dev`) — desert
  boots with 3 braziers, overlay = 3 beacons + 4 fuels, solving lights all 3 → raise button →
  confirm closes overlay + `rising=true`, **0 console errors**. Still needs a real-browser look
  at the rise *animation* (software-GL starves headlessly) and the **no-crystal gate** path
  (the `?e2e` flag also trips the dev bypass, so it's unobservable headlessly).

## New this session (2026-10-01) — Desert "Lesson Three": the pyramid rises
**Started the desert's lesson-three set-piece** — a hidden pyramid that the Atlantis sanctum
crystal raises from the sand. Full design + phased plan: **`DESERT-LESSON3-PLAN.md`** (topic:
light / EM radiation / `c=λν`, `E=hν` / flame-test emission; three puzzles map onto the existing
EvolveOverlay dial + ResonanceOverlay stepper + item store). Shipped this pass (Phases 0–1):
- **Sanctum crystal is now an item.** `GIZA_CRYSTAL` (`'giza-crystal'`) added to the `progress.ts`
  item store, granted inside `markEnlightened()` (+ load-time back-fill for already-enlightened
  players), local-only like the Magic Key. No new dex card (Enlightenment already awards one).
- **Tile-composed pyramid sprite.** `tools/gen_pyramid.py` builds a stepped ziggurat from the
  GrayCatGames desert tiles + procedural step shading (no store art), emitting
  `src/assets/desert/pyramid.png` (risen) + `pyramid-buried.png` (pre-rise marker) +
  `tools/pyramid_preview.png`. Stepped & "good enough for now"; a smoother pyramid can overwrite
  the same filenames later.
- **The rise cutscene** (in `DesertScene.ts`). Buried-apex marker at tile **(40,22)**, trigger at
  **(40,24)**; step on it with the crystal (`?dev`/`?debug`/`?e2e` bypasses) and the pyramid
  **emerges from the ground** (geometry-mask clip at the ground line), **jitters**, **sheds dirt
  particles that fade** + tumbling debris (reused boulder/shrub), brief camera jolt, title,
  control restored. `prefers-reduced-motion` skips it. Persisted via a new `progress` pyramid
  store (`isotopia.pyramid.v1`, `markPyramidRisen`/`isPyramidRisen`); risen stays risen.
- **Interior = stubbed:** the `TOMB ▲` door opens a "sealed — coming soon" dialog. `PyramidScene`
  + a real **collision footprint** (bake into `gen_desert.py`) are the next increment — today the
  risen pyramid is decorative/no-collision.
- **Verification:** build clean (Node 18); headless (chrome-headless-shell-1243 + Node 22 CDP)
  confirms the desert loads with the buried pyramid, player at START, **0 page errors**; mask +
  particle primitives render fine. **The animated rise itself is UNVERIFIED** — ~5s of continuous
  swiftshader software-GL starves the event loop (headful Chrome also crashes in this sandbox), so
  it needs a **real-browser smoke test**: `npm run watch` → `localhost:10001/?dev` → Warp → Desert
  → walk onto (40,24). Tune timing/intensity after seeing it live.

## New this session (2026-09-30) — Desert (level 2) + Jungle (level 3) + Dev Warp

**Shipped to `main` / live.** Three things landed: a developer zone-warp overlay and
**both** new outdoor biomes — the desert (level 2) and the jungle (level 3). Both are
explore-only for now (no wild Elementals yet); the next pass is populating them with
Elementals and tuning density.

### Dev Warp overlay — `src/ui/DevWarp.ts`
In-game zone teleporter so you can jump to any scene instead of walking the world
and clearing gate cutscenes. Mounted from `game.ts` (`mountDevWarp(game)`), styled
in `index.css` (`.devwarp*`, magenta). **Gated — never visible to students:** shows
only with `?dev` / `?debug` / `?e2e` in the URL **or** a staff sign-in (reuses
`onTeacherAuth` from `adminAuth.ts`). Warps via `GameScene.switch()`. Add a new zone
to its `GROUPS` (one line). Use it live at `is0topia.netlify.app/?dev` → tap **⧉ Warp**.

### Desert — level 2 (renumbered → **level 3** on 2026-10-01; `SceneName.Desert`)
A large (80×50) sand basin south of the city: oasis pools, cracked-dirt pits, rock
buttes, with palms / cacti / boulders / shrubs as sprites. Explore-only for now (no
wild Elementals yet). Verified in-engine headlessly (0 runtime errors, 335 collision
tiles, screenshots).

- **Art:** `src/assets/tiles/desert_tileset.png` (GrayCatGames PixelWorlds, 14×13 @16,
  free for commercial use). Props auto-sliced to `src/assets/desert/*.png`. *(Fixed a
  slicing bug: `cactus-short.png` had a rock blob baked in above the cactus — re-cropped
  to the cactus only.)*
- **Map generator:** `tools/gen_desert.py` → `src/assets/tilemap/desert_map.json`.
  Technique: flat sand base (tile 24 + speckle variants) + **stamp pre-arranged
  blocks** (oasis / dirt-pit / cliff) skipping transparent cells, so features keep
  the artist's shapes. Collision = visible water/cliff tiles **+ `blank16`** as a 2nd
  tileset (firstgid 183, collide gid 184) placed under blocking props.
- **Scene:** `src/Scenes/DesertScene.ts` (clones `WoodsScene`; note `variant` is
  **0-based** here, unlike woods' 1-based). Registered in `game.ts` scene list + the
  `SceneName` enum; added to the Dev Warp "Outdoors" group.
- **World links:** Desert→City (south "CITY ▼" pad); City→Desert (new "DESERT ▼" pad
  at city `x18,y71`). Chain is now Town → Woods → City → Desert (→ Jungle next).

### Biome pipeline (reuse for jungle)
`gen_*.py` → `node tools/embed-maps.mjs` (add the map name to its list) → new
`*Scene.ts` + `SceneName` + `game.ts` registration + DevWarp entry + link Doors →
`npm run build`. **Verify loop without playwright:** serve `dist/`, launch the cached
chromium (`~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`) with
`--remote-debugging-port`, drive over CDP via Node-22 global `WebSocket`/`fetch`
(boot `?e2e&dev`, click a `.devwarp-zone`, `Page.captureScreenshot`).

### Jungle — level 3 (renumbered → **level 2** on 2026-10-01; `SceneName.Jungle`)
A dense (80×50) rainforest **north of the desert**: a deep-green grass expanse walled
in by canopy trees, carved with earthy dirt clearings and rock-ringed water ponds,
with ferns / rocks / moss as sprites and **teal slimes** drifting by the ponds.
Explore-only for now (no wild Elementals yet). Verified in-engine headlessly earlier
in the build (0 runtime errors, 399 scenery objects, screenshots).

- **Art:** ilmenite "Lost Valleys" pack in `sprites/jungle/Lost_Valleys_Main_Free/`.
  The bundled Read_My is the `_Free` tier (non-commercial/no-redistribute) **but Justin
  purchased distribution rights over these files (receipt emailed 2026-09-30)** — treat
  as fully licensed; see `sprites/jungle/LICENSE.txt`.
- **Slicer:** `tools/slice_jungle.py` **composes one ground sheet**
  `src/assets/tiles/jungle_tileset.png` (8×1 @16: grass / 2 grass-variants / dirt /
  dirt-var / stone / 2 water). Grass is the pack's, `tint()`-deepened lime→rainforest
  green; **dirt + water are borrowed from `desert_tileset.png`** (cracked earth + teal
  oasis) so the biomes feel of a piece. Props cut to tight bounding boxes into
  `src/assets/jungle/`: `tree-1..4` (unused extras), `fern-1..6`, `rock-1..8`,
  `moss-1..3`, plus the `slime-sheet.png` (4×4 @36×28, idle frames 0–3).
  **Canopy is shared with the woods:** `JungleScene` loads `woods_tree_1..3` (dominant)
  + `jungle_tree_1..2` (accents); `loadObjectImages` picks the asset folder from each
  key's prefix (`woods_*`→`assets/woods/`, `jungle_*`→`assets/jungle/`).
- **Map generator:** `tools/gen_jungle.py` → `src/assets/tilemap/jungle_map.json`.
  Deep-grass base + speckled variants, **organic blob** dirt clearings / water ponds
  (not rectangles), a tree-wall border that thins inward (`edge_p` density, cap 125,
  greens dominant), fern/rock/moss scatter, ponds ringed with rock+fern. Collision =
  water tiles + tree/rock bases via `blank16` (2nd tileset, firstgid 9, collide gid 10).
- **Scene:** `src/Scenes/JungleScene.ts` (clones `DesertScene`; `variant` 0-based).
  Scenery via the object layer like desert; **ambient slimes placed in code** in
  `spawnFauna()` — animated spritesheet + idle anim + gentle side-to-side drift,
  skipped under `prefers-reduced-motion`. Registered in `game.ts` + Dev Warp "Outdoors".
- **World links:** Desert→Jungle (desert **north** "JUNGLE ▲" pad at `x40,y0`);
  Jungle→Desert (south "DESERT ▼" pad). Chain is now Town → Woods → City → Desert → Jungle.
- **Dropped:** a stone-ruins plaza + goblin/crab fauna were prototyped then cut (kept
  just the slimes). The pack's unused ruin/creature source art stays in `sprites/jungle/`.
- **Note:** the final live-slime screenshot wasn't re-captured (local headless-Chrome
  flake after the build); confirm the slimes animate on the Netlify preview.

### NEXT — populate + refine both biomes
Wild Elementals for desert + jungle (spots like `WoodsScene.WILD`), plus density /
pond-size tuning and deciding where each biome's entrance sits. Jungle preview images:
`tools/jungle_preview*.png`. The grass-variant patches read slightly blocky — soften
the tint spread if desired.

## Where things stand (2026-09-27) — read this first
**Isotopia is a web app, full stop.** Native (iOS/Android) is **abandoned** — Justin
has no usable Apple ID and the 2017 Mac (macOS 13, Xcode 15.2 max) is too old to
upload to the App Store. iPads get the **web game**: Safari → Share → **Add to Home
Screen**, or the school's MDM pushes a web clip of https://is0topia.netlify.app/.
The web app manifest + icons (`src/manifest.webmanifest`, `src/assets/icon-*.png`)
make it open full-screen with the dog icon.

The day of Mac work — sign-in typing fix, iPad layout, Rad Finder hints, the Support
page, and the PWA manifest/icons — is now **merged to `main` and deployed live**.

| Branch | State | What to do with it |
|---|---|---|
| `main` | **The only branch that matters.** Live site; now includes all the former `web-fixes` work. | Do work here (or short-lived feature branches off it). Push → Netlify deploys. |
| `web-fixes` | Fully merged into `main`; nothing left on it. | Done. Safe to delete anytime; harmless if left. |
| `mobile` | **ABANDONED.** Capacitor 8.5.2 iOS/Android shell, archived at `origin/mobile` (`MOBILE-HANDOFF.md` lives there). | Do **not** maintain, merge, or keep in sync. Kept only as a recoverable archive if native is ever revived — that branch also carries an RTDB rules change that must ship with it. |
| `origin/claude/repo-interview-readiness-x9z7u5` | Stale (Aug 29, a README tweak, far behind `main`). | Deletable; ignore. |

Decisions made:
- **Web-only, no App Store** (see above). This is the direction, not a temporary hold.
- **Monetization = voluntary support, not sales or ads.** `support.html` + a quiet
  help-card link + a teacher-portal link, all switched on by the `SUPPORT_URL`
  build env var (https:// only; unset ⇒ hidden, page says "coming soon"). Never
  call it a charity or tax-deductible. Before ever *charging* money, check the
  LimeZu/Cainos asset licenses (permission was given for a free game).

Waiting on Justin:
1. Create a Ko-fi (or GitHub Sponsors) page → set `SUPPORT_URL` in Netlify's
   environment variables → redeploy. Then add `.github/FUNDING.yml` for the repo's
   Sponsor button. (Until then the Support link stays hidden and the page reads
   "coming soon" — the deployed default.)
2. **Verify on a real iPad now that the fixes are live** — the main untested risk
   (student sign-up/login typing, portrait/landscape, Add to Home Screen). See Open items.

Next candidates: offline support via a service worker (launch without Wi-Fi after
the first visit), an "Install Isotopia" page with Add-to-Home-Screen steps for
iPad/Android/Chromebook, then the older open items at the bottom of this file.

### Deploying
Deploy = push to `main`. Netlify auto-builds (`npm run build`, Node 18) and publishes
`dist/`. Needs the 8 `FIREBASE_*` env vars already set in Netlify (see `.env.example`)
or online features silently go offline. Justin pastes a GitHub PAT inline per push.
```bash
cd /home/nah/Claudia/isotopia
npm install
npm run build          # local sanity check
git push origin main   # → Netlify deploys
```

## What this is
**Isotopia** — a Pokémon-style pixel game for learning the periodic table. You
play a dog exploring a small town, walk up to friendly element creatures called
**Elementals**, and answer multiple-choice atomic-structure questions to catch
them and fill your **Isotopedex**. It's **offline-first**: the whole game runs
from a built-in question seed with no setup. An optional Firebase backend adds a
shared question bank, a teacher portal, email/password student registration, and
per-student progress sync. Real classroom target: an **AP Chemistry** class at
**SAD 15 (Gray–New Gloucester, Maine)** — the town is themed on Gray, Maine.

## Coordinates
| Thing | Value |
|---|---|
| Local path | `/home/nah/Claudia/isotopia` (Linux — the main and only machine now; the Mac was for the abandoned native build) |
| GitHub | https://github.com/justin-harvey/isotopia (branch `main`, public; old `G00DTECH` path redirects) |
| Live game | https://is0topia.netlify.app/ (note the **zero**). Teacher portal: `/teacher.html` |
| Firebase project | `isotopia-2809c` (Realtime Database) |
| Deploy | Netlify auto-builds from `main` (`npm run build` → publish `dist/`). **Requires the 8 `FIREBASE_*` env vars set in Netlify** (see `.env.example`) or online features silently go offline |
| Foundation | fork of [danielart/phaser-rpg-template](https://github.com/danielart/phaser-rpg-template) (MIT), Phaser 3 + grid-engine |
| Deploys | Justin pastes a GitHub PAT inline per push (use inline, don't persist) |

## Run locally
```bash
cd /home/nah/Claudia/isotopia
npm install
npm run watch    # dev server + live reload → http://localhost:10001
npm run build    # production build → dist/ (also builds dist/teacher.html)
npm run package  # build + zip -> isotopia-offline.zip (see note — download offering is pulled)
```
Runs fully offline with no config. Set `FIREBASE_*` env vars before building to
enable the online features.

**Download offering pulled (2026-09-29):** the public `isotopia-offline.zip`
download was removed from the README and the old GitHub Release is stale. Don't
re-advertise a download or publish a new Release until the build is re-verified.
`npm run package` still works for a one-off local bundle; the preferred path for
"play offline" going forward is a **service worker** (see Open items), not a zip.

## Controls / gameplay
- **Tap / click** to walk (arrow keys too on desktop).
- **Walk within one tile of an Elemental** to auto-start its quiz (proximity — no
  key, for iPads). Encounters open a **GBA-style battle** (enemy on a platform,
  the dog's real back sprite opposite, pixel textbox). Correct answer catches it;
  if `questionsToCatch` > 1 the enemy has a draining **HP bar**. A screen-wipe
  plays before every battle.
- **Step on a glowing ▲/▼ pad** to enter/leave a building; follow the **trail
  north** into the woods (wild Elementals sit at **fixed cloaked spots**, found with
  the Rad Finder — no random tall-grass encounters anymore).
- **DEX** button (top-right) → the **Isotopedex** collection.
- **Secret path:** walk **north up column 20 of the woods to the very top** → a
  cutscene reveals the distant city → tap **"enter the city"** to walk it.
- **Treasure chest:** hidden in a far-eastern nook of the North Woods (tile 37,13,
  well off the central trail) — walk up to it to open a dialog and claim the **Magic
  Key** (a one-time pickup, saved locally).
- **Hidden Atlantis sanctum:** the Magic Key unlocks a **hidden tunnel in the Museum's
  lowest level (B4)** — a `custom` portal that only appears once you own the key —
  which warps to the **Atlantis sanctum** (`AtlantisScene`, the "Periodic Table of
  Crystals" room). No public entrance; the old always-open B3 "Cloud City" portal was
  removed.

## The Elementals (16 active)
Original, copyright-safe display names (no "-mon"), set in `data/elements.ts`
(`monster` field). Element `id`s and art filenames are unchanged.

| Element | Name | Where | Element | Name | Where |
|---|---|---|---|---|---|
| Hydrogen | Hydrohop | Museum B1 | Helium | Helior | Museum B1 |
| Neon | Neonglow | town plaza | Iron | Ironclank | Hardware interior |
| Carbon | Carbocrunch | Museum B2 | Sodium | Sodazoom | Hannaford interior |
| Nitrogen | Nitronoodle | woods (wild) | Magnesium | Magflash | Auto interior |
| Oxygen | Oxypuff | woods (wild) | Uranium | Glowbun | Library interior |
| Aluminum | Aluminio | city streets | Fluorine | Fluorvex | city streets |
| Scandium | Scandion | city streets | Boron | Borolith | city streets |
| Beryllium | Beryllia | city streets | Sulfur | Brimora | city streets |

Placements live in `TestScene.MONSTER_SPAWNS`, `WoodsScene.WILD`, the `elementIds`
passed to each town `InteriorScene`, `CityScene.CITY_ELEMENTALS` (city streets), and
now populated **city interiors** — **Hydrogen & Helium were relocated into the Museum
first basement (B1) and Carbon into the second basement (B2)** (the `elementIds` on
`CityMuseumB1Scene` / `CityMuseumB2Scene` in `CityInteriors.ts`; they were removed from
the town lake / Home / woods, incl. the woods grass pool).
**Keep `data/elementalLocations.ts` (Rad Finder hints) in sync when moving one.**
Every Elemental is **cloaked** on spawn (`components/Cloak.ts`) — a steady very-faint
alpha so it's hard to spot by eye; the Rad Finder is how you're meant to find them
(walking within one tile still auto-triggers the quiz regardless of visibility).
All 16 have art in `src/assets/elementals/` (declared in `data/elementalArt.ts`).
Chlorine is retired; `isotopia-next-batch.csv` lists the next candidates.

## Architecture / key files
| Path | Purpose |
|---|---|
| `src/game.ts` | Bootstrap: mounts DEX/intro, inits student auth, loads questions + class settings, then starts Phaser. Scene list incl. CityScene |
| `src/Scenes/TestScene.ts` | Town (building-art overlays over invisible collision, lake, doors, north trail) |
| `src/Scenes/WoodsScene.ts` | Woods; fixed wild-Elemental spawns + the hidden **treasure chest** (37,13), the secret city-reveal trigger (col 20, top) |
| `src/Scenes/CityScene.ts` | **Walkable city** — buildings, streets, plaza props, pedestrians, talking NPCs |
| `src/Scenes/InteriorScene.ts` + Home/Hardware/Hannaford/Auto/Library | Building interiors (image backgrounds + shared collision grid) |
| `src/Scenes/GameScene.ts` | Base scene: `spawnElemental` (release-gated), `spawnTreasureChest`, `spawnPedestrian`, `spawnTalkingNpc`, `spawnCompanionNpc`, camera, embedded-map loading (`enableGrassEncounters` still defined but **unused** — no random grass encounters) |
| `src/ui/QuizOverlay.ts` | GBA battle quiz (round-based, HP bar, `startBattle` wipe) |
| `src/ui/EvolveOverlay.ts` + `src/data/evolution.ts` | **Evolution Lab** (city Power Station). Three chambers — VSEPR Fusion, Hyper-Chamber (expanded octet), ΔEN Tug-of-War — fuse Elementals into compounds. `evolution.ts` holds recipes + real chemistry (EN table, geometries); products record via `progress.markEvolved`. Product art auto-loads from `assets/compounds/<id>.png` (formula-disc fallback) |
| `src/Scenes/components/Cloak.ts` | Cloaks Elementals on spawn: a steady very-faint alpha so they're hard to spot by eye (the Rad Finder is the intended way to find them). Called from `GameScene.spawnElemental` |
| `src/ui/Isotopedex.ts` | Collection screen + student account bar (email/password sign-up / log in / verify) + hidden teacher-portal entrance (hold the title) |
| `src/ui/CityReveal.ts` | The secret-path cutscene (bridge pan-out under sunset, dog on the bridge; tap → enter city) |
| `src/ui/RadFinder.ts` + `data/elementalLocations.ts` | "Rad Finder" tool (dex Tools row). Tap **Track** on an uncaught dex card to target it (`getRadTarget`/`setRadTarget`, persisted); the in-game HUD then shows a **directional arrow** rotating toward that Elemental when it's in the current scene (heat by distance), its **location hint** when it's elsewhere, or falls back to the nearest when nothing's picked. `GameScene.refreshRadFinder` registers targets in `spawnElemental` and pushes `RadReading`s from `update()`; also unlocks per-card location hints. |
| `src/ui/Intro.ts` / `NpcDialog.ts` / `icons.ts` | Help card, NPC dialog box, inline SVG icons (replaced emoji) |
| `src/data/elements.ts` / `questions.ts` / `questionSource.ts` | Elements, local seed bank, local-vs-RTDB question source |
| `src/data/progress.ts` | Seen/Caught + stats; localStorage cache, mirrors to `students/{uid}` when signed in. Also the local-only **inventory store** (`giveItem`/`hasItem`/`MAGIC_KEY`, key `isotopia.items.v1`) that gates the Atlantis tunnel, and the evolved-forms store |
| `src/Scenes/CityInteriors.ts` | City building interiors + the museum floor chain (ground→B4); painted-portal nav; the **key-gated Atlantis sanctum portal** (`createSanctumPortalIfUnlocked`, B4) and `AtlantisScene` (`wisdom-of-atlantis.png`) |
| `src/data/classConfig.ts` | Class settings + 40-day release schedule; `elementReleased()` cache the game reads |
| `src/data/firebase.ts` | Firebase config from `FIREBASE_*` env (blank ⇒ offline) + lazy init |
| `src/data/auth.ts` / `studentAuth.ts` / `adminAuth.ts` | Guest anon sign-in / student **email+password** register+verify / portal sign-in (super via Google, admin via email+password) + role gate |
| `src/data/studentAdmin.ts` | Portal data: `loadRoster(classId)`/`setMembership(Bulk)` (writes `assignments/`) + `loadAdmins`/`setAdmin` (super-only role mgmt) |
| `src/data/classConfig.ts` | Per-owner class settings + `meta{name,color}` + `assignments/` resolution; game reads the student's assigned class's release schedule (`loadAndCacheSettings`) |
| `src/data/maps.ts` | **Embedded tilemaps** (test/woods/interior/city) so the game runs from `file://` (no XHR). Regenerate via `tools/embed-maps.mjs` after editing any map |
| `src/teacher.ts` + `teacher.html` + `teacher.css` | Teacher admin portal (separate rollup bundle) |
| `src/support.html` + `src/data/support.ts` | Support page (copied with `%SUPPORT_URL%` filled in by rollup-plugin-copy's `transform`) + the flag the game/portal use to show their support links |
| `src/manifest.webmanifest` + `src/assets/icon-192/512.png` | Home-screen web app (name, icon, full-screen) |
| `tools/gen_town.py` / `gen_woods.py` / `gen_city.py` / `gen_interior.py` | Regenerate each tilemap; `embed-maps.mjs` re-embeds them into `maps.ts` |
| `firebase/` | `database.rules.json`, `set-teacher.mjs`, `ADD-A-TEACHER.md`, `ACCOUNTS-SCOPE.md`, `NEXT-STEPS.md`, `serviceAccount.json` (gitignored) |

## Accounts, auth, roles, teacher portal
Three roles, two of them enforced entirely in `database.rules.json` (client UI is
just convenience — the rules are the real gate).
- **Guests** play anonymously (local progress only).
- **Students** register in-game (DEX account bar) with **email + password** — any
  email, **email verification required**. Only a *verified* user syncs progress to
  `students/{uid}`. Registering does **not** join the class: a student just lands
  in the "registrant pool" until a staff member adds them (see roster below).
- **Admins** (staff) — a promoted registrant, recorded at `admins/{uid}` in RTDB.
  They manage classes/rosters/questions but **cannot create other admins**. They
  open `/teacher.html` with the **same email + password** they registered with.
- **Super admins** — the fixed set carrying the `teacher` custom claim
  (`jharvood@gmail.com`, `aharvey@sad15.org`; Justin's mom is the teacher). Only
  supers can promote/revoke admins. **No new supers are ever minted from the app** —
  the claim only comes from `firebase/set-teacher.mjs` (`node set-teacher.mjs <UID>
  [off]`, `firebase-admin@11` on Node 18) and we don't re-run it. Supers sign into
  the portal with **Google** (`@sad15.org`). In-game, **press-and-hold the
  Isotopedex title ~1s** opens the portal.
- **One class per staff member** (super or admin), keyed by the owner's uid
  (`classes/{uid}`). Each has `meta {name,color}` (color is portal-only) — set on
  the **Class** tab; a header chip shows it. Auto-created on first portal load.
- **Portal tabs:** **Class** (name + color), **Questions** (CRUD + import seed),
  **Schedule** (40-day unlock days, per class), **Settings** (`questionsToCatch`,
  per class), **Roster** (registrant pool → bulk add/remove to *your* class),
  **Admins** (super-only: promote/revoke admins). Busy states + save toasts.
- **Membership = `assignments/{studentUid} = classId`** (one class per student;
  replaced the old `classes/*/members`). Staff-written: admins may only claim
  *unassigned* students into their own class; supers can reassign anyone. The game
  resolves a student's class from their assignment; `pushCloud` in `progress.ts`
  no longer self-joins or writes classId.

## Data model + release schedule
```
questions/{id}                 { elementId, angle, prompt, choices[4], correctIndex }   # global bank
classes/{ownerUid}/meta        { name, color, ownerUid }                                # owner or super writes
classes/{ownerUid}/settings    { questionsToCatch, unitStartDate, releaseAllNow, release:{elementId:day} }
assignments/{studentUid}       "{ownerUid}"   # student's class. STAFF-written (see rules). Source of truth.
students/{uid}                 { name, email, seen, caught, stats:{elementId:{attempts,correct}} }
admins/{uid}                   true           # SUPER-written only. Presence = admin role.
```
**Rules gates** (`firebase/database.rules.json`): `students/{uid}` write = self +
`email_verified`; reading the `students` pool + `assignments` + editing
`questions`/`dailySchedule` = *staff* (super claim OR `admins/{uid}===true`);
`classes/{cid}` write = **owner (`auth.uid===cid`) or super**; `assignments/{sid}`
write = super (any) OR admin claiming an *unassigned* student into their own class;
`admins/{uid}` write = *super* only. **No single `CLASS_ID` any more** (old
`classes/ap-chem/*` is orphaned legacy). **Release logic** (`isElementReleased`):
releaseAllNow ⇒ all visible; else an element shows only if it has an unlock day
that has arrived — **no day = hidden**; unassigned students fall back to defaults
(all released). The game reads settings **once at startup** (cached), so schedule
changes need a **game reload**.

## The city (reached via the woods secret path)
- Cutscene: `WoodsScene` movementStopped at (col 20, y≤1) → `playCityReveal(onEnter)`
  → tap → `this.switch(SceneName.City)`.
- `CityScene` + `tools/gen_city.py` (**52×72 map**, embedded): light sidewalks +
  asphalt road grid (sidewalk `gid(43,2)`, asphalt `gid(34,6)`) + cobblestone
  plaza; 9 building overlays over blank16 collision footprints; **power-tower,
  large-church, power-station are 2×**; plaza + street **trees**, **lit lamps**
  (`assets/city/lamp.png`), **benches** (`bench.png`); **8 wandering pedestrians**
  (`spawnPedestrian`, scale 0.35) + **3 talking NPCs** (`spawnTalkingNpc`). WOODS
  pad returns you. Keep `CityScene.BUILDINGS` in sync with `gen_city.PLACEMENTS`.

## The Evolution Lab (city Power Station)
The city **Power Station** is repurposed as the **Evolution Lab** (`lab: true` on
`CityPowerStationScene` in `CityInteriors.ts`): a console **technician** — a proximity
NPC on an "EVOLVE ▲" pad (`spawnEvolutionConsole`) — opens `ui/EvolveOverlay.ts`. Three
chambers, all live:
- **VSEPR Fusion** — pick a molecule, match its bond angle on a dial (±2.5°) to fuse.
  Products: H₂O, CO₂, CH₄, NH₃, BF₃, SO₂, O₂, N₂.
- **Hyper-Chamber** — expand a central atom past the octet by injecting reagents:
  SF₄ (10 e⁻, see-saw), SF₆ (12 e⁻, octahedral). He/Ne/period-2 cores **fizzle** with
  the real reason they can't expand — the AP lesson, deliberately not a faked reaction.
- **Tug-of-War** — classify a binary bond from ΔEN, then slide to the potential-energy
  well minimum (equilibrium bond length). Products: NaF, MgO, MgF₂, Al₂O₃ (ionic),
  FeS (polar covalent), steel/Fe·C (interstitial alloy).

Recipes + chemistry: `data/evolution.ts` (`FUSIONS` / `HYPERVALENTS` / `IONICS` + a
Pauling EN table). Success calls `progress.markEvolved(id)` → local key
`elemonsters.evolved.v1`, kept **out** of the cloud `students/{uid}` schema on purpose
(so a new field can't reject the RTDB write and break progress sync). **16 products,
placeholder names/tints** until art lands.

**Artwork drop-in:** the success disc loads `assets/compounds/<recipe-id>.png` if it
exists, else a tinted formula disc. Drop a PNG there + rebuild — no code change.
Filenames + spec in `src/assets/compounds/README.md`. Justin is supplying the art.
**Soft-gated:** attempts are allowed without owning the reactants (marked a "practice
simulation") so it's testable; flip to strict "must be caught" later.

## The Atlantis sanctum — Crystalline Core Attunement (the final test)
The hidden **`AtlantisScene`** (key-gated tunnel from Museum B4, see history) holds the
game's **final test**. Stepping onto the **Giza Core** pad (`ATTUNE ✦`, tile
`AtlantisScene.CORE = {11,5}`, drawn with `drawDoorCue`) opens **`ui/ResonanceOverlay.ts`**,
a one-crystal-at-a-time **forge** that drills the whole intro atomic-structure syllabus:
protons/neutrons/electrons → ions → a net-zero circuit.

- **Forge (3 phases per crystal, a phase tracker walks you through them):** ① **Protons** —
  tap ＋/− to inject protons until the count equals the atomic number; the tile's identity
  morphs live as protons are added (Z6 → Carbon, Z7 → Nitrogen…): *protons = identity*.
  ② **Neutrons** — add neutrons until `mass = protons + neutrons` hits the stable isotope;
  off-target the tile **vibrates** (decays), dead-on it goes still: *mass = p + n*.
  ③ **Electrons** — tune electrons so `charge = protons − electrons` reaches the target ion;
  losing e⁻ → **cation** (metals, LEFT, "cats!"), gaining → **anion** (non-metals, RIGHT),
  equal → neutral. Steppers repeat on **press-and-hold**; the live derived readout is the
  lesson. A per-phase confirm button (Anchor identity / Stabilize isotope / Harmonize) only
  enables when the count is exactly right.
- **Circuit finale:** once every crystal is forged, the floor grid shows the ions in two
  columns (cations left, anions right; neutral Carbon is the centre "heart"). Tap a cation
  then an anion — if the charges cancel to **net zero** they link (chime + compound label
  NaF / MgO / AlN); mismatched magnitudes buzz "net charge ≠ 0" and clear. Balance all three
  pairs → **100% = Enlightenment**.
- **Crystals (all data-driven):** `data/resonance.ts` — `CORE_ELEMENTS` (Carbon tutorial +
  Na/F, Mg/O, Al/N, all also catchable Elementals), `ION_PAIRS` (the three net-zero pairs),
  an `IDENTITY_BY_Z` table (Z 1-20) for the live proton morph, and
  `neutronsFor`/`electronsFor`/`chargeLabel` helpers. Add/trim crystals or pairs there and the
  tracker, meter and finale all follow.
- **Persistence:** `progress.ts` resonance store (`isotopia.resonance.v1`:
  `attuneNode`/`isNodeAttuned` [now = a crystal fully forged] / `markEnlightened` /
  `isEnlightened`), its own local key, kept out of the cloud `students/{uid}` schema like
  items/evolved. A returning player resumes at the first un-forged crystal (or straight to the
  circuit if all are forged).
- **Reward + dex secret cards:** on Enlightenment `isEnlightened()` awards a **"Giza Core"**
  card in the Isotopedex (`makeEnlightenmentCard`, copy updated for the forge). The **Magic
  Key** also shows as a **"Secret Treasure"** card once looted (`makeMagicKeyCard`), both gold
  `dex-special`, both listed after the Elementals and OUT of the "/N caught" tally (separate
  header **✦ secrets** count). `isEnlightened()` is the **hook to unlock a future zone**
  ("the path to the next realm opens").
- **Trigger wiring:** `AtlantisScene.create()` subscribes to `movementStopped` and opens the
  overlay when the player rests on the Core tile (guarded by `inDialogue`), mirroring
  WoodsScene's city-reveal. `DoorCue` allows the non-directional `✦` marker. The `inDialogue`
  guard means the puzzle only fires when no dialog is open — true during normal walking, so a
  no-op in play (headless tests must clear the boot intro's flag first).
- **Status: E2E-VERIFIED** (2026-09-30) end-to-end via headless Playwright (cached
  chromium-1243 + Node 22; `?e2e` hook → `window.__isotopia`; **launch with
  `--disable-dev-shm-usage`** or the heavy sanctum background crashes swiftshader): walk onto
  the Core → forge all 7 crystals through all 21 phases → 7 attuned persisted → circuit renders
  → a +1/−2 pick rejected (net ≠ 0) → the 3 net-zero pairs link → Enlightenment persisted,
  banner shown, meter 100%, overlay closes and clears `inDialogue`; **14/14 checks, zero page
  errors**. Throwaway test: `/tmp/pw/test-sanctum-final.mjs`. Quick manual jump: load `?debug`,
  then `__isotopia.game.scene.start('atlantis')` and walk up onto the Core.

## Gotchas
- **Netlify needs the 8 `FIREBASE_*` env vars** or the live site loses online features.
- **Reload the game** after changing schedule/settings (startup-cached).
- **Editing any tilemap** (gen_*.py) requires re-running `tools/embed-maps.mjs`.
- **file://-safe:** all Phaser loader paths are relative `assets/...` (not `../`);
  maps embedded; font self-hosted. Keep it that way (0 `../assets` in dist/game.js).
- **Email/Password provider must be ENABLED** in the Firebase Console (Auth →
  Sign-in method) or both student registration and admin portal login fail. And
  **redeploy rules after any change**: `firebase deploy --only database --project
  isotopia-2809c` — the frontend expects the staff/super/verified gates.
- **iPad student registration (email/password + verification link) is UNVERIFIED
  on hardware** — main risk. Verification emails need `is0topia.netlify.app` in the
  Firebase authorized domains (already set).
- Teacher-claim script needs `firebase-admin@11` (latest is ESM-only, breaks Node 18);
  run from an isolated dir (e.g. `/tmp/isotopia-admin`).
- localStorage progress key stays `elemonsters.progress.v1` (don't change the value).
- **Evolved/compound forms are local-only** (`elemonsters.evolved.v1`), deliberately
  outside the cloud `students/{uid}` record; cloud-syncing them needs a rules update.
- **`CityInteriorScene.preload` now calls `loadObjectImages()`** so a populated city
  floor (museum, lab) actually loads its Elemental/NPC art (was a latent gap — no city
  interior held Elementals before).
- **Compound art:** drop `src/assets/compounds/<id>.png` (ids in that folder's README)
  and rebuild; missing art falls back to a formula disc.
- **Camera zoom is a fixed per-scene value** — `GameScene.createCamera` sets 2.5;
  `CityScene` overrides to 1.8 (large map). There is **no more `keepRoomFilled`**: its
  cover-zoom over-zoomed interiors ~50% on tall/portrait screens. To retune a scene, set
  its camera zoom (lower = wider); uncovered margins letterbox to **black** (camera bg is
  set black in `createCamera`) — don't reintroduce a cover-zoom to "fix" a margin.

## Licensing (for the open-source release)
LimeZu "Modern Exteriors/Interiors" tilesets + character sheet are used with
**LimeZu's express permission** (free educational game). All other art (Luna
Town interiors, building/bridge artwork, the dog) authored by Justin. Code is
MIT. README credits reflect this.

## Open items / next
- **🎨 Texture consistency across all levels (Justin — PRIORITY, initiative started):** shared
  elements should look the SAME in every zone; today each level has its own water/dirt/grass/stone.
  **✅ First task DONE (2026-10-01e): the Town lake now uses the canonical jungle water** — the
  canonical water tile is extracted to `src/assets/tiles/water.png` by `tools/slice_water.py` and
  tiled in `TestScene.drawLake()` (see this session's note above). *(Implementation note: the lake
  is a DRAWN decorative body of water over blocking cells — `gen_town.py` only stamps a dummy
  collision gid — so it was repainted in `TestScene`, not in the tilemap; no `embed-maps` needed.)*
  **Remaining:** (1) point the **desert oasis** at the same `water.png` (or confirm it already
  matches — the jungle water IS the desert oasis water, `desert_tileset.png` cells (4,2)/(5,1)); (2)
  audit the other shared textures (dirt/grass/stone/paths) so all levels share one visual language.
  (No art purchase needed — reuse the jungle tiles.)
  **⚠️ NEW (2026-10-02, Justin):** this shared water carries baked-in orange/tan "triangle" specks
  (worst tiled on the Town lake). Root cause + full fix plan are in **▶ NEXT SESSION #1** at the top
  of this file — clean the oasis source cells (4,2)/(5,1) once and it fixes lake + jungle ponds +
  oasis together.
- **Verify on a real iPad (now live — top untested risk):** the 2026-09-29 UX pass
  (see `SESSION-HANDOFF-2026-09-29.md`) — student sign-up/login (inline errors +
  auto-verify), the Rad Finder arrow + Track, the reduced-motion battle cover, dex
  legibility/pinch-zoom, portrait/landscape, Add to Home Screen, city walking.
- **Performance & database hygiene (NEXT — Justin flagged "page unresponsive" + DB growth):**
  two separate concerns.
  **(1) "Page unresponsive" is client-side, not the backend.** MEASURED headless (2026-09-30):
  transitions use `scene.switch` = Phaser **sleep/wake**, so `create()` runs **once per scene**
  and `shutdown` **never fires during play**. The `inDialogue` listener count is flat/bounded
  (3 → 5 after visiting a second scene, then steady across 8+ switches), so the earlier
  "listeners accumulate per transition" theory is **disproven** — there is no subscription leak,
  and the existing `shutdown` cleanups only run on game destroy. Real suspects given this
  architecture: scenes are never destroyed, so the whole world (incl. the 52×72 city) stays
  resident. **REPRO CLUE (Justin, 2026-09-30): it happens entering/exiting buildings RAPIDLY.**
  That path is `Door`/`Portal` → `movementStopped` → `scene.switch` (sleep/wake), gated by a
  `characterMoved` arming flag with a `wake` reposition (`Door.ts`, `Portal.ts`,
  `InteriorScene.create`). `diag-perf.mjs` drove `switch()` directly and was clean (flat
  listeners, no scene stacking), so the lead is the **door-trigger path / rapid-switch timing**:
  re-entrant or overlapping switches, a tap queued mid-transition, per-switch churn of
  tweens/graphics (`showTapRipple`) or the Leave-button DOM, or a wake/arming race. NEXT SESSION:
  reproduce by hammering the real door enter→exit loop headlessly (onto door pad → interior →
  onto exit pad → town, fast, ×many) while watching active-scene count, live tween/timer counts,
  and pageerrors; secondary suspect stays retained memory. Diag harness: `/tmp/pw/diag-perf.mjs`.
  **ROOT CAUSE FOUND (2026-09-30, retained-memory confirmed):** built a door-driving harness
  (`/tmp/pw/hammer-doors.mjs`) then a texture-retention probe (`/tmp/pw/texture-retention.mjs`).
  Hammering the REAL door path into the *same* building was totally flat (scenes=22, children=6,
  listeners plateau 7, DOM 45, heap ~17MB, 0 pageerrors, thread responsive) — so it is **NOT** a
  per-transition leak, tween/DOM churn, or a re-entrant-switch crash. The real cause is **unbounded
  resident scenes + GPU textures across DISTINCT buildings**: touring all 13 city interiors once,
  alive (created, never-shutdown/sleeping) scenes climb **2 → 15** and `game.textures` count climbs
  **32 → 65**, one step per *new* building, monotonic, never released. Re-visiting the same
  buildings is FLAT (textures/scenes reused). **JS heap barely moves (+3 MB)** because the weight is
  GPU texture memory (each interior bg is 1408×768 ≈ ~4 MB VRAM, + the big city bg), which
  `performance.memory` doesn't see — which is why same-building hammering looked clean and why it
  never repros in headless swiftshader (17 GB RAM, no GPU cap) but DOES bite a real iPad (iOS Safari
  WebGL has a hard texture-memory cap → context loss / tab killed = "page unresponsive"). Matches
  Justin's "entering/exiting buildings rapidly" repro: each distinct building adds a never-freed
  resident scene+texture. **FIX SHIPPED (2026-09-30, verified):** both `InteriorScene` and
  `CityInteriorScene` now free the room background on `sleep`/`shutdown` and lazily reload it on
  `wake` — `addBackground()` / `freeBackground()` (`bgImage.destroy()` + `textures.remove(bgKey)`) /
  `reloadBackground()` (`load.image` + re-add on `Loader.COMPLETE`). So at most the CURRENT
  interior's ~4 MB bg is resident instead of all 13. `texture-retention.mjs` confirms: full tour
  texture growth dropped **+33 → +20** (the 13 room backgrounds freed), Pass 2 (re-visits) is FLAT
  (no leak from the reload cycle), all transitions succeed, 0 pageerrors; `verify-reload.mjs` + a
  screenshot confirm the bg frees on exit and re-renders on re-entry (no black room). Residual +20
  is small per-interior sprites (elemental/NPC sheets), negligible for the iOS WebGL cap. NOTE: only
  the bg texture is freed, not the scene — sleeping scenes stay resident but are now cheap; if this
  still isn't enough on-device, the next lever is `scene.stop` on exit to fully drop the scenes.
  Trade-off: rapid re-entry reloads the bg from HTTP cache (possible 1-frame black before it paints;
  margins already letterbox black). **Still needs a real-iPad confirmation.** Removing the scene
  alone would NOT have freed the texture (TextureManager is global) — the explicit `textures.remove`
  is the load-bearing part.
  **(2) "Guest device" growth is Firebase _Auth_, not the Realtime Database.** Guests get an
  **anonymous Auth** user (`data/auth.ts ensureSignedIn` → `signInAnonymously`) purely so the
  rules (`auth != null`) let them *read* the live question bank + schedule; they never write to
  RTDB (`students/{uid}` write needs `email_verified`, and `progress.pushCloud` only runs for
  verified students). So RTDB nodes don't balloon from guests — but **anonymous Auth accounts
  accumulate forever** (every new device / cleared storage / private tab mints a fresh anon UID
  that never expires). That is the "ballooning." MEASURED read-only (2026-09-30, census script
  `/tmp/isotopia-admin/measure.mjs`): **223 total Auth users, 207 anonymous (93%)** vs 16 real,
  in the project's first ~2 months; **99 anon idle >30d** (cleanup candidates). So the trend is
  real and worth a cleanup, but it is tiny today (223 is nothing for Firebase Auth) and does
  **not** cause the client freeze — hygiene, not the fix. **Parked as backlog / nice-to-have per
  Justin (2026-09-30); the freeze is the priority.** When picked up: cleanup script (delete anon
  idle >30d, dry-run first, pattern of `firebase/set-teacher.mjs`) and/or drop anon auth so guests
  use the local seed. Census script kept at `/tmp/isotopia-admin/measure.mjs`.
    - **Cleanup job:** a `firebase-admin` script (same pattern as `firebase/set-teacher.mjs` —
      service account, Node 18) that paginates `auth().listUsers()`, selects anonymous users
      (`providerData.length === 0`) whose `metadata.lastRefreshTime`/`lastSignInTime` is older
      than ~30 days, and `deleteUsers()` in batches of 1000. Run manually first; promote to a
      Cloud Scheduler cron (Blaze) later.
    - **Prevention (bigger lever, product decision):** stop minting anon users — let guests fall
      back to the **local seed bank** (already fully supported offline) and authenticate only
      registered students. Eliminates the accumulation; trade-off is guests play the built-in
      seed, not the teacher's live custom questions/schedule. (Making `questions`/`dailySchedule`
      publicly readable is rejected — it would expose every question + correct answer.)
- **Evolution Lab follow-ups:** wire in Justin's evolved artwork (drop PNGs into
  `assets/compounds/`, filenames in its README); tighten gating to "must own the
  reactants"; add the compounds to the DEX/collection; cloud-sync evolved forms (+ a
  rules update); difficulty tuning (hide target angles, allow Hyper-Chamber overshoot).
- **Atlantis sanctum follow-ups (final test DONE + E2E-verified, see history + its
  section):** **cloud-sync** the resonance store (plus a rules update), like evolved/items;
  **tune/extend** the forge (crystal count, add ion pairs, Core pad tile) via
  `data/resonance.ts`; wire `isEnlightened()` to an actual **next zone** once one exists;
  optional polish — a "×5" beam or a multiple-choice-calc variant if single-tap stepping to
  Z=13 feels long on a phone, and a locked-door hint at the B4 tunnel tile before the key.
- **Desert "Lesson Three" — Light, EM Radiation & Atomic Emission (NEW design, 2026-10-01):**
  the desert's lesson-three set-piece and the concrete payoff for `isEnlightened()`'s "next
  zone" hook. (Desert is still explore-only; `DesertScene.createNpcs()` is an empty stub, so
  this is where lesson three lands.) **Full phased build plan: `DESERT-LESSON3-PLAN.md`.**
  **Topic (AP Chem):** `c = λν` (c = 3.0×10⁸ m/s); `E = hν` (h = 6.626×10⁻³⁴ J·s); the EM
  spectrum (UV = short λ / high E ↔ IR = long λ / low E); flame-test emission colors (Na
  yellow, Li red, K lilac/purple, Cu green, Sr red/orange, Ca orange, Ba green). Natural
  **sequel to the Atlantis forge**: the sanctum taught electrons/shells; emission is what
  those electrons do when excited and then relax — worth surfacing the electron-transition "why".

  **Reveal sequence (Justin's vision):** finish the Atlantis sanctum → carry the **giant crystal**
  out as an item → in the desert, combine it with **specific Elementals caught on the journey** →
  grand cutscene: a **massive hidden pyramid rises from the sand**. The risen pyramid is the
  lesson-three interior.

  **Three puzzle mechanics (each maps onto an EXISTING overlay pattern — strong reuse):**
  1. **Solar Prism / EMS alignment** — ancient mirrors + a λ/ν dial steer sunbeams along the
     spectrum (dial λ down → ν & E up → UV to charge an obelisk; dial up → IR to melt ice /
     reveal heat signatures). Reuse `EvolveOverlay`'s **dial-match** (the VSEPR bond-angle dial,
     ±tolerance) + a live HUD.
  2. **Flame-Test Beacon Pillars** — collect elemental **salts/dusts** in the ruins, toss into
     altar fires, match the emission **color** to each gate lock (Cu→green, K→purple, Na→yellow…).
     Reuse the **inventory item** store (Magic Key / crystal pattern, `isotopia.items.v1`) + a
     color-match UI. *Note: Cu and Ba both read "green" — a real AP ambiguity to design around.*
  3. **Energy-calc locks (`E = hν`, `c = λν`)** — given a target photon energy, adjust ν/λ on a
     dial while the HUD computes `E` live; confirm when within tolerance. Reuse
     `ResonanceOverlay`'s **stepper + live-derived-readout + confirm-when-exact** pattern.

  **Open design decisions (resolve before building):**
  - **What gates the pyramid-rise** — caught Elementals vs. collected "dusts"? Only **Na** is a
    current Elemental; Li/K/Cu/Sr/Ca/Ba aren't. Either add flame-test Elementals to the roster
    or treat dusts as items distinct from catchable creatures (the design leans "dusts").
  - **Scene layout** — pyramid interior as a new scene (like `AtlantisScene`) or rooms inside
    `DesertScene`? Where the rise cutscene lives (reuse the `CityReveal` cutscene pattern).
  - **Scope/phasing** — three puzzle systems + a cutscene + maybe new elements; build in phases
    (crystal item + rise cutscene first, then one puzzle at a time).

  **Two starter backlog items (to tee it up):**
  1. **Find a large pyramid sprite** matching the desert art — GrayCatGames PixelWorlds Desert
     tileset, 16px pixel-art sand palette (`src/assets/tiles/desert_tileset.png`, props in
     `src/assets/desert/`). Big enough to read as a monument rising; drop into `src/assets/desert/`.
  2. **Turn the sanctum crystal into an inventory item.** Enlightenment currently only awards the
     "Giza Core" dex card (`makeEnlightenmentCard`) + sets `isEnlightened()` — no carryable crystal.
     Add e.g. `GIZA_CRYSTAL` via `progress.giveItem()` where `markEnlightened()` fires, **reusing
     the Magic Key pattern** (`giveItem`/`hasItem`/id in `progress.ts`, local key
     `isotopia.items.v1`, out of the cloud `students/{uid}` schema). This item + the specific
     elements gate the pyramid-rise cutscene.
- **Church interior showed the FASHION room (asset bug) — FIXED 2026-09-30.** `src/assets/rooms/
  church-interior.png` had been overwritten with the fashion textile art (wiring + collision were
  always correct). The real church art (cathedral + atom stained-glass + periodic-table floor)
  still existed at `sprites/city/church interior.png` (md5 027f809) and
  `/home/nah/interior-collision/_canvas_original/church-interior.png`. Restored by copying
  `sprites/city/church interior.png` → `src/assets/rooms/church-interior.png`, then re-ran the
  collision exercise (`python3 tools/gen_interior_collision.py`) which came back **byte-identical**
  for every room's tilemap + `interiorNav.ts` — confirming only the art was corrupt, not the
  collision. Rebuilt (`node tools/embed-maps.mjs && npm run build`) and verified in-game
  (headless screenshot) + via the fresh verify overlay `/tmp/interior_grid/church-interior_verify.png`.
  NOTE for future collision work: `gen_interior_collision.py` does NOT write room art — it only
  reads `src/assets/rooms/<art>.png` for the verify overlay and emits tilemap JSON + nav; room art
  is copied in separately from `sprites/city/` (that copy step is where church got clobbered).
  Paint sources live in `/home/nah/interior-collision` (12 city/town) + `/home/nah/museum-collision`
  (5 museum); both intact. **DONE + LIVE:** Justin then dropped final church + fashion interior art
  into `src/assets/rooms/` and it's pushed to `main`/deployed (verified live md5 matches). Asset/
  deploy pipeline is now documented in README ("Art, assets & deploying"): Netlify builds `main`,
  `npm run build` copies `src/assets/*` → `dist/assets`, so `src/assets/` is the ONLY art source;
  `dist/`, `sprites/`, `www/`, `android/`, `ios/` are generated/stale dead-ends. Same-filename cache
  means a hard-refresh may be needed after redeploy.
- **Forest chest art:** `assets/woods/treasure-chest.png` is currently a **byte-for-byte
  copy of the old `signpost.png`** (it was never real chest art), so the chest reads as a
  now-half-size signpost in-world. Supply a real chest sprite, plus an open-chest
  `treasure-chest-open.png` (key `woods_chest_open`, auto-swaps once looted). The
  standalone woods **signpost decoration was deleted** this session.
- **PWA polish:** an "Install Isotopia" page with Add-to-Home-Screen steps for
  iPad/Android/Chromebook, then a **service worker** so it launches offline after
  the first visit.
- **Support/monetization:** stand up Ko-fi or GitHub Sponsors → set `SUPPORT_URL` in
  Netlify env → redeploy → add `.github/FUNDING.yml`.
- **Native apps (abandoned — see top):** archived only on branch `origin/mobile`
  (`MOBILE-HANDOFF.md` lives there). Not maintained. If ever revived, that branch
  also carries in-app account deletion and an RTDB rules change that must ship with
  it (`firebase deploy --only database --project isotopia-2809c`).
- **Fountain** for the plaza centre (couldn't isolate its tiles in the 16k-tile
  sheet — its centre spot is left open). More city props/NPCs/shops.
- Populate the city with gameplay (Elementals/quizzes/Gym).
- Seed the real 40-day release schedule; per-element mastery in the dashboard.
- Deferred portal UX: unsaved-changes warning; refresh the `questionsToCatch` help
  (the HP battle is live now).

## Recent history (newest first)
**2026-10-01 (Desert Lesson Three — pyramid rise, Phases 0–1):** Began the desert's lesson-three
set-piece (full plan in `DESERT-LESSON3-PLAN.md`). (0) Turned the Atlantis sanctum crystal into an
inventory item `GIZA_CRYSTAL` (granted in `markEnlightened()` + back-fill). (0) Built
`tools/gen_pyramid.py` — a stepped pyramid composed from the desert tiles + procedural shading →
`src/assets/desert/pyramid.png` / `pyramid-buried.png`. (1) Added the buried marker + crystal-gated
**rise cutscene** to `DesertScene.ts` (emerge-from-ground via geometry mask, jitter, shedding/fading
dirt particles + debris, camera jolt) and a `progress` pyramid store (`isotopia.pyramid.v1`); the
`TOMB ▲` door is a "coming soon" stub (interior + collision are next). Build clean; desert+buried-
pyramid load headless-verified (0 errors), but the **animated rise is unverified** (swiftshader
starves on sustained render; headful Chrome crashes in-sandbox) → needs a real-browser smoke test.
**Not committed at time of writing → committed with this push.**
**2026-09-30 (final church + fashion interior art + easter-egg tweaks + deploy docs):** Justin
supplied final church (cathedral) + fashion (textile-room) interior art into `src/assets/rooms/`
(verified not swapped, 1408×768) — pushed + live. "what da dog doin" easter egg: raised combo 4→10
and made it require STRICT S/D alternation (`sdsdsdsdsd`; same key twice restarts). Documented the
art/deploy pipeline in README so future art updates land in the right place (`src/assets/`, deploy
from `main`). The freeze texture-fix + these all shipped to `main`.
**2026-09-30 (freeze ROOT CAUSE + FIX + church asset bug):** Built headless harnesses
(`/tmp/pw/hammer-doors.mjs` drives the real door enter/exit path; `/tmp/pw/texture-retention.mjs`
tours every interior). Found the "page unresponsive" freeze is **unbounded resident GPU textures**:
interiors are never destroyed, so each DISTINCT building visited kept its ~4 MB room bg resident
(invisible to JS heap — why it never repro'd headless and looked flat when hammering one building).
**Fixed** by freeing the room bg on `sleep`/`shutdown` and reloading on `wake` in `InteriorScene`
+ `CityInteriorScene` (`addBackground`/`freeBackground`/`reloadBackground`); verified tour texture
growth +33→+20, re-visits flat, bg re-renders on re-entry. Also **diagnosed** the church interior
showing the fashion room: `church-interior.png` IS the fashion art (wiring is correct; the PNG was
saved as a copy) — needs real church art. Both in Open items. Still needs real-iPad confirmation.
**2026-09-30 (perf/DB investigation + "what da dog doin" easter egg):** (a) **Easter egg** —
mashing the dog's **S/D keys 4× quickly** (≤2s between presses) plays
`assets/music/what-da-dog-doin.mp3` (`GameScene.registerDogAction`, counter fed from the existing
S=sit / D=sniff handlers; audio loaded + added like bark/sniff). Headless-checked: asset loads,
sound adds, combo fires with no errors. (b) **"Page unresponsive" investigation** — MEASURED
headless that transitions are sleep/wake with flat/bounded listeners, so the "listener leak per
transition" theory was **disproven**; a started shutdown-cleanup fix was **reverted** as a no-op.
Justin's repro clue is **rapid building enter/exit**, so the lead is now the door-trigger /
rapid-switch path (see Open items → Performance). (c) **Read-only Auth census** — 223 users, 207
anonymous (93%), 99 idle >30d: real but tiny; anon-cleanup parked as backlog. Handoff Open-items
+ Atlantis section updated to match. **Not yet committed at time of writing → committed with the
easter egg push.**
**2026-09-30 (Atlantis final test reworked → subatomic "Crystalline Core Attunement"):**
Replaced the symbol→name Crystalline Resonance puzzle with a **syllabus-focused final test**
(see its section). The Giza Core now opens a one-crystal-at-a-time **forge**: per crystal,
inject **protons** (identity morphs live), add **neutrons** (mass/isotope; the tile vibrates
until stable), tune **electrons** (charge → cation/anion), then a **net-zero circuit** finale
links Na⁺/F⁻, Mg²⁺/O²⁻, Al³⁺/N³⁻ (Carbon is the neutral tutorial "heart"). Rewrote
`data/resonance.ts` (`CORE_ELEMENTS`/`ION_PAIRS`/`IDENTITY_BY_Z` + helpers) and
`ui/ResonanceOverlay.ts` (phase state machine, press-and-hold steppers, live derived readouts,
circuit linker); reworked the `.res-*` theme in `index.css` (tile / phase tracker / stepper /
circuit); updated the "Giza Core" dex card copy in `Isotopedex.ts`. Kept the **same**
`openResonanceOverlay` entry point, the **same** `isotopia.resonance.v1` store (`attuneNode`
now means "crystal forged"), and the **same** `markEnlightened`/`isEnlightened` reward +
future-zone hook — so `CityInteriors.ts` trigger wiring and the dex secret cards were
untouched. Clean TS build; **E2E-VERIFIED** end-to-end via headless Playwright (14/14 checks,
zero page errors; `/tmp/pw/test-sanctum-final.mjs`, launch chromium with
`--disable-dev-shm-usage`). **Not yet committed/pushed.**
**2026-09-30 (Isotopedex Magic Key card + Atlantis Crystalline Resonance):** Two
additions, both live on `main`. **(1) Isotopedex secret cards:** once the forest chest is
looted, the **Magic Key** shows as a caught-style **"Secret Treasure"** card
(`makeMagicKeyCard`, gold `dex-special` style, `assets/items/magic-key.png`), and the dex
header gained a **✦ secrets** tally. Both are kept OUT of the `ELEMENTS` roster and the
"/N caught" element count, so the periodic table, quizzes, and cloud schema are untouched.
**(2) Atlantis "Crystalline Resonance" puzzle** (see its section above): the sanctum's
Giza Core `ATTUNE ✦` pad opens `ui/ResonanceOverlay.ts`, an error-correction game (fix 6
mislabeled crystals to 100%, i.e. Enlightenment, which awards a "Giza Core" secret dex
card). New: `data/resonance.ts`, `ui/ResonanceOverlay.ts`; touched `progress.ts`
(resonance store), `CityInteriors.ts` (AtlantisScene Core trigger), `DoorCue.ts` (`✦`
marker), `index.css` (`.res-*` theme), `Isotopedex.ts`. Build clean, **not yet
headless-tested** (no `playwright` package installed locally). Commit `68d4ba7`.
**2026-09-30 (woods signpost removed + chest shrunk):** The forest "treasure chest" was
found to be a **duplicate of the signpost** (`treasure-chest.png` equals the old
`signpost.png`, identical MD5). Deleted the standalone **signpost** scenery object
(removed from `woods_map.json`, the `WoodsScene` SCENERY table and texture load, and
`signpost.png` itself) and **halved the chest scale** (`CHEST_ART_SCALE` 1.4 to 0.7). The
chest still draws the (signpost) image, so it needs real chest art (see Open items).
Commit `1f19725`.
**2026-09-29 (forest treasure chest + Magic Key):** Added a **treasure chest** in the
North Woods — a tree-framed clearing at tile **(27,6)**, east of the trail on the way
up to the LOOKOUT (placement BFS-verified reachable/walkable/off-trail). Walk up to it
(same proximity trigger as an Elemental) and a **dialog box** opens revealing the
**Magic Key**. Chest art `src/assets/woods/treasure-chest.png` (32×31; Justin supplied
it — moved out of the build-only `dist/` and de-spaced); key art
`src/assets/items/magic-key.png` (orange bg edge-flood-filled off Justin's sprite,
inner element tiles preserved). Taking it calls `progress.giveItem(MAGIC_KEY)` — a new
**local-only inventory store** (`isotopia.items.v1`; `giveItem`/`hasItem`/`itemIds` +
the `MAGIC_KEY` id), same out-of-cloud pattern as evolved forms so it can't reject the
RTDB write. The key persists across reloads; the chest then reads as empty. New pieces:
`GameScene.spawnTreasureChest`, `CHEST_ART_SCALE` (tune if size looks off),
`showNpcDialog` gained an optional `{image}` to show a sprite, `.npc-portrait` CSS.
Chest initially at (27,6); moved to a hidden far-east nook and the tunnel built the
same day (next entry).
**2026-09-29 (Atlantis sanctum + woods bug fixes):** Built the Magic Key's payoff and
fixed two woods bugs. **(1) Hidden Atlantis sanctum:** repurposed the old `CloudCity`
scene into **`AtlantisScene`** (SceneName `atlantis`), background
`src/assets/rooms/wisdom-of-atlantis.png` (the "Periodic Table of Crystals" art,
1408×768). **Removed** the always-open **B3 "Cloud City" purple portal** and added a
**key-gated `custom` portal in the Museum's lowest level (B4)** via the painted-mask
pipeline (edited `/home/nah/museum-collision/museum-level-3&4_PAINT-ME.png`: cleared
B3 (4,3), painted B4 (18,4); re-ran `gen_interior_collision.py` + `embed-maps.mjs` —
only `interiorNav.ts` changed, verified by git diff). New
`CityInteriorScene.createSanctumPortalIfUnlocked()` creates the portal **only when
`hasItem(MAGIC_KEY)`** (fully hidden otherwise — no pad, plain floor), re-checked on
`wake` so it appears if the key is found after B4 was first entered. **(2) Woods grass
bug:** removed `enableGrassEncounters` from `WoodsScene` — no more random any-grass
encounters; each wild Elemental (oxygen 16,8; nitrogen 25,10) is a dedicated cloaked
spawn tile (Rad-Finder-found), like everywhere else. **(3) Chest fix:** hardened
`NpcsAndObjects.checkProximity` to skip objects not in grid-engine (a throwing
`getPosition` on one object was silently killing proximity for every object after it —
the likely chest-dialog culprit); reworded the reveal to "a mysterious key"; moved the
chest to a hidden far-east nook **(37,13)**. **(4) Bundle-order fix:** `GlobalInfo.ts`
subclasses Phaser at load but didn't import it; added `import 'phaser'` so the bundler
always evaluates Phaser (which sets `global.Phaser`) first. **E2E-VERIFIED** end-to-end
via headless Playwright (cached chromium + Node 22; a `?e2e`/`?debug`-guarded hook in
`game.ts` exposes `window.__isotopia`): walk-up → dialog → "a mysterious key" + key image
→ `giveItem` persisted → chest then empty; and the B4 sanctum portal is hidden without
the key, present with it, and the Atlantis scene boots with its background. Still worth a
real-device pass. (To re-see the reveal after looting once, clear localStorage
`isotopia.items.v1`.) Throwaway test scripts live in `/tmp/pw/*.mjs`.
**2026-09-29 (camera zoom fix + museum spread):** Interiors had regressed ~50% closer
because the 2026-09-27 `keepRoomFilled` cover-zoom over-zoomed wide/short rooms on tall
(portrait) screens — **removed `keepRoomFilled`**; interiors use the fixed per-scene
camera zoom again, and `createCamera` now sets a **black camera background** so any
uncovered margin letterboxes cleanly (no white band). Pulled the large **city** exterior
back (2.5 → **1.8**); town/woods unchanged at 2.5. Moved **Carbon from museum B1 to B2**
(B1 = Hydrogen + Helium). Shipped to `main` → live.
**2026-09-29 (cloak + museum move + Evolution Lab):** Elementals are now **cloaked**
(steady very-faint alpha, `components/Cloak.ts`) so they're hard to spot — the Rad
Finder carries finding them. Relocated **Hydrogen & Helium into the Museum first
basement (B1) and Carbon into B2** (pulled from town lake / Home / woods incl. the grass
pool; Rad Finder hints updated). Built the **Evolution Lab** in the city Power Station:
three working chambers (VSEPR Fusion, Hyper-Chamber expanded-octet, ΔEN Tug-of-War),
16 compound products, a local `markEvolved` store, and an `assets/compounds/<id>.png`
art drop-in pipeline (art pending from Justin). Fixed `CityInteriorScene.preload` not
loading object art. All shipped to `main` → live.
**2026-09-29 (UX/accessibility pass):** shipped the multi-agent code-review fixes
(details in `SESSION-HANDOFF-2026-09-29.md`) — Rad Finder redesigned as a directional
arrow toward a DEX-tracked target (+ a "LOOKOUT" woods cue); prefers-reduced-motion
(dark battle cover, no white flashes); 9–10px legible dex/auth text + re-enabled
pinch-zoom; paced-release empty-world messaging; auth polish (inline errors, busy
states, auto-verify, iPad input hints); confirmed 3 questions per Elemental.
**2026-09-27 (deploy + web-only):** decided Isotopia is **web-only** (native App
Store abandoned — no Apple ID, Mac too old); merged the day's `web-fixes` work into
`main` and pushed → Netlify deployed it live; `mobile` branch marked abandoned
(archived at `origin/mobile`), handoff rewritten for the web-only future.
**2026-09-27 (web-fixes):** "Support Isotopia" page + links (`support.html`,
`data/support.ts`, `SUPPORT_URL` env) · sign-in fields could not receive A/S/D/R/space/arrows
(Phaser's game-wide KeyboardManager preventDefault()s captured keys; the guard now
disables the manager while a field is focused) · progress sync failed for up to an
hour after verifying (ID token now force-refreshed) · 8s startup timeout → local
data · game resizes to the screen shape (portrait iPad fills the screen; rotation
handled; `GameScene.keepRoomFilled` zooms interiors to cover — fixed the white band
under city rooms) · Rad Finder meter was hidden under the tips bar; 6 city hints
were wrong · battle card fits phones · web app manifest + home-screen icons ·
Firebase config for the Netlify build is unchanged. Previously: lab favicon,
roster CSV export ·
Fixed a boot black screen (Rad Finder mounted before `<body>` existed; now all
startup DOM mounts go through `ui/domReady.onBodyReady`) · removed Neonu Reeves
(the woods companion NPC) ·
Rad Finder tool — equippable Geiger counter (dex Tools row) with dex location
hints + an in-game homing HUD, so students never get stuck ·
Per-admin classes: each staff owns one named+colored class (`classes/{uid}`),
membership via `assignments/{studentUid}` (replaced `members`), new Class tab,
per-class schedule/settings, roster scoped per class · fixed supers being written
as students (they already held the `teacher` claim; cleaned 2 stray records) ·
Email/password student registration + email verification (replaced Google
`@sad15.org` student sign-in) · teacher-controlled roster (bulk add/remove) ·
super/admin role tiers (supers promote admins; no new supers; admins sign in with
their game email+password) · RTDB rules reworked (staff/super/verified gates) ·
City tweaks (half-size people, doubled landmarks, more lamps/trees) · city
populated (streets, plaza, pedestrians, talkers) · walkable CityScene · secret
path + city-reveal cutscene · offline-playable (embedded maps, relative paths,
self-hosted font) · copyright-safe creature rename · teacher portal + Firebase
live (accounts/dashboard) · GBA battle feel · mobile-first movement + Isotopedex.
