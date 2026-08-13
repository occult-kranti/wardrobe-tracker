import { drawFurniture } from './furnitureArt';
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
 * Each piece is drawn into furnitureArt's 460×560 box, and every form in it
 * stands between y=96 and the floor at y≈500. Cropping to that band is what
 * lets a room be a room-shaped strip rather than a tall square with air on top.
 */
const BOX_W = 460;
const CROP_TOP = 88;
const CROP_BOT = 512;
const CROP_H = CROP_BOT - CROP_TOP;

/**
 * How wide one piece is drawn, by how many there are.
 *
 * FEWER PIECES ARE DRAWN BIGGER. This is the whole fix for the empty room: the
 * old one held its bay width constant and let the wall grow, so owning one
 * thing meant looking at a lot of wall. Here, owning one thing means looking at
 * that thing.
 */
function pieceWidth(count: number, plate: number): number {
  const wanted = count <= 1 ? 300 : count === 2 ? 250 : count === 3 ? 210 : count === 4 ? 186 : 168;
  // Never so small that the drawing stops being a picture of an object, and
  // never wider than the plate can hold one of.
  return Math.max(120, Math.min(wanted, plate - 48));
}

/** Room-side margin: the wall the furniture is not standing against. */
const SIDE = 26;
const GAP = 14;
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

export interface Room {
  svg: string;
  w: number;
  h: number;
  bays: RoomBay[];
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
): Room {
  const plateW = Math.max(260, Math.round(plate));
  const bare = pieces.length === 0;
  const standing = bare ? [THE_RAIL] : pieces;

  // How many fit standing side by side, at the width that many would be drawn
  // at. Solved rather than assumed: the width depends on the count and the
  // count depends on the width.
  let show = standing.length;
  let pw = pieceWidth(show, plateW);
  while (show > 1 && SIDE * 2 + show * pw + (show - 1) * GAP > plateW) {
    show--;
    pw = pieceWidth(show, plateW);
  }
  const beyond = standing.length - show;

  const ph = Math.round((pw * CROP_H) / BOX_W);
  const innerW = show * pw + (show - 1) * GAP;
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

  standing.slice(0, show).forEach((piece, i) => {
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

  // The doorway, and ONLY when there is something through it. A door drawn on
  // an empty wall is an invitation to go and get more furniture, which is the
  // one thing this screen must never be.
  if (beyond > 0) {
    const dx = W - SIDE - 4;
    out.push(`<path d="M${dx} ${floorY}v-${Math.round(ph * 0.86)}h-26" ${E}/>`);
  }

  return { svg: out.join(''), w: W, h: H, bays, beyond, bare };
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
