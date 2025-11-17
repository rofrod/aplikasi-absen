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
  const requestUrl = new URL(event.request.url);

  // Network-first for navigations, main app shell and critical assets
  const isNavigation = event.request.mode === 'navigate' || requestUrl.pathname === '/' || requestUrl.pathname.endsWith('/index.html');
  const isCriticalAsset = requestUrl.pathname.endsWith('app.js') || requestUrl.pathname.endsWith('main.css') || requestUrl.pathname.endsWith('navbar.css');

  if (isNavigation || isCriticalAsset) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html') || new Response('Offline - Resource not available', { status: 503 })))
    );
    return;
  }

  // Default: cache-first for other static resources
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => new Response('Offline - Resource not available', { status: 503 }));
    })
  );
});
