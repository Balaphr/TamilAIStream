/* ================================================================
   Tamil AI Stream – Service Worker
   
   Caching strategy:
     • Network-first for ALL requests (navigation + static assets).
       Cache is only an offline fallback; fresh data is always preferred.
     • /api/* and cross-origin requests are NEVER intercepted or cached
       by the SW (let the browser handle them directly).
     • Old caches are pruned on activate using the version embedded in
       the cache name.
   
   Update flow:
     1. The Cloudflare Worker rewrites __BUILD_VERSION__ in this file
        at serve-time with the current deploy timestamp.
     2. A new deploy → different bytes → browser detects update →
        updatefound event fires on the page.
     3. The page shows a "New Update Available" banner.
     4. User clicks "Update Now" → page posts SKIP_WAITING message.
     5. This SW activates, claims all clients, and the page reloads.
   ================================================================ */

const APP_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = 'tamilai-v' + APP_VERSION;
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/ultra-perf.css',
  '/yt-music.css',
  '/style.css',
  '/premium-ui.css',
  '/global-player.css',
  '/ultra-perf.js',
  '/script.js',
  '/global-player.js',
  '/premium-landing.js',
  '/yt-music.js',
  '/data-store.js',
  '/player-engine.js'
];

/* ---- Install ---- */
self.addEventListener('install', (event) => {
  // Skip aggressive caching in development (Vite dev server on localhost)
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CRITICAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('tamilai-v') && k !== CACHE_NAME)
              .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---- Prune old caches on activation ---- */
self.addEventListener('activate', (event) => {
  const MAX_CACHES = 3;
  event.waitUntil(
    caches.keys().then((keys) => {
      const oldCaches = keys
        .filter((k) => k.startsWith('tamilai-v') && k !== CACHE_NAME)
        .sort()
        .slice(0, Math.max(0, keys.length - MAX_CACHES));
      return Promise.all(oldCaches.map((k) => caches.delete(k)));
    })
  );
});

/* ---- Message handler ---- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---- Fetch ---- */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip caching entirely in development — always fetch fresh
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) return;

  // 1. Never intercept /api/* – this covers /api/manifest, /api/media,
  //    /api/version and any future endpoints.
  if (url.pathname.startsWith('/api/')) return;

  // 2. Never intercept cross-origin (fonts, Firebase, CDN, YouTube
  //    thumbnails, etc.).  Let the browser's own cache handle them.
  if (url.origin !== self.location.origin) return;

  // 3. Same-origin requests (HTML, JS, CSS, images, etc.)
  //    Strategy: network-first with cache fallback (offline support).

  // 3a. Navigation (HTML page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then((c) => c.match(request)))
    );
    return;
  }

  // 3b. Static assets (JS / CSS / images / fonts served from same origin)
  // Strategy: stale-while-revalidate for instant loading, background update
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      });
    })
  );
});