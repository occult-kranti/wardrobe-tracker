#!/usr/bin/env node
/**
 * The export squad's checks: what a backup file contains, and what it must
 * never contain.
 *
 * Follows the repo pattern (test-sync.mjs): esbuild-bundle the lib into a temp
 * dir, import the bundle, and assert. exportDoc.ts is pure by contract — no
 * React, no DOM — so bare Node is the whole environment it needs, and that is
 * also the proof it can move to packages/shared for the native app.
 *
 * The defect this file was written against: Settings.tsx filtered the React
 * context with a DENYLIST naming only 'activeItems'. The context also carries
 * packedItemIds, a ReadonlySet, which is not a function and was not named — so
 * it passed the filter and JSON.stringify wrote it as {}. Every backup this app
 * has ever written carries a spurious "packedItemIds": {}.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { deepStrictEqual } from 'node:assert';

const dir = mkdtempSync(join(tmpdir(), 'export-'));
await build({ alias: sharedAliases(),
  entryPoints: {
    'lib/exportDoc': fileURLToPath(new URL('../src/lib/exportDoc.ts', import.meta.url)),
    'lib/migrate': fileURLToPath(new URL('../packages/shared/migrate.ts', import.meta.url)),
    // The photograph store, for the door below. exportDoc does NOT import it —
    // that is the point of handing the inliner in — so this is a second,
    // independent bundle and importing it here proves nothing about the first.
    'lib/photoStore': fileURLToPath(new URL('../src/lib/photoStore.ts', import.meta.url)),
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  jsx: 'automatic',
  logLevel: 'error',
});

const doc = await import(pathToFileURL(join(dir, 'lib', 'exportDoc.js')).href);
const mig = await import(pathToFileURL(join(dir, 'lib', 'migrate.js')).href);
const photos = await import(pathToFileURL(join(dir, 'lib', 'photoStore.js')).href);
const types = await import(pathToFileURL(join(dir, 'types.js')).href);

const {
  EXPORTED_KEYS, buildExportDoc, exportDocText, readExportDoc, exportFileName,
  buildExportDocAsync, exportDocTextAsync,
} = doc;
const { migrate } = mig;
const { SCHEMA_VERSION, initialState } = types;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

/** Deep equality as a boolean, so a mismatch prints a FAIL line and not a throw. */
const same = (a, b) => {
  try { deepStrictEqual(a, b); return true; } catch { return false; }
};

const STAMP = '2026-08-19T09:00:00.000Z';

/* ---------- the pinned list ----------
   Deep-equal against a literal written out by hand. This is the whole point of
   inverting the denylist: a field can no longer arrive in, or vanish from, a
   backup without somebody deliberately editing the lines below. */

const PINNED = [
  'schemaVersion',
  'items',
  'outfits',
  'wearLogs',
  'wishlist',
  'circle',
  'events',
  'furniture',
  'settings',
  // Native keeps photographs as files on disk and inlines them to base64 on
  // export, so the document round-trips with web in both directions.
  'photoEncoding',
];

check('the allowlist is exactly the pinned list', same([...EXPORTED_KEYS], PINNED), [...EXPORTED_KEYS].join(','));

/* ---------- a stand-in for the React context ----------
   The shape Settings.tsx actually hands the builder: the state spread flat,
   plus the callbacks, plus the two values the provider computes. */

const state = migrate({
  ...initialState,
  items: [{
    id: 'a', name: 'White Oxford', category: 'tops', color: '#f5f0eb',
    season: ['spring'], occasion: ['work'], imageUrl: 'data:x', dateAdded: '2026-01-01',
    wearCount: 14, cost: 68, favorite: true, laundryStatus: 'clean',
  }],
  furniture: [{
    id: 'f1', name: 'The almirah', form: 'almirah', dateAdded: '2026-02-01',
    slots: [{ id: 'f1-1', label: 'Top shelf', packed: true }],
  }],
});

const context = {
  ...state,
  // Derived: items minus the retired ones. Plain data by shape, computed in fact.
  activeItems: state.items,
  // Derived: the pieces in packed-away compartments. THE defect — a Set.
  packedItemIds: new Set(['a']),
  addItem: () => {},
  replaceState: () => {},
  markExported: () => {},
};

const built = buildExportDoc(context, STAMP);

check(
  'the document holds the pinned keys it has, and exportedAt',
  same(Object.keys(built).sort(), [...PINNED.filter(k => k in state), 'exportedAt'].sort()),
  Object.keys(built).join(',')
);
check('packedItemIds is not in the document', !('packedItemIds' in built));
check('activeItems is not in the document', !('activeItems' in built));
check('the callbacks are not in the document', !('addItem' in built) && !('replaceState' in built));

/* ---------- a Set can never serialise as {} ----------
   Not the same assertion as the one above. That one names packedItemIds; this
   one says the failure MODE is closed, so the next Set added to the context
   under any name at all still cannot reach a file. */

const withSets = buildExportDoc(
  { ...context, someFutureSet: new Set(['x']), someFutureMap: new Map([['k', 'v']]), whenever: new Date(0) },
  STAMP
);
check(
  'a Set-valued field never reaches the document as {}',
  !('someFutureSet' in withSets) && !('someFutureMap' in withSets) && !('whenever' in withSets),
  Object.keys(withSets).filter(k => !PINNED.includes(k) && k !== 'exportedAt').join(',')
);
check(
  'nothing in the written text serialises to an empty object',
  !/:\s*\{\}/.test(exportDocText(context, STAMP))
);

/* ---------- the round trip ----------
   Lossless forever (CLAUDE.md). A file written by a NEWER build carries fields
   this one cannot name; migrate() keeps them on the state, and the export must
   hand them back out again or the promise is only a promise about today. */

const future = migrate({ ...state, photoEncoding: 'inline', someFutureKey: { keep: 'me' } });
// migrate must be a fixed point on its own output, or the comparison below
// would be measuring migrate's normalising rather than the export's fidelity.
check('migrate is a fixed point on an already-migrated state', same(migrate(future), future));

const roundTripped = readExportDoc(exportDocText(future, STAMP));
check(
  'export then import preserves the state losslessly',
  same(roundTripped, { ...future, exportedAt: STAMP }),
  Object.keys(roundTripped).join(',')
);
check('an unknown key from a newer build survives the round trip', same(roundTripped.someFutureKey, { keep: 'me' }));
check('a field named before it exists survives the round trip', roundTripped.photoEncoding === 'inline');

/* ---------- the stamps and the name ---------- */

check('schemaVersion is this build, not the file', buildExportDoc({ ...state, schemaVersion: 2 }, STAMP).schemaVersion === SCHEMA_VERSION);
check('exportedAt is the stamp, never the source', buildExportDoc({ ...state, exportedAt: 'stale' }, STAMP).exportedAt === STAMP);
check('the file is named for the local day', exportFileName('2026-08-19') === 'almari-backup-2026-08-19.json');
check('an empty wardrobe still exports a readable document', readExportDoc(exportDocText(initialState, STAMP)).items.length === 0);

let threw = false;
try { readExportDoc('not json'); } catch { threw = true; }
check('a file that is not JSON throws rather than importing nothing', threw);

/* ---------- THE FIRST DOOR OFF THE DEVICE: an exported file inlines ----------

   A photograph does not have to be in the record to be in the wardrobe. The
   web app can keep it in IndexedDB and leave `idb:<id>` behind; the native app
   keeps it as a file and leaves a path. Both are names for something on ONE
   machine, and a backup file is opened on another one — so the document that
   goes on disk must have the pictures IN it, or the promise that a web file
   and a native file are the same file is over.

   There is no mock here. Bare Node has no IndexedDB, so src/lib/photoStore.ts
   falls back to its in-memory store — which IS the fixture: real putPhoto,
   real references, real walker, and a resolver that has to actually find them. */

const picture = 'data:image/jpeg;base64,' + Buffer.from('a photographed jacket').toString('base64');
const outfitPicture = 'data:image/jpeg;base64,' + Buffer.from('a mirror shot').toString('base64');
const pieceRef = await photos.putPhoto(picture);
const outfitRef = await photos.putPhoto(outfitPicture);
const deadRef = 'idb:this-picture-is-gone';

const withRefs = migrate({
  ...state,
  items: [
    { ...state.items[0], imageUrl: pieceRef },
    { ...state.items[0], id: 'b', name: 'Lost picture', imageUrl: deadRef },
    { ...state.items[0], id: 'c', name: 'Never photographed', imageUrl: '' },
  ],
  outfits: [{
    id: 'o1', name: 'Monday', itemIds: ['a'], dateCreated: '2026-02-01',
    wearCount: 0, favorite: false, imageUrl: outfitRef,
  }],
});

// Red proof first: every assertion below is worth nothing unless the document
// WOULD have carried the references out to disk without the door.
const notInlined = exportDocText(withRefs, STAMP);
check(
  'RED PROOF — the plain synchronous export carries a reference straight out to the file',
  notInlined.includes(pieceRef) && notInlined.includes(outfitRef),
);

const inline = d => photos.inlinePhotosIn(d);
const inlinedText = await exportDocTextAsync(withRefs, STAMP, inline);
const inlinedDoc = JSON.parse(inlinedText);

check(
  'an exported document holds the PICTURES, not references into this device',
  inlinedDoc.items[0].imageUrl === picture && inlinedDoc.outfits[0].imageUrl === outfitPicture,
);
check(
  'not one resolvable reference survives in the text — only the one whose picture is gone',
  (inlinedText.match(/idb:/g) ?? []).length === 1 && inlinedText.includes(deadRef),
);
check(
  'a reference whose picture is gone is LEFT IN THE FILE — nothing is thrown away, including the fact of it',
  inlinedDoc.items[1].imageUrl === deadRef,
);
check('a piece that was never photographed is still an empty string', inlinedDoc.items[2].imageUrl === '');

const readBack = readExportDoc(inlinedText);
check(
  'the inlined file reads back as a wardrobe with its photographs in it',
  readBack.items[0].imageUrl === picture && readBack.outfits[0].imageUrl === outfitPicture &&
    readBack.items.length === 3,
);
check(
  'the inlined document is still exactly the allowlist, plus exportedAt',
  same(Object.keys(inlinedDoc).sort(), [...PINNED.filter(k => k in withRefs), 'exportedAt'].sort()),
  Object.keys(inlinedDoc).join(','),
);
check(
  'the inliner never gets to rewrite what this build says about the file',
  (await buildExportDocAsync(withRefs, STAMP, async d => ({ ...d, schemaVersion: 999, exportedAt: 'whenever' })))
    .schemaVersion === SCHEMA_VERSION,
);
check(
  'a wardrobe with no references at all goes through the door byte-identical',
  (await exportDocTextAsync(context, STAMP, inline)) === exportDocText(context, STAMP),
);

console.log(fail === 0 ? '\nALL EXPORT CHECKS PASSED' : `\n${fail} EXPORT CHECKS FAILED`);
process.exit(fail ? 1 : 0);
