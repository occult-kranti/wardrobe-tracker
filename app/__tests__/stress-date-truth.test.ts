/**
 * The date-truth replay — closing the loop docs/33 opened.
 *
 * scripts/fixtures/date-truth.json holds 246 zone-invariant cases, proved
 * identical across five zones in Node by scripts/test-dates.mjs. Its own doc
 * field says: "Wave 3 replays this file through jest-expo so Hermes has to
 * agree too." This file is that replay. Every case is asserted individually
 * (the test name IS the case id), with === and zero tolerance, exactly per
 * the three case shapes the fixture's doc field defines.
 *
 * WHAT THIS REPLAY PROVES, HONESTLY. jest-expo executes tests in Node (V8)
 * after the same Babel pipeline (babel-preset-expo) that feeds the Hermes
 * bundle. So this suite proves the TRANSPILED code — the exact JS Hermes
 * will be handed — computes the truth, and it proves the fixture's replay
 * contract is executable outside the generator. It does NOT execute the
 * Hermes VM itself: Hermes's own ICU tables and Date internals are only
 * exercised on a device, which stays an alpha-QR task. The zone sweep below
 * re-replays all 246 cases under each of the five zones the fixture was
 * generated against — but ONLY where the runtime can genuinely re-point
 * process.env.TZ. Plain Node can; THIS jest sandbox CANNOT (measured: the
 * sandbox copies process.env, assignments read back but ICU never moves),
 * so under jest the sweep skips with that exact reason rather than sweeping
 * the home zone five times and calling it proof. The lever jest does offer
 * is per-PROCESS pinning — TZ set in the shell before jest spawns is
 * honoured — and the 246 individual replays below are zone-invariant by the
 * fixture's own contract, so the whole file must stay green under any
 * pinned zone; the squad report records the zones it was actually run in.
 * A sentinel inside the sweep proves any zone it claims actually applied.
 *
 * The fixture here is a byte-for-byte COPY of scripts/fixtures/date-truth.json
 * (which is generated, and must never be edited by hand — its doc says a diff
 * is a behaviour change). The first test below enforces the copy has not
 * drifted from the source of truth.
 */
import { afterAll, describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import * as costMod from '@almari/shared/cost';
import * as datesMod from '@almari/shared/dates';

interface WallClock {
  year: number;
  month: number; // 1-BASED in the fixture, 0-based in the Date constructor
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface TruthCase {
  id: string;
  module: 'dates' | 'cost';
  fn: string;
  args: (string | number | null)[] | null;
  localWallClock?: WallClock;
  expect: string | number;
}

interface TruthFile {
  $schema: string;
  provedIdenticalIn: string[];
  doc: string;
  cases: TruthCase[];
}

const COPY_PATH = join(__dirname, 'fixtures', 'date-truth.json');
const SOURCE_PATH = join(__dirname, '..', '..', 'scripts', 'fixtures', 'date-truth.json');

const fixture = JSON.parse(readFileSync(COPY_PATH, 'utf8')) as TruthFile;

const modules: Record<TruthCase['module'], Record<string, unknown>> = {
  dates: datesMod as unknown as Record<string, unknown>,
  cost: costMod as unknown as Record<string, unknown>,
};

/** Replays one case exactly per the fixture's doc field — no more, no less. */
function replay(c: TruthCase): string | number {
  if (c.fn.startsWith('@')) {
    // "not an export" — the doc field defines the arithmetic verbatim.
    if (c.fn !== '@dayDiffLikeDaysSince') {
      throw new Error(
        `case ${c.id}: unknown derived shape ${c.fn} — this replay knows only @dayDiffLikeDaysSince; ` +
          'a new derived shape in the fixture needs a new clause here, not a silent skip',
      );
    }
    const [from, to] = c.args as [string, string];
    return Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
    );
  }
  const fn = modules[c.module][c.fn];
  if (typeof fn !== 'function') {
    throw new Error(`case ${c.id}: ${c.module}.${c.fn} is not an exported function of @almari/shared`);
  }
  if (c.args === null) {
    const w = c.localWallClock;
    if (!w) throw new Error(`case ${c.id}: args is null but no localWallClock to build from`);
    const d = new Date(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return (fn as (d: Date) => string | number)(d);
  }
  return (fn as (...a: unknown[]) => string | number)(...c.args);
}

/* ---------- the fixture itself is under guard ---------- */

describe('the fixture copy is honest', () => {
  test('the copy in __tests__/fixtures is byte-for-byte the generated source', () => {
    // The source is generated (scripts/test-dates.mjs) and never hand-edited;
    // this copy exists so the app suite owns its own fixtures directory. If
    // the source is ever regenerated, this fails until the copy is re-cut —
    // a stale copy replaying yesterday's truth would be a vacuous pass.
    const copy = readFileSync(COPY_PATH);
    const source = readFileSync(SOURCE_PATH);
    expect(copy.equals(source)).toBe(true);
  });

  test('all 246 cases are aboard and every shape is represented', () => {
    expect(fixture.cases).toHaveLength(246);
    // If a regeneration ever drops a shape, the replay below would silently
    // narrow — this names the loss.
    expect(fixture.cases.some(c => Array.isArray(c.args) && !c.fn.startsWith('@'))).toBe(true);
    expect(fixture.cases.some(c => c.args === null)).toBe(true);
    expect(fixture.cases.some(c => c.fn.startsWith('@'))).toBe(true);
    // Both modules under test are actually exercised.
    expect(fixture.cases.some(c => c.module === 'dates')).toBe(true);
    expect(fixture.cases.some(c => c.module === 'cost')).toBe(true);
  });
});

/* ---------- every case, individually, in the runner's own zone ---------- */

describe('every date-truth case replays through jest-expo (zero tolerance)', () => {
  for (const c of fixture.cases) {
    test(c.id, () => {
      // toBe is === — the fixture's comparison, exactly. No coercion, no
      // tolerance; a string "2026-04-04" is not a Date and 6 is not "6".
      expect(replay(c)).toBe(c.expect);
    });
  }
});

/* ---------- the zone sweep: the five zones the truth was proved in ---------- */

/**
 * [Jan 15, Jul 15] getTimezoneOffset at local noon, 2026 — both hemispheres'
 * DST states, so a zone that half-applied is caught too. Values pinned from
 * the IANA database (verified in this repo's Node before writing them down).
 * NOTE: resolvedOptions().timeZone is NOT usable as the sentinel — ICU
 * canonicalizes some ids (Asia/Kolkata reports as Asia/Calcutta).
 */
const ZONE_PROBES: Record<string, [number, number]> = {
  UTC: [0, 0],
  'Pacific/Kiritimati': [-840, -840],
  'Pacific/Niue': [660, 660],
  'America/Santiago': [180, 240],
  'Australia/Lord_Howe': [-660, -630],
};

/**
 * True only when assigning process.env.TZ actually moves the clock — probed
 * with two zones of distinct offsets so no home zone can mask both. Measured
 * FALSE in this repo's jest-expo: the sandbox copies process.env, so the
 * assignment reads back but ICU never sees it.
 */
function detectTzVariability(): boolean {
  const before = process.env.TZ;
  const offsets = () => [
    new Date(2026, 0, 15, 12).getTimezoneOffset(),
    new Date(2026, 6, 15, 12).getTimezoneOffset(),
  ];
  const home = offsets();
  let moved = false;
  for (const z of ['Pacific/Kiritimati', 'Asia/Kolkata']) {
    process.env.TZ = z;
    const p = offsets();
    if (p[0] !== home[0] || p[1] !== home[1]) {
      moved = true;
      break;
    }
  }
  if (before === undefined) delete process.env.TZ;
  else process.env.TZ = before;
  return moved;
}

const TZ_CAN_VARY = detectTzVariability();
const zoneTest = TZ_CAN_VARY ? test : test.skip;

describe(
  'the zone sweep — all 246 cases, in each zone the fixture was proved in' +
    (TZ_CAN_VARY
      ? ''
      : ' (SKIPPED: this jest sandboxes process.env — TZ assignments read back but ICU never moves; pin a zone per process via the shell instead)'),
  () => {
    const originalTZ = process.env.TZ;

    afterAll(() => {
      // jest workers reuse processes across suites — a leaked TZ would quietly
      // re-zone every suite that runs after this one.
      if (originalTZ === undefined) delete process.env.TZ;
      else process.env.TZ = originalTZ;
    });

    for (const zone of fixture.provedIdenticalIn) {
      zoneTest(`all cases agree under TZ=${zone}`, () => {
        process.env.TZ = zone;

        // The sentinel: prove the zone actually took effect. An environment
        // that ignores runtime TZ changes (a phone's Hermes would; some CI
        // nodes might) must fail HERE, loudly, not pass a sweep that swept
        // one zone five times.
        const probe = ZONE_PROBES[zone];
        if (!probe) {
          throw new Error(
            `zone ${zone} has no offset probe — the fixture gained a proving zone; pin its offsets here first`,
          );
        }
        expect([
          new Date(2026, 0, 15, 12).getTimezoneOffset(),
          new Date(2026, 6, 15, 12).getTimezoneOffset(),
        ]).toEqual(probe);

        // One test per zone, failure output naming every disagreeing case id.
        const failures: string[] = [];
        for (const c of fixture.cases) {
          const got = replay(c);
          if (got !== c.expect) failures.push(`${c.id}: expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`);
        }
        expect(failures).toEqual([]);
      });
    }
  },
);
