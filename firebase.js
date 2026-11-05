import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
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
import { isIosHomeScreenApp, authDomainFor } from "./js/auth-domain.js?v=1";

// Set just before leaving for Google's page (redirect), checked when the app loads
// again, so a sign-in that comes back without a result is reported, not silent.
const REDIRECT_PENDING_KEY = "accountBook.googleRedirect";

let firebaseConfig = null;
let app = null;
let auth = null;
let db = null;
let authPersistenceMode = "unknown";

export async function initFirebase() {
  let sameSiteAuthHosts = [];
  try {
    // Optional file the user will create.
    const mod = await import("./firebase-config.js?v=2");
    firebaseConfig = mod.firebaseConfig;
    sameSiteAuthHosts = mod.sameSiteAuthHosts || [];
  } catch {
    return {
      ok: false,
      reason:
        "Missing Firebase config. Create firebase-config.js (copy from firebase-config.example.js) and fill in your keys.",
    };
  }

  const authDomain = authDomainFor({
    host: location.host,
    iosHomeScreenApp: isIosHomeScreenApp(),
    defaultAuthDomain: firebaseConfig.authDomain,
    sameSiteHosts: sameSiteAuthHosts,
  });
  app = initializeApp({ ...firebaseConfig, authDomain });
  auth = getAuth(app);

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

  // Improve cross-browser session behavior (especially mobile / private modes).
  // If local persistence is blocked, fall back to session persistence.
  try {
    await setPersistence(auth, browserLocalPersistence);
    authPersistenceMode = "local";
  } catch {
    try {
      await setPersistence(auth, browserSessionPersistence);
      authPersistenceMode = "session";
    } catch {
      // ignore; Firebase will fall back to in-memory persistence
      authPersistenceMode = "memory";
    }
  }

  // If a Google sign-in redirect just happened, process it so errors don't get swallowed.
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

  // A home-screen app on iPhone can't get a popup's result back: the popup opens in
  // a separate browser sheet that can't talk to the app, so the sign-in there ends
  // in Google's "Something went wrong" (often after approving the sign-in in Gmail).
  // Redirect instead: Google's page opens in the app itself and comes back to it. The
  // result only survives with the helper on the site itself (see js/auth-domain.js).
  if (isIosHomeScreenApp()) {
    await redirectToGoogle(provider);
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
