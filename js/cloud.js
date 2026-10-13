// Optional accounts + sync via Firebase (Auth + Firestore). Loaded lazily so the
// app still starts offline and works fully without an account.
import { firebaseConfig } from './firebase-config.js';
import { syncedPart, emailTargeting } from './sync-merge.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const EMAIL_KEY = 'pick-a-card:email-for-signin';

export const cloudEnabled = !!firebaseConfig;

let fb = null; // loaded SDK functions + instances
let user = null;
let unsubscribe = null;
let uploadTimer = null;

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
export async function initCloud({ onUser, onFirstSync, onRemote, getState, deviceId }) {
  if (!cloudEnabled) return;
  const f = await load();

  // Finish an email-link sign-in if we arrived from the link.
  if (f.isSignInWithEmailLink(f.auth, location.href)) {
    let email = localStorage.getItem(EMAIL_KEY);
    if (!email) email = prompt('Confirm your email to finish signing in');
    if (email) {
      try {
        await f.signInWithEmailLink(f.auth, email, location.href);
        localStorage.removeItem(EMAIL_KEY);
      } finally {
        history.replaceState(null, '', location.pathname);
      }
    }
  }

  f.onAuthStateChanged(f.auth, async (u) => {
    unsubscribe?.();
    unsubscribe = null;
    user = u;
    onUser(u);
    if (!u) return;
    const ref = f.doc(f.db, 'users', u.uid);
    const snap = await f.getDoc(ref);
    const remoteDoc = snap.exists() ? snap.data() : null;
    const remote = remoteDoc?.state ? JSON.parse(remoteDoc.state) : null;
    const choice = await onFirstSync(remote, remoteDoc?.prefs);
    if (choice !== 'remote') await upload(getState(), deviceId);
    unsubscribe = f.onSnapshot(ref, (s) => {
      const d = s.data();
      if (!d?.state || d.deviceId === deviceId || s.metadata.hasPendingWrites) return;
      onRemote(JSON.parse(d.state), d.prefs);
    });
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
  uploadTimer = setTimeout(() => upload(state, deviceId).catch((e) => console.warn('Sync failed', e)), 1500);
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

export async function sendEmailLink(email) {
  const f = await load();
  await f.sendSignInLinkToEmail(f.auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
  localStorage.setItem(EMAIL_KEY, email);
}

export async function signOutUser() {
  const f = await load();
  await f.signOut(f.auth);
}
