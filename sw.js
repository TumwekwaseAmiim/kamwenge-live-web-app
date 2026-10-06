const CACHE = 'kamwenge-live-v3.2.0';

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

  // Branding
  './assets/images/logo/kamwenge-live-logo.png',
  './assets/images/avatar-placeholder.svg'

  // Only add this when the file actually exists:
  // './assets/images/developer/amiim.jpg'
];


// =====================================================
// INSTALL
// =====================================================

self.addEventListener(
  'install',
  event => {

    self.skipWaiting();

    event.waitUntil(
      caches
        .open(CACHE)
        .then(
          cache =>
            cache.addAll(ASSETS)
        )
    );
  }
);


// =====================================================
// ACTIVATE
// Delete older Kamwenge Live caches
// =====================================================

self.addEventListener(
  'activate',
  event => {

    event.waitUntil(
      caches
        .keys()
        .then(
          keys =>
            Promise.all(
              keys
                .filter(
                  key =>
                    key !== CACHE
                )
                .map(
                  key =>
                    caches.delete(key)
                )
            )
        )
        .then(
          () =>
            self.clients.claim()
        )
    );
  }
);


// =====================================================
// FETCH
// =====================================================

self.addEventListener(
  'fetch',
  event => {

    const request =
      event.request;


    // -------------------------------------------------
    // GET requests only
    // -------------------------------------------------

    if (
      request.method !==
      'GET'
    ) {
      return;
    }


    const url =
      new URL(
        request.url
      );


    // -------------------------------------------------
    // IMPORTANT:
    // Only control Kamwenge Live's own files.
    //
    // Do not interfere with:
    // Firebase
    // Firestore
    // Cloudflare Worker
    // LiveKit
    // Cloudinary
    // jsDelivr
    // -------------------------------------------------

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }


    // =================================================
    // HTML / PAGE NAVIGATION
    //
    // NETWORK FIRST
    // So users receive the newest live.html/index.html.
    // =================================================

    if (
      request.mode ===
      'navigate'
    ) {

      event.respondWith(
        fetch(request)

          .then(
            response => {

              if (
                response &&
                response.ok
              ) {

                const copy =
                  response.clone();


                caches
                  .open(CACHE)
                  .then(
                    cache =>
                      cache.put(
                        request,
                        copy
                      )
                  );
              }


              return response;
            }
          )

          .catch(
            async () => {

              const cached =
                await caches.match(
                  request
                );


              if (cached) {
                return cached;
              }


              return caches.match(
                './index.html'
              );
            }
          )
      );


      return;
    }


    // =================================================
    // JAVASCRIPT / CSS
    //
    // NETWORK FIRST
    //
    // Important while Kamwenge Live is actively being
    // developed. This reduces old-code problems.
    // =================================================

    if (
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.webmanifest')
    ) {

      event.respondWith(
        fetch(request)

          .then(
            response => {

              if (
                response &&
                response.ok
              ) {

                const copy =
                  response.clone();


                caches
                  .open(CACHE)
                  .then(
                    cache =>
                      cache.put(
                        request,
                        copy
                      )
                  );
              }


              return response;
            }
          )

          .catch(
            () =>
              caches.match(
                request
              )
          )
      );


      return;
    }


    // =================================================
    // IMAGES / ICONS / OTHER STATIC FILES
    //
    // CACHE FIRST, THEN NETWORK
    // =================================================

    event.respondWith(
      caches
        .match(request)
        .then(
          cached => {

            if (cached) {

              // Update quietly in background
              event.waitUntil(
                fetch(request)
                  .then(
                    response => {

                      if (
                        response &&
                        response.ok
                      ) {

                        return caches
                          .open(CACHE)
                          .then(
                            cache =>
                              cache.put(
                                request,
                                response
                              )
                          );
                      }
                    }
                  )
                  .catch(
                    () => {}
                  )
              );


              return cached;
            }


            return fetch(
              request
            )
              .then(
                response => {

                  if (
                    response &&
                    response.ok
                  ) {

                    const copy =
                      response.clone();


                    caches
                      .open(CACHE)
                      .then(
                        cache =>
                          cache.put(
                            request,
                            copy
                          )
                      );
                  }


                  return response;
                }
              );
          }
        )
    );
  }
);