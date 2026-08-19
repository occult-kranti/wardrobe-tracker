import { createContext, useContext, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { showToast } from '../components/Toast';
import { defaultSlotLabels, maxSlotsFor } from '../lib/furnitureArt';
import { todayLocal, isFutureDate, addDays } from '../lib/dates';
import { migrate } from '../lib/migrate';
import { wardrobeKey } from '../lib/accounts';
import { useSession } from './SessionContext';
import {
  SYNC_ADOPTED_EVENT,
  loadPulled,
  pushNow,
  queuePush,
  shouldSync,
} from '../lib/sync';
import {
  initialState,
  isActive,
  isBenched,
  isQuietCategory,
  type Account,
  type AppState,
  type AppSettings,
  type BorrowStatus,
  type CategoryId,
  type CircleMessage,
  type CircleProfile,
  type ClothingItem,
  type Outfit,
  type WardrobeEvent,
  type WearLog,
  type WishlistItem,
  type FurnitureForm,
  type Ornament,
  MAX_FURNITURE,
} from '../types';

interface WardrobeContextType extends AppState {
  /** Active (non-retired) items — what every browse surface should use. */
  activeItems: ClothingItem[];
  /** Returns the new piece's id, so a caller writing several can then relate them. */
  addItem: (item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => string;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
  /** Removes the piece and everything naming it; returns the way to put it back. */
  deleteItem: (id: string) => () => void;
  retireItem: (id: string, reason?: string) => void;
  unretireItem: (id: string) => void;
  toggleFavoriteItem: (id: string) => void;
  setLaundryStatus: (id: string, status: ClothingItem['laundryStatus']) => void;
  /** Wash day in one motion: every piece currently in `from` moves to `to`. */
  advanceLaundry: (from: ClothingItem['laundryStatus'], to: ClothingItem['laundryStatus']) => number;
  addOutfit: (outfit: Omit<Outfit, 'id' | 'dateCreated' | 'wearCount'>) => void;
  deleteOutfit: (id: string) => void;
  toggleFavoriteOutfit: (id: string) => void;
  logWear: (itemIds: string[], outfitId?: string, date?: string) => void;
  removeWearLog: (id: string) => void;
  confirmPlan: (logId: string) => void;
  addWishlistItem: (item: Omit<WishlistItem, 'id' | 'dateAdded'>) => void;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => void;
  deleteWishlistItem: (id: string) => void;
  moveWishlistToCloset: (id: string) => void;
  releaseWishlistItem: (id: string) => void;
  keepWishlistItem: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addEvent: (event: Omit<WardrobeEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<WardrobeEvent>) => void;
  removeEvent: (id: string) => void;
  sendRailMessage: (groupId: string, text: string, request?: CircleMessage['request']) => void;
  setRequestStatus: (messageId: string, status: BorrowStatus) => void;
  returnLoan: (loanId: string) => void;
  /**
   * The seam between Conversations and the Rail. A borrow request answered in
   * a community thread writes its loan into the OPEN wardrobe's own circle —
   * the community store and the wardrobe store are separate keys, and only the
   * open wardrobe may be written. Only ever called by the side that accepted
   * (the owner's wardrobe is the one with the buttons), so direction is 'to'.
   */
  recordLoan: (pieceName: string, me: Account, other: Account) => void;
  /** Closes the open loan for this piece and counterparty, if one is out. */
  closeLoan: (pieceName: string, withId: string) => void;
  setLendable: (itemId: string, lendable: boolean) => void;
  addCategory: (label: string) => void;
  renameCategory: (id: CategoryId, label: string) => void;
  setCategoryQuiet: (id: CategoryId, quiet: boolean) => void;
  moveCategory: (id: CategoryId, direction: -1 | 1) => void;
  addOccasion: (tag: string) => void;
  /* ---------- furniture: where a piece lives ---------- */
  /** Returns the new piece's id, so a caller can open it straight away. */
  /** The id of what was drawn, or '' when the room is already full. */
  addFurniture: (name: string, form: FurnitureForm, slotCount: number, ornament?: Ornament) => string;
  /** Pack a compartment away for the season, or bring it back out. */
  packSlot: (furnitureId: string, slotId: string, packed: boolean) => void;
  /** Pack, or unpack, every compartment of one piece at once. */
  packPiece: (furnitureId: string, packed: boolean) => void;
  renameFurniture: (id: string, name: string) => void;
  renameSlot: (furnitureId: string, slotId: string, label: string) => void;
  /** Removes the furniture, never the clothes. Returns the way to put it back. */
  removeFurniture: (id: string) => () => void;
  /** One piece. null takes it out of wherever it was. */
  filePiece: (itemId: string, place: ClothingItem['place'] | null) => void;
  /** A shelf's worth, in ONE committed state. Returns how many moved. */
  filePieces: (itemIds: string[], place: ClothingItem['place'] | null) => number;
  replaceState: (next: AppState) => void;
  markExported: () => void;
  getItem: (id: string) => ClothingItem | undefined;
  getOutfit: (id: string) => Outfit | undefined;
  getMostWorn: (limit?: number) => ClothingItem[];
  getLeastWorn: (limit?: number) => ClothingItem[];
  getUnwornItems: () => ClothingItem[];
  /** Clean, unbenched, unretired, non-quiet — the only pieces the generator deals. */
  getWearablePool: () => ClothingItem[];
  getOutfitSuggestions: () => Outfit[];
  /** Pieces sitting in packed-away compartments, by id. The day's draw never
      deals them, and Today never names them. */
  packedItemIds: ReadonlySet<string>;
}

const WardrobeContext = createContext<WardrobeContextType | null>(null);

/**
 * A loan names its counterparty, so the rail needs a record of them — the
 * circle is this closet's contact book, and lending to someone is what puts
 * them in it. Existing entries are kept as they are; `isMe` only ever sets.
 */
function upsertProfile(profiles: CircleProfile[], account: Account, isMe = false): CircleProfile[] {
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

export function WardrobeProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  // One store per wardrobe. App keys this provider by accountId so switching
  // wardrobes remounts it — useLocalStorage reads storage only in its useState
  // initializer, so without the remount the next write would put one closet's
  // contents under another's key.
  const [state, setState] = useLocalStorage<AppState>(
    wardrobeKey(accountId),
    initialState,
    migrate,
    // The one failure this app must never keep to itself: the device refusing
    // the write. Everything on screen still looks saved, and a refresh would
    // throw it away. Photographs are almost always the cause.
    () => showToast(
      'This device would not take the write — its storage is full. Export a backup from Settings now, then remove a few photographs.',
      'error',
    ),
  );

  const activeItems = useMemo(() => state.items.filter(isActive), [state.items]);

  /* ---------- cloud sync: this wardrobe only, and only if its owner chose it ----------

     The push is keyed on the committed state and compared by content, so the
     state just adopted from the account (identical to what the account holds)
     does not echo straight back up, and a StrictMode double-effect does not
     send twice. Offline, pushNow queues and the session layer flushes on the
     next online moment. Samples never reach here — shouldSync refuses them.

     Conflict semantics, stated honestly: last-writer-wins, whole wardrobe at a
     time. A pull that finds a newer row replaces the local record; a push
     stamps updated_at = now. No field-level merge is attempted. */
  const { accounts, authUser } = useSession();
  const account = accounts.find(a => a.id === accountId) ?? null;
  const syncOn = account !== null && authUser !== null && shouldSync(account) && !!account.syncId;
  const lastPushedJson = useRef<string | null>(null);
  const pushTimer = useRef<number | null>(null);
  /** The scheduled-but-unsent push, so hiding the page can still keep it. */
  const pendingPush = useRef<{ account: Account; state: AppState; userId: string } | null>(null);

  useEffect(() => {
    if (!syncOn || !authUser || !account?.syncId) return;
    const json = JSON.stringify(state);
    // The first pass after mount is the state just read from the store, and an
    // adopted pull is marked before it is committed — neither is news.
    if (lastPushedJson.current === null) {
      lastPushedJson.current = json;
      return;
    }
    if (json === lastPushedJson.current) return;
    lastPushedJson.current = json;
    if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    pendingPush.current = { account, state, userId: authUser.id };
    pushTimer.current = window.setTimeout(() => {
      pushTimer.current = null;
      const job = pendingPush.current;
      pendingPush.current = null;
      if (job) void pushNow(job.account, job.state, job.userId);
    }, 800);
    return () => {
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    };
  }, [state, syncOn, authUser, account]);

  /**
   * A push still inside its debounce when the page hides, or this provider
   * unmounts (a wardrobe switch), must not evaporate. On hide it is QUEUED
   * rather than sent — a fetch started during pagehide can die without either
   * callback, while the queue's localStorage write survives. On unmount the
   * page is very much alive, so it is simply sent.
   */
  useEffect(() => {
    const stash = () => {
      if (pushTimer.current !== null) {
        window.clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      const job = pendingPush.current;
      pendingPush.current = null;
      if (job) queuePush(job.account, job.state);
    };
    const send = () => {
      if (pushTimer.current !== null) {
        window.clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      const job = pendingPush.current;
      pendingPush.current = null;
      if (job) void pushNow(job.account, job.state, job.userId);
    };
    window.addEventListener('pagehide', stash);
    return () => {
      window.removeEventListener('pagehide', stash);
      send();
    };
  }, []);

  // A pull that wrote this wardrobe's store announces itself here; the open
  // provider adopts what was written. (A same-tab localStorage write fires no
  // `storage` event, so the announcement is a custom event, not that one.)
  useEffect(() => {
    const onAdopted = (e: Event) => {
      if ((e as CustomEvent<{ accountId?: string }>).detail?.accountId !== accountId) return;
      const pulled = loadPulled(accountId);
      if (!pulled) return;
      // Mark BEFORE committing: the adopted state is what the account holds,
      // so the push effect must not echo it straight back up.
      lastPushedJson.current = JSON.stringify(pulled);
      setState(migrate(pulled));
    };
    window.addEventListener(SYNC_ADOPTED_EVENT, onAdopted);
    return () => window.removeEventListener(SYNC_ADOPTED_EVENT, onAdopted);
  }, [accountId, setState]);

  const addItem = useCallback((item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => {
    const newItem: ClothingItem = {
      ...item,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
      wearCount: 0,
      laundryStatus: 'clean',
    };
    setState(prev => ({ ...prev, items: [...prev.items, newItem] }));
    return newItem.id;
  }, [setState]);

  const updateItem = useCallback((id: string, updates: Partial<ClothingItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item),
    }));
  }, [setState]);

  /**
   * "Delete for good" — and it means every trace, not just the row.
   *
   * It used to remove the item and strip it from outfits, but leave every wear
   * log still naming it. Calendar and Dashboard render piecesPhrase over the
   * COUNT OF IDS, not of resolved pieces, so a deleted piece left a phantom day
   * on the calendar reading "1 piece" with no thumbnail, no name, and an UNDO
   * for a wear of nothing. Now the id comes out of every log, a log left with
   * nothing on it is dropped with it, and the piece comes off the borrow list.
   *
   * The whole previous state is handed back so the caller can offer to put it
   * back — see `showToast`'s action. This is the answer to the complaint that
   * follows every rival in the category: things vanish and cannot be recovered.
   */
  const deleteItem = useCallback((id: string) => {
    let before: AppState | null = null;
    setState(prev => {
      before = prev;
      const logs = prev.wearLogs
        .map(log => ({ ...log, itemIds: log.itemIds.filter(iid => iid !== id) }))
        .filter(log => log.itemIds.length > 0 || log.outfitId);
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== id),
        outfits: prev.outfits.map(o => ({ ...o, itemIds: o.itemIds.filter(iid => iid !== id) })),
        wearLogs: logs,
        circle: {
          ...prev.circle,
          profiles: prev.circle.profiles.map(p =>
            p.isMe ? { ...p, lendable: p.lendable.filter(l => l.itemId !== id) } : p
          ),
        },
      };
    });
    return () => { if (before) setState(before); };
  }, [setState]);

  // Retiring keeps every wear the piece ever earned — the history is the point.
  const retireItem = useCallback((id: string, reason?: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, retired: { date: todayLocal(), reason } } : item
      ),
    }));
  }, [setState]);

  const unretireItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== id) return item;
        const { retired: _retired, ...rest } = item;
        return rest;
      }),
    }));
  }, [setState]);

  const toggleFavoriteItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, favorite: !item.favorite } : item
      ),
    }));
  }, [setState]);

  const advanceLaundry = useCallback((from: ClothingItem['laundryStatus'], to: ClothingItem['laundryStatus']) => {
    let moved = 0;
    setState(prev => {
      const items = prev.items.map(item => {
        if (item.retired || item.laundryStatus !== from) return item;
        moved += 1;
        return { ...item, laundryStatus: to };
      });
      return moved === 0 ? prev : { ...prev, items };
    });
    return moved;
  }, [setState]);

  const setLaundryStatus = useCallback((id: string, status: ClothingItem['laundryStatus']) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, laundryStatus: status } : item
      ),
    }));
  }, [setState]);

  const addOutfit = useCallback((outfit: Omit<Outfit, 'id' | 'dateCreated' | 'wearCount'>) => {
    const newOutfit: Outfit = {
      ...outfit,
      id: crypto.randomUUID(),
      dateCreated: new Date().toISOString(),
      wearCount: 0,
    };
    setState(prev => ({ ...prev, outfits: [...prev.outfits, newOutfit] }));
  }, [setState]);

  const deleteOutfit = useCallback((id: string) => {
    setState(prev => ({ ...prev, outfits: prev.outfits.filter(o => o.id !== id) }));
  }, [setState]);

  const toggleFavoriteOutfit = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      outfits: prev.outfits.map(o => o.id === id ? { ...o, favorite: !o.favorite } : o),
    }));
  }, [setState]);

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
        ? { id: crypto.randomUUID(), date: logDate, itemIds: creditedIds, outfitId, planned: true }
        : { id: crypto.randomUUID(), date: logDate, itemIds: creditedIds, outfitId };
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
            : item
        ),
        outfits: prev.outfits.map(o =>
          o.id === outfitId
            ? { ...o, wearCount: o.wearCount + 1, lastWorn: !o.lastWorn || logDate > o.lastWorn ? logDate : o.lastWorn }
            : o
        ),
      };
    });
  }, [setState]);

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
      // a date that is no longer on it — "quiet lately" and the suggestions
      // both read that date.
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
        items: wasPlanned ? prev.items : prev.items.map(item =>
          log.itemIds.includes(item.id)
            ? { ...item, wearCount: Math.max(0, item.wearCount - 1), lastWorn: lastFor(item.id) }
            : item
        ),
        outfits: wasPlanned || !log.outfitId ? prev.outfits : prev.outfits.map(o =>
          o.id === log.outfitId ? { ...o, wearCount: Math.max(0, o.wearCount - 1) } : o
        ),
      };
    });
  }, [setState]);

  /**
   * A plan whose day has arrived is a QUESTION, not a fact. This is the yes:
   * the flag clears, and only now do the counts, lastWorn and the laundry
   * basket move — exactly as if the wear had been logged fresh.
   */
  const confirmPlan = useCallback((logId: string) => {
    setState(prev => {
      const log = prev.wearLogs.find(l => l.id === logId);
      if (!log || log.planned !== true) return prev;
      return {
        ...prev,
        wearLogs: prev.wearLogs.map(l => l.id === logId ? { ...l, planned: undefined } : l),
        items: prev.items.map(item =>
          log.itemIds.includes(item.id)
            ? {
                ...item,
                wearCount: item.wearCount + 1,
                lastWorn: !item.lastWorn || log.date > item.lastWorn ? log.date : item.lastWorn,
                laundryStatus: 'worn' as const,
              }
            : item
        ),
        outfits: prev.outfits.map(o =>
          o.id === log.outfitId
            ? { ...o, wearCount: o.wearCount + 1, lastWorn: !o.lastWorn || log.date > o.lastWorn ? log.date : o.lastWorn }
            : o
        ),
      };
    });
  }, [setState]);

  const addWishlistItem = useCallback((item: Omit<WishlistItem, 'id' | 'dateAdded'>) => {
    const newItem: WishlistItem = {
      ...item,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
    };
    setState(prev => ({ ...prev, wishlist: [...prev.wishlist, newItem] }));
  }, [setState]);

  const updateWishlistItem = useCallback((id: string, updates: Partial<WishlistItem>) => {
    setState(prev => ({
      ...prev,
      wishlist: prev.wishlist.map(item => item.id === id ? { ...item, ...updates } : item),
    }));
  }, [setState]);

  const deleteWishlistItem = useCallback((id: string) => {
    setState(prev => ({ ...prev, wishlist: prev.wishlist.filter(item => item.id !== id) }));
  }, [setState]);

  const releaseWishlistItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      wishlist: prev.wishlist.map(w =>
        w.id === id
          ? { ...w, status: 'let-go' as const, releasedAt: todayLocal(), coolingOff: w.coolingOff ? { ...w.coolingOff, asked: true } : undefined }
          : w
      ),
    }));
  }, [setState]);

  const keepWishlistItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      wishlist: prev.wishlist.map(w =>
        w.id === id
          ? { ...w, status: 'kept' as const, coolingOff: w.coolingOff ? { ...w.coolingOff, asked: true } : undefined }
          : w
      ),
    }));
  }, [setState]);

  const moveWishlistToCloset = useCallback((id: string) => {
    setState(prev => {
      const wishItem = prev.wishlist.find(w => w.id === id);
      if (!wishItem) return prev;
      const newItem: ClothingItem = {
        id: crypto.randomUUID(),
        name: wishItem.name,
        category: wishItem.category,
        color: wishItem.color,
        brand: wishItem.brand,
        imageUrl: wishItem.imageUrl || '',
        dateAdded: new Date().toISOString(),
        wearCount: 0,
        favorite: false,
        season: [],
        occasion: [],
        cost: wishItem.price,
        notes: wishItem.notes,
        laundryStatus: 'clean',
      };
      return {
        ...prev,
        items: [...prev.items, newItem],
        wishlist: prev.wishlist.map(w => w.id === id ? { ...w, status: 'bought' as const } : w),
      };
    });
  }, [setState]);

  /* ---------- events ---------- */

  const addEvent = useCallback((event: Omit<WardrobeEvent, 'id'>) => {
    setState(prev => ({ ...prev, events: [...prev.events, { ...event, id: crypto.randomUUID() }] }));
  }, [setState]);

  const updateEvent = useCallback((id: string, updates: Partial<WardrobeEvent>) => {
    setState(prev => ({
      ...prev,
      events: prev.events.map(e => (e.id === id ? { ...e, ...updates } : e)),
    }));
  }, [setState]);

  const removeEvent = useCallback((id: string) => {
    setState(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
  }, [setState]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }));
  }, [setState]);

  /* ---------- the Shared Rail ----------
     Local records only: profiles, one thread, loans. Nothing here syncs. */

  const sendRailMessage = useCallback((groupId: string, text: string, request?: CircleMessage['request']) => {
    const trimmed = text.trim();
    if (!trimmed && !request) return;
    setState(prev => {
      const me = prev.circle.profiles.find(p => p.isMe);
      if (!me) return prev;
      const message: CircleMessage = {
        id: crypto.randomUUID(),
        groupId,
        authorId: me.id,
        date: todayLocal(),
        text: trimmed,
        request,
      };
      return { ...prev, circle: { ...prev.circle, messages: [...prev.circle.messages, message] } };
    });
  }, [setState]);

  /** Advance a borrow request; lending opens a loan, returning closes it. */
  const setRequestStatus = useCallback((messageId: string, status: BorrowStatus) => {
    setState(prev => {
      const message = prev.circle.messages.find(m => m.id === messageId);
      if (!message?.request || message.request.status === status) return prev;
      const me = prev.circle.profiles.find(p => p.isMe);
      const messages = prev.circle.messages.map(m =>
        m.id === messageId ? { ...m, request: { ...m.request as NonNullable<CircleMessage['request']>, status } } : m
      );
      let loans = prev.circle.loans;
      if (status === 'lent') {
        const lendable = me?.lendable.find(l => l.name === message.request?.pieceName);
        loans = [...loans, {
          id: crypto.randomUUID(),
          pieceName: message.request.pieceName,
          itemId: lendable?.itemId,
          withId: message.authorId === me?.id
            ? prev.circle.groups.find(g => g.id === message.groupId)?.memberIds.find(id => id !== me?.id) ?? message.authorId
            : message.authorId,
          direction: message.authorId === me?.id ? 'from' : 'to',
          since: todayLocal(),
        }];
      }
      if (status === 'returned') {
        loans = loans.map(l =>
          l.pieceName === message.request?.pieceName && !l.returned ? { ...l, returned: todayLocal() } : l
        );
      }
      return { ...prev, circle: { ...prev.circle, messages, loans } };
    });
  }, [setState]);

  const returnLoan = useCallback((loanId: string) => {
    setState(prev => ({
      ...prev,
      circle: {
        ...prev.circle,
        loans: prev.circle.loans.map(l => l.id === loanId && !l.returned ? { ...l, returned: todayLocal() } : l),
      },
    }));
  }, [setState]);

  /**
   * "Lend it" was pressed in Conversations. The request lives in the shared
   * community store; the loan it opens lives here, in the lending wardrobe's
   * own ledger, so the Rail's Out and back reflects it. One open loan per
   * piece and person — a second accept of the same ask opens nothing.
   */
  const recordLoan = useCallback((pieceName: string, me: Account, other: Account) => {
    setState(prev => {
      const alreadyOut = prev.circle.loans.some(
        l => !l.returned && l.pieceName === pieceName && l.withId === other.id
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
              id: crypto.randomUUID(),
              pieceName,
              withId: other.id,
              direction: 'to' as const,
              since: todayLocal(),
            },
          ],
        },
      };
    });
  }, [setState]);

  const closeLoan = useCallback((pieceName: string, withId: string) => {
    setState(prev => ({
      ...prev,
      circle: {
        ...prev.circle,
        loans: prev.circle.loans.map(l =>
          !l.returned && l.pieceName === pieceName && l.withId === withId
            ? { ...l, returned: todayLocal() }
            : l
        ),
      },
    }));
  }, [setState]);

  /** Put a piece of this closet on, or take it off, my open-to-borrow list. */
  /* ---------- furniture ---------- */

  const addFurniture = useCallback((
    name: string, form: FurnitureForm, slotCount: number, ornament?: Ornament,
  ) => {
    // The ceiling governs what may be MADE. It never governs what may be read:
    // a file that already holds more arrives intact and stays intact.
    if (state.furniture.length >= MAX_FURNITURE) return '';
    const id = `f-${crypto.randomUUID().slice(0, 8)}`;
    const wanted = Number.isFinite(slotCount) ? Math.round(slotCount) : 1;
    const count = Math.max(1, Math.min(maxSlotsFor(form), wanted));
    const labels = defaultSlotLabels(form, count);
    const piece = {
      id,
      name: name.trim() || 'A place',
      form,
      slots: labels.map((label, i) => ({ id: `${id}-s${i + 1}`, label })),
      dateAdded: todayLocal(),
      // Plain is the absence of the field, not a value in it — so a plain piece
      // is byte-identical to every piece written before ornament existed.
      ...(ornament && ornament !== 'plain' ? { ornament } : {}),
    };
    setState(prev => (
      prev.furniture.length >= MAX_FURNITURE
        ? prev
        : { ...prev, furniture: [...prev.furniture, piece] }
    ));
    return id;
  }, [setState, state.furniture.length]);

  /**
   * PACKED AWAY.
   *
   * The whole of what this does elsewhere is one line in getWearablePool. It is
   * not a bench state and not a retirement: the pieces stay in the closet, keep
   * every wear, stay searchable and stay wearable. They simply stop being
   * offered, which is the difference between a wardrobe app and a filing system
   * — nobody wants a wool coat suggested in July, and nobody wants to delete it
   * to stop that happening.
   */
  const packSlot = useCallback((furnitureId: string, slotId: string, packed: boolean) => {
    setState(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => f.id !== furnitureId ? f : {
        ...f,
        slots: f.slots.map(s => {
          if (s.id !== slotId) return s;
          if (!packed) { const { packed: _gone, ...rest } = s; return rest; }
          return { ...s, packed: true };
        }),
      }),
    }));
  }, [setState]);

  const packPiece = useCallback((furnitureId: string, packed: boolean) => {
    setState(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => f.id !== furnitureId ? f : {
        ...f,
        slots: f.slots.map(s => {
          if (!packed) { const { packed: _gone, ...rest } = s; return rest; }
          return { ...s, packed: true };
        }),
      }),
    }));
  }, [setState]);

  const renameFurniture = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => (f.id === id ? { ...f, name } : f)),
    }));
  }, [setState]);

  const renameSlot = useCallback((furnitureId: string, slotId: string, label: string) => {
    setState(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => f.id !== furnitureId ? f : {
        ...f,
        slots: f.slots.map(s => (s.id === slotId ? { ...s, label } : s)),
      }),
    }));
  }, [setState]);

  /**
   * Removing furniture is a chest leaving the room. It is NOT clothes leaving
   * the closet.
   *
   * deleteItem takes a piece's wear logs with it because a log naming a piece
   * that no longer exists is a phantom day on the calendar. The rule that sets
   * is "remove every trace of the thing removed" — and the only trace of a
   * chest is the line saying where a garment sleeps. Nothing else about a
   * garment changes: not its name, its photograph, its wears, its cost, its
   * history. It simply stops having an address.
   *
   * The whole previous state comes back in the closure so the toast can offer
   * Undo, exactly as deleteItem does — never a field-by-field inverse, which is
   * how half-restores happen. Every rival's reviews carry the same sentence
   * about archive and storage features: it deleted my things and I could not
   * get them back.
   */
  const removeFurniture = useCallback((id: string) => {
    let before: AppState | null = null;
    setState(prev => {
      before = prev;
      return {
        ...prev,
        furniture: prev.furniture.filter(f => f.id !== id),
        items: prev.items.map(item => {
          if (item.place?.furnitureId !== id) return item;
          const { place: _gone, ...rest } = item;
          return rest;
        }),
      };
    });
    return () => { if (before) setState(before); };
  }, [setState]);

  const filePiece = useCallback((itemId: string, place: ClothingItem['place'] | null) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== itemId) return item;
        if (!place) {
          const { place: _gone, ...rest } = item;
          return rest;
        }
        return { ...item, place };
      }),
    }));
  }, [setState]);

  /**
   * A shelf's worth in ONE committed state.
   *
   * Deliberately not a loop of filePiece: the whole wardrobe is serialised once
   * per committed state, so twelve separate calls would rebuild and re-serialise
   * a closet full of photographs twelve times inside one coalescing window.
   * advanceLaundry does the same thing for the same reason.
   */
  const filePieces = useCallback((itemIds: string[], place: ClothingItem['place'] | null) => {
    const wanted = new Set(itemIds);
    let moved = 0;
    setState(prev => {
      moved = prev.items.filter(i => wanted.has(i.id)).length;
      if (moved === 0) return prev;
      return {
        ...prev,
        items: prev.items.map(item => {
          if (!wanted.has(item.id)) return item;
          if (!place) {
            const { place: _gone, ...rest } = item;
            return rest;
          }
          return { ...item, place };
        }),
      };
    });
    return moved;
  }, [setState]);

  const setLendable = useCallback((itemId: string, lendable: boolean) => {
    setState(prev => {
      const me = prev.circle.profiles.find(p => p.isMe);
      if (!me) return prev;
      const item = prev.items.find(i => i.id === itemId);
      // Offering needs the piece; WITHDRAWING must not. Requiring it for both
      // directions meant any piece that left the closet stayed on the
      // open-to-borrow list permanently — removal needed the item to exist,
      // and it no longer did.
      if (lendable && !item) return prev;
      const has = me.lendable.some(l => l.itemId === itemId);
      if (has === lendable) return prev;
      const nextLendable = lendable
        ? [...me.lendable, { itemId, name: item!.name, category: item!.category }]
        : me.lendable.filter(l => l.itemId !== itemId);
      return {
        ...prev,
        circle: {
          ...prev.circle,
          profiles: prev.circle.profiles.map(p => p.isMe ? { ...p, lendable: nextLendable } : p),
        },
      };
    });
  }, [setState]);

  const addCategory = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || crypto.randomUUID();
    setState(prev => {
      if (prev.settings.categories.some(c => c.id === id)) return prev;
      return {
        ...prev,
        settings: { ...prev.settings, categories: [...prev.settings.categories, { id, label: trimmed }] },
      };
    });
  }, [setState]);

  const renameCategory = useCallback((id: CategoryId, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        categories: prev.settings.categories.map(c => c.id === id ? { ...c, label: trimmed } : c),
      },
    }));
  }, [setState]);

  const setCategoryQuiet = useCallback((id: CategoryId, quiet: boolean) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        categories: prev.settings.categories.map(c => c.id === id ? { ...c, quiet } : c),
      },
    }));
  }, [setState]);

  const moveCategory = useCallback((id: CategoryId, direction: -1 | 1) => {
    setState(prev => {
      const list = [...prev.settings.categories];
      const index = list.findIndex(c => c.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return prev;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, settings: { ...prev.settings, categories: list } };
    });
  }, [setState]);

  const addOccasion = useCallback((tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    setState(prev =>
      prev.settings.occasions.includes(trimmed)
        ? prev
        : { ...prev, settings: { ...prev.settings, occasions: [...prev.settings.occasions, trimmed] } }
    );
  }, [setState]);

  const replaceState = useCallback((next: AppState) => setState(migrate(next)), [setState]);

  const markExported = useCallback(() => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, lastExportAt: new Date().toISOString() } }));
  }, [setState]);

  const getItem = useCallback((id: string) => state.items.find(i => i.id === id), [state.items]);
  const getOutfit = useCallback((id: string) => state.outfits.find(o => o.id === id), [state.outfits]);
  const getMostWorn = useCallback((limit = 5) =>
    [...activeItems].sort((a, b) => b.wearCount - a.wearCount).slice(0, limit), [activeItems]);
  const getLeastWorn = useCallback((limit = 5) =>
    [...activeItems].sort((a, b) => a.wearCount - b.wearCount).slice(0, limit), [activeItems]);
  const getUnwornItems = useCallback(() =>
    activeItems.filter(i => i.wearCount === 0), [activeItems]);

  /** Every compartment currently packed away, across every piece. */
  const packedSlots = useMemo(() => {
    const packed = new Set<string>();
    for (const f of state.furniture) {
      for (const s of f.slots) if (s.packed) packed.add(`${f.id}/${s.id}`);
    }
    return packed;
  }, [state.furniture]);

  /** The pieces sitting in those compartments, by id. */
  const packedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of state.items) {
      if (i.place && packedSlots.has(`${i.place.furnitureId}/${i.place.slotId}`)) ids.add(i.id);
    }
    return ids;
  }, [state.items, packedSlots]);

  const getWearablePool = useCallback(() =>
    activeItems.filter(i =>
      i.laundryStatus === 'clean'
      && !isBenched(i)
      && !isQuietCategory(state.settings, i.category)
      // In the trunk under the bed is not "available today".
      && !(i.place && packedSlots.has(`${i.place.furnitureId}/${i.place.slotId}`))
    ), [activeItems, state.settings, packedSlots]);

  const getOutfitSuggestions = useCallback(() => {
    const today = todayLocal();
    if (state.wearLogs.some(l => l.date === today)) return [];
    const retiredIds = new Set(state.items.filter(i => i.retired).map(i => i.id));
    // An outfit is offered whole or not at all: one piece in the trunk under
    // the bed benches the look until the compartment comes back out.
    const wearable = state.outfits.filter(o =>
      o.itemIds.every(id => !retiredIds.has(id) && !packedItemIds.has(id)));
    const favorites = wearable.filter(o => o.favorite);
    const pool = favorites.length > 0 ? favorites : wearable;
    // Most-recently-worn last: variety without randomness that re-shuffles on render.
    return [...pool]
      .sort((a, b) => (a.lastWorn ?? '').localeCompare(b.lastWorn ?? ''))
      .slice(0, 3);
  }, [state.outfits, state.wearLogs, state.items, packedItemIds]);

  return (
    <WardrobeContext.Provider value={{
      ...state,
      activeItems,
      addItem, updateItem, deleteItem, retireItem, unretireItem,
      toggleFavoriteItem, setLaundryStatus, advanceLaundry,
      addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear, removeWearLog, confirmPlan,
      addWishlistItem, updateWishlistItem, deleteWishlistItem, moveWishlistToCloset,
      releaseWishlistItem, keepWishlistItem,
      addEvent, updateEvent, removeEvent,
      updateSettings, addCategory, renameCategory, setCategoryQuiet, moveCategory, addOccasion,
      sendRailMessage, setRequestStatus, returnLoan, recordLoan, closeLoan, setLendable,
      addFurniture, renameFurniture, renameSlot, removeFurniture, filePiece, filePieces,
      packSlot, packPiece,
      replaceState, markExported,
      getItem, getOutfit,
      getMostWorn, getLeastWorn, getUnwornItems, getWearablePool,
      getOutfitSuggestions, packedItemIds,
    }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error('useWardrobe must be used within WardrobeProvider');
  return ctx;
}

export { addDays };
