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
  /** A photograph of the whole look, when one exists. Optional forever. */
  imageUrl?: string;
  /** How the look was built, and the one thing not to do with it. */
  notes?: string;
  stylingNote?: string;
}

export interface WearLog {
  id: string;
  date: string;
  outfitId?: string;
  itemIds: string[];
  notes?: string;
}

/* ---------- the Shared Rail ----------
   Borrowing between people who already know each other. Everything below is
   LOCAL data — records the user keeps, like a contact book. There is no server,
   no account, and nothing syncs; the owner chose to ship the full flow as a
   working local preview, recorded in docs/11-shared-rail.md. The panel's "no
   social graph" rejection was about feeds and followers; a named friend you
   hand a dress to is neither. */

export interface LendablePiece {
  /** Set when the piece is in this closet; friends' pieces are name-only records. */
  itemId?: string;
  name: string;
  category?: CategoryId;
  note?: string;
}

export interface CircleProfile {
  id: string;
  /** '@needle' — typed by the user, unique only by convention. */
  handle: string;
  name: string;
  /** About the clothes and the craft, never a gender or a body. */
  bio?: string;
  /** 1–2 letters on the tag-shaped avatar. Never a face. */
  monogram: string;
  color: string;
  lendable: LendablePiece[];
  /** Curated outfit ids shown on the profile. */
  showcase: string[];
  isMe?: boolean;
}

export type BorrowStatus = 'asked' | 'lent' | 'declined' | 'returned';

export interface CircleMessage {
  id: string;
  groupId: string;
  authorId: string;
  date: string;
  text: string;
  /** Present when the message is a borrow request rather than plain talk. */
  request?: { pieceName: string; status: BorrowStatus };
}

export interface CircleGroup {
  id: string;
  name: string;
  about?: string;
  memberIds: string[];
}

export interface Loan {
  id: string;
  pieceName: string;
  itemId?: string;
  /** The other person's profile id. */
  withId: string;
  /** 'to' — lent out of this closet; 'from' — borrowed into it. */
  direction: 'to' | 'from';
  since: string;
  returned?: string;
}

export interface CircleState {
  profiles: CircleProfile[];
  groups: CircleGroup[];
  messages: CircleMessage[];
  loans: Loan[];
}

export const EMPTY_CIRCLE: CircleState = {
  profiles: [],
  groups: [],
  messages: [],
  loans: [],
};

/* ---------- events ----------
   A trip, a festival, a wedding week, an offsite: a dated occasion you dress
   for more than once, with outfits reserved against its days. Reserving is not
   wearing — an event day only becomes a wear when it is logged, exactly like a
   planned calendar day. */

export type EventKind = 'trip' | 'festival' | 'celebration' | 'work' | 'other';

export interface EventReservation {
  id: string;
  /** The day within the event this look is held for. */
  date: string;
  /** What the day is: "Sangeet", "Board offsite", "Flight home". */
  label?: string;
  outfitId?: string;
  /** Loose pieces held alongside or instead of a saved outfit. */
  itemIds: string[];
  notes?: string;
}

export interface WardrobeEvent {
  id: string;
  name: string;
  kind: EventKind;
  startDate: string;
  endDate?: string;
  place?: string;
  notes?: string;
  reservations: EventReservation[];
}

export const EVENT_LABELS: Record<EventKind, string> = {
  trip: 'Trip',
  festival: 'Festival',
  celebration: 'Celebration',
  work: 'Work',
  other: 'Occasion',
};

/* ---------- accounts and the community layer ----------

   These live OUTSIDE AppState, in their own localStorage keys, because they are
   the only data shared between wardrobes. Each account's clothes stay in its own
   store; the registry below is just the list of wardrobes on this device, and
   the community state is the small amount every wardrobe can see.

   There is no server. "Signing in" picks which local wardrobe to open, and the
   UI says exactly that — see docs/12-accounts-and-feed.md. */

export interface Account {
  id: string;
  name: string;
  handle: string;
  city?: string;
  /** One line, about the clothes and the craft. Never about a body. */
  tagline?: string;
  /** A relative path under public/, or a data-URI for a wardrobe you made. */
  portrait?: string;
  /** Two letters on the tag avatar when there is no portrait. */
  monogram: string;
  color: string;
  createdAt: string;
  /** Seeded demo wardrobes, as opposed to one started on this device. */
  isSample?: boolean;
}

/** What a post carries, captured when it is shared. */
export interface SharedLook {
  outfitId: string;
  name: string;
  imageUrl?: string;
  occasion?: string;
  /** Names only — a viewer cannot open someone else's pieces. */
  pieces: string[];
}

export interface SharedPiece {
  itemId: string;
  name: string;
  imageUrl?: string;
  category?: string;
  color?: string;
}

export type PostAudience = 'everyone' | 'group' | 'nobody';

export interface FeedPost {
  id: string;
  authorId: string;
  date: string;
  /** The wearer's own words. Optional — a look can speak for itself. */
  caption?: string;
  audience: PostAudience;
  look?: SharedLook;
  piece?: SharedPiece;
}

/** A one-to-one thread or the group. Same shape; `memberIds.length` decides. */
export interface Conversation {
  id: string;
  name?: string;
  memberIds: string[];
  isGroup: boolean;
  about?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  date: string;
  text: string;
  look?: SharedLook;
  piece?: SharedPiece;
  /** Borrow requests ride in the same thread; see CircleMessage for the states. */
  request?: { pieceName: string; status: BorrowStatus };
}

export interface CommunityState {
  posts: FeedPost[];
  conversations: Conversation[];
  messages: ChatMessage[];
}

export const EMPTY_COMMUNITY: CommunityState = {
  posts: [],
  conversations: [],
  messages: [],
};

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
  circle: CircleState;
  events: WardrobeEvent[];
  settings: AppSettings;
}

// v3: the Shared Rail (circle). v4: events, for outfits reserved against a trip
// or a festival. Migration seeds both on older exports — scripts/test-migrate.mjs
// holds a case for each.
export const SCHEMA_VERSION = 4;

export const DEFAULT_CATEGORIES: UserCategory[] = [
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'dresses', label: 'One-pieces' },
  { id: 'layers', label: 'Layers' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'jewellery', label: 'Jewellery' },
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
  circle: EMPTY_CIRCLE,
  events: [],
  settings: {
    categories: DEFAULT_CATEGORIES,
    occasions: DEFAULT_OCCASIONS,
    // Dark by default — cataloguing happens at night, and it is the look this
    // wardrobe's owner asked for twice. Light paper stays one tap away.
    theme: 'dark',
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
