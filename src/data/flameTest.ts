// Desert Lesson Three — the Flame-Test Beacons (see ui/BeaconOverlay + DesertScene).
//
// The chemistry: heat an element and its electrons jump to a higher energy level,
// then fall back — each drop releases a photon of one fixed ENERGY, and therefore
// one fixed COLOUR. Every element has its own signature flame colour. This is the
// visible sequel to the Atlantis sanctum's electron-shell forge: there the student
// arranged electrons in shells; here they see what those electrons EMIT.
//
// The puzzle (outside, in the desert): carry the sanctum crystal to wake the beacons,
// then light each one by burning an Elemental YOU HAVE CAUGHT whose flame colour
// matches. Match all of them and the buried pyramid rises from the sand.
//
// The "fuel" is a caught Elemental (data/elements.ts + the Isotopedex), so every
// element named here is a real catchable Elemental. As of 2026-10-01 the six classic
// flame-test metals were added as Elementals (K/Cu/Ba/Li/Sr/Ca) alongside Na, so the
// beacons now use the authentic flame-test palette — including the famous collisions:
//   • Copper, Barium (and Boron) all read GREEN.
//   • Lithium and Strontium both read RED.
//   • Potassium's lilac is easily lost in sodium's yellow (the cobalt-glass trick).
// Sulfur (blue) and Magnesium (brilliant white) are honest distractors (no beacon).

export interface FlameColor {
    id: string;      // grouping key — several elements can share a colour
    name: string;    // human label, e.g. 'lilac'
    hex: string;     // approximate on-screen flame colour
}

export const FLAME_COLORS: Record<string, FlameColor> = {
    yellow: { id: 'yellow', name: 'golden yellow',   hex: '#ffd21e' },
    green:  { id: 'green',  name: 'green',            hex: '#3fae57' },
    lilac:  { id: 'lilac',  name: 'lilac',           hex: '#b060e0' },
    red:    { id: 'red',    name: 'red',             hex: '#e23b4e' },
    orange: { id: 'orange', name: 'brick orange',    hex: '#ff7a1a' },
    blue:   { id: 'blue',   name: 'blue',            hex: '#4aa3ff' },
    white:  { id: 'white',  name: 'brilliant white', hex: '#f5f7ff' },
};

export interface FlameFuel {
    elementId: string;   // id in data/elements.ts (must be catchable)
    symbol: string;      // periodic symbol (for the chip)
    name: string;        // element name
    color: FlameColor;   // its signature flame colour
    note: string;        // one-line teaching shown when burned
}

// Every catchable Elemental with a real flame colour. Several share a colour on
// purpose (the teachable collisions). Sulfur + Magnesium match no beacon (distractors).
export const FLAME_FUELS: FlameFuel[] = [
    { elementId: 'sodium',    symbol: 'Na', name: 'Sodium',    color: FLAME_COLORS.yellow,
      note: 'Sodium burns an intense golden yellow — so strong it can drown out fainter colours.' },
    { elementId: 'potassium', symbol: 'K',  name: 'Potassium', color: FLAME_COLORS.lilac,
      note: 'Potassium burns a pale lilac — easily masked by sodium; chemists view it through blue cobalt glass.' },
    { elementId: 'copper',    symbol: 'Cu', name: 'Copper',    color: FLAME_COLORS.green,
      note: 'Copper burns a vivid green.' },
    { elementId: 'barium',    symbol: 'Ba', name: 'Barium',    color: FLAME_COLORS.green,
      note: 'Barium burns a pale yellow-green — close enough that it reads as green, like copper.' },
    { elementId: 'boron',     symbol: 'B',  name: 'Boron',     color: FLAME_COLORS.green,
      note: 'Boron also burns green — the classic boric-acid flame.' },
    { elementId: 'lithium',   symbol: 'Li', name: 'Lithium',   color: FLAME_COLORS.red,
      note: 'Lithium burns a deep crimson red.' },
    { elementId: 'strontium', symbol: 'Sr', name: 'Strontium', color: FLAME_COLORS.red,
      note: 'Strontium burns a bright scarlet red — hard to tell from lithium; the red behind flares.' },
    { elementId: 'calcium',   symbol: 'Ca', name: 'Calcium',   color: FLAME_COLORS.orange,
      note: 'Calcium burns a warm brick orange-red.' },
    { elementId: 'sulfur',    symbol: 'S',  name: 'Sulfur',    color: FLAME_COLORS.blue,
      note: 'Sulfur burns an eerie blue — not a beacon colour here.' },
    { elementId: 'magnesium', symbol: 'Mg', name: 'Magnesium', color: FLAME_COLORS.white,
      note: 'Magnesium burns a blinding brilliant white — not a beacon colour here.' },
];

export const FUEL_BY_ELEMENT: Record<string, FlameFuel> =
    FLAME_FUELS.reduce((acc, f) => { acc[f.elementId] = f; return acc; }, {} as Record<string, FlameFuel>);

export interface Beacon {
    id: string;        // identity/persistence key
    color: FlameColor; // the flame colour this pillar demands
    hint: string;      // a clue to the colour (the player deduces the element)
}

// The beacon braziers. Order is left→right in the overlay and matches the world
// braziers in DesertScene.BEACON_TILES; they can be lit in any order. Green and red
// each have multiple valid answers (the teachable collisions); blue/white are not
// here, so caught Sulfur/Magnesium end up as distractors in the tray.
export const BEACONS: Beacon[] = [
    { id: 'beacon-yellow', color: FLAME_COLORS.yellow,
      hint: 'A golden glare, like the desert sun or a sodium street lamp.' },
    { id: 'beacon-green',  color: FLAME_COLORS.green,
      hint: 'The green of an oasis — more than one metal answers this.' },
    { id: 'beacon-lilac',  color: FLAME_COLORS.lilac,
      hint: 'A shy violet, easily lost in sodium’s glare — seek it through cobalt glass.' },
    { id: 'beacon-red',    color: FLAME_COLORS.red,
      hint: 'A fierce red, like a distress flare — two metals burn this colour.' },
    { id: 'beacon-orange', color: FLAME_COLORS.orange,
      hint: 'A warm brick orange.' },
];

/** Caught-or-not aside, which fuel(s) would satisfy a beacon (shared colours → >1). */
export function fuelsFor(beacon: Beacon): FlameFuel[] {
    return FLAME_FUELS.filter(f => f.color.id === beacon.color.id);
}
