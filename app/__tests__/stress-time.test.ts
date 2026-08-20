/**
 * Time under stress — midnight, DST, and the half-hour zones.
 *
 * The web's day law (mirrored from scripts/test-dates.mjs, enforced by
 * @almari/shared/dates): a wear-log date is the LOCAL day, never a UTC
 * slice, and daysSince counts local calendar days with Math.round so a
 * 23-, 23.5- or 25-hour "day" across a DST jump still counts as one day.
 *
 * WHAT THIS ENVIRONMENT LETS US VARY, HONESTLY — measured, not assumed:
 *  - Plain Node (v24, win32 included) honours process.env.TZ re-pointed at
 *    RUNTIME — offsets move immediately. Verified outside jest.
 *  - jest DOES NOT. The sandbox hands each test file a COPY of process.env:
 *    an assignment reads back ('Pacific/Kiritimati') but ICU never sees it
 *    and getTimezoneOffset never moves. Probed in this exact jest-expo
 *    setup; even require('process') resolves to the same sandboxed object.
 *    So per-test and per-file zone switching is IMPOSSIBLE here, and any
 *    test that "switched" TZ and passed would be sweeping its home zone
 *    while claiming five. The zone-matrix tests below are therefore gated
 *    on a capability probe and SKIP, loudly, with this reason — they run
 *    (with an applied-zone sentinel) in any future runner whose env is real.
 *  - What jest DOES allow: pinning ONE zone per PROCESS — TZ set in the
 *    shell before jest spawns is inherited by the workers and ICU honours
 *    it. Every unconditional test in this file is therefore written
 *    zone-INVARIANT (wall clocks built locally, expectations from an
 *    independent civil-calendar oracle, never from the machine's zone), so
 *    the whole suite can be re-run under TZ=Asia/Kolkata, TZ=UTC,
 *    TZ=Pacific/Kiritimati … and must stay green in all of them. That is
 *    the "per process where jest allows" lever, and the verification log
 *    in the squad report records the zones it was actually run under.
 *  - The Hermes VM on a device takes the OS zone at process start and an
 *    app cannot vary it at all; on-device confirmation of Hermes's own
 *    ICU/TZ tables stays an alpha-QR task, one zone per physical phone.
 *    What this suite proves is the transpiled code's arithmetic.
 *  - Only Date is faked (the inherited suites' doNotFake list) — timers,
 *    promises and waitFor stay real, so the provider's 250ms settle window
 *    behaves exactly as shipped.
 */
import { afterAll, afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';

import { addDays, daysSince, formatLocalDate, isFutureDate, todayLocal } from '@almari/shared/dates';

import {
  ACCOUNTS_KEY,
  SESSION_KEY,
  storage,
  wardrobeKey,
} from '../src/lib/storage';
import { useWardrobe, WardrobeProvider } from '../src/lib/wardrobe';

/* ---------- can this runner vary the zone at all? ---------- */

const ORIGINAL_TZ = process.env.TZ;

function offsetsProbe(): [number, number] {
  // Jan + Jul, both hemispheres' DST states.
  return [
    new Date(2026, 0, 15, 12).getTimezoneOffset(),
    new Date(2026, 6, 15, 12).getTimezoneOffset(),
  ];
}

/**
 * True only when assigning process.env.TZ actually moves the clock. Probes
 * two zones with distinct offsets, so no home zone can mask both.
 */
function detectTzVariability(): boolean {
  const home = offsetsProbe();
  let moved = false;
  for (const z of ['Pacific/Kiritimati', 'Asia/Kolkata']) {
    process.env.TZ = z;
    const p = offsetsProbe();
    if (p[0] !== home[0] || p[1] !== home[1]) {
      moved = true;
      break;
    }
  }
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
  return moved;
}

const TZ_CAN_VARY = detectTzVariability();

/**
 * Measured in this repo's jest-expo: FALSE. jest sandboxes process.env into
 * a plain copy — assignments read back but never reach ICU, so the run is
 * pinned to the zone the process was BORN in. The matrix below skips with
 * this constant as the reason; the pinned-zone lever (TZ in the shell before
 * jest starts) is exercised instead, from outside, per the squad report.
 */
const PIN_REASON =
  'this jest sandboxes process.env (assignments read back, ICU never moves) — zone can only be pinned per process, from the shell, before jest spawns';

const zoneTest = TZ_CAN_VARY ? test : test.skip;

/** [Jan 15, Jul 15] noon getTimezoneOffset — pinned from IANA, verified in this Node. */
const ZONE_PROBES: Record<string, [number, number]> = {
  'Asia/Kolkata': [-330, -330], // +05:30 all year — the non-hour offset the prompt names
  'America/New_York': [300, 240], // DST: -05:00 winter, -04:00 summer
  'Pacific/Kiritimati': [-840, -840], // +14:00 — the earliest wall clock on earth
  'Australia/Lord_Howe': [-660, -630], // the world's only 30-MINUTE DST shift
};

function setZone(zone: string) {
  process.env.TZ = zone;
  const probe = ZONE_PROBES[zone];
  if (!probe) throw new Error(`zone ${zone} has no pinned offsets — add them before using it`);
  // The sentinel: these tests only run where TZ_CAN_VARY probed true, and
  // even then each zone must PROVE it applied — a runtime that half-honours
  // TZ fails loudly here rather than sweeping its home zone under five names.
  expect(offsetsProbe()).toEqual(probe);
}

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

/* ---------- the independent oracle: civil-calendar day numbers ---------- */

/**
 * Days since 1970-01-01 for a YYYY-MM-DD string — pure integer arithmetic
 * (Howard Hinnant's days_from_civil), no Date object anywhere. This is a
 * TEST ORACLE, deliberately not the module's own arithmetic: asserting
 * daysSince against daysSince's formula would prove nothing. It is not one
 * of docs/34 §5's shared formulas — those come from @almari/shared and are
 * imported above, never copied.
 */
function civilDayNumber(dateStr: string): number {
  const [y0, m, d] = dateStr.split('-').map(Number);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

describe('the oracle itself is sound (so the tests below mean something)', () => {
  test('epoch, leap years, month ends', () => {
    expect(civilDayNumber('1970-01-01')).toBe(0);
    expect(civilDayNumber('1970-01-02')).toBe(1);
    // 2024 was a leap year; 2026 is not; 2000 was; 1900 was not.
    expect(civilDayNumber('2024-03-01') - civilDayNumber('2024-02-28')).toBe(2);
    expect(civilDayNumber('2026-03-01') - civilDayNumber('2026-02-28')).toBe(1);
    expect(civilDayNumber('2000-03-01') - civilDayNumber('2000-02-28')).toBe(2);
    expect(civilDayNumber('1900-03-01') - civilDayNumber('1900-02-28')).toBe(1);
    expect(civilDayNumber('2027-01-01') - civilDayNumber('2026-01-01')).toBe(365);
  });
});

/* ---------- provider plumbing (the inherited suites' pattern) ---------- */

type Ctx = ReturnType<typeof useWardrobe>;
let ctx: Ctx | null = null;

function Probe() {
  ctx = useWardrobe();
  return null;
}

async function openWardrobe() {
  const view = render(createElement(WardrobeProvider, null, createElement(Probe, null)));
  await waitFor(() => expect(ctx?.status).not.toBe('loading'));
  return view;
}

const DOC = JSON.stringify({
  schemaVersion: 8,
  items: [
    {
      id: 'i1', name: 'The white oxford', category: 'tops', color: '#F4EFE2',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 0, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i2', name: 'Indigo jeans', category: 'bottoms', color: '#31415E',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 5, lastWorn: '2026-08-01', favorite: false, laundryStatus: 'clean',
    },
  ],
  outfits: [], wearLogs: [], wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [], furniture: [], photoEncoding: 'inline',
  settings: { categories: [{ id: 'tops', label: 'Tops' }, { id: 'bottoms', label: 'Bottoms' }], occasions: ['casual'], theme: 'dark' },
});

async function seed(doc: string, id = 'acct-1') {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: id }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id, name: 'Time wardrobe', handle: '@time', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey(id), doc);
}

/** Only Date is faked — the inherited wardrobe suite's exact doNotFake list. */
function fakeDateOnly(now: Date) {
  jest.useFakeTimers({
    doNotFake: [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask',
      'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback',
      'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout',
    ],
    now,
  });
}

beforeEach(async () => {
  ctx = null;
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

/* ---------- 1. the midnight rollover — zone-invariant, runs pinned ---------- */

describe('logging across midnight (in whatever zone this run is pinned to)', () => {
  test('23:59:30 and 00:00:30 land on two different local days', async () => {
    // The wall clock is built LOCALLY — new Date(y,m,d,h,…) means this
    // moment in the runner's pinned zone, so the test is exact under any
    // TZ the process was started with (see the header: that is the lever
    // this environment actually offers). A UTC-slice implementation fails
    // this pair in every pinned zone except UTC itself: west of UTC the
    // first log lands tomorrow, east of UTC the second lands yesterday.
    fakeDateOnly(new Date(2026, 7, 19, 23, 59, 30));

    await seed(DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i1']);
    });
    const first = ctx!.wearLogs[ctx!.wearLogs.length - 1];
    expect(first.date).toBe('2026-08-19');
    expect(ctx!.getItem('i1')!.laundryStatus).toBe('worn');

    // Sixty seconds pass. Midnight happened in between.
    jest.setSystemTime(new Date(2026, 7, 20, 0, 0, 30));

    act(() => {
      ctx!.logWear(['i1']);
    });
    const second = ctx!.wearLogs[ctx!.wearLogs.length - 1];
    expect(second.date).toBe('2026-08-20');
    expect(second.date).not.toBe(first.date);

    // Neither is a plan — both moments already happened.
    expect(first.planned).toBeUndefined();
    expect(second.planned).toBeUndefined();
    // And the piece's lastWorn follows the newer local day.
    expect(ctx!.getItem('i1')!.lastWorn).toBe('2026-08-20');
    expect(ctx!.getItem('i1')!.wearCount).toBe(2);
  });

  test('formatLocalDate agrees with the oracle either side of the stroke', () => {
    fakeDateOnly(new Date(2026, 7, 19, 23, 59, 30));
    const before = todayLocal();
    jest.setSystemTime(new Date(2026, 7, 20, 0, 0, 30));
    const after = todayLocal();
    expect(before).toBe('2026-08-19');
    expect(after).toBe('2026-08-20');
    expect(civilDayNumber(after) - civilDayNumber(before)).toBe(1);
    expect(formatLocalDate(new Date(2026, 7, 20, 0, 0, 30))).toBe('2026-08-20');
  });
});

/* ---------- 2. daysSince and addDays against the oracle, through DST ---------- */

describe('daysSince and addDays agree with the civil calendar, day by day', () => {
  // Each window straddles the DST transitions of whichever hemisphere the
  // pinned zone lives in (NH spring + fall, SH spring + fall): if the
  // pinned zone jumps anywhere inside a window, a floor-based daysSince or
  // a UTC-based addDays breaks against the oracle on the exact day of the
  // jump. In a DST-less pinned zone (UTC, Kolkata, Kiritimati) the same
  // assertions still hold exactly — they are calendar truths, not zone
  // truths. Windows also cross month ends and a leap-less February.
  const WINDOWS: [string, string][] = [
    ['2026-02-20', '2026-04-20'], // NH spring forward (US Mar 8, EU Mar 29), SH fall back (Santiago/Lord Howe early April)
    ['2026-09-20', '2026-11-20'], // NH fall back (EU Oct 25, US Nov 1), SH spring forward (Lord Howe/Santiago Oct 4, Sep 6)
  ];

  test.each(WINDOWS)('every day from %s to %s counts exactly', (start, end) => {
    const [ey, em, ed] = end.split('-').map(Number);
    fakeDateOnly(new Date(ey, em - 1, ed, 12, 0, 0));

    const span = civilDayNumber(end) - civilDayNumber(start);
    expect(span).toBeGreaterThan(50); // the window really is wide

    const failures: string[] = [];
    for (let i = 0; i <= span; i++) {
      const day = addDays(start, i);
      // addDays against the oracle — a UTC-shifted or DST-confused addDays
      // lands on the wrong civil day here.
      if (civilDayNumber(day) !== civilDayNumber(start) + i) {
        failures.push(`addDays(${start}, ${i}) = ${day}, civil #${civilDayNumber(day)} ≠ ${civilDayNumber(start) + i}`);
      }
      // daysSince against the oracle — Math.floor instead of Math.round
      // fails on the first post-spring-forward day in any DST zone.
      const expected = civilDayNumber(end) - civilDayNumber(day);
      if (daysSince(day) !== expected) {
        failures.push(`daysSince(${day}) = ${daysSince(day)}, oracle says ${expected}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('daysSince clamps the future at zero rather than counting backwards', () => {
    fakeDateOnly(new Date(2026, 7, 19, 12, 0, 0));
    expect(daysSince(todayLocal())).toBe(0);
    expect(daysSince(addDays(todayLocal(), 3))).toBe(0);
  });
});

/* ---------- 3. a wear logged "yesterday" is yesterday, not today ---------- */

describe('a wear logged for yesterday, seconds after midnight', () => {
  test('renders as yesterday: one day since, never a plan, bench untouched', async () => {
    // 00:00:30 — the person logs the evening they just lived through.
    fakeDateOnly(new Date(2026, 7, 20, 0, 0, 30));

    await seed(DOC);
    await openWardrobe();

    const yesterday = addDays(todayLocal(), -1);
    expect(yesterday).toBe('2026-08-19');

    act(() => {
      ctx!.logWear(['i2'], undefined, yesterday);
    });

    const log = ctx!.wearLogs[ctx!.wearLogs.length - 1];
    // Recorded on the day it happened…
    expect(log.date).toBe('2026-08-19');
    // …which is one day ago, not zero (the "renders as today" bug)…
    expect(daysSince(log.date)).toBe(1);
    expect(log.date).not.toBe(todayLocal());
    // …and it is a WEAR, not a plan — yesterday already happened.
    expect(log.planned).toBeUndefined();
    expect(isFutureDate(log.date)).toBe(false);

    const item = ctx!.getItem('i2')!;
    expect(item.wearCount).toBe(6);
    expect(item.lastWorn).toBe('2026-08-19');
    // A backfilled wear cannot know what the laundry has done since —
    // the bench is about NOW and stays untouched.
    expect(item.laundryStatus).toBe('clean');
  });

  test('the same seconds-after-midnight moment logged with NO date lands on the new day', async () => {
    fakeDateOnly(new Date(2026, 7, 20, 0, 0, 30));

    await seed(DOC);
    await openWardrobe();

    act(() => {
      ctx!.logWear(['i1']);
    });
    const log = ctx!.wearLogs[ctx!.wearLogs.length - 1];
    // No date argument means NOW, and now is already the 20th — a UTC slice
    // (still the 19th at 00:00:30 anywhere east of Greenwich) would have
    // shifted the day here.
    expect(log.date).toBe('2026-08-20');
    expect(daysSince(log.date)).toBe(0);
  });
});

/* ---------- 4. the zone matrix — runs only where the env is real ---------- */

describe(`the zone matrix (skips when pinned: ${PIN_REASON})`, () => {
  describe.each(['Asia/Kolkata', 'America/New_York', 'Pacific/Kiritimati'])(
    'logging across midnight in %s',
    zone => {
      zoneTest('23:59:30 and 00:00:30 land on two different local days', async () => {
        setZone(zone);
        fakeDateOnly(new Date(2026, 7, 19, 23, 59, 30));

        await seed(DOC);
        await openWardrobe();

        act(() => {
          ctx!.logWear(['i1']);
        });
        expect(ctx!.wearLogs[ctx!.wearLogs.length - 1].date).toBe('2026-08-19');

        jest.setSystemTime(new Date(2026, 7, 20, 0, 0, 30));
        act(() => {
          ctx!.logWear(['i1']);
        });
        expect(ctx!.wearLogs[ctx!.wearLogs.length - 1].date).toBe('2026-08-20');
      });
    },
  );

  describe('daysSince across named DST boundaries', () => {
    zoneTest('New York spring-forward: the 23-hour day still counts as one day', () => {
      setZone('America/New_York');
      // US DST began Sunday 2026-03-08. Mar 6 → Mar 12 is 6 calendar days
      // but only 5d23h of real time — Math.floor would answer 5.
      fakeDateOnly(new Date(2026, 2, 12, 12, 0, 0));
      expect(daysSince('2026-03-06')).toBe(6);
    });

    zoneTest('New York fall-back: the 25-hour day still counts as one day', () => {
      setZone('America/New_York');
      // US DST ends Sunday 2026-11-01. Oct 30 → Nov 5: 6 calendar days, 6d1h real.
      fakeDateOnly(new Date(2026, 10, 5, 12, 0, 0));
      expect(daysSince('2026-10-30')).toBe(6);
    });

    zoneTest('Lord Howe: the world’s only 30-minute DST shift rounds true as well', () => {
      setZone('Australia/Lord_Howe');
      // +10:30 → +11:00 on Sunday 2026-10-04. Sep 30 → Oct 10: 10 calendar
      // days, 9d23.5h real — the half-hour case no whole-hour zone can catch.
      fakeDateOnly(new Date(2026, 9, 10, 12, 0, 0));
      expect(daysSince('2026-09-30')).toBe(10);
    });

    zoneTest('Kolkata: a +05:30 zone with no DST counts plain calendar days', () => {
      setZone('Asia/Kolkata');
      fakeDateOnly(new Date(2026, 7, 19, 12, 0, 0));
      expect(daysSince('2026-08-01')).toBe(18);
      expect(daysSince('2026-08-19')).toBe(0);
    });
  });
});
