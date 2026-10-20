// Admin-portal authentication + role tier (src/teacher.ts). Two roles:
//
//   • SUPER admin — a fixed set of accounts carrying the "teacher" custom claim
//     (set once, server-side, via firebase/set-teacher.mjs). No new supers are
//     ever minted from the app: the claim can only come from that script, and we
//     simply don't run it again. Supers alone can grant/revoke the admin role.
//   • ADMIN — a promoted registrant, recorded at admins/{uid} in RTDB (a super
//     writes it from the Admins tab). Admins manage classes/rosters but can never
//     create other admins. The RTDB rules enforce all of this server-side.
//
// Supers sign in with Google (their claim lives on that account). Promoted admins
// sign in with the SAME email + password they registered with in the game (their
// uid is what the super added to admins/{uid}), so the portal accepts both.

import {
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, User,
} from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from './firebase';

export const ALLOWED_DOMAIN = 'sad15.org';

export interface TeacherSession {
    user: User;
    isSuper: boolean;    // fixed super admin (teacher custom claim)
    isStaff: boolean;    // super OR promoted admin — may open the portal
}

/** Subscribe to auth changes. Emits null when signed out or Firebase is off. */
export function onTeacherAuth(cb: (session: TeacherSession | null) => void): void {
    const app = getFirebaseApp();
    if (!app) { cb(null); return; }
    onAuthStateChanged(getAuth(app), async (user) => {
        if (!user) { cb(null); return; }
        // Fresh token so a just-granted teacher (super) claim is picked up.
        const token = await user.getIdTokenResult(true);
        const isSuper = token.claims.teacher === true;
        let isStaff = isSuper;
        if (!isSuper) {
            // Promoted admin? Rules let a user read their own admins/{uid} entry.
            try {
                const snap = await get(ref(getDatabase(app), `admins/${user.uid}`));
                isStaff = snap.val() === true;
            } catch { isStaff = false; }
        }
        cb({ user, isSuper, isStaff });
    });
}

/** Super-admin sign-in: Google, hinted to the school domain. */
export async function signInTeacher(): Promise<void> {
    const app = getFirebaseApp();
    if (!app) throw new Error('Firebase is not configured.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ALLOWED_DOMAIN });   // hint the school domain
    await signInWithPopup(getAuth(app), provider);
}

/** Admin sign-in: the email + password they registered with in the game. */
export async function signInAdminEmail(email: string, password: string): Promise<void> {
    const app = getFirebaseApp();
    if (!app) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(getAuth(app), email.trim(), password);
}

export async function signOutTeacher(): Promise<void> {
    const app = getFirebaseApp();
    if (app) await signOut(getAuth(app));
}
