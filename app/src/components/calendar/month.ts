/**
 * THE CALENDAR'S ARITHMETIC — every date in this feature is computed here,
 * and every one of them is a LOCAL day.
 *
 * The house law (@almari/shared/dates, pinned by scripts/test-dates.mjs and
 * app/__tests__/stress-time.test.ts): a wear-log date is 'YYYY-MM-DD' in the
 * wearer's own zone. `toISOString()` appears nowhere in this file and must
 * never appear in it — west of UTC it posts the evening to tomorrow, east of
 * UTC it posts the morning to yesterday, and a calendar that does that is a
 * calendar that quietly moves somebody's history by a day.
 *
 * So: months are keyed 'YYYY-MM' and stepped by integer arithmetic, never by
 * Date.setMonth (which rolls the 31st of a long month into the 1st of the
 * next); day counts come from `new Date(y, m, 0)`, a LOCAL construction; and
 * every day string is either sliced from another day string or built by
 * @almari/shared/dates. The maths this file does not own, it does not
 * reimplement — addDays and formatLocalDate are imported, per the shared-code
 * law in CLAUDE.md.
 *
 * THE DATE VOICE is the web Calendar's own (src/pages/Calendar.tsx): en-IN,
 * so a day reads "Wednesday, 12 August" and a short date "12 Aug" — day
 * before month, which is how this wardrobe's owner writes one down.
 */
import { addDays, todayLocal } from '@almari/shared/dates';
import { isPlannedLog, type WearLog } from '@almari/shared/types';

/** A month, keyed 'YYYY-MM'. */
export type MonthKey = string;

/** What a day is holding — the only three answers the marks distinguish. */
export type DayMarkKind = 'worn' | 'planned' | 'none';

/** 'YYYY-MM-DD' to a Date at LOCAL midnight. Never parse these as UTC. */
export function localDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/* ---------- months ---------- */

/** The month a day belongs to. */
export function monthOf(dateStr: string): MonthKey {
  return dateStr.slice(0, 7);
}

/** The month today belongs to. */
export function thisMonth(): MonthKey {
  return monthOf(todayLocal());
}

export function firstOfMonth(month: MonthKey): string {
  return `${month}-01`;
}

/**
 * Step whole months. Integer arithmetic on (year * 12 + month), because
 * Date.setMonth(+1) on the 31st of August lands on the 1st of October —
 * a month door that skips September once a year.
 */
export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  // JS % keeps the sign of the dividend; year 0 is far enough away that this
  // is defensive rather than reachable, and defensive is what dates need.
  const index = ((total % 12) + 12) % 12;
  return `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`;
}

/** Day 0 of the next month is the last day of this one, built locally. */
export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** "August 2026", in the house's en-IN voice. */
export function monthLabel(month: MonthKey): string {
  return localDate(firstOfMonth(month)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The month as weeks of seven, Sunday first — the week the web's Calendar
 * starts on (startOfWeek there subtracts getDay()). Days outside the month
 * are null: a blank cell, never a greyed-out neighbour's date, because a
 * neighbour's date on this page is a day you can tap by mistake.
 */
export function monthGrid(month: MonthKey): (string | null)[][] {
  const lead = localDate(firstOfMonth(month)).getDay();
  const count = daysInMonth(month);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d++) {
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ---------- the strip ---------- */

/**
 * The seven days ending today — six back, then today itself.
 *
 * NOT Sunday-to-Saturday. The strip is Today's own shoulder, and on a Sunday
 * a Sunday-first week is six cells of days that have not happened: nothing to
 * see, nothing to log, and the one gesture the strip exists for — writing
 * down a day that went unwritten — unavailable in six of its seven cells.
 * Trailing seven keeps every cell a day that can actually be written.
 */
export function trailingWeek(today: string = todayLocal()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

/**
 * "August 2026", or "Jul – Aug 2026" when the strip straddles two months.
 * Ported from src/pages/Calendar.tsx's spanLabel, en dash and all.
 */
export function spanLabel(startStr: string, endStr: string): string {
  const a = localDate(startStr);
  const b = localDate(endStr);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return a.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.toLocaleDateString('en-IN', { month: 'short' })} – ${b.toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    })}`;
  }
  const opts = { month: 'short', year: 'numeric' } as const;
  return `${a.toLocaleDateString('en-IN', opts)} – ${b.toLocaleDateString('en-IN', opts)}`;
}

/* ---------- the date voice, the web's own ---------- */

/** "W" — one letter, the column's own weekday. */
export function weekdayInitial(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-IN', { weekday: 'narrow' });
}

export function dayNumber(dateStr: string): number {
  return localDate(dateStr).getDate();
}

/** "12 Aug" — en-IN puts the day first. */
export function shortDate(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/** "Wednesday, 12 August" */
export function longDate(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function piecesPhrase(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}

export function wearsPhrase(n: number): string {
  return n === 1 ? 'worn once' : `worn ${n} times`;
}

/* ---------- what a day is holding ---------- */

/** Every log filed under its own day, in the order the record keeps them. */
export function logsByDate(logs: WearLog[]): Map<string, WearLog[]> {
  const map = new Map<string, WearLog[]>();
  for (const log of logs) {
    const list = map.get(log.date);
    if (list) list.push(log);
    else map.set(log.date, [log]);
  }
  return map;
}

/**
 * The mark a day carries. A PLAN IS NOT A WEAR and never counts as one — the
 * flag is read from the record (isPlannedLog), never derived from the date,
 * because a plan whose day has arrived is still a question (the provider's
 * logWear says so in as many words).
 */
export function dayMark(logs: WearLog[] | undefined): DayMarkKind {
  if (!logs || logs.length === 0) return 'none';
  if (logs.some(l => !isPlannedLog(l))) return 'worn';
  return 'planned';
}

/** How many pieces are on the record for a day — plans excluded. */
export function piecesWorn(logs: WearLog[] | undefined): number {
  if (!logs) return 0;
  return logs.filter(l => !isPlannedLog(l)).reduce((sum, l) => sum + l.itemIds.length, 0);
}
