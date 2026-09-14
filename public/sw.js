const CACHE = 'nexus-mapas-v22-mobile-final-20260913';
const CORE = [
  '/', '/index.html', '/404.html', '/styles.css',
  '/app-core-1.js', '/app-core-2.js', '/app-core-3.js',
  '/app-media.js', '/app-ai-1.js', '/app-ai-2.js', '/app-ai-3.js', '/app-ai-4.js',
  '/nexus-map-features.js', '/nexus-editor-v17.js', '/app-export.js', '/app-billing.js', '/app-license-sales.js',
  '/mobile-ux.js', '/mobile-ui-hotfix.js', '/presentation-ux.js', '/nexus-ui.js', '/install-button-fix.js', '/pwa.js',
  '/manifest.webmanifest', '/icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || (await caches.match('/index.html')))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
