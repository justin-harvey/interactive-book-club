// Seed the Firestore `questions` collection from questions.array.json.
//
//   npm install firebase-admin
//   # download a service-account key from Firebase Console ->
//   #   Project settings -> Service accounts -> Generate new private key
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node firebase/seed/seed-firestore.mjs
//
// Re-runnable: each question is written to a deterministic doc id (q001…), so
// running it again updates in place instead of duplicating.

import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const questions = JSON.parse(
    readFileSync(new URL('./questions.array.json', import.meta.url), 'utf8')
);

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const batch = db.batch();
questions.forEach((q, i) => {
    const id = 'q' + String(i + 1).padStart(3, '0');
    batch.set(db.collection('questions').doc(id), q);
});

await batch.commit();
console.log(`Seeded ${questions.length} questions into Firestore.`);
