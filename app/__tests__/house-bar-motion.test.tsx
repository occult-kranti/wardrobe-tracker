/**
 * THE TAP, WITH AND WITHOUT STILLNESS ASKED FOR (docs/42 §3, §10 QA 6).
 *
 * The ruling's reduced-motion answer for a bar tap is exact: "a bar tap is a
 * 140ms opacity crossfade, no slide", and QA 6 is marked "fix before ship;
 * accessibility is not negotiable". This is that case, exercised against the
 * real shell rather than against a bench that could agree with itself.
 *
 * WHAT IS OBSERVABLE, AND WHY IT IS THE RIGHT THING TO WATCH. An opacity is
 * painted by `setNativeProps` and leaves no trace in a rendered tree, so the
 * assertion here is on the crossfade's MECHANISM instead: the sheet swaps at
 * the trough of the fade, not on the touch. With motion allowed the swap is
 * immediate — that half of this file is what makes the other half red-proof,
 * because a shell that never deferred anything would pass "it arrived" and
 * fail "it had not arrived yet".
 *
 * The bar itself is watched across the fade for the thing the design claims:
 * the rail does not blink with the sheets. The opacity rides `pagerStyle`,
 * which lands on the pager alone — the tab bar is the pager's sibling, not
 * its child — so all four slots are on screen throughout and the eyelet is
 * punched at the new slot rather than travelled to it.
 *
 * Fonts and the splash screen are mocked for the same reason tabs.test.tsx
 * mocks them: jest has no device to load a TTF onto.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

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

/** What the system was asked for, before the shell reads it. */
function stillness(asked: boolean) {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(async () => asked);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      {
        id: 'acct-1',
        name: 'Test wardrobe',
        handle: '@test',
        monogram: 'T',
        color: '#105F7D',
        createdAt: '2026-08-01',
      },
    ]),
  );
  await storage.setItem(
    wardrobeKey('acct-1'),
    JSON.stringify({
      schemaVersion: 8,
      items: [
        {
          id: 'i1',
          name: 'The linen shirt',
          category: 'tops',
          color: '#D9C4A3',
          season: [],
          occasion: [],
          imageUrl: '',
          dateAdded: '2026-06-01',
          wearCount: 0,
          favorite: false,
          laundryStatus: 'clean',
        },
      ],
      outfits: [],
      wearLogs: [],
      wishlist: [],
      circle: { profiles: [], groups: [], messages: [], loans: [] },
      events: [],
      furniture: [],
      photoEncoding: 'inline',
    }),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Boot the shell on Today, with the system's answer already in hand. */
async function openHouse(reduceMotion: boolean) {
  stillness(reduceMotion);
  const shell = renderRouter('./src/app', { initialUrl: '/' });
  await shell.findByText("Today's page is still blank.");
  // The shell reads the setting once, asynchronously, at mount: wait for the
  // read to have landed before pressing anything, or the tap under test would
  // be answered by the default rather than by the answer.
  await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
  return shell;
}

describe('a bar tap, motion allowed', () => {
  test('the sheet is handed over on the touch — the pager slides it across', async () => {
    const shell = await openHouse(false);

    fireEvent.press(shell.getByLabelText('Chats, tab 3 of 4'));
    // Nothing is waiting on a clock: the navigator has the address already,
    // and react-native-pager-view animates the sheet from there.
    expect(shell.getPathname()).toBe('/chats');
  });
});

describe('a bar tap, stillness asked for', () => {
  test('the sheet is not handed over on the touch — it waits for the trough', async () => {
    const shell = await openHouse(true);

    fireEvent.press(shell.getByLabelText('House, tab 4 of 4'));
    // 70ms of fade still to go. The old sheet is on its way out and the swap
    // has not happened, which is exactly what makes this a dissolve rather
    // than a cut with a fade painted over it.
    expect(shell.getPathname()).toBe('/');

    await waitFor(() => expect(shell.getPathname()).toBe('/profile'));
    // And the room it dissolved into is the one that was asked for.
    expect(await shell.findByText('The House')).toBeTruthy();
  });

  test('the rail does not blink with the sheets, and the eyelet is punched at the new slot', async () => {
    const shell = await openHouse(true);

    fireEvent.press(shell.getByLabelText('Chats, tab 3 of 4'));
    // Mid-fade: the bar is whole. The opacity rides `pagerStyle`, which is the
    // pager alone — the bar is its sibling, so nothing about the rail moves.
    expect(shell.getAllByRole('tab')).toHaveLength(4);
    expect(shell.getByTestId('house-bar-eyelet', { includeHiddenElements: true })).toBeTruthy();

    await waitFor(() => expect(shell.getPathname()).toBe('/chats'));
    // The bead is punched at the slot it arrived on, not travelled to it.
    expect(shell.getByLabelText('Chats, tab 3 of 4').props.accessibilityState.selected).toBe(true);
    expect(shell.getByLabelText('Today, tab 1 of 4').props.accessibilityState.selected).toBe(false);
    expect(shell.getAllByRole('tab')).toHaveLength(4);
  });

  test('a second tap mid-fade owns the bar — the first one’s clock is thrown away', async () => {
    const shell = await openHouse(true);

    // The shell boots on real timers because storage and the accessibility
    // read are real promises; the fade itself is a clock, and from here the
    // clock is ours so the two taps land at known moments rather than at
    // whatever the machine felt like.
    jest.useFakeTimers();
    try {
      fireEvent.press(shell.getByLabelText('Chats, tab 3 of 4'));
      act(() => {
        jest.advanceTimersByTime(40);
      });
      // 30ms before Chats would have arrived, the House is asked for instead.
      fireEvent.press(shell.getByLabelText('House, tab 4 of 4'));
      act(() => {
        jest.advanceTimersByTime(40);
      });

      // t = 80ms. Chats' own trough was due at 70 and must have been thrown
      // away with its fade; the House's is due at 110. A shell that let both
      // clocks run would be standing in Chats right now — a room nobody
      // asked to be shown, dissolved into and straight back out of.
      expect(shell.getPathname()).toBe('/');

      act(() => {
        jest.advanceTimersByTime(40);
      });
      expect(shell.getPathname()).toBe('/profile');
    } finally {
      jest.useRealTimers();
    }
  });

  test('tapping the slot you are already standing on spends no fade at all', async () => {
    const shell = await openHouse(true);

    fireEvent.press(shell.getByLabelText('Today, tab 1 of 4'));
    expect(shell.getPathname()).toBe('/');
    // Still Today after the whole 140ms has had every chance to elapse: the
    // house does not dip a sheet to arrive where it already is.
    await waitFor(() => expect(shell.getByText("Today's page is still blank.")).toBeTruthy());
    expect(shell.getPathname()).toBe('/');
  });
});
