// "Next batch" sprite plan for Isotopia: the 7 elements that, once drawn,
// complete the first three periods of the table (atomic numbers 1-20) — the
// core range for AP Chem and the most student-recognizable elements.
// Suggested monster names follow the existing copyright-safe "silly" style;
// tints are placeholder colors until real art lands.
import { writeFileSync } from 'node:fs';

const BATCH = [
  // #, symbol, element, suggested monster, suggested tint, theme hook for the artist
  [3,  'Li', 'Lithium',    'Lithspark',   '0xe57373', 'light reactive metal, battery/spark motif'],
  [14, 'Si', 'Silicon',    'Silichip',    '0x78909c', 'crystalline chip / circuit creature'],
  [15, 'P',  'Phosphorus', 'Phosflare',   '0xffb74d', 'glowing match-tip / ember body'],
  [17, 'Cl', 'Chlorine',   'Chlorofizz',  '0xaed581', 'pale green pool-gas blob'],
  [18, 'Ar', 'Argon',      'Argosnooze',  '0xb39ddb', 'sleepy inert noble-gas cloud'],
  [19, 'K',  'Potassium',  'Potaboom',    '0x9575cd', 'banana-hued, explodes-in-water energy'],
  [20, 'Ca', 'Calcium',    'Calcibone',   '0xeceff1', 'chalky bone/teeth armored critter'],
];

const header = ['Priority','Atomic #','Symbol','Element','Suggested Monster','Suggested Tint','Art Hook','Target Sprite File','Status'];
const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);
const rows = BATCH.map(([num, sym, name, monster, tint, hook], i) => [
  i + 1, num, sym, name, monster, tint, hook,
  `src/assets/elementals/${name.toLowerCase()}.png`, 'TO DO',
]);
const csv = [header, ...rows].map(line => line.map(esc).join(',')).join('\n');
writeFileSync(new URL('../isotopia-next-batch.csv', import.meta.url), csv + '\n');
console.log(`Wrote ${rows.length} rows -> isotopia-next-batch.csv`);
console.log('After this batch: elements 1-20 fully sprited (roster 16 -> 23).');
