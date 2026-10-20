# Desert — Lesson Three: Light, EM Radiation & Atomic Emission

Phased build plan for the desert finale. **Status: Phase 1 + Puzzle A (flame test) SHIPPED
(2026-10-01).** The flame-test puzzle lives **OUTSIDE in the desert** and solving it is what
raises the pyramid. Full topic/vision notes also live in `HANDOFF.md`.

> **⚠️ Model pivot (2026-10-01, Justin): the puzzle is OUTSIDE; there is NO pyramid interior.**
> Earlier drafts of this plan put the flame test *inside* a risen `PyramidScene`. That was
> cut. The flame-test beacons stand in the desert by the buried apex; the **sanctum crystal
> unlocks** the puzzle and **solving it raises the pyramid**. A `PyramidScene` interior was
> built and then deleted — do NOT re-create it unless Justin asks.

## The player story (one paragraph)
Finish the **Atlantis sanctum** → walk out carrying the **giant crystal** (`GIZA_CRYSTAL`).
In the **desert**, approach the altar at the buried pyramid's apex: the crystal wakes three
cold **flame-test beacons**. Light each by burning an **Elemental you've CAUGHT** whose flame
colour matches (Sodium = yellow, Boron = green, Sulfur = blue). Match all three and a
**massive hidden pyramid rises from the sand**. It's the pedagogical sequel to the sanctum:
the sanctum taught *electrons in shells*; the beacons teach *what those electrons emit when
excited and relax* — the puzzle says that out loud.

## Decisions, baked in (veto any of these)
1. **Flame-test fuels = Elementals you've CAUGHT, used from the Isotopedex** (Justin's call,
   2026-10-01). NOT collectible dusts. Every beacon element must be a real catchable Elemental.
   **Update (2026-10-01): the six classic flame-test metals were added as Elementals** — K, Cu,
   Ba, Li, Sr, Ca (`data/elements.ts`, placed as wild spawns in `DesertScene.createNpcs`) — so
   the beacons now use the authentic palette: **Na→yellow, Cu/Ba/B→green, K→lilac, Li/Sr→red,
   Ca→orange**, with **S→blue** and **Mg→white** as distractors. The green (Cu/Ba/B) and red
   (Li/Sr) collisions are the teachable gotchas. ⚠️ **The 6 new Elementals need real art** (high
   priority — `ART-NEEDED.md`); today they're tinted placeholders. See `src/data/flameTest.ts`.
2. **Gate = the sanctum crystal.** "Crystal unlocks puzzle": `hasItem(GIZA_CRYSTAL)` is
   required to open the beacon puzzle (`?dev`/`?debug`/`?e2e` bypasses for testing). Solving
   the puzzle calls the existing `DesertScene.playPyramidRise()`.
3. **No interior scene.** The puzzle and the payoff (the rise) are entirely in `DesertScene`.
   The risen pyramid's `TOMB` door stays a "coming soon" stub (future phases, if any, are TBD
   — likely also outside).

## Reuse map (why this is mostly assembly, not net-new engines)
| New mechanic | Existing pattern to clone |
|---|---|
| Solar Prism / EMS wavelength dial | `ui/EvolveOverlay.ts` VSEPR **bond-angle dial** (±tolerance) + live HUD |
| Energy-calc locks (`E = hν`) | `ui/ResonanceOverlay.ts` **stepper + live-derived-readout + confirm-when-exact** |
| Flame-test beacons (collect + match) | item store (`progress.ts` `giveItem`/`hasItem`) + simple color match |
| Pyramid rise cutscene | `ui/CityReveal.ts` cutscene pan |
| New scene + door/portal wiring | `AtlantisScene`, `Door`/`Portal`, `drawDoorCue`, `SceneName`, `game.ts` reg, DevWarp `GROUPS` |
| Completion flags/persistence | resonance/items local-store pattern (`isotopia.resonance.v1`) → new `isotopia.pyramid.v1` |

---

## Phase 0 — Assets & the crystal item (the two backlog starters)
**Goal:** the raw pieces exist. No gameplay yet.
- **Pyramid sprite — ✅ DONE (2026-10-01, tile-composed, stepped):** store assets dropped
  (none matched cleanly / all needed tint or purchase). Instead built **`tools/gen_pyramid.py`**
  (same spirit as `gen_desert.py` / `slice_jungle.py`): a stepped ziggurat composed from the
  existing GrayCatGames desert **sand tiles** + crisp procedural step shading (NW light: lit
  tread tops, dark bottom/right risers, warm sandstone wash so it contrasts with the ground,
  2px outline), with a carved **apex aperture** (sunbeam opening) and a front **doorway**.
  Emits two states:
  - `src/assets/desert/pyramid.png` — risen hero sprite, **352×272 px (~22×17 tiles)**.
  - `src/assets/desert/pyramid-buried.png` — apex poking from a cracked-earth ring (pre-rise marker).
  - `tools/pyramid_preview.png` — visual check (risen + buried on sand, dog-scale box).
  **For Phase 1 wiring** (coords in the risen sprite's pre-crop canvas, origin top-left):
  apex aperture ≈ px rect (194,22)-(220,42) → sunbeam/beam origin; doorway ≈ (192,249)-(222,285)
  → place the "ENTER ▲" pad / `PyramidScene` door under it. Re-run `python3 tools/gen_pyramid.py`
  to regenerate; tweak `TIERS`/shading constants at the top. **Intentionally stepped & "good
  enough for now"** (Justin: "we can fix the pyramid later") — a smoother/hand-drawn pyramid can
  replace the same PNG filenames later with zero code change.
  - *Dropped store options (kept for reference if we ever want smoother art):* KR "Spirit of
    Egypt" (kokororeflections.itch.io, $13.99), Ventilatore "Desert Oasis" ($3.99, 16px),
    OpenGameArt "Desert Pyramids" by @SUFFLE12 (CC-BY-SA, 16px, interiors).
- **Crystal item — ✅ DONE (2026-10-01, built + bundle-verified):** added `GIZA_CRYSTAL`
  (`'giza-crystal'`) to the item store in `progress.ts` (mirrors `MAGIC_KEY`). Granted via
  `giveItem(GIZA_CRYSTAL)` **inside `markEnlightened()`** (single choke-point — no
  `ResonanceOverlay` change) + a **load-time back-fill** for players already enlightened before
  the item existed. Local-only (`isotopia.items.v1`), out of the cloud schema, same as the
  Magic Key. **No separate dex card** — Enlightenment already awards the "Giza Core" secret
  card, so a second would double-count. `npm run build` clean (Node 18); bundle confirms the
  declaration + 2 grant call sites. **Check with `hasItem(GIZA_CRYSTAL)`.**
- **Verify (full in-browser):** rides along with Phase 1 — force Enlightenment under `?dev` →
  confirm `hasItem(GIZA_CRYSTAL)` persists across reload; pyramid sprite imports without errors.

## Phase 1 — The rise (✅ mostly DONE 2026-10-01; interior stubbed)
**Goal:** a complete, playable spine — approach the site, trigger the rise, (walk inside = next).
All in `DesertScene.ts` + the `progress.ts` pyramid store. Implemented this pass:
- **✅ Buried marker:** the `desert_pyramid_buried` sprite sits at base-centre tile **(40,22)**
  with a `RELIC ✦` cue; the rise trigger tile is **(40,24)** (player walks up col 40 from the
  city entrance and sees it dead ahead). Placement validated by a static map render.
- **✅ Gate check (now opens the flame puzzle):** step on the altar (40,24) → `onApproachAltar()`
  (renamed from `tryRaisePyramid`). Needs `hasItem(GIZA_CRYSTAL)` (`?dev`/`?debug`/`?e2e`
  bypasses). Without the crystal it drops a one-time hint. **With** it, opens the flame-test
  beacon puzzle (Puzzle A); the rise now fires only when that puzzle is SOLVED (its `onSolved`
  callback calls `playPyramidRise()`), not on bare step-on.
- **✅ Rise cutscene (in-scene Phaser, NOT a DOM clone of CityReveal):** freezes the dog
  (`inDialogue` + `input.enabled=false`), camera pans/zooms to the site, the full pyramid
  **emerges from the ground** behind a geometry mask at the ground line, **jitters side-to-side**
  as it climbs (~4.8s, Sine.easeOut), **sheds dirt particles** (tinted clods that fall + fade to
  nothing) and **tumbling debris** (reused `boulder-2`/`shrub-2`), a brief camera jolt at
  breach + a settling thud, then a title line, camera returns to the dog, control restored.
  `prefers-reduced-motion` skips straight to risen. Dirt particle texture generated in-scene.
- **✅ Persistence:** `progress.markPyramidRisen()` / `isPyramidRisen()` → `isotopia.pyramid.v1`
  (own local key, out of cloud schema). On return visits the risen pyramid shows immediately
  (no buried sprite, no re-animation) + a `TOMB ▲` door cue.
- **✅ Interior CUT (2026-10-01):** the `TOMB ▲` door stays a "sealed — coming soon" dialog on
  purpose. A `PyramidScene` interior was built then **deleted** per Justin's pivot — the whole
  lesson plays outside. The risen pyramid is decorative/no-collision (fine; nothing to walk into).
- **Verification (2026-10-01):** build clean (Node 18); headless (chrome-headless-shell-1243 +
  Node 22 CDP, `?e2e&dev`) confirms the **desert loads with the buried pyramid, player at START,
  0 page errors**, and the geometry-mask + particle primitives each render fine. The **animated
  rise itself could not be verified headlessly**: ~5s of continuous software-GL (swiftshader)
  rendering starves the event loop (same class of limit the handoff notes for the sanctum). Needs
  a **real-browser smoke test**: `npm run watch` → `localhost:10001/?dev` → DevWarp to Desert →
  walk onto (40,24) (dev bypasses the crystal) → watch it rise. (Regular headful Chrome crashes
  in this sandbox, so no on-device check was possible here.) Throwaway harnesses in `/tmp/pw/`.

## Phase 2 — Puzzle A: Flame-Test Beacon Pillars — ✅ SHIPPED (2026-10-01)
**Goal (met):** match flame colours to raise the pyramid — the puzzle IS the rise gate.
- **Data:** `src/data/flameTest.ts` — `FLAME_COLORS`, `FLAME_FUELS` (10 caught-Elemental fuels:
  Na=yellow, Cu/Ba/B=green, K=lilac, Li/Sr=red, Ca=orange, plus S=blue & Mg=white distractors),
  `BEACONS` (five required colours: yellow/green/lilac/red/orange). *(2026-10-01: expanded from
  Na/B/S to the full flame-test palette once K/Cu/Ba/Li/Sr/Ca were added as Elementals.)*
- **Puzzle UI:** `src/ui/BeaconOverlay.ts` (pure DOM, cloned from `ResonanceOverlay`): tap a
  beacon → tap one of **your caught Elementals** → it burns its flame colour; a match lights
  the beacon, a mismatch fizzles + teaches. Fuel tray = `FLAME_FUELS` filtered by
  `isCaught(id)` (dev/e2e sees all). All three lit → a "Raise the pyramid ▸" button →
  `onSolved()`.
- **World:** `DesertScene` places three `beacon_orb` braziers (dark) by the buried apex;
  `onApproachAltar()` opens the overlay (crystal-gated); on solve, `lightBeacons()` tints them
  to their colours and `playPyramidRise()` runs. CSS: `.beacon-*` block in `src/index.css`.
- **Teachable chemistry:** every fuel is a real, catchable Elemental with a genuine flame
  colour; Mg (brilliant white) is an honest distractor. The emission "why" is stated in the
  overlay intro (excited electrons fall back → photon of fixed colour).
- **Verified (2026-10-01):** `npm run build` clean; headless (chrome-1243 + Node 22 CDP,
  `?e2e&dev`) — desert boots with 3 braziers, overlay shows 3 beacons + 4 fuels, solving
  lights all 3 and reveals the raise button, confirming closes the overlay and sets
  `rising=true`, **0 console errors**. The rise *animation* needs a real-browser look
  (software-GL starves headlessly). The **no-crystal gate** path can't be seen under `?e2e`
  (that flag also trips the dev bypass) — confirm in a real browser as a non-enlightened player.

## Phase 3 — Puzzle B: Solar Prism / EMS alignment
**Goal:** steer a sunbeam along the spectrum with a λ/ν dial to trip hidden sensors.
- **`ui/PrismOverlay.ts`** (clone `EvolveOverlay`'s dial): dial **wavelength**; HUD shows ν
  and the band live (Radio → IR → Visible → UV). Dial λ **down** → ν & E **up** → UV charges
  an obelisk; dial **up** → IR melts ice / reveals heat. Mirrors/lenses in the room are the
  framing; the dial is the mechanic.
- **Teaches:** `c = λν` and the inverse λ↔ν relationship; "shorter wavelength = higher energy."
- **Verify:** dialing into the target band trips the sensor; readouts update live; out-of-band
  does nothing.

## Phase 4 — Puzzle C: Energy-calc locks (`E = hν`, `c = λν`)
**Goal:** hit a target photon energy to unlock the final chamber.
- **`ui/EnergyLockOverlay.ts`** (clone `ResonanceOverlay`'s stepper + live-derived-readout +
  confirm-when-exact): given a target `E`, adjust ν (or λ) while the HUD computes `E = hν`
  live with h = 6.626×10⁻³⁴ J·s; confirm when within tolerance.
- **Phone ergonomics:** if single-tap stepping to a target is tedious, offer a coarse/fine
  step or a multiple-choice variant (the sanctum flagged the same concern).
- **Verify:** confirm enabled only within tolerance; correct → chamber unlocks + flag.

## Phase 5 — Capstone + reward
**Goal:** "maximum resonance" finale and the payoff.
- With all three gates solved, the **solar capstone** overcharges (big light cue) →
  `capstoneCharged` flag → reward: a secret dex card (mirror `makeEnlightenmentCard`) and/or a
  new unlock hook (the desert's own "path to the next realm," the way `isEnlightened()` is the
  hook that led here).
- **Verify:** full run end-to-end headless (dust→beacons→prism→energy→capstone), flags persist,
  0 page errors — the bar every sanctum/forge feature has shipped against.

---

## Chemistry/pedagogy notes (for the teacher-facing lesson plan)
- **Constants:** c = 3.0×10⁸ m/s; h = 6.626×10⁻³⁴ J·s.
- **Flame colors:** Na yellow, Li red, K lilac/purple, Cu green (blue-green), Sr red/orange,
  Ca orange, Ba green (pale/yellow-green). *Cu vs Ba both green; K masked by Na → cobalt glass.*
- **EM spectrum:** UV = short λ / high E; IR = long λ / low E. Higher ν ⇒ higher E ⇒ shorter λ.
- **The "why" to surface at the pyramid entrance:** emission = excited electrons dropping to
  lower energy levels, releasing a photon whose energy (hence color) is fixed by the gap.
  Direct callback to the sanctum's electron/shell forge.

## Still open (not blocking Phase 0–1)
- Exact gate elements for the rise (soft crystal-only to start; strict set later).
- Pyramid interior layout (one scene with 3 gated rooms vs. portal-linked sub-rooms).
- How much of the 7-color palette the beacon lock actually uses.
- Whether dusts also appear in the open desert vs. only inside the pyramid.
