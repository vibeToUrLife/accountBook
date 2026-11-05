// Google sign-in in the iPhone home-screen app: how to recognise it, and where the
// sign-in helper pages (Firebase's authDomain) live for it. Kept out of firebase.js
// so the rules can be tested without the Firebase SDK.

/** Opened from the iPhone/iPad home screen (added from Safari or Chrome). */
export function isIosHomeScreenApp(win = globalThis) {
  const nav = win.navigator || {};
  if (nav.standalone === true) return true;
  const standalone = typeof win.matchMedia === "function" && win.matchMedia("(display-mode: standalone)").matches;
  return standalone && /iPhone|iPad|iPod/.test(nav.userAgent || "");
}

/**
 * The home-screen app signs in by redirect (a popup there can't hand the result back).
 * Safari only keeps a redirect's result when the helper (/__/auth/) is on the site
 * itself: from firebaseapp.com it is read through a third-party frame whose storage
 * Safari partitions, so the app came back signed out. vercel.json proxies /__/auth/
 * to Firebase, so on the hosts listed in firebase-config.js (sameSiteAuthHosts) the
 * home-screen app uses the site's own host. Everywhere else, and in browsers, which
 * keep the popup, the default authDomain stays.
 */
export function authDomainFor({ host, iosHomeScreenApp, defaultAuthDomain, sameSiteHosts = [] }) {
  return iosHomeScreenApp && sameSiteHosts.includes(host) ? host : defaultAuthDomain;
}
