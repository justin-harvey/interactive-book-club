// First-run "how to play" card. Shown once when the game loads (no persistence —
// classroom iPads are shared, so every fresh load greets the next student), and
// re-openable any time via the "?" help button. Pure DOM, like the other UI.

import GlobalInfo from '../GlobalInfo';
import { icon } from './icons';
import { currentStudent } from '../data/studentAuth';
import { isFirebaseConfigured } from '../data/firebase';
import { onBodyReady } from './domReady';
import { supportEnabled, SUPPORT_PAGE } from '../data/support';

let overlay: HTMLDivElement | null = null;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

export function showIntro(): void {
    if (overlay) return;
    setDialogue(true);

    overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.innerHTML = `
        <div class="intro-card">
            <div class="intro-title">${icon('flask')} Welcome to Isotopia!</div>
            <p class="intro-lead">You're a trainer exploring a town full of element
                creatures called Elementals. Meet them, answer their questions,
                and collect them all!</p>
            <ul class="intro-list">
                <li>${icon('pin')} Tap where you want to walk.</li>
                <li>${icon('paw')} Walk up to an Elemental to start its quiz.</li>
                <li>${icon('ball')} Answer correctly to catch it!</li>
                <li>${icon('door')} Step on a glowing pad to enter or leave a building.</li>
                <li>${icon('book')} Tap the DEX (top-right) to see everything you've found.</li>
            </ul>
            <div class="intro-actions">
                ${(currentStudent() || !isFirebaseConfigured()) ? '' : `<p class="intro-note">Open the DEX (top-right) to sign up and save your progress across devices.</p>`}
                <button class="intro-go">Let's go!</button>
            </div>
            ${supportEnabled() ? `<a class="intro-support" href="${SUPPORT_PAGE}" target="_blank" rel="noopener">Isotopia is free &amp; ad-free &middot; support it &#9829;</a>` : ''}
        </div>`;

    const close = (): void => {
        overlay!.remove();
        overlay = null;
        setDialogue(false);
    };
    overlay.querySelector('.intro-go')!.addEventListener('click', close);
    document.body.appendChild(overlay);
}

// Mount the "?" help button and show the intro once, when the DOM is ready.
export function initIntro(): void {
    const mount = (): void => {
        if (!document.getElementById('help-button')) {
            const btn = document.createElement('button');
            btn.id = 'help-button';
            btn.className = 'help-button';
            btn.textContent = '?';
            btn.setAttribute('aria-label', 'How to play');
            btn.title = 'How to play';
            btn.addEventListener('click', showIntro);
            document.body.appendChild(btn);
        }
        showIntro();
    };
    onBodyReady(mount);
}
