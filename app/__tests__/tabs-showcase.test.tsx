/**
 * THE SHELL, SHOWCASE — the same bar with the flag on.
 *
 * The branch `feed-showcase` differs from this one by exactly one line in
 * packages/shared/flags.ts (`= true`). That line is the only thing this file
 * mocks, and everything else — the routes, the roster, the bar, the pager —
 * is the shipped tree. So this suite is the OTHER half of the test matrix:
 * tabs.test.tsx proves the alpha's four-room bar, and this proves that the
 * one-line flip seats the Look Book CENTRE without moving home and without
 * moving any address.
 *
 * Why a separate file: jest.mock is hoisted per module registry, so a flag
 * cannot hold two values inside one file. A second file is the honest way to
 * assert both branches rather than skipping one.
 *
 * docs/42 §1: showcase is TODAY · CLOSET · LOOKS · CHATS · HOUSE. The centre
 * slot is the Look Book's, the word shrinks to LOOKS rather than the type
 * shrinking to 11px, and Today does not move — home is Today because the
 * two-tap wear log is the load-bearing wall (§5).
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

// The one line the showcase branch changes, and nothing else.
jest.mock('@almari/shared/flags', () => ({ FEED_ENABLED: true }));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

import { FEED_ENABLED } from '@almari/shared/flags';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(
    wardrobeKey('acct-1'),
    JSON.stringify({
      schemaVersion: 8,
      items: [
        {
          id: 'i1', name: 'The linen shirt', category: 'tops', color: '#D9C4A3',
          season: [], occasion: [], imageUrl: '', dateAdded: '2026-06-01',
          wearCount: 0, favorite: false, laundryStatus: 'clean',
        },
      ],
      outfits: [], wearLogs: [],
    }),
  );
});

/** The showcase bar, in order, as a screen reader hears it. */
const SHOWCASE_BAR = [
  'Today, tab 1 of 5',
  'Closet, tab 2 of 5',
  'Looks, tab 3 of 5',
  'Chats, tab 4 of 5',
  'House, tab 5 of 5',
];

describe('the house bar, flag on', () => {
  test('the mock actually reaches the shell', () => {
    // If this fails, every assertion below is testing the alpha bar twice.
    expect(FEED_ENABLED).toBe(true);
  });

  test('five slots, the Look Book seated centre, and home has not moved', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();

    for (const label of SHOWCASE_BAR) expect(shell.getByLabelText(label)).toBeTruthy();
    expect(shell.getAllByRole('tab')).toHaveLength(5);

    // Seated CENTRE — third of five — which is the whole point of the roster
    // putting the flagged slot in the middle of the array.
    expect(shell.getByLabelText('Looks, tab 3 of 5')).toBeTruthy();
    // The word shrinks, never the type: the bar says LOOKS, not LOOK BOOK.
    expect(shell.getByText('Looks')).toBeTruthy();
    expect(shell.queryByText('Look Book')).toBeNull();

    // Home is still Today, still first, still the screen the app opens on.
    expect(shell.getPathname()).toBe('/');
  });

  test('the centre slot answers /feed — the address never moved either way', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByLabelText('Looks, tab 3 of 5'));
    await waitFor(() => expect(shell.getPathname()).toBe('/feed'));
    expect(await shell.findByText('Newest first. That is the whole order.')).toBeTruthy();
  });

  test('a /feed deep link opens the room rather than landing on Today', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    expect(await shell.findByText('Newest first. That is the whole order.')).toBeTruthy();
    expect(shell.getPathname()).toBe('/feed');
  });

  test('the House keeps the last slot and its own address', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByLabelText('House, tab 5 of 5'));
    expect(await shell.findByText('The House')).toBeTruthy();
    expect(shell.getPathname()).toBe('/profile');
  });
});
