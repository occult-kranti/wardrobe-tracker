/**
 * The account session — src/lib/session.tsx, proved against the alpha truth:
 *
 *   - local-first always: SIGNING OUT LEAVES LOCAL DATA — every byte on the
 *     shelf before the sign-out is on the shelf after it, verbatim;
 *   - a sign-in flushes the offline queue, then pulls: known wardrobes are
 *     announced for adoption, rows this device has never seen are introduced
 *     as registry rows with sync switched on and the syncId pointing home;
 *   - the app boots signed out without flinching (authReady gates the panel).
 *
 * The supabase module is replaced whole (auth and wire both — sync.ts reads
 * getSupabase from the same module, so one mock serves the pair); storage is
 * the real adapter over the AsyncStorage jest mock.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';

import type { AppState } from '@almari/shared/types';
import { initialState } from '@almari/shared/types';

/* ---------- the mocked account service ---------- */

interface MockAuthUser { id: string; email: string }

const mockAuth = {
  user: null as MockAuthUser | null,
  listeners: [] as ((event: string, user: MockAuthUser | null) => void)[],
  signOutCalls: 0,
  selectAnswer: () => ({ data: [] as unknown[], error: null as unknown }),
  upsertCalls: [] as unknown[],
  upsertAnswer: () => ({ data: { updated_at: DB_STAMP } as unknown, error: null as unknown }),
};

jest.mock('../src/lib/supabase', () => ({
  currentAuthUser: async () => mockAuth.user,
  onAuthChange: (cb: (event: string, user: MockAuthUser | null) => void) => {
    mockAuth.listeners.push(cb);
    return () => {
      mockAuth.listeners = mockAuth.listeners.filter(l => l !== cb);
    };
  },
  signInWithEmail: jest.fn(async () => ({ ok: true })),
  signUpWithEmail: jest.fn(async () => ({ ok: true })),
  signOutAuth: async () => {
    mockAuth.signOutCalls += 1;
    mockAuth.user = null;
    for (const l of [...mockAuth.listeners]) l('SIGNED_OUT', null);
  },
  getSupabase: () => ({
    from: () => ({
      upsert: (row: unknown) => {
        mockAuth.upsertCalls.push(row);
        return { select: () => ({ single: async () => mockAuth.upsertAnswer() }) };
      },
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        then: (
          onFulfilled: (v: unknown) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => Promise.resolve(mockAuth.selectAnswer()).then(onFulfilled, onRejected),
      }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  }),
}));

const DB_STAMP = '2026-08-19 11:00:00.5+00:00';

import { SessionProvider, useSession } from '../src/lib/session';
import { ACCOUNTS_KEY, storage, wardrobeKey } from '../src/lib/storage';
import { lastSyncedAt, onSyncAdopted } from '../src/lib/sync';

type Ctx = ReturnType<typeof useSession>;
let ctx: Ctx | null = null;

function Probe() {
  ctx = useSession();
  return null;
}

async function mountSession() {
  const view = render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await waitFor(() => expect(ctx?.authReady).toBe(true));
  return view;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  ctx = null;
  mockAuth.user = null;
  mockAuth.listeners = [];
  mockAuth.signOutCalls = 0;
  mockAuth.upsertCalls = [];
  mockAuth.selectAnswer = () => ({ data: [], error: null });
  mockAuth.upsertAnswer = () => ({ data: { updated_at: DB_STAMP }, error: null });
});

describe('booting signed out', () => {
  test('authReady flips once the stored session has been checked; no user', async () => {
    await mountSession();
    expect(ctx?.authUser).toBeNull();
    expect(mockAuth.upsertCalls).toHaveLength(0);
  });
});

describe('signing out leaves local data — the promise, byte for byte', () => {
  test('every shelf entry survives a sign-out verbatim', async () => {
    // A device with a real record on it: registry, wardrobe, community.
    const doc: AppState = { ...initialState };
    await storage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([{
        id: 'w-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
        color: 'var(--color-accent)', createdAt: '2026-08-01', sync: 'cloud',
        syncId: '11111111-1111-4111-8111-111111111111',
      }]),
    );
    await storage.setItem(wardrobeKey('w-1'), JSON.stringify(doc));
    await storage.setItem('toile-community', JSON.stringify({ posts: [] }));

    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    await mountSession();
    await waitFor(() => expect(ctx?.authUser?.email).toBe('tester@example.com'));

    // The whole shelf, photographed before the sign-out.
    const keysBefore = [...(await storage.getAllKeys())].sort();
    const shelfBefore = new Map<string, string | null>();
    for (const key of keysBefore) shelfBefore.set(key, await storage.getItem(key));

    await act(async () => {
      await ctx!.signOutAccount();
    });

    expect(mockAuth.signOutCalls).toBe(1);
    await waitFor(() => expect(ctx?.authUser).toBeNull());

    const keysAfter = [...(await storage.getAllKeys())].sort();
    expect(keysAfter).toEqual(keysBefore);
    for (const key of keysAfter) {
      await expect(storage.getItem(key)).resolves.toBe(shelfBefore.get(key));
    }
  });
});

describe('what a sign-in sets in motion', () => {
  test('the offline queue goes up first, and its wardrobe is stamped', async () => {
    await storage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([{
        id: 'w-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
        color: 'var(--color-accent)', createdAt: '2026-08-01', sync: 'cloud',
        syncId: '11111111-1111-4111-8111-111111111111',
      }]),
    );
    await storage.setItem('toile-sync-queue', JSON.stringify([{
      syncId: '11111111-1111-4111-8111-111111111111',
      name: 'The weekday closet',
      state: initialState,
      queuedAt: '2026-08-19T09:00:00.000Z',
      accountId: 'w-1',
    }]));

    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    await mountSession();

    await waitFor(async () => {
      expect(mockAuth.upsertCalls).toHaveLength(1);
      await expect(storage.getItem('toile-sync-queue')).resolves.toBe('[]');
    });
    // The queue-flush stamping law, end to end: the drain recorded agreement.
    await expect(lastSyncedAt('w-1')).resolves.toBe(DB_STAMP);
  });

  test('a known wardrobe with news is adopted and announced; a fresh row is introduced', async () => {
    await storage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([{
        id: 'w-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
        color: 'var(--color-accent)', createdAt: '2026-08-01', sync: 'cloud',
        syncId: '11111111-1111-4111-8111-111111111111',
      }]),
    );
    const knownState: AppState = { ...initialState };
    mockAuth.selectAnswer = () => ({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          name: 'The weekday closet',
          state: { v: 1, alg: 'none', payload: knownState },
          updated_at: DB_STAMP,
        },
        {
          id: '77777777-7777-4777-8777-777777777777',
          user_id: 'user-1',
          name: 'The travelling closet',
          state: initialState, // a legacy bare row — still a wardrobe
          updated_at: DB_STAMP,
        },
      ],
      error: null,
    });

    const announced: string[] = [];
    const unsubscribe = onSyncAdopted(id => announced.push(id));

    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    await mountSession();

    await waitFor(() => expect(announced).toEqual(['w-1']));
    unsubscribe();

    // The known wardrobe's store holds the pulled record, stamped.
    const pulled = JSON.parse((await storage.getItem(wardrobeKey('w-1'))) as string);
    expect(pulled).toEqual(knownState);
    await expect(lastSyncedAt('w-1')).resolves.toBe(DB_STAMP);

    // The fresh row became a registry row: sync on, syncId pointing home,
    // the vocabulary derived exactly as the web derives it.
    const registry = JSON.parse((await storage.getItem(ACCOUNTS_KEY)) as string) as Array<Record<string, unknown>>;
    expect(registry).toHaveLength(2);
    const fresh = registry.find(a => a.name === 'The travelling closet');
    expect(fresh).toBeDefined();
    expect(fresh!.sync).toBe('cloud');
    expect(fresh!.syncId).toBe('77777777-7777-4777-8777-777777777777');
    expect(fresh!.handle).toBe('@thetravellingclose');
    expect(fresh!.monogram).toBe('TC');
    // Its store was written and stamped, so the next pull is an echo, not news.
    const freshDoc = JSON.parse((await storage.getItem(wardrobeKey(fresh!.id as string))) as string);
    expect(freshDoc).toEqual(initialState);
    await expect(lastSyncedAt(fresh!.id as string)).resolves.toBe(DB_STAMP);
  });
});
