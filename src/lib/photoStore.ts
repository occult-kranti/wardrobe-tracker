/**
 * THE PHOTOGRAPH STORE — where the pictures live once they are out of the purse.
 *
 * localStorage is a purse: one origin, one quota, five megabytes on most
 * phones and ten if you are lucky, and EVERY byte of it is a string this app
 * re-serialises on every committed state. A photographed piece costs on the
 * order of a hundred kilobytes as base64 (src/components/AddItemModal.tsx caps
 * the stored tile at 640px, JPEG 0.85), so a forty-piece photographed closet
 * is the whole purse and a fiftieth piece is the toast that says "this device
 * would not take the write". That toast is honest, and it is also the end of
 * the road for anyone who photographs their clothes — which is the app.
 *
 * IndexedDB is a room instead of a purse: same origin, same privacy, no
 * telemetry, no network, but the quota is a share of the disk rather than a
 * five-megabyte line, and the app does not re-serialise it on every keystroke.
 * So the pictures move there and the RECORD keeps a reference — `idb:<id>` —
 * where the data URL used to sit.
 *
 * FOUR PROMISES, and they are the whole design:
 *
 * 1. NOTHING ALREADY WRITTEN CHANGES ITS MEANING. An `imageUrl` holding a
 *    `data:` URL is valid forever and renders unchanged. There is no
 *    migration, no rewrite pass, no schema change — `imageUrl` was a string
 *    and stays a string, which is why scripts/test-migrate.mjs has nothing to
 *    say about this wave.
 * 2. A REFERENCE NEVER LEAVES THIS DEVICE. Two doors carry a wardrobe off it:
 *    the export file and a sync push. Both INLINE — a reference is resolved
 *    back to its data URL on the way out (see `inlinePhotos`), because a file
 *    on a desktop and a row on the account cannot reach this browser's
 *    IndexedDB. What arrives from elsewhere is stored as it arrives; inline
 *    works everywhere, which is why the inbound direction needs no rule.
 * 3. NO INDEXEDDB, NO REFERENCES. Private windows refuse the database, some
 *    browsers refuse it behind a blocked upgrade, and any of it can fail
 *    mid-write. In every one of those cases `storePhoto` hands back the data
 *    URL untouched and the record keeps it inline — exactly today's behaviour,
 *    which is durable. A reference is only ever written when there is
 *    somewhere for it to point.
 * 4. A REFERENCE IS RESOLVED WHERE IT IS DRAWN, SYNCHRONOUSLY. `photoSrc` is
 *    a plain function, not a hook, so it is legal inside the `.map()` callbacks
 *    where most of this app's photo tiles are actually written.
 *
 * WHY THE DATA URL AND NOT A BLOB. IndexedDB stores either. The data URL is
 * kept because it is the exact string the record held, byte for byte, so the
 * two doors above are transcription rather than re-encoding, and "lossless
 * export forever" needs no argument about whether a re-encoded JPEG is the
 * same photograph. A blob would be about a third smaller on disk and cheaper
 * in memory; that is an optimisation for a later wave, and it belongs behind
 * the same `getPhoto`/`putPhoto` seam that is here now.
 */

/** The scheme. Deliberately not a real URL scheme — nothing must try to fetch it. */
export const PHOTO_REF_PREFIX = 'idb:';

const DB_NAME = 'almari-photos';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

/**
 * WHETHER NEW PHOTOGRAPHS ARE WRITTEN AS REFERENCES. On, as of the wiring wave.
 *
 * It shipped false for one wave, and the reason was not caution for its own
 * sake: this app renders `imageUrl` straight into an `<img src>` at two dozen
 * sites across fifteen files, and with the flag on before those sites resolved,
 * the closet tile rendered `<img src="idb:...">` at naturalWidth 0 — measured,
 * not assumed. Every one of those sites now goes through `photoSrc`, the shell
 * hydrates the cache at boot (src/App.tsx), the context sweeps what nothing
 * names any more (src/context/WardrobeContext.tsx), and the third door — a
 * snapshot copied into the community store — inlines rather than referencing.
 * `scripts/test-photos.mjs` pins this value and scans every `<img src>` in the
 * tree, so the flip is a deliberate edit to a test and never a drift.
 *
 * WHAT SWITCHING IT BACK OFF WOULD DO, because that has to be safe too: new
 * photographs go back to being written inline, and every reference ALREADY on a
 * record keeps drawing — `photoSrc` resolves whatever the record holds, the
 * flag is read only by `storePhoto`, and the sweep marks against the documents
 * rather than against the flag. Nothing is stranded by the switch in either
 * direction.
 */
export const PHOTO_REFS_ENABLED = true;

/** Is this string a reference into the store, rather than a picture itself? */
export function isPhotoRef(src: string | null | undefined): boolean {
  return typeof src === 'string' && src.startsWith(PHOTO_REF_PREFIX);
}

/** The id inside a reference, or '' if this was never one. */
export function photoRefId(src: string): string {
  return isPhotoRef(src) ? src.slice(PHOTO_REF_PREFIX.length) : '';
}

/** A reference, from an id. */
export function photoRef(id: string): string {
  return PHOTO_REF_PREFIX + id;
}

function newPhotoId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Any environment without randomUUID still needs ids that do not collide
  // inside one session; the store is device-local, so this is enough.
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ==================== the database, opened once and lazily ==================== */

/**
 * Nothing at module scope touches `indexedDB`. This file is imported by
 * src/lib/sync.ts, which scripts/test-sync.mjs bundles and runs in bare Node —
 * and by the native app's future export path, which has no such object at all.
 * An import that reached for a browser global would make both of those a crash
 * instead of a fallback.
 */
let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * How long to wait for the database before deciding there isn't one.
 *
 * `open()` can fire neither `onsuccess` nor `onerror`: a version upgrade
 * blocked by another tab leaves the request pending indefinitely. Without a
 * ceiling, `putPhoto` would never settle, and `putPhoto` is awaited on the path
 * that adds a piece — a hung promise there is a form that never saves. The
 * ceiling turns the worst case into "this photograph stays inline", which is
 * today's behaviour and costs nothing but bytes.
 */
const OPEN_TIMEOUT_MS = 3000;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    let settled = false;
    const done = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };
    try {
      const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!factory) return done(null);
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => done(request.result);
      request.onerror = () => done(null);
      request.onblocked = () => done(null);
      const timer = setTimeout(() => done(null), OPEN_TIMEOUT_MS);
      // Node keeps the process alive for a pending timer; a test suite that
      // finished should not sit here for three seconds.
      (timer as unknown as { unref?: () => void }).unref?.();
    } catch {
      // Firefox in a private window throws from open() rather than erroring.
      done(null);
    }
  });
  return dbPromise;
}

/** Is there a durable store on this device? Used to decide whether to write a ref. */
export async function photosAreDurable(): Promise<boolean> {
  return (await openDb()) !== null;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    db =>
      new Promise<T | null>(resolve => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const request = work(tx.objectStore(STORE_NAME));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
          tx.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/* ==================== the fallback, and the warm cache ==================== */

/**
 * Two maps, and they are not the same thing.
 *
 * `fallback` is the STORE when there is no database — a private window, a
 * refused upgrade. It lives as long as the tab does, which is why nothing
 * writes a reference into a RECORD while this is the only store there is
 * (see `storePhoto`): a reference whose target dies with the tab is a
 * photograph thrown away, and this app does not throw things away.
 *
 * `cache` is what makes `photoSrc` synchronous. Every put seeds it, and
 * `hydratePhotos` fills it from disk once at boot, so the closet grid can
 * draw a reference in the same frame it draws everything else.
 */
const fallback = new Map<string, string>();
const cache = new Map<string, string>();

/** Fired when `hydratePhotos` has finished, so a shell can redraw once. */
export const PHOTOS_HYDRATED_EVENT = 'almari:photos-hydrated';

/* ==================== the store ==================== */

/**
 * Keep a picture and hand back the reference to it. Always a reference: when
 * there is no database the picture is held in memory for this tab, which is
 * what the tests exercise and what a private window gets. Callers writing to a
 * RECORD want `storePhoto`, which refuses to hand out a reference that memory
 * alone is standing behind.
 */
export async function putPhoto(dataUrl: string, id: string = newPhotoId()): Promise<string> {
  cache.set(id, dataUrl);
  const db = await openDb();
  if (!db) {
    fallback.set(id, dataUrl);
    return photoRef(id);
  }
  const ok = await run<IDBValidKey>('readwrite', store => store.put(dataUrl, id));
  // A refused write (quota, a closing database) still has to be readable for
  // as long as this tab lives, or the piece just added draws nothing.
  if (ok === null) fallback.set(id, dataUrl);
  return photoRef(id);
}

/** The picture behind a reference, or null if this device has no such picture. */
export async function getPhoto(ref: string): Promise<string | null> {
  const id = isPhotoRef(ref) ? photoRefId(ref) : ref;
  if (!id) return null;
  const warm = cache.get(id);
  if (warm !== undefined) return warm;
  const held = fallback.get(id);
  if (held !== undefined) return held;
  const stored = await run<unknown>('readonly', store => store.get(id) as IDBRequest<unknown>);
  if (typeof stored !== 'string') return null;
  cache.set(id, stored);
  return stored;
}

/** Forget a picture entirely. A no-op on anything that was never a reference. */
export async function removePhoto(ref: string): Promise<void> {
  const id = isPhotoRef(ref) ? photoRefId(ref) : '';
  if (!id) return;
  cache.delete(id);
  fallback.delete(id);
  await run<undefined>('readwrite', store => store.delete(id) as IDBRequest<undefined>);
}

/** Every id this device is holding a picture for. */
export async function photoIds(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>('readonly', store => store.getAllKeys());
  const fromDb = (keys ?? []).filter((k): k is string => typeof k === 'string');
  return [...new Set([...fromDb, ...fallback.keys()])];
}

/**
 * Read every picture into the cache so `photoSrc` can answer synchronously.
 * Returns how many it warmed. Announced, because the first paint happens
 * before this finishes and the tiles that drew nothing need a second chance.
 */
export async function hydratePhotos(): Promise<number> {
  const ids = await photoIds();
  for (const id of ids) {
    if (cache.has(id)) continue;
    const stored = await getPhoto(id);
    if (stored !== null) cache.set(id, stored);
  }
  const announce = (globalThis as { dispatchEvent?: (e: Event) => boolean }).dispatchEvent;
  try {
    if (typeof announce === 'function' && typeof CustomEvent === 'function') {
      announce.call(globalThis, new CustomEvent(PHOTOS_HYDRATED_EVENT, { detail: { count: cache.size } }));
    }
  } catch {
    /* no event bus here — hydration still happened */
  }
  return cache.size;
}

/* ==================== drawing ==================== */

/**
 * THE ONE LINE EVERY PHOTO TILE NEEDS: `src={photoSrc(item.imageUrl)}`.
 *
 * A plain function rather than a hook, on purpose. Most of this app's photo
 * tiles are written inside `.map()` callbacks (Rail, Furniture, Events), where
 * a hook is illegal — a resolver that could not be used at two thirds of the
 * sites it exists for would not be a resolver.
 *
 * Anything that is not a reference comes straight back out, so the call is
 * safe on a data URL, on '' and on undefined: the inline pictures already
 * written keep drawing through the exact same expression.
 *
 * A reference nothing has warmed yet returns '' rather than the reference,
 * because every one of those sites already reads its own value for
 * truthiness and falls through to the drawn garment flat. Empty is the
 * app's existing word for "no photograph", and it draws something correct;
 * an unresolvable string in an `<img src>` draws a broken-image glyph.
 */
export function photoSrc(src: string | null | undefined): string {
  if (typeof src !== 'string' || src === '') return '';
  if (!isPhotoRef(src)) return src;
  return cache.get(photoRefId(src)) ?? '';
}

/** The async form, for a caller that can wait (a detail sheet, a share sheet). */
export async function resolvePhoto(src: string | null | undefined): Promise<string> {
  if (typeof src !== 'string' || src === '') return '';
  if (!isPhotoRef(src)) return src;
  return (await getPhoto(src)) ?? '';
}

/* ==================== the write path's decision ==================== */

/**
 * What a RECORD should hold for this picture.
 *
 * The whole of promise 3 lives in these six lines. A reference is written only
 * when references are switched on AND a durable store took the picture; in
 * every other case the data URL itself comes back and the record keeps it
 * inline, which is what this app has always done and is durable by definition.
 *
 * Never throws. A photograph failing to file is not a reason for a piece to
 * fail to be added.
 */
export async function storePhoto(dataUrl: string): Promise<string> {
  if (!PHOTO_REFS_ENABLED) return dataUrl;
  if (typeof dataUrl !== 'string' || dataUrl === '' || isPhotoRef(dataUrl)) return dataUrl;
  try {
    if (!(await photosAreDurable())) return dataUrl;
    return await putPhoto(dataUrl);
  } catch {
    return dataUrl;
  }
}

/* ==================== the two doors ==================== */

/** How a reference is turned back into a picture on the way out. Injectable so
 *  a test can stand in for the disk, and so the native app can supply its own
 *  (its references are file paths, and its export inlines them the same way). */
export type PhotoResolver = (ref: string) => Promise<string | null>;

/**
 * Deep-copy a JSON-shaped value with every `idb:` reference replaced by the
 * picture it names. This is what makes an export file openable on a desktop
 * and a pushed row openable on a second phone.
 *
 * Walks by SHAPE, not by field name. `imageUrl` is where references live
 * today, but a document also carries wishlist pictures, outfit pictures,
 * circle showcases and whatever a newer build has added; a walker that knew
 * the field names would inline exactly the fields somebody remembered, which
 * is the denylist mistake exportDoc.ts was written to stop repeating.
 *
 * A reference the device cannot resolve is LEFT AS IT IS rather than blanked.
 * The picture is already gone — blanking would additionally throw away the
 * fact that there was one, and this app does not throw things away. The count
 * comes back so a caller can say so out loud if it ever wants to.
 */
export async function inlinePhotos<T>(
  value: T,
  resolve: PhotoResolver = getPhoto,
): Promise<{ value: T; inlined: number; missing: number }> {
  let inlined = 0;
  let missing = 0;

  const walk = async (node: unknown): Promise<unknown> => {
    if (typeof node === 'string') {
      if (!isPhotoRef(node)) return node;
      const picture = await resolve(node);
      if (typeof picture === 'string' && picture !== '') {
        inlined++;
        return picture;
      }
      missing++;
      return node;
    }
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      for (const entry of node) out.push(await walk(entry));
      return out;
    }
    if (node !== null && typeof node === 'object') {
      // Only plain objects are rebuilt. A Date, a Set, a Blob is somebody's
      // runtime furniture and is handed back by reference rather than
      // flattened into an object shape it never had.
      const proto = Object.getPrototypeOf(node);
      if (proto !== Object.prototype && proto !== null) return node;
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(node as Record<string, unknown>)) {
        out[key] = await walk(entry);
      }
      return out;
    }
    return node;
  };

  return { value: (await walk(value)) as T, inlined, missing };
}

/** The same thing when only the document is wanted. */
export async function inlinePhotosIn<T>(value: T, resolve?: PhotoResolver): Promise<T> {
  return (await inlinePhotos(value, resolve)).value;
}

/** Does this document mention the store at all? Lets a caller skip the walk. */
export function hasPhotoRefs(value: unknown): boolean {
  if (typeof value === 'string') return isPhotoRef(value);
  if (Array.isArray(value)) return value.some(hasPhotoRefs);
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(value as Record<string, unknown>).some(hasPhotoRefs);
  }
  return false;
}

/* ==================== keeping the room tidy ==================== */

/**
 * Remove every picture the given document no longer mentions.
 *
 * A sweep rather than a delete-on-delete hook, and the reason is honest: a
 * picture can stop being referenced in half a dozen ways — a piece deleted, a
 * wishlist entry released, an outfit removed, a photograph replaced by a
 * cut-out, a whole state replaced by an import — and a hook on each of those
 * is six chances to miss one and leak a picture forever. One pass over the
 * document that is now true says exactly which ids still matter.
 *
 * The document must be the WHOLE wardrobe. Handed a fragment, this would
 * delete the pictures the fragment happens not to mention, so callers pass
 * state and never a slice of it.
 */
export async function sweepPhotos(state: unknown): Promise<number> {
  const kept = new Set<string>();
  const mark = (node: unknown): void => {
    if (typeof node === 'string') {
      if (isPhotoRef(node)) kept.add(photoRefId(node));
      return;
    }
    if (Array.isArray(node)) return node.forEach(mark);
    if (node !== null && typeof node === 'object') {
      const proto = Object.getPrototypeOf(node);
      if (proto !== Object.prototype && proto !== null) return;
      Object.values(node as Record<string, unknown>).forEach(mark);
    }
  };
  mark(state);

  let removed = 0;
  for (const id of await photoIds()) {
    if (kept.has(id)) continue;
    await removePhoto(photoRef(id));
    removed++;
  }
  return removed;
}

/**
 * Drop everything, including the database. Only the tests and a future
 * "forget this wardrobe" want this; nothing on a normal path calls it.
 */
export async function clearPhotos(): Promise<void> {
  cache.clear();
  fallback.clear();
  await run<undefined>('readwrite', store => store.clear() as IDBRequest<undefined>);
}
