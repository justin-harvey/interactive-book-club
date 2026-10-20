// Per-class settings + the 40-day release schedule, stored at
// classes/{classId}/settings in Realtime Database. Each staff member (super or
// admin) owns ONE class, keyed by their own uid (classId === owner uid), with a
// meta record {name, color}. A student belongs to one class via
// assignments/{studentUid} = classId, which staff set from the portal; the game
// resolves the student's class from there and reads that class's schedule.
//
// The teacher portal writes settings/meta for the owner's class; the game reads
// the student's assigned class to decide which Elementals are "released" and how
// many correct answers catch one.

import { getFirebaseApp } from './firebase';
import { getDatabase, ref, get, set } from 'firebase/database';
import { currentUid } from './auth';

export const UNIT_LENGTH_DAYS = 40;
export const DEFAULT_CLASS_COLOR = '#3a7afe';

export interface ClassSettings {
    questionsToCatch: number;              // correct answers needed to catch (1..5)
    unitStartDate: string;                 // 'YYYY-MM-DD', day 1 of the unit ('' = unset)
    releaseAllNow: boolean;                // testing override: everything unlocked
    release: Record<string, number>;       // elementId -> unlock day (1..UNIT_LENGTH_DAYS)
}

export interface ClassMeta {
    name: string;                          // teacher-chosen class name
    color: string;                         // hex color, portal-only styling
    ownerUid: string;                      // the staff member who owns this class (== classId)
}

export const DEFAULT_SETTINGS: ClassSettings = {
    questionsToCatch: 1,
    unitStartDate: '',
    releaseAllNow: true,
    release: {},
};

function db() {
    const app = getFirebaseApp();
    return app ? getDatabase(app) : undefined;
}

/** The class a student is assigned to, or null if unassigned. */
export async function resolveClassId(studentUid: string): Promise<string | null> {
    const d = db();
    if (!d || !studentUid) return null;
    const snap = await get(ref(d, `assignments/${studentUid}`));
    return snap.exists() ? String(snap.val()) : null;
}

export async function loadSettings(classId: string): Promise<ClassSettings> {
    const d = db();
    if (!d || !classId) return { ...DEFAULT_SETTINGS };
    const snap = await get(ref(d, `classes/${classId}/settings`));
    return { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.val() : {}) };
}

export async function saveSettings(classId: string, s: ClassSettings): Promise<void> {
    const d = db();
    if (!d) throw new Error('Firebase is not configured.');
    if (!classId) throw new Error('No class to save to.');
    await set(ref(d, `classes/${classId}/settings`), s);
}

/** A class's name/color, or null if it hasn't been set up yet. */
export async function loadClassMeta(classId: string): Promise<ClassMeta | null> {
    const d = db();
    if (!d || !classId) return null;
    const snap = await get(ref(d, `classes/${classId}/meta`));
    if (!snap.exists()) return null;
    return { name: '', color: DEFAULT_CLASS_COLOR, ownerUid: classId, ...snap.val() };
}

export async function saveClassMeta(classId: string, meta: ClassMeta): Promise<void> {
    const d = db();
    if (!d) throw new Error('Firebase is not configured.');
    if (!classId) throw new Error('No class to save to.');
    await set(ref(d, `classes/${classId}/meta`), { ...meta, ownerUid: classId });
}

/** Which day of the 40-day unit "today" is (1..UNIT_LENGTH_DAYS), or the last
 *  day if no start date is set. */
export function currentUnitDay(s: ClassSettings, today: Date = new Date()): number {
    if (!s.unitStartDate) return UNIT_LENGTH_DAYS;
    const start = new Date(s.unitStartDate + 'T00:00:00');
    const day = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
    return Math.max(1, Math.min(UNIT_LENGTH_DAYS, day));
}

/** Whether an element is released to students right now. With releaseAllNow on,
 *  everything is unlocked. Otherwise an element is released only once it has an
 *  unlock day that has arrived — an element with NO assigned day stays hidden
 *  ("not scheduled yet"). */
export function isElementReleased(
    s: ClassSettings, elementId: string, today: Date = new Date(),
): boolean {
    if (s.releaseAllNow) return true;
    const day = s.release[elementId];
    if (day == null) return false;            // unscheduled = not released yet
    return day <= currentUnitDay(s, today);
}

// --- Cached copy for the game. Loaded once at startup (game.ts) so scenes and
// the Isotopedex can check release state synchronously. Defaults (everything
// released) until loaded / if Firebase is unreachable / if the student isn't
// assigned to a class yet, so the game never hides content by accident.
let cache: ClassSettings = { ...DEFAULT_SETTINGS };

export async function loadAndCacheSettings(): Promise<ClassSettings> {
    try {
        const uid = currentUid();
        const classId = uid ? await resolveClassId(uid) : null;
        cache = classId ? await loadSettings(classId) : { ...DEFAULT_SETTINGS };
    } catch {
        cache = { ...DEFAULT_SETTINGS };
    }
    return cache;
}

export function cachedSettings(): ClassSettings { return cache; }

/** Release check against the cached settings — for game code. */
export function elementReleased(elementId: string): boolean {
    return isElementReleased(cache, elementId);
}
