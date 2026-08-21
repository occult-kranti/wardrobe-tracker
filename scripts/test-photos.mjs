#!/usr/bin/env node
/**
 * The photograph store's checks: the round trip, the fallback, the walker that
 * inlines a document on its way off the device, the sweep, and the one number
 * this whole wave exists for — what a photographed closet costs the purse.
 *
 * Follows the repo pattern (test-sync.mjs, test-export.mjs): esbuild-bundle the
 * lib into a temp dir, import the bundle, assert. What it does NOT do is mock
 * the store it is testing. IndexedDB is stood up here as a small in-memory
 * implementation of the four calls src/lib/photoStore.ts actually makes, so the
 * database branch — the one a browser runs and the one a bare-Node import never
 * reaches — is exercised for real: open, upgrade, transaction, put/get/delete/
 * getAllKeys. A test that skipped it would be testing the fallback twice and
 * calling it coverage.
 *
 * The three environments a person actually has are all here:
 *   1. A browser with a working database.
 *   2. A private window, where open() THROWS (Firefox) or errors (Safari).
 *   3. Bare Node, or any runtime with no `indexedDB` at all.
 * The rule that must hold in 2 and 3 is the one that keeps this safe: no
 * reference is ever written into a record when there is nowhere for it to
 * point, so the record keeps the picture inline, exactly as it did before this
 * file existed.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'photos-'));
await build({
  alias: sharedAliases(),
  entryPoints: { 'lib/photoStore': fileURLToPath(new URL('../src/lib/photoStore.ts', import.meta.url)) },
  bundle: true,
  format: 'esm',
  outdir: dir,
  jsx: 'automatic',
  logLevel: 'error',
});

const MODULE = pathToFileURL(join(dir, 'lib', 'photoStore.js')).href;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

/* ==================== a small, honest IndexedDB ====================
   Only the surface photoStore touches, and asynchronous in the same way the
   real one is: every request settles on a later turn, AFTER the caller has had
   its chance to attach onsuccess. A synchronous fake would pass a store that
   the browser would hang on. */

function makeFakeIndexedDB() {
  const data = new Map();
  const soon = fn => setTimeout(fn, 0);

  const objectStore = name => {
    const map = data.get(name);
    const answer = result => {
      const request = { onsuccess: null, onerror: null, result: undefined };
      soon(() => {
        request.result = result;
        request.onsuccess?.();
      });
      return request;
    };
    return {
      put(value, key) { map.set(key, value); return answer(key); },
      get(key) { return answer(map.get(key)); },
      delete(key) { map.delete(key); return answer(undefined); },
      getAllKeys() { return answer([...map.keys()]); },
      clear() { map.clear(); return answer(undefined); },
    };
  };

  const db = {
    objectStoreNames: { contains: name => data.has(name) },
    createObjectStore(name) { data.set(name, new Map()); return objectStore(name); },
    transaction(name) {
      return { objectStore: () => objectStore(name), onabort: null, onerror: null };
    },
  };

  return {
    /** The rows, for the assertions to look at directly. */
    rows: () => data.get('photos') ?? new Map(),
    open() {
      const request = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, result: db };
      soon(() => {
        if (!data.has('photos')) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

/** A private window in Firefox: open() throws outright. */
const throwingIndexedDB = { open() { throw new Error('the database is not available here'); } };

/** A private window in Safari: open() returns a request that errors. */
const erroringIndexedDB = {
  open() {
    const request = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, result: null };
    setTimeout(() => request.onerror?.(), 0);
    return request;
  },
};

/**
 * A fresh module instance. Every import of the same URL shares one set of
 * module-level maps — which is correct for the app and useless for a test that
 * needs to prove the cache was COLD and the database was warm. A query string
 * makes Node treat it as a different module, and that is exactly a page reload:
 * new memory, same disk.
 */
let instance = 0;
const load = () => import(`${MODULE}?run=${++instance}`);

/* A picture, small enough to read in a failure message and shaped like the
   real thing — a JPEG data URL, which is what AddItemModal writes. */
const PIC = (tag) => `data:image/jpeg;base64,${Buffer.from(`picture-${tag}`).toString('base64')}`;

/* ==================== 1. a browser with a working database ==================== */

globalThis.indexedDB = makeFakeIndexedDB();
const store = await load();

const {
  PHOTO_REF_PREFIX, PHOTO_REFS_ENABLED,
  isPhotoRef, photoRefId, photoRef,
  putPhoto, getPhoto, removePhoto, photoIds, hydratePhotos,
  photoSrc, resolvePhoto, storePhoto, photosAreDurable,
  inlinePhotos, inlinePhotosIn, hasPhotoRefs, sweepPhotos,
} = store;

check('the scheme is idb:, and it is not a scheme anything will try to fetch', PHOTO_REF_PREFIX === 'idb:');
check('a working database reports itself durable', (await photosAreDurable()) === true);

const one = PIC('one');
const refOne = await putPhoto(one);
check('a stored picture hands back a reference', isPhotoRef(refOne) && photoRefId(refOne).length > 0, refOne);
check('the reference is the prefix and the id, and nothing else', photoRef(photoRefId(refOne)) === refOne);

check(
  'the picture comes back BYTE FOR BYTE — the store is a transcription, never a re-encode',
  (await getPhoto(refOne)) === one,
);
check(
  'the database is what is holding it, not a variable in this process',
  globalThis.indexedDB.rows().get(photoRefId(refOne)) === one,
);

/* ---------- drawing: the one line every photo tile needs ---------- */
check('photoSrc resolves a reference synchronously once it is warm', photoSrc(refOne) === one);
check('photoSrc hands back a data URL untouched — inline pictures draw as they always did', photoSrc(one) === one);
check('photoSrc is safe on the empty string and on undefined', photoSrc('') === '' && photoSrc(undefined) === '' && photoSrc(null) === '');
check(
  'a reference this device cannot resolve draws as NO PHOTOGRAPH, never as a broken image',
  photoSrc('idb:nothing-was-ever-stored-here') === '',
);
check('resolvePhoto is the same answer, awaited', (await resolvePhoto(refOne)) === one && (await resolvePhoto(one)) === one);

/* ---------- a reload: cold cache, warm disk ---------- */
const reloaded = await load();
check(
  'a fresh page cannot draw a reference before it has hydrated',
  reloaded.photoSrc(refOne) === '',
);
const warmed = await reloaded.hydratePhotos();
check(
  'hydratePhotos reads the disk back into the cache, and then it draws',
  warmed >= 1 && reloaded.photoSrc(refOne) === one,
  `${warmed} warmed`,
);
check('and the picture survived the reload whole', (await reloaded.getPhoto(refOne)) === one);

/* ---------- deletion ---------- */
const two = PIC('two');
const refTwo = await putPhoto(two);
check('two pictures, two ids', photoRefId(refOne) !== photoRefId(refTwo) && (await photoIds()).length >= 2);

await removePhoto(refTwo);
check(
  'DELETION REMOVES THE PICTURE — from the database, the cache and the fallback alike',
  (await getPhoto(refTwo)) === null &&
    photoSrc(refTwo) === '' &&
    !globalThis.indexedDB.rows().has(photoRefId(refTwo)),
);
check('and it took nothing else with it', (await getPhoto(refOne)) === one);
// Red proof: the assertion above is only worth something if the same call
// against a picture that IS still there would have failed it.
check(
  'RED PROOF — the same check against a picture still on the device does not pass by accident',
  !((await getPhoto(refOne)) === null && photoSrc(refOne) === ''),
);
await removePhoto('not-a-reference');
check('removing something that was never a reference is a no-op, not a throw', (await getPhoto(refOne)) === one);

/* ==================== 2. the walker that inlines a document ==================== */

const picA = PIC('a');
const picB = PIC('b');
const refA = await putPhoto(picA);
const refB = await putPhoto(picB);
const inlineAlready = PIC('already-inline');

/** A wardrobe with references in three different places and a dead one. */
const wardrobe = () => ({
  schemaVersion: 7,
  items: [
    { id: 'i1', name: 'Wax jacket', imageUrl: refA, wearCount: 3, favorite: false },
    { id: 'i2', name: 'Linen shirt', imageUrl: inlineAlready, wearCount: 0, favorite: true },
    { id: 'i3', name: 'Lost picture', imageUrl: 'idb:this-one-is-gone', wearCount: 1, favorite: false },
    { id: 'i4', name: 'No photograph', imageUrl: '', wearCount: 9, favorite: false },
  ],
  outfits: [{ id: 'o1', imageUrl: refB, itemIds: ['i1', 'i2'] }],
  settings: { theme: 'dyehouse', currency: '₹' },
  wearLogs: [],
});

check('a document with references says so', hasPhotoRefs(wardrobe()) === true);
check('a document with none says so too', hasPhotoRefs({ items: [{ imageUrl: inlineAlready }] }) === false);

const walked = await inlinePhotos(wardrobe());
check(
  'every reachable reference is inlined, wherever in the document it sits',
  walked.value.items[0].imageUrl === picA && walked.value.outfits[0].imageUrl === picB,
  `${walked.inlined} inlined`,
);
check('an already-inline picture is left exactly as it was', walked.value.items[1].imageUrl === inlineAlready);
check(
  'a reference whose picture is gone is LEFT IN PLACE — the picture is lost, the fact that there was one is not',
  walked.value.items[2].imageUrl === 'idb:this-one-is-gone' && walked.missing === 1,
);
check('the counts are the truth', walked.inlined === 2 && walked.missing === 1);
check(
  'nothing else in the document is disturbed',
  walked.value.items[3].imageUrl === '' &&
    walked.value.items[0].wearCount === 3 &&
    walked.value.items[1].favorite === true &&
    walked.value.settings.currency === '₹' &&
    walked.value.schemaVersion === 7 &&
    Array.isArray(walked.value.wearLogs) && walked.value.wearLogs.length === 0,
);
const original = wardrobe();
const copy = await inlinePhotos(original);
check(
  'the source document is not mutated — the walk hands back a copy',
  original.items[0].imageUrl === refA &&
    original.outfits[0].imageUrl === refB &&
    copy.value !== original &&
    copy.value.items !== original.items &&
    copy.value.items[0].imageUrl === picA,
);

// Red proof: the assertion "every reference is inlined" is vacuous unless a
// document that was NOT walked still fails it.
check(
  'RED PROOF — the un-walked document still holds its references',
  hasPhotoRefs(wardrobe()) && wardrobe().items[0].imageUrl.startsWith('idb:'),
);
// Red proof: a resolver that returns nothing must leave every reference alone
// and say so, not quietly blank the pictures.
const refused = await inlinePhotos(wardrobe(), async () => null);
check(
  'RED PROOF — a resolver that can dereference nothing inlines nothing and blanks nothing',
  refused.inlined === 0 && refused.missing === 3 && refused.value.items[0].imageUrl === refA,
);
check('inlinePhotosIn is the same walk, document only', (await inlinePhotosIn(wardrobe())).outfits[0].imageUrl === picB);

/* ==================== 3. the sweep ==================== */

const kept = await putPhoto(PIC('kept'));
const orphan = await putPhoto(PIC('orphan'));
const stillReferenced = { items: [{ imageUrl: kept }, { imageUrl: refOne }, { imageUrl: refA }, { imageUrl: refB }] };
const before = (await photoIds()).length;
const swept = await sweepPhotos(stillReferenced);
check(
  'the sweep removes exactly the pictures the wardrobe no longer names',
  swept >= 1 && (await getPhoto(orphan)) === null && (await getPhoto(kept)) !== null,
  `${before} held, ${swept} removed`,
);
check('and the ones it still names are untouched', (await getPhoto(refOne)) === one && (await getPhoto(refA)) === picA);

/* ==================== 4. the write path's decision ==================== */

check(
  'the reference switch is ON in this build, and flipping it is a deliberate edit to this line',
  PHOTO_REFS_ENABLED === true,
);
const written = await storePhoto(one);
check(
  'with references on and a durable store, a RECORD holds a reference and not a picture',
  isPhotoRef(written) && written.length < 60,
  `${one.length} chars \u2192 ${written.length}`,
);
check(
  'and the picture it names comes back byte for byte — the record lost nothing',
  (await getPhoto(written)) === one && photoSrc(written) === one,
);
check(
  'storePhoto refuses to file something that is already a reference',
  (await storePhoto(written)) === written,
);
check('storePhoto never touches the empty string', (await storePhoto('')) === '');

/* ==================== 5. a private window, and a runtime with no database ====================
   The rule under test is the one that makes this wave safe to ship: a
   reference is only ever written into a record when there is somewhere for it
   to point. Everywhere else the picture stays inline — today's behaviour,
   which is durable, and which loses nothing. */

for (const [label, factory] of [
  ['a private window where the database THROWS', () => { globalThis.indexedDB = throwingIndexedDB; }],
  ['a private window where the database ERRORS', () => { globalThis.indexedDB = erroringIndexedDB; }],
  ['a runtime with no indexedDB at all', () => { delete globalThis.indexedDB; }],
]) {
  factory();
  const shut = await load();
  const pic = PIC(label);
  check(`${label}: nothing throws, and the store reports itself not durable`, (await shut.photosAreDurable()) === false);
  check(
    `${label}: a record keeps its picture INLINE — never a reference with nothing behind it`,
    (await shut.storePhoto(pic)) === pic,
  );
  const ref = await shut.putPhoto(pic);
  check(
    `${label}: the in-memory fallback still holds and hands back the picture for this session`,
    isPhotoRef(ref) && (await shut.getPhoto(ref)) === pic && shut.photoSrc(ref) === pic,
  );
  await shut.removePhoto(ref);
  check(`${label}: and deletion still empties it`, (await shut.getPhoto(ref)) === null);
  check(
    `${label}: a document still inlines out of the fallback, so export and sync keep working`,
    (await shut.inlinePhotosIn({ items: [{ imageUrl: await shut.putPhoto(pic) }] })).items[0].imageUrl === pic,
  );
  check(`${label}: hydrating a store that isn't there is a no-op, not a crash`, typeof (await shut.hydratePhotos()) === 'number');
}

/* ==================== 6. what it costs the purse ====================
   The number this wave was commissioned for. A 20-piece photographed closet,
   serialised exactly the way src/hooks/useLocalStorage.ts serialises it —
   JSON.stringify of the whole wardrobe document — measured with the pictures
   in the record and with references in their place.

   Two picture sizes, because one number would be a claim and two are a range,
   and neither is invented:

     · 37,643 characters — the median of this repo's own 62 garment tiles
       (28,214 binary bytes) as a base64 data URL.
     · 78,951 characters — MEASURED. A real photograph (public/intake-samples/
       hanging-closet.jpg) put through the actual Add-a-piece form on the
       production build in Chromium at 390x844, which re-encodes it at the cap
       AddItemModal applies: 640px longest edge, JPEG 0.85. The same probe read
       79,231 bytes per piece back out of localStorage with the reference
       switch off, and 320 with it on. */

globalThis.indexedDB = makeFakeIndexedDB();
const measure = await load();

/** A stand-in picture of an exact data-URL length. */
const dataUrlOf = chars => 'data:image/jpeg;base64,' + 'A'.repeat(chars - 23);

const closetOf = pictures => ({
  schemaVersion: 7,
  items: pictures.map((url, n) => ({
    id: `i${n}`, name: `Piece ${n}`, category: 'tops', color: '#5E4232',
    season: ['spring'], occasion: ['casual'], imageUrl: url,
    dateAdded: '2026-08-20T09:00:00.000Z', wearCount: n, favorite: false, laundryStatus: 'clean',
  })),
  outfits: [], wearLogs: [], wishlist: [], circle: { profiles: [], messages: [], loans: [] },
  events: [], furniture: [], settings: { categories: [], occasions: [] },
});

const kb = n => `${(n / 1024).toFixed(1)} KB`;
console.log('\n  A 20-PIECE PHOTOGRAPHED CLOSET, IN THE localStorage PURSE');
console.log('  ' + '-'.repeat(66));

let purseShrank = true;
for (const [label, chars] of [['repo median tile', 37_643], ['measured phone photo', 78_951]]) {
  const inline = [];
  const refs = [];
  for (let n = 0; n < 20; n++) {
    const url = dataUrlOf(chars);
    inline.push(url);
    refs.push(await measure.putPhoto(url, `measured-${label}-${n}`));
  }
  const was = JSON.stringify(closetOf(inline)).length;
  const now = JSON.stringify(closetOf(refs)).length;
  const saved = ((1 - now / was) * 100).toFixed(1);
  console.log(
    `  ${label.padEnd(20)} ${kb(was).padStart(10)} → ${kb(now).padStart(9)}` +
    `   (${saved}% out of the purse; ${kb(was - now)} moved to IndexedDB)`
  );
  if (now >= was) purseShrank = false;
}
// Typical alpha budget, said out loud so the figures above have a wall to hit.
console.log('  ' + '-'.repeat(66));
console.log('  A phone gives localStorage about 5 MB (5120.0 KB) for the whole origin.\n');

check('the purse shrinks in every case measured, and by more than an order of magnitude', purseShrank);

/* ==================== 7. THE THIRD DOOR: what crosses between wardrobes ====================

   Two doors carry a wardrobe OFF this device and both inline: the export file
   and a sync push. There is a third that carries a picture out of the WARDROBE
   without leaving the device — a snapshot written into the community store,
   which every wardrobe on this origin reads and which a second device pulls.

   Per toile-social a snapshot is frozen at the moment it is taken. It must not
   change under the person who saw it, and it must not vanish when the piece it
   was taken from is retired and swept. A reference there does both: it resolves
   today only by accident (same device, same database) and dies the moment the
   origin piece is deleted. So every copy into the community store carries the
   picture itself. */

const room = await load();
const origin = PIC('a-piece-that-gets-passed-on');
const onTheRecord = await room.putPhoto(origin);
await room.hydratePhotos();

/* The snapshot, taken exactly the way the pages take it. */
const snapshot = {
  itemId: 'i-passed',
  name: 'Wax jacket',
  imageUrl: room.photoSrc(onTheRecord),
  category: 'outerwear',
};

check(
  'a snapshot taken for another wardrobe holds the PICTURE, never a reference',
  snapshot.imageUrl === origin && !room.isPhotoRef(snapshot.imageUrl),
);

/* Now the piece it came from is deleted and the room is swept. */
const afterTheOwnerLetItGo = { items: [], outfits: [], wishlist: [] };
await room.sweepPhotos(afterTheOwnerLetItGo);
check(
  'the origin picture is gone from the room once nothing names it',
  (await room.getPhoto(onTheRecord)) === null,
);
check(
  'AND THE SNAPSHOT STILL DRAWS — frozen ink, not a pointer into a room that emptied',
  room.photoSrc(snapshot.imageUrl) === origin,
);
// Red proof: the assertion above is worth nothing unless the reference form
// would have failed it. This is the exact defect the third door closes.
check(
  'RED PROOF — a snapshot that had kept the REFERENCE would now draw nothing',
  room.photoSrc(onTheRecord) === '',
);

/* ---------- and the call sites themselves, pinned ----------

   The rules above are properties of the store; these are the four places in the
   app that have to obey them. A source check rather than a rendered one because
   this suite runs in bare Node with no browser — and because what actually goes
   wrong here is somebody adding a fifth snapshot site and copying the shape of
   the line above it. */

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const readSrc = f => readFileSync(join(SRC, f), 'utf8');

for (const [file, wanted, forbidden] of [
  [
    'pages/Closet.tsx',
    'const snapshot = await resolvePhoto(retiring.imageUrl);',
    'imageUrl: retiring.imageUrl,',
  ],
  [
    'pages/Closet.tsx',
    "await storePhoto(await resolvePhoto(offer.piece.imageUrl ?? ''))",
    "imageUrl: offer.piece.imageUrl ?? '',",
  ],
  [
    'pages/Outfits.tsx',
    'imageUrl: photoSrc(outfit.imageUrl),',
    'imageUrl: outfit.imageUrl,',
  ],
  [
    'pages/Chats.tsx',
    'imageUrl: photoSrc(outfit.imageUrl),',
    null, // Chats draws a preview from the same expression; only the snapshot is pinned.
  ],
  [
    'pages/Chats.tsx',
    'imageUrl: photoSrc(item.imageUrl), category: item.category',
    null,
  ],
]) {
  const text = readSrc(file);
  check(
    `${file}: the snapshot resolves its picture — ${wanted.slice(0, 46)}…`,
    text.includes(wanted),
  );
  if (forbidden !== null) {
    check(
      `${file}: and the raw copy that would send a dangling pointer is gone`,
      !text.includes(forbidden),
      forbidden,
    );
  }
}

/* ==================== 8. every photo tile resolves ====================

   The measured harm, from the wave that built the store: with references on and
   a tile rendering `<img src="idb:…">`, the browser draws a broken image at
   naturalWidth 0. There are two dozen of those tiles across fifteen files, and
   the only durable guard is that NONE of them puts a bare `imageUrl` in an
   `<img src>` ever again. */

const tsx = [];
const walk = dir => {
  for (const entry of readdirSync(join(SRC, dir), { withFileTypes: true })) {
    const at = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(at);
    else if (entry.name.endsWith('.tsx')) tsx.push(at);
  }
};
walk('');

const unresolved = [];
for (const file of tsx) {
  const text = readSrc(file);
  for (const [, expression] of text.matchAll(/src=\{([^}]*)\}/g)) {
    if (!expression.includes('imageUrl')) continue;
    if (expression.includes('photoSrc(')) continue;
    unresolved.push(`${file}: src={${expression}}`);
  }
}
check(
  `every <img src> that reads an imageUrl goes through photoSrc (${tsx.length} files read)`,
  unresolved.length === 0,
  unresolved.slice(0, 3).join(' · '),
);
// Red proof: the scan has to be able to SEE a bare one, or it is checking nothing.
check(
  'RED PROOF — the same scan finds a bare imageUrl when one is put in front of it',
  [...'<img src={item.imageUrl} />'.matchAll(/src=\{([^}]*)\}/g)]
    .some(([, e]) => e.includes('imageUrl') && !e.includes('photoSrc(')),
);

/* ---------- and the suite is actually run ---------- */
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
check(
  'npm run verify runs this suite — a green test nothing calls is not a test',
  pkg.scripts.verify.includes('npm run test:photos') && pkg.scripts['test:photos'] === 'node scripts/test-photos.mjs',
);

console.log(fail === 0 ? '\nALL PHOTO STORE CHECKS PASSED' : `\n${fail} PHOTO STORE CHECKS FAILED`);
process.exit(fail ? 1 : 0);
