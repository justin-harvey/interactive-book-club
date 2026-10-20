// game.js loads as a classic <script> in <head>, so top-level UI init runs
// before <body> exists. Any startup DOM mount must wait for the body — call
// onBodyReady so an unguarded document.body.appendChild can't throw and abort the
// whole boot (that's the black screen the Rad Finder mount once caused).
export function onBodyReady(fn: () => void): void {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
}
