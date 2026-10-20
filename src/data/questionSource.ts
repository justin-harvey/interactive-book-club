// Single choke-point for "give me a question for this element".
// Today it resolves from the local seed bank (src/data/questions.ts) so the game
// is fully playable offline. When you're ready for Firebase, follow README
// "Enabling Firebase" — you only edit THIS file and firebase.ts, nothing in the
// game scenes changes.

import { Question, randomQuestionForElement, QUESTIONS } from './questions';
import { getFirebaseApp } from './firebase';
import { getDatabase, ref, get } from 'firebase/database';

// In-memory cache of the question bank. Seeded locally; replaced by Firestore
// data when Firebase is enabled.
let bank: Question[] = [...QUESTIONS];

/** Pull the live question bank from Realtime Database into `bank` (no-op if
 *  Firebase isn't configured — stays on the local seed). */
export async function loadQuestionBank(): Promise<void> {
    const app = getFirebaseApp();
    if (!app) return; // stay on the local seed
    const snap = await get(ref(getDatabase(app), 'questions'));
    if (snap.exists()) {
        bank = Object.values(snap.val()) as Question[];
    }
}

/** A question for the given element. Async so the Firebase swap is invisible to callers. */
export async function getQuestion(elementId: string): Promise<Question | undefined> {
    const pool = bank.filter(q => q.elementId === elementId);
    if (pool.length === 0) return randomQuestionForElement(elementId);
    return pool[Math.floor(Math.random() * pool.length)];
}
