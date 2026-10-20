# Evolution product artwork

Drop a PNG here named exactly `<recipe-id>.png` and it appears automatically in the
Evolution Lab (success screen + collection). No code change needed — the overlay
loads `assets/compounds/<id>.png` and falls back to a tinted formula disc if it's
missing. Rebuild/redeploy to publish new art.

## Spec
- **Format:** PNG, RGBA with a transparent background (same as `assets/elementals/`).
- **Size:** square, 512×512 or 1024×1024. Creature centered with a little padding.
- **Style:** match the existing Elemental creatures (single static frame — these
  only appear in the lab/DEX, they don't walk the map).

## Filenames to design (recipe id → what it is)

VSEPR Fusion (molecules):
- `water.png` — H₂O (bent)
- `carbon-dioxide.png` — CO₂ (linear)
- `methane.png` — CH₄ (tetrahedral)
- `ammonia.png` — NH₃ (trigonal pyramidal)
- `boron-trifluoride.png` — BF₃ (trigonal planar)
- `sulfur-dioxide.png` — SO₂ (bent)
- `dioxygen.png` — O₂ (diatomic)
- `dinitrogen.png` — N₂ (diatomic)

Hyper-Chamber (expanded octet):
- `sulfur-tetrafluoride.png` — SF₄ (see-saw)
- `sulfur-hexafluoride.png` — SF₆ (octahedral)

Tug-of-War (ionic / alloy):
- `sodium-fluoride.png` — NaF (ionic)
- `magnesium-oxide.png` — MgO (ionic)
- `magnesium-fluoride.png` — MgF₂ (ionic)
- `aluminum-oxide.png` — Al₂O₃ (ionic — ruby/sapphire)
- `iron-sulfide.png` — FeS (polar covalent)
- `steel.png` — Fe·C (interstitial alloy)

Placeholder monster names live in `src/data/evolution.ts` (`name` field) — rename
there whenever you like.
