#!/usr/bin/env node
/**
 * The sync squad's checks: the state↔row mapping, the envelope the state
 * travels in, the conflict rule, the sample guard, and the offline queue.
 *
 * Follows the repo pattern (test-feed.mjs): esbuild-bundle the lib into a
 * temp dir, import the bundle, and assert. The PURE helpers are tested
 * directly. The one piece of wire machinery that is tested — the queue drain
 * stamping what it agreed with — gets there by swapping the Supabase module
 * for a fake at bundle time, so no network and no project are involved; a
 * test that needs those is not a test, it is a hope.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'sync-'));

/**
 * The stand-in for src/lib/supabase.ts. sync.ts reaches the network through
 * exactly one function, so replacing that function replaces the network. The
 * fake itself is handed in on globalThis by the test below, which is how the
 * assertions get to see what was upserted.
 */
const supabaseStub = join(dir, 'supabase-stub.js');
writeFileSync(supabaseStub, 'export function getSupabase() { return globalThis.__fakeSupabase; }\n');

await build({ alias: sharedAliases(),
  entryPoints: {
    'lib/sync': fileURLToPath(new URL('../src/lib/sync.ts', import.meta.url)),
    // The photograph store, because a push has to inline what it holds. It is
    // named as an entry point AND imported by sync.ts, so the build SPLITS:
    // one copy of the module, shared. Two separate bundles would hand the test
    // a second store with its own empty maps, and every inlining assertion
    // below would be asserting against a picture sync.ts had never seen.
    'lib/photoStore': fileURLToPath(new URL('../src/lib/photoStore.ts', import.meta.url)),
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
  },
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: dir,
  jsx: 'automatic',
  logLevel: 'error',
  plugins: [{
    name: 'fake-supabase',
    setup(b) {
      // Only the app's own module, never the @supabase/supabase-js package.
      b.onResolve({ filter: /^\.{1,2}\/(lib\/)?supabase$/ }, () => ({ path: supabaseStub }));
    },
  }],
});

const sync = await import(pathToFileURL(join(dir, 'lib', 'sync.js')).href);
const photos = await import(pathToFileURL(join(dir, 'lib', 'photoStore.js')).href);
const types = await import(pathToFileURL(join(dir, 'types.js')).href);

const {
  toRow,
  fromRow,
  openState,
  openRow,
  remoteIsNewer,
  shouldSync,
  syncModeOf,
  enqueuePush,
  drainQueue,
  accountFromRow,
  flushQueue,
  lastSyncedAt,
  pushNow,
  pullAccount,
  ENVELOPE_VERSION,
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
check('toRow: name and state land whole', row.name === 'My wardrobe' && row.state?.payload?.items?.length === 1);

const back = fromRow(row);
check(
  'row → state round-trips whole',
  JSON.stringify(back.state) === JSON.stringify(state) && back.name === account.name && back.updatedAt === now
);

/* ---------- the envelope the state travels in ---------- */
check(
  'the state travels in a versioned envelope, plaintext for alpha',
  row.state?.v === ENVELOPE_VERSION && row.state?.alg === 'none' && ENVELOPE_VERSION >= 1,
  JSON.stringify({ v: row.state?.v, alg: row.state?.alg })
);
check(
  'an envelope opens to exactly the document that went in',
  JSON.stringify(openState?.(row.state)) === JSON.stringify(state)
);

// The rows alpha testers already have on the account carry the wardrobe
// document bare. They were written before the envelope existed and they are
// live data: a reader that only understands the new shape would show those
// closets as empty.
const legacyRow = {
  id: account.syncId, user_id: 'user-uuid-1', name: 'My wardrobe',
  state, updated_at: now,
};
check(
  'a LEGACY bare-state row still reads, as the alg-none it always was',
  JSON.stringify(fromRow(legacyRow).state) === JSON.stringify(state)
);
check(
  'openRow opens a legacy row whole, id and stamp intact',
  openRow?.(legacyRow)?.id === account.syncId &&
    openRow?.(legacyRow)?.updated_at === now &&
    openRow?.(legacyRow)?.state?.items?.length === 1
);
check(
  'an envelope this build cannot open is refused, not guessed at',
  openState?.({ v: 2, alg: 'aes-gcm-256', payload: 'ciphertext' }) === null &&
    openRow?.({ ...legacyRow, state: { v: 2, alg: 'aes-gcm-256', payload: 'x' } }) === null
);

/* ---------- the conflict rule: newer updated_at wins ---------- */
check('a newer remote row carries news', remoteIsNewer('2026-08-18T21:00:00.000Z', now) === true);
check('an older remote row does not', remoteIsNewer('2026-08-18T19:00:00.000Z', now) === false);
check(
  'an EQUAL stamp is not news — it is the same write seen twice',
  remoteIsNewer(now, now) === false
);
check('nothing agreed yet means anything remote is news', remoteIsNewer(now, null) === true);

/* ---------- the format matrix ----------
 * Two writers stamp this column and they render time differently: the browser
 * writes toISOString, PostgREST renders a timestamptz (six fractional digits,
 * trailing zeros trimmed off, an offset instead of 'Z'). Both stamps end up in
 * the sync meta and get compared against each other, so the rule must hold for
 * EVERY ordered pair of renderings — not just the pair one code path happens
 * to produce today.
 */
const at = (s, ms, micros = 0) => ({ ms: Date.UTC(2026, 7, 18, 20, 0, s, ms), micros });
const formats = {
  // The browser: always three fractional digits, always 'Z'.
  client: t => new Date(t.ms).toISOString(),
  // PostgREST, untrimmed: six fractional digits and an offset.
  postgrest: t =>
    new Date(t.ms).toISOString().slice(0, 19) +
    '.' + String((t.ms % 1000) * 1000 + t.micros).padStart(6, '0') + '+00:00',
  // Postgres drops trailing zeros, so the same column yields varying widths.
  trimmed: t => {
    const digits = String((t.ms % 1000) * 1000 + t.micros).padStart(6, '0').replace(/0+$/, '');
    const head = new Date(t.ms).toISOString().slice(0, 19);
    return digits === '' ? `${head}+00:00` : `${head}.${digits}+00:00`;
  },
  // A whole second carries no fractional part at all.
  noFraction: t => new Date(t.ms).toISOString().slice(0, 19) + '+00:00',
};

const instants = [at(0, 0), at(0, 1), at(0, 100), at(0, 120), at(0, 500), at(0, 999), at(1, 0), at(1, 250), at(2, 0)];
const names = Object.keys(formats);

let matrixPairs = 0;
let matrixWrong = null;
let echoPairs = 0;
for (const lastName of names) {
  for (const remoteName of names) {
    for (const a of instants) {
      for (const b of instants) {
        const lastStamp = formats[lastName](a);
        const remoteStamp = formats[remoteName](b);
        const truth = Date.parse(remoteStamp) > Date.parse(lastStamp);
        matrixPairs++;
        if (Date.parse(remoteStamp) === Date.parse(lastStamp)) echoPairs++;
        if (remoteIsNewer(remoteStamp, lastStamp) !== truth && matrixWrong === null) {
          matrixWrong = `last ${lastName} ${lastStamp} vs remote ${remoteName} ${remoteStamp}: ` +
            `said ${remoteIsNewer(remoteStamp, lastStamp)}, the clock says ${truth}`;
        }
      }
    }
  }
}
check(
  'the format matrix: every ordered pair of renderings is judged by the clock, not by the glyphs',
  matrixWrong === null,
  matrixWrong ?? `${matrixPairs} pairs`
);

// Stated separately because it is the rule the whole policy rests on, and the
// cross-format pairs are exactly where a text compare loses it: 'Z' sorts
// above every digit and '.' above '+', so one instant in two renderings reads
// as two, and the device adopts an echo of its own write.
let echoWrong = null;
for (const lastName of names) {
  for (const remoteName of names) {
    for (const t of instants) {
      const lastStamp = formats[lastName](t);
      const remoteStamp = formats[remoteName](t);
      if (Date.parse(lastStamp) !== Date.parse(remoteStamp)) continue;
      if (remoteIsNewer(remoteStamp, lastStamp) !== false && echoWrong === null) {
        echoWrong = `${lastStamp} vs ${remoteStamp}`;
      }
    }
  }
}
check(
  'ONE INSTANT IN TWO RENDERINGS IS NOT NEWS — the same write seen twice never echoes back',
  echoWrong === null,
  echoWrong ?? `${echoPairs} same-instant pairs`
);

// An offset is not decoration. Postgres renders in the connection's timezone,
// and a project whose role is not UTC would send '+05:30' — a text compare
// reads the wall clock and misses an hour of real news. Nothing observed on
// this project sends one; the rule holds for it regardless.
check(
  'an offset that is not +00:00 is still read as an instant',
  remoteIsNewer('2026-08-18T19:00:00.000000-02:00', '2026-08-18T20:00:00.000Z') === true &&
    remoteIsNewer('2026-08-18T22:30:00.000000+02:00', '2026-08-18T21:00:00.000Z') === false
);

// Unreadable clocks get a decision rather than whatever NaN comparisons fall
// out to. A local stamp we cannot read is no agreement at all; a REMOTE stamp
// we cannot read is the one case for doing nothing, because the local record
// is the original and is not replaced on the strength of an unreadable clock.
check(
  'a stamp this device cannot read is treated as no agreement at all',
  remoteIsNewer(now, 'not a timestamp') === true && remoteIsNewer(now, '') === true
);
check(
  'a remote clock this device cannot read is never grounds to replace the local record',
  remoteIsNewer('not a timestamp', now) === false && remoteIsNewer('', now) === false
);

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

/* ---------- the drain reaches agreement, and says so ----------
 * A queue that empties without stamping leaves lastSyncedAt at whatever the
 * last successful push wrote — stale by the whole offline stretch — and the
 * next pull then judges the row this device just sent against a time from
 * before it went offline. The stamp must be the one the DATABASE returned,
 * because supabase/setup.sql's trigger overwrites what the client proposed.
 */
const SERVER_STAMP = '2026-08-18T20:00:05.123456+00:00';
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
  },
  dispatchEvent: () => true,
  addEventListener: () => {},
};

const upserted = [];
globalThis.__fakeSupabase = {
  from(table) {
    return {
      upsert(payload) {
        upserted.push({ table, payload });
        const result = Promise.resolve({ data: { updated_at: SERVER_STAMP }, error: null });
        const builder = {
          select: () => builder,
          single: () => result,
          then: (res, rej) => result.then(res, rej),
        };
        return builder;
      },
    };
  },
};

store.set('toile-sync-queue', JSON.stringify([{
  syncId: '4b7d1c2e-0000-4000-8000-bbbbbbbbbbbb',
  accountId: 'w-drained',
  name: 'Drained wardrobe',
  state,
  queuedAt: '2026-08-18T10:00:00.000Z',
}]));
store.set('toile-sync-meta', JSON.stringify({ 'w-drained': '2026-08-17T09:00:00.000Z' }));

await flushQueue('user-uuid-1');

check(
  'a drained queue empties',
  JSON.parse(store.get('toile-sync-queue')).length === 0 && upserted.length === 1,
  `${upserted.length} upsert(s)`
);
check(
  'a drained push STAMPS the wardrobe it agreed for — the meta is no longer stale',
  lastSyncedAt('w-drained') === SERVER_STAMP,
  String(lastSyncedAt('w-drained'))
);
check(
  'the drain stamps what the DATABASE returned, not the time this device proposed',
  lastSyncedAt('w-drained') === SERVER_STAMP && SERVER_STAMP !== upserted[0]?.payload?.updated_at,
  `this device proposed ${upserted[0]?.payload?.updated_at}`
);
check(
  'a queued push goes up inside the envelope too',
  upserted[0]?.payload?.state?.alg === 'none' &&
    upserted[0]?.payload?.state?.payload?.items?.length === 1
);

// Entries queued by an earlier build have no accountId. They must still send;
// they simply cannot be stamped, which is the behaviour they already had.
store.set('toile-sync-queue', JSON.stringify([{
  syncId: '4b7d1c2e-0000-4000-8000-cccccccccccc',
  name: 'Older build',
  state,
  queuedAt: '2026-08-18T10:00:00.000Z',
}]));
await flushQueue('user-uuid-1');
check(
  'a push queued by an older build still drains, unstamped and uncomplaining',
  JSON.parse(store.get('toile-sync-queue')).length === 0 && upserted.length === 2
);

/* ---------- THE SECOND DOOR OFF THE DEVICE: a push inlines ----------

 * A photograph kept in this browser's IndexedDB leaves `idb:<id>` in the
 * record. That id names a row in a database on THIS device: the second phone
 * that pulls this wardrobe has the same app, the same schema, and no such
 * picture. Push a reference and the piece arrives over there with a broken
 * photograph and no way to ever get it back — the exact hole the native app
 * still has with its file paths (see the report for this wave).
 *
 * So the push resolves first. Bare Node has no IndexedDB, so photoStore falls
 * back to its in-memory store: real putPhoto, real reference, real walker.
 * Because photoStore is bundled as a shared chunk, the picture this test files
 * is the picture sync.ts is able to find.
 */

const picture = 'data:image/jpeg;base64,' + Buffer.from('a wax jacket, photographed').toString('base64');
const pieceRef = await photos.putPhoto(picture);
const photographed = {
  ...structuredClone(state),
  items: [{ ...state.items[0], imageUrl: pieceRef }],
};

// Red proof: the door is the only thing standing between that reference and
// the wire. Without it, this is what would be sent.
check(
  'RED PROOF — the bare mapping would put the reference itself on the wire',
  toRow(account, photographed, 'user-uuid-1', now).state.payload.items[0].imageUrl === pieceRef,
);

const cloudAccount = {
  id: 'w-photographed',
  name: 'Photographed wardrobe',
  handle: '@photographed',
  monogram: 'PW',
  color: 'var(--color-accent)',
  createdAt: '2026-08-20',
  sync: 'cloud',
  syncId: '4b7d1c2e-0000-4000-8000-dddddddddddd',
};

upserted.length = 0;
const pushed = await pushNow(cloudAccount, photographed, 'user-uuid-1');
check('the push was sent', pushed === 'sent', pushed);
check(
  'A PUSH INLINES — what goes up is the photograph, never a name for a row on this device',
  upserted[0]?.payload?.state?.payload?.items[0]?.imageUrl === picture,
  String(upserted[0]?.payload?.state?.payload?.items[0]?.imageUrl).slice(0, 32),
);
check(
  'and the LOCAL record is not rewritten by the sending of it',
  photographed.items[0].imageUrl === pieceRef,
);
check(
  'a reference the device cannot resolve goes up as it is, and takes the rest of the wardrobe with it',
  await (async () => {
    upserted.length = 0;
    const orphaned = { ...structuredClone(state), items: [{ ...state.items[0], imageUrl: 'idb:long-gone' }] };
    await pushNow(cloudAccount, orphaned, 'user-uuid-1');
    const sentUp = upserted[0]?.payload?.state?.payload;
    return sentUp?.items[0]?.imageUrl === 'idb:long-gone' && sentUp?.items[0]?.name === 'Wax jacket';
  })(),
);

/* ---------- the queue keeps REFERENCES, because the queue is the purse ----------
   An offline push is parked in localStorage — the very five megabytes this
   whole wave exists to empty. Inlining on the way IN would put every
   photograph straight back into it at the moment the device can least spare
   the room, so the queue holds references and the drain resolves them. */

const offlineSupabase = {
  from() {
    return {
      upsert() {
        const result = Promise.reject(new Error('offline'));
        const builder = {
          select: () => builder,
          single: () => result,
          then: (res, rej) => result.then(res, rej),
        };
        return builder;
      },
    };
  },
};

const working = globalThis.__fakeSupabase;
globalThis.__fakeSupabase = offlineSupabase;
store.set('toile-sync-queue', JSON.stringify([]));
const queuedResult = await pushNow(cloudAccount, photographed, 'user-uuid-1');
const parked = store.get('toile-sync-queue');
check('a refused push is queued rather than lost', queuedResult === 'queued', queuedResult);
check(
  'THE QUEUE HOLDS THE REFERENCE, not the photograph — an offline push must not refill the purse',
  parked.includes(pieceRef) && !parked.includes(picture),
  `${parked.length} bytes parked`,
);

globalThis.__fakeSupabase = working;
upserted.length = 0;
await flushQueue('user-uuid-1');
check(
  'and the DRAIN inlines, so the bytes are spent on the wire instead of on the disk',
  JSON.parse(store.get('toile-sync-queue')).length === 0 &&
    upserted[0]?.payload?.state?.payload?.items[0]?.imageUrl === picture,
);

/* ---------- a pull PASSES THROUGH: inline works everywhere, so nothing is done to it ---------- */

const remotePicture = 'data:image/jpeg;base64,' + Buffer.from('sent from the other phone').toString('base64');
const remoteState = { ...structuredClone(state), items: [{ ...state.items[0], imageUrl: remotePicture }] };

check(
  'a row arriving with its photographs in it opens with them still in it',
  openRow({
    id: cloudAccount.syncId, user_id: 'user-uuid-1', name: 'Photographed wardrobe',
    state: { v: ENVELOPE_VERSION, alg: 'none', payload: remoteState }, updated_at: '2026-08-19T10:00:00.000Z',
  }).state.items[0].imageUrl === remotePicture,
);

globalThis.__fakeSupabase = {
  from() {
    const result = Promise.resolve({
      data: {
        id: cloudAccount.syncId, user_id: 'user-uuid-1', name: 'Photographed wardrobe',
        state: { v: ENVELOPE_VERSION, alg: 'none', payload: remoteState },
        updated_at: '2026-08-19T10:00:00.000Z',
      },
      error: null,
    });
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () => result,
      then: (res, rej) => result.then(res, rej),
    };
    return builder;
  },
};
store.set('toile-sync-meta', JSON.stringify({}));
const pulled = await pullAccount(cloudAccount);
const written = store.get(`wardrobe-tracker:${cloudAccount.id}`);
check('the newer row is adopted', pulled === 'adopted', pulled);
check(
  'A PULL STORES WHAT IT RECEIVED, AS IT RECEIVED IT — inline reads on every device, so nothing is filed away behind a name',
  typeof written === 'string' &&
    JSON.parse(written).items[0].imageUrl === remotePicture &&
    !written.includes('idb:'),
);

console.log(fail === 0 ? '\nALL SYNC CHECKS PASSED' : `\n${fail} SYNC CHECKS FAILED`);
process.exit(fail ? 1 : 0);
