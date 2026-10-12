/* Service worker: caches the app shell and the pages and data you read, so saved stories open offline.
   Private requests (anything with an Authorization header, sign-in, accounts, stats) are never cached. */
const VERSION = 'v2';
const SHELL = `news-shell-${VERSION}`;
const RUNTIME = `news-runtime-${VERSION}`;
const SCOPE = self.registration.scope;
const PRIVATE = /\/(login|logout|user|stats|audit|newsletter|bookmarks|upload|socket\.io|settings\/private)(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(['./', 'favicon.svg', 'manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type !== 'opaque') cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = (await cache.match(request)) || (fallbackUrl ? await caches.match(fallbackUrl) : undefined);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const fresh = fetch(request).then((response) => {
    if (response && response.ok && response.type !== 'opaque') cache.put(request, response.clone());
    return response;
  }).catch(() => undefined);
  return hit || fresh || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.headers.has('authorization') || PRIVATE.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, SCOPE));
    return;
  }
  if (url.origin === self.location.origin && /\.(js|css|woff2?|svg|png|webp|jpg|jpeg|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  // article and section data from the API (cross-origin in real mode)
  if (/\/(news|category|authors|comments|search|settings)(\/|$)/.test(url.pathname) || /\.(xml|webmanifest)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, RUNTIME));
  }
});
