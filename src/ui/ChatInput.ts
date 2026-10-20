// The in-world chat composer (M5). A single DOM text field docked at the bottom of
// the screen, opened by pressing Enter. Pure DOM, like BookReader/LeaveButton. While
// it's open the Phaser scene keyboard is disabled so typing doesn't walk the dog;
// Enter sends, Escape cancels. Sending is delegated to the caller (ScenePresence),
// which relays over presence and shows the speaker's own bubble.

import 'phaser';

let overlay: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
let isOpen = false;
let activeScene: Phaser.Scene | null = null;
let onSubmit: ((text: string) => void) | null = null;

export function isChatInputOpen(): boolean {
    return isOpen;
}

function ensure(): void {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'ibc-chat';
    overlay.className = 'ibc-chat';
    overlay.innerHTML = `
        <form class="ibc-chat__form">
            <input class="ibc-chat__input" type="text" maxlength="200" autocomplete="off"
                   autocapitalize="sentences" placeholder="Say something…" aria-label="Chat message" />
            <button class="ibc-chat__send" type="submit">Send</button>
        </form>
    `;
    input = overlay.querySelector('.ibc-chat__input');
    overlay.querySelector('.ibc-chat__form')!.addEventListener('submit', (e) => {
        e.preventDefault();
        send();
    });
    input!.addEventListener('keydown', (e) => {
        // Stop keys from reaching the game while typing; handle our own Enter/Esc.
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeChatInput(); }
    });
    document.body.appendChild(overlay);
}

function send(): void {
    const text = (input?.value || '').trim();
    const cb = onSubmit;
    closeChatInput();
    if (text && cb) cb(text);
}

// Open the composer for `scene`. `submit` is called with the typed text when the
// player presses Enter / taps Send (never with empty text).
export function openChatInput(scene: Phaser.Scene, submit: (text: string) => void): void {
    ensure();
    if (isOpen) return;
    isOpen = true;
    activeScene = scene;
    onSubmit = submit;

    const kb = scene.input?.keyboard;
    if (kb) kb.enabled = false;

    input!.value = '';
    overlay!.style.display = 'flex';
    // Defer focus so the Enter that opened us doesn't immediately submit.
    setTimeout(() => input?.focus(), 0);
}

export function closeChatInput(): void {
    if (!isOpen) return;
    isOpen = false;
    if (overlay) overlay.style.display = 'none';

    const kb = activeScene?.input?.keyboard;
    if (kb) kb.enabled = true;
    activeScene = null;
    onSubmit = null;
}
