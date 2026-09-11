const CACHE = 'mapaflex-v3-20260911';
const CORE = ['/', '/index.html', '/styles.css', '/app.js', '/db.js', '/ai.js', '/export.js', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(c => c.put('/index.html', copy)); return response;
    }).catch(() => caches.match('/index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok || response.type === 'opaque') caches.open(CACHE).then(c => c.put(event.request, response.clone()));
    return response;
  })));
});
