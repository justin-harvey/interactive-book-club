// A one-tap "Leave" button shown only while inside a building. Pure DOM (like
// the Isotopedex button) so it sits above the Phaser canvas and is unmistakable
// to new/young players who might not spot the in-world doorway. Interiors call
// showLeaveButton() on entry and hideLeaveButton() when they sleep.

let btn: HTMLButtonElement | null = null;
let onLeave: (() => void) | null = null;

function ensure(): void {
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'leave-button';
    btn.className = 'leave-button';
    btn.setAttribute('aria-label', 'Leave the building');
    btn.innerHTML = `<span class="leave-arrow">←</span> Leave`;
    btn.addEventListener('click', () => onLeave?.());
    document.body.appendChild(btn);
}

// Show the button and set what it does. Called from an interior's create()/wake.
export function showLeaveButton(handler: () => void): void {
    ensure();
    onLeave = handler;
    btn!.style.display = 'flex';
}

export function hideLeaveButton(): void {
    onLeave = null;
    if (btn) btn.style.display = 'none';
}
