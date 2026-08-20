/**
 * THE LOOKS ROOM, through the real router and the real provider.
 *
 * Rendered through the shipped tree — root layout, WardrobeProvider, the
 * AsyncStorage adapter and migrate-on-read included — so what these tests
 * exercise is the path a tester walks, not a double of it. Every assertion
 * about what was written reads the STORED DOCUMENT after the provider's
 * settle window, because a screen that looks right over state that never
 * reached the shelf is the failure this app cannot afford.
 *
 * THE THREE CHECKS THIS FEATURE EXISTS TO SURVIVE:
 *
 *  1. WEARING A LOOK CREDITS EVERY PIECE IN IT EXACTLY ONCE, against the
 *     look's own id. Twice is a wardrobe that inflates its own history; the
 *     cost-per-wear on every screen in the app is downstream of this number.
 *  2. RETIRING A LOOK NEVER TAKES CLOTHES WITH IT. Counted before and after,
 *     the way scripts/test-features.mjs counts pieces around removing
 *     furniture. The day a grouping can delete a garment it has become a way
 *     to lose things.
 *  3. A REFUSAL IS A SENTENCE. The provider answers null for a nameless or
 *     empty look; the room must say which half is missing, and the control
 *     must still be pressable. A button that has gone grey cannot explain
 *     itself, and the person is left guessing at a rule nobody stated.
 *
 * This file runs with the house flag as it ships (FEED_ENABLED false), so it
 * also proves the negative: with the Look Book out of the house, no surface
 * here mentions sharing at all. outfits-showcase.test.tsx is the other half.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent } from '@testing-library/react-native';
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

import { addDays, todayLocal } from '@almari/shared/dates';
import { FEED_ENABLED } from '@almari/shared/flags';
import type { AppState } from '@almari/shared/types';

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

const DRESSED = [
  piece('i-oxford', 'The white oxford', { wearCount: 14 }),
  piece('i-jumper', 'The navy jumper', { wearCount: 9 }),
  piece('i-scarf', 'The wool scarf', { wearCount: 1 }),
  // Retired: still in the document, never offered to a look being built.
  piece('i-summer', 'The summer dress', { retired: { date: '2026-07-01' } }),
];

const doc = (outfits: object[], items = DRESSED) =>
  JSON.stringify({
    schemaVersion: 8,
    items,
    outfits,
    wearLogs: [],
    wishlist: [],
    circle: { profiles: [], groups: [], messages: [], loans: [] },
    events: [],
    furniture: [],
    photoEncoding: 'inline',
  });

/** Two looks: one pinned and worn, one newer and never worn. */
const KEPT = [
  {
    id: 'o-blacks',
    name: 'Tuesday blacks',
    itemIds: ['i-oxford', 'i-jumper'],
    occasion: 'work',
    favorite: true,
    dateCreated: '2026-07-01T09:00:00.000Z',
    wearCount: 2,
    lastWorn: addDays(todayLocal(), -4),
  },
  {
    id: 'o-scarf',
    name: 'The wool scarf, alone',
    itemIds: ['i-scarf'],
    favorite: false,
    dateCreated: '2026-08-01T09:00:00.000Z',
    wearCount: 0,
  },
];

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

/**
 * Run the clock out: the provider's 250ms write window and the house toast's
 * timer, which stands for nine seconds when a notice carries an offer. Both
 * are advanced rather than waited out — jest-expo runs on fake timers and a
 * real wait never returns under a faked clock. Draining the toast matters as
 * much as draining the write: showToast keeps its queue in MODULE state, so a
 * notice left standing at the end of one test is found by the next one's
 * query.
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
  await seed(doc(KEPT));
});

/* ============ the list ============ */

describe('the looks room', () => {
  test('lists what the wardrobe holds, pinned first and newest next', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    expect(await shell.findByText('Looks')).toBeTruthy();
    expect(shell.getByText('2 looks')).toBeTruthy();
    expect(shell.getByText('Tuesday blacks')).toBeTruthy();
    expect(shell.getByText('The wool scarf, alone')).toBeTruthy();

    // The occasion, title-cased for display and never mangled in the record.
    expect(shell.getByText('Work')).toBeTruthy();

    // The ledger line: what it has done, when, and how big it is.
    expect(shell.getByText('Worn 2 times · Last worn 4 days ago · 2 pieces')).toBeTruthy();
    expect(shell.getByText('Not worn yet · 1 piece')).toBeTruthy();

    // Pinned first — the web's own comparator, not insertion order.
    const names = shell
      .getAllByRole('button')
      .map(node => String(node.props.accessibilityLabel ?? ''))
      .filter(label => label.includes('·'));
    expect(names[0]).toContain('Tuesday blacks');
    expect(names[1]).toContain('The wool scarf, alone');

    // Zero gamification chrome, on the surface that actually has records to
    // gamify (brand law 11). The dressing room's sweep, verbatim.
    for (const node of shell.root.findAllByType('Text' as never)) {
      const kids = (node as { props: { children?: unknown } }).props.children;
      const text = Array.isArray(kids) ? kids.join('') : String(kids ?? '');
      expect(text).not.toMatch(/%/);
      expect(text).not.toMatch(/\b(streak|progress|complete|score|rank)\b/i);
    }

    await settle();
  });

  test('an empty room invites, and states no ratio or ranking anywhere', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    expect(await shell.findByText('Nothing put together yet.')).toBeTruthy();
    expect(shell.getByText(/A look is pieces from the closet, kept as one thing/)).toBeTruthy();
    expect(shell.getByText('Build a look')).toBeTruthy();
    // No count of nothing.
    expect(shell.queryByText('0 looks')).toBeNull();

    for (const node of shell.root.findAllByType('Text' as never)) {
      const kids = (node as { props: { children?: unknown } }).props.children;
      const text = Array.isArray(kids) ? kids.join('') : String(kids ?? '');
      expect(text).not.toMatch(/%/);
      expect(text).not.toMatch(/\b(streak|progress|complete|score)\b/i);
    }

    await settle();
  });

  test('an empty closet is shown the closet, not a builder that cannot succeed', async () => {
    await seed(doc([], []));
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    expect(await shell.findByText('Nothing put together yet.')).toBeTruthy();
    expect(
      shell.getByText(/Add a piece or two and this room has something to work with/),
    ).toBeTruthy();
    // The builder's Save could never succeed over an empty closet, so the one
    // primary on this view is the door to the pieces instead.
    expect(shell.getByText('Open the closet')).toBeTruthy();
    expect(shell.queryByText('Build a look')).toBeNull();

    await settle();
  });

  test('the room carries its own way back — it has no slot on the house bar', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });
    expect(await shell.findByText('Back to the closet')).toBeTruthy();
    await settle();
  });
});

/* ============ building ============ */

describe('build a look', () => {
  test('a named look with pieces in it is written through addOutfit', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    fireEvent.press(await shell.findByText('Build a look'));
    fireEvent.changeText(await shell.findByLabelText('What to call it'), '  Opening night  ');
    fireEvent.press(shell.getByLabelText('The white oxford'));
    fireEvent.press(shell.getByLabelText('The wool scarf'));
    fireEvent.press(shell.getByLabelText('Formal'));
    fireEvent.press(shell.getByText('Save the look'));

    await settle();
    const state = await stored();
    expect(state.outfits).toHaveLength(1);
    // The provider trims the name and de-duplicates the pieces; the room does
    // not do it a second time and does not disagree about the result.
    expect(state.outfits[0].name).toBe('Opening night');
    expect(state.outfits[0].itemIds).toEqual(['i-oxford', 'i-scarf']);
    expect(state.outfits[0].occasion).toBe('formal');
    expect(state.outfits[0].wearCount).toBe(0);
    // Nothing about the clothes moved.
    expect(state.items.find(i => i.id === 'i-oxford')?.wearCount).toBe(14);
  });

  test('a retired piece is not offered to a look being built', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    fireEvent.press(await shell.findByText('Build a look'));
    expect(await shell.findByLabelText('The white oxford')).toBeTruthy();
    // Retired is not gone — it is simply not something to build with.
    expect(shell.queryByLabelText('The summer dress')).toBeNull();

    await settle();
  });

  test('a nameless look is refused in a sentence, and the control stays pressable', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    fireEvent.press(await shell.findByText('Build a look'));
    fireEvent.press(shell.getByLabelText('The white oxford'));

    const save = shell.getByLabelText('Save the look');
    // NEVER A DISABLED BUTTON: a control that cannot be pressed cannot say why.
    expect(save.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(save);

    expect(
      await shell.findByText('The pieces are chosen; the look still needs a name.'),
    ).toBeTruthy();
    expect(shell.getByLabelText('Save the look').props.accessibilityState?.disabled).toBe(false);

    await settle();
    expect((await stored()).outfits).toHaveLength(0);
  });

  test('an empty look is refused in a sentence naming the other missing half', async () => {
    await seed(doc([]));
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });

    fireEvent.press(await shell.findByText('Build a look'));
    fireEvent.press(shell.getByText('Save the look'));
    expect(
      await shell.findByText('A look needs a name and at least one piece. Neither is here yet.'),
    ).toBeTruthy();

    fireEvent.changeText(shell.getByLabelText('What to call it'), 'Opening night');
    fireEvent.press(shell.getByText('Save the look'));
    expect(
      await shell.findByText(
        'The name is written; nothing is in the look yet. Tap the pieces that belong together.',
      ),
    ).toBeTruthy();

    await settle();
    expect((await stored()).outfits).toHaveLength(0);
  });
});

/* ============ one look, open ============ */

describe('one look', () => {
  test('opens from the list and states its own record', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits' });
    fireEvent.press(await shell.findByLabelText(/^Tuesday blacks,/));

    expect(await shell.findByText('Wear it today')).toBeTruthy();
    expect(shell.getByText('Worn 2 times · Last worn 4 days ago · 2 pieces')).toBeTruthy();
    // Every piece named, never identified by photograph alone.
    expect(shell.getByText('The white oxford')).toBeTruthy();
    expect(shell.getByText('The navy jumper')).toBeTruthy();
    expect(shell.getByText('Back to the looks')).toBeTruthy();

    await settle();
  });

  test('wearing it is one confirm, and credits every piece exactly once', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });

    fireEvent.press(await shell.findByText('Wear it today'));
    // The gate says what moves before it moves.
    expect(
      await shell.findByText(
        /Today goes in the record for “Tuesday blacks”, and for all 2 pieces in it/,
      ),
    ).toBeTruthy();
    fireEvent.press(shell.getByText('Log it'));

    expect(await shell.findByText('Logged. “Tuesday blacks” worn 3 times.')).toBeTruthy();

    await settle();
    const state = await stored();

    expect(state.wearLogs).toHaveLength(1);
    const log = state.wearLogs[0];
    expect(log.outfitId).toBe('o-blacks');
    expect(log.date).toBe(todayLocal());
    expect([...log.itemIds].sort()).toEqual(['i-jumper', 'i-oxford']);
    // ONCE, not twice: the itemIds the screen passed are unioned with the
    // look's own, and a piece in both must not be credited from each.
    expect(log.itemIds.filter(x => x === 'i-oxford')).toHaveLength(1);
    expect(state.items.find(i => i.id === 'i-oxford')?.wearCount).toBe(15);
    expect(state.items.find(i => i.id === 'i-jumper')?.wearCount).toBe(10);
    expect(state.items.find(i => i.id === 'i-scarf')?.wearCount).toBe(1);
    expect(state.outfits.find(o => o.id === 'o-blacks')?.wearCount).toBe(3);
  });

  test('amending goes through updateOutfit and never touches the wears', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });

    fireEvent.press(await shell.findByText('Amend this look'));
    fireEvent.changeText(await shell.findByLabelText('What to call it'), 'Tuesday blacks, mended');
    fireEvent.press(shell.getByLabelText('The wool scarf'));
    fireEvent.press(shell.getByText('Save the changes'));

    await settle();
    const amended = (await stored()).outfits.find(o => o.id === 'o-blacks');
    expect(amended?.name).toBe('Tuesday blacks, mended');
    expect(amended?.itemIds).toEqual(['i-oxford', 'i-jumper', 'i-scarf']);
    // Wears are days that happened. Only logWear may move them.
    expect(amended?.wearCount).toBe(2);
    expect(amended?.lastWorn).toBe(addDays(todayLocal(), -4));
  });

  test('removing it is behind the house confirm, and takes no clothes with it', async () => {
    const before = await stored();
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });

    fireEvent.press(await shell.findByText('Remove this look'));
    // The loss, stated truthfully rather than as a warning.
    expect(
      await shell.findByText(/Every piece in it stays in the closet with every wear it earned/),
    ).toBeTruthy();
    expect(shell.getByText(/its own record of being worn 2 times/)).toBeTruthy();
    fireEvent.press(shell.getByText('Remove it'));

    // REMOVE, not "retire": a retired PIECE keeps its record and is merely no
    // longer offered, and removeOutfit does no such thing. The word has to
    // match what the record actually does.
    expect(
      await shell.findByText('Removed. The pieces stay in the closet, with every wear they earned.'),
    ).toBeTruthy();

    await settle();
    const after = await stored();
    expect(after.outfits.map(o => o.id)).toEqual(['o-scarf']);
    // Counted before and after: a grouping is not a way to lose things.
    expect(after.items).toHaveLength(before.items.length);
    expect(after.items.find(i => i.id === 'i-oxford')?.wearCount).toBe(14);
    expect(after.items.find(i => i.id === 'i-jumper')?.wearCount).toBe(9);
    expect(after.wearLogs).toEqual(before.wearLogs);
  });

  test('an occasion is amendable but never written as an empty string', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });

    fireEvent.press(await shell.findByText('Amend this look'));
    // The look already carries one, and updateOutfit has no way to say "take
    // this off" — so the sheet does not pretend it can, and says why.
    expect(
      await shell.findByText(/but not taken off again — the record has no way yet/),
    ).toBeTruthy();
    fireEvent.press(shell.getByLabelText('Work'));
    fireEvent.press(shell.getByText('Save the changes'));

    await settle();
    const amended = (await stored()).outfits.find(o => o.id === 'o-blacks');
    expect(amended?.occasion).toBe('work');

    // The look with no occasion may be given one, and the chip is clearable
    // there because nothing is on the record to clear.
    const scarf = renderRouter('./src/app', { initialUrl: '/outfits/o-scarf' });
    fireEvent.press(await scarf.findByText('Amend this look'));
    expect(scarf.queryByText(/but not taken off again/)).toBeNull();
    fireEvent.press(scarf.getByLabelText('Party'));
    fireEvent.press(scarf.getByLabelText('Party'));
    fireEvent.press(scarf.getByText('Save the changes'));

    await settle();
    const still = (await stored()).outfits.find(o => o.id === 'o-scarf');
    // Deselected before saving: the key is absent, never `''`.
    expect(still && 'occasion' in still).toBe(false);
  });

  test('a retired piece stays in the look, is named, and is still credited', async () => {
    await seed(
      doc([
        {
          id: 'o-summer',
          name: 'Last summer',
          itemIds: ['i-oxford', 'i-summer'],
          favorite: false,
          dateCreated: '2026-07-01T09:00:00.000Z',
          wearCount: 0,
        },
      ]),
    );
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-summer' });

    // The masthead counts two, so two must be on the screen: members resolve
    // from every item, never from the active closet alone.
    expect(await shell.findByText('2 pieces')).toBeTruthy();
    expect(shell.getByText('The summer dress')).toBeTruthy();
    expect(
      shell.getByText('“The summer dress” has been retired. The look keeps its record.'),
    ).toBeTruthy();

    fireEvent.press(shell.getByText('Wear it today'));
    fireEvent.press(shell.getByText('Log it'));

    await settle();
    const state = await stored();
    // logWear filters nothing: a piece worn is a piece worn, retired or not.
    expect([...state.wearLogs[0].itemIds].sort()).toEqual(['i-oxford', 'i-summer']);
    expect(state.items.find(i => i.id === 'i-summer')?.wearCount).toBe(1);
    expect(state.items.find(i => i.id === 'i-summer')?.retired).toBeTruthy();
  });

  test('a look that is not there says so without alarm', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-nothing' });
    expect(await shell.findByText('No record of this look.')).toBeTruthy();
    expect(shell.getByText(/every piece is still in the closet/)).toBeTruthy();
    // Nothing anywhere calls a removed look "retired" — see the removal test.
    expect(shell.queryByText(/Retire/)).toBeNull();
    await settle();
  });
});

/* ============ the flag, off ============ */

describe('the Look Book is out of the house', () => {
  test('nothing in this room offers to share anything', async () => {
    expect(FEED_ENABLED).toBe(false);
    const shell = renderRouter('./src/app', { initialUrl: '/outfits/o-blacks' });
    await shell.findByText('Wear it today');

    expect(shell.queryByText('Share this look')).toBeNull();
    expect(shell.queryByText('Not shared')).toBeNull();
    expect(shell.queryByText('On the feed')).toBeNull();
    expect(shell.queryByText('Take it off the feed')).toBeNull();

    await settle();
  });
});
