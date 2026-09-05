/* ================================================================
   Tamil AI Stream – Service Worker (Optimized)
   
   Caching strategy:
     • Network-first for navigation + code assets (JS/CSS).
     • Stale-while-revalidate for images/fonts (instant loads).
     • Separate image cache with LRU eviction (max 150 entries).
     • /api/* and cross-origin requests are NEVER intercepted.
   
   Update flow:
     1. Cloudflare Worker rewrites __BUILD_VERSION__ at serve-time.
     2. New deploy → browser detects update → shows banner.
     3. User clicks "Update Now" → SKIP_WAITING → reload.
   ================================================================ */

const APP_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = 'tamilai-v' + APP_VERSION;
const IMAGE_CACHE = 'tamilai-img-v' + APP_VERSION;
const MAX_IMAGE_CACHE = 150;

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/ultra-perf.css',
  '/yt-music.css',
  '/style.css',
  '/premium-ui.css',
  '/ai-glass.css',
  '/ultra-perf.js',
  '/script.js',
  '/yt-music.js',
  '/data-store.js',
  '/ai-home.js',
  '/pwa.js',
  '/pwa-splash.js',
  '/pwa-install.css',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png'
];

/* ---- Install ---- */
self.addEventListener('install', (event) => {
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) { self.skipWaiting(); return; }
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CRITICAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate (consolidated) ---- */
self.addEventListener('activate', (event) => {
  const MAX_CACHES = 3;
  event.waitUntil(
    caches.keys().then((keys) => {
      const oldVersioned = keys
        .filter((k) => (k.startsWith('tamilai-v') || k.startsWith('tamilai-img-v')) && k !== CACHE_NAME && k !== IMAGE_CACHE)
        .sort()
        .slice(0, Math.max(0, keys.length - MAX_CACHES));
      return Promise.all(oldVersioned.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

/* ---- Message handler ---- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---- LRU eviction for image cache ---- */
async function pruneImageCache() {
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const keys = await cache.keys();
    if (keys.length > MAX_IMAGE_CACHE) {
      const toDelete = keys.slice(0, keys.length - MAX_IMAGE_CACHE);
      await Promise.all(toDelete.map((req) => cache.delete(req)));
    }
  } catch (_) { /* ok */ }
}

/* ---- Fetch ---- */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) return;

  /* Never intercept /api/* or cross-origin */
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  /* Navigation — network-first with cache fallback */
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

  /* Code assets (JS/CSS) — network-first */
  const isCodeAsset = /\.(js|mjs|css)(\?|$)/i.test(url.pathname) ||
    (request.destination === 'script' || request.destination === 'style');

  if (isCodeAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then((c) => c.match(request)))
    );
    return;
  }

  /* Images — stale-while-revalidate with separate LRU cache */
  const isImage = request.destination === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg|avif|ico)(\?|$)/i.test(url.pathname);

  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
              /* Prune in background — don't block the response */
              pruneImageCache();
            }
            return response;
          }).catch(() => cached);

          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  /* Everything else — stale-while-revalidate */
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
