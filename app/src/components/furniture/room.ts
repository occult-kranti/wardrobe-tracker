/**
 * THE DRESSING ROOM'S HALF OF THE PROVIDER CONTRACT.
 *
 * Squad A owns app/src/lib/wardrobe.tsx. The wave's contract was:
 *
 *   furniture: Furniture[]
 *   addFurniture(name, form, slotCount, ornament) => id | null
 *   removeFurniture(id)          — clothes keep every wear, lose only the
 *                                  address (the web's own semantics)
 *   filePiece(itemId, furnitureId, slotId)
 *   MAX_FURNITURE honored
 *
 * What actually landed is that contract with two things the written version did
 * not promise, both of which this feature uses and neither of which it assumes:
 *
 *   removeFurniture RETURNS A PUT-IT-BACK CLOSURE — the whole previous state,
 *   the web's own undo, never a field-by-field inverse. Undo is offered on the
 *   notice only when a function comes back, and the confirmation copy never
 *   promises it, so a provider that returns nothing breaks no sentence.
 *
 *   filePiece TAKES NULLS. A null furnitureId or slotId removes the address,
 *   which is what "take out" has to mean: a place is a convenience, so unfiling
 *   must be as cheap as filing.
 *
 * This module is the ONLY place in the feature that touches useWardrobe, so
 * when the contract moves, one file moves. It reads the surface STRUCTURALLY:
 * WardrobeContextValue is not exported from wardrobe.tsx and cannot be
 * augmented from outside, so the shape is asserted here rather than imported,
 * and `wired` says whether the furniture half is actually present — a build
 * without it reads as an empty room rather than crashing on a missing function.
 */
import { useMemo } from 'react';

import {
  MAX_FURNITURE,
  type ClothingItem,
  type Furniture,
  type FurnitureForm,
  type Ornament,
} from '@almari/shared/types';

import { useWardrobe } from '../../lib/wardrobe';

/** The furniture half of the provider, as this feature relies on it. */
interface FurnitureSurface {
  furniture: Furniture[];
  addFurniture: (
    name: string,
    form: FurnitureForm,
    slotCount: number,
    ornament?: Ornament,
  ) => string | null;
  /** May return a put-it-back closure; the contract does not require one. */
  removeFurniture: (id: string) => (() => void) | void;
  filePiece: (itemId: string, furnitureId: string | null, slotId?: string | null) => void;
}

type Wardrobe = ReturnType<typeof useWardrobe>;

/**
 * THE MISMATCH REPORT, MADE MECHANICAL.
 *
 * `true` while the provider has no such member (a room may be built ahead of
 * the provider, which is the wave plan), `true` when it has one that satisfies
 * the contract above, and `false` when it has one that does NOT. Only the last
 * case is a defect, and only the last case stops `npx tsc --noEmit`. A squad
 * cannot forget to notice a signature that moved under it.
 *
 * The technique is squad C's (app/src/components/outfits/contract.ts), adopted
 * here rather than reinvented.
 */
type Honours<K extends keyof FurnitureSurface> =
  Wardrobe extends Record<K, infer Landed>
    ? Landed extends FurnitureSurface[K]
      ? true
      : false
    : true;

type Assert<T extends true> = T;

export type ContractHonoured = [
  Assert<Honours<'furniture'>>,
  Assert<Honours<'addFurniture'>>,
  Assert<Honours<'removeFurniture'>>,
  Assert<Honours<'filePiece'>>,
];

export interface DressingRoom extends FurnitureSurface {
  activeItems: ClothingItem[];
  /** False while the furniture half of the contract is still to land. */
  wired: boolean;
  /** True once this wardrobe holds as many places as the room will draw. */
  full: boolean;
}

const noopAdd = () => null;
const noop = () => undefined;

export function useDressingRoom(): DressingRoom {
  const wardrobe = useWardrobe();
  // Legal narrowing: `A & Partial<B>` is assignable to `A`. No `unknown` hop,
  // so the compile-time check above still reads the real provider type.
  const w = wardrobe as Wardrobe & Partial<FurnitureSurface>;

  const furniture = Array.isArray(w.furniture) ? w.furniture : [];
  const wired =
    Array.isArray(w.furniture) &&
    typeof w.addFurniture === 'function' &&
    typeof w.removeFurniture === 'function' &&
    typeof w.filePiece === 'function';

  return useMemo(
    () => ({
      furniture,
      activeItems: wardrobe.activeItems,
      wired,
      full: furniture.length >= MAX_FURNITURE,
      addFurniture: w.addFurniture ?? noopAdd,
      removeFurniture: w.removeFurniture ?? noop,
      filePiece: w.filePiece ?? noop,
    }),
    [furniture, wardrobe.activeItems, wired, w.addFurniture, w.removeFurniture, w.filePiece],
  );
}

/**
 * How many pieces sit in each slot of one piece of furniture.
 *
 * The count is DERIVED, every time, from where the clothes say they live.
 * Nothing about fullness is ever stored — no capacity, no size, no percentage.
 */
export function countsFor(items: ClothingItem[], furnitureId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.place?.furnitureId !== furnitureId) continue;
    counts[item.place.slotId] = (counts[item.place.slotId] ?? 0) + 1;
  }
  return counts;
}

/** Everything filed to one compartment, in the order the closet holds it. */
export function inSlot(
  items: ClothingItem[],
  furnitureId: string,
  slotId: string,
): ClothingItem[] {
  return items.filter(i => i.place?.furnitureId === furnitureId && i.place.slotId === slotId);
}

/**
 * How many pieces have no address at all.
 *
 * A FLAT COUNT, NEVER A RATIO. "47 pieces not filed" is a bank balance and is
 * allowed; "39% filed" is progress-as-achievement and is not — all three review
 * panels struck it, and the house bans it besides.
 */
export function unfiledCount(items: ClothingItem[], furniture: Furniture[]): number {
  const known = new Set(furniture.map(f => f.id));
  let unfiled = 0;
  for (const item of items) {
    if (!item.place || !known.has(item.place.furnitureId)) unfiled++;
  }
  return unfiled;
}
