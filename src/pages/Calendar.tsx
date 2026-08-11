import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { addDays, formatLocalDate, isFutureDate, todayLocal } from '../lib/dates';
import type { ClothingItem, Outfit, WearLog } from '../types';
import { Button, Card, EmptyState, IconButton, Masthead, Modal, SectionTitle } from '../components/ui';
import {
  IconArrowRight, IconChevronLeft, IconChevronRight, IconEyelet, IconEyeletFilled, IconPlus,
} from '../components/icons';
import { Basting, GarmentPlate, PlateEmptyLedger } from '../components/art';
import { showToast } from '../components/Toast';

/**
 * CALENDAR — a week of the ledger, laid open.
 *
 * Two kinds of entry live here and they never look alike:
 *   · a recorded wear — filled carmine eyelet, counted, on the record;
 *   · a plan — a future date, basting-dashed and labelled "planned". Plans move no
 *     wear counts (see logWear in WardrobeContext); they are intentions, not history.
 *
 * Scheduling a day passes that day's date to logWear, so a set planned for Thursday
 * lands on Thursday. Today's cell carries a ring, never a fill, until something is
 * actually logged. Past days that went unlogged say "not logged" — a fact, not a
 * failure, and never red.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

/** 'YYYY-MM-DD' → a Date at local midnight. Never parse these as UTC. */
function localDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function weekdayShort(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}

function dayNumber(dateStr: string): number {
  return localDate(dateStr).getDate();
}

function shortDate(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function longDate(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Sunday of the week containing dateStr, in local time. */
function startOfWeek(dateStr: string): string {
  const d = localDate(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return formatLocalDate(d);
}

/** "August 2026", or "Jul – Aug 2026" when the week straddles two months. */
function spanLabel(startStr: string, endStr: string): string {
  const a = localDate(startStr);
  const b = localDate(endStr);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return a.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.toLocaleDateString('en-US', { month: 'short' })} – ${b.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })}`;
  }
  const opts = { month: 'short', year: 'numeric' } as const;
  return `${a.toLocaleDateString('en-US', opts)} – ${b.toLocaleDateString('en-US', opts)}`;
}

function wearsPhrase(n: number): string {
  return n === 1 ? 'worn once' : `worn ${n} times`;
}

function piecesPhrase(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}

/** Photo tile, or the drawn flat when there's no photo. The no-photo state is first-class. */
function Thumb({ item, className = '' }: { item: ClothingItem; className?: string }) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} />
      )}
    </span>
  );
}

/* ---------- the page ---------- */

export default function Calendar() {
  const { items, outfits, wearLogs, logWear, removeWearLog } = useWardrobe();
  const navigate = useNavigate();

  const today = todayLocal();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  /** The day the scheduling sheet is open for, or null. */
  const [planFor, setPlanFor] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = days[6];
  const isThisWeek = weekStart === startOfWeek(today);

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, WearLog[]>();
    for (const log of wearLogs) {
      const list = map.get(log.date);
      if (list) list.push(log);
      else map.set(log.date, [log]);
    }
    return map;
  }, [wearLogs]);

  const scheduleOrder = useMemo(
    () =>
      [...outfits].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return (a.lastWorn ?? '').localeCompare(b.lastWorn ?? '');
      }),
    [outfits]
  );

  /** The next day on this page that is today-or-later and still blank. */
  const openDay = useMemo(
    () => days.find(d => d >= today && (logsByDate.get(d)?.length ?? 0) === 0),
    [days, today, logsByDate]
  );

  const describe = (log: WearLog): string => {
    const outfit = log.outfitId ? outfits.find(o => o.id === log.outfitId) : undefined;
    if (outfit) return outfit.name;
    const names = log.itemIds
      .map(id => byId.get(id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) return piecesPhrase(log.itemIds.length);
    if (names.length <= 2) return names.join(' + ');
    return `${names[0]} + ${names.length - 1} more`;
  };

  /* ---------- scheduling ---------- */

  /**
   * The fix that matters: the chosen date goes to logWear. A future date is stored
   * as a plan (no wear counts move); today's date is a real, sealed wear.
   */
  const schedule = (dateStr: string, outfit: Outfit) => {
    logWear(outfit.itemIds, outfit.id, dateStr);
    if (isFutureDate(dateStr)) {
      showToast(`Planned. "${outfit.name}" is down for ${shortDate(dateStr)}.`, 'info');
    } else {
      showToast(`Logged. "${outfit.name}" ${wearsPhrase(outfit.wearCount + 1)}.`, 'seal');
    }
    setPlanFor(null);
  };

  const remove = (log: WearLog) => {
    const planned = isFutureDate(log.date);
    removeWearLog(log.id);
    showToast(
      planned ? 'Removed. That plan is off the page.' : 'Undone. That wear is off the record.',
      'info'
    );
  };

  /* ---------- nothing to show at all ---------- */

  if (outfits.length === 0 && wearLogs.length === 0) {
    return (
      <>
        <Masthead title="Calendar" />
        <Card>
          <EmptyState
            plate={<PlateEmptyLedger />}
            title="The week is still blank."
            body="Days fill in as wears go on the record. Save an outfit and you can also put one down for a day that hasn't happened yet."
            action={
              <Button tone="primary" onClick={() => navigate('/outfits')}>
                Put an outfit together
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead
        title="Calendar"
        meta={
          <span className="tabular">
            {shortDate(weekStart)} – {shortDate(weekEnd)}
          </span>
        }
      />

      {/* week navigation */}
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <IconChevronLeft size={18} />
        </IconButton>
        <div className="text-center min-w-0">
          <p className="type-masthead text-[20px] leading-none">{spanLabel(weekStart, weekEnd)}</p>
          {isThisWeek ? (
            <p className="type-ledger text-[10px] text-text-2 mt-1.5">This week</p>
          ) : (
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(today))}
              className="type-ledger text-[10px] text-text-2 hover:text-text transition-colors duration-150 mt-1"
            >
              Back to this week
            </button>
          )}
        </div>
        <IconButton label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <IconChevronRight size={18} />
        </IconButton>
      </div>

      {/* the week */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map(date => {
          const logs = logsByDate.get(date) ?? [];
          const isToday = date === today;
          const past = date < today;
          const recorded = logs.some(l => !isFutureDate(l.date));

          return (
            <div
              key={date}
              className={`bg-surface rounded-[2px] p-2.5 flex flex-col sm:min-h-[168px] ${
                isToday ? 'plate-ink' : 'plate'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="type-ledger text-[11px] text-text-2 tabular">
                  {weekdayShort(date)} {dayNumber(date)}
                </span>
                {recorded ? (
                  <span className="text-accent shrink-0" title="Worn — on the record">
                    <IconEyeletFilled size={12} />
                  </span>
                ) : isToday ? (
                  <span className="text-text-2 shrink-0" title="Today">
                    <IconEyelet size={12} />
                  </span>
                ) : null}
              </div>

              <div className="flex-1">
                {logs.map(log => {
                  const planned = isFutureDate(log.date);
                  const members = log.itemIds
                    .map(id => byId.get(id))
                    .filter((i): i is ClothingItem => Boolean(i));
                  return (
                    <div key={log.id} className="mt-2.5">
                      <p className="text-[13px] text-text leading-snug break-words">{describe(log)}</p>
                      {planned ? <Basting className="mt-1.5" /> : null}
                      <p className="type-ledger text-[10px] text-text-2 mt-1 tabular">
                        {planned ? 'Planned' : piecesPhrase(log.itemIds.length)}
                      </p>
                      {members.length > 0 ? (
                        <div className="flex gap-1 mt-1.5">
                          {members.slice(0, 3).map(item => (
                            <Thumb key={item.id} item={item} className="w-7 h-9" />
                          ))}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => remove(log)}
                        aria-label={
                          planned
                            ? `Remove the plan for ${longDate(date)}`
                            : `Remove the wear logged on ${longDate(date)}`
                        }
                        className="type-ledger text-[10px] text-text-2 hover:text-text transition-colors duration-150 h-11 w-full text-left"
                      >
                        {planned ? 'Remove' : 'Undo'}
                      </button>
                    </div>
                  );
                })}

                {logs.length === 0 && past ? (
                  <p className="type-ledger text-[10px] text-text-2 mt-2.5">Not logged</p>
                ) : null}
              </div>

              {!past && outfits.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPlanFor(date)}
                  aria-label={
                    isToday
                      ? "Log today's wear"
                      : `Plan an outfit for ${longDate(date)}`
                  }
                  className="type-ledger text-[10px] text-text-2 hover:text-text hover:bg-sunken transition-colors duration-150 h-11 w-full mt-2 inline-flex items-center gap-1.5 px-1 rounded-[2px]"
                >
                  <IconPlus size={12} />
                  {isToday ? 'Log' : 'Plan'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* quick schedule */}
      {outfits.length > 0 ? (
        <Card>
          <SectionTitle aside={openDay ? shortDate(openDay) : undefined}>Quick schedule</SectionTitle>
          {openDay ? (
            <>
              <p className="text-[14px] text-text-2 mb-4 leading-snug">
                An outfit here goes down for the next open day on this page —{' '}
                {openDay === today ? 'today' : longDate(openDay)}.
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {scheduleOrder.map(outfit => {
                  const members = outfit.itemIds
                    .map(id => byId.get(id))
                    .filter((i): i is ClothingItem => Boolean(i));
                  return (
                    <button
                      key={outfit.id}
                      type="button"
                      onClick={() => schedule(openDay, outfit)}
                      className="shrink-0 w-[132px] text-left p-2 bg-sunken rounded-[2px] registered hover:bg-sunken/70 transition-colors duration-150"
                    >
                      <span className="flex gap-1">
                        {members.slice(0, 3).map(item => (
                          <Thumb key={item.id} item={item} className="w-8 h-10" />
                        ))}
                      </span>
                      <span className="block text-[13px] text-text mt-2 truncate">{outfit.name}</span>
                      <span className="type-ledger text-[10px] text-text-2 block mt-0.5 tabular">
                        {piecesPhrase(outfit.itemIds.length)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-[14px] text-text-2 leading-snug">
              {weekEnd < today
                ? 'This week is already written. Move forward a week to plan one.'
                : 'Every day left on this page has an entry. The week ahead is open.'}
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <EmptyState
            plate={<PlateEmptyLedger />}
            title="No outfits to schedule yet."
            body="Days still fill in from Today, one wear at a time. Save an outfit and you can put it down for a day in advance from here."
            action={
              <Button tone="primary" onClick={() => navigate('/outfits')}>
                Put an outfit together
              </Button>
            }
          />
        </Card>
      )}

      {/* ---------- the scheduling sheet ---------- */}
      <Modal
        open={planFor !== null}
        onClose={() => setPlanFor(null)}
        title={planFor === today ? "Log today's wear" : planFor ? `Plan ${longDate(planFor)}` : ''}
      >
        {planFor ? (
          <div>
            <p className="text-[14px] text-text-2 leading-snug">
              {isFutureDate(planFor)
                ? 'A planned day is an intention, not a wear. Nothing is counted until the day arrives.'
                : 'This one counts — it goes straight onto the record.'}
            </p>

            <Basting className="my-5" />

            <ul className="space-y-1 -mx-2 max-h-[46vh] overflow-y-auto">
              {scheduleOrder.map(outfit => {
                const members = outfit.itemIds
                  .map(id => byId.get(id))
                  .filter((i): i is ClothingItem => Boolean(i));
                return (
                  <li key={outfit.id}>
                    <button
                      type="button"
                      onClick={() => schedule(planFor, outfit)}
                      className="w-full min-h-[56px] flex items-center gap-3 px-2 py-2 text-left rounded-[2px] hover:bg-sunken transition-colors duration-150"
                    >
                      <span className="flex gap-1 shrink-0">
                        {members.slice(0, 3).map(item => (
                          <Thumb key={item.id} item={item} className="w-8 h-10" />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-text truncate">{outfit.name}</span>
                        <span className="type-ledger text-[10px] text-text-2 block mt-0.5 tabular">
                          {piecesPhrase(outfit.itemIds.length)}
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
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
