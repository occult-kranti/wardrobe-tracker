/**
 * THE SHELL, ALPHA — the four-room house bar and the addresses behind it.
 *
 * docs/42 §1: flag off the bar is TODAY · CLOSET · CHATS · HOUSE, four equal
 * slots, and the geometry law says the bar derives from the VISIBLE roster —
 * no spacer, no ghost cell, no disabled slot where the Look Book will sit.
 * So this suite counts to four on purpose: the accessibility label carries
 * "of 4", and a fifth slot appearing would fail it rather than pass quietly.
 *
 * The addresses are still the web's own (src/lib/routes.ts, and now
 * @almari/shared/nav which both bars read): `/` is today, `/closet` the
 * closet, `/chats` conversations, `/profile` the House, `/open` the door.
 * The two that MOVED in this wave are asserted where they moved to:
 * `/settings` is off the bar and answers as a pushed route, and `/feed` —
 * hidden, never deleted — lands on Today silently, with no plaque.
 *
 * The flag-on half of this bar lives in tabs-showcase.test.tsx, which mocks
 * FEED_ENABLED true. Both halves are asserted; neither is skipped.
 *
 * Rendered with expo-router's own testing library against the real src/app
 * directory — no fixture copy that could drift from the shipped routes.
 * Fonts and the splash screen are mocked: jest has no device to load a TTF
 * onto, and this is about the shell, not the faces.
 *
 * RNTL is pinned at 13.x on purpose: expo-router 57's testing library was
 * built against RNTL 13's synchronous render — RNTL 14 made render async,
 * so renderRouter hands back a bare Promise and every query (and the
 * global `screen`) comes up detached. The pin follows the SDK, not the
 * newest tag.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { FEED_ENABLED } from '@almari/shared/flags';

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
      outfits: [], wearLogs: [], wishlist: [],
      circle: { profiles: [], groups: [], messages: [], loans: [] },
      events: [], furniture: [], photoEncoding: 'inline',
    }),
  );
});

/** The alpha bar, in order, as a screen reader hears it (docs/42 §9). */
const ALPHA_BAR = [
  'Today, tab 1 of 4',
  'Closet, tab 2 of 4',
  'Chats, tab 3 of 4',
  'House, tab 4 of 4',
];

describe('the house bar, alpha', () => {
  test('boots on Today with four slots — and the fifth is absent, not empty', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // The day's page, blank until something is logged.
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();
    expect(shell.getPathname()).toBe('/');

    // Four slots, each announcing its place in the VISIBLE roster.
    for (const label of ALPHA_BAR) expect(shell.getByLabelText(label)).toBeTruthy();
    expect(shell.getAllByRole('tab')).toHaveLength(FEED_ENABLED ? 5 : 4);

    // The Look Book's slot is gone rather than disabled: no ghost cell, and
    // nothing on the bar says the word.
    expect(shell.queryByText('Look Book')).toBeNull();
    expect(shell.queryByText('Looks')).toBeNull();
    // Settings has left the bar for a pushed route (docs/42 §6).
    expect(shell.queryByText('Settings')).toBeNull();
    // No notification chrome of any kind rides the bar (docs/42 §1).
    for (const banned of [/unread/i, /\bnew\b/i, /\bbadge\b/i]) {
      expect(shell.queryByText(banned)).toBeNull();
    }
  });

  test('the House slot says it can be held, and holding it opens the switcher', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    const house = shell.getByLabelText('House, tab 4 of 4');
    // Instagram's account-switch gesture, translated — and announced.
    expect(house.props.accessibilityHint).toBe('Hold to switch wardrobes.');
    // Only the House carries one; a hint on every slot would be noise.
    expect(shell.getByLabelText('Today, tab 1 of 4').props.accessibilityHint).toBeUndefined();

    fireEvent(house, 'longPress');
    await waitFor(() => expect(shell.getPathname()).toBe('/profile'));
    // The sheet is up, not merely the hall: "Open now" marks the open
    // wardrobe's row and appears nowhere else in the house.
    expect(await shell.findByText('Open now')).toBeTruthy();
    // Named on the nameplate AND on its row in the sheet.
    expect(shell.getAllByText('Test wardrobe').length).toBeGreaterThan(1);
  });

  test('the Closet slot answers /closet with the pieces on their tiles', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByLabelText('Closet, tab 2 of 4'));
    expect(await shell.findByText('The linen shirt')).toBeTruthy();
    expect(shell.getPathname()).toBe('/closet');
  });

  test('the Chats slot answers /chats — the address the web keeps', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByLabelText('Chats, tab 3 of 4'));
    await waitFor(() => expect(shell.getPathname()).toBe('/chats'));
  });

  test('the House slot answers /profile — the address does not move with the word', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByLabelText('House, tab 4 of 4'));
    // The slot and the masthead say House; the address stays /profile, so a
    // deep link is the same sentence on both apps.
    expect(await shell.findByText('The House')).toBeTruthy();
    expect(shell.getPathname()).toBe('/profile');
  });

  test("the Look Book's address lands on Today, silently and without a plaque", async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });

    if (FEED_ENABLED) {
      // The showcase branch: the room is in the house and answers for itself.
      expect(await shell.findByText('Newest first. That is the whole order.')).toBeTruthy();
      expect(shell.getPathname()).toBe('/feed');
      return;
    }

    await waitFor(() => expect(shell.getPathname()).toBe('/'));
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();
    // A door that is not in the house this season gets no plaque: nothing
    // explains, apologises for, or names the room that is not here.
    expect(shell.queryByText('Newest first. That is the whole order.')).toBeNull();
    for (const banned of [/look book/i, /coming soon/i, /not available/i, /\bfeed\b/i]) {
      expect(shell.queryByText(banned)).toBeNull();
    }
  });

  test('a story deck sent from another app lands on Today the same way', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/story/acct-1' });

    if (FEED_ENABLED) {
      await waitFor(() => expect(shell.getPathname()).not.toBe('/'));
      return;
    }
    await waitFor(() => expect(shell.getPathname()).toBe('/'));
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();
  });

  test('Settings is off the bar and answers as a pushed route at /settings', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    expect(shell.getPathname()).toBe('/settings');
    // Every setting survived the move (docs/42 §6: verbatim).
    expect(await shell.findByText('Where the record lives')).toBeTruthy();
    expect(shell.getByText('The account')).toBeTruthy();
    // Pushed OVER the tabs, so the bar is not under it — and the route owes
    // the reader a door out, since the root stack shows no header.
    expect(shell.queryByLabelText('Today, tab 1 of 4')).toBeNull();
    expect(shell.getByText('Back to the house')).toBeTruthy();
  });

  test('the House masthead spool is the one door into Settings', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    fireEvent.press(shell.getByLabelText('Settings'));
    await waitFor(() => expect(shell.getPathname()).toBe('/settings'));
    expect(await shell.findByText('Where the record lives')).toBeTruthy();
  });

  test('the door answers /open outside the tabs and names the open wardrobe', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    expect(shell.getPathname()).toBe('/open');
    expect(await shell.findByText('Every wardrobe is its own closet.')).toBeTruthy();
    expect(await shell.findByText('"Test wardrobe" is open on this device.')).toBeTruthy();
  });
});
