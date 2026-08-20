/**
 * THE SHOWING — the band-dealing arithmetic for the Explore mosaic (docs/41).
 *
 * The publishable size law, one breath, true at every breakpoint:
 *
 *   Every band deals one turn: whatever arrives at that slot in time's order
 *   takes it, a guest steps aside by one place, and every other slot is the
 *   rack.
 *
 * And its corollary: the newest post always opens the showing at full plate.
 *
 * Everything here is a pure function of position — index, total, column
 * count. Nothing reads a post's kind, content, author, recency weight, or
 * any popularity signal (none exists). Framework-free on purpose, like
 * bufferFeed.ts: the node suite (scripts/test-feed.mjs) imports it directly,
 * and the native app can read the same arithmetic when its wall lands.
 */

export type Columns = 2 | 3 | 4;
export type Variant = 'rack' | 'turn' | 'turn-r';

/** Below this many entries the wall is not dealt: a centred column of full
 *  plates instead. A thin wardrobe shown small in a void reads as a verdict,
 *  and the house does not do shame mechanics (docs/41 §8). */
export const LAY_THRESHOLD = 5;

/** The hem's one calm sentence, in each state. Spec-exact (docs/41 §8). */
export const HEM_LINE = 'That is everything on show.';
export const HEM_LINE_FILTERED = 'That is everything that answers.';

/** One band of the deal: 5 tiles at 2 columns, 6 at 3, 9 at 4. */
export function bandUnit(cols: Columns): number {
  return cols === 2 ? 5 : cols === 3 ? 6 : 9;
}

/** The mirrored cycle: two bands at md+ (left band then right band), one on
 *  the phone — a full-width turn has no side to mirror. */
export function cycleOf(cols: Columns): number {
  return cols === 2 ? 5 : cols === 3 ? 12 : 18;
}

/** Is `i` a turn slot by arithmetic alone — before the tail guard is asked.
 *  This is also the swap's trigger: the guard never moves a guest's seat. */
export function isTurnIndex(i: number, cols: Columns): boolean {
  if (cols === 2) return i % 5 === 0;
  if (cols === 3) {
    const m = i % 12;
    return m === 0 || m === 7;
  }
  const m = i % 18;
  return m === 0 || m === 11;
}

/**
 * The deterministic size grammar: position in, variant out.
 *
 * Tail guard (docs/41 §2.3): at a turn index the tile is promoted only when
 * the turn-band behind it can fill — at 3 columns only if ≥ 2 tiles follow,
 * at 4 columns only if ≥ 4. The phone's full-width turn never demotes: it is
 * a complete row by construction. Otherwise the tile renders as a rack and
 * the final row rags naturally. A rag at the hem is a rag, never a hole.
 */
export function variantFor(i: number, total: number, cols: Columns): Variant {
  if (!isTurnIndex(i, cols)) return 'rack';
  if (cols === 2) return 'turn';
  const follow = total - i - 1;
  if (follow < (cols === 3 ? 2 : 4)) return 'rack';
  if (cols === 3) return i % 12 === 7 ? 'turn-r' : 'turn';
  return i % 18 === 11 ? 'turn-r' : 'turn';
}

/**
 * The guest step-aside — the backward swap (docs/41 §2.5).
 *
 * For each turn index t: if tiles[t] is a guest, swap tiles[t] and
 * tiles[t−1]. Applied after interleaveCommons, whose guests land at output
 * indices 6k+5, so collisions are arithmetic, not edge cases: on the phone at
 * i ≡ 5 (mod 30), at 4 columns every third guest, at 3 columns never. The
 * forward swap is refused — it stacks two non-reals in one window of six and
 * can hand a guest the closing tile. Swap sites sit ≥ 18 apart, so no
 * cascade; a look never changes position because of a guest, only the guest
 * steps aside.
 */
export function backwardSwap<T>(
  tiles: T[],
  isGuest: (tile: T) => boolean,
  cols: Columns
): T[] {
  const out = tiles.slice();
  for (let t = 1; t < out.length; t++) {
    if (isTurnIndex(t, cols) && isGuest(out[t])) {
      const guest = out[t];
      out[t] = out[t - 1];
      out[t - 1] = guest;
    }
  }
  return out;
}

/* ================================ seams ================================ */

export interface Seam {
  /** The band boundary the seam prints before — always a multiple of the unit. */
  index: number;
  /** 'July 2026' — the month and year of the next band's first real post. */
  label: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM-DD' → 'YYYY-MM'; anything unparseable is month-transparent,
 *  exactly like a guest — an unreadable date can never move a seam. */
export function monthKey(date: string | undefined): string | null {
  return date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}

/** '2026-07' → 'July 2026'. English, fixed table — the seam is a locator and
 *  must render the same on every machine the record visits. */
export function monthLabel(ym: string): string {
  const name = MONTHS[Number(ym.slice(5, 7)) - 1];
  return name ? `${name} ${ym.slice(0, 4)}` : ym;
}

/**
 * Month seams (docs/41 §2.6). The deal runs continuously — it never resets at
 * a seam. The seam prints at the next band boundary after the pour crosses a
 * month; its label is the month of the next band's first real post; the
 * misfiled run above a seam never exceeds one band; one seam per boundary
 * even when several thin months are skipped. Computed from real posts'
 * months only: pass null for guests, and they can never create, move, or
 * straddle a seam.
 */
export function seamsFor(
  months: ReadonlyArray<string | null>,
  cols: Columns
): Seam[] {
  const unit = bandUnit(cols);
  const firstRealAt = (start: number): string | null => {
    for (let i = start; i < months.length; i++) {
      const m = months[i];
      if (m) return m;
    }
    return null;
  };
  const seams: Seam[] = [];
  let prev = firstRealAt(0);
  for (let boundary = unit; boundary < months.length; boundary += unit) {
    const first = firstRealAt(boundary);
    if (prev && first && first !== prev) {
      seams.push({ index: boundary, label: monthLabel(first) });
    }
    if (first) prev = first;
  }
  return seams;
}

/* ============================ the search hay ============================ */

/** The post's date as words the search box can hear: long month, short
 *  month, year — seams get you near March; this gets you to the wedding. */
export function monthWords(date: string | undefined): string[] {
  const key = monthKey(date);
  if (!key) return [];
  const name = MONTHS[Number(key.slice(5, 7)) - 1];
  const year = key.slice(0, 4);
  return name ? [name.toLowerCase(), name.slice(0, 3).toLowerCase(), year] : [year];
}

/**
 * The honest hue-word mapper (docs/41 §4): quantizes a piece's stated colour
 * into the house's ~14 cloth words. Stated limit: looks match colour only
 * through their piece names — SharedLook.pieces is names-only by consent
 * design, and nobody widens it for a search feature. A search word is
 * forgiving where a chip would be a claim, so the mapper stays conservative:
 * a hue it cannot name honestly gets no word at all.
 *
 * Chroma is read as the RGB spread (max−min), not HSL saturation — HSL
 * saturation blows up near white and calls cream "tan" to its face.
 */
export function hueWords(hex: string | undefined): string[] {
  if (!hex) return [];
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [];
  let s = m[1].toLowerCase();
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }

  if (l <= 0.13) return ['black'];
  if (d <= 0.03) return l >= 0.88 ? ['white'] : ['grey'];

  const warm = h >= 20 && h < 78;
  if (warm && d <= 0.3) {
    // The cloth neutrals: the low-chroma warm ladder, lightest first.
    if (d < 0.05) return l >= 0.88 ? ['white'] : ['grey'];
    if (l >= 0.85) return ['cream'];
    if (l >= 0.6) return ['oatmeal'];
    if (l >= 0.38) return ['tan'];
    return ['brown'];
  }
  if (d <= 0.12) return l >= 0.88 ? ['white'] : ['grey'];

  if (h < 15 || h >= 345) {
    if (l >= 0.68) return ['pink'];
    if (l <= 0.45 && d >= 0.35) return ['carmine', 'red'];
    return ['red'];
  }
  if (h < 42) return l >= 0.6 ? ['tan'] : ['brown'];
  if (h < 68) return l >= 0.87 ? ['cream'] : ['gold'];
  if (h < 170) return ['green'];
  if (h < 258) return l <= 0.28 ? ['navy', 'blue'] : ['blue'];
  if (h < 292) return l <= 0.35 ? ['navy', 'blue'] : ['blue'];
  // Plum and magenta: light reads as pink; the rest makes no honest claim.
  return l >= 0.62 ? ['pink'] : [];
}
