// The emote picker (M5): a small bottom-right button that expands into a row of
// reaction glyphs. Pure DOM (like LeaveButton), so it sits above the Phaser canvas and
// is tap-friendly on phones. Active scenes call showEmoteBar() on wake and
// hideEmoteBar() on sleep. Picking a glyph fires the handler and collapses the row.

import { EMOTES } from './Emotes';

let wrap: HTMLDivElement | null = null;
let row: HTMLDivElement | null = null;
let toggle: HTMLButtonElement | null = null;
let onPick: ((glyph: string) => void) | null = null;
let openRow = false;

function setOpen(open: boolean): void {
    openRow = open;
    if (wrap) wrap.classList.toggle('ibc-emote--open', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
}

function ensure(): void {
    if (wrap) return;
    wrap = document.createElement('div');
    wrap.id = 'ibc-emote';
    wrap.className = 'ibc-emote';

    row = document.createElement('div');
    row.className = 'ibc-emote__row';
    EMOTES.forEach(glyph => {
        const b = document.createElement('button');
        b.className = 'ibc-emote__pick';
        b.type = 'button';
        b.textContent = glyph;
        b.setAttribute('aria-label', `React ${glyph}`);
        b.addEventListener('click', () => { const cb = onPick; setOpen(false); cb?.(glyph); });
        row!.appendChild(b);
    });

    toggle = document.createElement('button');
    toggle.className = 'ibc-emote__toggle';
    toggle.type = 'button';
    toggle.textContent = '😊';
    toggle.setAttribute('aria-label', 'React with an emote');
    toggle.addEventListener('click', () => setOpen(!openRow));

    wrap.appendChild(row);
    wrap.appendChild(toggle);
    document.body.appendChild(wrap);
}

// Show the picker and set what a pick does. Called from an active scene's wake.
export function showEmoteBar(handler: (glyph: string) => void): void {
    ensure();
    onPick = handler;
    setOpen(false);
    wrap!.style.display = 'flex';
}

export function hideEmoteBar(): void {
    onPick = null;
    setOpen(false);
    if (wrap) wrap.style.display = 'none';
}
