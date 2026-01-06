const CACHE_NAME = 'novtl-cache-v1';
const OFFLINE_URL = '/';

// Install Event: Skip Waiting agar SW baru langsung aktif
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event: Claim Clients & Bersihkan Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network First Strategy
// Kita mengutamakan Online. Cache hanya sebagai cadangan jika offline (untuk aset statis).
self.addEventListener('fetch', (event) => {
  // 1. JANGAN Cache Request selain GET (misal: POST ke API Gemini/OpenAI)
  // Ini menjamin respons AI selalu fresh dan tidak salah cache.
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. JANGAN Cache request ke Extension atau skema non-http
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Jika berhasil ambil dari network, simpan salinannya ke cache (untuk jaga-jaga offline nanti)
        // Pastikan response valid sebelum dicache
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      })
      .catch(() => {
        // Jika Network Gagal (Offline), coba cari di cache
        return caches.match(event.request);
      })
  );
});