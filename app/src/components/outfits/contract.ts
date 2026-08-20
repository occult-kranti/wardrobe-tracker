/**
 * THE PROVIDER CONTRACT, AS THE OUTFITS ROOM READS IT.
 *
 * This wave's contract (squad A owns src/lib/wardrobe.tsx; this room only
 * consumes it):
 *
 *   outfits:      Outfit[]                                    — already shipped
 *   addOutfit:    (name, itemIds, occasion?) => id | null
 *   updateOutfit: (id, patch) => void                         — null clears (R4)
 *   removeOutfit: (id) => () => void                          — put it back (R3)
 *   logWear:      (itemIds, outfitId?) => void                — already shipped
 *   removeWearLog:(id) => void                                — already shipped
 *
 * Two things live here and nowhere else.
 *
 * 1. THE COMPILE-TIME CHECK THAT ARMS ITSELF. `ContractHonoured` below reads
 *    the provider's ACTUAL value type. While a member is absent the check
 *    passes (the room is building ahead of the provider, by the wave plan);
 *    the moment squad A lands a member with a DIFFERENT signature the check
 *    resolves to `false` and `npx tsc --noEmit` stops compiling this file.
 *    That is the mismatch report, made mechanical rather than remembered —
 *    a squad cannot forget to notice. Both of this wave's provider rulings
 *    (R3's closure, R4's null sentinel) are watched by it: a provider that
 *    still answers `void` from removeOutfit, or that still refuses null on a
 *    patch, is a red build rather than a room quietly offering an Undo that
 *    does nothing.
 *
 * 2. THE RUNTIME SEAM, NAMED. Until the three mutators exist, `addOutfit`
 *    answers `null` — which the builder already treats as a refusal and says
 *    out loud — `updateOutfit` does nothing, and `removeOutfit` answers null
 *    RATHER THAN a no-op closure. That distinction is the whole of R3's
 *    honesty: `null` means there is nothing to put back with, and the room
 *    then offers no Undo at all. A no-op function would have been an Undo
 *    that silently did nothing, which is worse than no offer.
 *
 * Nothing here computes anything. Every figure the room shows comes from
 * @almari/shared (docs/34 §5); this file only forwards.
 */
import type { Occasion, Outfit } from '@almari/shared/types';

import { useWardrobe } from '../../lib/wardrobe';

/**
 * WHAT MAY BE AMENDED, AND THE ONE SENTINEL THAT TAKES SOMETHING OFF.
 *
 * R4: `null` is the clear sentinel — `updateOutfit(id, { occasion: null })`
 * means "this outfit is for nothing in particular now". `undefined` keeps its
 * older meaning, "leave this field alone", which is what makes a partial
 * patch a partial patch. The two are not interchangeable and the room never
 * writes `''`: an empty string is a value the web never produces and no
 * migration case has ever seen.
 *
 * The whitelist is still the provider's to enforce at runtime (R4) — a wider
 * patch type is a legal way to call a narrower parameter, so a type alone
 * could never keep a stray `wearCount` out.
 */
export type OutfitPatch = Omit<Partial<Outfit>, 'occasion'> & { occasion?: Occasion | null };

export type AddOutfit = (name: string, itemIds: string[], occasion?: string) => string | null;
export type UpdateOutfit = (id: string, patch: OutfitPatch) => void;
/** R3: parity with removeFurniture — the way to put the whole thing back. */
export type RemoveOutfit = (id: string) => () => void;

export interface OutfitOps {
  addOutfit: AddOutfit;
  updateOutfit: UpdateOutfit;
  removeOutfit: RemoveOutfit;
}

type Wardrobe = ReturnType<typeof useWardrobe>;

/**
 * `true` while the provider has no such member (building ahead is allowed),
 * `true` when it has one that satisfies the contract, `false` when it has one
 * that does not. Only the last case is a defect, and only the last case fails
 * the build.
 */
type Honours<K extends keyof OutfitOps> =
  Wardrobe extends Record<K, infer Landed>
    ? Landed extends OutfitOps[K]
      ? true
      : false
    : true;

type Assert<T extends true> = T;

/** Red the moment the provider lands a shape this room did not build to. */
export type ContractHonoured = [
  Assert<Honours<'addOutfit'>>,
  Assert<Honours<'updateOutfit'>>,
  Assert<Honours<'removeOutfit'>>,
];

export interface OutfitsView {
  outfits: Outfit[];
  /** False while a mutator is still the provider's to write — the seam, visible. */
  writable: boolean;
  addOutfit: AddOutfit;
  updateOutfit: UpdateOutfit;
  /**
   * The put-it-back closure, or null when there is nothing to put back with
   * (the provider has no such member yet). Narrower than `RemoveOutfit` on
   * purpose — see note 2 above: an Undo that would do nothing is never
   * offered.
   */
  removeOutfit: (id: string) => (() => void) | null;
}

export function useOutfits(): OutfitsView {
  const wardrobe = useWardrobe();
  // Legal narrowing: `A & Partial<B>` is assignable to `A`. No `unknown` hop,
  // so the check above still reads the real provider type.
  const ops = wardrobe as Wardrobe & Partial<OutfitOps>;

  return {
    outfits: wardrobe.outfits,
    writable:
      typeof ops.addOutfit === 'function' &&
      typeof ops.updateOutfit === 'function' &&
      typeof ops.removeOutfit === 'function',
    addOutfit: (name, itemIds, occasion) =>
      typeof ops.addOutfit === 'function' ? ops.addOutfit(name, itemIds, occasion) : null,
    updateOutfit: (id, patch) => {
      if (typeof ops.updateOutfit === 'function') ops.updateOutfit(id, patch);
    },
    removeOutfit: id => {
      if (typeof ops.removeOutfit !== 'function') return null;
      const putBack = ops.removeOutfit(id);
      // The provider is the law on what comes back. A member that answers
      // anything but a function is reported as "nothing to put back with"
      // rather than crashed on at the moment somebody reaches for Undo.
      return typeof putBack === 'function' ? putBack : null;
    },
  };
}
