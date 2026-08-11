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
  outfits: [{ id: 'o1', name: 'Monday', itemIds: ['a'], favorite: true, dateCreated: '2026-03-01', wearCount: 3 }],
  wearLogs: [{ id: 'l1', date: '2026-08-01', itemIds: ['a'] }],
  wishlist: [{ id: 'w1', name: 'Cardigan', category: 'tops', color: '#d4a574', priority: 'high', dateAdded: '2026-07-01', purchased: false, price: 88 }],
  someFutureKey: { keep: 'me' },
};

const m = migrate(v1);
const checks = [
  ['schemaVersion set', m.schemaVersion === 3],
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
  ['outfits preserved', m.outfits.length === 1],
  ['wearLogs preserved', m.wearLogs.length === 1],
  ['wishlist preserved', m.wishlist.length === 1],
  ['purchased -> status', m.wishlist[0].status === 'waiting' && !('purchased' in m.wishlist[0])],
  ['custom category adopted', m.settings.categories.some(c => c.id === 'skirts-custom')],
  ['default categories seeded', m.settings.categories.some(c => c.id === 'tops')],
  ['custom occasion adopted', m.settings.occasions.includes('market-day')],
  ['performance in defaults', m.settings.occasions.includes('performance')],
  ['unknown top-level key preserved', m.someFutureKey?.keep === 'me'],
  ['theme defaults to dark', m.settings.theme === 'dark'],
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
