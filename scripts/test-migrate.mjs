// Verifies a real v1 localStorage payload survives migration with no loss.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/* `--tz <IANA>` runs this file as the timezone child described at the foot of
   the file. The assignment below has to happen before the first Date is built,
   because assigning process.env.TZ is what clears V8's cached zone — and it has
   to happen here rather than being inherited, because on this repo's Git-Bash a
   TZ prefix is swallowed before it reaches node. The child reports the zone it
   actually resolved so a swallowed TZ is a loud failure and never a silent
   pass. The pattern is scripts/test-dates.mjs's; read its header for the long
   version. `--bundle` lets the child reuse the parent's build. */
const argv = process.argv.slice(2);
const zoneArg = argv.includes('--tz') ? argv[argv.indexOf('--tz') + 1] : null;
if (zoneArg) process.env.TZ = zoneArg;
const bundleArg = argv.includes('--bundle') ? argv[argv.indexOf('--bundle') + 1] : null;

const out = bundleArg ?? join(mkdtempSync(join(tmpdir(), 'mig-')), 'migrate.mjs');
if (!bundleArg) {
  await build({ alias: sharedAliases(),
    entryPoints: [fileURLToPath(new URL('../packages/shared/migrate.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    outfile: out,
    logLevel: 'error',
  });
}

const { migrate } = await import(pathToFileURL(out).href);

// A child reports its one zone and exits; it never reaches the suite below.
if (zoneArg) await runZoneCase(zoneArg);

const v1 = {
  items: [
    {
      id: 'a', name: 'White Oxford', category: 'tops', color: '#f5f0eb',
      season: ['spring'], occasion: ['work'], imageUrl: 'data:x', dateAdded: '2026-01-01',
      wearCount: 14, cost: 68, favorite: true, laundryStatus: 'clean',
    },
    {
      id: 'b', name: 'Kilt', category: 'skirts-custom', color: '#31415e',
      season: [], occasion: ['market-day'], imageUrl: '', dateAdded: '2026-02-01',
      wearCount: 0, favorite: false, laundryStatus: 'washing',
    },
    // A hand-edited export can carry a cost that is not a number. Until now
    // migrate coerced wearCount but never cost, so a string reached
    // ItemDetail's `item.cost.toFixed(0)` and white-screened the modal.
    {
      id: 'c', name: 'Overcoat', category: 'outerwear', color: '#3a362e',
      season: ['winter'], occasion: ['work'], imageUrl: '', dateAdded: '2026-01-15',
      wearCount: 4, cost: '420', favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'd', name: 'Scarf', category: 'accessories', color: '#be1231',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-20',
      wearCount: 2, cost: 'not a price', favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'e', name: 'Gifted Ring', category: 'accessories', color: '#c9a227',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-25',
      wearCount: 9, cost: 0, favorite: false, laundryStatus: 'clean',
    },
  ],
  outfits: [
    { id: 'o1', name: 'Monday', itemIds: ['a'], favorite: true, dateCreated: '2026-03-01', wearCount: 3 },
    // An outfit saved before outfits could carry a photograph, and one saved after.
    { id: 'o2', name: 'Gallery', itemIds: ['a'], favorite: false, dateCreated: '2026-04-01', wearCount: 1, imageUrl: 'wardrobe/meher/MK-01.webp' },
  ],
  wearLogs: [{ id: 'l1', date: '2026-08-01', itemIds: ['a'] }],
  wishlist: [{ id: 'w1', name: 'Cardigan', category: 'tops', color: '#d4a574', priority: 'high', dateAdded: '2026-07-01', purchased: false, price: 88 }],
  someFutureKey: { keep: 'me' },
};

const m = migrate(v1);
const checks = [
  ['schemaVersion set', m.schemaVersion === 8],
  // v4 adds events. A pre-v4 export must gain an empty, valid list rather than
  // an undefined the Events page would crash on, and an export that already
  // carries events must round-trip with its reservations intact.
  ['events seeded on old exports', Array.isArray(m.events) && m.events.length === 0],
  ['existing events preserved', (() => {
    const withEvents = migrate({ ...v1, events: [{ id: 'e1', name: 'Udaipur wedding', kind: 'celebration', startDate: '2026-11-20', endDate: '2026-11-23', reservations: [{ id: 'r1', date: '2026-11-21', label: 'Mehndi', itemIds: ['a'], outfitId: 'o1' }] }] });
    return withEvents.events.length === 1
      && withEvents.events[0].reservations.length === 1
      && withEvents.events[0].reservations[0].label === 'Mehndi';
  })()],
  ['malformed events dropped, not crashed', (() => {
    const bad = migrate({ ...v1, events: 'not an array' });
    return Array.isArray(bad.events) && bad.events.length === 0;
  })()],
  // v3 adds the Shared Rail. An export from before it must gain an empty, valid
  // circle rather than an undefined that crashes the /rail page, and an export
  // that already carries one must round-trip untouched.
  ['circle seeded on old exports', m.circle && Array.isArray(m.circle.profiles) && Array.isArray(m.circle.groups) && Array.isArray(m.circle.messages) && Array.isArray(m.circle.loans)],
  ['existing circle preserved', (() => {
    const withCircle = migrate({ ...v1, circle: { profiles: [{ id: 'p1', handle: '@needle', name: 'Needle', monogram: 'N', color: '#5A7A6E', lendable: [], showcase: [] }], groups: [], messages: [], loans: [] } });
    return withCircle.circle.profiles.length === 1 && withCircle.circle.profiles[0].handle === '@needle';
  })()],
  ['items preserved', m.items.length === 5],
  ['wear counts intact', m.items[0].wearCount === 14],
  // Losslessness is read strictly: a numeric string is parsed, not thrown away.
  ['numeric string cost coerced', m.items[2].cost === 420],
  ['unparseable cost dropped', m.items[3].cost === undefined],
  ['recorded zero cost preserved', m.items[4].cost === 0],
  ['outfits preserved', m.outfits.length === 2],
  // The planned flag. A plan used to be recognised by its date being in the
  // future — which meant every plan silently became a "wear" the morning its
  // day arrived, and Undo on that fiction decremented counts that had never
  // moved. The flag is stored now. Migration: a log with no flag and a future
  // date is a plan; a past log with no flag is a wear (a matured legacy plan
  // cannot be told apart from a real wear — that ambiguity is exactly why the
  // flag exists). A stored flag always survives, even on a past date: that is
  // a matured, unconfirmed plan awaiting its question.
  ['future logs gain the planned flag', (() => {
    const withPlan = migrate({ ...v1, wearLogs: [{ id: 'l1', date: '2099-01-01', itemIds: ['a'] }] });
    return withPlan.wearLogs[0].planned === true;
  })()],
  ['past logs stay wears', (() => {
    const past = migrate({ ...v1, wearLogs: [{ id: 'l1', date: '2020-01-01', itemIds: ['a'] }] });
    return past.wearLogs[0].planned !== true;
  })()],
  ['a stored planned flag survives maturing', (() => {
    const matured = migrate({ ...v1, wearLogs: [{ id: 'l1', date: '2020-01-01', itemIds: ['a'], planned: true }] });
    return matured.wearLogs[0].planned === true;
  })()],
  // v5: a hand-me-down carries its provenance — a FROZEN snapshot of where it
  // came from, never a live link into the giver's wardrobe. It must round-trip
  // untouched, and its absence must stay absent.
  ['provenance round-trips', (() => {
    const withProv = migrate({ ...v1, items: [{ ...v1.items[0], provenance: { from: 'Meher', wearsInTheirRecord: 51, passedOn: '2026-08-01' } }] });
    const p = withProv.items[0].provenance;
    return p && p.from === 'Meher' && p.wearsInTheirRecord === 51 && p.passedOn === '2026-08-01';
  })()],
  ['no provenance stays none', m.items[0].provenance === undefined],
  ['outfit without a photo survives', m.outfits[0].imageUrl === undefined && m.outfits[0].wearCount === 3],
  ['outfit photo round-trips', m.outfits[1].imageUrl === 'wardrobe/meher/MK-01.webp'],
  ['wearLogs preserved', m.wearLogs.length === 1],
  ['wishlist preserved', m.wishlist.length === 1],
  ['purchased -> status', m.wishlist[0].status === 'waiting' && !('purchased' in m.wishlist[0])],
  ['custom category adopted', m.settings.categories.some(c => c.id === 'skirts-custom')],
  ['default categories seeded', m.settings.categories.some(c => c.id === 'tops')],
  ['custom occasion adopted', m.settings.occasions.includes('market-day')],
  ['performance in defaults', m.settings.occasions.includes('performance')],
  ['unknown top-level key preserved', m.someFutureKey?.keep === 'me'],
  ['theme defaults to dark', m.settings.theme === 'dark'],

  // v6: furniture — where a piece physically lives. The whole risk of this
  // feature is that a storage feature can lose clothes, so every case below is
  // about the record surviving furniture being wrong, missing, or from a build
  // we have never seen.
  ['furniture seeded empty', Array.isArray(m.furniture) && m.furniture.length === 0],
  ['no seeded furniture', (() => {
    // A dresser nobody owns is a lie in the record. An old export must gain an
    // EMPTY list, never a helpful default.
    const fresh = migrate({ items: [] });
    return Array.isArray(fresh.furniture) && fresh.furniture.length === 0;
  })()],
  ['furniture round-trips', (() => {
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'Bedroom chest', form: 'chest', dateAdded: '2026-08-01',
        slots: [{ id: 's1', label: 'Top drawer' }, { id: 's2', label: 'Shirts' }] },
    ] });
    const f = withF.furniture[0];
    return f.name === 'Bedroom chest' && f.form === 'chest' && f.slots.length === 2
      && f.slots[1].label === 'Shirts';
  })()],
  ['unknown fields on furniture survive', (() => {
    // The newer-backup case: a v7 field must round-trip through a v6 build.
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'Chest', form: 'chest', slots: [{ id: 's1', label: 'A', depth: 'deep' }], roomId: 'attic' },
    ] });
    return withF.furniture[0].roomId === 'attic' && withF.furniture[0].slots[0].depth === 'deep';
  })()],
  ['malformed furniture is dropped, never thrown', (() => {
    const a = migrate({ ...v1, furniture: 'nonsense' });
    const b = migrate({ ...v1, furniture: [null, 42, {}, { id: 'ok', slots: [] }] });
    return a.furniture.length === 0 && b.furniture.length === 1 && b.furniture[0].id === 'ok';
  })()],
  ['a nameless piece is named after itself', (() => {
    // Repair, never discard: it still holds clothes.
    const withF = migrate({ ...v1, furniture: [{ id: 'f9', slots: [] }] });
    return withF.furniture[0].name === 'f9';
  })()],
  ['a piece with no slots gains one', (() => {
    // Zero slots is a piece of furniture nothing can be filed in — an object
    // that exists and cannot be used. One slot is the floor.
    const withF = migrate({ ...v1, furniture: [{ id: 'f1', name: 'Rail', form: 'rail', slots: [] }] });
    return withF.furniture[0].slots.length === 1;
  })()],
  ['duplicate furniture ids collapse to one', (() => {
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'A', slots: [{ id: 's', label: 'x' }] },
      { id: 'f1', name: 'B', slots: [{ id: 's', label: 'y' }] },
    ] });
    return withF.furniture.length === 1 && withF.furniture[0].name === 'A';
  })()],
  ['an unknown place on a piece is PRESERVED', (() => {
    // Losslessness. An id we cannot resolve is a filing we cannot READ, not a
    // filing that is wrong — clearing it would lose the grouping for good.
    const withP = migrate({ ...v1, items: [{ ...v1.items[0], place: { furnitureId: 'ghost', slotId: 'x' } }] });
    return withP.items[0].place?.furnitureId === 'ghost';
  })()],
  ['a malformed place is dropped', (() => {
    const bad = migrate({ ...v1, items: [{ ...v1.items[0], place: 42 }] });
    const half = migrate({ ...v1, items: [{ ...v1.items[0], place: { furnitureId: 'f1' } }] });
    return bad.items[0].place === undefined && half.items[0].place === undefined;
  })()],
  ['no place stays none', m.items[0].place === undefined],

  // v7: the new forms, the limits, and packing away. Same standard as v6 —
  // every case here is about the RECORD surviving, because the one thing a
  // storage feature must never do is lose clothes.
  ['the new forms survive', (() => {
    const forms = ['rail', 'chest', 'shelves', 'almirah', 'almirah-carved', 'box', 'hooks', 'stand', 'rack'];
    const withF = migrate({ ...v1, furniture: forms.map((form, i) => (
      { id: `f${i}`, name: form, form, slots: [{ id: `s${i}`, label: 'x' }] }
    )) });
    return withF.furniture.length === forms.length
      && forms.every((form, i) => withF.furniture[i].form === form);
  })()],
  ['the fitted almirah round-trips with its seven parts', (() => {
    const withF = migrate({ ...v1, furniture: [{
      id: 'f1', name: 'Fitted', form: 'almirah-fitted', dateAdded: '2026-01-01',
      slots: ['Hanging ledge', 'Shelves', 'Jewels', 'Locker', 'Bags', 'Shoes', 'Drawer']
        .map((label, i) => ({ id: `s${i}`, label })),
    }] });
    const f = withF.furniture[0];
    return f.form === 'almirah-fitted' && f.slots.length === 7 && f.slots[4].label === 'Bags';
  })()],
  ['a carved treatment round-trips, and an unknown one becomes plain', (() => {
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'A', form: 'almirah-fitted', ornament: 'mughal', slots: [{ id: 's', label: 'x' }] },
      { id: 'f2', name: 'B', form: 'almirah-fitted', ornament: 'baroque', slots: [{ id: 's', label: 'x' }] },
      { id: 'f3', name: 'C', form: 'almirah-fitted', ornament: 'plain', slots: [{ id: 's', label: 'x' }] },
      { id: 'f4', name: 'D', form: 'almirah-fitted', slots: [{ id: 's', label: 'x' }] },
    ] });
    // Plain is the ABSENCE of the field, so a plain piece is byte-identical to
    // every piece written before ornament existed.
    return withF.furniture[0].ornament === 'mughal'
      && withF.furniture[1].ornament === undefined
      && withF.furniture[2].ornament === undefined
      && withF.furniture[3].ornament === undefined;
  })()],
  ['an unknown form becomes a chest, and keeps its slots', (() => {
    // A form we cannot draw is a wrong picture of a real object, which is
    // recoverable. Dropping the piece would take its addresses with it.
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'Trunk', form: 'palanquin', slots: [{ id: 's1', label: 'Inside' }] },
    ] });
    return withF.furniture[0].form === 'chest' && withF.furniture[0].slots.length === 1;
  })()],
  ['slots ABOVE the drawing limit are kept, never cut', (() => {
    // The case that decides whether this feature can lose things. A file from a
    // build with a taller drawing still describes real drawers with real
    // clothes in them; truncating would orphan every piece filed below the
    // seventh. The drawing gives way, not the record.
    const slots = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, label: `Drawer ${i}` }));
    const withF = migrate({ ...v1, furniture: [{ id: 'f1', name: 'Tall', form: 'chest', slots }] });
    return withF.furniture[0].slots.length === 40 && withF.furniture[0].slots[39].id === 's39';
  })()],
  ['two hundred places all arrive', (() => {
    // Over MAX_FURNITURE by an order of magnitude. The ceiling governs what may
    // be MADE, never what may be READ.
    const many = Array.from({ length: 200 }, (_, i) => (
      { id: `f${i}`, name: `Place ${i}`, form: 'chest', slots: [{ id: `f${i}-s`, label: 'In' }] }
    ));
    const withF = migrate({ ...v1, furniture: many });
    return withF.furniture.length === 200;
  })()],
  ['a ten-thousand-character name is KEPT WHOLE', (() => {
    // The limit is on what may be typed, not on what may be held. Cutting here
    // would silently shorten somebody's record, and the drawing already clips
    // what it cannot fit.
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'x'.repeat(10000), form: 'chest',
        slots: [{ id: 's1', label: 'y'.repeat(10000) }] },
    ] });
    const f = withF.furniture[0];
    return f.name.length === 10000 && f.slots.length === 1 && f.slots[0].label.length === 10000;
  })()],
  ['an oversized file round-trips unchanged', (() => {
    // Two hundred places, nine slots each, absurd names — migrating it must be
    // a no-op, or every load of that file quietly edits it again.
    const over = migrate({ ...v1, furniture: Array.from({ length: 200 }, (_, i) => ({
      id: `f${i}`, name: 'n'.repeat(500), form: 'almirah', dateAdded: '2026-01-01',
      slots: Array.from({ length: 9 }, (_, j) => ({ id: `f${i}s${j}`, label: 'l'.repeat(200) })),
    })) });
    return JSON.stringify(migrate(over)) === JSON.stringify(over);
  })()],
  ['duplicate slot ids collapse to one', (() => {
    // Two slots with one id means a piece filed in either is filed in both.
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'A', form: 'chest', slots: [
        { id: 's', label: 'first' }, { id: 's', label: 'second' },
      ] },
    ] });
    return withF.furniture[0].slots.length === 1 && withF.furniture[0].slots[0].label === 'first';
  })()],
  ['packed survives, and only when it is exactly true', (() => {
    // A truthy string out of a hand-edited file must not quietly take half a
    // wardrobe out of the day's suggestions.
    const withF = migrate({ ...v1, furniture: [
      { id: 'f1', name: 'A', form: 'chest', slots: [
        { id: 's1', label: 'Winter', packed: true },
        { id: 's2', label: 'Summer', packed: 'yes' },
        { id: 's3', label: 'Now', packed: 1 },
        { id: 's4', label: 'Also now' },
      ] },
    ] });
    const s = withF.furniture[0].slots;
    return s[0].packed === true && s[1].packed === undefined
      && s[2].packed === undefined && s[3].packed === undefined;
  })()],
  ['a negative or NaN slot list is still one slot', (() => {
    const a = migrate({ ...v1, furniture: [{ id: 'f1', name: 'A', form: 'rail', slots: -3 }] });
    const b = migrate({ ...v1, furniture: [{ id: 'f2', name: 'B', form: 'rail', slots: NaN }] });
    return a.furniture[0].slots.length === 1 && b.furniture[0].slots.length === 1;
  })()],

  // v8: the photograph contract. The web app stores photographs as base64 data
  // URIs inside this document; the native app keeps the files on disk under
  // FileSystem.documentDirectory and writes relative paths into the same
  // `imageUrl` field. Both are strings, so neither side could ever tell which
  // it was holding — the mismatch would have been silent, and a silent one is
  // the kind that arrives as forty broken photographs. The document declares
  // its own encoding now, and every document written before this field existed
  // was written by the web app, so no declaration means 'inline'.
  ['a document with no encoding declares inline', m.photoEncoding === 'inline'],
  ['a native document KEEPS file', (() => {
    // Migration must never clobber a document the native app wrote. Rewriting
    // 'file' to 'inline' here would tell every reader that a set of relative
    // paths were data URIs, and every photograph in the wardrobe would resolve
    // to nothing at once.
    const onDisk = migrate({ ...v1, photoEncoding: 'file' });
    return onDisk.photoEncoding === 'file';
  })()],
  ['a file document survives being migrated twice', (() => {
    // The classic version-step bug: the first pass reads the old document and
    // keeps 'file', the second pass sees a current document and "helpfully"
    // normalises it. Loading the file twice must not edit it.
    const once = migrate({ ...v1, photoEncoding: 'file' });
    return JSON.stringify(migrate(once)) === JSON.stringify(once);
  })()],
  ['an unknown encoding is repaired to inline, not trusted', (() => {
    // A value out of a hand-edited file or a build we have never seen is not a
    // reading we can act on. 'inline' is the safe repair: a data URI renders as
    // itself no matter who reads it, while trusting a path we cannot resolve
    // would blank every photograph on the device that reads it.
    const nonsense = migrate({ ...v1, photoEncoding: 'webdav' });
    const empty = migrate({ ...v1, photoEncoding: '' });
    const wrongType = migrate({ ...v1, photoEncoding: 7 });
    return nonsense.photoEncoding === 'inline' && empty.photoEncoding === 'inline'
      && wrongType.photoEncoding === 'inline';
  })()],
  ['a native document keeps its unknown keys too', (() => {
    // Lossless forever. Declaring an encoding must not cost a document the
    // fields this build has never heard of.
    const onDisk = migrate({ ...v1, photoEncoding: 'file', someFutureKey: { keep: 'me' } });
    return onDisk.photoEncoding === 'file' && onDisk.someFutureKey?.keep === 'me';
  })()],
];

// Idempotency: migrating twice must be a no-op.
const twice = migrate(m);
checks.push(['idempotent', JSON.stringify(twice) === JSON.stringify(m)]);

// A purchased v1 wishlist item becomes 'bought'.
const bought = migrate({ items: [], wishlist: [{ id: 'w', name: 'x', category: 'tops', color: '#000', priority: 'low', dateAdded: 'd', purchased: true }] });
checks.push(['purchased:true -> bought', bought.wishlist[0].status === 'bought']);

// Empty / garbage input must not throw.
checks.push(['null safe', migrate(null).items.length === 0]);
checks.push(['garbage safe', migrate('nonsense').items.length === 0]);

/* The furniture dateAdded repair writes a day, and a day is a local fact.
   WardrobeContext stamps todayLocal() when a person makes a new piece, so a
   repair that stamped the UTC day would give a document two different meanings
   for the same field: a wardrobe furnished in Kiritimati (UTC+14) before 14:00
   local would be repaired to YESTERDAY, one in Niue (UTC-11) after 13:00 to
   TOMORROW.

   Those two zones are not decoration. Kiritimati's local day differs from UTC's
   for the fourteen hours from 10:00 UTC; Niue's differs for the eleven hours
   before 11:00 UTC. Between them they cover every hour of every day, so at
   least one of these children always disagrees with UTC and a UTC repair can
   never slip through on a lucky hour. The check below asserts exactly that,
   which is what stops the pair going quietly vacuous if someone trims the list. */
const TZ_ZONES = ['Pacific/Kiritimati', 'Pacific/Niue'];
const zoneResults = [];
for (const zone of TZ_ZONES) {
  const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--tz', zone, '--bundle', out], {
    env: { ...process.env, TZ: zone },
    encoding: 'utf8',
  });
  const marker = (run.stdout ?? '').split('\n').find(l => l.startsWith('##ZONE##'));
  if (!marker) {
    if (run.stderr) process.stderr.write(run.stderr);
    checks.push([`${zone}: the child produced a result`, false]);
    continue;
  }
  const r = JSON.parse(marker.slice('##ZONE##'.length));
  zoneResults.push(r);
  checks.push([`${zone}: the child process really is in ${zone} (resolved ${r.resolved})`, r.resolved === zone]);
  // If midnight passed between the two readings the answer is legitimately
  // either one; that is the flake, not the bug. Both are accepted and the run
  // says so rather than failing on a clock nobody controls.
  if (r.local !== r.localAfter) {
    console.log(`NOTE - midnight crossed mid-run in ${zone} (${r.local} -> ${r.localAfter}); both days accepted`);
  }
  checks.push([
    `${zone}: repaired furniture dateAdded is the LOCAL day, not the UTC one `
      + `(repaired ${r.repaired}, local ${r.local}, UTC ${r.utc})`,
    r.repaired === r.local || r.repaired === r.localAfter,
  ]);
  checks.push([`${zone}: the repaired day is still YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(r.repaired)]);
}
checks.push([
  'at least one zone disagrees with UTC right now, so the pair above is not vacuous',
  zoneResults.length === TZ_ZONES.length && zoneResults.some(r => r.local !== r.utc),
]);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', '-', name);
  if (!ok) failed++;
}
console.log(failed === 0 ? '\nALL MIGRATION CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

/**
 * One zone, in a process of its own.
 *
 * migrate's repair reads the ambient process timezone, through Date's local
 * getters — there is no timeZone option to hand it. A harness that formatted
 * with an explicit timeZone would therefore exercise a code path the app never
 * runs and prove nothing at all about the repair. The zone has to be the
 * process's own, and a process's zone is settled the first time a Date is
 * built, which is the whole reason this is a child and not a closure.
 *
 * The oracle is Intl with an EXPLICIT timeZone. It goes nowhere near
 * src/lib/dates.ts or Date's local getters, so agreeing with it means the
 * repair named the right day — where comparing against a second copy of
 * formatLocalDate would only ever prove the copy was faithful.
 */
async function runZoneCase(zone) {
  const dayIn = when => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(when);
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const local = dayIn(new Date());
  const repaired = migrate({
    items: [],
    furniture: [{ id: 'f1', name: 'The rail', form: 'rail', slots: [{ id: 'f1-s1', label: 'Inside' }] }],
  }).furniture[0].dateAdded;
  console.log(`##ZONE##${JSON.stringify({
    zone,
    resolved: Intl.DateTimeFormat().resolvedOptions().timeZone,
    repaired,
    local,
    localAfter: dayIn(new Date()),
    utc: new Date().toISOString().slice(0, 10),
  })}`);
  process.exit(0);
}
