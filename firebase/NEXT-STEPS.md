# Elemonsters — Firebase setup checklist

The game runs **fully offline today** (local seed + `localStorage`). Firebase adds:
a shared question bank you edit from anywhere, real per-student accounts, and a
teacher view of progress. Do these steps when you're ready — the game code
doesn't change except pasting your config and uncommenting two marked blocks.

## Decide: Firestore vs Realtime Database
- **Firestore (recommended)** — matches the spec's `questions/{id}`,
  `students/{uid}`, `dailySchedule/{classId}` model and lets you query by
  element/angle/day. Rules live in `firebase/firestore.rules`.
- **Realtime Database** — simpler, and rules + data import as literal JSON
  (`firebase/database.rules.json`, `firebase/seed/rtdb-import.json`).

The steps below assume **Firestore**; RTDB notes are called out inline.

## 1. Create the project
1. https://console.firebase.google.com → **Add project** → name it (e.g. `elemonsters`).
2. Google Analytics is optional — you can skip it.

## 2. Register a Web App & get config
1. Project Overview → **</> (Add app)** → Web → give it a nickname → Register.
2. Copy the `firebaseConfig` object it shows you.
3. Paste those values into **`src/data/firebase.ts`** (`firebaseConfig`).
4. `npm install firebase`
5. In `src/data/firebase.ts` **uncomment** the "FIREBASE DROP-IN" block.
6. In `src/data/questionSource.ts` **uncomment** the "FIREBASE DROP-IN" block.
   That's it — the game now reads questions from Firestore, with the local seed
   as an automatic fallback if config is missing.

## 3. Enable Authentication
- Build → **Authentication** → Get started.
- Enable **Anonymous** (fastest for a classroom: no passwords) and/or **Email link**.
- Students get a stable `uid` used to key their `students/{uid}` progress doc.

## 4. Create the database
- **Firestore:** Build → Firestore Database → Create → start in *production* mode
  (the rules below lock it down properly).
- **RTDB:** Build → Realtime Database → Create.

## 5. Apply security rules
- **Firestore:** Firestore → **Rules** tab → paste all of
  `firebase/firestore.rules` → **Publish**.
- **RTDB:** Realtime Database → **Rules** tab → paste
  `firebase/database.rules.json` → **Publish**.

## 6. Load the 21 seed questions
- **Firestore:**
  ```bash
  npm install firebase-admin
  # Project settings → Service accounts → Generate new private key → save as serviceAccount.json
  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node firebase/seed/seed-firestore.mjs
  ```
- **RTDB:** Realtime Database → **⋮ menu → Import JSON** → choose
  `firebase/seed/rtdb-import.json`.

## 7. Make yourself a "teacher"
The rules let only a user with a custom claim `{ teacher: true }` edit questions
and read all students. Grant it once with the Admin SDK:
```js
// set-teacher.mjs  →  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node set-teacher.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
initializeApp({ credential: applicationDefault() });
await getAuth().setCustomUserClaims('YOUR_TEACHER_UID', { teacher: true });
console.log('done');
```
(Find your UID under Authentication → Users after signing in once.)

## Still to wire (next dev milestone, not blocking)
- Sign students in on game load (anonymous auth) and read/write
  `students/{uid}` from `src/data/progress.ts`.
- Load today's `targetElementIds` from `dailySchedule` to drive which monsters
  are "in focus" each day (spec §5).
