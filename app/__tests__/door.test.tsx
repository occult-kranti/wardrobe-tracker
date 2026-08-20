/**
 * The door — first open, two honest starts.
 *
 * No stored wardrobe: the tabs redirect to /open, which offers "Start
 * empty" and "Walk through a sample". The sample is labelled sample
 * everywhere it lands (the account row's isSample — the flag the sync
 * client will refuse by — and the document's own sample marker), which is
 * the owner decision docs/35 records. Mirrors the registry/session shapes
 * scripts/test-sync.mjs reads on the web side.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';
import { SAMPLE_ACCOUNT_ID } from '../src/lib/sampleWardrobe';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('first open, no wardrobe on the device', () => {
  test('the shell walks straight to the door, and the door offers both starts', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/' });

    await waitFor(() => expect(shell.getPathname()).toBe('/open'));
    expect(await shell.findByText('Every wardrobe is its own closet.')).toBeTruthy();
    expect(shell.getByText('Start empty')).toBeTruthy();
    expect(shell.getByText('Walk through a sample')).toBeTruthy();
  });

  test('"Start empty" opens a genuinely empty record and writes the registry', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Start empty'));

    await waitFor(() => expect(shell.getPathname()).toBe('/'));
    expect(await shell.findByText('Nothing in the closet yet.')).toBeTruthy();

    const session = JSON.parse((await storage.getItem(SESSION_KEY)) as string);
    expect(typeof session.activeId).toBe('string');
    const accounts = JSON.parse((await storage.getItem(ACCOUNTS_KEY)) as string);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Wardrobe');
    expect(accounts[0].isSample).toBeUndefined();
    // The wardrobe document exists and is empty — value at item #1.
    const doc = JSON.parse((await storage.getItem(wardrobeKey(session.activeId))) as string);
    expect(doc.items).toHaveLength(0);
  });

  test('"Walk through a sample" seeds the labelled sample and says so on Today', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Walk through a sample'));

    await waitFor(() => expect(shell.getPathname()).toBe('/'));
    // The label is on the page, not buried in data.
    expect(await shell.findByText(/a sample, not your record/)).toBeTruthy();

    // Marked sample:true throughout — the registry row and the document.
    const accounts = JSON.parse((await storage.getItem(ACCOUNTS_KEY)) as string);
    const row = accounts.find((a: { id: string }) => a.id === SAMPLE_ACCOUNT_ID);
    expect(row.isSample).toBe(true);
    const doc = JSON.parse((await storage.getItem(wardrobeKey(SAMPLE_ACCOUNT_ID))) as string);
    expect(doc.sample).toBe(true);
    expect(doc.items.length).toBeGreaterThanOrEqual(8);
    expect(doc.items.length).toBeLessThanOrEqual(10);
    expect(doc.items.every((i: { sample?: boolean }) => i.sample === true)).toBe(true);
    // A sample arrives with a record to look at, not an empty rail.
    expect(doc.wearLogs.length).toBeGreaterThan(0);
  });
});

describe('the door with a wardrobe already open', () => {
  test('names the wardrobe and steps through', async () => {
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
    await storage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([
        { id: 'acct-1', name: 'The weekday closet', handle: '@weekday', monogram: 'W', color: '#105F7D', createdAt: '2026-08-01' },
      ]),
    );
    await storage.setItem(wardrobeKey('acct-1'), JSON.stringify({ items: [] }));

    const shell = renderRouter('./src/app', { initialUrl: '/open' });
    expect(await shell.findByText('"The weekday closet" is open on this device.')).toBeTruthy();
    expect(shell.getByText('Step through to Today')).toBeTruthy();
  });
});
