import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  initializeAuth,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { isIosHomeScreenApp, useDirectGoogleSignIn, googleAuthUrl, parseGoogleReturn, jwtPayload, randomId } from "./js/google-signin.js?v=1";

// Set just before a Firebase redirect to Google (browsers whose popups are blocked),
// checked when the app loads again, so a sign-in that comes back without a result
// is reported, not silent.
const REDIRECT_PENDING_KEY = "accountBook.googleRedirect";
// The iPhone home-screen app's own Google sign-in (js/google-signin.js): what it
// expects back ({ state, nonce, at }), and what /__/auth/handler received.
const GOOGLE_PENDING_KEY = "accountBook.googleSignIn";
const GOOGLE_RETURN_KEY = "accountBook.googleReturn";
// A sign-in started longer ago than this and never finished isn't reported.
const GOOGLE_PENDING_MAX_MS = 15 * 60 * 1000;

let firebaseConfig = null;
let app = null;
let auth = null;
let db = null;
let authPersistenceMode = "unknown";
let googleSignIn = { clientId: "", redirectHosts: [] };

export async function initFirebase() {
  try {
    // Optional file the user will create.
    const mod = await import("./firebase-config.js?v=3");
    firebaseConfig = mod.firebaseConfig;
    googleSignIn = { clientId: mod.googleWebClientId || "", redirectHosts: mod.googleRedirectHosts || [] };
  } catch {
    return {
      ok: false,
      reason:
        "Missing Firebase config. Create firebase-config.js (copy from firebase-config.example.js) and fill in your keys.",
    };
  }

  app = initializeApp(firebaseConfig);
  // The session lives in localStorage (sessionStorage if that's blocked), not in
  // IndexedDB, Firebase's default. On iPhone, a page hidden while it loads (a
  // home-screen app reloaded in the background, the screen locking) can have its
  // IndexedDB closed under Firebase's first read; Auth then never reports signed in
  // or out (firebase-js-sdk #10311) and the app stayed at just its header. Earlier
  // versions moved the session to localStorage on every launch, so it is found there.
  auth = initializeAuth(app, {
    persistence: [browserLocalPersistence, browserSessionPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });

  // Persistent local cache: records load from the device when offline and
  // writes made offline are queued and synced once the connection returns.
  // The multi-tab manager lets several open tabs share the same cache.
  // If the browser refuses (no IndexedDB), fall back to the in-memory cache.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }

  // Which of those Auth can use; "memory" means the session won't survive a reload.
  authPersistenceMode = storageWorks("localStorage") ? "local" : storageWorks("sessionStorage") ? "session" : "memory";

  // Back from the home-screen app's own Google sign-in: finish it.
  const googleReturn = takeGoogleReturn();
  if (googleReturn) {
    try {
      await finishGoogleSignIn(googleReturn);
    } catch (e) {
      return {
        ok: true,
        redirectError: { code: e?.code || "auth/redirect-incomplete", message: e?.message || "" },
        persistenceMode: authPersistenceMode,
      };
    }
  }

  // If a Firebase sign-in redirect just happened, process it so errors don't get swallowed.
  let redirectPending = false;
  try {
    redirectPending = localStorage.getItem(REDIRECT_PENDING_KEY) === "1";
    localStorage.removeItem(REDIRECT_PENDING_KEY);
  } catch {
    // storage blocked: nothing to check
  }
  try {
    const result = await getRedirectResult(auth);
    // Back from Google's page with no result: say so rather than quietly showing
    // the sign-in form again.
    if (redirectPending && !result && !auth.currentUser) {
      return {
        ok: true,
        redirectError: { code: "auth/redirect-incomplete", message: "" },
        persistenceMode: authPersistenceMode,
      };
    }
  } catch (e) {
    return {
      ok: true,
      redirectError: {
        code: e?.code || "",
        message: e?.message || "",
      },
      persistenceMode: authPersistenceMode,
    };
  }

  return { ok: true, redirectError: null, persistenceMode: authPersistenceMode };
}

export function watchAuth(callback) {
  if (!auth) throw new Error("Firebase not initialized");
  return onAuthStateChanged(auth, callback);
}

export async function signUpWithEmailPassword(email, password) {
  if (!auth) throw new Error("Firebase not initialized");
  await createUserWithEmailAndPassword(auth, email, password);
  return auth.currentUser;
}

export async function signInWithEmailPassword(email, password) {
  if (!auth) throw new Error("Firebase not initialized");
  await signInWithEmailAndPassword(auth, email, password);
  return auth.currentUser;
}

function storageWorks(name) {
  try {
    const store = window[name];
    store.setItem("accountBook.storageTest", "1");
    store.removeItem("accountBook.storageTest");
    return true;
  } catch {
    return false;
  }
}

/** What the home-screen app's Google sign-in left behind, cleared as it's read. */
function takeGoogleReturn() {
  let fragment = null, pending = null;
  try {
    fragment = localStorage.getItem(GOOGLE_RETURN_KEY);
    pending = JSON.parse(localStorage.getItem(GOOGLE_PENDING_KEY) || "null");
    localStorage.removeItem(GOOGLE_RETURN_KEY);
    localStorage.removeItem(GOOGLE_PENDING_KEY);
  } catch {
    return null;
  }
  if (fragment === null && !pending) return null;
  // Left for Google long ago and never came back: nothing worth reporting now.
  if (fragment === null && !(Date.now() - (pending.at || 0) < GOOGLE_PENDING_MAX_MS)) return null;
  return { fragment, pending };
}

async function finishGoogleSignIn({ fragment, pending }) {
  const back = parseGoogleReturn(fragment);
  // The token must answer the request this app made (state) and carry its nonce, so
  // a token from elsewhere, or one replayed, isn't accepted.
  const claims = back.idToken ? jwtPayload(back.idToken) : null;
  if (!back.idToken || !pending || back.state !== pending.state || !claims || claims.nonce !== pending.nonce) {
    const err = new Error(back.error ? `Google sign-in: ${back.error}` : "Google sign-in didn't finish");
    err.code = "auth/redirect-incomplete";
    throw err;
  }
  await signInWithCredential(auth, GoogleAuthProvider.credential(back.idToken));
}

/** The home-screen app's Google sign-in: off to Google, back via /__/auth/handler. */
function goToGoogle() {
  const state = randomId(), nonce = randomId();
  localStorage.setItem(GOOGLE_PENDING_KEY, JSON.stringify({ state, nonce, at: Date.now() }));
  location.assign(googleAuthUrl({ clientId: googleSignIn.clientId, redirectUri: `${location.origin}/__/auth/handler`, state, nonce }));
}

async function redirectToGoogle(provider) {
  try {
    localStorage.setItem(REDIRECT_PENDING_KEY, "1");
  } catch {
    // storage blocked: the sign-in still works, it just can't report a failed return
  }
  await signInWithRedirect(auth, provider);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase not initialized");
  const provider = new GoogleAuthProvider();

  // The iPhone home-screen app goes to Google itself (see js/google-signin.js):
  // a popup can't hand its result back there, and Firebase's redirect never got its
  // result back either.
  if (useDirectGoogleSignIn({ iosHomeScreenApp: isIosHomeScreenApp(), host: location.host, ...googleSignIn })) {
    goToGoogle();
    return null;
  }

  // In a browser the popup keeps the page as it is. If the environment blocks
  // popups, fall back to redirect.
  try {
    await signInWithPopup(auth, provider);
    return auth.currentUser;
  } catch (e) {
    const code = e?.code || "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await redirectToGoogle(provider);
      return null;
    }
    throw e;
  }
}

export async function signOutUser() {
  if (!auth) throw new Error("Firebase not initialized");
  await signOut(auth);
}

export function userCollections(uid) {
  if (!db) throw new Error("Firebase not initialized");
  const userDoc = doc(db, "users", uid);
  return {
    userDoc,
    categories: collection(userDoc, "categories"),
    transactions: collection(userDoc, "transactions"),
    settings: collection(userDoc, "settings"),
    savingsGoals: collection(userDoc, "savingsGoals"),
    targets: collection(userDoc, "targets"),
    recurring: collection(userDoc, "recurring"),
    templates: collection(userDoc, "templates"),
    debts: collection(userDoc, "debts"),
    subscriptions: collection(userDoc, "subscriptions"),
  };
}

export function firestoreApi() {
  return {
    collection,
    doc,
    addDoc,
    deleteDoc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    // Bound to the app's database when called (firestoreApi() runs before initFirebase).
    batch: () => writeBatch(db),
    runTransaction: (fn) => runTransaction(db, fn),
  };
}
