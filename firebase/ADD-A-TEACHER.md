# How to add (or remove) a teacher

Teachers get access to the admin portal at **`/teacher.html`** — where you edit
questions, set the release schedule, tune settings, and see student progress.

Access is controlled by a "teacher" flag on a Google account (a Firebase custom
claim). Any Google account can be a teacher — it does **not** have to be an
`@sad15.org` account.

Current teachers: `jharvood@gmail.com`, `aharvey@sad15.org`.

---

## To add a teacher

**1. Have them sign in once.**
The new teacher opens **https://is0topia.netlify.app/teacher.html** and clicks
**Sign in with Google**. They'll see a **"Not authorized"** screen — that's
expected; it just means they don't have the teacher flag yet. (Signing in once
creates their account so we can find its ID.)

**2. Find their User UID.**
In the [Firebase console](https://console.firebase.google.com/) → project
**isotopia-2809c** → **Authentication → Users** → find their email → copy the
**User UID** (a long string like `aQuCAefgOcUBAzp82OujjjsSDfp1`).

**3. Grant the teacher flag.** From the project folder, with the service-account
key in place (see below):

```bash
npm install firebase-admin        # first time only
GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccount.json \
  node firebase/set-teacher.mjs <THEIR_UID>
```

**4. They sign out and back in** at `/teacher.html` to refresh their token. Done —
they now have full portal access.

## To remove a teacher

Same as above, with `off` on the end:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccount.json \
  node firebase/set-teacher.mjs <THEIR_UID> off
```

---

## The service-account key (`firebase/serviceAccount.json`)

Granting/removing teachers needs a private admin key. If you don't have
`firebase/serviceAccount.json`:

1. Firebase console → ⚙️ **Project settings → Service accounts**
2. **Generate new private key** → save the downloaded file as
   **`firebase/serviceAccount.json`**.

**Keep this file private.** It's already git-ignored, so it will never be
committed — do not share it or paste its contents anywhere.

> Note (Node 18): if `firebase-admin` fails to load with an ESM/`jose` error,
> install the pinned version instead: `npm install firebase-admin@11`.
