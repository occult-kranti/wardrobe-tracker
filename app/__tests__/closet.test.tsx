/**
 * The closet screen — tiles, the detail sheet, the add sheet.
 *
 * Mirrors the maths contracts the node suites hold: every figure on a tile
 * comes from @almari/shared/cost via shared/similarity's wearContext, so
 * the expected strings here are the same INR strings scripts/test-dates.mjs
 * pins for the formatters (₹, en-IN grouping, two decimals per wear) and
 * the CPW precedence scripts/test-migrate.mjs's corpus exercises (a
 * recorded 0 is 'free', never a per-wear figure; no wears is its own
 * answer). Rendered through the real router tree — provider, storage,
 * migrate-on-read included.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

const DOC = JSON.stringify({
  schemaVersion: 8,
  items: [
    {
      id: 'i-oxford', name: 'The white oxford', category: 'tops', color: '#F4EFE2',
      season: [], occasion: ['work'], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 100, cost: 350, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i-ring', name: 'The gifted ring', category: 'accessories', color: '#C9A227',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-25',
      wearCount: 9, cost: 0, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i-linen', name: 'The good linen shirt', category: 'tops', color: '#D9C4A3',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-06-01',
      wearCount: 0, cost: 2600, favorite: false, laundryStatus: 'clean',
    },
  ],
  outfits: [], wearLogs: [], wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [], furniture: [], photoEncoding: 'inline',
});

async function seed(doc: string | null) {
  await AsyncStorage.clear();
  if (doc === null) return;
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey('acct-1'), doc);
}

describe('the closet tiles state their ledger honestly', () => {
  beforeEach(async () => {
    await seed(DOC);
  });

  test('cost-per-wear renders in rupees via the shared formatter', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    // 350 over 100 wears — the en-IN two-decimal string, from shared/cost.
    expect(await shell.findByText('Tops · worn 100× · ₹3.50/wear')).toBeTruthy();
  });

  test('a recorded zero is free, not a per-wear figure; no wears is its own answer', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    // reason 'free': wears stated plainly, never ₹0.00/wear.
    expect(await shell.findByText('Accessories · 9 wears')).toBeTruthy();
    // reason 'no-wears': the caption says so instead of dividing by zero.
    expect(await shell.findByText('Tops · never worn yet')).toBeTruthy();
  });

  test('the detail sheet shows the facts and "Worn today" logs with the seal copy', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('The white oxford'));

    expect(await shell.findByText('₹350')).toBeTruthy();
    expect(shell.getByText('₹3.50/wear')).toBeTruthy();
    expect(shell.getByText('100')).toBeTruthy();

    fireEvent.press(shell.getByText('Worn today'));
    expect(await shell.findByText('Logged. Worn 101 times.')).toBeTruthy();
    // The count moved on the tile too.
    expect(await shell.findByText('Tops · worn 101× · ₹3.47/wear')).toBeTruthy();
  });

  test('the add sheet takes the minimal fields and the piece persists', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));

    fireEvent.changeText(await shell.findByLabelText('Name'), 'The market tote');
    fireEvent.press(shell.getByText('Add it'));

    expect(await shell.findByText('Added. It starts at 0 wears.')).toBeTruthy();
    expect(await shell.findByText('The market tote')).toBeTruthy();

    // Through the debounce and onto the shelf — waitFor advances the settle
    // window (the RN preset's timers are fake; waitFor is what drives them).
    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(raw).toContain('The market tote');
    });
  });

  test('a nameless piece is refused with a sentence, not a disabled door', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    fireEvent.press(await shell.findByText('Add a piece'));
    fireEvent.press(await shell.findByText('Add it'));
    expect(await shell.findByText('A name is all it needs to start.')).toBeTruthy();
  });
});

describe('the empty closet keeps the house line', () => {
  test('an empty wardrobe shows the empty state, not a zero-row grid', async () => {
    await seed(JSON.stringify({ items: [] }));
    const shell = renderRouter('./src/app', { initialUrl: '/closet' });
    expect(await shell.findByText('Nothing hangs here yet.')).toBeTruthy();
    expect(
      shell.getByText(
        'One piece is enough to start: a name, and a photo if you have one. The ledger counts from its first wear.',
      ),
    ).toBeTruthy();
  });
});
