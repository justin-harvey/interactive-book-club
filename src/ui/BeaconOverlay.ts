// Desert Lesson Three — the Flame-Test Beacons puzzle (outside, in the desert).
//
// Light three cold beacons by burning an Elemental YOU HAVE CAUGHT whose flame colour
// matches each one. Match all three and the buried pyramid rises. Teaches atomic
// emission: an excited electron falling back to a lower shell releases a photon whose
// energy — and therefore colour — is the element's signature (sequel to the sanctum's
// electron-shell forge). See data/flameTest.ts.
//
// The "fuel" you can burn is whatever you've caught (progress.isCaught) that has a
// real flame colour (data/flameTest FLAME_FUELS) — the puzzle makes you go back and
// catch Sodium / Boron / Sulfur if you haven't. Pure DOM (like QuizOverlay /
// ResonanceOverlay) so it renders crisply over the Phaser canvas and freezes the dog
// via inDialogue while open. Lit progress is session-scoped (module memory); the real
// completion is the pyramid rising, which DesertScene persists.

import GlobalInfo from '../GlobalInfo';
import { BEACONS, FLAME_FUELS, FUEL_BY_ELEMENT, Beacon, FlameFuel, fuelsFor } from '../data/flameTest';
import { isCaught } from '../data/progress';

let isOpen = false;
let onSolvedCb: (() => void) | undefined;
let onCloseCb: (() => void) | undefined;
let overlay: HTMLDivElement | null = null;

// Which caught Elemental lit each beacon (beacon id → element id). Session-scoped.
const lit: Record<string, string> = {};
let selectedBeacon: string | null = null;
let message = '';

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// ---- A soft WebAudio "ignite" / "fizzle" (no audio assets needed) -------------
type ACtor = typeof AudioContext;
let audioCtx: AudioContext | undefined;
function ac(): AudioContext | undefined {
    try {
        const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
        const Ctx = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctx) return undefined;
        if (!audioCtx) audioCtx = new Ctx();
        return audioCtx;
    } catch { return undefined; }
}
function tone(freq: number, ms: number, type: OscillatorType, delay = 0, vol = 0.06): void {
    const ctx = ac();
    if (!ctx) return;
    try {
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + ms / 1000);
    } catch { /* audio unavailable — puzzle still works silently */ }
}
function tick(): void { tone(523.25, 45, 'square', 0, 0.02); }
function ignite(): void { tone(330, 220, 'sawtooth', 0, 0.04); tone(880, 200, 'sine', 0.04); tone(1320, 240, 'sine', 0.12); }
function fizzle(): void { tone(180, 260, 'sawtooth', 0, 0.05); tone(120, 320, 'sawtooth', 0.06, 0.04); }
function victoryChord(): void { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 900, 'sine', i * 0.09, 0.05)); }

// ---- Open / close -------------------------------------------------------------
// onSolved fires once the player confirms the rise (all three beacons lit). onClose
// always fires when the overlay is dismissed (so the altar can re-arm).
export function openBeaconOverlay(onSolved?: () => void, onClose?: () => void): void {
    if (isOpen) return;
    isOpen = true;
    onSolvedCb = onSolved;
    onCloseCb = onClose;
    selectedBeacon = null;
    message = '';
    setDialogue(true);

    overlay = document.createElement('div');
    overlay.className = 'beacon-overlay';
    overlay.innerHTML = `
        <div class="beacon-panel">
            <div class="beacon-header">
                <span class="beacon-title">🔥 Flame-Test Beacons</span>
                <button class="beacon-close" aria-label="Step back from the beacons">✕</button>
            </div>
            <p class="beacon-intro"></p>
            <div class="beacon-meter" role="progressbar" aria-label="Beacons lit" aria-valuemin="0" aria-valuemax="3">
                <div class="beacon-meter-fill"></div>
                <span class="beacon-meter-label"></span>
            </div>
            <div class="beacon-banner" hidden></div>
            <div class="beacon-body"></div>
            <button class="beacon-primary" type="button" hidden>Raise the pyramid ▸</button>
        </div>`;

    overlay.querySelector('.beacon-close')!.addEventListener('click', closeBeaconOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeBeaconOverlay(); });
    (overlay.querySelector('.beacon-primary') as HTMLButtonElement)
        .addEventListener('click', confirmSolve);
    document.addEventListener('keydown', onKey);

    render();
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { closeBeaconOverlay(); e.preventDefault(); }
}

export function closeBeaconOverlay(): void {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    overlay = null;
    isOpen = false;
    selectedBeacon = null;
    setDialogue(false);
    const cb = onCloseCb;
    onSolvedCb = undefined;
    onCloseCb = undefined;
    if (cb) cb();
}

// ---- Helpers ------------------------------------------------------------------
const litCount = (): number => BEACONS.filter(b => lit[b.id]).length;
const solved = (): boolean => litCount() === BEACONS.length;
const isDev = (): boolean => /[?&](dev|debug|e2e)\b/.test(location.search);
/** The flame fuels the player can actually use right now (caught Elementals; dev sees all). */
const availableFuels = (): FlameFuel[] => FLAME_FUELS.filter(f => isDev() || isCaught(f.elementId));

// ---- Render -------------------------------------------------------------------
function render(): void {
    if (!overlay) return;
    const done = solved();

    const intro = overlay.querySelector('.beacon-intro') as HTMLElement;
    intro.innerHTML = `Heat an element and its electrons leap, then fall back — each drop
        casts off light of one fixed <b>colour</b>. Burn an Elemental <b>you have caught</b>
        whose flame matches each beacon. <b>Tap a beacon, then tap an Elemental to burn.</b>`;

    const n = litCount();
    const fill = overlay.querySelector('.beacon-meter-fill') as HTMLElement;
    const label = overlay.querySelector('.beacon-meter-label') as HTMLElement;
    const meter = overlay.querySelector('.beacon-meter') as HTMLElement;
    fill.style.width = `${Math.round((n / BEACONS.length) * 100)}%`;
    label.textContent = `${n} of ${BEACONS.length} beacons lit`;
    meter.setAttribute('aria-valuenow', String(n));
    meter.classList.toggle('full', done);

    const banner = overlay.querySelector('.beacon-banner') as HTMLElement;
    if (done) {
        banner.hidden = false;
        banner.innerHTML = `🔥 EVERY BEACON BURNS TRUE 🔥<br>
            <span>Each colour was an element announcing itself by the light its electrons emit.
            The sand begins to tremble…</span>`;
    } else {
        banner.hidden = true;
    }

    const body = overlay.querySelector('.beacon-body') as HTMLElement;
    body.innerHTML = '';
    body.appendChild(makeBeacons());
    body.appendChild(makeTray());

    const primary = overlay.querySelector('.beacon-primary') as HTMLButtonElement;
    primary.hidden = !done;
}

function makeBeacons(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'beacon-row';
    wrap.innerHTML = `<div class="beacon-row-head">The Beacons</div>
        <div class="beacon-pillars">${BEACONS.map(beaconCard).join('')}</div>
        <div class="beacon-status" role="status" aria-live="polite">${escHtml(message || defaultMsg())}</div>`;

    wrap.querySelectorAll<HTMLButtonElement>('.beacon-pillar').forEach(btn => {
        const id = btn.dataset.id!;
        if (lit[id]) return;                 // already lit — leave it
        btn.addEventListener('click', () => selectBeacon(id));
    });
    return wrap;
}

function beaconCard(b: Beacon): string {
    const on = !!lit[b.id];
    const sel = selectedBeacon === b.id;
    const litBy = on ? FUEL_BY_ELEMENT[lit[b.id]] : undefined;
    return `<button class="beacon-pillar ${on ? 'lit' : ''} ${sel ? 'sel' : ''}"
            type="button" data-id="${b.id}" ${on ? 'disabled' : ''}
            style="--flame:${b.color.hex}">
        <span class="beacon-flame">${on ? '🔥' : '○'}</span>
        <span class="beacon-color">${escHtml(b.color.name)}</span>
        <span class="beacon-hint">${on
            ? `lit by ${escHtml(litBy ? litBy.symbol : '?')}`
            : escHtml(b.hint)}</span>
    </button>`;
}

function defaultMsg(): string {
    const have = availableFuels();
    // Which still-dark beacons can't be lit with what the player has caught?
    const unlightable = BEACONS.filter(b => !lit[b.id] && !fuelsFor(b).some(f => isDev() || isCaught(f.elementId)));
    if (!solved() && unlightable.length && have.length < BEACONS.length) {
        const colors = unlightable.map(b => b.color.name).join(', ');
        return `You haven't caught an Elemental that burns ${colors}. Catch the right Elementals, then return.`;
    }
    if (selectedBeacon) {
        const b = BEACONS.find(x => x.id === selectedBeacon)!;
        return `Beacon selected: it calls for a ${b.color.name} flame. Now tap an Elemental to burn.`;
    }
    return 'Tap a beacon to choose it, then tap one of your caught Elementals to burn in it.';
}

function makeTray(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'beacon-tray';
    const have = availableFuels();
    const chips = have.length
        ? have.map(fuelChip).join('')
        : `<div class="beacon-empty">— you've caught no Elementals with a known flame colour yet —</div>`;
    wrap.innerHTML = `<div class="beacon-row-head">Your Elementals</div>
        <div class="beacon-chips">${chips}</div>`;

    wrap.querySelectorAll<HTMLButtonElement>('.beacon-chip').forEach(btn => {
        const id = btn.dataset.id!;
        btn.addEventListener('click', () => burnFuel(id));
    });
    return wrap;
}

function fuelChip(f: FlameFuel): string {
    return `<button class="beacon-chip" type="button" data-id="${f.elementId}" style="--flame:${f.color.hex}">
        <span class="beacon-chip-sym">${escHtml(f.symbol)}</span>
        <span class="beacon-chip-swatch"></span>
        <span class="beacon-chip-el">${escHtml(f.name)}</span>
    </button>`;
}

// ---- Interaction --------------------------------------------------------------
function selectBeacon(id: string): void {
    if (lit[id]) return;
    selectedBeacon = (selectedBeacon === id ? null : id);
    tick();
    const b = BEACONS.find(x => x.id === id)!;
    message = selectedBeacon
        ? `This beacon wants a ${b.color.name} flame. Which Elemental burns that colour?`
        : '';
    render();
}

function burnFuel(elementId: string): void {
    const fuel = FUEL_BY_ELEMENT[elementId];
    if (!fuel) return;
    if (!selectedBeacon) {
        message = `Choose a beacon first, then burn ${fuel.symbol} in it.`;
        tick();
        render();
        return;
    }
    const beacon = BEACONS.find(b => b.id === selectedBeacon)!;
    if (fuel.color.id === beacon.color.id) {
        lit[beacon.id] = fuel.elementId;
        selectedBeacon = null;
        ignite();
        message = `${fuel.name} flares ${fuel.color.name} — the beacon catches! ${fuel.note}`;
        if (solved()) victoryChord();
        render();
    } else {
        fizzle();
        message = `${fuel.name} burns ${fuel.color.name}, but this beacon calls for ${beacon.color.name}. ${fuel.note}`;
        render();
        const pillars = overlay?.querySelector('.beacon-pillars') as HTMLElement | null;
        if (pillars) { pillars.classList.remove('shake'); void pillars.offsetWidth; pillars.classList.add('shake'); }
    }
}

function confirmSolve(): void {
    if (!solved()) return;
    const cb = onSolvedCb;
    closeBeaconOverlay();     // clears callbacks, fires onClose (altar re-arm)
    if (cb) cb();             // DesertScene plays the pyramid rise
}
