/**
 * The arrival contract — the web's feed hands conversations a snapshot via
 * navigation state (src/components/social.tsx PostCard):
 *
 *   navigate('/chats', { state: { attach: { piece } | { look } } })
 *   navigate('/chats', { state: { ask: { pieceName, ownerId } } })
 *
 * Native restates the same shapes as JSON in the `attach` / `ask` search
 * params of /chats and /chats/[id]. The sender screens are not built yet on
 * the phone; this suite is the contract they meet — a bad param is no
 * arrival (never a crash on a deep link), the list shows what is riding
 * along, and the thread's composer receives it.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { parseAsk, parseAttach } from '../src/components/chats/store';
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
];

const COMMUNITY = {
  posts: [],
  households: [],
  passes: [],
  conversations: [{ id: 'c-pair', memberIds: ['acct-1', 'acct-2'], isGroup: false }],
  messages: [
    { id: 'm1', conversationId: 'c-pair', authorId: 'acct-2', date: '2026-08-16', text: 'The shawl came home washed.' },
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

const PIECE = { itemId: 'i9', name: 'The mustard shawl', category: 'accessories', color: '#C8912E' };
const LOOK = { outfitId: 'o1', name: 'Monsoon build', occasion: 'everyday', pieces: ['The mustard shawl'] };

beforeEach(async () => {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'acct-1' }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(ACCOUNTS));
  await storage.setItem(wardrobeKey('acct-1'), JSON.stringify(WARDROBE_DOC));
  await storage.setItem(COMMUNITY_KEY, JSON.stringify(COMMUNITY));
});

describe('the param shapes', () => {
  test('the web\'s own shapes parse; anything less is no arrival', () => {
    expect(parseAttach(JSON.stringify({ piece: PIECE }))).toEqual({ piece: PIECE });
    expect(parseAttach(JSON.stringify({ look: LOOK }))).toEqual({ look: LOOK });
    // expo-router can hand a repeated param as an array; the first one rides.
    expect(parseAttach([JSON.stringify({ piece: PIECE }), 'ignored'])).toEqual({ piece: PIECE });

    expect(parseAttach(undefined)).toBeNull();
    expect(parseAttach('')).toBeNull();
    expect(parseAttach('not json')).toBeNull();
    expect(parseAttach(JSON.stringify({ piece: { itemId: 'i9' } }))).toBeNull(); // no name
    expect(parseAttach(JSON.stringify('a string'))).toBeNull();

    expect(parseAsk(JSON.stringify({ pieceName: 'ivory bandhgala', ownerId: 'acct-2' }))).toEqual({
      pieceName: 'ivory bandhgala',
      ownerId: 'acct-2',
    });
    expect(parseAsk(JSON.stringify({ pieceName: '   ', ownerId: 'acct-2' }))).toBeNull();
    expect(parseAsk(JSON.stringify({ pieceName: 'ivory bandhgala' }))).toBeNull();
    expect(parseAsk('broken{')).toBeNull();
  });
});

describe('an attach arrival', () => {
  test('/chats shows what is riding along and asks for a thread', async () => {
    const attach = encodeURIComponent(JSON.stringify({ piece: PIECE }));
    const shell = renderRouter('./src/app', { initialUrl: `/chats?attach=${attach}` });

    expect(await shell.findByText('Riding along')).toBeTruthy();
    expect(shell.getByText('The mustard shawl')).toBeTruthy();
    expect(shell.getByText('Choose a thread to carry it.')).toBeTruthy();
  });

  test('picking a thread carries the snapshot into the composer, and Send keeps it', async () => {
    const attach = encodeURIComponent(JSON.stringify({ piece: PIECE }));
    const shell = renderRouter('./src/app', { initialUrl: `/chats?attach=${attach}` });
    await shell.findByText('Riding along');

    fireEvent.press(shell.getByText('Nadia Khan'));
    await waitFor(() => expect(shell.getPathname()).toBe('/chats/c-pair'));

    // The snapshot sits in the composer, with the web's own way off.
    expect(await shell.findByText('The mustard shawl')).toBeTruthy();
    expect(shell.getByText('Take it off')).toBeTruthy();

    // An attachment alone is a sendable message — the web's own rule.
    fireEvent.press(shell.getByText('Send'));
    await waitFor(async () => {
      const community = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
      expect(community.messages).toHaveLength(2);
      const sent = community.messages[1];
      expect(sent.piece).toEqual(PIECE);
      expect(sent.authorId).toBe('acct-1');
    });
  });

  test('a look arrival lands the same way', async () => {
    const attach = encodeURIComponent(JSON.stringify({ look: LOOK }));
    const shell = renderRouter('./src/app', {
      initialUrl: `/chats/c-pair?attach=${attach}`,
    });

    expect(await shell.findByText('Monsoon build')).toBeTruthy();
    expect(shell.getByText('Take it off')).toBeTruthy();
  });

  test('a malformed arrival is no arrival — the list simply stands', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats?attach=not-json' });

    expect(await shell.findByText('Nadia Khan')).toBeTruthy();
    expect(shell.queryByText('Riding along')).toBeNull();
  });
});

describe('an ask arrival', () => {
  test('/chats/[id] opens the ask sheet with the piece and its owner named', async () => {
    const ask = encodeURIComponent(
      JSON.stringify({ pieceName: 'ivory bandhgala', ownerId: 'acct-2' }),
    );
    const shell = renderRouter('./src/app', { initialUrl: `/chats/c-pair?ask=${ask}` });

    expect(await shell.findByDisplayValue('ivory bandhgala')).toBeTruthy();

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
    });
  });
});
