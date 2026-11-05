const USER = { uid: "u1", email: "lowky999@gmail.com" };
// window.__SIGNED_OUT = true (set before the page loads) starts the app signed out.
const user = () => (globalThis.__SIGNED_OUT ? null : USER);
export function getAuth() { return { currentUser: user() }; }
// The options the app started Auth with: window.__authInit.
export function initializeAuth(app, options) { globalThis.__authInit = options; return getAuth(); }
// window.__AUTH_DELAY: ms before Auth reports the user (Infinity: never, like a wedged start).
export function onAuthStateChanged(auth, cb) {
  const delay = globalThis.__AUTH_DELAY || 0;
  if (delay !== Infinity) setTimeout(() => cb(user()), delay);
  return () => {};
}
export async function createUserWithEmailAndPassword() {}
export async function signInWithEmailAndPassword() {}
export class GoogleAuthProvider {}
// Which Google sign-in the app used, in order: window.__authCalls ("popup" / "redirect").
const called = (how) => (globalThis.__authCalls ||= []).push(how);
export async function signInWithPopup() { called("popup"); }
export async function signInWithRedirect() { called("redirect"); }
export async function getRedirectResult() { return null; }
export async function setPersistence() {}
export const browserLocalPersistence = { type: "LOCAL" };
export const browserSessionPersistence = { type: "SESSION" };
export const indexedDBLocalPersistence = { type: "INDEXED_DB" };
export const browserPopupRedirectResolver = {};
export async function signOut() {}
