export type Category = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'shoes' | 'accessories';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Occasion = 'casual' | 'work' | 'formal' | 'sport' | 'party';
export type LaundryStatus = 'clean' | 'worn' | 'washing';

export interface ClothingItem {
  id: string;
  name: string;
  category: Category;
  color: string;
  brand?: string;
  pattern?: string;
  material?: string;
  season: Season[];
  occasion: Occasion[];
  imageUrl: string;
  dateAdded: string;
  lastWorn?: string;
  wearCount: number;
  cost?: number;
  favorite: boolean;
  notes?: string;
  laundryStatus: LaundryStatus;
}

export interface WishlistItem {
  id: string;
  name: string;
  category: Category;
  color: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  link?: string;
  priority: 'low' | 'medium' | 'high';
  dateAdded: string;
  notes?: string;
  purchased: boolean;
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  category?: string;
  occasion?: Occasion;
  favorite: boolean;
  dateCreated: string;
  wearCount: number;
  lastWorn?: string;
}

export interface WearLog {
  id: string;
  date: string;
  outfitId?: string;
  itemIds: string[];
  notes?: string;
}

export interface AppState {
  items: ClothingItem[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  wishlist: WishlistItem[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  accessories: 'Accessories',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  outerwear: '🧥',
  shoes: '👟',
  accessories: '👜',
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  casual: 'Casual',
  work: 'Work',
  formal: 'Formal',
  sport: 'Sport',
  party: 'Party',
};

export const PRESET_COLORS = [
  '#1a1a1a', '#3d3d3d', '#6b6560', '#a8a39e',
  '#f5f0eb', '#faf8f5', '#ffffff',
  '#8b4513', '#c4705a', '#d4a03d', '#c48b9e',
  '#7a9e7e', '#5a7a6e', '#6b8fa3', '#8b6b8f',
  '#c45b5a', '#a03d3d', '#3d5aa0', '#2d6b4a',
  '#d4a574', '#e8d5b7', '#f0e6d3', '#d9c4a3',
];

export const LAUNDRY_LABELS: Record<LaundryStatus, string> = {
  clean: 'Clean',
  worn: 'Needs Wash',
  washing: 'In Laundry',
};

export const LAUNDRY_ICONS: Record<LaundryStatus, string> = {
  clean: '✨',
  worn: '👕',
  washing: '🧺',
};

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
