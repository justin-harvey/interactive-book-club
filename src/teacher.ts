// Isotopia — Teacher admin portal (separate page: teacher.html).
// Google sign-in (school domain) gated by the "teacher" custom claim. Lets the
// teacher edit the question bank, set the 40-day element release schedule, and
// tune capture difficulty — all written live to Realtime Database.
//
// The student game (game.ts) is untouched by this; students play as guests.

import {
    onTeacherAuth, signInTeacher, signInAdminEmail, signOutTeacher, TeacherSession, ALLOWED_DOMAIN,
} from './data/adminAuth';
import { isFirebaseConfigured } from './data/firebase';
import { supportEnabled, SUPPORT_PAGE } from './data/support';
import { ELEMENTS } from './data/elements';
import { PERIODIC_TABLE, getPeriodicElement, elementLabel } from './data/periodicTable';
import {
    ClassSettings, loadSettings, saveSettings, DEFAULT_SETTINGS,
    isElementReleased, currentUnitDay, UNIT_LENGTH_DAYS,
    ClassMeta, loadClassMeta, saveClassMeta, DEFAULT_CLASS_COLOR,
} from './data/classConfig';
import {
    StoredQuestion, loadAllQuestions, saveQuestion, deleteQuestion, importStarterQuestions,
    syncMissingStarterQuestions,
} from './data/questionAdmin';
import {
    loadRoster, setMembership, setMembershipBulk, loadAdmins, setAdmin, StudentRow, AdminRow,
} from './data/studentAdmin';
import { loadSeasonId, setSeason, seasonId } from './data/season';

const app = document.getElementById('app') as HTMLDivElement;

// Elements that exist as catchable Elementals in the game right now (id -> the
// creature's display name, from elements.ts). Questions on any OTHER element are
// still saved, but won't surface in gameplay until that element gets a creature.
// The portal marks these so the teacher knows which element maps to a real,
// catchable creature and which questions are just banked for later.
const PLAYABLE = new Map(ELEMENTS.map(e => [e.id, e.monster] as const));

let session: TeacherSession | null = null;
let settings: ClassSettings = { ...DEFAULT_SETTINGS };
let questions: StoredQuestion[] = [];
let tab: 'questions' | 'schedule' | 'settings' | 'students' | 'admins' | 'class' = 'questions';
let classMeta: ClassMeta | null = null;         // the logged-in staff member's class

// This staff member owns one class, keyed by their own uid.
function myClassId(): string { return session?.user.uid || ''; }
function myClassName(): string { return classMeta?.name?.trim() || 'My Class'; }
let editing: StoredQuestion | null = null;      // question being added/edited
let rosterRows: StudentRow[] = [];              // cached roster (filtered client-side)
let rosterFilter = '';
let adminRows: AdminRow[] = [];                 // cached registrant list for role mgmt
let adminFilter = '';
let pickerQuery = '';                            // element-picker search text (editor)

const esc = (s: string): string =>
    s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// A transient confirmation / error toast, bottom-centre.
function flash(msg: string, isError = false): void {
    const t = document.createElement('div');
    t.className = `toast${isError ? ' error' : ''}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2300);
}

// Run an async write with the button disabled + relabelled, so the teacher sees
// it working, can't double-submit, and gets a success/error toast. Returns true
// only if the action succeeded — the caller keeps state (e.g. an open editor) on
// failure instead of re-rendering as if it saved.
async function withBusy(
    btn: HTMLButtonElement, busyLabel: string, action: () => Promise<void>, okMsg?: string,
): Promise<boolean> {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    try {
        await action();
        if (okMsg) flash(okMsg);
        return true;
    } catch (err) {
        flash((err as Error).message || 'Something went wrong — not saved.', true);
        return false;
    } finally {
        btn.disabled = false;
        btn.textContent = original;
    }
}

// ---------------------------------------------------------------- boot
function boot(): void {
    if (!isFirebaseConfigured()) {
        app.innerHTML = `<div class="card"><h1>Isotopia Teacher</h1>
            <p>Firebase isn't configured yet — set <code>firebaseConfig</code> in
            <code>src/data/firebase.ts</code>.</p></div>`;
        return;
    }
    onTeacherAuth(async (s) => {
        session = s;
        if (s?.isStaff) {
            const cid = s.user.uid;
            [settings, questions, classMeta] = await Promise.all([
                loadSettings(cid), loadAllQuestions(), loadClassMeta(cid),
            ]);
            // First time this staff member opens the portal: create their class.
            if (!classMeta) {
                classMeta = { name: 'My Class', color: DEFAULT_CLASS_COLOR, ownerUid: cid };
                try { await saveClassMeta(cid, classMeta); } catch { /* rules/offline — retry on Class tab */ }
            }
        }
        render();
    });
}

// ---------------------------------------------------------------- shells
function render(): void {
    if (!session) return renderSignedOut();
    if (!session.isStaff) return renderNotAuthorized();
    renderPortal();
}

function renderSignedOut(): void {
    app.innerHTML = `<div class="card center">
        <h1>Isotopia Teacher</h1>
        <p>Super admins sign in with their <b>@${ALLOWED_DOMAIN}</b> Google account.</p>
        <button id="signin" class="btn primary">Sign in with Google</button>
        <p class="muted" style="margin-top:18px">Class admins sign in with the email
            and password they registered with in the game.</p>
        <form id="admin-email-form" class="stack">
            <input type="email" id="admin-email" placeholder="email" autocomplete="email" required>
            <input type="password" id="admin-pass" placeholder="password" autocomplete="current-password" required>
            <button type="submit" class="btn">Sign in as admin</button>
        </form>
    </div>`;
    (document.getElementById('signin') as HTMLButtonElement)
        .addEventListener('click', () => signInTeacher().catch(err => alert(err.message)));
    (document.getElementById('admin-email-form') as HTMLFormElement)
        .addEventListener('submit', (e) => {
            e.preventDefault();
            const email = (document.getElementById('admin-email') as HTMLInputElement).value;
            const pass = (document.getElementById('admin-pass') as HTMLInputElement).value;
            signInAdminEmail(email, pass).catch(err => alert(err.message));
        });
}

function renderNotAuthorized(): void {
    app.innerHTML = `<div class="card center">
        <h1>Not authorized</h1>
        <p>Signed in as <b>${esc(session!.user.email || '')}</b>, but this account
        doesn't have teacher access yet.</p>
        <button id="signout" class="btn">Sign out</button>
    </div>`;
    (document.getElementById('signout') as HTMLButtonElement)
        .addEventListener('click', () => signOutTeacher());
}

// Tabs available in the portal. The Admins tab (role management) is super-only.
function portalTabs(): [typeof tab, string][] {
    const tabs: [typeof tab, string][] = [
        ['class', 'Class'],
        ['questions', 'Questions'],
        ['schedule', 'Schedule'],
        ['settings', 'Settings'],
        ['students', 'Roster'],
    ];
    if (session?.isSuper) tabs.push(['admins', 'Admins']);
    return tabs;
}

function renderPortal(): void {
    app.innerHTML = `
        <header class="topbar">
            <span class="brand">Isotopia Teacher</span>
            <span class="class-chip"><span class="class-swatch" style="background:${esc(classMeta?.color || DEFAULT_CLASS_COLOR)}"></span>${esc(myClassName())}</span>
            <nav class="tabs" role="tablist">
                ${portalTabs().map(([t, label]) => {
                    const on = tab === t;
                    return `<button data-tab="${t}" role="tab" aria-selected="${on}" class="${on ? 'on' : ''}">${label}</button>`;
                }).join('')}
            </nav>
            <span class="who">${supportEnabled()
                    ? `<a class="support-link" href="${SUPPORT_PAGE}" target="_blank" rel="noopener">&#9829; Support Isotopia</a>` : ''}
                ${esc(session!.user.email || '')}
                <button id="signout" class="btn small">Sign out</button></span>
        </header>
        <main id="panel"></main>`;

    app.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b =>
        b.addEventListener('click', () => {
            tab = b.dataset.tab as typeof tab;
            editing = null;
            // Move the active highlight to the clicked tab (renderPanel only
            // repaints the panel, not the nav).
            app.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(x => {
                const on = x === b;
                x.classList.toggle('on', on);
                x.setAttribute('aria-selected', String(on));
            });
            renderPanel();
        }));
    (document.getElementById('signout') as HTMLButtonElement)
        .addEventListener('click', () => signOutTeacher());
    renderPanel();
}

function renderPanel(): void {
    if (tab === 'questions') return renderQuestions();
    if (tab === 'class') return renderClass();
    if (tab === 'schedule') return renderSchedule();
    if (tab === 'students') { void renderStudents(); return; }
    if (tab === 'admins') { void renderAdmins(); return; }
    renderSettings();
}

// ---------------------------------------------------------------- questions
function renderQuestions(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    // Group by every element that actually has questions (questions can now be
    // tagged to any of the 118 elements, so we don't render a section per element
    // — only the ones in use), ordered by atomic number. Unknown ids sort last.
    const groups = new Map<string, StoredQuestion[]>();
    questions.forEach(q => {
        const list = groups.get(q.elementId) ?? [];
        list.push(q);
        groups.set(q.elementId, list);
    });
    const byElement = Array.from(groups.entries())
        .map(([id, qs]) => ({ id, num: getPeriodicElement(id)?.number ?? 9999, qs }))
        .sort((a, b) => a.num - b.num || a.id.localeCompare(b.id));

    // Catchable creatures with NO questions in the bank yet — e.g. newly shipped
    // Elementals whose starter questions were never synced up. The button below
    // pushes their bundled seed questions without touching the rest of the bank.
    const missing = Array.from(PLAYABLE.keys()).filter(id => !groups.has(id));

    panel.innerHTML = `
        <div class="row between">
            <h2>Question bank <span class="muted">(${questions.length} total)</span></h2>
            <div>
                ${questions.length === 0 ? `<button id="import" class="btn">Import starter questions</button>` : ''}
                ${questions.length > 0 && missing.length > 0
                    ? `<button id="sync" class="btn">Add starter questions for ${missing.length} new creature${missing.length === 1 ? '' : 's'}</button>`
                    : ''}
                <button id="add" class="btn primary">+ New question</button>
            </div>
        </div>
        <div id="qeditor"></div>
        <div class="qlist">
            ${questions.length === 0 ? `<p class="muted">No questions yet — add one, or import the starter set.</p>` : ''}
            ${byElement.map(g => `
                <section>
                    <h3>${esc(elementLabel(g.id))}
                        <span class="muted">(${g.qs.length})</span>
                        ${PLAYABLE.get(g.id)
                            ? `<span class="badge ok">● ${esc(PLAYABLE.get(g.id) as string)}</span>`
                            : `<span class="badge neutral">no creature yet</span>`}</h3>
                    ${g.qs.map(q => `
                        <div class="qrow">
                            <div class="qtext">
                                <div class="qprompt">${esc(q.prompt)}</div>
                                <div class="muted small">${esc(q.angle || '')} · answer:
                                    <b>${esc(q.choices[q.correctIndex] ?? '?')}</b></div>
                            </div>
                            <div class="qactions">
                                <button class="btn small" data-edit="${q.id}">Edit</button>
                                <button class="btn small danger" data-del="${q.id}">Delete</button>
                            </div>
                        </div>`).join('')}
                </section>`).join('')}
        </div>`;

    const importBtn = document.getElementById('import') as HTMLButtonElement | null;
    importBtn?.addEventListener('click', async () => {
        let imported = 0;
        const ok = await withBusy(importBtn, 'Importing…', async () => {
            imported = await importStarterQuestions();
            questions = await loadAllQuestions();
        });
        if (ok) { flash(imported ? `Imported ${imported} starter questions.` : 'Question bank already has data.'); renderQuestions(); }
    });
    const syncBtn = document.getElementById('sync') as HTMLButtonElement | null;
    syncBtn?.addEventListener('click', async () => {
        let added = 0;
        const ok = await withBusy(syncBtn, 'Adding…', async () => {
            added = await syncMissingStarterQuestions();
            questions = await loadAllQuestions();
        });
        if (ok) { flash(added ? `Added ${added} starter question${added === 1 ? '' : 's'}.` : 'No missing questions to add.'); renderQuestions(); }
    });
    (document.getElementById('add') as HTMLButtonElement).addEventListener('click', () => {
        editing = { id: '', elementId: ELEMENTS[0].id, angle: '', prompt: '', choices: ['', '', '', ''], correctIndex: 0 };
        pickerQuery = '';
        renderQuestionEditor();
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b =>
        b.addEventListener('click', () => {
            const q = questions.find(x => x.id === b.dataset.edit);
            if (q) { editing = { ...q, choices: [...q.choices] }; pickerQuery = ''; renderQuestionEditor(); }
        }));
    panel.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b =>
        b.addEventListener('click', async () => {
            const q = questions.find(x => x.id === b.dataset.del);
            const preview = q ? `"${q.prompt.slice(0, 60)}${q.prompt.length > 60 ? '…' : ''}"` : 'this question';
            if (!confirm(`Delete ${preview}?`)) return;
            const ok = await withBusy(b, 'Deleting…', async () => {
                await deleteQuestion(b.dataset.del as string);
                questions = await loadAllQuestions();
            }, 'Question deleted.');
            if (ok) renderQuestions();
        }));
    if (editing) renderQuestionEditor();
}

function renderQuestionEditor(): void {
    const host = document.getElementById('qeditor') as HTMLElement;
    if (!editing) { host.innerHTML = ''; return; }
    const q = editing;
    host.innerHTML = `
        <div class="editor">
            <label>Element
                <div class="elpicker">
                    <div class="elpicker-selected" id="el-selected"></div>
                    <input id="el-search" class="elpicker-search" type="text"
                        placeholder="Search all 118 elements — name, symbol, or number…"
                        value="${esc(pickerQuery)}" autocomplete="off">
                    <div class="elpicker-hint muted small">● = has a creature in the game
                        (${PLAYABLE.size} elements, shown first). Questions on other elements
                        are saved, but won't appear in gameplay until that element gets a creature.</div>
                    <div class="elpicker-grid" id="el-grid"></div>
                </div>
            </label>
            <label>Angle / topic
                <input id="f-angle" value="${esc(q.angle || '')}" placeholder="protons, ion, valence…">
            </label>
            <label>Question prompt
                <textarea id="f-prompt" rows="2" placeholder="How many protons…">${esc(q.prompt)}</textarea>
            </label>
            <fieldset class="choices">
                <legend>Answer choices — select the correct one</legend>
                ${q.choices.map((c, i) => `
                    <label class="choice">
                        <input type="radio" name="correct" value="${i}" ${i === q.correctIndex ? 'checked' : ''}
                            aria-label="Mark choice ${i + 1} correct">
                        <input class="f-choice" data-i="${i}" value="${esc(c)}" placeholder="Choice ${i + 1}"
                            aria-label="Choice ${i + 1} text">
                    </label>`).join('')}
            </fieldset>
            <div class="row">
                <button id="q-save" class="btn primary">Save question</button>
                <button id="q-cancel" class="btn">Cancel</button>
            </div>
        </div>`;

    // The element picker writes straight to q.elementId as the teacher clicks, so
    // it's already set by save time (no <select> to read).
    wireElementPicker(host, q);

    (document.getElementById('q-cancel') as HTMLButtonElement).addEventListener('click', () => { editing = null; renderQuestions(); });
    const saveBtn = document.getElementById('q-save') as HTMLButtonElement;
    saveBtn.addEventListener('click', async () => {
        q.angle = (document.getElementById('f-angle') as HTMLInputElement).value.trim();
        q.prompt = (document.getElementById('f-prompt') as HTMLTextAreaElement).value.trim();
        q.choices = Array.from(host.querySelectorAll<HTMLInputElement>('.f-choice')).map(i => i.value.trim());
        q.correctIndex = Number((host.querySelector('input[name="correct"]:checked') as HTMLInputElement).value);
        if (!q.prompt || q.choices.some(c => !c)) { flash('Fill in the prompt and all four choices.', true); return; }
        // Keep the editor open on failure (withBusy returns false) so nothing is lost.
        const ok = await withBusy(saveBtn, 'Saving…', async () => {
            await saveQuestion(q);
            questions = await loadAllQuestions();
        }, 'Question saved.');
        if (ok) { editing = null; renderQuestions(); }
    });

    // Bring the editor into view when opened from a question low in the list.
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// The searchable element picker inside the question editor. Any of the 118
// elements can be chosen — a dropdown of that many is unusable, so this is a
// filterable grid. Selection writes straight to `q.elementId`; only the grid +
// the "selected" line re-render on each keystroke, so the search box keeps focus.
function wireElementPicker(host: HTMLElement, q: StoredQuestion): void {
    const search = host.querySelector('#el-search') as HTMLInputElement;
    fillElementPicker(host, q);
    search.addEventListener('input', () => { pickerQuery = search.value; fillElementPicker(host, q); });
    // Enter picks the single remaining match — fast keyboard entry for teachers.
    search.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const matches = filterElements(pickerQuery);
        if (matches.length >= 1) { q.elementId = matches[0].id; fillElementPicker(host, q); }
    });
}

function filterElements(query: string): typeof PERIODIC_TABLE {
    const term = query.trim().toLowerCase();
    if (!term) return PERIODIC_TABLE;
    return PERIODIC_TABLE.filter(el =>
        el.name.toLowerCase().includes(term) ||
        el.symbol.toLowerCase() === term ||
        el.symbol.toLowerCase().startsWith(term) ||
        String(el.number) === term);
}

function fillElementPicker(host: HTMLElement, q: StoredQuestion): void {
    const selectedLine = host.querySelector('#el-selected') as HTMLElement;
    const grid = host.querySelector('#el-grid') as HTMLElement;
    const sel = getPeriodicElement(q.elementId);
    const monster = PLAYABLE.get(q.elementId);
    const selName = sel ? `${esc(sel.symbol)} · ${esc(sel.name)}` : esc(q.elementId);
    selectedLine.innerHTML = monster
        ? `Selected: <b>${selName}</b> — creature <b>${esc(monster)}</b> <span class="badge ok">catchable now</span>`
        : `Selected: <b>${selName}</b> <span class="badge neutral">no creature yet · banked</span>`;

    // Catchable elements first (so the "real" ones are easy to find), then by
    // atomic number.
    const matches = filterElements(pickerQuery).slice().sort((a, b) =>
        (PLAYABLE.has(a.id) ? 0 : 1) - (PLAYABLE.has(b.id) ? 0 : 1) || a.number - b.number);
    grid.innerHTML = matches.length === 0
        ? `<p class="muted small">No element matches that.</p>`
        : matches.map(el => {
            const mon = PLAYABLE.get(el.id);
            return `<button type="button" class="elcell${el.id === q.elementId ? ' on' : ''}${mon ? ' playable' : ''}" data-el="${el.id}"
                title="${esc(el.name)} · atomic number ${el.number}${mon ? ` — creature ${esc(mon)}` : ' — no creature yet'}">
                <span class="elnum">${mon ? '● ' : ''}${el.number}</span>
                <span class="elsym">${esc(el.symbol)}</span>
                <span class="elname">${esc(el.name)}</span>
            </button>`;
        }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.elcell').forEach(b =>
        b.addEventListener('click', () => { q.elementId = b.dataset.el as string; fillElementPicker(host, q); }));
}

// ---------------------------------------------------------------- schedule
function renderSchedule(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    const day = currentUnitDay(settings);
    panel.innerHTML = `
        <h2>Release schedule <span class="muted">(${UNIT_LENGTH_DAYS}-day unit)</span></h2>
        <div class="grid2">
            <label>Unit start date (day 1)
                <input type="date" id="s-start" value="${esc(settings.unitStartDate)}">
            </label>
            <label class="check">
                <input type="checkbox" id="s-all" ${settings.releaseAllNow ? 'checked' : ''}>
                Release everything now (testing)
            </label>
        </div>
        ${settings.releaseAllNow
            ? `<p class="muted small">"Release everything now" is on — every element is visible regardless of the days below.</p>`
            : (!settings.unitStartDate
                ? `<div class="warn">Set a unit start date, or nothing unlocks: while "Release everything now" is off, every element without a reached unlock day stays hidden.</div>`
                : `<p class="muted small">Today is <b>day ${day}</b> of ${UNIT_LENGTH_DAYS}. Elements with no day, or a later day, stay hidden.</p>`)}
        <table class="sched">
            <thead><tr><th>Element</th><th>Unlock day (1–${UNIT_LENGTH_DAYS})</th><th>Status now</th></tr></thead>
            <tbody>
                ${ELEMENTS.map(el => {
                    const released = isElementReleased(settings, el.id);
                    return `<tr>
                        <td>${esc(el.symbol)} · ${esc(el.name)}</td>
                        <td><input type="number" min="1" max="${UNIT_LENGTH_DAYS}" class="s-day"
                             data-el="${el.id}" value="${settings.release[el.id] ?? ''}" placeholder="—"></td>
                        <td><span class="badge ${released ? 'ok' : 'lock'}">${released ? 'Released' : 'Locked'}</span></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        <div class="row"><button id="sched-save" class="btn primary">Save schedule</button></div>`;

    const schedSaveBtn = document.getElementById('sched-save') as HTMLButtonElement;
    schedSaveBtn.addEventListener('click', async () => {
        settings.unitStartDate = (document.getElementById('s-start') as HTMLInputElement).value;
        settings.releaseAllNow = (document.getElementById('s-all') as HTMLInputElement).checked;
        const release: Record<string, number> = {};
        panel.querySelectorAll<HTMLInputElement>('.s-day').forEach(i => {
            const v = parseInt(i.value, 10);
            if (!Number.isNaN(v)) release[i.dataset.el as string] = Math.max(1, Math.min(UNIT_LENGTH_DAYS, v));
        });
        settings.release = release;
        // Re-render on success so the status badges + any clamped day values refresh.
        const ok = await withBusy(schedSaveBtn, 'Saving…', async () => { await saveSettings(myClassId(), settings); }, 'Schedule saved.');
        if (ok) renderSchedule();
    });
}

// ---------------------------------------------------------------- settings
function renderSettings(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    // The season control is global + destructive, so super-only.
    const seasonCard = session?.isSuper ? `
        <h2 style="margin-top:32px">Season</h2>
        <p class="muted small">Starting a new season resets <strong>every</strong> student's
            Isotopedex — collection, answer stats, evolutions, items, and puzzle
            progress — the next time they open the game. Names, emails, and class
            assignments are kept. Use this once when testing ends and the official
            season begins. Set a new label (e.g. <code>2026-fall</code>) and save.</p>
        <label>Season label
            <input type="text" id="season-id" placeholder="e.g. 2026-fall" value="">
        </label>
        <p class="muted small">Current season: <span id="season-current">loading…</span></p>
        <div class="row"><button id="season-save" class="btn danger">Start new season (reset all dexes)</button></div>` : '';

    panel.innerHTML = `
        <h2>Game settings</h2>
        <label>Correct answers needed to catch an Elemental
            <input type="number" id="g-catch" min="1" max="5" value="${settings.questionsToCatch}">
        </label>
        <p class="muted small">1 = catch on the first correct answer. Higher values
            turn each encounter into a short battle (used when the HP-bar battle lands).</p>
        <div class="row"><button id="set-save" class="btn primary">Save settings</button></div>
        ${seasonCard}`;

    const setSaveBtn = document.getElementById('set-save') as HTMLButtonElement;
    setSaveBtn.addEventListener('click', async () => {
        const v = parseInt((document.getElementById('g-catch') as HTMLInputElement).value, 10);
        settings.questionsToCatch = Math.max(1, Math.min(5, Number.isNaN(v) ? 1 : v));
        const ok = await withBusy(setSaveBtn, 'Saving…', async () => { await saveSettings(myClassId(), settings); }, 'Settings saved.');
        if (ok) renderSettings();
    });

    if (session?.isSuper) {
        const curEl = document.getElementById('season-current') as HTMLSpanElement;
        void loadSeasonId().then(id => { curEl.textContent = id || '(none set)'; });
        const seasonSaveBtn = document.getElementById('season-save') as HTMLButtonElement;
        seasonSaveBtn.addEventListener('click', async () => {
            const id = (document.getElementById('season-id') as HTMLInputElement).value.trim();
            if (!id) { alert('Enter a season label first.'); return; }
            if (id === seasonId()) { alert('That is already the current season.'); return; }
            if (!confirm(`Start season "${id}"? This resets every student's dex on next load. This cannot be undone.`)) return;
            const ok = await withBusy(seasonSaveBtn, 'Starting…', async () => { await setSeason(id); }, `Season "${id}" started — all dexes will reset.`);
            if (ok) renderSettings();
        });
    }
}

// ---------------------------------------------------------------- class
// Each staff member names + colors their own class (classId === their own uid).
// Color is portal-only (students never see it).
const CLASS_COLORS = ['#3a7afe', '#e2584d', '#2f9e57', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#64748b'];

function renderClass(): void {
    const panel = document.getElementById('panel') as HTMLElement;
    const meta = classMeta || { name: '', color: DEFAULT_CLASS_COLOR, ownerUid: myClassId() };
    let chosen = meta.color;
    panel.innerHTML = `<h2>Class</h2>
        <p class="muted small">Name your class and pick a color — this is how your
            class shows in the portal. Students never see the color.</p>
        <form id="class-form" class="stack" style="max-width:360px;margin:14px 0 0">
            <label class="fld">Class name
                <input id="class-name" type="text" maxlength="60" placeholder="e.g. AP Chem — Period 3" value="${esc(meta.name)}">
            </label>
            <div class="fld">Color
                <div class="swatches">
                    ${CLASS_COLORS.map(c => `<button type="button" class="swatch-pick${c.toLowerCase() === meta.color.toLowerCase() ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
                </div>
            </div>
            <button type="submit" class="btn primary" id="class-save">Save class</button>
        </form>`;
    const swatches = panel.querySelectorAll<HTMLButtonElement>('.swatch-pick');
    swatches.forEach(b => b.addEventListener('click', () => {
        chosen = b.dataset.color as string;
        swatches.forEach(x => x.classList.toggle('on', x === b));
    }));
    (panel.querySelector('#class-form') as HTMLFormElement).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (panel.querySelector('#class-name') as HTMLInputElement).value.trim();
        const saveBtn = panel.querySelector('#class-save') as HTMLButtonElement;
        const next: ClassMeta = { name, color: chosen, ownerUid: myClassId() };
        const ok = await withBusy(saveBtn, 'Saving…', async () => { await saveClassMeta(myClassId(), next); }, 'Class saved.');
        if (ok) { classMeta = next; renderPortal(); }   // refresh header chip, stay on tab
    });
}

// ---------------------------------------------------------------- roster
// Everyone who has registered (and verified their email) lands here. Staff tick
// students and bulk add/remove them to the class, or use the per-row button.
// Registrants who aren't added just sit here harmlessly.
async function renderStudents(): Promise<void> {
    const panel = document.getElementById('panel') as HTMLElement;
    const intro = `<p class="muted small">Registrants for <b>${esc(myClassName())}</b>.
        Tick students and use the bulk buttons, or the per-row button. Students
        already in another class can't be claimed${session?.isSuper ? '' : ' (ask a super admin to move them)'}.</p>`;
    panel.innerHTML = `<div class="row between"><h2>Roster</h2>
        <button id="stu-refresh" class="btn">Refresh</button></div>${intro}
        <p class="muted">Loading…</p>`;
    document.getElementById('stu-refresh')?.addEventListener('click', () => void renderStudents());

    rosterRows = await loadRoster(myClassId()).catch(() => []);
    if (rosterRows.length === 0) {
        panel.innerHTML = `<div class="row between"><h2>Roster</h2>
            <button id="stu-refresh" class="btn">Refresh</button></div>${intro}
            <p class="muted">No one has registered yet. Have students open the DEX,
            tap "Sign up", and click the verification link in their email.</p>`;
        document.getElementById('stu-refresh')?.addEventListener('click', () => void renderStudents());
        return;
    }

    const inClass = rosterRows.filter(r => r.inClass).length;
    panel.innerHTML = `<div class="row between">
            <h2>Roster <span class="muted">(${inClass} in class / ${rosterRows.length} registered)</span></h2>
            <button id="stu-refresh" class="btn">Refresh</button></div>${intro}
        <div class="row toolbar">
            <input id="roster-filter" class="filter" type="search" placeholder="Filter by name or email…" value="${esc(rosterFilter)}">
            <button id="bulk-add" class="btn">Add selected to class</button>
            <button id="bulk-remove" class="btn">Remove selected</button>
            <button id="export-csv" class="btn">Export CSV</button>
        </div>
        <div id="roster-table"></div>`;
    document.getElementById('stu-refresh')?.addEventListener('click', () => void renderStudents());
    const filterEl = document.getElementById('roster-filter') as HTMLInputElement;
    filterEl.addEventListener('input', () => { rosterFilter = filterEl.value; paintRoster(); });
    document.getElementById('bulk-add')!.addEventListener('click', () => void bulkRoster(true));
    document.getElementById('bulk-remove')!.addEventListener('click', () => void bulkRoster(false));
    document.getElementById('export-csv')!.addEventListener('click', () => exportRosterCsv());
    paintRoster();
}

function filteredRoster(): StudentRow[] {
    const q = rosterFilter.trim().toLowerCase();
    if (!q) return rosterRows;
    return rosterRows.filter(r =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
}

/** Sum attempts/correct across all elements for one student. */
function statTotals(r: StudentRow): { attempts: number; correct: number } {
    let attempts = 0, correct = 0;
    (Object.values(r.stats) as { attempts: number; correct: number }[])
        .forEach(s => { if (s && typeof s === 'object') { attempts += s.attempts || 0; correct += s.correct || 0; } });
    return { attempts, correct };
}

/** Download the current class roster as a CSV for grading. In-class students
 *  only, one row each: name, email, caught/seen counts, and answer accuracy. */
function exportRosterCsv(): void {
    const rows = rosterRows.filter(r => r.inClass);
    if (rows.length === 0) { flash('No students are in this class yet.', true); return; }
    const cell = (v: string | number): string => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Name', 'Email', 'Caught', 'Seen', 'Questions answered', 'Correct', 'Accuracy %'];
    const lines = [header.join(',')];
    rows.sort((a, b) => a.name.localeCompare(b.name)).forEach(r => {
        const { attempts, correct } = statTotals(r);
        const acc = attempts ? Math.round((correct / attempts) * 100) : 0;
        lines.push([r.name, r.email, r.caught, r.seen, attempts, correct, acc].map(cell).join(','));
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (myClassName() || 'class').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isotopia-${safeName || 'class'}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function paintRoster(): void {
    const host = document.getElementById('roster-table');
    if (!host) return;
    const rows = filteredRoster();
    if (rows.length === 0) {
        host.innerHTML = `<p class="muted">No registrants match "${esc(rosterFilter)}".</p>`;
        return;
    }
    host.innerHTML = `<table class="sched">
        <thead><tr><th></th><th>Student</th><th>Roster</th><th>Caught</th><th>Seen</th><th>Accuracy</th></tr></thead>
        <tbody>${rows.map(r => {
            const { attempts: att, correct: cor } = statTotals(r);
            const acc = att ? Math.round((cor / att) * 100) : 0;
            // "Assigned elsewhere" is only claimable by a super (rules block admins).
            const locked = r.assignedElsewhere && !session?.isSuper;
            const rosterCell = r.inClass
                ? `<span class="pill">in class</span> <button class="btn small roster-toggle" data-uid="${esc(r.uid)}" data-in="1">Remove</button>`
                : r.assignedElsewhere
                    ? `<span class="muted small">another class</span>${locked ? '' : ` <button class="btn small roster-toggle" data-uid="${esc(r.uid)}" data-in="0">Claim</button>`}`
                    : `<button class="btn small roster-toggle" data-uid="${esc(r.uid)}" data-in="0">Add</button>`;
            return `<tr>
                <td>${locked ? '' : `<input type="checkbox" class="roster-check" data-uid="${esc(r.uid)}" data-in="${r.inClass ? '1' : '0'}">`}</td>
                <td>${esc(r.name)}<div class="muted small">${esc(r.email)}</div></td>
                <td>${rosterCell}</td>
                <td>${r.caught}</td>
                <td>${r.seen}</td>
                <td>${att ? `${acc}% <span class="muted small">(${cor}/${att})</span>` : '—'}</td>
            </tr>`;
        }).join('')}</tbody>
    </table>`;
    host.querySelectorAll<HTMLButtonElement>('.roster-toggle').forEach(btn =>
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid as string;
            const isIn = btn.dataset.in === '1';
            btn.disabled = true;
            btn.textContent = '…';
            try {
                await setMembership(myClassId(), uid, !isIn);
            } catch (e) {
                flash(e instanceof Error ? e.message : 'Could not update the roster.', true);
            }
            void renderStudents();
        }));
}

async function bulkRoster(add: boolean): Promise<void> {
    let uids = Array.from(document.querySelectorAll<HTMLInputElement>('.roster-check:checked'))
        .map(c => c.dataset.uid as string);
    if (add) {
        // Adding: skip anyone already in this class, and (for non-supers) anyone
        // claimed by another class — a single ineligible path rejects the whole
        // atomic write.
        const byUid = new Map(rosterRows.map(r => [r.uid, r] as const));
        uids = uids.filter(uid => {
            const r = byUid.get(uid);
            return r && !r.inClass && !(r.assignedElsewhere && !session?.isSuper);
        });
    }
    if (uids.length === 0) { flash(add ? 'No eligible students ticked.' : 'Tick some students first.', true); return; }
    try {
        await setMembershipBulk(myClassId(), uids, add);
        flash(`${add ? 'Added' : 'Removed'} ${uids.length} student${uids.length > 1 ? 's' : ''}.`);
    } catch (e) {
        flash(e instanceof Error ? e.message : 'Bulk update failed.', true);
    }
    void renderStudents();
}

// ---------------------------------------------------------------- admins
// Super-admin-only role management. Promote a registrant to admin (they can then
// manage classes/rosters) or revoke it. Admins can never reach this tab, and no
// new super admins can be minted here — that's the teacher custom claim, which
// only comes from firebase/set-teacher.mjs (see database.rules.json).
async function renderAdmins(): Promise<void> {
    const panel = document.getElementById('panel') as HTMLElement;
    const intro = `<p class="muted small">Super admins only. Promote a registrant to
        <b>admin</b> to let them manage classes and rosters. Admins can’t promote
        anyone, and no new super admins can be created here.</p>`;
    panel.innerHTML = `<div class="row between"><h2>Admins</h2>
        <button id="adm-refresh" class="btn">Refresh</button></div>${intro}
        <p class="muted">Loading…</p>`;
    document.getElementById('adm-refresh')?.addEventListener('click', () => void renderAdmins());

    adminRows = await loadAdmins().catch(() => []);
    const count = adminRows.filter(r => r.isAdmin).length;
    panel.innerHTML = `<div class="row between">
            <h2>Admins <span class="muted">(${count})</span></h2>
            <button id="adm-refresh" class="btn">Refresh</button></div>${intro}
        <div class="row toolbar">
            <input id="admin-filter" class="filter" type="search" placeholder="Filter by name or email…" value="${esc(adminFilter)}">
        </div>
        <div id="admin-table"></div>`;
    document.getElementById('adm-refresh')?.addEventListener('click', () => void renderAdmins());
    const f = document.getElementById('admin-filter') as HTMLInputElement;
    f.addEventListener('input', () => { adminFilter = f.value; paintAdmins(); });
    paintAdmins();
}

function paintAdmins(): void {
    const host = document.getElementById('admin-table');
    if (!host) return;
    const q = adminFilter.trim().toLowerCase();
    const rows = q
        ? adminRows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
        : adminRows;
    if (rows.length === 0) {
        host.innerHTML = `<p class="muted">No registrants match "${esc(adminFilter)}".</p>`;
        return;
    }
    host.innerHTML = `<table class="sched">
        <thead><tr><th>Person</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
            <td>${esc(r.name)}<div class="muted small">${esc(r.email)}</div></td>
            <td>${r.isAdmin ? '<span class="pill">admin</span>' : '<span class="muted">registrant</span>'}</td>
            <td><button class="btn small admin-toggle" data-uid="${esc(r.uid)}" data-admin="${r.isAdmin ? '1' : '0'}" data-label="${esc(r.email || r.name)}">${r.isAdmin ? 'Revoke admin' : 'Make admin'}</button></td>
        </tr>`).join('')}</tbody>
    </table>`;
    host.querySelectorAll<HTMLButtonElement>('.admin-toggle').forEach(btn =>
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid as string;
            const isAdm = btn.dataset.admin === '1';
            const label = btn.dataset.label || 'this person';
            if (!confirm(`${isAdm ? 'Revoke admin from' : 'Make admin:'} ${label}?`)) return;
            btn.disabled = true;
            btn.textContent = '…';
            try {
                await setAdmin(uid, !isAdm);
            } catch (e) {
                flash(e instanceof Error ? e.message : 'Could not update the role.', true);
            }
            void renderAdmins();
        }));
}

boot();
