const USER = { uid: "u1", email: "lowky999@gmail.com" };
// window.__SIGNED_OUT = true (set before the page loads) starts the app signed out.
const user = () => (globalThis.__SIGNED_OUT ? null : USER);
export function getAuth() { return { currentUser: user() }; }
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(user()), 0); return () => {}; }
export async function createUserWithEmailAndPassword() {}
export async function signInWithEmailAndPassword() {}
export class GoogleAuthProvider {}
// Which Google sign-in the app used, in order: window.__authCalls ("popup" / "redirect").
const called = (how) => (globalThis.__authCalls ||= []).push(how);
export async function signInWithPopup() { called("popup"); }
export async function signInWithRedirect() { called("redirect"); }
export async function getRedirectResult() { return null; }
export async function setPersistence() {}
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};
export async function signOut() {}
