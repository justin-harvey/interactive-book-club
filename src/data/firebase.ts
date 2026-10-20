// Firebase configuration + lazy init.
//
// Isotopia runs fully WITHOUT Firebase (local question seed + localStorage), so
// the game — and any fork — works offline out of the box. Firebase adds the
// shared question bank, the teacher portal, and per-student progress sync.
//
// The values below are injected at BUILD TIME from FIREBASE_* environment
// variables (see rollup.config.*.js). Set them (e.g. in your Netlify site's
// Environment settings, or a local shell) to point at your own Firebase project;
// leave them unset and the values are empty strings, so getFirebaseApp() returns
// undefined and everything falls back to local data. Nothing secret is committed.

import { initializeApp, FirebaseApp } from 'firebase/app';

// `process.env.*` here is replaced with a literal string by rollup at build time
// ('' when the variable is unset), so no real `process` exists at runtime.
declare const process: { env: Record<string, string | undefined> };

export const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
};

export function isFirebaseConfigured(): boolean {
    return firebaseConfig.apiKey.length > 0 && firebaseConfig.databaseURL.length > 0;
}

let app: FirebaseApp | undefined;

/** The initialized Firebase app, or undefined if the FIREBASE_* env vars weren't
 *  set at build time (the game then runs fully offline on local data). */
export function getFirebaseApp(): FirebaseApp | undefined {
    if (!isFirebaseConfigured()) return undefined;
    if (!app) app = initializeApp(firebaseConfig);
    return app;
}
