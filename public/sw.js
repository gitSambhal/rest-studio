const CACHE_NAME = 'reststudio-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// 1. Install Event: Cache Core Static Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache initial assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Stale-while-revalidate for assets, Pass-through for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests, proxy API endpoints, and Vite dev/module assets
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.search.includes('v=') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  // Handle HTML document navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Stale-While-Revalidate for JS, CSS, SVG, Images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Localhost Proxy Bridge Message Handler
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'EXECUTE_LOCALHOST_FETCH') {
    const { id, method, url, headers, body } = event.data.payload;
    const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url);
    const isPrivateIpUrl = /^https?:\/\/(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/i.test(url);

    try {
      const fetchOptions = {
        method: (method || 'GET').toUpperCase(),
        headers: { ...headers },
      };

      if (isLocalhostUrl) {
        fetchOptions.targetAddressSpace = 'local';
      } else if (isPrivateIpUrl) {
        fetchOptions.targetAddressSpace = 'private';
      }

      if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method)) {
        fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
      }

      const startTime = performance.now();
      const res = await fetch(url, fetchOptions);
      const endTime = performance.now();
      const text = await res.text();

      const resHeaders = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: true,
          id,
          response: {
            status: res.status,
            statusText: res.statusText || 'OK',
            headers: resHeaders,
            body: text,
            size: new Blob([text]).size,
            duration: Math.round(endTime - startTime),
            timestamp: Date.now(),
            ok: res.ok,
            contentType: res.headers.get('content-type') || 'text/plain',
          },
        });
      }
    } catch (err) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: false,
          id,
          error: err.message || 'Service Worker Localhost fetch failed',
        });
      }
    }
  }
});

