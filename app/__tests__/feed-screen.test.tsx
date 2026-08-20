/**
 * The Look Book — sample content resolves, own looks appear, samples are
 * labelled, no counts anywhere, and a web-relative photograph renders the
 * typographic specimen, never a broken image.
 *
 * Rendered through the real router tree — provider, storage and the
 * community shelf included, exactly as the other screen suites do.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { todayLocal } from '@almari/shared/dates';
import { FEED_ENABLED } from '@almari/shared/flags';
import type { CommunityState } from '@almari/shared/types';

import { ACCOUNTS_KEY, COMMUNITY_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

const DOC = JSON.stringify({
  schemaVersion: 8,
  items: [],
  outfits: [],
  wearLogs: [],
});

/** A look this wardrobe put on show itself, stamped now so it leads the feed. */
const MY_POST = {
  id: 'post-mine-1',
  authorId: 'acct-1',
  date: todayLocal(),
  at: `${todayLocal()}T09:00:00`,
  caption: 'The shawl carried the whole evening.',
  scope: { kind: 'everyone' as const },
  look: {
    outfitId: 'o-mine',
    name: 'The evening shawl look',
    occasion: 'dinner on the terrace',
    pieces: ['The grandmother’s shawl', 'Charcoal wool trousers'],
  },
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: 'var(--color-accent)', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey('acct-1'), DOC);
});

/**
 * THE FLAG BRANCHES BOTH WAYS (docs/42 §2 and its suite matrix). Nothing here
 * is skipped or deleted — the Look Book is HIDDEN, not gone, and both halves
 * of that sentence are assertions.
 *
 * Flag OFF (this branch): every one of these addresses must land on Today
 * SILENTLY. No plaque, no explainer, no trace of the room's own words. That
 * is the alpha's contract and it is checked on every case below rather than
 * once in a corner.
 *
 * Flag ON (branch feed-showcase, which differs by one line): the original
 * assertions run unchanged, because the room is in the house again.
 *
 * Returns true when the caller should go on to the flag-on assertions.
 */
async function lookBookOrToday(shell: ReturnType<typeof renderRouter>): Promise<boolean> {
  if (FEED_ENABLED) return true;
  await waitFor(() => expect(shell.getPathname()).toBe('/'));
  // None of the Look Book's own words survive the redirect.
  expect(shell.queryByText('Newest first. That is the whole order.')).toBeNull();
  expect(shell.queryByText('On show in the last day')).toBeNull();
  expect(shell.queryAllByTestId('specimen-card')).toHaveLength(0);
  return false;
}

describe('the Look Book', () => {
  test('sample content resolves, newest first, and says it is a sample', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    if (!(await lookBookOrToday(shell))) return;

    // The newest sample post (two days back) and the masthead's ledger count —
    // the name sets twice on a specimen card (the plate and the ledger line).
    expect((await shell.findAllByText('Oxblood at Indian Accent', { exact: false })).length).toBeGreaterThan(0);
    expect(shell.getByText('11 shared')).toBeTruthy();
    expect(shell.getByText('Newest first. That is the whole order.')).toBeTruthy();

    // Every sample card wears the label.
    expect(shell.getAllByText('sample wardrobe').length).toBeGreaterThan(0);

    // The rail is present, and the commons keeps it company as labelled guests.
    expect(shell.getByText('On show in the last day')).toBeTruthy();
    expect(shell.getByText('Guests')).toBeTruthy();
  });

  test('a web-relative photograph renders the typographic specimen, never a broken image', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    if (!(await lookBookOrToday(shell))) return;
    await shell.findByText('11 shared');

    const specimens = shell.getAllByTestId('specimen-card');
    expect(specimens.length).toBeGreaterThan(0);
    // The specimen is the look set in type: name, pieces, the wearer's line.
    const oxblood = specimens.find(s => within(s).queryByText('Oxblood at Indian Accent'));
    expect(oxblood).toBeTruthy();
    expect(within(oxblood!).getByText('worn by Meher Kapoor')).toBeTruthy();
    expect(within(oxblood!).getByText('Longline wool coat')).toBeTruthy();
  });

  test('no counts anywhere: no likes, followers, views or seen-by ever render', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    if (!(await lookBookOrToday(shell))) return;
    await shell.findByText('11 shared');
    for (const banned of [/\blikes?\b/i, /\bfollowers?\b/i, /\bviews?\b/i, /seen by/i, /\bstreak\b/i]) {
      expect(shell.queryByText(banned)).toBeNull();
    }
  });

  test('your own shared look appears, counted as yours, with the take-down gate', async () => {
    await storage.setItem(
      COMMUNITY_KEY,
      JSON.stringify({
        posts: [MY_POST],
        conversations: [],
        messages: [],
        households: [],
        passes: [],
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    if (!(await lookBookOrToday(shell))) return;

    expect(await shell.findByText('The shawl carried the whole evening.')).toBeTruthy();
    expect(shell.getByText('12 shared')).toBeTruthy();
    expect(shell.getByText('1 of your looks is on show. Each can be taken down from the card it sits on.')).toBeTruthy();
    expect(shell.getByText('Take it off the feed')).toBeTruthy();

    // The gate, then the tombstone: the removal is recorded, not just an absence.
    fireEvent.press(shell.getByText('Take it off the feed'));
    expect(await shell.findByText('Take it off')).toBeTruthy();
    fireEvent.press(shell.getByText('Take it off'));
    expect(await shell.findByText('Taken off the feed. The look stays in your outfits.')).toBeTruthy();

    await waitFor(async () => {
      const raw = await storage.getItem(COMMUNITY_KEY);
      const stored = JSON.parse(raw as string) as CommunityState;
      expect(stored.removedPostIds).toContain('post-mine-1');
      expect(stored.posts.some(p => p.id === 'post-mine-1')).toBe(false);
    });
  });

  test('set aside is private, filterable, and counted nowhere', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    if (!(await lookBookOrToday(shell))) return;
    await shell.findByText('11 shared');

    fireEvent.press(shell.getByLabelText('Set "Oxblood at Indian Accent" aside'));
    expect(await shell.findByText('Set aside. Only this device keeps the mark.')).toBeTruthy();

    // The one filter exists only now that something is set aside.
    const chips = await shell.findByLabelText('Set aside');
    fireEvent.press(chips);
    expect(shell.getByLabelText('Put "Oxblood at Indian Accent" back')).toBeTruthy();
    expect(shell.queryAllByText('Sangeet Bandhgala', { exact: false })).toHaveLength(0);

    // The mark lands on the shelf as a private list, never a number on a card.
    await waitFor(async () => {
      const raw = await storage.getItem(COMMUNITY_KEY);
      const stored = JSON.parse(raw as string) as CommunityState;
      expect(stored.savedPostIds).toContain('post-meher-MK-17');
    });
  });

  test('sample posts do not offer the take-down: the verb belongs to the author alone', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/feed' });
    if (!(await lookBookOrToday(shell))) return;
    await shell.findByText('11 shared');
    expect(shell.queryByText('Take it off the feed')).toBeNull();
    // A look post that is not yours carries Attach — the Show verb.
    expect(shell.getAllByText('Attach').length).toBeGreaterThan(0);
  });
});
