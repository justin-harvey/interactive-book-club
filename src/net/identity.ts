// A lightweight, persistent guest identity for presence. There's no account system
// here (friends-only, private), so each device gets a stable random id plus a friendly
// display name and an avatar colour, all kept in localStorage. A future sign-in could
// override these. UI (the Avatar panel) changes name/colour; listeners re-tint the local
// avatar and re-announce to peers (see onIdentityChange + ScenePresence).

const ID_KEY = 'ibc:uid';
const NAME_KEY = 'ibc:name';
const COLOR_KEY = 'ibc:color';

// A friendly, visually distinct palette so friends can tell each other apart.
export const AVATAR_COLORS = [
    '#e0566d', '#f29e4c', '#f7d154', '#6bbf59',
    '#4cc3c9', '#5b8cf0', '#a36bd6', '#d66ba0',
];

function randomId(): string {
    return 'g-' + Math.random().toString(36).slice(2, 10);
}

// '#rrggbb' -> 0xRRGGBB for Phaser setTint.
export function colorToInt(hex: string): number {
    return parseInt(String(hex).replace('#', ''), 16) || 0xffffff;
}

// Readable text colour (dark or white) for a filled swatch of `hex`, by luminance.
export function textOn(hex: string): string {
    const n = colorToInt(hex);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#10203a' : '#ffffff';
}

export function getGuestId(): string {
    let id = '';
    try { id = localStorage.getItem(ID_KEY) || ''; } catch { /* ignore */ }
    if (!id) { id = randomId(); try { localStorage.setItem(ID_KEY, id); } catch { /* ignore */ } }
    return id;
}

export function getGuestName(): string {
    let name = '';
    try { name = localStorage.getItem(NAME_KEY) || ''; } catch { /* ignore */ }
    if (!name) {
        name = 'Penguin ' + Math.floor(1000 + Math.random() * 9000);
        try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
    }
    return name;
}

export function getGuestColor(): string {
    let color = '';
    try { color = localStorage.getItem(COLOR_KEY) || ''; } catch { /* ignore */ }
    if (!color) {
        // Seed a stable-ish colour from the guest id so a fresh device isn't grey.
        const id = getGuestId();
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        color = AVATAR_COLORS[h % AVATAR_COLORS.length];
        try { localStorage.setItem(COLOR_KEY, color); } catch { /* ignore */ }
    }
    return color;
}

export function setGuestName(name: string): void {
    const n = name.trim().slice(0, 24);
    if (n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } notify(); }
}

export function setGuestColor(hex: string): void {
    const c = String(hex || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) { try { localStorage.setItem(COLOR_KEY, c); } catch { /* ignore */ } notify(); }
}

// Notify when the local player's identity (name/colour) changes, so the active scene can
// re-tint the avatar and re-announce to peers.
type Listener = () => void;
const listeners = new Set<Listener>();
export function onIdentityChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function notify(): void { listeners.forEach(fn => fn()); }
