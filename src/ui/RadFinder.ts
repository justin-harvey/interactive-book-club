// The Rad Finder — an equippable Geiger-counter tool. A student equips it from
// the Isotopedex at any time; it then (a) unlocks location hints on every dex
// card and (b) shows an in-game HUD meter that heats up as they approach the
// nearest undiscovered Elemental in the current room. Between the two, nobody
// gets stuck. Fully client-side and offline/iPad-safe, so the "clicks" are
// visual (audio is blocked on file:// and iOS Safari won't vibrate).

import { onBodyReady } from './domReady';

const KEY = 'isotopia.radfinder.v1';
let equipped = load();
const listeners: (() => void)[] = [];
let hud: HTMLDivElement | null = null;

function load(): boolean {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function isRadFinderEquipped(): boolean { return equipped; }

/** Equip / unequip. Persists, toggles the HUD, and notifies listeners (the dex
 *  re-renders its cards + tool button). */
export function setRadFinderEquipped(on: boolean): void {
    equipped = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
    syncHud();
    listeners.forEach(fn => fn());
}

export function onRadFinderChange(fn: () => void): void { listeners.push(fn); }

// The Elemental the student is actively tracking (picked in the DEX). The Rad
// Finder points its arrow at THIS one; if none is picked it falls back to the
// nearest uncaught in the room. Persisted so it survives a reload.
const TARGET_KEY = 'isotopia.radtarget.v1';
let target: string | null = loadTarget();

function loadTarget(): string | null {
    try { return localStorage.getItem(TARGET_KEY) || null; } catch { return null; }
}

export function getRadTarget(): string | null { return target; }

/** Track a specific Elemental (or stop, with null). Notifies listeners so the dex
 *  re-renders its Track buttons. */
export function setRadTarget(id: string | null): void {
    target = id;
    try {
        if (id) localStorage.setItem(TARGET_KEY, id);
        else localStorage.removeItem(TARGET_KEY);
    } catch { /* private mode */ }
    listeners.forEach(fn => fn());
}

export interface RadReading {
    // homing: rotate the arrow (angleDeg) toward a target in THIS room.
    // elsewhere: target is in another area — show its location hint, no arrow.
    // caught: the tracked target is already caught. none: no signal here.
    mode: 'homing' | 'elsewhere' | 'caught' | 'none';
    label: string;         // e.g. "Tracking Oxypuff" / "Nearest: Ironclank"
    detail: string;        // distance, location hint, or status line
    angleDeg?: number;     // homing only — rotation for the up-pointing arrow
    heat?: 'none' | 'cool' | 'warm' | 'hot';
}

/** Mount the HUD once at startup (hidden until equipped). Deferred via
 *  onBodyReady because game.js runs in <head> before <body> exists. */
export function mountRadFinder(): void {
    onBodyReady(() => {
        if (hud) return;
        hud = document.createElement('div');
        hud.className = 'radfinder';
        hud.dataset.heat = 'none';
        hud.innerHTML = `
            <div class="rf-title">⚛ Rad Finder</div>
            <div class="rf-main">
                <div class="rf-arrow" aria-hidden="true">↑</div>
                <div class="rf-info">
                    <div class="rf-label">Scanning…</div>
                    <div class="rf-read">Tap Track on a card in the DEX to pick a target.</div>
                </div>
            </div>`;
        document.body.appendChild(hud);
        syncHud();
    });
}

function syncHud(): void {
    if (hud) hud.classList.toggle('on', equipped);
}

/** Push a fresh reading (called by the active scene as the player moves). */
export function setRadReading(r: RadReading): void {
    if (!hud || !equipped) return;
    const arrow = hud.querySelector('.rf-arrow') as HTMLElement;
    const label = hud.querySelector('.rf-label') as HTMLElement;
    const read = hud.querySelector('.rf-read') as HTMLElement;

    hud.dataset.heat = r.heat ?? 'none';
    label.textContent = r.label;
    read.textContent = r.detail;

    if (r.mode === 'homing' && r.angleDeg != null) {
        arrow.style.display = '';
        arrow.textContent = '↑';
        arrow.style.transform = `rotate(${Math.round(r.angleDeg)}deg)`;
    } else if (r.mode === 'elsewhere') {
        arrow.style.display = '';
        arrow.style.transform = 'none';
        arrow.textContent = '📍';      // it's in another area — the detail says where
    } else if (r.mode === 'caught') {
        arrow.style.display = '';
        arrow.style.transform = 'none';
        arrow.textContent = '✓';
    } else {
        arrow.style.display = 'none';   // none — no signal / all found
    }
}
