/**
 * THE PROVIDER CONTRACT, AS THE LOOKS ROOM READS IT.
 *
 * This wave's contract (squad A owns src/lib/wardrobe.tsx; this room only
 * consumes it):
 *
 *   outfits:      Outfit[]                                    — already shipped
 *   addOutfit:    (name, itemIds, occasion?) => id | null
 *   updateOutfit: (id, patch) => void
 *   removeOutfit: (id) => void
 *   logWear:      (itemIds, outfitId?) => void                — already shipped
 *
 * Two things live here and nowhere else.
 *
 * 1. THE COMPILE-TIME CHECK THAT ARMS ITSELF. `ContractHonoured` below reads
 *    the provider's ACTUAL value type. While a member is absent the check
 *    passes (the room is building ahead of the provider, by the wave plan);
 *    the moment squad A lands a member with a DIFFERENT signature the check
 *    resolves to `false` and `npx tsc --noEmit` stops compiling this file.
 *    That is the mismatch report, made mechanical rather than remembered —
 *    a squad cannot forget to notice.
 *
 * 2. THE RUNTIME SEAM, NAMED. Until the three mutators exist, `addOutfit`
 *    answers `null` — which the builder already treats as a refusal and says
 *    out loud — and the two void mutators do nothing. No screen carries a
 *    branch for the seam, and when the provider lands this adapter becomes a
 *    pass-through with no call site to change.
 *
 * Nothing here computes anything. Every figure the room shows comes from
 * @almari/shared (docs/34 §5); this file only forwards.
 */
import type { Outfit } from '@almari/shared/types';

import { useWardrobe } from '../../lib/wardrobe';

export type AddOutfit = (name: string, itemIds: string[], occasion?: string) => string | null;
export type UpdateOutfit = (id: string, patch: Partial<Outfit>) => void;
export type RemoveOutfit = (id: string) => void;

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

export interface OutfitsView extends OutfitOps {
  outfits: Outfit[];
  /** False while a mutator is still the provider's to write — the seam, visible. */
  writable: boolean;
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
      if (typeof ops.removeOutfit === 'function') ops.removeOutfit(id);
    },
  };
}
