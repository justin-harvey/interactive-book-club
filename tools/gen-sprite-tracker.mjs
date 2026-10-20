// Generates a sprite-production tracker CSV for Isotopia's Elementals.
// Source of truth: src/data/elements.ts (playable roster + monster names),
// src/data/periodicTable.ts (full 118-element table), and the actual wired
// art files in src/assets/elementals/*.png.
import { readdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';

// --- Playable roster (id -> monster display name), copied from elements.ts ---
const ROSTER = {
  hydrogen: 'Hydrohop', carbon: 'Carbocrunch', nitrogen: 'Nitronoodle',
  oxygen: 'Oxypuff', sodium: 'Sodazoom', magnesium: 'Magflash',
  iron: 'Ironclank', neon: 'Neonglow', uranium: 'Glowbun',
  helium: 'Helior', beryllium: 'Beryllia', boron: 'Borolith',
  fluorine: 'Fluorvex', aluminum: 'Aluminio', sulfur: 'Brimora',
  scandium: 'Scandion',
};

// --- Full periodic table (name, symbol), atomic number = index + 1 ---
const RAW = [
  ['Hydrogen','H'],['Helium','He'],['Lithium','Li'],['Beryllium','Be'],['Boron','B'],
  ['Carbon','C'],['Nitrogen','N'],['Oxygen','O'],['Fluorine','F'],['Neon','Ne'],
  ['Sodium','Na'],['Magnesium','Mg'],['Aluminum','Al'],['Silicon','Si'],['Phosphorus','P'],
  ['Sulfur','S'],['Chlorine','Cl'],['Argon','Ar'],['Potassium','K'],['Calcium','Ca'],
  ['Scandium','Sc'],['Titanium','Ti'],['Vanadium','V'],['Chromium','Cr'],['Manganese','Mn'],
  ['Iron','Fe'],['Cobalt','Co'],['Nickel','Ni'],['Copper','Cu'],['Zinc','Zn'],
  ['Gallium','Ga'],['Germanium','Ge'],['Arsenic','As'],['Selenium','Se'],['Bromine','Br'],
  ['Krypton','Kr'],['Rubidium','Rb'],['Strontium','Sr'],['Yttrium','Y'],['Zirconium','Zr'],
  ['Niobium','Nb'],['Molybdenum','Mo'],['Technetium','Tc'],['Ruthenium','Ru'],['Rhodium','Rh'],
  ['Palladium','Pd'],['Silver','Ag'],['Cadmium','Cd'],['Indium','In'],['Tin','Sn'],
  ['Antimony','Sb'],['Tellurium','Te'],['Iodine','I'],['Xenon','Xe'],['Cesium','Cs'],
  ['Barium','Ba'],['Lanthanum','La'],['Cerium','Ce'],['Praseodymium','Pr'],['Neodymium','Nd'],
  ['Promethium','Pm'],['Samarium','Sm'],['Europium','Eu'],['Gadolinium','Gd'],['Terbium','Tb'],
  ['Dysprosium','Dy'],['Holmium','Ho'],['Erbium','Er'],['Thulium','Tm'],['Ytterbium','Yb'],
  ['Lutetium','Lu'],['Hafnium','Hf'],['Tantalum','Ta'],['Tungsten','W'],['Rhenium','Re'],
  ['Osmium','Os'],['Iridium','Ir'],['Platinum','Pt'],['Gold','Au'],['Mercury','Hg'],
  ['Thallium','Tl'],['Lead','Pb'],['Bismuth','Bi'],['Polonium','Po'],['Astatine','At'],
  ['Radon','Rn'],['Francium','Fr'],['Radium','Ra'],['Actinium','Ac'],['Thorium','Th'],
  ['Protactinium','Pa'],['Uranium','U'],['Neptunium','Np'],['Plutonium','Pu'],['Americium','Am'],
  ['Curium','Cm'],['Berkelium','Bk'],['Californium','Cf'],['Einsteinium','Es'],['Fermium','Fm'],
  ['Mendelevium','Md'],['Nobelium','No'],['Lawrencium','Lr'],['Rutherfordium','Rf'],['Dubnium','Db'],
  ['Seaborgium','Sg'],['Bohrium','Bh'],['Hassium','Hs'],['Meitnerium','Mt'],['Darmstadtium','Ds'],
  ['Roentgenium','Rg'],['Copernicium','Cn'],['Nihonium','Nh'],['Flerovium','Fl'],['Moscovium','Mc'],
  ['Livermorium','Lv'],['Tennessine','Ts'],['Oganesson','Og'],
];

// Which ids actually have a wired PNG in src/assets/elementals/
const artFiles = new Set(
  readdirSync(new URL('../src/assets/elementals/', import.meta.url))
    .filter(f => f.endsWith('.png'))
    .map(f => f.replace('.png', ''))
);

const rows = RAW.map(([name, symbol], i) => {
  const id = name.toLowerCase();
  const monster = ROSTER[id] || '';
  const inRoster = monster ? 'Yes' : 'No';
  const hasSprite = artFiles.has(id) ? 'Yes' : 'No';
  const spriteFile = artFiles.has(id) ? `src/assets/elementals/${id}.png` : '';
  let status;
  if (hasSprite === 'Yes') status = 'Done';
  else if (inRoster === 'Yes') status = 'NEEDS SPRITE (monster named)';
  else status = 'Needs monster design + sprite';
  return {
    number: i + 1, symbol, name, monster, inRoster, hasSprite, spriteFile, status,
  };
});

const header = ['Atomic #','Symbol','Element','Monster Name','In Playable Roster','Has Sprite','Sprite File','Status'];
const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);
const csv = [header, ...rows.map(r => [r.number,r.symbol,r.name,r.monster,r.inRoster,r.hasSprite,r.spriteFile,r.status])]
  .map(line => line.map(esc).join(',')).join('\n');

const out = new URL('../isotopia-sprite-tracker.csv', import.meta.url);
writeFileSync(out, csv + '\n');

const done = rows.filter(r => r.hasSprite === 'Yes').length;
const namedNoSprite = rows.filter(r => r.inRoster === 'Yes' && r.hasSprite === 'No').length;
console.log(`Wrote ${rows.length} rows -> isotopia-sprite-tracker.csv`);
console.log(`Sprites done: ${done} | Named monsters still missing sprite: ${namedNoSprite} | Elements with no monster yet: ${rows.length - done - namedNoSprite}`);
