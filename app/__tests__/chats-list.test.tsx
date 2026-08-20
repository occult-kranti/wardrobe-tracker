/**
 * Conversations, the list — the tab answers /chats, membership is the one
 * lock, no counts ride the rows, and the empty room can bring in the
 * sample wardrobes' threads (the chats slice of the web's installSamples).
 *
 * Rendered with expo-router's own testing library against the real src/app
 * directory, like every shell suite here. Fonts and splash mocked: jest has
 * no device to load a TTF onto.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { seedChatThreads } from '../src/components/chats/personaThreads';
import {
  ACCOUNTS_KEY,
  COMMUNITY_KEY,
  SESSION_KEY,
  storage,
  wardrobeKey,
} from '../src/lib/storage';

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

const ACCOUNTS = [
  { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
  { id: 'acct-2', name: 'Nadia Khan', handle: '@nadia', monogram: 'NK', color: '#8A5A2E', createdAt: '2026-08-01' },
  { id: 'acct-3', name: 'Farhan Ali', handle: '@farhan', monogram: 'FA', color: '#3B5D3A', createdAt: '2026-08-01' },
];

const COMMUNITY = {
  posts: [],
  households: [],
  passes: [],
  conversations: [
    { id: 'c-pair', memberIds: ['acct-1', 'acct-2'], isGroup: false },
    // A thread between two OTHER wardrobes on the device — never ours to list.
    { id: 'c-foreign', memberIds: ['acct-2', 'acct-3'], isGroup: false },
  ],
  messages: [
    { id: 'm1', conversationId: 'c-pair', authorId: 'acct-2', date: '2026-08-16', text: 'The shawl came home washed.' },
    { id: 'm2', conversationId: 'c-pair', authorId: 'acct-1', date: '2026-08-17', text: 'Good. It goes out again Friday.' },
    { id: 'm3', conversationId: 'c-foreign', authorId: 'acct-3', date: '2026-08-18', text: 'A line between two other wardrobes.' },
  ],
};

const WARDROBE_DOC = {
  schemaVersion: 8,
  items: [],
  outfits: [],
  wearLogs: [],
  wishlist: [],
  circle: { profiles: [], groups: [], messages: [], loans: [] },
  events: [],
  furniture: [],
  photoEncoding: 'inline',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(ACCOUNTS));
  await storage.setItem(wardrobeKey('acct-1'), JSON.stringify(WARDROBE_DOC));
  await storage.setItem(COMMUNITY_KEY, JSON.stringify(COMMUNITY));
});

describe('the conversations list', () => {
  test('the tab answers /chats and lists only threads the open wardrobe is in', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats' });

    // The pair thread, titled by the other member.
    expect(await shell.findByText('Nadia Khan')).toBeTruthy();
    expect(shell.getPathname()).toBe('/chats');
    expect(shell.getByText('1 open')).toBeTruthy();
    expect(shell.getByText('@test · Good. It goes out again Friday.')).toBeTruthy();

    // Membership is the lock: the foreign pair's thread does not exist here.
    expect(shell.queryByText('Farhan Ali')).toBeNull();
    expect(shell.queryByText(/A line between two other wardrobes/)).toBeNull();
  });

  test('the row carries a date and no message count — a thread is not a meter', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats' });

    // Exact match: were the web's trailing `· 2` ported, '17 Aug' alone
    // would not be found and this line would fail.
    expect(await shell.findByText('17 Aug')).toBeTruthy();
  });

  test('an empty room offers the sample wardrobes; their threads arrive but stay theirs', async () => {
    // Alone on the device: one wardrobe, nothing shared yet.
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ACCOUNTS[0]]));
    await storage.removeItem(COMMUNITY_KEY);

    const shell = renderRouter('./src/app', { initialUrl: '/chats' });
    expect(await shell.findByText('No conversations yet.')).toBeTruthy();

    fireEvent.press(await shell.findByText('Add the sample wardrobes'));

    // Someone to write to now — the offer becomes the web's own Start one.
    expect(await shell.findByText('Start one')).toBeTruthy();

    // The registry gained the four sample rows and the shelf their threads…
    await waitFor(async () => {
      const accounts = JSON.parse((await AsyncStorage.getItem(ACCOUNTS_KEY)) ?? '[]');
      expect(accounts.map((a: { id: string }) => a.id)).toEqual(
        expect.arrayContaining(['acct-1', 'aarav', 'vikram', 'meher', 'cofounder']),
      );
      const community = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
      expect(community.conversations.map((c: { id: string }) => c.id)).toEqual(
        expect.arrayContaining(['c-group', 'c-meher-vikram', 'c-aarav-meher', 'c-aarav-vikram']),
      );
    });

    // …but a thread this wardrobe is not in reads the same as one that is
    // gone: The Rail is the samples' room, not ours.
    expect(shell.queryByText('The Rail')).toBeNull();
  });

  test('the seed is idempotent — a reseed adds nothing and rewrites nothing', () => {
    const empty = {
      posts: [], conversations: [], messages: [], households: [], passes: [],
      removedPostIds: [], savedPostIds: [],
    };
    const once = seedChatThreads(empty);
    expect(once.conversations).toHaveLength(4);
    expect(once.messages).toHaveLength(17);
    // Known ids answer the second knock: the same object comes straight back.
    expect(seedChatThreads(once)).toBe(once);
  });

  test('starting a thread with a pair already talking lands on their one thread', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats' });
    await shell.findByText('Nadia Khan');

    fireEvent.press(shell.getByText('New'));
    // The sheet's rows wear the handle; the list row does not.
    fireEvent.press(await shell.findByText('@nadia'));
    fireEvent.press(shell.getByText('Start it'));

    await waitFor(() => expect(shell.getPathname()).toBe('/chats/c-pair'));
    const community = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
    expect(community.conversations).toHaveLength(2);
  });

  test('starting a thread with somebody new writes one conversation with both in it', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats' });
    await shell.findByText('Nadia Khan');

    fireEvent.press(shell.getByText('New'));
    fireEvent.press(await shell.findByText('@farhan'));
    fireEvent.press(shell.getByText('Start it'));

    await waitFor(() => expect(shell.getPathname()).toMatch(/^\/chats\/c-/));
    const community = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
    expect(community.conversations).toHaveLength(3);
    const started = community.conversations[2];
    expect(started.isGroup).toBe(false);
    expect(started.memberIds.sort()).toEqual(['acct-1', 'acct-3']);
  });
});
