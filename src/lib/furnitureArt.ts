import type { Furniture, FurnitureForm } from '../types';

/**
 * DRAWING THE FURNITURE.
 *
 * The design decision this file exists to serve: **the drawing IS the control.**
 * A place is not a property of a garment the way a colour is — it is a container
 * with an interior and a fullness. Stored as a string in a column, the app can
 * render the fact but never the state. Drawn, you can point at the drawer you
 * mean, which is recognition rather than recall.
 *
 * Built in the frieze grammar (lib/friezeArt.ts): the same 460×560 box, the same
 * floor at y=500, the same stroke weights, butt caps and miter joins. Two things
 * are deliberately different, and both are because this is a CONTROL and the
 * frieze is wallpaper:
 *
 *   1. No opacity ladder. The frieze paints --color-artline at 0.20–0.38. Gold
 *      on the surface measures about 2.0:1 — under the 3:1 WCAG asks of a
 *      graphic. This paints in text tokens at full opacity.
 *   2. The third register is a DASH, not a thinner line. A 1.5px stroke blurs at
 *      non-integer DPR, and a dash survives — and it is the house's own basting
 *      mark, which already means "not yet sewn down".
 *
 * FULLNESS IS DRAWN, NEVER STORED. There is no capacity field and never will be
 * one: all three review panels struck it independently, because a drawer that
 * knows when it is full is inventory software and a fullness meter is a
 * completion meter under another name. The rebate line below is computed from
 * the count of what is in a slot, relative to the fullest slot — a bar chart
 * nobody has to read as a chart.
 */

/* ---------- the box, shared with every frieze piece ---------- */
const VIEW = { w: 460, h: 560 };
const FLOOR = 500;
const CASE_X0 = 96;
const CASE_X1 = 364;
const CASE_W = CASE_X1 - CASE_X0;

/**
 * The unit drawer height, and the number that makes the whole feature legal on
 * a phone. At 390px the page has px-4 and the plate p-4, leaving 326px of
 * drawing width; a 460-unit box therefore renders at scale 0.709. At U=56 a
 * drawer is a 39.7px tap target — under the 44px floor. At 64 it is 45.4px.
 * Do not lower it.
 */
const U = 64;

/** Seven is the tallest chest that fits the box. An eighth drawer is a second piece. */
export const MAX_SLOTS = 7;

/** The three registers. R3 is the basting dash: not yet sewn down. */
const R1 = 'fill="none" stroke="var(--color-text-2)" stroke-width="2.5" stroke-linecap="butt" stroke-linejoin="miter"';
const R2 = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';
const R3 = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="butt"';

export interface DrawnSlot {
  id: string;
  /** Unit-space rectangle of the whole band — the hit target. */
  x: number; y: number; w: number; h: number;
}

export interface Drawing {
  svg: string;
  slots: DrawnSlot[];
  viewBox: string;
}

/**
 * SVG font-size is in USER UNITS, so a naive font-size="13" renders at
 * 13 × 0.709 = 9.2px on a phone — illegible, and under the 13px floor the
 * contract sets for a label on an interactive control. Divide by the scale.
 */
function labelSize(scale: number): number {
  return Math.round(13 / Math.max(scale, 0.001));
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Default slot names, generated on creation and editable afterwards. */
export function defaultSlotLabels(form: FurnitureForm, count: number): string[] {
  if (form === 'rail') {
    return count === 1 ? ['The rail'] : Array.from({ length: count }, (_, i) => `Section ${i + 1}`);
  }
  const noun = form === 'shelves' ? 'shelf' : 'drawer';
  if (count === 1) return [`The ${noun}`];
  if (count > 6) return Array.from({ length: count }, (_, i) => `${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1}`);
  const ordinals = ['Top', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? `Bottom ${noun}` : `${ordinals[i]} ${noun}`);
}

/* ---------- the chest ---------- */
function drawChest(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const n = f.slots.length;
  const H = n * U;
  const y0 = 482 - H;
  const fs = labelSize(scale);
  const most = Math.max(1, ...f.slots.map(s => counts[s.id] ?? 0));

  const parts: string[] = [];
  const slots: DrawnSlot[] = [];

  // Plinth and feet — the piece stands on the frieze's floor.
  parts.push(`<path d="M${CASE_X0} 482h${CASE_W}" ${R1}/>`);
  parts.push(`<path d="M108 482v18M352 482v18" ${R1}/>`);
  // Cap slab, overhanging 8 each side, and the carcass.
  parts.push(`<path d="M88 ${y0 - 8}h284v8h-284z" ${R1}/>`);
  parts.push(`<path d="M${CASE_X0} ${y0}h${CASE_W}v${H}h-${CASE_W}z" ${R1}/>`);

  f.slots.forEach((slot, i) => {
    const by = y0 + i * U;
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    slots.push({ id: slot.id, x: CASE_X0, y: by, w: CASE_W, h: U });

    if (i > 0) parts.push(`<path d="M${CASE_X0} ${by}h${CASE_W}" ${R1}/>`);

    // An EMPTY drawer is drawn in basting stitch and has no handle: a drawer
    // not yet sewn down. Nothing scolds you about it — it reads as available.
    // The handle appears when there is something to pull out.
    parts.push(`<path d="M102 ${by + 4}h256v${U - 8}h-256z" ${filled ? R2 : R3}/>`);
    if (filled) {
      parts.push(`<path d="M206 ${by + U / 2}h48" ${R2}/>`);
      // The rebate — a real drawer's inset rule, run across a fraction of the
      // face equal to this slot's share of the fullest. A drawer not quite
      // pushed home. This is the whole thesis: fullness drawn, never counted.
      const share = Math.min(count / most, 0.92);
      parts.push(`<path d="M102 ${by + U - 10}h${Math.round(254 * share)}" ${R3}/>`);
    }

    const tone = filled ? 'currentColor' : 'var(--color-text-2)';
    parts.push(
      `<text x="112" y="${by + U / 2 + fs * 0.36}" text-anchor="start" fill="${tone}" ` +
      `style="font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em">${esc(slot.label.toUpperCase())}</text>`
    );
    parts.push(
      `<text x="348" y="${by + U / 2 + fs * 0.36}" text-anchor="end" fill="${tone}" ` +
      `style="font:400 ${fs}px var(--font-mono)">${count || ''}</text>`
    );
  });

  return { svg: parts.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- the rail ----------
   First of the three forms, on purpose. The panel's studio-flat seat: "I have a
   rail and a chair. I am not typing 'chair' into a dropdown that offers me
   'dresser'." A rail with clothes on it is drawn with clothes on it, in the
   exact lines the frieze already hangs at the top of every desktop page — so
   owning one rail never reads as owning too little. */
function drawRail(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const n = f.slots.length;
  const fs = labelSize(scale);
  const parts: string[] = [];
  const slots: DrawnSlot[] = [];

  parts.push(`<path d="M70 176h320" ${R1}/>`);
  parts.push(`<path d="M86 176v${FLOOR - 176}M374 176v${FLOOR - 176}" ${R1}/>`);

  const span = 240;
  const step = n > 1 ? span / (n - 1) : 0;
  const first = n > 1 ? 110 : 230;

  f.slots.forEach((slot, i) => {
    const hx = Math.round(first + i * step);
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    const half = n > 1 ? step / 2 : 120;
    slots.push({ id: slot.id, x: hx - half, y: 168, w: half * 2, h: 220 });

    const reg = filled ? R2 : R3;
    // Hook, stem and bar — the frieze's own hanger, verbatim.
    parts.push(`<path d="M${hx - 7} 176a7 7 0 0 1 14 0" ${reg}/>`);
    parts.push(`<path d="M${hx} 190v-8" ${reg}/>`);
    parts.push(`<path d="M${hx} 190l-42 24h84z" ${reg}/>`);
    if (filled) {
      parts.push(
        `<path d="M${hx} 190l-40 22c-3 26-2 48 1 70c25 4 53 4 78 0c3-22 4-44 1-70z" ${R2}/>`
      );
    }
    parts.push(
      `<text x="${hx}" y="${filled ? 320 : 240}" text-anchor="middle" ` +
      `fill="${filled ? 'currentColor' : 'var(--color-text-2)'}" ` +
      `style="font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em">${count || ''}</text>`
    );
  });

  parts.push(`<path d="M70 ${FLOOR}h320" ${R1}/>`);
  return { svg: parts.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- shelves ---------- */
function drawShelves(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const n = f.slots.length;
  const H = n * U;
  const y0 = 482 - H;
  const fs = labelSize(scale);
  const parts: string[] = [];
  const slots: DrawnSlot[] = [];

  parts.push(`<path d="M${CASE_X0} ${y0}h${CASE_W}v${H}h-${CASE_W}z" ${R1}/>`);
  parts.push(`<path d="M104 ${y0}v${H}M356 ${y0}v${H}" ${R1}/>`);
  parts.push(`<path d="M${CASE_X0} 482h${CASE_W}" ${R1}/>`);
  parts.push(`<path d="M108 482v18M352 482v18" ${R1}/>`);

  f.slots.forEach((slot, i) => {
    const sy = y0 + (i + 1) * U;
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    slots.push({ id: slot.id, x: CASE_X0, y: y0 + i * U, w: CASE_W, h: U });

    parts.push(`<path d="M${CASE_X0} ${sy}h${CASE_W}" ${R1}/>`);
    parts.push(`<path d="M${CASE_X0} ${sy + 5}h${CASE_W}" ${R3}/>`);
    if (filled) {
      // The stack caps at three folds however full the shelf is: it is a
      // drawing, not a bar chart. The count carries the number.
      parts.push(`<path d="M140 ${sy - 12}h180M144 ${sy - 22}h172M148 ${sy - 32}h164" ${R2}/>`);
    }
    const tone = filled ? 'currentColor' : 'var(--color-text-2)';
    parts.push(
      `<text x="112" y="${sy - 42}" text-anchor="start" fill="${tone}" ` +
      `style="font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em">${esc(slot.label.toUpperCase())}</text>`
    );
    parts.push(
      `<text x="348" y="${sy - 42}" text-anchor="end" fill="${tone}" ` +
      `style="font:400 ${fs}px var(--font-mono)">${count || ''}</text>`
    );
  });

  return { svg: parts.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/**
 * Draw a piece of furniture, sized from its own slot count.
 *
 * The generator's rule: **a drawer is always a drawer; the case grows.** A
 * three-drawer chest is a squat object with wall above it and a seven-drawer
 * one nearly fills the box. They are not the same drawing scaled — they are
 * different objects, because that is what they are in the room.
 *
 * `scale` is rendered px per unit, and is needed only to size the SVG's text.
 */
export function drawFurniture(
  f: Furniture,
  counts: Record<string, number>,
  scale = 0.709,
): Drawing {
  if (f.form === 'rail') return drawRail(f, counts, scale);
  if (f.form === 'shelves') return drawShelves(f, counts, scale);
  return drawChest(f, counts, scale);
}

/** What one of these is called, in a sentence. */
export const FORM_LABELS: Record<FurnitureForm, string> = {
  rail: 'A rail',
  chest: 'A chest',
  shelves: 'Shelves',
};

/** What its compartments are called. */
export const SLOT_NOUN: Record<FurnitureForm, [string, string]> = {
  rail: ['section', 'sections'],
  chest: ['drawer', 'drawers'],
  shelves: ['shelf', 'shelves'],
};
