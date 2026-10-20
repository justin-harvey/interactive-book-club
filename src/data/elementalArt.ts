// Which Elementals have real character art (in src/assets/elementals/<id>.png).
// Elements not listed here still work — they render as a tinted placeholder NPC.
// Keep the filenames in sync with the copies under src/assets/elementals/.
const ART_IDS = new Set<string>([
    'hydrogen', 'carbon', 'oxygen', 'sodium',
    'iron', 'neon', 'uranium', 'magnesium', 'nitrogen',
    // 2026-09 art drop
    'helium', 'beryllium', 'boron', 'fluorine', 'aluminum', 'sulfur', 'scandium',
    // Flame-test Elementals (desert Lesson Three) — real pixel art (2026-10-04, Gemini
    // art with the orange bg stripped). Earlier placeholder flame creatures were replaced
    // in place; tools/gen_placeholder_elementals.py can still regenerate stand-ins.
    'potassium', 'copper', 'barium', 'lithium', 'strontium', 'calcium',
    // 3p-block fill-ins (jungle Lesson Two) — real Gemini art, orange bg stripped.
    'silicon', 'phosphorus', 'chlorine', 'argon',
    // First-row transition metals (2026-10) — real art, bg stripped via tools/remove_bg.py.
    'titanium', 'vanadium', 'chromium', 'manganese', 'cobalt', 'nickel',
    // Period-4 post-transition/metalloids/noble gas + period-5 alkali (2026-10-09) —
    // real art, bg stripped + centred via tools/remove_bg.py.
    'zinc', 'gallium', 'germanium', 'arsenic', 'selenium', 'bromine', 'krypton', 'rubidium',
    // Second-row (4d) transition metals (2026-10-09 batch 2) — real art, bg stripped +
    // centred via tools/prep_elemental_sprite.py.
    'zirconium', 'niobium', 'molybdenum', 'technetium', 'ruthenium', 'rhodium', 'palladium',
]);

/** Texture cache key for an Elemental's art, or undefined if it has no art. */
export function elementalArtKey(id: string): string | undefined {
    return ART_IDS.has(id) ? `elemental_${id}` : undefined;
}

/** Load path (relative to the scene HTML) for an Elemental's art PNG. */
export function elementalArtPath(id: string): string {
    return `assets/elementals/${id}.png`;
}
