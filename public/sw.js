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

// ---- Push notifications -----------------------------------------------------
// The server sends a small JSON payload: { title, body, tag, url }.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'RADIUS', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'RADIUS'
  event.waitUntil(
    (async () => {
      // If RADIUS is open and on screen, the person is already looking at it,
      // so skip the notification (answers are shown in the app itself).
      if (data.tag === 'radius-reply') {
        const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (open.some((c) => c.visibilityState === 'visible')) return
      }
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: data.tag || 'radius',
        renotify: true,
        data: { url: data.url || '/' },
      })
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({ type: 'radius-open', url })
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url)
    })()
  )
})
