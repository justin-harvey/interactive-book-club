# Isotopia — Accounts & Progress Sync (scope)

Scope for giving each student a real identity and syncing their Seen/Caught
progress to the cloud, plus a teacher view. Written to be reviewed **before**
any code. Supersedes the anonymous-auth assumptions in `NEXT-STEPS.md`.

## Setting (decides the design)
- **Audience:** high-school **AP Chemistry** students (capable of a real login).
- **Devices:** **1:1 — students do NOT share iPads.** (So there is no
  shared-device problem; anonymous per-device auth is unnecessary and fragile.)
- **Identity provider:** **Google Sign-In**, locked to the **`@sad15.org`**
  domain. Confirmed: `sad15.org` mail is Google Workspace (MX → google.com).
  SAD 15 = Gray–New Gloucester, the same Gray, Maine the town map is themed on.

## Decision: Google SSO, domain-restricted
Chosen over anonymous-per-device and email/password because it is **less work
and more durable**:
- One tap to log in; no passwords to create/distribute/reset, no roster typing.
- `auth.uid` is stable per student across any device/browser → existing
  `students/{uid}` rules work unchanged; progress survives cache clears, browser
  changes, loaner devices, doing it on a laptop, etc.
- The teacher dashboard gets real names/emails from the Google profile for free.
- Restricting to `@sad15.org` keeps outsiders out.

## Data model (Realtime Database)
```
teachers/{uid}                     { name, email, classIds: { <classId>: true } }
classCodes/{joinCode}              { classId }                     // lookup index for join
classes/{classId}
  ├─ name, teacherUid, joinCode
  ├─ settings/ { questionsToCatch, activeElements: { <elementId>: true } }
  └─ members/ { <studentUid>: true }                              // for dashboard enumeration
students/{uid}
  ├─ classId, name, email
  ├─ seen/    { <elementId>: true }
  ├─ caught/  { <elementId>: { ts } }
  └─ stats/   { <elementId>: { attempts, correct } }              // powers mastery view
```
`stats` is cheap to write now and means the dashboard (Phase 3) needs no
gameplay changes later. `members` gives the teacher a way to list a class's
students without querying across all of `students/`.

## Security rules (replaces firebase/database.rules.json)
```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "questions":     { ".read": "auth != null",
                       ".write": "auth != null && auth.token.teacher === true" },
    "dailySchedule": { ".read": "auth != null",
                       ".write": "auth != null && auth.token.teacher === true" },

    "classCodes": {
      ".read": "auth != null",
      "$code": { ".write": "auth != null && auth.token.teacher === true" }
    },

    "classes": {
      "$classId": {
        ".read": "auth != null",
        ".write": "auth != null && auth.token.teacher === true",
        "members": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid"    // student joins by adding self
          }
        }
      }
    },

    "students": {
      "$uid": {
        ".read":  "auth != null && (auth.uid === $uid || auth.token.teacher === true)",
        ".write": "auth != null && auth.uid === $uid && auth.token.email.matches(/@sad15[.]org$/)",
        ".validate": "newData.hasChildren(['classId','name'])"
      }
    }
  }
}
```
Domain lock lives in the `students` write rule (`auth.token.email.matches`).
Teacher read of all students is claim-gated; fine for a single teacher, can be
scoped per-class later if needed.

## Auth / join flow
1. **Launch → Google Sign-In** (domain-hinted `hd=sad15.org`). Silent re-auth on
   later launches → straight into the game.
2. **First time only → "Enter your class code."** App reads
   `classCodes/{code}` → `classId`, then writes `students/{uid}.classId`,
   `name`, `email`, and `classes/{classId}/members/{uid} = true`.
3. Play. Progress writes go to `students/{uid}` (see Phase 2).

## Phased build
1. **Google auth + class-code binding** — enable Google provider in the Firebase
   console (domain-restricted); add a small sign-in screen (DOM overlay, matches
   the GBA UI); one-time class-code capture + membership write. Replace/extend
   `src/data/auth.ts` (`ensureSignedIn` → real Google sign-in, expose
   `currentUid`, name, email, `classId`).
2. **Progress sync** — swap `src/data/progress.ts` `load/save` from
   `localStorage` to `students/{uid}`. Keep a `localStorage` cache: read cache
   first for instant start, reconcile with RTDB, write-through on
   `markSeen/markCaught`, and also record `stats` on each answered question
   (needs `QuizOverlay` to report correct/attempt — one extra call). Isolated:
   game scenes don't change.
3. **Teacher dashboard** — teacher signs in (has `teacher` claim), picks a class,
   reads `members` → each `students/{uid}`: per-student caught/seen and
   per-element mastery from `stats`. Read-only first. Likely a separate DOM view
   or a lightweight `/teacher` page.
4. **Teacher controls (later)** — element release (`settings.activeElements`
   gates which Elementals spawn / are catchable) and capture difficulty
   (`settings.questionsToCatch`, ties into the HP-bar battle idea).

## One-time backend setup
- **Enable Google provider** (Authentication → Sign-in method), add
  `sad15.org` under Authorized domains + the Netlify domain.
- **Grant the teacher claim** once via Admin SDK (recipe already in
  `NEXT-STEPS.md` §7). Custom claims can't be set from the console.
- No Cloud Functions required for the MVP — sign-in and class binding are
  client-side + rules. (A Function could later auto-create the teacher/class or
  validate codes more strictly.)

## Offline / resilience
- Keep the `localStorage` cache so a dropped connection never blocks a student
  mid-game; sync reconciles when back online. The game already degrades to the
  local question seed if RTDB is unreachable — same philosophy for progress.

## Migrating existing local progress
- On first signed-in launch, if `localStorage` has `elemonsters.progress.v1` and
  the student's cloud record is empty, push the local Seen/Caught up once (best
  effort), then treat cloud as source of truth.

## Open decisions (for review)
1. **Sign-in gate:** require login to play at all, or allow a "guest/offline"
   mode (local only) with a prompt to sign in to save? (Recommend: require
   sign-in, since it's a graded class tool — but easy to allow guest.)
2. **Class creation:** teacher self-serve (a minimal teacher setup screen) vs.
   we seed the first class + code by hand for the pilot? (Recommend: hand-seed
   one class for the pilot, build self-serve in Phase 3.)
3. **Dashboard surface:** in-app teacher view vs. a separate `/teacher` route?
4. **How many classes/sections** this term (affects whether we bother with
   multi-class UI now or hard-code one).
```
