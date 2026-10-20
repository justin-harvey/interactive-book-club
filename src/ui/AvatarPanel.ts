// Avatar customization (M7): a top-right button that opens a small modal to set your
// display name and avatar colour, so friends can tell each other apart. Pure DOM (like
// LeaveButton/ChatInput). Saving writes identity (localStorage); identity listeners then
// re-tint the local avatar and re-announce to peers (see ScenePresence). The scene
// keyboard is disabled while the modal is open so typing a name doesn't walk the dog.

import 'phaser';
import { AVATAR_COLORS, getGuestName, getGuestColor, getGuestCharacter, setGuestName, setGuestColor, setGuestCharacter, textOn } from '../net/identity';
import { CHARACTERS } from '../data/characters';

let btn: HTMLButtonElement | null = null;
let modal: HTMLDivElement | null = null;
let nameInput: HTMLInputElement | null = null;
let swatchWrap: HTMLDivElement | null = null;
let charWrap: HTMLDivElement | null = null;
let activeScene: Phaser.Scene | null = null;
let chosenColor = '';
let chosenCharacter = '';
let isOpen = false;

export function isAvatarPanelOpen(): boolean {
    return isOpen;
}

function renderSwatches(): void {
    if (!swatchWrap) return;
    swatchWrap.innerHTML = '';
    AVATAR_COLORS.forEach(hex => {
        const s = document.createElement('button');
        s.type = 'button';
        s.className = 'ibc-avatar__swatch' + (hex === chosenColor ? ' ibc-avatar__swatch--on' : '');
        s.style.background = hex;
        s.setAttribute('aria-label', `Colour ${hex}`);
        s.addEventListener('click', () => { chosenColor = hex; renderSwatches(); syncButton(); });
        swatchWrap!.appendChild(s);
    });
}

// A grid of character thumbnails (pixel townsfolk show their down-standing frame; the
// dog shows a 🐕 glyph). Picking just marks the selection; Save commits it.
function renderCharacters(): void {
    if (!charWrap) return;
    charWrap.innerHTML = '';
    CHARACTERS.forEach(def => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ibc-avatar__char' + (def.id === chosenCharacter ? ' ibc-avatar__char--on' : '');
        b.title = def.label;
        b.setAttribute('aria-label', def.label);
        if (def.pixel && def.sheet) {
            const thumb = document.createElement('span');
            thumb.className = 'ibc-avatar__thumb';
            // Show frame 0 (down, standing — always at the sheet's top-left), scaled so the
            // frame is ~44px tall. Works for any sheet (townsfolk 16x24, animals 32x32).
            const k = 44 / def.frameHeight;
            thumb.style.width = `${def.frameWidth * k}px`;
            thumb.style.height = `${def.frameHeight * k}px`;
            thumb.style.backgroundImage = `url(${def.sheet})`;
            thumb.style.backgroundSize = `${(def.sheetWidth || def.frameWidth) * k}px ${(def.sheetHeight || def.frameHeight) * k}px`;
            thumb.style.backgroundPosition = '0 0';
            b.appendChild(thumb);
        } else {
            b.textContent = '🐕';
            b.classList.add('ibc-avatar__char--emoji');
        }
        b.addEventListener('click', () => { chosenCharacter = def.id; renderCharacters(); });
        charWrap!.appendChild(b);
    });
}

// Keep the corner button showing the current colour.
function syncButton(): void {
    if (!btn) return;
    const c = chosenColor || getGuestColor();
    btn.style.background = c;
    btn.style.color = textOn(c);
}

function ensure(): void {
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'ibc-avatar-btn';
    btn.className = 'ibc-avatar__btn';
    btn.type = 'button';
    btn.textContent = '🎨';
    btn.setAttribute('aria-label', 'Customize your avatar');
    btn.addEventListener('click', open);

    modal = document.createElement('div');
    modal.id = 'ibc-avatar';
    modal.className = 'ibc-avatar';
    modal.innerHTML = `
        <div class="ibc-avatar__panel">
            <div class="ibc-avatar__bar">
                <span class="ibc-avatar__title">🎨 Your avatar</span>
                <button class="ibc-avatar__close" type="button" aria-label="Close">Close &times;</button>
            </div>
            <label class="ibc-avatar__field">
                <span>Name</span>
                <input class="ibc-avatar__name" type="text" maxlength="24" autocomplete="off" placeholder="Your name" />
            </label>
            <div class="ibc-avatar__field">
                <span>Colour</span>
                <div class="ibc-avatar__swatches"></div>
            </div>
            <div class="ibc-avatar__field">
                <span>Character</span>
                <div class="ibc-avatar__chars"></div>
            </div>
            <button class="ibc-avatar__save" type="button">Save</button>
        </div>
    `;
    nameInput = modal.querySelector('.ibc-avatar__name');
    swatchWrap = modal.querySelector('.ibc-avatar__swatches');
    charWrap = modal.querySelector('.ibc-avatar__chars');
    nameInput!.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    modal.querySelector('.ibc-avatar__close')!.addEventListener('click', close);
    modal.querySelector('.ibc-avatar__save')!.addEventListener('click', save);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.body.appendChild(btn);
    document.body.appendChild(modal);
}

function open(): void {
    if (isOpen || !activeScene) return;
    isOpen = true;
    chosenColor = getGuestColor();
    chosenCharacter = getGuestCharacter();
    nameInput!.value = getGuestName();
    renderSwatches();
    renderCharacters();
    const kb = activeScene.input?.keyboard;
    if (kb) kb.enabled = false;
    modal!.style.display = 'flex';
    setTimeout(() => nameInput?.focus(), 0);
}

function save(): void {
    const name = (nameInput?.value || '').trim();
    if (name) setGuestName(name);
    if (chosenColor) setGuestColor(chosenColor);
    if (chosenCharacter) setGuestCharacter(chosenCharacter);
    syncButton();
    close();
}

function close(): void {
    if (!isOpen) return;
    isOpen = false;
    if (modal) modal.style.display = 'none';
    const kb = activeScene?.input?.keyboard;
    if (kb) kb.enabled = true;
}

// Show the avatar button for the active scene (called on wake). Opening the modal targets
// this scene (so its keyboard is the one we disable while typing).
export function showAvatarUi(scene: Phaser.Scene): void {
    ensure();
    activeScene = scene;
    syncButton();
    btn!.style.display = 'flex';
}

export function hideAvatarUi(): void {
    close();
    activeScene = null;
    if (btn) btn.style.display = 'none';
}
