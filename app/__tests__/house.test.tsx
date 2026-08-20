/**
 * THE HOUSE — the hall at /profile (docs/42 §4).
 *
 * What this suite is really holding the screen to is the ruling's two hard
 * rules, because both are the kind that rot quietly:
 *
 *   DOORS ONLY FOR ROOMS WHOSE PORTS EXIST. The Ledger, the buying table and
 *   the Shared rail have no native screens yet, so no row may name them — a
 *   door onto a room that is not built is the plaque the ruling forbids,
 *   pointed inward. Their FACTS are still stated; only the doors wait.
 *
 *   A PLATE WITH NOTHING TO SAY SAYS NOTHING. Cumulative totals about the
 *   clothes and nothing else: no rate, no delta, no streak, no comparison,
 *   and no zeros dressed up as prompts (brand law 11). An empty wardrobe's
 *   House is quiet rather than encouraging.
 *
 * The tag-portrait and the long-pressed slot are the two ways into the
 * switcher, and both are asserted — the gesture is Instagram's, translated,
 * and a gesture nobody can find is not a feature.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
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

const ROW = {
  id: 'acct-1',
  name: 'The weekday closet',
  handle: '@weekday',
  monogram: 'W',
  color: '#105F7D',
  createdAt: '2026-03-14',
};

const OTHER = {
  id: 'acct-2',
  name: "Priya's wardrobe",
  handle: '@priya',
  monogram: 'P',
  color: '#8A1F2B',
  createdAt: '2026-05-02',
};

const piece = (id: string, wearCount: number, cost?: number) => ({
  id,
  name: `Piece ${id}`,
  category: 'tops',
  color: '#D9C4A3',
  season: [],
  occasion: [],
  imageUrl: '',
  dateAdded: '2026-06-01',
  wearCount,
  favorite: false,
  laundryStatus: 'clean',
  ...(cost === undefined ? {} : { cost }),
});

async function seed({
  rows = [ROW],
  doc,
}: {
  rows?: Record<string, unknown>[];
  doc: Record<string, unknown>;
}) {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(rows));
  await storage.setItem(wardrobeKey('acct-1'), JSON.stringify(doc));
}

const STOCKED = {
  schemaVersion: 8,
  items: [piece('i1', 3, 2000), piece('i2', 2, 1500)],
  outfits: [{ id: 'o1', name: 'The weekday two', itemIds: ['i1', 'i2'], wearCount: 0 }],
  wearLogs: [],
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('the nameplate', () => {
  test('names the wardrobe, dates it, and says where it is kept', async () => {
    await seed({ doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });

    expect(await shell.findByText('The House')).toBeTruthy();
    expect(shell.getByText('The weekday closet')).toBeTruthy();
    // A DATE, never a streak: the month the record opened, and that is all.
    expect(shell.getByText('Kept since MARCH 2026')).toBeTruthy();
    // Signed out is a fact, not a lack — and it is the true one.
    expect(shell.getByText('Kept on this phone.')).toBeTruthy();
  });

  test('nothing on this hall counts anything but the clothes', async () => {
    await seed({ doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    for (const banned of [
      /streak/i,
      /\bper (day|week|month)\b/i,
      /\bmore than\b/i,
      /\bless than\b/i,
      /this week/i,
      /\bgoal\b/i,
      /\bkeep it up\b/i,
    ]) {
      expect(shell.queryByText(banned)).toBeNull();
    }
  });
});

describe('the four factual plates', () => {
  test('state the cumulative totals, and the money in rupees', async () => {
    await seed({ doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    expect(shell.getByText('Pieces on the rail')).toBeTruthy();
    expect(shell.getByText('2')).toBeTruthy();
    expect(shell.getByText('Wears noted')).toBeTruthy();
    expect(shell.getByText('5')).toBeTruthy();
    expect(shell.getByText('Outfits kept')).toBeTruthy();
    expect(shell.getByText('1')).toBeTruthy();
    // Through the shared formatter, en-IN grouping and all.
    expect(shell.getByText('What it cost')).toBeTruthy();
    expect(shell.getByText('₹3,500')).toBeTruthy();
  });

  test('an empty wardrobe gets a quiet House, not four zeros', async () => {
    await seed({ doc: { schemaVersion: 8, items: [], outfits: [], wearLogs: [] } });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    // A plate with nothing to say says nothing — no zeros dressed as prompts.
    for (const label of ['Pieces on the rail', 'Wears noted', 'Outfits kept', 'What it cost']) {
      expect(shell.queryByText(label)).toBeNull();
    }
    expect(shell.queryByText('0')).toBeNull();
    // The hall itself is still a hall: the nameplate and the doors stand.
    expect(shell.getByText('The weekday closet')).toBeTruthy();
    expect(shell.getByText('Open another')).toBeTruthy();
  });

  test('a wardrobe with pieces but no prices says three facts, not four', async () => {
    await seed({
      doc: { schemaVersion: 8, items: [piece('i1', 1)], outfits: [], wearLogs: [] },
    });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    expect(shell.getByText('Pieces on the rail')).toBeTruthy();
    expect(shell.getByText('Wears noted')).toBeTruthy();
    // Nobody said what anything cost, so the House does not answer for it.
    expect(shell.queryByText('What it cost')).toBeNull();
    expect(shell.queryByText('Outfits kept')).toBeNull();
  });
});

describe('doors only for rooms whose ports exist', () => {
  test('no row names a room this app has not built', async () => {
    await seed({ doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    // The floor-plan order of record holds these seats; none may be drawn
    // until its native screen lands (docs/42 §4). Wave 7 built the Ledger,
    // the Wishlist and the export port, so those three doors now STAND — the
    // positive half asserts them, and the unbuilt list keeps shrinking as
    // rooms land, never the other way.
    expect(shell.getByText(/open the ledger/i)).toBeTruthy();
    expect(shell.getByText(/the wishlist/i)).toBeTruthy();
    expect(shell.getByText(/export the record/i)).toBeTruthy();
    // "The buying table" now stands as a heading over the Wishlist's real
    // door, so it left the unbuilt list; Before you buy itself still has no
    // port and keeps no row.
    expect(shell.getByText(/the buying table/i)).toBeTruthy();
    for (const unbuilt of [
      /before you buy/i,
      /shared rail/i,
    ]) {
      expect(shell.queryByText(unbuilt)).toBeNull();
    }
  });

  test('LOOKS YOU HAVE SHARED is absent in alpha, not empty', async () => {
    await seed({ doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    for (const banned of [/looks you have shared/i, /on show/i, /what you are showing/i]) {
      expect(shell.queryByText(banned)).toBeNull();
    }
  });

  test('the rooms that DO exist carry their doors', async () => {
    await seed({ doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    // The room, stated as a fact — the change is web work still.
    expect(shell.getByText('The dye house — the default room')).toBeTruthy();
    // The record, and its door to the sheet that holds the account row.
    expect(shell.getByText('This wardrobe stays on this device.')).toBeTruthy();

    fireEvent.press(shell.getByLabelText('This wardrobe stays on this device.'));
    await waitFor(() => expect(shell.getPathname()).toBe('/settings'));
  });

  test('the door to another wardrobe is the door, and it opens', async () => {
    await seed({ rows: [ROW, OTHER], doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    // The other record on this device is NAMED — that is a fact this phone
    // holds — while opening one stays the door's own work.
    expect(await shell.findByText("Priya's wardrobe")).toBeTruthy();

    fireEvent.press(shell.getAllByLabelText('Open another')[0]);
    await waitFor(() => expect(shell.getPathname()).toBe('/open'));
  });
});

describe('the switcher', () => {
  test('the tag-portrait opens it, and it lists the wardrobes on this device', async () => {
    await seed({ rows: [ROW, OTHER], doc: STOCKED });
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    await shell.findByText('The House');

    expect(shell.queryByText('Open now')).toBeNull();
    fireEvent.press(shell.getByLabelText('Switch wardrobes'));

    // Grab handle, tag rows, "Open another" — and the open one marked.
    expect(await shell.findByText('Open now')).toBeTruthy();
    expect(shell.getAllByText('The weekday closet').length).toBeGreaterThan(1);
    expect(shell.getAllByText("Priya's wardrobe").length).toBeGreaterThan(1);
  });
});
