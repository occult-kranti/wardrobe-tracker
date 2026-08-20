/**
 * THE LEDGER'S ARITHMETIC, checked against the one source of it.
 *
 * Every expectation below is computed HERE by calling `@almari/shared/cost`
 * directly, and separately pinned to a literal ₹ string. Both halves matter
 * and they check different things:
 *
 *   - the shared call proves the room does not carry a second opinion about
 *     money (the web Ledger once printed two different averages for the same
 *     wardrobe 240px apart, which is the defect the shared module exists to
 *     make impossible);
 *   - the literal proves the shared answer itself has not moved. A formatter
 *     that quietly stopped grouping en-IN would pass the first check and fail
 *     the second, and ₹1,41,900 becoming ₹141,900 is a visible regression in
 *     every room at once.
 *
 * THE FIXTURE IS PINNED and its numbers were chosen to exercise the cost
 * module's whole precedence: a paid-for piece with wears, an expensive piece
 * with few, a RECORDED ZERO (gifted — a real answer, not a gap), a piece with
 * no amount recorded at all, a paid-for piece with no wears yet, and a retired
 * piece whose money and wears must stay out of every figure.
 */
import { describe, expect, test } from '@jest/globals';

import { aggregateCostPerWear, costBasis, formatMoney, formatPerWear } from '@almari/shared/cost';
import { DEFAULT_CATEGORIES, DEFAULT_OCCASIONS, type AppSettings, type ClothingItem, type WearLog } from '@almari/shared/types';

import { ledgerFigures } from '../src/components/ledger/figures';

const SETTINGS: AppSettings = { categories: DEFAULT_CATEGORIES, occasions: DEFAULT_OCCASIONS };

function piece(id: string, category: string, extra: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id,
    name: id,
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
  } as ClothingItem;
}

/** The pinned wardrobe. Five active pieces and one retired. */
const ITEMS: ClothingItem[] = [
  piece('i-oxford', 'tops', { cost: 4500, wearCount: 30 }),
  piece('i-coat', 'outerwear', { cost: 129000, wearCount: 12 }),
  // A recorded zero: gifted. Counted as a piece, never as spend.
  piece('i-scarf', 'accessories', { cost: 0, wearCount: 4 }),
  // No amount on the record at all — different from the scarf, by contract.
  piece('i-linen', 'tops', { wearCount: 6 }),
  piece('i-boots', 'shoes', { cost: 8400, wearCount: 0 }),
  piece('i-old', 'tops', {
    cost: 2000,
    wearCount: 50,
    retired: { date: '2026-05-05', reason: 'passed on' },
  }),
];

const ACTIVE = ITEMS.filter(i => i.retired === undefined);

const LOGS: WearLog[] = [
  { id: 'w1', date: '2026-08-01', itemIds: ['i-oxford'] },
  { id: 'w2', date: '2026-08-02', itemIds: ['i-coat'] },
  { id: 'w3', date: '2026-08-03', itemIds: ['i-scarf', 'i-linen'] },
  // A plan is not a wear.
  { id: 'w4', date: '2026-08-04', itemIds: ['i-oxford'], planned: true },
  // Neither is a day that has not happened. Pinned far enough out that this
  // suite does not start lying in 2027.
  { id: 'w5', date: '2099-01-01', itemIds: ['i-coat'] },
] as WearLog[];

const figures = ledgerFigures({
  items: ITEMS,
  activeItems: ACTIVE,
  outfits: [{ id: 'o1' }, { id: 'o2' }] as never,
  wearLogs: LOGS,
  settings: SETTINGS,
});

describe('the ledger figures', () => {
  test('the money is the shared module’s answer, to the character', () => {
    const shared = aggregateCostPerWear(ACTIVE);

    // 4500 + 129000 + 8400. The gifted scarf's recorded zero is not spend,
    // and the retired piece's 2000 has left the closet.
    expect(figures.cost.basis).toBe(141900);
    expect(figures.cost.basis).toBe(shared.basis);
    expect(formatMoney(figures.cost.basis)).toBe('₹1,41,900');

    // 30 + 12 + 0 — the wears of the pieces that money bought. The linen's 6
    // and the scarf's 4 are not in the denominator: nobody paid for them.
    expect(figures.cost.wears).toBe(42);
    expect(figures.cost.wears).toBe(shared.wears);

    expect(figures.cost.costedPieces).toBe(3);
    expect(formatPerWear(figures.cost.value)).toBe(formatPerWear(shared.value));
    expect(formatPerWear(figures.cost.value)).toBe('₹3,378.57');
  });

  test('a recorded zero is a piece with a price, and an absent one is not', () => {
    // The scarf and the boots both fall outside `costedPieces`; only one of
    // them has anybody's answer on the record, and the empty-cost card says a
    // different sentence for each.
    expect(costBasis(ACTIVE.find(i => i.id === 'i-scarf') as ClothingItem)).toBe(0);
    expect(costBasis(ACTIVE.find(i => i.id === 'i-linen') as ClothingItem)).toBeUndefined();
    // oxford, coat, scarf, boots — four of the five. The linen has nothing.
    expect(figures.recordedPrices).toBe(4);
  });

  test('retired pieces sit outside every figure, and are counted once', () => {
    expect(figures.pieces).toBe(5);
    // 30 + 12 + 4 + 6 + 0. The retired piece's 50 wears are not here.
    expect(figures.wears).toBe(52);
    expect(figures.retired).toBe(1);
  });

  test('plans and future dates are not days logged', () => {
    expect(figures.daysLogged).toBe(3);
  });

  test('worn, unworn, and the money resting in what has not been worn', () => {
    expect(figures.worn).toBe(4);
    expect(figures.unworn).toBe(1);
    expect(figures.resting).toBe(8400);
    expect(formatMoney(figures.resting)).toBe('₹8,400');
  });

  test('categories are ordered by the quantity drawn beside them', () => {
    expect(figures.categories.rows.map(r => [r.label, r.wears, r.pieces])).toEqual([
      ['Tops', 36, 2],
      ['Outerwear', 12, 1],
      ['Accessories', 4, 1],
      ['Shoes', 0, 1],
    ]);
    expect(figures.categories.max).toBe(36);
  });
});

describe('a wardrobe carrying an old import’s dirty amounts', () => {
  /**
   * `item.cost && …` was the idiom at six call sites before the cost module,
   * and `?? 0` is the same mistake wearing a newer operator: a string cost out
   * of a hand-edited import CONCATENATES into a running total, and a negative
   * one subtracts from money that is resting. Both are unreachable through the
   * app's own forms and entirely reachable through import, which is the door
   * this product promises stays open forever.
   */
  const dirty = [
    piece('d-clean', 'shoes', { cost: 8400 }),
    piece('d-string', 'tops', { cost: '2400' as unknown as number }),
    piece('d-negative', 'tops', { cost: -500 }),
    piece('d-nan', 'accessories', { cost: Number.NaN }),
  ];

  const f = ledgerFigures({
    items: dirty,
    activeItems: dirty,
    outfits: [],
    wearLogs: [],
    settings: SETTINGS,
  });

  test('money resting is what was actually recorded, and nothing else', () => {
    // Only the one honest amount. `?? 0` would answer '84002400-500' — a
    // string — or NaN, and print it as money.
    expect(f.resting).toBe(8400);
    expect(typeof f.resting).toBe('number');
    expect(formatMoney(f.resting)).toBe('₹8,400');
  });

  test('spend is the same one amount, through the same sanitizer', () => {
    expect(f.cost.basis).toBe(8400);
    expect(f.cost.costedPieces).toBe(1);
    expect(f.recordedPrices).toBe(1);
  });
});

describe('a wardrobe with nothing paid for', () => {
  const free = [
    piece('f-1', 'tops', { wearCount: 3 }),
    piece('f-2', 'shoes', { wearCount: 1 }),
  ];

  test('states no spend and no average, rather than a zero', () => {
    const f = ledgerFigures({
      items: free,
      activeItems: free,
      outfits: [],
      wearLogs: [],
      settings: SETTINGS,
    });
    expect(f.cost.basis).toBe(0);
    expect(f.cost.costedPieces).toBe(0);
    expect(f.recordedPrices).toBe(0);
    // Null, not 0 — "₹0.00 per wear" would assert a purchase nobody made.
    expect(f.cost.value).toBeNull();
    expect(formatPerWear(f.cost.value)).toBe('—');
  });
});
