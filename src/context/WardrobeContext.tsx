import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { todayLocal, isFutureDate } from '../lib/dates';
import type { ClothingItem, Outfit, WearLog, WishlistItem, AppState } from '../types';

const initialState: AppState = {
  items: [],
  outfits: [],
  wearLogs: [],
  wishlist: [],
};

interface WardrobeContextType extends AppState {
  addItem: (item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'laundryStatus'>) => void;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
  deleteItem: (id: string) => void;
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
  getItem: (id: string) => ClothingItem | undefined;
  getOutfit: (id: string) => Outfit | undefined;
  getItemsByCategory: (category: ClothingItem['category']) => ClothingItem[];
  getMostWorn: (limit?: number) => ClothingItem[];
  getLeastWorn: (limit?: number) => ClothingItem[];
  getUnwornItems: () => ClothingItem[];
  getWearCount: (id: string) => number;
  getOutfitSuggestions: () => Outfit[];
}

const WardrobeContext = createContext<WardrobeContextType | null>(null);

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<AppState>('wardrobe-tracker', initialState);

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
    const newLog: WearLog = {
      id: crypto.randomUUID(),
      date: logDate,
      itemIds,
      outfitId,
    };
    setState(prev => {
      // Wearing an outfit always credits every item in it.
      const creditedIds = outfitId
        ? Array.from(new Set([...itemIds, ...(prev.outfits.find(o => o.id === outfitId)?.itemIds ?? [])]))
        : itemIds;
      // Future dates are plans: record the log, but don't touch wear
      // counts or laundry until the day actually happens.
      if (planned) {
        return { ...prev, wearLogs: [...prev.wearLogs, { ...newLog, itemIds: creditedIds }] };
      }
      return {
        ...prev,
        wearLogs: [...prev.wearLogs, { ...newLog, itemIds: creditedIds }],
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
        // Un-count real (non-planned) wears so stats stay honest.
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
        imageUrl: wishItem.imageUrl || `https://placehold.co/300x400/${wishItem.color.replace('#', '')}/ffffff?text=${encodeURIComponent(wishItem.name)}`,
        dateAdded: new Date().toISOString(),
        wearCount: 0,
        favorite: false,
        season: ['spring', 'summer', 'fall', 'winter'],
        occasion: ['casual'],
        cost: wishItem.price,
        notes: wishItem.notes,
        laundryStatus: 'clean',
      };
      return {
        ...prev,
        items: [...prev.items, newItem],
        wishlist: prev.wishlist.filter(w => w.id !== id),
      };
    });
  }, [setState]);

  const getItem = useCallback((id: string) => state.items.find(i => i.id === id), [state.items]);
  const getOutfit = useCallback((id: string) => state.outfits.find(o => o.id === id), [state.outfits]);
  const getItemsByCategory = useCallback((category: ClothingItem['category']) =>
    state.items.filter(i => i.category === category), [state.items]);
  const getMostWorn = useCallback((limit = 5) =>
    [...state.items].sort((a, b) => b.wearCount - a.wearCount).slice(0, limit), [state.items]);
  const getLeastWorn = useCallback((limit = 5) =>
    [...state.items].sort((a, b) => a.wearCount - b.wearCount).slice(0, limit), [state.items]);
  const getUnwornItems = useCallback(() =>
    state.items.filter(i => i.wearCount === 0), [state.items]);
  const getWearCount = useCallback((id: string) =>
    state.items.find(i => i.id === id)?.wearCount ?? 0, [state.items]);
  const getOutfitSuggestions = useCallback(() => {
    const today = todayLocal();
    const todayLog = state.wearLogs.find(l => l.date === today);
    if (todayLog) return [];
    return state.outfits.filter(o => o.favorite).sort(() => Math.random() - 0.5).slice(0, 3);
  }, [state.outfits, state.wearLogs]);

  return (
    <WardrobeContext.Provider value={{
      ...state,
      addItem, updateItem, deleteItem, toggleFavoriteItem, setLaundryStatus,
      addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear, removeWearLog,
      addWishlistItem, updateWishlistItem, deleteWishlistItem, moveWishlistToCloset,
      getItem, getOutfit, getItemsByCategory,
      getMostWorn, getLeastWorn, getUnwornItems, getWearCount,
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
