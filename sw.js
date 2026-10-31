const CACHE_NAME = "accountbook-v19";
const CDN_CACHE = "accountbook-cdn-v16";
// The app shell is cached as "./", never "./index.html": Vercel (cleanUrls) answers
// /index.html with a 308 to /, and a page load can't be answered with a cached
// redirect (Safari: "Response served by service worker has redirections").
const SHELL = "./";
// How long a page load waits for the network before using the cached shell.
const NAV_TIMEOUT_MS = 3000;
// Versioned like the imports in app.js, so a cached copy never mixes with
// files from another release.
const PRECACHE = [
  SHELL,
  "./styles.css?v=14",
  "./app.js?v=13",
  "./utils.js?v=7",
  "./firebase.js?v=2",
  "./firebase-config.js",
  "./js/i18n.js?v=2",
  "./js/i18n.zh.js?v=2",
  "./js/backup.js?v=1",
  "./js/features/debts.js?v=2",
  "./js/features/goals.js?v=3",
  "./js/features/receipts.js?v=2",
  "./js/features/recurring.js?v=2",
  "./js/features/subscriptions.js?v=2",
  "./js/features/targets.js?v=2",
  "./js/features/templates.js?v=2",
  "./js/features/upcoming.js?v=2",
  "./favicon.svg?v=2",
];

// CDN hosts that serve static libraries/fonts we can safely cache for offline use.
const CACHEABLE_CDN_HOSTS = [
  "cdn.jsdelivr.net",
  "esm.sh",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "www.gstatic.com", // Firebase SDK ESM modules
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== CDN_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return; // never touch writes (Firestore POST/PATCH)
  const url = new URL(e.request.url);

  // Cross-origin: only cache known static CDN libraries/fonts.
  // Firebase API/Auth calls (googleapis.com, identitytoolkit, firestore) are left alone.
  if (url.origin !== location.origin) {
    if (CACHEABLE_CDN_HOSTS.includes(url.hostname)) {
      e.respondWith(
        caches.open(CDN_CACHE).then((cache) =>
          cache.match(e.request).then((cached) => {
            const fetched = fetch(e.request)
              .then((response) => {
                // Cache successful or opaque (cross-origin) responses.
                if (response && (response.ok || response.type === "opaque")) {
                  cache.put(e.request, response.clone());
                }
                return response;
              })
              .catch(() => cached);
            return cached || fetched;
          })
        )
      );
    }
    return; // other cross-origin requests pass through untouched
  }

  // Page loads (home-screen launch, reload, typed URL).
  if (e.request.mode === "navigate") {
    e.respondWith(handleNavigation(e.request));
    return;
  }

  // Same-origin app files: stale-while-revalidate.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((response) => {
        if (response.ok && !response.redirected) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

// Network first, so a new deploy shows up on the next launch. The network answer is
// passed back untouched: a redirect (/index.html -> /) is followed by the browser.
// Offline, or when the network takes longer than NAV_TIMEOUT_MS, the cached shell
// answers instead. Every app route serves index.html, so one shell fits them all.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then((response) => {
    const isPage = (response.headers.get("content-type") || "").includes("text/html");
    if (response.ok && !response.redirected && isPage) cache.put(SHELL, response.clone());
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {
    // offline: use the cached shell below
  }
  return (await cache.match(SHELL)) || network;
}
