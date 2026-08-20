/**
 * The sync rules — the pure section of src/lib/sync.ts, proved the way
 * scripts/test-sync.mjs proves the web's: no network, no mocks, just the
 * envelope, the conflict rule, and the queue discipline. The app file
 * mirrors the web file byte for byte in semantics; this suite is the
 * proof the crossing lost nothing.
 */
import { describe, expect, jest, test } from '@jest/globals';

// sync.ts imports the supabase client module (for the wire section, unused
// here); the keychain import inside it is mocked so the pure rules can be
// proved without a device keychain.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import type { AppState } from '@almari/shared/types';
import { initialState } from '@almari/shared/types';

import {
  ENVELOPE_VERSION,
  accountFromRow,
  drainQueue,
  enqueuePush,
  fromRow,
  openRow,
  openState,
  remoteIsNewer,
  shouldSync,
  syncModeOf,
  toRow,
  type IncomingRow,
  type QueuedPush,
  type StateEnvelope,
} from '../src/lib/sync';

const someState: AppState = { ...initialState, items: [] };

describe('the envelope — what the state column holds', () => {
  test('toRow wraps the document in a v1 alg-none envelope, keyed by syncId', () => {
    const row = toRow(
      { name: 'The weekday closet', syncId: 'a1b2c3d4-0000-4000-8000-000000000001' },
      someState,
      'user-1',
      '2026-08-19T10:00:00.000Z',
    );
    expect(row).toEqual({
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      user_id: 'user-1',
      name: 'The weekday closet',
      state: { v: ENVELOPE_VERSION, alg: 'none', payload: someState },
      updated_at: '2026-08-19T10:00:00.000Z',
    });
    // The exact envelope shape, spelled out — v, alg, payload and nothing else.
    expect(Object.keys(row.state).sort()).toEqual(['alg', 'payload', 'v']);
    expect(row.state.v).toBe(1);
    expect(row.state.alg).toBe('none');
    expect(row.state.payload).toBe(someState);
  });

  test('openState opens an envelope, reads a legacy bare row, refuses an unknown alg', () => {
    const envelope: StateEnvelope = { v: 1, alg: 'none', payload: someState };
    expect(openState(envelope)).toBe(someState);
    // A row written before envelopes existed carries the document bare —
    // live alpha data that must keep reading.
    expect(openState(someState)).toBe(someState);
    // An alg this build does not know says nothing rather than writing
    // ciphertext into someone's wardrobe as though it were pieces.
    const sealed = { v: 2, alg: 'sealed', payload: 'ciphertext' } as unknown as StateEnvelope;
    expect(openState(sealed)).toBeNull();
  });

  test('openRow and fromRow accept the legacy bare row whole', () => {
    const bare: IncomingRow = {
      id: 'row-1',
      user_id: 'user-1',
      name: 'Older than envelopes',
      state: someState,
      updated_at: '2026-08-01T00:00:00+00:00',
    };
    expect(openRow(bare)).toEqual({ ...bare, state: someState });
    expect(fromRow(bare)).toEqual({
      name: 'Older than envelopes',
      state: someState,
      updatedAt: '2026-08-01T00:00:00+00:00',
    });
  });

  test('openRow drops a row this build cannot read', () => {
    const sealedRow = {
      id: 'row-2',
      user_id: 'user-1',
      name: 'From a newer Almari',
      state: { v: 2, alg: 'sealed', payload: 'ciphertext' },
      updated_at: '2026-08-19T00:00:00Z',
    } as unknown as IncomingRow;
    expect(openRow(sealedRow)).toBeNull();
  });
});

describe('who may sync', () => {
  test('absent sync means device — every account written before sync existed', () => {
    expect(syncModeOf({})).toBe('device');
    expect(syncModeOf({ sync: 'cloud' })).toBe('cloud');
    expect(syncModeOf({ sync: 'device' })).toBe('device');
  });

  test('a sample never syncs, whatever its flags say', () => {
    expect(shouldSync({ sync: 'cloud', isSample: true, syncId: 'x' })).toBe(false);
    expect(shouldSync({ sync: 'cloud', syncId: 'x' })).toBe(true);
    expect(shouldSync({ sync: 'device', syncId: 'x' })).toBe(false);
    expect(shouldSync({})).toBe(false);
  });
});

describe('the conflict rule — equal is not newer', () => {
  test('no stamp yet: the account copy carries news', () => {
    expect(remoteIsNewer('2026-08-19T10:00:00.000Z', null)).toBe(true);
  });

  test('one instant in the two writers’ renderings is one instant', () => {
    // This client writes toISOString; PostgREST renders timestamptz with
    // trimmed fractional zeros and a +00:00 offset. Compared as glyphs these
    // disagree; compared as instants they are the same write seen twice.
    const clientStamp = '2026-08-19T10:00:00.000Z';
    const pgStamp = '2026-08-19T10:00:00+00:00';
    expect(remoteIsNewer(pgStamp, clientStamp)).toBe(false);
    expect(remoteIsNewer(clientStamp, pgStamp)).toBe(false);
  });

  test('a genuinely newer remote row is news; an older one is not', () => {
    expect(remoteIsNewer('2026-08-19T10:00:01+00:00', '2026-08-19T10:00:00.000Z')).toBe(true);
    expect(remoteIsNewer('2026-08-19T09:59:59+00:00', '2026-08-19T10:00:00.000Z')).toBe(false);
  });

  test('unreadable stamps err the safe way on each side', () => {
    // A local stamp we cannot read is no agreement — let the account copy in.
    expect(remoteIsNewer('2026-08-19T10:00:00Z', 'not a time')).toBe(true);
    // A remote clock we cannot read never replaces the original.
    expect(remoteIsNewer('not a time', '2026-08-19T10:00:00Z')).toBe(false);
  });
});

describe('the offline queue', () => {
  const push = (syncId: string, name: string, queuedAt: string): QueuedPush => ({
    syncId,
    name,
    state: someState,
    queuedAt,
  });

  test('a second push of the same wardrobe replaces in place, order kept', () => {
    let queue: QueuedPush[] = [];
    queue = enqueuePush(queue, push('a', 'First', 't1'));
    queue = enqueuePush(queue, push('b', 'Second', 't2'));
    queue = enqueuePush(queue, { ...push('a', 'First again', 't3') });
    expect(queue.map(q => q.syncId)).toEqual(['a', 'b']);
    expect(queue[0].name).toBe('First again');
    expect(queue[0].queuedAt).toBe('t3');
  });

  test('a drain stops at the first failure and keeps the rest, in order', async () => {
    const queue = [push('a', 'A', 't1'), push('b', 'B', 't2'), push('c', 'C', 't3')];
    const sent: string[] = [];
    const { sent: ok, remaining } = await drainQueue(queue, async p => {
      if (p.syncId === 'b') throw new Error('offline');
      sent.push(p.syncId);
    });
    expect(ok).toEqual(['a']);
    expect(sent).toEqual(['a']);
    expect(remaining.map(q => q.syncId)).toEqual(['b', 'c']);
  });
});

describe('a remote row becoming a wardrobe on a new device', () => {
  test('accountFromRow keeps the row name, switches sync on, points syncId home', () => {
    const account = accountFromRow(
      { id: 'row-uuid', name: 'The travelling closet' },
      { id: 'w-1', handle: '@travelling', monogram: 'TC', color: 'var(--color-accent)', createdAt: '2026-08-19' },
    );
    expect(account).toEqual({
      id: 'w-1',
      handle: '@travelling',
      monogram: 'TC',
      color: 'var(--color-accent)',
      createdAt: '2026-08-19',
      name: 'The travelling closet',
      sync: 'cloud',
      syncId: 'row-uuid',
    });
  });
});
