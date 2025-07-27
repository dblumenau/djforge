/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'dj-forge-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
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
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for API requests
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(request).then((fetchResponse) => {
          // Don't cache non-successful responses
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          // Clone the response before caching
          const responseToCache = fetchResponse.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            });

          return fetchResponse;
        });
      })
      .catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html').then(response => response || new Response('Offline', { status: 503 }));
        }
        // Return a 404 response for other failed requests
        return new Response('Not found', { status: 404 });
      })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

export {};