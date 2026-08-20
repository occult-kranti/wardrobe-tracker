/**
 * The sync client on the wire — mocked network, real bookkeeping.
 *
 * The supabase module is replaced whole; the storage side is the real
 * adapter over the AsyncStorage jest mock, so every stamp and queue write
 * asserted here is a genuine round-trip through the same shelf the app
 * uses. What scripts/test-sync.mjs proves for the web's wire section, this
 * proves for the port:
 *
 *   - a push sends the ENVELOPE, and files away the stamp the DATABASE
 *     returned, never the one this device proposed;
 *   - a refused push joins the queue, carrying the local account id;
 *   - a queue drain STAMPS each wardrobe it reconciles (the flushQueue
 *     stamping law), while entries queued by an older build — no
 *     accountId — still send, merely unstamped;
 *   - a pull adopts only news (equal is not newer), accepts the legacy
 *     bare row, refuses an unknown alg, and never touches the wire for a
 *     sample or a device-mode wardrobe.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Account, AppState } from '@almari/shared/types';
import { initialState } from '@almari/shared/types';

/* ---------- the mocked wire ---------- */

interface MockNet {
  upsertCalls: unknown[];
  upsertAnswer: (row: unknown) => { data: unknown; error: unknown };
  selectAnswer: () => { data: unknown; error: unknown };
  singleAnswer: () => { data: unknown; error: unknown };
  fromCalls: number;
  deleteCalls: unknown[];
}

const mockNet: MockNet = {
  upsertCalls: [],
  upsertAnswer: () => ({ data: { updated_at: DB_STAMP }, error: null }),
  selectAnswer: () => ({ data: [], error: null }),
  singleAnswer: () => ({ data: null, error: null }),
  fromCalls: 0,
  deleteCalls: [],
};

jest.mock('../src/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => {
      mockNet.fromCalls += 1;
      return {
        upsert: (row: unknown) => {
          mockNet.upsertCalls.push(row);
          return {
            select: () => ({
              single: async () => mockNet.upsertAnswer(row),
            }),
          };
        },
        select: () => ({
          eq: () => ({ maybeSingle: async () => mockNet.singleAnswer() }),
          // pullAll awaits the select builder directly — a thenable.
          then: (
            onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
            onRejected?: (e: unknown) => unknown,
          ) => Promise.resolve(mockNet.selectAnswer()).then(onFulfilled, onRejected),
        }),
        delete: () => ({
          eq: async (...args: unknown[]) => {
            mockNet.deleteCalls.push(args);
            return { data: null, error: null };
          },
        }),
      };
    },
  }),
}));

/** The stamp the database puts on the row — PostgREST's own rendering. */
const DB_STAMP = '2026-08-19 10:00:00.123456+00:00';

import { storage, wardrobeKey } from '../src/lib/storage';
import {
  deleteRemote,
  flushQueue,
  lastSyncedAt,
  pullAccount,
  pullAll,
  pushNow,
  queuePush,
  stampSynced,
  type QueuedPush,
  type StoredRow,
} from '../src/lib/sync';

const QUEUE_KEY = 'toile-sync-queue';
const META_KEY = 'toile-sync-meta';

const cloudAccount: Account = {
  id: 'w-local1',
  name: 'The weekday closet',
  handle: '@weekday',
  monogram: 'W',
  color: 'var(--color-accent)',
  createdAt: '2026-08-01',
  sync: 'cloud',
  syncId: '11111111-1111-4111-8111-111111111111',
};

const sampleAccount: Account = {
  ...cloudAccount,
  id: 'w-sample',
  syncId: '22222222-2222-4222-8222-222222222222',
  isSample: true,
};

const someState: AppState = { ...initialState };

async function readQueue(): Promise<QueuedPush[]> {
  return JSON.parse((await storage.getItem(QUEUE_KEY)) ?? '[]') as QueuedPush[];
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockNet.upsertCalls = [];
  mockNet.deleteCalls = [];
  mockNet.fromCalls = 0;
  mockNet.upsertAnswer = () => ({ data: { updated_at: DB_STAMP }, error: null });
  mockNet.selectAnswer = () => ({ data: [], error: null });
  mockNet.singleAnswer = () => ({ data: null, error: null });
});

describe('pushNow — the envelope up, the database stamp back', () => {
  test('sends the enveloped row and stamps the DB-returned time, not the proposed one', async () => {
    const result = await pushNow(cloudAccount, someState, 'user-1');
    expect(result).toBe('sent');
    expect(mockNet.upsertCalls).toHaveLength(1);
    const sent = mockNet.upsertCalls[0] as StoredRow;
    // The wire carries the envelope — v, alg 'none', the document as payload.
    expect(sent.id).toBe(cloudAccount.syncId);
    expect(sent.user_id).toBe('user-1');
    expect(sent.name).toBe('The weekday closet');
    expect(sent.state).toEqual({ v: 1, alg: 'none', payload: someState });
    // The stamp round-trip: what the meta holds is what the ROW carries.
    await expect(lastSyncedAt(cloudAccount.id)).resolves.toBe(DB_STAMP);
    expect(DB_STAMP).not.toBe(sent.updated_at);
  });

  test('a sample never reaches the wire, whatever it asks', async () => {
    const result = await pushNow(sampleAccount, someState, 'user-1');
    expect(result).toBe('sent');
    expect(mockNet.fromCalls).toBe(0);
    expect(mockNet.upsertCalls).toHaveLength(0);
  });

  test('a refused push joins the queue with the local account id aboard', async () => {
    mockNet.upsertAnswer = () => ({ data: null, error: new Error('offline') });
    const result = await pushNow(cloudAccount, someState, 'user-1');
    expect(result).toBe('queued');
    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].syncId).toBe(cloudAccount.syncId);
    expect(queue[0].accountId).toBe(cloudAccount.id);
    // Nothing was agreed, so nothing is stamped.
    await expect(lastSyncedAt(cloudAccount.id)).resolves.toBeNull();
  });

  test('a second refused push of the same wardrobe replaces the first in place', async () => {
    mockNet.upsertAnswer = () => ({ data: null, error: new Error('offline') });
    await pushNow(cloudAccount, someState, 'user-1');
    const newer: AppState = { ...someState, wearLogs: [] };
    await pushNow(cloudAccount, newer, 'user-1');
    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].state).toEqual(newer);
  });
});

describe('flushQueue — the drain stamps what it reconciles', () => {
  test('a drained push stamps its wardrobe from the returned row', async () => {
    await queuePush(cloudAccount, someState, '2026-08-19T09:00:00.000Z');
    await flushQueue('user-1');
    expect(mockNet.upsertCalls).toHaveLength(1);
    // The flushQueue stamping law: agreement reached during a drain is
    // recorded exactly as a live push records it — the DB's stamp.
    await expect(lastSyncedAt(cloudAccount.id)).resolves.toBe(DB_STAMP);
    await expect(readQueue()).resolves.toEqual([]);
  });

  test('an entry queued by an older build — no accountId — sends, unstamped', async () => {
    const legacy: QueuedPush = {
      syncId: cloudAccount.syncId!,
      name: cloudAccount.name,
      state: someState,
      queuedAt: '2026-08-19T09:00:00.000Z',
    };
    await storage.setItem(QUEUE_KEY, JSON.stringify([legacy]));
    await flushQueue('user-1');
    expect(mockNet.upsertCalls).toHaveLength(1);
    await expect(readQueue()).resolves.toEqual([]);
    // Exactly the behaviour those entries already had: sent, not stamped.
    await expect(storage.getItem(META_KEY)).resolves.toBeNull();
  });

  test('a failure stops the drain; the failed push and everything after stay, in order', async () => {
    const second: Account = { ...cloudAccount, id: 'w-local2', name: 'The second closet', syncId: '33333333-3333-4333-8333-333333333333' };
    const third: Account = { ...cloudAccount, id: 'w-local3', name: 'The third closet', syncId: '44444444-4444-4444-8444-444444444444' };
    await queuePush(cloudAccount, someState, 't1');
    await queuePush(second, someState, 't2');
    await queuePush(third, someState, 't3');
    let calls = 0;
    mockNet.upsertAnswer = () => {
      calls += 1;
      return calls === 2
        ? { data: null, error: new Error('offline again') }
        : { data: { updated_at: DB_STAMP }, error: null };
    };
    await flushQueue('user-1');
    const queue = await readQueue();
    expect(queue.map(q => q.syncId)).toEqual([second.syncId, third.syncId]);
    await expect(lastSyncedAt(cloudAccount.id)).resolves.toBe(DB_STAMP);
    await expect(lastSyncedAt(second.id)).resolves.toBeNull();
  });
});

describe('pullAccount — news adopted, echoes refused', () => {
  const remoteRow = (state: unknown, updatedAt: string) => ({
    id: cloudAccount.syncId,
    user_id: 'user-1',
    name: cloudAccount.name,
    state,
    updated_at: updatedAt,
  });

  test('a newer enveloped row is written into the store and stamped', async () => {
    const remoteState: AppState = { ...initialState };
    mockNet.singleAnswer = () => ({
      data: remoteRow({ v: 1, alg: 'none', payload: remoteState }, DB_STAMP),
      error: null,
    });
    const result = await pullAccount(cloudAccount);
    expect(result).toBe('adopted');
    const stored = JSON.parse((await storage.getItem(wardrobeKey(cloudAccount.id))) as string);
    expect(stored).toEqual(remoteState);
    await expect(lastSyncedAt(cloudAccount.id)).resolves.toBe(DB_STAMP);
  });

  test('a legacy bare row — the document with no envelope — is accepted whole', async () => {
    const bareState: AppState = { ...initialState };
    mockNet.singleAnswer = () => ({ data: remoteRow(bareState, DB_STAMP), error: null });
    const result = await pullAccount(cloudAccount);
    expect(result).toBe('adopted');
    const stored = JSON.parse((await storage.getItem(wardrobeKey(cloudAccount.id))) as string);
    expect(stored).toEqual(bareState);
  });

  test('the same instant in the two renderings is an echo, not news', async () => {
    // The device stamped the client rendering; the row answers PostgREST's.
    await stampSynced(cloudAccount.id, '2026-08-19T10:00:00.123456Z');
    mockNet.singleAnswer = () => ({
      data: remoteRow({ v: 1, alg: 'none', payload: initialState }, DB_STAMP),
      error: null,
    });
    const result = await pullAccount(cloudAccount);
    expect(result).toBe('current');
    await expect(storage.getItem(wardrobeKey(cloudAccount.id))).resolves.toBeNull();
  });

  test('an alg this build cannot open is no news, and the store is untouched', async () => {
    mockNet.singleAnswer = () => ({
      data: remoteRow({ v: 2, alg: 'sealed', payload: 'ciphertext' }, DB_STAMP),
      error: null,
    });
    const result = await pullAccount(cloudAccount);
    expect(result).toBe('none');
    await expect(storage.getItem(wardrobeKey(cloudAccount.id))).resolves.toBeNull();
  });

  test('a sample or a device-mode wardrobe never touches the wire', async () => {
    expect(await pullAccount(sampleAccount)).toBe('none');
    expect(await pullAccount({ ...cloudAccount, sync: 'device' })).toBe('none');
    expect(mockNet.fromCalls).toBe(0);
  });
});

describe('pullAll — the second device', () => {
  test('known wardrobes reconcile, unknown rows come back fresh, sealed rows drop', async () => {
    const knownState: AppState = { ...initialState };
    mockNet.selectAnswer = () => ({
      data: [
        {
          id: cloudAccount.syncId,
          user_id: 'user-1',
          name: cloudAccount.name,
          state: { v: 1, alg: 'none', payload: knownState },
          updated_at: DB_STAMP,
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          user_id: 'user-1',
          name: 'Never seen here',
          state: initialState, // a legacy bare row, fresh to this device
          updated_at: DB_STAMP,
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          user_id: 'user-1',
          name: 'From a newer Almari',
          state: { v: 2, alg: 'sealed', payload: 'ciphertext' },
          updated_at: DB_STAMP,
        },
      ],
      error: null,
    });
    const { rows, adoptedIds, fresh } = await pullAll([cloudAccount]);
    expect(rows).toHaveLength(2); // the sealed row never reaches the session layer
    expect(adoptedIds).toEqual([cloudAccount.id]);
    expect(fresh.map(r => r.name)).toEqual(['Never seen here']);
    const stored = JSON.parse((await storage.getItem(wardrobeKey(cloudAccount.id))) as string);
    expect(stored).toEqual(knownState);
  });

  test('a local wardrobe flipped back to device is left alone', async () => {
    mockNet.selectAnswer = () => ({
      data: [{
        id: cloudAccount.syncId,
        user_id: 'user-1',
        name: cloudAccount.name,
        state: { v: 1, alg: 'none', payload: initialState },
        updated_at: DB_STAMP,
      }],
      error: null,
    });
    const { adoptedIds, fresh } = await pullAll([{ ...cloudAccount, sync: 'device' }]);
    expect(adoptedIds).toEqual([]);
    expect(fresh).toEqual([]);
    await expect(storage.getItem(wardrobeKey(cloudAccount.id))).resolves.toBeNull();
  });
});

describe('deleteRemote — retiring takes the remote copy along', () => {
  test('deletes the row and forgets the stamp', async () => {
    await stampSynced(cloudAccount.id, DB_STAMP);
    await deleteRemote(cloudAccount);
    expect(mockNet.deleteCalls).toHaveLength(1);
    await expect(lastSyncedAt(cloudAccount.id)).resolves.toBeNull();
  });
});
