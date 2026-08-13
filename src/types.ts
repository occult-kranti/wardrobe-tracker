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
  /** A hand-me-down's frozen record of where it came from — captured at the
      moment it was offered, never a live link into the giver's wardrobe. The
      giver keeps their own wears; this is the memory that travels. */
  provenance?: { from: string; wearsInTheirRecord?: number; passedOn: string };
  /**
   * Where the piece physically lives — which drawer of which chest.
   *
   * Absent is a real answer and by far the commonest one. An unfiled piece must
   * never read as an error, a warning, or a chore: no badge, no count bubble,
   * no percentage filed. The focus group vetoed all three by name, and the
   * house already bans progress-as-achievement.
   */
  place?: { furnitureId: string; slotId: string };
}

/**
 * FURNITURE — the thing a garment lives in.
 *
 * A rail is first, and stays first, because the panel's studio-flat seat put it
 * plainly: "I have a rail and a chair. I am not typing 'chair' into a dropdown
 * that offers me 'dresser'." Nobody is short of furniture, and the app must
 * never imply someone owns too little of it — which is also why the list below
 * runs from the cheapest object to the grandest and not the other way round.
 *
 * A form earns its place by being a different DRAWING. "Handbag storage" is not
 * a form; a row of pegs is. "Jewellery" is not a form; a lidded box of trays
 * is, and a bangle stand is a third thing again, because a post is not a tray.
 * Anything that would be an existing drawing with a different word on it was
 * cut.
 *
 * What is NOT here, and never will be: a capacity, a size, a fullness
 * percentage. Every one of the three panels struck it independently — a drawer
 * that knows when it is full is inventory software, and a fullness meter is a
 * completion meter under another name. How full a drawer is gets DRAWN, from
 * the count of what is in it, and is never stored.
 */
export type FurnitureForm =
  | 'rail' | 'chest' | 'shelves'
  // The two almirahs. Not a chest with a different word on it: an almirah is
  // one tall case whose inside is DIVIDED — a hanging side, a lockable
  // compartment, shelves stacked beside them, a drawer under the lot — and that
  // division is fixed by the object rather than chosen by the owner. It is the
  // commonest wardrobe on earth and the app had no drawing for it.
  | 'almirah' | 'almirah-carved'
  // The fitted one: a steel carcass with wooden doors, and an inside that is
  // not N of the same thing — a hanging ledge, a jewellery tray, a shoe tier, a
  // stand for bags. The wardrobe somebody had built rather than bought.
  | 'almirah-fitted'
  // Things that hold what is not a garment. Every one of these earns its place
  // by being a different SHAPE, not a different noun: a tray is not a drawer, a
  // peg is not a shelf, and a bangle stand is a post.
  | 'box' | 'hooks' | 'stand' | 'rack';

export const FURNITURE_FORMS: FurnitureForm[] = [
  'rail', 'chest', 'shelves', 'almirah', 'almirah-carved', 'almirah-fitted',
  'box', 'hooks', 'stand', 'rack',
];

export interface FurnitureSlot {
  id: string;
  /** Always non-empty — generated on creation, editable afterwards. */
  label: string;
  /**
   * PACKED AWAY — the winter coats in the top of the almirah, the wedding
   * clothes in the trunk.
   *
   * The one thing a place can say about itself that changes anything elsewhere,
   * and the case the focus group named as the whole point of having places at
   * all: what is packed should stop being offered on a Tuesday in July. It is
   * NOT retirement and NOT a bench state — the pieces stay in the closet, keep
   * every wear, stay searchable, and can be worn the moment you go and get
   * them. All that changes is that the day's suggestions stop reaching for
   * them.
   *
   * Absent means not packed, which is almost everything, forever.
   */
  packed?: boolean;
}

/**
 * A CARVED TREATMENT, on the one form grand enough to carry one.
 *
 * Absent means plain, so every piece that already exists is untouched and
 * always will be. It changes no working part: the artist's law is that nothing
 * inside the carcass may be ornamented, because everything in there — the rod,
 * the trays, the locker, the labels, the tap targets — is a control.
 */
export type Ornament = 'plain' | 'mughal' | 'rajput' | 'shoji';

export const ORNAMENTS: Ornament[] = ['plain', 'mughal', 'rajput', 'shoji'];

export interface Furniture {
  id: string;
  name: string;
  form: FurnitureForm;
  /** Only ever read for a fitted almirah. Absent is plain. */
  ornament?: Ornament;
  /** At least one, and at most that form's own maximum — see FORM_MAX_SLOTS. */
  slots: FurnitureSlot[];
  note?: string;
  dateAdded: string;
}

/**
 * HOW MANY COMPARTMENTS EACH FORM CAN HAVE.
 *
 * Every one of these numbers is a DRAWING limit, not an inventory limit, and
 * that is the only kind of limit this app is allowed to have. A form stops
 * where its own picture stops being legible at 390px — below a 44px tap target
 * the control is broken, so the count that would break it is the count that is
 * refused. Nothing here caps how much you may OWN; an eighth drawer is a second
 * chest, which is a truer description of a bedroom anyway.
 *
 * Lives in types.ts rather than in the generator because the migration has to
 * enforce it and the migration must not import a drawing.
 */
export const FORM_MAX_SLOTS: Record<FurnitureForm, number> = {
  rail: 5,
  chest: 7,
  shelves: 6,
  almirah: 6,
  'almirah-carved': 6,
  'almirah-fitted': 7,
  box: 4,
  hooks: 5,
  stand: 4,
  rack: 5,
};

/**
 * How many places one wardrobe may hold.
 *
 * The room drawing shows the first eight along its wall and the rest through
 * the door, so this is the point past which the door stops meaning "more" and
 * starts meaning "a filing cabinet". Twenty-four is four bedrooms' worth. It is
 * a ceiling nobody will meet, which is what a good ceiling is.
 */
export const MAX_FURNITURE = 24;

/** Long enough for "The almirah in the back bedroom", short enough to draw. */
export const MAX_FURNITURE_NAME = 60;
export const MAX_SLOT_LABEL = 40;

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
  /** True while this entry is an INTENTION, not a fact. A plan used to be
      recognised by its date being in the future, which meant every plan
      silently became a "wear" the morning its day arrived — counted by the
      Ledger, sealed by the Calendar, never reflected in any wearCount — and
      Undo on that fiction decremented counts that had never moved. The flag
      is cleared only by confirmPlan, when the person says it happened. */
  planned?: boolean;
}

/** The one honest question about a log: is it still an intention? */
export function isPlannedLog(log: WearLog): boolean {
  return log.planned === true;
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
  /** Which build of the sample seed this wardrobe was written by. A sample
      whose number trails the code's is rebuilt at boot — without this, fixing
      the seed only fixes it for people who have never opened the app. */
  seedVersion?: number;
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

/**
 * Who a shared look is meant for.
 *
 * `self` is genuinely distinct from not sharing at all: unshared means no record
 * exists, `self` means the record exists and appears on your own profile and
 * nowhere else. Both are reachable, and taking a look off removes the record.
 *
 * These are labels on a shared shelf, not locks. Everything on this device sits
 * in one file that every wardrobe here can read, and the UI says so rather than
 * implying an enforcement it cannot perform.
 */
export type ShareScope =
  | { kind: 'everyone' }
  | { kind: 'conversation'; conversationId: string }
  | { kind: 'person'; accountId: string }
  | { kind: 'household'; householdId: string }
  | { kind: 'self' };

export const SCOPE_LABELS: Record<ShareScope['kind'], string> = {
  everyone: 'Everyone here',
  conversation: 'One conversation',
  person: 'One person',
  household: 'Just the household',
  self: 'Only this wardrobe',
};

export interface FeedPost {
  id: string;
  authorId: string;
  date: string;
  /** The wearer's own words. Optional — a look can speak for itself. */
  caption?: string;
  scope: ShareScope;
  look?: SharedLook;
  piece?: SharedPiece;
}

/** Can `viewerId` see this post? Authors always see their own. */
export function postVisibleTo(
  post: FeedPost,
  viewerId: string | null,
  conversations: Conversation[],
  households: Household[] = []
): boolean {
  if (post.authorId === viewerId) return true;
  const scope = post.scope;
  switch (scope.kind) {
    case 'everyone':
      return true;
    case 'person':
      return scope.accountId === viewerId;
    case 'conversation': {
      if (!viewerId) return false;
      const target = conversations.find(c => c.id === scope.conversationId);
      return target !== undefined && target.memberIds.includes(viewerId);
    }
    case 'household': {
      if (!viewerId) return false;
      const target = households.find(h => h.id === scope.householdId);
      // Joined members only — an invitation you have not answered shows you nothing.
      return target !== undefined && target.members.some(m => m.accountId === viewerId && m.joined);
    }
    case 'self':
      return false;
  }
}

/** A one-to-one thread or the group. Same shape; `memberIds.length` decides. */
export interface Conversation {
  id: string;
  name?: string;
  memberIds: string[];
  isGroup: boolean;
  about?: string;
  /** Set when this thread IS a household's room; membership follows the roof. */
  householdId?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  date: string;
  text: string;
  look?: SharedLook;
  piece?: SharedPiece;
  /**
   * Borrow requests ride in the same thread. `ownerId` is whose piece it is —
   * a request is always between two wardrobes even when written in a group, and
   * only the owner may advance it.
   */
  request?: { pieceName: string; status: BorrowStatus; ownerId?: string };
}

/**
 * Wardrobes on this device joined under one roof. The kind describes the ROOM,
 * not what any two members are to each other — one person can belong to a
 * partners household, a housemates household and a family household at once,
 * because those are three rooms, not three labels on one edge. A household
 * stores ids and a kind and nothing else: no roles, no shape, no size checks
 * (docs/06 §2.7 — no field anywhere can encode couple-shape). Membership is
 * flat; a member without `joined` is an invitation still waiting for its yes.
 */
export type HouseholdKind = 'roommates' | 'partners' | 'family';

export const HOUSEHOLD_KIND_LABELS: Record<HouseholdKind, string> = {
  roommates: 'Housemates',
  partners: 'Partners',
  family: 'Family',
};

export interface Household {
  id: string;
  name?: string;
  kind: HouseholdKind;
  members: Array<{ accountId: string; joined?: string }>;
}

/**
 * A hand-me-down mid-air. The offer is a SNAPSHOT — no code path ever writes
 * into a wardrobe that is not open, so the piece appears in the receiver's
 * tray and is accepted from inside, or it never lands at all. "If a thing can
 * appear in my closet because someone else pressed a button, it isn't my
 * closet."
 */
export interface PassOffer {
  id: string;
  fromId: string;
  toId: string;
  piece: SharedPiece;
  provenance: { from: string; wearsInTheirRecord?: number; passedOn: string };
  status: 'offered' | 'accepted' | 'declined';
}

export interface CommunityState {
  posts: FeedPost[];
  conversations: Conversation[];
  messages: ChatMessage[];
  households: Household[];
  passes: PassOffer[];
}

export const EMPTY_COMMUNITY: CommunityState = {
  posts: [],
  conversations: [],
  messages: [],
  households: [],
  passes: [],
};

/**
 * Which room the app is shown in. This belongs to the eyes looking at the
 * screen, not to a wardrobe — three closets on one device should not each drag
 * the interface to a different palette when opened. Stored device-level.
 */
export type Theme = 'light' | 'dark' | 'salon' | 'gilt' | 'dyehouse' | 'obsidian' | 'system';

export const THEME_LABELS: Record<Theme, string> = {
  light: 'The pattern room',
  dark: 'The atelier at night',
  salon: 'The salon',
  gilt: 'The gilding room',
  dyehouse: 'The dye house',
  obsidian: 'The obsidian',
  system: 'Follow the device',
};

export interface AppSettings {
  categories: UserCategory[];
  occasions: Occasion[];
  lastExportAt?: string;
  /** Kept for older exports; the live value is device-level — see Theme below. */
  theme?: Theme;
}

export interface AppState {
  schemaVersion: number;
  items: ClothingItem[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  wishlist: WishlistItem[];
  circle: CircleState;
  events: WardrobeEvent[];
  /** The furniture a piece can be filed in. Empty until someone draws one. */
  furniture: Furniture[];
  settings: AppSettings;
}

// v3: the Shared Rail (circle). v4: events, for outfits reserved against a trip
// or a festival. v5: provenance on a hand-me-down. v6: furniture — where a piece
// physically lives. Migration seeds each on older exports; scripts/test-migrate.mjs
// holds a case for every one, written before the field existed.
export const SCHEMA_VERSION = 7;

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
  furniture: [],
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
  'Passed on',
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
