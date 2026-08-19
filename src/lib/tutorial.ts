/**
 * The tour's one flag — 'toile-tour' in this device's local storage.
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
