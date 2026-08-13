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
 */

/* ---------- the room's own lines, and only its own ---------- */
const A = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';
const E = 'fill="none" stroke="var(--color-text-2)" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="butt" stroke-linejoin="miter"';
/**
 * The room's one ornament, in the frieze's own metal.
 *
 * Not a control, not data, not interactive, and drawn in --color-gold, which
 * the contract reserves for exactly this: decorative only, never text, never a
 * labelled fill. It exists so the room reads as somewhere lived in rather than
 * as a diagram — a single shoe stepped out of and left where it fell, which is
 * what a real dressing-room floor has on it.
 */
const M = 'fill="none" stroke="var(--color-gold)" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"';

/**
 * Each piece is drawn into furnitureArt's 460×560 box, and every form in it
 * stands between y=96 and the floor at y≈500. Cropping to that band is what
 * lets a room be a room-shaped strip rather than a tall square with air on top.
 */
const BOX_W = 460;
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
 * How wide n pieces are drawn, given the plate they must fit in.
 *
 * SOLVED, not tabulated. The first version held a table of widths by count —
 * 300 for one, 250 for two, and so on — which meant the width did not know how
 * wide the plate was: on a 320px phone two pieces "wanted" 250 each, could not
 * fit, and the solver dropped to ONE object every time. A phone with five
 * places saw one wardrobe and a door. Divide the room by the objects instead,
 * and the arithmetic is right at every width.
 */
function pieceWidth(count: number, plate: number): number {
  const room = plate - SIDE * 2 - GAP * Math.max(0, count - 1);
  return Math.min(MAX_PIECE, Math.floor(room / Math.max(1, count)));
}

/** Room-side margin: the wall the furniture is not standing against. */
const SIDE = 14;
const GAP = 10;
/**
 * Below this a drawing stops being a picture of an object. The strokes are
 * unit-scaled, so at 118px the 2.5-unit carcass renders at 0.64px — already
 * thin; under it the whole object greys into texture and the forms stop being
 * distinguishable from one another, which is the only job the mark has.
 */
const MIN_PIECE = 118;
/** Past this one object stops being furniture and becomes a poster. */
const MAX_PIECE = 260;
/** Headroom over the tallest piece, and the floor band under everything. */
const HEAD = 26;
const FLOOR_BAND = 30;

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

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

  // How many fit standing side by side, at the width that many would be drawn
  // at. Solved rather than assumed: the width depends on the count and the
  // count depends on the width.
  // The chair takes a place in the run, so it is counted when the widths are
  // solved — otherwise it would be drawn over the last wardrobe.
  const slots = standing.length + (withChair ? 1 : 0);
  let show = slots;
  while (show > 1 && pieceWidth(show, plateW) < MIN_PIECE) show--;
  // AT LEAST ONE PIECE OF FURNITURE, always. The chair is an action and it
  // takes a slot, and on a narrow plate that meant it could take the ONLY slot
  // — a dressing room drawn as a chair with no wardrobe in it.
  let showPieces = show - (withChair ? 1 : 0);
  if (withChair && showPieces < 1 && standing.length > 0) {
    show = 2;
    showPieces = 1;
  }
  showPieces = Math.max(0, Math.min(showPieces, standing.length));
  const pw = pieceWidth(show, plateW);
  const beyond = standing.length - showPieces;

  const cropTop = cropTopFor(standing.slice(0, showPieces));
  const ph = Math.round((pw * (CROP_BOT - cropTop)) / BOX_W);
  const drawn = showPieces + (withChair ? 1 : 0);
  const innerW = drawn * pw + (drawn - 1) * GAP;
  const W = plateW;
  const H = HEAD + ph + FLOOR_BAND;
  const floorY = HEAD + ph;
  // Centred, so a small wardrobe reads as a composition rather than as a room
  // with a gap on one side.
  const x0 = Math.round((W - innerW) / 2);

  const out: string[] = [];
  const bays: RoomBay[] = [];

  // THE ROOM. Four lines and two short returns — the whole architecture, kept
  // deliberately thin because everything else on this plate is the user's.
  out.push(`<path d="M${SIDE} ${floorY}h${W - SIDE * 2}" ${A}/>`);
  out.push(`<path d="M${SIDE} ${floorY + 8}h${W - SIDE * 2}" ${A}/>`);
  out.push(`<path d="M${SIDE} 10h${W - SIDE * 2}" ${A}/>`);
  out.push(`<path d="M${SIDE} 10v${floorY - 10}M${W - SIDE} 10v${floorY - 10}" ${A}/>`);
  out.push(`<path d="M${SIDE} 10L2 2M${W - SIDE} 10L${W - 2} 2" ${A}/>`);
  out.push(`<path d="M${SIDE} ${floorY}L2 ${floorY + 14}M${W - SIDE} ${floorY}L${W - 2} ${floorY + 14}" ${A}/>`);

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
    const k = pw / BOX_W;
    const left = x0 + i * (pw + GAP);
    out.push(
      `<g transform="translate(${left} ${Math.round(floorY - CROP_BOT * k)}) scale(${k.toFixed(4)})" ` +
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

  // ONE HEEL, stepped out of and left on the floor. Near the left return,
  // clear of the furniture's run, and omitted when the room is too narrow to
  // hold it without crowding — an ornament that has to fight for space is not
  // an ornament, it is clutter.
  if (x0 - SIDE >= 46 && FLOOR_BAND >= 26) {
    const hx = SIDE + 12;
    const hy = floorY + 20;
    out.push(`<path d="M${hx} ${hy}h26q6 0 8-5l3-9" ${M}/>`);
    out.push(`<path d="M${hx + 37} ${hy - 14}q-9 3-15 9" ${M}/>`);
    out.push(`<path d="M${hx + 24} ${hy}v7h5v-7" ${M}/>`);
  }

  // The chair, at the end of the run — where it is in the room, and where it
  // does not sit between two wardrobes.
  let chair: RoomChair | null = null;
  if (withChair) {
    const k = pw / BOX_W;
    const left = x0 + showPieces * (pw + GAP);
    out.push(
      `<g transform="translate(${left} ${Math.round(floorY - CROP_BOT * k)}) scale(${k.toFixed(4)})" ` +
      `class="text-text">${drawChair(wornCount).svg}</g>`
    );
    chair = {
      left: Math.round((left / W) * 10000) / 100,
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
    const dx = W - SIDE - 4;
    out.push(`<path d="M${dx} ${floorY}v-${Math.round(ph * 0.86)}h-26" ${E}/>`);
  }

  return { svg: out.join(''), w: W, h: H, bays, chair, beyond, bare };
}

/** What the line under the room says. Kept here so the drawing and its sentence
    cannot drift apart. */
export function roomCaption(room: Room, places: number): string {
  if (room.bare) return 'Everything hangs on the rail for now.';
  const shown = room.bays.length;
  const named = room.bays.map(b => esc(b.name)).join(', ');
  if (room.beyond > 0) {
    return `${named}, and ${room.beyond} more through the door.`;
  }
  return shown === places ? `${named}.` : `${named}.`;
}
