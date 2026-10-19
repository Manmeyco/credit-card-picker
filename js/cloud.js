// Optional accounts + sync via Firebase (Auth + Firestore). Loaded lazily so the
// app still starts offline and works fully without an account.
import { firebaseConfig } from './firebase-config.js';
import { syncedPart, emailTargeting } from './sync-merge.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export const cloudEnabled = !!firebaseConfig;

let fb = null; // loaded SDK functions + instances
let user = null;
let unsubscribe = null;
let uploadTimer = null;
let reportError = () => {};
let reportSynced = () => {};

async function load() {
  if (fb) return fb;
  const [app, auth, store] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const instance = app.initializeApp(firebaseConfig);
  fb = { ...auth, ...store, auth: auth.getAuth(instance), db: store.getFirestore(instance) };
  return fb;
}

export const currentUser = () => user;

/**
 * Start listening for sign-in. Callbacks:
 *  onUser(user | null)           — signed in / out
 *  onFirstSync(remote | null)    — once per sign-in; return 'local' | 'remote' | 'combine'
 *  onRemote(remote)              — the account changed on another device
 */
export async function initCloud({ onUser, onFirstSync, onRemote, onSyncError, onSynced, getState, deviceId }) {
  if (!cloudEnabled) return;
  reportError = onSyncError || reportError;
  reportSynced = onSynced || reportSynced;
  const f = await load();

  f.onAuthStateChanged(f.auth, async (u) => {
    unsubscribe?.();
    unsubscribe = null;
    user = u;
    onUser(u);
    if (!u) return;
    const ref = f.doc(f.db, 'users', u.uid);
    try {
      const snap = await f.getDoc(ref);
      const remoteDoc = snap.exists() ? snap.data() : null;
      const remote = remoteDoc?.state ? JSON.parse(remoteDoc.state) : null;
      const choice = await onFirstSync(remote, remoteDoc?.prefs);
      if (choice !== 'remote') await upload(getState(), deviceId);
      reportSynced();
    } catch (e) {
      reportError(e);
      return;
    }
    unsubscribe = f.onSnapshot(ref, (s) => {
      const d = s.data();
      reportSynced();
      if (!d?.state || d.deviceId === deviceId || s.metadata.hasPendingWrites) return;
      onRemote(JSON.parse(d.state), d.prefs);
    }, reportError);
  });
}

export async function upload(state, deviceId, prefs) {
  if (!user || !fb) return;
  const data = {
    state: JSON.stringify(syncedPart(state)),
    deviceId,
    email: user.email || null,
    presetIds: emailTargeting(state),
    updatedAt: fb.serverTimestamp(),
  };
  if (prefs) data.prefs = prefs;
  await fb.setDoc(fb.doc(fb.db, 'users', user.uid), data, { merge: true });
}

/** Debounced upload after local edits. */
export function scheduleUpload(state, deviceId) {
  if (!user) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => upload(state, deviceId).then(() => reportSynced(), reportError), 1500);
}

export async function savePrefs(state, deviceId, prefs) {
  await upload(state, deviceId, prefs);
}

export async function signInWithGoogle() {
  const f = await load();
  const provider = new f.GoogleAuthProvider();
  try {
    await f.signInWithPopup(f.auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await f.signInWithRedirect(f.auth, provider);
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      throw e;
    }
  }
}

export async function signInWithEmail(email, password) {
  const f = await load();
  await f.signInWithEmailAndPassword(f.auth, email, password);
}

export async function createAccount(email, password) {
  const f = await load();
  await f.createUserWithEmailAndPassword(f.auth, email, password);
}

export async function resetPassword(email) {
  const f = await load();
  await f.sendPasswordResetEmail(f.auth, email);
}

export async function signOutUser() {
  const f = await load();
  await f.signOut(f.auth);
}

/** Plain-English explanation of a Firebase or loading error. Pure, for testing. */
export function describeAccountError(e, { online = true, domain = '' } = {}) {
  const code = e?.code || '';
  const known = {
    'auth/unauthorized-domain': `Sign-in is blocked because ${domain || 'this website'} isn't on Firebase's list of authorized domains yet. Add it in Firebase → Authentication → Settings → Authorized domains.`,
    'auth/operation-not-allowed': 'This sign-in method is switched off. Turn it on in Firebase → Authentication → Sign-in method.',
    'auth/configuration-not-found': "Sign-in hasn't been set up for this Firebase project yet. Open Firebase → Authentication and click Get started.",
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
    'auth/network-request-failed': online ? "The sign-in request didn't get an answer from Google's servers." : 'Your phone is offline, so you can\'t sign in right now.',
    'auth/invalid-email': "That doesn't look like a valid email address.",
    'auth/invalid-credential': 'Wrong email or password. If you signed up with Google, use "Sign in with Google" instead.',
    'auth/wrong-password': 'Wrong password.',
    'auth/user-not-found': 'There is no account with that email. Tap "Create account" to make one.',
    'auth/email-already-in-use': 'An account with that email already exists. Tap "Sign in" instead, or "Forgot password".',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/missing-password': 'Enter a password.',
    'auth/missing-email': 'Enter your email address.',
    'auth/too-many-requests': 'Too many sign-in attempts. Wait a few minutes and try again.',
    'permission-denied': "The database refused the request: its security rules don't allow it. The rules in firestore.rules may not be deployed yet (GitHub Actions → Deploy Firestore rules).",
    'failed-precondition': "The Firestore database hasn't been created yet. Open Firebase → Firestore Database → Create database.",
    'unavailable': online ? "The Firestore database didn't answer." : 'Your phone is offline.',
  };
  if (known[code]) return `${known[code]} (${code})`;
  if (code) return `${e.message || 'Unknown error'} (${code})`;
  if (!online) return 'Your phone is offline, so the sign-in service could not be loaded.';
  return `The sign-in service could not be loaded from Google (${e?.message || 'unknown error'}).`;
}
