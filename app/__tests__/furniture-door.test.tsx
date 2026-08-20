/**
 * THE DRESSING ROOM'S DOOR — lead ruling R7, held to.
 *
 * The two furniture routes have no slot on the house bar, so nothing stops a
 * deep link reaching them on a phone that has never opened a wardrobe: a link
 * in a message, a link in the alpha kit, a link somebody pasted. Before R7 that
 * landed on an empty dressing room with a "Back to the closet" button pointing
 * at a closet that did not exist either, and on a place screen answering "That
 * place is not in this wardrobe" about a wardrobe nobody had made. Both are
 * answers to a question that was never asked; the door is the answer.
 *
 * WHAT IS ACTUALLY BEING PROTECTED, and it is not tidiness: /open is where a
 * wardrobe gets MADE, and a person who cannot reach it has an app with no way
 * in. The four rooms on the bar have carried this gate since Wave 5
 * ((tabs)/_layout.tsx); these two were the ones left outside it.
 *
 * The 'loading' beat is asserted separately because it is the half that is easy
 * to drop: without it the shelf's own answer races the redirect, and a wardrobe
 * that exists sends its owner to the door on the strength of an answer that had
 * not arrived yet.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

const ROW = {
  id: 'acct-1',
  name: 'The weekday closet',
  handle: '@weekday',
  monogram: 'W',
  color: '#105F7D',
  createdAt: '2026-03-14',
};

const CHEST = {
  id: 'f-1',
  name: 'Bedroom chest',
  form: 'chest',
  slots: [{ id: 'f-1-s1', label: 'Top drawer' }],
  dateAdded: '2026-06-01',
};

async function seedWardrobe() {
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ROW]));
  await storage.setItem(
    wardrobeKey('acct-1'),
    JSON.stringify({ items: [], furniture: [CHEST] }),
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('R7 — a furniture route opened cold, with no wardrobe on the device', () => {
  test('the dressing room sends you to the door', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    await waitFor(() => expect(shell.getPathname()).toBe('/open'));
  });

  test('one place sends you to the door too', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-1' });
    await waitFor(() => expect(shell.getPathname()).toBe('/open'));
  });

  test('the door is reached SILENTLY — no plaque explaining what was missed', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });
    await waitFor(() => expect(shell.getPathname()).toBe('/open'));

    // A door that is not in the house this season gets no sign saying so, and
    // a wardrobe that was never made gets no notice about the one it lacks.
    for (const plaque of [
      /dressing room/i,
      /no wardrobe/i,
      /you need/i,
      /first make/i,
      /not available/i,
    ]) {
      expect(shell.queryByText(plaque)).toBeNull();
    }
  });
});

describe('R7 — the gate lets a real wardrobe through, and does not flash the door at it', () => {
  test('the dressing room opens on a device that has one', async () => {
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });

    expect(await shell.findByText('Dressing room')).toBeTruthy();
    expect(shell.getPathname()).toBe('/furniture');
  });

  test('one place opens on a device that has one', async () => {
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/furniture/f-1' });

    expect(await shell.findByText('Bedroom chest')).toBeTruthy();
    expect(shell.getPathname()).toBe('/furniture/f-1');
  });

  test('the shelf is asked before the door is — no redirect while the answer is still coming', async () => {
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/furniture' });

    // The very first frame, before the store has answered: a blank beat on the
    // room's own paper, and NOT the door. A gate that treated 'loading' as
    // 'none' would already have navigated by now.
    expect(shell.getPathname()).toBe('/furniture');
    await shell.findByText('Dressing room');
    expect(shell.getPathname()).toBe('/furniture');
  });
});
