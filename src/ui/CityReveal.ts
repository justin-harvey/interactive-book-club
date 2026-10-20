// The secret-path cutscene. Stepping onto the lookout at the very top of the
// woods trail freezes the dog and plays a slow, wondering reveal of the distant
// city across the bridge (bridge.png). The bridge is framed by a sunset sky above
// and a dark tree-line below, so it reads as a vista glimpsed through the woods
// rather than an image with hard edges. Tap to head back.

import GlobalInfo from '../GlobalInfo';

let playing = false;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

export function playCityReveal(onEnter?: () => void): void {
    if (playing) return;
    playing = true;
    setDialogue(true);                 // freeze the dog for the cutscene

    const overlay = document.createElement('div');
    overlay.className = 'city-reveal';
    overlay.innerHTML = `
        <div class="cr-sky"></div>
        <div class="cr-stage">
            <img class="cr-bridge" src="assets/city/bridge.png" alt="A view of the distant city across the bridge">
            <div class="cr-dog" aria-hidden="true"></div>
        </div>
        <div class="cr-caption"></div>`;
    document.body.appendChild(overlay);
    const caption = overlay.querySelector('.cr-caption') as HTMLElement;

    // Slowly pan out to reveal the whole bridge.
    requestAnimationFrame(() => overlay.classList.add('cr-bridge-in'));

    // Once it has settled, let the player linger, then tap to cross into the
    // city (or head back to the woods if there's nowhere to go). With reduce-motion
    // the slow pan is skipped (CSS), so don't make the student wait it out.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const t = window.setTimeout(() => {
        caption.textContent = onEnter
            ? 'Cross the bridge…   (tap to enter the city)'
            : 'Across the bridge lies a city…   (tap to head back)';
        overlay.addEventListener('click', finish);
    }, reduce ? 1400 : 9600);

    function finish(): void {
        overlay.removeEventListener('click', finish);
        clearTimeout(t);
        overlay.classList.add('cr-out');
        setDialogue(false);            // unfreeze so the city (or woods) is playable
        if (onEnter) onEnter();        // switch into the city scene
        window.setTimeout(() => {
            overlay.remove();
            playing = false;
        }, 700);
    }
}
