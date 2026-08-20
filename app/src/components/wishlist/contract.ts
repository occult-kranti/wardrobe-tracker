/**
 * THE PROVIDER CONTRACT, AS THE WISHLIST READS IT.
 *
 * Squad A2 owns app/src/lib/wardrobe.tsx; this room only consumes it. What
 * landed this wave, and what this room was built to:
 *
 *   wishlist:     WishlistItem[]                     (web: state.wishlist)
 *   addWish:      (draft) => string                  (web: addWishlistItem)
 *   updateWish:   (id, patch) => void                (web: updateWishlistItem)
 *   removeWish:   (id) => () => void                 (web: deleteWishlistItem)
 *   promoteWish:  (id) => string | null              (web: moveWishlistToCloset)
 *
 * ONE DIVERGENCE FROM THIS SQUAD'S BRIEF, RESOLVED IN THE PROVIDER'S FAVOUR
 * AND REPORTED. The brief said promote "creates the piece and removes the
 * wish". The landed `promoteWish` creates the piece and LEAVES THE WISH on the
 * record marked 'bought' — the web's own moveWishlistToCloset semantics, with
 * the provider's stated reason: the two apps write ONE document, the browser's
 * wishlist prints its Bought section from exactly those rows, and a promote on
 * the phone that dropped the row would empty a list in the browser that had
 * been there for months. The wave's standing instruction is to build to the
 * LANDED signature, so this room prints a Bought section that the phone itself
 * fills, and the tests pin the landed behaviour.
 *
 * Two things live here and nowhere else.
 *
 * 1. THE COMPILE-TIME CHECK THAT ARMS ITSELF. `ContractHonoured` reads the
 *    provider's ACTUAL value type. While a member is absent the check passes
 *    (a room may be built ahead of the provider, which is the wave plan); the
 *    moment a member lands with a DIFFERENT signature the check resolves to
 *    `false` and `npx tsc --noEmit` stops compiling this file. That is the
 *    mismatch report, made mechanical rather than remembered. The technique is
 *    squad C's (components/outfits/contract.ts) by way of squad B's
 *    (components/furniture/room.ts); adopted, not reinvented.
 *
 * 2. THE RUNTIME SEAM, NAMED. If the four mutators are ever absent — an older
 *    build, a provider mid-rewrite — the room reads as a list that says out
 *    loud it is not connected, and the mutators do nothing rather than
 *    throwing. `wired` is the only branch any screen carries for it.
 *
 * THE RETURN TYPES ARE DELIBERATELY PERMISSIVE, THE PARAMETERS DELIBERATELY
 * EXACT. `addWish` answering an id and `removeWish` answering a put-it-back
 * closure (the parity R3 gave removeOutfit, which removeFurniture already had)
 * both satisfy this contract — a wider answer is never a broken promise. A
 * mutator that wants DIFFERENT ARGUMENTS is a broken promise, and that is what
 * goes red.
 *
 * WHY `WishPatch` IS MIRRORED RATHER THAN IMPORTED. The provider exports its
 * own; importing it would make this room's expectations invisible and drift
 * silent — the mirror is the whole mechanism above. It is mirrored EXACTLY,
 * not widened: the Looks room's contract declares the wider `Partial<Outfit>`
 * and the provider's own comment names that as the hazard it has to defend
 * against at runtime. This one hands over nothing it is not allowed to.
 *
 * Nothing here computes anything. Every figure the room shows comes from
 * @almari/shared (docs/34 §5); this file only forwards.
 */
import { useMemo } from 'react';

import type { WishlistItem } from '@almari/shared/types';

import { useWardrobe } from '../../lib/wardrobe';

/**
 * What is written when a wish is put on the list. The record mints `id` and
 * `dateAdded` itself — the web's own split (addWishlistItem takes
 * Omit<WishlistItem, 'id' | 'dateAdded'>), so a wish written on the phone is
 * the same shape as one written in the browser.
 */
export type WishDraft = Omit<WishlistItem, 'id' | 'dateAdded'>;

/**
 * The fields a wish is allowed to be WITHOUT. A brand typed by mistake, a
 * price that turned out wrong, notes that stopped being true — each has to be
 * removable, and "removable" cannot share a spelling with "unmentioned"
 * (lead ruling R4). `null` clears; `undefined` says nothing at all.
 */
type WishClearable = 'brand' | 'price' | 'imageUrl' | 'link' | 'notes' | 'coolingOff' | 'releasedAt';

/**
 * What may be amended on a wish. `id` and `dateAdded` are the record's
 * identity and are not reachable from here at all — a patch type that can
 * touch them is a patch type that will one day re-date somebody's wish because
 * a form field was blank.
 */
export type WishPatch = Partial<
  Pick<WishlistItem, 'name' | 'category' | 'color' | 'priority' | 'status'>
> & {
  [K in WishClearable]?: WishlistItem[K] | null;
};

/** The wishlist half of the provider, as this feature relies on it. */
export interface WishSurface {
  wishlist: WishlistItem[];
  /** May answer the new wish's id; the contract does not require one. */
  addWish: (draft: WishDraft) => string | void;
  updateWish: (id: string, patch: WishPatch) => void;
  /** May answer a put-it-back closure; the contract does not require one. */
  removeWish: (id: string) => (() => void) | void;
  /**
   * It was bought: the piece joins the closet at zero wears and the wish stays
   * on the record marked 'bought'. May answer the new piece's id, or an
   * explicit null when there was no such wish.
   */
  promoteWish: (id: string) => string | null | void;
}

type Wardrobe = ReturnType<typeof useWardrobe>;

/**
 * `true` while the provider has no such member (building ahead is allowed),
 * `true` when it has one that satisfies the contract, `false` when it has one
 * that does not. Only the last case is a defect, and only the last case fails
 * the build.
 */
type Honours<K extends keyof WishSurface> =
  Wardrobe extends Record<K, infer Landed>
    ? Landed extends WishSurface[K]
      ? true
      : false
    : true;

type Assert<T extends true> = T;

/** Red the moment the provider lands a shape this room did not build to. */
export type ContractHonoured = [
  Assert<Honours<'wishlist'>>,
  Assert<Honours<'addWish'>>,
  Assert<Honours<'updateWish'>>,
  Assert<Honours<'removeWish'>>,
  Assert<Honours<'promoteWish'>>,
];

export interface WishlistView extends WishSurface {
  /** False if the wishlist half of the contract is ever not there. */
  wired: boolean;
}

const noop = () => undefined;

export function useWishlist(): WishlistView {
  const wardrobe = useWardrobe();
  // Legal narrowing: `A & Partial<B>` is assignable to `A`. No `unknown` hop,
  // so the compile-time check above still reads the real provider type.
  const w = wardrobe as Wardrobe & Partial<WishSurface>;

  const list = Array.isArray(w.wishlist) ? w.wishlist : null;
  const wired =
    list !== null &&
    typeof w.addWish === 'function' &&
    typeof w.updateWish === 'function' &&
    typeof w.removeWish === 'function' &&
    typeof w.promoteWish === 'function';

  const { addWish, updateWish, removeWish, promoteWish } = w;

  return useMemo(
    () => ({
      // One frozen empty list rather than a fresh `[]` per render, so a
      // consumer memoising on `wishlist` is not woken by an absence.
      wishlist: list ?? EMPTY,
      wired,
      addWish: addWish ?? noop,
      updateWish: updateWish ?? noop,
      removeWish: removeWish ?? noop,
      promoteWish: promoteWish ?? noop,
    }),
    [list, wired, addWish, updateWish, removeWish, promoteWish],
  );
}

const EMPTY: WishlistItem[] = [];
