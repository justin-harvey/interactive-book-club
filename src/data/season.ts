// Global "season" epoch. One value at RTDB `season/current` (a string id the
// staff choose, e.g. "2026-fall"). Every client stamps the season it last reset
// for; when staff bump this value, each student's game wipes its collection ONCE
// on next load and restamps — so the official season starts from a clean dex.
//
// Why an epoch instead of a direct admin wipe: the database rules let a student
// write only their OWN students/{uid} record (staff can read all but not write
// them), and a one-time cloud delete would be undone by returning devices that
// still hold progress in localStorage. The epoch makes each client reset itself
// (cloud + local), respecting the rules and keeping the roster (name/email)
// intact. See progress.ts applySeasonReset / maybeResetForSeason.

import { getFirebaseApp } from './firebase';
import { getDatabase, ref, get, set } from 'firebase/database';

function db() {
    const app = getFirebaseApp();
    return app ? getDatabase(app) : undefined;
}

// Cached so repeated reads (startup + each sign-in) don't re-hit the network.
let cached: string | null = null;
let loaded = false;

/** Read the current global season id from RTDB (cached after the first call).
 *  Returns null if unset or Firebase is unreachable — in which case nothing
 *  resets (a missing season must never trigger a wipe). */
export async function loadSeasonId(): Promise<string | null> {
    if (loaded) return cached;
    const d = db();
    if (!d) { loaded = true; cached = null; return null; }
    try {
        const snap = await get(ref(d, 'season/current'));
        cached = snap.exists() ? String(snap.val()) : null;
    } catch {
        cached = null;          // offline/transient — treat as "no season known"
    }
    loaded = true;
    return cached;
}

/** The cached season id (call loadSeasonId first). */
export function seasonId(): string | null { return cached; }

/** Set the global season — staff only (the rules require the teacher claim or an
 *  admin). Bumping this to a new value starts a new season: every student's dex
 *  resets once on next load. Also updates the local cache. */
export async function setSeason(id: string): Promise<void> {
    const d = db();
    if (!d) throw new Error('Firebase is not configured.');
    const value = id.trim();
    if (!value) throw new Error('Season id cannot be empty.');
    await set(ref(d, 'season/current'), value);
    cached = value;
    loaded = true;
}
