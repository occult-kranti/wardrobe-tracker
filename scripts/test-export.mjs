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
const types = await import(pathToFileURL(join(dir, 'types.js')).href);

const { EXPORTED_KEYS, buildExportDoc, exportDocText, readExportDoc, exportFileName } = doc;
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

console.log(fail === 0 ? '\nALL EXPORT CHECKS PASSED' : `\n${fail} EXPORT CHECKS FAILED`);
process.exit(fail ? 1 : 0);
