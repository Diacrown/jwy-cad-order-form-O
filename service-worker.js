// Service worker for the JWY CAD Order Form.
//
// Purpose: after the FIRST successful load (which needs network, or the files
// need to already be present locally), cache everything the page needs so
// later loads work with zero internet connection.
//
// IMPORTANT for the truly-offline CAD workstations: a service worker only
// helps once a browser has successfully fetched and cached these files at
// least once. If a machine has NEVER been online, copy the entire folder
// (index.html, manifest.json, service-worker.js, vendor/, icons) directly
// onto that machine via USB/local network instead of relying on this cache —
// the service worker is a convenience layer for occasionally-connected
// devices, not a substitute for having the files locally in the first place.

const CACHE_NAME = 'jwy-cad-form-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './vendor/tailwind.js',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './vendor/pdf.min.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first strategy: serve from cache immediately (instant load, works
// offline), and update the cache in the background from the network when
// available. Never intercepts the Apps Script API calls — those need to hit
// the live network every time to actually sync data, so this only handles
// the static app-shell files listed above.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShellRequest = APP_SHELL.some((path) => url.pathname.endsWith(path.replace('./', '/')) || url.pathname.endsWith(path.replace('./', '')));

  if (event.request.method !== 'GET' || !isAppShellRequest) {
    return; // let the browser handle it normally (e.g. the API submission POST)
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline: fall back to cache

      return cached || networkFetch;
    })
  );
});
