/**
 * PER-PAGE WALKTHROUGHS — the step scripts, and nothing else.
 *
 * The spec is docs/43. The short version: every guided screen may carry one
 * stepped walkthrough, reached from a single tertiary control in the foot of
 * that screen's guide sheet. Two doors deep, both pulled by the reader — which
 * is the whole of what keeps this legal beside src/lib/pageGuides.ts, whose own
 * comment block promises a guide never opens itself.
 *
 * A SIBLING OF pageGuides.ts, NOT A FIELD INSIDE IT (docs/43 §2). The seventeen
 * shipped Guide entries and the Guide interface are not edited at all, which is
 * the proof the shipped guides cannot regress behind this. Keying through
 * guideKeyFor inherits the flag seating for free: a tutorial can only exist
 * where a guide already stands, so no tutorial can point at a Look Book room
 * that answers with Today.
 *
 * Framework-free on purpose, like its sibling — nothing here imports React, so
 * the native app in app/ can read the same step copy and bind its own anchors.
 * The resolver that turns a StepTarget into an element touches the DOM and
 * therefore lives in src/components/Tutorial.tsx, not here.
 *
 * THE LENGTH LAW, inherited from pageGuides.ts: at most five steps. A screen
 * that needs more is asking too much of a first-timer, and the fix belongs in
 * the screen. scripts/test-features.mjs fails on a sixth.
 *
 * THE COPY LAW (.claude/skills/wardrobe-brand/SKILL.md §12): address the
 * clothes and the page, never the reader's diligence. No exclamation point, no
 * congratulation, no progress talk. Nothing here counts anything but steps.
 */
import { guideKeyFor } from './pageGuides';

/**
 * Where a step points. Not a CSS selector: a role and an accessible name,
 * resolved by the same idiom the suites already use to find things.
 *
 * The name is matched EXACTLY (case-insensitive, whitespace collapsed) — see
 * docs/43 §1.2: three visible controls on /settings contain the word "Export",
 * and a substring match rings the wrong one. A label that legitimately changes
 * with state lists its alternatives instead; the first visible one wins.
 *
 * Apostrophes in a name are the TYPEWRITER kind, because that is the character
 * the page files actually render — "Log today's wear" is written with U+0027 in
 * Dashboard.tsx, and a curly one here would resolve to nothing at all.
 */
export interface StepTarget {
  role: 'button' | 'link' | 'textbox' | 'tab' | 'checkbox';
  /** One exact accessible name, or the alternatives one control takes. */
  name: string | string[];
  /**
   * 'main' (default) — the page's own column, document.querySelector('main').
   * 'chrome' — the shell's persistent controls in <header>/<aside>/<nav>, one
   *   viewport's worth visible at a time. Required for "Add a piece", which is
   *   Layout's and not the Closet's (docs/43 §1.3): the Closet's own "Add a
   *   piece" sits inside the empty-state branch, so a 'main' scope would leave
   *   that step pointing at nothing the moment the closet holds anything.
   */
  scope?: 'main' | 'chrome';
  /**
   * The escape hatch, checked FIRST where present: a data-tutorial value on the
   * target, for a control with no stable accessible name. No launch tutorial
   * uses one, and any future use adds that page file to that wave's ownership
   * list, explicitly (docs/43 §2.4).
   */
  hint?: string;
}

export interface TutorialStep {
  /** One instruction, at most two sentences: the act, and what it settles. */
  say: string;
  /** Omitted for a step about the page as a whole — no ring, no scroll. */
  target?: StepTarget;
}

export interface Tutorial {
  /** At most five. See THE LENGTH LAW above. */
  steps: TutorialStep[];
}

/**
 * A step whose target does not resolve keeps its text and loses its ring — it
 * is never skipped, because a skipped step would make "2 of 4" a lie (docs/43
 * §2.3, §4.7). The runtime is forgiving; the suite is strict. Drift shows up as
 * a red test, by name, not as a broken sheet in somebody's hands.
 */
const TUTORIALS: Record<string, Tutorial> = {
  /* ---- wave one: the three that carry week one (docs/43 §3.1) ---- */

  /**
   * TODAY. Rings once, on the only control the page is about. Three of the
   * four steps are text because the rest of Today is state — a matured plan's
   * "Wore it", "Same as yesterday", "Undo" — and a ring that appears only on
   * some mornings teaches nothing reliably.
   */
  '/': {
    steps: [
      {
        say: 'Today asks one question — what went on. Answering it is the whole daily job; everything else in the app exists to make this tap worth taking.',
      },
      {
        // Both halves of the hero: the blank day's fill and the logged day's
        // "Log another" (Dashboard.tsx). The first visible one wins.
        say: 'Press this, then tap what went on. With a saved outfit it is two taps; without one, a tap and then the pieces themselves.',
        target: { role: 'button', name: ["Log today's wear", 'Log another'] },
      },
      {
        say: 'A day that got away is not a broken record. The calendar takes a late entry, and the ledger counts it the same as any other.',
      },
      {
        say: 'The counts underneath are the closet at a glance. Resting is how many pieces have had no first wear yet.',
      },
    ],
  },

  /**
   * SETTINGS. The one mistake that ends a tester permanently is a lost record,
   * so this is the second thing built and the door's install-first lesson lives
   * in step 4 (docs/43 §3.0.1 — the door stands outside the Layout shell, has
   * no guide, and therefore can carry no tutorial of its own).
   *
   * Step 1 tells the whole truth about sync, in the words the page itself
   * carries: per wardrobe, opt-in, and not yet end-to-end encrypted (docs/35,
   * PLAN.md #1 as amended). A false privacy line is the most expensive sentence
   * this app can print.
   */
  '/settings': {
    steps: [
      {
        say: 'The record lives in this browser. An account is optional, sync is per wardrobe, and until end-to-end encryption lands a synced copy is stored readable.',
      },
      {
        // Exact, and this is amendment A earning its keep: the stale-backup
        // reminder says "Export a backup now" and the footer says "Export a
        // backup". Three visible controls carry the word; only one is named
        // plainly "Export".
        say: 'Export writes the whole record as one file — pieces, wears, costs, categories, tags. Keep it somewhere that is not this browser.',
        target: { role: 'button', name: 'Export' },
      },
      {
        say: 'Import reads a backup back in, from any version of Almari. It replaces what is on this device, so export first if there is any doubt.',
        target: { role: 'button', name: 'Choose a file' },
      },
      {
        // Deliberately targetless: "Add to home screen" renders only where
        // beforeinstallprompt has fired, which is never in the suite's browser,
        // so a ring here would be a dead anchor by design.
        say: 'The row above adds Almari to the home screen. An in-app browser — WhatsApp’s, Instagram’s — keeps storage of its own, so a wardrobe catalogued in one is not the wardrobe the installed app opens.',
      },
      {
        say: 'The short tour waits here. It never returns on its own; this is the only way back to it.',
        target: { role: 'button', name: 'Replay' },
      },
    ],
  },

  /**
   * THE INTAKE BENCH. A stocked closet is the reason to come back, and this is
   * the one place the app talks to a model at all.
   */
  '/intake': {
    steps: [
      {
        say: 'Everything on this bench arrives as a draft. Nothing is written to the closet until you press the add button at the foot of it.',
      },
      {
        // /intake and /intake?worn=1 label the same control differently, and
        // both Settings and the Closet link to the second.
        say: 'Photograph what you have on, or lay several garments out and photograph the lot. One journey out to the model; the cutting out happens on this device.',
        target: { role: 'button', name: ['Read a photograph', 'Read what I am wearing'] },
      },
      {
        say: 'Or a handful of photographs at once — flat lays, hanger shots, one outfit as worn. A photograph with two or more people in it comes back empty, by rule.',
        target: { role: 'button', name: 'Read your photos' },
      },
      {
        say: 'No key of your own is needed: the relay holds the service key. Prefer your own model, or no network at all? Take the prompt and bring the file back.',
        target: { role: 'button', name: ['Copy the prompt', 'Prompt copied'] },
      },
      {
        // Targetless on purpose — the bench does not exist until a photograph
        // has been read, so its controls are unresolvable at rest.
        say: 'Each draft states its doubts — a colour it is unsure of, a name it guessed. Correct them on the bench, leave one out, and the add button says how many are going in.',
      },
    ],
  },

  /* ---- wave two: the Closet, the worked example of docs/43 §2.1 ---- */

  '/closet': {
    steps: [
      {
        say: 'This grid is everything on the record. Tap any piece to open its card — its wears, its cost, and what it now costs per wear.',
      },
      {
        // THE AMENDMENT IN ONE STEP. The control that is always there lives in
        // Layout's masthead on a phone and its sidebar on a desktop, one
        // visible at a time — outside <main> by design.
        say: 'A piece is added from the same place on every screen. A name is enough; a photograph is welcome and never asked for.',
        target: { role: 'button', name: 'Add a piece', scope: 'chrome' },
      },
      {
        // docs/43 §2.2 named the placeholder ("Search by name") as the source
        // of this control's name. It is not: Closet.tsx puts an sr-only <label>
        // on the input, and a label outranks a placeholder in every accessible
        // name computation there is. Both are listed, label first, so the step
        // survives either being the one that wins.
        say: 'Search finds a piece by name when the grid grows long.',
        target: { role: 'textbox', name: ['Search pieces by name', 'Search by name'] },
      },
      {
        say: 'Filters narrow the grid by kind, colour or season. The small number on the control is how many are set.',
        target: { role: 'button', name: 'Filters' },
      },
    ],
  },

  /* ---- wave three: the rest of the house, as pure data (docs/43 §3.3) ---- */

  '/outfits': {
    steps: [
      {
        say: 'A set you already know works, saved once and worn in a tap. A piece in the wash is benched, and a benched piece is not dealt.',
      },
      {
        say: 'Put a set together and save it. From then on the whole outfit logs in one tap, and can be booked onto a day in the calendar.',
        target: { role: 'button', name: 'Build an outfit' },
      },
      {
        say: 'Or ask to be dealt one. The draw takes only what is clean and in rotation, so a benched piece and a quiet category are both left out — that absence is the rule working, not a fault.',
        target: { role: 'button', name: 'Deal a set' },
      },
      {
        say: 'A saved set is not a promise. Wear it, change it, or let it go; the record still counts only what actually went on.',
      },
    ],
  },

  '/furniture': {
    steps: [
      {
        say: 'A rail is a place; so is the shelf by the door. Draw one, and the clothes gain addresses.',
        target: { role: 'button', name: 'Draw a place' },
      },
      {
        say: 'Put pieces in a place and the closet can answer where is it, not only what is it. An address is optional, and a piece without one is not missing.',
      },
      {
        say: 'Filing changes nothing about a piece — the same garment, the same wears, the same arithmetic. It is one closet, sorted by where things live.',
      },
    ],
  },

  '/calendar': {
    steps: [
      {
        say: 'A day that got away can still be put on the record. Tap it, say what was worn, and the ledger carries on.',
      },
      {
        say: 'A gap is not a broken record. A late entry counts exactly as much as one made on the morning itself.',
      },
      {
        say: 'Tap a day ahead and book an outfit for it. Today asks whether it happened when the day comes, and answering settles it either way.',
      },
    ],
  },

  '/events': {
    steps: [
      {
        say: 'An occasion with a date deserves a look settled before the morning of. Reserving decides; wearing still gets logged.',
      },
      {
        say: 'Add the occasion with its date, then reserve the look you mean to wear.',
        target: { role: 'button', name: 'Add an event' },
      },
      {
        say: 'A reservation is a plan, not a wear. The day is logged when it arrives, like any other day — a reserved look never logged leaves a hole in the record.',
      },
    ],
  },

  '/ledger': {
    steps: [
      {
        say: 'Give a piece its price and every wear divides it down. Until then the arithmetic waits, blank on purpose.',
      },
      {
        say: 'A cost goes on the piece itself, in the closet, and can be added at any time. The blank money column is not broken; it is waiting to be told.',
      },
      {
        say: 'Cost per wear falls with every wear. The number rewards use, not purchase, which is why nothing here is ever a score.',
      },
      {
        say: 'Read Most worn and Resting together. The distance between them is the thing this whole record is for.',
      },
    ],
  },

  '/wishlist': {
    steps: [
      {
        say: 'A thing you are considering waits here in silence. When the wait is up it asks once: keep, let go, or bought.',
      },
      {
        // The masthead's toggle, which is the only add control standing at
        // rest: "Put it on the list" is the form's submit, and the form does
        // not exist until this has been pressed. The empty state's "Add
        // something you're considering" is deliberately NOT listed beside it —
        // both are visible at once on an empty list, and two visible matches
        // is an ambiguous anchor whatever the intent.
        say: 'Add what you are thinking about, with its price and how long it should wait.',
        target: { role: 'button', name: 'Add' },
      },
      {
        say: 'Nothing is sent while it waits — no reminder, no count, and this alpha has no notifications at all. Meanwhile the closet answers back with what you already own that comes close.',
      },
    ],
  },

  '/compare': {
    steps: [
      {
        say: 'Hold the thing in your hands against what already hangs at home. The page states the facts and then goes quiet.',
      },
      {
        say: 'Describe it — kind, colour, price — and the nearest pieces already on the record come back with what they cost and how often they go on.',
      },
      {
        say: 'There is no verdict here, no score, and no shop link. The conclusion is yours, and the wishlist is there if the thing should wait instead.',
      },
    ],
  },

  '/chats': {
    steps: [
      {
        say: 'A loan begins as a question in a conversation, and only the owner answers it. Showing is not lending.',
      },
      {
        say: 'Attach a look or a piece to show it. The piece stays exactly where it is — attaching changed nothing about who has it.',
      },
      {
        say: 'Ask after a piece and its owner decides. When it comes home, mark it returned and the loan closes on the shared rail.',
      },
    ],
  },

  '/rail': {
    steps: [
      {
        say: 'The rail remembers who has the black coat, and since when. Mark it returned and it rejoins the rotation.',
      },
      {
        say: 'Wardrobes joined under one roof share a rail. Each shows which of its pieces are open to borrow, and nothing else.',
      },
      {
        say: 'Out and back is the standing list. A loan never marked returned keeps a piece out of rotation at home, and the arithmetic quietly stops counting it.',
      },
    ],
  },

  '/profile': {
    steps: [
      {
        say: 'This page holds what the wardrobe has chosen to say, and nothing it has not.',
      },
      {
        say: 'Nothing reads a closet to fill this page. What has not been shared is not here, on your own page or on anyone else’s.',
      },
      {
        say: 'Joining a roof shares a rail, not a closet. The pieces stay where they are; only the lending record is held in common.',
      },
    ],
  },

  '/open': {
    steps: [
      {
        say: 'One device, several wardrobes, each with its own closet and its own arithmetic. Samples are for looking, not for living in.',
      },
      {
        say: 'Open a wardrobe and every other screen shows that one. A sample is rebuilt on every update, so a real piece kept in one does not survive.',
      },
      {
        say: 'Closing a wardrobe leaves it on the device. Retiring one removes it, so export it first if the record is worth keeping.',
      },
    ],
  },

  /*
   * /feed and /explore are NOT scripted this season. Both guides are seated
   * behind FEED_ENABLED, and guideKeyFor returns null for them while the flag
   * is off, so an entry here would be unreachable copy. They walk in with the
   * rooms. /admin has no guide, so it can have no tutorial — correct: it is an
   * alpha portal, not a room in the product.
   */
};

/** The tutorial for an address, or null where there is none. */
export function tutorialFor(pathname: string): Tutorial | null {
  const key = guideKeyFor(pathname);
  return key ? TUTORIALS[key] ?? null : null;
}

/**
 * The seen-state key for an address — the parent path, same as the guides, so
 * /chats/abc and /chats/def share one mark rather than leaving it standing on a
 * walkthrough already taken.
 */
export function tutorialKeyFor(pathname: string): string | null {
  const key = guideKeyFor(pathname);
  return key && TUTORIALS[key] ? key : null;
}

/** Every scripted address, for the suite and for anything that clears marks. */
export function tutorialPaths(): string[] {
  return Object.keys(TUTORIALS);
}
