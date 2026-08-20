/**
 * The wardrobe, in memory and on the shelf.
 *
 * Ports the semantics of src/context/WardrobeContext.tsx +
 * src/hooks/useLocalStorage.ts over the AsyncStorage adapter
 * (src/lib/storage.ts). docs/34 §2.4's four laws, each with its line here:
 *
 *  1. WRITES NEVER HAPPEN INSIDE THE STATE UPDATER — one write per
 *     committed state, coalesced over the same 250 ms settle window the
 *     web uses (the persist effect below).
 *  2. A FAILED WRITE IS SAID OUT LOUD — once per run of trouble, not per
 *     keystroke (the `errored` ref + the storage-full toast).
 *  3. PENDING WRITES FLUSH ON BACKGROUNDING/UNMOUNT — the web's pagehide
 *     maps to RN's AppState 'background'/'inactive'.
 *  4. MIGRATE ON READ — every load passes the document through migrate()
 *     from @almari/shared/migrate before anything trusts it. This closes
 *     the seam storage.ts left open: a v7 export, or the bare pre-account
 *     blob the web once wrote, opens correctly here.
 *
 * The maths and the day-handling come from @almari/shared only — logWear's
 * dates are local YYYY-MM-DD via shared/dates, never toISOString(), and a
 * future date is a PLAN (stored flag, exactly as the web decided after the
 * matured-plan bug).
 *
 * SYNC, NOW HERE, exactly where the web keeps it (src/context/
 * WardrobeContext.tsx): the provider that owns the state owns the push.
 * The session (src/lib/session.tsx) is consumed OPTIONALLY — this provider's
 * own tests mount it bare, and a wardrobe that never heard of accounts is
 * the founding case, not an error. The push is keyed on the committed state
 * and compared by content, so an adopted pull does not echo straight back
 * up; backgrounding QUEUES a pending push rather than sending it (a fetch
 * started on the way down may die silently, a storage write survives);
 * samples never reach the wire — shouldSync refuses them.
 *
 * PHOTOGRAPHS ARE FILES HERE, and this provider is where the document comes
 * to agree with the disk. lib/photos.ts writes the bytes under the app's
 * document directory and hands back a path; `item.imageUrl` holds that path,
 * and the moment one is written `photoEncoding` is stamped 'file' so the
 * document says out loud which kind of string its photographs are (shared
 * types, schema v8 — the field Wave 1 built for exactly this). The file is
 * removed on the same breath as the record that pointed at it: replacing a
 * photograph deletes the one it replaced, and a piece losing its photograph
 * loses the file too. Nothing else in the app may delete a photo file — an
 * orphan wastes kilobytes, a wrongly-deleted one is somebody's only picture
 * of a garment.
 *
 * What is deliberately NOT here yet: the corrupted-document "export the
 * corpse" offer (Phase 0 edge case, tracked; today a corrupt read falls back
 * to a fresh state exactly as the web's hook does).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState as RNAppState } from 'react-native';

import { isFutureDate, todayLocal } from '@almari/shared/dates';
import { migrate } from '@almari/shared/migrate';
import {
  FORM_MAX_SLOTS,
  initialState,
  isActive,
  MAX_FURNITURE,
  type Account,
  type AppState,
  type AppSettings,
  type CircleProfile,
  type ClothingItem,
  type Furniture,
  type FurnitureForm,
  type Loan,
  type Occasion,
  type Ornament,
  type Outfit,
  type SyncMode,
  type WearLog,
  type WishlistItem,
} from '@almari/shared/types';

import { showToast } from '../components/Toast';
import { isInlinePhoto, removePhoto, savePhoto, storedPath } from './photos';
import { handleFor, mintSyncId, monogramFor, useSessionOptional } from './session';
import {
  ACCOUNTS_KEY,
  LEGACY_KEY,
  SESSION_KEY,
  storage,
  wardrobeKey,
} from './storage';
import {
  loadPulled,
  onSyncAdopted,
  pushNow,
  queuePush,
  shouldSync,
  syncModeOf,
} from './sync';
import { buildSampleState, SAMPLE_ACCOUNT } from './sampleWardrobe';

/** The web's own settle window (src/hooks/useLocalStorage.ts). */
const SETTLE_MS = 250;

/**
 * Hermes ships no crypto.randomUUID and expo-crypto is not among our deps
 * (a new dependency is an owner decision). Ids are opaque strings — the
 * house's own Toast already mints them this way. Not a formula; no shared
 * source exists for it.
 */
function newId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}${rand()}`;
}

/**
 * How many compartments a form may be given. FORM_MAX_SLOTS is shared data
 * (packages/shared/types.ts) and the ONLY source of it; this is the web's
 * maxSlotsFor with the same fallback, not a second table.
 */
function maxSlotsFor(form: FurnitureForm): number {
  return FORM_MAX_SLOTS[form] ?? 8;
}

/**
 * DEFAULT SLOT NAMES — a verbatim mirror of defaultSlotLabels in
 * src/lib/furnitureArt.ts.
 *
 * Mirrored rather than imported because that file is a DOM-coupled drawing
 * module the app cannot reach (docs/34 §2.8 keeps only packages/shared
 * crossing), and mirrored rather than simplified because these labels are
 * STORED DATA, not chrome: they go into the document at creation and travel
 * through sync and export. A chest made on the phone must arrive in the
 * browser reading "Top drawer", not "Compartment 1", or the same wardrobe
 * describes itself two ways depending on which app drew it.
 * __tests__/wardrobe-furniture pins every form's answers.
 */
const FITTED_LABELS = [
  'Hanging ledge', 'Shelves', 'Jewels', 'Locker', 'Bags', 'Shoes', 'Drawer',
];

function defaultSlotLabels(form: FurnitureForm, count: number): string[] {
  if (form === 'almirah' || form === 'almirah-carved') {
    // Named after the parts, in the order the parts are in — because an
    // almirah is not N of the same thing, and "Compartment 2" would be a
    // worse name for the locker than the locker already has.
    const shelves = Math.max(0, count - 1 - (count >= 3 ? 1 : 0) - (count >= 4 ? 1 : 0));
    const shelfNames =
      shelves === 0 ? []
        : shelves === 1 ? ['Shelves']
          : shelves === 2 ? ['Upper', 'Lower']
            : ['Upper', 'Middle', 'Lower'].slice(0, shelves);
    return [
      'The hanging side',
      ...(count >= 3 ? ['Locker'] : []),
      ...shelfNames,
      ...(count >= 4 ? ['The drawer'] : []),
    ].slice(0, count);
  }
  if (form === 'almirah-fitted') {
    return FITTED_LABELS.slice(0, count);
  }
  if (form === 'rail') {
    return count === 1 ? ['The rail'] : Array.from({ length: count }, (_, i) => `Section ${i + 1}`);
  }
  if (form === 'hooks') {
    return count === 1 ? ['The peg'] : Array.from({ length: count }, (_, i) => `Peg ${i + 1}`);
  }
  if (form === 'box') {
    if (count === 1) return ['The tray'];
    const names = ['Top tray', 'Second tray', 'Third tray', 'Bottom tray'];
    return Array.from({ length: count }, (_, i) => names[i] ?? `Tray ${i + 1}`);
  }
  if (form === 'stand' || form === 'rack') {
    const noun = 'tier';
    if (count === 1) return [`The ${noun}`];
    const ordinals = ['Top', 'Second', 'Third', 'Fourth', 'Fifth'];
    return Array.from({ length: count }, (_, i) =>
      i === count - 1 ? `Bottom ${noun}` : `${ordinals[i]} ${noun}`);
  }
  const noun = form === 'shelves' ? 'shelf' : 'drawer';
  if (count === 1) return [`The ${noun}`];
  if (count > 6) {
    return Array.from({ length: count }, (_, i) => `${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1}`);
  }
  const ordinals = ['Top', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? `Bottom ${noun}` : `${ordinals[i]} ${noun}`);
}

/**
 * Is this `imageUrl` a file this app put on the disk?
 *
 * The one question that decides whether the document should declare
 * photoEncoding 'file'. A data: URI is not (that is what the web writes and
 * what sync brings down); an empty string is not; a path under our document
 * directory is.
 */
function isStoredPhoto(imageUrl: string | undefined): boolean {
  const raw = (imageUrl ?? '').trim();
  if (!raw || isInlinePhoto(raw)) return false;
  return storedPath(raw) !== null;
}

/**
 * The document, told the truth about how it holds its photographs.
 *
 * Stamped ONLY when a file-backed photograph actually lands. A document that
 * came down from the web app holds data URIs and must keep saying 'inline'
 * until one of its pieces genuinely points at a file, because the field is a
 * statement of fact and a wrong one blanks every photograph at once (the
 * failure migrate.ts's own comment describes).
 */
function stampFilePhotos(prev: AppState): AppState {
  return prev.photoEncoding === 'file' ? prev : { ...prev, photoEncoding: 'file' };
}

/**
 * A registry row, shaped as the web's Account (shared/types). Unknown keys
 * on rows written by other builds are preserved on rewrite — the registry
 * obeys the same lossless manners as the document.
 */
interface AccountRow {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  color: string;
  createdAt: string;
  isSample?: boolean;
  seedVersion?: number;
  sync?: SyncMode;
  syncId?: string;
  [key: string]: unknown;
}

/** The registry row in the shared Account shape the sync client speaks. */
function toSharedAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    monogram: row.monogram,
    color: row.color,
    createdAt: row.createdAt,
    ...(row.isSample === true ? { isSample: true } : {}),
    ...(row.sync ? { sync: row.sync } : {}),
    ...(row.syncId ? { syncId: row.syncId } : {}),
  };
}

/**
 * A person on the rail, put on the record without disturbing one already there.
 *
 * A VERBATIM MIRROR of upsertProfile in src/context/WardrobeContext.tsx, and
 * mirrored rather than imported for the same reason the slot labels are: it
 * lives inside a web context module the app cannot reach, and what it writes is
 * STORED DATA that travels through sync and export. The one asymmetry is the
 * web's own and is deliberate — `isMe` may be raised on a profile that already
 * exists, but nothing else about an existing profile is ever overwritten. A
 * lend must never quietly rewrite somebody's name or colour from whatever the
 * caller happened to be holding.
 */
function upsertProfile(
  profiles: CircleProfile[],
  account: Account,
  isMe = false,
): CircleProfile[] {
  const existing = profiles.find(p => p.id === account.id);
  if (existing) {
    if (!isMe || existing.isMe) return profiles;
    return profiles.map(p => (p.id === account.id ? { ...p, isMe: true } : p));
  }
  return [
    ...profiles,
    {
      id: account.id,
      handle: account.handle,
      name: account.name,
      monogram: account.monogram,
      color: account.color,
      lendable: [],
      showcase: [],
      ...(isMe ? { isMe: true } : {}),
    },
  ];
}

export type WardrobeStatus = 'loading' | 'none' | 'open';

/**
 * The fields a look is allowed to be WITHOUT — and so the only ones `null` may
 * take off the record. A look's name, its pieces and its pin are part of what a
 * look IS; clearing those would not empty a field, it would break a record.
 */
type OutfitClearable = 'occasion' | 'notes' | 'stylingNote' | 'imageUrl';

/**
 * What may be amended on a look.
 *
 * Deliberately not Partial<Outfit>: `id` and `dateCreated` are the record's
 * identity and `wearCount` / `lastWorn` belong to logWear alone. A patch type
 * that could reach them is a patch type that will, one day, reset somebody's
 * wear count to zero because a form field was blank.
 *
 * NULL IS THE CLEAR SENTINEL (lead ruling R4). The three states are distinct
 * and all three are needed: ABSENT (or undefined) means this patch says nothing
 * about the field and it is left exactly as it was; a VALUE sets it; NULL takes
 * it off the record entirely. Without the third, an occasion chosen once could
 * never be un-chosen — the form had no way to say "none" that did not also
 * mean "leave it alone" — and a look would carry a tag its owner had already
 * changed their mind about, forever.
 *
 * Cleared means ABSENT, never blank: a look whose occasion is cleared here must
 * be byte-identical to one the web wrote that never had an occasion at all,
 * because those two looks are the same look and an export cannot say otherwise.
 */
export type OutfitPatch = Partial<Pick<Outfit, 'name' | 'itemIds' | 'favorite'>> & {
  [K in OutfitClearable]?: Outfit[K] | null;
};

/** The same list, at runtime — see updateOutfit for why both exist. */
const OUTFIT_PATCHABLE = [
  'name',
  'itemIds',
  'occasion',
  'favorite',
  'notes',
  'stylingNote',
  'imageUrl',
] as const satisfies ReadonlyArray<keyof OutfitPatch>;

/** The clearable subset, at runtime. Same reason both forms exist. */
const OUTFIT_CLEARABLE: ReadonlySet<string> = new Set<OutfitClearable>([
  'occasion',
  'notes',
  'stylingNote',
  'imageUrl',
]);

/**
 * What may be amended on a wish. Same three-state rule as OutfitPatch, same
 * reason: a brand typed by mistake, a price that turned out to be wrong, a
 * cooling-off wait that has been answered — each has to be removable, and
 * "removable" cannot share a spelling with "unmentioned".
 *
 * `id` and `dateAdded` are the record's identity and are not patchable at all.
 */
type WishClearable = 'brand' | 'price' | 'imageUrl' | 'link' | 'notes' | 'coolingOff' | 'releasedAt';

export type WishPatch = Partial<
  Pick<WishlistItem, 'name' | 'category' | 'color' | 'priority' | 'status'>
> & {
  [K in WishClearable]?: WishlistItem[K] | null;
};

const WISH_PATCHABLE = [
  'name',
  'category',
  'color',
  'brand',
  'price',
  'imageUrl',
  'link',
  'priority',
  'notes',
  'status',
  'coolingOff',
  'releasedAt',
] as const satisfies ReadonlyArray<keyof WishPatch>;

const WISH_CLEARABLE: ReadonlySet<string> = new Set<WishClearable>([
  'brand',
  'price',
  'imageUrl',
  'link',
  'notes',
  'coolingOff',
  'releasedAt',
]);

/**
 * ONE PATCH, APPLIED — the whitelist enforced at RUNTIME, not only in a type.
 *
 * A consumer that types its own alias wider (one already does:
 * app/src/components/outfits/contract.ts declares Partial<Outfit>) can hand a
 * patcher a `wearCount`, and TypeScript will not stop it, because a wider
 * parameter type is a legal way to call a narrower one. A spread would then
 * quietly reset somebody's wear count from a form field that happened to be
 * blank. Wears are days that happened; only logWear and removeWearLog may move
 * them, so the guarantee is made here, where it cannot be typed around.
 */
function applyPatch<T extends object>(
  record: T,
  patch: Record<string, unknown>,
  patchable: readonly string[],
  clearable: ReadonlySet<string>,
): T {
  const next: T = { ...record };
  const bag = next as unknown as Record<string, unknown>;
  for (const key of patchable) {
    const value = patch[key];
    // Silence about a field is not an instruction about it.
    if (value === undefined) continue;
    if (value === null) {
      // Absent, not blanked. A field a record is not allowed to be without
      // ignores the sentinel rather than obeying it into a broken row.
      if (clearable.has(key)) delete bag[key];
      continue;
    }
    bag[key] = value;
  }
  return next;
}

interface WardrobeContextValue {
  /** 'none' means the door has not been walked through yet. */
  status: WardrobeStatus;
  items: ClothingItem[];
  /** Active (non-retired) items — what every browse surface should use. */
  activeItems: ClothingItem[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  settings: AppSettings;
  /** Sample wardrobes are labelled everywhere and never sync. */
  isSample: boolean;
  wardrobeName: string | null;
  /** The open wardrobe's registry row, in the shared Account shape the sync
      client speaks — the blob's address, exposed for sync. Null at the door. */
  syncAccount: Account | null;
  /** Where the record lives — 'device' unless its owner chose otherwise. */
  syncMode: SyncMode;
  /** The per-wardrobe toggle. Mints the remote row's uuid on first 'cloud';
      turning it off keeps the id, so turning it back on finds the same row.
      Refuses samples — a worked example belongs to the device. */
  setSyncMode: (mode: SyncMode) => Promise<void>;
  /** Returns the new piece's id, so a caller writing several can relate them. */
  addItem: (item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => string;

  /* ---------- looks ---------- */

  /**
   * Build a look. Returns its id, or null when there is nothing to build one
   * from — a look needs a name and at least one piece, and a refusal that
   * answers null lets the caller say what is missing rather than writing an
   * empty record nobody asked for.
   */
  addOutfit: (name: string, itemIds: string[], occasion?: Occasion) => string | null;
  /**
   * Amend a look. Ports the web's field-by-field edits; wears are never
   * patched, and `null` takes a clearable field off the record (R4).
   */
  updateOutfit: (id: string, patch: OutfitPatch) => void;
  /**
   * Ports deleteOutfit: the look goes, every piece in it keeps everything.
   * Returns the way to put it back — the same put-it-back closure
   * removeFurniture hands out, for the same reason (R3). A caller that does
   * not want an undo may ignore it.
   */
  removeOutfit: (id: string) => () => void;

  /* ---------- the wishlist: the list that cools ---------- */

  /** Everything on the list, in the order it was added. Every status. */
  wishlist: WishlistItem[];
  /** Put something on the list. Returns its id. */
  addWish: (wish: Omit<WishlistItem, 'id' | 'dateAdded'>) => string;
  /**
   * Amend a wish. `null` clears a clearable field; `id` and `dateAdded` are
   * the record's identity and cannot be reached.
   *
   * KEEP AND LET GO ARE EXPRESSED HERE, and both halves matter. The web's
   * keepWishlistItem/releaseWishlistItem each set the status AND mark the
   * cooling-off question asked, because the contract is that the card asks
   * ONCE and then never again; a patch that moves the status and leaves
   * `coolingOff.asked` false would let the same question come back. So:
   *   keep    → { status: 'kept',   coolingOff: { ...w.coolingOff, asked: true } }
   *   let go  → { status: 'let-go', releasedAt: todayLocal(),
   *               coolingOff: { ...w.coolingOff, asked: true } }
   * (`coolingOff` is left alone when the wish never had one.)
   */
  updateWish: (id: string, patch: WishPatch) => void;
  /** Take a wish off the list. Returns the put-it-back closure. */
  removeWish: (id: string) => () => void;
  /**
   * It was bought. The piece joins the closet at zero wears and the wish stays
   * on the record as 'bought' — ports moveWishlistToCloset. Returns the new
   * piece's id, or null when there is no such wish.
   */
  promoteWish: (id: string) => string | null;

  /* ---------- the shared rail's ledger: what is out, and with whom ---------- */

  /** This wardrobe's own loans. Local records; nothing here is a social graph. */
  loans: Loan[];
  /** Ports recordLoan: an accepted ask opens a loan out of THIS closet. */
  recordLoan: (pieceName: string, me: Account, other: Account) => void;
  /** Ports closeLoan: "home again" closes the open loan for that piece. */
  closeLoan: (pieceName: string, withId: string) => void;

  /* ---------- furniture: where a piece lives ---------- */

  /** The furniture a piece can be filed in. Empty until someone draws one. */
  furniture: Furniture[];
  /**
   * Make a place. Returns its id, or null when this wardrobe already holds
   * MAX_FURNITURE — the ceiling governs what may be MADE and never what may
   * be READ, so a document that already holds more arrives and stays intact.
   */
  addFurniture: (
    name: string,
    form: FurnitureForm,
    slotCount: number,
    ornament?: Ornament,
  ) => string | null;
  /**
   * A chest leaving the room, never clothes leaving the closet: every piece
   * filed in it keeps its name, photograph, wears, cost and history and loses
   * only its address. Returns the way to put the whole thing back — the web's
   * own undo closure, never a field-by-field inverse, which is how half-
   * restores happen.
   */
  removeFurniture: (id: string) => () => void;
  /**
   * File a piece into a compartment, or unfile it.
   *
   * The web spells this `filePiece(itemId, place | null)`; the app's shape is
   * flat because the two ids are how every caller here already holds it. A
   * null furnitureId or slotId REMOVES the address — absent is a real answer
   * and by far the commonest one, and an unfiled piece must never read as an
   * error, a chore, or a count.
   */
  filePiece: (itemId: string, furnitureId: string | null, slotId?: string | null) => void;

  /* ---------- photographs ---------- */

  /**
   * Give a piece a photograph. Takes a picker uri or a data URI, writes the
   * file, points the record at it, stamps photoEncoding 'file', and deletes
   * whatever photograph it replaced. Rejects with the house's storage
   * sentence when the disk refuses — a photograph silently not saved is the
   * one failure a person cannot see until they go looking.
   */
  setItemPhoto: (itemId: string, dataUrlOrUri: string) => Promise<void>;
  /** Take a piece's photograph off the record and off the disk. */
  removeItemPhoto: (itemId: string) => Promise<void>;

  logWear: (itemIds: string[], outfitId?: string, date?: string) => void;
  /** Undo — the web's removeWearLog, lastWorn recomputed from what survives. */
  removeWearLog: (id: string) => void;
  getItem: (id: string) => ClothingItem | undefined;
  /** The door's two handles. */
  startEmpty: (name?: string) => Promise<void>;
  startSample: () => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

async function readJson(key: string): Promise<unknown> {
  const raw = await storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // The web's hook answers corrupt JSON with the initial value; migrate(null)
    // is that same answer here. Nothing already saved is overwritten until the
    // person changes something.
    return null;
  }
}

async function readAccounts(): Promise<AccountRow[]> {
  const parsed = await readJson(ACCOUNTS_KEY);
  return Array.isArray(parsed) ? (parsed as AccountRow[]) : [];
}

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WardrobeStatus>('loading');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [state, setState] = useState<AppState>(initialState);

  /**
   * The last committed state, readable SYNCHRONOUSLY.
   *
   * React runs a setState updater when it pleases, not when it is called, so
   * anything that reads the old value from inside an updater and uses it
   * afterwards reads null. Two things here need the previous value in the
   * same breath as the change and cannot wait: the photograph being REPLACED
   * (whose file has to be deleted) and the undo closure removeFurniture hands
   * back (which has to hold the whole state that existed before it ran). Both
   * read this instead.
   */
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  // The state just hydrated from the shelf is not news — writing it back
  // would only re-serialize what was just read (the web's `mounted` skip).
  const hydrating = useRef(true);
  const pending = useRef<{ key: string; value: AppState } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errored = useRef(false);

  /* ---------- load: migrate on read (law 4) ---------- */

  const hydrate = useCallback((id: string, row: AccountRow | null, doc: unknown) => {
    hydrating.current = true;
    setActiveId(id);
    setAccount(row);
    setState(migrate(doc));
    setStatus('open');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = (await readJson(SESSION_KEY)) as { activeId?: string } | null;
        let id = typeof session?.activeId === 'string' ? session.activeId : null;
        let accounts = await readAccounts();

        // The pre-accounts closet at the bare key is adopted, never orphaned —
        // ports src/lib/accounts.ts adoptLegacyWardrobe, same row, same id.
        if (!id) {
          const legacy = await storage.getItem(LEGACY_KEY);
          if (legacy !== null) {
            const adopted: AccountRow = {
              id: 'you',
              name: 'Your wardrobe',
              handle: '@you',
              monogram: 'Y',
              color: 'var(--color-accent)',
              createdAt: todayLocal(),
            };
            await storage.setItem(wardrobeKey(adopted.id), legacy);
            await storage.removeItem(LEGACY_KEY);
            accounts = [...accounts.filter(a => a.id !== adopted.id), adopted];
            await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
            await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: adopted.id }));
            id = adopted.id;
          }
        }

        if (cancelled) return;
        if (!id) {
          setStatus('none');
          return;
        }
        const doc = await readJson(wardrobeKey(id));
        if (cancelled) return;
        hydrate(id, accounts.find(a => a.id === id) ?? null, doc);
      } catch {
        if (!cancelled) setStatus('none');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  /* ---------- persist: coalesced, spoken failures, flushed (laws 1–3) ---------- */

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    storage
      .setItem(job.key, JSON.stringify(job.value))
      .then(() => {
        errored.current = false;
      })
      .catch(() => {
        // Said once per run of trouble, not once per keystroke.
        if (!errored.current) {
          errored.current = true;
          showToast(
            'This device would not take the write — its storage is full. Export a backup from Settings now, then remove a few photographs.',
            'error',
          );
        }
      });
  }, []);

  useEffect(() => {
    if (status !== 'open' || activeId === null) return;
    if (hydrating.current) {
      hydrating.current = false;
      return;
    }
    pending.current = { key: wardrobeKey(activeId), value: state };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SETTLE_MS);
  }, [state, status, activeId, flush]);

  useEffect(() => {
    // pagehide/visibilitychange, restated for a phone: backgrounding must
    // not be able to lose an edit made a moment before.
    const sub = RNAppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  /* ---------- cloud sync: this wardrobe only, and only if its owner chose it ----------

     Ports the sync section of src/context/WardrobeContext.tsx over the
     adapter. The push is keyed on the committed state and compared by
     content, so the state just adopted from the account (identical to what
     the account holds) does not echo straight back up. Offline, pushNow
     queues and the session layer flushes on the next foreground moment.
     Samples never reach here — shouldSync refuses them.

     Conflict semantics, stated honestly: last-writer-wins, whole wardrobe at
     a time. A pull that finds a newer row replaces the local record; a push
     stamps updated_at = now. No field-level merge is attempted. */

  const session = useSessionOptional();
  const authUser = session?.authUser ?? null;
  const sharedAccount = useMemo(() => (account ? toSharedAccount(account) : null), [account]);
  const syncOn =
    sharedAccount !== null && authUser !== null && shouldSync(sharedAccount) && !!sharedAccount.syncId;
  const lastPushedJson = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The scheduled-but-unsent push, so backgrounding can still keep it. */
  const pendingPush = useRef<{ account: Account; state: AppState; userId: string } | null>(null);

  useEffect(() => {
    if (!syncOn || !authUser || !sharedAccount?.syncId) return;
    const json = JSON.stringify(state);
    // The first pass after mount is the state just read from the store, and an
    // adopted pull is marked before it is committed — neither is news.
    if (lastPushedJson.current === null) {
      lastPushedJson.current = json;
      return;
    }
    if (json === lastPushedJson.current) return;
    lastPushedJson.current = json;
    if (pushTimer.current !== null) clearTimeout(pushTimer.current);
    pendingPush.current = { account: sharedAccount, state, userId: authUser.id };
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      const job = pendingPush.current;
      pendingPush.current = null;
      if (job) void pushNow(job.account, job.state, job.userId);
    }, 800);
    return () => {
      if (pushTimer.current !== null) clearTimeout(pushTimer.current);
    };
  }, [state, syncOn, authUser, sharedAccount]);

  /**
   * A push still inside its debounce when the app backgrounds, or this
   * provider unmounts, must not evaporate. On backgrounding it is QUEUED
   * rather than sent — a fetch started on the way down can die without
   * either callback, while the queue's storage write survives. On unmount
   * the app is very much alive, so it is simply sent.
   */
  useEffect(() => {
    const stash = () => {
      if (pushTimer.current !== null) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      const job = pendingPush.current;
      pendingPush.current = null;
      if (job) void queuePush(job.account, job.state);
    };
    const send = () => {
      if (pushTimer.current !== null) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      const job = pendingPush.current;
      pendingPush.current = null;
      if (job) void pushNow(job.account, job.state, job.userId);
    };
    const sub = RNAppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') stash();
    });
    return () => {
      sub.remove();
      send();
    };
  }, []);

  // A pull that wrote this wardrobe's store announces itself here; the open
  // provider adopts what was written. (An AsyncStorage write fires no event
  // of its own, so the announcement is the sync module's own registry.)
  useEffect(() => {
    if (activeId === null) return;
    const unsubscribe = onSyncAdopted(adoptedId => {
      if (adoptedId !== activeId) return;
      void loadPulled(activeId).then(pulled => {
        if (!pulled) return;
        // Mark BEFORE committing: the adopted state is what the account
        // holds, so the push effect must not echo it straight back up.
        lastPushedJson.current = JSON.stringify(pulled);
        setState(migrate(pulled));
      });
    });
    return unsubscribe;
  }, [activeId]);

  /**
   * The settings toggle — where the open wardrobe's record lives. Writes the
   * registry row and the in-memory account in the same breath. Mirrors the
   * web's SwitchWardrobe: the first 'cloud' mints the remote row's uuid;
   * flipping back to 'device' keeps it, so the same row is found again. The
   * first copy reaches the account on the next edit, exactly as on the web —
   * the push effect above is keyed on the state, not on the choice.
   */
  const setSyncMode = useCallback(async (mode: SyncMode) => {
    if (!account || account.isSample === true) return;
    const updates: Partial<AccountRow> =
      mode === 'cloud'
        ? { sync: 'cloud', syncId: account.syncId ?? mintSyncId() }
        : { sync: 'device' };
    const accounts = await readAccounts();
    await storage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify(accounts.map(a => (a.id === account.id ? { ...a, ...updates } : a))),
    );
    setAccount(prev => (prev ? { ...prev, ...updates } : prev));
  }, [account]);

  /* ---------- the door ---------- */

  const startEmpty = useCallback(async (name?: string) => {
    const accounts = await readAccounts();
    const trimmed = (name ?? '').trim();
    // A blank name is never a dead end: it becomes "Wardrobe", then
    // "Wardrobe 2" — ports uniqueWardrobeName + createAccount.
    const taken = new Set(accounts.map(a => a.name.trim().toLowerCase()));
    let finalName = trimmed || 'Wardrobe';
    for (let n = 2; taken.has(finalName.toLowerCase()) && n < 500; n++) {
      finalName = `${trimmed || 'Wardrobe'} ${n}`;
    }
    const row: AccountRow = {
      id: `w-${newId().slice(-8)}`,
      name: finalName,
      handle: handleFor(finalName),
      monogram: monogramFor(finalName),
      color: 'var(--color-accent)',
      createdAt: todayLocal(),
    };
    // A wardrobe starts genuinely empty — value at item #1 is the cold-start rule.
    await storage.setItem(wardrobeKey(row.id), JSON.stringify(initialState));
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, row]));
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: row.id }));
    hydrate(row.id, row, initialState);
  }, [hydrate]);

  const startSample = useCallback(async () => {
    const accounts = await readAccounts();
    const doc = buildSampleState();
    const row: AccountRow = { ...SAMPLE_ACCOUNT, createdAt: todayLocal() };
    await storage.setItem(wardrobeKey(row.id), JSON.stringify(doc));
    await storage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([...accounts.filter(a => a.id !== row.id), row]),
    );
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: row.id }));
    hydrate(row.id, row, doc);
  }, [hydrate]);

  /* ---------- the record (ported bodies — WardrobeContext.tsx) ---------- */

  const addItem = useCallback(
    (item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => {
      const newItem: ClothingItem = {
        ...item,
        id: newId(),
        dateAdded: new Date().toISOString(),
        wearCount: 0,
        laundryStatus: 'clean',
      };
      setState(prev => {
        const next = { ...prev, items: [...prev.items, newItem] };
        // A piece arriving WITH a photograph already on the disk (the add
        // sheet saves the file the moment it is chosen, so a person can see
        // it while they type) is the first moment this document holds a file.
        return isStoredPhoto(newItem.imageUrl) ? stampFilePhotos(next) : next;
      });
      return newItem.id;
    },
    [],
  );

  /* ---------- looks (ported bodies — WardrobeContext.tsx addOutfit/deleteOutfit) ---------- */

  const addOutfit = useCallback(
    (name: string, itemIds: string[], occasion?: Occasion): string | null => {
      const trimmed = name.trim();
      // A look with no name, or nothing in it, is not a look. Answering null
      // lets the screen say which of the two is missing.
      const pieces = Array.from(new Set(itemIds.filter(id => id.trim().length > 0)));
      if (!trimmed || pieces.length === 0) return null;
      const outfit: Outfit = {
        id: newId(),
        name: trimmed,
        itemIds: pieces,
        favorite: false,
        dateCreated: new Date().toISOString(),
        wearCount: 0,
        // Absent is the absence of the field, not an empty string in it — so a
        // look with no occasion is byte-identical to one written by the web.
        ...(occasion ? { occasion } : {}),
      };
      setState(prev => ({ ...prev, outfits: [...prev.outfits, outfit] }));
      return outfit.id;
    },
    [],
  );

  /**
   * The whitelist is enforced at RUNTIME (applyPatch), not only in
   * OutfitPatch's type — see that helper for the reason, which is a real
   * consumer and not a hypothetical one. NULL CLEARS (R4), and only the four
   * fields a look is allowed to be without.
   */
  const updateOutfit = useCallback((id: string, patch: OutfitPatch) => {
    setState(prev => ({
      ...prev,
      outfits: prev.outfits.map(o =>
        o.id === id
          ? applyPatch(o, patch as Record<string, unknown>, OUTFIT_PATCHABLE, OUTFIT_CLEARABLE)
          : o,
      ),
    }));
  }, []);

  /**
   * Ports deleteOutfit exactly: the look is filtered out and NOTHING else
   * moves. Every piece keeps every wear it earned while in it, and the wear
   * logs keep their outfitId — a log is a record of a day that happened, and
   * a day does not stop having happened because the look was tidied away.
   *
   * The whole previous state comes back in the closure so a notice can offer
   * Undo (R3, parity with removeFurniture) — never a field-by-field inverse,
   * which is how half-restores happen.
   */
  const removeOutfit = useCallback((id: string) => {
    // Captured NOW, not inside the updater: removeFurniture's own reason —
    // an Undo on a toast can be reached for before React has run anything,
    // and an undo that quietly does nothing is worse than no undo at all.
    const before = stateRef.current;
    setState(prev => ({ ...prev, outfits: prev.outfits.filter(o => o.id !== id) }));
    return () => setState(before);
  }, []);

  /* ---------- the wishlist (ported bodies — WardrobeContext.tsx) ---------- */

  const addWish = useCallback((wish: Omit<WishlistItem, 'id' | 'dateAdded'>): string => {
    const entry: WishlistItem = {
      ...wish,
      id: newId(),
      dateAdded: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, wishlist: [...prev.wishlist, entry] }));
    return entry.id;
  }, []);

  const updateWish = useCallback((id: string, patch: WishPatch) => {
    setState(prev => ({
      ...prev,
      wishlist: prev.wishlist.map(w =>
        w.id === id
          ? applyPatch(w, patch as Record<string, unknown>, WISH_PATCHABLE, WISH_CLEARABLE)
          : w,
      ),
    }));
  }, []);

  const removeWish = useCallback((id: string) => {
    const before = stateRef.current;
    setState(prev => ({ ...prev, wishlist: prev.wishlist.filter(w => w.id !== id) }));
    return () => setState(before);
  }, []);

  /**
   * IT WAS BOUGHT — ports moveWishlistToCloset.
   *
   * The piece joins the closet at ZERO WEARS (a thing you own is a thing you
   * have not worn yet, whatever it cost), and the wish STAYS on the record
   * marked 'bought'. It is not deleted: the web's wishlist prints a bought
   * section from exactly those rows, and the two apps write one document — a
   * promote on the phone that dropped the row would empty a list in the
   * browser that had been there for months. 'bought' is what "off the list"
   * means here; the list that cools is the waiting one.
   *
   * The wish is read from stateRef so the new id can be answered in the same
   * breath, and the guard is repeated inside the updater because a pull can
   * change the document between the read and the commit.
   */
  const promoteWish = useCallback((id: string): string | null => {
    const wish = stateRef.current.wishlist.find(w => w.id === id);
    if (!wish) return null;
    const piece: ClothingItem = {
      id: newId(),
      name: wish.name,
      category: wish.category,
      color: wish.color,
      brand: wish.brand,
      imageUrl: wish.imageUrl || '',
      dateAdded: new Date().toISOString(),
      wearCount: 0,
      favorite: false,
      season: [],
      occasion: [],
      cost: wish.price,
      notes: wish.notes,
      laundryStatus: 'clean',
    };
    setState(prev => {
      if (!prev.wishlist.some(w => w.id === id)) return prev;
      const next: AppState = {
        ...prev,
        items: [...prev.items, piece],
        wishlist: prev.wishlist.map(w => (w.id === id ? { ...w, status: 'bought' as const } : w)),
      };
      // A wish photographed on this phone arrives as a file, and this is the
      // moment the document holds one — the same stamp addItem makes.
      return isStoredPhoto(piece.imageUrl) ? stampFilePhotos(next) : next;
    });
    return piece.id;
  }, []);

  /* ---------- the shared rail's ledger (ported bodies) ---------- */

  /**
   * "Lend it" was pressed in a conversation. The request lives in the shared
   * community store; the loan it opens lives HERE, in the lending wardrobe's
   * own ledger. One open loan per piece and person — a second accept of the
   * same ask opens nothing, which is what makes the button idempotent.
   *
   * Only the owner ever sees those buttons, so the lending side is always the
   * wardrobe doing the writing. The borrower's own rail learns of it the day
   * their app writes their half; no code path here may write it for them.
   */
  const recordLoan = useCallback((pieceName: string, me: Account, other: Account) => {
    setState(prev => {
      const alreadyOut = prev.circle.loans.some(
        l => !l.returned && l.pieceName === pieceName && l.withId === other.id,
      );
      if (alreadyOut) return prev;
      return {
        ...prev,
        circle: {
          ...prev.circle,
          profiles: upsertProfile(upsertProfile(prev.circle.profiles, me, true), other),
          loans: [
            ...prev.circle.loans,
            {
              id: newId(),
              pieceName,
              withId: other.id,
              direction: 'to' as const,
              since: todayLocal(),
            },
          ],
        },
      };
    });
  }, []);

  /**
   * Home again. The loan is stamped returned and NOTHING ELSE MOVES — no wear
   * is logged, no count changes, no laundry status is touched. The web is
   * exact about this and so is this port: a piece coming back is not a piece
   * having been worn, and the person who wore it was not its owner. Inventing
   * a wear here would put days into somebody's ledger that they did not have.
   */
  const closeLoan = useCallback((pieceName: string, withId: string) => {
    setState(prev => ({
      ...prev,
      circle: {
        ...prev.circle,
        loans: prev.circle.loans.map(l =>
          !l.returned && l.pieceName === pieceName && l.withId === withId
            ? { ...l, returned: todayLocal() }
            : l,
        ),
      },
    }));
  }, []);

  /* ---------- furniture (ported bodies — WardrobeContext.tsx) ---------- */

  const furnitureCount = state.furniture.length;
  /**
   * Places decided on but not yet committed.
   *
   * The ceiling has to be answered SYNCHRONOUSLY — the caller is told an id or
   * null and draws accordingly — but the committed count only moves on the
   * next render. Without this, twelve adds inside one render all see the same
   * count, all get an id, and only some of them exist. Reset the moment the
   * committed count actually moves.
   */
  const pendingFurniture = useRef(0);
  useEffect(() => {
    pendingFurniture.current = 0;
  }, [furnitureCount]);

  const addFurniture = useCallback(
    (
      name: string,
      form: FurnitureForm,
      slotCount: number,
      ornament?: Ornament,
    ): string | null => {
      // The ceiling governs what may be MADE. It never governs what may be
      // read: a file that already holds more arrives intact and stays intact.
      if (furnitureCount + pendingFurniture.current >= MAX_FURNITURE) return null;
      pendingFurniture.current += 1;
      const id = `f-${newId().slice(-8)}`;
      const wanted = Number.isFinite(slotCount) ? Math.round(slotCount) : 1;
      const count = Math.max(1, Math.min(maxSlotsFor(form), wanted));
      const labels = defaultSlotLabels(form, count);
      const piece: Furniture = {
        id,
        name: name.trim() || 'A place',
        form,
        slots: labels.map((label, i) => ({ id: `${id}-s${i + 1}`, label })),
        dateAdded: todayLocal(),
        // Plain is the absence of the field, not a value in it — so a plain
        // piece is byte-identical to every piece written before ornament
        // existed.
        ...(ornament && ornament !== 'plain' ? { ornament } : {}),
      };
      // The guard is repeated inside the updater because a pull can raise the
      // committed count between the decision above and the commit below.
      setState(prev =>
        prev.furniture.length >= MAX_FURNITURE
          ? prev
          : { ...prev, furniture: [...prev.furniture, piece] },
      );
      return id;
    },
    [furnitureCount],
  );

  /**
   * Removing furniture is a chest leaving the room. It is NOT clothes leaving
   * the closet.
   *
   * The only trace of a chest is the line saying where a garment sleeps.
   * Nothing else about a garment changes: not its name, its photograph, its
   * wears, its cost, its history. It simply stops having an address.
   *
   * The whole previous state comes back in the closure so a toast can offer
   * Undo — never a field-by-field inverse, which is how half-restores happen.
   */
  const removeFurniture = useCallback((id: string) => {
    // Captured NOW, not inside the updater: an undo offered on a toast can be
    // reached for before React has run anything, and an undo that quietly
    // does nothing is worse than no undo at all.
    const before = stateRef.current;
    setState(prev => ({
      ...prev,
      furniture: prev.furniture.filter(f => f.id !== id),
      items: prev.items.map(item => {
        if (item.place?.furnitureId !== id) return item;
        const { place: _gone, ...rest } = item;
        return rest;
      }),
    }));
    return () => setState(before);
  }, []);

  const filePiece = useCallback(
    (itemId: string, furnitureId: string | null, slotId?: string | null) => {
      const place =
        furnitureId && slotId ? { furnitureId, slotId } : null;
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id !== itemId) return item;
          if (!place) {
            // Absent, not empty: an unfiled piece is byte-identical to one
            // that was never filed.
            const { place: _gone, ...rest } = item;
            return rest;
          }
          return { ...item, place };
        }),
      }));
    },
    [],
  );

  /* ---------- photographs ---------- */

  /**
   * The disk write happens FIRST and outside the updater (law 1: writes never
   * happen inside the state updater). Only once there is a real file does the
   * record point at it — the opposite order leaves a document naming a
   * photograph that does not exist, which is the failure that blanks tiles.
   */
  const setItemPhoto = useCallback(async (itemId: string, dataUrlOrUri: string) => {
    // The piece is looked up BEFORE the file is written: a photograph saved
    // for a piece that is not there is an orphan nobody will ever find.
    const existing = stateRef.current.items.find(i => i.id === itemId);
    if (!existing) return;
    const replaced = (existing.imageUrl ?? '').trim();

    const path = await savePhoto(dataUrlOrUri);
    setState(prev =>
      prev.items.some(i => i.id === itemId)
        ? stampFilePhotos({
            ...prev,
            items: prev.items.map(i => (i.id === itemId ? { ...i, imageUrl: path } : i)),
          })
        : prev,
    );
    // The photograph that was replaced goes with it — after the record has
    // moved on, never before: a delete that ran first and then failed to
    // commit would leave a piece pointing at a file that is gone.
    if (replaced && replaced !== path) await removePhoto(replaced);
  }, []);

  const removeItemPhoto = useCallback(async (itemId: string) => {
    const existing = stateRef.current.items.find(i => i.id === itemId);
    const removed = (existing?.imageUrl ?? '').trim();
    if (!existing || !removed) return;
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => (i.id === itemId ? { ...i, imageUrl: '' } : i)),
    }));
    await removePhoto(removed);
  }, []);

  const logWear = useCallback((itemIds: string[], outfitId?: string, date?: string) => {
    const logDate = date ?? todayLocal();
    const planned = isFutureDate(logDate);
    setState(prev => {
      // Wearing an outfit always credits every item in it.
      const creditedIds = outfitId
        ? Array.from(new Set([...itemIds, ...(prev.outfits.find(o => o.id === outfitId)?.itemIds ?? [])]))
        : itemIds;
      // Future dates are plans: recorded, but they don't move wear counts or
      // laundry until the person confirms the day actually happened. The flag
      // is STORED — derived-from-date let every plan silently read as a wear
      // the morning its date arrived.
      const newLog: WearLog = planned
        ? { id: newId(), date: logDate, itemIds: creditedIds, outfitId, planned: true }
        : { id: newId(), date: logDate, itemIds: creditedIds, outfitId };
      if (planned) {
        return { ...prev, wearLogs: [...prev.wearLogs, newLog] };
      }
      return {
        ...prev,
        wearLogs: [...prev.wearLogs, newLog],
        items: prev.items.map(item =>
          creditedIds.includes(item.id)
            ? {
                ...item,
                wearCount: item.wearCount + 1,
                lastWorn: !item.lastWorn || logDate > item.lastWorn ? logDate : item.lastWorn,
                // The bench is about NOW. A wear logged for today moves the
                // piece to the bench; a backfilled wear from last week cannot
                // know what the laundry has done since, so it leaves the
                // bench alone and moves only the count and the date.
                laundryStatus: logDate === todayLocal() ? ('worn' as const) : item.laundryStatus,
              }
            : item,
        ),
        outfits: prev.outfits.map(o =>
          o.id === outfitId
            ? { ...o, wearCount: o.wearCount + 1, lastWorn: !o.lastWorn || logDate > o.lastWorn ? logDate : o.lastWorn }
            : o,
        ),
      };
    });
  }, []);

  const removeWearLog = useCallback((id: string) => {
    setState(prev => {
      const log = prev.wearLogs.find(l => l.id === id);
      if (!log) return prev;
      // The STORED flag, never the date: deriving it here meant a plan whose
      // day had arrived read as a wear, and undoing it decremented counts that
      // had never been incremented.
      const wasPlanned = log.planned === true;
      const remaining = prev.wearLogs.filter(l => l.id !== id);
      // lastWorn is recomputed from the surviving record, not left pointing at
      // a date that is no longer on it.
      const lastFor = (itemId: string): string | undefined => {
        let last: string | undefined;
        for (const l of remaining) {
          if (l.planned === true || isFutureDate(l.date)) continue;
          if (!l.itemIds.includes(itemId)) continue;
          if (!last || l.date > last) last = l.date;
        }
        return last;
      };
      return {
        ...prev,
        wearLogs: remaining,
        items: wasPlanned
          ? prev.items
          : prev.items.map(item =>
              log.itemIds.includes(item.id)
                ? { ...item, wearCount: Math.max(0, item.wearCount - 1), lastWorn: lastFor(item.id) }
                : item,
            ),
        outfits:
          wasPlanned || !log.outfitId
            ? prev.outfits
            : prev.outfits.map(o =>
                o.id === log.outfitId ? { ...o, wearCount: Math.max(0, o.wearCount - 1) } : o,
              ),
      };
    });
  }, []);

  const getItem = useCallback((id: string) => state.items.find(i => i.id === id), [state.items]);

  const activeItems = useMemo(() => state.items.filter(isActive), [state.items]);

  const value = useMemo<WardrobeContextValue>(
    () => ({
      status,
      items: state.items,
      activeItems,
      outfits: state.outfits,
      furniture: state.furniture,
      wishlist: state.wishlist,
      loans: state.circle.loans,
      wearLogs: state.wearLogs,
      settings: state.settings,
      isSample: account?.isSample === true,
      wardrobeName: account?.name ?? null,
      syncAccount: sharedAccount,
      syncMode: sharedAccount ? syncModeOf(sharedAccount) : 'device',
      setSyncMode,
      addItem,
      addOutfit,
      updateOutfit,
      removeOutfit,
      addWish,
      updateWish,
      removeWish,
      promoteWish,
      recordLoan,
      closeLoan,
      addFurniture,
      removeFurniture,
      filePiece,
      setItemPhoto,
      removeItemPhoto,
      logWear,
      removeWearLog,
      getItem,
      startEmpty,
      startSample,
    }),
    [
      status, state, activeItems, account, sharedAccount, setSyncMode, addItem,
      addOutfit, updateOutfit, removeOutfit,
      addWish, updateWish, removeWish, promoteWish,
      recordLoan, closeLoan,
      addFurniture, removeFurniture, filePiece,
      setItemPhoto, removeItemPhoto,
      logWear, removeWearLog, getItem, startEmpty, startSample,
    ],
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe(): WardrobeContextValue {
  const value = useContext(WardrobeContext);
  if (!value) throw new Error('useWardrobe must sit under a WardrobeProvider');
  return value;
}
