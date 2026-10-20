// The Evolution Lab's recipes + the real chemistry each chamber quizzes on:
//   - Fusion       (VSEPR molecular compounds)      -> FUSIONS
//   - Hyper-Chamber (expanded octet / hypervalent)   -> HYPERVALENTS
//   - Tug-of-War   (ΔEN binary bonding, ionic/alloy) -> IONICS
//
// PLACEHOLDER ART/NAMES: `name`/`tint` are stand-ins. When Justin's artwork lands,
// drop a PNG named `<id>.png` into src/assets/compounds/ and it appears automatically
// (EvolveOverlay tries that path, falls back to the tinted formula disc). The
// chemistry fields are the real teaching content and shouldn't change.

import { getElement } from './elements';

// Pauling electronegativities for the roster (noble gases He/Ne omitted — they
// don't meaningfully bond). Used by the Tug-of-War chamber.
const EN: Record<string, number> = {
    hydrogen: 2.20, boron: 2.04, carbon: 2.55, nitrogen: 3.04, oxygen: 3.44,
    fluorine: 3.98, sodium: 0.93, magnesium: 1.31, aluminum: 1.61, sulfur: 2.58,
    scandium: 1.36, iron: 1.83, beryllium: 1.57, uranium: 1.38,
};
export function electronegativity(id: string): number | undefined { return EN[id]; }

export interface Ingredient { id: string; count: number; }

// ---- Chamber A: VSEPR Fusion ----------------------------------------------
export interface FusionRecipe {
    kind: 'fusion';
    id: string; name: string; formula: string;
    ingredients: Ingredient[];
    stericNumber: number; hybrid: string; bondAngle: number; shape: string;
    fact: string; tint: number;
}

// A tolerance (± degrees) the dial must land within to fuse.
export const ANGLE_TOLERANCE = 2.5;

export const FUSIONS: FusionRecipe[] = [
    { kind: 'fusion', id: 'water', name: 'Aquadrip', formula: 'H₂O',
      ingredients: [{ id: 'hydrogen', count: 2 }, { id: 'oxygen', count: 1 }],
      stericNumber: 4, hybrid: 'sp³', bondAngle: 104.5, shape: 'Bent',
      fact: 'Two lone pairs on O squeeze water down to a bent 104.5°.', tint: 0x4fc3f7 },
    { kind: 'fusion', id: 'carbon-dioxide', name: 'Fizzfume', formula: 'CO₂',
      ingredients: [{ id: 'carbon', count: 1 }, { id: 'oxygen', count: 2 }],
      stericNumber: 2, hybrid: 'sp', bondAngle: 180, shape: 'Linear',
      fact: 'No lone pairs on C — O=C=O stretches out to a linear 180°.', tint: 0x90a4ae },
    { kind: 'fusion', id: 'methane', name: 'Marshmuck', formula: 'CH₄',
      ingredients: [{ id: 'carbon', count: 1 }, { id: 'hydrogen', count: 4 }],
      stericNumber: 4, hybrid: 'sp³', bondAngle: 109.5, shape: 'Tetrahedral',
      fact: 'Four equal bonds, zero lone pairs — a perfect tetrahedral 109.5°.', tint: 0xa1887f },
    { kind: 'fusion', id: 'ammonia', name: 'Whiffnix', formula: 'NH₃',
      ingredients: [{ id: 'nitrogen', count: 1 }, { id: 'hydrogen', count: 3 }],
      stericNumber: 4, hybrid: 'sp³', bondAngle: 107, shape: 'Trigonal pyramidal',
      fact: 'One lone pair on N nudges H–N–H from 109.5° down to about 107°.', tint: 0x9ccc65 },
    { kind: 'fusion', id: 'boron-trifluoride', name: 'Triflora', formula: 'BF₃',
      ingredients: [{ id: 'boron', count: 1 }, { id: 'fluorine', count: 3 }],
      stericNumber: 3, hybrid: 'sp²', bondAngle: 120, shape: 'Trigonal planar',
      fact: 'Electron-deficient B, no lone pairs — flat trigonal planar 120°.', tint: 0x64b5f6 },
    { kind: 'fusion', id: 'sulfur-dioxide', name: 'Chokemist', formula: 'SO₂',
      ingredients: [{ id: 'sulfur', count: 1 }, { id: 'oxygen', count: 2 }],
      stericNumber: 3, hybrid: 'sp²', bondAngle: 119, shape: 'Bent',
      fact: 'One lone pair on S bends SO₂ to roughly 119°.', tint: 0xffca28 },
    { kind: 'fusion', id: 'dioxygen', name: 'Duoxy', formula: 'O₂',
      ingredients: [{ id: 'oxygen', count: 2 }],
      stericNumber: 2, hybrid: 'sp', bondAngle: 180, shape: 'Linear (diatomic)',
      fact: 'Any diatomic molecule is linear by definition — 180°.', tint: 0xef5350 },
    { kind: 'fusion', id: 'dinitrogen', name: 'Dinite', formula: 'N₂',
      ingredients: [{ id: 'nitrogen', count: 2 }],
      stericNumber: 2, hybrid: 'sp', bondAngle: 180, shape: 'Linear (diatomic)',
      fact: 'A nitrogen triple bond holds N₂ in a straight 180° line.', tint: 0x64b5f6 },
];

// ---- Chamber B: Hyper-Chamber (expanded octet) ----------------------------
// Only period-3+ main-group atoms can exceed an octet; in this roster that's
// Sulfur. He/Ne (and period-2 atoms) cannot — the chamber teaches that as the foil.
export interface HyperRecipe {
    kind: 'hyper';
    id: string; name: string; formula: string;
    center: string;        // central atom element id (sulfur)
    reagent: string;       // injected reagent element id (fluorine)
    bonds: number;         // reagent atoms bonded
    electrons: number;     // electrons in the central atom's expanded valence shell
    shape: string; hybrid: string;
    fact: string; tint: number;
}

// Central atoms that physically CAN expand their octet (period 3+). Anything else
// (He, Ne, C, N, O…) fizzles — the pedagogical point of this chamber.
export const HYPER_CAPABLE = new Set<string>(['sulfur']);

export const HYPERVALENTS: HyperRecipe[] = [
    { kind: 'hyper', id: 'sulfur-tetrafluoride', name: 'Cutlash', formula: 'SF₄',
      center: 'sulfur', reagent: 'fluorine', bonds: 4, electrons: 10,
      shape: 'See-saw', hybrid: 'sp³d',
      fact: 'S expands to 10 electrons: 4 bonds + 1 lone pair make a see-saw.', tint: 0xba9a3a },
    { kind: 'hyper', id: 'sulfur-hexafluoride', name: 'Hexaclaw', formula: 'SF₆',
      center: 'sulfur', reagent: 'fluorine', bonds: 6, electrons: 12,
      shape: 'Octahedral', hybrid: 'sp³d²',
      fact: 'S expands to 12 electrons: 6 bonds, no lone pairs — perfect octahedron.', tint: 0xcdb457 },
];

// ---- Chamber C: Tug-of-War (ΔEN binary bonding) ---------------------------
export type BondType = 'Ionic' | 'Polar covalent' | 'Nonpolar covalent' | 'Interstitial alloy';

export interface IonicRecipe {
    kind: 'ionic';
    id: string; name: string; formula: string;
    a: string; b: string;          // the two element ids
    ratio: [number, number];       // stoichiometric ratio a:b
    bondType: BondType;            // the correct classification (from ΔEN / metal+metal)
    bondLengthPm: number;          // equilibrium internuclear distance (PE well minimum)
    fact: string; tint: number;
}

// ± pm the distance slider must land within to lock the bond.
export const DISTANCE_TOLERANCE = 8;

export const IONICS: IonicRecipe[] = [
    { kind: 'ionic', id: 'sodium-fluoride', name: 'Saltling', formula: 'NaF',
      a: 'sodium', b: 'fluorine', ratio: [1, 1], bondType: 'Ionic', bondLengthPm: 231,
      fact: 'ΔEN ≈ 3.0 — Na hands its electron to F outright. Textbook ionic.', tint: 0xe0e0e0 },
    { kind: 'ionic', id: 'magnesium-oxide', name: 'Cindermag', formula: 'MgO',
      a: 'magnesium', b: 'oxygen', ratio: [1, 1], bondType: 'Ionic', bondLengthPm: 210,
      fact: 'Two +2/–2 ions packed tight — one of the highest lattice energies going.', tint: 0xcfd8dc },
    { kind: 'ionic', id: 'magnesium-fluoride', name: 'Frostmag', formula: 'MgF₂',
      a: 'magnesium', b: 'fluorine', ratio: [1, 2], bondType: 'Ionic', bondLengthPm: 207,
      fact: 'Mg²⁺ needs two F⁻ to balance charge — ionic, 1:2.', tint: 0xb3e5fc },
    { kind: 'ionic', id: 'aluminum-oxide', name: 'Corundrake', formula: 'Al₂O₃',
      a: 'aluminum', b: 'oxygen', ratio: [2, 3], bondType: 'Ionic', bondLengthPm: 192,
      fact: 'Al³⁺ and O²⁻ balance 2:3 — this lattice is corundum (ruby & sapphire).', tint: 0xf48fb1 },
    { kind: 'ionic', id: 'iron-sulfide', name: 'Pyrixen', formula: 'FeS',
      a: 'iron', b: 'sulfur', ratio: [1, 1], bondType: 'Polar covalent', bondLengthPm: 245,
      fact: 'ΔEN ≈ 0.75 — not enough to fully ionize. Polar covalent, metallic sheen.', tint: 0x9e8f6b },
    { kind: 'ionic', id: 'steel', name: 'Forgolem', formula: 'Fe·C',
      a: 'iron', b: 'carbon', ratio: [1, 1], bondType: 'Interstitial alloy', bondLengthPm: 175,
      fact: 'Carbon atoms wedge into iron\'s gaps — an interstitial alloy: steel.', tint: 0x78909c },
];

export type Recipe = FusionRecipe | HyperRecipe | IonicRecipe;

export const ALL_RECIPES: Recipe[] = [...FUSIONS, ...HYPERVALENTS, ...IONICS];

export function getRecipe(id: string): Recipe | undefined {
    return ALL_RECIPES.find(r => r.id === id);
}

// ΔEN for an ionic recipe (undefined if either atom has no tabulated EN).
export function deltaEN(r: IonicRecipe): number | undefined {
    const a = EN[r.a], b = EN[r.b];
    return (a === undefined || b === undefined) ? undefined : Math.abs(a - b);
}

// Element ids in a fusion recipe the student hasn't caught (soft gating + labels).
export function missingIngredients(recipe: FusionRecipe, caught: (id: string) => boolean): string[] {
    return recipe.ingredients.filter(r => !caught(r.id)).map(r => r.id);
}

export function elementalName(id: string): string {
    return getElement(id)?.monster ?? id;
}
