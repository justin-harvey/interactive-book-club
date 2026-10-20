// The Jungle (level 2) lesson — "Canopy Energy Network" (electron configuration).
//
// A one-totem-at-a-time puzzle that drills orbital filling. For each totem (an element
// the student has caught) the player channels electron-seeds up a VERTICAL lattice of
// sublevels — root nodes (1s) at the jungle floor, up through vine platforms (p), high
// crowns (d), to the emergent giants (f) — one rung at a time, in Aufbau order:
//   1. CAPACITY — each sublevel holds a fixed number (s=2, p=6, d=10, f=14).
//   2. ORDER    — you cannot fill a rung until the one below it is full; lowest energy
//                 first (so 4s fills BEFORE 3d — the lesson's "money" concept).
//   3. The element's configuration (e.g. Carbon = 1s² 2s² 2p²) is a pure function of
//      its atomic number; fill every rung to its target and the totem lights.
// Configure every totem and the ancient network powers up, awarding the Canopy Key
// (a bonus secret, NOT a gate — the desert is already gated by the sanctum crystal).
//
// Pure DOM (like ResonanceOverlay / QuizOverlay) so it renders crisply on a projector
// or iPad above the Phaser canvas, and freezes the dog via the shared inDialogue flag
// while open. The verticality lives HERE in the overlay (Isotopia's overworld is
// top-down — you walk between totems); the lattice is the climb. Cloned from
// ui/ResonanceOverlay.ts (steppers + press-and-hold + live readout + confirm-when-exact).

import GlobalInfo from '../GlobalInfo';
import {
    TOTEMS, Totem, Rung,
    configFor, totemZ, ORBITALS, isAufbauSwap,
} from '../data/aufbau';
import { getElement } from '../data/elements';
import {
    attuneTotem, isTotemAttuned, attunedTotemCount,
    markCanopyAttuned, isCanopyAttuned,
} from '../data/progress';

let isOpen = false;
let onCloseCb: (() => void) | undefined;
let overlay: HTMLDivElement | null = null;

// ---- Puzzle state -------------------------------------------------------------
let mode: 'configure' | 'done' = 'configure';
let currentIndex = 0;          // index into TOTEMS being configured
let rungs: Rung[] = [];        // configFor(Z) of the current totem (Aufbau order)
let rungIndex = 0;             // which rung is active (0 = 1s)
let work = 0;                  // electron-seeds placed in the active rung so far

const SUPERSCRIPT: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
const sup = (n: number): string => String(n).split('').map(d => SUPERSCRIPT[d]).join('');
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// ---- A soft WebAudio "chime" / "deny" (no audio assets needed) -----------------
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
function chime(): void { tone(659.25, 170, 'sine'); tone(987.77, 240, 'sine', 0.1); }
function deny(): void { tone(140, 180, 'sawtooth', 0, 0.045); }
function powerChord(): void {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 900, 'sine', i * 0.09, 0.05));
}

// ---- Open / close -------------------------------------------------------------
export function openCanopyOverlay(onClose?: () => void): void {
    if (isOpen) return;
    isOpen = true;
    onCloseCb = onClose;
    setDialogue(true);
    initState();

    overlay = document.createElement('div');
    overlay.className = 'canopy-overlay';
    overlay.innerHTML = `
        <div class="canopy-panel">
            <div class="canopy-header">
                <span class="canopy-title">❡ Canopy Energy Network</span>
                <button class="canopy-close" aria-label="Leave the totem">✕</button>
            </div>
            <p class="canopy-intro"></p>
            <div class="canopy-meter" role="progressbar" aria-label="Canopy network power" aria-valuemin="0" aria-valuemax="100">
                <div class="canopy-meter-fill"></div>
                <span class="canopy-meter-label"></span>
            </div>
            <div class="canopy-banner" hidden></div>
            <div class="canopy-body"></div>
        </div>`;

    overlay.querySelector('.canopy-close')!.addEventListener('click', closeCanopyOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCanopyOverlay(); });
    document.addEventListener('keydown', onKey);

    render();
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { closeCanopyOverlay(); e.preventDefault(); }
}

export function closeCanopyOverlay(): void {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    overlay = null;
    isOpen = false;
    setDialogue(false);
    const cb = onCloseCb;
    onCloseCb = undefined;
    if (cb) cb();
}

// ---- State setup --------------------------------------------------------------
// On open, skip totems already configured in a previous session and resume at the
// first un-configured one; if all are done, show the powered network.
function initState(): void {
    if (isCanopyAttuned()) { mode = 'done'; return; }
    const next = TOTEMS.findIndex(t => !isTotemAttuned(t.id));
    if (next === -1) { mode = 'done'; markCanopyAttuned(); return; }
    mode = 'configure';
    startTotem(next);
}

function startTotem(index: number): void {
    currentIndex = index;
    rungs = configFor(totemZ(TOTEMS[index]));
    rungIndex = 0;
    work = 0;
}

const doneCount = (): number => TOTEMS.filter(t => isTotemAttuned(t.id)).length;

// Network power %: each configured totem is one unit; while configuring, completed
// rungs of the current totem count as a fraction for a live-feeling meter.
function powerPct(): number {
    const total = TOTEMS.length;
    let done = doneCount();
    if (mode === 'configure' && rungs.length) done += rungIndex / rungs.length;
    return Math.round((done / total) * 100);
}

// ---- Top-level render (shell: intro, meter, banner, body) ---------------------
function render(): void {
    if (!overlay) return;
    const complete = isCanopyAttuned();

    const intro = overlay.querySelector('.canopy-intro') as HTMLElement;
    intro.innerHTML = mode === 'configure'
        ? `Wake each totem by configuring its electrons. Channel seeds up the lattice
           <b>in order</b> — fill each sublevel (<b>s</b>=2, <b>p</b>=6, <b>d</b>=10) before the next.`
        : `Every totem is configured and the network hums with light. The canopy is powered.`;

    const pct = powerPct();
    const fill = overlay.querySelector('.canopy-meter-fill') as HTMLElement;
    const label = overlay.querySelector('.canopy-meter-label') as HTMLElement;
    const meter = overlay.querySelector('.canopy-meter') as HTMLElement;
    fill.style.width = `${pct}%`;
    label.textContent = `Network power ${pct}%`;
    meter.setAttribute('aria-valuenow', String(pct));
    meter.classList.toggle('full', complete);

    const banner = overlay.querySelector('.canopy-banner') as HTMLElement;
    if (complete) {
        banner.hidden = false;
        banner.innerHTML = `❡ THE CANOPY IS POWERED ❡<br>
            <span>Every totem channels its electrons in perfect order. The ancient grove
            yields the <b>Canopy Key</b> — added to your Isotopedex.</span>`;
    } else {
        banner.hidden = true;
    }

    const body = overlay.querySelector('.canopy-body') as HTMLElement;
    body.innerHTML = '';
    if (mode === 'configure') body.appendChild(makeConfigure());
    else body.appendChild(makeSummary());
}

// ---- Configure (one totem: fill the lattice rung by rung) ---------------------
function makeConfigure(): HTMLElement {
    const totem = TOTEMS[currentIndex];
    const el = getElement(totem.id);
    const wrap = document.createElement('div');
    wrap.className = 'canopy-configure';

    wrap.innerHTML = `
        <div class="canopy-forge-head">
            <span class="canopy-forge-count">Totem ${doneCount() + 1} of ${TOTEMS.length}</span>
            <span class="canopy-spirit" style="--gem:${totem.gem}">${escHtml(totem.spirit)} · ${escHtml(el?.symbol ?? '?')}</span>
        </div>
        <p class="canopy-blurb">${escHtml(totem.blurb)}</p>
        <div class="canopy-forge-main">
            <div class="canopy-lattice" style="--gem:${totem.gem}" aria-label="electron orbital lattice"></div>
            <div class="canopy-phase-body">
                <div class="canopy-instruct"></div>
                <div class="canopy-readout"></div>
                <div class="canopy-stepper">
                    <button class="canopy-step canopy-minus" type="button" aria-label="remove one electron">−</button>
                    <span class="canopy-count"></span>
                    <button class="canopy-step canopy-plus" type="button" aria-label="add one electron">＋</button>
                </div>
                <div class="canopy-status" role="status" aria-live="polite"></div>
                <div class="canopy-why"></div>
                <button class="canopy-primary" type="button" disabled></button>
            </div>
        </div>`;

    bindStepper(wrap.querySelector('.canopy-minus') as HTMLElement, () => step(-1));
    bindStepper(wrap.querySelector('.canopy-plus') as HTMLElement, () => step(+1));
    (wrap.querySelector('.canopy-primary') as HTMLButtonElement)
        .addEventListener('click', confirmRung);

    queueMicrotask(refreshConfigure);
    return wrap;
}

function step(dir: number): void {
    const rung = rungs[rungIndex];
    const before = work;
    work = clamp(work + dir, 0, rung.cap);
    if (work === before) return;                 // hit a clamp — no change
    if (work > rung.electrons) deny();            // overfilling past what this atom has
    else tick();
    refreshConfigure();
}

// Update the dynamic parts in place (keeps the stepper buttons alive for
// press-and-hold). The lattice has no listeners, so rebuilding its HTML is safe.
function refreshConfigure(): void {
    if (!overlay) return;
    const totem = TOTEMS[currentIndex];
    const el = getElement(totem.id);
    const rung = rungs[rungIndex];
    const target = rung.electrons;

    (overlay.querySelector('.canopy-lattice') as HTMLElement).innerHTML = latticeHtml();

    const instruct = overlay.querySelector('.canopy-instruct') as HTMLElement;
    const sw = isAufbauSwap(rung.label);
    const prev = rungIndex > 0 ? rungs[rungIndex - 1].label : '';
    instruct.innerHTML =
        `The <b>${rung.sub}</b> sublevel holds up to <b>${rung.cap}</b> electrons
         (${ORBITALS[rung.sub]} orbital${ORBITALS[rung.sub] > 1 ? 's' : ''} × 2). Fill
         <b>${rung.label}</b> to <b>${target}</b>.`
        + (sw
            ? `<br><span class="canopy-swap">⚡ Aufbau surprise: <b>${rung.label}</b> fills
               <b>after</b> ${escHtml(prev)} — a lower principal number, but lower energy comes first.</span>`
            : '');

    const readout = overlay.querySelector('.canopy-readout') as HTMLElement;
    readout.innerHTML = liveConfigHtml();

    const count = overlay.querySelector('.canopy-count') as HTMLElement;
    count.textContent = String(work);

    const status = overlay.querySelector('.canopy-status') as HTMLElement;
    const ok = work === target;
    if (work === 0) {
        status.innerHTML = `Channel electron-seeds into <b>${rung.label}</b>.`;
    } else if (work < target) {
        status.innerHTML = `${rung.label}: <b>${work}</b> of ${target}. Keep channeling.`;
    } else if (ok) {
        status.innerHTML = target < rung.cap
            ? `✓ ${rung.label}${sup(work)} — ${escHtml(el?.name ?? '')}'s electrons run out here
               (the ${rung.sub} sublevel could hold ${rung.cap}).`
            : `✓ ${rung.label} full (${rung.cap}). On to the next level.`;
    } else {
        status.innerHTML = `Too many — ${escHtml(el?.name ?? '')} has only <b>${target}</b> electron${target === 1 ? '' : 's'}
            left for ${rung.label}. Ease back.`;
    }

    const why = overlay.querySelector('.canopy-why') as HTMLElement;
    why.innerHTML = `so far: <b>${liveConfigString()}</b>`;

    const primary = overlay.querySelector('.canopy-primary') as HTMLButtonElement;
    primary.disabled = !ok;
    const lastRung = rungIndex === rungs.length - 1;
    primary.textContent = lastRung ? 'Light the totem ▸' : `Lock ${rung.label} ▸`;
}

// The vertical lattice: highest-energy rung at the TOP, 1s (roots) at the bottom.
function latticeHtml(): string {
    return rungs.map((r, i) => {
        const state = i < rungIndex ? 'done' : (i === rungIndex ? 'active' : 'locked');
        const filled = i < rungIndex ? r.electrons : (i === rungIndex ? work : 0);
        const seeds = Array.from({ length: r.cap }, (_, k) =>
            `<span class="canopy-seed ${k < filled ? 'on' : ''}${k >= r.electrons ? ' beyond' : ''}"></span>`).join('');
        const shown = i < rungIndex ? r.electrons : (i === rungIndex ? work : 0);
        return `<div class="canopy-rung canopy-${state}">
            <span class="canopy-rung-label">${r.label}</span>
            <span class="canopy-seeds">${seeds}</span>
            <span class="canopy-rung-count">${shown}${state === 'locked' ? '' : `/${r.cap}`}</span>
        </div>`;
    }).reverse().join('');
}

// The configuration written out as the player fills it: completed rungs at their
// target, the active rung at its live count (bold), locked rungs hidden.
function liveConfigHtml(): string {
    const parts = rungs.slice(0, rungIndex).map(r => `${r.label}${sup(r.electrons)}`);
    const active = rungs[rungIndex];
    parts.push(`<b>${active.label}${sup(work)}</b>`);
    return parts.join(' ');
}
function liveConfigString(): string {
    const parts = rungs.slice(0, rungIndex).map(r => `${r.label}${sup(r.electrons)}`);
    const active = rungs[rungIndex];
    parts.push(`${active.label}${sup(work)}`);
    return parts.join(' ');
}

function confirmRung(): void {
    const rung = rungs[rungIndex];
    if (work !== rung.electrons) return;           // guard (button is disabled anyway)

    if (rungIndex < rungs.length - 1) {
        rungIndex += 1;                            // advance to the next sublevel
        work = 0;
        chime();
        render();
        return;
    }

    // last rung confirmed -> this totem is fully configured
    attuneTotem(TOTEMS[currentIndex].id);
    chime();
    const next = TOTEMS.findIndex(t => !isTotemAttuned(t.id));
    if (next === -1) {
        if (!isCanopyAttuned()) { markCanopyAttuned(); powerChord(); }
        mode = 'done';
    } else {
        startTotem(next);
    }
    render();
}

// ---- Press-and-hold stepper ---------------------------------------------------
function bindStepper(btn: HTMLElement, doStep: () => void): void {
    let hold: number | undefined;
    let repeat: number | undefined;
    const stop = (): void => {
        if (hold) { clearTimeout(hold); hold = undefined; }
        if (repeat) { clearInterval(repeat); repeat = undefined; }
    };
    btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        doStep();
        hold = window.setTimeout(() => { repeat = window.setInterval(doStep, 110); }, 350);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, stop));
}

// ---- Powered-network summary (all totems configured) --------------------------
function makeSummary(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'canopy-summary';
    const configured = Math.max(attunedTotemCount(), doneCount());
    wrap.innerHTML = `
        <div class="canopy-summary-head">${configured} / ${TOTEMS.length} totems configured</div>
        <div class="canopy-totem-grid">
            ${TOTEMS.map((t: Totem) => {
                const el = getElement(t.id);
                const lit = isTotemAttuned(t.id);
                return `<div class="canopy-totem-card ${lit ? 'lit' : ''}" style="--gem:${t.gem}">
                    <span class="canopy-totem-spirit">${escHtml(t.spirit)}</span>
                    <span class="canopy-totem-sym">${escHtml(el?.symbol ?? '?')}</span>
                    <span class="canopy-totem-cfg">${configStringSup(totemZ(t))}</span>
                </div>`;
            }).join('')}
        </div>`;
    return wrap;
}

// configString with unicode superscripts (the data module's configString already
// does this, but keeping the overlay's own formatter avoids a second import path).
function configStringSup(z: number): string {
    return configFor(z).map(r => `${r.label}${sup(r.electrons)}`).join(' ');
}
