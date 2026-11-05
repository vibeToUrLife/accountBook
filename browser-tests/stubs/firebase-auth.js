const USER = { uid: "u1", email: "lowky999@gmail.com" };
// window.__SIGNED_OUT = true (set before the page loads) starts the app signed out.
const user = () => (globalThis.__SIGNED_OUT ? null : USER);
export function getAuth() { return { currentUser: user() }; }
// The options the app started Auth with: window.__authInit.
// window.__AUTH_HELPER_NEVER_ANSWERS: as in the iPhone home-screen app, where Firebase,
// given its popup/redirect helper here, loads it as Auth starts and waits 5 s for an
// answer that never comes before Auth is ready (onAuthStateChanged, getRedirectResult).
let started = Promise.resolve();
export function initializeAuth(app, options) {
  globalThis.__authInit = options;
  if (globalThis.__AUTH_HELPER_NEVER_ANSWERS && options?.popupRedirectResolver) started = new Promise((r) => setTimeout(r, 5000));
  return getAuth();
}
// window.__AUTH_DELAY: ms before Auth reports the user (Infinity: never, like a wedged start).
export function onAuthStateChanged(auth, cb) {
  const delay = globalThis.__AUTH_DELAY || 0;
  if (delay !== Infinity) started.then(() => setTimeout(() => cb(user()), delay));
  return () => {};
}
export async function createUserWithEmailAndPassword() {}
export async function signInWithEmailAndPassword() {}
export class GoogleAuthProvider { static credential(idToken) { return { idToken }; } }
// Signing in with a Google ID token: noted as "credential:<token>", and the user is signed in.
export async function signInWithCredential(auth, credential) { called("credential:" + credential.idToken); globalThis.__SIGNED_OUT = false; }
// Which Google sign-in the app used, in order: window.__authCalls ("popup" / "redirect").
const called = (how) => (globalThis.__authCalls ||= []).push(how);
// Like Firebase: the popup and redirect calls need the popup/redirect helper, passed to
// the call or given when Auth started (auth/argument-error otherwise).
const needsHelper = (resolver) => {
  if (!resolver && !globalThis.__authInit?.popupRedirectResolver) throw Object.assign(new Error("Firebase: Error (auth/argument-error)."), { code: "auth/argument-error" });
};
export async function signInWithPopup(auth, provider, resolver) { needsHelper(resolver); called("popup"); }
export async function signInWithRedirect(auth, provider, resolver) { needsHelper(resolver); called("redirect"); }
export async function getRedirectResult(auth, resolver) { await started; needsHelper(resolver); return null; }
export async function setPersistence() {}
export const browserLocalPersistence = { type: "LOCAL" };
export const browserSessionPersistence = { type: "SESSION" };
export const indexedDBLocalPersistence = { type: "INDEXED_DB" };
export const browserPopupRedirectResolver = {};
export async function signOut() {}
