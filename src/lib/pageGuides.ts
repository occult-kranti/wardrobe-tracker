/**
 * One short guide per screen — what it is for, what to do on it, and the one
 * word this app uses that no other wardrobe app does.
 *
 * Why this exists at all: the first-run tour (src/lib/tutorial.ts) is four
 * cards, shown once, on Today. It cannot teach fifteen screens without becoming
 * a wizard, and a wizard is a nag. So the teaching is split — the tour keeps
 * the shape of the app, and every screen carries its own paragraph, asked for
 * rather than pushed.
 *
 * Keyed by the paths in src/lib/routes.ts, because two lists of addresses
 * always drift and this one has to agree with the router or the guide opens on
 * the wrong page. Framework-free on purpose: nothing here imports React, so the
 * same record can be read by the native app in app/ when its screens land.
 *
 * THE LENGTH RULE. A lede, at most three things to do, at most one word
 * defined. If a screen cannot be explained inside that, the screen is asking
 * too much of a first-time visitor and the fix belongs in the screen, not in a
 * longer paragraph here.
 *
 * AND THE GUIDES ARE SEATED BY THE SAME FLAG AS THE ROOMS (docs/42 §2). A
 * guide is a plaque by another name: one that explains a grid the branch does
 * not render, or a room that answers with Today, teaches a stranger about a
 * door that is not in the house this season. The record keeps every word; the
 * flag decides which are on the wall.
 */
import { FEED_ENABLED } from '@almari/shared/flags';


export interface Guide {
  /** What to head the sheet with — the screen's name as the house says it. */
  title: string;
  /** One sentence: what this screen is FOR. */
  lede: string;
  /** Two or three things to actually do here. Never more. */
  doing: string[];
  /**
   * The house word this screen uses without explaining. Optional, and mostly
   * absent: three runs over the app found the jargon concentrated on about six
   * screens, and defining a word on a screen that does not use it is noise.
   */
  term?: { word: string; meaning: string };
}

/**
 * The Look Book's own guides, held apart so the flag seats them as one.
 *
 * Flag off, /feed and /explore answer with Today, so no pathname the router can
 * settle on ever asks for these. They stay in the record and out of
 * guidedPaths(), and they walk back in with the rooms.
 */
const LOOK_BOOK_GUIDES: Record<string, Guide> = {
  '/feed': {
    title: 'The feed',
    lede: 'Looks that wardrobes have put on show, newest first.',
    doing: [
      'Newest first is the whole order. Nothing here is ranked, counted or scored — and the rail up top simply holds what went on show in the last day.',
      'A look reaches the feed only when its wardrobe shares it, and what arrives is a snapshot taken at that moment — never a window into anyone’s closet.',
      'The bookmark at the top right of a look sets it aside for later. Set-aside looks stay on this device, and nobody is told.',
    ],
  },

  '/explore': {
    title: 'Explore',
    lede: 'Everything on show, laid out to browse — the same looks the feed holds, never more.',
    doing: [
      'Search what is on show, or narrow it with a chip. A filter is you asking a question; nothing here ranks the answers.',
      'Tap a tile to see the whole card, with the same verbs the feed offers.',
      'Cards marked “from the commons” are bundled samples — animals and plants keeping a young feed company. They come from no one’s wardrobe.',
    ],
    term: {
      word: 'On show',
      meaning: 'Shared by its wardrobe, one look at a time. What is not shared is not here.',
    },
  },
};

const GUIDES: Record<string, Guide> = {
  '/': {
    title: 'Today',
    lede: 'Today is where a day goes on the record.',
    doing: [
      'Tap the log-wear button, then tap the pieces that went on. That is the whole entry: two taps, and the day is kept.',
      'If a look was planned for today, Today asks whether it happened. Answering settles it either way.',
      'The four counts underneath are the closet at a glance. "Resting" is how many pieces have had no first wear yet.',
    ],
    term: {
      word: 'A piece',
      meaning: 'One garment on the record — a shirt, a pair of shoes, a ring.',
    },
  },

  '/closet': {
    title: 'The closet',
    lede: 'Everything the wardrobe holds, in one place.',
    doing: [
      'Add a piece with the + in the top bar. A name is enough; a photograph is welcome and never asked for.',
      'Filter by kind, colour or season to find something, and tap a piece to open its record — its wears, its cost, and what it now costs per wear.',
      'A piece you are finished with is retired, not deleted. It leaves the rotation and keeps its history.',
    ],
    term: {
      word: 'Benched',
      meaning: 'Out of rotation while a piece is in the wash or waiting on a repair. It comes back when you say it has.',
    },
  },

  '/outfits': {
    title: 'Outfits',
    lede: 'Combinations worth keeping, and a way to be handed one when nothing comes to mind.',
    doing: [
      'Put a set together and save it. A saved outfit logs in one tap, and can be scheduled on the calendar.',
      'Or draw a set, and the app deals a combination from what is available.',
      'Pieces in the wash, at the tailor, or in a category you have set aside are left out of the draw.',
    ],
    term: {
      word: 'A quiet category',
      meaning: 'A category set aside in Settings. Its pieces stay on the record but are kept out of browsing and out of the draw.',
    },
  },

  '/calendar': {
    title: 'The calendar',
    lede: 'The record laid out by day: what was worn, and what is planned.',
    doing: [
      'Tap a day that has passed to log or correct what was worn. The record can always be put right.',
      'Tap a day ahead and schedule an outfit for it. Today asks about it when the day comes.',
    ],
  },

  '/ledger': {
    title: 'The ledger',
    lede: 'The arithmetic: what the closet holds, what it cost, and what each piece has come to cost per wear.',
    doing: [
      'Put a cost on a piece — on the piece itself, in the closet — and it starts dividing by that piece’s wears.',
      'Costs are optional and can be added at any time. Until one is recorded there is nothing to divide, and the money half of this page stays blank.',
      'Read "Most worn" and "Resting" together. The distance between them is the thing this app is for.',
    ],
    term: {
      word: 'Cost per wear',
      meaning: 'What a piece cost, divided by the wears logged against it. It falls every time the piece goes on.',
    },
  },

  '/wishlist': {
    title: 'The wishlist',
    lede: 'Things you are considering, held for a while before you decide.',
    doing: [
      'Add what you are thinking about, with its price and how long to wait.',
      'Nothing is said while it waits — no reminder, no count. When the wait is up, the card asks once: keep it, let it go, or mark it bought.',
      'While it waits, the closet answers back with the pieces you already own that come close.',
    ],
  },

  '/compare': {
    title: 'Before you buy',
    lede: 'Hold something you are tempted by against what the closet already has.',
    doing: [
      'Describe the piece in your hands — kind, colour, price — and the page finds the nearest things already on the record.',
      'It reports what those cost, how often they go on, and what they have come to cost per wear. Then it stops. The conclusion is yours.',
      'From here the thing can go on the wishlist to wait, or you can decide you own enough of that already.',
    ],
  },

  '/events': {
    title: 'Events',
    lede: 'Occasions with a date, so what to wear is settled before the morning of.',
    doing: [
      'Add an event with its date, then reserve the look you mean to wear.',
      'A reservation is a plan, not a wear. The day is logged when it arrives, like any other day.',
      'If a reserved look has a gap, the page offers pieces already on the record to fill it. It never suggests anything to buy.',
    ],
  },

  ...(FEED_ENABLED ? LOOK_BOOK_GUIDES : {}),

  '/rail': {
    title: 'The shared rail',
    lede: 'The lending record between wardrobes: what has gone out, and what has come home.',
    doing: [
      'Wardrobes joined under one roof share a rail. Each shows which of its pieces are open to borrow.',
      'Ask after a piece and its owner answers — lend it, or it stays home. Either answer is a plain fact about a garment.',
      '"Out and back" is the standing list of loans. Mark a piece returned when it comes home and it goes back into rotation.',
    ],
    term: {
      word: 'A rail',
      meaning: 'Here, a lending record between wardrobes. What hangs in your own room is the closet.',
    },
  },

  '/chats': {
    title: 'Conversations',
    lede: 'Messages between the wardrobes on this device — for asking after a piece, sending a look, or saying when it came home.',
    doing: [
      'Start a thread and attach a look or a piece. Attaching shows something; it does not lend it.',
      'Ask after a piece and its owner decides. Only the owner can lend.',
      'When it comes home, mark it returned and the loan closes on the shared rail.',
    ],
  },

  /**
   * Two readings of one page, because the page itself has two shapes: with the
   * Look Book seated it leads with the on-show grid, and without it the page is
   * the wardrobe alone. The showcase branch restores the first words exactly.
   */
  '/profile': FEED_ENABLED ? {
    title: 'A profile',
    lede: 'How a wardrobe looks to the others it shares with: a name, a handle, and the looks it has chosen to show.',
    doing: [
      'Only what has been shared appears here. Nothing reads a closet to fill this page.',
      'Join wardrobes under a roof to share a rail with them and see one another’s looks.',
    ],
  } : {
    title: 'A profile',
    lede: 'How a wardrobe looks to the others it shares with: a name, a handle, and the way it dresses.',
    doing: [
      'Your own page carries the counts — pieces on the rail, wears noted, outfits kept, what it cost.',
      'Join wardrobes under a roof to share a rail with them.',
      'Nothing here reads anyone else’s closet. A wardrobe says only what it has chosen to say.',
    ],
  },

  '/furniture': {
    title: 'The dressing room',
    lede: 'Where the clothes actually live: the rails, drawers and shelves in the room.',
    doing: [
      'Draw a place — a rail, a drawer, a shelf — and name it.',
      'Put pieces in it, and the closet can then answer "where is it", not only "what is it".',
      'Nothing here changes a piece. It is the same closet, sorted by address.',
    ],
  },

  '/intake': {
    title: 'Catalogue from photos',
    lede: 'The fast road into a wardrobe: photograph clothes, and let the pieces come out of the photograph.',
    doing: [
      'Photograph what you have on, lay several garments out and photograph the lot, read in a gallery, or paste a screenshot.',
      'Reading the photograph is the one step that uses the network — it makes a single trip and comes back as words. The cutting out happens on this device.',
      'Everything arrives as a draft, with its doubts stated. Nothing is written to the closet until you say so.',
    ],
  },

  '/settings': {
    title: 'Settings',
    lede: 'What this wardrobe calls things, how it looks, and where the record lives.',
    doing: [
      'Export writes the whole record as one file, worth keeping somewhere safe. Import reads one back.',
      'The record lives in this browser. An account is optional, and a wardrobe only leaves this device if you switch sync on for that wardrobe.',
      'The short tour waits here too, under "Replay the tour".',
    ],
    term: {
      word: 'Categories and occasion tags',
      meaning: 'The words this wardrobe files things under. Change them here and the rest of the app follows.',
    },
  },

  '/open': {
    title: 'Wardrobes',
    lede: 'This device can hold more than one wardrobe; this is where you switch between them or start another.',
    doing: [
      'Open a wardrobe and every other screen shows that one. Each keeps its own closet, its own ledger, its own record.',
      'The sample wardrobes can be added from here — worked closets with a year of wear in them, useful for seeing what a full record looks like before cataloguing your own.',
      'Closing a wardrobe leaves it on the device. Retiring one removes it, so export it first if the record is worth keeping.',
    ],
  },
};

/**
 * The guide for an address, or null where there is none.
 *
 * A path with one further segment — /chats/:id, /rail/:id, /profile/:id,
 * /furniture/:id, /open/new — falls back to its parent's guide, because a
 * conversation is still conversations and a place is still the dressing room.
 * Anything with no guide gets no control at all, which is the honest answer for
 * /admin (an alpha-only portal, not a room in the product) and for an address
 * that does not exist.
 */
export function guideFor(pathname: string): Guide | null {
  const key = guideKeyFor(pathname);
  return key ? GUIDES[key] : null;
}

/**
 * Which guide an address reads, as a storage key — the parent's path, not the
 * address visited.
 *
 * /chats/abc and /chats/def show the same guide, so marking them apart would
 * leave the "not opened yet" mark standing on a guide already read.
 */
export function guideKeyFor(pathname: string): string | null {
  if (GUIDES[pathname]) return pathname;
  const cut = pathname.lastIndexOf('/');
  if (cut <= 0) return null;
  const parent = pathname.slice(0, cut);
  return GUIDES[parent] ? parent : null;
}

/** Every guided address, for anything that wants to count or clear them. */
export function guidedPaths(): string[] {
  return Object.keys(GUIDES);
}
