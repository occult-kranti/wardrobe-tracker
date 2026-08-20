/**
 * THE WORDS FOR FURNITURE — mirrored from src/lib/furnitureArt.ts by reading it.
 *
 * Nothing here is maths, so nothing here belongs in @almari/shared (docs/34 §5
 * binds the FORMULAS to the shared package; these are copy tables and a naming
 * rule). They are mirrored rather than imported because the web file emits DOM
 * markup and paints in CSS custom properties — see plate.ts for the measured
 * reason that generator cannot cross to native.
 *
 * The ceilings themselves are NOT mirrored: FORM_MAX_SLOTS lives in
 * @almari/shared/types, exactly where the web's own comment says it must
 * ("lives in types.ts rather than in the generator because the migration has to
 * enforce it and the migration must not import a drawing"), and is imported.
 *
 * DRIFT WATCH: defaultSlotLabels() is duplicated logic — the provider's
 * addFurniture (app/src/lib/wardrobe.tsx, squad A) generates the STORED labels
 * and this copy draws only the not-yet-created preview. If the two disagree the
 * preview lies. Reported as a candidate for the shared package.
 */
import { FORM_MAX_SLOTS, type FurnitureForm, type Ornament } from '@almari/shared/types';

/** How many compartments THIS form can have — a drawing limit, never an inventory one. */
export function maxSlotsFor(form: FurnitureForm): number {
  return FORM_MAX_SLOTS[form] ?? 7;
}

/** What one of these is called, in a sentence. */
export const FORM_LABELS: Record<FurnitureForm, string> = {
  rail: 'A rail',
  chest: 'A chest',
  shelves: 'Shelves',
  almirah: 'A steel almirah',
  'almirah-carved': 'A wooden almirah',
  'almirah-fitted': 'A fitted almirah',
  box: 'A jewellery box',
  hooks: 'A row of pegs',
  stand: 'A bangle stand',
  rack: 'A shoe rack',
};

/** One line about each, for the person choosing. */
export const FORM_NOTES: Record<FurnitureForm, string> = {
  rail: 'A rod and what hangs on it. A studio flat is a rail and a chair, and that is a whole wardrobe.',
  chest: 'Drawers, one above another. It holds anything and asks no questions.',
  shelves: 'An open case. What is folded rather than hung.',
  almirah:
    'The pressed-steel wardrobe with a mirror on the door — hanging on one side, shelves and a locker on the other, a drawer beneath.',
  'almirah-carved': 'The old wooden one, with panelled doors and a pediment. Divided inside the same way.',
  'almirah-fitted':
    'Steel case, wooden doors, and an inside fitted out for everything — a hanging ledge, a jewellery tray, shoes at the foot, and a stand for the bags.',
  box: 'Shallow trays under a lid. Rings, studs, chains.',
  hooks: 'A batten and its pegs — the bags, the belts, the scarf that lives by the door.',
  stand: 'A post that bangles stack on.',
  rack: 'Leaning tiers. Shoes, toe down.',
};

/** What its compartments are called — [singular, plural]. */
export const SLOT_NOUN: Record<FurnitureForm, [string, string]> = {
  rail: ['section', 'sections'],
  chest: ['drawer', 'drawers'],
  shelves: ['shelf', 'shelves'],
  almirah: ['compartment', 'compartments'],
  'almirah-carved': ['compartment', 'compartments'],
  'almirah-fitted': ['compartment', 'compartments'],
  box: ['tray', 'trays'],
  hooks: ['peg', 'pegs'],
  stand: ['tier', 'tiers'],
  rack: ['tier', 'tiers'],
};

/** The names of the parts, which is what a fitted almirah's compartments are. */
export const FITTED_LABELS: string[] = [
  'Hanging ledge',
  'Shelves',
  'Jewels',
  'Locker',
  'Bags',
  'Shoes',
  'Drawer',
];

export const ORNAMENT_LABELS: Record<Ornament, string> = {
  plain: 'Plain',
  mughal: 'Mughal',
  rajput: 'Rajput',
  shoji: 'Shoji',
};

export const ORNAMENT_NOTES: Record<Ornament, string> = {
  plain: 'Pressed steel and two panelled doors. Nothing added.',
  mughal:
    'A cusped arch over the case, a pierced screen under it, and the same rhythm again along the plinth.',
  rajput: 'A bracketed hood oversailing the case, heavy rails on the doors, a scalloped apron at the foot.',
  shoji: 'One lintel, an even ladder of rails, and a band of nothing left above it.',
};

/**
 * Default slot names, generated on creation and editable afterwards.
 * Mirrors src/lib/furnitureArt.ts defaultSlotLabels line for line.
 */
export function defaultSlotLabels(form: FurnitureForm, count: number): string[] {
  if (form === 'almirah' || form === 'almirah-carved') {
    const shelves = Math.max(0, count - 1 - (count >= 3 ? 1 : 0) - (count >= 4 ? 1 : 0));
    const shelfNames =
      shelves === 0
        ? []
        : shelves === 1
          ? ['Shelves']
          : shelves === 2
            ? ['Upper', 'Lower']
            : ['Upper', 'Middle', 'Lower'].slice(0, shelves);
    return [
      'The hanging side',
      ...(count >= 3 ? ['Locker'] : []),
      ...shelfNames,
      ...(count >= 4 ? ['The drawer'] : []),
    ].slice(0, count);
  }
  if (form === 'almirah-fitted') return FITTED_LABELS.slice(0, count);
  if (form === 'rail') {
    return count === 1 ? ['The rail'] : Array.from({ length: count }, (_, i) => `Section ${i + 1}`);
  }
  if (form === 'hooks') {
    return count === 1 ? ['The peg'] : Array.from({ length: count }, (_, i) => `Peg ${i + 1}`);
  }
  if (form === 'box') {
    if (count === 1) return ['The tray'];
    const names = ['Top tray', 'Second tray', 'Third tray', 'Bottom tray'];
    return Array.from({ length: count }, (_, i) => names[i] ?? `Tray ${i + 1}`);
  }
  if (form === 'stand' || form === 'rack') {
    if (count === 1) return ['The tier'];
    const ordinals = ['Top', 'Second', 'Third', 'Fourth', 'Fifth'];
    return Array.from({ length: count }, (_, i) =>
      i === count - 1 ? 'Bottom tier' : `${ordinals[i]} tier`,
    );
  }
  const noun = form === 'shelves' ? 'shelf' : 'drawer';
  if (count === 1) return [`The ${noun}`];
  if (count > 6) {
    return Array.from(
      { length: count },
      (_, i) => `${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1}`,
    );
  }
  const ordinals = ['Top', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? `Bottom ${noun}` : `${ordinals[i]} ${noun}`,
  );
}

/** "3 drawers", "1 tray" — the noun agreed with its number. */
export function slotCountPhrase(form: FurnitureForm, n: number): string {
  const noun = SLOT_NOUN[form];
  return `${n} ${n === 1 ? noun[0] : noun[1]}`;
}

/** "4 pieces", "1 piece". The house counts clothes in pieces. */
export function piecePhrase(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}
