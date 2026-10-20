// Dev Warp — an in-game zone teleporter for staff/developers. Lets you jump to
// any scene instantly instead of walking the world and clearing the gate
// cutscenes (Woods → LOOKOUT → city-reveal → City, museum basement chain, the
// key-gated Atlantis tunnel, etc.). Purely a navigation shortcut: it calls the
// same GameScene.switch() a Door does, so scenes create() normally at their
// default start tile.
//
// GATING — never visible to students. It shows only when either:
//   • the URL carries ?dev / ?debug / ?e2e (developer / automated testing), OR
//   • the signed-in account is staff (super admin claim, or a promoted admin —
//     resolved by onTeacherAuth, the same check the teacher portal uses).
// Firebase-off (offline dev) => onTeacherAuth emits null, so only the ?dev flag
// reveals it.

import { onBodyReady } from './domReady';
import { onTeacherAuth } from '../data/adminAuth';
import { SceneName } from '../Scenes/enums/SceneNames';

interface Zone { key: string; label: string; }
interface ZoneGroup { title: string; zones: Zone[]; }

// Ordered zone menu, grouped the way the world is laid out. Keys are the Phaser
// scene keys (SceneName values) registered in game.ts. Add a new outdoor biome
// here (one line) once its scene exists — that's all the warp needs.
const GROUPS: ZoneGroup[] = [
    { title: 'Town', zones: [
        { key: SceneName.Test,      label: 'Town (start)' },
        { key: SceneName.Home,      label: 'Home' },
        { key: SceneName.Hardware,  label: 'Hardware store' },
        { key: SceneName.Hannaford, label: 'Hannaford' },
        { key: SceneName.Auto,      label: 'Auto shop' },
        { key: SceneName.Library,   label: 'Library' },
    ] },
    { title: 'Outdoors', zones: [
        { key: SceneName.Woods,     label: 'North Woods' },
        { key: SceneName.Jungle,    label: 'Jungle (lvl 2)' },
        { key: SceneName.Desert,    label: 'Desert (lvl 3)' },
    ] },
    { title: 'City', zones: [
        { key: SceneName.City,      label: 'City' },
    ] },
    { title: 'City interiors', zones: [
        { key: SceneName.CityPowerTower,   label: 'Power tower' },
        { key: SceneName.CityFinance,      label: 'Finance' },
        { key: SceneName.CityLargeTower,   label: 'Large tower' },
        { key: SceneName.CityChurch,       label: 'Church' },
        { key: SceneName.CityFashion,      label: 'Fashion' },
        { key: SceneName.CityRadioTower,   label: 'Radio tower' },
        { key: SceneName.CityPowerStation, label: 'Power station' },
        { key: SceneName.CityRadioTower2,  label: 'Radio tower 2' },
        { key: SceneName.CityMuseum,       label: 'Museum (ground)' },
        { key: SceneName.CityMuseumB1,     label: 'Museum B1' },
        { key: SceneName.CityMuseumB2,     label: 'Museum B2' },
        { key: SceneName.CityMuseumB3,     label: 'Museum B3' },
        { key: SceneName.CityMuseumB4,     label: 'Museum B4' },
    ] },
    { title: 'Secret', zones: [
        { key: SceneName.Atlantis,  label: 'Atlantis sanctum' },
    ] },
];

let root: HTMLDivElement | null = null;   // the whole widget (button + panel)
let revealed = false;                      // gate satisfied (flag or staff)

function devFlag(): boolean {
    return /[?&](dev|debug|e2e)\b/.test(location.search);
}

/** Warp to a scene key using the currently-running gameplay scene's switch()
 *  (stops audio, sleeps current, wakes/starts target). Falls back to a cold
 *  start if somehow nothing is running yet. */
function warpTo(game: Phaser.Game, key: string): void {
    const running = game.scene.getScenes(true) as unknown as { scene: { key: string };
        switch?: (k: string) => void }[];
    // Last active scene that exposes GameScene.switch — that's the live zone.
    const active = [...running].reverse().find(s => typeof s.switch === 'function');
    if (active && active.scene.key !== key) active.switch!(key);
    else if (!active) game.scene.start(key);
    closePanel();
    // Return focus to the game so movement keys work immediately after warping.
    (document.activeElement as HTMLElement | null)?.blur();
}

function closePanel(): void {
    root?.classList.remove('open');
}

function buildPanel(game: Phaser.Game): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'devwarp-panel';
    panel.innerHTML = '<div class="devwarp-head">⧉ Dev Warp</div>';
    GROUPS.forEach(group => {
        const g = document.createElement('div');
        g.className = 'devwarp-group';
        const h = document.createElement('div');
        h.className = 'devwarp-grouptitle';
        h.textContent = group.title;
        g.appendChild(h);
        const wrap = document.createElement('div');
        wrap.className = 'devwarp-zones';
        group.zones.forEach(z => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'devwarp-zone';
            b.textContent = z.label;
            b.addEventListener('click', () => warpTo(game, z.key));
            wrap.appendChild(b);
        });
        g.appendChild(wrap);
        panel.appendChild(g);
    });
    return panel;
}

function reveal(): void {
    if (revealed || !root) return;
    revealed = true;
    root.classList.add('shown');
}

/** Mount the warp widget once at startup. Hidden until the dev flag or a staff
 *  sign-in reveals it. Deferred via onBodyReady (game.js runs before <body>). */
export function mountDevWarp(game: Phaser.Game): void {
    onBodyReady(() => {
        if (root) return;
        root = document.createElement('div');
        root.className = 'devwarp';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'devwarp-toggle';
        toggle.textContent = '⧉ Warp';
        toggle.title = 'Dev: warp to any zone';
        toggle.addEventListener('click', () => root!.classList.toggle('open'));

        const panel = buildPanel(game);
        root.append(panel, toggle);
        document.body.appendChild(root);

        // Reveal immediately for the dev flag; otherwise wait for a staff account.
        if (devFlag()) reveal();
        try { onTeacherAuth(session => { if (session?.isStaff) reveal(); }); }
        catch { /* Firebase off — dev flag is the only way in */ }
    });
}
