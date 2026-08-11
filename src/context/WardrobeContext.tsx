import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { todayLocal, isFutureDate, addDays } from '../lib/dates';
import { migrate } from '../lib/migrate';
import {
  initialState,
  isActive,
  isBenched,
  isQuietCategory,
  type AppState,
  type AppSettings,
  type CategoryId,
  type ClothingItem,
  type Occasion,
  type Outfit,
  type UserCategory,
  type WearLog,
  type WishlistItem,
} from '../types';

interface WardrobeContextType extends AppState {
  /** Active (non-retired) items — what every browse surface should use. */
  activeItems: ClothingItem[];
  addItem: (item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => void;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
  deleteItem: (id: string) => void;
  retireItem: (id: string, reason?: string) => void;
  unretireItem: (id: string) => void;
  toggleFavoriteItem: (id: string) => void;
  setLaundryStatus: (id: string, status: ClothingItem['laundryStatus']) => void;
  addOutfit: (outfit: Omit<Outfit, 'id' | 'dateCreated' | 'wearCount'>) => void;
  deleteOutfit: (id: string) => void;
  toggleFavoriteOutfit: (id: string) => void;
  logWear: (itemIds: string[], outfitId?: string, date?: string) => void;
  removeWearLog: (id: string) => void;
  addWishlistItem: (item: Omit<WishlistItem, 'id' | 'dateAdded'>) => void;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => void;
  deleteWishlistItem: (id: string) => void;
  moveWishlistToCloset: (id: string) => void;
  releaseWishlistItem: (id: string) => void;
  keepWishlistItem: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addCategory: (label: string) => void;
  renameCategory: (id: CategoryId, label: string) => void;
  setCategoryQuiet: (id: CategoryId, quiet: boolean) => void;
  moveCategory: (id: CategoryId, direction: -1 | 1) => void;
  addOccasion: (tag: string) => void;
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
}

const WardrobeContext = createContext<WardrobeContextType | null>(null);

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<AppState>('wardrobe-tracker', initialState, migrate);

  const activeItems = useMemo(() => state.items.filter(isActive), [state.items]);

  const addItem = useCallback((item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => {
    const newItem: ClothingItem = {
      ...item,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
      wearCount: 0,
      laundryStatus: 'clean',
    };
    setState(prev => ({ ...prev, items: [...prev.items, newItem] }));
  }, [setState]);

  const updateItem = useCallback((id: string, updates: Partial<ClothingItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item),
    }));
  }, [setState]);

  const deleteItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
      outfits: prev.outfits.map(o => ({ ...o, itemIds: o.itemIds.filter(iid => iid !== id) })),
    }));
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
      const newLog: WearLog = { id: crypto.randomUUID(), date: logDate, itemIds: creditedIds, outfitId };
      // Future dates are plans: recorded, but they don't move wear counts or
      // laundry until the day actually arrives.
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
                laundryStatus: 'worn' as const,
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
      const wasPlanned = isFutureDate(log.date);
      return {
        ...prev,
        wearLogs: prev.wearLogs.filter(l => l.id !== id),
        items: wasPlanned ? prev.items : prev.items.map(item =>
          log.itemIds.includes(item.id)
            ? { ...item, wearCount: Math.max(0, item.wearCount - 1) }
            : item
        ),
        outfits: wasPlanned || !log.outfitId ? prev.outfits : prev.outfits.map(o =>
          o.id === log.outfitId ? { ...o, wearCount: Math.max(0, o.wearCount - 1) } : o
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

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...updates } }));
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

  const getWearablePool = useCallback(() =>
    activeItems.filter(i =>
      i.laundryStatus === 'clean' && !isBenched(i) && !isQuietCategory(state.settings, i.category)
    ), [activeItems, state.settings]);

  const getOutfitSuggestions = useCallback(() => {
    const today = todayLocal();
    if (state.wearLogs.some(l => l.date === today)) return [];
    const retiredIds = new Set(state.items.filter(i => i.retired).map(i => i.id));
    const wearable = state.outfits.filter(o => o.itemIds.every(id => !retiredIds.has(id)));
    const favorites = wearable.filter(o => o.favorite);
    const pool = favorites.length > 0 ? favorites : wearable;
    // Most-recently-worn last: variety without randomness that re-shuffles on render.
    return [...pool]
      .sort((a, b) => (a.lastWorn ?? '').localeCompare(b.lastWorn ?? ''))
      .slice(0, 3);
  }, [state.outfits, state.wearLogs, state.items]);

  return (
    <WardrobeContext.Provider value={{
      ...state,
      activeItems,
      addItem, updateItem, deleteItem, retireItem, unretireItem,
      toggleFavoriteItem, setLaundryStatus,
      addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear, removeWearLog,
      addWishlistItem, updateWishlistItem, deleteWishlistItem, moveWishlistToCloset,
      releaseWishlistItem, keepWishlistItem,
      updateSettings, addCategory, renameCategory, setCategoryQuiet, moveCategory, addOccasion,
      replaceState, markExported,
      getItem, getOutfit,
      getMostWorn, getLeastWorn, getUnwornItems, getWearablePool,
      getOutfitSuggestions,
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
