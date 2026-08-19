import { drawChair, drawFurniture } from './furnitureArt';
import type { Furniture } from '../types';

/**
 * THE DRESSING ROOM — your own furniture, standing in a room.
 *
 * This is the second attempt. The first one was deleted, and it is worth
 * writing down exactly why, because both faults are easy to build again:
 *
 *   1. IT WAS A SECOND DRAWING SYSTEM. It re-implemented every form that
 *      furnitureArt.ts already draws, at a different scale, with a different
 *      line budget. Two generators for one object class drift, and it drifted
 *      within one commit of a form being added — the fitted almirah had no case
 *      in it, so it took a bay on the wall and rendered nothing at all.
 *   2. IT WAS MOSTLY NOTHING. Measured at the real plate widths, one almirah
 *      filled 8% of the plate on a phone and 9% on a desktop: 91% empty at
 *      every width, because the wall was divided into a fixed number of even
 *      bays and the extra width went into the gaps.
 *
 * Both are answered by the same decision: **this file draws no furniture.** It
 * is a compositor. It asks furnitureArt for each piece exactly as the rest of
 * the app does, and places those drawings along a floor. A form added tomorrow
 * appears here the day it is drawn, because there is nothing here to forget to
 * update.
 *
 * And the room is sized to what is IN it. The frame is as wide as its furniture
 * needs and no wider, centred on the plate; a wardrobe of one piece gets a
 * small room and a wardrobe of six gets a long one. Nothing is divided into
 * bays, so there is no empty bay to count — which was the other objection, and
 * the fair one: a container drawn with visible unfilled capacity is a
 * completion meter whatever it is a picture of.
 *
 * Two measurements kept that promise from being true, and both are fixed here
 * by sizing the room to the furniture's INK rather than to the plate:
 *
 *   1. THE FRAME SPRAWLED. `W = plateW` drew the walls at the plate's edges
 *      whatever was standing between them — one almirah in a metre of empty
 *      room. The walls now stand one skirting off the furniture run, which is
 *      what the paragraph above always said they did (docs/26 §6).
 *   2. THE HEIGHT GREW WITH THE WARDROBE. Piece width was solved from the
 *      plate and the height followed it, so every added place made the room
 *      taller and pushed the clothes further down the page. It runs the other
 *      way now: the strip's height is bounded and decided first, the pieces
 *      are sized to the strip, and what does not fit goes through the door.
 */

/* ---------- the room's own lines, and only its own ---------- */
const A = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';
const E = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="butt" stroke-linejoin="miter"';

/**
 * Each piece is drawn into furnitureArt's 460×560 box, and every form in it
 * stands between y=96 and the floor at y≈500. Cropping to that band is what
 * lets a room be a room-shaped strip rather than a tall square with air on top.
 */
const CROP_BOT = 512;
/**
 * Where the crop starts, and it is not a constant.
 *
 * Every plain form's ink begins at y=96, so 88 was right until the fitted
 * almirah gained a carved crest: mughal springs from y=26, rajput's cornice
 * from 40, shoji's lintel from 76. Cropping at 88 sliced the top off all three
 * — and drew what survived over the room's own ceiling line. So the crop is
 * asked of the pieces actually standing, and a room with no ornament in it
 * keeps its tighter band.
 */
const CROP_PLAIN = 88;
const CROP_CARVED = 20;
function cropTopFor(pieces: Furniture[]): number {
  return pieces.some(p => p.form === 'almirah-fitted' && p.ornament && p.ornament !== 'plain')
    ? CROP_CARVED
    : CROP_PLAIN;
}

/**
 * THE INK WINDOW. Every form draws its ink between x=64 and x=396 of the
 * 460-unit box — the almirah's folded doors, the pegs' batten, the rail's
 * posts — and the rest of the box is the air around the object. The first
 * version of this room placed the BOXES side by side, so a 10-unit gap between
 * boxes was sixty pixels of nothing between the drawings, and the furniture
 * read as specks floating in a field. The room now places the INK side by
 * side: each piece is shifted left by the window's edge, a slot is exactly one
 * drawing wide, and the gap between two pieces is the gap, nothing more. The
 * two carved crests overhang the window by a few units; they lean into the
 * empty gap and nobody is hit.
 */
const INK_X0 = 64;
const INK_W = 332; // 396 - 64

/** The gap between two drawings, ink to ink. */
const GAP = 10;
/** Wall to ink: the skirting of clear floor a room keeps around its furniture. */
const FRAME_PAD = 18;
/** Headroom over the tallest piece, and the floor band under everything. */
const HEAD = 26;
/** The deepest thing drawn below the floor line is the chair's tipped floor
    rule at +13. Twenty-four covers it with breathing room. */
const FLOOR_BAND = 24;
/**
 * THE STRIP'S HEIGHT IS DECIDED FIRST, and the furniture is sized to it — never
 * the other way round. A room whose height grew with the count or width of the
 * wardrobe is a chart, and it pushed the clothes — the hero of this page —
 * further down with every place added. Bounded both ways: tall enough to read
 * on a phone, never taller on a desktop than a strip has any reason to be.
 */
const PH_MIN = 132;
const PH_MAX = 168;
/**
 * Below this a drawing stops being a picture of an object: the strokes are
 * unit-scaled, and under 88px of ink the 2.5-unit carcass is under 0.7px and
 * the forms grey into one texture. This is the old 118px box minimum said in
 * ink, and the arithmetic is the same.
 */
const MIN_INK = 88;

export interface RoomBay {
  id: string;
  /** Percentages of the plate — X against the width, Y against the HEIGHT.
      One divisor for two axes was a real bug here once; it floated every
      target up into the ceiling. */
  left: number; width: number; top: number; height: number;
  name: string;
  count: number;
  packed: boolean;
}

/** The chair, when there is anything on it. A button, not a link — it is the
    only object in the room that DOES something rather than opening somewhere. */
export interface RoomChair {
  left: number; width: number; top: number; height: number;
  count: number;
}

export interface Room {
  svg: string;
  w: number;
  h: number;
  bays: RoomBay[];
  chair: RoomChair | null;
  /** Pieces the room could not hold, which is the only thing the door means. */
  beyond: number;
  /** No furniture at all: the wall carries one rail standing in for the lot. */
  bare: boolean;
}

/** The rail that stands in for a wardrobe nobody has described yet. */
const THE_RAIL: Furniture = {
  id: '', name: 'The rail', form: 'rail', dateAdded: '',
  slots: Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, label: '' })),
};

/**
 * Draw the room.
 *
 * `plate` is the measured plate width in CSS pixels. Everything else follows
 * from it and from the furniture, and one unit is one pixel — so a 44-unit tap
 * target is 44px with nothing to recompute.
 */
export function drawRoom(
  pieces: Furniture[],
  counts: Record<string, number>,
  plate: number,
  looseCount: number,
  wornCount = 0,
): Room {
  const plateW = Math.max(260, Math.round(plate));
  const bare = pieces.length === 0;
  const standing = bare ? [THE_RAIL] : pieces;
  /**
   * THE CHAIR STANDS IN THE ROOM, with the furniture, when there is anything on
   * it — because that is where it is in the house. It was a strip of its own
   * under the room for a week and that was two pictures of one bedroom.
   *
   * It is still not a PLACE: nothing is filed to it, it is derived from
   * laundryStatus at render, and it never enters the furniture list. And it is
   * still a verb — tapping it sends the pile to the wash. At zero it simply is
   * not there, which is what keeps it from being a scoreboard in either
   * direction.
   */
  const withChair = wornCount > 0;

  // The ceiling is asked of everything standing, shown or not — a carved crest
  // going through the door must not change the height of the room it left.
  const cropTop = cropTopFor(standing);
  const cropU = CROP_BOT - cropTop;

  // THE STRIP. The height comes from the plate's width, bounded both ways, and
  // the pieces are sized to the height — so the room is the same height for a
  // wardrobe of one piece and a wardrobe of nine, and adding a place never
  // pushes the clothes further down the page.
  const ph = Math.max(PH_MIN, Math.min(PH_MAX, Math.round(plateW * 0.42)));
  // One slot is one drawing's INK wide; the air in the box is shifted away at
  // placement, not paid for here.
  let pw = Math.round((ph * INK_W) / cropU);

  // What the run may span: the plate, less the skirting and the corner returns
  // on both walls.
  const room = plateW - 2 * (FRAME_PAD + 14);
  // AT LEAST ONE PIECE OF FURNITURE, always. The chair is an action and it
  // takes a slot, and on a narrow plate that could take the ONLY slot — a
  // dressing room drawn as a chair with no wardrobe in it. The pieces give way
  // first: narrower ink before a piece leaves the room.
  if (withChair) pw = Math.min(pw, Math.floor((room - GAP) / 2));
  pw = Math.max(MIN_INK, pw);

  // How many fit standing side by side in the run. The chair takes a place in
  // it, so it is counted when the fit is solved — otherwise it would be drawn
  // over the last wardrobe.
  const fit = Math.max(1, Math.floor((room + GAP) / (pw + GAP)));
  let showPieces = Math.min(standing.length, fit - (withChair ? 1 : 0));
  if (withChair && showPieces < 1 && standing.length > 0) showPieces = 1;
  showPieces = Math.max(0, showPieces);
  const beyond = standing.length - showPieces;

  const drawn = showPieces + (withChair ? 1 : 0);
  const innerW = drawn * pw + (drawn - 1) * GAP;
  const W = plateW;
  const H = HEAD + ph + FLOOR_BAND;
  const floorY = HEAD + ph;
  // Centred, so a small wardrobe reads as a composition rather than as a room
  // with a gap on one side.
  const x0 = Math.round((W - innerW) / 2);
  // THE FRAME IS AS WIDE AS ITS FURNITURE NEEDS — one skirting off the run —
  // and no wider. The walls used to be drawn at the plate's own edges, which
  // is how one almirah came to stand in a metre of empty room.
  const wallL = x0 - FRAME_PAD;
  const wallR = x0 + innerW + FRAME_PAD;

  const out: string[] = [];
  const bays: RoomBay[] = [];

  // THE ROOM. Four lines and two short returns — the whole architecture, kept
  // deliberately thin because everything else on this plate is the user's.
  out.push(`<path d="M${wallL} ${floorY}h${wallR - wallL}" ${A}/>`);
  out.push(`<path d="M${wallL} ${floorY + 8}h${wallR - wallL}" ${A}/>`);
  out.push(`<path d="M${wallL} 10h${wallR - wallL}" ${A}/>`);
  out.push(`<path d="M${wallL} 10v${floorY - 10}M${wallR} 10v${floorY - 10}" ${A}/>`);
  out.push(`<path d="M${wallL} 10L${wallL - 12} 2M${wallR} 10L${wallR + 12} 2" ${A}/>`);
  out.push(`<path d="M${wallL} ${floorY}L${wallL - 12} ${floorY + 14}M${wallR} ${floorY}L${wallR + 12} ${floorY + 14}" ${A}/>`);

  standing.slice(0, showPieces).forEach((piece, i) => {
    const total = piece.slots.reduce((a, s) => a + (counts[s.id] ?? 0), 0);
    const count = bare ? looseCount : total;
    // THE SAME DRAWING THE REST OF THE APP USES. Labels off: at this size its
    // text would land near 9px, and the caption under the room carries the
    // names in the page's own typography.
    const drawing = drawFurniture(
      bare ? THE_RAIL : piece,
      bare ? Object.fromEntries(THE_RAIL.slots.map(s => [s.id, count])) : counts,
      0.709,
      { labels: false },
    );
    const k = pw / INK_W;
    const left = x0 + i * (pw + GAP);
    out.push(
      `<g transform="translate(${(left - INK_X0 * k).toFixed(2)} ${Math.round(floorY - CROP_BOT * k)}) scale(${k.toFixed(4)})" ` +
      `class="text-text">${drawing.svg}</g>`
    );

    bays.push({
      id: piece.id,
      left: Math.round((left / W) * 10000) / 100,
      width: Math.round((pw / W) * 10000) / 100,
      top: Math.round((HEAD / H) * 10000) / 100,
      height: Math.round(((ph + FLOOR_BAND) / H) * 10000) / 100,
      name: piece.name,
      count,
      packed: piece.slots.length > 0 && piece.slots.every(s => s.packed),
    });
  });

  // The chair, at the end of the run — where it is in the room, and where it
  // does not sit between two wardrobes.
  let chair: RoomChair | null = null;
  if (withChair) {
    // SMALLER, AND SET AT AN ANGLE.
    //
    // Drawn square-on at the wardrobes' own width it read as another piece of
    // furniture in the line — and it is not one; nothing is filed to it. A
    // chair in a real room is pulled out and turned, so this one is too: about
    // seven tenths the size of the cases beside it, and tipped nine degrees
    // about the point where its own feet meet the floor, so it still stands on
    // the same floor as everything else while plainly not being part of the
    // run.
    const k = (pw * 0.7) / INK_W;
    const slotLeft = x0 + showPieces * (pw + GAP);
    // The chair's own ink runs 72..388 of its box; centred in the slot by it.
    const left = slotLeft + (pw - 316 * k) / 2 - 72 * k;
    out.push(
      `<g transform="translate(${left.toFixed(2)} ${Math.round(floorY - CROP_BOT * k)}) scale(${k.toFixed(4)}) rotate(-9 230 500)" ` +
      `class="text-text">${drawChair(wornCount).svg}</g>`
    );
    chair = {
      // The TARGET keeps the full slot: the drawing shrank, the thing a thumb
      // aims at did not.
      left: Math.round((slotLeft / W) * 10000) / 100,
      width: Math.round((pw / W) * 10000) / 100,
      top: Math.round((HEAD / H) * 10000) / 100,
      height: Math.round(((ph + FLOOR_BAND) / H) * 10000) / 100,
      count: wornCount,
    };
  }

  // The doorway, and ONLY when there is something through it. A door drawn on
  // an empty wall is an invitation to go and get more furniture, which is the
  // one thing this screen must never be.
  if (beyond > 0) {
    const dx = wallR - 4;
    out.push(`<path d="M${dx} ${floorY}v-${Math.round(ph * 0.86)}h-26" ${E}/>`);
  }

  return { svg: out.join(''), w: W, h: H, bays, chair, beyond, bare };
}

