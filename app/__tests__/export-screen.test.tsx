/**
 * SETTINGS, THE DATA CARD — the two presses a tester actually makes.
 *
 * export-document.test.ts holds the file to the web's allowlist. This one is
 * about the room: that Export puts a named file into the share sheet and says
 * what went, that Import states the exact counts and the plain fact that there
 * is no undo BEFORE anything is replaced, that a refused file gets a sentence
 * and never touches the shelf, and that a device which will not take the write
 * replaces nothing and says why.
 *
 * Every setting that was already on this screen is still asserted here, so the
 * export card cannot have been added by pushing something else off.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
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

const shareCalls: { url: string; options: unknown }[] = [];
const sharing = { available: true };

jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => sharing.available,
  shareAsync: async (url: string, options: unknown) => {
    shareCalls.push({ url, options });
  },
}));

const picker: { result: unknown } = { result: { canceled: true, assets: null } };

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => picker.result,
}));

import { File, Paths } from 'expo-file-system';

import { migrate } from '@almari/shared/migrate';

import { exportDocText, readExportDoc } from '../src/lib/exportClient';
import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

/**
 * A wardrobe with something to lose: two pieces, an outfit, a wear log and a
 * wishlist entry — five records, which is the number the card must show and
 * the number the confirm must name.
 */
const STORED = {
  schemaVersion: 8,
  items: [
    {
      id: 'a', name: 'White Oxford', category: 'tops', color: '#f5f0eb',
      season: ['spring'], occasion: ['work'], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 14, cost: 68, favorite: true, laundryStatus: 'clean',
    },
    {
      id: 'c', name: 'Overcoat', category: 'outerwear', color: '#3a362e',
      season: ['winter'], occasion: ['work'], imageUrl: '', dateAdded: '2026-01-15',
      wearCount: 4, cost: 420, favorite: false, laundryStatus: 'clean',
    },
  ],
  outfits: [
    { id: 'o1', name: 'Monday', itemIds: ['a'], favorite: true, dateCreated: '2026-03-01', wearCount: 3 },
  ],
  wearLogs: [{ id: 'l1', date: '2026-08-01', itemIds: ['a'] }],
  wishlist: [
    {
      id: 'w1', name: 'Cardigan', category: 'tops', color: '#d4a574',
      priority: 'high', dateAdded: '2026-07-01', status: 'waiting', price: 88,
    },
  ],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [],
  photoEncoding: 'inline',
  settings: { categories: [{ id: 'tops', label: 'Tops' }], occasions: ['work'] },
};

const ROW = {
  id: 'acct-1',
  name: 'The weekday closet',
  handle: '@weekday',
  monogram: 'W',
  color: 'var(--color-accent)',
  createdAt: '2026-08-01',
};

async function seed(doc: unknown = STORED) {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: ROW.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ROW]));
  await storage.setItem(wardrobeKey(ROW.id), JSON.stringify(doc));
}

beforeEach(async () => {
  // A toast is module state that outlives a render, and it stands for four
  // seconds. Under fake timers each test can retire its own before the next
  // one starts, so "no sentence was said" is a claim about THIS test.
  jest.useFakeTimers();
  await AsyncStorage.clear();
  mockAuth.user = null;
  mockAuth.listeners = [];
  shareCalls.length = 0;
  sharing.available = true;
  picker.result = { canceled: true, assets: null };
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('the data card sits on the settings screen without displacing anything', () => {
  test('the account and the sync choice are still here, and so is the export card', async () => {
    await seed();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    // What was on this screen before this wave.
    expect(await shell.findByText('The account')).toBeTruthy();
    expect(shell.getByText('Where the record lives')).toBeTruthy();
    expect(shell.getByText('On this device')).toBeTruthy();
    expect(shell.getByText('Synced to my account')).toBeTruthy();
    expect(shell.getByText('Back to the house')).toBeTruthy();

    // What this wave adds.
    expect(shell.getByText('Your data')).toBeTruthy();
    expect(shell.getByLabelText('Export a backup')).toBeTruthy();
    expect(shell.getByLabelText('Choose a file')).toBeTruthy();
    // Wave 7: the placeholder promise was kept — the room section stands
    // where "Theme and storage will live here." used to point.
    expect(shell.getByText('The room')).toBeTruthy();
  });

  test('the count names all four kinds of record, wishlist included', async () => {
    await seed();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    // 2 pieces + 1 outfit + 1 wear log + 1 wishlist entry, and the wishlist is
    // the one no screen on this phone can see.
    expect(await shell.findByText('5 records')).toBeTruthy();
  });
});

describe('export — a named file, into the share sheet, and a word about it', () => {
  test('the file carries the wardrobe name and the whole record, and the toast counts it', async () => {
    await seed();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Export a backup'));

    await waitFor(() => expect(shareCalls).toHaveLength(1));
    expect(shareCalls[0].url.endsWith('.json')).toBe(true);
    expect(shareCalls[0].url).toContain('almari-the-weekday-closet-');

    const state = readExportDoc(new File(shareCalls[0].url).textSync());
    expect(state.items).toHaveLength(2);
    expect(state.outfits).toHaveLength(1);
    expect(state.wearLogs).toHaveLength(1);
    // The wishlist has no screen on this phone and still leaves in the file.
    expect(state.wishlist).toHaveLength(1);

    expect(await shell.findByText('Exported. 5 records in one file.')).toBeTruthy();
  });

  test('a phone with nowhere to send a file is told so, calmly', async () => {
    sharing.available = false;
    await seed();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Export a backup'));

    expect(
      await shell.findByText('This phone offers nowhere to send a file, so the backup has no way out of it.'),
    ).toBeTruthy();
    expect(shareCalls).toHaveLength(0);
  });
});

describe('import — the counts, then the confirm, then the record', () => {
  /** A backup of somebody else's wardrobe, sitting where a picker would find it. */
  function stageBackup(name = 'almari-backup-2026-08-19.json') {
    const arriving = migrate({
      ...STORED,
      items: [STORED.items[0]],
      outfits: [],
      wearLogs: [],
      wishlist: [],
    });
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(exportDocText(arriving, '2026-08-19T09:00:00.000Z'));
    picker.result = {
      canceled: false,
      assets: [{ uri: file.uri, name, mimeType: 'application/json' }],
    };
    return file;
  }

  test('the confirm states what arrives, what goes, and that there is no undo', async () => {
    await seed();
    stageBackup();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));

    expect(await shell.findByText('Bring in this backup')).toBeTruthy();
    const body = await shell.findByText(/That file holds/);
    const said = String(body.props.children);
    // The name of the file being brought in.
    expect(said).toContain('almari-backup-2026-08-19.json');
    // Exactly what arrives.
    expect(said).toContain('That file holds 1 pieces, 0 outfits, 0 wear logs and 0 wishlist entries.');
    // Exactly what goes, and the plain fact about it.
    expect(said).toContain('replaces the 5 records on this device now');
    expect(said).toContain('There is no undo, and no other copy of them unless you exported one.');

    // Nothing has been replaced by merely being asked about.
    expect(JSON.parse((await storage.getItem(wardrobeKey(ROW.id))) as string).items).toHaveLength(2);
  });

  test('bringing it in replaces the record on the shelf and says what landed', async () => {
    await seed();
    stageBackup();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));
    fireEvent.press(await shell.findByLabelText('Bring it in'));

    expect(await shell.findByText('Imported. 1 pieces on record.')).toBeTruthy();
    await waitFor(async () => {
      const shelf = JSON.parse((await storage.getItem(wardrobeKey(ROW.id))) as string) as {
        items: unknown[];
        wearLogs: unknown[];
      };
      expect(shelf.items).toHaveLength(1);
      expect(shelf.wearLogs).toHaveLength(0);
    });
    // And the OPEN wardrobe adopted it — the screen is not still reading the
    // record that was replaced underneath it. Five records became one.
    expect(await shell.findByText('1 records')).toBeTruthy();
    expect(shell.queryByText('5 records')).toBeNull();
  });

  test('cancelling the confirm leaves every record exactly where it was', async () => {
    await seed();
    stageBackup();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));
    fireEvent.press(await shell.findByLabelText('Cancel'));

    await waitFor(() => expect(shell.queryByText('Bring in this backup')).toBeNull());
    expect(JSON.parse((await storage.getItem(wardrobeKey(ROW.id))) as string).items).toHaveLength(2);
  });

  test('a file that is not a backup gets one calm sentence and no confirm', async () => {
    await seed();
    const junk = new File(Paths.cache, 'holiday-photos.json');
    junk.create({ overwrite: true });
    junk.write('{ not json at all');
    picker.result = {
      canceled: false,
      assets: [{ uri: junk.uri, name: 'holiday-photos.json', mimeType: 'application/json' }],
    };

    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));

    expect(await shell.findByText('That file did not read as a backup.')).toBeTruthy();
    expect(shell.queryByText('Bring in this backup')).toBeNull();
    expect(JSON.parse((await storage.getItem(wardrobeKey(ROW.id))) as string).items).toHaveLength(2);
  });

  test('a shopping list is refused too, rather than offered as an empty wardrobe', async () => {
    await seed();
    const junk = new File(Paths.cache, 'shopping.json');
    junk.create({ overwrite: true });
    junk.write('{"milk":true,"eggs":6}');
    picker.result = {
      canceled: false,
      assets: [{ uri: junk.uri, name: 'shopping.json', mimeType: 'application/json' }],
    };

    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));

    expect(await shell.findByText('That file did not read as a backup.')).toBeTruthy();
    expect(shell.queryByText('Bring in this backup')).toBeNull();
  });

  test('closing the picker without choosing says nothing at all', async () => {
    await seed();
    picker.result = { canceled: true, assets: null };
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));

    await waitFor(() => expect(shell.queryByText('Bring in this backup')).toBeNull());
    expect(shell.queryByText('That file did not read as a backup.')).toBeNull();
  });

  test('a device that will not take the write replaces nothing, and says why', async () => {
    await seed();
    stageBackup();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    fireEvent.press(await shell.findByLabelText('Choose a file'));
    await shell.findByText('Bring in this backup');

    const setItem = jest
      .spyOn(storage, 'setItem')
      .mockRejectedValue(new Error('QuotaExceededError') as never);
    try {
      fireEvent.press(shell.getByLabelText('Bring it in'));
      expect(
        await shell.findByText(
          'This device would not take the write — its storage is full. Nothing was replaced. Remove a few photographs, then bring the backup in again.',
        ),
      ).toBeTruthy();
    } finally {
      setItem.mockRestore();
    }
    expect(JSON.parse((await storage.getItem(wardrobeKey(ROW.id))) as string).items).toHaveLength(2);
  });
});
