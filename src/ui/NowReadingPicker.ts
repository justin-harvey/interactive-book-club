// The "Now Reading" chooser (M5). A DOM overlay listing the catalog so a member can set
// the club's current pick from in-world. Pure DOM, like BookReader/ChatInput; disables
// the scene keyboard while open. Picking delegates to the caller (the Now Reading sign),
// which relays the choice over presence so it persists and syncs to everyone.

import 'phaser';
import { BOOKS } from '../data/books';

let overlay: HTMLDivElement | null = null;
let listEl: HTMLDivElement | null = null;
let isOpen = false;
let activeScene: Phaser.Scene | null = null;
let onPick: ((bookId: string) => void) | null = null;

export function isNowReadingPickerOpen(): boolean {
    return isOpen;
}

function ensure(): void {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'ibc-nowreading';
    overlay.className = 'ibc-nowreading';
    overlay.innerHTML = `
        <div class="ibc-nowreading__panel">
            <div class="ibc-nowreading__bar">
                <span class="ibc-nowreading__title">📖 Set the club's Now Reading</span>
                <button class="ibc-nowreading__close" aria-label="Close">Close &times;</button>
            </div>
            <div class="ibc-nowreading__list"></div>
        </div>
    `;
    listEl = overlay.querySelector('.ibc-nowreading__list');
    overlay.querySelector('.ibc-nowreading__close')!.addEventListener('click', () => closeNowReadingPicker());
    // Click the dim backdrop (outside the panel) to dismiss.
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeNowReadingPicker(); });
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeNowReadingPicker(); }
}

// Open the chooser. `currentId` is highlighted; `pick` is called with the chosen book id.
export function openNowReadingPicker(scene: Phaser.Scene, currentId: string, pick: (bookId: string) => void): void {
    ensure();
    if (isOpen) return;
    isOpen = true;
    activeScene = scene;
    onPick = pick;

    listEl!.innerHTML = '';
    BOOKS.forEach(book => {
        const b = document.createElement('button');
        b.className = 'ibc-nowreading__choice' + (book.id === currentId ? ' ibc-nowreading__choice--current' : '');
        b.type = 'button';
        b.innerHTML = `<span class="ibc-nowreading__spine" style="background:${book.spine}"></span>`
            + `<span class="ibc-nowreading__name">${book.title}<small>${book.author}</small></span>`
            + (book.id === currentId ? `<span class="ibc-nowreading__flag">now reading</span>` : '');
        b.addEventListener('click', () => { const cb = onPick; const id = book.id; closeNowReadingPicker(); cb?.(id); });
        listEl!.appendChild(b);
    });

    const kb = scene.input?.keyboard;
    if (kb) kb.enabled = false;
    document.addEventListener('keydown', onKey);
    overlay!.style.display = 'flex';
}

export function closeNowReadingPicker(): void {
    if (!isOpen) return;
    isOpen = false;
    if (overlay) overlay.style.display = 'none';
    document.removeEventListener('keydown', onKey);
    const kb = activeScene?.input?.keyboard;
    if (kb) kb.enabled = true;
    activeScene = null;
    onPick = null;
}
