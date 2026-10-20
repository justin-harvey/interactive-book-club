// The full periodic table, used by the teacher portal so questions can be tagged
// to ANY element — not just the handful of playable Elementals in elements.ts.
//
// `id` is the lowercase English name and is the single source of truth that ties
// a question (question.elementId) to an element. This matches the ids already
// used by the playable creatures (elements.ts) and the local seed bank
// (questions.ts), e.g. 'hydrogen', 'sodium', 'iron', 'uranium'. A question tagged
// to an element with no Elemental art simply isn't used in gameplay yet — the
// teacher can still author its questions ahead of time. US spellings (Aluminum,
// Cesium, Sulfur) match the AP-Chem classroom this ships to.

export interface PeriodicElement {
    id: string;      // lowercase name — matches question.elementId
    symbol: string;  // periodic-table symbol, e.g. "Na"
    name: string;    // "Sodium"
    number: number;  // atomic number
}

// name/symbol/number tuples, atomic number = array index + 1.
const RAW: [string, string][] = [
    ['Hydrogen', 'H'], ['Helium', 'He'], ['Lithium', 'Li'], ['Beryllium', 'Be'],
    ['Boron', 'B'], ['Carbon', 'C'], ['Nitrogen', 'N'], ['Oxygen', 'O'],
    ['Fluorine', 'F'], ['Neon', 'Ne'], ['Sodium', 'Na'], ['Magnesium', 'Mg'],
    ['Aluminum', 'Al'], ['Silicon', 'Si'], ['Phosphorus', 'P'], ['Sulfur', 'S'],
    ['Chlorine', 'Cl'], ['Argon', 'Ar'], ['Potassium', 'K'], ['Calcium', 'Ca'],
    ['Scandium', 'Sc'], ['Titanium', 'Ti'], ['Vanadium', 'V'], ['Chromium', 'Cr'],
    ['Manganese', 'Mn'], ['Iron', 'Fe'], ['Cobalt', 'Co'], ['Nickel', 'Ni'],
    ['Copper', 'Cu'], ['Zinc', 'Zn'], ['Gallium', 'Ga'], ['Germanium', 'Ge'],
    ['Arsenic', 'As'], ['Selenium', 'Se'], ['Bromine', 'Br'], ['Krypton', 'Kr'],
    ['Rubidium', 'Rb'], ['Strontium', 'Sr'], ['Yttrium', 'Y'], ['Zirconium', 'Zr'],
    ['Niobium', 'Nb'], ['Molybdenum', 'Mo'], ['Technetium', 'Tc'], ['Ruthenium', 'Ru'],
    ['Rhodium', 'Rh'], ['Palladium', 'Pd'], ['Silver', 'Ag'], ['Cadmium', 'Cd'],
    ['Indium', 'In'], ['Tin', 'Sn'], ['Antimony', 'Sb'], ['Tellurium', 'Te'],
    ['Iodine', 'I'], ['Xenon', 'Xe'], ['Cesium', 'Cs'], ['Barium', 'Ba'],
    ['Lanthanum', 'La'], ['Cerium', 'Ce'], ['Praseodymium', 'Pr'], ['Neodymium', 'Nd'],
    ['Promethium', 'Pm'], ['Samarium', 'Sm'], ['Europium', 'Eu'], ['Gadolinium', 'Gd'],
    ['Terbium', 'Tb'], ['Dysprosium', 'Dy'], ['Holmium', 'Ho'], ['Erbium', 'Er'],
    ['Thulium', 'Tm'], ['Ytterbium', 'Yb'], ['Lutetium', 'Lu'], ['Hafnium', 'Hf'],
    ['Tantalum', 'Ta'], ['Tungsten', 'W'], ['Rhenium', 'Re'], ['Osmium', 'Os'],
    ['Iridium', 'Ir'], ['Platinum', 'Pt'], ['Gold', 'Au'], ['Mercury', 'Hg'],
    ['Thallium', 'Tl'], ['Lead', 'Pb'], ['Bismuth', 'Bi'], ['Polonium', 'Po'],
    ['Astatine', 'At'], ['Radon', 'Rn'], ['Francium', 'Fr'], ['Radium', 'Ra'],
    ['Actinium', 'Ac'], ['Thorium', 'Th'], ['Protactinium', 'Pa'], ['Uranium', 'U'],
    ['Neptunium', 'Np'], ['Plutonium', 'Pu'], ['Americium', 'Am'], ['Curium', 'Cm'],
    ['Berkelium', 'Bk'], ['Californium', 'Cf'], ['Einsteinium', 'Es'], ['Fermium', 'Fm'],
    ['Mendelevium', 'Md'], ['Nobelium', 'No'], ['Lawrencium', 'Lr'], ['Rutherfordium', 'Rf'],
    ['Dubnium', 'Db'], ['Seaborgium', 'Sg'], ['Bohrium', 'Bh'], ['Hassium', 'Hs'],
    ['Meitnerium', 'Mt'], ['Darmstadtium', 'Ds'], ['Roentgenium', 'Rg'], ['Copernicium', 'Cn'],
    ['Nihonium', 'Nh'], ['Flerovium', 'Fl'], ['Moscovium', 'Mc'], ['Livermorium', 'Lv'],
    ['Tennessine', 'Ts'], ['Oganesson', 'Og'],
];

export const PERIODIC_TABLE: PeriodicElement[] = RAW.map(([name, symbol], i) => ({
    id: name.toLowerCase(),
    symbol,
    name,
    number: i + 1,
}));

export const PERIODIC_BY_ID: Record<string, PeriodicElement> =
    PERIODIC_TABLE.reduce((acc, e) => { acc[e.id] = e; return acc; }, {} as Record<string, PeriodicElement>);

export function getPeriodicElement(id: string): PeriodicElement | undefined {
    return PERIODIC_BY_ID[id];
}

// A readable label for an element id even if it predates this table (falls back
// to the raw id so nothing renders blank).
export function elementLabel(id: string): string {
    const e = PERIODIC_BY_ID[id];
    return e ? `${e.symbol} · ${e.name}` : id;
}
