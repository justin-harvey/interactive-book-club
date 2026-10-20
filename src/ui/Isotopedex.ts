// The Isotopedex: a persistent corner button that opens the student's creature
// collection. Each of the 11 Elementals gets a card whose detail unlocks as it's
// Seen (encountered) then Caught (answered correctly) — see data/progress.ts.
//
// Pure DOM (like QuizOverlay) so it renders crisply on a projector/iPad and sits
// above the Phaser canvas. It lives outside the scenes, so the button persists
// across every room; the overlay is rebuilt on each open to reflect progress.

import GlobalInfo from '../GlobalInfo';
import { ELEMENTS, ElementInfo } from '../data/elements';
import { statusOf, counts, hasItem, MAGIC_KEY, isEnlightened, isCanopyAttuned } from '../data/progress';
import { elementalArtKey } from '../data/elementalArt';
import { elementReleased } from '../data/classConfig';
import {
    currentStudent, pendingVerification, onStudentAuth, signOutStudent,
    registerStudent, loginStudent, resendVerification, refreshVerification, resetStudentPassword,
} from '../data/studentAuth';
import { isFirebaseConfigured } from '../data/firebase';
import { elementalLocation } from '../data/elementalLocations';
import { isRadFinderEquipped, setRadFinderEquipped, getRadTarget, setRadTarget } from './RadFinder';
import { onBodyReady } from './domReady';

const escHtml = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

let overlay: HTMLDivElement | null = null;

// Freeze the dog while the dex is open, via the shared flag the movement +
// proximity systems already watch.
function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// Create the corner button once the DOM is ready. Safe to call at startup.
export function initIsotopedex(): void {
    const mount = (): void => {
        if (document.getElementById('dex-button')) return;   // already mounted
        const btn = document.createElement('button');
        btn.id = 'dex-button';
        btn.className = 'dex-button';
        btn.setAttribute('aria-label', 'Open your Isotopedex');
        btn.title = 'Isotopedex';
        btn.innerHTML = `
            <span class="dex-lens"></span>
            <span class="dex-dots"><i></i><i></i><i></i></span>
            <span class="dex-btn-label">DEX</span>`;
        btn.addEventListener('click', openIsotopedex);
        document.body.appendChild(btn);
    };
    onBodyReady(mount);
    // Keep the account bar in sync if sign-in state changes while the dex is open.
    onStudentAuth(() => { if (overlay) renderAccount(); });
}

export function openIsotopedex(): void {
    if (overlay) return;
    setDialogue(true);

    // Only released Elementals appear in the dex (locked ones stay hidden until
    // their release day), so the total grows over the unit.
    const released = ELEMENTS.filter(el => elementReleased(el.id));
    const c = counts();
    const total = released.length;
    // Bonus secrets (the Magic Key, the attuned Giza Core, the Canopy Key) are not
    // periodic-table Elementals, so they get their own ✦ tally instead of inflating
    // "/N caught".
    const secrets = (hasItem(MAGIC_KEY) ? 1 : 0) + (isEnlightened() ? 1 : 0) + (isCanopyAttuned() ? 1 : 0);
    const secretNote = secrets ? `✦ <b>${secrets}</b> secret${secrets > 1 ? 's' : ''}` : '';
    const countsInner = total === 0
        ? (secrets ? `${secretNote} found` : 'No Elementals released yet')
        : `<b>${c.caught}</b>/${total} caught &nbsp;·&nbsp; <b>${c.seen}</b>/${total} discovered${secrets ? ` &nbsp;·&nbsp; ${secretNote}` : ''}`;

    overlay = document.createElement('div');
    overlay.className = 'dex-overlay';
    overlay.innerHTML = `
        <div class="dex-panel">
            <div class="dex-header">
                <span class="dex-title">Isotopedex</span>
                <span class="dex-counts">${countsInner}</span>
                <button class="dex-close" aria-label="Close">✕</button>
            </div>
            <div class="dex-account"></div>
            <div class="dex-tools"></div>
            <div class="dex-grid"></div>
        </div>`;

    renderTools();
    populateGrid();

    renderAccount();
    overlay.querySelector('.dex-close')!.addEventListener('click', closeIsotopedex);
    // Click the dark backdrop (but not the panel) to close.
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeIsotopedex();
    });

    // Hidden teacher entrance: press and hold the "Isotopedex" title for ~1s to
    // open the teacher portal. Students tap cards, not hold the title, so they
    // won't stumble into it — and it's gated by Google login + the teacher claim
    // anyway. A gold underline fills while holding to signal it's working.
    const title = overlay.querySelector('.dex-title') as HTMLElement;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelHold = (): void => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = undefined; }
        title.classList.remove('holding');
    };
    title.addEventListener('pointerdown', () => {
        title.classList.add('holding');
        holdTimer = setTimeout(() => { window.location.href = 'teacher.html'; }, 1000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
        title.addEventListener(ev, cancelHold));

    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
        closeIsotopedex();
        e.preventDefault();
    }
}

export function closeIsotopedex(): void {
    if (!overlay) return;
    stopVerifyPolling();
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    overlay = null;
    setDialogue(false);
}

// Firebase auth error code -> a sentence a 13-year-old can act on. Raw codes like
// "auth/email-already-in-use" used to be shown verbatim via alert().
function authMessage(err: unknown): string {
    const code = (err && typeof err === 'object' && 'code' in err)
        ? String((err as { code: string }).code) : '';
    switch (code) {
        case 'auth/invalid-email':          return "That email doesn't look right — check for typos.";
        case 'auth/email-already-in-use':   return 'That email already has an account — try Log in.';
        case 'auth/weak-password':          return 'Use a password of at least 6 characters.';
        case 'auth/missing-password':       return 'Enter your password.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':     return "Email and password don't match. Try again, or reset it.";
        case 'auth/user-not-found':         return 'No account for that email yet — tap Sign up.';
        case 'auth/too-many-requests':      return 'Too many tries — wait a minute, then try again.';
        case 'auth/network-request-failed': return 'Network problem — check the Wi-Fi and try again.';
        default:                            return 'Something went wrong — try again in a moment.';
    }
}

// Inline status line inside the account bar (aria-live so it's announced), instead
// of a native alert() that steals focus and can't be styled.
function showAuthMsg(text: string, kind: 'ok' | 'err' | 'info'): void {
    const m = overlay?.querySelector('.dex-auth-msg') as HTMLElement | null;
    if (m) { m.textContent = text; m.className = `dex-auth-msg ${kind}`; }
}

// Run an async auth action with a busy button (disabled + relabelled), surfacing
// any error inline. Mirrors the teacher portal's withBusy so double-taps on slow
// school Wi-Fi can't fire a second sign-up.
async function withBusy(btn: HTMLButtonElement, busyLabel: string, fn: () => Promise<void>): Promise<void> {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    try { await fn(); }
    catch (err) { showAuthMsg(authMessage(err), 'err'); }
    finally { btn.disabled = false; btn.textContent = label; }
}

// While waiting on email verification, auto-check so returning from the mail app
// (window focus) or simply waiting flips the UI to "signed in" with no manual tap —
// verification is the single biggest onboarding drop-off. Only runs while the
// pending view is shown; cleaned up on re-render and on dex close.
let verifyPoll: ReturnType<typeof setInterval> | undefined;
let verifyOnFocus: (() => void) | undefined;
function stopVerifyPolling(): void {
    if (verifyPoll) { clearInterval(verifyPoll); verifyPoll = undefined; }
    if (verifyOnFocus) { window.removeEventListener('focus', verifyOnFocus); verifyOnFocus = undefined; }
}
function startVerifyPolling(): void {
    stopVerifyPolling();
    const check = (): void => { void refreshVerification(); };   // flips to verified via emit -> re-render
    verifyPoll = setInterval(check, 5000);
    verifyOnFocus = check;
    window.addEventListener('focus', verifyOnFocus);
}

// The account bar in the dex header: guest vs signed-in student, with a
// sign-in / sign-out button. Re-rendered on auth changes while the dex is open.
function renderAccount(): void {
    if (!overlay) return;
    stopVerifyPolling();                 // (re)started only while the pending view shows
    const host = overlay.querySelector('.dex-account') as HTMLElement | null;
    if (!host) return;
    // Offline build (no Firebase): no sign-in, just say progress is local.
    if (!isFirebaseConfigured()) {
        host.innerHTML = `<span class="dex-acct-label">Progress saves on this device.</span>`;
        return;
    }
    const u = currentStudent();
    const p = pendingVerification();

    // Signed in and verified — progress is syncing.
    if (u) {
        host.innerHTML = `<span class="dex-acct-label">Saving as <b>${escHtml(u.email || u.displayName || 'you')}</b></span>
            <button class="dex-auth-btn" id="dex-signout">Sign out</button>`;
        (host.querySelector('#dex-signout') as HTMLButtonElement)
            .addEventListener('click', () => { void signOutStudent(); });
        return;
    }

    // Signed in but the email link hasn't been clicked yet.
    if (p) {
        host.innerHTML = `<span class="dex-acct-label">Check <b>${escHtml(p.email || 'your email')}</b> for a
            verification link — we'll sign you in automatically once you tap it.</span>
            <button class="dex-auth-btn" id="dex-verified">I'm verified</button>
            <button class="dex-auth-btn" id="dex-resend">Resend</button>
            <button class="dex-auth-btn" id="dex-signout">Cancel</button>
            <div class="dex-auth-msg info" role="status" aria-live="polite">Waiting for you to click the link…</div>`;
        const verifiedBtn = host.querySelector('#dex-verified') as HTMLButtonElement;
        verifiedBtn.addEventListener('click', () => {
            void withBusy(verifiedBtn, 'Checking…', async () => {
                const ok = await refreshVerification();
                if (!ok) showAuthMsg("Not verified yet — click the link in your email, then try again.", 'err');
            });
        });
        const resendBtn = host.querySelector('#dex-resend') as HTMLButtonElement;
        resendBtn.addEventListener('click', () => {
            void withBusy(resendBtn, 'Sending…', async () => {
                await resendVerification();
                showAuthMsg('Verification email sent. Check your inbox (and spam).', 'ok');
            });
        });
        (host.querySelector('#dex-signout') as HTMLButtonElement)
            .addEventListener('click', () => { void signOutStudent(); });
        startVerifyPolling();
        return;
    }

    // Guest — offer sign up / log in.
    host.innerHTML = `<span class="dex-acct-label">Playing as <b>guest</b> — saved on this device only.</span>
        <form class="dex-auth-form" id="dex-auth-form">
            <input type="email" id="dex-email" placeholder="email" autocomplete="email"
                inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false"
                aria-label="Email" required>
            <input type="password" id="dex-pass" placeholder="password (6+)" autocomplete="current-password"
                aria-label="Password" required minlength="6">
            <button type="submit" class="dex-auth-btn" id="dex-login">Log in</button>
            <button type="button" class="dex-auth-btn" id="dex-signup">Sign up</button>
            <button type="button" class="dex-auth-link" id="dex-reset">Forgot password?</button>
        </form>
        <div class="dex-auth-msg" role="status" aria-live="polite"></div>`;
    const email = (): string => (host.querySelector('#dex-email') as HTMLInputElement).value;
    const pass = (): string => (host.querySelector('#dex-pass') as HTMLInputElement).value;
    const loginBtn = host.querySelector('#dex-login') as HTMLButtonElement;
    (host.querySelector('#dex-auth-form') as HTMLFormElement)
        .addEventListener('submit', (e) => {
            e.preventDefault();
            void withBusy(loginBtn, 'Logging in…', () => loginStudent(email(), pass()));
        });
    const signupBtn = host.querySelector('#dex-signup') as HTMLButtonElement;
    signupBtn.addEventListener('click', () => {
        if (!email() || pass().length < 6) {
            showAuthMsg('Enter an email and a password of at least 6 characters.', 'err');
            return;
        }
        // On success, onStudentAuth flips us to the pending view with next steps.
        void withBusy(signupBtn, 'Creating…', () => registerStudent(email(), pass()));
    });
    const resetBtn = host.querySelector('#dex-reset') as HTMLButtonElement;
    resetBtn.addEventListener('click', () => {
        if (!email()) { showAuthMsg('Type your email above first, then tap Forgot password.', 'err'); return; }
        void withBusy(resetBtn, 'Sending…', async () => {
            await resetStudentPassword(email());
            showAuthMsg('Password reset email sent. Check your inbox.', 'ok');
        });
    });
}

// The tools row: currently just the Rad Finder — a Geiger counter students can
// equip any time to home in on undiscovered Elementals (an in-game meter) and see
// where each one lives (location hints on the cards below). So nobody gets stuck.
function renderTools(): void {
    if (!overlay) return;
    const host = overlay.querySelector('.dex-tools') as HTMLElement | null;
    if (!host) return;
    const on = isRadFinderEquipped();
    host.innerHTML = `
        <span class="dex-tools-label">Tools</span>
        <button class="dex-tool${on ? ' on' : ''}" id="tool-rad" aria-pressed="${on}">
            <span class="dex-tool-ico">⚛</span> Rad Finder
            <span class="dex-tool-state">${on ? 'ON' : 'OFF'}</span>
        </button>
        <span class="dex-tools-hint">${on
            ? 'On — tap Track on any card to point the arrow at it.'
            : 'Equip, then Track a card to get an arrow to it.'}</span>`;
    (host.querySelector('#tool-rad') as HTMLButtonElement)
        .addEventListener('click', () => {
            setRadFinderEquipped(!isRadFinderEquipped());
            renderTools();
            populateGrid();     // reveal / hide the location hints
        });
}

// (Re)build the card grid. Only released Elementals appear; the Rad Finder adds a
// location hint to every not-yet-caught card.
function populateGrid(): void {
    if (!overlay) return;
    const grid = overlay.querySelector('.dex-grid') as HTMLDivElement | null;
    if (!grid) return;
    grid.innerHTML = '';
    const released = ELEMENTS.filter(el => elementReleased(el.id))
        .sort((a, b) => a.number - b.number);
    const hasKey = hasItem(MAGIC_KEY);
    const enlightened = isEnlightened();
    if (released.length === 0 && !hasKey && !enlightened) {
        // Paced-release day-0 (or before the first unlock): no empty grid — say why.
        const empty = document.createElement('div');
        empty.className = 'dex-empty';
        empty.innerHTML = 'No Elementals have appeared yet.<br>Check back after your teacher releases them!';
        grid.appendChild(empty);
        return;
    }
    released.forEach(el => grid.appendChild(makeCard(el)));
    // Bonus secret cards after the Elementals (not part of the periodic-table roster):
    // the Magic Key from the forest chest, and the Giza Core once the sanctum is attuned.
    if (hasKey) grid.appendChild(makeMagicKeyCard());
    if (enlightened) grid.appendChild(makeEnlightenmentCard());
    if (isCanopyAttuned()) grid.appendChild(makeCanopyKeyCard());
}

// One creature card. Unseen → dark silhouette + "???"; seen/caught reveal the
// art, names and atomic-structure facts. Caught gets a gold ✓ badge. With the
// Rad Finder equipped, not-yet-caught cards also show where to find them.
function makeCard(el: ElementInfo): HTMLDivElement {
    const status = statusOf(el.id);
    const known = status !== 'unseen';

    const card = document.createElement('div');
    card.className = `dex-card dex-${status}`;

    // Portrait: real art if the Elemental has a PNG, otherwise a tinted disc
    // showing its symbol. CSS silhouettes either one while it's unseen.
    // Meaningful alt text for screen readers (hidden creatures stay hidden).
    const alt = known ? `${el.monster}, the ${el.name} Elemental` : 'Undiscovered Elemental';
    const artKey = elementalArtKey(el.id);
    const portrait = artKey
        ? `<img class="dex-art" src="assets/elementals/${el.id}.png" alt="${alt}">`
        : `<div class="dex-art dex-art-disc" style="--tint:#${el.tint.toString(16).padStart(6, '0')}" role="img" aria-label="${alt}">${el.symbol}</div>`;

    const badge =
        status === 'caught' ? `<div class="dex-badge caught">✓ Caught</div>`
        : status === 'seen' ? `<div class="dex-badge seen">Seen</div>`
        : `<div class="dex-badge locked">Undiscovered</div>`;

    const locLine = (isRadFinderEquipped() && status !== 'caught')
        ? `<div class="dex-loc">📍 ${escHtml(elementalLocation(el.id))}</div>` : '';

    // Uncaught cards can be "tracked": the Rad Finder points its arrow at the one
    // you pick, so you can go find the exact Elemental you're still missing.
    const tracked = getRadTarget() === el.id;
    const canTrack = status !== 'caught';
    if (tracked) card.classList.add('tracking');
    const trackBtn = canTrack
        ? `<button class="dex-track${tracked ? ' on' : ''}">${tracked ? '◎ Tracking' : '⌖ Track'}</button>`
        : '';

    card.innerHTML = `
        <div class="dex-num">#${el.number}</div>
        <div class="dex-portrait">${portrait}</div>
        <div class="dex-name">${known ? el.monster : '???'}</div>
        <div class="dex-el">${known ? `${el.symbol} · ${el.name}` : '— — —'}</div>
        <div class="dex-stats">${known
            ? `Atomic #${el.number}<br>Protons ${el.number} · Electrons ${el.number}`
            : 'Find and meet it to reveal!'}</div>
        ${locLine}
        ${badge}
        ${trackBtn}`;

    if (canTrack) {
        (card.querySelector('.dex-track') as HTMLButtonElement).addEventListener('click', () => {
            if (getRadTarget() === el.id) {
                setRadTarget(null);        // untrack — stay in the dex
                populateGrid();
                return;
            }
            setRadTarget(el.id);           // track this one…
            if (!isRadFinderEquipped()) setRadFinderEquipped(true);
            closeIsotopedex();             // …and close so the arrow can guide you there
        });
    }
    return card;
}

// The Magic Key is not an Elemental, but once the student loots the forest chest
// (hasItem(MAGIC_KEY)) it earns a card here like a caught creature: gold, with a
// star marker and flavor text in place of atomic stats. It is a bonus secret and
// never counts toward the "/N caught" element tally.
function makeMagicKeyCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'dex-card dex-caught dex-special';
    card.innerHTML = `
        <div class="dex-num">✦</div>
        <div class="dex-portrait">
            <img class="dex-art" src="assets/items/magic-key.png" alt="The Magic Key, a secret treasure">
        </div>
        <div class="dex-name">Magic Key</div>
        <div class="dex-el">Secret Treasure</div>
        <div class="dex-stats">A mysterious key etched with elements and a bubbling flask.<br>Said to open a passage sealed beneath the Museum.</div>
        <div class="dex-badge caught">✓ Obtained</div>`;
    return card;
}

// The Giza Crystalline Core: awarded once the Atlantis sanctum is fully attuned
// (isEnlightened()). Same caught-style special card as the Magic Key, drawn with a
// crystal disc instead of a PNG. Also a bonus secret, outside the element tally.
function makeEnlightenmentCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'dex-card dex-caught dex-special';
    card.innerHTML = `
        <div class="dex-num">✦</div>
        <div class="dex-portrait">
            <div class="dex-art dex-art-disc" style="--tint:#7fd4ff" role="img"
                aria-label="The Giza Crystalline Core, fully resonant">◈</div>
        </div>
        <div class="dex-name">Giza Core</div>
        <div class="dex-el">Enlightenment</div>
        <div class="dex-stats">You forged every crystal from its protons, neutrons and electrons,<br>then balanced the ion circuit to net-zero charge.</div>
        <div class="dex-badge caught">✓ Resonant</div>`;
    return card;
}

// The Canopy Key: awarded once every jungle totem is correctly configured
// (isCanopyAttuned()). Same caught-style special card, drawn with a green leaf disc.
// A bonus secret, outside the element tally — the jungle lesson's reward.
function makeCanopyKeyCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'dex-card dex-caught dex-special';
    card.innerHTML = `
        <div class="dex-num">✦</div>
        <div class="dex-portrait">
            <div class="dex-art dex-art-disc" style="--tint:#8dff9a" role="img"
                aria-label="The Canopy Key, the powered jungle network">❡</div>
        </div>
        <div class="dex-name">Canopy Key</div>
        <div class="dex-el">Electron Configuration</div>
        <div class="dex-stats">You channeled every totem's electrons up the lattice in Aufbau order,<br>filling each sublevel (s, p, d) before the next — and powered the canopy.</div>
        <div class="dex-badge caught">✓ Powered</div>`;
    return card;
}
