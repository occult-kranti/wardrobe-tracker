import {
  SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
  DEFAULT_OCCASIONS,
  FURNITURE_FORMS,
  initialState,
  type AppState,
  type ClothingItem,
  type WishlistItem,
} from '../types';
import { isRecordedAmount } from './cost';
import { isFutureDate } from './dates';

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
  // Cost was never sanitized, so a hand-edited export carrying cost: "420"
  // survived to `item.cost.toFixed(0)` and took the detail modal down with it.
  // Parse what can be parsed — losing a recoverable value would break the
  // lossless promise — and drop only what is genuinely not a number. A recorded
  // 0 is a real answer (inherited, gifted) and must survive untouched.
  const rawCost: unknown = (item as Loose).cost;
  if (rawCost !== undefined && !isRecordedAmount(rawCost)) {
    const parsed = typeof rawCost === 'string' ? Number(rawCost.trim()) : NaN;
    if (isRecordedAmount(parsed)) item.cost = parsed;
    else delete item.cost;
  }
  if (typeof item.favorite !== 'boolean') item.favorite = false;
  if (typeof item.laundryStatus !== 'string') item.laundryStatus = 'clean';
  if (typeof item.imageUrl !== 'string') item.imageUrl = '';
  if (typeof item.dateAdded !== 'string') item.dateAdded = new Date().toISOString();
  // v6: where it lives. A place that is not a usable pair is dropped; one that
  // names furniture we have never heard of is KEPT. An unknown id is a filing
  // we cannot READ, not a filing that is wrong — clearing it would lose the
  // grouping for good, which is the exact failure that made Whering's archive
  // feature "the last straw" for its own users.
  const rawPlace: unknown = (item as Loose).place;
  if (rawPlace !== undefined) {
    const p = rawPlace as Loose;
    const ok = !!p && typeof p === 'object'
      && typeof p.furnitureId === 'string' && !!p.furnitureId
      && typeof p.slotId === 'string' && !!p.slotId;
    if (!ok) delete item.place;
  }
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
  // A legacy log with no planned flag and a future date is a plan; a past log
  // with no flag is a wear. A matured legacy plan cannot be told apart from a
  // real wear — that ambiguity is exactly why the flag is stored now.
  const wearLogs = (Array.isArray(state.wearLogs) ? state.wearLogs : []).map(raw => {
    const log = raw as Loose;
    if (log && typeof log === 'object' && log.planned === undefined && typeof log.date === 'string' && isFutureDate(log.date)) {
      return { ...log, planned: true };
    }
    return raw;
  });

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

  // v3: the Shared Rail. Exports from before it gain an empty, valid circle;
  // one that already carries records keeps them untouched.
  const rawCircle = (state.circle ?? {}) as Loose;
  const circle: AppState['circle'] = {
    profiles: Array.isArray(rawCircle.profiles) ? (rawCircle.profiles as AppState['circle']['profiles']) : [],
    groups: Array.isArray(rawCircle.groups) ? (rawCircle.groups as AppState['circle']['groups']) : [],
    messages: Array.isArray(rawCircle.messages) ? (rawCircle.messages as AppState['circle']['messages']) : [],
    loans: Array.isArray(rawCircle.loans) ? (rawCircle.loans as AppState['circle']['loans']) : [],
  };

  // v4: events. Anything that is not a well-formed list is dropped rather than
  // handed to the page — a string here used to be a crash waiting to happen.
  const events = (Array.isArray(state.events) ? state.events : [])
    .filter((e): e is AppState['events'][number] => !!e && typeof e === 'object')
    .map(e => ({ ...e, reservations: Array.isArray(e.reservations) ? e.reservations : [] }));

  // v6: furniture. Repair, never discard — a piece of furniture that arrives
  // malformed still holds clothes, so it is fixed where it can be and dropped
  // only when it has no usable id at all. Unknown fields are spread through
  // untouched so a newer build's furniture round-trips through this one.
  const seenFurniture = new Set<string>();
  const furniture = (Array.isArray(state.furniture) ? state.furniture : [])
    .flatMap((raw): AppState['furniture'] => {
      if (!raw || typeof raw !== 'object') return [];
      const f = { ...(raw as Loose) } as unknown as AppState['furniture'][number];
      if (typeof f.id !== 'string' || !f.id) return [];
      if (seenFurniture.has(f.id)) return [];
      seenFurniture.add(f.id);
      // A nameless piece is named after itself rather than thrown away.
      if (typeof f.name !== 'string' || !f.name.trim()) f.name = f.id;
      // A name longer than the drawing can carry is KEPT WHOLE. The limit is a
      // limit on what may be TYPED — the field carries maxLength — and the
      // drawing clips what it cannot fit at render. Cutting it here would
      // silently shorten a record nobody asked us to edit, and would contradict
      // the rule six lines down that keeps over-long slot lists intact.
      // A form we do not know how to draw becomes a chest, which is the form
      // that can hold anything. It is a wrong picture of a real object, which
      // is recoverable; dropping it would take the addresses with it.
      if (!FURNITURE_FORMS.includes(f.form)) f.form = 'chest';
      const seenSlots = new Set<string>();
      const slots = (Array.isArray(f.slots) ? f.slots : [])
        .flatMap((s): AppState['furniture'][number]['slots'] => {
          if (!s || typeof s !== 'object') return [];
          const slot = { ...(s as unknown as Loose) } as unknown as AppState['furniture'][number]['slots'][number];
          if (typeof slot.id !== 'string' || !slot.id) return [];
          // Two slots with one id means every piece filed in either is filed in
          // both. The second is dropped; its pieces keep a place that resolves.
          if (seenSlots.has(slot.id)) return [];
          seenSlots.add(slot.id);
          if (typeof slot.label !== 'string' || !slot.label.trim()) slot.label = slot.id;
          // v7: packed away. Anything that is not exactly true is not packed —
          // a truthy string from a hand-edited file must not silently remove
          // half a wardrobe from the day's suggestions.
          if (slot.packed !== true) delete slot.packed;
          return [slot];
        });
      // Zero slots is furniture nothing can be filed in — an object that exists
      // and cannot be used. One is the floor.
      f.slots = slots.length > 0 ? slots : [{ id: `${f.id}-1`, label: 'Inside' }];
      // OVER THE CEILING: the extra slots are KEPT, not cut. A file written by
      // a build with a taller drawing than ours still describes real drawers
      // with real clothes in them, and truncating here would orphan every piece
      // filed below the seventh. The drawing is what has a limit, so the
      // drawing is what gives way — it renders what it can and says so. What is
      // refused is only the making of a NEW one over the line.
      if (typeof f.dateAdded !== 'string') f.dateAdded = new Date().toISOString().slice(0, 10);
      return [f];
    });

  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    items,
    outfits,
    wearLogs,
    wishlist,
    circle,
    events,
    furniture,
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
