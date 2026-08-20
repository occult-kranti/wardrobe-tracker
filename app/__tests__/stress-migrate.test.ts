/**
 * The garbage parade — migrate-on-read under everything a shelf can hold.
 *
 * Mirrors the spirit of scripts/test-migrate.mjs (the web's corpus, still the
 * source of truth) but hunts from the other side: not "does a good v7 export
 * open" (the inherited wardrobe suite proves that) but "does the WORST
 * document this key could possibly hold still open the door".
 *
 * The migrate contract under test (packages/shared/migrate.ts, docs/34 §2.4
 * law 4 and the lossless-forever promise):
 *  - anything unparseable or non-object → a fresh initialState, never a throw;
 *  - wrong-typed fields → repaired or defaulted, never trusted, never a crash;
 *  - every shell this app has ever written (v0 bare → v8) opens, stamped to
 *    the current schema;
 *  - a document from the FUTURE (v9, unknown keys everywhere) opens with
 *    every unknown key preserved — the version stamp is rewritten to this
 *    build's (that is the contract: the web's own corpus proves a v7 field
 *    round-trips through a v6 build BECAUSE the keys survive, not because
 *    the number does).
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';

import { migrate } from '@almari/shared/migrate';
import { SCHEMA_VERSION } from '@almari/shared/types';

import {
  ACCOUNTS_KEY,
  SESSION_KEY,
  storage,
  wardrobeKey,
} from '../src/lib/storage';
import { useWardrobe, WardrobeProvider } from '../src/lib/wardrobe';

const V7_DOC = readFileSync(join(__dirname, 'fixtures', 'v7-wardrobe.json'), 'utf8');

type Ctx = ReturnType<typeof useWardrobe>;
let ctx: Ctx | null = null;

function Probe() {
  ctx = useWardrobe();
  return null;
}

async function openWardrobe() {
  const view = render(createElement(WardrobeProvider, null, createElement(Probe, null)));
  await waitFor(() => expect(ctx?.status).not.toBe('loading'));
  return view;
}

async function seed(doc: string, id = 'acct-1') {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: id }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id, name: 'Parade wardrobe', handle: '@parade', monogram: 'P', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey(id), doc);
}

/** A piece that must come out the other side of every migration alive. */
const SENTINEL = {
  id: 'survivor',
  name: 'The piece that must survive',
  category: 'tops',
  color: '#31415E',
};

beforeEach(async () => {
  ctx = null;
  await AsyncStorage.clear();
});

/* ---------- 1. truncated JSON ---------- */

describe('truncated JSON', () => {
  test('a half-written v7 document opens as a fresh state and is left in place', async () => {
    // The exact bytes a process killed mid-write leaves behind.
    const truncated = V7_DOC.slice(0, Math.floor(V7_DOC.length * 0.4));
    await seed(truncated);
    await openWardrobe();

    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(0);
    // The corpse is preserved for the future "export the corpse" offer —
    // hydration must never write over what it could not read.
    await new Promise(r => setTimeout(r, 400));
    await expect(storage.getItem(wardrobeKey('acct-1'))).resolves.toBe(truncated);
  });

  test.each([
    ['empty string', ''],
    ['one brace', '{'],
    ['JSON cut mid-string', '{"schemaVersion": 8, "items": [{"id": "i1", "name": "the lin'],
    ['a bare word', 'undefined'],
    ['NaN — JSON.parse rejects it', 'NaN'],
  ])('%s never throws through migrate-on-read', async (_label, raw) => {
    await seed(raw);
    await openWardrobe();
    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(0);
    expect(Array.isArray(ctx!.settings.categories)).toBe(true);
  });

  test('valid JSON that is not an object also answers a fresh state', () => {
    // JSON.parse succeeds on these — migrate itself must hold the line.
    for (const doc of ['42', '"a string"', 'true', 'null', '[1,2,3]'] as const) {
      const state = migrate(JSON.parse(doc));
      expect(state.schemaVersion).toBe(SCHEMA_VERSION);
      expect(state.items).toEqual([]);
    }
  });
});

/* ---------- 2. wrong-type fields ---------- */

describe('wrong-type fields', () => {
  const WRONG_TYPES = {
    schemaVersion: 'eight',
    items: 'not an array',
    outfits: null,
    wearLogs: { a: 1 },
    wishlist: false,
    settings: 42,
    circle: 'nobody',
    events: 'friday',
    furniture: 17,
    photoEncoding: 'carrier-pigeon',
  };

  test('every collection comes back a valid collection, every default lands', () => {
    const state = migrate(WRONG_TYPES);
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.items).toEqual([]);
    expect(state.outfits).toEqual([]);
    expect(state.wearLogs).toEqual([]);
    expect(state.wishlist).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.furniture).toEqual([]);
    expect(state.circle).toEqual({ profiles: [], groups: [], messages: [], loans: [] });
    // An encoding nobody recognises is repaired to 'inline', never trusted —
    // a path read as a data URI blanks every photograph at once.
    expect(state.photoEncoding).toBe('inline');
    expect(state.settings.categories.length).toBeGreaterThan(0);
    expect(state.settings.theme).toBe('dark');
  });

  test('the provider opens it without a throw', async () => {
    await seed(JSON.stringify(WRONG_TYPES));
    await openWardrobe();
    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(0);
  });

  test('items full of wrong-typed fields are repaired to the invariants, never dropped', () => {
    const state = migrate({
      schemaVersion: 8,
      items: [
        {
          ...SENTINEL,
          season: 'summer', // not an array
          occasion: null, // not an array
          wearCount: 'fourteen', // not a number
          favorite: 'yes', // not a boolean
          laundryStatus: 7, // not a string
          imageUrl: 12, // not a string
          dateAdded: 20260101, // not a string
          cost: '  420 ', // a numeric string — parsed, not dropped
          place: 'the floor', // not a usable pair — dropped
        },
        { ...SENTINEL, id: 'survivor-2', cost: '₹500' }, // unparseable — dropped
        { ...SENTINEL, id: 'survivor-3', cost: -80 }, // negative — dropped
        { ...SENTINEL, id: 'survivor-4', cost: 0 }, // a recorded 0 — KEPT
      ],
    });
    expect(state.items).toHaveLength(4);
    const [a, b, c, d] = state.items;
    expect(a.id).toBe('survivor');
    expect(a.season).toEqual([]);
    expect(a.occasion).toEqual([]);
    expect(a.wearCount).toBe(0);
    expect(a.favorite).toBe(false);
    expect(a.laundryStatus).toBe('clean');
    expect(a.imageUrl).toBe('');
    expect(typeof a.dateAdded).toBe('string');
    expect(a.cost).toBe(420);
    expect(a.place).toBeUndefined();
    expect(b.cost).toBeUndefined();
    expect(c.cost).toBeUndefined();
    expect(d.cost).toBe(0);
  });
});

/* ---------- 3. the shells, v0 through v8 ---------- */

describe('every shell this app has ever written opens (v0 → v8)', () => {
  // One shell per era, each with its era's defining quirk and the sentinel
  // aboard. Minimal on purpose: the web corpus proves the full documents;
  // this proves NO era's skeleton can strand the door.
  const SHELLS: [string, Record<string, unknown>][] = [
    ['v0: the bare pre-schema blob', { items: [SENTINEL] }],
    [
      'v1: fixed categories, boolean wishlist.purchased',
      {
        items: [{ ...SENTINEL, category: 'outerwear' }],
        wishlist: [{ id: 'w1', name: 'A wish', purchased: true }],
      },
    ],
    ['v2: schemaVersion arrives', { schemaVersion: 2, items: [SENTINEL], settings: {} }],
    ['v3: before the circle', { schemaVersion: 3, items: [SENTINEL], outfits: [], wearLogs: [] }],
    [
      'v4: events, with malformed rows aboard',
      { schemaVersion: 4, items: [SENTINEL], events: [null, 'garbage', { id: 'e1', reservations: 'no' }] },
    ],
    [
      'v5: custom occasions on items only',
      { schemaVersion: 5, items: [{ ...SENTINEL, occasion: ['mehndi-night'] }] },
    ],
    [
      'v6: furniture in every broken shape',
      {
        schemaVersion: 6,
        items: [SENTINEL],
        furniture: [
          { id: 'f1', name: 'The unknown form', form: 'spaceship', slots: [] },
          { id: 'f2', form: 'chest', slots: [{ id: 's1' }, { id: 's1' }, { id: 's2', label: 'Top drawer' }] },
          { id: 'f1', name: 'duplicate id — dropped', form: 'chest', slots: [] },
          'not furniture at all',
          null,
        ],
      },
    ],
    [
      'v7: ornaments and packed flags from a hand-edited file',
      {
        schemaVersion: 7,
        items: [SENTINEL],
        furniture: [
          {
            id: 'f1',
            name: 'The almirah',
            form: 'chest',
            ornament: 'art-deco-from-the-future',
            slots: [{ id: 's1', label: 'Inside', packed: 'yes' }],
          },
        ],
      },
    ],
    [
      'v8: the photograph declaration',
      { schemaVersion: 8, items: [SENTINEL], photoEncoding: 'file' },
    ],
  ];

  test.each(SHELLS)('%s', (_label, shell) => {
    const state = migrate(shell);
    // The stamp is always this build's…
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    // …and the sentinel is always alive, with the invariants restored.
    const survivor = state.items.find(i => i.id === 'survivor');
    expect(survivor).toBeDefined();
    expect(survivor!.name).toBe('The piece that must survive');
    expect(typeof survivor!.wearCount).toBe('number');
    expect(Array.isArray(survivor!.season)).toBe(true);
    expect(survivor!.laundryStatus).toBe('clean');
    expect(state.settings.categories.length).toBeGreaterThan(0);
  });

  test('the era quirks each repaired the way the contract says', () => {
    // v1: a bought wish is a bought wish.
    const v1 = migrate(SHELLS[1][1]);
    expect(v1.wishlist[0].status).toBe('bought');
    expect((v1.wishlist[0] as unknown as Record<string, unknown>).purchased).toBeUndefined();

    // v3: the circle arrives empty and valid.
    const v3 = migrate(SHELLS[3][1]);
    expect(v3.circle).toEqual({ profiles: [], groups: [], messages: [], loans: [] });

    // v4: only the well-formed event survives, given a real reservations list.
    const v4 = migrate(SHELLS[4][1]);
    expect(v4.events).toHaveLength(1);
    expect(v4.events[0].reservations).toEqual([]);

    // v5: the item's own vocabulary is adopted into settings.
    const v5 = migrate(SHELLS[5][1]);
    expect(v5.settings.occasions).toContain('mehndi-night');

    // v6: unknown form → chest; zero slots → the floor; duplicate slot ids and
    // duplicate furniture ids dropped; non-objects dropped.
    const v6 = migrate(SHELLS[6][1]);
    expect(v6.furniture).toHaveLength(2);
    expect(v6.furniture[0].form).toBe('chest');
    expect(v6.furniture[0].slots).toEqual([{ id: 'f1-1', label: 'Inside' }]);
    expect(v6.furniture[1].slots.map(s => s.id)).toEqual(['s1', 's2']);

    // v7: an unknown ornament is removed; a truthy-string packed is NOT packed.
    const v7 = migrate(SHELLS[7][1]);
    expect(v7.furniture[0].ornament).toBeUndefined();
    expect(v7.furniture[0].slots[0].packed).toBeUndefined();

    // v8: a declared 'file' encoding is believed.
    const v8 = migrate(SHELLS[8][1]);
    expect(v8.photoEncoding).toBe('file');
  });

  test('a legacy future-dated log gains the planned flag; a past log stays a wear', () => {
    const state = migrate({
      schemaVersion: 5,
      items: [SENTINEL],
      wearLogs: [
        { id: 'l1', date: '2099-01-01', itemIds: ['survivor'] }, // a matured-plan trap
        { id: 'l2', date: '2020-01-01', itemIds: ['survivor'] }, // plainly the past
      ],
    });
    const l1 = state.wearLogs.find(l => l.id === 'l1')!;
    const l2 = state.wearLogs.find(l => l.id === 'l2')!;
    expect(l1.planned).toBe(true);
    expect(l2.planned).toBeUndefined();
  });
});

/* ---------- 4. the document from the future ---------- */

describe('an AppState from the future (v9, unknown keys everywhere)', () => {
  const V9_DOC = {
    schemaVersion: 9,
    // Top-level keys no v8 build has ever heard of.
    mendingLedger: { entries: [{ pieceId: 'survivor', stitch: 'sashiko' }] },
    honors: ['the-oldest-piece', { emoji: '🥇', lineage: true }],
    items: [
      {
        ...SENTINEL,
        season: ['summer'],
        occasion: [],
        imageUrl: '',
        dateAdded: '2026-01-01',
        wearCount: 3,
        favorite: false,
        laundryStatus: 'clean',
        // Item fields from the future.
        fabricWeightGsm: 180,
        mendingState: { patches: 2 },
      },
    ],
    outfits: [],
    wearLogs: [
      { id: 'l1', date: '2026-08-01', itemIds: ['survivor'], v9Mood: 'stormy' },
    ],
    wishlist: [],
    circle: { profiles: [], groups: [], messages: [], loans: [] },
    events: [],
    furniture: [],
    photoEncoding: 'file',
    settings: { categories: [{ id: 'tops', label: 'Tops' }], occasions: ['casual'], theme: 'dark' },
  };

  test('migrate keeps every unknown key and re-stamps the version — that IS the contract', () => {
    const state = migrate(V9_DOC) as ReturnType<typeof migrate> & Record<string, unknown>;
    // The stamp says what this build understands…
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    // …and the unknown keys say everything it does not, kept whole so the
    // v9 build that wrote them reads them back losslessly.
    expect(state.mendingLedger).toEqual(V9_DOC.mendingLedger);
    expect(state.honors).toEqual(V9_DOC.honors);
    expect((state.items[0] as unknown as Record<string, unknown>).fabricWeightGsm).toBe(180);
    expect((state.items[0] as unknown as Record<string, unknown>).mendingState).toEqual({ patches: 2 });
    expect((state.wearLogs[0] as unknown as Record<string, unknown>).v9Mood).toBe('stormy');
    // v9 data itself is not lost.
    expect(state.items[0].wearCount).toBe(3);
    // The photograph declaration from the future is a known value — believed.
    expect(state.photoEncoding).toBe('file');
  });

  test('the provider opens it, an edit lands, and the future keys survive the round-trip', async () => {
    await seed(JSON.stringify(V9_DOC));
    await openWardrobe();

    expect(ctx!.status).toBe('open');
    expect(ctx!.items).toHaveLength(1);
    expect(ctx!.getItem('survivor')!.wearCount).toBe(3);

    act(() => {
      ctx!.logWear(['survivor'], undefined, '2026-08-10');
    });

    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      expect(raw).not.toBeNull();
      const persisted = JSON.parse(raw as string);
      // The edit is aboard…
      expect(persisted.items[0].wearCount).toBe(4);
      expect(persisted.wearLogs).toHaveLength(2);
      // …and NOTHING the future wrote fell off the document.
      expect(persisted.mendingLedger).toEqual(V9_DOC.mendingLedger);
      expect(persisted.honors).toEqual(V9_DOC.honors);
      expect(persisted.items[0].fabricWeightGsm).toBe(180);
      expect(persisted.items[0].mendingState).toEqual({ patches: 2 });
      expect(persisted.wearLogs[0].v9Mood).toBe('stormy');
      expect(persisted.photoEncoding).toBe('file');
      expect(persisted.schemaVersion).toBe(SCHEMA_VERSION);
    });
  });
});
