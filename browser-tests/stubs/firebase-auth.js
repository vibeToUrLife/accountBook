const USER = { uid: "u1", email: "lowky999@gmail.com" };
export function getAuth() { return { currentUser: USER }; }
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(USER), 0); return () => {}; }
export async function createUserWithEmailAndPassword() {}
export async function signInWithEmailAndPassword() {}
export class GoogleAuthProvider {}
export async function signInWithPopup() {}
export async function signInWithRedirect() {}
export async function getRedirectResult() { return null; }
export async function setPersistence() {}
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};
export async function signOut() {}
