# Jungle — Lesson Two: Electron Configuration (the "Canopy Energy Network")

Design + feasibility map for the **Jungle (level 2)** lesson set-piece. **Status: BUILT + SHIPPED —
Phases 0–4 complete, merged to `main` (PR #1, 2026-10-02).** See the HANDOFF "2026-10-01g/h/i" entries
for the build summaries + E2E verification.
> **Totem count update (2026-10-02):** the totem set shipped at 9, grew to 13 (adding the 3p block
> Si/P/Cl/Ar), then was **trimmed to a curated 8** at Justin's request (the test was too long) while
> **keeping the 4s-before-3d swap as the finale** (Scandium + Iron). Dropped as totems: N/O/P/S/Cl
> (still catchable Elementals). See HANDOFF "NEXT SESSION task #2". The "9"/"13" counts below are
> left as historical records of each phase; the current set is **8** (`TOTEMS` in `data/aufbau.ts`). Files: `src/data/aufbau.ts`, `src/ui/CanopyOverlay.ts`,
`.canopy-*` in `src/index.css`, totems in `src/Scenes/JungleScene.ts`, Canopy Key card in
`src/ui/Isotopedex.ts`, canopy store in `src/data/progress.ts`. This doc maps Justin's handwritten
"Canopy Energy Network" note onto what the engine can actually do, flags the honest constraints, and
lays out the phased build that was **mostly assembly of existing systems**, not net-new engines.

## Topic (AP Chem)
Electron configuration and the rules that govern orbital filling:
- **Sublevel capacities:** s = 2, p = 6, d = 10, f = 14.
- **Aufbau order** (fill lowest energy first): 1s → 2s → 2p → 3s → 3p → **4s → 3d** → 4p → 5s → 4d …
  (the 4s-before-3d swap is the money concept.)
- **Blocks:** an element's position = its outermost sublevel (s/p/d/f block). e.g. Carbon = 1s²2s²2p².

This is the pedagogical bridge between the two finished puzzles: the **sanctum (L1)** taught
*protons/neutrons/electrons & charge* (electrons as a COUNT); the jungle teaches *where those
electrons actually live* (shells & sublevels); the **desert (L3)** teaches *what they emit when they
jump between those levels* (E = hν, flame colour). Same electrons, three lenses.

---

## ⚠️ Feasibility verdict (read first)
**Buildable, and a natural clone of the sanctum forge — but one part of the note needs reframing.**

- ✅ **The filling puzzle is a near-perfect fit for the existing forge.** `ResonanceOverlay` already
  does "inject particles one at a time, to an EXACT target count, in a strict PHASE sequence, with a
  live-derived readout and confirm-when-exact." Electron configuration is literally that with the
  phases renamed to **sublevels** (1s, 2s, 2p, …) and each phase's target = that sublevel's capacity
  (or the remaining electrons for the final partial sublevel). The "can't fill 2p before 2s is full"
  constraint is just the phase tracker refusing to advance — already how the forge works.
- ✅ **Totem = element config puzzle** is the sanctum's `CORE_ELEMENTS` pattern: a data table of
  target elements, one at a time. Configs are a **pure function of atomic number** (`elements.ts`
  already has `number`), so no hand-authoring per element.
- ⚠️ **The "vertical canopy platforming" is the part to reframe.** Isotopia is a **top-down,
  tile/grid game (grid-engine)** — there is no jump/gravity/vertical-traversal engine, and adding one
  is out of scope. So you **cannot literally climb from 1s roots up to f-block emergent giants** in
  the overworld. Instead the **verticality lives in the puzzle overlay**: the Canopy Energy Network
  renders as a **vertical orbital diagram** (roots/1s at the bottom → emergent canopy/high shells at
  the top) that you fill bottom-up. The overworld stays top-down: you **walk between totems**, and
  each opens the vertical canopy overlay. (This is exactly how the sanctum renders its forge and the
  desert renders its beacons — the teaching UI is DOM over the Phaser canvas.)
- ✅ **"Electron fireflies / bioluminescent seeds"** = the particle you inject (the forge's ＋/−
  steppers), reskinned as glowing seeds. Pure cosmetics over the existing stepper.
- ✅ **"Temple gate / vine bridge opens"** = the sanctum's completion → reward/flag pattern, and/or a
  `Door`/`Portal` that only appears once the lesson is solved (same shape as the key-gated sanctum
  portal).

**Bottom line:** ~80% assembly (forge clone + data table + a jungle pad/totem + a completion flag),
~20% new (the Aufbau data module + the vertical-canopy overlay layout + totem art). No new engine.

---

## The player story (one paragraph)
Deep in the rainforest stand dormant **stone totems**, each carved as an animal spirit bound to an
element you've met (a Jaguar = Carbon, a Serpent = Silicon…). Approach a totem and the **Canopy
Energy Network** awakens: a vertical lattice of light from the **root nodes (1s)** at the jungle
floor up through **vine platforms (p)**, **high crowns (d)**, to the **emergent giants (f)**. You
channel **electron-seeds** into the sublevels **in Aufbau order** — fill 1s (2), then 2s (2), then
2p (…) — until the totem's element is correctly configured (Carbon = 1s²2s²2p²). Fill out of order or
overflow a sublevel and the circuit **fizzles and tells you why** (the orbital-energy rule).
Configure every totem and the ancient **temple gate** powers up — a bonus reward (the **Canopy
Key**), not a wall: the way onward to the **desert pyramid (level 3)** is open either way.

## Proposed decisions (veto any)
1. **Reuse the sanctum forge engine.** Clone `ResonanceOverlay` → `ui/CanopyOverlay.ts`; clone the
   `resonance.ts` data pattern → `data/aufbau.ts`. Don't reinvent steppers/phase-tracking/audio.
2. **Totems = Elementals you've CAUGHT** (continuity with sanctum "crystals you caught" + desert
   "fuels you caught"). A totem is dormant until you own that Elemental; dev/e2e bypass like the
   others. This ties overworld catching → jungle configuring.
3. **Verticality is in the overlay, not the overworld** (see feasibility). Overworld = walk between
   totems; four decorative **s/p/d/f "ruin" landmarks** can flavour the biome but the real filling is
   the overlay's vertical lattice.
4. **Electron configs are derived, not authored:** a pure `configFor(z)` Aufbau function (Z 1–~36 to
   start, covering through Krypton; extend later). Totem list is just element ids + a spirit name/art.
5. **Completion flag mirrors Enlightenment:** `isCanopyAttuned()` in `progress.ts` (own local key),
   a secret Isotopedex card ("Canopy Key" / green), and the hook that opens the temple gate.
6. **Scope the blocks to the lesson:** ship **s + p block** totems first (Z up to 20, clean 2s/2p/3s/
   3p), then add **one or two d-block totems** (Scandium 21, Iron 26) specifically to teach the
   **4s-before-3d** swap. f-block is flavour only (emergent-giant art) unless we want a bonus totem.

## Reuse map (why this is mostly assembly)
| New piece | Existing pattern to clone |
|---|---|
| Canopy fill overlay (seeds → sublevels, in order, confirm-when-full) | `ui/ResonanceOverlay.ts` forge: phase tracker + ＋/− steppers + live readout + confirm-when-exact + chime/dissonance |
| Aufbau data (capacities, order, per-element target config) | `data/resonance.ts` (`CORE_ELEMENTS`, helper fns, `IDENTITY_BY_Z`) → new `data/aufbau.ts` |
| Totem = dormant-until-caught puzzle object on a pad | sanctum `drawDoorCue('✦')` + `movementStopped` gate + `hasItem` (here `hasCaught`), and `spawnTalkingNpc`/`Npc` proximity |
| "Wrong order fizzles + teaches" feedback | `BeaconOverlay` mismatch (fizzle + reason) / forge off-target vibrate |
| Temple-gate opens on completion | key-gated sanctum `Portal` (appears only when unlocked) + `drawDoorCue` |
| Completion flag + secret dex card | `progress.ts` resonance store (`isNodeAttuned`/`markEnlightened`) + `makeEnlightenmentCard` |
| Electron-seed / firefly visuals | Rad Finder glow + `Cloak` alpha pulse; EvolveOverlay disc animations |

## Data model sketch (`src/data/aufbau.ts`)
```ts
export const CAPACITY = { s: 2, p: 6, d: 10, f: 14 } as const;
// Aufbau order as (n, sublevel) rungs, lowest energy first.
export const FILL_ORDER = ['1s','2s','2p','3s','3p','4s','3d','4p','5s','4d','5p','6s','4f','5d','6p','7s'];
export interface Rung { label: string; sub: 's'|'p'|'d'|'f'; cap: number; electrons: number; }
export function configFor(z: number): Rung[] { /* fill FILL_ORDER until z electrons placed */ }
export function configString(z: number): string { /* "1s² 2s² 2p²" */ }

export interface Totem { id: string; spirit: string; /* art key */ gem: string; }
export const TOTEMS: Totem[] = [
  { id: 'carbon',    spirit: 'Jaguar',  gem: '#9e9e9e' }, // tutorial, Z6 = 1s²2s²2p²  (continuity w/ sanctum heart)
  { id: 'nitrogen',  spirit: 'Macaw',   gem: '#64b5f6' }, // Z7  2p³
  { id: 'oxygen',    spirit: 'Frog',    gem: '#ef5350' }, // Z8  2p⁴
  { id: 'neon',      spirit: 'Firefly', gem: '#ff7043' }, // Z10 full 2p (noble gas = full sublevel)
  { id: 'sodium',    spirit: 'Serpent', gem: '#ba68c8' }, // Z11 opens 3s
  { id: 'aluminum',  spirit: 'Armadillo', gem:'#b0bec5' },// Z13 opens 3p
  { id: 'sulfur',    spirit: 'Toad',    gem: '#ffca28' }, // Z16 3p⁴
  // d-block gotcha (ship after s/p):
  { id: 'scandium',  spirit: 'Condor',  gem: '#4a7c7c' }, // Z21 ...4s² 3d¹  → teaches 4s BEFORE 3d
  { id: 'iron',      spirit: 'Panther', gem: '#8d6e63' }, // Z26 ...4s² 3d⁶
];
```
All of the above totem ids are **already catchable Elementals** (`data/elements.ts`), so decision #2
needs no new creatures. Neon as "full 2p" is a clean noble-gas teaching beat.

## Phased build (each phase ships + is headless-verifiable, like the desert)
- **✅ Phase 0 — data + flag (DONE 2026-10-01g).** `data/aufbau.ts` (`configFor`/`configString`,
  `isAufbauSwap`, `TOTEMS`), `progress.ts` canopy store (`attuneTotem`/`isTotemAttuned`/
  `markCanopyAttuned`/`isCanopyAttuned` + `CANOPY_KEY` item, own key). `configFor` checked against
  C/O/Ne/Na/Al/S/Ar/Sc/Fe (all pass incl. 4s-before-3d). *(Shipped Z 1–36 coverage via FILL_ORDER;
  the 9 totems use Z≤26.)*
- **✅ Phase 1 — the Canopy overlay (DONE 2026-10-01g).** `ui/CanopyOverlay.ts` cloned from
  `ResonanceOverlay`: vertical lattice (1s at the bottom up), press-and-hold ＋/− electron-seed
  steppers per rung, Aufbau order enforced (next rung locked until current is full), live config
  readout, confirm-when-complete, fizzle+reason on overfilling a partial sublevel, "⚡ Aufbau surprise"
  note on the 4s-before-3d rung. `.canopy-*` jungle theme in `index.css`.
- **✅ Phase 2 — one totem in the jungle (DONE 2026-10-01g).** Carbon "Jaguar" totem + the slice:
  `drawDoorCue('✦')`, `movementStopped` gate, dormant-until-caught w/ `?dev`/`?debug`/`?e2e` bypass,
  opens the overlay, lights the totem (gem-coloured aura) on solve + persists.
- **✅ Phase 3 — the totem set + reward (DONE 2026-10-01g).** All 9 `TOTEMS` placed on verified-
  walkable corridor tiles. Completing the set awards the **Canopy Key** secret dex card
  (`makeCanopyKeyCard`) + `markCanopyAttuned()`. Per decision #2 the Jungle→Desert pad stays **always
  open** — the Canopy Key is a **bonus** (today = the dex card + flag). *(Open decision #4 — what else
  the Canopy Key unlocks, e.g. a hidden grove — is still TBD, deferred to Phase 4.)*
- **✅ Phase 4 — polish + art (DONE 2026-10-01h).** Carved stone **totem sprites** per element
  (`tools/gen_totems.py` → `src/assets/jungle/totem-<id>.png`; placeholder, see `ART-NEEDED.md`),
  ambient **electron-seed fireflies** (`spawnTotemFireflies`), gem lights on the carved **face**
  (`lightTotem` + `GEM_FRAC`), and a one-time **"Canopy awakens" completion cue** (`celebrateCanopy`:
  lit grove + green flash + gem bursts + title) resolving decision #4 below. Reduced-motion paths on
  every new effect. *(The "s/p/d/f ruin landmark props" idea was dropped — the carved totems, each
  showing its element symbol, already carry the lesson; a separate ruin set would just add clutter.)*

## Decisions settled (Justin, 2026-10-01)
1. **✅ Walk order = City → Jungle → Desert** (rewire from the current City → Desert → Jungle). So
   the forward path is Town → Woods → City → **Jungle** → **Desert finale**. Concrete link changes
   (link-only; the jungle map can stay geographically north of the desert — these pads teleport):
   - **City's outdoor pad → Jungle** (was Desert): relabel `JUNGLE`, `nextScene: SceneName.Jungle`,
     add the matching Jungle arrival tile + a Jungle **`CITY`** return pad.
   - **Jungle → Desert stays** (the existing south pad) = the forward step into the finale.
   - **Desert:** repurpose the north **`JUNGLE ▲`** pad as the back-link to the jungle; the existing
     Desert→City south pad can stay as a shortcut home or be dropped.
   - Update **DevWarp** "Outdoors" ordering/labels and the HANDOFF world-links section.
2. **✅ Desert finale is NOT gated on the jungle.** It already requires finishing the **sanctum**
   (`GIZA_CRYSTAL`), and that is sufficient gating. So **do NOT** add `isCanopyAttuned()` as a desert
   prerequisite, and the jungle's **main exit to the desert must stay open regardless of the lesson**
   (the "temple gate" can't be a hard block on the only path forward). The jungle lesson is
   **rewarded, not required**: solving the totems awards the **Canopy Key** secret dex card +
   `isCanopyAttuned()` flag, and may unlock a **bonus** (a hidden grove / shortcut / cosmetic), but
   never blocks progress to the desert.

## Open decisions / wrinkles to settle
1. **d/f scope.** Ship s+p first (Z≤20). Add Sc/Fe for the 4s-before-3d lesson. f-block likely
   flavour-only (the emergent-giant art) unless a bonus totem is wanted.
2. **Electron source.** Infinite seeds (pure puzzle) vs. a limited inventory you gather in the jungle
   (adds a fetch loop). Recommend **infinite** for v1 — the lesson is the ORDER, not resource hunting.
3. **How "vertical" to make the overlay.** Minimum: a labelled rung stack. Nicer: rungs drawn as
   ascending canopy tiers with the jungle palette. Scope to taste.
4. **✅ What the Canopy Key bonus unlocks (SETTLED 2026-10-01h):** a **cosmetic "grove of light"** —
   completing every totem lights the whole grove permanently and plays a one-time awakening cue (green
   flash + gem bursts + title), plus the **Canopy Key secret dex card**. No new *zone* is unlocked
   (none exists yet; adding one is out of scope and the desert is already reachable). If a future realm
   is ever built, `isCanopyAttuned()` is the ready hook to gate it — mirroring `isEnlightened()`.

## Progression across all three levels (for reference)
- **L1 — Crystalline Core Shrine (sanctum, DONE):** protons/neutrons/mass/charge — electrons as a count.
- **L2 — Jungle Canopy Ruins (THIS doc):** electron configuration — where the electrons live (s/p/d/f, Aufbau).
- **L3 — Desert Pyramid Capstone (flame test, DONE):** E = hν / flame emission — what electrons emit when they jump levels.
