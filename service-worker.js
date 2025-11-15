// Service Worker untuk Aplikasi Absensi
// Menghandle caching dan offline support

const CACHE_NAME = 'absensi-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.html',
  '/style/main.css',
  '/style/navbar.css',
  '/script/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app resources');
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('Some resources failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if available
      if (response) {
        return response;
      }
      // Try network request
      return fetch(event.request)
        .then((response) => {
          // Clone the response
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseToCache = response.clone();
          // Cache successful responses for next use
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Network request failed, serve offline fallback if available
          return caches.match(event.request)
            .then((response) => {
              if (response) return response;
              // Optional: return a generic offline page or error
              return new Response('Offline - Resource not available', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        });
    })
  );
});
