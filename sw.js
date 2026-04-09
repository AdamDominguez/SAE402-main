// -- SERVICE WORKER -- 

const APP_VERSION = 'v1.0.3';
const LONG_CACHE = `chrono-rouage-long-${APP_VERSION}`;
const SHORT_CACHE = `chrono-rouage-short-${APP_VERSION}`;
const SHORT_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const SHORT_CACHE_MAX_ITEMS = 30;
const META_PREFIX = '__sw_meta__/';
const OFFLINE_FALLBACK_URL = './index.html';
const LONG_LIVED_FILES = [
  './',
  './index.html',
  './manifest.json',
  './style/hub.css',
  './js/hub.js',
  './game2/index.html',
  './game2/style/style.css',
  './game2/js/utils.js',
  './game2/js/globals.js',
  './game2/js/integration.js',
  './game2/js/input.js',
  './game2/js/Player.js',
  './game2/js/Pendulum.js',
  './game2/js/Tomato.js',
  './game2/js/Fragment.js',
  './game2/js/main.js',
  './favicon/favicon.ico',
  './favicon/favicon.svg',
  './favicon/favicon-96x96.png',
  './favicon/apple-touch-icon.png',
  './favicon/web-app-manifest-192x192.png',
  './favicon/web-app-manifest-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(LONG_CACHE).then((cache) => cache.addAll(LONG_LIVED_FILES))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== LONG_CACHE && key !== SHORT_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.headers.has('range')) {
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirstShort(request));
    return;
  }

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  const isStaticAsset = ['script', 'style', 'image', 'font', 'audio', 'video'].includes(request.destination);

  if (isStaticAsset) {
    event.respondWith(cacheFirstLongWithRefresh(request));
    return;
  }

  if (isNavigation) {
    event.respondWith(networkFirstShort(request, true));
    return;
  }

  event.respondWith(networkFirstShort(request));
});

async function cacheFirstLongWithRefresh(request) {
  const cache = await caches.open(LONG_CACHE);
  const cached = await cache.match(request);

  const updatePromise = fetch(request)
    .then((response) => {
      if (isCacheable(response) && response.status !== 206) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const network = await updatePromise;
  if (network) return network;

  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

async function networkFirstShort(request, isNavigation = false) {
  const shortCache = await caches.open(SHORT_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheable(response) && response.status !== 206) {
      await shortCache.put(request, response.clone());
      await setMetaTimestamp(shortCache, request.url, Date.now());
      await trimShortCache(shortCache);
    }
    return response;
  } catch {
    const cached = await getFreshShortCache(shortCache, request);
    if (cached) {
      return cached;
    }

    const longCache = await caches.open(LONG_CACHE);
    const shell = await longCache.match(request);
    if (shell) {
      return shell;
    }

    if (isNavigation) {
      const offlinePage = await longCache.match(OFFLINE_FALLBACK_URL);
      if (offlinePage) return offlinePage;
    }

    return new Response('Offline and no cached copy available.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

function isCacheable(response) {
  return response && (response.ok || response.type === 'opaque');
}

function buildMetaRequest(url) {
  return new Request(`${self.registration.scope}${META_PREFIX}${encodeURIComponent(url)}`);
}

function isMetaRequest(request) {
  const reqUrl = new URL(request.url);
  return reqUrl.pathname.includes(`/${META_PREFIX}`) || reqUrl.pathname.endsWith(META_PREFIX);
}

async function setMetaTimestamp(cache, url, timestamp) {
  await cache.put(buildMetaRequest(url), new Response(String(timestamp)));
}

async function getFreshShortCache(cache, request) {
  const cachedResponse = await cache.match(request);
  if (!cachedResponse) return null;

  const metaResponse = await cache.match(buildMetaRequest(request.url));
  if (!metaResponse) return cachedResponse;

  const rawValue = await metaResponse.text();
  const timestamp = Number(rawValue);

  if (!Number.isFinite(timestamp)) {
    await cache.delete(request);
    await cache.delete(buildMetaRequest(request.url));
    return null;
  }

  if (Date.now() - timestamp > SHORT_CACHE_MAX_AGE_MS) {
    await cache.delete(request);
    await cache.delete(buildMetaRequest(request.url));
    return null;
  }

  return cachedResponse;
}

async function trimShortCache(cache) {
  const keys = await cache.keys();
  const dataRequests = keys.filter((request) => !isMetaRequest(request));
  if (dataRequests.length <= SHORT_CACHE_MAX_ITEMS) return;

  const entries = await Promise.all(
    dataRequests.map(async (request) => {
      const meta = await cache.match(buildMetaRequest(request.url));
      const timestamp = meta ? Number(await meta.text()) : 0;
      return {
        request,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0
      };
    })
  );

  entries.sort((a, b) => a.timestamp - b.timestamp);
  const toDelete = entries.slice(0, entries.length - SHORT_CACHE_MAX_ITEMS);

  await Promise.all(
    toDelete.map(async ({ request }) => {
      await cache.delete(request);
      await cache.delete(buildMetaRequest(request.url));
    })
  );
}
