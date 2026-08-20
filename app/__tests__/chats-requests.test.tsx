/**
 * ANSWERING A REQUEST — the owner lends, or it stays home; either party
 * says when it came home.
 *
 * SOURCE OF TRUTH: src/pages/Chats.tsx (the request plate and `advance`).
 * Two things move on a press and this suite holds both to account: the
 * STATUS on the shared shelf, which the other wardrobe reads, and the LOAN
 * in the open wardrobe's own document, which nobody else can see.
 *
 * WHAT IS BEING GUARDED, beyond "it works":
 *  - Only the owner may lend (toile-social, the four verbs). A borrower
 *    looking at their own ask gets no button that would let them lend to
 *    themselves, and a bystander in a group gets nothing at all.
 *  - "Staying home" is a neutral fact. Declining writes NO loan and no
 *    penalty of any kind; the raw word "declined" never reaches a screen.
 *  - The borrower's half of a loan is not this app's to write.
 *  - Nothing counts anything: no tally moves, and lending is not wearing.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { todayLocal } from '@almari/shared/dates';
import { EMPTY_COMMUNITY, type BorrowStatus, type ChatMessage } from '@almari/shared/types';

import { STATUS_LABELS } from '../src/components/chats/format';
import { PERSONA_ROWS, seedChatThreads } from '../src/components/chats/personaThreads';
import { requestActions } from '../src/components/chats/RequestPlate';
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

/** acct-1 is the wardrobe holding the phone unless a test says otherwise. */
const ACCOUNTS = [
  { id: 'acct-1', name: 'Test wardrobe', handle: '@test', monogram: 'T', color: '#105F7D', createdAt: '2026-08-01' },
  { id: 'acct-2', name: 'Nadia Khan', handle: '@nadia', monogram: 'NK', color: '#8A5A2E', createdAt: '2026-08-01' },
  { id: 'acct-3', name: 'Farhan Ali', handle: '@farhan', monogram: 'FA', color: '#3B5D3A', createdAt: '2026-08-01' },
];

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

/** A shelf holding the given messages, in a pair thread and a group. */
function community(messages: ChatMessage[]) {
  return {
    ...EMPTY_COMMUNITY,
    conversations: [
      { id: 'c-pair', memberIds: ['acct-1', 'acct-2'], isGroup: false },
      { id: 'c-room', memberIds: ['acct-1', 'acct-2', 'acct-3'], isGroup: true, name: 'The room' },
    ],
    messages,
  };
}

/** A request message: `by` wrote the ask, `ownerId` owns the piece. */
function ask(over: {
  id?: string;
  conversationId?: string;
  by: string;
  ownerId: string;
  status: BorrowStatus;
}): ChatMessage {
  return {
    id: over.id ?? 'm-req',
    conversationId: over.conversationId ?? 'c-pair',
    authorId: over.by,
    date: '2026-08-15',
    text: 'About the pashmina shawl.',
    request: { pieceName: 'Pashmina shawl', status: over.status, ownerId: over.ownerId },
  };
}

async function seed(opts: { activeId?: string; messages: ChatMessage[] }) {
  const activeId = opts.activeId ?? 'acct-1';
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(ACCOUNTS));
  await storage.setItem(wardrobeKey(activeId), JSON.stringify(WARDROBE_DOC));
  await storage.setItem(COMMUNITY_KEY, JSON.stringify(community(opts.messages)));
}

/** The stored request, read back from the shelf. */
async function storedRequest(messageId = 'm-req') {
  const blob = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
  return blob.messages.find((m: { id: string }) => m.id === messageId)?.request;
}

/** The loans in one wardrobe's own document. */
async function storedLoans(accountId = 'acct-1') {
  const doc = JSON.parse((await AsyncStorage.getItem(wardrobeKey(accountId))) ?? '{}');
  return doc.circle?.loans ?? [];
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

/* ------------------------------------------------------------------ *
 * The entitlement rule, on its own.
 * ------------------------------------------------------------------ */
describe('who may answer a request', () => {
  const OWNER = 'acct-2';
  const ASKER = 'acct-1';
  const BYSTANDER = 'acct-3';
  const req = (status: BorrowStatus) => ({
    pieceName: 'Pashmina shawl',
    status,
    ownerId: OWNER,
  });

  test('an ask offers the owner exactly two answers, neither weighted', () => {
    expect(requestActions(req('asked'), ASKER, OWNER)).toEqual([
      { label: 'Lend it', status: 'lent' },
      { label: 'It stays home', status: 'declined' },
    ]);
  });

  test('the borrower is offered nothing on their own ask — only the owner may lend', () => {
    expect(requestActions(req('asked'), ASKER, ASKER)).toEqual([]);
  });

  test('a bystander in a group is offered nothing', () => {
    expect(requestActions(req('asked'), ASKER, BYSTANDER)).toEqual([]);
    expect(requestActions(req('lent'), ASKER, BYSTANDER)).toEqual([]);
  });

  test('either party may say a lent piece came home', () => {
    const home = [{ label: 'Mark it home', status: 'returned' }];
    expect(requestActions(req('lent'), ASKER, OWNER)).toEqual(home);
    expect(requestActions(req('lent'), ASKER, ASKER)).toEqual(home);
  });

  test('staying home and home again are terminal — re-asking is a new ask', () => {
    expect(requestActions(req('declined'), ASKER, OWNER)).toEqual([]);
    expect(requestActions(req('returned'), ASKER, OWNER)).toEqual([]);
  });

  test('a request with no owner named is nobody to answer for', () => {
    // Built inline, not through `req`: a default parameter would quietly put
    // the owner back and the test would prove nothing.
    expect(requestActions({ pieceName: 'Pashmina shawl', status: 'asked' }, ASKER, OWNER)).toEqual(
      [],
    );
  });

  test('with no wardrobe open, nothing is offered', () => {
    expect(requestActions(req('asked'), ASKER, null)).toEqual([]);
    expect(requestActions(req('asked'), ASKER, undefined)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * The words. These are the web's, byte for byte.
 * ------------------------------------------------------------------ */
describe('the labels', () => {
  test('the status words match src/pages/Chats.tsx STATUS_LABELS exactly', () => {
    expect(STATUS_LABELS).toEqual({
      asked: 'Asked',
      lent: 'Lent',
      declined: 'Staying home',
      returned: 'Home again',
    });
  });

  test('the two answers to an ask are the web own words', () => {
    const labels = requestActions(
      { pieceName: 'x', status: 'asked', ownerId: 'acct-2' },
      'acct-1',
      'acct-2',
    ).map(a => a.label);
    expect(labels).toEqual(['Lend it', 'It stays home']);
  });
});

/* ------------------------------------------------------------------ *
 * Lending — the status and the ledger, one press.
 * ------------------------------------------------------------------ */
describe('the owner answers an ask', () => {
  beforeEach(async () => {
    // acct-1 holds the phone and OWNS the piece; acct-2 did the asking.
    await seed({ messages: [ask({ by: 'acct-2', ownerId: 'acct-1', status: 'asked' })] });
  });

  test('lending moves the status on the shelf and opens a loan in the ledger', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });
    fireEvent.press(await shell.findByText('Lend it'));

    // The status renders in place — the plate does not navigate anywhere.
    expect(await shell.findByText('Lent')).toBeTruthy();
    await waitFor(async () => {
      expect(await storedRequest()).toEqual({
        pieceName: 'Pashmina shawl',
        status: 'lent',
        ownerId: 'acct-1',
      });
    });

    // The ledger half: one loan, out to the asker, dated today, still open.
    await waitFor(async () => {
      const loans = await storedLoans();
      expect(loans).toHaveLength(1);
      expect(loans[0]).toMatchObject({
        pieceName: 'Pashmina shawl',
        withId: 'acct-2',
        direction: 'to',
        since: todayLocal(),
      });
      expect(loans[0].returned).toBeUndefined();
    });
  });

  test('once answered, the ask offers no second answer', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });
    fireEvent.press(await shell.findByText('Lend it'));
    await shell.findByText('Lent');

    await waitFor(() => {
      expect(shell.queryByText('Lend it')).toBeNull();
      expect(shell.queryByText('It stays home')).toBeNull();
    });
  });

  test('a piece staying home is a neutral fact — no loan, no alarm word', async () => {
    /* TWO asks, deliberately: one to decline and one to lend.
       Asserting an empty ledger straight after declining proves nothing —
       the ledger is empty a moment after ANY press, including a press that
       does write, because the provider persists asynchronously. Lending the
       second piece gives the writer something to arrive at, and the ledger
       is then read for what it holds: the lent piece, and only that one. */
    await seed({
      messages: [
        ask({ by: 'acct-2', ownerId: 'acct-1', status: 'asked' }),
        {
          id: 'm-coat',
          conversationId: 'c-pair',
          authorId: 'acct-2',
          date: '2026-08-16',
          text: 'And the wool coat, if it is free?',
          request: { pieceName: 'Wool coat', status: 'asked', ownerId: 'acct-1' },
        },
      ],
    });
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    // Oldest first, so the shawl's pair of answers comes first.
    fireEvent.press((await shell.findAllByText('It stays home'))[0]);
    expect(await shell.findByText('Staying home')).toBeTruthy();
    // The raw status word never reaches the screen.
    expect(shell.queryByText(/^declined$/i)).toBeNull();
    await waitFor(async () => {
      expect((await storedRequest()).status).toBe('declined');
    });

    // The shawl answered, only the coat's answers are left to press.
    fireEvent.press(shell.getByText('Lend it'));
    await waitFor(async () => {
      const loans = await storedLoans();
      // A piece not going out is not a transaction, and certainly not a loan.
      expect(loans.map((l: { pieceName: string }) => l.pieceName)).toEqual(['Wool coat']);
    });
  });

  test('answering logs no wear and moves no tally — lending is not wearing', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });
    fireEvent.press(await shell.findByText('Lend it'));
    await shell.findByText('Lent');

    await waitFor(async () => {
      const doc = JSON.parse((await AsyncStorage.getItem(wardrobeKey('acct-1'))) ?? '{}');
      expect(doc.circle.loans).toHaveLength(1);
      expect(doc.wearLogs).toEqual([]);
      expect(doc.items).toEqual([]);
    });
  });
});

/* ------------------------------------------------------------------ *
 * The borrower's side of the same plate.
 * ------------------------------------------------------------------ */
describe('the wardrobe that did the asking', () => {
  test('sees the status and no buttons at all while it is only asked', async () => {
    // acct-1 holds the phone and ASKED; acct-2 owns the piece.
    await seed({ messages: [ask({ by: 'acct-1', ownerId: 'acct-2', status: 'asked' })] });
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    expect(await shell.findByText('Asked')).toBeTruthy();
    expect(shell.queryByText('Lend it')).toBeNull();
    expect(shell.queryByText('It stays home')).toBeNull();
    expect(shell.queryByText('Mark it home')).toBeNull();
  });

  test('marking it home closes the borrowed row, aimed at the owner', async () => {
    /* This wardrobe borrowed the shawl and its own rail says so: a loan
       'from' acct-2. Marking it home must close THAT row, which means the
       close has to be aimed at the OWNER — the counterparty from this side
       of the request. Aiming it at the message's author instead (which is
       this wardrobe, since this wardrobe did the asking) would match
       nothing and leave the row standing open forever. */
    await seed({ messages: [ask({ by: 'acct-1', ownerId: 'acct-2', status: 'lent' })] });
    await storage.setItem(
      wardrobeKey('acct-1'),
      JSON.stringify({
        ...WARDROBE_DOC,
        circle: {
          ...WARDROBE_DOC.circle,
          loans: [
            {
              id: 'loan-borrowed',
              pieceName: 'Pashmina shawl',
              withId: 'acct-2',
              direction: 'from',
              since: '2026-08-14',
            },
          ],
        },
      }),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    fireEvent.press(await shell.findByText('Mark it home'));
    expect(await shell.findByText('Home again')).toBeTruthy();
    await waitFor(async () => {
      expect((await storedRequest()).status).toBe('returned');
    });

    await waitFor(async () => {
      const loans = await storedLoans();
      // Retire, never delete — and never a second row invented beside it.
      expect(loans).toHaveLength(1);
      expect(loans[0]).toMatchObject({
        id: 'loan-borrowed',
        withId: 'acct-2',
        direction: 'from',
        returned: todayLocal(),
      });
    });
  });

  test('a borrowed piece with no row of its own writes no half-loan', async () => {
    /* The other side of the same coin: this wardrobe never recorded the
       borrowing, so there is nothing to close and nothing may be created.
       The borrower's half of a loan is not this app's to write — the web
       says so and this holds it. Lending a second piece gives the ledger a
       write to settle on, so the emptiness is observed rather than raced. */
    await seed({
      messages: [
        ask({ by: 'acct-1', ownerId: 'acct-2', status: 'lent' }),
        {
          id: 'm-mine',
          conversationId: 'c-pair',
          authorId: 'acct-2',
          date: '2026-08-16',
          text: 'And the wool coat of yours?',
          request: { pieceName: 'Wool coat', status: 'asked', ownerId: 'acct-1' },
        },
      ],
    });
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    fireEvent.press(await shell.findByText('Mark it home'));
    expect(await shell.findByText('Home again')).toBeTruthy();

    fireEvent.press(shell.getByText('Lend it'));
    await waitFor(async () => {
      const loans = await storedLoans();
      expect(loans.map((l: { pieceName: string }) => l.pieceName)).toEqual(['Wool coat']);
    });
  });
});

/* ------------------------------------------------------------------ *
 * Closing the loan the owner opened.
 * ------------------------------------------------------------------ */
describe('a lent piece comes home', () => {
  test('the owner closing it dates the loan returned rather than deleting it', async () => {
    await seed({ messages: [ask({ by: 'acct-2', ownerId: 'acct-1', status: 'asked' })] });
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-pair' });

    fireEvent.press(await shell.findByText('Lend it'));
    await shell.findByText('Lent');
    await waitFor(async () => {
      expect(await storedLoans()).toHaveLength(1);
    });

    fireEvent.press(await shell.findByText('Mark it home'));
    expect(await shell.findByText('Home again')).toBeTruthy();

    await waitFor(async () => {
      const loans = await storedLoans();
      // Retire, never delete: the row stays and gains a date.
      expect(loans).toHaveLength(1);
      expect(loans[0]).toMatchObject({
        pieceName: 'Pashmina shawl',
        withId: 'acct-2',
        returned: todayLocal(),
      });
    });
    await waitFor(async () => {
      expect((await storedRequest()).status).toBe('returned');
    });
  });
});

/* ------------------------------------------------------------------ *
 * A group: a request is between two wardrobes even in a room of three.
 * ------------------------------------------------------------------ */
describe('a request written in a group', () => {
  test('a bystander reads the fact and is offered no answer to it', async () => {
    // acct-1 holds the phone; acct-2 asked acct-3 for a piece.
    await seed({
      messages: [
        ask({ conversationId: 'c-room', by: 'acct-2', ownerId: 'acct-3', status: 'asked' }),
        {
          id: 'm-lent',
          conversationId: 'c-room',
          authorId: 'acct-2',
          date: '2026-08-16',
          text: 'And the coat, already out.',
          request: { pieceName: 'Wool coat', status: 'lent', ownerId: 'acct-3' },
        },
      ],
    });
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-room' });

    expect(await shell.findByText('Pashmina shawl')).toBeTruthy();
    expect(shell.getByText('Asked')).toBeTruthy();
    expect(shell.getByText('Lent')).toBeTruthy();
    expect(shell.queryByText('Lend it')).toBeNull();
    expect(shell.queryByText('It stays home')).toBeNull();
    expect(shell.queryByText('Mark it home')).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * The sample threads, answered from the owner's side.
 *
 * The seed carries an ask from Aarav for Vikram's linen shirt
 * (personaThreads GROUP_THREAD, mirroring src/lib/communitySeed.ts). Open
 * the app AS Vikram and that ask is his to answer — the owner path
 * exercised against the shipped seed rather than a fixture invented for it.
 * ------------------------------------------------------------------ */
describe('a persona-seeded ask, answered by the wardrobe that owns the piece', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    const rows = PERSONA_ROWS.map(row => ({ ...row, createdAt: '2026-08-01' }));
    await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: 'vikram' }));
    await storage.setItem(ACCOUNTS_KEY, JSON.stringify(rows));
    await storage.setItem(wardrobeKey('vikram'), JSON.stringify(WARDROBE_DOC));
    await storage.setItem(COMMUNITY_KEY, JSON.stringify(seedChatThreads(EMPTY_COMMUNITY)));
  });

  test('Vikram is offered the two answers on the linen shirt asked of him', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-group' });

    expect(await shell.findByText('Linen shirt, sand')).toBeTruthy();
    expect(shell.getByText('It stays home')).toBeTruthy();
    // The kurta Meher owns is not his to answer, and the seed's settled
    // requests are terminal — so exactly one ask is open to him.
    expect(shell.getAllByText('Lend it')).toHaveLength(1);
  });

  test('lending it writes the loan against Aarav, who did the asking', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-group' });
    fireEvent.press(await shell.findByText('Lend it'));

    await waitFor(async () => {
      const blob = JSON.parse((await AsyncStorage.getItem(COMMUNITY_KEY)) ?? '{}');
      const seeded = blob.messages.find(
        (m: { request?: { pieceName: string } }) => m.request?.pieceName === 'Linen shirt, sand',
      );
      expect(seeded.request.status).toBe('lent');
    });

    await waitFor(async () => {
      const loans = await storedLoans('vikram');
      expect(loans).toHaveLength(1);
      expect(loans[0]).toMatchObject({
        pieceName: 'Linen shirt, sand',
        withId: 'aarav',
        direction: 'to',
        since: todayLocal(),
      });
    });
  });

  test('the settled requests in the seed keep their neutral words', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/chats/c-group' });

    // Meher's kurta was declined; the bandhgala came home.
    expect(await shell.findByText('Staying home')).toBeTruthy();
    expect(shell.getByText('Home again')).toBeTruthy();
    expect(shell.queryByText(/^declined$/i)).toBeNull();
  });
});
