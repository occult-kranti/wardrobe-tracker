/**
 * The tab shell smoke — the shell boots, the four rooms of the shell
 * answer their addresses, and the addresses are the web's own
 * (src/lib/routes.ts: `/` is today, `/closet` the closet, `/feed` the feed,
 * `/settings` settings, `/open` the door).
 *
 * Since the wardrobe opened (wave 4a), the shell only shows its tabs when
 * a wardrobe exists — a device with none walks to the door instead (that
 * path is door.test.tsx's). So this suite seeds one small wardrobe and
 * asserts the same four addresses it always has, now with the real
 * screens' own lines.
 *
 * Rendered with expo-router's own testing library against the real
 * src/app directory — no fixture copy that could drift from the shipped
 * routes. Fonts and the splash screen are mocked: jest has no device to
 * load a TTF onto, and the smoke test is about the shell, not the faces.
 *
 * RNTL is pinned at 13.x on purpose: expo-router 57's testing library was
 * built against RNTL 13's synchronous render — RNTL 14 made render async,
 * so renderRouter hands back a bare Promise and every query (and the
 * global `screen`) comes up detached. The pin follows the SDK, not the
 * newest tag.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';
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

describe('the tab shell', () => {
  test('boots on Today with all four tabs on the rail', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // The day's page, blank until something is logged.
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();
    expect(shell.getPathname()).toBe('/');
    expect(shell.getAllByText('Today').length).toBeGreaterThan(0);
    expect(shell.getByText('Closet')).toBeTruthy();
    expect(shell.getByText('Look Book')).toBeTruthy();
    expect(shell.getByText('Settings')).toBeTruthy();
  });

  test('the Closet tab answers /closet with the pieces on their tiles', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByText('Closet'));
    expect(await shell.findByText('The linen shirt')).toBeTruthy();
    expect(shell.getPathname()).toBe('/closet');
  });

  test('the Look Book tab answers /feed — the web route keeps its address', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText("Today's page is still blank.");

    fireEvent.press(shell.getByText('Look Book'));
    // The placeholder's empty line gave way to the living feed (FEED wave):
    // the route now answers with the feed's own order sentence.
    expect(await shell.findByText('Newest first. That is the whole order.')).toBeTruthy();
    expect(shell.getPathname()).toBe('/feed');
  });

  test('the door answers /open outside the tabs and names the open wardrobe', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    expect(shell.getPathname()).toBe('/open');
    expect(await shell.findByText('Every wardrobe is its own closet.')).toBeTruthy();
    expect(await shell.findByText('"Test wardrobe" is open on this device.')).toBeTruthy();
  });
});
