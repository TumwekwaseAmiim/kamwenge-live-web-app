const CACHE = 'kamwenge-live-v2-1';


// =====================================================
// INSTALL
// =====================================================

self.addEventListener('install', event => {
  self.skipWaiting();
});


// =====================================================
// ACTIVATE
// Remove ALL older Kamwenge Live caches
// =====================================================

self.addEventListener('activate', event => {

  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );

});


// =====================================================
// FETCH
//
// IMPORTANT:
// Do not intercept requests while Kamwenge Live
// live-streaming is being tested.
// Everything loads directly from the network.
// =====================================================

self.addEventListener('fetch', event => {
  return;
});