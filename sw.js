const CACHE = 'kamwenge-live-v3.1.0';

const ASSETS = [
  './',

  // Pages
  './index.html',
  './live.html',
  './studio.html',
  './create.html',
  './login.html',
  './dashboard.html',
  './profile.html',
  './about.html',
  './privacy.html',

  // Styles
  './css/style.css',

  // JavaScript
  './js/app.js',
  './js/firebase-config.js',
  './js/firebase-core.js',
  './js/auth.js',
  './js/store.js',
  './js/home.js',
  './js/live.js',
  './js/studio.js',
  './js/create.js',
  './js/login.js',
  './js/dashboard.js',
  './js/profile.js',
  './js/media-config.js',
  './js/cloudinary.js',
  './js/streaming-adapter.js',

  // Manifest
  './manifest.webmanifest',

  // Icons
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-48.png',
  './assets/icons/favicon-32.png',

  // Branding images
  './assets/images/logo/kamwenge-live-logo.png',
  './assets/images/avatar-placeholder.svg'

  // Add developer photo only after the file exists:
  // './assets/images/developer/amiim.jpg'
];


// =====================================================
// INSTALL
// Cache core Kamwenge Live files
// =====================================================

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(ASSETS))
  );
});


// =====================================================
// ACTIVATE
// Remove older Kamwenge Live caches
// =====================================================

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


// =====================================================
// FETCH
// Network first, cache fallback
// =====================================================

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  // Don't try to cache browser extension requests etc.
  if (!request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();

        caches
          .open(CACHE)
          .then(cache => {
            cache.put(request, copy);
          });

        return response;
      })
      .catch(async () => {
        const cached =
          await caches.match(request);

        if (cached) {
          return cached;
        }

        // Navigation fallback
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }

        return Response.error();
      })
  );
});