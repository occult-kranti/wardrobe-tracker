import {
  SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
  DEFAULT_OCCASIONS,
  initialState,
  type AppState,
  type ClothingItem,
  type WishlistItem,
} from '../types';

// Every stored shape this app has ever written must load without loss. Unknown
// keys are preserved verbatim so an export from a newer version can round-trip
// through an older one — "lossless forever" is a promise, not a version.

type Loose = Record<string, unknown>;

const V1_CATEGORY_IDS = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'];

function migrateItem(raw: Loose): ClothingItem {
  const item = { ...raw } as Loose & Partial<ClothingItem>;
  // v1 stored `purchased`-less items with a fixed category union; ids match the
  // new default category ids, so category strings carry over untouched.
  if (typeof item.category !== 'string' || !item.category) item.category = 'tops';
  if (!Array.isArray(item.season)) item.season = [];
  if (!Array.isArray(item.occasion)) item.occasion = [];
  if (typeof item.wearCount !== 'number') item.wearCount = 0;
  if (typeof item.favorite !== 'boolean') item.favorite = false;
  if (typeof item.laundryStatus !== 'string') item.laundryStatus = 'clean';
  if (typeof item.imageUrl !== 'string') item.imageUrl = '';
  if (typeof item.dateAdded !== 'string') item.dateAdded = new Date().toISOString();
  return item as ClothingItem;
}

function migrateWish(raw: Loose): WishlistItem {
  const wish = { ...raw } as Loose & Partial<WishlistItem> & { purchased?: boolean };
  if (!wish.status) {
    // v1 carried a boolean; a bought item is a bought item.
    wish.status = wish.purchased ? 'bought' : 'waiting';
  }
  delete wish.purchased;
  if (typeof wish.priority !== 'string') wish.priority = 'medium';
  if (typeof wish.category !== 'string' || !wish.category) wish.category = 'tops';
  if (typeof wish.dateAdded !== 'string') wish.dateAdded = new Date().toISOString();
  return wish as WishlistItem;
}

export function migrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return { ...initialState };
  const state = { ...(raw as Loose) };

  const items = Array.isArray(state.items) ? state.items.map(i => migrateItem(i as Loose)) : [];
  const wishlist = Array.isArray(state.wishlist) ? state.wishlist.map(w => migrateWish(w as Loose)) : [];
  const outfits = Array.isArray(state.outfits) ? state.outfits : [];
  const wearLogs = Array.isArray(state.wearLogs) ? state.wearLogs : [];

  const storedSettings = (state.settings ?? {}) as Loose;
  const categories = Array.isArray(storedSettings.categories) && storedSettings.categories.length
    ? (storedSettings.categories as AppState['settings']['categories'])
    : DEFAULT_CATEGORIES;
  const occasions = Array.isArray(storedSettings.occasions) && storedSettings.occasions.length
    ? (storedSettings.occasions as string[])
    : DEFAULT_OCCASIONS;

  // Any category id referenced by an item but missing from settings gets adopted,
  // so a hand-edited import or an older custom category never orphans a piece.
  const known = new Set(categories.map(c => c.id));
  const adopted = [...categories];
  for (const item of items) {
    if (!known.has(item.category)) {
      known.add(item.category);
      const fallback = DEFAULT_CATEGORIES.find(c => c.id === item.category);
      adopted.push(fallback ?? { id: item.category, label: item.category });
    }
  }
  // Same for occasion tags — free-form means the closet defines the vocabulary.
  const occasionSet = new Set(occasions);
  for (const item of items) {
    for (const tag of item.occasion) occasionSet.add(tag);
  }

  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    items,
    outfits,
    wearLogs,
    wishlist,
    settings: {
      ...storedSettings,
      categories: adopted,
      occasions: [...occasionSet],
      theme: (storedSettings.theme as AppState['settings']['theme']) ?? 'dark',
    },
  } as AppState;
}

/** V1 keys are still recognized so an old backup file imports cleanly. */
export function isLegacyV1(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const state = raw as Loose;
  if (state.schemaVersion) return false;
  return Array.isArray(state.items) && !state.settings;
}

export { V1_CATEGORY_IDS };
