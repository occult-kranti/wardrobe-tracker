#!/usr/bin/env node
/**
 * The sync squad's checks: the state↔row mapping, the conflict rule, the
 * sample guard, and the offline queue.
 *
 * Follows the repo pattern (test-feed.mjs): esbuild-bundle the lib into a
 * temp dir, import the bundle, and assert. Only the PURE helpers are tested —
 * the wire half of sync.ts needs a network and a Supabase project, and a test
 * that needs those is not a test, it is a hope.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'sync-'));
await build({
  entryPoints: [
    fileURLToPath(new URL('../src/lib/sync.ts', import.meta.url)),
    fileURLToPath(new URL('../src/types.ts', import.meta.url)),
  ],
  bundle: true,
  format: 'esm',
  outdir: dir,
  jsx: 'automatic',
  logLevel: 'error',
});

const sync = await import(pathToFileURL(join(dir, 'lib', 'sync.js')).href);
const types = await import(pathToFileURL(join(dir, 'types.js')).href);

const {
  toRow,
  fromRow,
  remoteIsNewer,
  shouldSync,
  syncModeOf,
  enqueuePush,
  drainQueue,
  accountFromRow,
} = sync;
const { initialState } = types;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

/* ---------- a wardrobe's state, mapped to a row and back ---------- */
const state = {
  ...structuredClone(initialState),
  items: [{
    id: 'i-1', name: 'Wax jacket', category: 'outerwear', color: '#5E4232',
    season: ['fall', 'winter'], occasion: ['casual'], imageUrl: '',
    dateAdded: '2026-01-04T09:00:00.000Z', wearCount: 3, favorite: false,
    laundryStatus: 'clean',
  }],
};
const account = { name: 'My wardrobe', syncId: '4b7d1c2e-0000-4000-8000-aaaaaaaaaaaa' };
const now = '2026-08-18T20:00:00.000Z';

const row = toRow(account, state, 'user-uuid-1', now);
check('toRow: the row id is the syncId, not the local id', row.id === account.syncId, row.id);
check('toRow: the row is owned and stamped', row.user_id === 'user-uuid-1' && row.updated_at === now);
check('toRow: name and state land whole', row.name === 'My wardrobe' && row.state.items.length === 1);

const back = fromRow(row);
check(
  'row → state round-trips whole',
  JSON.stringify(back.state) === JSON.stringify(state) && back.name === account.name && back.updatedAt === now
);

/* ---------- the conflict rule: newer updated_at wins ---------- */
check('a newer remote row carries news', remoteIsNewer('2026-08-18T21:00:00.000Z', now) === true);
check('an older remote row does not', remoteIsNewer('2026-08-18T19:00:00.000Z', now) === false);
check(
  'an EQUAL stamp is not news — it is the same write seen twice',
  remoteIsNewer(now, now) === false
);
check('nothing agreed yet means anything remote is news', remoteIsNewer(now, null) === true);

/* ---------- who may sync at all ---------- */
check('a cloud wardrobe syncs', shouldSync({ sync: 'cloud', syncId: 'x' }) === true);
check(
  'a SAMPLE wardrobe never syncs, even marked cloud',
  shouldSync({ sync: 'cloud', isSample: true, syncId: 'x' }) === false
);
check('an on-device wardrobe does not sync', shouldSync({ sync: 'device' }) === false);
check(
  'an account written before sync existed (no field) stays on the device',
  shouldSync({}) === false && syncModeOf({}) === 'device'
);
check('the choice reads back', syncModeOf({ sync: 'cloud' }) === 'cloud');

/* ---------- the offline queue ---------- */
const pushA1 = { syncId: 'a', name: 'A', state, queuedAt: '2026-08-18T10:00:00.000Z' };
const pushB1 = { syncId: 'b', name: 'B', state, queuedAt: '2026-08-18T10:01:00.000Z' };
const pushA2 = { syncId: 'a', name: 'A', state: { ...state, wishlist: [{ id: 'w1' }] }, queuedAt: '2026-08-18T10:02:00.000Z' };

const q1 = enqueuePush(enqueuePush([], pushA1), pushB1);
check('pushes queue in order', JSON.stringify(q1.map(p => p.syncId)) === JSON.stringify(['a', 'b']));

const q2 = enqueuePush(q1, pushA2);
check(
  'a re-queued wardrobe REPLACES its pending push in place — order kept, newest state kept',
  q2.length === 2 &&
    q2[0].syncId === 'a' && q2[0].queuedAt === pushA2.queuedAt && q2[1].syncId === 'b',
  q2.map(p => `${p.syncId}@${p.queuedAt}`).join(',')
);

const sentOrder = [];
const drained = await drainQueue(q2, async p => { sentOrder.push(p.syncId); });
check(
  'the queue drains in order, and empties',
  JSON.stringify(sentOrder) === JSON.stringify(['a', 'b']) && drained.remaining.length === 0
);

const sentBeforeFailure = [];
const drainedFail = await drainQueue(q2, async p => {
  if (p.syncId === 'a') throw new Error('offline');
  sentBeforeFailure.push(p.syncId);
});
check(
  'a failure keeps the failed push AND everything after it, in order',
  drainedFail.sent.length === 0 &&
    JSON.stringify(drainedFail.remaining.map(p => p.syncId)) === JSON.stringify(['a', 'b']) &&
    sentBeforeFailure.length === 0
);

const threeQueue = enqueuePush(enqueuePush(q2, { syncId: 'c', name: 'C', state, queuedAt: '2026-08-18T10:03:00.000Z' }), pushB1);
const partial = await drainQueue(threeQueue, async p => {
  if (p.syncId === 'b') throw new Error('offline mid-drain');
});
check(
  'a mid-drain failure keeps what was sent sent, and the rest queued in order',
  JSON.stringify(partial.sent) === JSON.stringify(['a']) &&
    JSON.stringify(partial.remaining.map(p => p.syncId)) === JSON.stringify(['b', 'c'])
);

/* ---------- a row from another device becomes an account ---------- */
const introduced = accountFromRow(row, {
  id: 'w-newdevice', handle: '@mywardrobe', monogram: 'MW', color: 'var(--color-accent)',
  createdAt: '2026-08-18',
});
check(
  'a fresh row is introduced as a synced wardrobe pointing at its row',
  introduced.name === 'My wardrobe' && introduced.sync === 'cloud' && introduced.syncId === row.id &&
    introduced.id === 'w-newdevice'
);

console.log(fail === 0 ? '\nALL SYNC CHECKS PASSED' : `\n${fail} SYNC CHECKS FAILED`);
process.exit(fail ? 1 : 0);
