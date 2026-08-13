/**
 * Almari's service worker — the whole of "works with no signal".
 *
 * There is nothing to sync, because there is no server: the wardrobe already
 * lives in this browser's localStorage. The only thing standing between the
 * app and a plane is the shell — the HTML, the script, the stylesheet and the
 * two typefaces — which is what this caches.
 *
 * It precaches nothing at install, because Vite hashes every asset name and a
 * hard-coded list would go stale the moment we build. Instead the first visit
 * fills the cache as it loads, and every visit after that is served from it.
 * The cost is that the very first load still needs a network; the benefit is a
 * worker that cannot ship a wrong filename.
 */

const CACHE = 'toile-shell-v1';

// The address of the app's own HTML, whatever subdirectory it was deployed to.
const SHELL = new URL('./', self.location).href;

self.addEventListener('install', event => {
  // Take over as soon as the new worker is ready; a stale shell serving a new
  // build's asset names is the one failure mode worth being impatient about.
  event.waitUntil(caches.open(CACHE).then(c => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      // Drop the cached shell whenever a worker activates. Vite hashes asset
      // names, so a shell held from a previous build points at filenames the
      // server no longer has — serve it once and every script and stylesheet
      // 404s. The assets themselves are safe to keep (a changed file is a
      // changed URL); only the document that names them can go stale.
      .then(() => caches.open(CACHE).then(c => c.delete(SHELL)))
      .then(() => self.clients.claim()),
  );
});

/** Put a copy away, quietly. A full cache must never break a page load. */
async function keep(request, response) {
  if (!response || response.status !== 200) return;
  // Opaque responses (the typefaces, served cross-origin) have status 0 and
  // are cached separately below — everything else must be a real 200.
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  } catch {
    /* quota, or a request that cannot be cached — the page still has its copy */
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // A navigation: try the network so a new build is picked up, and fall back
  // to the cached shell when there is no signal. Because the router is a
  // HashRouter, every address in the app is this one document.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          keep(SHELL, response);
          return response;
        })
        .catch(async () => (await caches.match(SHELL)) ?? Response.error()),
    );
    return;
  }

  // Everything else: cache first. Hashed asset names make this safe — a
  // changed file is a changed URL, so a cached copy can never be the wrong one.
  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request)
        .then(response => {
          // Typefaces come back opaque from another origin. Cache them anyway:
          // an unreadable response still renders, and type is most of the app.
          if (sameOrigin || response.type === 'opaque') keep(request, response);
          return response;
        })
        .catch(() => caches.match(request).then(c => c ?? Response.error()));
    }),
  );
});
