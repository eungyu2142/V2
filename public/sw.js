const CACHE_NAME = 'repdiary-pwa-v4'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/exopet-logo.png', '/favicon.svg']
const DEFAULT_NOTIFICATION = {
  title: 'ExoCare',
  body: '완료하지 않은 돌봄 루틴이 있어요.',
  icon: '/exopet-logo.png',
  badge: '/exopet-logo.png',
  url: '/diary',
}

function readPushPayload(event) {
  if (!event.data) return {}

  try {
    const payload = event.data.json()
    return payload && typeof payload === 'object' ? payload : {}
  } catch {
    return {}
  }
}

function readString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function buildNotificationUrl(payload) {
  const requestedPath = readString(payload.url, DEFAULT_NOTIFICATION.url)
  const safePath = requestedPath.startsWith('/') ? requestedPath : DEFAULT_NOTIFICATION.url
  const target = new URL(safePath, self.location.origin)

  if (payload.petId != null) target.searchParams.set('petId', String(payload.petId))
  if (payload.routineId != null) target.searchParams.set('routineId', String(payload.routineId))
  if (payload.routineDate != null) target.searchParams.set('date', String(payload.routineDate))

  return `${target.pathname}${target.search}${target.hash}`
}

function buildNotificationTag(payload) {
  const providedTag = readString(payload.tag)
  if (providedTag) return providedTag

  const routineId = payload.routineId != null ? String(payload.routineId) : 'care'
  const scheduledFor = payload.scheduledFor != null
    ? String(payload.scheduledFor)
    : payload.routineDate != null
      ? String(payload.routineDate)
      : 'pending'

  return `routine-${routineId}-${scheduledFor}`
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (new URL(event.request.url).origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        if (event.request.mode === 'navigate') return caches.match('/index.html')
        return Response.error()
      }),
  )
})

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event)
  const targetUrl = buildNotificationUrl(payload)

  const title = readString(payload.title, DEFAULT_NOTIFICATION.title)
  const options = {
    body: readString(payload.body, DEFAULT_NOTIFICATION.body),
    icon: readString(payload.icon, DEFAULT_NOTIFICATION.icon),
    badge: readString(payload.badge, DEFAULT_NOTIFICATION.badge),
    tag: buildNotificationTag(payload),
    data: {
      url: targetUrl,
      petId: payload.petId != null ? String(payload.petId) : null,
      routineId: payload.routineId != null ? String(payload.routineId) : null,
      routineDate: payload.routineDate != null ? String(payload.routineDate) : null,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notificationUrl = readString(event.notification.data?.url, DEFAULT_NOTIFICATION.url)
  const targetUrl = new URL(notificationUrl, self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      const existingClient = windowClients[0]

      if (existingClient) {
        if ('navigate' in existingClient) await existingClient.navigate(targetUrl.href)
        return existingClient.focus()
      }

      return self.clients.openWindow(targetUrl.href)
    }),
  )
})
