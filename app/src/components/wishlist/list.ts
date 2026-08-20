/**
 * THE WISHLIST'S OWN ARITHMETIC — the part that is not maths.
 *
 * Every AMOUNT this room prints goes through @almari/shared/cost
 * (`formatMoney` for a sum, `formatPrice` for one recorded price), and every
 * DAY through @almari/shared/dates. Nothing here re-implements either; docs/34
 * §5 keeps exactly one source of the formulas and this file is a consumer of
 * it, never a second copy.
 *
 * The two things shared does NOT supply, and why they are mirrored here rather
 * than invented:
 *
 *   `daysUntil` — shared/dates has `daysSince`, which clamps at zero because
 *   nothing in the wear ledger looks forward. A cooling-off period is the one
 *   thing in the app that does, so the web keeps its own un-clamped helper as
 *   a local function in src/pages/Wishlist.tsx. This is that function, and it
 *   parses the stored day at local midnight for the same reason the web's
 *   does: a 'YYYY-MM-DD' read as UTC is off by a day for half the planet.
 *
 *   `shortDay` — likewise a local helper in the web page. One difference: a
 *   wish's `dateAdded` is a full ISO TIMESTAMP (the record's own choice, web
 *   and native alike), not the bare day the wear logs use, so this accepts
 *   both and parses each the only correct way for its shape.
 *
 * THE TWO SUMS are the web page's own inline reductions. They are additions,
 * not formulas — there is no shared function to call, and inventing one for
 * `a + b` would put a second definition of "still on the list" into the tree.
 *
 * THE PHILOSOPHY THIS FILE ENFORCES, from src/pages/Wishlist.tsx's header:
 * during a wait THE APP SAYS NOTHING. No badge, no count on a door, no
 * notification, no reminder. `waitLine` is the whole of what a wait is allowed
 * to say, and it is a quiet mono line on the card itself. When the wait is up,
 * that one card asks ONCE — and `isAsking` goes false forever after, because
 * `asked` is stamped on the answer.
 */
import { formatMoney, formatPrice } from '@almari/shared/cost';
import { todayLocal } from '@almari/shared/dates';
import type { WishlistItem } from '@almari/shared/types';

/* ---------- days ---------- */

/**
 * Whole days from today to a local 'YYYY-MM-DD'. Negative once the date is
 * past. Mirrors the web page's own `daysUntil`.
 */
export function daysUntil(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - now.getTime()) / 86400000);
}

/**
 * '2026-03-12' or '2026-03-12T09:14:00.000Z' becomes '12 Mar'.
 *
 * A bare day is parsed at LOCAL midnight (never as UTC — that is the whole
 * point of shared/dates); a full timestamp is parsed as the instant it is, and
 * rendered in the reader's own zone, which is where they were when they noted
 * it down.
 */
export function shortDay(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const bareDay = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const d = bareDay ? new Date(`${raw}T00:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ---------- what a wait is allowed to say ---------- */

/**
 * The card is asking exactly when the wait has run out and it has not asked
 * yet. Mirrors the web's `isAsking`.
 */
export function isAsking(item: WishlistItem): boolean {
  if (item.status !== 'waiting' || !item.coolingOff || item.coolingOff.asked) return false;
  return todayLocal() >= item.coolingOff.endsAt;
}

/**
 * THE ONLY THING A WAIT MAY SAY. A quiet mono line on the card, and null
 * everywhere else — never a badge, never a count on a door, never a
 * notification. The silence is the intervention.
 */
export function waitLine(item: WishlistItem): string | null {
  if (item.status !== 'waiting' || !item.coolingOff || item.coolingOff.asked) return null;
  const left = daysUntil(item.coolingOff.endsAt);
  if (left <= 0) return null;
  return `WAITING · ${left} ${left === 1 ? 'DAY' : 'DAYS'} LEFT`;
}

/** True while a wish is inside a wait it has not been asked about yet. */
export function isMidWait(item: WishlistItem): boolean {
  return waitLine(item) !== null;
}

/** 'NOTED 12 MAR' — the ledger line every wish carries, whatever its state. */
export function notedLine(item: WishlistItem): string {
  const day = shortDay(item.dateAdded);
  return day ? `NOTED ${day.toUpperCase()}` : '';
}

/* ---------- the list, in its four states ---------- */

export interface WishSections {
  waiting: WishlistItem[];
  kept: WishlistItem[];
  released: WishlistItem[];
  /**
   * Wishes that came home. `promoteWish` writes the piece into the closet and
   * leaves the wish here marked 'bought' — the browser prints its own Bought
   * section from exactly these rows, and the two apps write one document, so
   * a promote on the phone that dropped the row would empty a list in the
   * browser that had been there for months.
   */
  bought: WishlistItem[];
  /** Waiting + kept: the pieces that have not been answered either way. */
  open: WishlistItem[];
}

export function sections(wishlist: WishlistItem[]): WishSections {
  const waiting = wishlist.filter(w => w.status === 'waiting');
  const kept = wishlist.filter(w => w.status === 'kept');
  return {
    waiting,
    kept,
    released: wishlist.filter(w => w.status === 'let-go'),
    bought: wishlist.filter(w => w.status === 'bought'),
    open: [...waiting, ...kept],
  };
}

/** What the still-open part of the list would cost. Prices only; no guesses. */
export function openTotal(open: WishlistItem[]): number {
  return open.reduce((sum, w) => sum + (w.price ?? 0), 0);
}

/** What the let-go part of the list did not cost. */
export function stayedYoursTotal(released: WishlistItem[]): number {
  return released.reduce((sum, w) => sum + (w.price ?? 0), 0);
}

/* ---------- sentences ---------- */

/**
 * The ledger's own sentence for the released pile.
 *
 * A total is stated only when there is one. An amount of zero would assert a
 * sum nobody recorded, so with no prices on file the line counts pieces
 * instead — the web's own branch, kept word for word.
 */
export function stayedYoursLine(released: WishlistItem[]): string {
  const total = stayedYoursTotal(released);
  if (total > 0) return `${formatMoney(total)} stayed yours.`;
  return `${released.length} ${released.length === 1 ? 'piece' : 'pieces'} stayed on the shelf.`;
}

/** 'N on the list' for the masthead's meta slot; null when the list is empty. */
export function onTheListLine(open: WishlistItem[]): string | null {
  return open.length > 0 ? `${open.length} on the list` : null;
}

/**
 * The card's own meta line: what kind of piece, whose, and what it costs.
 * Absent parts are absent — never a dash standing in for a fact nobody gave.
 */
export function metaLine(item: WishlistItem, categoryName: string): string {
  return [
    categoryName,
    item.brand,
    item.price !== undefined ? formatPrice(item.price) : undefined,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');
}

/**
 * What the add sheet says after a wish is written.
 *
 * The wait is named because agreeing to it is the whole gesture; with no wait
 * there is nothing to name and the sentence stops. Dry, verb first, two beats
 * — and no exclamation point, here or anywhere (brand law 10, and the house's
 * one exclamation point is long spent).
 */
export function addedLine(days: number): string {
  return days > 0 ? `On the list. It waits ${days} days.` : 'On the list.';
}

/**
 * A price typed into a form, as the record wants it.
 *
 * Absent is the absence of the field, never a zero in it — a wish with no
 * price noted must be byte-identical to one written by the browser, where the
 * form writes `undefined` for an empty box. Anything that is not a finite
 * non-negative number is no price at all.
 */
export function parsePrice(input: string): number | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/* ---------- the wait, as the sheet offers it ---------- */

export interface WaitOption {
  days: number;
  label: string;
}

/** The web's four, in the web's order. 'No wait' is a real answer, not a skip. */
export const WAIT_OPTIONS: readonly WaitOption[] = [
  { days: 0, label: 'No wait' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

/** The house default, stated once: seven days of silence. */
export const DEFAULT_WAIT_DAYS = 7;
