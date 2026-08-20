/**
 * The sample wardrobe — a walk-through, not a record.
 *
 * Deliberately NOT the web's demoData (that seed is web-owned and heavy;
 * docs/34 §2.8 keeps persona/demo data out of the shared lift until its
 * photo paths are resolved). This is a small inline closet in the house
 * voice: ten pieces, a few honest wears, every cost story the ledger knows
 * how to tell — a real per-wear figure, a recorded zero (inherited), a cost
 * nobody stated, a piece never worn yet.
 *
 * MARKED AS A SAMPLE THROUGHOUT, three ways:
 *  - the account row carries `isSample: true` (the web's own flag — the
 *    sync client refuses samples by this field, docs/34 §4);
 *  - the document carries a top-level `sample: true`, an unknown key that
 *    migrate() preserves losslessly, so the blob says what it is even when
 *    it travels alone;
 *  - every item carries `sample: true` the same way.
 *
 * Owner decision (docs/35): personas and samples are always labelled as
 * samples. Copy law holds: the pieces are addressed as clothes, no
 * exclamation points, nothing about anybody's body.
 */
import { addDays, todayLocal } from '@almari/shared/dates';
import {
  initialState,
  PRESET_COLORS,
  type AppState,
  type ClothingItem,
  type WearLog,
} from '@almari/shared/types';

/** Bumped when the seed changes, so an old sample can be rebuilt at boot. */
export const SAMPLE_SEED_VERSION = 1;

export const SAMPLE_ACCOUNT_ID = 'sample-wardrobe';

/** The registry row for the sample — shaped like the web's Account. */
export const SAMPLE_ACCOUNT = {
  id: SAMPLE_ACCOUNT_ID,
  name: 'The sample wardrobe',
  handle: '@sample',
  tagline: 'A closet to walk through, not to keep.',
  monogram: 'S',
  color: PRESET_COLORS[17], // a muted study green, from the house palette
  isSample: true,
  seedVersion: SAMPLE_SEED_VERSION,
} as const;

type SampleItem = ClothingItem & { sample: true };

function piece(
  overrides: Partial<ClothingItem> &
    Pick<ClothingItem, 'id' | 'name' | 'category' | 'color' | 'wearCount'>
): SampleItem {
  return {
    season: [],
    occasion: [],
    imageUrl: '',
    dateAdded: '2026-06-01T00:00:00.000Z',
    favorite: false,
    laundryStatus: 'clean',
    sample: true,
    ...overrides,
  } as SampleItem;
}

/**
 * Built fresh each call so the wear-log dates sit in the caller's own last
 * week — a sample that opens onto a live Today, not a stale one.
 */
export function buildSampleState(): AppState & { sample: true } {
  const today = todayLocal();

  const items: SampleItem[] = [
    piece({
      id: 'sample-oxford', name: 'The white oxford', category: 'tops',
      color: '#F4EFE2', cost: 2400, wearCount: 14, occasion: ['work'],
      lastWorn: addDays(today, -1),
    }),
    piece({
      id: 'sample-jeans', name: 'Indigo straight jeans', category: 'bottoms',
      color: '#31415E', cost: 3200, wearCount: 21, occasion: ['casual'],
      lastWorn: addDays(today, -1),
    }),
    piece({
      id: 'sample-kurta', name: 'The block-print kurta', category: 'tops',
      color: '#BE1231', cost: 1800, wearCount: 9, occasion: ['casual', 'party'],
      lastWorn: addDays(today, -3),
    }),
    piece({
      id: 'sample-shawl', name: "The grandmother's shawl", category: 'layers',
      color: '#8B6B8F', cost: 0, wearCount: 12, source: 'inherited', favorite: true,
      notes: 'Free is a real answer — it was hers first.',
      lastWorn: addDays(today, -6),
    }),
    piece({
      id: 'sample-trousers', name: 'Charcoal wool trousers', category: 'bottoms',
      color: '#3A362E', cost: 2800, wearCount: 6, occasion: ['work', 'formal'],
      season: ['fall', 'winter'], lastWorn: addDays(today, -6),
    }),
    piece({
      id: 'sample-jutti', name: 'The wedding jutti', category: 'shoes',
      color: '#C9A227', cost: 2200, wearCount: 2, occasion: ['formal', 'party'],
    }),
    piece({
      id: 'sample-sandals', name: 'Everyday sandals', category: 'shoes',
      color: '#5E4232', cost: 900, wearCount: 30, occasion: ['casual'],
      lastWorn: addDays(today, -3),
    }),
    piece({
      id: 'sample-linen', name: 'The good linen shirt', category: 'tops',
      color: '#D9C4A3', cost: 2600, wearCount: 0, occasion: ['casual'],
      notes: 'Waiting on its first wear. The ledger counts from there.',
    }),
    piece({
      id: 'sample-jhumkas', name: 'Silver jhumkas', category: 'jewellery',
      color: '#A8A39E', wearCount: 7, occasion: ['party'],
      notes: 'Nobody wrote down what these cost, and that is allowed.',
    }),
    piece({
      id: 'sample-tote', name: 'The market tote', category: 'accessories',
      color: '#2E6B4F', cost: 450, wearCount: 18, occasion: ['casual'],
      lastWorn: addDays(today, -1),
    }),
  ];

  const wearLogs: WearLog[] = [
    { id: 'sample-log-1', date: addDays(today, -1), itemIds: ['sample-oxford', 'sample-jeans', 'sample-tote'] },
    { id: 'sample-log-2', date: addDays(today, -3), itemIds: ['sample-kurta', 'sample-sandals'] },
    { id: 'sample-log-3', date: addDays(today, -6), itemIds: ['sample-shawl', 'sample-trousers'] },
  ];

  return {
    ...initialState,
    items,
    wearLogs,
    sample: true,
  };
}
