/**
 * THE WISHLIST'S SENTENCES AND ITS DAYS — the pure half, pinned.
 *
 * components/wishlist/list.ts is the only module in this feature that turns a
 * record into words, so it is the only one where a wrong answer is silent: a
 * screen with a broken layout is obvious and a screen that says "3 DAYS LEFT"
 * on a wait that ended yesterday is not.
 *
 * THE THREE THINGS THESE TESTS EXIST TO SURVIVE:
 *
 *  1. THE SILENCE HOLDS. `waitLine` is the WHOLE of what a cooling-off period
 *     may say, and `isAsking` is the only thing that may reopen the question.
 *     Both are pinned at every boundary — the day before, the day of, the day
 *     after, and after the answer — because the contract (docs/06 §1 row 7) is
 *     that the card asks ONCE and the wait itself never nags.
 *
 *  2. EVERY AMOUNT IS THE RUPEE, FROM @almari/shared/cost. Not a `$`, not a
 *     bare number, not a second formatter. The assertions call formatMoney and
 *     formatPrice themselves and compare, so the day the house currency moves
 *     these tests move with it instead of pinning a stale glyph.
 *
 *  3. A DAY IS A LOCAL DAY. A stored 'YYYY-MM-DD' parsed as UTC is off by one
 *     for half the planet, and a cooling-off period is exactly where that shows
 *     up as a card asking a day early. Every date here is built from
 *     @almari/shared/dates so the test cannot drift from the app's own clock.
 */
import { describe, expect, test } from '@jest/globals';

import { formatMoney, formatPrice } from '@almari/shared/cost';
import { addDays, todayLocal } from '@almari/shared/dates';
import type { WishlistItem } from '@almari/shared/types';

import {
  addedLine,
  DEFAULT_WAIT_DAYS,
  daysUntil,
  isAsking,
  isMidWait,
  metaLine,
  notedLine,
  onTheListLine,
  openTotal,
  parsePrice,
  sections,
  shortDay,
  stayedYoursLine,
  stayedYoursTotal,
  WAIT_OPTIONS,
  waitLine,
} from '../src/components/wishlist/list';

const wish = (over: Partial<WishlistItem> = {}): WishlistItem => ({
  id: 'w-1',
  name: 'Black wool coat',
  category: 'outerwear',
  color: '#201D18',
  priority: 'medium',
  dateAdded: '2026-03-12T09:14:00.000Z',
  status: 'waiting',
  ...over,
});

/* ============ days ============ */

describe('days', () => {
  test('daysUntil counts forward, backward, and refuses to guess', () => {
    expect(daysUntil(todayLocal())).toBe(0);
    expect(daysUntil(addDays(todayLocal(), 6))).toBe(6);
    expect(daysUntil(addDays(todayLocal(), 1))).toBe(1);
    // Past dates go NEGATIVE. shared/dates' daysSince clamps at zero because
    // nothing in the wear ledger looks forward; a wait does, and a clamp here
    // would make an expired wait read as "0 days left" forever.
    expect(daysUntil(addDays(todayLocal(), -1))).toBe(-1);
    expect(daysUntil(addDays(todayLocal(), -30))).toBe(-30);
    // Nonsense is not a date and is not half a date either.
    expect(daysUntil('not-a-day')).toBe(0);
  });

  test('shortDay reads a bare day at LOCAL midnight and a timestamp as itself', () => {
    // The bug this pins: `new Date('2026-01-01')` is UTC midnight, which is
    // 31 Dec for anybody west of Greenwich. The local parse is the only
    // correct one for a stored day.
    expect(shortDay('2026-01-01')).toBe('1 Jan');
    expect(shortDay('2026-03-12')).toBe('12 Mar');
    // A wish's own dateAdded is a full ISO timestamp, not a bare day.
    expect(shortDay('2026-03-12T09:14:00.000Z')).toBe(
      new Date('2026-03-12T09:14:00.000Z').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      }),
    );
    // Unreadable input is handed back untouched rather than rendered as
    // "Invalid Date" — a record that arrived strange stays legible.
    expect(shortDay('sometime')).toBe('sometime');
    expect(shortDay('')).toBe('');
  });

  test('notedLine is the ledger line every wish carries', () => {
    expect(notedLine(wish({ dateAdded: '2026-03-12' }))).toBe('NOTED 12 MAR');
    expect(notedLine(wish({ dateAdded: '' }))).toBe('');
  });
});

/* ============ the silence ============ */

describe('what a wait is allowed to say', () => {
  test('mid-wait, the only thing said is one quiet line', () => {
    const item = wish({ coolingOff: { endsAt: addDays(todayLocal(), 6), asked: false } });
    expect(waitLine(item)).toBe('WAITING · 6 DAYS LEFT');
    expect(isMidWait(item)).toBe(true);
    // And it is NOT asking. The whole point: nothing is put to the person
    // until the wait has actually run out.
    expect(isAsking(item)).toBe(false);
  });

  test('one day left says DAY, not DAYS', () => {
    expect(waitLine(wish({ coolingOff: { endsAt: addDays(todayLocal(), 1), asked: false } }))).toBe(
      'WAITING · 1 DAY LEFT',
    );
  });

  test('a wish with no wait says nothing at all, and is never asked', () => {
    const item = wish();
    expect(waitLine(item)).toBeNull();
    expect(isMidWait(item)).toBe(false);
    expect(isAsking(item)).toBe(false);
  });

  test('the wait ends and the card asks — once', () => {
    const due = wish({ coolingOff: { endsAt: todayLocal(), asked: false } });
    expect(isAsking(due)).toBe(true);
    // The line stops the day the question starts: a card cannot both be
    // waiting quietly and be asking.
    expect(waitLine(due)).toBeNull();

    const overdue = wish({ coolingOff: { endsAt: addDays(todayLocal(), -3), asked: false } });
    expect(isAsking(overdue)).toBe(true);

    // Answered. It never asks again — this is the contract, not a nicety.
    const answered = wish({ coolingOff: { endsAt: addDays(todayLocal(), -3), asked: true } });
    expect(isAsking(answered)).toBe(false);
    expect(waitLine(answered)).toBeNull();
  });

  test('only a WAITING wish is ever asked', () => {
    for (const status of ['kept', 'let-go', 'bought'] as const) {
      const item = wish({ status, coolingOff: { endsAt: todayLocal(), asked: false } });
      expect(isAsking(item)).toBe(false);
      expect(waitLine(item)).toBeNull();
    }
  });
});

/* ============ the list ============ */

describe('the list, in its four states', () => {
  const list = [
    wish({ id: 'w-wait', status: 'waiting', price: 4000 }),
    wish({ id: 'w-kept', status: 'kept', price: 1500 }),
    wish({ id: 'w-gone', status: 'let-go', price: 2500, releasedAt: '2026-08-01' }),
    wish({ id: 'w-home', status: 'bought', price: 900 }),
  ];

  test('sections split by status, and open is waiting plus kept', () => {
    const parts = sections(list);
    expect(parts.waiting.map(w => w.id)).toEqual(['w-wait']);
    expect(parts.kept.map(w => w.id)).toEqual(['w-kept']);
    expect(parts.released.map(w => w.id)).toEqual(['w-gone']);
    expect(parts.bought.map(w => w.id)).toEqual(['w-home']);
    // Open is what has not been answered either way — bought and let-go are
    // answers, so neither counts against "still on the list".
    expect(parts.open.map(w => w.id)).toEqual(['w-wait', 'w-kept']);
  });

  test('the totals add only what was actually recorded', () => {
    const parts = sections(list);
    expect(openTotal(parts.open)).toBe(5500);
    expect(stayedYoursTotal(parts.released)).toBe(2500);
    // A wish with no price contributes nothing rather than a zero standing in
    // for a fact nobody gave.
    expect(openTotal([wish({ price: undefined }), wish({ price: 200 })])).toBe(200);
    expect(openTotal([])).toBe(0);
  });

  test('the masthead counts the list, and says nothing when there is none', () => {
    expect(onTheListLine(sections(list).open)).toBe('2 on the list');
    expect(onTheListLine([wish()])).toBe('1 on the list');
    expect(onTheListLine([])).toBeNull();
  });
});

/* ============ the rupee, from shared ============ */

describe('every amount is the house currency, from @almari/shared/cost', () => {
  test('the stayed-yours line states a total when there is one', () => {
    const released = [wish({ price: 4000 }), wish({ price: 134000 })];
    expect(stayedYoursLine(released)).toBe(`${formatMoney(138000)} stayed yours.`);
    // en-IN grouping, and the rupee — not a dollar, not a bare number.
    expect(stayedYoursLine(released)).toBe('₹1,38,000 stayed yours.');
  });

  test('with no prices on file it counts pieces rather than asserting a sum', () => {
    // "₹0 stayed yours" would assert a total nobody recorded.
    expect(stayedYoursLine([wish({ price: undefined })])).toBe('1 piece stayed on the shelf.');
    expect(stayedYoursLine([wish({ price: undefined }), wish({ price: undefined })])).toBe(
      '2 pieces stayed on the shelf.',
    );
    expect(stayedYoursLine([wish({ price: undefined })])).not.toContain('₹');
  });

  test('the card meta line prints a recorded price value-preserving', () => {
    expect(metaLine(wish({ brand: 'Raw Mango', price: 4500 }), 'Outerwear')).toBe(
      `Outerwear · Raw Mango · ${formatPrice(4500)}`,
    );
    expect(metaLine(wish({ brand: 'Raw Mango', price: 4500 }), 'Outerwear')).toContain('₹4,500');
    // Paise survive on a single recorded price (formatPrice, not formatMoney).
    expect(metaLine(wish({ price: 45.5 }), 'Tops')).toBe('Tops · ₹45.50');
  });

  test('absent parts are absent — never a dash standing in for a fact', () => {
    expect(metaLine(wish({ brand: undefined, price: undefined }), 'Tops')).toBe('Tops');
    expect(metaLine(wish({ brand: 'Raw Mango', price: undefined }), 'Tops')).toBe(
      'Tops · Raw Mango',
    );
    expect(metaLine(wish({ brand: undefined, price: 900 }), 'Tops')).toBe('Tops · ₹900');
    expect(metaLine(wish({ brand: '' }), 'Tops')).toBe('Tops');
  });
});

/* ============ the form's own answers ============ */

describe('what a form hands the record', () => {
  test('a price is a number or it is nothing — never a zero standing in', () => {
    expect(parsePrice('4500')).toBe(4500);
    expect(parsePrice('45.50')).toBe(45.5);
    expect(parsePrice(' 900 ')).toBe(900);
    expect(parsePrice('0')).toBe(0);
    // Absent is the absence of the field. A blank box is not "free".
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('   ')).toBeUndefined();
    expect(parsePrice('a lot')).toBeUndefined();
    // A negative price is not a price.
    expect(parsePrice('-40')).toBeUndefined();
  });

  test('the add sentence names the wait, and only when there is one', () => {
    expect(addedLine(7)).toBe('On the list. It waits 7 days.');
    expect(addedLine(30)).toBe('On the list. It waits 30 days.');
    expect(addedLine(0)).toBe('On the list.');
  });

  test('the wait options are the four the web offers, in the web order', () => {
    expect(WAIT_OPTIONS.map(o => o.days)).toEqual([0, 7, 14, 30]);
    expect(WAIT_OPTIONS.map(o => o.label)).toEqual(['No wait', '7 days', '14 days', '30 days']);
    // Seven days of silence is the house default, stated once.
    expect(DEFAULT_WAIT_DAYS).toBe(7);
    expect(WAIT_OPTIONS.some(o => o.days === DEFAULT_WAIT_DAYS)).toBe(true);
  });
});

/* ============ the voice ============ */

describe('the voice of this module', () => {
  /** Every sentence this module can produce, in one place. */
  const everySentence = (): string[] => {
    const list = [
      wish({ status: 'waiting', price: 4000 }),
      wish({ status: 'kept' }),
      wish({ status: 'let-go', price: 2500 }),
      wish({ status: 'bought' }),
    ];
    const parts = sections(list);
    return [
      addedLine(0),
      addedLine(7),
      stayedYoursLine(parts.released),
      stayedYoursLine([wish({ price: undefined })]),
      onTheListLine(parts.open) ?? '',
      metaLine(list[0], 'Outerwear'),
      notedLine(list[0]),
      waitLine(wish({ coolingOff: { endsAt: addDays(todayLocal(), 3), asked: false } })) ?? '',
    ];
  };

  test('no exclamation point anywhere — the house has one and it is spent', () => {
    for (const line of everySentence()) expect(line).not.toContain('!');
  });

  test('no shame, no verdict, no commerce, no score', () => {
    // Brand law 12's banned register, plus the Before You Buy vetoes: the room
    // is a savvy friend, never a parent, and never a shop.
    const banned =
      /\b(really need|wasted|waste|detox|splurge|guilt|treat yourself|deserve|flattering|slimming|pre-?loved|buy now|shop|deal|discount|saved|savings|streak|score|progress)\b/i;
    for (const line of everySentence()) expect(line).not.toMatch(banned);
  });

  test('nothing this module says is a percentage', () => {
    for (const line of everySentence()) expect(line).not.toContain('%');
  });
});
