#!/usr/bin/env node
/**
 * The feed squad's checks: same-day ordering, seed idempotency, tombstones,
 * cross-tab merge, the persona activity engine, and the scope rules.
 *
 * Follows the repo pattern (test-demo.mjs): esbuild-bundle the libs into a
 * temp dir, import the bundles, and assert. No DOM — social.tsx's module
 * scope only defines components, which is why the comparators can be tested
 * through the real file rather than a copy.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'feed-'));
await build({
  entryPoints: [
    fileURLToPath(new URL('../src/lib/communitySeed.ts', import.meta.url)),
    fileURLToPath(new URL('../src/lib/feedEngine.ts', import.meta.url)),
    fileURLToPath(new URL('../src/types.ts', import.meta.url)),
    fileURLToPath(new URL('../src/components/social.tsx', import.meta.url)),
    fileURLToPath(new URL('../src/lib/personaWardrobe.ts', import.meta.url)),
  ],
  bundle: true,
  format: 'esm',
  outdir: dir,
  jsx: 'automatic',
  logLevel: 'error',
});

const seed = await import(pathToFileURL(join(dir, 'lib', 'communitySeed.js')).href);
const engine = await import(pathToFileURL(join(dir, 'lib', 'feedEngine.js')).href);
const types = await import(pathToFileURL(join(dir, 'types.js')).href);
const social = await import(pathToFileURL(join(dir, 'components', 'social.js')).href);
const pw = await import(pathToFileURL(join(dir, 'lib', 'personaWardrobe.js')).href);

const { seedCommunity, mergeCommunity, normalizeCommunity } = seed;
const { personaSchedule, mergeSchedule } = engine;
const { EMPTY_COMMUNITY, postVisibleTo } = types;
const { newestFirst, oldestFirst } = social;
const { PERSONAS } = pw;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

// Local date math, never toISOString — same rule as the app.
const fmt = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = fmt(new Date());
const addD = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

/* ---------- (a) same-day ordering by `at` ----------
   Ids are chosen to fight the timestamps: the id tiebreak alone would produce
   a different (and arbitrary) order. */
const sameDay = [
  { id: 'a1', date: today, at: `${today}T21:30:00` },
  { id: 'z9', date: today, at: `${today}T13:15:00` },
  { id: 'k4', date: today, at: `${today}T08:00:00` },
];
check(
  'newestFirst orders same-day posts by at, not id',
  JSON.stringify([...sameDay].sort(newestFirst).map(p => p.id)) === JSON.stringify(['a1', 'z9', 'k4']),
  [...sameDay].sort(newestFirst).map(p => p.id).join(',')
);
check(
  'oldestFirst orders same-day messages by at, not id',
  JSON.stringify([...sameDay].sort(oldestFirst).map(p => p.id)) === JSON.stringify(['k4', 'z9', 'a1']),
  [...sameDay].sort(oldestFirst).map(p => p.id).join(',')
);
// Seeded rows keep date-only and must still sort: undated goes last, no throw.
let sortedMixed = null;
try {
  sortedMixed = [...sameDay, { id: 'u1' }, { id: 't1', date: today }].sort(newestFirst);
} catch {
  /* an undated row must never be enough to throw inside the sort */
}
check(
  'date-only rows still sort, undated last',
  sortedMixed !== null && sortedMixed[sortedMixed.length - 1].id === 'u1'
);

/* ---------- the seeded community ---------- */
const seeded1 = seedCommunity(structuredClone(EMPTY_COMMUNITY), PERSONAS);
check(
  'seed produces posts, threads, households',
  seeded1.posts.length > 0 && seeded1.conversations.length > 0 && seeded1.households.length > 0,
  `${seeded1.posts.length} posts`
);

/* ---------- (b) seedCommunity idempotency ---------- */
const seeded2 = seedCommunity(seeded1, PERSONAS);
check(
  'seeding twice adds nothing',
  JSON.stringify(seeded1.posts) === JSON.stringify(seeded2.posts) &&
    JSON.stringify(seeded1.messages) === JSON.stringify(seeded2.messages) &&
    JSON.stringify(seeded1.conversations) === JSON.stringify(seeded2.conversations)
);

/* ---------- (c) a taken-down seed post stays down ---------- */
const victim = seeded1.posts.find(p => p.id.startsWith('post-'));
const takenDown = {
  ...seeded1,
  posts: seeded1.posts.filter(p => p.id !== victim.id),
  removedPostIds: [victim.id],
};
const reseeded = seedCommunity(takenDown, PERSONAS);
check(
  'a tombstoned seed post does not resurrect',
  !reseeded.posts.some(p => p.id === victim.id),
  victim.id
);
// Blobs written before tombstones existed carry no field; seeding must not throw.
const legacyBlob = {
  posts: seeded1.posts,
  conversations: seeded1.conversations,
  messages: seeded1.messages,
  households: seeded1.households,
  passes: seeded1.passes,
};
let legacyOk = true;
try {
  seedCommunity(legacyBlob, PERSONAS);
} catch {
  legacyOk = false;
}
check('a pre-tombstone blob still seeds cleanly', legacyOk);
// loadCommunity rebuilds only the five original lists, so the newer keys must
// be defaulted on read — otherwise a take-down resurrects on the next reload.
const normalized = normalizeCommunity(legacyBlob);
check(
  'normalizeCommunity defaults tombstones and saves on a legacy blob',
  Array.isArray(normalized.removedPostIds) && Array.isArray(normalized.savedPostIds)
);
// And a reseed preserves the tombstone and save lists it did not write.
check(
  'reseeding preserves tombstones and saves it did not write',
  Array.isArray(reseeded.removedPostIds) && reseeded.removedPostIds.includes(victim.id)
);

/* ---------- (d) cross-tab merge unions without clobbering ---------- */
const postA = { id: 'ua-1', authorId: 'you', date: today, at: `${today}T10:00:00`, scope: { kind: 'everyone' }, caption: 'from tab A' };
const postB = { id: 'ub-1', authorId: 'you', date: today, at: `${today}T11:00:00`, scope: { kind: 'everyone' }, caption: 'from tab B' };
const msgA = { id: 'ma-1', conversationId: 'c-group', authorId: 'you', date: today, at: `${today}T10:00:00`, text: 'from tab A' };
const msgB = { id: 'mb-1', conversationId: 'c-group', authorId: 'you', date: today, at: `${today}T11:00:00`, text: 'from tab B' };
const stateA = {
  ...seeded1,
  posts: [...seeded1.posts, postA],
  messages: [...seeded1.messages, msgA],
  removedPostIds: [],
  savedPostIds: ['save-a'],
};
const stateB = {
  ...seeded1,
  posts: [...seeded1.posts, postB],
  messages: [...seeded1.messages, msgB],
  removedPostIds: [],
  savedPostIds: ['save-b'],
};
const merged = mergeCommunity(stateA, stateB);
check(
  'merge unions posts from both tabs',
  merged.posts.some(p => p.id === 'ua-1') && merged.posts.some(p => p.id === 'ub-1')
);
check(
  'merge unions messages from both tabs',
  merged.messages.some(m => m.id === 'ma-1') && merged.messages.some(m => m.id === 'mb-1')
);
check(
  'merge unions the private save marks',
  merged.savedPostIds.includes('save-a') && merged.savedPostIds.includes('save-b')
);
// The classic race: B's blob predates A's post. Locally present must survive.
check(
  'a locally-present post missing from the incoming blob survives',
  mergeCommunity(stateA, seeded1).posts.some(p => p.id === 'ua-1')
);
// Newer activity wins per entity, in both directions.
const older = { ...seeded1, messages: [{ id: 'm1', conversationId: 'c', authorId: 'x', date: today, at: `${today}T09:00:00`, text: 'old' }] };
const newer = { ...seeded1, messages: [{ id: 'm1', conversationId: 'c', authorId: 'x', date: today, at: `${today}T12:00:00`, text: 'new' }] };
check(
  'newer activity wins per entity, both directions',
  mergeCommunity(older, newer).messages.find(m => m.id === 'm1').text === 'new' &&
    mergeCommunity(newer, older).messages.find(m => m.id === 'm1').text === 'new'
);
// A status advance is a later write: the same-id, same-stamp tie goes to it.
const asked = { ...seeded1, messages: [{ id: 'm2', conversationId: 'c', authorId: 'x', date: today, text: 'q', request: { pieceName: 'Coat', status: 'asked' } }] };
const lent = { ...seeded1, messages: [{ id: 'm2', conversationId: 'c', authorId: 'x', date: today, text: 'q', request: { pieceName: 'Coat', status: 'lent' } }] };
check(
  'the later write wins a same-id status advance',
  mergeCommunity(asked, lent).messages.find(m => m.id === 'm2').request.status === 'lent'
);
// Tombstones union and beat the post, whichever side took it down.
const tA = { ...stateA, posts: stateA.posts.filter(p => p.id !== 'ub-1'), removedPostIds: ['ub-1'] };
const mT = mergeCommunity(tA, stateB);
check(
  'a tombstone in either tab takes the post down in the merge',
  !mT.posts.some(p => p.id === 'ub-1') && mT.removedPostIds.includes('ub-1')
);
// The loop guard: merging an identical blob is a no-op returning the same object.
check(
  'a no-op merge returns the same object (no write, no reply event)',
  mergeCommunity(stateA, structuredClone(stateA)) === stateA
);
// Entity sets converge: both merge orders, merged again, agree on the ids.
const idsOf = s => JSON.stringify([...s.posts.map(p => p.id)].sort());
check(
  'divergent tabs converge on the same set of posts',
  idsOf(mergeCommunity(mergeCommunity(stateA, stateB), mergeCommunity(stateB, stateA))) ===
    idsOf(mergeCommunity(mergeCommunity(stateB, stateA), mergeCommunity(stateA, stateB)))
);

/* ---------- (e) the persona activity engine ---------- */
const allScheduleIds = new Set();
for (const persona of PERSONAS) {
  const s1 = personaSchedule(persona, today);
  const s2 = personaSchedule(persona, today);
  check(`${persona.id}: the schedule is deterministic`, JSON.stringify(s1) === JSON.stringify(s2));
  check(
    `${persona.id}: ids are feed-<persona>-<date>`,
    s1.every(p => p.id === `feed-${persona.id}-${p.date}`)
  );
  check(
    `${persona.id}: the window holds — at most ${21} days, none ahead of today`,
    s1.length <= 21 && s1.every(p => p.date <= today && p.date >= addD(today, -20))
  );
  check(
    `${persona.id}: the wardrobe posts`,
    s1.length >= 1,
    `${s1.length} posts in 21 days`
  );
  check(
    `${persona.id}: posts are complete and well-spoken`,
    s1.every(
      p =>
        p.authorId === persona.id &&
        p.scope.kind === 'everyone' &&
        p.look &&
        p.look.pieces.length > 0 &&
        p.caption &&
        !p.caption.includes('!') &&
        !/\b(ladies|babe|queen|flattering|slimming)\b/i.test(p.caption) &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(p.at ?? '')
    ),
    s1[0]?.caption ?? ''
  );
  for (const p of s1) allScheduleIds.add(p.id);
}
// No persona wears another's day: ids never collide across the cast.
const totalScheduled = PERSONAS.reduce((n, p) => n + personaSchedule(p, today).length, 0);
check('schedule ids never collide across personas', allScheduleIds.size === totalScheduled);

// Genericity: a wardrobe nobody hardcoded gets a schedule shaped like itself.
const fake = {
  id: 'test-extra',
  slug: 'test-extra',
  name: 'Test Wardrobe',
  handle: '@test',
  age: '-', city: '-', job: '-',
  palette: { name: '-', colours: [] },
  philosophy: [], rules: [], neverWears: [], fragrance: '-', icons: [],
  leadImage: '', leadCaption: '',
  items: [
    { id: 'te-1', name: 'Wax jacket', category: 'outerwear', color: '#5E4232', colour: 'brown', fabric: '-', fit: '-', season: ['fall', 'winter'], occasion: ['casual'], cost: 0, tier: 'low', outfits: ['te-o1'] },
    { id: 'te-2', name: 'Corduroy trousers', category: 'bottoms', color: '#5E4232', colour: 'brown', fabric: '-', fit: '-', season: ['fall'], occasion: ['casual'], cost: 0, tier: 'low', outfits: ['te-o1'] },
  ],
  outfits: [
    { id: 'te-o1', name: 'Wet Sunday', category: 'casual', occasion: 'a wet sunday walk', season: 'fall', time: '-', weather: '-', image: '', itemIds: ['te-1', 'te-2'] },
  ],
  calendar: [],
};
const fakeSchedule = personaSchedule(fake, today);
check(
  'a persona nobody hardcoded still gets a valid schedule',
  fakeSchedule.every(p => p.id.startsWith('feed-test-extra-') && p.look?.name === 'Wet Sunday')
);

/* ---------- mergeSchedule ---------- */
const withFeed = mergeSchedule(seeded1, PERSONAS, today);
const feedCount = withFeed.posts.filter(p => p.id.startsWith('feed-')).length;
check('the schedule actually reaches the store', feedCount === totalScheduled, `${feedCount} posts`);
check('mergeSchedule is idempotent', mergeSchedule(withFeed, PERSONAS, today) === withFeed);
// A tombstoned schedule post stays down.
const someSched = withFeed.posts.find(p => p.id.startsWith('feed-'));
const tombstonedMerge = mergeSchedule({ ...seeded1, removedPostIds: [someSched.id] }, PERSONAS, today);
check(
  'a tombstoned schedule post is not re-added',
  !tombstonedMerge.posts.some(p => p.id === someSched.id)
);
// Pruning: schedule rows past the horizon fall out; user rows never do.
const oldDate = addD(today, -40);
const oldSched = { id: `feed-${PERSONAS[0].id}-${oldDate}`, authorId: PERSONAS[0].id, date: oldDate, scope: { kind: 'everyone' }, caption: 'old' };
const oldUser = { id: 'user-old-1', authorId: 'you', date: oldDate, scope: { kind: 'everyone' }, caption: 'mine, kept' };
const pruned = mergeSchedule(
  { ...seeded1, posts: [...seeded1.posts, oldSched, oldUser], removedPostIds: [oldSched.id] },
  PERSONAS,
  today
);
check('schedule posts older than 30 days are pruned', !pruned.posts.some(p => p.id === oldSched.id));
check('user-authored posts are never pruned', pruned.posts.some(p => p.id === 'user-old-1'));
check(
  'aged-out schedule tombstones go with their posts',
  !(pruned.removedPostIds ?? []).includes(oldSched.id)
);

/* ---------- (f) the scope rules still hold ---------- */
const convo = { id: 'c1', memberIds: ['a', 'b'], isGroup: false };
const house = {
  id: 'h1',
  kind: 'family',
  members: [{ accountId: 'a', joined: '2026-01-01' }, { accountId: 'c' }],
};
const mkPost = scope => ({
  id: 'p1',
  authorId: 'a',
  date: today,
  scope,
  look: { outfitId: 'o1', name: 'A look', pieces: ['A piece'] },
});
check('everyone scope is visible to another wardrobe', postVisibleTo(mkPost({ kind: 'everyone' }), 'b', [convo], [house]));
check('self scope is visible to the author alone', postVisibleTo(mkPost({ kind: 'self' }), 'a', [convo], [house]) && !postVisibleTo(mkPost({ kind: 'self' }), 'b', [convo], [house]));
check('person scope reaches only the named wardrobe', postVisibleTo(mkPost({ kind: 'person', accountId: 'b' }), 'b', [convo], [house]) && !postVisibleTo(mkPost({ kind: 'person', accountId: 'b' }), 'c', [convo], [house]));
check('conversation scope reaches members only', postVisibleTo(mkPost({ kind: 'conversation', conversationId: 'c1' }), 'b', [convo], [house]) && !postVisibleTo(mkPost({ kind: 'conversation', conversationId: 'c1' }), 'c', [convo], [house]));
check('an unanswered invitation shows nothing', !postVisibleTo(mkPost({ kind: 'household', householdId: 'h1' }), 'c', [convo], [house]));
check('authors always see their own', postVisibleTo(mkPost({ kind: 'household', householdId: 'h1' }), 'a', [convo], [house]));

console.log(fail === 0 ? '\nALL FEED CHECKS PASSED' : `\n${fail} FEED CHECKS FAILED`);
process.exit(fail ? 1 : 0);
