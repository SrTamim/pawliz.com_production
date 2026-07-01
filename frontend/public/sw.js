const CACHE_VERSION = 'pawliz-v8';
// NOTE: never precache HTML routes (e.g. '/') — navigations are network-first
// (see fetch handler) so a new deploy's HTML is always served fresh. Caching '/'
// here served stale home HTML to returning visitors after a deploy, which
// mismatched the new JS bundle → React hydration errors.
const CACHE_URLS = [
  '/favicon.svg',
  '/manifest.json',
];

// API paths that contain private/authenticated user data — NEVER cache these
const PRIVATE_API_PATHS = [
  '/api/v1/auth/',
  '/api/v1/profile',
  '/api/v1/pets',
  '/api/v1/notifications',
  '/api/v1/admin/',
  '/api/v1/vet-dashboard',
  '/api/v1/otp',
];

function isPrivateApiPath(url) {
  return PRIVATE_API_PATHS.some((path) => url.includes(path));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        CACHE_URLS.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => {
              // Silently skip failed URLs (e.g., API 401)
            })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Web Push — show a native OS notification (with sound) for any push payload,
// even when the site/PWA is closed. Payload is server-built JSON.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const tag = data.tag || undefined;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pawliz', {
      body: data.message || '',
      icon: '/icon-192.png',
      badge: '/favicon.svg',
      data: { url: data.action_url || '/' },
      tag,
      // Re-alert (sound + banner) even if a notification with this tag exists,
      // so repeated notifications don't silently replace the previous one.
      renotify: tag ? true : undefined,
    })
  );
});

// Focus an existing tab on the target URL, or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// CLEAR_API_CACHE message — called on logout to prevent PII leakage between users on shared devices
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    caches.open(CACHE_VERSION).then((cache) => {
      cache.keys().then((keys) => {
        keys.forEach((request) => {
          if (request.url.includes('/api/')) {
            cache.delete(request);
          }
        });
      });
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  // Ignore non-http(s) schemes (e.g. chrome-extension://)
  if (!request.url.startsWith('http')) {
    return;
  }

  // Never intercept Next.js HMR / webpack dev assets — breaks Fast Refresh
  if (request.url.includes('/_next/')) {
    return;
  }

  // Only handle same-origin requests. Cross-origin assets (R2 images, CF beacon,
  // Unsplash, tawk.to) are left to the browser — re-fetching them in the SW made
  // them subject to the document's connect-src and broke image loads.
  if (new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // HTML navigations: ALWAYS network-first so a new deploy's HTML matches the
  // new JS bundle (prevents hydration mismatch). Fall back to cache only offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // API requests: network first, only cache public endpoints
  if (request.url.includes('/api/')) {
    // Never cache private/authenticated API responses — prevents PII leakage on shared devices
    if (isPrivateApiPath(request.url)) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) return response;
      return fetch(request).then((response) => {
        if (response.ok && request.url.match(/\.(js|css|png|jpg|jpeg|webp|gif|svg)$/)) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, responseClone));
        }
        return response;
      });
    }).catch(() => {
      if (request.url.includes('image') || request.url.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#999">Offline</text></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      }
      return new Response('Offline', { status: 503 });
    })
  );
});