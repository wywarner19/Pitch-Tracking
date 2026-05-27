const CACHE_NAME = 'pitch-tracking-v3'

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.png',
]

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── ACTIVATE: clean up ALL old caches ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Always go straight to network for these — never cache
  const networkOnly = [
    'supabase.co',
    'supabase.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ]
  if (networkOnly.some(h => url.hostname.includes(h))) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })))
    return
  }

  // Non-GET — always network
  if (request.method !== 'GET') {
    event.respondWith(fetch(request))
    return
  }

  // JS and CSS files — network first, fall back to cache
  // This ensures app updates load immediately without needing a hard refresh
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // HTML — network first so app shell always updates
  if (request.mode === 'navigate' || url.pathname.match(/\.html$/)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match('./index.html'))
    )
    return
  }

  // Images and other static assets — cache first (these don't change often)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => new Response('Offline', { status: 503 }))
    })
  )
})
