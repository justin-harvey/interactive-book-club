// Where each Elemental can be found — used by the Rad Finder's "never get stuck"
// location hints in the Isotopedex. Mirrors the spawn placements in the scenes:
// TestScene (MONSTER_SPAWNS), WoodsScene (WILD), the town interiors (the
// elementIds passed to InteriorScene), and CityScene (CITY_ELEMENTALS — outdoors
// on the city streets, not inside the buildings). Keep in sync if an Elemental
// moves. The city is only reachable by the secret path, so its hints say how.

const CITY = 'City (walk to the very top of the North Woods)';
// Relocated starters now live down in the Museum basement (a city building).
const MUSEUM_B1 = `${CITY} — in the Museum, first basement level`;
const MUSEUM_B2 = `${CITY} — in the Museum, second basement level`;
// The 3p-block Elementals roam the Jungle (reached north from the City), where their
// totems are configured in the Canopy Energy Network lesson.
const JUNGLE = 'Jungle (north from the City) — roaming the clearings';

export const ELEMENTAL_LOCATION: Record<string, string> = {
    // Town placements re-scrambled for the official season (2026-10-13) — keep
    // these hints in sync with the scene spawns (TestScene, WoodsScene, the venues).
    hydrogen:  MUSEUM_B1,
    neon:      'North Woods — by the eastern tall grass',
    oxygen:    'Town — the plaza',
    nitrogen:  'North Woods — up north in the meadow',
    carbon:    MUSEUM_B2,
    iron:      'Library',
    sodium:    'Hardware store',
    magnesium: 'Hannaford (grocery)',
    uranium:   'Auto shop',
    helium:    MUSEUM_B1,
    // Directions relative to where you arrive (bottom middle of the city map).
    aluminum:  `${CITY} — far west side, halfway up`,
    scandium:  `${CITY} — far west side, lower down`,
    fluorine:  `${CITY} — just east of the middle`,
    beryllium: `${CITY} — near where you arrive, to the west`,
    sulfur:    `${CITY} — near where you arrive, to the east`,
    boron:     `${CITY} — far east, near the bottom`,
    // 3p-block Elementals — wild in the Jungle (Lesson Two).
    silicon:    JUNGLE,
    phosphorus: JUNGLE,
    chlorine:   JUNGLE,
    argon:      JUNGLE,
    // Period-4 post-transition/metalloids/noble gas + period-5 alkali (2026-10-09) —
    // roaming the City streets, spread to the corners and mid-map.
    zinc:      `${CITY} — northwest corner`,
    gallium:   `${CITY} — along the north edge, middle`,
    germanium: `${CITY} — near the top, just right of middle`,
    arsenic:   `${CITY} — northeast corner`,
    selenium:  `${CITY} — far east side, upper-middle`,
    bromine:   `${CITY} — middle of the map, east of centre`,
    krypton:   `${CITY} — far west side, lower down`,
    rubidium:  `${CITY} — southeast corner`,
    // Second-row (4d) transition metals (2026-10-09 batch 2) — roaming the City streets.
    zirconium:  `${CITY} — near the top, centre column`,
    niobium:    `${CITY} — far east side, near the top`,
    molybdenum: `${CITY} — far west edge, middle`,
    technetium: `${CITY} — lower-middle, east of centre`,
    ruthenium:  `${CITY} — southwest corner`,
    rhodium:    `${CITY} — along the south edge, west of centre`,
    palladium:  `${CITY} — along the south edge, east side`,
};

export function elementalLocation(id: string): string {
    return ELEMENTAL_LOCATION[id] || 'Somewhere in town';
}
