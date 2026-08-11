import type { ClothingItem } from '../types';

/**
 * Cost-per-wear, in one place.
 *
 * CPW was computed at seven call sites with four different opinions about what
 * a cost of 0 means, three about zero wears, and five about how to format the
 * result. Two of them divided without guarding, one crashed the item detail
 * modal outright on an imported non-numeric cost, and the Ledger printed two
 * different averages for the same wardrobe 240px apart. This module is the
 * single answer, and it is the prerequisite for folding repair costs into CPW
 * (docs/06-focus-group-requirements.md, deferred list): every consumer reads
 * `basis` rather than `item.cost`, so when repairs arrive they are summed here
 * and propagate everywhere at once.
 *
 * No copy lives in this file. It returns numbers and a reason; the sentences
 * stay in the components, where copy law is reviewable.
 */

/** Reserved for the deferred repair log. Not yet a field on ClothingItem. */
export interface RepairEntry {
  date: string;
  cost: number;
  note?: string;
}

/** The slice of an item this module needs. Keeps it usable for wishlist rows too. */
export type Costed = Pick<ClothingItem, 'cost' | 'wearCount'> & { repairs?: RepairEntry[] };

/**
 * `ok` — a real per-wear figure. `free` — nothing was paid, but that IS recorded.
 * `no-cost` — nobody said what it cost. `no-wears` — it has not been worn yet.
 * Precedence is fixed (no-cost, then no-wears, then free, then ok) so exactly one
 * reason ever comes back and call sites can switch exhaustively.
 */
export type CpwReason = 'ok' | 'free' | 'no-cost' | 'no-wears';

/**
 * The one sanitizer. A recorded 0 is a real answer (inherited, gifted, swapped);
 * a string, null, NaN or a negative number is not. `item.cost && …` — the idiom
 * six call sites used — silently treated free heirlooms as unrecorded and happily
 * divided by a negative.
 */
export function isRecordedAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function wearsOf(item: Costed): number {
  return isRecordedAmount(item.wearCount) ? Math.floor(item.wearCount) : 0;
}

/**
 * What the piece has cost so far: purchase price plus any repairs.
 * `undefined` only when nothing at all is on record. This is the repair seam.
 */
export function costBasis(item: Costed): number | undefined {
  const purchase = isRecordedAmount(item.cost) ? item.cost : undefined;
  const repairs = (item.repairs ?? [])
    .filter(r => isRecordedAmount(r.cost))
    .reduce((sum, r) => sum + r.cost, 0);
  if (purchase === undefined) return repairs > 0 ? repairs : undefined;
  return purchase + repairs;
}

export interface CostPerWear {
  /** Dollars per wear, or null when there is no honest figure to state. */
  value: number | null;
  basis: number | undefined;
  wears: number;
  reason: CpwReason;
}

export function costPerWear(item: Costed): CostPerWear {
  const basis = costBasis(item);
  const wears = wearsOf(item);
  if (basis === undefined) return { value: null, basis, wears, reason: 'no-cost' };
  if (wears === 0) return { value: null, basis, wears, reason: 'no-wears' };
  if (basis === 0) return { value: 0, basis, wears, reason: 'free' };
  return { value: basis / wears, basis, wears, reason: 'ok' };
}

/**
 * 'costed-wears' divides what was spent by the wears of the pieces that money
 * bought — a 96-wear heirloom should not deflate the average price of things you
 * actually paid for. 'all-wears' divides by every wear in the closet. The Ledger
 * used to do both on one page without saying so; now the choice is one word.
 */
export type CpwDenominator = 'costed-wears' | 'all-wears';

export interface CpwTotals {
  basis: number;
  wears: number;
  pieces: number;
  costedPieces: number;
  value: number | null;
}

export function aggregateCostPerWear(
  items: Costed[],
  opts: { denominator?: CpwDenominator } = {}
): CpwTotals {
  const denominator = opts.denominator ?? 'costed-wears';
  let basis = 0;
  let wears = 0;
  let costedPieces = 0;

  for (const item of items) {
    const itemBasis = costBasis(item);
    const itemWears = wearsOf(item);
    const paidFor = itemBasis !== undefined && itemBasis > 0;
    if (paidFor) {
      basis += itemBasis;
      costedPieces += 1;
    }
    if (denominator === 'all-wears' || paidFor) wears += itemWears;
  }

  return {
    basis,
    wears,
    pieces: items.length,
    costedPieces,
    value: basis > 0 && wears > 0 ? basis / wears : null,
  };
}

/* ---------- formatting ----------
   Five variants of "render an amount" existed; the focus-group doc quotes
   "$1,340 stayed yours" and "$890 is resting here", so separators are the house
   style and `toFixed(0)` was off-contract. */

/** Whole units with separators: 1340 → "$1,340". For sums and totals. */
export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Value-preserving: 45 → "$45", 45.5 → "$45.50". For a single recorded price. */
export function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 3.121 → "$3.12"; null → "—". Callers still supply the `tabular` class. */
export function formatPerWear(value: number | null, opts: { dash?: string } = {}): string {
  if (value === null) return opts.dash ?? '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
