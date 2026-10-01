/* global self, caches, fetch, URL */
const CACHE_PREFIX = 'warka-shell-'
const CACHE_NAME = `${CACHE_PREFIX}0.1.0`
const SHELL = ['/', '/manifest.webmanifest', '/warka-icon.svg']
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))),
)
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  ),
)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/downloads/')
  )
    return
  if (!SHELL.includes(url.pathname) && !url.pathname.startsWith('/assets/'))
    return
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  )
})
