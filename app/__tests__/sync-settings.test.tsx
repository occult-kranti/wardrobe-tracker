/**
 * Settings — the per-wardrobe sync choice, held to the alpha truth:
 *
 *   - OPT-IN, OFF BY DEFAULT: a wardrobe that never chose reads 'device'
 *     and the registry says nothing until its owner presses the choice;
 *   - the plain trust sentence ships wherever sync is offered (docs/35);
 *   - choosing 'Synced to my account' while signed out offers the sign-in
 *     instead of silently promising a sync with nowhere to go;
 *   - a sample never gets the choice at all;
 *   - flipping back to 'On this device' keeps the syncId, so the same
 *     remote row is found again.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

interface MockAuthUser { id: string; email: string }

const mockAuth = {
  user: null as MockAuthUser | null,
  listeners: [] as ((event: string, user: MockAuthUser | null) => void)[],
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
  signOutAuth: jest.fn(async () => undefined),
  getSupabase: () => ({
    from: () => ({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(onF, onR),
      }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  }),
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function seedWardrobe(row: Record<string, unknown>) {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: row.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([row]));
  await storage.setItem(wardrobeKey(row.id as string), JSON.stringify({ items: [] }));
}

async function registryRow(id: string): Promise<Record<string, unknown>> {
  const registry = JSON.parse((await storage.getItem(ACCOUNTS_KEY)) as string) as Array<Record<string, unknown>>;
  return registry.find(a => a.id === id)!;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockAuth.user = null;
  mockAuth.listeners = [];
});

describe('where the record lives — off by default, said plainly', () => {
  test('a wardrobe that never chose reads as device-kept, with the trust sentence beside the choice', async () => {
    await seedWardrobe({
      id: 'acct-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
      color: 'var(--color-accent)', createdAt: '2026-08-01',
    });
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    expect(await shell.findByText('Where the record lives')).toBeTruthy();
    expect(shell.getByText('On this device')).toBeTruthy();
    expect(shell.getByText('Synced to my account')).toBeTruthy();
    expect(shell.getByText(/Kept on this device only/)).toBeTruthy();
    // The plain sentence — docs/35: who can read a synced copy, said
    // wherever sync is offered, until E2E encryption lands.
    expect(shell.getByText(/until end-to-end encryption ships/)).toBeTruthy();
    expect(shell.getByText(/the operator of that\s+project could read it/)).toBeTruthy();
  });

  test('choosing sync while signed out offers the sign-in and changes nothing', async () => {
    await seedWardrobe({
      id: 'acct-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
      color: 'var(--color-accent)', createdAt: '2026-08-01',
    });
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    fireEvent.press(await shell.findByText('Synced to my account'));
    expect(await shell.findByText('Syncing needs the account it syncs to')).toBeTruthy();
    // The choice did not hold — the registry still says nothing about sync.
    const row = await registryRow('acct-1');
    expect(row.sync).toBeUndefined();
    expect(row.syncId).toBeUndefined();
  });

  test('signed in, the choice holds: sync on mints a uuid; sync off keeps it', async () => {
    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    await seedWardrobe({
      id: 'acct-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
      color: 'var(--color-accent)', createdAt: '2026-08-01',
    });
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    fireEvent.press(await shell.findByText('Synced to my account'));
    await waitFor(async () => {
      const row = await registryRow('acct-1');
      expect(row.sync).toBe('cloud');
    });
    const turnedOn = await registryRow('acct-1');
    expect(turnedOn.syncId).toMatch(UUID_SHAPE);
    expect(await shell.findByText(/A copy is kept on your account/)).toBeTruthy();

    // Flipping back keeps the id — the same remote row is found again — and
    // the copy line says what happens to the account's copy.
    fireEvent.press(shell.getByText('On this device'));
    await waitFor(async () => {
      const row = await registryRow('acct-1');
      expect(row.sync).toBe('device');
    });
    const turnedOff = await registryRow('acct-1');
    expect(turnedOff.syncId).toBe(turnedOn.syncId);
    expect(await shell.findByText(/left on the account as it was/)).toBeTruthy();
  });

  test('a sample never gets the choice at all', async () => {
    await seedWardrobe({
      id: 'sample-1', name: 'The sample closet', handle: '@sample', monogram: 'S',
      color: 'var(--color-accent)', createdAt: '2026-08-01', isSample: true,
    });
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    expect(await shell.findByText(/A sample never syncs/)).toBeTruthy();
    expect(shell.queryByText('Synced to my account')).toBeNull();
    expect(shell.queryByText('On this device')).toBeNull();
  });
});

describe('the account section in Settings', () => {
  test('signed out it explains and offers the form; signed in it names the account', async () => {
    await seedWardrobe({
      id: 'acct-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W',
      color: 'var(--color-accent)', createdAt: '2026-08-01',
    });
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    expect(await shell.findByText('The account')).toBeTruthy();
    expect(await shell.findByText(/The maker pays for it out of a free tier/)).toBeTruthy();

    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    for (const l of [...mockAuth.listeners]) l('SIGNED_IN', mockAuth.user);
    expect(await shell.findByText('Signed in as tester@example.com')).toBeTruthy();
    // The sign-out promise, where the button is.
    expect(shell.getByText(/Signing out ends that and deletes\s+nothing/)).toBeTruthy();
    expect(shell.getByText('Sign out')).toBeTruthy();
  });
});
