import { FORM_MAX_SLOTS, type Furniture, type FurnitureForm } from '../types';

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
  switch (f.form) {
    case 'rail': return drawRail(f, counts, scale);
    case 'shelves': return drawShelves(f, counts, scale);
    case 'almirah': return drawAlmirah(f, counts, scale, false);
    case 'almirah-carved': return drawAlmirah(f, counts, scale, true);
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
  box: ['tray', 'trays'],
  hooks: ['peg', 'pegs'],
  stand: ['tier', 'tiers'],
  rack: ['tier', 'tiers'],
};
