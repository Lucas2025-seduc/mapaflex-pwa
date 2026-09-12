const CACHE = 'mapaflex-ultimate-v4-drag-hotfix-20260912';
const CORE = ['/', '/index.html', '/styles.css', '/app-core-1.js', '/app-core-2.js', '/app-core-3.js', '/app-media.js', '/app-ai-1.js', '/app-ai-2.js', '/app-ai-3.js', '/app-ai-4.js', '/app-export.js', '/pwa.js', '/manifest.webmanifest', '/icons/icon.svg'];

function patchPwaSource(text) {
  const oldCode = "if(n){const mp=mapPoint(now.x,now.y);n.x=mp.x-gesture.offsetX;n.y=mp.y-gesture.offsetY;if(typeof render==='function') render();suppressClickUntil=Date.now()+250;}";
  const newCode = "if(n){const mp=mapPoint(now.x,now.y);n.x=mp.x-gesture.offsetX;n.y=mp.y-gesture.offsetY;const el=document.querySelector(`g.node[data-id=\"${CSS.escape(n.id)}\"]`);if(el)el.setAttribute('transform',`translate(${n.x},${n.y})`);suppressClickUntil=Date.now()+250;}";
  return text.includes(oldCode) ? text.replace(oldCode, newCode) : text;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (!response.ok) return response;
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return caches.match(request);
  }
}

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
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname === '/pwa.js') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (!response.ok) return response;
        const source = patchPwaSource(await response.text());
        const headers = new Headers(response.headers);
        headers.set('content-type', 'application/javascript; charset=utf-8');
        const patched = new Response(source, { status: response.status, statusText: response.statusText, headers });
        const cache = await caches.open(CACHE);
        await cache.put(event.request, patched.clone());
        return patched;
      } catch (error) {
        return caches.match(event.request);
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});