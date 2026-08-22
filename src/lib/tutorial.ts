/**
 * The tour's one flag, and the page guides' one list — both in this device's
 * local storage, both plain reads and writes.
 *
 * The tour's flag is 'toile-tour'.
 *
 * Three values: absent ('new'), 'done', 'again'. The tour reads it once, on the
 * Today page's mount; every way out of the sheet writes 'done', because a tour
 * that asks twice is a nag. Settings writes 'again' when someone asks for the
 * replay by name, which is the only way the sheet comes back.
 *
 * It is a plain read/write, not useLocalStorage: nothing here needs to be
 * reactive, and a flag written in the same gesture that dismisses the sheet
 * should not wait on a settle timer — closing the tab a breath later must
 * still count as dismissed.
 */

const TOUR_KEY = 'toile-tour';

export type TourState = 'new' | 'done' | 'again';

export function tourState(): TourState {
  try {
    const raw = window.localStorage.getItem(TOUR_KEY);
    return raw === 'done' || raw === 'again' ? raw : 'new';
  } catch {
    // Storage that will not read will not write either, so the dismissal could
    // never be recorded — and a sheet that cannot remember being dismissed must
    // never show. The kinder failure is silence.
    return 'done';
  }
}

export function markTourDone(): void {
  try {
    window.localStorage.setItem(TOUR_KEY, 'done');
  } catch {
    /* nothing to nag with */
  }
}

export function requestTour(): void {
  try {
    window.localStorage.setItem(TOUR_KEY, 'again');
  } catch {
    /* as above */
  }
}

/**
 * THE PAGE GUIDES — which screens have had their guide opened at least once.
 *
 * A separate key from the tour, and deliberately not folded into its three
 * values: the tour is one thing that happens once, and this is a set that grows
 * as someone walks the app. Sharing a key would mean replaying the tour wiped
 * fifteen unrelated marks, or that a single guide could resurrect the tour.
 *
 * The only thing this state drives is a small mark beside the "What is this
 * page?" control, which goes out once the guide has been read. Nothing here
 * opens anything: an unread guide waits, it does not ask.
 *
 * One key holding a JSON list rather than one key per screen, so the whole set
 * clears in a single write and a browser's storage inspector shows one row
 * instead of sixteen.
 */
const GUIDES_KEY = 'toile-guides';

/**
 * The recorded list under one key, or null where storage would not answer at
 * all.
 *
 * The two failures are worth keeping apart. Storage that throws means the mark
 * can never be cleared, so it must never be shown; a value that is merely
 * malformed means storage works and this one row is rubbish, which is an empty
 * list and recoverable on the next write.
 *
 * Written once and read by both marks below. It used to be readGuides() with
 * the key baked in; the walkthroughs need the identical discipline down to the
 * two failure readings, and a second hand-copy of it is exactly how two rows
 * end up disagreeing about what a throwing localStorage means.
 */
function readMarks(storageKey: string): string[] | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Silent on failure, in the direction that never nags: unrecordable reads as seen. */
function marked(storageKey: string, key: string): boolean {
  const seen = readMarks(storageKey);
  if (seen === null) return true;
  return seen.includes(key);
}

function mark(storageKey: string, key: string): void {
  const seen = readMarks(storageKey);
  if (seen === null || seen.includes(key)) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...seen, key]));
  } catch {
    /* a mark that cannot be recorded simply never shows */
  }
}

/** Has this screen's guide been opened before? Silent-on-failure, as above. */
export function guideSeen(key: string): boolean {
  return marked(GUIDES_KEY, key);
}

export function markGuideSeen(key: string): void {
  mark(GUIDES_KEY, key);
}

/**
 * THE WALKTHROUGHS — which screens have had their stepped walkthrough started
 * at least once (docs/43 §5).
 *
 * A third key, not a third value on either of the two above, and deliberately
 * NOT a field in AppState. Four reasons, in the order they cost:
 *
 *   CLAUDE.md binds any AppState change to a migration case in
 *   scripts/test-migrate.mjs first, and a walkthrough mark is worth zero
 *   migrations forever.
 *
 *   It is a fact about this browser's reader, not about the wardrobe. It must
 *   not ride the lossless export, must not sync, and a second device is
 *   entitled to its own first time.
 *
 *   It is app-wide, not per-wardrobe, so switching wardrobes must not
 *   resurrect it.
 *
 *   And a separate key clears in one write, which is the argument the guides'
 *   key above already makes for itself.
 *
 * MARKED ON START, NOT ON COMPLETION. The guide precedent is "opening IS
 * reading"; marking on Done would smuggle in a completion mechanic, which is a
 * score by the back door and banned outright (docs/43 §4.3). The only readers
 * are the suite and any future "clear the marks" in Settings — there is no dot,
 * no badge, and no second affordance. The guide sheet's existing dot already
 * carries "you have not looked here yet", and one quiet mark per screen is the
 * ceiling this app will ever have.
 */
const WALKTHROUGHS_KEY = 'toile-walkthroughs';

export function walkthroughSeen(key: string): boolean {
  return marked(WALKTHROUGHS_KEY, key);
}

export function markWalkthroughSeen(key: string): void {
  mark(WALKTHROUGHS_KEY, key);
}

/**
 * THE FIRST-VISIT POP-UP — the owner's order of 2026-08-21, seated on the two
 * marks above rather than on a fourth key of its own (docs/43 §9).
 *
 * The house law was "an unopened guide waits, it does not ask", written into
 * pageGuides.ts and into PageGuide's own comment block. The law's author has
 * amended it: on the FIRST visit to a guided screen the guide sheet opens by
 * itself, once, and then never again. This function is the whole of the
 * decision — three refusals and a question — so that the component below it
 * has no policy in it at all and the suite can read the policy without a
 * browser.
 *
 * A DETAIL SCREEN IS NOT A GUIDED PAGE. guideKeyFor falls back to the parent —
 * /chats/abc reads the Conversations guide, /profile/:id reads A profile — and
 * that fallback is right for the control the reader presses, which is the only
 * thing it was written for. It is wrong here twice over: a sheet titled
 * "Conversations" over one particular conversation explains the wrong screen,
 * and it would spend /chats's single showing before /chats had ever been
 * visited. So the pop-up asks for an EXACT address, and a detail screen keeps
 * the quiet control and the dot it always had.
 *
 * THE DOOR IS EXCLUDED. /open is where a stranger arrives, and the arrival is
 * not the moment: a sheet over the wardrobes on the first screen after the
 * door is the coach-mark wall this app was built against. Note what the
 * exclusion actually covers, because it is not quite what it sounds like: the
 * stranger's door is <Door /> in App.tsx's DoorRoutes, which stands OUTSIDE
 * the Layout shell and therefore mounts no PageGuide at all — it could never
 * have popped. What this line silences is the signed-in Wardrobes switcher at
 * the same address, which is the screen a reader goes to in order to switch
 * wardrobes and where a sheet is simply in the way. Both readings of "the
 * door" end up quiet; only one of them needed a rule.
 *
 * THE TOUR OUTRANKS IT. While the one-time tour is unseen ('new') or waiting
 * on a replay ('again'), nothing pops anywhere — the pop-up defers to the NEXT
 * visit rather than stacking a second sheet on the first. Note the consequence,
 * because it is a real fact about this build and not an oversight: the tour's
 * flag only becomes 'done' when the tour sheet itself closes, and the tour is
 * only offered on a wardrobe started today and still empty. A device that
 * opens a SAMPLE wardrobe, or imports a record, is never offered the tour, so
 * its flag stays 'new' and no guide ever pops for it until the tour is asked
 * for by name in Settings. That is the ruling's letter — "any page while the
 * tour is unseen" — and settling the flag on the tour's behalf would mean
 * editing the tour's own decision, which lives in Dashboard.tsx.
 *
 * AND STORAGE THAT WILL NOT ANSWER NEVER POPS: tourState() reads 'done' and
 * guideSeen() reads true when localStorage throws, and the two silences point
 * opposite ways on purpose — the second one wins here, which is the direction
 * that never nags.
 */
const NEVER_POPS: string[] = ['/open'];

export function guidePops(path: string, key: string): boolean {
  if (key !== path) return false;
  if (NEVER_POPS.includes(key)) return false;
  if (tourState() !== 'done') return false;
  return !guideSeen(key);
}
