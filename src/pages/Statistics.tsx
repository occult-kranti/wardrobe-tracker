import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { categoryLabel, isPlannedLog, SOURCE_LABELS, type ClothingItem, type ItemSource } from '@almari/shared/types';
import { daysSince, isFutureDate, todayLocal } from '@almari/shared/dates';
import { aggregateCostPerWear, costPerWear, formatMoney, formatPerWear } from '@almari/shared/cost';
import { Button, Card, EmptyState, Masthead, SectionTitle, Stat, TableRail } from '../components/ui';
import { Basting, GarmentPlate, LeaderLine, PlateEmptyLedger } from '../components/art';
import AddItemModal from '../components/AddItemModal';

/**
 * LEDGER — the closet's accounts, set like magazine infographics.
 *
 * Neutral territory by contract (docs/06-focus-group-requirements.md §2.6): no red,
 * no alarm states, no report card. Bars are ink with exactly one carmine hero (the
 * maximum) per chart. Low wear reads as "quiet lately" and offers paths, never a
 * verdict. Never-worn pieces are stated once, like a bank balance — resting, not
 * wasted. Retired pieces sit out of the active numbers but are acknowledged in one
 * line, because their history is kept.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

/** Basting-stitch rule painted on a table row — the CSS class needs its own box. */
const bastingRow: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(to right, var(--color-border) 0 4px, transparent 4px 7px)',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 1px',
  backgroundPosition: 'left bottom',
};

/** 'YYYY-MM' → 'Mar', or 'Mar ’24' once the year stops being obvious. */
function monthTick(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const short = d.toLocaleDateString('en-IN', { month: 'short' });
  return d.getFullYear() === new Date().getFullYear() ? short : `${short} ’${String(y).slice(2)}`;
}

/** 'YYYY-MM-DD' → 'March' / 'March 2025'. Never parse these as UTC. */
function monthLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

/** Brand-group sentinels — pieces with no maker to rank. Never real makers. */
const SELF_MADE = '\u0000self-made';
const NO_LABEL = '\u0000no-label';

/** Photo tile, or the drawn flat when there's no photo. The no-photo state is first-class. */
function Thumb({ item, className = '' }: { item: ClothingItem; className?: string }) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
      )}
    </span>
  );
}

/**
 * One horizontal bar off a hairline axis. Ink throughout — no hero bar.
 *
 * The carmine hero was withdrawn: focus-group §2.6 says "every category gets
 * identical visual weight — dresses are never rendered softer, rounder, or
 * pinker", and colouring exactly one category is that operation, whatever picked
 * it. In dark mode the accent resolves to a chalk red, so the singled-out row was
 * rendered literally pinker. Emphasis is carried by a leader line instead, which
 * is brand §6.5's own "basting-dash projection line".
 */
function BarRow({
  label,
  value,
  aside,
  max,
  width = 3,
}: {
  label: string;
  value: number;
  aside?: string;
  max: number;
  /** Character width of the value column, so 3- and 4-digit totals still line up. */
  width?: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 h-9">
      <span className="type-ledger text-[11px] text-text-2 w-[86px] sm:w-[118px] shrink-0 truncate">
        {label}
      </span>
      <span className="flex-1 border-l border-border py-[3px] min-w-0">
        <span
          className="block h-2 bg-text"
          style={{ width: `${Math.max(pct, value > 0 ? 1.5 : 0)}%` }}
        />
      </span>
      <span
        className="type-ledger text-[12px] text-text tabular text-right shrink-0"
        style={{ width: `${width}ch` }}
      >
        {value}
      </span>
      {aside ? (
        <span className="type-ledger text-[11px] text-text-2 tabular w-[68px] text-right shrink-0">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

export default function Statistics() {
  const {
    items, activeItems, outfits, wearLogs, settings,
    getMostWorn, getUnwornItems,
  } = useWardrobe();

  const [addOpen, setAddOpen] = useState(false);

  const retiredCount = items.length - activeItems.length;

  /* ---------- totals (plans are not wears) ---------- */

  // Two quantities that used to share the label "wears recorded", 24× apart.
  const daysLogged = useMemo(
    () => wearLogs.filter(l => !isPlannedLog(l) && !isFutureDate(l.date)).length,
    [wearLogs]
  );
  const itemWears = useMemo(
    () => activeItems.reduce((sum, i) => sum + i.wearCount, 0),
    [activeItems]
  );

  /** Every non-future log, oldest first. The spine of every series below. */
  const history = useMemo(
    () => wearLogs.filter(l => !isPlannedLog(l) && !isFutureDate(l.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [wearLogs]
  );

  const unworn = useMemo(() => getUnwornItems(), [getUnwornItems]);
  const wornCount = activeItems.length - unworn.length;

  /* ---------- cost ---------- */

  // 'costed-wears': what was spent, divided by the wears of the pieces that money
  // bought. The page used to print this average one way and the By-maker table
  // the other, 240px apart, without saying which was which.
  const costTotals = useMemo(() => aggregateCostPerWear(activeItems), [activeItems]);
  const restingCost = useMemo(
    () => unworn.reduce((sum, i) => sum + (i.cost ?? 0), 0),
    [unworn]
  );

  /* ---------- by category ---------- */

  const categories = useMemo(() => {
    const counts = new Map<string, { count: number; wears: number }>();
    for (const item of activeItems) {
      const entry = counts.get(item.category) ?? { count: 0, wears: 0 };
      entry.count += 1;
      entry.wears += item.wearCount;
      counts.set(item.category, entry);
    }
    // Sorted and scaled by wears, which is what the bar now draws.
    const rows = [...counts.entries()]
      .map(([id, entry]) => ({ id, label: categoryLabel(settings, id), ...entry }))
      .sort((a, b) => b.wears - a.wears || a.label.localeCompare(b.label));
    return { rows, max: rows.reduce((m, r) => Math.max(m, r.wears), 0) };
  }, [activeItems, settings]);

  /* ---------- the monthly spine ----------
     One pass builds every month-indexed series: wears, distinct pieces worn, and
     the money owned by the end of that month. Twelve continuous months, gaps
     included, anchored on the current month so the newest bar is always "now". */

  const months = useMemo(() => {
    // Retired pieces sit outside every number on this page (their one line at
    // the foot excepted), and the CPW curve divides spend by the wears of the
    // pieces that money bought — the same denominator as the Cost card, so the
    // chart, its caption, and the card can never disagree again.
    const activeIds = new Set(activeItems.map(i => i.id));
    const costedIds = new Set(activeItems.filter(i => (i.cost ?? 0) > 0).map(i => i.id));

    const wearsBy = new Map<string, number>();
    const piecesBy = new Map<string, Set<string>>();
    const costedBy = new Map<string, number>();
    for (const log of history) {
      const key = log.date.slice(0, 7);
      const ids = log.itemIds.filter(id => activeIds.has(id));
      if (ids.length === 0) continue;
      wearsBy.set(key, (wearsBy.get(key) ?? 0) + ids.length);
      costedBy.set(key, (costedBy.get(key) ?? 0) + ids.filter(id => costedIds.has(id)).length);
      const seen = piecesBy.get(key) ?? new Set<string>();
      for (const id of ids) seen.add(id);
      piecesBy.set(key, seen);
    }
    if (wearsBy.size === 0) return [];

    const today = todayLocal();
    const thisMonth = today.slice(0, 7);
    const monthKeys = [...wearsBy.keys()].sort();
    const earliest = monthKeys[0];
    const [ty, tm] = thisMonth.split('-').map(Number);

    const rows: Array<{
      key: string;
      wears: number;
      distinct: number;
      spend: number;
      cumWears: number;
      cpw: number | null;
      partial: boolean;
    }> = [];

    for (let back = 11; back >= 0; back--) {
      const d = new Date(ty, tm - 1 - back, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key < earliest) continue; // don't draw months before the closet existed
      // Everything owned by the last day of this month, and every costed wear up
      // to it — including wears from before the charted window.
      const spend = activeItems
        .filter(i => i.dateAdded.slice(0, 7) <= key)
        .reduce((sum, i) => sum + (i.cost ?? 0), 0);
      const cumWears = monthKeys
        .filter(k => k <= key)
        .reduce((sum, k) => sum + (costedBy.get(k) ?? 0), 0);
      rows.push({
        key,
        wears: wearsBy.get(key) ?? 0,
        distinct: piecesBy.get(key)?.size ?? 0,
        spend,
        cumWears,
        cpw: spend > 0 && cumWears > 0 ? spend / cumWears : null,
        // The current month is only part-run. Charting it beside whole months
        // makes every "now" look like a collapse.
        partial: key === thisMonth,
      });
    }
    return rows;
  }, [history, activeItems]);

  const monthlyMax = months.reduce((max, r) => Math.max(max, r.wears), 0);
  const monthlyPeak = months.findIndex(r => r.wears === monthlyMax && r.wears > 0);

  /* ---------- cost per wear, over time ----------
     Cumulative, not per-month: the question is "what has this wardrobe cost me
     per wear so far", and that number falls with every wear and steps up when a
     piece is bought. Stated as arithmetic, never as an achievement. */

  // Under three months the curve is theatre, not information: a closet logged for
  // six weeks runs ₹52 → ₹7 on arithmetic alone, and no caption beats that slope.
  const MIN_CPW_MONTHS = 3;
  const cpwSeries = useMemo(() => months.filter(m => m.cpw !== null), [months]);
  const cpwNow = cpwSeries.length > 0 ? cpwSeries[cpwSeries.length - 1].cpw : null;
  const cpwThen = cpwSeries.length > 1 ? cpwSeries[0].cpw : null;
  const cpwMax = cpwSeries.reduce((max, r) => Math.max(max, r.cpw ?? 0), 0);

  /* ---------- re-wear rate ----------
     Wears ÷ distinct pieces worn, over whole months only. This is deliberately
     NOT charted as a long trend: the rate falls mechanically as a wardrobe grows
     (7 pieces worn 40 times reads 5.7; 29 pieces worn 120 times reads 4.1), and a
     number that drops while you do nothing wrong is a shame mechanic in disguise.
     Six recent whole months is a window, not a verdict. */

  const rewear = useMemo(() => {
    const whole = months.filter(m => !m.partial && m.distinct > 0).slice(-6);
    if (whole.length === 0) return null;
    const rows = whole.map(m => ({ key: m.key, rate: m.wears / m.distinct }));
    const wears = whole.reduce((sum, m) => sum + m.wears, 0);
    const pieces = whole.reduce((sum, m) => sum + m.distinct, 0);
    return {
      rows,
      max: rows.reduce((max, r) => Math.max(max, r.rate), 0),
      average: pieces > 0 ? wears / pieces : 0,
      monthsCounted: whole.length,
    };
  }, [months]);

  /* ---------- most worn / quiet lately ---------- */

  const mostWorn = useMemo(() => getMostWorn(5).filter(i => i.wearCount > 0), [getMostWorn]);

  // Quiet means worn once and then a month untouched. Never-worn pieces are
  // Resting's story, told once, directly below — without the wearCount guard
  // this card degenerated into an exact copy of Resting whenever five
  // never-worn pieces crossed thirty days. A week-one closet has nothing
  // quiet in it yet.
  const quietLately = useMemo(
    () =>
      activeItems
        .filter(i => i.wearCount > 0 && daysSince(i.lastWorn ?? i.dateAdded) >= 30)
        .sort(
          (a, b) =>
            a.wearCount - b.wearCount ||
            (a.lastWorn ?? '').localeCompare(b.lastWorn ?? '')
        )
        .slice(0, 5),
    [activeItems]
  );

  /* ---------- brands: a plain ranked table, never a collection ---------- */

  const brands = useMemo(() => {
    const groups = new Map<
      string,
      { casings: Map<string, number>; pieces: number; wears: number; cost: number; costedWears: number }
    >();

    for (const item of activeItems) {
      const raw = (item.brand ?? '').trim();
      const key = item.source === 'self-made' ? SELF_MADE : raw ? raw.toLowerCase() : NO_LABEL;
      const group =
        groups.get(key) ??
        { casings: new Map<string, number>(), pieces: 0, wears: 0, cost: 0, costedWears: 0 };
      group.pieces += 1;
      group.wears += item.wearCount;
      if (raw) group.casings.set(raw, (group.casings.get(raw) ?? 0) + 1);
      // Cost-per-wear only averages pieces that actually carry a cost.
      if (item.cost && item.cost > 0) {
        group.cost += item.cost;
        group.costedWears += item.wearCount;
      }
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([key, group]) => {
        // Display the casing the closet uses most — "APC" stays "A.P.C." if that's
        // how it was typed.
        const commonCasing = [...group.casings.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
        )[0]?.[0];
        const label =
          key === SELF_MADE
            ? SOURCE_LABELS['self-made']
            : key === NO_LABEL
              ? 'No label'
              : commonCasing ?? key;
        return {
          key,
          label,
          pieces: group.pieces,
          wears: group.wears,
          cpw: group.cost > 0 && group.costedWears > 0 ? group.cost / group.costedWears : null,
        };
      })
      .sort((a, b) => b.pieces - a.pieces || b.wears - a.wears || a.label.localeCompare(b.label));
  }, [activeItems]);

  /* ---------- how pieces came in ---------- */

  const sources = useMemo(() => {
    const order: ItemSource[] = ['new', 'secondhand', 'swapped', 'gifted', 'inherited', 'self-made'];
    const counts = new Map<ItemSource, number>();
    let unrecorded = 0;
    for (const item of activeItems) {
      if (item.source) counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
      else unrecorded += 1;
    }
    return {
      rows: order
        .filter(s => (counts.get(s) ?? 0) > 0)
        .map(s => ({ source: s, label: SOURCE_LABELS[s], count: counts.get(s) as number })),
      unrecorded,
    };
  }, [activeItems]);

  /* ---------- nothing on the record yet ---------- */

  if (items.length === 0) {
    return (
      <>
        <Masthead title="Ledger" />
        <Card>
          {/* §8.4: an empty screen teaches one thing and offers one way on.
              This one used to teach and stop — the only empty room in the
              house with no door out. The way on is the first piece. */}
          <EmptyState
            plate={<PlateEmptyLedger />}
            title="The ledger is still empty."
            body="Pieces and wears land here. Every wear you log divides what a piece cost by one more, so the ledger can say what each thing has come down to per wear."
            action={
              <Button tone="primary" onClick={() => setAddOpen(true)}>
                Add the first piece
              </Button>
            }
          />
        </Card>
        <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead title="Ledger" meta={`${daysLogged.toLocaleString('en-IN')} days logged`} />

      {/* Cumulative, factual, unloseable. Stated like a bank balance.
          "Wears recorded" is the item-wear total — the same words used to label a
          count of logged days here and the item total 600px lower, 24× apart. */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat value={activeItems.length} label="In the closet" />
          <Stat value={itemWears.toLocaleString('en-IN')} label="Wears recorded" />
          <Stat value={outfits.length} label="Outfits" />
          <Stat value={unworn.length} label="Not worn yet" />
        </div>
      </Card>

      {/* In use — a sentence, not a score.

          A 93% figure in 56px Fraunces over a full-width completion meter used to
          sit here. It is progress-as-achievement, which the panel rejected
          outright (focus-group §2.2, §2.6; brand §8.2), and it framed a wardrobe
          as something you can be behind on. The count stays; the scoreboard goes. */}
      {activeItems.length > 0 ? (
        <Card>
          <SectionTitle aside={`${wornCount} of ${activeItems.length}`}>In use</SectionTitle>
          <p className="type-editorial text-[20px] sm:text-[22px] leading-snug text-balance">
            {wornCount} of {activeItems.length} pieces have been worn at least once
            {unworn.length > 0
              ? `. ${unworn.length} ${unworn.length === 1 ? 'is' : 'are'} still resting.`
              : '.'}
          </p>
        </Card>
      ) : null}

      {/* By category — the bar and the numeral beside it are now the same
          quantity. The bar used to be drawn from piece count while the label read
          wears, so four categories holding three pieces each drew identical bars
          against 29, 77, 90 and 135 wears. */}
      {categories.rows.length > 0 ? (
        <Card>
          <SectionTitle aside="wears · pieces">By category</SectionTitle>
          <div>
            {categories.rows.map(row => (
              <BarRow
                key={row.id}
                label={row.label}
                value={row.wears}
                aside={`${row.count} ${row.count === 1 ? 'piece' : 'pieces'}`}
                max={categories.max}
                width={4}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {/* Monthly activity — ink columns on a hairline baseline, the peak marked
          with a basting-dash leader rather than a colour. Two months minimum:
          a single flex-1 column at full height is a slab, not a chart, and the
          column cap keeps short histories reading as columns too. */}
      {months.length >= 2 ? (
        <Card>
          <SectionTitle aside={`${months.length} ${months.length === 1 ? 'month' : 'months'}`}>Monthly activity</SectionTitle>
          <div className="flex items-end gap-1.5 sm:gap-2 h-32 border-b border-border">
            {months.map(row => {
              const pct = monthlyMax > 0 ? (row.wears / monthlyMax) * 100 : 0;
              return (
                <div key={row.key} className="flex-1 max-w-16 h-full flex flex-col justify-end items-center gap-1.5 min-h-0">
                  <span className="type-ledger text-[11px] text-text-2 tabular">{row.wears}</span>
                  {/* The bar lives in its own track so `height: %` resolves
                      against the PLOT AREA. It used to resolve against the flex
                      column that also holds the numeral and the gap; the
                      overflow was absorbed by default flex-shrink, and eight
                      months spanning 119–146 wears all rendered 99–100px tall.
                      A ledger whose chart flattens a 23% spread to nothing is
                      lying, which is the one thing a ledger cannot do. */}
                  <span className="w-full flex-1 min-h-0 flex items-end">
                    <span
                      className="w-full bg-text"
                      style={{
                        height: `${row.wears > 0 ? Math.max(pct, 3) : 0}%`,
                        // The running month is only part-counted; drawn open so it
                        // never reads as a fall off a cliff.
                        opacity: row.partial ? 0.45 : 1,
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-1.5 sm:gap-2 mt-2">
            {months.map(row => (
              <span
                key={row.key}
                className="type-ledger text-[10px] text-text-2 flex-1 max-w-16 text-center truncate"
              >
                {monthTick(row.key)}
              </span>
            ))}
          </div>
          {monthlyPeak >= 0 ? (
            /* The leader starts under the peak column, not at the card edge —
               §6.5 made this line the sole focal device after the coloured bar
               was withdrawn, and it was pointing at whichever month came first. */
            <div
              className="flex items-center gap-2 mt-3"
              // Capped three ways: by the column stride once capped columns stop
              // filling the row, and by the card edge so a late-year peak cannot
              // push the caption off it.
              style={{ marginInlineStart: `min(${(monthlyPeak / months.length) * 100}%, ${monthlyPeak * 72}px, calc(100% - 230px))` }}
            >
              <LeaderLine width={40} />
              <span className="type-ledger text-[11px] text-text-2 whitespace-nowrap">
                Busiest · {monthTick(months[monthlyPeak].key)} · {monthlyMax} {monthlyMax === 1 ? 'wear' : 'wears'}
              </span>
            </div>
          ) : null}
          <p className="type-ledger text-[10px] text-text-2 mt-2">
            {months[months.length - 1].partial ? 'This month is still running' : 'Wears per month'}
          </p>
        </Card>
      ) : null}

      {/* Cost per wear, over time — the number the whole ledger is for.
          Cumulative: everything owned, divided by every wear it has done. It
          falls with each wear and steps up when a piece arrives, and the caption
          says so plainly rather than congratulating anyone. */}
      {cpwSeries.length >= MIN_CPW_MONTHS && cpwNow !== null ? (
        <Card>
          <SectionTitle aside="cumulative">Cost per wear, over time</SectionTitle>
          <div className="flex items-end gap-5">
            <p className="type-masthead text-[40px] sm:text-[48px] leading-none tabular shrink-0">
              {formatPerWear(cpwNow)}
            </p>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-end gap-1 h-20 border-b border-l border-border pl-1">
                {cpwSeries.map(row => (
                  <span
                    key={row.key}
                    className="flex-1 bg-text min-w-[2px]"
                    style={{ height: `${cpwMax > 0 ? Math.max(((row.cpw as number) / cpwMax) * 100, 2) : 0}%` }}
                    title={`${monthTick(row.key)} · ${formatPerWear(row.cpw)}`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className="type-ledger text-[10px] text-text-2 tabular">
                  {monthTick(cpwSeries[0].key)} · {formatPerWear(cpwThen)}
                </span>
                <span className="type-ledger text-[10px] text-text-2 tabular">
                  {monthTick(cpwSeries[cpwSeries.length - 1].key)} · {formatPerWear(cpwNow)}
                </span>
              </div>
            </div>
          </div>
          <Basting className="my-4" />
          <p className="text-[14px] text-text-2 leading-snug">
            {formatMoney(costTotals.basis)} across {costTotals.wears.toLocaleString('en-IN')} wears
            of the pieces it bought. Every wear divides the same money one more way; every piece
            added starts the sum again.
          </p>
        </Card>
      ) : null}

      {/* Re-wear rate — how many times you wore each piece you reached for.
          Whole months only, six of them. Not charted as a long trend on purpose:
          the rate falls as a wardrobe grows, and a number that drops while
          nothing is wrong is a verdict wearing a lab coat. */}
      {rewear !== null && rewear.rows.length > 1 ? (
        <Card>
          <SectionTitle aside={`${rewear.monthsCounted} whole ${rewear.monthsCounted === 1 ? 'month' : 'months'}`}>Re-wear rate</SectionTitle>
          <div className="flex items-end gap-5">
            <p className="type-masthead text-[40px] sm:text-[48px] leading-none tabular shrink-0">
              {rewear.average.toFixed(1)}
              <span className="type-ledger text-[13px] align-top ml-1 text-text-2">×</span>
            </p>
            <div className="flex-1 min-w-0">
              {rewear.rows.map(row => (
                <BarRow
                  key={row.key}
                  label={monthTick(row.key)}
                  value={Number(row.rate.toFixed(1))}
                  max={rewear.max}
                  width={4}
                />
              ))}
            </div>
          </div>
          <Basting className="my-4" />
          <p className="text-[14px] text-text-2 leading-snug">
            Each piece you reached for, you wore {rewear.average.toFixed(1)} times on average. A wardrobe
            that gets bigger will read lower here — the number counts repetition, not effort.
          </p>
        </Card>
      ) : null}

      {/* Cost — two plain numbers, no commentary. The average divides what was
          spent by the wears of the pieces that money bought, so a 96-wear
          heirloom cannot deflate the price of things actually paid for. Rendered
          only while the closet is too young for the curve above — once the curve
          shows, this card would state the same two figures twice. */}
      {!(cpwSeries.length >= MIN_CPW_MONTHS && cpwNow !== null) && costTotals.basis > 0 ? (
        <Card>
          <SectionTitle aside={`${costTotals.costedPieces} priced pieces`}>Cost</SectionTitle>
          <div className="grid grid-cols-2 gap-5">
            <Stat value={formatMoney(costTotals.basis)} label="What it cost" />
            <Stat value={formatPerWear(costTotals.value)} label="Average per wear" />
          </div>
        </Card>
      ) : null}

      {/* Most worn — the closet's working pieces. */}
      {mostWorn.length > 0 ? (
        <Card>
          <SectionTitle aside="by wears">Most worn</SectionTitle>
          <ul className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {mostWorn.map(item => (
              <li key={item.id}>
                <Link to={`/closet?category=${encodeURIComponent(item.category)}`} className="block group">
                  <Thumb item={item} className="aspect-[4/5] w-full" />
                  <p className="text-[13px] text-text mt-1.5 leading-tight line-clamp-2 group-hover:underline underline-offset-[3px]">
                    {item.name}
                  </p>
                  <p className="type-ledger text-[11px] text-text-2 tabular mt-0.5">
                    {item.wearCount} {item.wearCount === 1 ? 'wear' : 'wears'}
                    {costPerWear(item).reason === 'ok'
                      ? ` · ${formatPerWear(costPerWear(item).value)}`
                      : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Quiet lately — paths, not verdicts. No alarm colour anywhere near this. */}
      {quietLately.length > 0 ? (
        <Card>
          <SectionTitle aside="fewest wears">Quiet lately</SectionTitle>
          <ul>
            {quietLately.map(item => (
              <li key={item.id}>
                <Link
                  to={`/closet?category=${encodeURIComponent(item.category)}`}
                  className="flex items-center gap-3 min-h-[56px] py-2 group"
                >
                  <Thumb item={item} className="w-11 h-14 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text truncate group-hover:underline underline-offset-[3px]">
                      {item.name}
                    </span>
                    <span className="type-ledger text-[11px] text-text-2 block mt-0.5">
                      {item.wearCount} {item.wearCount === 1 ? 'wear' : 'wears'}
                      {item.lastWorn ? ` · last worn ${monthLabel(item.lastWorn)}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Basting className="my-3" />
          <p className="text-[14px] text-text-2 leading-snug">
            A quiet piece is still a piece. Revive it, alter it, or pass it on.
          </p>
        </Card>
      ) : null}

      {/* Never worn — stated once, like a bank balance. Resting, never wasted. */}
      {unworn.length > 0 ? (
        <Card>
          <SectionTitle aside="no first wear yet">Resting</SectionTitle>
          <p className="type-editorial text-[20px] sm:text-[22px] leading-snug text-balance">
            {unworn.length === 1
              ? '1 piece hasn’t had a first wear yet.'
              : `${unworn.length} pieces haven’t had a first wear yet.`}
            {restingCost > 0 ? ` ${formatMoney(restingCost)} is resting here.` : ''}
          </p>
          <Basting className="my-4" />
          <ul className="grid sm:grid-cols-2 gap-x-6">
            {unworn.slice(0, 12).map(item => (
              <li key={item.id}>
                <Link
                  to={`/closet?category=${encodeURIComponent(item.category)}`}
                  className="flex items-baseline justify-between gap-3 h-11 group"
                >
                  <span className="text-[15px] text-text truncate group-hover:underline underline-offset-[3px]">
                    {item.name}
                  </span>
                  <span className="type-ledger text-[11px] text-text-2 shrink-0">
                    {categoryLabel(settings, item.category)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {unworn.length > 12 ? (
            <p className="text-[14px] text-text-2 mt-3">
              And {unworn.length - 12} more, in{' '}
              <Link to="/closet" className="text-accent underline underline-offset-[3px]">
                the closet
              </Link>
              .
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Brands — one plain ranked table. No logos, no imagery, nothing to
          complete. Only once a real named maker is on the books: a lone
          "No label" row is the totals card restated. */}
      {brands.some(b => b.key !== SELF_MADE && b.key !== NO_LABEL) ? (
        <Card>
          <SectionTitle aside={`${brands.length} ${brands.length === 1 ? 'maker' : 'makers'}`}>
            By maker
          </SectionTitle>
          <TableRail label="Wear and cost by maker">
            <table className="w-full text-left tabular">
              <thead>
                <tr>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 rule-double">
                    Brand
                  </th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-16">
                    Pieces
                  </th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-16">
                    Wears
                  </th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-[86px]">
                    Per wear
                  </th>
                </tr>
              </thead>
              <tbody>
                {brands.map(row => (
                  <tr key={row.key} style={bastingRow}>
                    <td className="text-[15px] text-text py-2.5 pr-3 max-w-[180px] truncate">
                      {row.label}
                    </td>
                    <td className="type-ledger text-[12px] text-text py-2.5 pl-3 text-right">
                      {row.pieces}
                    </td>
                    <td className="type-ledger text-[12px] text-text-2 py-2.5 pl-3 text-right">
                      {row.wears}
                    </td>
                    <td className="type-ledger text-[12px] text-text-2 py-2.5 pl-3 text-right">
                      {formatPerWear(row.cpw)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRail>
        </Card>
      ) : null}

      {/* How pieces came in — one line, stated plainly. */}
      {sources.rows.length > 0 ? (
        <Card>
          <SectionTitle aside={`${activeItems.length} pieces`}>How they came in</SectionTitle>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {sources.rows.map((row, index) => (
              <span key={row.source} className="inline-flex items-baseline gap-1.5">
                {index > 0 ? <span className="text-text-2 mr-1.5">·</span> : null}
                <span className="type-ledger text-[13px] text-text tabular">{row.count}</span>
                <span className="text-[15px] text-text-2">{row.label.toLowerCase()}</span>
              </span>
            ))}
          </p>
          {sources.unrecorded > 0 ? (
            <p className="type-ledger text-[11px] text-text-2 mt-3">
              {sources.unrecorded} not recorded
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Retired pieces sit outside every number above — but they are not erased. */}
      {retiredCount > 0 ? (
        <p className="type-ledger text-[11px] text-text-2 text-center">
          {retiredCount} {retiredCount === 1 ? 'piece' : 'pieces'} retired, their history kept
        </p>
      ) : null}
    </div>
  );
}
