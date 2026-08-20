/**
 * THE CALENDAR ROOM — /calendar, through the real router and the real
 * provider. Root layout, WardrobeProvider, the AsyncStorage adapter and
 * migrate-on-read included, so what is exercised is the shipped path.
 *
 * THE THREE CHECKS THIS ROOM EXISTS TO SURVIVE:
 *
 *  1. A PAST DAY LANDS ON THAT DAY. The date the sheet was opened for is the
 *     date that reaches logWear and the date that reaches the shelf. Every
 *     assertion about what was written reads the STORED DOCUMENT after the
 *     provider's settle window — a screen that looks right over state that
 *     never reached the disk is the failure this app cannot afford. A wear
 *     backfilled from last week also leaves the laundry bench alone, because
 *     it cannot know what the washing has done since.
 *  2. A PLAN IS NEVER A WEAR. A planned entry renders as a plan, is removed
 *     with the plan's own sentence, and moves no wear count on its way out.
 *  3. THE MONTH WALK IS CALENDAR-TRUE. February has 28 days in 2026 and no
 *     29th; stepping back from January lands in December of the year before,
 *     which is exactly what Date.setMonth arithmetic gets wrong.
 *
 * Only Date is faked (stress-time.test.ts's doNotFake list): timers,
 * promises and waitFor stay real, so the 250ms write window behaves as
 * shipped and the assertions can wait for it honestly.
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

import type { AppState } from '@almari/shared/types';

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

/** One written day, one plan still ahead of the clock, one bare wardrobe. */
const DOC = JSON.stringify({
  schemaVersion: 8,
  items: [
    piece('i-oxford', 'The white oxford', { wearCount: 3, lastWorn: '2026-08-17' }),
    piece('i-jeans', 'Indigo jeans', { category: 'bottoms', wearCount: 2, lastWorn: '2026-08-17' }),
  ],
  outfits: [],
  wearLogs: [
    { id: 'w-mon', date: '2026-08-17', itemIds: ['i-oxford', 'i-jeans'] },
    { id: 'w-ahead', date: '2026-08-25', itemIds: ['i-oxford'], planned: true },
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

/** What actually reached the shelf. */
async function stored(): Promise<AppState> {
  const raw = await storage.getItem(wardrobeKey(ACCOUNT.id));
  return JSON.parse(raw as string) as AppState;
}

beforeEach(async () => {
  await seed(DOC);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the month, as a page', () => {
  test('August 2026 prints thirty-one days and stops', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    expect(await shell.findByText('31')).toBeTruthy();
    expect(shell.getByText('1')).toBeTruthy();
    expect(shell.queryByText('32')).toBeNull();
    // Today is named, and it is the only cell that is.
    expect(shell.getByLabelText(/^Today, Wednesday, 19 August/)).toBeTruthy();
    expect(shell.getAllByLabelText(/^Today, /)).toHaveLength(1);
  });

  test('the written day carries its count and the empty ones say so', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    expect(await shell.findByLabelText('Monday, 17 August, 2 pieces on the record')).toBeTruthy();
    expect(shell.getByLabelText('Tuesday, 25 August, planned')).toBeTruthy();
    expect(shell.getByLabelText('Tuesday, 18 August, not logged')).toBeTruthy();
  });

  test('nothing on the page is a score, a streak, or a percentage', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });
    await shell.findByText('31');
    for (const word of [/streak/i, /in a row/i, /%/, /\d+\s*of\s*31/i, /missed/i]) {
      expect(shell.queryByText(word)).toBeNull();
    }
  });

  test('a month nobody wrote in is thirty-one blank days, not a reprimand', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    fireEvent.press(await shell.findByLabelText('Go to July 2026'));

    await waitFor(() => expect(shell.getAllByLabelText(/not logged$/)).toHaveLength(31));
    expect(shell.queryByLabelText(/on the record$/)).toBeNull();
    expect(shell.queryByText(/nothing logged this month/i)).toBeNull();
  });
});

describe('the month walk is calendar-true', () => {
  test('February 2026 ends on the 28th', async () => {
    fakeDateOnly(new Date(2026, 1, 10, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    expect(await shell.findByText('28')).toBeTruthy();
    expect(shell.queryByText('29')).toBeNull();
    expect(shell.queryByText('30')).toBeNull();
  });

  test('stepping back from January lands in December of the year before', async () => {
    fakeDateOnly(new Date(2026, 0, 15, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    fireEvent.press(await shell.findByLabelText('Go to December 2025'));

    // 31 December exists; and the walk offers November on the way back.
    await waitFor(() => expect(shell.getByLabelText(/^Wednesday, 31 December/)).toBeTruthy());
    expect(shell.getByLabelText('Go to November 2025')).toBeTruthy();
    expect(shell.getByLabelText('Go to January 2026')).toBeTruthy();
  });

  test('stepping forward from the 31st does not skip the short month', async () => {
    // The Date.setMonth trap: 31 August + 1 month is 1 October. The page must
    // walk August to September, and September must be thirty days.
    fakeDateOnly(new Date(2026, 7, 31, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    fireEvent.press(await shell.findByLabelText('Go to September 2026'));

    await waitFor(() => expect(shell.getByLabelText(/^Wednesday, 30 September/)).toBeTruthy());
    expect(shell.queryByText('31')).toBeNull();
  });

  test('the walk finds its way home', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    // Standing on this month, the page states it rather than offering a door
    // to where you already are.
    expect(await shell.findByText('This month')).toBeTruthy();
    expect(shell.queryByLabelText('Back to August 2026')).toBeNull();

    fireEvent.press(shell.getByLabelText('Go to July 2026'));
    await waitFor(() => expect(shell.getByLabelText('Back to August 2026')).toBeTruthy());

    fireEvent.press(shell.getByLabelText('Back to August 2026'));
    await waitFor(() => expect(shell.getByLabelText(/^Today, Wednesday, 19 August/)).toBeTruthy());
  });
});

describe("a day's page", () => {
  test('a deep link opens the month it is in, with that day open', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar?day=2026-08-12' });

    expect(await shell.findByText('Wednesday, 12 August')).toBeTruthy();
    // Never written, and the page says only that.
    expect(shell.getByText('Not logged')).toBeTruthy();
    expect(shell.getByText('Log a wear for this day')).toBeTruthy();
  });

  test('a past day can be written, and it lands on that day', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar?day=2026-08-12' });

    // Three taps from the strip: the day (spent arriving here), the piece,
    // the confirm.
    fireEvent.press(await shell.findByText('The white oxford'));
    fireEvent.press(shell.getByText('Log this'));

    // The toast names the day, because a wear you cannot place is a wear you
    // will log a second time.
    expect(await shell.findByText('Logged for 12 Aug. "The white oxford" worn 4 times.')).toBeTruthy();

    await waitFor(async () => {
      const doc = await stored();
      const written = doc.wearLogs.find(l => l.date === '2026-08-12');
      expect(written).toBeTruthy();
      expect(written!.itemIds).toEqual(['i-oxford']);
      // Not a plan: a remembered wear is a wear.
      expect(written!.planned).toBeUndefined();
      const item = doc.items.find(i => i.id === 'i-oxford');
      expect(item!.wearCount).toBe(4);
      // lastWorn FOLLOWS THE NEWEST WEAR AND NEVER WALKS BACKWARDS. The
      // piece was last worn on the 17th; remembering the 12th afterwards
      // must not make it look neglected for five days it was not.
      expect(item!.lastWorn).toBe('2026-08-17');
      // THE BENCH IS ABOUT NOW. A wear backfilled from last week cannot know
      // what the laundry has done since, so it leaves the status alone.
      expect(item!.laundryStatus).toBe('clean');
    });
  });

  test('a written day shows what was on it, and the undo takes it off', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar?day=2026-08-17' });

    expect(await shell.findByText('Monday, 17 August')).toBeTruthy();
    expect(shell.getByText('The white oxford + Indigo jeans')).toBeTruthy();
    expect(shell.getByText('2 pieces')).toBeTruthy();

    fireEvent.press(shell.getByText('Undo'));
    expect(await shell.findByText('Undone. That wear is off the record.')).toBeTruthy();

    await waitFor(async () => {
      const doc = await stored();
      expect(doc.wearLogs.some(l => l.id === 'w-mon')).toBe(false);
      expect(doc.items.find(i => i.id === 'i-oxford')!.wearCount).toBe(2);
    });
  });
});

describe('a plan is never a wear', () => {
  test('a day still ahead shows its plan and refuses to write one', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar?day=2026-08-25' });

    expect(await shell.findByText('Tuesday, 25 August')).toBeTruthy();
    expect(shell.getByText('Down for this day')).toBeTruthy();
    expect(shell.getByText('Planned')).toBeTruthy();
    // No picker on a day that has not happened.
    expect(shell.queryByText('Log a wear for this day')).toBeNull();
    expect(shell.queryByText('Log this')).toBeNull();
  });

  test("removing a plan carries the plan's own sentence and moves no count", async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar?day=2026-08-25' });

    fireEvent.press(await shell.findByText('Remove'));
    expect(await shell.findByText('Removed. That plan is off the page.')).toBeTruthy();

    await waitFor(async () => {
      const doc = await stored();
      expect(doc.wearLogs.some(l => l.id === 'w-ahead')).toBe(false);
      // The plan never moved a count on the way in, so it moves none on the
      // way out. Three, exactly as it was seeded.
      expect(doc.items.find(i => i.id === 'i-oxford')!.wearCount).toBe(3);
    });
  });
});

describe('the room keeps its doors', () => {
  test('back returns to Today', async () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    fireEvent.press(await shell.findByLabelText('Open the month, August 2026'));
    await waitFor(() => expect(shell.getPathname()).toBe('/calendar'));

    fireEvent.press(shell.getByText('Back to today'));
    await waitFor(() => expect(shell.getPathname()).toBe('/'));
  });

  test('cold-opened with no wardrobe, the month sends you to the door', async () => {
    await AsyncStorage.clear();
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    await waitFor(() => expect(shell.getPathname()).toBe('/open'));
  });

  test('an empty wardrobe is invited, never scolded', async () => {
    await seed(BARE);
    fakeDateOnly(new Date(2026, 7, 19, 12, 0));
    const shell = renderRouter('./src/app', { initialUrl: '/calendar' });

    expect(await shell.findByText('The month is still blank.')).toBeTruthy();
    expect(shell.getByText('Open the closet')).toBeTruthy();
    expect(shell.queryByLabelText(/not logged$/)).toBeNull();
  });
});
