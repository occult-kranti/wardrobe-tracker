import { defaultSlotLabels, maxSlotsFor } from './furnitureArt';
import type { ClothingItem, Furniture, FurnitureForm } from '@almari/shared/types';

/**
 * FURNISHING A SAMPLE WARDROBE.
 *
 * The places feature is invisible until somebody draws a place, which is right
 * — and it means a first-time visitor opening a demo closet had no way to know
 * the feature existed at all. So the sample wardrobes come furnished.
 *
 * Three rules the panel would hold us to, and which this file keeps:
 *
 *   1. NOT EVERYTHING IS FILED. A demo where every garment has an address is a
 *      demo of a filing cabinet, and it sets an expectation the app spends the
 *      rest of its life refusing to nag about. Roughly half of what COULD be
 *      filed is, and the rest simply lives in the closet — which is what a real
 *      wardrobe looks like a month in.
 *   2. IT IS SOMEBODY'S ROOM, NOT A SHOWROOM. Each persona gets furniture that
 *      matches what they own: a closet of forty shoes gets a rack, one with
 *      eleven bangles gets a stand, and nobody gets a jewellery box for two
 *      pairs of studs.
 *   3. IT IS THE SAME EVERY TIME. Seeded from the persona's own id, so the
 *      demo a person shows someone else is the demo they saw, and so the
 *      browser suite can assert against it.
 */

/** FNV-1a folded into mulberry32 — the same stable 0..1 the seed data uses. */
function rand(...parts: Array<string | number>): number {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * What kind of thing a compartment wants.
 *
 * Matched against the CATEGORY the wardrobe itself uses, which is user-owned
 * free text — so this reads the words rather than a fixed union, and anything
 * it does not recognise simply never gets filed automatically, which is the
 * safe direction to be wrong in.
 */
type Affinity = 'hanging' | 'folded' | 'shoes' | 'jewellery' | 'bags' | 'any';

function affinityOf(category: string): Affinity {
  const c = category.toLowerCase();
  if (/shoe|boot|sneaker|sandal|footwear/.test(c)) return 'shoes';
  if (/jewel|bangle|ring|earring|necklace/.test(c)) return 'jewellery';
  if (/access|bag|belt|scarf|hat/.test(c)) return 'bags';
  if (/bottom|jean|trouser|chino|jogger|legging|short|skirt/.test(c)) return 'folded';
  if (/top|layer|dress|drape|suit|shirt|blouse|sweater|hoodie|coat|outer|kurta|saree/.test(c)) return 'hanging';
  return 'any';
}

/** What each form's compartments are for, slot by slot. */
function slotWants(form: FurnitureForm, index: number, total: number): Affinity {
  switch (form) {
    case 'rail': return 'hanging';
    case 'chest': return 'folded';
    case 'shelves': return index === 0 ? 'folded' : 'any';
    case 'box': return 'jewellery';
    case 'hooks': return 'bags';
    case 'stand': return 'jewellery';
    case 'rack': return 'shoes';
    case 'almirah-fitted': {
      // fittedPlan's own order: the hanging ledge, then down the right-hand
      // column, then back to the foot of the left.
      return (['hanging', 'folded', 'jewellery', 'jewellery', 'bags', 'shoes', 'folded'] as Affinity[])[index]
        ?? 'any';
    }
    case 'almirah':
    case 'almirah-carved': {
      // The parts, in the order almirahPlan lays them out: the hanging side,
      // the locker, the shelves, then the drawer underneath.
      if (index === 0) return 'hanging';
      if (total >= 3 && index === 1) return 'jewellery';
      if (total >= 4 && index === total - 1) return 'folded';
      return 'any';
    }
    default: return 'any';
  }
}

interface Plan {
  form: FurnitureForm;
  name: string;
  slots: number;
}

/**
 * What this closet is worth furnishing with.
 *
 * Counted from what is actually in it. A form that would stand empty is not
 * offered — an empty drawing in a sample wardrobe teaches the wrong thing about
 * a feature whose whole point is that a place holds something.
 */
function planFor(seed: string, items: ClothingItem[]): Plan[] {
  const tally = new Map<Affinity, number>();
  for (const item of items) {
    const a = affinityOf(item.category);
    tally.set(a, (tally.get(a) ?? 0) + 1);
  }
  const has = (a: Affinity) => tally.get(a) ?? 0;
  const total = items.filter(i => !i.retired).length;
  const plans: Plan[] = [];

  // A SMALL CLOSET IS NOT A SMALL VERSION OF A BIG ONE.
  //
  // Everything below is threshold-gated — a rail at eight hanging pieces, a
  // chest at six folded — so a wardrobe of fourteen things came out as one
  // almirah and nothing else, which is both wrong and the least interesting
  // drawing available. Somebody with fourteen garments does not own an almirah;
  // they own four nails behind a door and a shelf, and that is a better picture
  // than a big cupboard with three things in it.
  if (total < 20) {
    plans.push({ name: 'Pegs by the door', form: 'hooks', slots: 3 + Math.floor(rand(seed, 'hooks') * 2) });
    plans.push({ name: 'The shelf', form: 'shelves', slots: 2 });
    if (has('shoes') >= 2) plans.push({ name: 'By the door', form: 'rack', slots: 2 });
    return plans;
  }

  // The almirah first, always — it is the app's namesake and the object most of
  // its people actually own. Which of the three it is varies by closet.
  const roll = rand(seed, 'almirah');
  const form: FurnitureForm =
    roll < 0.34 ? 'almirah' : roll < 0.67 ? 'almirah-carved' : 'almirah-fitted';
  plans.push({
    form,
    name: form === 'almirah-carved' ? 'The old almirah' : 'Bedroom almirah',
    slots: Math.min(maxSlotsFor(form), 4 + Math.floor(rand(seed, 'almirah-n') * 3)),
  });

  // THE THRESHOLDS SCALE WITH THE CLOSET.
  //
  // Fixed numbers — a rail at eight hanging pieces, a chest at six folded —
  // were read off a sixty-piece wardrobe and are simply the wrong question to
  // ask a twenty-four-piece one: a chef with two pairs of trousers, three pairs
  // of shoes and sixteen shirts came out with a wardrobe and a rail and nothing
  // else, because every other threshold was written for somebody who owns three
  // times as much. Proportion asks the same question at any size.
  const need = (share: number, floor: number) => Math.max(floor, Math.round(total * share));

  if (has('hanging') >= need(0.15, 4)) {
    plans.push({ name: 'The hall rail', form: 'rail', slots: 2 + Math.floor(rand(seed, 'rail') * 3) });
  }
  if (has('folded') >= need(0.10, 3)) {
    plans.push({ name: 'Chest by the window', form: 'chest', slots: 3 + Math.floor(rand(seed, 'chest') * 3) });
  }
  if (has('shoes') >= need(0.08, 2)) {
    plans.push({ name: 'Shoe rack at the door', form: 'rack', slots: 3 + Math.floor(rand(seed, 'rack') * 2) });
  }
  // A BOX AND A STAND ARE NOT ALTERNATIVES. This was a coin flip, which meant a
  // closet with twenty pieces of jewellery in it could only ever have one place
  // to keep them — and a stand holds bangles while a box holds everything that
  // is not a bangle. Past a certain amount, you own both.
  if (has('jewellery') >= need(0.08, 3)) {
    plans.push({ name: 'Jewellery box', form: 'box', slots: 2 + Math.floor(rand(seed, 'box') * 3) });
  }
  if (has('jewellery') >= 12) {
    plans.push({ name: 'Bangle stand', form: 'stand', slots: 2 + Math.floor(rand(seed, 'stand') * 3) });
  }
  if (has('bags') >= need(0.07, 2)) {
    plans.push({ name: 'Pegs by the door', form: 'hooks', slots: 3 + Math.floor(rand(seed, 'hooks') * 3) });
  }

  // Eight, not five. Five was chosen when the room drew a fixed number of even
  // bays; it now fits what it can and puts the rest through the door, so a
  // closet grand enough for eight pieces of furniture may have eight.
  return plans.slice(0, 8);
}

export interface Furnished {
  furniture: Furniture[];
  /** The same items, with a place on some of them. */
  items: ClothingItem[];
}

/**
 * Furnish a wardrobe and file some of it away.
 *
 * Returns new arrays; nothing is mutated, so a caller can furnish a state it
 * does not own.
 */
export function furnish(seed: string, items: ClothingItem[], dateAdded: string): Furnished {
  const plans = planFor(seed, items);
  const furniture: Furniture[] = plans.map((plan, i) => {
    const id = `${seed}-f${i + 1}`;
    const count = Math.max(1, Math.min(maxSlotsFor(plan.form), plan.slots));
    return {
      id,
      name: plan.name,
      form: plan.form,
      dateAdded,
      slots: defaultSlotLabels(plan.form, count).map((label, s) => ({
        id: `${id}-s${s + 1}`,
        label,
      })),
    };
  });

  // Everything that could be filed, grouped by what it is.
  const pool = new Map<Affinity, ClothingItem[]>();
  for (const item of items) {
    if (item.retired) continue;
    const a = affinityOf(item.category);
    const list = pool.get(a) ?? [];
    list.push(item);
    pool.set(a, list);
  }
  for (const [, list] of pool) {
    // Stable shuffle, so the same closet files the same things every time.
    list.sort((a, b) => rand(seed, a.id) - rand(seed, b.id));
  }

  /**
   * FILL BY ROUND, NOT BY PIECE, AND STOP HALFWAY.
   *
   * Filling one piece at a time until its pool ran dry did two things wrong at
   * once, and both showed up the first time this was run against the real
   * personas: the almirah drained the trousers before the chest was reached, so
   * a chest of drawers stood in the room with nothing in it — which teaches
   * exactly the wrong thing about a feature whose point is that a place holds
   * something — and four in five garments ended up with an address, which is a
   * filing cabinet rather than a wardrobe.
   *
   * So: every slot takes a little, in turn, and the whole thing stops at half.
   * A slot whose own kind has run out takes from the leftovers, because a
   * drawer holds whatever needs a drawer.
   */
  const placed = new Map<string, ClothingItem['place']>();
  const eligible = items.filter(i => !i.retired).length;
  const budget = Math.round(eligible * 0.5);
  const spare: ClothingItem[] = [];

  const rounds: { piece: Furniture; slot: Furniture['slots'][number]; wants: Affinity }[] = [];
  for (const piece of furniture) {
    piece.slots.forEach((slot, index) => {
      rounds.push({ piece, slot, wants: slotWants(piece.form, index, piece.slots.length) });
    });
  }

  let filed = 0;

  // EVERY PIECE GETS SOMETHING FIRST.
  //
  // The round-robin below spends a budget of about half the closet across every
  // slot in the room, and a small wardrobe with several pieces of furniture has
  // more slots than budget — so the last piece in the run could be reached only
  // after the budget was gone, and stood there empty. Which is precisely the
  // thing this file's own test forbids, and it went unnoticed until a
  // twenty-piece closet with three places in it was built.
  //
  // So each piece is given one thing before any piece is given two.
  for (const piece of furniture) {
    if (filed >= budget) break;
    const first = rounds.find(r => r.piece.id === piece.id);
    if (!first) continue;
    const own = pool.get(first.wants) ?? [];
    const general = first.wants === 'any' || first.wants === 'folded';
    const item = own.shift()
      ?? (general ? (spare.shift() ?? [...pool.values()].find(list => list.length > 0)?.shift()) : undefined)
      // A specific compartment takes its own kind — but a piece of furniture
      // standing empty in a sample wardrobe is the worse failure of the two.
      ?? [...pool.values()].find(list => list.length > 0)?.shift();
    if (!item) continue;
    placed.set(item.id, { furnitureId: piece.id, slotId: first.slot.id });
    filed++;
  }

  for (let pass = 0; pass < 4 && filed < budget; pass++) {
    for (const { piece, slot, wants } of rounds) {
      if (filed >= budget) break;
      const own = pool.get(wants) ?? [];
      // A SPECIFIC compartment takes its own kind or nothing. Only the general
      // ones fall back — a drawer holds whatever needs a drawer, but a
      // jewellery tray with a kaftan in it is the app being wrong about
      // somebody's own wardrobe, which is worse than the tray being empty.
      const general = wants === 'any' || wants === 'folded';
      const take = 1 + Math.floor(rand(seed, piece.id, slot.id, pass) * 2);
      for (let i = 0; i < take && filed < budget; i++) {
        const item = own.shift()
          ?? (general ? (spare.shift() ?? [...pool.values()].find(list => list.length > 0)?.shift()) : undefined);
        if (!item) break;
        placed.set(item.id, { furnitureId: piece.id, slotId: slot.id });
        filed++;
      }
    }
  }

  // One compartment somewhere is packed away for the season — the feature is
  // the reason places are worth having, and a sample wardrobe that never shows
  // it is a sample wardrobe that hides its best idea.
  const packable = furniture.flatMap(f =>
    f.slots.filter(s => [...placed.values()].some(p => p?.slotId === s.id)).map(s => ({ f, s })));
  if (packable.length > 1) {
    const pick = packable[Math.floor(rand(seed, 'packed') * packable.length)];
    // The flag only. Renaming the compartment to say so overflowed its own
    // label in the drawing, and a place's name belongs to its owner anyway —
    // the detail page says "packed away" in a control, which is where a state
    // belongs.
    pick.s.packed = true;
  }

  return {
    furniture,
    items: items.map(item => {
      const place = placed.get(item.id);
      return place ? { ...item, place } : item;
    }),
  };
}
