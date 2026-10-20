// Small inline-SVG icons that replace the old emoji, in a monochrome GBA-menu
// style (they inherit the surrounding text colour via currentColor). This is the
// single place to restyle every icon — or to swap in hand-drawn pixel art later:
// just change the SVG string for a given name.

const SVG: Record<string, string> = {
    // Map pin — "tap where you want to walk".
    pin: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/></svg>`,
    // Paw print — "walk up to an Elemental".
    paw: `<svg viewBox="0 0 24 24"><circle class="fill" cx="6" cy="11" r="1.8"/><circle class="fill" cx="10" cy="7.5" r="1.8"/><circle class="fill" cx="14" cy="7.5" r="1.8"/><circle class="fill" cx="18" cy="11" r="1.8"/><path class="fill" d="M12 12c2.5 0 4.5 1.8 4.5 4S14.5 20 12 20s-4.5-1.8-4.5-4 2-4 4.5-4z"/></svg>`,
    // Capture ball — "answer correctly to catch it".
    ball: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><circle cx="12" cy="12" r="2.6"/></svg>`,
    // Door — "enter or leave a building".
    door: `<svg viewBox="0 0 24 24"><path d="M7 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle class="fill" cx="14" cy="12" r="1"/></svg>`,
    // Booklet — "tap the DEX (your collection)".
    book: `<svg viewBox="0 0 24 24"><path d="M6 4h10a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4z"/><path d="M6 4a2 2 0 0 0-2 2v12"/><path d="M10 8.5h5"/><path d="M10 12.5h5"/></svg>`,
    // Flask — the Isotopia brand mark.
    flask: `<svg viewBox="0 0 24 24"><path d="M9 3h6"/><path d="M10 3v6L4.8 18.2A1 1 0 0 0 5.7 20h12.6a1 1 0 0 0 .9-1.8L14 9V3"/><path d="M8.5 14h7"/></svg>`,
};

/** An inline icon span for use inside innerHTML. Decorative (aria-hidden). */
export function icon(name: keyof typeof SVG | string): string {
    return `<span class="ico" aria-hidden="true">${SVG[name] ?? ''}</span>`;
}
