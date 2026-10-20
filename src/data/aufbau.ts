// The Jungle (level 2) lesson — "Canopy Energy Network" (electron configuration).
//
// This is the data backbone for JungleScene's totems + ui/CanopyOverlay, the
// pedagogical bridge between the sanctum (L1: electrons as a COUNT) and the desert
// (L3: what electrons emit when they jump). Here the lesson is WHERE those electrons
// live — the sublevels (s/p/d/f) and the order they fill (Aufbau).
//
// The three rules, made into a mechanic (fill rungs of a vertical lattice, in order):
//   Sublevel CAPACITY   s=2, p=6, d=10, f=14      (orbitals x 2 electrons)
//   Aufbau ORDER        fill lowest energy first  (1s -> 2s -> 2p -> ... -> 4s BEFORE 3d)
//   An element's config  is a pure function of its atomic number Z.
//
// Configs are DERIVED (configFor), never hand-authored, so adding a totem is just an
// element id + a spirit name/colour. Mirrors data/resonance.ts' data-driven pattern.

import { getElement } from './elements';

export type SubShell = 's' | 'p' | 'd' | 'f';

/** Electrons each sublevel type can hold (orbitals x 2). */
export const CAPACITY: Record<SubShell, number> = { s: 2, p: 6, d: 10, f: 14 };

/** Orbital count per sublevel type (for the "p = 3 orbitals" teaching line). */
export const ORBITALS: Record<SubShell, number> = { s: 1, p: 3, d: 5, f: 7 };

// Aufbau filling order as (n, sublevel) rungs, lowest energy first. The 4s-before-3d
// swap (and 5s-before-4d, 6s-before-4f-before-5d) is the "money" concept this encodes.
export const FILL_ORDER = [
    '1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d',
    '5p', '6s', '4f', '5d', '6p', '7s',
] as const;

export interface Rung {
    label: string;      // e.g. "2p"
    n: number;          // principal quantum number (1,2,3...)
    sub: SubShell;      // s | p | d | f
    cap: number;        // capacity of this sublevel (CAPACITY[sub])
    electrons: number;  // electrons THIS element places in this rung (target)
}

/** Split a rung label like "4s" into its principal number and sublevel letter. */
function parseRung(label: string): { n: number; sub: SubShell } {
    const m = label.match(/^(\d+)([spdf])$/);
    if (!m) throw new Error(`bad rung label: ${label}`);
    return { n: parseInt(m[1], 10), sub: m[2] as SubShell };
}

/** The ground-state electron configuration of an atom with `z` electrons, as the
 *  ordered list of filled rungs (Aufbau order). The final rung may be partial. */
export function configFor(z: number): Rung[] {
    const rungs: Rung[] = [];
    let remaining = Math.max(0, Math.floor(z));
    for (const label of FILL_ORDER) {
        if (remaining <= 0) break;
        const { n, sub } = parseRung(label);
        const cap = CAPACITY[sub];
        const electrons = Math.min(cap, remaining);
        rungs.push({ label, n, sub, cap, electrons });
        remaining -= electrons;
    }
    return rungs;
}

const SUPERSCRIPT: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
const sup = (n: number): string => String(n).split('').map(d => SUPERSCRIPT[d]).join('');

/** The configuration as a human string, e.g. configString(6) === "1s² 2s² 2p²". */
export function configString(z: number): string {
    return configFor(z).map(r => `${r.label}${sup(r.electrons)}`).join(' ');
}

/** Is this rung an Aufbau "surprise" — a sublevel that fills before a lower-n one of
 *  the previous shell (the 4s-before-3d family)? Used to surface the teaching beat. */
export function isAufbauSwap(label: string): boolean {
    const idx = FILL_ORDER.indexOf(label as typeof FILL_ORDER[number]);
    if (idx <= 0) return false;
    const { n } = parseRung(label);
    // A swap is when an earlier (lower-energy) rung has a HIGHER principal number —
    // e.g. 3d (n=3) comes right after 4s (n=4).
    for (let i = 0; i < idx; i++) {
        if (parseRung(FILL_ORDER[i]).n > n) return true;
    }
    return false;
}

// ---- Totems (the dormant animal-spirit shrines in the jungle) ------------------
// Each totem is an element the student can CATCH elsewhere, so configuring it reuses
// the roster (decision #2 in JUNGLE-LESSON2-PLAN.md — no new creatures). `gem` tints
// the totem's cue/overlay so each reads distinct; `z` is derived from elements.ts.
export interface Totem {
    id: string;       // element id (matches data/elements.ts) + persistence key
    spirit: string;   // animal-spirit name carved into the totem
    gem: string;      // accent colour (hex)
    blurb: string;    // one-line flavour shown atop the overlay
}

// A curated eight-totem arc, ordered from the jungle's south entrance northward.
// Each totem is a DISTINCT lesson beat (no repeats), so the network powers up in a
// shorter climb while still landing the payoff: the two d-block totems that teach the
// 4s-before-3d swap. The arc: fill the 2nd shell (2p² → full 2p⁶ noble), start the 3rd
// (3s → 3p¹ → 3p² → full 3p⁶ noble), then the d-block "gotcha" finale. (Nitrogen,
// Oxygen, Phosphorus, Sulfur and Chlorine remain catchable Elementals — just not
// totems — so the lesson stays short; completion keys off TOTEMS.length everywhere.)
export const TOTEMS: Totem[] = [
    { id: 'carbon',   spirit: 'Jaguar',    gem: '#9e9e9e',
      blurb: 'The Jaguar spirit — Carbon, the backbone of life. Begin the ascent.' },
    { id: 'neon',     spirit: 'Firefly',   gem: '#ff7043',
      blurb: 'The Firefly spirit — Neon, a full outer shell: a noble, settled glow.' },
    { id: 'sodium',   spirit: 'Serpent',   gem: '#ba68c8',
      blurb: 'The Serpent spirit — Sodium, the first to climb into a new shell (3s).' },
    { id: 'aluminum', spirit: 'Armadillo', gem: '#b0bec5',
      blurb: 'The Armadillo spirit — Aluminum, opening the 3p branch.' },
    { id: 'silicon',  spirit: 'Beetle',    gem: '#78909c',
      blurb: 'The Beetle spirit — Silicon, a carapace of crystal and circuitry.' },
    { id: 'argon',    spirit: 'Sloth',     gem: '#b39ddb',
      blurb: 'The Sloth spirit — Argon, a full shell: content, inert, unbothered.' },
    // d-block gotcha finale (teaches the 4s-before-3d swap):
    { id: 'scandium', spirit: 'Condor',    gem: '#4a7c7c',
      blurb: 'The Condor spirit — Scandium, the first d-block climber. Watch the order.' },
    { id: 'iron',     spirit: 'Panther',   gem: '#8d6e63',
      blurb: 'The Panther spirit — Iron, deep in the d-block crowns.' },
];

export const TOTEM_BY_ID: Record<string, Totem> =
    TOTEMS.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, Totem>);

/** Atomic number of a totem's element (the electron count to configure). */
export function totemZ(t: Totem): number { return getElement(t.id)?.number ?? 0; }
