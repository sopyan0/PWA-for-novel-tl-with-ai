const CACHE_VERSION = 'v2::' + self.crypto?.randomUUID?.() || Date.now();
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/favicon.ico'
];

function log(...args) {
  // toggle this to false to quiet the SW logs in production
  const ENABLE_LOG = true;
  if (ENABLE_LOG) console.log('[sw]', ...args);
}

self.addEventListener('install', (event) => {
  log('install', CACHE_VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  log('activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            log('deleting old cache', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// helper to send message to all clients
async function broadcastMessage(msg) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientsList) {
    client.postMessage(msg);
  }
}

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    log('received SKIP_WAITING message');
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // only handle GET requests
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  // navigation requests (SPA) -> network-first, fallback to cache
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // update static cache with latest index.html
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // same-origin requests for static assets -> cache-first
  if (isSameOrigin && STATIC_ASSETS.includes(requestUrl.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      }))
    );
    return;
  }

  // API or other requests -> network-first with dynamic caching
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // optionally cache JSON responses for offline use
        const contentType = response.headers.get('content-type') || '';
        if (isSameOrigin && contentType.includes('application/json')) {
          const copy = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// optional: cleanup dynamic cache size
async function trimCache(cacheName, maxItems = 50) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// on update, broadcast new version so the page can prompt the user
self.addEventListener('activate', (event) => {
  event.waitUntil(broadcastMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
});

// export nothing: service worker file
