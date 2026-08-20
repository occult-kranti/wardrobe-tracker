/**
 * THE CALENDAR'S ARITHMETIC, on its own — no router, no provider, no screen.
 *
 * The room tests prove the page behaves; this file proves the numbers under
 * it, which is where calendars actually go wrong: the month that skips
 * September because Date.setMonth rolled the 31st, the February that grows a
 * 29th in a common year, the week that loses a day crossing New Year.
 *
 * ZONE-INVARIANT BY CONSTRUCTION. Every expectation below is a civil-calendar
 * truth (August has 31 days; 1 August 2026 is a Saturday), never a fact about
 * the machine's offset, so this file must stay green under TZ=UTC,
 * TZ=Asia/Kolkata and TZ=Pacific/Kiritimati alike — the lever
 * app/__tests__/stress-time.test.ts documents as the one this runner offers.
 */
import { describe, expect, test } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  addMonths,
  dayMark,
  daysInMonth,
  logsByDate,
  monthGrid,
  monthOf,
  piecesWorn,
  spanLabel,
  trailingWeek,
} from '../src/components/calendar/month';

import type { WearLog } from '@almari/shared/types';

describe('the month walk', () => {
  test('a month steps to its neighbour, and across the turn of the year', () => {
    expect(addMonths('2026-08', 1)).toBe('2026-09');
    expect(addMonths('2026-08', -1)).toBe('2026-07');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    // Twelve steps is a year, in either direction.
    expect(addMonths('2026-08', 12)).toBe('2027-08');
    expect(addMonths('2026-08', -12)).toBe('2025-08');
  });

  test('stepping off a 31-day month never skips the short one', () => {
    // The Date.setMonth trap: a Date on 31 August, setMonth(+1), is 1 October.
    // Keys carry no day, so there is no day to roll.
    expect(addMonths(monthOf('2026-08-31'), 1)).toBe('2026-09');
    expect(addMonths(monthOf('2026-05-31'), 1)).toBe('2026-06');
    expect(addMonths(monthOf('2026-03-31'), -1)).toBe('2026-02');
  });

  test('months are as long as the calendar says, leap years included', () => {
    expect(daysInMonth('2026-01')).toBe(31);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2000-02')).toBe(29); // divisible by 400 — a leap year
    expect(daysInMonth('1900-02')).toBe(28); // divisible by 100, not 400 — not
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });
});

describe('the month grid', () => {
  test('August 2026 opens on a Saturday and runs to the 31st', () => {
    const weeks = monthGrid('2026-08');
    expect(weeks).toHaveLength(6);
    // Sunday-first: six blanks, then the 1st in the Saturday column.
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-08-01']);
    // 30 August is a Sunday, so the last row opens on it; 31 August is the
    // Monday beside it and the five cells after are blank.
    expect(weeks[4][6]).toBe('2026-08-29');
    expect(weeks[5]).toEqual(['2026-08-30', '2026-08-31', null, null, null, null, null]);
    const days = weeks.flat().filter((d): d is string => d !== null);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-08-01');
    expect(days[30]).toBe('2026-08-31');
  });

  test('February 2026 fits four rows exactly, with no ghost week', () => {
    // 1 February 2026 is a Sunday and the month is 28 days: 28 cells, four
    // rows, no leading blank and no trailing one.
    const weeks = monthGrid('2026-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2026-02-01');
    expect(weeks[3][6]).toBe('2026-02-28');
    expect(weeks.flat().some(d => d === null)).toBe(false);
    expect(weeks.flat().some(d => d === '2026-02-29')).toBe(false);
  });

  test('a leap February keeps its 29th', () => {
    const days = monthGrid('2024-02')
      .flat()
      .filter((d): d is string => d !== null);
    expect(days).toHaveLength(29);
    expect(days[28]).toBe('2024-02-29');
  });

  test('every row is seven cells and every day belongs to the month', () => {
    for (const month of ['2026-01', '2026-02', '2026-05', '2026-09', '2025-12', '2024-02']) {
      const weeks = monthGrid(month);
      for (const week of weeks) expect(week).toHaveLength(7);
      const days = weeks.flat().filter((d): d is string => d !== null);
      expect(days).toHaveLength(daysInMonth(month));
      for (const d of days) expect(monthOf(d)).toBe(month);
      // Consecutive, no repeats, no gaps.
      expect(new Set(days).size).toBe(days.length);
    }
  });
});

describe('the trailing week', () => {
  test('seven days, ending on the day it was asked about', () => {
    expect(trailingWeek('2026-08-19')).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
    ]);
  });

  test('it crosses a month without losing a day', () => {
    expect(trailingWeek('2026-09-02')).toEqual([
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  test('it crosses the turn of the year, and the end of a leap February', () => {
    expect(trailingWeek('2026-01-03')[0]).toBe('2025-12-28');
    expect(trailingWeek('2026-01-03')).toHaveLength(7);
    expect(trailingWeek('2024-03-02')).toContain('2024-02-29');
  });
});

describe('the strip label', () => {
  test('one month says the month; two say both', () => {
    expect(spanLabel('2026-08-13', '2026-08-19')).toBe('August 2026');
    expect(spanLabel('2026-08-27', '2026-09-02')).toBe('Aug – Sept 2026');
    expect(spanLabel('2025-12-28', '2026-01-03')).toBe('Dec 2025 – Jan 2026');
  });
});

describe('what a day is holding', () => {
  const wear = (date: string, itemIds: string[]): WearLog => ({ id: `w-${date}`, date, itemIds });
  const plan = (date: string, itemIds: string[]): WearLog => ({
    id: `p-${date}`,
    date,
    itemIds,
    planned: true,
  });

  test('a plan is never counted as a wear, whatever its date says', () => {
    // A plan whose day has PASSED is still a plan — the flag is read from the
    // record, never derived from the date. Deriving it is how every plan
    // silently became a wear the morning its date arrived.
    expect(dayMark([plan('2026-08-15', ['i1'])])).toBe('planned');
    expect(dayMark([wear('2026-08-17', ['i1'])])).toBe('worn');
    expect(dayMark([])).toBe('none');
    expect(dayMark(undefined)).toBe('none');
    // One real wear among plans is a written day.
    expect(dayMark([plan('2026-08-17', ['i1']), wear('2026-08-17', ['i2'])])).toBe('worn');
  });

  test('the count on a day counts pieces worn, never pieces planned', () => {
    expect(piecesWorn([wear('2026-08-17', ['i1', 'i2'])])).toBe(2);
    expect(piecesWorn([plan('2026-08-17', ['i1', 'i2'])])).toBe(0);
    expect(piecesWorn([wear('2026-08-17', ['i1']), plan('2026-08-17', ['i2', 'i3'])])).toBe(1);
    expect(piecesWorn(undefined)).toBe(0);
  });

  test('logs file under their own day and keep their order', () => {
    const map = logsByDate([
      wear('2026-08-17', ['i1']),
      wear('2026-08-18', ['i2']),
      plan('2026-08-17', ['i3']),
    ]);
    expect(map.get('2026-08-17')).toHaveLength(2);
    expect(map.get('2026-08-18')).toHaveLength(1);
    expect(map.get('2026-08-19')).toBeUndefined();
    expect(map.get('2026-08-17')![0].itemIds).toEqual(['i1']);
  });
});

describe('the day law, held at the source', () => {
  test('no file in this feature reaches for toISOString', () => {
    // A UTC slice reads correctly all afternoon and is wrong every evening
    // west of UTC and every morning east of it. The rule is easier to keep
    // than the bug is to find, so it is checked rather than remembered —
    // scripts/check-native-storage.mjs polices the phone's disk the same way.
    const dir = join(__dirname, '..', 'src', 'components', 'calendar');
    const files = readdirSync(dir).map(name => join(dir, name));
    files.push(join(__dirname, '..', 'src', 'app', 'calendar.tsx'));
    files.push(join(__dirname, '..', 'src', 'app', '(tabs)', 'index.tsx'));

    // Comments are stripped first, so a file may NAME the trap in prose
    // (both of these do, at length) without tripping the guard that forbids
    // calling it.
    const strip = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const offenders = files.filter(f => {
      const src = strip(readFileSync(f, 'utf8'));
      return src.includes('toISOString') || src.includes('getUTC') || src.includes('Date.UTC');
    });
    expect(offenders).toEqual([]);
    // And the guard is looking at real files, not an empty directory.
    expect(files.length).toBeGreaterThan(5);
  });
});
