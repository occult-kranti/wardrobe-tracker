/**
 * THE OUTFITS ROOM, SHOWCASE — the same room with the Look Book in the house.
 *
 * The branch `feed-showcase` differs from this one by exactly one line in
 * packages/shared/flags.ts (`= true`). That line is the only thing this file
 * mocks; the routes, the provider, the shared shelf and the room are the
 * shipped tree. So this suite is the OTHER half of the flag matrix —
 * outfits.test.tsx proves the alpha's room offers no share surface at all,
 * and this proves the one-line flip seats a working one on the outfit
 * itself, where the feed's own plaque already says it lives ("Sharing happens
 * one look at a time, from the outfit itself").
 *
 * IT IS ALSO WHERE R2 IS PROVED NOT TO HAVE OVERSHOT. The room took the web's
 * word — the masthead and every sentence in it say "outfit" — and the feed
 * KEPT its own: the share row on this very screen still says "look", because
 * a share is the Look Book's verb reaching in. Two words, one screen, each
 * meaning exactly one thing. That is the collision dissolved rather than
 * merely renamed, and the test below asserts both halves at once.
 *
 * Why a separate file: jest.mock is hoisted per module registry, so a flag
 * cannot hold two values inside one file. A second file is the honest way to
 * assert both branches rather than skipping one — the pattern
 * tabs-showcase.test.tsx set.
 *
 * WHAT IS ACTUALLY CHECKED HERE is the consent contract, not the pixels:
 *   - a share writes a SNAPSHOT (name, occasion, piece NAMES) — never a live
 *     reference into this wardrobe (toile-social §4);
 *   - the scope is chosen and stated in words before the tap;
 *   - taking it down leaves a TOMBSTONE, so a reseed cannot resurrect it;
 *   - nothing anywhere counts a view, a like, or a reader (§3).
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

// The one line the showcase branch changes, and nothing else.
jest.mock('@almari/shared/flags', () => ({ FEED_ENABLED: true }));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

import { todayLocal } from '@almari/shared/dates';
import { FEED_ENABLED } from '@almari/shared/flags';
import type { CommunityState } from '@almari/shared/types';

import { ACCOUNTS_KEY, COMMUNITY_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

const ACCOUNT = {
  id: 'acct-1',
  name: 'Test wardrobe',
  handle: '@test',
  monogram: 'T',
  color: '#105F7D',
  createdAt: '2026-08-01',
};

const piece = (id: string, name: string) => ({
  id,
  name,
  category: 'tops',
  color: '#D9C4A3',
  season: [],
  occasion: [],
  imageUrl: '',
  dateAdded: '2026-06-01',
  wearCount: 4,
  favorite: false,
  laundryStatus: 'clean',
});

const WARDROBE = JSON.stringify({
  schemaVersion: 8,
  items: [piece('i-oxford', 'The white oxford'), piece('i-jumper', 'The navy jumper')],
  outfits: [
    {
      id: 'o-blacks',
      name: 'Tuesday blacks',
      itemIds: ['i-oxford', 'i-jumper'],
      occasion: 'work',
      favorite: false,
      dateCreated: '2026-07-01T09:00:00.000Z',
      wearCount: 2,
    },
  ],
  wearLogs: [],
  wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [],
  photoEncoding: 'inline',
});

/** This wardrobe's own post about the look, for the already-shared half. */
const SHOWN = {
  id: 'p-mine',
  authorId: ACCOUNT.id,
  date: todayLocal(),
  scope: { kind: 'everyone' as const },
  look: {
    outfitId: 'o-blacks',
    name: 'Tuesday blacks',
    occasion: 'work',
    pieces: ['The white oxford', 'The navy jumper'],
  },
};

async function seed(posts: object[]) {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: ACCOUNT.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ACCOUNT]));
  await storage.setItem(wardrobeKey(ACCOUNT.id), WARDROBE);
  await storage.setItem(
    COMMUNITY_KEY,
    JSON.stringify({
      posts,
      conversations: [],
      messages: [],
      households: [],
      passes: [],
      removedPostIds: [],
      savedPostIds: [],
    }),
  );
}

/** The shared shelf, which the community store writes through immediately. */
async function shelf(): Promise<CommunityState> {
  const raw = await storage.getItem(COMMUNITY_KEY);
  return JSON.parse(raw ?? '{}') as CommunityState;
}

async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(12000);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  await seed([]);
});

describe('showing a look, with the Look Book in the house', () => {
  test('the flag is the only difference, and it seats a share row on the outfit', async () => {
    expect(FEED_ENABLED).toBe(true);
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });

    expect(await shell.findByText('Not shared')).toBeTruthy();
    expect(shell.getByText('Share this look')).toBeTruthy();
    // No metric rides along with it (toile-social §3).
    expect(shell.queryByText(/\bview(s|ed)?\b/i)).toBeNull();
    expect(shell.queryByText(/seen by/i)).toBeNull();

    await settle();
  });

  test('R2: the room speaks "outfit" and the feed keeps "look", on one screen', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });
    await shell.findByText('Not shared');

    // THE ROOM'S OWN VERBS took the web's word — every one of them.
    expect(shell.getByText('Amend this outfit')).toBeTruthy();
    expect(shell.getByText('Remove this outfit')).toBeTruthy();
    expect(shell.getByText('Back to the outfits')).toBeTruthy();
    expect(shell.queryByText('Amend this look')).toBeNull();
    expect(shell.queryByText('Remove this look')).toBeNull();

    // THE FEED'S VERB KEPT ITS OWN — the one place "look" still belongs, and
    // the reason R2 is a boundary rather than a find-and-replace. Renaming
    // this too would have moved the collision instead of dissolving it.
    expect(shell.getByText('Share this look')).toBeTruthy();

    await settle();
  });

  test('sharing writes a snapshot at the chosen scope, and says who can see it', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });
    fireEvent.press(await shell.findByText('Share this look'));

    // The scope is a choice, stated in words rather than as a label to decode.
    expect(await shell.findByText('Everyone here')).toBeTruthy();
    expect(shell.getByText('Only this wardrobe')).toBeTruthy();
    expect(shell.getByText('Every wardrobe on this device can see it.')).toBeTruthy();
    fireEvent.press(shell.getByText('Only this wardrobe'));
    expect(shell.getByText('It stays on your own profile and nowhere else.')).toBeTruthy();

    fireEvent.changeText(shell.getByLabelText('A line about it'), 'The good coat, finally out.');
    fireEvent.press(shell.getByText('Share it'));

    expect(
      await shell.findByText('On the feed. It stays on your own profile and nowhere else.'),
    ).toBeTruthy();

    await settle();
    const posts = (await shelf()).posts.filter(p => p.authorId === ACCOUNT.id);
    expect(posts).toHaveLength(1);
    const post = posts[0];
    expect(post.scope).toEqual({ kind: 'self' });
    expect(post.caption).toBe('The good coat, finally out.');
    expect(post.date).toBe(todayLocal());
    // A SNAPSHOT: the names travel, the pieces do not. Nothing here can be
    // followed back into this wardrobe's own records.
    expect(post.look?.outfitId).toBe('o-blacks');
    expect(post.look?.name).toBe('Tuesday blacks');
    expect(post.look?.occasion).toBe('work');
    expect(post.look?.pieces).toEqual(['The white oxford', 'The navy jumper']);
    expect(JSON.stringify(post.look)).not.toContain('i-oxford');

    // The room now reads back what the shelf says, not a flag of its own.
    expect(shell.getByText('On the feed')).toBeTruthy();
  });

  test('taking it down is confirmed, and leaves a tombstone so a reseed cannot undo it', async () => {
    await seed([SHOWN]);
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });

    expect(await shell.findByText('On the feed')).toBeTruthy();
    fireEvent.press(shell.getByText('Take it off the feed'));
    expect(
      await shell.findByText(
        /This takes “Tuesday blacks” off the feed for every wardrobe here.*The look itself stays in your outfits\./s,
      ),
    ).toBeTruthy();
    fireEvent.press(shell.getByText('Take it off'));

    expect(
      await shell.findByText('Taken off the feed. The look stays in your outfits.'),
    ).toBeTruthy();

    await settle();
    const state = await shelf();
    expect(state.posts.some(p => p.id === 'p-mine')).toBe(false);
    expect(state.removedPostIds).toContain('p-mine');

    // The look itself is untouched — the whole point of the sentence above.
    const wardrobe = JSON.parse((await storage.getItem(wardrobeKey(ACCOUNT.id))) ?? '{}');
    expect(wardrobe.outfits).toHaveLength(1);
    expect(wardrobe.outfits[0].wearCount).toBe(2);
  });
});
