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

/**
 * The disk, for the photograph half of the provider. `mock`-prefixed so
 * jest's hoist allows the reference from inside the factory. The shapes are
 * the SDK 57 object API's own (docs read this session) — see photos.test.ts,
 * which exercises the file layer directly; here it exists so the provider's
 * "the file goes when the record does" rule can be watched happening.
 */
const mockDisk = { files: new Map<string, string>(), dirs: new Set<string>() };

jest.mock('expo-file-system', () => {
  const DOCUMENT = 'file:///documents/';
  const resolve = (args: unknown[]): string => {
    const [first, ...rest] = args;
    const base = typeof first === 'string' ? first : String((first as { uri: string }).uri);
    if (rest.length === 0) return base;
    const head = base.endsWith('/') ? base : `${base}/`;
    return head + rest.map(String).join('/');
  };
  class Directory {
    uri: string;
    constructor(...args: unknown[]) {
      const uri = resolve(args);
      this.uri = uri.endsWith('/') ? uri : `${uri}/`;
    }
    get exists() {
      return mockDisk.dirs.has(this.uri);
    }
    create() {
      mockDisk.dirs.add(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = resolve(args);
    }
    get exists() {
      return mockDisk.files.has(this.uri);
    }
    create() {
      if (!mockDisk.files.has(this.uri)) mockDisk.files.set(this.uri, '');
    }
    write(content: string) {
      mockDisk.files.set(this.uri, content);
    }
    async base64() {
      const v = mockDisk.files.get(this.uri);
      if (v === undefined) throw new Error('no such file');
      return v;
    }
    delete() {
      mockDisk.files.delete(this.uri);
    }
    async copy(destination: File) {
      const v = mockDisk.files.get(this.uri);
      if (v === undefined) throw new Error('no such file');
      mockDisk.files.set(destination.uri, v);
    }
  }
  return {
    Directory,
    File,
    Paths: { document: new Directory(DOCUMENT), cache: new Directory('file:///cache/') },
  };
});

import { todayLocal } from '@almari/shared/dates';
import { FORM_MAX_SLOTS, MAX_FURNITURE, type FurnitureForm } from '@almari/shared/types';

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

/* ============================================================================
   THE LOOKS AND THE FURNITURE — the CRUD squads B, C and D build against.

   Mirrors the semantics of src/context/WardrobeContext.tsx by behaviour, and
   the assertion scripts/test-features.mjs holds over the browser ("removing
   furniture never removes clothes") by counting the same things this provider
   stores. Every case runs through the real provider over the real storage
   adapter, so what is checked is what is written down.
   ============================================================================ */

/** A piece, in the shape the document holds one. */
const piece = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
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

describe('looks — addOutfit / updateOutfit / removeOutfit', () => {
  test('a look is built with a name, its pieces, and a wear count that starts at zero', async () => {
    await seed(
      JSON.stringify({ items: [piece('i-1', 'The white oxford'), piece('i-2', 'The good linen shirt')] }),
    );
    await openWardrobe();

    let id: string | null = null;
    act(() => {
      id = ctx!.addOutfit('Monday', ['i-1', 'i-2'], 'work');
    });

    expect(id).toBeTruthy();
    expect(ctx!.outfits).toHaveLength(1);
    const look = ctx!.outfits[0];
    expect(look.name).toBe('Monday');
    expect(look.itemIds).toEqual(['i-1', 'i-2']);
    expect(look.occasion).toBe('work');
    expect(look.wearCount).toBe(0);
    expect(look.favorite).toBe(false);
    expect(look.dateCreated).toBeTruthy();
  });

  test('no occasion means the FIELD IS ABSENT, byte-identical to a web-written look', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();
    act(() => {
      ctx!.addOutfit('Plain', ['i-1']);
    });
    expect('occasion' in ctx!.outfits[0]).toBe(false);
  });

  test('a look with no name, or nothing in it, is refused rather than written empty', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();

    let a: string | null = 'x';
    let b: string | null = 'x';
    let c: string | null = 'x';
    act(() => {
      a = ctx!.addOutfit('   ', ['i-1']);
      b = ctx!.addOutfit('Nameless pieces', []);
      c = ctx!.addOutfit('Blank ids', ['   ']);
    });
    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(c).toBeNull();
    expect(ctx!.outfits).toHaveLength(0);
  });

  test('the same piece twice is one piece — a look is a set, not a tally', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();
    act(() => {
      ctx!.addOutfit('Doubled', ['i-1', 'i-1']);
    });
    expect(ctx!.outfits[0].itemIds).toEqual(['i-1']);
  });

  test('a look is amended field by field, and its wears are not something a patch can touch', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'A'), piece('i-2', 'B')],
        outfits: [
          {
            id: 'o-1',
            name: 'Monday',
            itemIds: ['i-1'],
            favorite: false,
            dateCreated: '2026-06-01T00:00:00.000Z',
            wearCount: 4,
          },
        ],
      }),
    );
    await openWardrobe();

    act(() => {
      ctx!.updateOutfit('o-1', { name: 'Tuesday', itemIds: ['i-1', 'i-2'], favorite: true });
    });

    const look = ctx!.outfits[0];
    expect(look.name).toBe('Tuesday');
    expect(look.itemIds).toEqual(['i-1', 'i-2']);
    expect(look.favorite).toBe(true);
    // The four wears are four days that happened. Nothing about editing a
    // look's name is allowed to reach them.
    expect(look.wearCount).toBe(4);
    expect(look.dateCreated).toBe('2026-06-01T00:00:00.000Z');
  });

  test('a patch cannot reach the wears, even when a caller types it wider', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'A')],
        outfits: [
          {
            id: 'o-1',
            name: 'Monday',
            itemIds: ['i-1'],
            favorite: false,
            dateCreated: '2026-06-01T00:00:00.000Z',
            wearCount: 7,
            lastWorn: '2026-06-10',
          },
        ],
      }),
    );
    await openWardrobe();

    // app/src/components/outfits/contract.ts types its own alias as
    // Partial<Outfit>, which TypeScript will happily pass to the narrower
    // signature here. The guarantee has to hold at RUNTIME or it is not one.
    act(() => {
      (ctx!.updateOutfit as (id: string, patch: Record<string, unknown>) => void)('o-1', {
        name: 'Tuesday',
        wearCount: 0,
        lastWorn: undefined,
        id: 'o-hijacked',
        dateCreated: '1999-01-01T00:00:00.000Z',
      });
    });

    const look = ctx!.outfits[0];
    expect(look.name).toBe('Tuesday');
    expect(look.id).toBe('o-1');
    expect(look.wearCount).toBe(7);
    expect(look.lastWorn).toBe('2026-06-10');
    expect(look.dateCreated).toBe('2026-06-01T00:00:00.000Z');
  });

  test('removing a look takes the look and NOTHING else (ports deleteOutfit)', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'A', { wearCount: 3, lastWorn: '2026-06-10' })],
        outfits: [
          {
            id: 'o-1',
            name: 'Monday',
            itemIds: ['i-1'],
            favorite: false,
            dateCreated: '2026-06-01T00:00:00.000Z',
            wearCount: 3,
          },
        ],
        wearLogs: [{ id: 'w-1', date: '2026-06-10', itemIds: ['i-1'], outfitId: 'o-1' }],
      }),
    );
    await openWardrobe();

    act(() => {
      ctx!.removeOutfit('o-1');
    });

    expect(ctx!.outfits).toHaveLength(0);
    // The piece keeps every wear it earned while in that look, and the day it
    // was worn is still a day that happened.
    expect(ctx!.items[0].wearCount).toBe(3);
    expect(ctx!.items[0].lastWorn).toBe('2026-06-10');
    expect(ctx!.wearLogs).toHaveLength(1);
    expect(ctx!.wearLogs[0].outfitId).toBe('o-1');
  });

  test('wearing a look credits every piece in it, and the look', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'A'), piece('i-2', 'B')],
        outfits: [
          {
            id: 'o-1',
            name: 'Monday',
            itemIds: ['i-1', 'i-2'],
            favorite: false,
            dateCreated: '2026-06-01T00:00:00.000Z',
            wearCount: 0,
          },
        ],
      }),
    );
    await openWardrobe();

    act(() => {
      ctx!.logWear([], 'o-1');
    });

    expect(ctx!.items.map(i => i.wearCount)).toEqual([1, 1]);
    expect(ctx!.outfits[0].wearCount).toBe(1);
  });
});

describe('furniture — where a piece lives', () => {
  test('a place is made with its own default compartment names, at the count asked for', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    let id: string | null = null;
    act(() => {
      id = ctx!.addFurniture('Bedroom chest', 'chest', 3);
    });

    expect(id).toBeTruthy();
    const made = ctx!.furniture[0];
    expect(made.name).toBe('Bedroom chest');
    expect(made.form).toBe('chest');
    expect(made.slots.map(s => s.label)).toEqual(['Top drawer', 'Second drawer', 'Bottom drawer']);
    expect(made.slots.map(s => s.id)).toEqual([`${made.id}-s1`, `${made.id}-s2`, `${made.id}-s3`]);
    expect(made.dateAdded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('every form names its parts the way the web names them', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    const expected: Array<[FurnitureForm, number, string[]]> = [
      ['rail', 1, ['The rail']],
      ['rail', 3, ['Section 1', 'Section 2', 'Section 3']],
      ['shelves', 2, ['Top shelf', 'Bottom shelf']],
      ['almirah', 4, ['The hanging side', 'Locker', 'Shelves', 'The drawer']],
      ['almirah-carved', 6, ['The hanging side', 'Locker', 'Upper', 'Middle', 'Lower', 'The drawer']],
      ['almirah-fitted', 4, ['Hanging ledge', 'Shelves', 'Jewels', 'Locker']],
      ['box', 3, ['Top tray', 'Second tray', 'Third tray']],
      ['hooks', 1, ['The peg']],
      ['hooks', 2, ['Peg 1', 'Peg 2']],
      ['stand', 3, ['Top tier', 'Second tier', 'Bottom tier']],
      ['rack', 1, ['The tier']],
      [
        'chest',
        7,
        ['Drawer 1', 'Drawer 2', 'Drawer 3', 'Drawer 4', 'Drawer 5', 'Drawer 6', 'Drawer 7'],
      ],
    ];

    for (const [form, count, labels] of expected) {
      let id: string | null = null;
      act(() => {
        id = ctx!.addFurniture(`A ${form}`, form, count);
      });
      const made = ctx!.furniture.find(f => f.id === id);
      expect(made?.slots.map(s => s.label)).toEqual(labels);
    }
  });

  test('a count above the form ceiling is cut to it, and below one is raised to one', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    let over: string | null = null;
    let under: string | null = null;
    act(() => {
      over = ctx!.addFurniture('Too many pegs', 'hooks', 40);
      under = ctx!.addFurniture('No trays at all', 'box', 0);
    });
    expect(ctx!.furniture.find(f => f.id === over)?.slots).toHaveLength(FORM_MAX_SLOTS.hooks);
    expect(ctx!.furniture.find(f => f.id === under)?.slots).toHaveLength(1);
  });

  test('a nameless place is still a place', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    act(() => {
      ctx!.addFurniture('   ', 'rail', 1);
    });
    expect(ctx!.furniture[0].name).toBe('A place');
  });

  test('plain is the ABSENCE of ornament, and a treatment is stored when asked for', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    let plain: string | null = null;
    let carved: string | null = null;
    act(() => {
      plain = ctx!.addFurniture('Plain', 'almirah-fitted', 2, 'plain');
      carved = ctx!.addFurniture('Carved', 'almirah-fitted', 2, 'mughal');
    });
    expect('ornament' in ctx!.furniture.find(f => f.id === plain)!).toBe(false);
    expect(ctx!.furniture.find(f => f.id === carved)!.ornament).toBe('mughal');
  });

  test('the ceiling governs what may be MADE, and answers null rather than a fake id', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    act(() => {
      for (let n = 0; n < MAX_FURNITURE; n++) ctx!.addFurniture(`Place ${n}`, 'rail', 1);
    });
    expect(ctx!.furniture).toHaveLength(MAX_FURNITURE);

    let refused: string | null = 'x';
    act(() => {
      refused = ctx!.addFurniture('One too many', 'rail', 1);
    });
    expect(refused).toBeNull();
    expect(ctx!.furniture).toHaveLength(MAX_FURNITURE);
  });

  test('the ceiling never governs what may be READ — a fuller document arrives intact', async () => {
    const overFull = Array.from({ length: MAX_FURNITURE + 6 }, (_, n) => ({
      id: `f-${n}`,
      name: `Place ${n}`,
      form: 'rail',
      slots: [{ id: `f-${n}-s1`, label: 'The rail' }],
      dateAdded: '2026-06-01',
    }));
    await seed(JSON.stringify({ items: [], furniture: overFull }));
    await openWardrobe();
    expect(ctx!.furniture).toHaveLength(MAX_FURNITURE + 6);
  });

  test('filing a piece gives it an address; unfiling REMOVES the field rather than blanking it', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'The white oxford')],
        furniture: [
          {
            id: 'f-1',
            name: 'Bedroom chest',
            form: 'chest',
            slots: [{ id: 'f-1-s1', label: 'Top drawer' }],
            dateAdded: '2026-06-01',
          },
        ],
      }),
    );
    await openWardrobe();

    act(() => {
      ctx!.filePiece('i-1', 'f-1', 'f-1-s1');
    });
    expect(ctx!.items[0].place).toEqual({ furnitureId: 'f-1', slotId: 'f-1-s1' });

    act(() => {
      ctx!.filePiece('i-1', null, null);
    });
    // Absent, not empty: an unfiled piece is byte-identical to one never filed.
    expect('place' in ctx!.items[0]).toBe(false);
  });

  test('unfiling takes the address and nothing else', async () => {
    await seed(
      JSON.stringify({
        items: [
          piece('i-1', 'The white oxford', {
            wearCount: 9,
            lastWorn: '2026-06-10',
            cost: 350,
            place: { furnitureId: 'f-1', slotId: 'f-1-s1' },
          }),
        ],
        furniture: [
          {
            id: 'f-1',
            name: 'Bedroom chest',
            form: 'chest',
            slots: [{ id: 'f-1-s1', label: 'Top drawer' }],
            dateAdded: '2026-06-01',
          },
        ],
      }),
    );
    await openWardrobe();

    act(() => {
      ctx!.filePiece('i-1', null, null);
    });
    const item = ctx!.items[0];
    expect(item.wearCount).toBe(9);
    expect(item.lastWorn).toBe('2026-06-10');
    expect(item.cost).toBe(350);
    expect(item.name).toBe('The white oxford');
  });

  test('REMOVING FURNITURE NEVER REMOVES CLOTHES (mirrors scripts/test-features.mjs)', async () => {
    await seed(
      JSON.stringify({
        items: [
          piece('i-1', 'The white oxford', {
            wearCount: 12,
            lastWorn: '2026-06-10',
            place: { furnitureId: 'f-1', slotId: 'f-1-s1' },
          }),
          piece('i-2', 'The good linen shirt', {
            wearCount: 3,
            place: { furnitureId: 'f-1', slotId: 'f-1-s2' },
          }),
          piece('i-3', 'Unfiled all along'),
        ],
        wearLogs: [{ id: 'w-1', date: '2026-06-10', itemIds: ['i-1'] }],
        furniture: [
          {
            id: 'f-1',
            name: 'Bedroom chest',
            form: 'chest',
            slots: [
              { id: 'f-1-s1', label: 'Top drawer' },
              { id: 'f-1-s2', label: 'Bottom drawer' },
            ],
            dateAdded: '2026-06-01',
          },
        ],
      }),
    );
    await openWardrobe();

    const before = ctx!.items.length;
    act(() => {
      ctx!.removeFurniture('f-1');
    });

    expect(ctx!.furniture).toHaveLength(0);
    expect(ctx!.items).toHaveLength(before);
    expect(ctx!.items.map(i => i.wearCount)).toEqual([12, 3, 0]);
    expect(ctx!.items[0].lastWorn).toBe('2026-06-10');
    expect(ctx!.wearLogs).toHaveLength(1);
    // Only the address goes.
    expect(ctx!.items.every(i => i.place === undefined)).toBe(true);
  });

  test('the removal hands back a put-it-back that restores the place AND its contents', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'The white oxford', { place: { furnitureId: 'f-1', slotId: 'f-1-s1' } })],
        furniture: [
          {
            id: 'f-1',
            name: 'Bedroom chest',
            form: 'chest',
            slots: [{ id: 'f-1-s1', label: 'Top drawer' }],
            dateAdded: '2026-06-01',
          },
        ],
      }),
    );
    await openWardrobe();

    let putBack: (() => void) | undefined;
    act(() => {
      putBack = ctx!.removeFurniture('f-1');
    });
    expect(ctx!.furniture).toHaveLength(0);
    expect(ctx!.items[0].place).toBeUndefined();

    act(() => {
      putBack!();
    });
    // The whole previous state, never a field-by-field inverse.
    expect(ctx!.furniture).toHaveLength(1);
    expect(ctx!.furniture[0].name).toBe('Bedroom chest');
    expect(ctx!.items[0].place).toEqual({ furnitureId: 'f-1', slotId: 'f-1-s1' });
  });

  test('removing a place that is already gone is not an error and loses nothing', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();
    act(() => {
      ctx!.removeFurniture('f-nope');
    });
    expect(ctx!.items).toHaveLength(1);
    expect(ctx!.furniture).toHaveLength(0);
  });
});

describe('photographs — the document agrees with the disk', () => {
  beforeEach(() => {
    mockDisk.files.clear();
    mockDisk.dirs.clear();
  });

  test('a photograph lands as a path, and the document STAMPS photoEncoding file', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'The white oxford')] }));
    await openWardrobe();

    mockDisk.files.set('file:///cache/pick.jpg', 'JPEGBYTES');
    await act(async () => {
      await ctx!.setItemPhoto('i-1', 'file:///cache/pick.jpg');
    });

    const stored = ctx!.items[0].imageUrl;
    expect(stored.startsWith('photos/')).toBe(true);
    expect(stored).not.toMatch(/^data:/);
    expect(mockDisk.files.get(`file:///documents/${stored}`)).toBe('JPEGBYTES');

    // The document says which kind of string its photographs are — the field
    // migrate.ts seeded for exactly this (shared/types, schema v8).
    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(JSON.parse(raw!).photoEncoding).toBe('file');
    });
  });

  test('a document with no file-backed photograph keeps saying inline', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();

    act(() => {
      ctx!.addItem({
        name: 'Typed in, no photograph',
        category: 'tops',
        color: '#D9C4A3',
        season: [],
        occasion: [],
        imageUrl: '',
        favorite: false,
      });
    });

    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(JSON.parse(raw!).photoEncoding).toBe('inline');
    });
  });

  test('a piece added WITH a photograph already saved stamps the document too', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    act(() => {
      ctx!.addItem({
        name: 'Photographed on the way in',
        category: 'tops',
        color: '#D9C4A3',
        season: [],
        occasion: [],
        imageUrl: 'photos/p-abc.jpg',
        favorite: false,
      });
    });

    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(JSON.parse(raw!).photoEncoding).toBe('file');
    });
  });

  test('replacing a photograph deletes the one it replaced', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();

    mockDisk.files.set('file:///cache/one.jpg', 'ONE');
    mockDisk.files.set('file:///cache/two.jpg', 'TWO');

    await act(async () => {
      await ctx!.setItemPhoto('i-1', 'file:///cache/one.jpg');
    });
    const first = ctx!.items[0].imageUrl;

    await act(async () => {
      await ctx!.setItemPhoto('i-1', 'file:///cache/two.jpg');
    });
    const second = ctx!.items[0].imageUrl;

    expect(second).not.toBe(first);
    expect(mockDisk.files.has(`file:///documents/${first}`)).toBe(false);
    expect(mockDisk.files.get(`file:///documents/${second}`)).toBe('TWO');
  });

  test('removing a photograph takes the file with it, and nothing else', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A', { wearCount: 5, cost: 350 })] }));
    await openWardrobe();

    mockDisk.files.set('file:///cache/one.jpg', 'ONE');
    await act(async () => {
      await ctx!.setItemPhoto('i-1', 'file:///cache/one.jpg');
    });
    const path = ctx!.items[0].imageUrl;
    expect(mockDisk.files.has(`file:///documents/${path}`)).toBe(true);

    await act(async () => {
      await ctx!.removeItemPhoto('i-1');
    });

    expect(ctx!.items[0].imageUrl).toBe('');
    expect(mockDisk.files.has(`file:///documents/${path}`)).toBe(false);
    expect(ctx!.items[0].wearCount).toBe(5);
    expect(ctx!.items[0].cost).toBe(350);
  });

  test('a wardrobe synced down from the web keeps its inline photographs and its inline claim', async () => {
    const inline = 'data:image/jpeg;base64,QUJDRA==';
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'From the browser', { imageUrl: inline })],
        photoEncoding: 'inline',
      }),
    );
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i-1']);
    });

    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      const doc = JSON.parse(raw!);
      expect(doc.photoEncoding).toBe('inline');
      expect(doc.items[0].imageUrl).toBe(inline);
    });
  });

  test('a photograph aimed at a piece that is not there changes nothing', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'A')] }));
    await openWardrobe();
    mockDisk.files.set('file:///cache/one.jpg', 'ONE');
    await act(async () => {
      await ctx!.setItemPhoto('i-nope', 'file:///cache/one.jpg');
    });
    expect(ctx!.items[0].imageUrl).toBe('');
  });
});


/* ============================================================================
   R3 · R4 — THE LOOK'S UNDO, AND THE SENTINEL THAT CLEARS A FIELD

   Both are lead rulings of this wave, and both are about a record being able
   to go back to what it said: a look tidied away by mistake comes back whole,
   and an occasion chosen once can be un-chosen. Every case here fails against
   the provider as it stood before the rulings — the undo case because nothing
   came back to call, the sentinel cases because null was written INTO the
   field instead of taking it off.
   ============================================================================ */

const LOOK = {
  id: 'o-1',
  name: 'Monday',
  itemIds: ['i-1'],
  favorite: false,
  dateCreated: '2026-06-01T00:00:00.000Z',
  wearCount: 5,
  lastWorn: '2026-06-10',
  occasion: 'work',
  notes: 'The collar sits better under the grey coat.',
  stylingNote: 'Not with the brown belt.',
  imageUrl: 'data:image/jpeg;base64,AAAA',
};

async function openWithLook(extra: Record<string, unknown> = {}) {
  await seed(
    JSON.stringify({
      items: [piece('i-1', 'The white oxford', { wearCount: 5, lastWorn: '2026-06-10' })],
      outfits: [{ ...LOOK, ...extra }],
    }),
  );
  await openWardrobe();
}

describe('R3 — removing a look hands back the way to put it back', () => {
  test('the closure restores the look whole, with the wears it had', async () => {
    await openWithLook();

    let undo: (() => void) | undefined;
    act(() => {
      undo = ctx!.removeOutfit('o-1');
    });
    expect(ctx!.outfits).toHaveLength(0);
    expect(typeof undo).toBe('function');

    act(() => {
      undo!();
    });
    // Whole, not field by field — the five wears, the date, the note and the
    // photograph all come back, because the previous STATE came back.
    expect(ctx!.outfits).toHaveLength(1);
    expect(ctx!.outfits[0]).toEqual(LOOK);
  });

  test('the closure is captured before React runs, so an undo reached for at once works', async () => {
    await openWithLook();

    // Remove and undo inside ONE act: on the web this is the toast being
    // pressed in the same tick it appeared. A closure that read the state from
    // inside the updater would still be holding null here.
    act(() => {
      const undo = ctx!.removeOutfit('o-1');
      undo();
    });
    expect(ctx!.outfits).toHaveLength(1);
    expect(ctx!.outfits[0].name).toBe('Monday');
  });

  test('removing a look still takes the look and nothing else', async () => {
    await openWithLook();
    act(() => {
      ctx!.removeOutfit('o-1');
    });
    // The piece keeps every wear it earned while in that look.
    expect(ctx!.items[0].wearCount).toBe(5);
    expect(ctx!.items[0].lastWorn).toBe('2026-06-10');
  });
});

describe('R4 — null is the clear sentinel, and only where a field may go', () => {
  test('null takes an occasion OFF the record — absent, never blank', async () => {
    await openWithLook();
    act(() => {
      ctx!.updateOutfit('o-1', { occasion: null });
    });
    const look = ctx!.outfits[0];
    // Absent, so the look is byte-identical to one the web wrote that never
    // had an occasion. `occasion: undefined` would serialise the same but read
    // differently to `in`, and `''` would not serialise the same at all.
    expect('occasion' in look).toBe(false);
    expect(JSON.parse(JSON.stringify(look)).occasion).toBeUndefined();
  });

  test('every clearable field clears, and the record keeps everything else', async () => {
    await openWithLook();
    act(() => {
      ctx!.updateOutfit('o-1', {
        occasion: null,
        notes: null,
        stylingNote: null,
        imageUrl: null,
      });
    });
    const look = ctx!.outfits[0];
    for (const key of ['occasion', 'notes', 'stylingNote', 'imageUrl']) {
      expect(key in look).toBe(false);
    }
    expect(look.name).toBe('Monday');
    expect(look.itemIds).toEqual(['i-1']);
    expect(look.wearCount).toBe(5);
    expect(look.lastWorn).toBe('2026-06-10');
    expect(look.dateCreated).toBe('2026-06-01T00:00:00.000Z');
  });

  test('undefined is silence, not a clear — an unmentioned field is left alone', async () => {
    await openWithLook();
    act(() => {
      ctx!.updateOutfit('o-1', { name: 'Tuesday', occasion: undefined });
    });
    expect(ctx!.outfits[0].name).toBe('Tuesday');
    expect(ctx!.outfits[0].occasion).toBe('work');
  });

  test('a field a look may not be WITHOUT ignores the sentinel rather than breaking the row', async () => {
    await openWithLook();
    // A caller typing its own alias wider can hand null to any of these; the
    // guarantee has to hold at runtime or it is not one. An unnamed look is
    // not a cleared field, it is a record nothing can draw.
    act(() => {
      (ctx!.updateOutfit as (id: string, patch: Record<string, unknown>) => void)('o-1', {
        name: null,
        itemIds: null,
        favorite: null,
      });
    });
    const look = ctx!.outfits[0];
    expect(look.name).toBe('Monday');
    expect(look.itemIds).toEqual(['i-1']);
    expect(look.favorite).toBe(false);
  });

  test('the sentinel did not open a door to the wears', async () => {
    await openWithLook();
    act(() => {
      (ctx!.updateOutfit as (id: string, patch: Record<string, unknown>) => void)('o-1', {
        wearCount: null,
        lastWorn: null,
        id: null,
        dateCreated: null,
      });
    });
    const look = ctx!.outfits[0];
    expect(look.id).toBe('o-1');
    expect(look.wearCount).toBe(5);
    expect(look.lastWorn).toBe('2026-06-10');
    expect(look.dateCreated).toBe('2026-06-01T00:00:00.000Z');
  });
});

/* ============================================================================
   R6 — LOANS: WHAT IS OUT, AND WITH WHOM

   Mirrors recordLoan/closeLoan in src/context/WardrobeContext.tsx exactly:
   the same signatures, the same loan record, the same one-open-loan rule, and
   the same refusal to touch a piece's wears when it comes home. The lending
   side is always the wardrobe doing the writing; nothing here writes the
   borrower's half.
   ============================================================================ */

const ME = {
  id: 'me',
  name: 'Your wardrobe',
  handle: '@you',
  monogram: 'Y',
  color: '#105F7D',
  createdAt: '2026-06-01',
};
const PRIYA = {
  id: 'priya',
  name: "Priya's wardrobe",
  handle: '@priya',
  monogram: 'P',
  color: '#8C2F2F',
  createdAt: '2026-06-01',
};
const ASHA = {
  id: 'asha',
  name: "Asha's wardrobe",
  handle: '@asha',
  monogram: 'A',
  color: '#3F5E3A',
  createdAt: '2026-06-01',
};

/**
 * The document AFTER the provider has written it — never the seeded bytes.
 *
 * The fixture is already at that key, so a bare read can answer with the seed
 * and pass an assertion the provider never made. Red-proofing found exactly
 * that hole: a mutation that let a lend overwrite an existing rail profile left
 * this suite green, because the read had raced the write and won. The marker
 * waited on is a loan, which only the provider can have put there.
 */
type RailProfile = { id: string; [key: string]: unknown };
type RailDoc = { circle: { profiles: RailProfile[]; loans: unknown[] } };

async function settled(): Promise<RailDoc> {
  await waitFor(async () => {
    const raw = await storage.getItem(wardrobeKey('acct-1'));
    expect(JSON.parse(raw!).circle?.loans ?? []).not.toHaveLength(0);
  });
  return JSON.parse((await storage.getItem(wardrobeKey('acct-1')))!);
}

/**
 * One person on the rail, named. Deliberately not a bare `find(...)!`:
 * "nobody by that name is on the rail" and "their name is wrong" are different
 * failures, and a dereference would report the first as the second.
 */
function railProfile(doc: RailDoc, id: string): RailProfile {
  const found = doc.circle.profiles.find(p => p.id === id);
  expect(found).toBeDefined();
  return found as RailProfile;
}

describe('R6 — loans, mirrored from the web context', () => {
  test('an accepted ask opens one loan out of this closet, dated today', async () => {
    await seed(JSON.stringify({ items: [piece('i-1', 'The good linen shirt')] }));
    await openWardrobe();

    act(() => {
      ctx!.recordLoan('The good linen shirt', ME, PRIYA);
    });

    expect(ctx!.loans).toHaveLength(1);
    const loan = ctx!.loans[0];
    expect(loan.pieceName).toBe('The good linen shirt');
    expect(loan.withId).toBe('priya');
    // 'to' — out of this closet. The borrower's own app writes their 'from'.
    expect(loan.direction).toBe('to');
    // The local day, from @almari/shared/dates — never toISOString().
    expect(loan.since).toBe(todayLocal());
    expect(loan.returned).toBeUndefined();
    expect(loan.id).toBeTruthy();
  });

  test('both people land on the rail, and only I am marked as me', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });

    // Read through the document the provider writes, since the rail's own
    // screen has no native port yet.
    const doc = await settled();
    const mine = railProfile(doc, 'me');
    const theirs = railProfile(doc, 'priya');
    expect(mine.isMe).toBe(true);
    expect(mine.handle).toBe('@you');
    expect(theirs.name).toBe("Priya's wardrobe");
    expect('isMe' in theirs).toBe(false);
    expect(theirs.lendable).toEqual([]);
    expect(theirs.showcase).toEqual([]);
  });

  test('a second accept of the same ask opens nothing — the button is idempotent', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
      ctx!.recordLoan('A coat', ME, PRIYA);
    });
    expect(ctx!.loans).toHaveLength(1);
  });

  test('the same piece to a different person is a different loan', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });
    act(() => {
      ctx!.closeLoan('A coat', 'priya');
    });
    act(() => {
      ctx!.recordLoan('A coat', ME, ASHA);
    });
    expect(ctx!.loans).toHaveLength(2);
    expect(ctx!.loans.filter(l => !l.returned)).toHaveLength(1);
    expect(ctx!.loans.find(l => !l.returned)!.withId).toBe('asha');
  });

  test('lending the same piece again after it came home opens a new loan', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });
    act(() => {
      ctx!.closeLoan('A coat', 'priya');
    });
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });
    expect(ctx!.loans).toHaveLength(2);
  });

  test('an existing profile is never overwritten by whatever the caller was holding', async () => {
    await seed(
      JSON.stringify({
        items: [],
        circle: {
          profiles: [
            {
              id: 'priya',
              handle: '@priya',
              name: 'Priya',
              monogram: 'P',
              color: '#123456',
              lendable: ['x'],
              showcase: [],
            },
          ],
          groups: [],
          messages: [],
          loans: [],
        },
      }),
    );
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });

    const doc = await settled();
    const theirs = railProfile(doc, 'priya');
    expect(theirs.name).toBe('Priya');
    expect(theirs.color).toBe('#123456');
    expect(theirs.lendable).toEqual(['x']);
  });

  test('home again stamps the loan and moves NOTHING else — no wear is invented', async () => {
    await seed(
      JSON.stringify({
        items: [piece('i-1', 'A coat', { wearCount: 3, lastWorn: '2026-06-10' })],
      }),
    );
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });
    act(() => {
      ctx!.closeLoan('A coat', 'priya');
    });

    expect(ctx!.loans[0].returned).toBe(todayLocal());
    // A piece coming back is not a piece having been worn, and the person who
    // wore it was not its owner.
    expect(ctx!.items[0].wearCount).toBe(3);
    expect(ctx!.items[0].lastWorn).toBe('2026-06-10');
    expect(ctx!.items[0].laundryStatus).toBe('clean');
    expect(ctx!.wearLogs).toHaveLength(0);
  });

  test('closing a loan that is not open changes nothing', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    act(() => {
      ctx!.recordLoan('A coat', ME, PRIYA);
    });
    act(() => {
      ctx!.closeLoan('A coat', 'priya');
    });
    const stamped = ctx!.loans[0].returned;
    act(() => {
      ctx!.closeLoan('A coat', 'priya');
      ctx!.closeLoan('A scarf that was never lent', 'priya');
    });
    expect(ctx!.loans).toHaveLength(1);
    expect(ctx!.loans[0].returned).toBe(stamped);
  });
});

/* ============================================================================
   THE WISHLIST — the list that cools

   The provider half the wishlist room is built against. Mirrors
   addWishlistItem / updateWishlistItem / deleteWishlistItem /
   moveWishlistToCloset in src/context/WardrobeContext.tsx.
   ============================================================================ */

const WISH = {
  name: 'The navy overcoat',
  category: 'outerwear' as const,
  color: '#22304A',
  brand: 'A shop',
  price: 9800,
  priority: 'medium' as const,
  status: 'waiting' as const,
  notes: 'Only if the grey one goes.',
};

describe('the wishlist — addWish / updateWish / removeWish / promoteWish', () => {
  test('a wish goes on the list with its own id and the day it was added', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();

    let id = '';
    act(() => {
      id = ctx!.addWish(WISH);
    });
    expect(id).toBeTruthy();
    expect(ctx!.wishlist).toHaveLength(1);
    const wish = ctx!.wishlist[0];
    expect(wish.id).toBe(id);
    expect(wish.name).toBe('The navy overcoat');
    expect(wish.price).toBe(9800);
    expect(wish.status).toBe('waiting');
    expect(wish.dateAdded).toBeTruthy();
  });

  test('a wish is amended field by field, and its identity is not something a patch can touch', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    let id = '';
    act(() => {
      id = ctx!.addWish(WISH);
    });
    const added = ctx!.wishlist[0].dateAdded;

    act(() => {
      (ctx!.updateWish as (id: string, patch: Record<string, unknown>) => void)(id, {
        price: 8400,
        priority: 'high',
        id: 'w-hijacked',
        dateAdded: '1999-01-01T00:00:00.000Z',
      });
    });
    const wish = ctx!.wishlist[0];
    expect(wish.price).toBe(8400);
    expect(wish.priority).toBe('high');
    expect(wish.id).toBe(id);
    expect(wish.dateAdded).toBe(added);
  });

  test('null clears a wish field, and refuses on one the record may not be without', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    let id = '';
    act(() => {
      id = ctx!.addWish({ ...WISH, link: 'https://example.test/coat' });
    });

    act(() => {
      ctx!.updateWish(id, { brand: null, price: null, notes: null, link: null });
    });
    const wish = ctx!.wishlist[0];
    for (const key of ['brand', 'price', 'notes', 'link']) {
      expect(key in wish).toBe(false);
    }

    act(() => {
      (ctx!.updateWish as (id: string, patch: Record<string, unknown>) => void)(id, {
        name: null,
        status: null,
        category: null,
        color: null,
        priority: null,
      });
    });
    const still = ctx!.wishlist[0];
    expect(still.name).toBe('The navy overcoat');
    expect(still.status).toBe('waiting');
    expect(still.category).toBe('outerwear');
    expect(still.color).toBe('#22304A');
    expect(still.priority).toBe('medium');
  });

  test('the cooling-off wait can be answered, and the answer can be taken back off', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    let id = '';
    act(() => {
      id = ctx!.addWish({ ...WISH, coolingOff: { endsAt: '2026-08-27', asked: false } });
    });

    // Keep: the status moves AND the question is marked asked, so the card
    // asks once and then never again.
    act(() => {
      ctx!.updateWish(id, { status: 'kept', coolingOff: { endsAt: '2026-08-27', asked: true } });
    });
    expect(ctx!.wishlist[0].status).toBe('kept');
    expect(ctx!.wishlist[0].coolingOff).toEqual({ endsAt: '2026-08-27', asked: true });

    act(() => {
      ctx!.updateWish(id, { coolingOff: null });
    });
    expect('coolingOff' in ctx!.wishlist[0]).toBe(false);
  });

  test('a wish taken off the list hands back the way to put it back', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    let id = '';
    act(() => {
      id = ctx!.addWish(WISH);
    });
    const before = ctx!.wishlist[0];

    let undo: (() => void) | undefined;
    act(() => {
      undo = ctx!.removeWish(id);
    });
    expect(ctx!.wishlist).toHaveLength(0);

    act(() => {
      undo!();
    });
    expect(ctx!.wishlist).toHaveLength(1);
    expect(ctx!.wishlist[0]).toEqual(before);
  });

  test('bought: the piece joins the closet at zero wears and the wish stays on the record', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    let id = '';
    act(() => {
      id = ctx!.addWish(WISH);
    });

    let pieceId: string | null = null;
    act(() => {
      pieceId = ctx!.promoteWish(id);
    });
    expect(pieceId).toBeTruthy();

    expect(ctx!.items).toHaveLength(1);
    const bought = ctx!.items[0];
    expect(bought.id).toBe(pieceId);
    expect(bought.name).toBe('The navy overcoat');
    expect(bought.category).toBe('outerwear');
    expect(bought.color).toBe('#22304A');
    expect(bought.brand).toBe('A shop');
    // The price becomes the cost, which is the only number cost-per-wear has
    // to work from.
    expect(bought.cost).toBe(9800);
    expect(bought.notes).toBe('Only if the grey one goes.');
    // A thing you own is a thing you have not worn yet, whatever it cost.
    expect(bought.wearCount).toBe(0);
    expect(bought.laundryStatus).toBe('clean');
    expect(bought.favorite).toBe(false);
    expect(bought.season).toEqual([]);
    expect(bought.occasion).toEqual([]);
    expect(bought.imageUrl).toBe('');

    // The wish is NOT deleted: the web's wishlist prints its bought section
    // from exactly these rows, and the two apps write one document.
    expect(ctx!.wishlist).toHaveLength(1);
    expect(ctx!.wishlist[0].status).toBe('bought');
    expect(ctx!.wishlist[0].id).toBe(id);
  });

  test('promoting a wish that is not there answers null and writes nothing', async () => {
    await seed(JSON.stringify({ items: [] }));
    await openWardrobe();
    let answer: string | null = 'x';
    act(() => {
      answer = ctx!.promoteWish('w-nope');
    });
    expect(answer).toBeNull();
    expect(ctx!.items).toHaveLength(0);
    expect(ctx!.wishlist).toHaveLength(0);
  });

  test('the list and the ledger survive the debounce, the write, and a fresh mount', async () => {
    await seed(JSON.stringify({ items: [] }));
    const first = await openWardrobe();

    act(() => {
      ctx!.addWish(WISH);
      ctx!.recordLoan('A coat', ME, PRIYA);
    });

    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(raw).toContain('The navy overcoat');
    });

    first.unmount();
    ctx = null;
    await openWardrobe();
    expect(ctx!.wishlist).toHaveLength(1);
    expect(ctx!.wishlist[0].name).toBe('The navy overcoat');
    expect(ctx!.loans).toHaveLength(1);
    expect(ctx!.loans[0].pieceName).toBe('A coat');
  });
});
