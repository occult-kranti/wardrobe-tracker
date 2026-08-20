/**
 * THE LEDGER'S ARITHMETIC — every number the room states, derived in one place.
 *
 * NOT ONE FORMULA LIVES HERE. Money is `@almari/shared/cost` (costBasis,
 * aggregateCostPerWear) and dates are `@almari/shared/dates`; this file only
 * chooses WHICH pieces go into them and hands back a shape the screen can
 * print. That division is the whole point of the shared lift (docs/34 §2.8):
 * the web Ledger once printed two different averages for the same wardrobe
 * 240px apart, and the fix was one module, not two careful call sites.
 *
 * WHAT THE ROOM COUNTS, and why each one is written down:
 *
 *  - RETIRED PIECES SIT OUTSIDE EVERY NUMBER, exactly as src/pages/Statistics
 *    has it. Their history is kept and acknowledged in one line at the foot;
 *    they simply do not move the arithmetic of a closet they have left.
 *  - PLANS ARE NOT WEARS. `daysLogged` filters `isPlannedLog` and any future
 *    date, because a wardrobe with next Tuesday's outfit scheduled has not
 *    worn anything on Tuesday.
 *  - `wears` IS THE ITEM-WEAR TOTAL and `daysLogged` IS A COUNT OF DAYS. The
 *    web carries a comment about these two having once shared the label
 *    "wears recorded", 24× apart. Two names, two fields, no chance of it here.
 *  - MONEY RESTING is summed through `costBasis`, not `item.cost ?? 0`. The
 *    sanitizer is the reason the module exists: a recorded 0 is a real answer
 *    (inherited, gifted, swapped) and a string or a negative from an old
 *    import is not, and `?? 0` cannot tell those apart.
 *
 * WHAT IT REFUSES TO DERIVE: a percentage, a rate, a completion, a rank of
 * categories by anything but the quantity actually drawn beside them. There
 * is no field on this interface a report card could be built from.
 */
import { aggregateCostPerWear, costBasis, type CpwTotals } from '@almari/shared/cost';
import { isFutureDate } from '@almari/shared/dates';
import {
  categoryLabel,
  isPlannedLog,
  type AppSettings,
  type ClothingItem,
  type Outfit,
  type WearLog,
} from '@almari/shared/types';

/** One category's line: what it holds and what it has done. Never a share. */
export interface CategoryRow {
  id: string;
  label: string;
  pieces: number;
  wears: number;
}

export interface LedgerFigures {
  /** Pieces in the active closet. */
  pieces: number;
  /** The item-wear total — every wear on every active piece. */
  wears: number;
  /** Days with a wear logged against them. Plans and future dates excluded. */
  daysLogged: number;
  /** Pieces that have been worn at least once, and pieces that have not. */
  worn: number;
  unworn: number;
  /** Retired pieces — outside every figure above, stated once at the foot. */
  retired: number;
  /** Looks kept. */
  outfits: number;
  /** What the never-worn pieces cost, through the shared sanitizer. */
  resting: number;
  /** Spend, wears of the pieces that money bought, and the average. */
  cost: CpwTotals;
  /**
   * How many active pieces carry a recorded amount AT ALL — including a
   * recorded zero, which is a real answer (inherited, gifted, swapped) and is
   * exactly what `cost.costedPieces` cannot tell you, since it counts only
   * amounts above zero. The empty-cost card needs the difference: a closet
   * where nobody has said what anything cost and a closet that was entirely
   * given to its owner are both `basis: 0`, and they are not the same
   * sentence.
   */
  recordedPrices: number;
  /** The per-category listing, and the largest bar in it. */
  categories: { rows: CategoryRow[]; max: number };
}

export interface LedgerInput {
  items: ClothingItem[];
  activeItems: ClothingItem[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  settings: AppSettings;
}

export function ledgerFigures({
  items,
  activeItems,
  outfits,
  wearLogs,
  settings,
}: LedgerInput): LedgerFigures {
  const unwornPieces = activeItems.filter(i => i.wearCount === 0);

  const daysLogged = wearLogs.filter(l => !isPlannedLog(l) && !isFutureDate(l.date)).length;

  const wears = activeItems.reduce((sum, i) => sum + i.wearCount, 0);

  const resting = unwornPieces.reduce((sum, i) => sum + (costBasis(i) ?? 0), 0);

  // 'costed-wears' is the default and the honest one: what was spent, divided
  // by the wears of the pieces that money bought. A 96-wear heirloom does not
  // get to deflate the price of things actually paid for.
  const cost = aggregateCostPerWear(activeItems);

  const recordedPrices = activeItems.filter(i => costBasis(i) !== undefined).length;

  const counts = new Map<string, { pieces: number; wears: number }>();
  for (const item of activeItems) {
    const entry = counts.get(item.category) ?? { pieces: 0, wears: 0 };
    entry.pieces += 1;
    entry.wears += item.wearCount;
    counts.set(item.category, entry);
  }
  // Sorted by the quantity the bar draws, so the bar and the numeral beside it
  // are the same fact. The web's own bug here was drawing piece counts under a
  // label that read wears.
  const rows = [...counts.entries()]
    .map(([id, entry]) => ({ id, label: categoryLabel(settings, id), ...entry }))
    .sort((a, b) => b.wears - a.wears || a.label.localeCompare(b.label));

  return {
    pieces: activeItems.length,
    wears,
    daysLogged,
    worn: activeItems.length - unwornPieces.length,
    unworn: unwornPieces.length,
    retired: items.length - activeItems.length,
    outfits: outfits.length,
    resting,
    cost,
    recordedPrices,
    categories: { rows, max: rows.reduce((max, r) => Math.max(max, r.wears), 0) },
  };
}
