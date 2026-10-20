// Start a new season: clear every student's Isotopedex and arm the season epoch.
// Uses the Admin SDK, which BYPASSES the database rules — so it works even if the
// `season` rule hasn't been deployed and regardless of who's signed in. This is
// the scripted equivalent of the teacher portal's "Start new season" button.
//
// What it does:
//   1. Sets season/current = <label>. Every player's game compares this to the
//      season it last cleared for and, on a new value, wipes ITS OWN progress once
//      on next load (cloud + localStorage: dex, stats, evolutions, items, puzzles).
//      This is what clears the local-only stores on returning devices — it needs
//      the deployed build to include the season code (src/data/season.ts etc.).
//   2. Directly zeroes seen/caught/stats on every existing students/{uid} record
//      right now (keeping name/email + class assignment), and stamps each with the
//      new season so clients don't double-reset. This makes the roster read clean
//      immediately, even for students who never open the game again.
//
// Steps:
//   1. Service-account key at firebase/serviceAccount.json (see ADD-A-TEACHER.md).
//   2. Node 22 (nvm use 22) — firebase-admin's deps don't run on Node 18.
//   3. Run:
//        GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccount.json \
//          node firebase/reset-season.mjs <SEASON_LABEL>
//      e.g.  node firebase/reset-season.mjs 2026-fall
//
//   Add  --season-only  to arm the epoch WITHOUT touching existing cloud records
//   (let each client clear itself on next load):
//        node firebase/reset-season.mjs 2026-fall --season-only

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'node:fs';

const label = (process.argv[2] || '').trim();
const seasonOnly = process.argv.includes('--season-only');
if (!label || label.startsWith('--')) {
    console.error('Usage: node firebase/reset-season.mjs <SEASON_LABEL> [--season-only]');
    console.error('  e.g. node firebase/reset-season.mjs 2026-fall');
    process.exit(1);
}

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL
    || 'https://isotopia-2809c-default-rtdb.firebaseio.com';

// Load the service-account key directly from the repo (no env var needed), so the
// command stays short and can't get mangled by terminal line-wrapping. Falls back
// to GOOGLE_APPLICATION_CREDENTIALS if the file isn't where we expect.
const KEY_PATH = new URL('./serviceAccount.json', import.meta.url);
let credential;
try {
    credential = cert(JSON.parse(readFileSync(KEY_PATH, 'utf8')));
} catch {
    credential = applicationDefault();
}

initializeApp({ credential, databaseURL: DATABASE_URL });
const db = getDatabase();

// 1. Arm the epoch.
await db.ref('season/current').set(label);
console.log(`season/current = "${label}" ✅  (clients self-reset on next load)`);

// 2. Clear existing cloud dexes now (unless --season-only).
if (seasonOnly) {
    console.log('--season-only: left existing students/{uid} records untouched.');
} else {
    const snap = await db.ref('students').get();
    const students = snap.exists() ? snap.val() : {};
    const uids = Object.keys(students);
    if (uids.length === 0) {
        console.log('No student records to clear.');
    } else {
        const updates = {};
        for (const uid of uids) {
            // Remove progress children, keep name/email, stamp the new season.
            updates[`students/${uid}/seen`] = null;
            updates[`students/${uid}/caught`] = null;
            updates[`students/${uid}/stats`] = null;
            updates[`students/${uid}/season`] = label;
        }
        await db.ref().update(updates);
        console.log(`Cleared dex (seen/caught/stats) for ${uids.length} student record(s); names/emails kept.`);
    }
}

console.log('Done. Students see a fresh dex on their next load.');
process.exit(0);
