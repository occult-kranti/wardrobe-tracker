import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { categoryLabel, isQuietCategory, type ClothingItem, type Outfit, type WearLog } from '../types';
import { todayLocal, isFutureDate, daysSince, addDays } from '../lib/dates';
import { isPlannedLog } from '../types';
import { costPerWear, formatPerWear } from '../lib/cost';
import { Button, Card, Chip, EmptyState, Masthead, Modal, SectionTitle, Stat } from '../components/ui';
import { IconArrowRight, IconCheck, IconEyeletFilled } from '../components/icons';
import { Basting, GarmentPlate, PlateEmptyCloset, WaxSeal } from '../components/art';
import { showToast } from '../components/Toast';
import AddItemModal from '../components/AddItemModal';
import { OUTDOORS, loadOutdoors, saveOutdoors, suitsOutdoors, type Outdoors } from '../lib/outdoors';

/**
 * TODAY — the home page and the daily habit loop.
 *
 * Everything here answers one question: what went on the record today. The hero
 * (the app's only carmine button) opens a sheet that logs a wear in a second tap.
 * Below it: one honest insight, cumulative totals stated like a bank balance, a
 * quiet category ledger, and the last few entries. No streaks, no badges, no
 * progress rings — see docs/06-focus-group-requirements.md §2.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late, then';
}

/** 'YYYY-MM-DD' → a Date at local midnight. Never parse these as UTC. */
function localDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function shortDate(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "March" — or "March 2025" once the year stops being obvious. */
function monthLabel(dateStr: string): string {
  const d = localDate(dateStr);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

function wearsPhrase(n: number): string {
  return n === 1 ? 'worn once' : `worn ${n} times`;
}

/** Deterministic 1..366 — the insight rotates daily, never on re-render. */
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

/** Photo tile, or the drawn flat when there's no photo. The no-photo state is first-class. */
function Thumb({ item, className = '' }: { item: ClothingItem; className?: string }) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
      )}
    </span>
  );
}

export default function Dashboard() {
  const {
    items, activeItems, outfits, wearLogs, settings,
    getOutfitSuggestions, getWearablePool, logWear, removeWearLog, confirmPlan,
  } = useWardrobe();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<'choices' | 'pieces'>('choices');
  const [picked, setPicked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const today = todayLocal();
  // What it is like out, asked rather than tracked. See lib/outdoors.ts.
  const [outdoors, setOutdoors] = useState<Outdoors | null>(() => loadOutdoors(todayLocal()));
  const answerOutdoors = (next: Outdoors | null) => {
    setOutdoors(next);
    saveOutdoors(today, next);
  };
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const retiredIds = useMemo(
    () => new Set(items.filter(i => i.retired).map(i => i.id)),
    [items]
  );

  /* ---------- today's page ---------- */

  // A plan whose day has arrived is a QUESTION, not a fact. Only confirmed
  // wears count as "logged today"; matured plans queue for their answer, and
  // must never suppress the log prompt or claim the day is on the record.
  const todayLogs = useMemo(
    () => wearLogs.filter(l => l.date === today && !isPlannedLog(l)),
    [wearLogs, today]
  );
  const maturedPlans = useMemo(
    () => wearLogs.filter(l => isPlannedLog(l) && l.date <= today),
    [wearLogs, today]
  );
  const loggedToday = todayLogs.length > 0;

  // Yesterday's REAL wears — the fuel for "Same as yesterday". Plans for
  // yesterday that never got their answer don't count; repeating a day that
  // didn't happen would be the exact lie the planned flag exists to prevent.
  const yesterdaysLogs = useMemo(
    () => wearLogs.filter(l => l.date === addDays(today, -1) && !isPlannedLog(l)),
    [wearLogs, today]
  );

  const repeatYesterday = () => {
    const pieces = new Set<string>();
    for (const log of yesterdaysLogs) {
      logWear(log.itemIds, log.outfitId);
      log.itemIds.forEach(id => pieces.add(id));
    }
    showToast(
      `Logged, same as yesterday. ${pieces.size} ${pieces.size === 1 ? 'piece' : 'pieces'}.`,
      'seal'
    );
  };

  /* ---------- the six choices ---------- */

  const suggestions = useMemo(() => getOutfitSuggestions(), [getOutfitSuggestions]);
  const choices = useMemo<Outfit[]>(() => {
    const taken = new Set(suggestions.map(o => o.id));
    // getOutfitSuggestions() goes quiet once today is logged; fill from the rest
    // so "log another" still has something to offer. Favourites first, then
    // least-recently-worn — the same order, by hand.
    const rest = outfits
      .filter(o => !taken.has(o.id) && o.itemIds.length > 0 && o.itemIds.every(id => !retiredIds.has(id)))
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return (a.lastWorn ?? '').localeCompare(b.lastWorn ?? '');
      });
    return [...suggestions, ...rest].slice(0, 6);
  }, [suggestions, outfits, retiredIds]);

  const pool = useMemo(() => getWearablePool(), [getWearablePool]);
  // Widening the picker still respects quiet categories — quiet is a stated
  // preference, not a filter to override.
  const everything = useMemo(
    () => activeItems.filter(i => !isQuietCategory(settings, i.category)),
    [activeItems, settings]
  );
  const unweathered = showAll || pool.length === 0 ? everything : pool;
  /**
   * The weather narrows the picker, and only if it has been answered and only
   * if it leaves something. A filter that empties the screen is a worse answer
   * than no filter, so it stands down rather than showing a wall of nothing.
   */
  const weathered = useMemo(
    () => unweathered.filter(i => suitsOutdoors(i, outdoors)),
    [unweathered, outdoors]
  );
  const pickable = weathered.length > 0 ? weathered : unweathered;

  /* ---------- totals (plans are not wears) ---------- */

  // "Wears recorded" used to count entries in the log — a count of logged DAYS —
  // while the Ledger showed the item-wear total under the same words, 24× larger.
  // The contract wants the cumulative unloseable total (§8.2): item wears.
  const itemWears = useMemo(() => activeItems.reduce((sum, i) => sum + i.wearCount, 0), [activeItems]);
  const restingCount = useMemo(() => activeItems.filter(i => i.wearCount === 0).length, [activeItems]);

  /* ---------- one honest insight, rotated by the day ---------- */

  const insight = useMemo<string | null>(() => {
    const lines: string[] = [];
    const worn = activeItems.filter(i => i.wearCount > 0);

    const most = [...worn].sort((a, b) => b.wearCount - a.wearCount)[0];
    if (most) {
      const { value } = costPerWear(most);
      lines.push(
        value !== null && value > 0
          ? `"${most.name}" is down to ${formatPerWear(value)} a wear.`
          : `"${most.name}" leads the closet at ${most.wearCount} wears.`
      );
    }

    const quietest = worn
      .filter(i => i.lastWorn)
      .sort((a, b) => (a.lastWorn ?? '').localeCompare(b.lastWorn ?? ''))[0];
    if (quietest?.lastWorn && daysSince(quietest.lastWorn) >= 30) {
      lines.push(`"${quietest.name}" hasn't been worn since ${monthLabel(quietest.lastWorn)}.`);
    }

    if (itemWears > 0) {
      const first = wearLogs
        .filter(l => !isPlannedLog(l) && !isFutureDate(l.date))
        .reduce<string | null>((min, l) => (min === null || l.date < min ? l.date : min), null);
      lines.push(`${itemWears} wears recorded${first ? ` since ${monthLabel(first)}` : ''}.`);
    }

    if (restingCount > 0) {
      lines.push(
        `${restingCount} ${restingCount === 1 ? 'piece is' : 'pieces are'} resting — no first wear yet.`
      );
    }

    if (worn.length > 0 && activeItems.length > 0) {
      const totalItemWears = activeItems.reduce((sum, i) => sum + i.wearCount, 0);
      lines.push(
        `${(totalItemWears / activeItems.length).toFixed(1)} wears per piece, across ${activeItems.length} pieces.`
      );
    }

    if (lines.length === 0) return null;
    return lines[dayOfYear() % lines.length];
  }, [activeItems, wearLogs, itemWears, restingCount]);

  /* ---------- category ledger ---------- */

  const categoryRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeItems) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    const rows = settings.categories
      .filter(c => !c.quiet)
      .map(c => ({ id: c.id, label: categoryLabel(settings, c.id), count: counts.get(c.id) ?? 0 }));
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return { rows, max };
  }, [activeItems, settings]);

  /* ---------- recent ledger entries ---------- */

  // Real wears only. Plans sort by date like anything else, so a far-future
  // plan would otherwise sit above every entry that actually happened.
  const recent = useMemo(
    () => wearLogs.filter(l => !isPlannedLog(l)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [wearLogs]
  );

  const namesFor = useCallback(
    (log: WearLog) => log.itemIds.map(id => byId.get(id)?.name).filter((n): n is string => Boolean(n)),
    [byId]
  );

  const describeLog = useCallback(
    (log: WearLog): string => {
      const outfit = log.outfitId ? outfits.find(o => o.id === log.outfitId) : undefined;
      if (outfit) return outfit.name;
      const names = namesFor(log);
      if (names.length === 0) return `${log.itemIds.length} pieces`;
      if (names.length <= 2) return names.join(' + ');
      return `${names[0]} + ${names.length - 1} more`;
    },
    [outfits, namesFor]
  );

  /* ---------- logging ---------- */

  const openSheet = () => {
    setMode('choices');
    setPicked([]);
    setShowAll(false);
    setSheetOpen(true);
  };

  /**
   * The first-wear line has to be computed BEFORE logWear — a moment later every
   * count has moved and the piece looks like any other. Returned, not shown, so
   * the seal toast still reads first.
   */
  const firstWearLine = (creditedIds: string[]): string | null => {
    const firsts = creditedIds
      .map(id => byId.get(id))
      .filter((i): i is ClothingItem => i !== undefined && i.wearCount === 0);
    if (firsts.length === 0) return null;
    return firsts.length === 1
      ? `Noted. "${firsts[0].name}" had its first wear.`
      : `Noted. "${firsts[0].name}" and ${firsts.length - 1} more had their first wear.`;
  };

  const logOutfit = (outfit: Outfit) => {
    const first = firstWearLine(outfit.itemIds);
    logWear([], outfit.id);
    showToast(`Logged. "${outfit.name}" ${wearsPhrase(outfit.wearCount + 1)}.`, 'seal');
    if (first) showToast(first, 'info');
    setSheetOpen(false);
  };

  const logPieces = () => {
    if (picked.length === 0) return;
    const first = firstWearLine(picked);
    const only = picked.length === 1 ? byId.get(picked[0]) : undefined;
    logWear(picked);
    showToast(
      only
        ? `Logged. "${only.name}" ${wearsPhrase(only.wearCount + 1)}.`
        : `Logged. ${picked.length} pieces — ${itemWears + picked.length} wears recorded.`,
      'seal'
    );
    if (first) showToast(first, 'info');
    setSheetOpen(false);
    setPicked([]);
  };

  const undoLog = (log: WearLog) => {
    removeWearLog(log.id);
    showToast('Undone. That wear is off the record.', 'info');
  };

  const togglePick = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));

  /* ---------- empty closet ---------- */

  const dateMeta = (
    <time dateTime={today} className="type-ledger">
      {shortDate(today)}
    </time>
  );

  if (activeItems.length === 0) {
    return (
      <>
        <Masthead title={greetingFor(new Date().getHours())} meta={dateMeta} />
        <Card>
          <EmptyState
            plate={<PlateEmptyCloset />}
            title="Nothing on the rail yet."
            body="Almari is a record, not a form. The first piece you add starts it — one photo or none, a name, and every wear it earns from here."
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

  /* ---------- the page ---------- */

  return (
    <div className="space-y-6">
      <Masthead title={greetingFor(new Date().getHours())} meta={dateMeta} />

      {/* A matured plan asks its question before anything else on the page.
          Saying yes is the fastest log in the app — the outfit was already
          chosen; the seal presses onto something true. Saying no removes the
          intention without touching a single count, which is the entire point
          of the stored flag. */}
      {maturedPlans.map(plan => (
        <Card key={plan.id}>
          <p className="type-ledger text-[11px] text-text-2">Held for {plan.date === today ? 'today' : shortDate(plan.date)}</p>
          <p className="type-editorial text-[20px] mt-1.5 leading-snug">
            You had {describeLog(plan)} down{plan.date === today ? ' for today' : ''}.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button
              tone="primary"
              compact
              icon={<IconEyeletFilled size={10} />}
              onClick={() => {
                confirmPlan(plan.id);
                showToast('Sealed. It happened.', 'seal');
              }}
            >
              Wore it
            </Button>
            <Button
              tone="tertiary"
              onClick={() => {
                removeWearLog(plan.id);
                showToast('Removed. The day stays open.', 'info');
              }}
            >
              It didn't happen
            </Button>
          </div>
        </Card>
      ))}

      {/* HERO — the whole point of the page, above the fold, two taps deep. */}
      <Card className="plate-ink">
        {loggedToday ? (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="type-ledger text-[11px] text-text-2">On the record today</p>
                <div className="mt-2 space-y-3">
                  {todayLogs.map(log => {
                    const names = namesFor(log);
                    return (
                      <div key={log.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="type-editorial text-[21px] leading-tight">{describeLog(log)}</p>
                          {names.length > 0 && log.outfitId ? (
                            <p className="text-[13px] text-text-2 mt-1 leading-snug">
                              {names.slice(0, 4).join(' · ')}
                              {names.length > 4 ? ` · +${names.length - 4}` : ''}
                            </p>
                          ) : null}
                        </div>
                        <Button tone="tertiary" onClick={() => undoLog(log)}>
                          Undo
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <span className="shrink-0 animate-seal">
                <WaxSeal size={40} />
              </span>
            </div>
            <Basting className="my-4" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-text-2">Wore something else as well?</p>
              {/* A log-wear action — the one sanctioned use of the hero fill,
                  and exactly one per view. Without it the logged state had no
                  accent at all and the heaviest object on the page was the
                  rail's "Add a piece". */}
              <Button tone="hero" compact icon={<IconEyeletFilled size={10} />} onClick={openSheet}>
                Log another
              </Button>
            </div>
            {/* The natural next step for a closet with no outfits yet — an
                aside, not a second call. Today already has its accent. */}
            {outfits.length === 0 ? (
              <Link
                to="/outfits"
                className="mt-2 inline-flex items-center gap-1.5 min-h-11 text-[13px] text-text-2 hover:text-text transition-colors duration-150"
              >
                Save today's look as an outfit — one tap to log it next time.
                <IconArrowRight size={14} />
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <p className="type-ledger text-[11px] text-text-2">Today</p>
              <p className="type-editorial text-[22px] sm:text-[26px] mt-2 leading-tight">
                Today's page is still blank.
              </p>
              <p className="text-[14px] text-text-2 mt-1">
                Two taps and it's on the record for good.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1 w-full sm:w-auto shrink-0">
              <Button
                tone="hero"
                onClick={openSheet}
                icon={<IconEyeletFilled size={10} />}
                className="w-full sm:w-auto"
              >
                Log today's wear
              </Button>
              {/* The single highest-leverage reduction of the logging cost the
                  product will ever ship (docs/21 §4): most days repeat, and a
                  repeated day should cost one tap, not a picker. Only offered
                  while today is blank and yesterday really happened. */}
              {yesterdaysLogs.length > 0 ? (
                <Button tone="tertiary" onClick={repeatYesterday}>
                  Same as yesterday
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      {/* ONE insight — honest, useful, and the same all day. */}
      {insight ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="type-ledger text-[11px] text-text-2">Noted</p>
              <p className="type-editorial text-[19px] sm:text-[21px] mt-2 leading-snug text-balance">
                {insight}
              </p>
            </div>
            <Link
              to="/ledger"
              className="type-ledger text-[11px] text-text-2 hover:text-text inline-flex items-center gap-1.5 shrink-0 h-11"
            >
              Ledger
              <IconArrowRight size={14} />
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Cumulative, factual, unloseable. Stated like a bank balance. */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat value={activeItems.length} label="In the closet" />
          <Stat value={outfits.length} label="Outfits" />
          <Stat value={itemWears} label="Wears recorded" />
          <Stat value={restingCount} label="Resting" />
        </div>
      </Card>

      {/* The closet as a ledger, one line per category. */}
      <Card>
        <SectionTitle aside={`${activeItems.length} pieces`}>By category</SectionTitle>
        <div>
          {categoryRows.rows.map(row => (
            <Link
              key={row.id}
              to={`/closet?category=${encodeURIComponent(row.id)}`}
              className="flex items-center gap-3 sm:gap-4 h-11 group"
            >
              <span className="type-ledger text-[11px] text-text-2 group-hover:text-text w-[92px] sm:w-[120px] shrink-0 truncate transition-colors duration-150">
                {row.label}
              </span>
              <span className="flex-1 h-[3px] bg-sunken overflow-hidden">
                <span
                  className="block h-full bg-text"
                  style={{ width: categoryRows.max > 0 ? `${(row.count / categoryRows.max) * 100}%` : '0%' }}
                />
              </span>
              <span className="type-ledger text-[12px] text-text tabular w-8 text-right shrink-0">
                {row.count}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Recent entries — wears on the record. Plans wait on the Calendar. */}
      {recent.length > 0 ? (
        <Card>
          <SectionTitle
            aside={
              <Link to="/calendar" className="inline-flex items-center min-h-11 hover:text-text transition-colors duration-150">
                Calendar
              </Link>
            }
          >
            Recent entries
          </SectionTitle>
          <div>
            {recent.map(log => (
              <div
                key={log.id}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <span className="type-ledger text-[11px] text-text-2 w-[84px] shrink-0">
                  {shortDate(log.date)}
                </span>
                <span className="text-[14px] text-text flex-1 min-w-0 truncate">
                  {describeLog(log)}
                </span>
                <span className="type-ledger text-[11px] text-text-2 shrink-0">
                  {log.itemIds.length} {log.itemIds.length === 1 ? 'piece' : 'pieces'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ---------- the quick log sheet ---------- */}
      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={mode === 'choices' ? "Log today's wear" : 'Pick the pieces'}
      >
        {mode === 'choices' ? (
          <div>
            {choices.length > 0 ? (
              <ul className="space-y-1 -mx-2">
                {choices.map(outfit => {
                  const pieces = outfit.itemIds
                    .map(id => byId.get(id))
                    .filter((i): i is ClothingItem => Boolean(i));
                  return (
                    <li key={outfit.id}>
                      <button
                        type="button"
                        onClick={() => logOutfit(outfit)}
                        className="w-full min-h-[56px] flex items-center gap-3 px-2 py-2 text-left rounded-[2px] hover:bg-sunken transition-colors duration-150"
                      >
                        <span className="flex gap-1 shrink-0">
                          {pieces.slice(0, 3).map(item => (
                            <Thumb key={item.id} item={item} className="w-8 h-10" />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] text-text truncate">{outfit.name}</span>
                          <span className="type-ledger text-[10px] text-text-2 block mt-0.5">
                            {outfit.itemIds.length} {outfit.itemIds.length === 1 ? 'piece' : 'pieces'}
                            {' · '}
                            {outfit.lastWorn ? `Last worn ${shortDate(outfit.lastWorn)}` : 'Not worn yet'}
                          </span>
                        </span>
                        <IconArrowRight size={16} className="text-text-2 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-text-2">
                No saved outfits yet — pick the pieces you wore instead, or{' '}
                <Link to="/outfits" className="text-accent underline underline-offset-[3px]">
                  put an outfit together
                </Link>
                .
              </p>
            )}

            <Basting className="my-5" />

            <button
              type="button"
              onClick={() => setMode('pieces')}
              className="w-full min-h-[44px] flex items-center justify-between gap-3 px-2 -mx-2 rounded-[2px] hover:bg-sunken transition-colors duration-150"
            >
              <span className="text-left">
                <span className="block text-[15px] text-text">Pick pieces instead</span>
                <span className="type-ledger text-[10px] text-text-2 block mt-0.5">
                  {pool.length > 0 ? `${pool.length} ready to wear` : 'From the whole closet'}
                </span>
              </span>
              <IconArrowRight size={16} className="text-text-2 shrink-0" />
            </button>
          </div>
        ) : (
          <div>
            {/* One tap, four answers, kept for today only. No location, no
                permission prompt, no network call — the person tapping it is
                standing at the window, which beats a forecast. */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="type-ledger text-[10px] text-text-2 mr-1">Out there</span>
              {OUTDOORS.map(o => (
                <Chip
                  key={o.id}
                  selected={outdoors === o.id}
                  onClick={() => answerOutdoors(outdoors === o.id ? null : o.id)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
            {outdoors && weathered.length === 0 ? (
              <p className="type-ledger text-[10px] text-text-2 -mt-2 mb-3">
                Nothing in the closet is tagged for that yet, so this is everything.
              </p>
            ) : null}
            {pickable.length === 0 ? (
              <p className="text-[14px] text-text-2">
                Nothing to pick from yet.{' '}
                <Link to="/closet" className="text-accent underline underline-offset-[3px]">
                  Open the closet
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="max-h-[46vh] pane -mx-1 px-1">
                  <ul className="grid grid-cols-3 gap-2">
                    {pickable.map(item => {
                      const selected = picked.includes(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => togglePick(item.id)}
                            aria-pressed={selected}
                            className={`w-full text-left registered rounded-[2px] p-1 transition-colors duration-150 ${
                              selected ? 'bg-sunken' : 'hover:bg-sunken/60'
                            }`}
                            data-selected={selected}
                          >
                            <span className="block relative">
                              <Thumb item={item} className="aspect-[4/5] w-full" />
                              {selected ? (
                                <span className="absolute top-1 right-1 w-5 h-5 bg-ink text-on-ink inline-flex items-center justify-center rounded-[2px] animate-seal">
                                  <IconCheck size={12} />
                                </span>
                              ) : null}
                            </span>
                            <span className="block text-[12px] text-text mt-1.5 leading-tight line-clamp-2">
                              {item.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {pool.length > 0 && !showAll ? (
                  <Button tone="tertiary" className="mt-3" onClick={() => setShowAll(true)}>
                    Show everything in the closet
                  </Button>
                ) : null}
              </>
            )}

            <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border">
              <div className="flex items-center gap-1">
                {choices.length > 0 ? (
                  <Button tone="tertiary" onClick={() => setMode('choices')}>
                    Back to outfits
                  </Button>
                ) : (
                  <span className="type-ledger text-[10px] text-text-2">
                    {picked.length} selected
                  </span>
                )}
              </div>
              <Button tone="primary" onClick={logPieces} disabled={picked.length === 0}>
                {picked.length > 1 ? `Log ${picked.length} pieces` : 'Log this'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
