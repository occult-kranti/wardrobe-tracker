import { FORM_MAX_SLOTS, type Furniture, type FurnitureForm, type Ornament } from '../types';

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

/**
 * How many compartments THIS form can have.
 *
 * Each number is the count at which that form's own drawing stops giving a 44px
 * target at 390px, and not one more. The arithmetic, so nobody has to redo it:
 * the plate is 326px wide at that viewport, the box is 460 units, so the scale
 * is 0.709 and **one tap target needs 62 units in both directions**.
 *
 *   chest / shelves  a band is the full 268-unit case wide; U=64 tall  → 45px
 *   rail             five hangers across a 264-unit span → 66 units    → 47px
 *   almirah          the locker is the tightest at 66 units tall       → 47px
 *   a box of trays   258 units of body over four trays → 64.5          → 46px
 *   pegs             five over a 340-unit batten → 68 units            → 48px
 *   a rack           five tiers over a 332-unit frame → 66.4          → 47px
 *   a bangle stand   FOUR tiers over 328 units → 82                   → 58px
 *
 * A sixth peg is 56 units, which is 40px, which is a control a thumb misses.
 * So there is no sixth peg — there is a second rail of pegs, which is what a
 * hallway with six bags on it actually has.
 *
 * The stand stops at four rather than five for a different reason, and it is
 * worth writing down: at five the stack of bangles on one tier reaches into the
 * label of the tier above it. The target would have been legal and the drawing
 * would have been wrong.
 */
export function maxSlotsFor(form: FurnitureForm): number {
  return FORM_MAX_SLOTS[form] ?? MAX_SLOTS;
}

/**
 * A label cut to the width it has to live in.
 *
 * SVG does not wrap, does not ellipsize and does not warn: a label too long for
 * its column simply runs out across the drawing and over its neighbour. Mono
 * caps at this size advance about 0.62 of the font size, which is the only
 * number in here that is measured rather than reasoned.
 */
function fitLabel(text: string, widthUnits: number, fs: number): string {
  const room = Math.max(1, Math.floor((widthUnits - 14) / (fs * 0.62)));
  const upper = text.toUpperCase();
  // By code POINT, not code unit. The house bans emoji in its own copy but a
  // person may put one in the name of their own chest of drawers, and cutting
  // a surrogate pair in half leaves a lone surrogate in the string that goes
  // to dangerouslySetInnerHTML — which is invalid XML, so the whole drawing
  // comes back blank rather than the word coming back short.
  const glyphs = [...upper];
  return glyphs.length <= room ? upper : `${glyphs.slice(0, Math.max(1, room - 1)).join('')}…`;
}

/** One label and one count, on the same line, the way every form writes them. */
function band(
  x0: number, x1: number, y: number, text: string, count: number, filled: boolean, fs: number,
): string {
  const tone = filled ? 'currentColor' : 'var(--color-text-2)';
  return (
    `<text x="${x0 + 10}" y="${y}" text-anchor="start" fill="${tone}" ` +
    `style="font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em">` +
    `${esc(fitLabel(text, x1 - x0 - (count ? 34 : 14), fs))}</text>` +
    `<text x="${x1 - 10}" y="${y}" text-anchor="end" fill="${tone}" ` +
    `style="font:400 ${fs}px var(--font-mono)">${count || ''}</text>`
  );
}

/** The frieze's own hanger, at whatever size the case allows. */
function hanger(cx: number, top: number, k: number, reg: string): string {
  const r = Math.round(7 * k);
  const drop = Math.round(14 * k);
  const arm = Math.round(42 * k);
  const fall = Math.round(24 * k);
  return (
    `<path d="M${cx - r} ${top}a${r} ${r} 0 0 1 ${r * 2} 0" ${reg}/>` +
    `<path d="M${cx} ${top + drop}v-${Math.round(8 * k)}" ${reg}/>` +
    `<path d="M${cx} ${top + drop}l-${arm} ${fall}h${arm * 2}z" ${reg}/>`
  );
}

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
  // CEIL, not round. At the phone's 0.709 the rounded answer is 18 units, which
  // renders at 12.76px — a quarter of a pixel under the 13px floor the contract
  // sets for a label on an interactive control, on every form in the app.
  return Math.ceil(13 / Math.max(scale, 0.001));
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Default slot names, generated on creation and editable afterwards. */
export function defaultSlotLabels(form: FurnitureForm, count: number): string[] {
  if (form === 'almirah' || form === 'almirah-carved') {
    // Named after the parts, in the order the parts are in — because an almirah
    // is not N of the same thing, and "Compartment 2" would be a worse name for
    // the locker than the locker already has.
    const shelves = Math.max(0, count - 1 - (count >= 3 ? 1 : 0) - (count >= 4 ? 1 : 0));
    const shelfNames =
      shelves === 0 ? []
        : shelves === 1 ? ['Shelves']
          : shelves === 2 ? ['Upper', 'Lower']
            : ['Upper', 'Middle', 'Lower'].slice(0, shelves);
    return [
      'The hanging side',
      ...(count >= 3 ? ['Locker'] : []),
      ...shelfNames,
      ...(count >= 4 ? ['The drawer'] : []),
    ].slice(0, count);
  }
  if (form === 'almirah-fitted') {
    // The parts' own names, in the order the object reads: the hanging ledge,
    // then down the right-hand column, then back to the foot of the left.
    return FITTED_LABELS.slice(0, count);
  }
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
    const noun = form === 'stand' ? 'tier' : 'tier';
    if (count === 1) return [`The ${noun}`];
    const ordinals = ['Top', 'Second', 'Third', 'Fourth', 'Fifth'];
    return Array.from({ length: count }, (_, i) =>
      i === count - 1 ? `Bottom ${noun}` : `${ordinals[i]} ${noun}`);
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

    // Above the handle, not across it. Centred, the two collided and every
    // filled drawer read as a struck-out word.
    parts.push(band(CASE_X0, CASE_X1, by + 22, slot.label, count, filled, fs));
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

  // 264 units across, so that five hangers sit 66 apart — 47px at 390, over the
  // 44px floor. At the old span of 240 the fifth section was a 42px target.
  const span = 264;
  const step = n > 1 ? span / (n - 1) : 0;
  const first = n > 1 ? 96 : 230;

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

/* ---------- the almirah ----------
   The one form whose inside is not a repetition. A chest is N of the same
   thing; an almirah is a hanging side AND a locker AND shelves AND a drawer,
   in that order, because that is the order they are in. So the slot count does
   not multiply a band — it decides how much of a fixed interior is there, and
   the labels are the parts' own names rather than "Drawer 3".

   This is also why it is two forms and not one with a flag: a pressed-steel
   almirah and a carved wooden one hold the same things and are not the same
   object, and the whole thesis of this file is that you should recognise your
   own furniture in the drawing. */

const A_TOP = 96;
const A_BOT = 482;
const IN_X0 = 104;
const IN_X1 = 356;
const IN_TOP = 106;
const DIV_X = 210;
const LOCKER_H = 66;
const A_DRAWER_H = 64;

interface AlmirahPart {
  role: 'hanging' | 'locker' | 'shelf' | 'drawer';
  x: number; y: number; w: number; h: number;
}

/**
 * Which parts an almirah of N compartments has, and where they sit.
 *
 * The order is the object's, not the owner's: the hanging side is always there
 * because that is what an almirah is for, the locker arrives third because a
 * cupboard with a locker in it is a cupboard people keep things in, and the
 * drawer is last because it is under everything.
 */
function almirahPlan(n: number): AlmirahPart[] {
  const hasDrawer = n >= 4;
  const hasLocker = n >= 3;
  const shelves = Math.max(0, n - 1 - (hasLocker ? 1 : 0) - (hasDrawer ? 1 : 0));
  const drawerTop = A_BOT - 4 - A_DRAWER_H;
  const bottom = hasDrawer ? drawerTop - 4 : A_BOT - 4;
  const divided = hasLocker || shelves > 0;
  const rightX = divided ? DIV_X : IN_X0;
  const rightW = IN_X1 - rightX;

  const parts: AlmirahPart[] = [{
    role: 'hanging',
    x: IN_X0, y: IN_TOP,
    w: (divided ? DIV_X : IN_X1) - IN_X0,
    h: bottom - IN_TOP,
  }];
  const shelfTop = IN_TOP + (hasLocker ? LOCKER_H : 0);
  if (hasLocker) parts.push({ role: 'locker', x: rightX, y: IN_TOP, w: rightW, h: LOCKER_H });
  const bandH = shelves > 0 ? (bottom - shelfTop) / shelves : 0;
  for (let i = 0; i < shelves; i++) {
    parts.push({
      role: 'shelf', x: rightX, y: Math.round(shelfTop + i * bandH), w: rightW,
      h: Math.round(bandH),
    });
  }
  if (hasDrawer) {
    parts.push({ role: 'drawer', x: IN_X0, y: drawerTop, w: IN_X1 - IN_X0, h: A_DRAWER_H });
  }
  return parts;
}

function drawAlmirah(
  f: Furniture, counts: Record<string, number>, scale: number, carved: boolean,
): Drawing {
  const fs = labelSize(scale);
  const parts = almirahPlan(f.slots.length);
  const out: string[] = [];
  const slots: DrawnSlot[] = [];

  // The doors, folded flat to either side. A cabinet drawn shut is a rectangle
  // and says nothing; drawn ajar it would need perspective, which this house
  // does not have. Folded open against the case, it stays flat, stays legible,
  // and shows the whole interior — which is the only reason to draw an almirah
  // at all.
  const leaf = (x0: number, x1: number, mirror: boolean) => {
    out.push(`<path d="M${x0} ${A_TOP + 4}h${x1 - x0}v${A_BOT - A_TOP - 8}h-${x1 - x0}z" ${R1}/>`);
    if (carved) {
      // Two sunk panels, the way a joiner divides a door.
      out.push(`<path d="M${x0 + 5} ${A_TOP + 16}h${x1 - x0 - 10}v150h-${x1 - x0 - 10}z" ${R1}/>`);
      out.push(`<path d="M${x0 + 5} ${A_TOP + 182}h${x1 - x0 - 10}v170h-${x1 - x0 - 10}z" ${R1}/>`);
    } else if (mirror) {
      // The full-length mirror every steel almirah has on its left leaf, said
      // in the one mark this house has for glass: a basting stroke across it.
      out.push(`<path d="M${x0 + 5} ${A_TOP + 26}h${x1 - x0 - 10}v300h-${x1 - x0 - 10}z" ${R1}/>`);
      out.push(`<path d="M${x0 + 10} ${A_TOP + 300}l${x1 - x0 - 20}-${262}" ${R3}/>`);
    }
  };
  leaf(68, 92, !carved);
  leaf(368, 392, false);

  // The case.
  out.push(`<path d="M96 ${A_TOP}h268v${A_BOT - A_TOP}h-268z" ${R1}/>`);
  if (carved) {
    // A shallow pediment, and turned feet. An old wooden almirah is known by
    // its top and its ankles.
    out.push(`<path d="M84 ${A_TOP}q146-42 292 0" ${R1}/>`);
    out.push(`<path d="M84 ${A_TOP}h292" ${R1}/>`);
    out.push(`<path d="M110 ${A_BOT}v8q0 10-8 10M350 ${A_BOT}v8q0 10 8 10" ${R1}/>`);
  } else {
    // A pressed lip, and the four rivets that hold a steel case together.
    out.push(`<path d="M96 ${A_TOP + 12}h268" ${R1}/>`);
    for (const [rx, ry] of [[106, A_TOP + 22], [354, A_TOP + 22], [106, A_BOT - 12], [354, A_BOT - 12]]) {
      out.push(`<path d="M${rx - 4} ${ry}h8M${rx} ${ry - 4}v8" ${R1}/>`);
    }
    out.push(`<path d="M108 ${A_BOT}v18M352 ${A_BOT}v18" ${R1}/>`);
  }
  out.push(`<path d="M96 ${A_BOT}h268" ${R1}/>`);

  const divided = parts.some(p => p.role !== 'hanging' && p.role !== 'drawer');
  if (divided) {
    const tall = parts.find(p => p.role === 'hanging')!;
    out.push(`<path d="M${DIV_X} ${IN_TOP}v${tall.h}" ${R1}/>`);
  }

  parts.forEach((part, i) => {
    const slot = f.slots[i];
    if (!slot) return;
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    const reg = filled ? R2 : R3;
    slots.push({ id: slot.id, x: part.x, y: part.y, w: part.w, h: part.h });

    if (part.role === 'hanging') {
      // The rod, and what is on it.
      const rodY = part.y + 26;
      out.push(`<path d="M${part.x + 6} ${rodY}h${part.w - 12}" ${R1}/>`);
      const k = Math.min(0.62, part.w / 240);
      const many = Math.min(3, Math.max(1, count));
      for (let hI = 0; hI < many; hI++) {
        const cx = Math.round(part.x + part.w * ((hI + 1) / (many + 1)));
        out.push(hanger(cx, rodY, k, reg));
        if (filled) {
          const arm = Math.round(42 * k);
          const drop = Math.round(14 * k);
          out.push(
            `<path d="M${cx} ${rodY + drop}l-${arm - 2} ${Math.round(22 * k)}` +
            `c-3 ${Math.round(60 * k)}-2 ${Math.round(110 * k)} 1 ${Math.round(150 * k)}` +
            `c${Math.round(24 * k)} 4 ${Math.round(52 * k)} 4 ${Math.round(76 * k)} 0` +
            `c3-${Math.round(40 * k)} 4-${Math.round(90 * k)} 1-${Math.round(150 * k)}z" ${R2}/>`
          );
        }
      }
      // Vertical, because the hanging side is a tall narrow column and a label
      // laid across it would run out over the shelves.
      const tone = filled ? 'currentColor' : 'var(--color-text-2)';
      out.push(
        `<text x="${part.x + 18}" y="${part.y + part.h - 14}" fill="${tone}" ` +
        `transform="rotate(-90 ${part.x + 18} ${part.y + part.h - 14})" ` +
        `style="font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em">` +
        `${esc(fitLabel(slot.label, part.h - 20, fs))}</text>`
      );
      if (count) {
        out.push(
          `<text x="${part.x + part.w - 10}" y="${part.y + part.h - 12}" text-anchor="end" ` +
          `fill="${tone}" style="font:400 ${fs}px var(--font-mono)">${count}</text>`
        );
      }
      return;
    }

    if (part.role === 'locker') {
      out.push(`<path d="M${part.x + 6} ${part.y + 6}h${part.w - 12}v${part.h - 12}h-${part.w - 12}z" ${reg}/>`);
      // A keyhole. The locker is the compartment that locks, and that is the
      // whole of what makes it a locker rather than a small shelf.
      const kx = part.x + 18;
      const ky = part.y + part.h / 2;
      out.push(`<path d="M${kx} ${ky - 5}a5 5 0 1 1 0 10a5 5 0 1 1 0-10" ${reg}/>`);
      out.push(`<path d="M${kx} ${ky + 5}v8" ${reg}/>`);
      out.push(band(part.x + 22, part.x + part.w, part.y + part.h / 2 + fs * 0.36, slot.label, count, filled, fs));
      return;
    }

    if (part.role === 'shelf') {
      out.push(`<path d="M${part.x} ${part.y + part.h}h${part.w}" ${R1}/>`);
      if (filled) {
        // The stack caps at three folds however full the shelf is: it is a
        // drawing, not a bar chart. The count carries the number.
        out.push(
          `<path d="M${part.x + 16} ${part.y + part.h - 12}h${part.w - 32}` +
          `M${part.x + 20} ${part.y + part.h - 22}h${part.w - 40}` +
          `M${part.x + 24} ${part.y + part.h - 32}h${part.w - 48}" ${R2}/>`
        );
      } else {
        out.push(`<path d="M${part.x + 8} ${part.y + part.h - 5}h${part.w - 16}" ${R3}/>`);
      }
      out.push(band(part.x, part.x + part.w, part.y + 20, slot.label, count, filled, fs));
      return;
    }

    // The drawer under the lot.
    out.push(`<path d="M${part.x + 4} ${part.y + 4}h${part.w - 8}v${part.h - 8}h-${part.w - 8}z" ${reg}/>`);
    if (filled) out.push(`<path d="M${part.x + part.w / 2 - 24} ${part.y + part.h / 2}h48" ${R2}/>`);
    out.push(band(part.x, part.x + part.w, part.y + part.h / 2 + fs * 0.36, slot.label, count, filled, fs));
  });

  return { svg: out.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- the fitted almirah ----------
   A steel carcass with wooden doors, fitted out inside for everything a
   wardrobe actually holds: a hanging ledge, a shelf, a tray for the jewellery,
   the locker, a stand for the bags, shoes at the foot, a drawer under them.

   It is a third almirah rather than a wider one because its INTERIOR IS LAID
   OUT DIFFERENTLY, not merely divided further: the tall column on the left runs
   the hanging, the shoes and the drawer, while the right-hand column stacks the
   small things full-height. That layout is the only reason seven compartments
   fit at a legal size — stacking all seven the plain almirah's way gives bands
   of 59 units, which is 42px, which is a control a thumb misses. */

const F_TOP = 96;
const F_BOT = 482;
const F_IN_X0 = 104;
const F_IN_X1 = 356;
const F_IN_TOP = 106;
const F_IN_BOT = 478;
/**
 * The stile between the two columns: left 120 wide, right 132. Both clear the
 * 62-unit floor, and the split is where it is because of the WORDS rather than
 * the boxes — at 216 the left column was 112 wide, which leaves room for six
 * characters beside a count, and "DRAWER" is six characters that then collided
 * with its own number. Eight units moved settles it with nothing to truncate.
 */
const F_DIV = 224;

type FittedRole = 'hanging' | 'shelves' | 'jewels' | 'locker' | 'bags' | 'shoes' | 'drawer';

interface FittedPart {
  role: FittedRole;
  x: number; y: number; w: number; h: number;
}

/**
 * The parts of a fitted almirah, in the object's own order.
 *
 * Left column, top to bottom: the hanging ledge, the shoe tier, the drawer.
 * Right column, top to bottom: shelves, the jewellery tray, the locker, the bag
 * stand. The order the compartments are RETURNED in is the order they are read
 * — hanging first, then down the right, then back to the foot of the left —
 * which is also the order they arrive in as the count grows.
 */
function fittedPlan(n: number): FittedPart[] {
  const rightRoles: FittedRole[] = ['shelves', 'jewels', 'locker', 'bags'];
  const rightCount = Math.max(0, Math.min(4, n - 1));
  const hasShoes = n >= 6;
  const hasDrawer = n >= 7;

  // The left column's own split. Every band clears 62 units.
  const leftBands: { role: FittedRole; y: number; h: number }[] = [];
  if (hasDrawer) {
    leftBands.push({ role: 'hanging', y: F_IN_TOP, h: 194 });
    leftBands.push({ role: 'shoes', y: 304, h: 86 });
    leftBands.push({ role: 'drawer', y: 394, h: 84 });
  } else if (hasShoes) {
    leftBands.push({ role: 'hanging', y: F_IN_TOP, h: 280 });
    leftBands.push({ role: 'shoes', y: 390, h: 88 });
  } else {
    leftBands.push({ role: 'hanging', y: F_IN_TOP, h: F_IN_BOT - F_IN_TOP });
  }

  const leftW = (rightCount > 0 ? F_DIV : F_IN_X1) - F_IN_X0;
  const byRole = new Map<FittedRole, FittedPart>();
  for (const band of leftBands) {
    byRole.set(band.role, { role: band.role, x: F_IN_X0, y: band.y, w: leftW, h: band.h });
  }

  const rightH = (F_IN_BOT - F_IN_TOP) / Math.max(1, rightCount);
  for (let i = 0; i < rightCount; i++) {
    byRole.set(rightRoles[i], {
      role: rightRoles[i],
      x: F_DIV, y: Math.round(F_IN_TOP + i * rightH),
      w: F_IN_X1 - F_DIV, h: Math.round(rightH),
    });
  }

  const order: FittedRole[] = ['hanging', ...rightRoles, 'shoes', 'drawer'];
  return order.map(role => byRole.get(role)).filter((p): p is FittedPart => !!p);
}

/** The names of the parts, which is what a fitted almirah's compartments are. */
const FITTED_LABELS: string[] = [
  'Hanging ledge', 'Shelves', 'Jewels', 'Locker', 'Bags', 'Shoes', 'Drawer',
];

/**
 * ORNAMENT — Mughal, Rajput and Japanese, on the one form grand enough for it.
 *
 * ONE LAW, and it decides everything else: **no ornament inside the carcass.**
 * Everything between (96,96) and (364,482) is a working part — the rod and what
 * hangs on it, the trays, the locker and its keyhole, the labels, the counts,
 * and the rectangles a thumb aims at. Ornament goes where the object actually
 * has area and no job: the crest above the case, the leaves, the plinth below.
 *
 * The second decision is the interesting one, and it came from measuring rather
 * than from taste. A true jaali is two crossing diagonal families; at the pitch
 * this drawing can afford, the perpendicular spacing is about 9px against 1.1px
 * strokes. That is not a screen, it is grey tone, and on a fractional DPR it
 * moirés. **So the Mughal treatment ships as a pierced grille — vertical bars
 * with a real opening between them — which is what a jaali resolves to from
 * three feet away anyway.** More authentic and less legible is a trade this
 * house does not make.
 *
 * The leaves fold flat at 24 units wide, which is thirteen pixels. A leaf that
 * narrow can say three things: how many rails divide it, where they sit, and
 * whether they are light or heavy. It cannot carry a pattern, so none of these
 * treatments puts one there — each states its tradition in the RHYTHM of its
 * rails, which is how a joiner would have done it.
 */
const ORN = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';

interface OrnamentSet {
  crest: (scale: number) => string;
  leaf: (x0: number, scale: number) => string;
  plinth: () => string;
}

const ORNAMENT_SETS: Record<Ornament, OrnamentSet> = {
  plain: {
    crest: () => '',
    leaf: (x0) =>
      `<path d="M${x0 + 5} 112h14v150h-14z" ${R1}/><path d="M${x0 + 5} 278h14v170h-14z" ${R1}/>`,
    plinth: () => '',
  },

  // The mehrab: a nine-point cusped arch springing off the case's own corners,
  // with a pierced tympanum under it and the same pitch repeated as a
  // ventilated plinth — crest and base tied by one rhythm.
  mughal: {
    crest: () =>
      `<path d="M84 96h292" ${ORN}/>` +
      `<path d="M96 96Q100 76 120 70Q133 50 156 52Q175 36 198 46Q218 44 230 26` +
      `Q242 44 262 46Q285 36 304 52Q327 50 340 70Q360 76 364 96" ${ORN}/>` +
      `<path d="M150 58h160v34h-160z" ${ORN}/>` +
      `<path d="M170 58v34M194 58v34M218 58v34M242 58v34M266 58v34M290 58v34" ${ORN}/>`,
    leaf: (x0, scale) =>
      `<path d="M${x0 + 5} 112h14v226h-14z" ${ORN}/>` +
      `<path d="M${x0 + 5} 350h14v100h-14z" ${ORN}/>` +
      // The arched head is 4px tall at phone scale; below that it is lint.
      (scale >= 0.68 ? `<path d="M${x0 + 5} 128q7-14 14 0" ${ORN}/>` : ''),
    plinth: () =>
      `<path d="M96 496h268" ${ORN}/>` +
      `<path d="M122 482v14M146 482v14M170 482v14M194 482v14M218 482v14` +
      `M242 482v14M266 482v14M290 482v14M314 482v14M338 482v14" ${ORN}/>`,
  },

  // The jharokha, made drawable in a house with no perspective: the projection
  // is stated as OVERSAIL rather than as depth. Heavier throughout, because
  // heaviness is the axis Rajput woodwork has and Mughal does not.
  rajput: {
    crest: () =>
      `<path d="M52 40h356v18h-356z" ${R1}/>` +
      `<path d="M96 96v-24q0-14 14-14M364 96v-24q0-14-14-14" ${R1}/>` +
      `<path d="M110 58a30 12 0 0 0 60 0a30 12 0 0 0 60 0a30 12 0 0 0 60 0a30 12 0 0 0 60 0" ${ORN}/>`,
    leaf: (x0) =>
      // Bold cross-bands the full width of the leaf. The panels are implied by
      // the bands and never outlined: a 5-unit inset rule at this width merges
      // with the stile and reads as a thicker line, not as a panel.
      `<path d="M${x0} 104h24M${x0} 116h24M${x0} 268h24M${x0} 280h24M${x0} 452h24M${x0} 464h24" ${R1}/>`,
    plinth: () =>
      `<path d="M92 482h280M92 492h280" ${R1}/>` +
      `<path d="M120 492a22 8 0 0 0 44 0a22 8 0 0 0 44 0a22 8 0 0 0 44 0a22 8 0 0 0 44 0a22 8 0 0 0 44 0" ${ORN}/>`,
  },

  // Shoji, and the corrective. One lintel, an even ladder, one line on the
  // floor — and then a band of nothing above the lintel that is never filled.
  // The empty part is the treatment.
  shoji: {
    crest: () => `<path d="M64 76h332v12h-332z" ${ORN}/>`,
    leaf: (x0) =>
      `<path d="M${x0 + 5} 112h14v340h-14z" ${ORN}/>` +
      `<path d="M${x0 + 5} 180h14M${x0 + 5} 248h14M${x0 + 5} 316h14M${x0 + 5} 384h14" ${ORN}/>`,
    plinth: () => `<path d="M84 500h292" ${ORN}/>`,
  },
};

/** What each treatment is called, for the one control that offers them. */
export const ORNAMENT_LABELS: Record<Ornament, string> = {
  plain: 'Plain',
  mughal: 'Mughal',
  rajput: 'Rajput',
  shoji: 'Shoji',
};

export const ORNAMENT_NOTES: Record<Ornament, string> = {
  plain: 'Pressed steel and two panelled doors. Nothing added.',
  mughal: 'A cusped arch over the case, a pierced screen under it, and the same rhythm again along the plinth.',
  rajput: 'A bracketed hood oversailing the case, heavy rails on the doors, a scalloped apron at the foot.',
  shoji: 'One lintel, an even ladder of rails, and a band of nothing left above it.',
};

function drawFitted(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const fs = labelSize(scale);
  const parts = fittedPlan(f.slots.length);
  const out: string[] = [];
  const slots: DrawnSlot[] = [];

  // WOODEN DOORS, folded flat against a STEEL CASE — the two materials are the
  // whole of what this object is called, so both are drawn rather than stated.
  // Wood is panelled; steel is riveted and has a pressed lip.
  const orn = ORNAMENT_SETS[f.ornament ?? 'plain'];
  out.push(orn.crest(scale));
  for (const [x0, x1] of [[68, 92], [368, 392]]) {
    out.push(`<path d="M${x0} ${F_TOP + 4}h${x1 - x0}v${F_BOT - F_TOP - 8}h-${x1 - x0}z" ${R1}/>`);
    out.push(orn.leaf(x0, scale));
  }
  out.push(`<path d="M96 ${F_TOP}h268v${F_BOT - F_TOP}h-268z" ${R1}/>`);
  out.push(`<path d="M96 ${F_TOP + 12}h268" ${R1}/>`);
  for (const [rx, ry] of [[106, F_TOP + 22], [354, F_TOP + 22], [106, F_BOT - 12], [354, F_BOT - 12]]) {
    out.push(`<path d="M${rx - 4} ${ry}h8M${rx} ${ry - 4}v8" ${R1}/>`);
  }
  out.push(`<path d="M96 ${F_BOT}h268" ${R1}/>`);
  out.push(`<path d="M108 ${F_BOT}v18M352 ${F_BOT}v18" ${R1}/>`);
  out.push(orn.plinth());

  const divided = parts.some(p => p.x === F_DIV);
  if (divided) out.push(`<path d="M${F_DIV} ${F_IN_TOP}v${F_IN_BOT - F_IN_TOP}" ${R1}/>`);

  parts.forEach((part, i) => {
    const slot = f.slots[i];
    if (!slot) return;
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    const reg = filled ? R2 : R3;
    slots.push({ id: slot.id, x: part.x, y: part.y, w: part.w, h: part.h });
    const tone = filled ? 'currentColor' : 'var(--color-text-2)';
    const mono = `font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em`;

    switch (part.role) {
      case 'hanging': {
        const rodY = part.y + 26;
        out.push(`<path d="M${part.x + 6} ${rodY}h${part.w - 12}" ${R1}/>`);
        const k = Math.min(0.5, part.w / 240);
        const many = Math.min(3, Math.max(1, count));
        for (let hI = 0; hI < many; hI++) {
          const cx = Math.round(part.x + part.w * ((hI + 1) / (many + 1)));
          out.push(hanger(cx, rodY, k, reg));
          if (filled) {
            const arm = Math.round(42 * k);
            out.push(
              `<path d="M${cx} ${rodY + Math.round(14 * k)}l-${arm - 2} ${Math.round(22 * k)}` +
              `c-3 ${Math.round(56 * k)}-2 ${Math.round(104 * k)} 1 ${Math.round(140 * k)}` +
              `c${Math.round(22 * k)} 4 ${Math.round(48 * k)} 4 ${Math.round(70 * k)} 0` +
              `c3-${Math.round(36 * k)} 4-${Math.round(84 * k)} 1-${Math.round(140 * k)}z" ${R2}/>`
            );
          }
        }
        // Vertical: a tall narrow column cannot carry a word laid across it.
        out.push(
          `<text x="${part.x + 18}" y="${part.y + part.h - 14}" fill="${tone}" ` +
          `transform="rotate(-90 ${part.x + 18} ${part.y + part.h - 14})" style="${mono}">` +
          `${esc(fitLabel(slot.label, part.h - 20, fs))}</text>`
        );
        if (count) {
          out.push(
            `<text x="${part.x + part.w - 10}" y="${part.y + part.h - 12}" text-anchor="end" ` +
            `fill="${tone}" style="font:400 ${fs}px var(--font-mono)">${count}</text>`
          );
        }
        break;
      }
      case 'shelves': {
        const rules = Math.min(3, Math.max(1, Math.floor(part.h / 64)));
        for (let r = 1; r <= rules; r++) {
          const sy = Math.round(part.y + (part.h * r) / (rules + 1));
          out.push(`<path d="M${part.x} ${sy}h${part.w}" ${R1}/>`);
          if (filled) {
            out.push(`<path d="M${part.x + 16} ${sy - 10}h${part.w - 32}M${part.x + 22} ${sy - 19}h${part.w - 44}" ${R2}/>`);
          } else {
            out.push(`<path d="M${part.x + 10} ${sy - 6}h${part.w - 20}" ${R3}/>`);
          }
        }
        out.push(band(part.x, part.x + part.w, part.y + 22, slot.label, count, filled, fs));
        break;
      }
      case 'jewels': {
        // A shallow tray, divided across — what makes it jewellery and not a
        // drawer is that you can see everything in it at once.
        const ty = part.y + Math.round(part.h / 2) - 18;
        out.push(`<path d="M${part.x + 8} ${ty}h${part.w - 16}v40h-${part.w - 16}z" ${reg}/>`);
        out.push(`<path d="M${part.x + 8 + Math.round((part.w - 16) / 3)} ${ty}v40` +
          `M${part.x + 8 + Math.round(((part.w - 16) * 2) / 3)} ${ty}v40" ${reg}/>`);
        if (filled) {
          out.push(`<path d="M${part.x + part.w / 2 - 9} ${ty + 40}a9 9 0 0 0 18 0" ${R2}/>`);
        }
        out.push(band(part.x, part.x + part.w, part.y + 22, slot.label, count, filled, fs));
        break;
      }
      case 'locker': {
        const ly = part.y + Math.round(part.h / 2) - 24;
        out.push(`<path d="M${part.x + 8} ${ly}h${part.w - 16}v48h-${part.w - 16}z" ${reg}/>`);
        const kx = part.x + part.w - 26;
        out.push(`<path d="M${kx} ${ly + 19}a5 5 0 1 1 0 10a5 5 0 1 1 0-10" ${reg}/>`);
        out.push(`<path d="M${kx} ${ly + 29}v7" ${reg}/>`);
        out.push(band(part.x, part.x + part.w, part.y + 22, slot.label, count, filled, fs));
        break;
      }
      case 'bags': {
        // A shelf with the bags stood upright on it: a body and a handle, which
        // is the whole of what makes a bag a bag from across a room.
        const sy = part.y + part.h - 14;
        out.push(`<path d="M${part.x} ${sy}h${part.w}" ${R1}/>`);
        if (filled) {
          for (const bx of [part.x + 26, part.x + 82]) {
            out.push(`<path d="M${bx - 14} ${sy}v-34h28v34z" ${R2}/>`);
            out.push(`<path d="M${bx - 8} ${sy - 34}q8-16 16 0" ${R2}/>`);
          }
        } else {
          out.push(`<path d="M${part.x + 10} ${sy - 8}h${part.w - 20}" ${R3}/>`);
        }
        out.push(band(part.x, part.x + part.w, part.y + 22, slot.label, count, filled, fs));
        break;
      }
      case 'shoes': {
        const sy = part.y + part.h - 12;
        out.push(`<path d="M${part.x} ${sy}h${part.w}" ${R1}/>`);
        out.push(`<path d="M${part.x + 4} ${sy - 20}h${part.w - 8}" ${reg}/>`);
        if (filled) {
          out.push(
            `<path d="M${part.x + 16} ${sy - 2}v-16q0-8 10-8h20q16 0 30 16l10 8z" ${R2}/>`
          );
        }
        out.push(band(part.x, part.x + part.w, part.y + 22, slot.label, count, filled, fs));
        break;
      }
      case 'drawer': {
        out.push(`<path d="M${part.x + 4} ${part.y + 30}h${part.w - 8}v${part.h - 40}h-${part.w - 8}z" ${reg}/>`);
        if (filled) {
          out.push(`<path d="M${part.x + part.w / 2 - 20} ${part.y + 30 + (part.h - 40) / 2}h40" ${R2}/>`);
        }
        out.push(band(part.x, part.x + part.w, part.y + 22, slot.label, count, filled, fs));
        break;
      }
    }
  });

  return { svg: out.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- a jewellery box ----------
   Lid up, because a box drawn shut is a rectangle. The trays are the point:
   what separates a jewellery box from a small chest is that its insides are
   shallow and divided across as well as down. */
function drawBox(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const fs = labelSize(scale);
  const n = f.slots.length;
  const B_X0 = 110, B_X1 = 350, B_TOP = 220, B_BOT = 478;
  const out: string[] = [];
  const slots: DrawnSlot[] = [];

  // The lid, standing open behind, with the mirror every box of this kind has
  // inside it.
  out.push(`<path d="M118 120h224v86h-224z" ${R1}/>`);
  out.push(`<path d="M126 130h208v66h-208z" ${R1}/>`);
  out.push(`<path d="M132 190l196-54" ${R3}/>`);
  out.push(`<path d="M150 206v14M310 206v14" ${R1}/>`);

  out.push(`<path d="M${B_X0} ${B_TOP}h${B_X1 - B_X0}v${B_BOT - B_TOP}h-${B_X1 - B_X0}z" ${R1}/>`);
  // Bracket feet, and the floor it stands on.
  out.push(`<path d="M${B_X0 + 10} ${B_BOT}v14M${B_X1 - 10} ${B_BOT}v14" ${R1}/>`);
  out.push(`<path d="M86 500h288" ${R1}/>`);

  const h = (B_BOT - B_TOP) / n;
  f.slots.forEach((slot, i) => {
    const y = Math.round(B_TOP + i * h);
    const hh = Math.round(h);
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    slots.push({ id: slot.id, x: B_X0, y, w: B_X1 - B_X0, h: hh });

    if (i > 0) out.push(`<path d="M${B_X0} ${y}h${B_X1 - B_X0}" ${R1}/>`);
    out.push(`<path d="M${B_X0 + 8} ${y + 6}h${B_X1 - B_X0 - 16}v${hh - 12}h-${B_X1 - B_X0 - 16}z" ${filled ? R2 : R3}/>`);
    // The two dividers across the tray — the thing that makes it a tray.
    out.push(`<path d="M${B_X0 + 88} ${y + 6}v${hh - 12}M${B_X1 - 88} ${y + 6}v${hh - 12}" ${filled ? R2 : R3}/>`);
    if (filled) {
      // A ring pull, so a full tray is one you would open.
      out.push(`<path d="M${(B_X0 + B_X1) / 2 - 9} ${y + hh - 14}a9 9 0 0 0 18 0" ${R2}/>`);
    }
    out.push(band(B_X0, B_X1, y + 24, slot.label, count, filled, fs));
  });

  return { svg: out.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- a row of pegs ----------
   For the bags, the scarves, the belts and the hat — the things a closet has
   nowhere to put and a hallway solves with a batten and five knobs. */
function drawHooks(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const fs = labelSize(scale);
  const n = f.slots.length;
  const X0 = 60, X1 = 400, TOP = 196, H = 54;
  const out: string[] = [];
  const slots: DrawnSlot[] = [];

  out.push(`<path d="M${X0} ${TOP}h${X1 - X0}v${H}h-${X1 - X0}z" ${R1}/>`);
  out.push(`<path d="M${X0} ${TOP + 12}h${X1 - X0}" ${R1}/>`);

  const step = (X1 - X0) / n;
  f.slots.forEach((slot, i) => {
    const cx = Math.round(X0 + step * (i + 0.5));
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    const reg = filled ? R2 : R3;
    slots.push({ id: slot.id, x: Math.round(X0 + step * i), y: TOP, w: Math.round(step), h: 300 });

    // The peg: a stem out of the batten and a turned end.
    out.push(`<path d="M${cx} ${TOP + H}v22" ${reg}/>`);
    out.push(`<path d="M${cx - 11} ${TOP + H + 22}h22" ${reg}/>`);
    if (filled) {
      // A bag on it, drawn as the handle and the body — the two things that
      // make a bag a bag from across a room.
      out.push(`<path d="M${cx - 20} ${TOP + H + 22}q20-34 40 0" ${R2}/>`);
      out.push(
        `<path d="M${cx - 34} ${TOP + H + 30}h68l-7 96h-54z" ${R2}/>`
      );
    }
    out.push(
      `<text x="${cx}" y="${TOP + H + 148}" text-anchor="middle" ` +
      `fill="${filled ? 'currentColor' : 'var(--color-text-2)'}" ` +
      `style="font:${filled ? 500 : 400} ${fs}px var(--font-mono);letter-spacing:.06em">` +
      `${esc(fitLabel(slot.label, step + 4, fs))}</text>`
    );
    if (count) {
      out.push(
        `<text x="${cx}" y="${TOP + H + 170}" text-anchor="middle" ` +
        `fill="currentColor" style="font:400 ${fs}px var(--font-mono)">${count}</text>`
      );
    }
  });

  out.push(`<path d="M60 500h340" ${R1}/>`);
  return { svg: out.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- a bangle stand ----------
   A post, not a tray. Bangles stack on a post and that is why this is its own
   drawing: nothing else in the house is a vertical stack of rings. */
function drawStand(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const fs = labelSize(scale);
  const n = f.slots.length;
  const CX = 230, TOP = 150, BOT = 478;
  const out: string[] = [];
  const slots: DrawnSlot[] = [];

  out.push(`<path d="M${CX - 6} ${TOP}h12v${BOT - TOP}h-12z" ${R1}/>`);
  out.push(`<path d="M${CX - 12} ${TOP}h24" ${R1}/>`);
  // The weighted base — two rules, the way a turned base reads flat on.
  out.push(`<path d="M${CX - 74} ${BOT}h148" ${R1}/>`);
  out.push(`<path d="M${CX - 58} ${BOT + 12}h116" ${R1}/>`);
  out.push(`<path d="M86 500h288" ${R1}/>`);

  const h = (BOT - TOP) / n;
  f.slots.forEach((slot, i) => {
    const y = Math.round(TOP + i * h);
    const hh = Math.round(h);
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    const reg = filled ? R2 : R3;
    slots.push({ id: slot.id, x: CX - 110, y, w: 220, h: hh });

    // The tier itself: a disc seen edge on.
    const ty = y + hh - 8;
    out.push(`<path d="M${CX - 52} ${ty}h104" ${R1}/>`);
    if (filled) {
      // Bangles, capped at three however many there are. A drawing, not a bar.
      for (let r = 0; r < Math.min(3, count); r++) {
        const ry = ty - 13 - r * 15;
        const rx = 46 - r * 7;
        // A whole ring, seen nearly edge on. Half an arc read as a scribble.
        out.push(
          `<path d="M${CX - rx} ${ry}a${rx} 8 0 1 0 ${rx * 2} 0a${rx} 8 0 1 0 -${rx * 2} 0" ${reg}/>`
        );
      }
    }
    out.push(band(CX - 110, CX + 110, y + 22, slot.label, count, filled, fs));
  });

  return { svg: out.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- a shoe rack ----------
   Tiers that lean. Shoes do not sit flat on a shelf and a rack that draws them
   flat is a bookcase; the slope is the whole recognition. */
function drawRack(f: Furniture, counts: Record<string, number>, scale: number): Drawing {
  const fs = labelSize(scale);
  const n = f.slots.length;
  const X0 = 96, X1 = 364, TOP = 150, BOT = 482;
  const out: string[] = [];
  const slots: DrawnSlot[] = [];

  out.push(`<path d="M${X0} ${TOP}v${BOT - TOP}M${X1} ${TOP}v${BOT - TOP}" ${R1}/>`);
  out.push(`<path d="M${X0} ${BOT}h${X1 - X0}" ${R1}/>`);
  out.push(`<path d="M${X0 + 12} ${BOT}v16M${X1 - 12} ${BOT}v16" ${R1}/>`);

  const h = (BOT - TOP) / n;
  f.slots.forEach((slot, i) => {
    const y = Math.round(TOP + i * h);
    const hh = Math.round(h);
    const count = counts[slot.id] ?? 0;
    const filled = count > 0;
    const reg = filled ? R2 : R3;
    slots.push({ id: slot.id, x: X0, y, w: X1 - X0, h: hh });

    // Two leaning bars, the front one lower: a shoe rests toe-down between them.
    out.push(`<path d="M${X0} ${y + hh - 8}h${X1 - X0}" ${R1}/>`);
    out.push(`<path d="M${X0 + 4} ${y + hh - 26}h${X1 - X0 - 8}" ${reg}/>`);
    if (filled) {
      // A pair, seen from the side, toe to the right.
      for (const sx of [X0 + 46, X0 + 150]) {
        out.push(
          `<path d="M${sx} ${y + hh - 10}v-22q0-10 12-10h30q22 0 40 22l14 10z" ${R2}/>`
        );
      }
    }
    out.push(band(X0, X1, y + 22, slot.label, count, filled, fs));
  });

  return { svg: out.join(''), slots, viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
}

/* ---------- the chair ----------
   Every home has it: the chair where the clothes that are neither clean nor
   dirty accumulate. It is drawn here because it is the users' own word — the
   panellist quoted at the top of types.ts said "I have a rail and a chair" —
   and because it is the one honest picture of the state between worn and
   washed.

   IT IS NOT A PIECE OF FURNITURE, and must never become one. Nothing is filed
   to the chair; it is derived from laundryStatus at render and stored nowhere.
   Giving a laundry state a permanent address would turn a Tuesday into a fact
   about how somebody lives.

   AND IT IS NOT A METER. Up to twelve the drawing is literal — there are as
   many garments drawn as there are garments, each landing where a real one
   lands. Past twelve it stops counting and starts describing: one enveloping
   shape at thirteen, and a heap with four legs under it at twenty-five.
   Nineteen and twenty-three are the same drawing, and that is the feature. A
   drawing that changed measurably at every integer would be a bar chart of
   somebody's housekeeping with a joke on top. The number is written beside it;
   the number is never drawn. */

const CHAIR_FRAME = [
  'M158 168v332M302 168v332',
  'M136 340h188v12h-188z',
  'M142 352v148M318 352v148',
  'M142 448h176',
  'M72 500h316',
].map(d => `<path d="${d}" ${R1}/>`).join('');

/** Cloth marks. Curves, always — the frame is straight lines and slabs, and
    that difference is how the drawing says which is furniture and which is
    laundry without labelling either. */
const CLOTH = {
  drapeA: 'M174 270c-4-28-2-58 2-86c7-18 20-24 41-24c21 0 34 6 41 24c4 28 6 58 2 86',
  drapeAHem: 'M174 270c28 8 58 8 86 0',
  drapeASleeve: 'M246 273c8 16 12 32 10 48c-5 4-12 4-15-2c0-14-4-28-9-42',
  drapeB: 'M250 252c-4-26-2-52 2-78c7-16 20-22 40-22c20 0 33 6 40 22c4 26 6 52 2 78',
  drapeBHem: 'M250 252c26 8 58 8 84 0',
  drapeC: 'M122 248c-4-26-2-52 2-78c7-16 20-22 40-22c20 0 33 6 40 22c4 26 6 52 2 78',
  drapeCHem: 'M122 248c26 8 58 8 84 0',
  course1: 'M140 340c10-14 30-22 56-24c30-2 56 2 74 10c10 4 14 10 14 14',
  course1Fold: 'M164 334c16-8 38-12 60-10',
  course2: 'M152 330c8-18 28-30 54-32c30-2 54 4 70 14c8 5 10 12 8 18',
  course3: 'M158 318c8-18 26-30 50-32c28-2 50 4 64 14c7 5 9 11 7 18',
  course4: 'M156 306c10-20 28-32 52-34c28-2 50 4 66 14c10 6 14 14 12 22',
  spill1: 'M262 336c8 14 12 34 10 56c-6 6-16 6-22 0c2-20-2-40-8-52',
  spill2: 'M196 336c10 24 16 60 14 96c-8 8-20 8-28 0c2-34-4-68-14-92',
  fallen1: 'M324 500c-2-14 6-26 20-30c12-4 22 0 28 8c4 6 4 14 2 22',
  fallen2: 'M136 500c2-14-6-26-20-30c-12-4-22 0-28 8c-4 6-4 14-2 22',
  fallen3: 'M332 472c2-14 12-22 26-22c12 0 20 6 20 14c0 5-2 9-6 12',
  shroud: 'M144 300c-8-46-2-92 10-122c10-24 30-36 56-38c22-2 40 6 52 18c14-12 34-16 52-10c22 8 32 28 30 52c-2 30-8 60-14 86',
  shroudFold: 'M164 214c26-16 60-20 88-10',
  mass: 'M116 440c-10-46-14-96-12-140c2-42 14-80 36-110c14-20 36-34 60-50c20-2 36 8 50 28c10-24 28-38 50-36c24 2 44 22 56 58c14 32 22 70 24 110c2 48-6 96-28 140',
  massHem: 'M116 440c34 18 74 28 118 28c44 0 84-10 118-28',
  massFold: 'M140 262c34-26 78-40 122-38',
};

const cloth = (...keys: (keyof typeof CLOTH)[]) =>
  keys.map(k => `<path d="${CLOTH[k]}" ${R2}/>`).join('');

/**
 * Draw the chair, with as much on it as there is.
 *
 * A member that passes under cloth is DRAWN SHORT rather than drawn over: there
 * are no fills in this house, so not drawing the hidden part is the only
 * occlusion available — and it is the truer one anyway. A visible stub under
 * twelve units is dropped entirely, because a six-pixel nub reads as a
 * rendering fault rather than as a rail continuing behind a shirt.
 */
export function drawChair(count: number): Drawing {
  const n = Math.max(0, Math.round(count) || 0);
  const out: string[] = [];

  if (n >= 25) {
    // The terminal drawing. Four legs under a heap, and nothing else of the
    // chair. This is what it looks like at 25 and at 250.
    out.push(`<path d="M142 449v51M158 454v46M302 459v41M318 455v45" ${R1}/>`);
    out.push(`<path d="M72 500h316" ${R1}/>`);
    out.push(cloth('mass', 'massHem', 'massFold', 'fallen1', 'fallen2', 'fallen3'));
    return { svg: out.join(''), slots: [{ id: 'chair', x: 84, y: 128, w: 296, h: 372 }], viewBox: `0 0 ${VIEW.w} ${VIEW.h}` };
  }

  // The back's frame, clipped by whatever is hanging over it.
  const overBack = Math.min(3, n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);
  if (overBack === 0) {
    out.push(`<path d="M152 168h156v14h-156z" ${R1}/>`);
    out.push(`<path d="M158 216h144v12h-144z" ${R1}/>`);
    out.push(`<path d="M158 264h144v12h-144z" ${R1}/>`);
  } else if (overBack === 1) {
    out.push(`<path d="M152 168h34M248 168h60M152 182h24M258 182h50M152 168v14M308 168v14" ${R1}/>`);
    out.push(`<path d="M158 216h13M261 216h41M158 228h12M262 228h40M158 216v12M302 216v12" ${R1}/>`);
    out.push(`<path d="M158 264h144v12h-144z" ${R1}/>`);
  } else if (overBack === 2) {
    out.push(`<path d="M152 168h34M152 182h24M152 168v14" ${R1}/>`);
    out.push(`<path d="M158 216h13M158 228h12M158 216v12" ${R1}/>`);
    out.push(`<path d="M158 264h16M260 264h42M158 276h16M260 276h42M158 264v12M302 264v12" ${R1}/>`);
  } else {
    out.push(`<path d="M158 264h16M260 264h42M158 276h16M260 276h42M158 264v12M302 264v12" ${R1}/>`);
  }

  // The stiles lose their tops as the back fills.
  const leftTop = n >= 6 ? 250 : 168;
  const rightTop = n >= 3 ? 252 : 168;
  out.push(`<path d="M158 ${leftTop}v${500 - leftTop}M302 ${rightTop}v${500 - rightTop}" ${R1}/>`);

  if (n >= 8) {
    // The seat's front edge breaks where something hangs over it.
    out.push(`<path d="M136 340h32M212 340h30M274 340h50" ${R1}/>`);
    out.push(`<path d="M136 352h40M210 352h38M272 352h52" ${R1}/>`);
    out.push(`<path d="M136 340v12M324 340v12" ${R1}/>`);
    out.push(`<path d="M142 352v148M318 352v148M142 448h176M72 500h316" ${R1}/>`);
  } else {
    out.push(CHAIR_FRAME);
  }

  if (n === 0) {
    // An empty chair, said in the house's own mark for "nothing here yet, and
    // nothing is wrong" — the same basting stitch an empty drawer wears.
    out.push(`<path d="M156 346h148" ${R3}/>`);
  }

  if (n >= 13) {
    // ONE SHAPE INSTEAD OF THREE. Past twelve the drawing stops counting, and
    // the way it says so is that the separate garments over the back are gone
    // — swallowed by a single outline. Drawing the shroud BEHIND them made
    // thirteen look like twelve with a smudge, which is the worst of both: it
    // still reads as counting, and it counts wrong.
    out.push(cloth('shroud', 'shroudFold'));
  } else {
    if (n >= 1) out.push(cloth('drapeA', 'drapeAHem', 'drapeASleeve'));
    if (n >= 3) out.push(cloth('drapeB', 'drapeBHem'));
    if (n >= 6) out.push(cloth('drapeC', 'drapeCHem'));
  }
  if (n >= 2) out.push(cloth('course1', 'course1Fold'));
  if (n >= 4) out.push(cloth('course2'));
  if (n >= 5) out.push(cloth('course3'));
  if (n >= 7) out.push(cloth('course4'));
  if (n >= 8) out.push(cloth('spill1'));
  if (n >= 9) out.push(cloth('spill2'));
  if (n >= 10) out.push(cloth('fallen1'));
  if (n >= 11) out.push(cloth('fallen2'));
  if (n >= 12) out.push(cloth('fallen3'));

  return {
    svg: out.join(''),
    slots: [{ id: 'chair', x: 84, y: 128, w: 296, h: 372 }],
    viewBox: `0 0 ${VIEW.w} ${VIEW.h}`,
  };
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
  opts: { labels?: boolean } = {},
): Drawing {
  // WITHOUT LABELS, for anywhere the drawing renders smaller than its own plate.
  //
  // SVG text is sized in user units against a fixed scale, so a drawing built
  // for a 326px plate and rendered at 240px puts its labels at 9.6px — under
  // the 13px floor the contract sets for a label on a control. The index draws
  // small and prints the name in the page's real typography underneath, which
  // is better typography anyway; only the detail page, where the drawing IS the
  // control, draws them.
  if (opts.labels === false) {
    const full = drawFurniture(f, counts, scale);
    return { ...full, svg: full.svg.replace(/<text[\s\S]*?<\/text>/g, '') };
  }
  switch (f.form) {
    case 'rail': return drawRail(f, counts, scale);
    case 'shelves': return drawShelves(f, counts, scale);
    case 'almirah': return drawAlmirah(f, counts, scale, false);
    case 'almirah-carved': return drawAlmirah(f, counts, scale, true);
    case 'almirah-fitted': return drawFitted(f, counts, scale);
    case 'box': return drawBox(f, counts, scale);
    case 'hooks': return drawHooks(f, counts, scale);
    case 'stand': return drawStand(f, counts, scale);
    case 'rack': return drawRack(f, counts, scale);
    default: return drawChest(f, counts, scale);
  }
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

/**
 * One line about each, for the person choosing.
 *
 * Written so nobody has to know the word "almirah" to pick one, and nobody who
 * does has to be told what it is.
 */
export const FORM_NOTES: Record<FurnitureForm, string> = {
  rail: 'A rod and what hangs on it. A studio flat is a rail and a chair, and that is a whole wardrobe.',
  chest: 'Drawers, one above another. It holds anything and asks no questions.',
  shelves: 'An open case. What is folded rather than hung.',
  almirah: 'The pressed-steel wardrobe with a mirror on the door — hanging on one side, shelves and a locker on the other, a drawer beneath.',
  'almirah-carved': 'The old wooden one, with panelled doors and a pediment. Divided inside the same way.',
  'almirah-fitted': 'Steel case, wooden doors, and an inside fitted out for everything — a hanging ledge, a jewellery tray, shoes at the foot, and a stand for the bags.',
  box: 'Shallow trays under a lid. Rings, studs, chains.',
  hooks: 'A batten and its pegs — the bags, the belts, the scarf that lives by the door.',
  stand: 'A post that bangles stack on.',
  rack: 'Leaning tiers. Shoes, toe down.',
};

/** What its compartments are called. */
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
