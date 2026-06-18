/* eslint-disable no-restricted-globals */

const APP_SHELL_CACHE = 'app-shell-v1';
const API_CACHE = 'api-v1';
const THUMBNAIL_CACHE = 'thumbnails-v1';
const AUDIO_FULL_CACHE = 'audio-full-v1';

const SHELL_CACHE_URLS = ['/', '/index.html'];

function isGet(request) {
  return request && request.method === 'GET';
}

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function extractAppShellUrlsFromHtml(html) {
  const urls = new Set();

  // JS entrypoints.
  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match = null;
  while ((match = scriptRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  // Stylesheets.
  const styleRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = styleRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp && resp.ok) {
    cache.put(request, resp.clone());
  }
  return resp;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ error: 'Backend unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const resp = await fetch(request);
    if (resp && resp.ok) {
      // Cache under canonical URLs so offline navigation works regardless of route.
      cache.put('/index.html', resp.clone());
      cache.put('/', resp.clone());
    }
    return resp;
  } catch {
    const cached = (await cache.match('/index.html')) || (await cache.match('/'));
    if (cached) return cached;

    return new Response('Offline: app shell not cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

function isAppShellAsset(url) {
  const pathname = url.pathname;
  if (pathname === '/index.html') return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname.startsWith('/src/')) return true; // dev-time modules
  if (pathname.startsWith('/@/')) return true; // Vite internal
  if (pathname.startsWith('/@')) return true; // Vite internal
  if (pathname.endsWith('.js')) return true;
  if (pathname.endsWith('.css')) return true;
  if (pathname.endsWith('.map')) return true;
  if (pathname.endsWith('.woff2')) return true;
  if (pathname.endsWith('.woff')) return true;
  return false;
}

function parseBytesRange(rangeHeader, totalBytes) {
  // Expected format: bytes=start-end, where end may be empty.
  const match = /^bytes\s*=\s*(\d+)\s*-\s*(\d*)\s*$/i.exec(rangeHeader);
  if (!match) return null;

  const start = Number(match[1]);
  const endRaw = match[2];
  const end = endRaw ? Number(endRaw) : totalBytes - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0) return null;
  if (end < start) return null;
  if (start >= totalBytes) return { start, end: totalBytes - 1, invalid: true };

  return { start, end, invalid: false };
}

async function sliceAudioFromFullResponse(fullResp, rangeHeader) {
  const contentType = fullResp.headers.get('Content-Type') || 'audio/mpeg';
  const fullBuffer = await fullResp.arrayBuffer();
  const totalBytes = fullBuffer.byteLength;
  const parsed = parseBytesRange(rangeHeader, totalBytes);

  if (!parsed) {
    return new Response('', {
      status: 416,
      headers: {
        'Content-Range': `bytes */${totalBytes}`,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      },
    });
  }

  if (parsed.invalid) {
    return new Response('', {
      status: 416,
      headers: {
        'Content-Range': `bytes */${totalBytes}`,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      },
    });
  }

  const sliceStart = parsed.start;
  const sliceEnd = parsed.end;
  const sliced = fullBuffer.slice(sliceStart, sliceEnd + 1);

  return new Response(sliced, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(sliceEnd - sliceStart + 1),
      'Content-Range': `bytes ${sliceStart}-${sliceEnd}/${totalBytes}`,
    },
  });
}

async function handleAudioRequest(request) {
  const rangeHeader = request.headers.get('Range');
  const cacheKey = request.url; // URL is enough; Range is a header.
  const cache = await caches.open(AUDIO_FULL_CACHE);

  // No Range: serve/cache full response.
  if (!rangeHeader) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const resp = await fetch(request);
    if (resp && resp.ok) {
      cache.put(cacheKey, resp.clone());
    }
    return resp;
  }

  // Range present: slice from cached full audio.
  const cachedFull = await cache.match(cacheKey);
  if (cachedFull) {
    return sliceAudioFromFullResponse(cachedFull, rangeHeader);
  }

  // Cache miss: try fetching the full object (without Range) so we can slice.
  try {
    const fullHeaders = new Headers(request.headers);
    fullHeaders.delete('Range');

    const fullReq = new Request(request.url, {
      method: 'GET',
      headers: fullHeaders,
      // Keep credentials/mode behavior aligned with the original request.
      credentials: request.credentials,
      mode: request.mode,
      redirect: request.redirect,
      referrer: request.referrer,
    });

    const fullResp = await fetch(fullReq);
    if (!fullResp || !fullResp.ok) throw new Error('Full fetch failed');

    cache.put(cacheKey, fullResp.clone());
    return sliceAudioFromFullResponse(fullResp, rangeHeader);
  } catch {
    return new Response('Offline audio unavailable (cache miss for full audio).', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      try {
        await cache.addAll(SHELL_CACHE_URLS);
      } catch {
        // Ignore install precache failures; runtime caching will still work.
      }

      // Best-effort precache of JS/CSS referenced by index.html.
      // This helps ensure offline reload works even if the initial page load happened
      // before this SW became active.
      try {
        const resp = await fetch('/index.html', { cache: 'reload' });
        if (!resp || !resp.ok) return;
        const html = await resp.text();

        const candidateUrls = extractAppShellUrlsFromHtml(html);
        if (candidateUrls.length === 0) return;

        await Promise.all(
          candidateUrls.map(async candidate => {
            const abs = new URL(candidate, self.registration.scope).href;
            try {
              await cache.add(abs);
            } catch {
              // Ignore individual asset failures.
            }
          })
        );
      } catch {
        // Ignore precache failures.
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Remove old caches (simple cleanup).
      const keys = await caches.keys();
      const allowed = new Set([APP_SHELL_CACHE, API_CACHE, THUMBNAIL_CACHE, AUDIO_FULL_CACHE]);
      await Promise.all(keys.map(key => (allowed.has(key) ? Promise.resolve() : caches.delete(key))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!isGet(request)) return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  // Critical: audio with Range support for persisted files at /audio/<filename>.
  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // Thumbnails: cache first.
  if (url.pathname.startsWith('/thumbnails/')) {
    event.respondWith(cacheFirst(request, THUMBNAIL_CACHE));
    return;
  }

  // API JSON: network first.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // App shell HTML navigation.
  const accept = request.headers.get('accept') || '';
  const isNavigation =
    request.mode === 'navigate' ||
    (request.destination === 'document' && accept.includes('text/html')) ||
    (request.destination === '' && accept.includes('text/html'));

  if (isNavigation) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  if (isAppShellAsset(url)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }
});

