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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let firebaseConfig = null;
let app = null;
let auth = null;
let db = null;
let authPersistenceMode = "unknown";

export async function initFirebase() {
  try {
    // Optional file the user will create.
    const mod = await import("./firebase-config.js");
    firebaseConfig = mod.firebaseConfig;
  } catch {
    return {
      ok: false,
      reason:
        "Missing Firebase config. Create firebase-config.js (copy from firebase-config.example.js) and fill in your keys.",
    };
  }

  app = initializeApp(firebaseConfig);
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
  try {
    await getRedirectResult(auth);
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

export async function signInWithGooglePopup() {
  if (!auth) throw new Error("Firebase not initialized");
  const provider = new GoogleAuthProvider();

  // Popup is generally the most reliable across mobile browsers because it
  // doesn't rely on sessionStorage surviving a full-page redirect.
  // If the environment blocks popups, fall back to redirect.
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
      await signInWithRedirect(auth, provider);
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
  };
}
