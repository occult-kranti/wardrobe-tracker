/**
 * WHAT THE LOOKS ROOM SAYS ABOUT A LOOK — the phrasing, in one testable file.
 *
 * Nothing here computes a figure. Every number a look carries (`wearCount`,
 * `lastWorn`) is written by the provider's logWear and read straight off the
 * record; the only arithmetic is the day-count, and that comes from
 * @almari/shared/dates so the room can never disagree with the ledger about
 * what day it is (docs/34 §5 — the maths has one home).
 *
 * The voice is the house tailor's: dry, exact, the clothes as subject. A look
 * that has never been worn is not behind on anything, so "Not worn yet" is a
 * fact and never a nudge; there is no streak, no ratio, and no "you haven't".
 */
import { daysSince } from '@almari/shared/dates';
import type { ClothingItem, Outfit } from '@almari/shared/types';

/** "1 piece" / "4 pieces". */
export function piecesPhrase(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}

/** "Not worn yet" / "Worn once" / "Worn 14 times" — the Today screen's cadence. */
export function wearsPhrase(n: number): string {
  if (n <= 0) return 'Not worn yet';
  if (n === 1) return 'Worn once';
  return `Worn ${n} times`;
}

/**
 * "Last worn today" / "…yesterday" / "…4 days ago", or null when it never has
 * been. Null rather than a placeholder: a look with no last-worn date has one
 * fewer thing to say, not an empty box where a date should be.
 *
 * daysSince clamps at 0, so a date the future somehow left on a record reads
 * as today rather than as a negative number of days.
 */
export function lastWornPhrase(dateStr?: string): string | null {
  if (!dateStr) return null;
  const days = daysSince(dateStr);
  if (Number.isNaN(days)) return null;
  if (days === 0) return 'Last worn today';
  if (days === 1) return 'Last worn yesterday';
  return `Last worn ${days} days ago`;
}

/**
 * The one ledger line under a look: what it has done, when, and how big it is.
 * Mirrors the web's OutfitCard ledger (src/pages/Outfits.tsx) — same three
 * facts, same order, same separator.
 */
export function ledgerLine(outfit: Outfit): string {
  return [wearsPhrase(outfit.wearCount), lastWornPhrase(outfit.lastWorn), piecesPhrase(outfit.itemIds.length)]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/**
 * The pieces of a look that are still in the closet, in the order the look
 * records them. A piece that has been retired or removed simply is not here —
 * see `missingCount` for the sentence that says so out loud.
 */
export function membersOf(outfit: Outfit, byId: Map<string, ClothingItem>): ClothingItem[] {
  return outfit.itemIds
    .map(id => byId.get(id))
    .filter((item): item is ClothingItem => item !== undefined);
}

/** How many of a look's pieces the active closet no longer holds. */
export function missingCount(outfit: Outfit, members: ClothingItem[]): number {
  return Math.max(0, outfit.itemIds.length - members.length);
}

/**
 * WHY addOutfit ANSWERED NULL, as a sentence.
 *
 * The provider refuses a look with no name or no pieces (lib/wardrobe.tsx
 * addOutfit) and answers null so the caller can say WHICH is missing. This is
 * that sentence, and it is deliberately computed from the same two facts the
 * provider tests rather than from a copy of its rule: name trimmed, ids
 * de-blanked and de-duplicated.
 *
 * The room shows it after the press, never as a disabled button. A control
 * that cannot be pressed cannot tell you why, and "Save" going grey is the
 * app declining to explain itself.
 *
 * Note the count: ONE piece is enough here, where the web asks for two. The
 * provider is the law on native and it takes one, so the room states one. A
 * single unrepeatable coat somebody wears as the whole look is a look.
 */
export function refusalSentence(name: string, itemIds: string[]): string | null {
  const named = name.trim().length > 0;
  const pieces = new Set(itemIds.filter(id => id.trim().length > 0)).size;
  if (named && pieces > 0) return null;
  if (!named && pieces === 0) {
    return 'A look needs a name and at least one piece. Neither is here yet.';
  }
  if (!named) {
    return 'The pieces are chosen; the look still needs a name.';
  }
  return 'The name is written; nothing is in the look yet. Tap the pieces that belong together.';
}

/**
 * Looks in the order the room shows them: pinned first, then newest made.
 * Ports the web's sortedOutfits comparator exactly (src/pages/Outfits.tsx).
 * Insertion order decides nothing here and neither does wear count — a league
 * table of somebody's own clothes is the one sort this app will not draw.
 */
export function sortedLooks(outfits: Outfit[]): Outfit[] {
  return [...outfits].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.dateCreated.localeCompare(a.dateCreated);
  });
}
