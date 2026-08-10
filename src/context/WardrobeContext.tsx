import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { ClothingItem, Outfit, WearLog, AppState } from '../types';

const initialState: AppState = {
  items: [],
  outfits: [],
  wearLogs: [],
};

interface WardrobeContextType extends AppState {
  addItem: (item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount'>) => void;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
  deleteItem: (id: string) => void;
  toggleFavoriteItem: (id: string) => void;
  addOutfit: (outfit: Omit<Outfit, 'id' | 'dateCreated' | 'wearCount'>) => void;
  deleteOutfit: (id: string) => void;
  toggleFavoriteOutfit: (id: string) => void;
  logWear: (itemIds: string[], outfitId?: string) => void;
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

  const addItem = useCallback((item: Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount'>) => {
    const newItem: ClothingItem = {
      ...item,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
      wearCount: 0,
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

  const logWear = useCallback((itemIds: string[], outfitId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newLog: WearLog = {
      id: crypto.randomUUID(),
      date: today,
      itemIds,
      outfitId,
    };
    setState(prev => ({
      ...prev,
      wearLogs: [...prev.wearLogs, newLog],
      items: prev.items.map(item =>
        itemIds.includes(item.id)
          ? { ...item, wearCount: item.wearCount + 1, lastWorn: today }
          : item
      ),
      outfits: prev.outfits.map(o =>
        o.id === outfitId
          ? { ...o, wearCount: o.wearCount + 1, lastWorn: today }
          : o
      ),
    }));
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
    const today = new Date().toISOString().split('T')[0];
    const todayLog = state.wearLogs.find(l => l.date === today);
    if (todayLog) return [];
    return state.outfits.filter(o => o.favorite).sort(() => Math.random() - 0.5).slice(0, 3);
  }, [state.outfits, state.wearLogs]);

  return (
    <WardrobeContext.Provider value={{
      ...state,
      addItem, updateItem, deleteItem, toggleFavoriteItem,
      addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear,
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
