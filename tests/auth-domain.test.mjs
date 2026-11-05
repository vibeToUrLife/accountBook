// Google sign-in in the iPhone home-screen app: it redirects, and its result only
// survives when the helper (/__/auth/) is on the site itself, so there (and only
// on the hosts vercel.json proxies) the authDomain is the site's own host.
import { test } from "node:test";
import assert from "node:assert/strict";
import { authDomainFor, isIosHomeScreenApp } from "../js/auth-domain.js";
import { sameSiteAuthHosts } from "../firebase-config.js";

const DEFAULT = "accountbook-6e296.firebaseapp.com";
const opts = (host, iosHomeScreenApp) => ({ host, iosHomeScreenApp, defaultAuthDomain: DEFAULT, sameSiteHosts: sameSiteAuthHosts });

test("the home-screen app on the live site signs in through the site itself", () => {
  assert.equal(authDomainFor(opts("accbook.vercel.app", true)), "accbook.vercel.app");
});

test("browsers keep Firebase's own helper (their popup works, nothing to change)", () => {
  assert.equal(authDomainFor(opts("accbook.vercel.app", false)), DEFAULT);
});

test("hosts without the proxy and a registered redirect URI keep the default", () => {
  assert.equal(authDomainFor(opts("accountbook-git-some-branch-lowky.vercel.app", true)), DEFAULT);
  assert.equal(authDomainFor(opts("localhost:5500", true)), DEFAULT);
  assert.equal(authDomainFor({ host: "accbook.vercel.app", iosHomeScreenApp: true, defaultAuthDomain: DEFAULT }), DEFAULT);
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
