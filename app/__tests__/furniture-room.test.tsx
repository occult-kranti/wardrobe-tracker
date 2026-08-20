/**
 * THE DRESSING ROOM, through the real router and the real provider.
 *
 * Rendered through the router tree — root layout, WardrobeProvider, the
 * AsyncStorage adapter and migrate-on-read included — so what these tests
 * exercise is the shipped path, not a double of it.
 *
 * THE CHECK THIS FEATURE EXISTS TO SURVIVE is "removing furniture never
 * removes clothes", mirrored from scripts/test-features.mjs's own assertion:
 * count the pieces in the stored document before and after, and read every
 * wear back afterwards. Furniture is a filing system laid over a wardrobe; the
 * day it can take a garment with it, it has become a way to lose things.
 *
 * The other laws held here: a place opens to its own drawing, a compartment is
 * tapped rather than chosen from a list, a shelf-full is filed in one gesture,
 * the ceilings say why they are ceilings, and no surface anywhere states a
 * percentage or a completion.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Image } from 'react-native';
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

import { defaultSlotLabels } from '../src/components/furniture/forms';
import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';
import { useWardrobe, WardrobeProvider } from '../src/lib/wardrobe';
import { FURNITURE_FORMS, type AppState } from '@almari/shared/types';

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

/** A furnished wardrobe: one chest of three drawers, four pieces, two filed. */
const FURNISHED = JSON.stringify({
  schemaVersion: 8,
  items: [
    piece('i-oxford', 'The white oxford', {
      wearCount: 14,
      place: { furnitureId: 'f-chest', slotId: 'f-chest-s1' },
    }),
    piece('i-linen', 'The good linen shirt', {
      wearCount: 3,
      place: { furnitureId: 'f-chest', slotId: 'f-chest-s1' },
    }),
    piece('i-jumper', 'The navy jumper', { wearCount: 9 }),
    piece('i-scarf', 'The wool scarf', { wearCount: 1 }),
  ],
  outfits: [],
  wearLogs: [],
  wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [
    {
      id: 'f-chest',
      name: 'Bedroom chest',
      form: 'chest',
      dateAdded: '2026-07-01',
      slots: [
        { id: 'f-chest-s1', label: 'Top drawer' },
        { id: 'f-chest-s2', label: 'Second drawer' },
        { id: 'f-chest-s3', label: 'Bottom drawer' },
      ],
    },
  ],
  photoEncoding: 'inline',
});

/** The same wardrobe with nothing in it and nowhere to put anything. */
const BARE = JSON.stringify({
  schemaVersion: 8,
  items: [piece('i-jumper', 'The navy jumper', { wearCount: 9 })],
  outfits: [],
  wearLogs: [],
  wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [],
  photoEncoding: 'inline',
});

async function seed(doc: string) {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: ACCOUNT.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ACCOUNT]));
  await storage.setItem(wardrobeKey(ACCOUNT.id), doc);
}

/** What is actually on the shelf, after the provider's 250ms settle. */
async function stored(): Promise<AppState> {
  const raw = await storage.getItem(wardrobeKey(ACCOUNT.id));
  return JSON.parse(raw ?? '{}') as AppState;
}

/**
 * Run the clock out: the provider's 250ms write window (docs/34 §2.4 law 1 —
 * one write per committed state) and the house toast's dismissal timer, which
 * stands for nine seconds when a notice carries an Undo.
 *
 * Both are advanced rather than waited out, because jest-expo runs the tests
 * on fake timers and a real wait never returns under a faked clock. Draining
 * the toast matters as much as draining the write: showToast keeps its queue
 * in MODULE state, so a notice left standing at the end of one test is found
 * by the next one's query — and each test gets a fresh clock, so a notice not
 * drained here can never be drained at all.
 */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(12000);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  await seed(FURNISHED);
});

/* ============ the room ============ */

describe('the dressing room', () => {
  test('an unfurnished wardrobe is invited, never scolded', async () => {
    await seed(BARE);
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    expect(await shell.findByText('Nothing has an address yet.')).toBeTruthy();
    expect(shell.getByLabelText('Draw a place')).toBeTruthy();
    // No count of what is not filed when there is nowhere to file it.
    expect(shell.queryByText(/no address\./)).toBeNull();
  });

  test('a furnished wardrobe draws its places and states a flat count of the unfiled', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    expect(await shell.findByText('Dressing room')).toBeTruthy();
    expect(shell.getByText('Bedroom chest')).toBeTruthy();
    expect(shell.getByText('3 drawers · 2 pieces')).toBeTruthy();
    // A bank balance, never a ratio (brand law 11 — no progress-as-achievement).
    expect(
      shell.getByText(
        /2 pieces have no address\. Nothing needs one — a place is a convenience, not a requirement\./,
      ),
    ).toBeTruthy();
  });

  test('nothing in the room is a percentage or a completion', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    await shell.findByText('Bedroom chest');
    for (const node of shell.root.findAllByType('Text' as never)) {
      const kids = (node as { props: { children?: unknown } }).props.children;
      const text = Array.isArray(kids) ? kids.join('') : String(kids ?? '');
      expect(text).not.toMatch(/%/);
      expect(text).not.toMatch(/\b(complete|progress|streak)\b/i);
    }
  });

  test('the room carries its own way back — it has no slot on the house bar', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    expect(await shell.findByLabelText('Back to the closet')).toBeTruthy();
  });
});

/* ============ drawing a place ============ */

describe('draw a place', () => {
  test('the drawing changes as the controls move, and Draw it opens the place', async () => {
    await seed(BARE);
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    fireEvent.press(await shell.findByLabelText('Draw a place'));

    // The nine forms, and the two that are the point of the furniture pass.
    expect(await shell.findByLabelText('A steel almirah')).toBeTruthy();
    expect(shell.getByLabelText('A wooden almirah')).toBeTruthy();
    for (const label of ['A jewellery box', 'A row of pegs', 'A bangle stand', 'A shoe rack']) {
      expect(shell.getByLabelText(label)).toBeTruthy();
    }

    fireEvent.press(shell.getByLabelText('A chest'));
    // The default is four drawers; one more makes five, and the noun agrees.
    expect(shell.getByLabelText('4 drawers')).toBeTruthy();
    fireEvent.press(shell.getByLabelText('One more drawer'));
    expect(shell.getByLabelText('5 drawers')).toBeTruthy();

    fireEvent.changeText(shell.getByLabelText('What to call it'), 'Hall chest');
    fireEvent.press(shell.getByLabelText('Draw it'));

    // The place opens to its own drawing, and the compartments are controls.
    expect(await shell.findByText('Hall chest')).toBeTruthy();
    expect(shell.getByLabelText('Top drawer, 0 pieces')).toBeTruthy();
    expect(shell.getByLabelText('Bottom drawer, 0 pieces')).toBeTruthy();

    await settle();
    const doc = await stored();
    expect(doc.furniture).toHaveLength(1);
    expect(doc.furniture[0].name).toBe('Hall chest');
    expect(doc.furniture[0].slots).toHaveLength(5);
  });

  test('a form stops at its own ceiling, and says why', async () => {
    await seed(BARE);
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    fireEvent.press(await shell.findByLabelText('Draw a place'));

    // Pegs cap at five; trays at four. Different drawings, different ceilings.
    fireEvent.press(shell.getByLabelText('A row of pegs'));
    for (let i = 0; i < 8; i++) fireEvent.press(shell.getByLabelText('One more peg'));
    expect(shell.getByLabelText('5 pegs')).toBeTruthy();
    expect(shell.getByText(/5 is as many as this drawing holds/)).toBeTruthy();
    expect(shell.getByText(/A 6th peg is a second place\./)).toBeTruthy();

    fireEvent.press(shell.getByLabelText('A jewellery box'));
    for (let i = 0; i < 8; i++) fireEvent.press(shell.getByLabelText('One more tray'));
    expect(shell.getByLabelText('4 trays')).toBeTruthy();
  });

  test('a carved treatment is offered on the fitted almirah and on nothing else', async () => {
    await seed(BARE);
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    fireEvent.press(await shell.findByLabelText('Draw a place'));

    fireEvent.press(shell.getByLabelText('A chest'));
    expect(shell.queryByLabelText('Mughal')).toBeNull();

    fireEvent.press(shell.getByLabelText('A fitted almirah'));
    expect(shell.getByLabelText('Mughal')).toBeTruthy();
    fireEvent.press(shell.getByLabelText('Shoji'));
    fireEvent.press(shell.getByLabelText('Draw it'));

    await settle();
    const doc = await stored();
    expect(doc.furniture[0].ornament).toBe('shoji');
  });

  test('a nameless place is still a place', async () => {
    await seed(BARE);
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    fireEvent.press(await shell.findByLabelText('Draw a place'));
    fireEvent.press(shell.getByLabelText('A rail'));
    fireEvent.press(shell.getByLabelText('Draw it'));
    await settle();
    const doc = await stored();
    expect(doc.furniture).toHaveLength(1);
    expect(doc.furniture[0].name).toBe('A place');
  });
});

/* ============ the compartment names the preview promises ============ */

describe('the preview does not lie about what will be stored', () => {
  /**
   * The slot names are STORED DATA — they travel through sync and export, so a
   * chest drawn on the phone must arrive in the browser reading "Top drawer".
   * The provider mirrors defaultSlotLabels privately (app/src/lib/wardrobe.tsx)
   * and the draw-a-place preview mirrors it again (components/furniture/
   * forms.ts). Two mirrors of one rule is one mirror too many, and this is the
   * guard that catches them parting company.
   */
  test('every form, every count: the provider stores exactly what the preview drew', async () => {
    await seed(BARE);
    let ctx: ReturnType<typeof useWardrobe> | null = null;
    function Probe() {
      ctx = useWardrobe();
      return null;
    }
    render(
      <WardrobeProvider>
        <Probe />
      </WardrobeProvider>,
    );
    await waitFor(() => expect(ctx?.status).toBe('open'));

    for (const form of FURNITURE_FORMS) {
      for (const n of [1, 2, 4]) {
        const name = `${form} ${n}`;
        // Found by NAME, not by the returned id: addFurniture's id is not
        // reliable under React's batched updates (reported to squad A), and
        // this test is about the labels, not about that.
        act(() => {
          ctx!.addFurniture(name, form, n, 'plain');
        });
        await waitFor(() => expect(ctx!.furniture.find(f => f.name === name)).toBeTruthy());
        const made = ctx!.furniture.find(f => f.name === name)!;
        expect(made.slots.map(s => s.label)).toEqual(defaultSlotLabels(form, made.slots.length));
        act(() => {
          ctx!.removeFurniture(made.id);
        });
        await waitFor(() => expect(ctx!.furniture).toHaveLength(0));
      }
    }
  });
});

/* ============ filing ============ */

describe('filing a piece', () => {
  test('a compartment is tapped, and a shelf-full is filed in one gesture', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    expect(await shell.findByText('Bedroom chest')).toBeTruthy();

    // The second drawer is empty, and says so without being scolded about it.
    fireEvent.press(shell.getByLabelText('Second drawer, 0 pieces'));
    expect(await shell.findByText('Nothing in here yet.')).toBeTruthy();

    fireEvent.press(shell.getByLabelText('Put things in'));
    expect(await shell.findByText('Put things in Second drawer')).toBeTruthy();
    fireEvent.press(shell.getByLabelText('The navy jumper'));
    fireEvent.press(shell.getByLabelText('The wool scarf'));
    fireEvent.press(shell.getByLabelText('File 2 pieces here'));

    expect(await shell.findByText(/Put away\. 2 pieces are in Second drawer\./)).toBeTruthy();
    // The drawing itself now says so — the count travels with the target.
    expect(shell.getByLabelText('Second drawer, 2 pieces')).toBeTruthy();

    await settle();
    const doc = await stored();
    const placed = doc.items.filter(i => i.place?.slotId === 'f-chest-s2').map(i => i.id);
    expect(placed.sort()).toEqual(['i-jumper', 'i-scarf']);
  });

  test('taking a piece out gives it no address, and takes nothing else', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    expect(await shell.findByText('The white oxford')).toBeTruthy();
    fireEvent.press(shell.getByLabelText('Take out The white oxford'));
    expect(await shell.findByText(/Taken out\./)).toBeTruthy();

    await settle();
    const doc = await stored();
    const oxford = doc.items.find(i => i.id === 'i-oxford')!;
    // Absent, not empty — and every wear it earned is still on it.
    expect(oxford.place).toBeUndefined();
    expect('place' in oxford).toBe(false);
    expect(oxford.wearCount).toBe(14);
    expect(doc.items).toHaveLength(4);
  });

  test('the route-param contract: /furniture/<place>?file=<item> files on one tap', async () => {
    const shell = renderRouter('./src/app', {
      initialUrl: '/furniture/f-chest?file=i-jumper',
    });
    // The place says what it is being asked, rather than looking like a visit.
    expect(await shell.findByText('Finding a place for')).toBeTruthy();
    expect(shell.getByText('The navy jumper')).toBeTruthy();

    fireEvent.press(shell.getByLabelText('Bottom drawer, 0 pieces'));
    expect(await shell.findByText(/Put away\. The navy jumper is in Bottom drawer\./)).toBeTruthy();

    await settle();
    const doc = await stored();
    expect(doc.items.find(i => i.id === 'i-jumper')!.place).toEqual({
      furnitureId: 'f-chest',
      slotId: 'f-chest-s3',
    });
  });

  test('the room, carrying a piece, asks which place before it asks which compartment', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture?file=i-jumper' });
    expect(await shell.findByText('Finding a place for')).toBeTruthy();
    expect(
      shell.getByText(/Open the place it lives in, then tap the compartment\./),
    ).toBeTruthy();
    // Nothing is written by arriving.
    await settle();
    const doc = await stored();
    expect(doc.items.find(i => i.id === 'i-jumper')!.place).toBeUndefined();
  });
});

/* ============ the photographs ============ */

describe('a piece filed in a compartment shows its photograph, flat', () => {
  /**
   * `imageUrl` holds a path under the document directory on native and a data:
   * URI in a document the WEB app wrote. photos.ts resolves both, and answers
   * null for anything else — a value pointing off the sandbox must draw the
   * flat rather than a frame, and must never become a way to read the phone.
   */
  test('a stored path resolves to a file uri; anything else falls back to the colour', async () => {
    await seed(
      JSON.stringify({
        ...JSON.parse(FURNISHED),
        items: [
          piece('i-a', 'The photographed one', {
            imageUrl: 'photos/p-1.jpg',
            place: { furnitureId: 'f-chest', slotId: 'f-chest-s1' },
          }),
          piece('i-b', 'The one pointing elsewhere', {
            imageUrl: 'https://example.invalid/x.png',
            place: { furnitureId: 'f-chest', slotId: 'f-chest-s1' },
          }),
        ],
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    expect(await shell.findByText('The photographed one')).toBeTruthy();

    const images = shell.UNSAFE_getAllByType(Image);
    const uris = images.map(i => String((i.props as { source?: { uri?: string } }).source?.uri));
    // Exactly one frame: the stored path, resolved to an absolute file uri.
    expect(uris).toHaveLength(1);
    expect(uris[0]).toMatch(/photos\/p-1\.jpg$/);
    expect(uris[0]).not.toBe('photos/p-1.jpg');
    // The off-sandbox one drew nothing, and its piece is still listed.
    expect(shell.getByText('The one pointing elsewhere')).toBeTruthy();
  });
});

/* ============ THE CHECK THIS FEATURE EXISTS TO SURVIVE ============ */

describe('removing a place', () => {
  test('a warning stands before the removal, and names what happens to the clothes', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    fireEvent.press(await shell.findByLabelText('Remove this place'));
    expect(
      await shell.findByText(
        /This removes “Bedroom chest” from the dressing room\. The 2 pieces filed in it stay in the closet with every wear they earned/,
      ),
    ).toBeTruthy();
    expect(shell.getByLabelText('Remove it')).toBeTruthy();
    expect(shell.getByLabelText('Cancel')).toBeTruthy();
    await settle();
  });

  test('removing furniture never removes clothes (mirrors scripts/test-features.mjs)', async () => {
    const before = await stored();
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    fireEvent.press(await shell.findByLabelText('Remove this place'));
    fireEvent.press(shell.getByLabelText('Remove it'));

    expect(
      await shell.findByText(
        /Removed\. The 2 pieces stay in the closet; they simply stop having an address\./,
      ),
    ).toBeTruthy();

    await settle();
    const after = await stored();
    // The count, first and loudest.
    expect(after.items).toHaveLength(before.items.length);
    // Then every wear, name and cost — a chest leaving the room takes the
    // ADDRESS and nothing else.
    for (const was of before.items) {
      const now = after.items.find(i => i.id === was.id)!;
      expect(now.name).toBe(was.name);
      expect(now.wearCount).toBe(was.wearCount);
      expect(now.place).toBeUndefined();
    }
    expect(after.furniture).toHaveLength(0);
  });

  test('the removal offers Undo, and Undo puts the place back with its contents', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    fireEvent.press(await shell.findByLabelText('Remove this place'));
    fireEvent.press(shell.getByLabelText('Remove it'));
    fireEvent.press(await shell.findByLabelText('Undo'));

    expect(await shell.findByText('Bedroom chest')).toBeTruthy();
    await settle();
    const doc = await stored();
    expect(doc.furniture).toHaveLength(1);
    expect(doc.items.filter(i => i.place?.furnitureId === 'f-chest')).toHaveLength(2);
  });

  test('an empty place says so rather than counting to zero at you', async () => {
    await seed(
      JSON.stringify({
        ...JSON.parse(FURNISHED),
        items: [piece('i-jumper', 'The navy jumper', { wearCount: 9 })],
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-chest' });
    fireEvent.press(await shell.findByLabelText('Remove this place'));
    expect(
      await shell.findByText(/Nothing is filed in it, so no clothes are touched\./),
    ).toBeTruthy();
  });

  test('a place that is gone is not an error, and says nothing was lost', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-nothing' });
    expect(await shell.findByText('No record of this place.')).toBeTruthy();
    expect(
      shell.getByText(/Nothing filed in it was lost — those pieces simply stopped having an address\./),
    ).toBeTruthy();
  });
});
