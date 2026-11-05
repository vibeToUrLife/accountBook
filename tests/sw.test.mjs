// The service worker must leave /__/ alone (/__/auth/handler is where Google sign-in
// comes back with its token): answered as a page load, that page would be cached as
// the app shell, or replaced by the shell when the network is slow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGIN = "https://accbook.vercel.app";

/** Runs sw.js in a sandbox and returns its fetch handler. */
function loadFetchHandler() {
  const handlers = {};
  const cache = { match: async () => undefined, put: async () => {}, addAll: async () => {} };
  const sandbox = {
    self: { addEventListener: (type, fn) => (handlers[type] = fn), skipWaiting() {}, clients: { claim() {} } },
    location: new URL(ORIGIN + "/sw.js"),
    caches: { open: async () => cache, match: async () => undefined, keys: async () => [], delete: async () => true },
    fetch: async () => ({ ok: true, redirected: false, headers: new Map(), clone() { return this; } }),
    URL, Promise, setTimeout,
  };
  vm.runInNewContext(readFileSync(new URL("../sw.js", import.meta.url), "utf8"), sandbox);
  return handlers.fetch;
}

/** Whether the service worker answers this request itself. */
function answers(handler, path, mode = "no-cors") {
  let answered = false;
  handler({ request: { method: "GET", url: ORIGIN + path, mode }, respondWith: () => (answered = true) });
  return answered;
}

test("the sign-in return page and other /__/ paths go straight to the network", () => {
  const onFetch = loadFetchHandler();
  assert.equal(answers(onFetch, "/__/auth/handler?apiKey=x&authType=signInViaRedirect", "navigate"), false);
  assert.equal(answers(onFetch, "/__/auth/iframe?apiKey=x", "navigate"), false);
  assert.equal(answers(onFetch, "/__/auth/handler.js"), false);
  assert.equal(answers(onFetch, "/__/firebase/init.json"), false);
});

test("the app's own pages and files are still served by the service worker", () => {
  const onFetch = loadFetchHandler();
  assert.equal(answers(onFetch, "/", "navigate"), true);
  assert.equal(answers(onFetch, "/app.js?v=18"), true);
});
