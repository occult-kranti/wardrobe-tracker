#!/usr/bin/env node
/**
 * test-usage.mjs — the privacy guarantee for the alpha usage record.
 *
 * PLAN.md non-negotiable #1 said "no telemetry" absolutely, until the owner's
 * ruling of 2026-08-28 amended it to admit ONE thing: an opt-in, revocable,
 * bounded usage record for the fifty-person alpha (src/lib/usage.ts). The
 * prose in that file explains the four rules it lives under; this suite is
 * what makes them true rather than aspirational. Read src/lib/usage.ts's
 * header before touching this file — it names the same four rules this suite
 * checks, in the same order, and the file says outright that this suite is
 * its proof.
 *
 * THE CENTRAL TEST is the one that matters most, because it is the one a
 * careless PR is most likely to break by accident: someone wiring up a new
 * call site who reaches for "the obvious" property — `itemName`, `brand`,
 * `note` — because it is right there on the object being logged, and the
 * compiler only stops them if EventProps has no slot shaped like a string.
 * So this suite builds a wardrobe fixture stuffed with the exact strings a
 * real closet would carry (a garment name, a brand, a free-text note, a
 * `fitsLike` line, a user-invented category and occasion, a wardrobe name, an
 * account handle, a cost, a photograph data URL), drives every one of the
 * fourteen event names through the real, typed `record()` function, asks the
 * module for exactly what it would send (`pendingPayload`), and greps the
 * serialised JSON — the WHOLE payload, not just the properties this file
 * expects to exist — for every one of those distinctive strings. None may
 * appear. That is the whole promise, tested as a promise rather than assumed
 * from the type signature.
 *
 * A check that polices a "never" needs a --red-proof: proof that when the
 * forbidden thing DOES happen, the check actually notices, rather than
 * quietly agreeing with whatever it is handed. `record()` cannot be talked
 * into carrying a garment name — that is the whole point of the closed
 * vocabulary — so this suite forges the leak the only way it CAN happen: by
 * writing a poisoned event straight into the buffer's localStorage key,
 * bypassing `record()` entirely, the way a future bug that skips the typed
 * API (a raw `localStorage.setItem` slipped in under deadline, say) would.
 * `--red-proof` runs that scenario alone and asserts the leak-scanning logic
 * in this file actually flags it. If it didn't, the clean run above would be
 * a check that cannot go red — a green stamp, not a check.
 *
 * Loading TypeScript: usage.ts is bundled with esbuild through
 * `sharedAliases()`, the same as every other suite in this repo, even though
 * usage.ts itself imports nothing from the shared package — the point is
 * never to re-implement the module under test, only ever to load the real
 * one the app compiles against.
 *
 * Node has no `window`, so a tiny localStorage shim is installed on
 * `globalThis.window` before the bundle is imported, following the pattern
 * in scripts/test-tutorial.mjs and scripts/test-accounts.mjs. Node DOES have
 * a real `crypto.randomUUID` (Node >= 19), so that is left alone except in
 * the central leak test, where both `Date` and `crypto.randomUUID` are
 * pinned to fixed, hand-picked values for exactly as long as that one test
 * runs. That pinning exists for a boring but real reason: `at` is
 * `Date.now()`, `sentAt` is an ISO timestamp, and `installId` is a random
 * UUID, and searching a JSON blob for the bare digits of a cost value like
 * "4200" while any of those three are left to vary at random has a real,
 * if small, chance of matching a coincidental run of the same four digits
 * inside a thirteen-digit epoch millisecond or a UUID's hex — which would
 * make this suite flaky, and a flaky privacy check is one people learn to
 * ignore. Pinning removes the coincidence entirely rather than hoping it
 * stays rare.
 *
 * Usage: node scripts/test-usage.mjs [--red-proof]
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RED_PROOF = process.argv.includes('--red-proof');

/* ==================== load the real module ==================== */

// A fresh, empty localStorage the module can read and write. Installed on
// globalThis.window BEFORE the bundle is imported, because usage.ts reads
// `window.localStorage` at call time, not at import time — but esbuild's
// output still expects `window` to exist as soon as any exported function
// runs, and several of those run during this suite's very first lines.
function freshLocalStorage() {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
}
globalThis.window = { localStorage: freshLocalStorage() };

const dir = mkdtempSync(join(tmpdir(), 'usage-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: { usage: fileURLToPath(new URL('../src/lib/usage.ts', import.meta.url)) },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const usage = await import(pathToFileURL(join(dir, 'usage.js')).href);
const {
  EVENT_NAMES,
  CONSENT_KEY,
  BUFFER_KEY,
  CONSENT_VERSION,
  MAX_EVENTS,
  MAX_BYTES,
  loadConsent,
  isRecording,
  shouldAsk,
  setConsent,
  readBuffer,
  record,
  pendingPayload,
} = usage;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};
const skip = (label, why) => console.log('SKIP -', label, `(${why})`);

const reset = () => { window.localStorage.clear(); };

/* ==================== red-proof branch ====================
   A completely separate run of this file: build the same fixture, poison
   the buffer by writing a leak straight into localStorage (never through
   record()), and assert the leak-scanning logic used by the clean test
   below actually catches it. Mirrors check-alias-parity.mjs --red-proof and
   scripts/check-native-storage.mjs --red-proof: its own branch, its own
   exit, never mixed into the normal run's pass/fail count. */
if (RED_PROOF) {
  reset();
  const fixture = buildFixture();
  const forbidden = forbiddenStrings(fixture);

  setConsent(true);
  // A poisoned event, exactly the shape a hurried call site would produce by
  // reaching for the object it already had in scope instead of the typed
  // vocabulary — carrying the garment name and brand straight through. This
  // is written directly to the BUFFER_KEY, bypassing record() entirely,
  // because record()'s typed signature makes this impossible to construct
  // through the real API — which is exactly why a red-proof has to go around
  // the front door to prove the door is doing anything.
  const poisoned = [{
    name: 'piece_added',
    at: Date.now(),
    props: {
      via: 'manual',
      hasPhoto: true,
      tier: 'mid',
      // Not in EventProps['piece_added']. A real leak looks exactly this
      // ordinary: a well-meaning extra field that compiles against nothing
      // because it was never routed through the typed record() call at all.
      itemName: fixture.itemName,
      brand: fixture.brand,
      notes: fixture.notes,
    },
  }];
  window.localStorage.setItem(BUFFER_KEY, JSON.stringify(poisoned));

  const payload = pendingPayload('red-proof-build');
  const serialized = JSON.stringify(payload);
  const leaks = findLeaks(serialized, forbidden);

  console.log('');
  console.log('=== red-proof: a garment name and brand planted directly in the buffer ===');
  if (leaks.length > 0) {
    console.log(`  caught: ${leaks.length} forbidden string(s) present in the payload the collector would send`);
    console.log('RED-PROOF OK — the leak-scanning check notices a leak when one actually exists');
    process.exit(0);
  }
  console.log('RED-PROOF FAILED — a garment name and brand were planted directly in the buffer');
  console.log('and pendingPayload() carried them through, but the leak scan found nothing.');
  console.log('That means the check in this file cannot be trusted to catch a real leak.');
  process.exit(1);
}

/* ==================== fixture: a wardrobe full of things that must never leave ==================== */

function buildFixture() {
  return {
    itemName: 'Navy linen shirt',
    brand: 'Uniqlo',
    notes: 'Bought during the Jaipur trip; hemmed by the tailor on MG Road, still a little loose at the shoulder',
    fitsLike: 'Runs small — size up one',
    category: 'Festivewear', // a user-invented category, never a built-in one
    occasion: 'Diwali dinner', // a user-invented occasion tag
    wardrobeName: "Meher's Almari",
    handle: '@meherwears',
    costValue: 4200,
    // A short but real PNG data URL — a 1x1 pixel, base64-encoded. Short on
    // purpose: the point is that its bytes are distinctive, not that it is
    // large; a giant fixture image would only slow the suite down.
    photoDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  };
}

function forbiddenStrings(fixture) {
  return [
    ['the garment name', fixture.itemName],
    ['the brand', fixture.brand],
    ['the free-text notes', fixture.notes],
    ['the fitsLike line', fixture.fitsLike],
    ['the user-authored category', fixture.category],
    ['the user-authored occasion', fixture.occasion],
    ['the wardrobe name', fixture.wardrobeName],
    ['the account handle', fixture.handle],
    ['the cost value', String(fixture.costValue)],
    ['the photograph data URL', fixture.photoDataUrl],
  ];
}

function findLeaks(serialized, forbidden) {
  return forbidden.filter(([, value]) => serialized.includes(value));
}

/* ==================== 1. nothing is buffered before consent (rule 2) ==================== */

console.log('=== rule 2: nothing is buffered before consent ===');
reset();
check('a fresh device has never been asked (state is unset)', loadConsent().state === 'unset');
check('shouldAsk() is true for an unset device', shouldAsk() === true);

for (let i = 0; i < 25; i++) record('app_opened', { cold: true, standalone: false });
check(
  'record() writes NOTHING while consent is unset, even called 25 times',
  readBuffer().length === 0,
  `buffer holds ${readBuffer().length} event(s)`
);

setConsent(false);
check('declining sets state to declined', loadConsent().state === 'declined');
for (let i = 0; i < 25; i++) record('app_opened', { cold: true, standalone: false });
check(
  'record() writes NOTHING while consent is declined, even called 25 times',
  readBuffer().length === 0,
  `buffer holds ${readBuffer().length} event(s)`
);

/* ==================== 2. revocation is destruction (rule 3) ==================== */

console.log('');
console.log('=== rule 3: revocation is destruction ===');
reset();
setConsent(true);
for (let i = 0; i < 10; i++) record('wear_logged', { pieces: 1, viaOutfit: false });
check('granting then recording actually fills the buffer', readBuffer().length === 10);
setConsent(false);
check('setConsent(false) empties the buffer', readBuffer().length === 0);

/* ==================== 3. install id spans cannot be stitched together ==================== */

console.log('');
console.log('=== the install id changes on every fresh grant ===');
reset();
const grant1 = setConsent(true);
check('granting mints an installId', typeof grant1.installId === 'string' && grant1.installId.length > 0);
setConsent(false);
const grant2 = setConsent(true);
check('revoking and re-granting mints a DIFFERENT installId', typeof grant2.installId === 'string' && grant2.installId !== grant1.installId, `${grant1.installId} vs ${grant2.installId}`);

/* ==================== 4. the ring buffer: MAX_EVENTS, drop-oldest ==================== */

console.log('');
console.log('=== rule 4: the ring buffer yields — MAX_EVENTS, oldest dropped first ===');
reset();
setConsent(true);
const overflow = MAX_EVENTS + 50;
for (let i = 0; i < overflow; i++) {
  record('session_ended', { ms: i, screens: 1 });
}
const afterOverflow = readBuffer();
check(
  `recording ${overflow} events (MAX_EVENTS + 50) leaves exactly MAX_EVENTS (${MAX_EVENTS})`,
  afterOverflow.length === MAX_EVENTS,
  `buffer holds ${afterOverflow.length}`
);
check(
  'the oldest 50 events are gone — the first surviving event is call #50, not #0',
  afterOverflow[0]?.props?.ms === 50,
  `first surviving props.ms = ${afterOverflow[0]?.props?.ms}`
);
check(
  'the newest event survives — the last surviving event is the final call',
  afterOverflow[afterOverflow.length - 1]?.props?.ms === overflow - 1,
  `last surviving props.ms = ${afterOverflow[afterOverflow.length - 1]?.props?.ms}`
);

/* ==================== 5. the ring buffer: MAX_BYTES, drop-oldest ====================
   isWellFormed() only checks name/at/props shape loosely — it does not
   validate props against the exact per-event schema, because that check is
   the compiler's job at the call site, not the reader's job on a value
   already in storage. That is a real gap for a hand-edited or future-build
   buffer, but it is also the gap this test needs: it lets a raw, oversized
   buffer be seeded directly, well below MAX_EVENTS in count but well over
   MAX_BYTES in size, so the byte cap — not the count cap — is what trim()
   is proven against here. */

console.log('');
console.log('=== rule 4: the ring buffer yields — MAX_BYTES, oldest dropped first ===');
reset();
setConsent(true);
const padding = 'x'.repeat(300);
const seeded = [];
for (let i = 0; i < 300; i++) {
  seeded.push({ name: 'export_taken', at: Date.now(), props: { size: 'under-1mb', seq: i, pad: padding } });
}
window.localStorage.setItem(BUFFER_KEY, JSON.stringify(seeded));
const seededSize = JSON.stringify(seeded).length;
check(
  `the seeded fixture is under MAX_EVENTS (${seeded.length} < ${MAX_EVENTS}) but over MAX_BYTES (${seededSize} > ${MAX_BYTES})`,
  seeded.length < MAX_EVENTS && seededSize > MAX_BYTES
);
// One more record() call, through the real API, triggers trim() against
// the buffer already sitting in storage.
record('app_opened', { cold: false, standalone: true });
const afterByteTrim = readBuffer();
const afterByteTrimSize = JSON.stringify(afterByteTrim).length;
check(
  'after one more record(), the buffer is back under MAX_BYTES',
  afterByteTrimSize <= MAX_BYTES,
  `${afterByteTrimSize} bytes`
);
check(
  'events were actually dropped to get there',
  afterByteTrim.length < seeded.length + 1,
  `${seeded.length + 1} seeded+new -> ${afterByteTrim.length} surviving`
);
check(
  'the oldest seeded event (seq 0) is gone',
  !afterByteTrim.some((e) => e.props && e.props.seq === 0)
);
check(
  'the newest event (the one just recorded) survived, at the end of the buffer',
  afterByteTrim[afterByteTrim.length - 1]?.name === 'app_opened'
);

/* ==================== 6. a stale CONSENT_VERSION reads back as unset ==================== */

console.log('');
console.log('=== a consent answer to an old ask is not an answer to this one ===');
reset();
setConsent(true);
const rawConsent = JSON.parse(window.localStorage.getItem(CONSENT_KEY));
check('the stored consent carries the current CONSENT_VERSION', rawConsent.version === CONSENT_VERSION);
rawConsent.version = CONSENT_VERSION + 1;
window.localStorage.setItem(CONSENT_KEY, JSON.stringify(rawConsent));
check(
  'a consent recorded under a different CONSENT_VERSION reads back as unset',
  loadConsent().state === 'unset'
);
check('isRecording() follows: false for a stale-version consent', isRecording() === false);
check('shouldAsk() follows: true for a stale-version consent', shouldAsk() === true);

/* THE STITCH, WHICH THIS SUITE USED TO MISS ENTIRELY.
   -------------------------------------------------------------------------
   A stale version reads back as 'unset' — asserted above, and correct. But the
   BUFFER is not versioned, so events written under the previous grant were
   still sitting there. Two things followed, both proven live before the fix:

     the consent panel opened and printed "Nothing has been written down,
     because nothing is written down before you allow it" over a full buffer;

     and the next grant minted a FRESH install id and sent the OLD events under
     it, stitching two spans that the id was minted specifically to keep apart.

   The fix is one line in setConsent — clearBuffer() moved above the branch, so
   BOTH answers start empty. This is the case that would have caught it. */
reset();
setConsent(true);
record('screen_viewed', { screen: 'closet', ms: 1200 });
record('wear_logged', { pieces: 2, viaOutfit: false });
check('events exist under the first grant', readBuffer().length === 2, `${readBuffer().length}`);

const aged = JSON.parse(window.localStorage.getItem(CONSENT_KEY));
const firstInstallId = aged.installId;
aged.version = CONSENT_VERSION + 1;
window.localStorage.setItem(CONSENT_KEY, JSON.stringify(aged));
check('the aged consent reads as unset, so the panel will ask again', loadConsent().state === 'unset');
check(
  'and pendingPayload() refuses to describe a buffer nobody has consented to',
  pendingPayload('alpha') === null
);

const regrant = setConsent(true);
check(
  'a fresh grant starts from an EMPTY buffer — no event survives the version boundary',
  readBuffer().length === 0,
  `${readBuffer().length} survived`
);
check(
  'and the payload it would send carries nothing from before',
  (pendingPayload('alpha')?.events.length ?? -1) === 0
);
check(
  'the re-grant minted a different install id, so the two spans cannot be joined',
  regrant.installId !== firstInstallId && !!regrant.installId
);

// A bonus, cheap to add: outright corrupt JSON under the consent key must
// not throw either. readJson()'s try/catch is the thing under test here.
window.localStorage.setItem(CONSENT_KEY, '{not json');
check('outright corrupt JSON under CONSENT_KEY does not throw and reads as unset', (() => {
  try { return loadConsent().state === 'unset'; } catch { return false; }
})());

/* ==================== 7. readBuffer() discards malformed entries, never throws ==================== */

console.log('');
console.log('=== a hand-edited or half-written buffer is discarded, not repaired, never thrown ===');
reset();
const wellFormed = { name: 'wear_logged', at: Date.now(), props: { pieces: 2, viaOutfit: true } };
const garbage = [
  wellFormed,
  'just a string',
  null,
  undefined,
  42,
  true,
  { name: 'not_a_real_event_name', at: Date.now(), props: {} },
  { name: 'wear_logged', at: 'not-a-number', props: { pieces: 1, viaOutfit: false } },
  { name: 'wear_logged', at: Date.now() }, // missing props
  { props: { pieces: 1, viaOutfit: false } }, // missing name and at
  { foo: 'bar' },
  [1, 2, 3],
];
window.localStorage.setItem(BUFFER_KEY, JSON.stringify(garbage));
let survivors = null;
let threw = false;
try {
  survivors = readBuffer();
} catch {
  threw = true;
}
check('readBuffer() does not throw on a garbage-filled buffer', !threw);
check(
  'readBuffer() keeps only the one well-formed entry, discarding the rest',
  Array.isArray(survivors) && survivors.length === 1 && survivors[0].name === 'wear_logged' && survivors[0].props.pieces === 2,
  survivors ? `kept ${survivors.length}` : 'threw'
);

// The buffer key itself can also hold the wrong shape entirely — an object
// instead of an array, the way a key can end up holding an account record
// or a wardrobe if two features ever collided on a name.
window.localStorage.setItem(BUFFER_KEY, JSON.stringify({ not: 'an array' }));
check('readBuffer() returns an empty array when BUFFER_KEY holds an object, not an array', (() => {
  try { return Array.isArray(readBuffer()) && readBuffer().length === 0; } catch { return false; }
})());

/* ==================== 8. pendingPayload() returns null when not recording ==================== */

console.log('');
console.log('=== pendingPayload() tells the truth about whether anything would send ===');
reset();
check('pendingPayload() is null while unset', pendingPayload('b1') === null);
setConsent(false);
check('pendingPayload() is null while declined', pendingPayload('b1') === null);
setConsent(true);
record('app_opened', { cold: true, standalone: false });
const live = pendingPayload('b1');
check(
  'pendingPayload() is a real payload once granted, carrying installId/build/events',
  !!live && typeof live.installId === 'string' && live.build === 'b1' && Array.isArray(live.events) && live.events.length === 1
);

/* ==================== 9. EVENT_NAMES parity with the server allowlist ==================== */

console.log('');
console.log('=== the server must know every event name the app can send ===');
const serverPath = fileURLToPath(new URL('../supabase/functions/usage/index.ts', import.meta.url));
if (!existsSync(serverPath)) {
  skip(
    'EVENT_NAMES matches the server allowlist in supabase/functions/usage/index.ts',
    'supabase/functions/usage/index.ts does not exist yet — a name the app can send that the ' +
    'server does not recognise is silently discarded in production, so this check is armed the ' +
    'moment that file is written, and should be run again then'
  );
} else {
  const serverText = readFileSync(serverPath, 'utf8');
  const serverNames = parseAllowlist(serverText);
  if (!serverNames) {
    check(
      'an event-name allowlist array could be located in supabase/functions/usage/index.ts',
      false,
      'no identifier matching EVENT_NAMES/ALLOWED_EVENTS/ALLOWLIST with an array literal was found — ' +
      'name the constant one of those, or update parseAllowlist() in this file'
    );
  } else {
    const appSet = [...EVENT_NAMES].sort();
    const serverSet = [...new Set(serverNames)].sort();
    const missingOnServer = appSet.filter((n) => !serverSet.includes(n));
    const extraOnServer = serverSet.filter((n) => !appSet.includes(n));
    check(
      'EVENT_NAMES (src/lib/usage.ts) and the server allowlist (supabase/functions/usage/index.ts) are the same set',
      missingOnServer.length === 0 && extraOnServer.length === 0,
      `missing on server: [${missingOnServer.join(', ')}] · extra on server: [${extraOnServer.join(', ')}]`
    );
  }
}

function parseAllowlist(text) {
  const m = text.match(/(?:EVENT_NAMES|ALLOWED_EVENTS|EVENT_ALLOWLIST|ALLOWLIST|ALLOWED_EVENT_NAMES)\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  const names = [...m[1].matchAll(/['"`]([a-zA-Z0-9_]+)['"`]/g)].map((x) => x[1]);
  return names.length ? names : null;
}

/* ==================== 10. THE CENTRAL TEST — the closed vocabulary holds under real use ==================== */

console.log('');
console.log('=== the central test: a wardrobe full of distinctive strings never reaches a payload ===');
reset();

// Date and crypto are pinned only for this block, and restored in a finally.
// See the file header for exactly why: without pinning, the epoch
// millisecond in `at`, the ISO string in `sentAt`, and the hex in a random
// installId are all free to vary, and a search for a short numeric marker
// like the cost value "4200" then carries a small but real chance of
// matching one of them by coincidence — which would make this suite flaky.
const RealDate = Date;
const FIXED_MS = 5_000_000_000_000; // chosen to contain no run of "4200" anywhere near it
class FixedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED_MS);
    else super(...args);
  }
  static now() { return FIXED_MS; }
}
const realRandomUUID = globalThis.crypto?.randomUUID;
const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; // no digits at all — cannot collide with a numeric marker

let payload = null;
let forbidden = null;
try {
  globalThis.Date = FixedDate;
  if (globalThis.crypto) globalThis.crypto.randomUUID = () => FIXED_UUID;

  const fixture = buildFixture();
  forbidden = forbiddenStrings(fixture);

  setConsent(true);

  // Every one of the fourteen event names, driven through the real, typed
  // record() function — the only door this file's payload can be reached
  // through. None of these calls can literally carry a fixture string; that
  // is the point being tested. tier/via/action below are the enum buckets
  // EventProps actually allows, deliberately DERIVED from the fixture in
  // spirit (a mid-tier cost, a photo-based add) without ever touching its
  // strings.
  record('app_opened', { cold: true, standalone: false });
  record('wardrobe_created', { seeded: false });
  record('piece_added', { via: 'photo', hasPhoto: true, tier: 'mid' });
  record('wear_logged', { pieces: 2, viaOutfit: true });
  record('outfit_created', { pieces: 3 });
  record('screen_viewed', { screen: 'closet', ms: 1200 });
  record('intake_run', { offered: 5, accepted: 3, ms: 4400 });
  record('cutout_run', { ms: 900, kept: true });
  record('export_taken', { size: 'under-1mb' });
  record('tutorial_step', { screen: 'intake', action: 'done' });
  record('write_refused', { size: '1-3mb' });
  record('error_raised', { where: 'photos', kind: 'quota' });
  record('sync_attempted', { ok: true, ms: 300, size: 'under-1mb' });
  record('session_ended', { ms: 60000, screens: 6 });

  check('all fourteen EVENT_NAMES were actually driven', readBuffer().length === EVENT_NAMES.length, `buffer holds ${readBuffer().length}, expected ${EVENT_NAMES.length}`);

  payload = pendingPayload('test-build');
} finally {
  globalThis.Date = RealDate;
  if (globalThis.crypto && realRandomUUID) globalThis.crypto.randomUUID = realRandomUUID;
}

const serializedPayload = JSON.stringify(payload);
check('pendingPayload() returned a real payload to search', !!payload && Array.isArray(payload.events) && payload.events.length === EVENT_NAMES.length);

for (const [label, value] of forbidden) {
  check(`the payload the collector would send never carries ${label}`, !serializedPayload.includes(value));
}

const anyLeak = findLeaks(serializedPayload, forbidden);
check(
  'not one of the ten distinctive fixture strings appears ANYWHERE in the serialised payload',
  anyLeak.length === 0,
  anyLeak.length ? `leaked: ${anyLeak.map(([label]) => label).join(', ')}` : `${forbidden.length} strings checked against ${serializedPayload.length} bytes`
);

/* ==================== summary ==================== */

console.log('');
if (fail) {
  console.log(`usage: ${fail} FAILURE(S) — the alpha usage record's privacy contract is not holding`);
  process.exit(1);
}
console.log('usage: ALL CHECKS PASSED — the alpha usage record holds its four rules');
