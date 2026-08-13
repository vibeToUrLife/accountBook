const CACHE_NAME = "accountbook-v14";
const CDN_CACHE = "accountbook-cdn-v14";
const PRECACHE = [
  "./index.html",
  "./styles.css?v=10",
  "./app.js?v=9",
  "./utils.js?v=6",
  "./firebase.js",
  "./firebase-config.js",
  "./favicon.svg?v=1",
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

  // Same-origin app shell: stale-while-revalidate.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
