import type { ClothingItem, Season } from '../types';

/**
 * WHAT IT IS LIKE OUT — asked, not tracked.
 *
 * Every rival ships weather-aware suggestions, and every one of them buys it
 * the same way: your location, sent to a server, several times a day. Acloset's
 * own Data Safety declaration says it shares precise location for advertising
 * or marketing. That is a very high price for "it will be cold".
 *
 * So the app asks. One tap, four answers, kept for the day only. It is less
 * clever than a forecast and more accurate than one, because the person
 * tapping it is standing at the window. No location, no permission prompt, no
 * network call, nothing to leak.
 *
 * The mapping onto clothes uses the season tags a piece already carries, so
 * this needs no new field and no migration: a wardrobe catalogued last year
 * answers the question today.
 */

export type Outdoors = 'cold' | 'mild' | 'warm' | 'wet';

export const OUTDOORS: { id: Outdoors; label: string; seasons: Season[] }[] = [
  { id: 'cold', label: 'Cold', seasons: ['winter', 'fall'] },
  { id: 'mild', label: 'Mild', seasons: ['spring', 'fall'] },
  { id: 'warm', label: 'Warm', seasons: ['summer', 'spring'] },
  // Wet is not a temperature, so it does not narrow by season at all — it
  // only asks that whatever is suggested can stand getting rained on.
  { id: 'wet', label: 'Wet', seasons: [] },
];

/** Fabrics that a downpour ruins. Named, so the reason is legible. */
const SPOILT_BY_RAIN = /\b(silk|suede|satin|velvet|linen|chiffon|organza)\b/i;

/**
 * Does this piece suit the weather as reported?
 *
 * A piece with no season tags always suits: an untagged wardrobe must not
 * quietly empty itself the moment someone taps a chip. Absence of information
 * is never treated as a "no" anywhere in this app.
 */
export function suitsOutdoors(item: ClothingItem, out: Outdoors | null): boolean {
  if (!out) return true;
  if (out === 'wet') {
    const words = `${item.name} ${item.material ?? ''} ${item.notes ?? ''}`;
    return !SPOILT_BY_RAIN.test(words);
  }
  const seasons = item.season ?? [];
  if (seasons.length === 0) return true;
  const wanted = OUTDOORS.find(o => o.id === out)?.seasons ?? [];
  return seasons.some(s => wanted.includes(s));
}

/** The day's answer, kept for the day. Tomorrow asks again. */
const KEY = 'toile-outdoors';

export function loadOutdoors(today: string): Outdoors | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { date?: string; out?: Outdoors };
    return saved.date === today && saved.out ? saved.out : null;
  } catch {
    return null;
  }
}

export function saveOutdoors(today: string, out: Outdoors | null): void {
  try {
    if (out === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify({ date: today, out }));
  } catch {
    /* storage disabled — the choice still holds for this render */
  }
}
