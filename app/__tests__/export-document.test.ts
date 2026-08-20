/**
 * THE BACKUP FILE — what it contains, what it must never contain, and that it
 * still opens on the web.
 *
 * The native half of scripts/test-export.mjs. The web's suite proves the
 * allowlist for the browser; this one proves the SAME allowlist here, plus the
 * two things only a phone has to answer for:
 *
 *   1. photographs live on disk here and must be INSIDE the file by the time
 *      it leaves (owner decision; AppState.photoEncoding is the field that
 *      makes the difference sayable), and
 *   2. the file is written and handed over by expo-file-system + expo-sharing,
 *      and comes back through expo-document-picker — none of which the web has.
 *
 * The fixture is built from __tests__/fixtures/v7-wardrobe.json, so what is
 * under test is a real stored shape and not a shape invented to pass.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'fs';
import { join } from 'path';

import { migrate } from '@almari/shared/migrate';
import { SCHEMA_VERSION, type AppState } from '@almari/shared/types';

const shareCalls: { url: string; options: unknown }[] = [];
const sharing = { available: true, throws: false };

jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => sharing.available,
  shareAsync: async (url: string, options: unknown) => {
    if (sharing.throws) throw new Error('no activity found');
    shareCalls.push({ url, options });
  },
}));

const picker: { result: unknown } = { result: { canceled: true, assets: null } };

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => picker.result,
}));

jest.mock('../src/lib/supabase', () => ({
  getSupabase: () => {
    throw new Error('the wire is not part of this suite');
  },
}));

import { File, Paths } from 'expo-file-system';

import {
  buildExportDoc,
  commitImport,
  countRecords,
  EXPORTED_KEYS,
  exportBackup,
  exportDocText,
  exportFileName,
  inlinePhotos,
  isBackupShaped,
  pickBackup,
  readBackupText,
  readExportDoc,
  readWholeDocument,
  withLiveRecord,
} from '../src/lib/exportClient';
import { SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';
import { onSyncAdopted } from '../src/lib/sync';

const STAMP = '2026-08-20T09:00:00.000Z';
const DAY = '2026-08-20';

const V7 = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'v7-wardrobe.json'), 'utf8'),
) as unknown;

/** The stored v7 wardrobe, brought forward — a real shape, not an invented one. */
function fixture(): AppState {
  return migrate(V7);
}

/** A one-pixel PNG, so the bytes that come back out are checkable. */
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Put a photograph on disk where a stored path would find it. */
function writePhoto(relativePath: string, base64 = PIXEL_PNG_BASE64): void {
  const file = new File(Paths.document, relativePath);
  file.create({ overwrite: true, intermediates: true });
  file.write(base64, { encoding: 'base64' });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  shareCalls.length = 0;
  sharing.available = true;
  sharing.throws = false;
  picker.result = { canceled: true, assets: null };
});

/* ==================== the allowlist ==================== */

describe('the allowlist is the whole document, and nothing else is', () => {
  /**
   * Deep-equal against a literal written out by hand — the same literal as
   * scripts/test-export.mjs PINNED. A field can no longer arrive in, or vanish
   * from, a backup without somebody deliberately editing both lists.
   */
  test('the pinned list matches the web, name for name and in order', () => {
    expect([...EXPORTED_KEYS]).toEqual([
      'schemaVersion',
      'items',
      'outfits',
      'wearLogs',
      'wishlist',
      'circle',
      'events',
      'furniture',
      'settings',
      'photoEncoding',
    ]);
  });

  test('a provider value exports its record and none of its furniture of its own', () => {
    const state = fixture();
    // The shape the screen actually holds: the state spread flat, plus the
    // callbacks, plus the values the provider computes.
    const providerValue = {
      ...state,
      activeItems: state.items,
      packedItemIds: new Set(['a']),
      addItem: () => undefined,
      logWear: () => undefined,
      startSample: async () => undefined,
    };

    const doc = buildExportDoc(providerValue, STAMP);

    expect(Object.keys(doc).sort()).toEqual(
      [...EXPORTED_KEYS.filter(k => k in state), 'exportedAt', 'someFutureKey'].sort(),
    );
    expect('activeItems' in doc).toBe(false);
    expect('packedItemIds' in doc).toBe(false);
    expect('addItem' in doc).toBe(false);
    expect('logWear' in doc).toBe(false);
    expect('startSample' in doc).toBe(false);
  });

  test('a Set, a Map or a Date can never serialise into the file as {}', () => {
    const state = fixture();
    const doc = buildExportDoc(
      {
        ...state,
        someFutureSet: new Set(['x']),
        someFutureMap: new Map([['k', 'v']]),
        whenever: new Date(0),
      },
      STAMP,
    );
    expect('someFutureSet' in doc).toBe(false);
    expect('someFutureMap' in doc).toBe(false);
    expect('whenever' in doc).toBe(false);
    expect(/:\s*\{\}/.test(exportDocText(state, STAMP))).toBe(false);
  });

  test('the stamps are this build, never whatever the source was holding', () => {
    const state = fixture();
    expect(buildExportDoc({ ...state, schemaVersion: 2 }, STAMP).schemaVersion).toBe(SCHEMA_VERSION);
    expect(buildExportDoc({ ...state, exportedAt: 'stale' }, STAMP).exportedAt).toBe(STAMP);
  });
});

/* ==================== photographs ==================== */

describe('photographs are files at rest and pictures in the file', () => {
  test('every stored path is read back inline and the document says so', async () => {
    writePhoto('photos/a.png');
    writePhoto('photos/c.jpg');
    const state: AppState = {
      ...fixture(),
      photoEncoding: 'file',
    };
    state.items = state.items.map(item =>
      item.id === 'a'
        ? { ...item, imageUrl: 'photos/a.png' }
        : item.id === 'c'
          ? { ...item, imageUrl: 'photos/c.jpg' }
          : item,
    );

    const report = await inlinePhotos(state);

    expect(report.inlined).toBe(2);
    expect(report.missing).toBe(0);
    const a = report.state.items.find(i => i.id === 'a');
    const c = report.state.items.find(i => i.id === 'c');
    expect(a?.imageUrl).toBe(`data:image/png;base64,${PIXEL_PNG_BASE64}`);
    // The media type comes from the extension, not from a single guess.
    expect(c?.imageUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    // Untouched pieces keep an empty photograph as an empty photograph.
    expect(report.state.items.find(i => i.id === 'd')?.imageUrl).toBe('');
  });

  test('the exported document is stamped inline even though the shelf says file', async () => {
    writePhoto('photos/a.png');
    const state: AppState = { ...fixture(), photoEncoding: 'file' };
    state.items = state.items.map(i => (i.id === 'a' ? { ...i, imageUrl: 'photos/a.png' } : i));

    const result = await exportBackup({ source: state, day: DAY, exportedAt: STAMP });
    expect(result.ok).toBe(true);

    const written = JSON.parse(new File(result.uri as string).textSync()) as Record<string, unknown>;
    expect(written.photoEncoding).toBe('inline');
    const items = written.items as { id: string; imageUrl: string }[];
    expect(items.find(i => i.id === 'a')?.imageUrl.startsWith('data:image/png;base64,')).toBe(true);
    // Nothing in the file still points at the disk it came off.
    expect(JSON.stringify(written).includes('photos/a.png')).toBe(false);
  });

  test('a photograph whose file is gone is said out loud, and costs the piece nothing else', async () => {
    const state: AppState = { ...fixture(), photoEncoding: 'file' };
    state.items = state.items.map(i => (i.id === 'a' ? { ...i, imageUrl: 'photos/vanished.png' } : i));

    const report = await inlinePhotos(state);

    expect(report.missing).toBe(1);
    expect(report.inlined).toBe(0);
    const a = report.state.items.find(i => i.id === 'a');
    expect(a?.imageUrl).toBe('');
    // The record of the piece survives the loss of its picture, in full.
    expect(a?.name).toBe('White Oxford');
    expect(a?.wearCount).toBe(14);
    expect(a?.place).toEqual({ furnitureId: 'f1', slotId: 's1' });
  });

  test('a photograph saved inside the settle window still travels as a picture', async () => {
    // The shelf has not caught up: the document still says 'inline' while the
    // record already holds an address. Trusting the declaration alone would
    // write a bare path into the backup and call it a photograph.
    writePhoto('photos/fresh.png');
    const state: AppState = { ...fixture(), photoEncoding: 'inline' };
    state.items = state.items.map(i => (i.id === 'a' ? { ...i, imageUrl: 'photos/fresh.png' } : i));

    const report = await inlinePhotos(state);

    expect(report.inlined).toBe(1);
    expect(report.state.items.find(i => i.id === 'a')?.imageUrl).toBe(
      `data:image/png;base64,${PIXEL_PNG_BASE64}`,
    );
  });

  test('a document that already says inline is never read off disk at all', async () => {
    const state: AppState = { ...fixture(), photoEncoding: 'inline' };
    state.items = state.items.map(i => (i.id === 'a' ? { ...i, imageUrl: 'data:image/png;base64,AA' } : i));
    const read = jest.fn(async () => 'data:image/png;base64,ZZ');

    const report = await inlinePhotos(state, read as never);

    expect(read).not.toHaveBeenCalled();
    expect(report.state).toBe(state);
    expect(report.inlined).toBe(0);
  });

  test('an export cannot be pointed at the rest of the sandbox', async () => {
    // lib/photos owns what a stored path may say, and refuses `..` in either
    // slash. The export path is the reason that rule exists, so it is asserted
    // from this side too: a hand-edited document must not turn a backup into a
    // way of reading the app sandbox out of the phone.
    const secret = new File(Paths.document, 'secrets.txt');
    secret.create({ overwrite: true, intermediates: true });
    secret.write('the refresh token');

    const state: AppState = { ...fixture(), photoEncoding: 'file' };
    state.items = state.items.map(i =>
      i.id === 'a' ? { ...i, imageUrl: 'photos/../secrets.txt' } : i,
    );

    const report = await inlinePhotos(state);

    expect(report.inlined).toBe(0);
    expect(report.missing).toBe(1);
    expect(report.state.items.find(i => i.id === 'a')?.imageUrl).toBe('');
    expect(JSON.stringify(report.state)).not.toContain('refresh token');
  });

  test('a document written by the web opens, exports, and keeps its pictures', async () => {
    // A wardrobe pulled down from the web app holds data URIs in a document
    // that still says 'file'. Nothing on disk answers for them, and they must
    // ride out untouched rather than count as swept.
    const state: AppState = { ...fixture(), photoEncoding: 'file' };
    state.items = state.items.map(i =>
      i.id === 'a' ? { ...i, imageUrl: `data:image/png;base64,${PIXEL_PNG_BASE64}` } : i,
    );

    const report = await inlinePhotos(state);

    expect(report.missing).toBe(0);
    expect(report.state.items.find(i => i.id === 'a')?.imageUrl).toBe(
      `data:image/png;base64,${PIXEL_PNG_BASE64}`,
    );
  });
});

/* ==================== lossless forever ==================== */

describe('the record leaves and returns whole', () => {
  test('migrate is a fixed point on its own output', () => {
    const state = fixture();
    expect(migrate(state)).toEqual(state);
  });

  test('an exported document round-trips through migrate with nothing lost', () => {
    const state = fixture();
    const back = readExportDoc(exportDocText(state, STAMP));
    expect(back).toEqual({ ...state, exportedAt: STAMP });
  });

  test('a key from a newer build survives the whole round trip', () => {
    const state = fixture();
    const back = readExportDoc(exportDocText(state, STAMP)) as unknown as Record<string, unknown>;
    expect(back.someFutureKey).toEqual({ keep: 'me' });
  });

  test('the wishlist, the circle and the events travel even though no screen holds them', async () => {
    const shelf = fixture();
    // Exactly what the screen does: the whole shelf under the live values.
    const source = withLiveRecord(shelf, {
      items: shelf.items,
      outfits: shelf.outfits,
      wearLogs: shelf.wearLogs,
      settings: shelf.settings,
      furniture: undefined,
    });
    const back = readExportDoc(exportDocText(source, STAMP));
    expect(back.wishlist).toHaveLength(1);
    expect(back.wishlist[0]?.name).toBe('Cardigan');
    expect(back.circle).toEqual(shelf.circle);
    expect(back.events).toEqual(shelf.events);
    expect(back.furniture).toHaveLength(2);
  });

  test('an edit the shelf has not caught up with is still in the file', () => {
    // The provider coalesces its writes over 250ms. Pressing Export inside that
    // window must not write the record as it was a moment ago.
    const shelf = fixture();
    const justWorn = shelf.items.map(i =>
      i.id === 'a' ? { ...i, wearCount: 15, lastWorn: '2026-08-20' } : i,
    );
    const source = withLiveRecord(shelf, { items: justWorn });
    const back = readExportDoc(exportDocText(source, STAMP));
    expect(back.items.find(i => i.id === 'a')?.wearCount).toBe(15);
    // and the fields the provider does not hold are still the shelf's.
    expect(back.wishlist).toHaveLength(1);
  });

  test('a shelf that will not parse opens as a fresh record rather than throwing', async () => {
    await storage.setItem(wardrobeKey('w-1'), '{ half a document');
    const shelf = await readWholeDocument('w-1');
    expect(shelf.items).toHaveLength(0);
    expect(shelf.schemaVersion).toBe(SCHEMA_VERSION);
    // And a wardrobe that was never written reads the same way.
    expect((await readWholeDocument('w-never')).items).toHaveLength(0);
  });

  test('an empty wardrobe still exports a document that reads back', () => {
    const empty = migrate(null);
    expect(readExportDoc(exportDocText(empty, STAMP)).items).toHaveLength(0);
  });

  test('the record count is the four the web counts', () => {
    const state = fixture();
    expect(countRecords(state)).toBe(
      state.items.length + state.outfits.length + state.wearLogs.length + state.wishlist.length,
    );
    expect(countRecords(state)).toBe(7);
  });
});

/* ==================== the name on the file ==================== */

describe('the file names itself for the wardrobe and the day', () => {
  test('with no name, the web filename verbatim', () => {
    expect(exportFileName('2026-08-20')).toBe('almari-backup-2026-08-20.json');
    expect(exportFileName('2026-08-20', null)).toBe('almari-backup-2026-08-20.json');
  });

  test('with a name, the name is in the file', () => {
    expect(exportFileName('2026-08-20', 'The weekday closet')).toBe(
      'almari-the-weekday-closet-2026-08-20.json',
    );
  });

  test('a name that slugs away to nothing still names a file', () => {
    expect(exportFileName('2026-08-20', '???')).toBe('almari-backup-2026-08-20.json');
    expect(exportFileName('2026-08-20', '   ')).toBe('almari-backup-2026-08-20.json');
  });
});

/* ==================== write, then hand it over ==================== */

describe('the file is written, then handed to the share sheet', () => {
  test('the exact file written is the exact file shared, as JSON', async () => {
    const result = await exportBackup({
      source: fixture(),
      wardrobeName: 'The weekday closet',
      day: DAY,
      exportedAt: STAMP,
    });

    expect(result.ok).toBe(true);
    expect(result.fileName).toBe('almari-the-weekday-closet-2026-08-20.json');
    expect(result.uri).toBe(`${Paths.cache.uri}almari-the-weekday-closet-2026-08-20.json`);
    expect(shareCalls).toHaveLength(1);
    expect(shareCalls[0].url).toBe(result.uri);
    expect(shareCalls[0].options).toMatchObject({ mimeType: 'application/json', UTI: 'public.json' });
    // What is on disk is the document, readable by hand and by the web.
    const text = new File(result.uri as string).textSync();
    expect(text.startsWith('{\n  "schemaVersion"')).toBe(true);
    expect(readExportDoc(text).items).toHaveLength(4);
  });

  test('exporting the same wardrobe twice in one day overwrites rather than failing', async () => {
    const first = await exportBackup({ source: fixture(), day: DAY, exportedAt: STAMP });
    const second = await exportBackup({ source: migrate(null), day: DAY, exportedAt: STAMP });
    expect(first.ok && second.ok).toBe(true);
    expect(second.uri).toBe(first.uri);
    expect(readExportDoc(new File(second.uri as string).textSync()).items).toHaveLength(0);
  });

  test('a phone with no share sheet is told about plainly, not crashed into', async () => {
    sharing.available = false;
    const result = await exportBackup({ source: fixture(), day: DAY, exportedAt: STAMP });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-share-sheet');
    expect(shareCalls).toHaveLength(0);
  });

  test('a share sheet that refuses the file is a reason, not an exception', async () => {
    sharing.throws = true;
    const result = await exportBackup({ source: fixture(), day: DAY, exportedAt: STAMP });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('share-failed');
  });

  test('a disk that will not take the write says so, and nothing is shared', async () => {
    const write = jest
      .spyOn(File.prototype, 'write')
      .mockImplementation(() => {
        throw new Error('No space left on device');
      });
    try {
      const result = await exportBackup({ source: fixture(), day: DAY, exportedAt: STAMP });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('write-failed');
      expect(result.uri).toBeNull();
      expect(shareCalls).toHaveLength(0);
    } finally {
      write.mockRestore();
    }
  });
});

/* ==================== coming back ==================== */

describe('a file that is not a backup is refused in a sentence', () => {
  test('text that is not JSON throws rather than importing nothing', () => {
    expect(() => readBackupText('not json at all')).toThrow();
  });

  test('JSON that is not a wardrobe is refused before migrate can flatten it', () => {
    // migrate() answers ANY object with a valid, EMPTY state. Left ungated,
    // this file would offer to replace a whole wardrobe with nothing.
    expect(isBackupShaped(JSON.parse('{"milk":true,"eggs":6}'))).toBe(false);
    expect(isBackupShaped(JSON.parse('[1,2,3]'))).toBe(false);
    expect(isBackupShaped(JSON.parse('"a string"'))).toBe(false);
    expect(isBackupShaped(JSON.parse('null'))).toBe(false);
    expect(() => readBackupText('{"milk":true,"eggs":6}')).toThrow();
  });

  test('a real backup is recognised by its version stamp or by its records', () => {
    expect(isBackupShaped(JSON.parse('{"schemaVersion":1}'))).toBe(true);
    // The bare pre-account blob the web once wrote has no version stamp.
    expect(isBackupShaped(JSON.parse('{"items":[]}'))).toBe(true);
  });

  test('a v7 export opens, brought forward, with every record on it', () => {
    const state = readBackupText(readFileSync(join(__dirname, 'fixtures', 'v7-wardrobe.json'), 'utf8'));
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.items).toHaveLength(4);
    expect(state.furniture).toHaveLength(2);
    expect((state as unknown as Record<string, unknown>).someFutureKey).toEqual({ keep: 'me' });
  });

  test('a refused file writes nothing at all to the shelf', async () => {
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'w-1' }));
    await storage.setItem(wardrobeKey('w-1'), JSON.stringify(fixture()));
    const before = await storage.getItem(wardrobeKey('w-1'));

    const junk = new File(Paths.cache, 'not-a-backup.json');
    junk.create({ overwrite: true });
    junk.write('{ this is not json');
    picker.result = {
      canceled: false,
      assets: [{ uri: junk.uri, name: 'not-a-backup.json', mimeType: 'application/json' }],
    };

    const picked = await pickBackup();

    expect(picked).toEqual({ ok: false, reason: 'unreadable' });
    expect(await storage.getItem(wardrobeKey('w-1'))).toBe(before);
  });

  test('a picker closed on purpose is a cancel, not a failure', async () => {
    picker.result = { canceled: true, assets: null };
    expect(await pickBackup()).toEqual({ ok: false, reason: 'cancelled' });
  });

  test('a chosen backup comes back migrated, with the name it was chosen by', async () => {
    const file = new File(Paths.cache, 'almari-backup-2026-08-19.json');
    file.create({ overwrite: true });
    file.write(exportDocText(fixture(), STAMP));
    picker.result = {
      canceled: false,
      assets: [{ uri: file.uri, name: 'almari-backup-2026-08-19.json', mimeType: 'application/json' }],
    };

    const picked = await pickBackup();

    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.fileName).toBe('almari-backup-2026-08-19.json');
    expect(picked.state.items).toHaveLength(4);
    expect(picked.state.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

/* ==================== putting it back ==================== */

describe('bringing a backup in replaces the record, or says why it did not', () => {
  test('the shelf takes the document and the provider is handed the same state', async () => {
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'w-1' }));
    await storage.setItem(wardrobeKey('w-1'), JSON.stringify(migrate(null)));
    const arriving = fixture();
    const replaceState = jest.fn();

    const outcome = await commitImport({ accountId: 'w-1', replaceState }, arriving);

    expect(outcome).toBe('replaced');
    expect(replaceState).toHaveBeenCalledWith(arriving);
    expect(await readWholeDocument('w-1')).toEqual(arriving);
  });

  test('without a provider replace, the open wardrobe is told the way a pull tells it', async () => {
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'w-1' }));
    const announced: string[] = [];
    const stop = onSyncAdopted(id => announced.push(id));
    try {
      const outcome = await commitImport({ accountId: 'w-1' }, fixture());
      expect(outcome).toBe('replaced');
      expect(announced).toEqual(['w-1']);
    } finally {
      stop();
    }
  });

  test('a device that will not take the write replaces nothing, and says so', async () => {
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'w-1' }));
    const before = JSON.stringify(migrate(null));
    await storage.setItem(wardrobeKey('w-1'), before);
    const replaceState = jest.fn();
    const setItem = jest
      .spyOn(storage, 'setItem')
      .mockRejectedValue(new Error('QuotaExceededError') as never);

    try {
      const outcome = await commitImport({ accountId: 'w-1', replaceState }, fixture());
      expect(outcome).toBe('storage-full');
      // The screen is never told a replacement happened that did not.
      expect(replaceState).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
    expect(await storage.getItem(wardrobeKey('w-1'))).toBe(before);
  });

  test('with no wardrobe open there is nowhere to put it, and nothing is written', async () => {
    const outcome = await commitImport({ accountId: null }, fixture());
    expect(outcome).toBe('nowhere');
    expect(await AsyncStorage.getAllKeys()).toHaveLength(0);
  });

  test('the whole document read back off the shelf is what was brought in', async () => {
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'w-1' }));
    const arriving = fixture();
    await commitImport({ accountId: 'w-1' }, arriving);
    const shelf = await readWholeDocument('w-1');
    expect(shelf.wishlist).toHaveLength(1);
    expect(shelf.furniture).toHaveLength(2);
    expect((shelf as unknown as Record<string, unknown>).someFutureKey).toEqual({ keep: 'me' });
  });
});
