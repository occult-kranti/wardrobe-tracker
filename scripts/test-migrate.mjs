// Verifies a real v1 localStorage payload survives migration with no loss.
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const out = join(mkdtempSync(join(tmpdir(), 'mig-')), 'migrate.mjs');
await build({
  entryPoints: [new URL('../src/lib/migrate.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});

const { migrate } = await import(out);

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
  ['schemaVersion set', m.schemaVersion === 6],
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

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', '-', name);
  if (!ok) failed++;
}
console.log(failed === 0 ? '\nALL MIGRATION CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
