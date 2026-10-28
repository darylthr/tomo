/* Tomo's service worker: the app itself starts from the device, the server's data never does.
 *  - /assets/* are named by content hash, so a cached copy is always right: cache first.
 *  - The page (HTML) is network first, so a new deploy shows at once; the cached copy covers being offline.
 *  - Everything else (the API, WebDAV, covers, metadata, config) is left to the browser. */
const CACHE = 'tomo-app-v1';
const MAX_ASSETS = 120;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          void trim(cache);
        }
        return response;
      })(),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          // One shell serves every route: the app does its own routing.
          if (response.ok) await cache.put('/', response.clone());
          return response;
        } catch (error) {
          const shell = await cache.match('/');
          if (shell) return shell;
          throw error;
        }
      })(),
    );
  }
});
