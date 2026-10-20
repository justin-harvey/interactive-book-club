// The Atlantis sanctum's final test — "Crystalline Core Attunement".
//
// A one-crystal-at-a-time forge that drills the whole intro atomic-structure
// syllabus. For each crystal the player works three phases:
//   1. PROTONS   — inject protons until the count equals the atomic number. The
//                  crystal's identity morphs live as protons are added (Z6 = Carbon,
//                  Z7 = Nitrogen ...): protons define identity.
//   2. NEUTRONS  — add neutrons until mass = protons + neutrons matches the stable
//                  isotope. Below/above target the crystal vibrates (decays); dead-on
//                  it goes still.
//   3. ELECTRONS — tune electrons so charge = protons − electrons hits the target ion.
//                  Losing electrons -> positive cation (metals, LEFT); gaining ->
//                  negative anion (non-metals, RIGHT); equal -> neutral.
// Then the finale: link each cation to an anion whose charges cancel to NET ZERO,
// completing the Core's balanced circuit. All balanced -> Enlightenment (persisted,
// rewarded with a secret Isotopedex card, and a hook for a future zone).
//
// Pure DOM (like QuizOverlay / EvolveOverlay / Isotopedex) so it renders crisply on
// a projector or iPad above the Phaser canvas, and it freezes the dog via the shared
// inDialogue flag while open. Steppers add/remove one particle per tap and repeat on
// press-and-hold; the derived formula (identity, mass, charge) is what teaches.

import GlobalInfo from '../GlobalInfo';
import {
    CORE_ELEMENTS, ION_PAIRS, CoreElement,
    neutronsFor, identityForZ, chargeLabel,
} from '../data/resonance';
import { attuneNode, isNodeAttuned, markEnlightened, isEnlightened } from '../data/progress';

let isOpen = false;
let onCloseCb: (() => void) | undefined;
let overlay: HTMLDivElement | null = null;

type Phase = 'protons' | 'neutrons' | 'electrons';
const PHASES: Phase[] = ['protons', 'neutrons', 'electrons'];
const phaseIndex = (p: Phase): number => PHASES.indexOf(p);

// ---- Puzzle state -------------------------------------------------------------
let mode: 'forge' | 'circuit' = 'forge';
let currentIndex = 0;                 // index into CORE_ELEMENTS being forged
let phase: Phase = 'protons';
let work = { p: 0, n: 0, e: 0 };      // working particle counts for the current crystal

// Circuit finale state
let usedIds = new Set<string>();      // ions already linked into the circuit
let linkedPairs = new Set<string>();  // compound labels completed
let selectedCation: string | null = null;
let selectedAnion: string | null = null;
let circuitMsg = '';

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// ---- A soft WebAudio "chime" / "dissonance" (no audio assets needed) ----------
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
function chime(): void { tone(880, 180, 'sine'); tone(1320, 260, 'sine', 0.11); }
function dissonance(): void { tone(150, 220, 'sawtooth', 0, 0.05); }
function enlightenChord(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 900, 'sine', i * 0.09, 0.05));
}

// ---- Open / close -------------------------------------------------------------
export function openResonanceOverlay(onClose?: () => void): void {
    if (isOpen) return;
    isOpen = true;
    onCloseCb = onClose;
    setDialogue(true);
    initState();

    overlay = document.createElement('div');
    overlay.className = 'res-overlay';
    overlay.innerHTML = `
        <div class="res-panel">
            <div class="res-header">
                <span class="res-title">✦ Crystalline Core</span>
                <button class="res-close" aria-label="Leave the sanctum">✕</button>
            </div>
            <p class="res-intro"></p>
            <div class="res-meter" role="progressbar" aria-label="Core resonance" aria-valuemin="0" aria-valuemax="100">
                <div class="res-meter-fill"></div>
                <span class="res-meter-label"></span>
            </div>
            <div class="res-banner" hidden></div>
            <div class="res-body"></div>
        </div>`;

    overlay.querySelector('.res-close')!.addEventListener('click', closeResonanceOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeResonanceOverlay(); });
    document.addEventListener('keydown', onKey);

    render();
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { closeResonanceOverlay(); e.preventDefault(); }
}

export function closeResonanceOverlay(): void {
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
// On open, skip crystals already forged in a previous session and resume at the
// first unforged one; if all are forged, go straight to the circuit finale.
function initState(): void {
    usedIds = new Set();
    linkedPairs = new Set();
    selectedCation = selectedAnion = null;
    circuitMsg = '';

    if (isEnlightened()) {
        mode = 'circuit';
        // Show the finished circuit: every pair already linked.
        ION_PAIRS.forEach(p => { linkedPairs.add(p.compound); usedIds.add(p.cation); usedIds.add(p.anion); });
        return;
    }
    const next = CORE_ELEMENTS.findIndex(e => !isNodeAttuned(e.id));
    if (next === -1) { mode = 'circuit'; return; }
    mode = 'forge';
    startCrystal(next);
}

function startCrystal(index: number): void {
    currentIndex = index;
    phase = 'protons';
    work = { p: 0, n: 0, e: 0 };
}

const forgedCount = (): number => CORE_ELEMENTS.filter(e => isNodeAttuned(e.id)).length;

// Resonance %: each forged crystal and each linked pair is one unit; while forging,
// completed phases of the current crystal count as thirds for a live-feeling meter.
function resonancePct(): number {
    const total = CORE_ELEMENTS.length + ION_PAIRS.length;
    let done = forgedCount() + linkedPairs.size;
    if (mode === 'forge') done += phaseIndex(phase) / 3;
    return Math.round((done / total) * 100);
}

// ---- Top-level render (shell: intro, meter, banner, body) ---------------------
function render(): void {
    if (!overlay) return;
    const done = isEnlightened();

    const intro = overlay.querySelector('.res-intro') as HTMLElement;
    intro.innerHTML = mode === 'forge'
        ? `Restore the Giza Core. Forge each crystal from its particles: <b>protons</b> set its
           identity, <b>neutrons</b> stabilize its mass, <b>electrons</b> set its charge.`
        : `Every crystal is forged. Complete the circuit: link each <b>cation</b> to an <b>anion</b>
           whose charges cancel to <b>net zero</b>.`;

    const pct = resonancePct();
    const fill = overlay.querySelector('.res-meter-fill') as HTMLElement;
    const label = overlay.querySelector('.res-meter-label') as HTMLElement;
    const meter = overlay.querySelector('.res-meter') as HTMLElement;
    fill.style.width = `${pct}%`;
    label.textContent = `Core resonance ${pct}%`;
    meter.setAttribute('aria-valuenow', String(pct));
    meter.classList.toggle('full', done);

    const banner = overlay.querySelector('.res-banner') as HTMLElement;
    if (done) {
        banner.hidden = false;
        banner.innerHTML = `✦ ENLIGHTENMENT ✦<br>
            <span>The Core resonates in perfect balance — net charge zero across the grid.
            The path to the next realm opens, and the Giza Core is added to your Isotopedex.</span>`;
    } else {
        banner.hidden = true;
    }

    const body = overlay.querySelector('.res-body') as HTMLElement;
    body.innerHTML = '';
    if (mode === 'forge') body.appendChild(makeForge());
    else body.appendChild(makeCircuit());
}

// ---- Forge (one crystal, three phases) ----------------------------------------
function makeForge(): HTMLElement {
    const el = CORE_ELEMENTS[currentIndex];
    const wrap = document.createElement('div');
    wrap.className = 'res-forge';

    const tracker = PHASES.map((p, i) => {
        const state = p === phase ? 'active' : (i < phaseIndex(phase) ? 'done' : 'todo');
        const nameCap = { protons: 'Protons', neutrons: 'Neutrons', electrons: 'Electrons' }[p];
        return `<span class="res-step-pill res-${state}">${i + 1} ${nameCap}</span>`;
    }).join('<span class="res-step-sep">›</span>');

    wrap.innerHTML = `
        <div class="res-forge-head">
            <span class="res-forge-count">Crystal ${forgedCount() + 1} of ${CORE_ELEMENTS.length}</span>
            <div class="res-tracker">${tracker}</div>
        </div>
        <div class="res-forge-main">
            <div class="res-tile" style="--gem:${el.gem}">
                <div class="res-tile-z"></div>
                <div class="res-tile-sym"></div>
                <div class="res-tile-name"></div>
                <div class="res-tile-mass"></div>
                <div class="res-tile-charge" hidden></div>
            </div>
            <div class="res-phase-body">
                <div class="res-instruct"></div>
                <div class="res-readout"></div>
                <div class="res-stepper">
                    <button class="res-step res-minus" type="button" aria-label="remove one">−</button>
                    <span class="res-count"></span>
                    <button class="res-step res-plus" type="button" aria-label="add one">＋</button>
                </div>
                <div class="res-status" role="status" aria-live="polite"></div>
                <div class="res-why"></div>
                <button class="res-primary" type="button" disabled></button>
            </div>
        </div>`;

    const minus = wrap.querySelector('.res-minus') as HTMLButtonElement;
    const plus = wrap.querySelector('.res-plus') as HTMLButtonElement;
    bindStepper(minus, () => step(el, -1));
    bindStepper(plus, () => step(el, +1));
    (wrap.querySelector('.res-primary') as HTMLButtonElement)
        .addEventListener('click', () => confirmPhase(el));

    // Fill the dynamic bits once mounted.
    queueMicrotask(() => refreshForge(el));
    return wrap;
}

function step(el: CoreElement, dir: number): void {
    if (phase === 'protons')      work.p = clamp(work.p + dir, 0, 20);
    else if (phase === 'neutrons') work.n = clamp(work.n + dir, 0, 30);
    else                           work.e = clamp(work.e + dir, 0, el.protons + 5);
    tick();
    refreshForge(el);
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// Update only the dynamic parts of the forge in place (keeps the stepper buttons
// alive so press-and-hold keeps repeating).
function refreshForge(el: CoreElement): void {
    if (!overlay) return;
    const q = (sel: string) => overlay!.querySelector(sel) as HTMLElement;
    const tile = q('.res-tile');
    const tz = q('.res-tile-z'), tsym = q('.res-tile-sym'), tname = q('.res-tile-name');
    const tmass = q('.res-tile-mass'), tchg = q('.res-tile-charge');
    const instruct = q('.res-instruct'), readout = q('.res-readout'), count = q('.res-count');
    const status = q('.res-status'), why = q('.res-why');
    const primary = q('.res-primary') as HTMLButtonElement;

    why.textContent = '';
    tile.classList.remove('res-vibrate', 'res-lit');
    tchg.hidden = true;

    if (phase === 'protons') {
        const id = identityForZ(work.p);
        instruct.innerHTML = `<b>Protons</b> set the element's identity. Inject protons until the
            atomic number equals <b>${el.protons}</b> (that makes ${escHtml(el.name)}).`;
        readout.innerHTML = `atomic number = protons &nbsp;→&nbsp; <b>Z = ${work.p}</b>`;
        count.textContent = String(work.p);
        tz.textContent = String(work.p);
        tsym.textContent = id ? id.symbol : '?';
        tname.textContent = id ? id.name : 'no element';
        tmass.textContent = `mass ${el.mass}`;
        const ok = work.p === el.protons;
        if (work.p === 0) status.textContent = 'Inject protons to give the crystal an identity.';
        else if (ok) { status.innerHTML = `✓ Identity locked: <b>${escHtml(el.name)}</b> (Z ${el.protons}).`; tile.classList.add('res-lit'); }
        else if (work.p < el.protons) status.innerHTML = `Z ${work.p} → ${escHtml(id?.name ?? '?')}. Keep going to ${escHtml(el.name)} (Z ${el.protons}).`;
        else status.innerHTML = `Z ${work.p} → ${escHtml(id?.name ?? 'unknown')} — too many. ${escHtml(el.name)} is Z ${el.protons}.`;
        primary.disabled = !ok;
        primary.textContent = 'Anchor identity ▸';
        return;
    }

    // protons are locked from here on — show the true element
    tz.textContent = String(el.protons);
    tsym.textContent = el.symbol;
    tname.textContent = el.name;

    if (phase === 'neutrons') {
        const targetN = neutronsFor(el);
        const massNow = el.protons + work.n;
        instruct.innerHTML = `<b>Neutrons</b> set the isotope. Add neutrons until
            mass = protons + neutrons = <b>${el.mass}</b>.`;
        readout.innerHTML = `mass = protons + neutrons = ${el.protons} + <b>${work.n}</b> = <b>${massNow}</b>`;
        count.textContent = String(work.n);
        tmass.textContent = `mass ${massNow}`;
        const ok = work.n === targetN;
        if (ok) { status.innerHTML = `✓ Stable isotope: mass <b>${el.mass}</b>.`; tile.classList.add('res-lit'); }
        else {
            tile.classList.add('res-vibrate');
            status.innerHTML = work.n < targetN
                ? `Mass ${massNow} — too light, the isotope is decaying. Target mass ${el.mass}.`
                : `Mass ${massNow} — too heavy, unstable. Target mass ${el.mass}.`;
        }
        why.innerHTML = `neutrons = mass − protons = ${el.mass} − ${el.protons} = <b>${targetN}</b>`;
        primary.disabled = !ok;
        primary.textContent = 'Stabilize isotope ▸';
        return;
    }

    // electrons phase
    tmass.textContent = `mass ${el.mass}`;
    const chargeNow = el.protons - work.e;
    const targetCharge = el.charge;
    const polWord = chargeNow > 0 ? 'CATION' : chargeNow < 0 ? 'ANION' : 'NEUTRAL';
    instruct.innerHTML = el.polarity === 'neutral'
        ? `<b>Electrons</b> set the charge. Keep electrons equal to protons so the charge stays
           <b>neutral</b> — Carbon shares, it doesn't give or take.`
        : `<b>Electrons</b> set the charge. Tune them until the charge is <b>${chargeLabel(targetCharge)}</b>
           (${el.side} side — ${targetCharge > 0 ? 'lose' : 'gain'} ${Math.abs(targetCharge)} e⁻).`;
    readout.innerHTML = `charge = protons − electrons = ${el.protons} − <b>${work.e}</b> = <b>${chargeLabel(chargeNow)}</b> ${chargeNow !== 0 ? `(${polWord})` : ''}`;
    count.textContent = String(work.e);
    tchg.hidden = false;
    tchg.textContent = chargeLabel(chargeNow);
    tchg.className = `res-tile-charge ${chargeNow > 0 ? 'pos' : chargeNow < 0 ? 'neg' : ''}`;

    const ok = chargeNow === targetCharge;
    if (ok) {
        tile.classList.add('res-lit');
        if (el.polarity === 'neutral') status.innerHTML = `✓ Neutral — equal protons and electrons. The stable heart.`;
        else status.innerHTML = `✓ ${chargeLabel(chargeNow)} ${polWord.toLowerCase()} — ready to link.
            ${targetCharge > 0 ? 'Cations are positive and sit on the LEFT (cats!).' : 'Anions are negative and sit on the RIGHT.'}`;
    } else {
        const verb = targetCharge > 0 ? 'lose' : targetCharge < 0 ? 'gain' : 'keep';
        status.innerHTML = el.polarity === 'neutral'
            ? `Charge ${chargeLabel(chargeNow)} — bring electrons back to ${el.protons} for a neutral atom.`
            : `You're at ${chargeLabel(chargeNow)}. ${escHtml(el.name)} wants ${chargeLabel(targetCharge)} — ${verb} ${Math.abs(targetCharge)} e⁻.`;
    }
    why.textContent = el.why;
    primary.disabled = !ok;
    primary.textContent = el.polarity === 'neutral' ? 'Set the heart ▸' : 'Harmonize ▸';
}

function confirmPhase(el: CoreElement): void {
    if (phase === 'protons') { phase = 'neutrons'; work.n = 0; chime(); render(); return; }
    if (phase === 'neutrons') { phase = 'electrons'; work.e = el.protons; chime(); render(); return; }
    // electrons confirmed -> crystal fully forged
    attuneNode(el.id);
    chime();
    const next = CORE_ELEMENTS.findIndex(e => !isNodeAttuned(e.id));
    if (next === -1) { mode = 'circuit'; circuitMsg = 'All crystals forged. Now cancel the charges.'; }
    else startCrystal(next);
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
        hold = window.setTimeout(() => { repeat = window.setInterval(doStep, 90); }, 350);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, stop));
}

// ---- Circuit finale (link cations to anions, net charge zero) ------------------
function makeCircuit(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'res-circuit';

    const cations = CORE_ELEMENTS.filter(e => e.polarity === 'cation');
    const anions = CORE_ELEMENTS.filter(e => e.polarity === 'anion');
    const neutral = CORE_ELEMENTS.find(e => e.polarity === 'neutral');

    const chip = (e: CoreElement): string => {
        const used = usedIds.has(e.id);
        const sel = e.id === selectedCation || e.id === selectedAnion;
        return `<button class="res-ion res-${e.polarity} ${used ? 'res-used' : ''} ${sel ? 'res-sel' : ''}"
            type="button" data-id="${e.id}" ${used ? 'disabled' : ''} style="--gem:${e.gem}">
            <span class="res-ion-sym">${escHtml(e.symbol)}</span>
            <span class="res-ion-chg">${chargeLabel(e.charge)}</span>
        </button>`;
    };

    const pairsDone = ION_PAIRS.filter(p => linkedPairs.has(p.compound))
        .map(p => `<span class="res-linked">${escHtml(p.compound)} · net 0 ✓</span>`).join('');

    wrap.innerHTML = `
        <div class="res-circuit-status" role="status" aria-live="polite">${escHtml(circuitMsg || 'Tap a cation (+), then an anion (−) whose charge cancels it.')}</div>
        <div class="res-grid-3">
            <div class="res-col">
                <div class="res-col-head res-cat">CATIONS · left · lose e⁻</div>
                ${cations.map(chip).join('')}
            </div>
            <div class="res-col res-col-core">
                <div class="res-col-head">CORE</div>
                ${neutral ? `<div class="res-ion res-neutral" style="--gem:${neutral.gem}">
                    <span class="res-ion-sym">${escHtml(neutral.symbol)}</span>
                    <span class="res-ion-chg">0</span></div>
                    <div class="res-core-note">neutral heart</div>` : ''}
            </div>
            <div class="res-col">
                <div class="res-col-head res-an">ANIONS · right · gain e⁻</div>
                ${anions.map(chip).join('')}
            </div>
        </div>
        <div class="res-links">${pairsDone}</div>`;

    wrap.querySelectorAll('.res-ion').forEach(btn => {
        const id = (btn as HTMLElement).dataset.id;
        if (!id || usedIds.has(id)) return;
        btn.addEventListener('click', () => onIonTap(id));
    });
    return wrap;
}

function onIonTap(id: string): void {
    const el = CORE_ELEMENTS.find(e => e.id === id);
    if (!el || el.polarity === 'neutral' || usedIds.has(id)) return;

    if (el.polarity === 'cation') selectedCation = (selectedCation === id ? null : id);
    else selectedAnion = (selectedAnion === id ? null : id);

    if (selectedCation && selectedAnion) resolveLink();
    else {
        const picked = selectedCation ?? selectedAnion;
        const pe = picked ? CORE_ELEMENTS.find(e => e.id === picked)! : null;
        circuitMsg = pe
            ? `Selected ${pe.symbol} ${chargeLabel(pe.charge)}. Now tap a ${pe.polarity === 'cation' ? 'anion (−)' : 'cation (+)'} to cancel it.`
            : 'Tap a cation (+), then an anion (−) whose charge cancels it.';
        render();
    }
}

function resolveLink(): void {
    const cat = CORE_ELEMENTS.find(e => e.id === selectedCation)!;
    const an = CORE_ELEMENTS.find(e => e.id === selectedAnion)!;
    const net = cat.charge + an.charge;

    if (net === 0) {
        const pair = ION_PAIRS.find(p => p.cation === cat.id && p.anion === an.id);
        usedIds.add(cat.id); usedIds.add(an.id);
        if (pair) linkedPairs.add(pair.compound);
        chime();
        circuitMsg = pair
            ? `${cat.symbol}${chargeLabel(cat.charge)} + ${an.symbol}${chargeLabel(an.charge)} → ${pair.compound}. ${pair.fact}`
            : `${cat.symbol}${chargeLabel(cat.charge)} + ${an.symbol}${chargeLabel(an.charge)} = net 0 ✓`;
        selectedCation = selectedAnion = null;

        if (linkedPairs.size === ION_PAIRS.length && !isEnlightened()) { markEnlightened(); enlightenChord(); }
        render();
    } else {
        dissonance();
        circuitMsg = `Net charge = ${chargeLabel(cat.charge)} + ${chargeLabel(an.charge)} = ${chargeLabel(net)} ≠ 0. `
            + `Match a +n with a −n so they cancel.`;
        selectedCation = selectedAnion = null;
        render();
        // brief shake on the grid
        const grid = overlay?.querySelector('.res-grid-3') as HTMLElement | null;
        if (grid) { grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake'); }
    }
}
