/**
 * DRAWING THE FURNITURE, NATIVELY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS AND THE WEB GENERATOR IS NOT IMPORTED.
 *
 * The brief was to test whether react-native-svg's `SvgXml` renders
 * src/lib/furnitureArt.ts's markup faithfully. It was tested, in this repo, on
 * react-native-svg 15.15.4 (the SDK 57 pin). It does not, and the failures are
 * silent rather than loud:
 *
 *   1. `stroke="var(--color-text-2)"` — two of the four registers (R1, the
 *      case; R3, the basting dash) and every quiet label paint in CSS custom
 *      properties. Native has no cascade. extractBrush warns once per node
 *      ("var(--color-text-2)" is not a valid color or brush) and drops the
 *      paint: the whole carcass outline goes.
 *   2. `style="font:500 19px var(--font-mono)"` — react-native-svg's own
 *      font-shorthand regex only accepts normal|bold|italic before the size,
 *      so a numeric weight makes the match fall through to
 *      `fontSize: 12, fontFamily: "500 19px var(--font-mono)"`. Measured, not
 *      guessed. That throws away labelSize(scale), the function that exists
 *      solely to hold every slot label at or above the 13px interactive floor
 *      — at the phone's 0.709 the label would render at 8.5px, and NOTHING
 *      warns.
 *   3. `letter-spacing:.06em` — RN letterSpacing is a number of px. An em
 *      string is not a number.
 *
 * So the drawings are drawn here with react-native-svg primitives. THE
 * GEOMETRY IS MIRRORED VERBATIM — the same 460×560 box, the same floor at
 * y=500, the same case at x 96…364, the same U=64 unit drawer, the same path
 * data — because the geometry is what makes a 44px tap target legal. What is
 * native is only the paint and the type: a register is an enum resolved to a
 * theme token at render, and a label is a typed mark whose size the renderer
 * computes from the plate's real width. SIMPLIFIED, and here is the whole
 * inventory of what was simplified away, so nobody has to diff 1300 lines:
 *
 *   · the jewellery stand that stands on a short chest's top      (chest)
 *   · the mirrored leaf's basting stroke on a steel almirah       (almirah)
 *   · the pediment's curve is a straight cornice                  (carved)
 *   · ornament crests/leaves/plinths are the four sets, unchanged (fitted)
 *   · the chair (a laundry state, not furniture — never filed to)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LAWS THIS FILE CARRIES ACROSS UNCHANGED (src/pages/Furniture.tsx):
 *
 *   FULLNESS IS DRAWN, NEVER STORED AND NEVER MEASURED. No capacity, no
 *   percentage, no completeness meter. A drawer's rebate line runs a fraction
 *   of the face equal to that slot's share of the FULLEST slot; a shelf's
 *   stack caps at three folds however full it is; a stand shows at most three
 *   bangles. Nineteen and twenty-three are the same drawing, and that is the
 *   feature.
 *
 *   AN EMPTY COMPARTMENT IS BASTED, NOT SCOLDED. Empty draws in the basting
 *   dash and carries no handle — a drawer not yet sewn down, which reads as
 *   available rather than as a chore.
 *
 *   NOTHING DECORATIVE BEHIND CLOTHING. No photograph is ever drawn inside
 *   this SVG; the pieces filed to a slot are flat tiles BELOW the drawing.
 */
import { type Furniture, type FurnitureForm, type Ornament } from '@almari/shared/types';

/* ---------- the box, shared with every frieze piece ---------- */
export const VIEW = { w: 460, h: 560 } as const;
const FLOOR = 500;
const CASE_X0 = 96;
const CASE_X1 = 364;
const CASE_W = CASE_X1 - CASE_X0;

/**
 * The unit drawer height, and the number that makes the whole feature legal on
 * a phone. At 390px the page has 20px of gutter each side, leaving 350px of
 * drawing width; a 460-unit box therefore renders at about scale 0.76. At
 * U=56 a drawer is under the 44px floor. At 64 it clears it. Do not lower it.
 */
const U = 64;

/** The web's own reference scale — a 326px plate in a 460-unit box. */
export const REFERENCE_SCALE = 0.709;

/**
 * SVG font-size is in USER UNITS, so a naive 13 renders at 13 × scale. Divide
 * by the scale, and CEIL rather than round: at 0.709 the rounded answer is 18
 * units, which renders a quarter-pixel under the 13px floor.
 */
export function labelSize(scale: number): number {
  return Math.ceil(13 / Math.max(scale, 0.001));
}

/**
 * A label cut to the width it has to live in. SVG does not wrap, does not
 * ellipsize and does not warn. Mono caps advance about 0.62 of the font size —
 * the one measured number in here. By code POINT, so a surrogate pair is never
 * cut in half.
 */
export function fitLabel(text: string, widthUnits: number, fs: number): string {
  const room = Math.max(1, Math.floor((widthUnits - 14) / (fs * 0.62)));
  const glyphs = [...text.toUpperCase()];
  return glyphs.length <= room ? glyphs.join('') : `${glyphs.slice(0, Math.max(1, room - 1)).join('')}…`;
}

/**
 * THE FOUR REGISTERS, as names rather than as paint.
 *
 *   case      the carcass — text-2 at 2.5, the web's R1
 *   part      a working part with something in it — text at 2, the web's R2
 *   baste     not yet sewn down — text-2 at 2, dashed 4/3, the web's R3
 *   metal     a ring pull, a keyhole, a bangle — gold at 2, the web's RM.
 *             DECORATIVE ONLY. Gold measures about 2:1 on these grounds and a
 *             control needs 3:1, so it never carries an outline, a division,
 *             or anything a finger aims at.
 *   ornament  a carved treatment — text-2 at 2, the web's ORN
 */
export type Register = 'case' | 'part' | 'baste' | 'metal' | 'ornament';

export interface PathMark {
  k: 'p';
  d: string;
  r: Register;
}

export interface TextMark {
  k: 't';
  x: number;
  y: number;
  s: string;
  anchor: 'start' | 'middle' | 'end';
  /** Ink and the medium face when the compartment holds something; quiet otherwise. */
  filled: boolean;
  /** Laid on its side — the hanging column is too narrow for a word across it. */
  rot?: boolean;
}

export type Mark = PathMark | TextMark;

/** Unit-space rectangle of a compartment — the hit target. */
export interface DrawnSlot {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Drawing {
  marks: Mark[];
  slots: DrawnSlot[];
  view: { w: number; h: number };
  /** User units. The renderer uses it verbatim; it already holds the 13px floor. */
  fontSize: number;
}

/* ---------- the small hands ---------- */

const p = (d: string, r: Register): PathMark => ({ k: 'p', d, r });

/** One label and one count on the same line, the way every form writes them. */
function band(
  out: Mark[],
  x0: number,
  x1: number,
  y: number,
  text: string,
  count: number,
  filled: boolean,
  fs: number,
): void {
  out.push({
    k: 't',
    x: x0 + 10,
    y,
    s: fitLabel(text, x1 - x0 - (count ? 34 : 14), fs),
    anchor: 'start',
    filled,
  });
  if (count) out.push({ k: 't', x: x1 - 10, y, s: String(count), anchor: 'end', filled });
}

/** The frieze's own hanger, at whatever size the case allows. */
function hanger(out: Mark[], cx: number, top: number, k: number, reg: Register): void {
  const r = Math.round(7 * k);
  const drop = Math.round(14 * k);
  const arm = Math.round(42 * k);
  const fall = Math.round(24 * k);
  out.push(p(`M${cx - r} ${top}a${r} ${r} 0 0 1 ${r * 2} 0`, reg));
  out.push(p(`M${cx} ${top + drop}v-${Math.round(8 * k)}`, reg));
  out.push(p(`M${cx} ${top + drop}l-${arm} ${fall}h${arm * 2}z`, reg));
}

/** Every generator answers the same three questions the same way. */
interface Ctx {
  f: Furniture;
  counts: Record<string, number>;
  fs: number;
  labels: boolean;
}

const countOf = (c: Ctx, id: string) => c.counts[id] ?? 0;

/* ---------- the chest ---------- */
function drawChest(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const H = n * U;
  const y0 = 482 - H;
  const most = Math.max(1, ...c.f.slots.map(s => countOf(c, s.id)));
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  // Plinth and feet — the piece stands on the frieze's floor.
  out.push(p(`M${CASE_X0} 482h${CASE_W}`, 'case'));
  out.push(p('M108 482v18M352 482v18', 'case'));
  // Cap slab, overhanging 8 each side, and the carcass.
  out.push(p(`M88 ${y0 - 8}h284v8h-284z`, 'case'));
  out.push(p(`M${CASE_X0} ${y0}h${CASE_W}v${H}h-${CASE_W}z`, 'case'));

  c.f.slots.forEach((slot, i) => {
    const by = y0 + i * U;
    const count = countOf(c, slot.id);
    const filled = count > 0;
    slots.push({ id: slot.id, label: slot.label, count, x: CASE_X0, y: by, w: CASE_W, h: U });

    if (i > 0) out.push(p(`M${CASE_X0} ${by}h${CASE_W}`, 'case'));
    // An EMPTY drawer is basted and has no handle. Nothing scolds you about it.
    out.push(p(`M102 ${by + 4}h256v${U - 8}h-256z`, filled ? 'part' : 'baste'));
    if (filled) {
      out.push(p(`M206 ${by + U / 2}h48`, 'part'));
      // The rebate — a drawer not quite pushed home, run across a fraction of
      // the face equal to this slot's share of the fullest. Fullness drawn.
      const share = Math.min(count / most, 0.92);
      out.push(p(`M102 ${by + U - 10}h${Math.round(254 * share)}`, 'baste'));
    }
    // Above the handle, never across it.
    if (c.labels) band(out, CASE_X0, CASE_X1, by + 22, slot.label, count, filled, c.fs);
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- the rail ----------
   First of the forms, on purpose: "I have a rail and a chair. I am not typing
   'chair' into a dropdown that offers me 'dresser'." A rail with clothes on it
   is drawn with clothes on it, so owning one rail never reads as owning too
   little. */
function drawRail(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  out.push(p('M70 176h320', 'case'));
  out.push(p(`M86 176v${FLOOR - 176}M374 176v${FLOOR - 176}`, 'case'));

  // 264 units across, so five hangers sit 66 apart — over the 44px floor.
  const span = 264;
  const step = n > 1 ? span / (n - 1) : 0;
  const first = n > 1 ? 96 : 230;

  c.f.slots.forEach((slot, i) => {
    const hx = Math.round(first + i * step);
    const count = countOf(c, slot.id);
    const filled = count > 0;
    const half = n > 1 ? step / 2 : 120;
    slots.push({ id: slot.id, label: slot.label, count, x: hx - half, y: 168, w: half * 2, h: 220 });

    const reg: Register = filled ? 'part' : 'baste';
    out.push(p(`M${hx - 7} 176a7 7 0 0 1 14 0`, reg));
    out.push(p(`M${hx} 190v-8`, reg));
    out.push(p(`M${hx} 190l-42 24h84z`, reg));
    if (filled) {
      out.push(
        p(`M${hx} 190l-40 22c-3 26-2 48 1 70c25 4 53 4 78 0c3-22 4-44 1-70z`, 'part'),
      );
    }
    if (c.labels && count) {
      out.push({ k: 't', x: hx, y: filled ? 320 : 240, s: String(count), anchor: 'middle', filled });
    }
  });

  out.push(p(`M70 ${FLOOR}h320`, 'case'));
  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- shelves ---------- */
function drawShelves(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const H = n * U;
  const y0 = 482 - H;
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  out.push(p(`M${CASE_X0} ${y0}h${CASE_W}v${H}h-${CASE_W}z`, 'case'));
  out.push(p(`M104 ${y0}v${H}M356 ${y0}v${H}`, 'case'));
  out.push(p(`M${CASE_X0} 482h${CASE_W}`, 'case'));
  out.push(p('M108 482v18M352 482v18', 'case'));

  c.f.slots.forEach((slot, i) => {
    const sy = y0 + (i + 1) * U;
    const count = countOf(c, slot.id);
    const filled = count > 0;
    slots.push({ id: slot.id, label: slot.label, count, x: CASE_X0, y: y0 + i * U, w: CASE_W, h: U });

    out.push(p(`M${CASE_X0} ${sy}h${CASE_W}`, 'case'));
    out.push(p(`M${CASE_X0} ${sy + 5}h${CASE_W}`, 'baste'));
    if (filled) {
      // The stack caps at three folds however full the shelf is: a drawing,
      // not a bar chart. The count carries the number.
      out.push(p(`M140 ${sy - 12}h180M144 ${sy - 22}h172M148 ${sy - 32}h164`, 'part'));
    }
    if (c.labels) {
      out.push({ k: 't', x: 112, y: sy - 42, s: slot.label.toUpperCase(), anchor: 'start', filled });
      if (count) out.push({ k: 't', x: 348, y: sy - 42, s: String(count), anchor: 'end', filled });
    }
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- the almirah ----------
   The one form whose inside is not a repetition: a hanging side AND a locker
   AND shelves AND a drawer, in that order, because that is the order they are
   in. The count does not multiply a band; it decides how much of a fixed
   interior is there. */

const A_TOP = 96;
const A_BOT = 482;
const IN_X0 = 104;
const IN_X1 = 356;
const IN_TOP = 106;
const DIV_X = 210;
const LOCKER_H = 66;
const A_DRAWER_H = 64;

type AlmirahRole = 'hanging' | 'locker' | 'shelf' | 'drawer';
interface AlmirahPart {
  role: AlmirahRole;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Which parts an almirah of N compartments has, and where they sit. The order
 * is the object's, not the owner's.
 */
export function almirahPlan(n: number): AlmirahPart[] {
  const hasDrawer = n >= 4;
  const hasLocker = n >= 3;
  const shelves = Math.max(0, n - 1 - (hasLocker ? 1 : 0) - (hasDrawer ? 1 : 0));
  const drawerTop = A_BOT - 4 - A_DRAWER_H;
  const bottom = hasDrawer ? drawerTop - 4 : A_BOT - 4;
  const divided = hasLocker || shelves > 0;
  const rightX = divided ? DIV_X : IN_X0;
  const rightW = IN_X1 - rightX;

  const parts: AlmirahPart[] = [
    {
      role: 'hanging',
      x: IN_X0,
      y: IN_TOP,
      w: (divided ? DIV_X : IN_X1) - IN_X0,
      h: bottom - IN_TOP,
    },
  ];
  const shelfTop = IN_TOP + (hasLocker ? LOCKER_H : 0);
  if (hasLocker) parts.push({ role: 'locker', x: rightX, y: IN_TOP, w: rightW, h: LOCKER_H });
  const bandH = shelves > 0 ? (bottom - shelfTop) / shelves : 0;
  for (let i = 0; i < shelves; i++) {
    parts.push({
      role: 'shelf',
      x: rightX,
      y: Math.round(shelfTop + i * bandH),
      w: rightW,
      h: Math.round(bandH),
    });
  }
  if (hasDrawer) {
    parts.push({ role: 'drawer', x: IN_X0, y: drawerTop, w: IN_X1 - IN_X0, h: A_DRAWER_H });
  }
  return parts;
}

function drawAlmirah(c: Ctx, carved: boolean): Drawing {
  const parts = almirahPlan(c.f.slots.length);
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  // The doors, folded flat to either side. Drawn shut a cabinet is a rectangle
  // and says nothing; drawn ajar it would need a perspective this house does
  // not have. Folded open against the case it stays flat and shows the inside,
  // which is the only reason to draw an almirah at all.
  for (const [x0, x1] of [
    [68, 92],
    [368, 392],
  ]) {
    out.push(p(`M${x0} ${A_TOP + 4}h${x1 - x0}v${A_BOT - A_TOP - 8}h-${x1 - x0}z`, 'case'));
    if (carved) {
      out.push(p(`M${x0 + 5} ${A_TOP + 16}h${x1 - x0 - 10}v150h-${x1 - x0 - 10}z`, 'case'));
      out.push(p(`M${x0 + 5} ${A_TOP + 182}h${x1 - x0 - 10}v170h-${x1 - x0 - 10}z`, 'case'));
    }
  }

  out.push(p(`M96 ${A_TOP}h268v${A_BOT - A_TOP}h-268z`, 'case'));
  if (carved) {
    // An old wooden almirah is known by its top and its ankles.
    out.push(p(`M84 ${A_TOP}h292`, 'case'));
    out.push(p(`M110 ${A_BOT}v8q0 10-8 10M350 ${A_BOT}v8q0 10 8 10`, 'case'));
  } else {
    // A pressed lip, and the four rivets that hold a steel case together.
    out.push(p(`M96 ${A_TOP + 12}h268`, 'case'));
    for (const [rx, ry] of [
      [106, A_TOP + 22],
      [354, A_TOP + 22],
      [106, A_BOT - 12],
      [354, A_BOT - 12],
    ]) {
      out.push(p(`M${rx - 4} ${ry}h8M${rx} ${ry - 4}v8`, 'case'));
    }
    out.push(p(`M108 ${A_BOT}v18M352 ${A_BOT}v18`, 'case'));
  }
  out.push(p(`M96 ${A_BOT}h268`, 'case'));

  const divided = parts.some(x => x.role !== 'hanging' && x.role !== 'drawer');
  if (divided) {
    const tall = parts.find(x => x.role === 'hanging');
    if (tall) out.push(p(`M${DIV_X} ${IN_TOP}v${tall.h}`, 'case'));
  }

  parts.forEach((part, i) => {
    const slot = c.f.slots[i];
    if (!slot) return;
    const count = countOf(c, slot.id);
    const filled = count > 0;
    const reg: Register = filled ? 'part' : 'baste';
    slots.push({ id: slot.id, label: slot.label, count, x: part.x, y: part.y, w: part.w, h: part.h });

    if (part.role === 'hanging') {
      const rodY = part.y + 26;
      out.push(p(`M${part.x + 6} ${rodY}h${part.w - 12}`, 'case'));
      const k = Math.min(0.62, part.w / 240);
      const many = Math.min(3, Math.max(1, count));
      for (let hI = 0; hI < many; hI++) {
        const cx = Math.round(part.x + part.w * ((hI + 1) / (many + 1)));
        hanger(out, cx, rodY, k, reg);
        if (filled) {
          const arm = Math.round(42 * k);
          const drop = Math.round(14 * k);
          out.push(
            p(
              `M${cx} ${rodY + drop}l-${arm - 2} ${Math.round(22 * k)}` +
                `c-3 ${Math.round(60 * k)}-2 ${Math.round(110 * k)} 1 ${Math.round(150 * k)}` +
                `c${Math.round(24 * k)} 4 ${Math.round(52 * k)} 4 ${Math.round(76 * k)} 0` +
                `c3-${Math.round(40 * k)} 4-${Math.round(90 * k)} 1-${Math.round(150 * k)}z`,
              'part',
            ),
          );
        }
      }
      if (c.labels) {
        // On its side: a tall narrow column cannot carry a word laid across it.
        out.push({
          k: 't',
          x: part.x + 18,
          y: part.y + part.h - 14,
          s: fitLabel(slot.label, part.h - 20, c.fs),
          anchor: 'start',
          filled,
          rot: true,
        });
        if (count) {
          out.push({
            k: 't',
            x: part.x + part.w - 10,
            y: part.y + part.h - 12,
            s: String(count),
            anchor: 'end',
            filled,
          });
        }
      }
      return;
    }

    if (part.role === 'locker') {
      out.push(p(`M${part.x + 6} ${part.y + 6}h${part.w - 12}v${part.h - 12}h-${part.w - 12}z`, reg));
      // A keyhole. The locker is the compartment that locks, and that is the
      // whole of what makes it a locker rather than a small shelf.
      const kx = part.x + 18;
      const ky = part.y + part.h / 2;
      out.push(p(`M${kx} ${ky - 5}a5 5 0 1 1 0 10a5 5 0 1 1 0-10`, reg));
      out.push(p(`M${kx} ${ky + 5}v8`, reg));
      out.push(p(`M${kx - 9} ${ky - 11}h18v22h-18z`, 'metal'));
      if (c.labels) {
        band(out, part.x + 22, part.x + part.w, part.y + part.h / 2 + c.fs * 0.36, slot.label, count, filled, c.fs);
      }
      return;
    }

    if (part.role === 'shelf') {
      out.push(p(`M${part.x} ${part.y + part.h}h${part.w}`, 'case'));
      if (filled) {
        out.push(
          p(
            `M${part.x + 16} ${part.y + part.h - 12}h${part.w - 32}` +
              `M${part.x + 20} ${part.y + part.h - 22}h${part.w - 40}` +
              `M${part.x + 24} ${part.y + part.h - 32}h${part.w - 48}`,
            'part',
          ),
        );
      } else {
        out.push(p(`M${part.x + 8} ${part.y + part.h - 5}h${part.w - 16}`, 'baste'));
      }
      if (c.labels) band(out, part.x, part.x + part.w, part.y + 20, slot.label, count, filled, c.fs);
      return;
    }

    // The drawer under the lot.
    out.push(p(`M${part.x + 4} ${part.y + 4}h${part.w - 8}v${part.h - 8}h-${part.w - 8}z`, reg));
    if (filled) out.push(p(`M${part.x + part.w / 2 - 24} ${part.y + part.h / 2}h48`, 'part'));
    if (c.labels) {
      band(out, part.x, part.x + part.w, part.y + part.h / 2 + c.fs * 0.36, slot.label, count, filled, c.fs);
    }
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- the fitted almirah ----------
   A third almirah rather than a wider one because its INTERIOR IS LAID OUT
   DIFFERENTLY: the tall left column runs the hanging, the shoes and the
   drawer, while the right column stacks the small things full-height. That
   layout is the only reason seven compartments fit at a legal size. */

const F_TOP = 96;
const F_BOT = 482;
const F_IN_X0 = 104;
const F_IN_X1 = 356;
const F_IN_TOP = 106;
const F_IN_BOT = 478;
/** The stile: left 120 wide, right 132. Both clear the 62-unit floor. */
const F_DIV = 224;

type FittedRole = 'hanging' | 'shelves' | 'jewels' | 'locker' | 'bags' | 'shoes' | 'drawer';
interface FittedPart {
  role: FittedRole;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function fittedPlan(n: number): FittedPart[] {
  const rightRoles: FittedRole[] = ['shelves', 'jewels', 'locker', 'bags'];
  const rightCount = Math.max(0, Math.min(4, n - 1));
  const hasShoes = n >= 6;
  const hasDrawer = n >= 7;

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
  for (const b of leftBands) {
    byRole.set(b.role, { role: b.role, x: F_IN_X0, y: b.y, w: leftW, h: b.h });
  }

  const rightH = (F_IN_BOT - F_IN_TOP) / Math.max(1, rightCount);
  for (let i = 0; i < rightCount; i++) {
    byRole.set(rightRoles[i], {
      role: rightRoles[i],
      x: F_DIV,
      y: Math.round(F_IN_TOP + i * rightH),
      w: F_IN_X1 - F_DIV,
      h: Math.round(rightH),
    });
  }

  const order: FittedRole[] = ['hanging', ...rightRoles, 'shoes', 'drawer'];
  return order.map(role => byRole.get(role)).filter((x): x is FittedPart => !!x);
}

/**
 * ORNAMENT — Mughal, Rajput and Japanese, on the one form grand enough for it.
 *
 * ONE LAW, and it decides everything else: no ornament inside the carcass.
 * Everything between (96,96) and (364,482) is a working part — the rod, the
 * trays, the locker and its keyhole, the labels, the counts, and the
 * rectangles a thumb aims at. Ornament goes where the object has area and no
 * job: the crest above the case, the leaves, the plinth below.
 *
 * The Mughal treatment ships as a pierced grille rather than a true crossing
 * jaali: at the pitch this drawing can afford, a jaali is grey tone that
 * moirés on a fractional DPR. More authentic and less legible is a trade this
 * house does not make.
 */
interface OrnamentSet {
  crest: (out: Mark[]) => void;
  leaf: (out: Mark[], x0: number, scale: number) => void;
  plinth: (out: Mark[]) => void;
}

const ORNAMENT_SETS: Record<Ornament, OrnamentSet> = {
  plain: {
    crest: () => undefined,
    leaf: (out, x0) => {
      out.push(p(`M${x0 + 5} 112h14v150h-14z`, 'case'));
      out.push(p(`M${x0 + 5} 278h14v170h-14z`, 'case'));
    },
    plinth: () => undefined,
  },

  mughal: {
    crest: out => {
      out.push(p('M84 96h292', 'ornament'));
      out.push(
        p(
          'M96 96Q100 76 120 70Q133 50 156 52Q175 36 198 46Q218 44 230 26' +
            'Q242 44 262 46Q285 36 304 52Q327 50 340 70Q360 76 364 96',
          'ornament',
        ),
      );
      out.push(p('M150 58h160v34h-160z', 'ornament'));
      out.push(p('M170 58v34M194 58v34M218 58v34M242 58v34M266 58v34M290 58v34', 'ornament'));
    },
    leaf: (out, x0, scale) => {
      out.push(p(`M${x0 + 5} 112h14v226h-14z`, 'ornament'));
      out.push(p(`M${x0 + 5} 350h14v100h-14z`, 'ornament'));
      // The arched head is 4px tall at phone scale; below that it is lint.
      if (scale >= 0.68) out.push(p(`M${x0 + 5} 128q7-14 14 0`, 'ornament'));
    },
    plinth: out => {
      out.push(p('M96 496h268', 'ornament'));
      out.push(
        p(
          'M122 482v14M146 482v14M170 482v14M194 482v14M218 482v14' +
            'M242 482v14M266 482v14M290 482v14M314 482v14M338 482v14',
          'ornament',
        ),
      );
    },
  },

  rajput: {
    crest: out => {
      out.push(p('M52 40h356v18h-356z', 'case'));
      out.push(p('M96 96v-24q0-14 14-14M364 96v-24q0-14-14-14', 'case'));
      out.push(
        p('M110 58a30 12 0 0 0 60 0a30 12 0 0 0 60 0a30 12 0 0 0 60 0a30 12 0 0 0 60 0', 'ornament'),
      );
    },
    leaf: (out, x0) => {
      // Bold cross-bands the full width of the leaf. The panels are implied by
      // the bands and never outlined — a 5-unit inset rule at this width merges
      // with the stile and reads as a thicker line, not as a panel.
      out.push(
        p(`M${x0} 104h24M${x0} 116h24M${x0} 268h24M${x0} 280h24M${x0} 452h24M${x0} 464h24`, 'case'),
      );
    },
    plinth: out => {
      out.push(p('M92 482h280M92 492h280', 'case'));
      out.push(
        p(
          'M120 492a22 8 0 0 0 44 0a22 8 0 0 0 44 0a22 8 0 0 0 44 0a22 8 0 0 0 44 0a22 8 0 0 0 44 0',
          'ornament',
        ),
      );
    },
  },

  shoji: {
    crest: out => out.push(p('M64 76h332v12h-332z', 'ornament')),
    leaf: (out, x0) => {
      out.push(p(`M${x0 + 5} 112h14v340h-14z`, 'ornament'));
      out.push(p(`M${x0 + 5} 180h14M${x0 + 5} 248h14M${x0 + 5} 316h14M${x0 + 5} 384h14`, 'ornament'));
    },
    plinth: out => out.push(p('M84 500h292', 'ornament')),
  },
};

function drawFitted(c: Ctx, scale: number): Drawing {
  const parts = fittedPlan(c.f.slots.length);
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  // Wooden doors folded flat against a steel case — the two materials are the
  // whole of what this object is called, so both are drawn rather than stated.
  const orn = ORNAMENT_SETS[c.f.ornament ?? 'plain'];
  orn.crest(out);
  for (const [x0, x1] of [
    [68, 92],
    [368, 392],
  ]) {
    out.push(p(`M${x0} ${F_TOP + 4}h${x1 - x0}v${F_BOT - F_TOP - 8}h-${x1 - x0}z`, 'case'));
    orn.leaf(out, x0, scale);
  }
  out.push(p(`M96 ${F_TOP}h268v${F_BOT - F_TOP}h-268z`, 'case'));
  out.push(p(`M96 ${F_TOP + 12}h268`, 'case'));
  for (const [rx, ry] of [
    [106, F_TOP + 22],
    [354, F_TOP + 22],
    [106, F_BOT - 12],
    [354, F_BOT - 12],
  ]) {
    out.push(p(`M${rx - 4} ${ry}h8M${rx} ${ry - 4}v8`, 'case'));
  }
  out.push(p(`M96 ${F_BOT}h268`, 'case'));
  out.push(p(`M108 ${F_BOT}v18M352 ${F_BOT}v18`, 'case'));
  orn.plinth(out);

  if (parts.some(x => x.x === F_DIV)) {
    out.push(p(`M${F_DIV} ${F_IN_TOP}v${F_IN_BOT - F_IN_TOP}`, 'case'));
  }

  parts.forEach((part, i) => {
    const slot = c.f.slots[i];
    if (!slot) return;
    const count = countOf(c, slot.id);
    const filled = count > 0;
    const reg: Register = filled ? 'part' : 'baste';
    slots.push({ id: slot.id, label: slot.label, count, x: part.x, y: part.y, w: part.w, h: part.h });
    const withBand = () => {
      if (c.labels) band(out, part.x, part.x + part.w, part.y + 22, slot.label, count, filled, c.fs);
    };

    switch (part.role) {
      case 'hanging': {
        const rodY = part.y + 26;
        out.push(p(`M${part.x + 6} ${rodY}h${part.w - 12}`, 'case'));
        const k = Math.min(0.5, part.w / 240);
        const many = Math.min(3, Math.max(1, count));
        for (let hI = 0; hI < many; hI++) {
          const cx = Math.round(part.x + part.w * ((hI + 1) / (many + 1)));
          hanger(out, cx, rodY, k, reg);
          if (filled) {
            const arm = Math.round(42 * k);
            out.push(
              p(
                `M${cx} ${rodY + Math.round(14 * k)}l-${arm - 2} ${Math.round(22 * k)}` +
                  `c-3 ${Math.round(56 * k)}-2 ${Math.round(104 * k)} 1 ${Math.round(140 * k)}` +
                  `c${Math.round(22 * k)} 4 ${Math.round(48 * k)} 4 ${Math.round(70 * k)} 0` +
                  `c3-${Math.round(36 * k)} 4-${Math.round(84 * k)} 1-${Math.round(140 * k)}z`,
                'part',
              ),
            );
          }
        }
        if (c.labels) {
          out.push({
            k: 't',
            x: part.x + 18,
            y: part.y + part.h - 14,
            s: fitLabel(slot.label, part.h - 20, c.fs),
            anchor: 'start',
            filled,
            rot: true,
          });
          if (count) {
            out.push({
              k: 't',
              x: part.x + part.w - 10,
              y: part.y + part.h - 12,
              s: String(count),
              anchor: 'end',
              filled,
            });
          }
        }
        break;
      }
      case 'shelves': {
        const rules = Math.min(3, Math.max(1, Math.floor(part.h / 64)));
        for (let r = 1; r <= rules; r++) {
          const sy = Math.round(part.y + (part.h * r) / (rules + 1));
          out.push(p(`M${part.x} ${sy}h${part.w}`, 'case'));
          if (filled) {
            out.push(
              p(`M${part.x + 16} ${sy - 10}h${part.w - 32}M${part.x + 22} ${sy - 19}h${part.w - 44}`, 'part'),
            );
          } else {
            out.push(p(`M${part.x + 10} ${sy - 6}h${part.w - 20}`, 'baste'));
          }
        }
        withBand();
        break;
      }
      case 'jewels': {
        // A shallow tray, divided across — what makes it jewellery and not a
        // drawer is that you can see everything in it at once.
        const ty = part.y + Math.round(part.h / 2) - 18;
        out.push(p(`M${part.x + 8} ${ty}h${part.w - 16}v40h-${part.w - 16}z`, reg));
        out.push(
          p(
            `M${part.x + 8 + Math.round((part.w - 16) / 3)} ${ty}v40` +
              `M${part.x + 8 + Math.round(((part.w - 16) * 2) / 3)} ${ty}v40`,
            reg,
          ),
        );
        if (filled) out.push(p(`M${part.x + part.w / 2 - 9} ${ty + 40}a9 9 0 0 0 18 0`, 'part'));
        withBand();
        break;
      }
      case 'locker': {
        const ly = part.y + Math.round(part.h / 2) - 24;
        out.push(p(`M${part.x + 8} ${ly}h${part.w - 16}v48h-${part.w - 16}z`, reg));
        const kx = part.x + part.w - 26;
        out.push(p(`M${kx} ${ly + 19}a5 5 0 1 1 0 10a5 5 0 1 1 0-10`, reg));
        out.push(p(`M${kx} ${ly + 29}v7`, reg));
        withBand();
        break;
      }
      case 'bags': {
        const sy = part.y + part.h - 14;
        out.push(p(`M${part.x} ${sy}h${part.w}`, 'case'));
        if (filled) {
          for (const bx of [part.x + 26, part.x + 82]) {
            out.push(p(`M${bx - 14} ${sy}v-34h28v34z`, 'part'));
            out.push(p(`M${bx - 8} ${sy - 34}q8-16 16 0`, 'part'));
          }
        } else {
          out.push(p(`M${part.x + 10} ${sy - 8}h${part.w - 20}`, 'baste'));
        }
        withBand();
        break;
      }
      case 'shoes': {
        const sy = part.y + part.h - 12;
        out.push(p(`M${part.x} ${sy}h${part.w}`, 'case'));
        out.push(p(`M${part.x + 4} ${sy - 20}h${part.w - 8}`, reg));
        if (filled) {
          out.push(p(`M${part.x + 16} ${sy - 2}v-16q0-8 10-8h20q16 0 30 16l10 8z`, 'part'));
        }
        withBand();
        break;
      }
      case 'drawer': {
        out.push(p(`M${part.x + 4} ${part.y + 30}h${part.w - 8}v${part.h - 40}h-${part.w - 8}z`, reg));
        if (filled) {
          out.push(p(`M${part.x + part.w / 2 - 20} ${part.y + 30 + (part.h - 40) / 2}h40`, 'part'));
        }
        withBand();
        break;
      }
    }
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- a jewellery box ----------
   Lid up, because a box drawn shut is a rectangle. The trays are the point. */
function drawBox(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const B_X0 = 110;
  const B_X1 = 350;
  const B_TOP = 220;
  const B_BOT = 478;
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  out.push(p('M118 120h224v86h-224z', 'case'));
  out.push(p('M126 130h208v66h-208z', 'case'));
  out.push(p('M132 190l196-54', 'baste'));
  out.push(p('M150 206v14M310 206v14', 'case'));

  out.push(p(`M${B_X0} ${B_TOP}h${B_X1 - B_X0}v${B_BOT - B_TOP}h-${B_X1 - B_X0}z`, 'case'));
  out.push(p(`M${B_X0 + 10} ${B_BOT}v14M${B_X1 - 10} ${B_BOT}v14`, 'case'));
  out.push(p('M86 500h288', 'case'));

  const h = (B_BOT - B_TOP) / n;
  c.f.slots.forEach((slot, i) => {
    const y = Math.round(B_TOP + i * h);
    const hh = Math.round(h);
    const count = countOf(c, slot.id);
    const filled = count > 0;
    const reg: Register = filled ? 'part' : 'baste';
    slots.push({ id: slot.id, label: slot.label, count, x: B_X0, y, w: B_X1 - B_X0, h: hh });

    if (i > 0) out.push(p(`M${B_X0} ${y}h${B_X1 - B_X0}`, 'case'));
    out.push(p(`M${B_X0 + 8} ${y + 6}h${B_X1 - B_X0 - 16}v${hh - 12}h-${B_X1 - B_X0 - 16}z`, reg));
    // The two dividers across the tray — the thing that makes it a tray.
    out.push(p(`M${B_X0 + 88} ${y + 6}v${hh - 12}M${B_X1 - 88} ${y + 6}v${hh - 12}`, reg));
    // A ring pull, so a full tray is one you would open. In the metal.
    if (filled) out.push(p(`M${(B_X0 + B_X1) / 2 - 9} ${y + hh - 14}a9 9 0 0 0 18 0`, 'metal'));
    if (c.labels) band(out, B_X0, B_X1, y + 24, slot.label, count, filled, c.fs);
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- a row of pegs ----------
   For the bags, the scarves, the belts and the hat — the things a closet has
   nowhere to put and a hallway solves with a batten and five knobs. */
function drawHooks(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const X0 = 60;
  const X1 = 400;
  const TOP = 196;
  const H = 54;
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  out.push(p(`M${X0} ${TOP}h${X1 - X0}v${H}h-${X1 - X0}z`, 'case'));
  out.push(p(`M${X0} ${TOP + 12}h${X1 - X0}`, 'case'));

  const step = (X1 - X0) / n;
  c.f.slots.forEach((slot, i) => {
    const cx = Math.round(X0 + step * (i + 0.5));
    const count = countOf(c, slot.id);
    const filled = count > 0;
    const reg: Register = filled ? 'part' : 'baste';
    slots.push({
      id: slot.id,
      label: slot.label,
      count,
      x: Math.round(X0 + step * i),
      y: TOP,
      w: Math.round(step),
      h: 300,
    });

    out.push(p(`M${cx} ${TOP + H}v22`, reg));
    out.push(p(`M${cx - 11} ${TOP + H + 22}h22`, reg));
    if (filled) {
      // A bag on it: the handle and the body, the two things that make a bag a
      // bag from across a room.
      out.push(p(`M${cx - 20} ${TOP + H + 22}q20-34 40 0`, 'part'));
      out.push(p(`M${cx - 34} ${TOP + H + 30}h68l-7 96h-54z`, 'part'));
    }
    if (c.labels) {
      out.push({
        k: 't',
        x: cx,
        y: TOP + H + 148,
        s: fitLabel(slot.label, step + 4, c.fs),
        anchor: 'middle',
        filled,
      });
      if (count) {
        out.push({ k: 't', x: cx, y: TOP + H + 170, s: String(count), anchor: 'middle', filled: true });
      }
    }
  });

  out.push(p('M60 500h340', 'case'));
  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- a bangle stand ----------
   A post, not a tray. Nothing else in the house is a vertical stack of rings. */
function drawStand(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const CX = 230;
  const TOP = 150;
  const BOT = 478;
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  out.push(p(`M${CX - 6} ${TOP}h12v${BOT - TOP}h-12z`, 'case'));
  out.push(p(`M${CX - 12} ${TOP}h24`, 'case'));
  out.push(p(`M${CX - 74} ${BOT}h148`, 'case'));
  out.push(p(`M${CX - 58} ${BOT + 12}h116`, 'case'));
  out.push(p('M86 500h288', 'case'));

  const h = (BOT - TOP) / n;
  c.f.slots.forEach((slot, i) => {
    const y = Math.round(TOP + i * h);
    const hh = Math.round(h);
    const count = countOf(c, slot.id);
    const filled = count > 0;
    slots.push({ id: slot.id, label: slot.label, count, x: CX - 110, y, w: 220, h: hh });

    const ty = y + hh - 8;
    out.push(p(`M${CX - 52} ${ty}h104`, 'case'));
    if (filled) {
      // Bangles, capped at three however many there are. A drawing, not a bar.
      for (let r = 0; r < Math.min(3, count); r++) {
        const ry = ty - 13 - r * 15;
        const rx = 46 - r * 7;
        out.push(p(`M${CX - rx} ${ry}a${rx} 8 0 1 0 ${rx * 2} 0a${rx} 8 0 1 0 -${rx * 2} 0`, 'metal'));
      }
    }
    if (c.labels) band(out, CX - 110, CX + 110, y + 22, slot.label, count, filled, c.fs);
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/* ---------- a shoe rack ----------
   Tiers that lean. Shoes do not sit flat on a shelf and a rack that draws them
   flat is a bookcase; the slope is the whole recognition. */
function drawRack(c: Ctx): Drawing {
  const n = c.f.slots.length;
  const X0 = 96;
  const X1 = 364;
  const TOP = 150;
  const BOT = 482;
  const out: Mark[] = [];
  const slots: DrawnSlot[] = [];

  out.push(p(`M${X0} ${TOP}v${BOT - TOP}M${X1} ${TOP}v${BOT - TOP}`, 'case'));
  out.push(p(`M${X0} ${BOT}h${X1 - X0}`, 'case'));
  out.push(p(`M${X0 + 12} ${BOT}v16M${X1 - 12} ${BOT}v16`, 'case'));

  const h = (BOT - TOP) / n;
  c.f.slots.forEach((slot, i) => {
    const y = Math.round(TOP + i * h);
    const hh = Math.round(h);
    const count = countOf(c, slot.id);
    const filled = count > 0;
    const reg: Register = filled ? 'part' : 'baste';
    slots.push({ id: slot.id, label: slot.label, count, x: X0, y, w: X1 - X0, h: hh });

    // Two leaning bars, the front one lower: a shoe rests toe-down between them.
    out.push(p(`M${X0} ${y + hh - 8}h${X1 - X0}`, 'case'));
    out.push(p(`M${X0 + 4} ${y + hh - 26}h${X1 - X0 - 8}`, reg));
    if (filled) {
      if (i < 2) {
        // THE TOP TWO TIERS HOLD BAGS, not shoes. A rack's upper shelves are
        // above the knee and nobody bends up to a shoe.
        for (const bx of [X0 + 72, X0 + 172]) {
          out.push(p(`M${bx - 24} ${y + hh - 10}v-30h48v30z`, 'part'));
          // The handle sits INSIDE the top of the body: above it, the arc
          // reached into the tier's own label.
          out.push(p(`M${bx - 13} ${y + hh - 40}q13 18 26 0`, 'metal'));
        }
      } else {
        for (const sx of [X0 + 46, X0 + 150]) {
          out.push(p(`M${sx} ${y + hh - 10}v-22q0-10 12-10h30q22 0 40 22l14 10z`, 'part'));
        }
      }
    }
    if (c.labels) band(out, X0, X1, y + 22, slot.label, count, filled, c.fs);
  });

  return { marks: out, slots, view: VIEW, fontSize: c.fs };
}

/**
 * THE DRAWING, AND ITS TAPPABLE SLOTS.
 *
 * `scale` is rendered px per unit and is needed only to size the type.
 *
 * WITHOUT LABELS, for anywhere the drawing renders smaller than its own plate:
 * a drawing built for a 326px plate and rendered at 160px puts its labels at
 * 6px, under the interactive floor. The index draws small and prints the name
 * in the page's real typography underneath, which is better typography anyway;
 * only the detail page, where the drawing IS the control, draws them.
 */
export function drawFurniture(
  f: Furniture,
  counts: Record<string, number>,
  scale: number = REFERENCE_SCALE,
  opts: { labels?: boolean } = {},
): Drawing {
  const c: Ctx = { f, counts, fs: labelSize(scale), labels: opts.labels !== false };
  switch (f.form) {
    case 'rail':
      return drawRail(c);
    case 'shelves':
      return drawShelves(c);
    case 'almirah':
      return drawAlmirah(c, false);
    case 'almirah-carved':
      return drawAlmirah(c, true);
    case 'almirah-fitted':
      return drawFitted(c, scale);
    case 'box':
      return drawBox(c);
    case 'hooks':
      return drawHooks(c);
    case 'stand':
      return drawStand(c);
    case 'rack':
      return drawRack(c);
    default:
      return drawChest(c);
  }
}

/** A preview piece for the draw-a-place flow — never stored, never given an id. */
export function previewPiece(
  name: string,
  form: FurnitureForm,
  labels: string[],
  ornament: Ornament,
): Furniture {
  return {
    id: 'preview',
    name: name || 'A place',
    form,
    ornament,
    slots: labels.map((label, i) => ({ id: `p${i}`, label })),
    dateAdded: '',
  };
}
