// Google sign-in in the iPhone home-screen app, without Firebase's sign-in helper.
//
// A popup can't hand its result back to a home-screen app, and Firebase's redirect
// needs its helper frame (/__/auth/iframe + Google's gapi script) to talk to the app
// when it comes back. On iPhone that handshake never completed: Firebase waited 15 s,
// gave up and showed the sign-in form again. So the home-screen app goes to Google
// itself and asks for an ID token (OpenID Connect, response_type=id_token). Google
// sends it back to /__/auth/handler (a redirect URI registered on the OAuth client),
// which hands it to the app, and the app signs in with it (signInWithCredential).
// The pure parts live here so they can be tested without the Firebase SDK.

/** Opened from the iPhone/iPad home screen (added from Safari or Chrome). */
export function isIosHomeScreenApp(win = globalThis) {
  const nav = win.navigator || {};
  if (nav.standalone === true) return true;
  const standalone = typeof win.matchMedia === "function" && win.matchMedia("(display-mode: standalone)").matches;
  return standalone && /iPhone|iPad|iPod/.test(nav.userAgent || "");
}

/**
 * Whether to sign in by going to Google directly: only in the home-screen app, only
 * on hosts whose /__/auth/handler is a registered redirect URI (firebase-config.js →
 * googleRedirectHosts), and only with the OAuth client ID known. Browsers keep
 * Firebase's popup.
 */
export function useDirectGoogleSignIn({ iosHomeScreenApp, host, redirectHosts = [], clientId }) {
  return Boolean(iosHomeScreenApp && clientId && redirectHosts.includes(host));
}

/** Google's sign-in address for an ID token, coming back to redirectUri. */
export function googleAuthUrl({ clientId, redirectUri, state, nonce }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    state,
    nonce,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}

/** What Google sent back in the URL fragment: { idToken, state, error }. */
export function parseGoogleReturn(fragment) {
  const params = new URLSearchParams(String(fragment || "").replace(/^#/, ""));
  return { idToken: params.get("id_token") || "", state: params.get("state") || "", error: params.get("error") || "" };
}

/** The claims of a JWT (no signature check: Firebase verifies the token itself). */
export function jwtPayload(token) {
  try {
    const part = String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(part + "=".repeat((4 - (part.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

/** A random hex string for state / nonce. */
export function randomId(bytes = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}
