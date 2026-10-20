// The Evolution Lab overlay (opened from the console in the old Power Station).
// Pure DOM, GBA-styled like the quiz/dialog overlays. Three chambers:
//   A) VSEPR Fusion       — pick a molecule, match its bond angle.
//   B) Hyper-Chamber      — expand Sulfur's octet by injecting reagents (SF₄/SF₆);
//                           noble gases / period-2 atoms fizzle (the real lesson).
//   C) Tug-of-War         — classify a binary bond from ΔEN, then find the PE-well
//                           equilibrium distance (ionic salts, an interstitial alloy).
//
// On success we record the product via markEvolved and show it. Product artwork:
// if src/assets/compounds/<id>.png exists it's shown; otherwise a tinted formula
// disc stands in (Justin supplies the art; no code change needed to swap it in).

import GlobalInfo from '../GlobalInfo';
import {
    FUSIONS, HYPERVALENTS, IONICS, FusionRecipe, HyperRecipe, IonicRecipe,
    ANGLE_TOLERANCE, DISTANCE_TOLERANCE, HYPER_CAPABLE,
    missingIngredients, deltaEN, electronegativity,
} from '../data/evolution';
import { getElement } from '../data/elements';
import { elementalArtKey } from '../data/elementalArt';
import { isCaught, markEvolved, isEvolved } from '../data/progress';

let isOpen = false;

const METALS = new Set(['sodium', 'magnesium', 'aluminum', 'iron', 'scandium', 'beryllium', 'uranium']);
function isMetal(id: string): boolean { return METALS.has(id); }

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

function hexColor(tint: number): string {
    return '#' + tint.toString(16).padStart(6, '0');
}

// A reactant/atom sprite: real art if the element has any, else a tinted disc.
function elementSprite(id: string): string {
    const el = getElement(id);
    if (!el) return '';
    if (elementalArtKey(id)) {
        return `<img class="evo-sprite" src="assets/elementals/${id}.png" alt="${el.monster}">`;
    }
    return `<span class="evo-sprite evo-sprite--disc" style="background:${hexColor(el.tint)}">${el.symbol}</span>`;
}

interface Product { id: string; name: string; formula: string; tint: number; geo: string; fact: string; }

export function openEvolveOverlay(onClose?: () => void): void {
    if (isOpen) return;
    isOpen = true;
    setDialogue(true);

    const overlay = document.createElement('div');
    overlay.className = 'quiz-overlay evo-overlay';
    overlay.innerHTML = `
        <div class="quiz-card evo-card">
            <button class="quiz-x" aria-label="Leave the lab">✕</button>
            <div class="evo-body"></div>
        </div>`;
    const body = overlay.querySelector('.evo-body') as HTMLDivElement;

    function close(): void {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        isOpen = false;
        setDialogue(false);
        onClose?.();
    }

    // ---- Screen: chamber select ------------------------------------------
    function renderChambers(): void {
        body.innerHTML = `
            <div class="evo-title">⚛ EVOLUTION LAB</div>
            <div class="evo-sub">Choose an evolution chamber</div>
            <div class="evo-chambers">
                <button class="evo-chamber" data-go="fusion">
                    <span class="evo-chamber-name">VSEPR Fusion</span>
                    <span class="evo-chamber-desc">Bond Elementals into a molecule and shape its geometry.</span>
                    <span class="evo-chamber-status evo-chamber-status--on">▶ ONLINE</span>
                </button>
                <button class="evo-chamber" data-go="hyper">
                    <span class="evo-chamber-name">Hyper-Chamber</span>
                    <span class="evo-chamber-desc">Expand a central atom past its octet with aggressive reagents.</span>
                    <span class="evo-chamber-status evo-chamber-status--on">▶ ONLINE</span>
                </button>
                <button class="evo-chamber" data-go="tug">
                    <span class="evo-chamber-name">Periodic Tug-of-War</span>
                    <span class="evo-chamber-desc">Weigh ΔEN to lock two Elementals into a compound.</span>
                    <span class="evo-chamber-status evo-chamber-status--on">▶ ONLINE</span>
                </button>
            </div>`;
        const go: Record<string, () => void> = {
            fusion: renderFusionSelect, hyper: renderHyperCores, tug: renderTugSelect,
        };
        body.querySelectorAll('[data-go]').forEach(b =>
            b.addEventListener('click', () => go[(b as HTMLElement).dataset.go!]()));
    }

    // ---- Shared success screen -------------------------------------------
    function renderSuccess(p: Product, back: () => void): void {
        body.innerHTML = `
            <div class="evo-success">
                <div class="evo-form-disc" style="background:${hexColor(p.tint)}">
                    <span class="evo-form-label">${p.formula}</span>
                </div>
                <div class="evo-done-title">EVOLUTION COMPLETE!</div>
                <div class="evo-done-name">${p.name} <span class="evo-done-formula">(${p.formula})</span></div>
                <div class="evo-done-geo">${p.geo}</div>
                <div class="evo-fact">${p.fact}</div>
                <div class="evo-note">Added to your collection — final artwork coming soon.</div>
            </div>
            <div class="evo-actions">
                <button class="evo-back">⚗ Make another</button>
                <button class="evo-fuse" data-done="1">Done ▶</button>
            </div>`;
        // Swap in supplied art if it exists (onload only — no broken-image flash).
        const disc = body.querySelector('.evo-form-disc') as HTMLElement;
        const img = new Image();
        img.className = 'evo-form-img';
        img.alt = p.name;
        img.onload = () => disc.appendChild(img);
        img.src = `assets/compounds/${p.id}.png`;

        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', back);
        (body.querySelector('[data-done="1"]') as HTMLButtonElement).addEventListener('click', close);
    }

    // Footer row: a Back button (each caller wires its own .evo-back click) plus an
    // optional primary button (the fuse / commit / lock action).
    function actions(primaryHTML?: string): string {
        return `<div class="evo-actions">
            <button class="evo-back">◀ Back</button>
            ${primaryHTML ?? ''}
        </div>`;
    }

    // ================= Chamber A: VSEPR Fusion ============================
    function renderFusionSelect(): void {
        const items = FUSIONS.map(c => {
            const chips = c.ingredients.map(r => {
                const have = isCaught(r.id);
                const el = getElement(r.id);
                return `<span class="evo-chip ${have ? 'evo-chip--have' : 'evo-chip--need'}">
                    ${elementSprite(r.id)}<span class="evo-chip-x">×${r.count}</span>
                    <span class="evo-chip-name">${el?.symbol ?? r.id}${have ? ' ✓' : ' ○'}</span></span>`;
            }).join('');
            const made = isEvolved(c.id) ? `<span class="evo-badge">✓ MADE</span>` : '';
            return `<button class="evo-item" data-id="${c.id}">
                <span class="evo-item-head"><span class="evo-item-formula">${c.formula}</span>
                    <span class="evo-item-name">${c.name}</span>${made}</span>
                <span class="evo-chips">${chips}</span></button>`;
        }).join('');
        body.innerHTML = `<div class="evo-title">VSEPR Fusion</div>
            <div class="evo-sub">Pick a molecule to assemble. ✓ = you've caught it.</div>
            <div class="evo-list">${items}</div>${actions()}`;
        wireList(renderFusion, FUSIONS);
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderChambers);
    }

    function renderFusion(recipe: FusionRecipe): void {
        const target = recipe.bondAngle;
        let angle = target >= 150 ? 96 : 174;   // start off-target so there's a puzzle
        const reactants = recipe.ingredients
            .map(r => `<span class="evo-react">${elementSprite(r.id)}<span class="evo-chip-x">×${r.count}</span></span>`)
            .join('<span class="evo-plus">+</span>');
        const missing = missingIngredients(recipe, isCaught);
        const missNote = missing.length
            ? `<div class="evo-warn">You haven't caught ${missing.map(m => getElement(m)?.monster ?? m).join(' & ')} yet — this run is a practice simulation.</div>` : '';

        body.innerHTML = `
            <div class="evo-arena-head"><span>FUSION ARENA: VSEPR GRID</span>
                <span class="evo-stat">STERIC ${recipe.stericNumber} · ${recipe.hybrid}</span></div>
            <div class="evo-reactants">${reactants}<span class="evo-arrow">▶</span>
                <span class="evo-slot" style="border-color:${hexColor(recipe.tint)}">?</span></div>
            ${missNote}
            <div class="evo-target">Target shape: <b>${recipe.shape}</b> — aim for <b>${target}°</b></div>
            <input class="evo-dial" type="range" min="90" max="180" step="0.5" value="${angle}" aria-label="Bond angle">
            <div class="evo-dialrow">
                <button class="evo-dialbtn" data-d="-0.5">◀</button>
                <span class="evo-readout">BOND ANGLE: <b class="evo-deg">${angle.toFixed(1)}</b>°</span>
                <button class="evo-dialbtn" data-d="0.5">▶</button></div>
            <div class="evo-meter"><span class="evo-meter-fill"></span></div>
            <div class="evo-hint"></div>
            ${actions(`<button class="evo-fuse" disabled>⚡ PUSH TO FUSE</button>`)}`;

        const dial = body.querySelector('.evo-dial') as HTMLInputElement;
        const deg = body.querySelector('.evo-deg') as HTMLElement;
        const fill = body.querySelector('.evo-meter-fill') as HTMLElement;
        const hint = body.querySelector('.evo-hint') as HTMLElement;
        const fuse = body.querySelector('.evo-fuse') as HTMLButtonElement;

        function refresh(): void {
            const diff = angle - target, off = Math.abs(diff);
            deg.textContent = angle.toFixed(1);
            fill.style.width = `${Math.round(Math.max(0, 1 - off / 45) * 100)}%`;
            const locked = off <= ANGLE_TOLERANCE;
            fill.classList.toggle('evo-meter-fill--ok', locked);
            fuse.disabled = !locked;
            hint.textContent = locked ? '● GEOMETRY LOCKED — push to fuse!'
                : (diff < 0 ? '▲ Widen the bond angle…' : '▼ Narrow the bond angle…');
            hint.className = locked ? 'evo-hint evo-hint--ok' : 'evo-hint';
        }
        function setAngle(v: number): void {
            angle = Math.min(180, Math.max(90, Math.round(v * 2) / 2));
            dial.value = String(angle); refresh();
        }
        dial.addEventListener('input', () => setAngle(parseFloat(dial.value)));
        body.querySelectorAll('.evo-dialbtn').forEach(b =>
            b.addEventListener('click', () => setAngle(angle + parseFloat((b as HTMLElement).dataset.d!))));
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderFusionSelect);
        fuse.addEventListener('click', () => {
            if (Math.abs(angle - target) > ANGLE_TOLERANCE) return;
            markEvolved(recipe.id);
            renderSuccess({ id: recipe.id, name: recipe.name, formula: recipe.formula, tint: recipe.tint,
                geo: `${recipe.shape} · ${recipe.hybrid} · ${recipe.bondAngle}°`, fact: recipe.fact }, renderFusionSelect);
        });
        refresh();
    }

    // ================= Chamber B: Hyper-Chamber ==========================
    // Offer a few cores; only period-3+ (Sulfur) can expand — the rest fizzle.
    const HYPER_CORES = ['sulfur', 'helium', 'neon', 'oxygen'];

    function renderHyperCores(): void {
        const items = HYPER_CORES.map(id => {
            const el = getElement(id);
            const ok = HYPER_CAPABLE.has(id);
            return `<button class="evo-item" data-core="${id}">
                <span class="evo-item-head">${elementSprite(id)}
                    <span class="evo-item-formula">${el?.symbol ?? id}</span>
                    <span class="evo-item-name">${el?.name ?? id}</span>
                    <span class="evo-badge ${ok ? '' : 'evo-badge--no'}">${ok ? 'expandable' : 'octet-locked'}</span></span>
            </button>`;
        }).join('');
        body.innerHTML = `<div class="evo-title">Hyper-Chamber</div>
            <div class="evo-sub">Pick a central atom to hyper-charge. Only period-3+ atoms can exceed an octet.</div>
            <div class="evo-list">${items}</div>${actions()}`;
        body.querySelectorAll('[data-core]').forEach(b =>
            b.addEventListener('click', () => {
                const id = (b as HTMLElement).dataset.core!;
                HYPER_CAPABLE.has(id) ? renderHyperProducts() : renderFizzle(id);
            }));
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderChambers);
    }

    function renderFizzle(id: string): void {
        const el = getElement(id);
        const noble = id === 'helium' || id === 'neon';
        const why = noble
            ? `${el?.name} is a noble gas — already a full, stable shell with no accessible d-orbitals. It won't expand its octet, so no hypervalent form exists.`
            : `${el?.name} is a period-2 atom: only 2s and 2p orbitals, capped at an octet (8 electrons). It can't go hypervalent.`;
        body.innerHTML = `<div class="evo-title">Reaction fizzles…</div>
            <div class="evo-fizzle">${elementSprite(id)}<div class="evo-fizzle-why">${why}</div></div>
            <div class="evo-target">Try <b>Sulfur</b> — a period-3 atom that <i>can</i> expand.</div>
            ${actions()}`;
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderHyperCores);
    }

    function renderHyperProducts(): void {
        const items = HYPERVALENTS.map(h => {
            const made = isEvolved(h.id) ? `<span class="evo-badge">✓ MADE</span>` : '';
            return `<button class="evo-item" data-id="${h.id}">
                <span class="evo-item-head"><span class="evo-item-formula">${h.formula}</span>
                    <span class="evo-item-name">${h.name} · ${h.shape}</span>${made}</span>
                <span class="evo-chips"><span class="evo-chip evo-chip--have">${elementSprite(h.center)} core</span>
                    <span class="evo-chip">+ ${h.bonds}× ${getElement(h.reagent)?.symbol}</span>
                    <span class="evo-chip">target ${h.electrons} e⁻</span></span></button>`;
        }).join('');
        body.innerHTML = `<div class="evo-title">Sulfur — expanded octet</div>
            <div class="evo-sub">Pick a hypervalent target, then inject reagents to hit its electron count.</div>
            <div class="evo-list">${items}</div>${actions()}`;
        wireList(renderHyperInject, HYPERVALENTS);
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderHyperCores);
    }

    function renderHyperInject(recipe: HyperRecipe): void {
        let bonds = 0;                          // reagents injected so far
        // Electrons around the core: anchored to the recipe so each injected bond adds
        // 2 and the target (recipe.electrons) is hit at exactly recipe.bonds bonds.
        const electrons = (): number => recipe.electrons - (recipe.bonds - bonds) * 2;
        const reagentSym = getElement(recipe.reagent)?.symbol ?? recipe.reagent;

        function draw(): void {
            const e = electrons();
            const injected = Array.from({ length: recipe.bonds }, (_, i) =>
                `<span class="evo-spike ${i < bonds ? 'evo-spike--on' : ''}">${i < bonds ? reagentSym : '·'}</span>`).join('');
            const target = recipe.electrons;
            const atTarget = bonds === recipe.bonds;
            const over = e > target;
            body.innerHTML = `
                <div class="evo-arena-head"><span>HYPER-CHAMBER</span>
                    <span class="evo-stat">${recipe.hybrid} · ${recipe.shape}</span></div>
                <div class="evo-reactants"><span class="evo-react evo-react--core">${elementSprite(recipe.center)}</span>
                    <span class="evo-spikes">${injected}</span></div>
                <div class="evo-target">Central-atom electrons: <b class="evo-deg">${e}</b> / ${target}
                    &nbsp;(octet = 8)</div>
                <div class="evo-meter"><span class="evo-meter-fill ${atTarget ? 'evo-meter-fill--ok' : ''}"
                    style="width:${Math.round(Math.min(1, e / target) * 100)}%"></span></div>
                <div class="evo-hint ${atTarget ? 'evo-hint--ok' : ''}">${
                    atTarget ? '● EXPANDED OCTET REACHED — commit the structure!'
                    : over ? '▼ Too many — remove a reagent.'
                    : `▲ Inject ${reagentSym} to expand past the octet…`}</div>
                <div class="evo-injectrow">
                    <button class="evo-dialbtn" data-inj="-1" ${bonds <= 0 ? 'disabled' : ''}>− remove</button>
                    <button class="evo-dialbtn" data-inj="1" ${bonds >= recipe.bonds ? 'disabled' : ''}>inject ${reagentSym} +</button>
                </div>
                ${actions(`<button class="evo-fuse" ${atTarget ? '' : 'disabled'}>⚡ COMMIT</button>`)}`;

            body.querySelectorAll('[data-inj]').forEach(b =>
                b.addEventListener('click', () => {
                    bonds = Math.max(0, Math.min(recipe.bonds, bonds + parseInt((b as HTMLElement).dataset.inj!, 10)));
                    draw();
                }));
            (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderHyperProducts);
            const fuse = body.querySelector('.evo-fuse') as HTMLButtonElement | null;
            fuse?.addEventListener('click', () => {
                if (bonds !== recipe.bonds) return;
                markEvolved(recipe.id);
                renderSuccess({ id: recipe.id, name: recipe.name, formula: recipe.formula, tint: recipe.tint,
                    geo: `${recipe.shape} · ${recipe.hybrid} · ${recipe.electrons} e⁻`, fact: recipe.fact }, renderHyperProducts);
            });
        }
        draw();
    }

    // ================= Chamber C: Tug-of-War =============================
    function renderTugSelect(): void {
        const items = IONICS.map(r => {
            const made = isEvolved(r.id) ? `<span class="evo-badge">✓ MADE</span>` : '';
            const pair = `<span class="evo-chip evo-chip--have">${elementSprite(r.a)} ${getElement(r.a)?.symbol}</span>
                <span class="evo-plus">+</span>
                <span class="evo-chip evo-chip--have">${elementSprite(r.b)} ${getElement(r.b)?.symbol}</span>`;
            return `<button class="evo-item" data-id="${r.id}">
                <span class="evo-item-head"><span class="evo-item-formula">${r.formula}</span>
                    <span class="evo-item-name">${r.name}</span>${made}</span>
                <span class="evo-chips">${pair}</span></button>`;
        }).join('');
        body.innerHTML = `<div class="evo-title">Periodic Tug-of-War</div>
            <div class="evo-sub">Pick a compound. Classify the bond, then find its equilibrium.</div>
            <div class="evo-list">${items}</div>${actions()}`;
        wireList(renderTugClassify, IONICS);
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderChambers);
    }

    function renderTugClassify(recipe: IonicRecipe): void {
        const dEN = deltaEN(recipe);
        const ena = electronegativity(recipe.a), enb = electronegativity(recipe.b);
        const opts: string[] = ['Ionic', 'Polar covalent', 'Nonpolar covalent', 'Interstitial alloy'];
        body.innerHTML = `
            <div class="evo-arena-head"><span>COULOMBIC BALANCE</span>
                <span class="evo-stat">${recipe.formula}</span></div>
            <div class="evo-en">
                <span class="evo-en-side">${elementSprite(recipe.a)}<b>${getElement(recipe.a)?.symbol}</b>
                    <span class="evo-en-val">EN ${ena ?? '—'}</span><span class="evo-en-tag">${isMetal(recipe.a) ? 'metal' : 'nonmetal'}</span></span>
                <span class="evo-en-mid">ΔEN<br><b>${dEN !== undefined ? dEN.toFixed(2) : '—'}</b></span>
                <span class="evo-en-side">${elementSprite(recipe.b)}<b>${getElement(recipe.b)?.symbol}</b>
                    <span class="evo-en-val">EN ${enb ?? '—'}</span><span class="evo-en-tag">${isMetal(recipe.b) ? 'metal' : 'nonmetal'}</span></span>
            </div>
            <div class="evo-target">What kind of bond forms?</div>
            <div class="evo-choices">${opts.map(o => `<button class="evo-choice" data-o="${o}">${o}</button>`).join('')}</div>
            <div class="evo-hint"></div>
            ${actions()}`;
        const hint = body.querySelector('.evo-hint') as HTMLElement;
        body.querySelectorAll('.evo-choice').forEach(b =>
            b.addEventListener('click', () => {
                const pick = (b as HTMLElement).dataset.o!;
                if (pick === recipe.bondType) {
                    hint.textContent = `● Correct — ${recipe.bondType}. Now find the equilibrium.`;
                    hint.className = 'evo-hint evo-hint--ok';
                    body.querySelectorAll('.evo-choice').forEach(x => ((x as HTMLButtonElement).disabled = true));
                    (b as HTMLElement).classList.add('evo-choice--ok');
                    setTimeout(() => renderTugDistance(recipe), 650);
                } else {
                    hint.textContent = dENHint(dEN, recipe.bondType);
                    hint.className = 'evo-hint';
                    (b as HTMLElement).classList.add('evo-choice--no');
                }
            }));
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderTugSelect);
    }

    function dENHint(dEN: number | undefined, answer: string): string {
        if (answer === 'Interstitial alloy') return 'Hint: a metal host with small atoms wedged in its lattice.';
        if (dEN === undefined) return 'Hint: compare their electronegativities.';
        if (dEN >= 1.7) return `Hint: ΔEN ${dEN.toFixed(2)} ≥ 1.7 — electrons are handed over.`;
        if (dEN >= 0.4) return `Hint: 0.4 ≤ ΔEN ${dEN.toFixed(2)} < 1.7 — shared unequally.`;
        return `Hint: ΔEN ${dEN.toFixed(2)} < 0.4 — shared about evenly.`;
    }

    function renderTugDistance(recipe: IonicRecipe): void {
        const req = recipe.bondLengthPm;
        let r = req > 250 ? 130 : 360;      // start away from the well
        const pe = (rr: number): number => { const x = req / rr; return Math.round(400 * (x * x - 2 * x)); };

        body.innerHTML = `
            <div class="evo-arena-head"><span>ENERGY DISTANCE (r)</span>
                <span class="evo-stat">${recipe.bondType}</span></div>
            <div class="evo-target">Slide to the bottom of the potential-energy well (the bond length).</div>
            <input class="evo-dial" type="range" min="100" max="400" step="1" value="${r}" aria-label="Internuclear distance">
            <div class="evo-dialrow">
                <button class="evo-dialbtn" data-d="-1">◀</button>
                <span class="evo-readout">r = <b class="evo-deg">${r}</b> pm &nbsp;·&nbsp; PE <b class="evo-pe">${pe(r)}</b> kJ/mol</span>
                <button class="evo-dialbtn" data-d="1">▶</button></div>
            <div class="evo-meter"><span class="evo-meter-fill"></span></div>
            <div class="evo-hint"></div>
            ${actions(`<button class="evo-fuse" disabled>⚡ LOCK BOND</button>`)}`;

        const dial = body.querySelector('.evo-dial') as HTMLInputElement;
        const rEl = body.querySelector('.evo-deg') as HTMLElement;
        const peEl = body.querySelector('.evo-pe') as HTMLElement;
        const fill = body.querySelector('.evo-meter-fill') as HTMLElement;
        const hint = body.querySelector('.evo-hint') as HTMLElement;
        const lock = body.querySelector('.evo-fuse') as HTMLButtonElement;

        function refresh(): void {
            const off = Math.abs(r - req);
            rEl.textContent = String(r);
            peEl.textContent = String(pe(r));
            fill.style.width = `${Math.round(Math.max(0, 1 - off / 120) * 100)}%`;
            const locked = off <= DISTANCE_TOLERANCE;
            fill.classList.toggle('evo-meter-fill--ok', locked);
            lock.disabled = !locked;
            hint.textContent = locked ? '● EQUILIBRIUM — lock the bond!'
                : (r < req ? '▲ Too close — repulsion spikes.' : '▼ Too far — attraction is weak.');
            hint.className = locked ? 'evo-hint evo-hint--ok' : 'evo-hint';
        }
        function setR(v: number): void { r = Math.min(400, Math.max(100, Math.round(v))); dial.value = String(r); refresh(); }
        dial.addEventListener('input', () => setR(parseFloat(dial.value)));
        body.querySelectorAll('.evo-dialbtn').forEach(b =>
            b.addEventListener('click', () => setR(r + parseFloat((b as HTMLElement).dataset.d!))));
        (body.querySelector('.evo-back') as HTMLButtonElement).addEventListener('click', renderTugSelect);
        lock.addEventListener('click', () => {
            if (Math.abs(r - req) > DISTANCE_TOLERANCE) return;
            markEvolved(recipe.id);
            const dEN = deltaEN(recipe);
            renderSuccess({ id: recipe.id, name: recipe.name, formula: recipe.formula, tint: recipe.tint,
                geo: `${recipe.bondType}${dEN !== undefined ? ` · ΔEN ${dEN.toFixed(2)}` : ''} · ${req} pm`, fact: recipe.fact }, renderTugSelect);
        });
        refresh();
    }

    // ---- shared: wire a list of .evo-item[data-id] to a render fn ---------
    function wireList<T extends { id: string }>(go: (recipe: T) => void, pool: T[]): void {
        body.querySelectorAll('.evo-item[data-id]').forEach(btn =>
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id!;
                const recipe = pool.find(p => p.id === id);
                if (recipe) go(recipe);
            }));
    }

    function onKey(e: KeyboardEvent): void {
        if (e.key === 'Escape') { close(); e.preventDefault(); }
    }

    (overlay.querySelector('.quiz-x') as HTMLButtonElement).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    renderChambers();
}
