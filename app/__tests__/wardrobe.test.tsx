/**
 * The wardrobe provider — migrate on read, the dates law, and the
 * persistence round-trip.
 *
 * Mirrors, case for case:
 *  - scripts/test-migrate.mjs — the fixtures in __tests__/fixtures are cut
 *    from its corpus (the v1 bare blob; a v7 export with the string-cost,
 *    zero-cost, furniture-form and unknown-key cases). What that suite
 *    proves about migrate() in node, this suite proves about the provider
 *    actually calling it on every read.
 *  - scripts/test-dates.mjs — the toISOString day-shift case: a wear
 *    logged at 23:30 local carries the LOCAL day, and a plan (future date)
 *    never moves a count.
 *
 * The storage adapter is the real one over the AsyncStorage jest mock, so
 * add → debounce → flush → reload is a genuine round-trip, not a stub.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ACCOUNTS_KEY,
  LEGACY_KEY,
  SESSION_KEY,
  storage,
  wardrobeKey,
} from '../src/lib/storage';
import { useWardrobe, WardrobeProvider } from '../src/lib/wardrobe';

const V7_DOC = readFileSync(join(__dirname, 'fixtures', 'v7-wardrobe.json'), 'utf8');
const BARE_DOC = readFileSync(join(__dirname, 'fixtures', 'bare-blob.json'), 'utf8');

type Ctx = ReturnType<typeof useWardrobe>;
let ctx: Ctx | null = null;

function Probe() {
  ctx = useWardrobe();
  return null;
}

async function openWardrobe() {
  const view = render(
    <WardrobeProvider>
      <Probe />
    </WardrobeProvider>,
  );
  await waitFor(() => expect(ctx?.status).not.toBe('loading'));
  return view;
}

async function seed(doc: string, id = 'acct-1') {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: id }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id, name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey(id), doc);
}

beforeEach(async () => {
  ctx = null;
  await AsyncStorage.clear();
});

describe('migrate on read — the seam is closed (mirrors scripts/test-migrate.mjs)', () => {
  test('a real v7 export opens correctly', async () => {
    await seed(V7_DOC);
    await openWardrobe();

    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(4);
    // Losslessness is read strictly: a numeric string is parsed, not thrown away.
    expect(ctx!.items.find(i => i.id === 'c')!.cost).toBe(420);
    expect(ctx!.items.find(i => i.id === 'd')!.cost).toBeUndefined();
    // A recorded 0 is a real answer (inherited, gifted) and survives untouched.
    expect(ctx!.items.find(i => i.id === 'e')!.cost).toBe(0);
    // The filing survives, even into a build that has no furniture screen yet.
    expect(ctx!.items.find(i => i.id === 'a')!.place).toEqual({ furnitureId: 'f1', slotId: 's1' });
    expect(ctx!.wearLogs).toHaveLength(1);
  });

  test('a v7 document round-trips losslessly through an edit and a write', async () => {
    await seed(V7_DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['a']);
    });

    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(raw).not.toBeNull();
      const doc = JSON.parse(raw as string);
      // Migrated forward on read, stamped on write.
      expect(doc.schemaVersion).toBe(8);
      // v8 seeds the photograph declaration; a web export is always inline.
      expect(doc.photoEncoding).toBe('inline');
      // Unknown keys are preserved verbatim — lossless forever.
      expect(doc.someFutureKey).toEqual({ keep: 'me' });
      // The v7 furniture — forms, the carved treatment, the packed slot,
      // the unknown fields on a newer build's rows — all still aboard.
      expect(doc.furniture).toHaveLength(2);
      expect(doc.furniture[0].form).toBe('almirah-fitted');
      expect(doc.furniture[0].ornament).toBe('mughal');
      expect(doc.furniture[0].slots[1].packed).toBe(true);
      expect(doc.furniture[1].roomId).toBe('attic');
      expect(doc.furniture[1].slots[0].depth).toBe('deep');
    });
  });

  test('the bare pre-account blob opens, and its stray category is adopted', async () => {
    await seed(BARE_DOC);
    await openWardrobe();

    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(2);
    expect(ctx!.items[0].wearCount).toBe(14);
    // An item's unknown category never orphans the piece — settings adopt it.
    expect(ctx!.settings.categories.some(c => c.id === 'skirts-custom')).toBe(true);
  });

  test('a legacy closet at the bare key is adopted, never orphaned', async () => {
    // No session, no registry — just the pre-accounts document, exactly what
    // src/lib/accounts.ts adoptLegacyWardrobe() handles on the web.
    await storage.setItem(LEGACY_KEY, BARE_DOC);
    await openWardrobe();

    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(2);
    await expect(storage.getItem(LEGACY_KEY)).resolves.toBeNull();
    await expect(storage.getItem(wardrobeKey('you'))).resolves.toBe(BARE_DOC);
    const session = JSON.parse((await storage.getItem(SESSION_KEY)) as string);
    expect(session.activeId).toBe('you');
  });

  test('garbage in the wardrobe key falls back to a fresh state, never a throw', async () => {
    await seed('this was never JSON {{{');
    await openWardrobe();

    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(0);
  });
});

describe('logWear — local days, stored plans (mirrors scripts/test-dates.mjs)', () => {
  const DOC = JSON.stringify({
    schemaVersion: 8,
    items: [
      {
        id: 'i1', name: 'The white oxford', category: 'tops', color: '#F4EFE2',
        season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01',
        wearCount: 0, favorite: false, laundryStatus: 'clean',
      },
      {
        id: 'i2', name: 'Indigo jeans', category: 'bottoms', color: '#31415E',
        season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01',
        wearCount: 5, lastWorn: '2026-08-01', favorite: false, laundryStatus: 'clean',
      },
    ],
    outfits: [], wearLogs: [], wishlist: [],
    circle: { profiles: [], groups: [], messages: [], loans: [] },
    events: [], furniture: [], photoEncoding: 'inline',
    settings: { categories: [{ id: 'tops', label: 'Tops' }, { id: 'bottoms', label: 'Bottoms' }], occasions: ['casual'], theme: 'dark' },
  });

  beforeEach(() => {
    // 23:30 LOCAL on the 19th — the hour toISOString() gets wrong for anyone
    // west of UTC. Only Date is faked; timers and promises stay real.
    jest.useFakeTimers({
      doNotFake: [
        'hrtime', 'nextTick', 'performance', 'queueMicrotask',
        'requestAnimationFrame', 'cancelAnimationFrame',
        'requestIdleCallback', 'cancelIdleCallback',
        'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
        'setTimeout', 'clearTimeout',
      ],
      now: new Date('2026-08-19T23:30:00'),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('a wear logged late in the evening carries the LOCAL day', async () => {
    await seed(DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i1']);
    });

    const log = ctx!.wearLogs[ctx!.wearLogs.length - 1];
    expect(log.date).toBe('2026-08-19');
    expect(log.planned).toBeUndefined();
    const item = ctx!.getItem('i1')!;
    expect(item.wearCount).toBe(1);
    expect(item.lastWorn).toBe('2026-08-19');
    // A wear logged for today moves the piece to the bench.
    expect(item.laundryStatus).toBe('worn');
  });

  test('a future date is a PLAN — recorded, counting nothing', async () => {
    await seed(DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i1'], undefined, '2026-08-25');
    });

    const log = ctx!.wearLogs[ctx!.wearLogs.length - 1];
    expect(log.planned).toBe(true);
    expect(ctx!.getItem('i1')!.wearCount).toBe(0);
    expect(ctx!.getItem('i1')!.laundryStatus).toBe('clean');
  });

  test('a backfilled wear moves the count and the date, never the bench', async () => {
    await seed(DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i2'], undefined, '2026-08-10');
    });

    const item = ctx!.getItem('i2')!;
    expect(item.wearCount).toBe(6);
    expect(item.lastWorn).toBe('2026-08-10');
    // Last week's laundry is not today's problem.
    expect(item.laundryStatus).toBe('clean');
  });

  test('undo puts the count back and recomputes lastWorn from what survives', async () => {
    await seed(DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i2']);
    });
    expect(ctx!.getItem('i2')!.wearCount).toBe(6);
    const logId = ctx!.wearLogs[ctx!.wearLogs.length - 1].id;

    act(() => {
      ctx!.removeWearLog(logId);
    });
    const item = ctx!.getItem('i2')!;
    expect(item.wearCount).toBe(5);
    // Not left pointing at the removed day — recomputed from the record.
    expect(item.lastWorn).toBeUndefined();
  });
});

describe('persistence — add, settle, reload (docs/34 §2.4 laws 1 and 4)', () => {
  test('an added piece survives the debounce, the write, and a fresh mount', async () => {
    await seed(JSON.stringify({ items: [] }));
    const first = await openWardrobe();

    act(() => {
      ctx!.addItem({
        name: 'The good linen shirt',
        category: 'tops',
        color: '#D9C4A3',
        season: [],
        occasion: [],
        imageUrl: '',
        favorite: false,
        cost: 2600,
      });
    });
    expect(ctx!.items).toHaveLength(1);

    // One write per committed state, coalesced over the settle window.
    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(raw).toContain('The good linen shirt');
    });

    first.unmount();
    ctx = null;
    await openWardrobe();
    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(1);
    expect(ctx!.items[0].name).toBe('The good linen shirt');
    expect(ctx!.items[0].cost).toBe(2600);
    expect(ctx!.items[0].wearCount).toBe(0);
    expect(ctx!.items[0].laundryStatus).toBe('clean');
  });
});
