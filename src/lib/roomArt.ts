import type { Furniture, FurnitureForm } from '../types';

/**
 * THE ROOM — the closet, drawn as somewhere you are standing.
 *
 * The Closet tab used to open on a grid of photographs. A grid is a good way to
 * FIND a garment and a poor way to remember where one lives, and "where is it?"
 * is the question the furniture feature exists to answer. So the tab opens on
 * the room: your own pieces of furniture, along a wall, at their own sizes, in
 * the order you drew them. You walk to one. The grid is still there, directly
 * below, unchanged.
 *
 * ── WHY THE PROJECTION IS WHAT IT IS ─────────────────────────────────────────
 * The house draws with NO FILLS, so nothing can occlude anything, so every
 * overlap becomes a plaid of crossing strokes with no depth cue to sort it.
 * That single fact settles the drawing:
 *
 *   · Not a corner. A corner puts furniture on a foreshortened plane, which
 *     needs a second generator for every form and destroys the one law that
 *     makes furniture legible at any size — *a drawer is always a drawer; the
 *     case grows*. A foreshortened drawer is not always a drawer.
 *   · Not a view down the room. Depth without fills cannot occlude: a chest
 *     standing behind a rail becomes hatching. And the near piece renders three
 *     times the far one, so the same control has targets that differ by 3×.
 *   · So: a one-point frame whose whole perspective budget is spent on the four
 *     EMPTY returns — ceiling, floor and two side walls — around a back wall
 *     that is true elevation at 1:1 and carries every piece of furniture.
 *
 * The receding lines carry no information, which is what stops it reading as a
 * wireframe. And the outer rectangle is never closed: a closed one reads as a
 * picture of a room, an open one as a room you are inside.
 *
 * ── PAGE UNITS, NOT THE 460×560 BOX ──────────────────────────────────────────
 * The frieze's box exists so that ONE OBJECT has a canonical size and can be
 * scaled into any hang. A room is not an object; it is the page. Drawn in page
 * units, stroke-width 2 means two real pixels, font-size 13 means the
 * contract's 13px floor with no division, and a 44-unit target means 44px with
 * nothing to recompute. The grammar is kept in full — same weights, butt caps,
 * miter joins, the floor-line convention, the register discipline. Only the box
 * is dropped, and only because here the room IS the box.
 *
 * ── FULLNESS AT ROOM SCALE IS BINARY ─────────────────────────────────────────
 * A piece with something in it is drawn solid; a piece with nothing in it is
 * drawn in basting dash. No proportional rebate, no share-of-fullest bar. A row
 * of proportional bars along a wall IS a bar chart and reads as a completion
 * board, which all three panels struck. The proportional rebate stays where it
 * belongs: at arm's length, on the piece's own page.
 */

/* ---------- the four registers ---------- */
const A = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';
const P = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="butt" stroke-linejoin="miter"';
const D = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';
const E = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="butt" stroke-linejoin="miter"';

/**
 * The narrowest bay worth drawing, and the reason a phone wall holds four.
 *
 * 66 px is a legal target with room for a mark inside it. Below it the
 * silhouettes stop being distinguishable from one another, which is the whole
 * job of the mark — so the wall stops here and the rest go through the door.
 */
const MIN_BAY = 66;
/** Past this a single piece stops being furniture and becomes a poster. */
const MAX_BAY = 240;
/** Eight is the widest wall a desk gets. A ninth place is through the door. */
const MAX_BAYS = 8;

export interface RoomBay {
  id: string;
  /** Percentages of the plate, so the HTML hit layer never desynchronises from
      the drawing by a rounding pixel. */
  left: number; width: number; top: number; height: number;
  name: string;
  count: number;
  packed: boolean;
}

export interface Room {
  svg: string;
  w: number;
  h: number;
  bays: RoomBay[];
  door: { left: number; width: number; top: number; height: number };
  /** True when the wall could not hold everything, which is what opens the door. */
  ajar: boolean;
  /** How many pieces the wall is not showing. */
  beyond: number;
  /** No furniture at all — the wall carries one rail standing in for the lot. */
  bare: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** How tall a form stands, in multiples of the bay's unit. */
function markHeight(form: FurnitureForm, slots: number, mu: number): number {
  switch (form) {
    case 'rail': return Math.round(6.5 * mu);
    case 'chest': return slots * mu + Math.max(5, Math.round(0.45 * mu)) + Math.max(3, Math.round(0.28 * mu));
    case 'shelves': return slots * mu + Math.max(5, Math.round(0.45 * mu));
    // An almirah is ONE CASE. Its compartment count divides the inside and does
    // not change its height, which is exactly what makes it recognisable across
    // a room: it is the tall one.
    case 'almirah': case 'almirah-carved': return Math.round(7.8 * mu);
    case 'box': return Math.round(3.4 * mu);
    case 'hooks': return Math.round(5.4 * mu);
    case 'stand': return Math.round(6.2 * mu);
    case 'rack': return Math.round(slots * mu * 0.86 + 0.5 * mu);
    default: return slots * mu;
  }
}

/**
 * ONE PIECE, AT ROOM SCALE.
 *
 * Not `drawFurniture` shrunk. At the scale a four-piece phone wall allows, a
 * seven-drawer chest becomes a 10px comb of hairlines: text, handles, rebates
 * and dashes collapse into one grey texture. The room mark carries exactly two
 * facts — WHICH FORM it is and HOW BIG it is — and never contents, counts,
 * names or proportions. Those are one tap away, at a size that can hold them.
 *
 * Everything is bottom-centred on the floor line, so a run of pieces stands on
 * one floor the way furniture does.
 */
function mark(f: Furniture, cx: number, floorY: number, mu: number, filled: boolean): string {
  const reg = filled ? P : E;
  const det = filled ? D : E;
  const n = f.slots.length;
  const h = markHeight(f.form, n, mu);
  const top = floorY - h;
  const out: string[] = [];
  const r = Math.round;

  const plinth = Math.max(5, r(0.45 * mu));
  const cap = Math.max(3, r(0.28 * mu));

  const caseOf = (aspect: number) => {
    const w = r(aspect * mu);
    return { w, x0: cx - r(w / 2), x1: cx - r(w / 2) + w };
  };

  switch (f.form) {
    case 'rail': {
      const w = r(4.6 * mu);
      const x0 = cx - r(w / 2);
      out.push(`<path d="M${x0} ${top}h${w}" ${reg}/>`);
      out.push(`<path d="M${x0 + 4} ${top}v${h}M${x0 + w - 4} ${top}v${h}" ${reg}/>`);
      const many = Math.min(n, 4);
      // The hanger's arm is bounded by the SPACING, not only by the unit: four
      // hangers on a wide rail each drew a 0.9mu triangle, they overlapped into
      // a zigzag, and a row of clothes came out looking like bunting.
      const gap = w / (many + 1);
      const arm = r(Math.min(0.9 * mu, gap * 0.42));
      const hook = r(Math.min(0.2 * mu, gap * 0.1));
      for (let i = 0; i < many; i++) {
        const hx = r(x0 + gap * (i + 1));
        if (mu >= 14 && hook >= 2) {
          out.push(`<path d="M${hx - hook} ${top}a${hook} ${hook} 0 0 1 ${hook * 2} 0" ${det}/>`);
        }
        out.push(`<path d="M${hx} ${top + r(0.4 * mu)}v-${r(0.2 * mu)}" ${det}/>`);
        out.push(`<path d="M${hx} ${top + r(0.4 * mu)}l-${arm} ${r(0.6 * mu)}h${arm * 2}z" ${det}/>`);
      }
      if (filled) {
        // One garment on the middle hanger, because a rail with clothes on it is
        // drawn with clothes on it. The frieze's own dressed hanger, reduced.
        const hx = r(x0 + gap);
        out.push(
          `<path d="M${hx} ${top + r(0.4 * mu)}l-${arm - 1} ${r(0.6 * mu)}` +
          `c-2 ${r(1.6 * mu)} 0 ${r(2.6 * mu)} 2 ${r(3.4 * mu)}` +
          `c${r(arm * 0.7)} 3 ${r(arm * 1.3)} 3 ${arm * 2 - 4} 0` +
          `c2-${r(0.8 * mu)} 3-${r(1.8 * mu)} 0-${r(3.4 * mu)}z" ${D}/>`
        );
      }
      out.push(`<path d="M${x0} ${floorY}h${w}" ${reg}/>`);
      break;
    }
    case 'chest': {
      const { w, x0 } = caseOf(3.2);
      const bodyTop = top + cap;
      const bodyH = n * mu;
      out.push(`<path d="M${x0 - 3} ${top}h${w + 6}v${cap}h-${w + 6}z" ${reg}/>`);
      out.push(`<path d="M${x0} ${bodyTop}h${w}v${bodyH}h-${w}z" ${reg}/>`);
      for (let i = 1; i < n; i++) out.push(`<path d="M${x0} ${bodyTop + i * mu}h${w}" ${det}/>`);
      if (filled && mu >= 11) {
        for (let i = 0; i < n; i++) {
          const hw = r(0.28 * w);
          out.push(`<path d="M${cx - r(hw / 2)} ${bodyTop + i * mu + r(mu / 2)}h${hw}" ${det}/>`);
        }
      }
      out.push(`<path d="M${x0} ${floorY - plinth}h${w}" ${reg}/>`);
      out.push(`<path d="M${x0 + 4} ${floorY - plinth}v${plinth}M${x0 + w - 4} ${floorY - plinth}v${plinth}" ${reg}/>`);
      break;
    }
    case 'shelves': {
      const { w, x0 } = caseOf(3.4);
      const bodyH = n * mu;
      out.push(`<path d="M${x0} ${top}h${w}v${bodyH}h-${w}z" ${reg}/>`);
      // Shelf rules OVERHANG the case. Against the chest's flush divisions this
      // is what tells the two apart at fifty pixels wide.
      for (let i = 1; i < n; i++) out.push(`<path d="M${x0 - 3} ${top + i * mu}h${w + 6}" ${det}/>`);
      if (filled) {
        for (let i = 0; i < Math.min(n, 3); i++) {
          out.push(`<path d="M${cx - r(0.31 * w)} ${top + (i + 1) * mu - 4}h${r(0.62 * w)}" ${det}/>`);
        }
      }
      out.push(`<path d="M${x0} ${floorY - plinth}h${w}" ${reg}/>`);
      break;
    }
    case 'almirah':
    case 'almirah-carved': {
      const { w, x0, x1 } = caseOf(3.0);
      const carved = f.form === 'almirah-carved';
      const caseTop = carved ? top + r(0.5 * mu) : top;
      out.push(`<path d="M${x0} ${caseTop}h${w}v${floorY - caseTop - plinth}h-${w}z" ${reg}/>`);
      // The tell that makes an almirah an almirah from across a room: it is
      // taller than everything, and it has two doors.
      out.push(`<path d="M${cx} ${caseTop}v${floorY - caseTop - plinth}" ${det}/>`);
      if (carved) {
        out.push(`<path d="M${x0 - 4} ${caseTop}q${r(w / 2) + 4} -${r(0.55 * mu)} ${w + 8} 0" ${reg}/>`);
        out.push(`<path d="M${x0 + 4} ${floorY - plinth}v${plinth}q0 ${r(0.2 * mu)} -3 ${r(0.2 * mu)}` +
          `M${x1 - 4} ${floorY - plinth}v${plinth}q0 ${r(0.2 * mu)} 3 ${r(0.2 * mu)}" ${reg}/>`);
      } else {
        // The mirror on the left leaf, in the one mark this house has for glass.
        out.push(`<path d="M${x0 + 4} ${caseTop + r(0.7 * mu)}l${r(w / 2) - 8} ${r(2.4 * mu)}" ${E}/>`);
        out.push(`<path d="M${x0 + 4} ${floorY - plinth}v${plinth}M${x1 - 4} ${floorY - plinth}v${plinth}" ${reg}/>`);
      }
      // Two handles meeting at the middle stile — the second tell.
      if (mu >= 11) {
        const hy = floorY - plinth - r(3.2 * mu);
        out.push(`<path d="M${cx - 5} ${hy}v${r(0.7 * mu)}M${cx + 5} ${hy}v${r(0.7 * mu)}" ${det}/>`);
      }
      break;
    }
    case 'box': {
      const { w, x0 } = caseOf(4.4);
      const lidH = Math.max(4, r(0.8 * mu));
      const bodyTop = top + lidH + 4;
      out.push(`<path d="M${x0 + 4} ${top}h${w - 8}v${lidH}h-${w - 8}z" ${reg}/>`);
      out.push(`<path d="M${x0} ${bodyTop}h${w}v${floorY - bodyTop - 4}h-${w}z" ${reg}/>`);
      for (let i = 1; i < n; i++) {
        out.push(`<path d="M${x0} ${bodyTop + r((floorY - bodyTop - 4) * (i / n))}h${w}" ${det}/>`);
      }
      out.push(`<path d="M${x0 + 4} ${floorY - 4}v4M${x0 + w - 4} ${floorY - 4}v4" ${reg}/>`);
      break;
    }
    case 'hooks': {
      // On the wall, not on the floor. The one form that does not stand.
      const w = r(5 * mu);
      const x0 = cx - r(w / 2);
      const battenH = Math.max(5, r(0.6 * mu));
      out.push(`<path d="M${x0} ${top}h${w}v${battenH}h-${w}z" ${reg}/>`);
      for (let i = 0; i < n; i++) {
        const px = r(x0 + w * ((i + 0.5) / n));
        out.push(`<path d="M${px} ${top + battenH}v${r(0.5 * mu)}" ${det}/>`);
      }
      if (filled) {
        const px = r(x0 + w * (0.5 / n));
        out.push(
          `<path d="M${px - r(0.5 * mu)} ${top + battenH + r(0.5 * mu)}q${r(0.5 * mu)}-${r(0.7 * mu)} ${r(1 * mu)} 0` +
          `M${px - r(0.8 * mu)} ${top + battenH + r(0.7 * mu)}h${r(1.6 * mu)}l-3 ${r(2 * mu)}h-${r(1.6 * mu) - 6}z" ${D}/>`
        );
      }
      break;
    }
    case 'stand': {
      out.push(`<path d="M${cx - 3} ${top}v${h - 4}M${cx + 3} ${top}v${h - 4}" ${reg}/>`);
      out.push(`<path d="M${cx - r(1.3 * mu)} ${floorY - 4}h${r(2.6 * mu)}" ${reg}/>`);
      out.push(`<path d="M${cx - r(0.9 * mu)} ${floorY}h${r(1.8 * mu)}" ${reg}/>`);
      for (let i = 0; i < n; i++) {
        const ty = r(top + (h - 8) * ((i + 1) / (n + 1)));
        out.push(`<path d="M${cx - r(0.8 * mu)} ${ty}h${r(1.6 * mu)}" ${det}/>`);
      }
      break;
    }
    case 'rack': {
      const { w, x0 } = caseOf(3.6);
      out.push(`<path d="M${x0} ${top}v${h}M${x0 + w} ${top}v${h}" ${reg}/>`);
      for (let i = 0; i < n; i++) {
        const ty = r(top + h * ((i + 1) / n));
        out.push(`<path d="M${x0} ${ty}h${w}" ${det}/>`);
        if (filled && mu >= 12) {
          out.push(`<path d="M${x0 + 4} ${ty - 3}q${r(0.5 * w)} -${r(0.4 * mu)} ${w - 8} 0" ${det}/>`);
        }
      }
      break;
    }
  }
  return out.join('');
}

/**
 * Draw the room.
 *
 * `width` is the measured plate width in CSS pixels; everything below is
 * derived from it and from the furniture, with no second design decision to
 * make anywhere.
 */
export function drawRoom(
  pieces: Furniture[],
  counts: Record<string, number>,
  width: number,
  looseCount: number,
): Room {
  const W = Math.max(240, Math.round(width));
  // The return depth. Its lower clamp of 44 exists solely so the door is a legal
  // tap target, and that clamp is what sets a phone's wall to four bays. Do not
  // lower it.
  const d = Math.min(160, Math.max(44, Math.round(0.13 * W)));
  const wallW = W - 2 * d;
  const capacity = Math.min(MAX_BAYS, Math.max(1, Math.floor(wallW / MIN_BAY)));
  const shown = Math.min(pieces.length, capacity);
  const ajar = pieces.length > capacity;
  const bare = pieces.length === 0;
  const bays = Math.max(shown, 1);
  const bayW = Math.min(wallW / bays, MAX_BAY);
  const runX0 = d + (wallW - bayW * bays) / 2;

  const mu = Math.min(
    Math.max(9, Math.min(Math.floor((bayW * 0.8) / 3.2), Math.round(W / 20))),
    40,
  );
  const heights = bare
    ? [markHeight('rail', 4, mu)]
    : pieces.slice(0, shown).map(p => markHeight(p.form, p.slots.length, mu));
  const wallH = Math.min(340, Math.max(150, Math.round(Math.max(...heights) / 0.74)));
  const k = 1 - (2 * d) / W;
  const H = Math.round(wallH / k);
  const ceilY = Math.round(Math.round(0.38 * H) * (1 - k));
  const floorY = ceilY + wallH;

  const out: string[] = [];
  // The shell. Eight paths, none of them closed into a rectangle.
  out.push(`<path d="M${d} ${ceilY}h${wallW}M${d} ${floorY}h${wallW}" ${A}/>`);
  out.push(`<path d="M${d} ${ceilY}v${wallH}M${W - d} ${ceilY}v${wallH}" ${A}/>`);
  const t = 0.62;
  for (const [cx, cy, tx, ty] of [
    [d, ceilY, 0, 0], [W - d, ceilY, W, 0],
    [d, floorY, 0, H], [W - d, floorY, W, H],
  ]) {
    out.push(`<path d="M${cx} ${cy}L${Math.round(cx + (tx - cx) * t)} ${Math.round(cy + (ty - cy) * t)}" ${A}/>`);
  }

  // The door, in the right-hand return — a plane no piece ever occupies, so it
  // can never cross one. It is present at every count including zero, because
  // you walked in through it. Ajar when the wall could not hold everything:
  // more room beyond, drawn rather than counted.
  const doorX = W - d + 6;
  const doorW = d - 12;
  out.push(`<path d="M${doorX} ${ceilY + 8}h${doorW}v${floorY - ceilY - 8}" ${A}/>`);
  if (ajar) {
    out.push(`<path d="M${doorX} ${ceilY + 8}l-${Math.round(doorW * 0.5)} ${Math.round((floorY - ceilY) * 0.1)}` +
      `v${Math.round((floorY - ceilY) * 0.86)}l${Math.round(doorW * 0.5)} ${Math.round((floorY - ceilY) * 0.04)}" ${A}/>`);
  } else {
    out.push(`<path d="M${doorX + doorW - 8} ${Math.round((ceilY + floorY) / 2)}v10" ${A}/>`);
  }

  const list: RoomBay[] = [];
  // TWO converters, not one. The plate is W units across and H units down, and
  // a CSS percentage resolves against the axis it is on — so a single divisor
  // scales every vertical by H/W and floats the whole hit layer up into the
  // ceiling, clear of the furniture it is supposed to be over.
  const pc = (v: number) => Math.round((v / W) * 10000) / 100;
  const pcY = (v: number) => Math.round((v / H) * 10000) / 100;
  const floorBand = Math.min(34, H - floorY);

  if (bare) {
    // NO FURNITURE — which is most people, forever. This is not an empty room,
    // because the person has clothes: they are, factually, hanging somewhere in
    // it without an address. So the wall carries the one thing every wardrobe
    // has whether or not it has been written down, drawn SOLID because it is
    // genuinely holding something, and tapping it opens those clothes.
    const stand: Furniture = {
      id: 'the-rail', name: 'The rail', form: 'rail', dateAdded: '',
      slots: Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, label: '' })),
    };
    out.push(mark(stand, Math.round(W / 2), floorY, mu, looseCount > 0));
    list.push({
      id: '', left: pc(d), width: pc(wallW), top: pcY(ceilY),
      height: pcY(wallH + floorBand), name: 'The rail', count: looseCount, packed: false,
    });
  } else {
    pieces.slice(0, shown).forEach((piece, i) => {
      const cx = Math.round(runX0 + (i + 0.5) * bayW);
      const count = piece.slots.reduce((a, s) => a + (counts[s.id] ?? 0), 0);
      out.push(mark(piece, cx, floorY, mu, count > 0));
      // A name on the floor, when the bay is wide enough to hold one. Mono caps
      // at 13px advance about 8.8px, so eight characters and their gutters need
      // 86; below that the bay carries no text and the link's own hidden label
      // carries the name instead.
      if (bayW >= 96 && floorBand >= 20) {
        const room = Math.max(1, Math.floor((bayW - 16) / 8.8));
        const text = piece.name.length > room ? `${piece.name.slice(0, room - 1)}…` : piece.name;
        out.push(
          `<text x="${cx}" y="${floorY + 20}" text-anchor="middle" fill="var(--color-text-2)" ` +
          `style="font:400 13px var(--font-mono);letter-spacing:.06em">${esc(text.toUpperCase())}</text>`
        );
      }
      list.push({
        id: piece.id,
        left: pc(runX0 + i * bayW), width: pc(bayW), top: pcY(ceilY),
        height: pcY(wallH + floorBand),
        name: piece.name,
        count,
        packed: piece.slots.length > 0 && piece.slots.every(s => s.packed),
      });
    });
  }

  return {
    svg: out.join(''),
    w: W,
    h: H,
    bays: list,
    door: { left: pc(W - d), width: pc(d), top: pcY(ceilY), height: pcY(H - ceilY) },
    ajar,
    beyond: Math.max(0, pieces.length - shown),
    bare,
  };
}
