// One-time: grant a user the "teacher" custom claim so the admin portal can
// write questions / schedule / settings (the RTDB rules check auth.token.teacher).
//
// Steps:
//   1. Firebase console -> Project settings -> Service accounts ->
//      "Generate new private key" -> save the file as serviceAccount.json here.
//   2. Open the teacher portal (/teacher.html) and sign in once with your
//      @sad15.org Google account, then copy your UID from
//      Authentication -> Users in the console.
//   3. Run:
//        npm install firebase-admin
//        GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccount.json \
//          node firebase/set-teacher.mjs <YOUR_UID>
//   4. Sign out and back in on the portal so the new claim is in your token.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.argv[2];
const remove = ['off', 'remove', 'false'].includes((process.argv[3] || '').toLowerCase());
if (!uid) {
    console.error('Usage: node firebase/set-teacher.mjs <UID> [off]');
    console.error('  add:    node firebase/set-teacher.mjs <UID>');
    console.error('  remove: node firebase/set-teacher.mjs <UID> off');
    process.exit(1);
}

initializeApp({ credential: applicationDefault() });
await getAuth().setCustomUserClaims(uid, remove ? null : { teacher: true });
console.log(remove
    ? `Removed teacher access from ${uid}. They must sign out and back in.`
    : `Granted teacher access to ${uid}. They must sign out and back in to refresh their token.`);
