/**
 * The story viewer — view-only, tap-through, the commons island, and the
 * reduced-motion stillness. Mirrors the web Story's semantics (src/pages/
 * Feed.tsx): nothing recorded, no seen-state, a walk through real decks
 * never slides into the guest deck.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { todayLocal } from '@almari/shared/dates';

import { ACCOUNTS_KEY, COMMUNITY_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';
import { commonsStoriesFor } from '../src/lib/bufferFeedNative';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

const DOC = JSON.stringify({ schemaVersion: 8, items: [], outfits: [], wearLogs: [] });

/** Two of this wardrobe's own looks, on show within the last day. */
const myPost = (n: number, hour: string) => ({
  id: `post-mine-${n}`,
  authorId: 'acct-1',
  date: todayLocal(),
  at: `${todayLocal()}T${hour}:00:00`,
  caption: `Caption the ${n === 1 ? 'first' : 'second'}.`,
  scope: { kind: 'everyone' as const },
  look: {
    outfitId: `o-${n}`,
    name: `Own look ${n}`,
    pieces: ['The white oxford'],
  },
});

const seedCommunity = async (posts: unknown[]) => {
  await storage.setItem(
    COMMUNITY_KEY,
    JSON.stringify({ posts, conversations: [], messages: [], households: [], passes: [] }),
  );
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

describe('the story viewer', () => {
  test('your own deck plays: frames oldest first, tap-through advances', async () => {
    await seedCommunity([myPost(2, '18'), myPost(1, '09')]);
    const shell = renderRouter('./src/app', { initialUrl: '/story/acct-1' });

    // Oldest first — the honest telling of a day.
    expect(await shell.findByText('Caption the first.')).toBeTruthy();
    expect(shell.getByText('Test wardrobe')).toBeTruthy();

    fireEvent.press(shell.getByLabelText('The next look'));
    expect(await shell.findByText('Caption the second.')).toBeTruthy();

    // And back again — the deck walks both ways.
    fireEvent.press(shell.getByLabelText('The look before'));
    expect(await shell.findByText('Caption the first.')).toBeTruthy();
  });

  test('the commons is an island: the walk past the last real deck ends at the feed', async () => {
    await seedCommunity([myPost(1, '09')]);
    const shell = renderRouter('./src/app', { initialUrl: '/story/acct-1' });
    await shell.findByText('Caption the first.');

    // One frame in the only real deck; the next deck on the shelf is the
    // guests'. The step must close to the feed, never slide into it.
    fireEvent.press(shell.getByLabelText('The next look'));
    expect((await shell.findAllByText('Look Book')).length).toBeGreaterThan(0);
    expect(shell.queryByText('from the commons')).toBeNull();
  });

  test('the guests’ deck opens only by its own door, labelled on every surface', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/story/commons' });

    expect(await shell.findByText('Guests')).toBeTruthy();
    expect(shell.getByText('from the commons')).toBeTruthy();
    // The day's first guest, deterministic by date, credited and marked sample.
    const first = commonsStoriesFor(todayLocal())[0];
    expect(shell.getByText(first.caption)).toBeTruthy();
    expect(shell.getByText(`from the commons · ${first.author} · sample`)).toBeTruthy();
  });

  test('backing out of the first frame stays put — the island holds both ways', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/story/commons' });
    const first = commonsStoriesFor(todayLocal())[0];
    await shell.findByText(first.caption);

    fireEvent.press(shell.getByLabelText('The look before'));
    expect(shell.getByText(first.caption)).toBeTruthy();
  });

  test('the 5-second hand advances a playing deck', async () => {
    await seedCommunity([myPost(2, '18'), myPost(1, '09')]);
    const shell = renderRouter('./src/app', { initialUrl: '/story/acct-1' });
    await shell.findByText('Caption the first.');

    await act(async () => {
      jest.advanceTimersByTime(5300);
    });
    expect(await shell.findByText('Caption the second.')).toBeTruthy();
  });

  test('under reduced motion nothing autoplays: advancing is tap only', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await seedCommunity([myPost(2, '18'), myPost(1, '09')]);
    const shell = renderRouter('./src/app', { initialUrl: '/story/acct-1' });
    await shell.findByText('Caption the first.');

    await act(async () => {
      jest.advanceTimersByTime(12000);
    });
    // Still the first frame — the hand never moved.
    expect(shell.getByText('Caption the first.')).toBeTruthy();
    expect(shell.queryByText('Caption the second.')).toBeNull();

    // The reader still walks at their own pace.
    fireEvent.press(shell.getByLabelText('The next look'));
    expect(await shell.findByText('Caption the second.')).toBeTruthy();
  });

  test('a deck that never existed sends the reader back to the feed', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/story/nobody' });
    expect((await shell.findAllByText('Look Book')).length).toBeGreaterThan(0);
  });
});
