# Art Needed

Tracks artwork the game is waiting on. Items at the top are **high priority** because
gameplay is already shipped around them and currently uses placeholders.

## ✅ DONE — Flame-test Elementals (6) — real art shipped 2026-10-04

Added as real, catchable Elementals on 2026-10-01 for the desert "Lesson Three" flame-test
beacon puzzle (`DESERT-LESSON3-PLAN.md`), initially with procedural placeholder flame creatures.
**Real pixel art is now in place** (2026-10-04): Gemini art on a flat orange field, backgrounds
stripped with `python3 tools/remove_bg.py IN.jpeg src/assets/elementals/<id>.png` (border
flood-fill + halo erosion; pure PIL, no numpy needed), then `npm run build`. All six are in
`ART_IDS`, so the art shows with no code change.

| Element | id | Monster name | Flame colour | Art file | Source |
|---|---|---|---|---|---|
| Potassium | `potassium` | Kaliflare | lilac (`#b060e0`) | `src/assets/elementals/potassium.png` | `~/Downloads/Kaliflare.jpeg` |
| Copper | `copper` | Cupragleam | green (`#3fae57`) | `src/assets/elementals/copper.png` | `~/Downloads/Cupragleam.jpeg` |
| Barium | `barium` | Bariglow | pale green (`#7fd651`) | `src/assets/elementals/barium.png` | `~/Downloads/Bariglow.jpeg` |
| Lithium | `lithium` | Lithflare | crimson (`#e23b4e`) | `src/assets/elementals/lithium.png` | `~/Downloads/Lithflare.jpeg` |
| Strontium | `strontium` | Stronflare | scarlet (`#ff4d2e`) | `src/assets/elementals/strontium.png` | `~/Downloads/Stronflare.jpeg` |
| Calcium | `calcium` | Calciglow | orange (`#ff7a1a`) | `src/assets/elementals/calcium.png` | `~/Downloads/Calciglow.jpeg` |

(To swap nicer art later: overwrite `src/assets/elementals/<id>.png` + `npm run build`. The old
procedural placeholders can be regenerated with `python3 tools/gen_placeholder_elementals.py`.)

**Deploy note:** these spawn by default (`classConfig` ships `releaseAllNow: true`). In a class
with a release *schedule* (`releaseAllNow: false`), the teacher must release potassium / copper /
barium / lithium / strontium / calcium or they won't appear (and the beacon puzzle can't be solved).

---

## Where they appear
All six are placed as wild Elementals in the **Desert** (`DesertScene.createNpcs`), spread across
open sand so students catch them on the way to the pyramid, then burn them at the beacons.

---

## 🟢 NICE-TO-HAVE — Jungle Canopy totems (8 placed) — placeholder art in place

The jungle "Lesson Two" (electron configuration — `JUNGLE-LESSON2-PLAN.md`) places a carved stone
**totem** per element along the corridor. **They have PLACEHOLDER art** — procedurally-generated
carved granite monoliths with a gem socket ("spirit eye", lit in the totem's colour once configured)
and the element symbol carved in (`tools/gen_totems.py`). Fully wired + shipped; nicer carved
**animal-spirit** totems are welcome but not blocking.

The totem set was **trimmed to a curated 8** on 2026-10-02 (the test was too long — see HANDOFF
"NEXT SESSION task #2"). Only the 8 below are placed; art for them is the priority if anyone paints
real totems:

| Spirit | Element | Needed file |
|---|---|---|
| Jaguar | Carbon | `src/assets/jungle/totem-carbon.png` |
| Firefly | Neon | `src/assets/jungle/totem-neon.png` |
| Serpent | Sodium | `src/assets/jungle/totem-sodium.png` |
| Armadillo | Aluminum | `src/assets/jungle/totem-aluminum.png` |
| Beetle | Silicon | `src/assets/jungle/totem-silicon.png` |
| Sloth | Argon | `src/assets/jungle/totem-argon.png` |
| Condor | Scandium | `src/assets/jungle/totem-scandium.png` |
| Panther | Iron | `src/assets/jungle/totem-iron.png` |

**Unplaced after the trim** (PNGs still on disk from the 13-totem era, not shown in game — don't need
art): Macaw/Nitrogen, Frog/Oxygen, Lanternfly/Phosphorus, Toad/Sulfur, Mantis/Chlorine.

**Specs:** vertical pixel-art PNG, transparent background, roughly 2:3-ish (the placeholders are
~36×64 native), origin bottom-centre (it stands on the ground). Keep a **round gem "eye" near the
top** — the game lights it in the totem's colour (`JungleScene.GEM_FRAC` is the socket's y-fraction;
if you move the eye, update that constant). **To replace (no code change):** overwrite the
`totem-<id>.png` file + `npm run build`. Regenerate placeholders with `python3 tools/gen_totems.py`.
