// RADIUS service worker. Deliberately small: it only keeps a copy of the app
// page so RADIUS opens (with a friendly message) when the phone is offline.
// API calls, uploads and everything else always go straight to the network, so
// new deployments show up immediately and nothing stale is ever served online.
const CACHE = 'radius-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req)
        if (fresh.ok) {
          const cache = await caches.open(CACHE)
          cache.put('/', fresh.clone())
        }
        return fresh
      } catch (e) {
        const cached = await caches.match('/')
        return (
          cached ||
          new Response('RADIUS is offline. Reconnect to the internet and try again.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      }
    })()
  )
})
