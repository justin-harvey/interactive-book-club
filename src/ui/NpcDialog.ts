// A simple speech-box dialog for flavor NPCs (e.g. Neonu Reeves). Pure DOM, like
// the quiz/intro overlays. Steps through one or more lines, then runs onDone.

import GlobalInfo from '../GlobalInfo';

let overlay: HTMLDivElement | null = null;

function setDialogue(active: boolean): void {
    GlobalInfo._gameProgress.inDialogue = active;
    GlobalInfo.emit('inDialogue', active);
}

// Optional extras: `image` shows an item/portrait sprite above the text (e.g. the
// Magic Key revealed by the forest chest).
export function showNpcDialog(
    speaker: string,
    lines: string[],
    onDone?: () => void,
    opts?: { image?: string },
): void {
    if (overlay || lines.length === 0) return;
    setDialogue(true);

    let idx = 0;
    overlay = document.createElement('div');
    overlay.className = 'npc-dialog-overlay';
    const imgHtml = opts?.image
        ? `<img class="npc-portrait" src="${opts.image}" alt="">`
        : '';
    overlay.innerHTML = `
        <div class="npc-dialog">
            <div class="npc-speaker">${speaker}</div>
            ${imgHtml}
            <div class="npc-line"></div>
            <button class="npc-next"></button>
        </div>`;

    const lineEl = overlay.querySelector('.npc-line') as HTMLDivElement;
    const nextBtn = overlay.querySelector('.npc-next') as HTMLButtonElement;

    const render = (): void => {
        lineEl.textContent = lines[idx];
        nextBtn.textContent = idx < lines.length - 1 ? 'Next ▶' : 'OK! ▶';
    };

    const close = (): void => {
        overlay!.remove();
        overlay = null;
        setDialogue(false);
        onDone?.();
    };

    const advance = (): void => {
        idx += 1;
        if (idx >= lines.length) close();
        else render();
    };

    nextBtn.addEventListener('click', advance);
    render();
    nextBtn.focus();
    document.body.appendChild(overlay);
}
