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
 * The recorded list, or null where storage would not answer at all.
 *
 * The two failures are worth keeping apart. Storage that throws means the mark
 * can never be cleared, so it must never be shown; a value that is merely
 * malformed means storage works and this one row is rubbish, which is an empty
 * list and recoverable on the next write.
 */
function readGuides(): string[] | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(GUIDES_KEY);
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

/** Has this screen's guide been opened before? Silent-on-failure, as above. */
export function guideSeen(key: string): boolean {
  const seen = readGuides();
  if (seen === null) return true;
  return seen.includes(key);
}

export function markGuideSeen(key: string): void {
  const seen = readGuides();
  if (seen === null || seen.includes(key)) return;
  try {
    window.localStorage.setItem(GUIDES_KEY, JSON.stringify([...seen, key]));
  } catch {
    /* a mark that cannot be recorded simply never shows */
  }
}
