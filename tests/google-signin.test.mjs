// Google sign-in in the iPhone home-screen app goes to Google itself and comes back
// with an ID token (js/google-signin.js); browsers keep Firebase's popup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isIosHomeScreenApp, useDirectGoogleSignIn, googleAuthUrl, parseGoogleReturn, jwtPayload, randomId } from "../js/google-signin.js";
import { googleWebClientId, googleRedirectHosts } from "../firebase-config.js";

const base = { clientId: googleWebClientId, redirectHosts: googleRedirectHosts };

test("only the home-screen app on a host with a registered return address goes to Google directly", () => {
  assert.equal(useDirectGoogleSignIn({ ...base, iosHomeScreenApp: true, host: "accbook.vercel.app" }), true);
  assert.equal(useDirectGoogleSignIn({ ...base, iosHomeScreenApp: false, host: "accbook.vercel.app" }), false, "browser: popup");
  assert.equal(useDirectGoogleSignIn({ ...base, iosHomeScreenApp: true, host: "accountbook-git-x-lowky.vercel.app" }), false, "preview");
  assert.equal(useDirectGoogleSignIn({ ...base, iosHomeScreenApp: true, host: "localhost:5500" }), false);
  assert.equal(useDirectGoogleSignIn({ ...base, clientId: "", iosHomeScreenApp: true, host: "accbook.vercel.app" }), false, "no client ID");
});

test("asks Google for an ID token for Firebase's web client, back to /__/auth/handler", () => {
  const url = new URL(googleAuthUrl({ clientId: googleWebClientId, redirectUri: "https://accbook.vercel.app/__/auth/handler", state: "s1", nonce: "n1" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: "152621770538-uq82t2jcpt5dghp2nudr8qeen7o4ubtc.apps.googleusercontent.com",
    redirect_uri: "https://accbook.vercel.app/__/auth/handler",
    response_type: "id_token",
    scope: "openid email profile",
    state: "s1",
    nonce: "n1",
  });
});

test("reads what Google sent back, including a refusal", () => {
  assert.deepEqual(parseGoogleReturn("#id_token=a.b.c&state=s1&authuser=0"), { idToken: "a.b.c", state: "s1", error: "" });
  assert.deepEqual(parseGoogleReturn("error=access_denied&state=s1"), { idToken: "", state: "s1", error: "access_denied" });
  assert.deepEqual(parseGoogleReturn(null), { idToken: "", state: "", error: "" });
});

test("reads a token's claims (UTF-8 names included); junk gives null", () => {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${part({ alg: "RS256" })}.${part({ nonce: "n1", name: "李明", aud: googleWebClientId })}.sig`;
  assert.deepEqual(jwtPayload(token), { nonce: "n1", name: "李明", aud: googleWebClientId });
  assert.equal(jwtPayload("not-a-token"), null);
  assert.equal(jwtPayload(""), null);
});

test("state and nonce are long and different every time", () => {
  const a = randomId(), b = randomId();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("recognises the home-screen app, from Safari or from Chrome", () => {
  const win = ({ standalone, ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", displayStandalone = false }) => ({
    navigator: { standalone, userAgent: ua },
    matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" && displayStandalone }),
  });
  assert.equal(isIosHomeScreenApp(win({ standalone: true })), true);
  assert.equal(isIosHomeScreenApp(win({ standalone: undefined, displayStandalone: true })), true);
  assert.equal(isIosHomeScreenApp(win({ standalone: false })), false, "Safari tab");
  assert.equal(isIosHomeScreenApp(win({ ua: "Mozilla/5.0 (Linux; Android 15; Pixel 9)", displayStandalone: true })), false, "Android app");
  assert.equal(isIosHomeScreenApp(win({ ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" })), false, "desktop");
});
