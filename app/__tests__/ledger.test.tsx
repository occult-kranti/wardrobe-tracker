/**
 * THE LEDGER, through the real router and the real provider.
 *
 * Rendered through the router tree — root layout, WardrobeProvider, the
 * AsyncStorage adapter and migrate-on-read included — so what these tests
 * exercise is the shipped path and the strings a person actually reads.
 *
 * THE CHECK THIS ROOM EXISTS TO SURVIVE is that its money is the web's money.
 * The fixture below is pinned and every ₹ string is asserted twice: once as a
 * literal, and once against `@almari/shared/cost` called here in the test. A
 * room that grew its own formatter, its own denominator, or its own opinion
 * about a recorded zero fails the second assertion while looking perfectly
 * plausible on screen — which is exactly how the web Ledger came to print two
 * different averages for one wardrobe 240px apart.
 *
 * THE OTHER LAWS HELD HERE: no percentage and no completion anywhere on the
 * screen; a wardrobe with no prices gets a sentence rather than silence; a
 * wardrobe that has worn nothing is stated, never scolded; retired pieces sit
 * outside the arithmetic and are acknowledged once; and a cold deep link with
 * no wardrobe on the device goes to the door (R7).
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
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

import { aggregateCostPerWear, formatMoney, formatPerWear } from '@almari/shared/cost';
import type { ClothingItem } from '@almari/shared/types';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

const ACCOUNT = {
  id: 'acct-1',
  name: 'Test wardrobe',
  handle: '@test',
  monogram: 'T',
  color: '#105F7D',
  createdAt: '2026-08-01',
};

const piece = (id: string, name: string, category: string, extra: object = {}) => ({
  id,
  name,
  category,
  color: '#D9C4A3',
  season: [],
  occasion: [],
  imageUrl: '',
  dateAdded: '2026-01-04',
  wearCount: 0,
  favorite: false,
  laundryStatus: 'clean',
  ...extra,
});

const shell = (items: object[], extra: object = {}) =>
  JSON.stringify({
    schemaVersion: 8,
    items,
    outfits: [],
    wearLogs: [],
    wishlist: [],
    circle: { profiles: [], groups: [], messages: [], loans: [] },
    events: [],
    furniture: [],
    photoEncoding: 'inline',
    ...extra,
  });

/**
 * THE PINNED WARDROBE. Chosen to walk the cost module's whole precedence: a
 * paid-for workhorse, an expensive coat with few wears, a RECORDED ZERO (the
 * gifted scarf — an answer, not a gap), a piece with no amount recorded at
 * all, a paid-for piece not yet worn, and one retired piece whose money and
 * wears must stay out of every figure on the screen.
 */
const PRICED_ITEMS = [
  piece('i-oxford', 'The white oxford', 'tops', { cost: 4500, wearCount: 30 }),
  piece('i-coat', 'The winter coat', 'outerwear', { cost: 129000, wearCount: 12 }),
  piece('i-scarf', 'The wool scarf', 'accessories', { cost: 0, wearCount: 4 }),
  piece('i-linen', 'The good linen shirt', 'tops', { wearCount: 6 }),
  piece('i-boots', 'The brown boots', 'shoes', { cost: 8400, wearCount: 0 }),
  piece('i-old', 'The first jumper', 'tops', {
    cost: 2000,
    wearCount: 50,
    retired: { date: '2026-05-05', reason: 'passed on' },
  }),
];

const PRICED = shell(PRICED_ITEMS, {
  outfits: [
    { id: 'o-1', name: 'Monday', itemIds: ['i-oxford'], dateCreated: '2026-02-01', wearCount: 0, favorite: false },
    { id: 'o-2', name: 'The good one', itemIds: ['i-coat'], dateCreated: '2026-02-02', wearCount: 0, favorite: false },
  ],
  wearLogs: [
    { id: 'w1', date: '2026-08-01', itemIds: ['i-oxford'] },
    { id: 'w2', date: '2026-08-02', itemIds: ['i-coat'] },
    { id: 'w3', date: '2026-08-03', itemIds: ['i-scarf', 'i-linen'] },
    // A plan is not a wear, and a day that has not happened is not a day logged.
    { id: 'w4', date: '2026-08-04', itemIds: ['i-oxford'], planned: true },
    { id: 'w5', date: '2099-01-01', itemIds: ['i-coat'] },
  ],
});

/** The same closet with nobody's prices in it. */
const UNPRICED = shell([
  piece('u-1', 'The linen shirt', 'tops', { wearCount: 3 }),
  piece('u-2', 'The canvas shoes', 'shoes', { wearCount: 1 }),
]);

/** Everything on the record was given, and recorded as given: zero is an answer. */
const ALL_GIFTED = shell([
  piece('g-1', 'Grandmother’s shawl', 'accessories', { cost: 0, wearCount: 5 }),
  piece('g-2', 'The handed-down coat', 'outerwear', { cost: 0, wearCount: 2 }),
]);

/** Pieces on the rail, nothing worn yet, money resting in them. */
const NOTHING_WORN = shell([
  piece('n-1', 'The new shirt', 'tops', { cost: 4500 }),
  piece('n-2', 'The new boots', 'shoes', { cost: 8400 }),
  piece('n-3', 'The new scarf', 'accessories', { cost: 1200 }),
]);

async function seed(doc: string) {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: ACCOUNT.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ACCOUNT]));
  await storage.setItem(wardrobeKey(ACCOUNT.id), doc);
}

/** Every string the screen is currently printing, flattened. */
function allText(root: { findAllByType: (t: never) => unknown[] }): string[] {
  return root.findAllByType('Text' as never).map(node => {
    const kids = (node as { props: { children?: unknown } }).props.children;
    return Array.isArray(kids) ? kids.flat(9).join('') : String(kids ?? '');
  });
}

beforeEach(async () => {
  await seed(PRICED);
});

/* ============ the accounts ============ */

describe('the ledger', () => {
  test('the masthead names the room and counts days logged, not wears', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    expect(await view.findByText('Ledger')).toBeTruthy();
    // Three real logs. The plan and the day in 2099 are not days logged, and
    // the item-wear total (52) is a different number with a different name.
    expect(view.getByText('3 days logged')).toBeTruthy();
  });

  test('the money on the screen is the shared module’s money, to the character', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');

    const active = PRICED_ITEMS.filter(i => !('retired' in i)) as unknown as ClothingItem[];
    const shared = aggregateCostPerWear(active);

    // 4500 + 129000 + 8400. The gifted scarf's recorded zero is not spend, and
    // the retired jumper's 2000 has left the closet.
    expect(formatMoney(shared.basis)).toBe('₹1,41,900');
    expect(formatPerWear(shared.value)).toBe('₹3,378.57');

    // Printed twice on purpose: the plate states it, the sentence divides it.
    expect(view.getAllByText('₹1,41,900').length).toBeGreaterThan(0);
    expect(view.getByText('₹3,378.57')).toBeTruthy();
    expect(view.getByText(/across 42 wears of the pieces it bought/)).toBeTruthy();
    // The denominator is named beside the heading, never hidden in the sum.
    expect(view.getByText('3 priced pieces')).toBeTruthy();
  });

  test('the totals are cumulative facts, and the two wear counts keep their own names', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');

    expect(view.getByText('In the closet')).toBeTruthy();
    expect(view.getByText('5')).toBeTruthy();
    // 30 + 12 + 4 + 6 + 0 — the retired jumper's 50 are not in it.
    expect(view.getByText('Wears recorded')).toBeTruthy();
    expect(view.getByText('52')).toBeTruthy();
    expect(view.getByText('Outfits')).toBeTruthy();
    expect(view.getByText('Not worn yet')).toBeTruthy();
  });

  test('every category is listed in the same ink, ordered by the bar drawn beside it', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');

    expect(view.getByLabelText('Tops: 36 wears, 2 pieces')).toBeTruthy();
    expect(view.getByLabelText('Outerwear: 12 wears, 1 piece')).toBeTruthy();
    expect(view.getByLabelText('Accessories: 4 wears, 1 piece')).toBeTruthy();
    // A quiet category is quiet: it is listed, it states its count, and it is
    // never asked to explain itself.
    expect(view.getByLabelText('Shoes: 0 wears, 1 piece')).toBeTruthy();
    expect(allText(view.root).join('|')).not.toMatch(/unworn|neglected|wasted|should|why not/i);
  });

  test('retired pieces sit outside the arithmetic and are acknowledged once', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');
    expect(view.getByText('1 piece retired, their history kept')).toBeTruthy();
    // Its 50 wears and its 2000 never joined a figure.
    expect(view.queryByText('102')).toBeNull();
    expect(view.queryByText('₹1,43,900')).toBeNull();
  });

  test('nothing on this screen is a percentage, a score, or an alarm', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');
    for (const text of allText(view.root)) {
      expect(text).not.toMatch(/%/);
      expect(text).not.toMatch(/\b(complete|completion|progress|streak|goal|score|rank)\b/i);
      // Copy law: roughly one exclamation point for the whole app, and it is
      // not spent in the room that does the arithmetic.
      expect(text).not.toMatch(/!/);
    }
  });

  test('the room carries its own way back to the House', async () => {
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    expect(await view.findByLabelText('Back to the House')).toBeTruthy();
  });
});

/* ============ the empty-cost card ============ */

describe('a wardrobe with no prices', () => {
  test('gets the one-field-away sentence, not silence', async () => {
    await seed(UNPRICED);
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');

    // The plate still stands and still states both figures — as em dashes,
    // because "₹0" would assert a purchase nobody made. The heading is the
    // web's "Cost"; the label under the numeral is its "What it cost".
    expect(view.getByText('Cost')).toBeTruthy();
    expect(view.getByText('What it cost')).toBeTruthy();
    expect(view.getByText('Average per wear')).toBeTruthy();
    expect(view.getAllByText('—').length).toBe(2);
    expect(
      view.getByText(/A price is optional — and it is the one thing cost per wear needs\./),
    ).toBeTruthy();
    expect(view.getByText(/Put one on a piece in the closet/)).toBeTruthy();
    // No denominator is claimed when there is nothing in it.
    expect(view.queryByText(/priced piece/)).toBeNull();
  });

  test('a closet that was entirely given says so, rather than claiming no price', async () => {
    await seed(ALL_GIFTED);
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');
    // A recorded zero is an answer; the sentence for "nobody said" would be a
    // lie about a wardrobe that answered.
    expect(view.getByText(/Every amount on the record is zero/)).toBeTruthy();
    expect(view.queryByText(/it is the one thing cost per wear needs/)).toBeNull();
  });
});

/* ============ the zero-wear stance ============ */

describe('a wardrobe that has worn nothing yet', () => {
  test('is stated as a balance, never as a score or a reproach', async () => {
    await seed(NOTHING_WORN);
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await view.findByText('Ledger');

    expect(view.getByText(/3 pieces have not had a first wear yet\./)).toBeTruthy();
    // 4500 + 8400 + 1200, through the shared sanitizer.
    expect(view.getByText(/₹14,100 is resting here\./)).toBeTruthy();
    // "0 of 3" beside a heading is a scoreboard whatever the sentence says.
    expect(view.queryByText('0 of 3')).toBeNull();
    // Paid for and not worn: an average is not asserted, and the money is not
    // divided by nothing.
    expect(view.getByText(/on the record, resting so far/)).toBeTruthy();
    expect(view.getByText('—')).toBeTruthy();
  });
});

/* ============ the empty room, and the door ============ */

describe('the ledger with nothing on the record', () => {
  test('teaches one thing and offers one way on', async () => {
    await seed(shell([]));
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    expect(await view.findByText('The ledger is still empty.')).toBeTruthy();
    expect(view.getByText(/divides what a piece cost by one more/)).toBeTruthy();
    expect(view.getByLabelText('Open the closet')).toBeTruthy();
  });

  test('cold-opened with no wardrobe on the device, it goes to the door (R7)', async () => {
    await AsyncStorage.clear();
    const view = renderRouter('./src/app', { initialUrl: '/ledger' });
    await waitFor(() => expect(view.getPathname()).toBe('/open'));
  });
});
