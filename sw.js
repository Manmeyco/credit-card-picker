// Offline support. Network first so card-data and app updates show up as soon
// as you open the app; falls back to the cached copy when offline.
// Store lookups (Overpass) are cross-origin and always go to the network.
const CACHE = 'pick-a-card-v3';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'data/cards.json',
  'js/app.js', 'js/data.js', 'js/engine.js', 'js/store.js', 'js/location.js', 'js/catalog.js', 'js/sync.js',
  'js/cloud.js', 'js/sync-merge.js', 'js/firebase-config.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // ignore cache-busting query strings
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key).then((r) => r || caches.match('index.html'))),
  );
});
