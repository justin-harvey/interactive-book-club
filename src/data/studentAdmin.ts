// Teacher dashboard + roster data. Every student who registers (and verifies)
// writes a students/{uid} record; staff can read all of them — this is the
// "registrant pool". Class membership is a single assignment per student:
// assignments/{studentUid} = classId (the owning staff member's uid). loadRoster
// joins the pool with assignments and flags, for a given class: who's in it, and
// who's already claimed by another class. setMembership writes the assignment.

import { getFirebaseApp } from './firebase';
import { getDatabase, ref, get, set, update } from 'firebase/database';

export interface StudentRow {
    uid: string;
    name: string;
    email: string;
    caught: number;
    seen: number;
    stats: Record<string, { attempts: number; correct: number }>;
    inClass: boolean;               // assigned to THIS class
    assignedElsewhere: boolean;     // assigned to a different class (can't claim unless super)
}

function db() {
    const app = getFirebaseApp();
    return app ? getDatabase(app) : undefined;
}

/** Every registrant, flagged relative to `classId`: in this class, or claimed by
 *  another. Sorted in-class first, then by name. Requires staff (rules gate the
 *  root reads of /students and /assignments). */
export async function loadRoster(classId: string): Promise<StudentRow[]> {
    const d = db();
    if (!d) return [];
    const [studSnap, asgSnap] = await Promise.all([
        get(ref(d, 'students')),
        get(ref(d, 'assignments')),
    ]);
    const students = studSnap.exists() ? studSnap.val() : {};
    const asg: Record<string, string> = asgSnap.exists() ? asgSnap.val() : {};
    const rows: StudentRow[] = Object.keys(students).map((uid) => {
        const v = students[uid] || {};
        const assigned = asg[uid] || null;
        return {
            uid,
            name: v.name || '(unknown)',
            email: v.email || '',
            caught: v.caught ? Object.keys(v.caught).length : 0,
            seen: v.seen ? Object.keys(v.seen).length : 0,
            stats: v.stats || {},
            inClass: assigned === classId,
            assignedElsewhere: !!assigned && assigned !== classId,
        };
    });
    return rows.sort((a, b) =>
        (Number(b.inClass) - Number(a.inClass)) || a.name.localeCompare(b.name));
}

/** Assign (true) or unassign (false) a student to/from `classId`. Admins may only
 *  claim unassigned students into their own class; supers may reassign anyone
 *  (enforced by the rules). */
export async function setMembership(classId: string, uid: string, inClass: boolean): Promise<void> {
    const d = db();
    if (!d) return;
    await set(ref(d, `assignments/${uid}`), inClass ? classId : null);
}

/** Assign/unassign many students in one atomic write. NOTE: the whole write is
 *  rejected if any single assignment fails the rules (e.g. an admin trying to
 *  claim someone already in another class), so the caller pre-filters. */
export async function setMembershipBulk(classId: string, uids: string[], inClass: boolean): Promise<void> {
    const d = db();
    if (!d || uids.length === 0) return;
    const updates: Record<string, unknown> = {};
    for (const uid of uids) {
        updates[`assignments/${uid}`] = inClass ? classId : null;
    }
    await update(ref(d), updates);
}

// ---- Admin role management (super-admins only) ----------------------------

export interface AdminRow {
    uid: string;
    name: string;
    email: string;
    isAdmin: boolean;               // true = a promoted admin (in admins/{uid})
}

/** Every registrant, flagged with whether they hold the admin role. Admins-first,
 *  then by name. Requires a super (rules gate reading /admins on the teacher
 *  claim). */
export async function loadAdmins(): Promise<AdminRow[]> {
    const d = db();
    if (!d) return [];
    const [studSnap, admSnap] = await Promise.all([
        get(ref(d, 'students')),
        get(ref(d, 'admins')),
    ]);
    const students = studSnap.exists() ? studSnap.val() : {};
    const admins: Record<string, unknown> = admSnap.exists() ? admSnap.val() : {};
    const rows: AdminRow[] = Object.keys(students).map((uid) => {
        const v = students[uid] || {};
        return {
            uid,
            name: v.name || '(unknown)',
            email: v.email || '',
            isAdmin: admins[uid] === true,
        };
    });
    return rows.sort((a, b) =>
        (Number(b.isAdmin) - Number(a.isAdmin)) || a.name.localeCompare(b.name));
}

/** Promote (true) or revoke (false) a registrant's admin role. Super-only —
 *  the rules require the teacher claim to write admins/{uid}. */
export async function setAdmin(uid: string, isAdmin: boolean): Promise<void> {
    const d = db();
    if (!d) return;
    await set(ref(d, `admins/${uid}`), isAdmin ? true : null);
}
