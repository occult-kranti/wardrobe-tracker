/**
 * THE WISHLIST, through the real router and the real provider.
 *
 * Rendered through the shipped tree — root layout, WardrobeProvider, the
 * AsyncStorage adapter and migrate-on-read included — so what these tests
 * exercise is the path a tester walks, not a double of it. Every assertion
 * about what was written reads the STORED DOCUMENT after the provider's settle
 * window: a screen that looks right over state that never reached the shelf is
 * the failure this app cannot afford.
 *
 * THE FIVE CHECKS THIS ROOM EXISTS TO SURVIVE:
 *
 *  1. THE SILENCE IS REAL. A wish inside its wait says exactly one quiet line
 *     and offers NOTHING to answer. No badge, no notification, no reminder,
 *     and no "let it go" sitting there being suggested — the silence is the
 *     intervention (docs/06 §1 row 7), and a control that lets the person
 *     re-litigate every time they open the room is the nag it exists to
 *     prevent.
 *  2. THE CARD ASKS ONCE. When the wait runs out the card asks, with three
 *     choices of identical weight; every answer stamps `coolingOff.asked` in
 *     the record, so the question can never come back. Pinned in the stored
 *     document, not on the screen — a screen that stops showing the question
 *     while the record still says `asked: false` asks again on the next boot.
 *  3. "IT CAME HOME" WRITES A REAL PIECE. Zero wears, the wish's price carried
 *     as its cost, and — the LANDED semantics, which differ from this squad's
 *     brief — the wish STAYS on the record marked 'bought'. The provider's
 *     reason is that one document serves both apps and the browser prints its
 *     Bought section from exactly those rows. Pinned here so a later change of
 *     mind is a deliberate change, not a silent one.
 *  4. EVERY AMOUNT IS THE RUPEE, FROM @almari/shared/cost. The assertions call
 *     formatMoney/formatPrice themselves, so the day the house currency moves
 *     these move with it instead of pinning a stale glyph.
 *  5. NOTHING HERE SELLS, SCORES, OR SCOLDS. No shop link, no percentage, no
 *     exclamation point, no shame register. Swept over every rendered string.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
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

import { formatMoney, formatPrice } from '@almari/shared/cost';
import { addDays, todayLocal } from '@almari/shared/dates';
import type { AppState, WishlistItem } from '@almari/shared/types';

import { ACCOUNTS_KEY, SESSION_KEY, storage, wardrobeKey } from '../src/lib/storage';

const ACCOUNT = {
  id: 'acct-1',
  name: 'Test wardrobe',
  handle: '@test',
  monogram: 'T',
  color: '#105F7D',
  createdAt: '2026-08-01',
};

const piece = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  category: 'tops',
  color: '#D9C4A3',
  season: [],
  occasion: [],
  imageUrl: '',
  dateAdded: '2026-06-01',
  wearCount: 0,
  favorite: false,
  laundryStatus: 'clean',
  ...extra,
});

const CLOSET = [piece('i-oxford', 'The white oxford', { wearCount: 14 })];

const wish = (over: Partial<WishlistItem> & { id: string; name: string }): WishlistItem => ({
  category: 'outerwear',
  color: '#201D18',
  priority: 'medium',
  dateAdded: '2026-03-12T09:14:00.000Z',
  status: 'waiting',
  ...over,
});

const doc = (wishlist: WishlistItem[], items = CLOSET) =>
  JSON.stringify({
    schemaVersion: 8,
    items,
    outfits: [],
    wearLogs: [],
    wishlist,
    circle: { profiles: [], groups: [], messages: [], loans: [] },
    events: [],
    furniture: [],
    photoEncoding: 'inline',
  });

/** Mid-wait: six days of silence still to run. */
const WAITING = wish({
  id: 'w-coat',
  name: 'Black wool coat',
  brand: 'Raw Mango',
  price: 12000,
  notes: 'Would go with the grey trousers',
  coolingOff: { endsAt: addDays(todayLocal(), 6), asked: false },
});

/** The wait ran out yesterday and nobody has been asked yet. */
const ASKING = wish({
  id: 'w-boots',
  name: 'The tall boots',
  price: 4500,
  dateAdded: '2026-07-02T18:40:00.000Z',
  coolingOff: { endsAt: addDays(todayLocal(), -1), asked: false },
});

/** Never waited on anything. */
const PLAIN = wish({
  id: 'w-scarf',
  name: 'A second wool scarf',
  price: 900,
  dateAdded: '2026-08-05T11:02:00.000Z',
});

/** Answered, both ways, some time ago. */
const RELEASED = wish({
  id: 'w-gone',
  name: 'The silk slip',
  brand: 'Bodice',
  price: 2500,
  dateAdded: '2026-06-11T08:00:00.000Z',
  status: 'let-go',
  releasedAt: '2026-08-01',
  coolingOff: { endsAt: '2026-07-25', asked: true },
});

const BOUGHT = wish({
  id: 'w-home',
  name: 'The linen kurta',
  price: 1800,
  dateAdded: '2026-05-20T07:30:00.000Z',
  status: 'bought',
});

async function seed(document: string) {
  await AsyncStorage.clear();
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: ACCOUNT.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([ACCOUNT]));
  await storage.setItem(wardrobeKey(ACCOUNT.id), document);
}

/** What is actually on the shelf, after the provider's 250ms settle. */
async function stored(): Promise<AppState> {
  const raw = await storage.getItem(wardrobeKey(ACCOUNT.id));
  return JSON.parse(raw ?? '{}') as AppState;
}

/** Every rendered string, in the order the screen lays it out. */
function textsIn(shell: { root: { findAllByType: (t: never) => unknown[] } }): string[] {
  return shell.root.findAllByType('Text' as never).map(node => {
    const kids = (node as { props: { children?: unknown } }).props.children;
    return Array.isArray(kids) ? kids.join('') : String(kids ?? '');
  });
}

/**
 * Run the clock out: the provider's 250ms write window and the house toast's
 * timer, which stands for nine seconds when a notice carries an offer. Both
 * are advanced rather than waited out — jest-expo runs on fake timers and a
 * real wait never returns under a faked clock. Draining the toast matters as
 * much as draining the write: showToast keeps its queue in MODULE state, so a
 * notice left standing at the end of one test is found by the next one's
 * query, and each test gets a fresh clock.
 */
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
  await seed(doc([WAITING, ASKING, PLAIN, RELEASED, BOUGHT]));
});

/* ============ the room ============ */

describe('the wishlist', () => {
  test('an empty list is an invitation, never a scolding or a gap', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });

    expect(await shell.findByText('Nothing on the list.')).toBeTruthy();
    expect(
      shell.getByText(
        'Pieces you are thinking about wait here. Give one a few days of silence and see whether it is still on your mind at the end.',
      ),
    ).toBeTruthy();
    expect(shell.getByLabelText('Add something you are considering')).toBeTruthy();
    // Nothing to count, so nothing counted. The masthead's meta stays empty.
    expect(shell.queryByText(/on the list$/)).toBeNull();
    await settle();
  });

  test('the list prints its sections, its rupees and its noted days', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    expect(await shell.findByText('Wishlist')).toBeTruthy();

    // Waiting + kept is what has not been answered either way: three of five.
    // The two answered rows — let go and bought — are not on the list any more.
    expect(shell.getByText('3 on the list')).toBeTruthy();

    for (const heading of ['Waiting', 'Stayed yours', 'Bought']) {
      expect(shell.getByText(heading)).toBeTruthy();
    }
    // Nothing has been kept, so no Kept section is drawn at all.
    expect(shell.queryByText('Kept')).toBeNull();

    expect(shell.getByText('Black wool coat')).toBeTruthy();
    // The card's meta line: kind of piece, brand, and the recorded price in ₹.
    expect(shell.getByText(`Outerwear · Raw Mango · ${formatPrice(12000)}`)).toBeTruthy();
    // Each card carries the day it was noted, in the reader's own zone.
    expect(shell.getByText('NOTED 12 MAR')).toBeTruthy();
    expect(shell.getByText('NOTED 5 AUG')).toBeTruthy();

    // The released ledger heads with one number framed as money that stayed.
    expect(shell.getByText(`${formatMoney(2500)} stayed yours.`)).toBeTruthy();
    expect(shell.getByText('₹2,500 stayed yours.')).toBeTruthy();

    // The still-open total, stated once, over the three unanswered wishes.
    expect(shell.getByText(formatMoney(12000 + 4500 + 900))).toBeTruthy();
    expect(shell.getByText('₹17,400')).toBeTruthy();
    expect(shell.getByText('Still on the list')).toBeTruthy();
    await settle();
  });

  test('the room carries its own way back — it has no slot on the house bar', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    expect(await shell.findByLabelText('Back to the house')).toBeTruthy();
    await settle();
  });

  test('the House door opens it — the room is reached from the hall, not the bar', async () => {
    // The door row lives in the House (app/src/app/(tabs)/profile.tsx, another
    // squad's file this wave). This pins the two halves together: the label a
    // person actually presses, and the route this squad built under it.
    const shell = renderRouter('./src/app', { initialUrl: '/profile' });
    fireEvent.press(await shell.findByLabelText('The wishlist'));

    await waitFor(() => expect(shell.getPathname()).toBe('/wishlist'));
    expect(await shell.findByText('Wishlist')).toBeTruthy();
    // And the way back out is there, because a pushed room owes one.
    expect(shell.getByLabelText('Back to the house')).toBeTruthy();
    await settle();
  });

  test('cold-opened with no wardrobe, the room sends you to the door (R7)', async () => {
    await AsyncStorage.clear();
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    await waitFor(() => expect(shell.getPathname()).toBe('/open'));
    // And it does NOT render somebody else's list on the way past.
    expect(shell.queryByText('Wishlist')).toBeNull();
    await settle();
  });
});

/* ============ the silence ============ */

describe('while a piece waits, the app says nothing', () => {
  test('a wish mid-wait shows one quiet line and offers nothing to answer', async () => {
    await seed(doc([WAITING]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });

    expect(await shell.findByText('WAITING · 6 DAYS LEFT')).toBeTruthy();
    // THE WHOLE POINT. It will be asked when the wait is up; until then the
    // card offers no way to answer a question nobody has put.
    expect(shell.queryByText('Still want this?')).toBeNull();
    expect(shell.queryByLabelText('Keep')).toBeNull();
    expect(shell.queryByLabelText('Let it go')).toBeNull();
    // "It came home" is not an answer to the wait — it is a fact about the
    // world, and it stays reachable throughout.
    expect(shell.getByLabelText('It came home')).toBeTruthy();
    await settle();
  });

  test('nothing anywhere in the room counts down, badges, or nags', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    await shell.findByText('Wishlist');
    const lines = textsIn(shell);

    // One quiet line about the wait, and one only.
    expect(lines.filter(line => line.includes('WAITING'))).toHaveLength(1);
    for (const line of lines) {
      expect(line).not.toMatch(/\bremind|reminder|notification|overdue|expires?\b/i);
      expect(line).not.toContain('%');
    }
    await settle();
  });
});

/* ============ the ask, once ============ */

describe('when the wait is up the card asks once', () => {
  test('the question offers three choices of identical weight', async () => {
    await seed(doc([ASKING]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });

    expect(await shell.findByText('Still want this?')).toBeTruthy();
    for (const label of ['Keep', 'Let it go', 'It came home']) {
      expect(shell.getByLabelText(label)).toBeTruthy();
    }
    // None of the three is the app's own answer: not one of them is styled as
    // the hero, and nothing tells the person which to press.
    const lines = textsIn(shell);
    expect(lines.some(line => /recommend|should|best|right choice/i.test(line))).toBe(false);
    await settle();
  });

  test('Keep moves the status and stamps the question asked, so it never returns', async () => {
    await seed(doc([ASKING]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Keep'));

    expect(await shell.findByText('Kept. It stays on the list.')).toBeTruthy();
    await settle();

    const kept = (await stored()).wishlist[0];
    expect(kept.status).toBe('kept');
    // BOTH HALVES. A status that moved while `asked` stayed false is a
    // question that comes back on the next boot.
    expect(kept.coolingOff).toEqual({ endsAt: ASKING.coolingOff!.endsAt, asked: true });
  });

  test('Let it go writes the release date and sends it to the ledger', async () => {
    await seed(doc([ASKING]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Let it go'));

    expect(await shell.findByText('Let it go. It goes to the ledger.')).toBeTruthy();
    // The ledger states what stayed, in the house currency.
    expect(shell.getByText(`${formatMoney(4500)} stayed yours.`)).toBeTruthy();
    await settle();

    const gone = (await stored()).wishlist[0];
    expect(gone.status).toBe('let-go');
    // A LOCAL day, from shared/dates — never toISOString().
    expect(gone.releasedAt).toBe(todayLocal());
    expect(gone.coolingOff).toEqual({ endsAt: ASKING.coolingOff!.endsAt, asked: true });
  });

  test('a wish that never waited is never stamped with a wait it did not have', async () => {
    await seed(doc([PLAIN]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Let it go'));
    await settle();

    const gone = (await stored()).wishlist[0];
    expect(gone.status).toBe('let-go');
    // Absent, not an own property holding nothing: a wish written on the phone
    // must be byte-identical to one written by the browser.
    expect('coolingOff' in gone).toBe(false);
  });
});

/* ============ putting something on the list ============ */

describe('adding a wish', () => {
  test('a wish and its wait are written through the provider', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Add something you are considering'));

    fireEvent.changeText(await shell.findByLabelText('What is it'), 'Black wool coat');
    fireEvent.changeText(shell.getByLabelText('Brand'), 'Raw Mango');
    fireEvent.changeText(shell.getByLabelText('Price'), '12000');
    fireEvent.press(shell.getByLabelText('Outerwear'));
    fireEvent.press(shell.getByLabelText('High'));
    fireEvent.press(shell.getByLabelText('14 days'));
    fireEvent.changeText(shell.getByLabelText('Notes'), 'Would go with the grey trousers');
    fireEvent.press(shell.getByLabelText('Put it on the list'));

    // The wait is named, because agreeing to it is the whole gesture.
    expect(await shell.findByText('On the list. It waits 14 days.')).toBeTruthy();
    await settle();

    const list = (await stored()).wishlist;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Black wool coat',
      brand: 'Raw Mango',
      price: 12000,
      category: 'outerwear',
      priority: 'high',
      notes: 'Would go with the grey trousers',
      status: 'waiting',
      coolingOff: { endsAt: addDays(todayLocal(), 14), asked: false },
    });
    // The record mints its own identity; the form never supplies one.
    expect(typeof list[0].id).toBe('string');
    expect(list[0].id.length).toBeGreaterThan(0);
  });

  test('No wait is a real answer and leaves no cooling-off on the record', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Add something you are considering'));
    fireEvent.changeText(await shell.findByLabelText('What is it'), 'A second wool scarf');
    fireEvent.press(shell.getByLabelText('No wait'));
    fireEvent.press(shell.getByLabelText('Put it on the list'));

    expect(await shell.findByText('On the list.')).toBeTruthy();
    await settle();

    const list = (await stored()).wishlist;
    expect(list).toHaveLength(1);
    expect('coolingOff' in list[0]).toBe(false);
    // A blank price box is not a free piece.
    expect('price' in list[0]).toBe(false);
    expect('brand' in list[0]).toBe(false);
  });

  test('a nameless wish is refused in a sentence, and nothing is written', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Add something you are considering'));
    // The control is ALWAYS pressable: a button that has gone grey cannot
    // explain itself, and the person is left guessing at a rule nobody stated.
    fireEvent.press(await shell.findByLabelText('Put it on the list'));

    expect(
      await shell.findByText(
        'This one needs something to call it. Say what the piece is and it goes on the list.',
      ),
    ).toBeTruthy();
    await settle();
    expect((await stored()).wishlist).toHaveLength(0);
  });
});

/* ============ it came home ============ */

describe('it came home', () => {
  test('the wish becomes a piece in the closet, at zero wears', async () => {
    await seed(doc([PLAIN]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    const before = (await stored()).items.length;

    fireEvent.press(await shell.findByLabelText('It came home'));

    // The toast says what happened to the RECORD, not just to the list.
    expect(
      await shell.findByText(
        'Came home. “A second wool scarf” is a piece in the closet now, at 0 wears.',
      ),
    ).toBeTruthy();
    await settle();

    const after = await stored();
    expect(after.items).toHaveLength(before + 1);
    const made = after.items[after.items.length - 1];
    expect(made.name).toBe('A second wool scarf');
    // A thing you own is a thing you have not worn yet, whatever it cost.
    expect(made.wearCount).toBe(0);
    // The price it was noted at becomes what the piece cost — the one number
    // every cost-per-wear on every screen is downstream of.
    expect(made.cost).toBe(900);
    expect(made.category).toBe('outerwear');
  });

  test('the wish STAYS on the record marked bought — the landed semantics', async () => {
    // NOT this squad's brief, which said promote removes the wish. The landed
    // promoteWish ports the web's moveWishlistToCloset because one document
    // serves both apps: the browser prints its Bought section from exactly
    // these rows, and dropping the row here would empty a list over there.
    // Pinned so a later change of mind is deliberate rather than silent.
    await seed(doc([PLAIN]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('It came home'));
    await settle();

    const list = (await stored()).wishlist;
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('bought');
    expect(list[0].id).toBe('w-scarf');
  });

  test('a bought wish reads as settled and is asked nothing further', async () => {
    await seed(doc([BOUGHT]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });

    expect(await shell.findByText('Bought')).toBeTruthy();
    expect(shell.getByText('In the closet')).toBeTruthy();
    // No verbs on an answered card: nothing left to decide.
    expect(shell.queryByLabelText('It came home')).toBeNull();
    expect(shell.queryByLabelText('Let it go')).toBeNull();
    // And it is not counted as still on the list.
    expect(shell.queryByText(/on the list$/)).toBeNull();
    await settle();
  });
});

/* ============ amending ============ */

describe('amending a wish', () => {
  test('the fields are amended and an emptied box CLEARS the field (R4)', async () => {
    await seed(doc([WAITING]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Amend'));

    expect(await shell.findByText('Amend this wish')).toBeTruthy();
    fireEvent.changeText(shell.getByLabelText('What is it'), 'The black wool coat');
    // Emptying the box is the only gesture anybody will look for. Lead ruling
    // R4: the record reads null as "take it off" and undefined as silence, so
    // a cleared box that sent undefined would leave the mistake on the record
    // and the form would appear to have done nothing.
    fireEvent.changeText(shell.getByLabelText('Brand'), '');
    fireEvent.press(shell.getByLabelText('Amend it'));

    expect(await shell.findByText('Amended. “The black wool coat”.')).toBeTruthy();
    await settle();

    const amended = (await stored()).wishlist[0];
    expect(amended.name).toBe('The black wool coat');
    expect('brand' in amended).toBe(false);
    // Amending is not answering: the wait is untouched and still runs.
    expect(amended.status).toBe('waiting');
    expect(amended.coolingOff).toEqual(WAITING.coolingOff);
    // Neither is the record's identity.
    expect(amended.id).toBe('w-coat');
    expect(amended.dateAdded).toBe(WAITING.dateAdded);
  });

  test('the wait is shown while amending and cannot be re-set from the form', async () => {
    await seed(doc([WAITING]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Amend'));
    await shell.findByText('Amend this wish');

    // Read-only, and honest about why. A control that re-arms a cooling-off
    // turns the silence into something to re-negotiate with yourself.
    // Twice over: the card behind still says it, and the sheet restates it as
    // a fact rather than a control.
    expect(shell.getAllByText('WAITING · 6 DAYS LEFT')).toHaveLength(2);
    expect(
      shell.getByText(
        'A wait is set once. Everything else here can be changed as often as you like, but the silence you agreed to is not something to re-negotiate with yourself.',
      ),
    ).toBeTruthy();
    for (const label of ['No wait', '7 days', '14 days', '30 days']) {
      expect(shell.queryByLabelText(label)).toBeNull();
    }
    await settle();
  });
});

/* ============ taking it off ============ */

describe('taking a wish off the list', () => {
  test('removal is behind the house confirm, and cancelling changes nothing', async () => {
    await seed(doc([PLAIN]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Take A second wool scarf off the list'));

    expect(await shell.findByText('Take it off the list')).toBeTruthy();
    expect(
      shell.getByText(
        '“A second wool scarf” comes off the list and out of the ledger. Nothing in the closet changes — a wish was never a piece.',
      ),
    ).toBeTruthy();

    fireEvent.press(shell.getByLabelText('Cancel'));
    await settle();
    expect((await stored()).wishlist).toHaveLength(1);
  });

  test('confirmed, it goes — and the notice offers a real Undo', async () => {
    await seed(doc([PLAIN]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    const closetBefore = (await stored()).items.length;

    fireEvent.press(await shell.findByLabelText('Take A second wool scarf off the list'));
    fireEvent.press(await shell.findByLabelText('Take it off'));

    expect(await shell.findByText('Off the list.')).toBeTruthy();
    // The put-it-back closure the provider hands out (R3 parity). An offer on
    // a notice that does nothing is worse than no offer.
    fireEvent.press(shell.getByLabelText('Undo'));
    await settle();

    const back = await stored();
    expect(back.wishlist).toHaveLength(1);
    expect(back.wishlist[0].id).toBe('w-scarf');
    // A wish was never a piece: the closet is untouched either way.
    expect(back.items).toHaveLength(closetBefore);
  });

  test('left alone, the removal stands', async () => {
    await seed(doc([PLAIN]));
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    fireEvent.press(await shell.findByLabelText('Take A second wool scarf off the list'));
    fireEvent.press(await shell.findByLabelText('Take it off'));
    await settle();

    expect((await stored()).wishlist).toHaveLength(0);
  });
});

/* ============ the voice, and the vetoes ============ */

describe('the room sells nothing, scores nothing and scolds nobody', () => {
  test('no shop, no price alert, no affiliate anything', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    await shell.findByText('Wishlist');
    for (const line of textsIn(shell)) {
      expect(line).not.toMatch(/\b(buy now|shop|browse the shop|deal|discount|offer code|sale)\b/i);
    }
    await settle();
  });

  test('no shame register, no verdict on a body, no guilt score', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    await shell.findByText('Wishlist');
    const banned =
      /\b(really need|wasted|detox|splurge|guilt|deserve|flattering|slimming|pre-?loved|streak|score|progress|complete)\b/i;
    for (const line of textsIn(shell)) expect(line).not.toMatch(banned);
    await settle();
  });

  test('not one exclamation point — the house has one and it is spent', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/wishlist' });
    await shell.findByText('Wishlist');
    for (const line of textsIn(shell)) expect(line).not.toContain('!');
    await settle();
  });
});
