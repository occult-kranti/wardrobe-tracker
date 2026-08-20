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
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { existsSync, mkdtempSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'feed-'));
await build({ alias: sharedAliases(),
  entryPoints: {
    'lib/communitySeed': fileURLToPath(new URL('../src/lib/communitySeed.ts', import.meta.url)),
    'lib/feedEngine': fileURLToPath(new URL('../src/lib/feedEngine.ts', import.meta.url)),
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
    'components/social': fileURLToPath(new URL('../src/components/social.tsx', import.meta.url)),
    'lib/personaWardrobe': fileURLToPath(new URL('../src/lib/personaWardrobe.ts', import.meta.url)),
    'lib/bufferFeed': fileURLToPath(new URL('../src/lib/bufferFeed.ts', import.meta.url)),
    'lib/showing': fileURLToPath(new URL('../src/lib/showing.ts', import.meta.url)),
  },
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
const buffer = await import(pathToFileURL(join(dir, 'lib', 'bufferFeed.js')).href);
const showing = await import(pathToFileURL(join(dir, 'lib', 'showing.js')).href);

const { seedCommunity, mergeCommunity, normalizeCommunity } = seed;
const { personaSchedule, mergeSchedule } = engine;
const { EMPTY_COMMUNITY, postVisibleTo } = types;
const { newestFirst, oldestFirst, shortDate, qualifiesForRail, railDecks, RAIL_WINDOW_MS } = social;
const { PERSONAS } = pw;
const { BUFFER_FEED, commonsStoriesFor, interleaveCommons } = buffer;

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

/* ---------- (g) the en-IN date, everywhere the social surfaces speak ----------
   Owner decision 2026-08-19: the house locale is en-IN — day before month,
   "9 Aug", never "Aug 9". One function (shortDate) serves the feed, chats,
   events and profiles, so this one assertion covers them all. */
check('shortDate speaks en-IN: day before month', shortDate('2026-08-09') === '9 Aug', shortDate('2026-08-09'));
check('shortDate tolerates the undated row', shortDate(undefined) === '');
check('shortDate passes garbage through rather than throwing', shortDate('not-a-date') === 'not-a-date');

/* ---------- (h) the story rail: membership is COMPUTED, never stored ----------
   A post joins the rail iff it is under 24 hours old by local time. Nothing is
   written, nothing expires from storage — after 24h only the rail forgets.
   The boundary is asserted a minute either side, and the day-granular seeded
   post is a story on its own day and not the next. */
const NOW = new Date(`${today}T10:00:00`).getTime();
const min = 60 * 1000;
check('rail window is 24 hours exactly', RAIL_WINDOW_MS === 24 * 60 * 60 * 1000, String(RAIL_WINDOW_MS));
const atMs = ms => {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${fmt(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
check(
  'a post 23h59 old is on the rail',
  qualifiesForRail({ at: atMs(NOW - (24 * 60 - 1) * min) }, NOW)
);
check(
  'a post 24h01 old is not',
  !qualifiesForRail({ at: atMs(NOW - (24 * 60 + 1) * min) }, NOW)
);
check(
  'a day-granular post is a story on its own day',
  qualifiesForRail({ date: today }, NOW)
);
check(
  'and not the day after',
  !qualifiesForRail({ date: addD(today, -1) }, NOW)
);
check('an undated row never reaches the rail', !qualifiesForRail({}, NOW));

/* railDecks: yours first, then authors by newest qualifying post; within a
   deck the day is told oldest → newest. Ids fight the timestamps on purpose. */
const mkAcc = id => ({ id, name: id, handle: `@${id}`, monogram: 'XX', color: '', createdAt: today });
const railEntries = [
  { post: { id: 'z1', authorId: 'them-quiet', date: today, at: atMs(NOW - 60 * min), scope: { kind: 'everyone' }, caption: 'older' }, author: mkAcc('them-quiet') },
  { post: { id: 'a2', authorId: 'them-fresh', date: today, at: atMs(NOW - 10 * min), scope: { kind: 'everyone' }, caption: 'newest' }, author: mkAcc('them-fresh') },
  { post: { id: 'a3', authorId: 'me', date: today, at: atMs(NOW - 200 * min), scope: { kind: 'everyone' }, caption: 'mine' }, author: mkAcc('me') },
  { post: { id: 'a4', authorId: 'them-fresh', date: today, at: atMs(NOW - 30 * min), scope: { kind: 'everyone' }, caption: 'earlier same author' }, author: mkAcc('them-fresh') },
  { post: { id: 'a5', authorId: 'them-stale', date: addD(today, -3), scope: { kind: 'everyone' }, caption: 'off the rail' }, author: mkAcc('them-stale') },
];
const decks = railDecks(railEntries, 'me', NOW);
check(
  'railDecks: yours first, then newest teller, stale authors absent',
  JSON.stringify(decks.map(d => d.author.id)) === JSON.stringify(['me', 'them-fresh', 'them-quiet']),
  decks.map(d => d.author.id).join(',')
);
check(
  'railDecks: a deck tells its day oldest first',
  JSON.stringify(decks[1].posts.map(p => p.id)) === JSON.stringify(['a4', 'a2']),
  decks[1].posts.map(p => p.id).join(',')
);

/* ---------- (i) the commons buffer: bundled, labelled, capped ----------
   Every byte is local (public/feed-buffer/), every entry says it is a sample,
   and the interludes never outnumber one card in six. */
const publicDir = fileURLToPath(new URL('../public', import.meta.url));
check('the commons catalog is not empty', BUFFER_FEED.length > 0, `${BUFFER_FEED.length} entries`);
check(
  'every commons id is unique and wears the commons- prefix',
  new Set(BUFFER_FEED.map(b => b.id)).size === BUFFER_FEED.length &&
    BUFFER_FEED.every(b => b.id.startsWith('commons-'))
);
check(
  'every commons path is kebab-case under feed-buffer/',
  BUFFER_FEED.every(b => /^feed-buffer\/[a-z0-9]+(-[a-z0-9]+)*\.(webp|webm)$/.test(b.path)),
  BUFFER_FEED.find(b => !/^feed-buffer\/[a-z0-9]+(-[a-z0-9]+)*\.(webp|webm)$/.test(b.path))?.path ?? ''
);
check(
  'every commons path exists on disk',
  BUFFER_FEED.every(b => existsSync(join(publicDir, b.path))),
  BUFFER_FEED.filter(b => !existsSync(join(publicDir, b.path))).map(b => b.path).join(', ')
);
check(
  'every file shipped is in the catalog (no unlabelled stowaways)',
  readdirSync(join(publicDir, 'feed-buffer'))
    .filter(f => f !== 'CREDITS.md')
    .every(f => BUFFER_FEED.some(b => b.path === `feed-buffer/${f}`))
);
check('the credits ship beside the files', existsSync(join(publicDir, 'feed-buffer', 'CREDITS.md')));
check(
  'every commons entry is a sample and says so in type and in fact',
  BUFFER_FEED.every(b => b.sample === true)
);
check(
  'every commons caption is spoken, calm, and in the house voice',
  BUFFER_FEED.every(
    b =>
      typeof b.caption === 'string' &&
      b.caption.trim().length > 0 &&
      !b.caption.includes('!') &&
      !/\b(ladies|babe|queen|flattering|slimming)\b/i.test(b.caption)
  ),
  BUFFER_FEED.find(b => !b.caption || b.caption.includes('!'))?.id ?? ''
);
check('every commons entry carries its author for the credit line', BUFFER_FEED.every(b => b.author && b.author.trim().length > 0));
check(
  'every commons kind matches its file extension',
  BUFFER_FEED.every(b => (b.kind === 'video') === b.path.endsWith('.webm'))
);

/* The guests' story deck: deterministic per day, drawn from the catalog. */
const deckA = commonsStoriesFor(today);
check('the guests deal the same hand for the same day', JSON.stringify(deckA) === JSON.stringify(commonsStoriesFor(today)));
check('the hand comes from the catalog', deckA.every(b => BUFFER_FEED.includes(b)) && deckA.length > 0, `${deckA.length} dealt`);
check(
  'different days deal different hands',
  [addD(today, -1), addD(today, -2), addD(today, -3)].some(
    d => JSON.stringify(commonsStoriesFor(d)) !== JSON.stringify(deckA)
  )
);

/* The interlude cap: one guest in six, never two adjacent, never leading,
   never trailing — the grid ends where the real record ends. */
const realRun = Array.from({ length: 17 }, (_, i) => ({ id: `real-${i}` }));
const laid = interleaveCommons(realRun, BUFFER_FEED, today);
const guestsLaid = laid.filter(t => 'commons' in t).length;
check('interludes are capped at one in six', guestsLaid > 0 && guestsLaid / laid.length <= 1 / 6, `${guestsLaid} of ${laid.length}`);
check(
  'no two interludes sit adjacent',
  laid.every((t, i) => i === 0 || !('commons' in t) || !('commons' in laid[i - 1]))
);
check('a real card opens and closes the run', 'real' in laid[0] && 'real' in laid[laid.length - 1]);
check(
  'four real cards carry no interlude at all — the commons buffers, it does not replace',
  interleaveCommons(realRun.slice(0, 4), BUFFER_FEED, today).every(t => 'real' in t)
);
check(
  'the real cards keep their order under interleaving',
  JSON.stringify(laid.filter(t => 'real' in t).map(t => t.real.id)) === JSON.stringify(realRun.map(r => r.id))
);

/* ---------- (j) THE SHOWING: the band-dealing arithmetic (docs/41) ----------
   The Explore mosaic's size grammar. Size is a pure function of index, total,
   and column count — never of the post — and these pins are the spec's §9
   stress list run headless: turn indices, mirror parity, the tail guard, the
   hole check, the backward swap's invariants, month seams, the hem, and the
   search hay's hue and month words. */
const {
  variantFor, isTurnIndex, bandUnit, cycleOf, backwardSwap, seamsFor,
  monthKey, monthLabel, monthWords, hueWords,
  HEM_LINE, HEM_LINE_FILTERED, LAY_THRESHOLD,
} = showing;

const COLS = [2, 3, 4];

check(
  'the deal: units 5/6/9, cycles 5/12/18',
  bandUnit(2) === 5 && bandUnit(3) === 6 && bandUnit(4) === 9 &&
    cycleOf(2) === 5 && cycleOf(3) === 12 && cycleOf(4) === 18
);
check(
  'the corollary: the newest post opens the showing at full plate, every breakpoint',
  COLS.every(c => variantFor(0, 12, c) !== 'rack')
);
check(
  'phone: every fifth tile takes the turn, and the full-width turn never demotes',
  Array.from({ length: 21 }, (_, i) => variantFor(i, 21, 2)).every(
    (v, i) => v === (i % 5 === 0 ? 'turn' : 'rack')
  ) && variantFor(20, 21, 2) === 'turn'
);
check(
  '3 cols: turns at {0,7} mod 12, sides mirrored, racks everywhere else',
  variantFor(0, 24, 3) === 'turn' && variantFor(7, 24, 3) === 'turn-r' &&
    variantFor(12, 24, 3) === 'turn' && variantFor(19, 24, 3) === 'turn-r' &&
    [1, 2, 3, 4, 5, 6, 8, 9, 10, 11].every(i => variantFor(i, 24, 3) === 'rack')
);
check(
  '4 cols: turns at {0,11} mod 18, sides mirrored',
  variantFor(0, 36, 4) === 'turn' && variantFor(11, 36, 4) === 'turn-r' &&
    variantFor(18, 36, 4) === 'turn' && variantFor(29, 36, 4) === 'turn-r' &&
    variantFor(5, 36, 4) === 'rack' && variantFor(17, 36, 4) === 'rack'
);
check(
  'a twelve-post wall at md+ shows both turn sides — the acceptance still',
  variantFor(0, 12, 3) === 'turn' && variantFor(7, 12, 3) === 'turn-r'
);
check(
  'tail guard: the index-7 turn demotes on a nine-tile wall at 3 cols',
  variantFor(7, 9, 3) === 'rack' && variantFor(7, 10, 3) === 'turn-r'
);
check(
  'tail guard: 4 cols promotes only with four followers',
  variantFor(11, 14, 4) === 'rack' && variantFor(11, 16, 4) === 'turn-r' &&
    variantFor(18, 21, 4) === 'rack' && variantFor(18, 23, 4) === 'turn'
);
check(
  'five entries: the lay begins and the turn band closes at every breakpoint',
  variantFor(0, 5, 2) === 'turn' && variantFor(0, 5, 3) === 'turn' && variantFor(0, 5, 4) === 'turn'
);

/* The hole check (§9.4): simulate CSS grid auto-placement — sparse flow,
   cursor only ever forward, only the mirrored turn pinned to its columns —
   for every total 0–60 at every column count. A gap may exist only in the
   final row: a rag is a rag, never a hole. First-paint order must also stay
   monotone, because reading order is DOM order is tab order. */
function layOut(total, cols) {
  const grid = [];
  const ensure = r => { while (grid.length <= r) grid.push(Array(cols).fill(null)); };
  const fits = (r, c, w, h) => {
    if (c + w > cols) return false;
    for (let dr = 0; dr < h; dr++) {
      ensure(r + dr);
      for (let dc = 0; dc < w; dc++) if (grid[r + dr][c + dc] !== null) return false;
    }
    return true;
  };
  const place = (r, c, w, h, i) => {
    for (let dr = 0; dr < h; dr++) {
      ensure(r + dr);
      for (let dc = 0; dc < w; dc++) grid[r + dr][c + dc] = i;
    }
  };
  let cr = 0, cc = 0;
  for (let i = 0; i < total; i++) {
    const v = variantFor(i, total, cols);
    if (v === 'turn' && cols === 2) {
      if (cc > 0) { cr++; cc = 0; }
      while (!fits(cr, 0, 2, 1)) cr++;
      place(cr, 0, 2, 1, i);
      cr++; cc = 0;
    } else if (v === 'turn-r') {
      const c0 = cols === 3 ? 1 : 2; // grid-column 2/4 or 3/5, zero-based
      let r = cr + (c0 < cc ? 1 : 0);
      while (!fits(r, c0, 2, 2)) r++;
      place(r, c0, 2, 2, i);
      cr = r; cc = c0 + 2;
    } else {
      const w = v === 'turn' ? 2 : 1;
      const h = v === 'turn' ? 2 : 1;
      let r = cr, c = cc;
      for (;;) {
        if (c + w > cols) { r++; c = 0; continue; }
        if (fits(r, c, w, h)) break;
        c++;
      }
      place(r, c, w, h, i);
      cr = r; cc = c + w;
    }
    if (cc >= cols) { cr++; cc = 0; }
  }
  return grid;
}

{
  let holeFail = null, orderFail = null, bandFail = null;
  for (const c of COLS) {
    const unit = bandUnit(c);
    for (let total = 0; total <= 60; total++) {
      const grid = layOut(total, c);
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (r < grid.length - 1) {
          if (row.some(x => x === null)) holeFail ??= `cols ${c} total ${total} row ${r}`;
        } else {
          const lastFilled = row.reduce((m, x, idx) => (x !== null ? idx : m), -1);
          if (row.slice(0, lastFilled + 1).some(x => x === null)) {
            holeFail ??= `cols ${c} total ${total} final row`;
          }
        }
      }
      const seen = [];
      for (const row of grid) for (const x of row) if (x !== null && !seen.includes(x)) seen.push(x);
      if (seen.some((x, k) => k > 0 && x < seen[k - 1])) orderFail ??= `cols ${c} total ${total}`;
      for (let s = 0; s + unit <= total; s += unit) {
        let turns = 0;
        for (let i = s; i < s + unit; i++) if (variantFor(i, total, c) !== 'rack') turns++;
        if (turns !== 1) bandFail ??= `cols ${c} total ${total} band ${s / unit}: ${turns} turns`;
      }
    }
  }
  check('hole check, totals 0–60 × every column count: a rag only, never a hole', holeFail === null, holeFail ?? '');
  check('reading order stays monotone under every deal', orderFail === null, orderFail ?? '');
  check('every complete band deals exactly one turn', bandFail === null, bandFail ?? '');
}

/* The guest step-aside (§2.5). First pin the arithmetic the swap assumes to
   interleaveCommons' real output, then the swap's own invariants. */
{
  const run = interleaveCommons(Array.from({ length: 40 }, (_, i) => ({ id: `r${i}` })), BUFFER_FEED, today);
  check(
    'interleaveCommons deals guests at output indices 6k+5 — the arithmetic the swap assumes',
    run.length === 47 && run.every((t, i) => ('commons' in t) === (i % 6 === 5))
  );
  const guestIdx = Array.from({ length: 60 }, (_, k) => 6 * k + 5);
  check('collisions are arithmetic: the phone collides at i ≡ 5 (mod 30)', guestIdx.every(i => isTurnIndex(i, 2) === (i % 30 === 5)));
  check('3 columns never collides', guestIdx.every(i => !isTurnIndex(i, 3)));
  check('4 columns collides on every third guest', guestIdx.every(i => isTurnIndex(i, 4) === (i % 18 === 11)));
}

{
  let swapFail = null;
  for (const c of COLS) {
    for (let n = 1; n <= 40; n++) {
      for (const date of [today, addD(today, -1), addD(today, -7)]) {
        const reals = () => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));
        const laid = interleaveCommons(reals(), BUFFER_FEED, date);
        const dealt = backwardSwap(laid, t => 'commons' in t, c);
        const again = backwardSwap(interleaveCommons(reals(), BUFFER_FEED, date), t => 'commons' in t, c);
        if (JSON.stringify(dealt) !== JSON.stringify(again)) swapFail ??= `not deterministic: cols ${c} n ${n}`;
        dealt.forEach((t, i) => {
          if ('commons' in t && isTurnIndex(i, c)) swapFail ??= `guest on a turn: cols ${c} n ${n} i ${i}`;
          if (i > 0 && 'commons' in t && 'commons' in dealt[i - 1]) swapFail ??= `adjacent non-reals: cols ${c} n ${n} i ${i}`;
        });
        // The window density, pinned as PROVED rather than as the spec's §2.5
        // prose claims it: the interleave deals two guests per twelve slots
        // (6k+5), and one backward swap at a window's right edge can slide a
        // third one in (swap sites sit ≥ 18 apart, so never a fourth) — e.g.
        // cols 2, guests 23·29·35→34. The spec's "never more than two" is
        // arithmetically false under its own ratified mechanism; the true
        // bounds are two before the swap, three after, ratio cap unchanged.
        const window12 = (run, cap, label) => {
          for (let w = 0; w + 12 <= run.length; w++) {
            if (run.slice(w, w + 12).filter(t => 'commons' in t).length > cap) {
              swapFail ??= `${label}: cols ${c} n ${n} at ${w}`;
            }
          }
        };
        window12(laid, 2, 'more than two guests per twelve before the swap');
        window12(dealt, 3, 'more than three guests per twelve after the swap');
        if (dealt.filter(t => 'commons' in t).length !== laid.filter(t => 'commons' in t).length) {
          swapFail ??= `the swap changed the guest count: cols ${c} n ${n}`;
        }
        const realsOut = dealt.filter(t => 'real' in t).map(t => t.real.id);
        if (JSON.stringify(realsOut) !== JSON.stringify(Array.from({ length: n }, (_, i) => `r${i}`))) {
          swapFail ??= `a look changed position because of a guest: cols ${c} n ${n}`;
        }
        if (!('real' in dealt[0]) || !('real' in dealt[dealt.length - 1])) {
          swapFail ??= `a guest opened or closed the run: cols ${c} n ${n}`;
        }
      }
    }
  }
  check(
    'the backward swap holds the §2.5 invariants (window density as proved), 2/3/4 cols × 1–40 reals × three days',
    swapFail === null,
    swapFail ?? ''
  );
}

/* Month seams (§2.6): the deal never resets; the seam prints at the NEXT band
   boundary after the pour crosses a month; the label is the next band's first
   real post; guests are month-transparent. */
{
  const M = (ym, n) => Array.from({ length: n }, () => ym);
  const midBand = seamsFor([...M('2026-08', 7), ...M('2026-07', 11)], 3);
  check(
    'a mid-band crossing prints at the next band boundary, labelled by the next band',
    midBand.length === 1 && midBand[0].index === 12 && midBand[0].label === 'July 2026',
    JSON.stringify(midBand)
  );
  const atBoundary = seamsFor([...M('2026-08', 5), ...M('2026-07', 10)], 2);
  check(
    'a crossing exactly at a boundary prints there, once — the deal never resets',
    atBoundary.length === 1 && atBoundary[0].index === 5 && atBoundary[0].label === 'July 2026',
    JSON.stringify(atBoundary)
  );
  const skipped = seamsFor(['2026-08', '2026-08', '2026-08', '2026-07', '2026-06', ...M('2026-05', 7)], 2);
  check(
    'a run of skipped thin months yields one seam, labelled where the pour lands',
    skipped.length === 1 && skipped[0].index === 5 && skipped[0].label === 'May 2026',
    JSON.stringify(skipped)
  );
  check('twelve posts from one August produce zero seams', COLS.every(c => seamsFor(M('2026-08', 12), c).length === 0));
  const emptied = seamsFor([...M('2026-08', 6), ...M('2026-06', 6)], 3);
  check(
    'a month emptied by a filter prints no seam of its own',
    emptied.length === 1 && emptied[0].index === 6 && emptied[0].label === 'June 2026' &&
      emptied.every(s => !s.label.startsWith('July')),
    JSON.stringify(emptied)
  );
  // Guests are month-transparent, and a guest slid backward by the swap
  // cannot move a seam: the null trades seats with a same-month real.
  const withGuests = [...M('2026-08', 5), null, ...M('2026-08', 5), null, ...M('2026-08', 2), ...M('2026-07', 6)];
  const slid = withGuests.slice();
  [slid[10], slid[11]] = [slid[11], slid[10]];
  check(
    'guests are month-transparent and a slid guest moves no seam',
    JSON.stringify(seamsFor(withGuests, 4)) === JSON.stringify(seamsFor(slid, 4)) &&
      seamsFor(withGuests, 4).every(s => s.index % 9 === 0),
    JSON.stringify(seamsFor(withGuests, 4))
  );
  // Never mid-band, and the misfiled run above a seam never exceeds one band —
  // fuzzed over crossing cadences at every column count.
  let seamFail = null;
  for (const c of COLS) {
    const unit = bandUnit(c);
    for (let k = 1; k <= 7; k++) {
      // Absolute-month arithmetic so a cadence can walk back across year ends.
      const abs = 2026 * 12 + 7; // August 2026
      const months = Array.from({ length: 40 }, (_, i) => {
        const m = abs - Math.floor(i / k);
        return `${String(Math.floor(m / 12)).padStart(4, '0')}-${String((m % 12) + 1).padStart(2, '0')}`;
      });
      for (const s of seamsFor(months, c)) {
        if (s.index % unit !== 0) seamFail ??= `mid-band: cols ${c} cadence ${k} at ${s.index}`;
        const labelYm = months[s.index];
        for (let i = 0; i < s.index - unit; i++) {
          if (months[i] === labelYm) seamFail ??= `misfile over one band: cols ${c} cadence ${k} at ${s.index}`;
        }
      }
    }
  }
  check('seams sit on band boundaries and misfile at most one band, fuzzed', seamFail === null, seamFail ?? '');
  check('monthKey reads dates and refuses garbage', monthKey('2026-07-14') === '2026-07' && monthKey(undefined) === null && monthKey('nonsense') === null);
  check('monthLabel speaks the locator', monthLabel('2026-07') === 'July 2026' && monthLabel('2026-01') === 'January 2026');
}

/* The search hay (§4): month words and the honest hue-word mapper. */
check(
  'month words: march, mar, and the year each find the post',
  JSON.stringify(monthWords('2026-03-09')) === JSON.stringify(['march', 'mar', '2026']) &&
    monthWords(undefined).length === 0
);
{
  const hueTable = [
    ['#1F2A44', ['navy', 'blue']],
    ['#BE1231', ['carmine', 'red']],
    ['#C9A227', ['gold']],
    ['#111111', ['black']],
    ['#FFFFFF', ['white']],
    ['#808080', ['grey']],
    ['#F5EEDC', ['cream']],
    ['#D8C8A8', ['oatmeal']],
    ['#C8A878', ['tan']],
    ['#6B4A2F', ['brown']],
    ['#2E6B4F', ['green']],
    ['#E8A0B4', ['pink']],
    ['#3F5D7D', ['blue']],
  ];
  const wrong = hueTable.find(([hex, words]) => JSON.stringify(hueWords(hex)) !== JSON.stringify(words));
  check(
    'the hue-word table speaks the house words',
    wrong === undefined,
    wrong ? `${wrong[0]} said ${JSON.stringify(hueWords(wrong[0]))}` : ''
  );
  check('navy claims navy AND blue; plain blue never claims navy', hueWords('#1F2A44').includes('blue') && !hueWords('#3F5D7D').includes('navy'));
  check(
    'the mapper makes no claim it cannot make honestly',
    hueWords('tartan').length === 0 && hueWords(undefined).length === 0 && hueWords('#58305B').length === 0
  );
  check('short-form hexes parse', hueWords('#abc').length > 0 && hueWords('111').includes('black'));
}

/* ---- the sweeps a browser cannot walk (added by the STRESS squad) ----
   scripts/test-explore-stress.mjs renders real walls at real widths, but a
   page test can only ever hold one wall at a time. These are the properties
   that must hold across every wall the arithmetic can deal and every colour
   a person can type into a piece: totals by the hundred, hexes by the
   thousand. They live here because they are pure. */
{
  /* A wall never re-deals itself as posts arrive. The tail guard reads only
     how many tiles FOLLOW, so growing the wall may promote a rack to the
     turn but must never demote a turn already dealt, and must never flip a
     turn's side — otherwise every new post would resize the wall above it,
     which is precisely what §2.4 says never happens ("the arrangement is
     fixed once laid"). */
  let churn = null;
  for (const c of COLS) {
    for (let total = 1; total <= 120; total++) {
      for (let i = 0; i < total; i++) {
        const now = variantFor(i, total, c);
        const later = variantFor(i, total + 1, c);
        if (now !== 'rack' && later === 'rack') {
          churn ??= `cols ${c}: tile ${i} demoted when the wall grew to ${total + 1}`;
        }
        if (now !== 'rack' && later !== 'rack' && now !== later) {
          churn ??= `cols ${c}: tile ${i} changed sides when the wall grew to ${total + 1}`;
        }
      }
    }
  }
  check('growth never demotes a dealt turn or flips its side — a new post moves nothing above it', churn === null, churn ?? '');

  /* A seam is a locator, never a header and never a footer: it can never
     print above the newest tile, never below the last, and never mid-band —
     swept over 80 totals of mixed months with guests threaded through. */
  let bound = null;
  for (const c of COLS) {
    const unit = bandUnit(c);
    for (let n = 0; n <= 80; n++) {
      const months = Array.from({ length: n }, (_, i) =>
        i % 7 === 3 ? null : `2026-${String(((i * 3) % 12) + 1).padStart(2, '0')}`);
      for (const s of seamsFor(months, c)) {
        if (s.index < unit) bound ??= `cols ${c} n ${n}: a seam above the newest band, at ${s.index}`;
        if (s.index >= n) bound ??= `cols ${c} n ${n}: a seam below the last tile, at ${s.index}`;
        if (s.index % unit !== 0) bound ??= `cols ${c} n ${n}: a mid-band seam at ${s.index}`;
      }
    }
  }
  check('every seam lands inside the wall, on a band boundary — never a header, never a footer', bound === null, bound ?? '');
  check(
    'a run of nothing but guests prints no seam at all — guests are month-transparent',
    COLS.every(c => seamsFor(Array.from({ length: 40 }, () => null), c).length === 0)
  );

  /* The month table's own edges: January and December are where an
     off-by-one hides, and an impossible month must fall back to the year
     rather than to "undefined". */
  check(
    'month words at the table edges: January, December, and a month that cannot exist',
    JSON.stringify(monthWords('2026-01-01')) === JSON.stringify(['january', 'jan', '2026']) &&
      JSON.stringify(monthWords('2026-12-31')) === JSON.stringify(['december', 'dec', '2026']) &&
      JSON.stringify(monthWords('2026-13-01')) === JSON.stringify(['2026'])
  );

  /* The hue mapper, swept rather than sampled: 4,096 colours across the
     cube. Whatever it says must be a house word, it may never say two words
     that contradict each other, and the only two-word answers the house
     allows are the two ladders (navy/blue, carmine/red). A neutral must
     never be given a hue: a grey camisole called navy is the chip deferral's
     whole reason for existing. */
  const HOUSE_WORDS = new Set([
    'red', 'carmine', 'navy', 'blue', 'green', 'cream', 'oatmeal', 'tan',
    'brown', 'black', 'grey', 'gold', 'pink', 'white',
  ]);
  const OPPOSED = [['black', 'white'], ['black', 'cream'], ['white', 'grey'], ['navy', 'pink'], ['gold', 'grey']];
  let hueFail = null;
  const hexOf = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const hex = hexOf(r, g, b);
        const words = hueWords(hex);
        if (words.some(w => !HOUSE_WORDS.has(w))) hueFail ??= `${hex} said "${words.join('/')}", which is not a house word`;
        if (new Set(words).size !== words.length) hueFail ??= `${hex} repeated itself`;
        if (words.length > 2) hueFail ??= `${hex} claimed ${words.length} words`;
        if (words.length === 2 && !['navy/blue', 'carmine/red'].includes(words.join('/'))) {
          hueFail ??= `${hex} invented a ladder: ${words.join('/')}`;
        }
        for (const [x, y] of OPPOSED) {
          if (words.includes(x) && words.includes(y)) hueFail ??= `${hex} said both ${x} and ${y}`;
        }
      }
    }
  }
  check('the hue mapper stays inside the house table across the whole colour cube', hueFail === null, hueFail ?? '');
  let neutralFail = null;
  for (let v = 0; v < 256; v += 3) {
    const words = hueWords(hexOf(v, v, v));
    if (words.length !== 1 || !['black', 'grey', 'white'].includes(words[0])) {
      neutralFail ??= `${hexOf(v, v, v)} said ${JSON.stringify(words)}`;
    }
  }
  check('a neutral is never given a hue — every grey on the ladder answers black, grey, or white', neutralFail === null, neutralFail ?? '');
}

/* The hem and the lay threshold (§8). */
check(
  'the hem speaks the spec sentences, the one exclamation point assumed spent',
  HEM_LINE === 'That is everything on show.' &&
    HEM_LINE_FILTERED === 'That is everything that answers.' &&
    !HEM_LINE.includes('!') && !HEM_LINE_FILTERED.includes('!')
);
check('the lay begins at five', LAY_THRESHOLD === 5);

console.log(fail === 0 ? '\nALL FEED CHECKS PASSED' : `\n${fail} FEED CHECKS FAILED`);
process.exit(fail ? 1 : 0);
