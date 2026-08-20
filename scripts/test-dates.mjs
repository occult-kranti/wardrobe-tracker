#!/usr/bin/env node
/**
 * The timezone matrix: every date helper and every money format, proved
 * identical in five zones.
 *
 * src/lib/dates.ts builds `new Date(dateStr + 'T00:00:00')` on purpose — its
 * header explains that toISOString() shifts the day for anyone west of UTC in
 * the evening. That decision is correct and, until this file, completely
 * untested; and it is about to run on Hermes on a phone whose zone nobody in
 * this repo lives in. src/lib/cost.ts formats money through
 * toLocaleString('en-US', {...}), which is one more thing that can quietly
 * differ on another ICU build.
 *
 * The zones are chosen for what they break, not for coverage:
 *   Pacific/Kiritimati    UTC+14 — the furthest ahead anyone lives. Local
 *                         midnight is yesterday 10:00 UTC, so any
 *                         toISOString().slice(0, 10) names the wrong day for
 *                         the first fourteen hours of every day.
 *   Pacific/Niue          UTC-11 — the furthest behind anyone lives.
 *   America/Santiago      southern-hemisphere DST, and the vicious part: DST
 *                         begins at 24:00, so 2026-09-06T00:00:00 IS NOT A
 *                         REAL LOCAL TIME. Midnight does not exist that day.
 *   Australia/Lord_Howe   a THIRTY-MINUTE DST shift. Every naive "an hour
 *                         more or less, round it off" is wrong here.
 *   UTC                   the control. If a case differs from UTC, the zone
 *                         is the cause and the case names which zone.
 *
 * HOW THE ZONE IS SET, and why. The code under test calls
 * Date.prototype.getFullYear/getMonth/getDate/setDate, which read the ambient
 * process timezone. There is no timeZone option to pass them, so an
 * Intl-with-explicit-timeZone harness would exercise a different code path
 * than the app runs — it would prove nothing at all about setDate. So each
 * zone gets a fresh child process. TZ is set two ways, deliberately: in the
 * child's `env` AND assigned to process.env.TZ as the child's first statement.
 * The second is not belt-and-braces theatre — on this repo's Windows/MSYS
 * shell the TZ variable is swallowed before it reaches a child, and assigning
 * process.env.TZ inside Node is what actually invalidates V8's cached zone.
 * The child asserts the zone it got is the zone it asked for before running a
 * single case, so a swallowed TZ is a loud failure and never a silent pass.
 *
 * THE ORACLE. Expected values are never a second copy of the implementation.
 * refAddDays does civil-calendar arithmetic through Date.UTC and getUTC*,
 * which has no local timezone in it anywhere. dates.ts is asserted to agree
 * with that independent oracle in every zone.
 *
 * THE FIXTURE. Every zone-invariant case is written to
 * scripts/fixtures/date-truth.json for Wave 3 to replay through jest-expo on
 * Hermes. Its replay contract is documented in the `doc` field of the file
 * itself, so a consumer never has to read this script.
 *
 * Usage:
 *   node scripts/test-dates.mjs                  run the matrix
 *   node scripts/test-dates.mjs --zone <IANA>    one zone (used internally)
 *   node scripts/test-dates.mjs --red-proof      prove the matrix bites
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

const ZONES = [
  'UTC',
  'Pacific/Kiritimati',
  'Pacific/Niue',
  'America/Santiago',
  'Australia/Lord_Howe',
];

/* ---------- the case table ----------
   Boundary dates first. Each is a day some zone in the matrix does something
   unusual on, plus the calendar's own edges. */
const BOUNDARY_DATES = [
  ['2026-04-04', 'the day before southern DST ends in Santiago and on Lord Howe'],
  ['2026-04-05', 'Lord Howe gives back 30 minutes; Santiago gives back an hour'],
  ['2026-04-06', 'the day after both'],
  ['2026-09-05', 'the day before Santiago springs forward'],
  ['2026-09-06', 'Santiago has no midnight on this date — 24:00 becomes 01:00'],
  ['2026-09-07', 'the day after'],
  ['2026-10-03', 'the day before Lord Howe takes its 30 minutes'],
  ['2026-10-04', 'Lord Howe +30 minutes: the shift naive hour arithmetic loses'],
  ['2026-10-05', 'the day after'],
  ['2026-03-08', 'US spring forward, for the zones this fixture will meet later'],
  ['2026-11-01', 'US fall back'],
  ['2026-03-29', 'EU spring forward'],
  ['2026-10-25', 'EU fall back'],
  ['2026-01-01', 'a year boundary from below'],
  ['2026-12-31', 'a year boundary from above'],
  ['2026-02-28', 'the end of a February with no 29th'],
  ['2024-02-29', 'a leap day, which +365 must not land on again'],
];

/** How far to walk from each boundary date. 365 crosses every DST a year has. */
const OFFSETS = [1, -1, 7, -7, 30, -30, 365, -365];

/** Local wall-clock instants, as [year, month (1-based), day, h, m, s]. */
const WALL_CLOCK_CASES = [
  [[2026, 10, 3, 23, 59, 59], 'one second before a Lord Howe DST midnight'],
  [[2026, 10, 4, 0, 0, 1], 'one second after it — a different date, and it counts'],
  [[2026, 9, 5, 23, 59, 59], 'one second before the midnight Santiago does not have'],
  [[2026, 9, 6, 0, 0, 1], 'inside the hour Santiago skips; still the 6th'],
  [[2026, 12, 31, 23, 59, 59], 'the last second of the year'],
  [[2027, 1, 1, 0, 0, 1], 'the first second of the next one'],
  [[2026, 8, 19, 12, 0, 0], 'a plain midday, as a control'],
];

// INR with Indian digit grouping since the owner decision of 2026-08-19 —
// lakhs and crores group 2-2-3, so 1234567 is ₹12,34,567, not ₹1,234,567.
const MONEY_CASES = [
  ['formatMoney', [0], '₹0'],
  ['formatMoney', [45], '₹45'],
  ['formatMoney', [1340], '₹1,340'],
  ['formatMoney', [1234567], '₹12,34,567'],
  ['formatMoney', [45.5], '₹46'],
  ['formatMoney', [45.4], '₹45'],
  ['formatMoney', [999999.5], '₹10,00,000'],
  ['formatPrice', [0], '₹0'],
  ['formatPrice', [45], '₹45'],
  ['formatPrice', [45.5], '₹45.50'],
  ['formatPrice', [3.125], '₹3.13'],
  ['formatPrice', [1340.5], '₹1,340.50'],
  ['formatPrice', [1234567.891], '₹12,34,567.89'],
  ['formatPerWear', [null], '—'],
  ['formatPerWear', [0], '₹0.00'],
  ['formatPerWear', [3.121], '₹3.12'],
  ['formatPerWear', [1234.5], '₹1,234.50'],
  ['formatPerWear', [0.005], '₹0.01'],
];

/* ---------- the oracle ----------
   Civil-calendar arithmetic with no local timezone anywhere in it. This is
   what dates.ts must agree with, and it is emphatically not how dates.ts is
   written — which is the only reason comparing against it proves anything. */
function refAddDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

/** The oracle's day difference, in whole civil days. */
function refDayDiff(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/* ---------- the child: one zone, the whole table ---------- */
async function runOneZone(zone, bundleDir) {
  // The first statement that matters. Assigning process.env.TZ is what clears
  // V8's cached zone; the env we were spawned with may not have survived the
  // shell. Everything below this line reads the zone we asked for.
  process.env.TZ = zone;
  const actualZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const dates = await import(pathToFileURL(join(bundleDir, 'dates.mjs')).href);
  const cost = await import(pathToFileURL(join(bundleDir, 'cost.mjs')).href);
  const { formatLocalDate, todayLocal, isFutureDate, addDays, daysSince } = dates;

  let fail = 0;
  const check = (label, ok, detail = '') => {
    console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
    if (!ok) fail++;
  };
  // What the parent cross-compares, and what lands in the fixture.
  const results = {};
  const record = (id, value) => { results[id] = value; };

  check(`the process is actually in ${zone}`, actualZone === zone, `resolved ${actualZone}`);

  /* --- round-trip: parse a YYYY-MM-DD and format it straight back --- */
  for (const [d, why] of BOUNDARY_DATES) {
    const rt = addDays(d, 0);
    record(`addDays/${d}/0`, rt);
    check(`${d} survives a parse and a format (${why})`, rt === d, rt);
  }

  /* --- walking the calendar, against the UTC-civil oracle --- */
  for (const [d] of BOUNDARY_DATES) {
    for (const n of OFFSETS) {
      const got = addDays(d, n);
      const want = refAddDays(d, n);
      record(`addDays/${d}/${n}`, got);
      check(`addDays(${d}, ${n})`, got === want, `got ${got}, oracle says ${want}`);
    }
  }

  /* --- there and back: no DST boundary may cost or gain a day --- */
  for (const [d, why] of BOUNDARY_DATES) {
    for (const n of OFFSETS) {
      const back = addDays(addDays(d, n), -n);
      check(`${d} +${n} then -${n} is still ${d} (${why})`, back === d, back);
    }
  }

  /* --- daysSince's arithmetic across a DST boundary ---
     daysSince() reads the wall clock, so an arbitrary pair of dates cannot be
     handed to it. Its formula is replicated here, and the replica is pinned to
     the source in the parent, so it cannot drift away from the original in
     silence. This is the check a 30-minute Lord Howe shift is aimed at: a span
     of n days must measure n days even when it contains half an hour the
     calendar deleted. */
  const dayDiffLikeDaysSince = (from, to) => {
    const then = new Date(`${from}T00:00:00`);
    const now = new Date(`${to}T00:00:00`);
    return Math.round((now.getTime() - then.getTime()) / 86400000);
  };
  for (const [d, why] of BOUNDARY_DATES) {
    for (const n of OFFSETS.filter(o => o > 0)) {
      const from = refAddDays(d, -n);
      const got = dayDiffLikeDaysSince(from, d);
      record(`dayDiff/${from}/${d}`, got);
      check(
        `${n} days before ${d} measures ${n} days (${why})`,
        got === n && got === refDayDiff(from, d),
        `got ${got}`
      );
    }
  }

  /* --- midnight-crossing: 23:59:59 and 00:00:01 are two dates, both real --- */
  for (const [[y, mo, d, h, mi, s], why] of WALL_CLOCK_CASES) {
    const stamp = new Date(y, mo - 1, d, h, mi, s);
    const got = formatLocalDate(stamp);
    const want = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const clock = `${h}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    record(`formatLocalDate/${y}-${mo}-${d}T${h}:${mi}:${s}`, got);
    check(`a wear logged ${want} at ${clock} is dated ${want} (${why})`, got === want, got);
  }
  // The pair that matters most, stated as one sentence: two seconds apart, two
  // dates, and the later is exactly one day after the earlier.
  const MIDNIGHT_PAIRS = [
    [[2026, 10, 3, 23, 59, 59], [2026, 10, 4, 0, 0, 1]],
    [[2026, 12, 31, 23, 59, 59], [2027, 1, 1, 0, 0, 1]],
  ];
  for (const [a, b] of MIDNIGHT_PAIRS) {
    const da = formatLocalDate(new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]));
    const db = formatLocalDate(new Date(b[0], b[1] - 1, b[2], b[3], b[4], b[5]));
    check(
      `23:59:59 and 00:00:01 two seconds later are consecutive dates (${da} then ${db})`,
      da !== db && addDays(da, 1) === db,
      `${da} -> ${db}`
    );
  }

  /* --- money, byte for byte --- */
  for (const [fn, args, want] of MONEY_CASES) {
    const got = cost[fn](...args);
    record(`cost/${fn}/${JSON.stringify(args)}`, got);
    const shown = args.map(a => JSON.stringify(a)).join(', ');
    check(`${fn}(${shown}) is ${JSON.stringify(want)}`, got === want, JSON.stringify(got));
  }

  /* --- the wall clock, read once ---
     todayLocal() legitimately differs between Kiritimati and Niue — they are
     25 hours apart — so these results are NOT cross-compared between zones.
     What is asserted is that each zone is self-consistent. */
  const today = todayLocal();
  check(`today (${today}) is not in the future`, isFutureDate(today) === false);
  check('tomorrow is in the future', isFutureDate(addDays(today, 1)) === true);
  check('yesterday is not', isFutureDate(addDays(today, -1)) === false);
  check('daysSince(today) is 0', daysSince(today) === 0, daysSince(today));
  check('daysSince(yesterday) is 1', daysSince(addDays(today, -1)) === 1, daysSince(addDays(today, -1)));
  check('daysSince(a year ago) is 365', daysSince(addDays(today, -365)) === 365, daysSince(addDays(today, -365)));
  check(
    'daysSince a future date is clamped to 0, never negative',
    daysSince(addDays(today, 7)) === 0,
    daysSince(addDays(today, 7))
  );
  // If midnight passed while the clock checks ran, say so rather than fail — a
  // rerun a second later would disagree, and that is the flake, not the bug.
  const stillToday = todayLocal();
  if (stillToday !== today) {
    console.log('NOTE - midnight crossed mid-run in', zone, `(${today} -> ${stillToday}); rerun to confirm the clock checks`);
  }

  console.log(`##RESULT##${JSON.stringify({ zone, fail, results })}`);
  process.exit(fail ? 1 : 0);
}

/* ---------- the parent: bundle once, spawn each zone, compare ---------- */
async function runMatrix() {
  const bundleDir = mkdtempSync(join(tmpdir(), 'dates-'));
  await bundleInto(bundleDir);

  let fail = 0;
  const check = (label, ok, detail = '') => {
    console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
    if (!ok) fail++;
  };

  // daysSince's arithmetic is replicated inside the child. Pin the replica to
  // the source: if someone rewrites daysSince, this goes red before the
  // replica can start testing a function that no longer exists as written.
  const src = readFileSync(new URL('../packages/shared/dates.ts', import.meta.url), 'utf8');
  const daysSinceBody = src.slice(src.indexOf('export function daysSince'));
  check(
    'the daysSince replica still matches the real daysSince (millisecond division, rounded)',
    daysSinceBody.includes('86400000') && daysSinceBody.includes('Math.round') && daysSinceBody.includes('T00:00:00'),
    'packages/shared/dates.ts changed — update the replica in this file, do not delete the check'
  );
  const formatBody = src.slice(src.indexOf('export function formatLocalDate'), src.indexOf('export function todayLocal'));
  check(
    'formatLocalDate still reads local calendar fields, not toISOString',
    /getFullYear/.test(formatBody) && /getMonth/.test(formatBody) && /getDate/.test(formatBody) && !/toISOString/.test(formatBody),
    'a toISOString inside formatLocalDate shifts the logged day for half the planet'
  );
  const addBody = src.slice(src.indexOf('export function addDays'), src.indexOf('export function daysSince'));
  check(
    'addDays still walks the local calendar with setDate, not by adding milliseconds',
    /setDate/.test(addBody) && !/86400000/.test(addBody),
    'adding 86_400_000ms loses an hour every spring and gains one every autumn'
  );

  const perZone = [];
  for (const zone of ZONES) {
    console.log(`\n--- ${zone} ---`);
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--zone', zone, '--bundle', bundleDir], {
      env: { ...process.env, TZ: zone },
      encoding: 'utf8',
    });
    const out = run.stdout ?? '';
    // Echo only failures and notes; the full table times five zones is a
    // thousand lines of PASS that nobody reads and everybody scrolls past.
    for (const line of out.split('\n')) {
      if (line.startsWith('FAIL') || line.startsWith('NOTE')) console.log(line);
    }
    if (run.stderr) process.stderr.write(run.stderr);
    const marker = out.split('\n').find(l => l.startsWith('##RESULT##'));
    if (!marker) {
      check(`${zone} completed`, false, 'the child produced no result line');
      continue;
    }
    const parsed = JSON.parse(marker.slice('##RESULT##'.length));
    const count = Object.keys(parsed.results).length;
    check(`${zone}: every case passed`, parsed.fail === 0, `${parsed.fail} failed, ${count} recorded`);
    perZone.push(parsed);
  }

  /* --- the cross-zone identity: the point of the whole exercise --- */
  const control = perZone.find(z => z.zone === 'UTC');
  if (!control) {
    check('the UTC control ran', false, 'no control means nothing to compare against');
  } else {
    for (const z of perZone) {
      if (z.zone === 'UTC') continue;
      const differing = Object.keys(control.results).filter(k => control.results[k] !== z.results[k]);
      const first = differing[0];
      check(
        `${z.zone} agrees with UTC on every zone-invariant case`,
        differing.length === 0,
        differing.length
          ? `${differing.length} differ, first ${first}: UTC=${JSON.stringify(control.results[first])} ${z.zone}=${JSON.stringify(z.results[first])}`
          : `${Object.keys(control.results).length} cases`
      );
    }
  }

  /* --- the fixture Wave 3 replays on Hermes --- */
  if (control && fail === 0) {
    const fixture = buildFixture(control.results);
    const path = fileURLToPath(new URL('../scripts/fixtures/date-truth.json', import.meta.url));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`\nFIXTURE - ${fixture.cases.length} zone-invariant cases written to ${path}`);
    console.log('FIXTURE - the replay contract is the "doc" field inside that file');
  }

  console.log(fail === 0 ? '\nALL DATE CHECKS PASSED' : `\n${fail} DATE CHECKS FAILED`);
  process.exit(fail ? 1 : 0);
}

async function bundleInto(dir) {
  await build({ alias: sharedAliases(),
    entryPoints: {
      dates: fileURLToPath(new URL('../packages/shared/dates.ts', import.meta.url)),
      cost: fileURLToPath(new URL('../packages/shared/cost.ts', import.meta.url)),
    },
    bundle: true,
    format: 'esm',
    outdir: dir,
    outExtension: { '.js': '.mjs' },
    logLevel: 'error',
  });
}

/**
 * The machine-consumable fixture.
 *
 * Every entry is a pure call whose answer must not depend on the device's
 * timezone. A consumer imports src/lib/dates.ts and src/lib/cost.ts, calls
 * module[fn](...args), and compares with === against `expect`. Nothing in here
 * reads the wall clock, so a replay is deterministic forever: the file can be
 * committed and diffed, and a diff means a behaviour change.
 */
function buildFixture(results) {
  const cases = [];
  for (const [id, expect] of Object.entries(results)) {
    const [kind, ...rest] = id.split('/');
    if (kind === 'addDays') {
      cases.push({ id, module: 'dates', fn: 'addDays', args: [rest[0], Number(rest[1])], expect });
    } else if (kind === 'dayDiff') {
      // Not an exported function — daysSince reads the clock. Replayed as the
      // arithmetic itself, so Hermes has to prove its Date subtraction agrees.
      cases.push({ id, module: 'dates', fn: '@dayDiffLikeDaysSince', args: [rest[0], rest[1]], expect });
    } else if (kind === 'formatLocalDate') {
      const [date, time] = rest[0].split('T');
      const [y, mo, d] = date.split('-').map(Number);
      const [h, mi, s] = time.split(':').map(Number);
      cases.push({
        id,
        module: 'dates',
        fn: 'formatLocalDate',
        args: null,
        localWallClock: { year: y, month: mo, day: d, hour: h, minute: mi, second: s },
        expect,
      });
    } else if (kind === 'cost') {
      cases.push({ id, module: 'cost', fn: rest[0], args: JSON.parse(rest.slice(1).join('/')), expect });
    }
  }
  return {
    $schema: 'almari-date-truth/1',
    generatedBy: 'scripts/test-dates.mjs',
    // No timestamp and no runtime version in here on purpose. This file is
    // meant to be committed and diffed, and "a diff means a behaviour change"
    // is only true if regenerating on a different day or a different Node
    // produces a byte-identical file.
    provedIdenticalIn: ZONES,
    doc: [
      'Every case here is timezone-invariant: the same call must return the same value in',
      'every zone on earth. Proved in Node under the zones listed in provedIdenticalIn;',
      'Wave 3 replays this file through jest-expo so Hermes has to agree too.',
      '',
      'A case is one of three shapes, told apart by fn and args:',
      '  args is an array  -> call module[fn](...args), compare === expect.',
      '  args is null      -> build new Date(localWallClock.year, localWallClock.month - 1,',
      '                       localWallClock.day, .hour, .minute, .second)  (month is',
      '                       1-BASED in this file and 0-based in the constructor), then',
      '                       call module[fn](thatDate) and compare === expect.',
      '  fn starts with @  -> not an export. "@dayDiffLikeDaysSince" is daysSince\'s own',
      '                       arithmetic with an injectable now:',
      '                       Math.round((new Date(args[1] + "T00:00:00").getTime()',
      '                                 - new Date(args[0] + "T00:00:00").getTime()) / 86400000)',
      '',
      'module is "dates" (src/lib/dates.ts) or "cost" (src/lib/cost.ts).',
      'expect is compared with === and is always a string or a number. No tolerance.',
      'Regenerate with: node scripts/test-dates.mjs. A diff in this file is a behaviour',
      'change and needs a sentence in the commit, not a quiet regeneration.',
    ].join('\n'),
    cases,
  };
}

/* ---------- the red-proof ----------
   A matrix that has never caught anything is decoration. This mode runs the
   same table against deliberately broken modules and passes only if the table
   catches each of them. It stays in the file so the next person can rerun the
   proof instead of trusting a comment.

   `minZones` is how many of the five must notice. UTC is allowed to agree with
   a UTC-shaped bug — it has no offset to lose, which is precisely why a suite
   run only in UTC would have shipped these. */
const SABOTAGE = [
  {
    name: 'the toISOString implementation dates.ts warns about in its own header',
    minZones: 4,
    files: {
      'dates.mjs': [
        "export function formatLocalDate(d) { return d.toISOString().slice(0, 10); }",
        "export function todayLocal() { return formatLocalDate(new Date()); }",
        "export function isFutureDate(s) { return s > todayLocal(); }",
        "export function addDays(s, n) { const d = new Date(s + 'T00:00:00'); return formatLocalDate(new Date(d.getTime() + n * 86400000)); }",
        "export function daysSince(s) { const t = new Date(s + 'T00:00:00'); const n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(0, Math.round((n.getTime() - t.getTime()) / 86400000)); }",
        '',
      ].join('\n'),
    },
  },
  {
    // formatLocalDate is left correct here, so only the DST checks can catch
    // this one. It is the classic "a day is 86,400,000 milliseconds" bug, and
    // it is wrong exactly twice a year in exactly the zones that have a DST.
    name: 'addDays by adding 86,400,000 milliseconds instead of walking the calendar',
    minZones: 2,
    files: {
      'dates.mjs': [
        "export function formatLocalDate(d) { const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return d.getFullYear() + '-' + m + '-' + day; }",
        "export function todayLocal() { return formatLocalDate(new Date()); }",
        "export function isFutureDate(s) { return s > todayLocal(); }",
        "export function addDays(s, n) { const d = new Date(s + 'T00:00:00'); return formatLocalDate(new Date(d.getTime() + n * 86400000)); }",
        "export function daysSince(s) { const t = new Date(s + 'T00:00:00'); const n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(0, Math.round((n.getTime() - t.getTime()) / 86400000)); }",
        '',
      ].join('\n'),
    },
  },
  {
    // Proves the money rows are load-bearing and not decoration: this is the
    // off-contract toFixed(0) that cost.ts's own comment says was removed.
    name: 'money formatted with toFixed, losing the thousands separators',
    minZones: 5,
    files: {
      'cost.mjs': [
        "export function formatMoney(v) { return '$' + v.toFixed(0); }",
        "export function formatPrice(v) { return '$' + v.toFixed(2); }",
        "export function formatPerWear(v, o = {}) { return v === null ? (o.dash ?? '-') : '$' + v.toFixed(2); }",
        '',
      ].join('\n'),
    },
  },
];

async function runRedProof() {
  let bad = 0;
  for (const scenario of SABOTAGE) {
    const dir = mkdtempSync(join(tmpdir(), 'dates-red-'));
    await bundleInto(dir);
    for (const [file, source] of Object.entries(scenario.files)) writeFileSync(join(dir, file), source);

    console.log(`\n=== sabotage: ${scenario.name} ===`);
    let caught = 0;
    for (const zone of ZONES) {
      const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--zone', zone, '--bundle', dir], {
        env: { ...process.env, TZ: zone },
        encoding: 'utf8',
      });
      const fails = (run.stdout ?? '').split('\n').filter(l => l.startsWith('FAIL'));
      console.log(`--- ${zone}: ${fails.length} FAIL line(s)`);
      for (const f of fails.slice(0, 3)) console.log('   ', f);
      if (fails.length > 0) caught++;
    }
    const ok = caught >= scenario.minZones;
    console.log(ok
      ? `RED-PROOF OK - ${caught}/${ZONES.length} zones caught it (needed ${scenario.minZones})`
      : `RED-PROOF FAILED - only ${caught}/${ZONES.length} zones noticed (needed ${scenario.minZones}); the matrix is not biting`);
    if (!ok) bad++;
  }
  console.log(bad === 0 ? '\nALL RED-PROOFS PASSED' : `\n${bad} RED-PROOF(S) FAILED`);
  process.exit(bad ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--red-proof')) {
  await runRedProof();
} else if (argv.includes('--zone')) {
  const zone = argv[argv.indexOf('--zone') + 1];
  let bundleAt = argv.includes('--bundle') ? argv[argv.indexOf('--bundle') + 1] : null;
  if (!bundleAt) {
    bundleAt = mkdtempSync(join(tmpdir(), 'dates-one-'));
    await bundleInto(bundleAt);
  }
  await runOneZone(zone, bundleAt);
} else {
  await runMatrix();
}
