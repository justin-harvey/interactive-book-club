// Read-only: look up the two superadmin accounts and print UID + custom claims,
// so we can confirm they actually carry the `teacher: true` claim.
//   GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccount.json node firebase/verify-supers.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const EMAILS = ['jharvood@gmail.com', 'aharvey@sad15.org'];

initializeApp({ credential: applicationDefault() });
const auth = getAuth();

for (const email of EMAILS) {
    try {
        const u = await auth.getUserByEmail(email);
        const claims = u.customClaims || {};
        const isSuper = claims.teacher === true;
        console.log(`\n${email}`);
        console.log(`  uid:            ${u.uid}`);
        console.log(`  email_verified: ${u.emailVerified}`);
        console.log(`  custom claims:  ${JSON.stringify(claims)}`);
        console.log(`  SUPER (teacher:true)? ${isSuper ? 'YES ✅' : 'NO ❌'}`);
    } catch (e) {
        console.log(`\n${email}`);
        console.log(`  NOT FOUND / error: ${e.code || e.message}`);
    }
}
