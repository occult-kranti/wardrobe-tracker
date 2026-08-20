/**
 * Almari's service worker — the whole of "works with no signal".
 *
 * There is no server to sync with: the wardrobe already lives in this
 * browser's storage. The only thing standing between the app and a plane is
 * the shell — the HTML, the scripts, the stylesheet and the typefaces — which
 * is what this file keeps.
 *
 * IT USED TO KEEP NOTHING. Two bugs, either one fatal on its own:
 *   1. `keep()` opened the cache with `await` and only then called
 *      `response.clone()`. By the time that await resolved the body was
 *      already streaming to the page, the stream was locked, clone() threw,
 *      and the catch swallowed it. Measured: after a first visit, a
 *      worker-controlled second visit and an explicit fetch, the cache held
 *      ZERO entries.
 *   2. `activate` deleted the shell that `install` had just cached, so even a
 *      working clone would have left the first day offline-dead — the exact
 *      path the alpha ships on: open the link once, Add to Home Screen, open
 *      it again in a metro tunnel.
 * Both are fixed below: every copy is cloned SYNCHRONOUSLY, before anything
 * can read the body, and nothing deletes what this build put away.
 *
 * The old comment said precaching was impossible because Vite hashes asset
 * names and a hard-coded list would go stale. That was true of a list written
 * by hand. The list below is written by the build (`almari-sw-precache` in
 * vite.config.ts) from the files it actually emitted, so it cannot name a file
 * that is not there, and the cache is named after a hash of that list: a new
 * build is a new cache, and `activate` drops every older one. That is also
 * what keeps a superseded build's JS from sitting in storage forever on a
 * 32GB phone, where storage pressure evicts the shell along with the junk.
 *
 * Strategies, and why:
 *   navigation  — network first, with a three-second patience, then the cached
 *                 shell. A new build must be picked up the moment there is
 *                 signal, and a stalled cell must not hold a blank screen; the
 *                 router is a HashRouter, so every address is this one document.
 *   assets/*    — cache first. The name carries a content hash, so a cached
 *   and the      copy can never be the wrong one; and a precached file is this
 *   precache     build's own, re-fetched in full whenever the build changes.
 *   everything  — stale while revalidate. The sample photographs and anything
 *   else          else public/ grows: answer from the copy, replace it quietly.
 */

/* Replaced at build time by the plugin in vite.config.ts. Left as written they
   mean "no build has touched this file" — the dev copy, which caches what it
   sees rather than pretending to a precache list it does not have. The
   placeholders are the plugin's contract: if it cannot find them it fails the
   build rather than shipping a worker that keeps nothing. */
const BUILD = '__ALMARI_BUILD__';
const PRECACHE = ['__ALMARI_PRECACHE__'];

/* ONE sentinel, and it is BUILD, never the file names.
   The two placeholders are replaced together or not at all (the plugin fails
   the build if it cannot find both), so the state of BUILD is the state of the
   list. Testing the file names for "__" instead — which this file did for one
   afternoon — quietly drops any asset whose Vite hash happens to contain a
   double underscore: the hash alphabet includes it, and `Chats-BY9kRd__.js`
   turned up in the very next build. That page then failed offline while every
   check about "the build is precached" still passed. */
const untouched = BUILD.indexOf('__') === 0;

const CACHE = 'almari-shell-' + (untouched ? 'dev' : BUILD);

// The address of the app's own HTML, whatever subdirectory it was deployed to.
const SHELL = new URL('./', self.location).href;

// Absolute now, so nothing downstream has to remember what they were relative to.
const SHELL_FILES = untouched ? [] : PRECACHE.map(path => new URL(path, self.location).href);

/* What install put away, by address. A precached file needs no revalidation
   for the life of this cache: the cache is named after the build, so a new
   build fetches the whole list again under a new name. Without this set the
   self-hosted type, the icons and the manifest would each fire a background
   fetch on every single load — the metered data the install handler takes
   care not to spend, spent anyway, for ever. */
const PRECACHED = new Set(SHELL_FILES);

/** The two spellings of the app's own document. Every address in the app is
    this one path plus a hash, because the router is a HashRouter. */
const APP_PATH = new URL(SHELL).pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const IS_APP_DOCUMENT = new RegExp(`^${APP_PATH}(index\\.html)?$`);

/** A hashed build asset: the one class of URL whose contents can never change. */
const HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css)$/;

/** Nothing this big belongs in a shell cache — the demo films are 12MB. */
const TOO_BIG = 5 * 1024 * 1024;

/** How long a navigation waits for a stalled network before opening the copy. */
const SHELL_TIMEOUT = 3000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // The document first, and forced past the HTTP cache: a stale copy of the
    // one file that names every other file is the failure this whole worker
    // exists to avoid. The rest are hashed, so the HTTP cache's copy of them
    // is by definition the right one, and re-fetching it would spend a second
    // megabyte of a metered phone for nothing.
    await cache.add(new Request(SHELL, { cache: 'reload' })).catch(() => {});
    // allSettled, not all: one asset that 404s must not cost the shell its
    // whole precache. Whatever fails here is fetched on demand later anyway.
    await Promise.allSettled(SHELL_FILES.map(url => cache.add(url)));
  })());
  // Take over as soon as the new worker is ready; a stale shell serving a new
  // build's asset names is the one failure mode worth being impatient about.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Every older cache, including the pre-rewrite 'toile-shell-v1'. The
    // current one is NOT touched: this build's shell was just put away, and
    // deleting it here is how the first day offline used to die.
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

/** Put a copy away, quietly. A full cache must never break a page load. */
async function keep(request, response) {
  try {
    const type = response.headers.get('content-type') || '';
    const size = Number(response.headers.get('content-length') || '0');
    // The films in public/ are 12MB and 6MB and belong to the company board,
    // not the app; one stray navigation should not spend a phone's storage on
    // them and lose the shell in the eviction that follows.
    if (type.indexOf('video/') === 0 || size > TOO_BIG) return;
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch {
    /* quota, or a request that cannot be cached — the page still has its copy */
  }
}

/**
 * Take a copy of a response that is on its way to the page.
 *
 * The clone happens HERE, synchronously, in the same turn the response
 * arrived: no await may come between the two lines below. That single ordering
 * is the bug this worker shipped with, and it is invisible in review because
 * the failure is swallowed by a catch.
 */
function copyAway(event, key, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  const copy = response.clone();
  event.waitUntil(keep(key, copy));
}

/**
 * A navigation: the network first, but not forever.
 *
 * "No signal" is the easy case — fetch rejects and the copy answers. The case
 * that actually loses testers is the congested cell that accepts the
 * connection and then stalls: a plain network-first worker sits on a blank
 * screen for as long as the phone is willing to wait. So the network gets
 * three seconds to prove it is there, and after that the app opens from the
 * copy while the fetch finishes quietly into the cache for next time.
 *
 * The copy can only ever be THIS build's shell — install put it there and the
 * cache is named after the build — so serving it is not serving a stale app.
 */
async function navigate(event) {
  const held = await caches.match(SHELL, { ignoreVary: true })
    || await caches.match(new URL('index.html', self.location).href, { ignoreVary: true });
  const network = fetch(event.request).then(response => {
    copyAway(event, SHELL, response);
    return response;
  });

  if (!held) {
    // Nothing to fall back on: the first visit has to come off the network.
    return network.catch(() => Response.error());
  }

  const slow = new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), SHELL_TIMEOUT));
  try {
    return await Promise.race([network, slow]);
  } catch {
    event.waitUntil(network.catch(() => {}));
    return held;
  }
}

async function asset(event, url) {
  const request = event.request;
  const held = await caches.match(request, { ignoreVary: true });
  // A hashed name is a promise about the bytes, and a precached file is this
  // build's own copy. Neither has anything to revalidate.
  if (held && (PRECACHED.has(url.href) || HASHED.test(url.pathname))) return held;

  const network = fetch(request).then(response => {
    copyAway(event, request, response);
    return response;
  });

  if (held) {
    // Stale while revalidate: the copy answers now, the network replaces it
    // for next time, and a failure changes nothing the reader can see.
    event.waitUntil(network.catch(() => {}));
    return held;
  }
  try {
    return await network;
  } catch {
    const late = await caches.match(request, { ignoreVary: true });
    return late || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cross-origin is left entirely alone. There is one class of it — the
  // account's own API — and a wardrobe's sync payload has no business in a
  // cache that outlives a sign-out.
  if (url.origin !== self.location.origin) return;

  // The app's own document, and only that one. public/ also ships pages that
  // are not the app (the alpha sheet, and whatever the board adds next); a
  // blanket SPA fallback would answer a request for one of those with the
  // wardrobe, which is a wrong page served silently rather than an honest miss.
  if (request.mode === 'navigate' && IS_APP_DOCUMENT.test(url.pathname)) {
    event.respondWith(navigate(event));
    return;
  }

  event.respondWith(asset(event, url));
});
