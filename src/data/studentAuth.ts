// Optional student sign-in via email + password. Guests play anonymously; a
// student can register with any email + password to save their collection to the
// cloud. Two things gate a "real" saved student:
//
//   1. Email verification — we send a verification link on sign-up and only treat
//      a VERIFIED user as a signed-in student (progress sync + rules writes). An
//      unverified sign-up is held in `pending` so the UI can nudge them.
//   2. Class membership — being a saved student does NOT put you on the roster;
//      the teacher adds registrants to the class from the portal (studentAdmin).
//
// So an open sign-up just lands in the "registrant pool": verified but unassigned,
// harmless until a teacher picks them. Teachers sign in separately (adminAuth).
//
// Token freshness: the database rules check `auth.token.email_verified`, which
// comes from the ID token, not from `user.emailVerified`. `user.reload()` updates
// the latter but keeps the cached token, so right after a student verifies, the
// rules would still see `false` for up to an hour (progress sync silently fails).
// Wherever we learn the user is verified, we force-refresh the token.

import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendEmailVerification, sendPasswordResetEmail, signOut,
    onAuthStateChanged, User,
} from 'firebase/auth';
import { getFirebaseApp } from './firebase';
import { attachStudent, detachStudent } from './progress';

let current: User | null = null;    // a VERIFIED, non-anonymous student, else null
let pending: User | null = null;    // signed in but email not yet verified, else null
const listeners: (() => void)[] = [];

function emit(): void { listeners.forEach(fn => fn()); }

function auth() {
    const app = getFirebaseApp();
    if (!app) throw new Error('Firebase is not configured.');
    return getAuth(app);
}

/** Start listening for student sign-in state. Call once at startup. */
export function initStudentAuth(): void {
    const app = getFirebaseApp();
    if (!app) return;
    onAuthStateChanged(getAuth(app), async (user) => {
        const real = (user && !user.isAnonymous) ? user : null;
        if (real && real.emailVerified) {
            // A token minted before the student verified still says
            // email_verified=false, and the rules would reject every sync write.
            let token = await real.getIdTokenResult();
            if (token.claims.email_verified !== true) token = await real.getIdTokenResult(true);
            // Super admins carry the "teacher" claim. They only turn up signed in
            // here because their portal session is shared in the same browser —
            // they are NOT students, so don't create a students/{uid} record for
            // them (it would pollute the roster). Promoted admins have no claim and
            // are ordinary students who may play, so they still attach normally.
            if (token.claims.teacher === true) {
                current = null;
                pending = null;
                detachStudent();
                emit();
                return;
            }
            current = real;
            pending = null;
            void attachStudent(real.uid, real.displayName || real.email || 'Student', real.email || '');
        } else {
            current = null;
            pending = real;         // non-null only while a non-anonymous user is unverified
            detachStudent();
        }
        emit();
    });
}

/** Subscribe to sign-in changes; fires immediately. Callers re-read state via
 *  currentStudent()/pendingVerification(). */
export function onStudentAuth(fn: () => void): void {
    listeners.push(fn);
    fn();
}

/** The signed-in, email-verified student (whose progress is syncing), or null. */
export function currentStudent(): User | null { return current; }

/** A signed-in user who still needs to verify their email, or null. */
export function pendingVerification(): User | null { return pending; }

/** Create a new account and send a verification email. Leaves them signed in
 *  (unverified) so they can resend / verify from the same session. */
export async function registerStudent(email: string, password: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
    await sendEmailVerification(cred.user);
}

/** Sign in an existing account. */
export async function loginStudent(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth(), email.trim(), password);
}

/** Re-send the verification email to the currently signed-in (unverified) user. */
export async function resendVerification(): Promise<void> {
    const u = pending;
    if (!u) throw new Error('Sign in first, then resend.');
    await sendEmailVerification(u);
}

/** Reload the current user so a just-clicked verification link takes effect in
 *  this session. Returns true once verified. */
export async function refreshVerification(): Promise<boolean> {
    const u = pending || current;
    if (!u) return false;
    await u.reload();
    if (u.emailVerified) {
        await u.getIdToken(true);   // so the rules see email_verified=true now
        current = u;
        pending = null;
        void attachStudent(u.uid, u.displayName || u.email || 'Student', u.email || '');
        emit();
        return true;
    }
    return false;
}

/** Send a password-reset email. */
export async function resetStudentPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth(), email.trim());
}

export async function signOutStudent(): Promise<void> {
    const app = getFirebaseApp();
    if (app) await signOut(getAuth(app));
}
