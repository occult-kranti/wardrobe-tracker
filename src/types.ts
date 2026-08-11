// Categories and occasions are user-owned data, not fixed unions — the panel was
// unanimous that six fixed boxes erase everyone who dresses outside them.
export type CategoryId = string;
export type Occasion = string;
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type LaundryStatus = 'clean' | 'worn' | 'washing' | 'needs-repair' | 'at-tailor';
export type ItemSource = 'new' | 'secondhand' | 'swapped' | 'gifted' | 'inherited' | 'self-made';
export type WishStatus = 'waiting' | 'kept' | 'let-go' | 'bought';

export interface UserCategory {
  id: CategoryId;
  label: string;
  /** Quiet categories are hidden from browse and the generator; no photo expected. */
  quiet?: boolean;
}

export interface ClothingItem {
  id: string;
  name: string;
  category: CategoryId;
  color: string;
  brand?: string;
  source?: ItemSource;
  /** One free-text line. Deliberately not a size schema. */
  fitsLike?: string;
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
  /** Present means the piece has left the active closet but keeps its history. */
  retired?: { date: string; reason?: string };
}

export interface WishlistItem {
  id: string;
  name: string;
  category: CategoryId;
  color: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  link?: string;
  priority: 'low' | 'medium' | 'high';
  dateAdded: string;
  notes?: string;
  status: WishStatus;
  /** Silent wait. On expiry the card asks once, inline. */
  coolingOff?: { endsAt: string; asked: boolean };
  releasedAt?: string;
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

export interface AppSettings {
  categories: UserCategory[];
  occasions: Occasion[];
  lastExportAt?: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface AppState {
  schemaVersion: number;
  items: ClothingItem[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  wishlist: WishlistItem[];
  settings: AppSettings;
}

export const SCHEMA_VERSION = 2;

export const DEFAULT_CATEGORIES: UserCategory[] = [
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'dresses', label: 'One-pieces' },
  { id: 'layers', label: 'Layers' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessories', label: 'Accessories' },
];

// 'performance' sits here exactly as flatly as 'work'.
export const DEFAULT_OCCASIONS: Occasion[] = [
  'casual', 'work', 'formal', 'performance', 'sport', 'party',
];

export const initialState: AppState = {
  schemaVersion: SCHEMA_VERSION,
  items: [],
  outfits: [],
  wearLogs: [],
  wishlist: [],
  settings: {
    categories: DEFAULT_CATEGORIES,
    occasions: DEFAULT_OCCASIONS,
    theme: 'system',
  },
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

export const LAUNDRY_LABELS: Record<LaundryStatus, string> = {
  clean: 'Ready',
  worn: 'Needs wash',
  washing: 'In the wash',
  'needs-repair': 'Needs repair',
  'at-tailor': 'At the tailor',
};

/** Benched pieces are neither clean nor dirty — they're out of rotation. */
export const BENCHED_STATUSES: LaundryStatus[] = ['needs-repair', 'at-tailor'];

export const SOURCE_LABELS: Record<ItemSource, string> = {
  new: 'New',
  secondhand: 'Secondhand',
  swapped: 'Swapped',
  gifted: 'Gifted',
  inherited: 'Inherited',
  'self-made': 'Made by me',
};

export const RETIRE_REASONS = [
  "Doesn't fit anymore",
  'Not me anymore',
  'Donated',
  'Swapped on',
  'Worn out',
  'Cut for patterns',
];

export const PRIORITY_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// Muted, complex tones — the panel singled these out as the one part of the old
// design with taste. Kept, extended, no neon.
export const PRESET_COLORS = [
  '#201D18', '#3A362E', '#6B6560', '#A8A39E',
  '#F4EFE2', '#FBF8F0', '#FFFFFF',
  '#5E4232', '#8B4513', '#BE1231', '#771324',
  '#C9A227', '#7D5813', '#D4A574', '#E8D5B7',
  '#2E6B4F', '#5A7A6E', '#31415E', '#6B8FA3',
  '#8B6B8F', '#C48B9E', '#A86E82', '#D9C4A3',
];

export function categoryLabel(settings: AppSettings, id: CategoryId): string {
  return settings.categories.find(c => c.id === id)?.label ?? id;
}

export function isQuietCategory(settings: AppSettings, id: CategoryId): boolean {
  return settings.categories.find(c => c.id === id)?.quiet === true;
}

export function isActive(item: ClothingItem): boolean {
  return !item.retired;
}

export function isBenched(item: ClothingItem): boolean {
  return BENCHED_STATUSES.includes(item.laundryStatus);
}

/** Title-cases a free-form tag for display without mangling the stored value. */
export function displayTag(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
