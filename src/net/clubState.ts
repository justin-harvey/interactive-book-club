// Shared, non-ephemeral book-club state that lives beyond any one scene: right now just
// the "Now Reading" pick. The presence client pushes the authoritative value here (from
// the server, on join and on change); UI that cares — the Library's Now Reading sign —
// reads it and subscribes for updates. Keeping it in one small store avoids threading the
// value through scene handlers, which get swapped as the player moves between rooms.

type Listener = (bookId: string) => void;

let nowReadingId = '';
const listeners = new Set<Listener>();

export function getNowReading(): string {
    return nowReadingId;
}

// Apply the authoritative value from the server (or an optimistic local set). No-ops if
// unchanged so we don't churn listeners.
export function setNowReading(bookId: string): void {
    const id = String(bookId || '');
    if (id === nowReadingId) return;
    nowReadingId = id;
    listeners.forEach(fn => fn(id));
}

// Subscribe to pick changes; returns an unsubscribe fn.
export function onNowReadingChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
