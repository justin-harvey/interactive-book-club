// DOM-based battle-style quiz shown when the dog trainer meets an Elemental.
// Styled like a Game Boy Advance Pokémon battle: the wild Elemental slides in on
// a platform (top-right), your dog stands opposite (bottom-left), and a bordered
// pixel-font textbox types out "A wild X appeared!" then multiple-choice
// questions. If the class setting `questionsToCatch` is > 1 the encounter is a
// short battle: the Elemental has an HP bar that drains one notch per correct
// answer, and you catch it when HP hits zero. One correct answer catches it when
// the setting is 1 (the default).

import GlobalInfo from '../GlobalInfo';
import { getQuestion } from '../data/questionSource';
import { markSeen, markCaught, recordAnswer } from '../data/progress';
import { getElement } from '../data/elements';
import { elementalArtKey } from '../data/elementalArt';
import { cachedSettings } from '../data/classConfig';
import { Question } from '../data/questions';

let isOpen = false;
let firstFightReacted = false;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// On the very first encounter, briefly pop the pixel dog as a reaction image.
function showDogReaction(): void {
    const reaction = document.createElement('div');
    reaction.className = 'dog-reaction';
    reaction.innerHTML = `
        <img src="assets/images/pixel-dog.png" alt="Your dog reacts">
        <div class="dog-reaction-caption">Woof! Your first Elemental!</div>`;
    document.body.appendChild(reaction);
    setTimeout(() => reaction.remove(), 2400);
}

// 0xRRGGBB Phaser tint -> "#rrggbb" for the no-art fallback disc.
function hexColor(tint: number): string {
    return '#' + tint.toString(16).padStart(6, '0');
}

// Types `text` into `el` one char at a time. Returns a function that instantly
// finishes the current line (tap-to-skip) and fires `done`.
function typewriter(el: HTMLElement, text: string, done?: () => void): () => void {
    el.textContent = '';
    let i = 0;
    let finished = false;
    const timer = window.setInterval(step, 18);
    function step(): void {
        if (i >= text.length) return finish();
        el.textContent += text[i++];
    }
    function finish(): void {
        if (finished) return;
        finished = true;
        window.clearInterval(timer);
        el.textContent = text;
        done?.();
    }
    return finish;
}

export async function openQuiz(elementId: string): Promise<void> {
    if (isOpen) return;
    const element = getElement(elementId);
    if (!element) { setDialogue(false); return; }

    // How many correct answers it takes to catch this Elemental (>=1).
    const needed = Math.max(1, Math.floor(cachedSettings().questionsToCatch || 1));

    isOpen = true;
    setDialogue(true);

    if (!firstFightReacted) {
        firstFightReacted = true;
        showDogReaction();
    }

    const hasArt = elementalArtKey(elementId) !== undefined;
    const enemyArt = hasArt
        ? `<img class="battle-sprite" src="assets/elementals/${elementId}.png" alt="${element.monster}">`
        : `<div class="battle-sprite battle-sprite--disc" style="background:${hexColor(element.tint)}">${element.symbol}</div>`;
    // Only show an HP bar for a real (multi-answer) battle.
    const hpHtml = needed > 1
        ? `<div class="battle-hp"><span class="battle-hp-fill"></span></div>`
        : '';

    const overlay = document.createElement('div');
    overlay.className = 'quiz-overlay';
    overlay.innerHTML = `
        <div class="quiz-card battle">
            <button class="quiz-x" aria-label="Close without answering">✕</button>
            <div class="battle-scene">
                <div class="battle-info battle-info--enemy">
                    <span class="battle-name">${element.monster}</span>
                    <span class="battle-elem">${element.symbol} · ${element.name}</span>
                    ${hpHtml}
                </div>
                <div class="battle-enemy">
                    <div class="battle-platform"></div>
                    ${enemyArt}
                </div>
                <div class="battle-player">
                    <div class="battle-platform"></div>
                    <div class="battle-sprite battle-sprite--dog" role="img" aria-label="Your dog, from behind"></div>
                </div>
            </div>
            <div class="battle-textbox">
                <div class="battle-text"></div>
                <span class="battle-arrow" hidden>▼</span>
                <div class="quiz-choices" hidden></div>
                <div class="quiz-feedback"></div>
                <div class="quiz-actions">
                    <button class="quiz-continue battle-next" hidden>Continue ▶</button>
                </div>
            </div>
        </div>`;

    const textEl = overlay.querySelector('.battle-text') as HTMLDivElement;
    const arrowEl = overlay.querySelector('.battle-arrow') as HTMLSpanElement;
    const textboxEl = overlay.querySelector('.battle-textbox') as HTMLDivElement;
    const choicesEl = overlay.querySelector('.quiz-choices') as HTMLDivElement;
    const feedbackEl = overlay.querySelector('.quiz-feedback') as HTMLDivElement;
    const actionBtn = overlay.querySelector('.battle-next') as HTMLButtonElement;
    const hpFill = overlay.querySelector('.battle-hp-fill') as HTMLSpanElement | null;

    type Stage = 'intro' | 'question' | 'answered' | 'done';
    let stage: Stage = 'intro';
    let skip: () => void = () => {};        // finishes the current typewriter line
    let answered = false;
    let correct = 0;                        // correct answers so far this battle
    let seenMarked = false;
    let current: { question: Question; buttons: HTMLButtonElement[] } | null = null;

    function setAction(label: string, handler: () => void): void {
        actionBtn.textContent = label;
        actionBtn.hidden = false;
        actionBtn.onclick = handler;
    }

    // Build the answer buttons for a question.
    function renderChoices(question: Question): HTMLButtonElement[] {
        choicesEl.innerHTML = '';
        return question.choices.map((choice, i) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-choice';
            btn.innerHTML = `<span class="quiz-key">${i + 1}</span> ${choice}`;
            btn.addEventListener('click', () => answer(i));
            choicesEl.appendChild(btn);
            return btn;
        });
    }

    // Load one question round: type the prompt, then reveal its choices.
    async function loadRound(): Promise<void> {
        const question = await getQuestion(elementId);
        if (!question) { close(); return; }
        answered = false;
        stage = 'question';
        arrowEl.hidden = true;
        choicesEl.hidden = true;
        feedbackEl.textContent = '';
        feedbackEl.className = 'quiz-feedback';
        actionBtn.hidden = true;
        current = { question, buttons: renderChoices(question) };
        skip = typewriter(textEl, question.prompt, () => { choicesEl.hidden = false; });
    }

    function answer(index: number): void {
        if (answered || !current) return;
        answered = true;
        stage = 'answered';
        const { question, buttons } = current;
        const isRight = index === question.correctIndex;

        // Glyph as well as colour, so right/wrong doesn't rely on green-vs-red.
        buttons.forEach((b, i) => {
            b.disabled = true;
            if (i === question.correctIndex) {
                b.classList.add('correct');
                b.insertAdjacentHTML('beforeend', ' <span class="quiz-mark">✓</span>');
            } else if (i === index) {
                b.classList.add('wrong');
                b.insertAdjacentHTML('beforeend', ' <span class="quiz-mark">✗</span>');
            }
        });

        // Any encounter counts as Seen (spec §4.2); markCaught also marks seen.
        if (!seenMarked) { markSeen(elementId); seenMarked = true; }
        recordAnswer(elementId, isRight);      // mastery stats for the dashboard

        const answerText = question.choices[question.correctIndex];
        if (isRight) {
            correct++;
            if (hpFill) hpFill.style.width = `${Math.max(0, (needed - correct) / needed) * 100}%`;
            if (correct >= needed) {
                stage = 'done';
                markCaught(elementId);
                overlay.querySelector('.battle-enemy')?.classList.add('caught');
                feedbackEl.textContent = `Caught it! ${element!.monster} joined your Isotopedex.`;
                feedbackEl.classList.add('ok');
                setAction('Continue ▶', close);
            } else {
                const left = needed - correct;
                feedbackEl.textContent = `Direct hit! ${left} more correct to catch ${element!.monster}.`;
                feedbackEl.classList.add('ok');
                setAction('Next ▶', () => { void loadRound(); });
            }
        } else {
            feedbackEl.textContent = `So close! The answer is "${answerText}". Keep trying to catch ${element!.monster}!`;
            feedbackEl.classList.add('no');
            setAction('Try again ▶', () => { void loadRound(); });
        }
        actionBtn.focus();
    }

    function startIntro(): void {
        stage = 'intro';
        arrowEl.hidden = true;
        choicesEl.hidden = true;
        skip = typewriter(textEl, `A wild ${element!.monster} appeared!`, () => { arrowEl.hidden = false; });
    }

    // Tap the textbox to skip typing, then advance the intro into round one.
    function advance(): void {
        skip();
        if (stage === 'intro') { arrowEl.hidden = true; void loadRound(); }
    }
    textboxEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        advance();
    });

    function close(): void {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        isOpen = false;
        setDialogue(false);
    }

    function onKey(e: KeyboardEvent): void {
        const choiceCount = current?.question.choices.length ?? 0;
        if (stage === 'question' && !choicesEl.hidden && !answered
            && e.key >= '1' && e.key <= String(choiceCount)) {
            answer(parseInt(e.key, 10) - 1);
            e.preventDefault();
        } else if (stage === 'answered' && (e.key === 'Enter' || e.key === ' ')) {
            actionBtn.click();
            e.preventDefault();
        } else if (stage === 'done' && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) {
            close();
            e.preventDefault();
        } else if ((stage === 'intro') && (e.key === 'Enter' || e.key === ' ')) {
            advance();
            e.preventDefault();
        } else if (e.key === 'Escape') {
            close();          // flee the battle
            e.preventDefault();
        }
    }

    // ✕ lets a student back out (iPads have no keyboard). The Elemental stays
    // de-armed until they step away, so it won't instantly reopen.
    (overlay.querySelector('.quiz-x') as HTMLButtonElement).addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    startIntro();
}

// Kick off an encounter the GBA way: freeze the world, play the battle-start
// screen wipe, then drop into the quiz once the screen is covered. Used by both
// walk-up (proximity) encounters and wild tall-grass encounters.
export function startBattle(elementId: string): void {
    if (isOpen || GlobalInfo._gameProgress.inDialogue) return;
    setDialogue(true);
    const wipe = document.createElement('div');
    wipe.className = 'battle-transition';
    document.body.appendChild(wipe);
    window.setTimeout(() => { void openQuiz(elementId); }, 460);
    window.setTimeout(() => wipe.remove(), 880);
}
