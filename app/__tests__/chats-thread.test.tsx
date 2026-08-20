/**
 * A conversation's own page — the record reads oldest first, a borrow
 * request wears its neutral labels, membership refuses a thread you are
 * not in, and composing appends to the shelf this device already keeps
 * (COMMUNITY_KEY — the web's own address).
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { todayLocal } from '@almari/shared/dates';
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
    { id: 'c-foreign', memberIds: ['acct-2', 'acct-3'], isGroup: false },
  ],
  messages: [
    { id: 'm1', conversationId: 'c-pair', authorId: 'acct-2', date: '2026-08-16', text: 'The shawl came home washed.' },
    { id: 'm2', conversationId: 'c-pair', authorId: 'acct-1', date: '2026-08-17', text: 'Good. It goes out again Friday.' },
    // A declined request is a neutral fact; a returned one is home again.
    { id: 'm3', conversationId: 'c-pair', authorId: 'acct-1', date: '2026-08-15', text: 'The marigold kurta for Sunday?', request: { pieceName: 'Marigold kurta', status: 'declined', ownerId: 'acct-2' } },
    { id: 'm4', conversationId: 'c-pair', authorId: 'acct-2', date: '2026-08-14', text: 'The pashmina is back with you.', request: { pieceName: 'Pashmina shawl', status: 'returned', ownerId: 'acct-1' } },
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

describe('a conversation', () => {
  test('the record reads oldest first under the other wardrobe\'s name', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    expect(await shell.findByText('The shawl came home washed.')).toBeTruthy();
    expect(shell.getByText('Nadia Khan')).toBeTruthy();
    expect(shell.getByText('@nadia')).toBeTruthy();

    // Oldest first: the 14th's line renders before the 17th's.
    const tree = JSON.stringify(shell.toJSON());
    expect(tree.indexOf('The pashmina is back with you.')).toBeLessThan(
      tree.indexOf('Good. It goes out again Friday.'),
    );
  });

  test('a request wears its neutral labels — "Staying home", never an alarm word', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    expect(await shell.findByText('Staying home')).toBeTruthy();
    expect(shell.getByText('Home again')).toBeTruthy();
    expect(shell.getByText('Marigold kurta')).toBeTruthy();
    // The raw status word never reaches the screen.
    expect(shell.queryByText(/declined/i)).toBeNull();
  });

  test('a thread you are not in reads the same as a thread that is gone', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-foreign' });

    expect(await shell.findByText('No record of this thread.')).toBeTruthy();
    // No live compose box on a refused door.
    expect(shell.queryByPlaceholderText('Ask after a piece, or send a look')).toBeNull();
    expect(shell.queryByText('A line between two other wardrobes.')).toBeNull();
  });

  test('composing appends locally, stamped with today and a sub-day time', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });
    await shell.findByText('The shawl came home washed.');

    fireEvent.changeText(
      shell.getByPlaceholderText('Ask after a piece, or send a look'),
      'A line for the record.',
    );
    fireEvent.press(shell.getByText('Send'));

    expect(await shell.findByText('A line for the record.')).toBeTruthy();
    await waitFor(async () => {
      const community = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
      expect(community.messages).toHaveLength(5);
      const sent = community.messages[4];
      expect(sent.conversationId).toBe('c-pair');
      expect(sent.authorId).toBe('acct-1');
      expect(sent.text).toBe('A line for the record.');
      expect(sent.date).toBe(todayLocal());
      expect(typeof sent.at).toBe('string');
    });
  });

  test('asking after a piece writes a request — status asked, owner named', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });
    await shell.findByText('The shawl came home washed.');

    fireEvent.press(shell.getByText('Ask after a piece'));
    fireEvent.changeText(await shell.findByPlaceholderText('The ivory bandhgala'), 'ivory bandhgala');
    fireEvent.press(shell.getByText('Ask'));

    expect(await shell.findByText('Asked')).toBeTruthy();
    await waitFor(async () => {
      const community = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
      const sent = community.messages[community.messages.length - 1];
      expect(sent.request).toEqual({
        pieceName: 'ivory bandhgala',
        status: 'asked',
        ownerId: 'acct-2',
      });
      expect(sent.text).toBe('Asking after the ivory bandhgala, Nadia Khan.');
    });
  });
});
