// The persistent on-screen HUD (the instruction strip at the bottom of the page)
// is mostly static markup in index.html. But the "walk up to an Elemental" tip is
// misleading when a paced release schedule means none have appeared yet — an empty
// world under that tip reads as "the game is broken." refreshHud() swaps in a
// friendly "check back later" line in that case. Called once after the class
// settings finish loading (game.ts); defaults leave the normal tip in place, so we
// never wrongly claim the world is empty.

import { ELEMENTS } from '../data/elements';
import { elementReleased } from '../data/classConfig';

export function refreshHud(): void {
    const tip = document.querySelector('#hud .hud-tip') as HTMLElement | null;
    if (!tip) return;
    const anyReleased = ELEMENTS.some(el => elementReleased(el.id));
    tip.innerHTML = anyReleased
        ? '<b>Tap</b> to walk · walk up to an <b>Elemental</b> to quiz it'
        : 'No <b>Elementals</b> have appeared yet — check back after your teacher releases them.';
}
