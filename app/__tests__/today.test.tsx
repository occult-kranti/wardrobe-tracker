/**
 * Today — the two-tap log, the day's record, the undo.
 *
 * Mirrors the web Dashboard's own copy byte for byte (the seal toast, the
 * first-wear note, the undo line) and the dates law scripts/test-dates.mjs
 * pins: what lands in the log is the LOCAL day from @almari/shared/dates.
 * Rendered through the real router tree — provider and storage included.
 *
 * RE-PINNED this wave: the week strip now stands behind Today (docs/42 §6).
 * The pins below say what that is allowed to cost, which is nothing — the
 * hero fill is still the way today is logged and the two-tap wall is still
 * two taps. The strip's own date truth (seven LOCAL days, the 23:30 and
 * 00:30 clocks, the month door, the marks) is pinned next door in
 * calendar-strip.test.tsx, where the clock can be faked without faking it
 * for the log tests here.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { todayLocal } from '@almari/shared/dates';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

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
  items: [
    {
      id: 'i-oxford', name: 'The white oxford', category: 'tops', color: '#F4EFE2',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 3, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i-jeans', name: 'Indigo jeans', category: 'bottoms', color: '#31415E',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01',
      wearCount: 2, favorite: false, laundryStatus: 'clean',
    },
    {
      id: 'i-linen', name: 'The good linen shirt', category: 'tops', color: '#D9C4A3',
      season: [], occasion: [], imageUrl: '', dateAdded: '2026-06-01',
      wearCount: 0, favorite: false, laundryStatus: 'clean',
    },
  ],
  outfits: [], wearLogs: [], wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [], furniture: [], photoEncoding: 'inline',
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([
      { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
    ]),
  );
  await storage.setItem(wardrobeKey('acct-1'), DOC);
});

describe('the two-tap log', () => {
  test('a blank day says so and offers the log', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();
    expect(shell.getByText("Two taps and it's on the record for good.")).toBeTruthy();
    expect(shell.getByText("Log today's wear")).toBeTruthy();
  });

  test('one piece: pick, one confirm tap, the seal toast', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    fireEvent.press(await shell.findByText("Log today's wear"));

    fireEvent.press(await shell.findByText('The white oxford'));
    fireEvent.press(shell.getByText('Log this'));

    expect(await shell.findByText('Logged. "The white oxford" worn 4 times.')).toBeTruthy();
    expect(await shell.findByText('On the record today')).toBeTruthy();
  });

  test('two pieces log together, the first wear is noted, and the log is a local day', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    fireEvent.press(await shell.findByText("Log today's wear"));

    fireEvent.press(await shell.findByText('Indigo jeans'));
    fireEvent.press(shell.getByText('The good linen shirt'));
    fireEvent.press(shell.getByText('Log 2 pieces'));

    // itemWears was 5; two more make 7 — the web's own sentence.
    expect(await shell.findByText('Logged. 2 pieces — 7 wears recorded.')).toBeTruthy();
    expect(await shell.findByText('Noted. "The good linen shirt" had its first wear.')).toBeTruthy();
    expect(await shell.findByText('Indigo jeans + The good linen shirt')).toBeTruthy();

    // The record on the shelf carries the LOCAL day (shared/dates law).
    // waitFor drives the settle window — the RN preset's timers are fake.
    await waitFor(async () => {
      const raw = await storage.getItem(wardrobeKey('acct-1'));
      const doc = JSON.parse(raw as string);
      expect(doc.wearLogs).toHaveLength(1);
      expect(doc.wearLogs[0].date).toBe(todayLocal());
    });
  });

  test('undo takes the wear off the record and reopens the day', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });
    fireEvent.press(await shell.findByText("Log today's wear"));
    fireEvent.press(await shell.findByText('The white oxford'));
    fireEvent.press(shell.getByText('Log this'));
    expect(await shell.findByText('On the record today')).toBeTruthy();

    fireEvent.press(shell.getByText('Undo'));
    expect(await shell.findByText('Undone. That wear is off the record.')).toBeTruthy();
    expect(await shell.findByText("Today's page is still blank.")).toBeTruthy();
  });
});

/* ---------- the calendar, standing behind Today (docs/42 §6) ---------- */

describe('the week strip stands behind Today, never in front of it', () => {
  test('seven days and a month door sit on the page, and the hero is untouched', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    // The month door at the strip's head — one tap to the deep archive.
    expect(await shell.findByLabelText(/^Open the month, /)).toBeTruthy();
    // Seven cells, and exactly one of them is today.
    expect(
      shell.getAllByLabelText(/, (not logged|planned|d+ pieces? on the record)$/),
    ).toHaveLength(7);
    // Anchored on the day's own state, because /^Today, / alone also catches
    // the house bar's slot label ("Today, tab 1 of 4") — a real label, and
    // not this one.
    expect(shell.getAllByLabelText(/^Today, .*(not logged|on the record)$/)).toHaveLength(1);
    // THE WALL IS THE WALL. The strip adds a door; it takes no tap from the
    // one gesture this screen exists for.
    expect(shell.getByText("Log today's wear")).toBeTruthy();
  });

  test("today's own cell fills in the moment a wear goes on the record", async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    fireEvent.press(await shell.findByText("Log today's wear"));
    fireEvent.press(await shell.findByText('The white oxford'));
    fireEvent.press(shell.getByText('Log this'));

    await waitFor(() =>
      expect(shell.getByLabelText(/^Today, .*, 1 piece on the record$/)).toBeTruthy(),
    );
  });
});
