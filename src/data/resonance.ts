// The Atlantis sanctum's final test — "Crystalline Core Attunement" (see
// ui/ResonanceOverlay). This is the game's culminating exam: it drills the whole
// intro atomic-structure syllabus as a single boss puzzle.
//
// The three subatomic rules, made into mechanics:
//   Protons   set IDENTITY   (atomic number  = protons)          -> forge phase 1
//   Neutrons  set the ISOTOPE (mass number    = protons + neutrons) -> forge phase 2
//   Electrons set the CHARGE  (charge         = protons - electrons) -> forge phase 3
// A neutral atom has electrons = protons. Losing electrons -> positive CATION
// (metals, LEFT side of the table); gaining electrons -> negative ANION
// (non-metals, RIGHT side). The finale links a cation to an anion whose charges
// cancel to net zero, completing the Core's balanced circuit ("Enlightenment").
//
// Every crystal below is also an Elemental the student can catch elsewhere, so the
// final test reuses the exact elements they collected. Carbon is the guided
// tutorial (6p, 6n, stays neutral — the stable heart of the Core); the six ions
// form three clean 1:1 net-zero pairs: Na+/F-, Mg2+/O2-, Al3+/N3-.

export type Polarity = 'cation' | 'anion' | 'neutral';

export interface CoreElement {
    id: string;          // element id (matches data/elements.ts) + persistence key
    symbol: string;      // periodic-table symbol
    name: string;        // element name
    protons: number;     // atomic number Z  (= target proton count, = identity)
    mass: number;        // mass number       (neutrons = mass - protons)
    group: number;       // periodic group    (explains the ion charge)
    polarity: Polarity;  // cation / anion / neutral
    charge: number;      // signed target ion charge (+1, -2, ... ; 0 if neutral)
    side: 'left' | 'right' | 'center';   // side of the periodic table (memory hook)
    why: string;         // one line: WHY it takes this charge (octet / noble gas)
    gem: string;         // crystal colour (hex) so each pedestal reads distinct
}

// Forge order: Carbon (tutorial) first, then the three ion pairs.
export const CORE_ELEMENTS: CoreElement[] = [
    { id: 'carbon',    symbol: 'C',  name: 'Carbon',    protons: 6,  mass: 12, group: 14,
      polarity: 'neutral', charge: 0, side: 'center', gem: '#9e9e9e',
      why: 'Carbon shares electrons instead of giving or taking, so it stays neutral — the stable heart of the Core.' },

    { id: 'sodium',    symbol: 'Na', name: 'Sodium',    protons: 11, mass: 23, group: 1,
      polarity: 'cation', charge: +1, side: 'left', gem: '#b06cff',
      why: 'Group 1 metals lose 1 electron to match Neon’s full shell, becoming a +1 cation.' },
    { id: 'fluorine',  symbol: 'F',  name: 'Fluorine',  protons: 9,  mass: 19, group: 17,
      polarity: 'anion', charge: -1, side: 'right', gem: '#aed581',
      why: 'Group 17 non-metals gain 1 electron to fill their shell (Neon), becoming a −1 anion.' },

    { id: 'magnesium', symbol: 'Mg', name: 'Magnesium', protons: 12, mass: 24, group: 2,
      polarity: 'cation', charge: +2, side: 'left', gem: '#ff8a65',
      why: 'Group 2 metals lose 2 electrons to reach a full shell, becoming a +2 cation.' },
    { id: 'oxygen',    symbol: 'O',  name: 'Oxygen',    protons: 8,  mass: 16, group: 16,
      polarity: 'anion', charge: -2, side: 'right', gem: '#ef5350',
      why: 'Group 16 non-metals gain 2 electrons to complete their octet, becoming a −2 anion.' },

    { id: 'aluminum',  symbol: 'Al', name: 'Aluminum',  protons: 13, mass: 27, group: 13,
      polarity: 'cation', charge: +3, side: 'left', gem: '#b0bec5',
      why: 'Group 13 metals lose 3 electrons to empty their outer shell, becoming a +3 cation.' },
    { id: 'nitrogen',  symbol: 'N',  name: 'Nitrogen',  protons: 7,  mass: 14, group: 15,
      polarity: 'anion', charge: -3, side: 'right', gem: '#64b5f6',
      why: 'Group 15 non-metals gain 3 electrons to complete their octet, becoming a −3 anion.' },
];

export const CORE_BY_ID: Record<string, CoreElement> =
    CORE_ELEMENTS.reduce((acc, e) => { acc[e.id] = e; return acc; }, {} as Record<string, CoreElement>);

// The three balanced pairs of the Core circuit: a cation linked to an anion whose
// charges cancel to net zero (1:1). Magnitudes are unique in the seed above, so a
// magnitude match is always the intended pair.
export interface IonPair {
    cation: string;   // CoreElement id
    anion: string;    // CoreElement id
    compound: string; // formula that results, e.g. "NaF"
    fact: string;     // one-line "why" (charges cancel)
}

export const ION_PAIRS: IonPair[] = [
    { cation: 'sodium',    anion: 'fluorine', compound: 'NaF', fact: '(+1) + (−1) = 0 — the charges cancel.' },
    { cation: 'magnesium', anion: 'oxygen',   compound: 'MgO', fact: '(+2) + (−2) = 0 — the charges cancel.' },
    { cation: 'aluminum',  anion: 'nitrogen', compound: 'AlN', fact: '(+3) + (−3) = 0 — the charges cancel.' },
];

// The crystals that take part in the circuit (everything but the neutral Carbon core).
export const CIRCUIT_ELEMENTS: CoreElement[] = CORE_ELEMENTS.filter(e => e.polarity !== 'neutral');

// Neutrons needed for the stable isotope, and electrons needed for the target ion.
export const neutronsFor = (e: CoreElement): number => e.mass - e.protons;
export const electronsFor = (e: CoreElement): number => e.protons - e.charge; // charge = protons - electrons

// A compact atomic-number -> identity table (Z 1..20) so the protons phase can show
// the element's identity morph live as the player injects each proton (H -> He -> ...).
export interface Identity { symbol: string; name: string; }
export const IDENTITY_BY_Z: Record<number, Identity> = {
    1:  { symbol: 'H',  name: 'Hydrogen' },   2:  { symbol: 'He', name: 'Helium' },
    3:  { symbol: 'Li', name: 'Lithium' },    4:  { symbol: 'Be', name: 'Beryllium' },
    5:  { symbol: 'B',  name: 'Boron' },      6:  { symbol: 'C',  name: 'Carbon' },
    7:  { symbol: 'N',  name: 'Nitrogen' },   8:  { symbol: 'O',  name: 'Oxygen' },
    9:  { symbol: 'F',  name: 'Fluorine' },   10: { symbol: 'Ne', name: 'Neon' },
    11: { symbol: 'Na', name: 'Sodium' },     12: { symbol: 'Mg', name: 'Magnesium' },
    13: { symbol: 'Al', name: 'Aluminum' },   14: { symbol: 'Si', name: 'Silicon' },
    15: { symbol: 'P',  name: 'Phosphorus' }, 16: { symbol: 'S',  name: 'Sulfur' },
    17: { symbol: 'Cl', name: 'Chlorine' },   18: { symbol: 'Ar', name: 'Argon' },
    19: { symbol: 'K',  name: 'Potassium' },  20: { symbol: 'Ca', name: 'Calcium' },
};

/** Identity of an atom with `z` protons (or undefined outside the table above). */
export function identityForZ(z: number): Identity | undefined { return IDENTITY_BY_Z[z]; }

/** Signed charge as a display string: 0 -> "0", +1 -> "+1", -2 -> "−2". */
export function chargeLabel(charge: number): string {
    if (charge === 0) return '0';
    const mag = Math.abs(charge);
    return `${charge > 0 ? '+' : '−'}${mag}`;
}
