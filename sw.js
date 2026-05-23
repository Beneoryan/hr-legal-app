const CACHE_NAME = 'hrd-ijef-v6.2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network-first: always try to get fresh content
  e.respondWith(
    fetch(e.request).then(resp => {
      // Only cache non-JS assets (images, fonts, etc)
      if (!e.request.url.includes('.js') && !e.request.url.includes('.html')) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
