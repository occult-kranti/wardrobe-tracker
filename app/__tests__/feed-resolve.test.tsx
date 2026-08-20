/**
 * The feed's grammar, held to the web's — resolution, the rail boundary,
 * the asset seam, the verbs' params contract, and the sample seed's manners.
 *
 * Every semantic asserted here mirrors src/components/social.tsx or
 * src/lib/communitySeed.ts (read, never imported); the shapes come from
 * @almari/shared/types, the one source.
 */
import { describe, expect, test } from '@jest/globals';

import { addDays, todayLocal } from '@almari/shared/dates';
import { EMPTY_COMMUNITY, type Account, type CommunityState, type FeedPost } from '@almari/shared/types';

import {
  isRenderableImageUri,
  newestFirst,
  qualifiesForRail,
  railDecks,
  resolveFeedEntries,
  shortDate,
} from '../src/components/feed/feedResolve';
import { SAMPLE_AUTHORS, sampleFeedPosts, seedSampleFeed } from '../src/components/feed/sampleFeed';
import { askHref, attachHref } from '../src/components/feed/verbs';
import { BUFFER_FEED_NATIVE, commonsStoriesFor } from '../src/lib/bufferFeedNative';

const acct = (id: string, name = id): Account => ({
  id,
  name,
  handle: `@${id}`,
  monogram: name.slice(0, 1).toUpperCase(),
  color: 'var(--color-accent)',
  createdAt: '2026-08-01',
});

const post = (over: Partial<FeedPost> & Pick<FeedPost, 'id' | 'authorId'>): FeedPost => ({
  date: '2026-08-10',
  scope: { kind: 'everyone' },
  look: { outfitId: 'o1', name: 'A look', pieces: [] },
  ...over,
});

const community = (posts: FeedPost[]): CommunityState => ({
  ...EMPTY_COMMUNITY,
  posts,
});

describe('resolveFeedEntries — the one list every surface reads', () => {
  test('drops the authorless, the scopeless and the contentless; keeps the rest', () => {
    const accounts = [acct('a'), acct('b')];
    const posts = [
      post({ id: 'p-good', authorId: 'a' }),
      post({ id: 'p-ghost', authorId: 'nobody' }),
      { id: 'p-scopeless', authorId: 'a', date: '2026-08-10' } as unknown as FeedPost,
      { id: 'p-empty', authorId: 'a', date: '2026-08-10', scope: { kind: 'everyone' } } as FeedPost,
    ];
    const entries = resolveFeedEntries(accounts, community(posts), 'b');
    expect(entries.map(e => e.post.id)).toEqual(['p-good']);
    expect(entries[0].author.id).toBe('a');
  });

  test('a self-scoped post shows only to its author', () => {
    const accounts = [acct('a'), acct('b')];
    const posts = [post({ id: 'p-self', authorId: 'a', scope: { kind: 'self' } })];
    expect(resolveFeedEntries(accounts, community(posts), 'a')).toHaveLength(1);
    expect(resolveFeedEntries(accounts, community(posts), 'b')).toHaveLength(0);
  });

  test('newest first: `at` leads `date`, the id breaks the tie — the whole algorithm', () => {
    const accounts = [acct('a')];
    const posts = [
      post({ id: 'z-early', authorId: 'a', date: '2026-08-10', at: '2026-08-10T09:00:00' }),
      post({ id: 'a-late', authorId: 'a', date: '2026-08-10', at: '2026-08-10T21:00:00' }),
      post({ id: 'm-dated', authorId: 'a', date: '2026-08-11' }),
    ];
    const order = resolveFeedEntries(accounts, community(posts), 'a').map(e => e.post.id);
    // The web's exact reading: a row carrying `at` leads every unstamped row —
    // day-granular rows sort behind the timed ones (social.tsx newestFirst).
    expect(order).toEqual(['a-late', 'z-early', 'm-dated']);
    // The comparator itself tolerates a record with no date at all.
    expect(newestFirst({ id: 'x' }, { id: 'y', date: '2026-08-01' })).toBeGreaterThan(0);
  });
});

describe('the rail boundary — under 24 hours, by local time', () => {
  const now = Date.parse('2026-08-19T12:00:00');

  test('23h59 is on the rail; 24h01 has left it', () => {
    expect(qualifiesForRail({ at: '2026-08-18T12:01:00' }, now)).toBe(true);
    expect(qualifiesForRail({ at: '2026-08-18T11:59:00' }, now)).toBe(false);
  });

  test('a day-granular post is that day’s story, gone once its midnight is a day old', () => {
    expect(qualifiesForRail({ date: '2026-08-19' }, now)).toBe(true);
    expect(qualifiesForRail({ date: '2026-08-18' }, now)).toBe(false);
    expect(qualifiesForRail({ date: undefined }, now)).toBe(false);
  });

  test('decks: yours first, then newest tellers; frames oldest → newest', () => {
    const accounts = [acct('me'), acct('friend')];
    const posts = [
      post({ id: 'f2', authorId: 'friend', date: '2026-08-19', at: '2026-08-19T11:00:00' }),
      post({ id: 'f1', authorId: 'friend', date: '2026-08-19', at: '2026-08-19T09:00:00' }),
      post({ id: 'mine', authorId: 'me', date: '2026-08-19', at: '2026-08-19T08:00:00' }),
      post({ id: 'old', authorId: 'friend', date: '2026-08-01' }),
    ];
    const decks = railDecks(resolveFeedEntries(accounts, community(posts), 'me'), 'me', now);
    expect(decks.map(d => d.author.id)).toEqual(['me', 'friend']);
    expect(decks[1].posts.map(p => p.id)).toEqual(['f1', 'f2']);
  });
});

describe('the asset seam — what RN’s Image can actually render', () => {
  test('web-relative snapshot paths cannot render; schemed URIs can', () => {
    expect(isRenderableImageUri('wardrobe/aarav/AM-01.webp')).toBe(false);
    expect(isRenderableImageUri('/wardrobe/meher/MK-17.webp')).toBe(false);
    expect(isRenderableImageUri('')).toBe(false);
    expect(isRenderableImageUri(undefined)).toBe(false);
    expect(isRenderableImageUri('https://example.test/a.webp')).toBe(true);
    expect(isRenderableImageUri('data:image/png;base64,AAAA')).toBe(true);
    expect(isRenderableImageUri('file:///photos/full.jpg')).toBe(true);
  });
});

describe('the en-IN short date — day before month, the way the date is said here', () => {
  test('9 Aug, not Aug 9', () => {
    expect(shortDate('2026-08-09')).toBe('9 Aug');
    expect(shortDate('2026-01-31')).toBe('31 Jan');
    expect(shortDate(undefined)).toBe('');
    expect(shortDate('not-a-date')).toBe('not-a-date');
  });
});

describe('the verbs’ params contract — the web’s own shapes, JSON-encoded', () => {
  test('Attach carries the look on a look post, the piece on a piece post', () => {
    const lookPost = post({ id: 'p1', authorId: 'a' });
    const attached = attachHref(lookPost);
    expect(attached.pathname).toBe('/chats');
    expect(JSON.parse(attached.params.attach)).toEqual({ look: lookPost.look });

    const piecePost = post({
      id: 'p2',
      authorId: 'a',
      look: undefined,
      piece: { itemId: 'i1', name: 'The linen shirt', category: 'tops' },
    });
    expect(JSON.parse(attachHref(piecePost).params.attach)).toEqual({ piece: piecePost.piece });
  });

  test('Ask exists only where a piece does, and names the owner', () => {
    const piecePost = post({
      id: 'p3',
      authorId: 'vikram',
      look: undefined,
      piece: { itemId: 'i2', name: 'Bandhgala, ivory raw silk' },
    });
    const ask = askHref(piecePost);
    expect(ask).not.toBeNull();
    expect(JSON.parse(ask!.params.ask)).toEqual({
      pieceName: 'Bandhgala, ivory raw silk',
      ownerId: 'vikram',
    });
    expect(askHref(post({ id: 'p4', authorId: 'a' }))).toBeNull();
  });
});

describe('the sample seed — the web’s posts, the web’s manners', () => {
  const today = todayLocal();

  test('every sample post is authored by a labelled sample wardrobe, scope everyone', () => {
    const authorIds = new Set(SAMPLE_AUTHORS.map(a => a.id));
    for (const a of SAMPLE_AUTHORS) expect(a.isSample).toBe(true);
    const posts = sampleFeedPosts(today);
    expect(posts).toHaveLength(11);
    for (const p of posts) {
      expect(authorIds.has(p.authorId)).toBe(true);
      expect(p.scope).toEqual({ kind: 'everyone' });
      expect(p.id).toBe(`post-${p.authorId}-${p.look!.outfitId}`);
      // The snapshot keeps its web-relative photograph — the specimen's cue.
      expect(isRenderableImageUri(p.look!.imageUrl)).toBe(false);
    }
  });

  test('seeding is idempotent by id, and a tombstoned id stays down', () => {
    const first = seedSampleFeed({ ...EMPTY_COMMUNITY }, today);
    expect(first.posts).toHaveLength(11);
    // The same shelf, seeded again: nothing to add, the same object back.
    expect(seedSampleFeed(first, today)).toBe(first);

    const takenOff = {
      ...first,
      posts: first.posts.filter(p => p.id !== 'post-meher-MK-17'),
      removedPostIds: ['post-meher-MK-17'],
    };
    const reseeded = seedSampleFeed(takenOff, today);
    expect(reseeded.posts.some(p => p.id === 'post-meher-MK-17')).toBe(false);
  });

  test('dates pin to the seed day: the newest sample sits two days back', () => {
    const posts = sampleFeedPosts('2026-08-19');
    const newest = [...posts].sort((a, b) => b.date.localeCompare(a.date))[0];
    expect(newest.id).toBe('post-meher-MK-17');
    expect(newest.date).toBe(addDays('2026-08-19', -2));
  });
});

describe('the commons, native edition — guests, labelled, deterministic', () => {
  test('every entry is a sample with a photographer credited', () => {
    expect(BUFFER_FEED_NATIVE.length).toBeGreaterThan(0);
    for (const e of BUFFER_FEED_NATIVE) {
      expect(e.sample).toBe(true);
      expect(e.author.length).toBeGreaterThan(0);
      expect(e.id.startsWith('commons-')).toBe(true);
    }
  });

  test('the same day deals the same hand; tomorrow deals another', () => {
    const a = commonsStoriesFor('2026-08-19').map(e => e.id);
    const b = commonsStoriesFor('2026-08-19').map(e => e.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
    const later = Array.from({ length: 14 }, (_, i) =>
      commonsStoriesFor(addDays('2026-08-19', i + 1)).map(e => e.id).join()
    );
    // At least one of the next fortnight's hands differs — rotation is real.
    expect(later.some(hand => hand !== a.join())).toBe(true);
  });
});
