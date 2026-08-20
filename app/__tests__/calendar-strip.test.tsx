/**
 * THE WEEK STRIP ON TODAY — seven local days, and the doors they open.
 *
 * THE CHECK THIS SURFACE EXISTS TO SURVIVE is that its seven days are LOCAL
 * days. A strip built with toISOString() looks perfect all afternoon and is
 * wrong every evening west of UTC and every morning east of it — the last
 * column says tomorrow, the wear you log lands on a day you were asleep, and
 * nothing on screen admits it. So the clock here is FAKED at 23:30 and again
 * at 00:30, the two moments a UTC slice gets wrong, and the assertions are
 * written to be true in any zone this suite is pinned to: the wall clock is
 * built with new Date(y, m, d, h, …), which means that moment in the runner's
 * own zone, exactly as app/__tests__/stress-time.test.ts establishes.
 *
 * Only Date is faked (that suite's doNotFake list), so timers, promises and
 * waitFor stay real and the provider's 250ms settle window behaves as shipped.
 *
 * Rendered through the shipped router tree — root layout, WardrobeProvider,
 * the AsyncStorage adapter, migrate-on-read — so what is exercised is the
 * path a tester walks.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

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

const ACCOUNT = {
  id: 'acct-1',
  name: 'Test wardrobe',
  handle: '@test',
  monogram: 'T',
  color: '#105F7D',
  createdAt: '2026-08-01',
};

const piece = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  category: 'tops',
  color: '#D9C4A3',
  season: [],
  occasion: [],
  imageUrl: '',
  dateAdded: '2026-06-01',
  wearCount: 0,
  favorite: false,
  laundryStatus: 'clean',
  ...extra,
});

/**
 * A record with one written day (17 August, two pieces), one day holding
 * nothing but a plan whose date has passed (15 August), and five days that
 * were never written. The matured plan is the interesting one: a plan is a
 * question, never a wear, and the strip must not mark it as one.
 */
const DOC = JSON.stringify({
  schemaVersion: 8,
  items: [
    piece('i-oxford', 'The white oxford', { wearCount: 3 }),
    piece('i-jeans', 'Indigo jeans', { category: 'bottoms', wearCount: 2 }),
  ],
  outfits: [],
  wearLogs: [
    { id: 'w-mon', date: '2026-08-17', itemIds: ['i-oxford', 'i-jeans'] },
    { id: 'w-plan', date: '2026-08-15', itemIds: ['i-oxford'], planned: true },
  ],
  wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [],
  photoEncoding: 'inline',
});

const BARE = JSON.stringify({
  schemaVersion: 8,
  items: [],
  outfits: [],
  wearLogs: [],
  wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [],
  photoEncoding: 'inline',
});

/** Only Date is faked — stress-time.test.ts's exact doNotFake list. */
function fakeDateOnly(now: Date) {
  jest.useFakeTimers({
    doNotFake: [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask',
      'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback',
      'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout',
    ],
    now,
  });
}

async function seed(doc: string) {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: ACCOUNT.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ACCOUNT]));
  await storage.setItem(wardrobeKey(ACCOUNT.id), doc);
}

beforeEach(async () => {
  await seed(DOC);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('seven local days', () => {
  test('at 23:30 the strip is the six days behind today, and today last', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 23, 30));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // 13 August through 19 August: seven numerals, no eighth, none missing.
    for (const n of ['13', '14', '15', '16', '17', '18', '19']) {
      expect(await shell.findByText(n)).toBeTruthy();
    }
    // The day a UTC slice would have added at half past eleven at night.
    expect(shell.queryByText('20')).toBeNull();
    // And the day it would have dropped off the other end.
    expect(shell.queryByText('12')).toBeNull();

    // Today is named as today, in the house's en-IN voice.
    expect(shell.getByLabelText(/^Today, Wednesday, 19 August/)).toBeTruthy();
  });

  test('at 00:30 the same morning the strip has already turned over', async () => {
    fakeDateOnly(new Date(2026, 7, 20, 0, 30));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    expect(await shell.findByText('20')).toBeTruthy();
    expect(shell.getByText('14')).toBeTruthy();
    expect(shell.getByLabelText(/^Today, Thursday, 20 August/)).toBeTruthy();
    // Half an hour earlier this was the last column; it is a past day now.
    expect(shell.getByLabelText(/^Wednesday, 19 August/)).toBeTruthy();
    expect(shell.queryByText('13')).toBeNull();
  });

  test('a strip that crosses a month says both months', async () => {
    fakeDateOnly(new Date(2026, 8, 2, 9, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // 27 August – 2 September. en-IN abbreviates September as "Sept", which
    // is what the web's own spanLabel prints from the same call — parity with
    // src/pages/Calendar.tsx, not a typo.
    expect(await shell.findByText('Aug – Sept 2026')).toBeTruthy();
    expect(shell.getByText('27')).toBeTruthy();
    expect(shell.getByText('1')).toBeTruthy();
    expect(shell.getByText('2')).toBeTruthy();
    expect(shell.getByLabelText(/^Today, Wednesday, 2 September/)).toBeTruthy();
  });

  test('a week inside one month says that month once', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    expect(await shell.findByText('August 2026')).toBeTruthy();
  });
});

describe('what a day is holding', () => {
  test('a written day carries its count; a blank day says so; a plan is not a wear', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // Written: two pieces went on the record that Monday.
    expect(await shell.findByLabelText('Monday, 17 August, 2 pieces on the record')).toBeTruthy();
    // Never written: a fact, not a failure, and never a scold.
    expect(shell.getByLabelText('Tuesday, 18 August, not logged')).toBeTruthy();
    // A PLAN WHOSE DAY HAS PASSED IS STILL A PLAN. If this ever reads
    // "1 piece on the record" the strip has started counting intentions.
    expect(shell.getByLabelText('Saturday, 15 August, planned')).toBeTruthy();
  });

  test('nothing on the strip states a streak, a run, or a score', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    await shell.findByText('19');
    for (const word of [/streak/i, /in a row/i, /days logged/i, /\d\s*of\s*7/i]) {
      expect(shell.queryByText(word)).toBeNull();
    }
  });
});

describe('the doors the strip opens', () => {
  test('a past day opens the calendar focused on that day', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    fireEvent.press(await shell.findByLabelText('Monday, 17 August, 2 pieces on the record'));

    await waitFor(() => expect(shell.getPathname()).toBe('/calendar'));
    expect(shell.getSearchParams().day).toBe('2026-08-17');
  });

  test("the strip's header opens the month whole", async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    fireEvent.press(await shell.findByLabelText('Open the month, August 2026'));

    await waitFor(() => expect(shell.getPathname()).toBe('/calendar'));
    expect(shell.getSearchParams().day).toBeUndefined();
  });
});

describe('the strip never stands in front of the wall', () => {
  test("logging today is still two taps, and the hero button is still the way", async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // Tap one: the log opens. Tap two would be the piece, tap three the
    // confirm — the same two-tap wall Today has always had (the picker's
    // own confirm is the second tap of the pair the house counts).
    fireEvent.press(await shell.findByText("Log today's wear"));
    fireEvent.press(await shell.findByText('The white oxford'));
    fireEvent.press(shell.getByText('Log this'));

    expect(await shell.findByText('Logged. "The white oxford" worn 4 times.')).toBeTruthy();
    // And the day it landed on is today's local day, marked on the strip.
    await waitFor(() =>
      expect(shell.getByLabelText('Today, Wednesday, 19 August, 1 piece on the record')).toBeTruthy(),
    );
  });

  test('an empty closet gets the sentence that says where to start, not a strip', async () => {
    await seed(BARE);
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    expect(await shell.findByText('Nothing in the closet yet.')).toBeTruthy();
    expect(shell.queryByLabelText(/^Open the month/)).toBeNull();
    expect(shell.queryByText('19')).toBeNull();
  });
});
