/**
 * FEED INTAKE — reading a screenshot of an Instagram grid.
 *
 * The flat-lay prompt (docs/23) reads one photograph of clothes. This one
 * reads a screenshot of a whole feed: many posts at once, most of them not
 * clothes at all. The discipline is the same — JSON only, doubts stated,
 * boxes the app can crop along — with one rule added ahead of all others:
 *
 *   A tile showing two or more people is left alone. Always.
 *
 * Only solo tiles (one person's outfit, or garments with no person in them
 * at all) are read for their pieces. The model locates the tiles, the
 * cutting happens on the device, and every detection lands as a draft in the
 * same review bench the flat-lay flow uses — nothing is written until the
 * owner says so.
 *
 * This module is pure: no DOM, no network, no storage. The page supplies
 * pixels; the tests supply strings.
 */

import { readIntake, type IntakeDraft, type IntakeRead, type IntakeSkip } from '@almari/shared/intake';

/** A normalized rectangle: fractions 0–1, origin top-left. */
export interface GridBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle in pixels, against the image that was actually sent. */
export interface PxBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * What a tile shows. 'solo' is the only kind ever read for garments:
 * one person's outfit, or clothes with no person in the frame at all
 * (a flat lay, a hanger, a product shot). 'group' is two or more people,
 * and the house rule is that it is left alone.
 */
export type TileKind = 'solo' | 'group' | 'scenery' | 'text' | 'other';

const KINDS: readonly TileKind[] = ['solo', 'group', 'scenery', 'text', 'other'];

/** A garment found on a solo tile. Boxes are WITHIN the tile, not the screenshot. */
export interface GridGarment {
  ref: string;
  name: string;
  /** Free text — the ledger's categories are the owner's; intake.ts matches them. */
  category: string;
  color?: string;
  colorName?: string;
  pattern?: string;
  material?: string;
  /** Season hints: any of spring, summer, fall, winter. */
  season: string[];
  /** Occasion and style words; the ones the ledger knows become its tags. */
  tags: string[];
  confidence: number;
  /** Field names the model said it guessed weakly — preserved, never ironed out. */
  uncertain: string[];
  box?: GridBox;
}

export interface GridTile {
  ref: string;
  kind: TileKind;
  confidence: number;
  /** Within the screenshot. Absent when the model could not place the tile. */
  box?: GridBox;
  /** Set when the reader had to interpret something (an unknown kind, say). */
  note?: string;
  /** Empty on every kind but solo — enforced here, whatever the model sent. */
  garments: GridGarment[];
}

export interface GridRead {
  tiles: GridTile[];
  /** Rows that could not be used at all, with the reason — nothing vanishes silently. */
  dropped: Array<{ ref: string; reason: string }>;
  /** Fatal problems with the answer itself. When set, tiles is empty. */
  error?: string;
}

/* ---------- the prompt ---------- */

/**
 * The vision prompt for a feed screenshot, in the old intake prompt's
 * discipline: JSON only, no fences, every doubt stated, boxes in fractions.
 * It borrows the flat-lay prompt's one absolute rule and aims it at the grid:
 * the clothes are the subject, and a tile with more than one person in it is
 * not read at all.
 */
export function buildGridPrompt(): string {
  return GRID_PROMPT;
}

const GRID_PROMPT = `You are reading a SCREENSHOT of an Instagram profile grid — many posts
at once — for a personal clothing ledger. Return ONLY a JSON object, no
prose before or after, no markdown fences.

THE GRID
Find every post tile in the grid. For each one give "box": {"x", "y", "w",
"h"} as fractions of the WHOLE screenshot (0 to 1, origin top-left, x and y
the top-left corner of the tile). Profile headers, buttons, captions and
icons around the grid are not tiles. If the grid is scrolled and a tile is
partly cut off, box the part you can see.

THE ONE RULE ABOUT PEOPLE
A tile showing ONE person is read for its clothes. A tile showing TWO OR
MORE people is left alone entirely: classify it "group", give it an empty
garments list, and never describe anyone in it. Whatever the tile, describe
the clothes and never the person — no word about a body, a face, an age, a
size, or who a garment would suit.

KIND — classify every tile as exactly one of:
  solo     one person's outfit in ONE photograph, or one photograph of
           garments with no person at all (a flat lay, a hanger shot, a
           product photo)
  group    two or more people — left alone, always
  scenery  a place, a meal, a pet, a view — no clothes as the subject
  text     a graphic of words
  other    anything else, including a collage of several photographs
           stitched into one tile
"confidence" is 0 to 1 for the classification. A tile you cannot classify
with any confidence is "other". A tile stitching two or more photographs
together is a collage: classify it "other", never "solo". When you hesitate
between "solo" and anything else, choose the other kind — "solo" is the only
kind that is read for garments, and it must be earned.

GARMENTS — only on "solo" tiles. Every other kind carries an empty list.
For each garment visible well enough to name:
  name       two to four plain words: "Blue oxford shirt", "Gold hoops". No
             marketing adjectives, no size, no gendered wording.
  category   one plain word — tops, bottoms, dresses, layers, outerwear,
             shoes, jewellery, accessories. The ledger's own categories are
             the owner's; this word is matched to them later.
  color      a hex sampled from the largest area of the piece, "#RRGGBB"
  colorName  the plain word for it ("navy", "oatmeal", "rust")
  pattern    one word ("solid", "striped", "floral") — omit if unclear
  material   your best read of the fabric — omit if you cannot tell
  season     any of spring, summer, fall, winter, from fabric weight and cut
  tags       occasion and style words: casual, work, formal, sport, party
  confidence 0 to 1 for the garment as a whole
  uncertain  the names of any fields you guessed weakly
  box        {"x", "y", "w", "h"} of the garment WITHIN ITS TILE (0 to 1,
             origin at the tile's own top-left). Tight around the piece. If
             you cannot place it, omit the box rather than inventing one.

It is better to be openly unsure than smoothly wrong: this file is going
into someone's permanent record.

RETURN EXACTLY THIS SHAPE:
{
  "feedGrid": 1,
  "tiles": [
    {
      "ref": "t1",
      "kind": "solo",
      "confidence": 0.9,
      "box": { "x": 0.0, "y": 0.25, "w": 0.333, "h": 0.22 },
      "garments": [
        {
          "ref": "g1",
          "name": "Blue oxford shirt",
          "category": "tops",
          "color": "#RRGGBB",
          "colorName": "light blue",
          "pattern": "solid",
          "material": "cotton",
          "season": ["spring", "summer"],
          "tags": ["casual", "work"],
          "confidence": 0.85,
          "uncertain": ["material"],
          "box": { "x": 0.15, "y": 0.1, "w": 0.7, "h": 0.55 }
        }
      ]
    },
    {
      "ref": "t2",
      "kind": "group",
      "confidence": 0.95,
      "box": { "x": 0.333, "y": 0.25, "w": 0.333, "h": 0.22 },
      "garments": []
    }
  ]
}

"ref" is unique within the answer. Tiles are in reading order, left to
right, top to bottom. "pattern", "material" and "uncertain" may be omitted
when they have nothing to say. Every other field is required on every tile
and every garment.`;

/* ---------- ONE PHOTOGRAPH — the gallery import prompt ---------- */

/**
 * The vision prompt for a single photograph from the owner's own gallery:
 * clothes laid out or hanging, or one person's outfit as worn. Same
 * discipline as the grid prompt — JSON only, doubts stated, boxes in
 * fractions, the clothes described and never a person — with one difference
 * that matters: here a solo worn outfit is a subject, not a reason to stop.
 * A photograph of TWO OR MORE people is the one thing it refuses, answered
 * with an empty pieces list.
 *
 * The answer is the same `toileIntake` handoff file the flat-lay flow uses,
 * so the reader is lib/intake.ts's — an API answer and a hand-written file
 * cannot diverge in how strictly they are checked.
 */
export function buildPhotoPrompt(): string {
  return PHOTO_PROMPT;
}

const PHOTO_PROMPT = `You are reading ONE photograph for a personal clothing ledger — clothes
laid out or hanging, or one person's outfit as worn. Return ONLY a JSON
object, no prose before or after, no markdown fences.

THE ONE RULE ABOUT PEOPLE
The clothes are the subject, never a person. Whatever the photograph shows,
describe the clothes and never the person — no word about a body, a face,
hair, an age, a size, or who a garment would suit. What one person happens
to be wearing is read like any other clothes: the shirt, not the shoulders
it is on. If the photograph shows TWO OR MORE people, return an empty
"pieces" list and say so in "skipped".

WHAT TO LOOK AT
Identify every distinct garment, footwear item, bag, or piece of jewellery
you can see well enough to name — laid out, hanging, or worn. Furniture,
hangers, walls, floors, mirrors, phones and rooms are not pieces. Pieces too
occluded, blurred or dark to name honestly go in "skipped", never guessed
at.

ONE ROW PER PIECE
A folded stack is several pieces only if you can distinguish them; if you
cannot, record one row and say so. A matched set worn as one thing (a suit
worn as a suit, a saree with its blouse) is ONE row; pieces that plainly
separate are TWO. A dress is ONE row, never a top and a skirt. A pair of
shoes is ONE row.

CATEGORY — use exactly one of these ids:
  tops         shirts, tees, blouses, knits, kurtas, camisoles
  bottoms      trousers, jeans, skirts, shorts, leggings
  dresses      one-pieces: dresses, jumpsuits, gowns, robes, sarees
  layers       cardigans, hoodies, blazers, waistcoats, overshirts
  outerwear    coats, parkas, rain shells, heavy jackets
  shoes        every kind of footwear, including sandals and boots
  jewellery    earrings, necklaces, rings, bangles, watches
  accessories  bags, belts, scarves, hats, sunglasses, socks, ties
If it is worn over another top and could come off indoors, it is layers; if
it is for weather, it is outerwear. A watch is jewellery. A bag is
accessories. When two ids are defensible, pick the one the owner would look
under, and add the field name to "uncertain".

NAME — two to four plain words, the words a person would actually use:
"Blue oxford shirt", "Black ankle boots", "Gold hoops". No marketing
adjectives, no size, no gendered wording.

DESCRIPTION — exactly one sentence, factual, under 110 characters. Say what
it is, its colour, and at most one detail you can genuinely see (weave,
collar, closure, print). Never guess price, quality, brand or era. Never
flatter and never judge.

COLOUR — "color" is a hex sampled from the largest area of the piece,
"#RRGGBB"; "colorName" is the plain word for it ("navy", "oatmeal", "rust").

SEASON — any of spring, summer, fall, winter, from fabric weight and cut.
OCCASION — any of casual, work, formal, performance, sport, party.

CONFIDENCE is 0 to 1 for the row as a whole. Put the names of any fields you
guessed weakly into "uncertain". It is better to be openly unsure than
smoothly wrong: this file is going into someone's permanent record.

BOX is required on every piece, and it is the field the app depends on most:
it crops the photograph along these coordinates to make the picture that ends
up in the closet. Give [x, y, w, h] as fractions of the image (0 to 1, origin
top-left, x and y the top-left corner of the box). Draw it TIGHT around the
piece — the smallest rectangle that still contains all of it. A worn piece:
box what shows. If you genuinely cannot place a piece, put it in "skipped"
rather than inventing coordinates: a wrong box crops someone's closet to a
picture of a floor.

BACKGROUND is one word describing what the piece is lying on or hanging
against, judged for one purpose: whether the piece could be lifted off its
background on the device. Tell it plainly.
  plain   an even sheet, wall, floor or seamless studio ground — would lift
  busy    a patterned duvet, a rug, a crowded rail, another garment behind
          it or touching it, or a room behind a worn outfit
  none    already cut out, on white or transparent — nothing to lift
Say "busy" whenever the piece and what it lies on are close in colour, or the
piece is touching another garment. A worn outfit is almost always "busy":
there is a room behind it and the garments touch each other.

RETURN EXACTLY THIS SHAPE:
{
  "toileIntake": 1,
  "photos": [{ "n": 1, "note": "clothes laid out on a bed" }],
  "pieces": [
    {
      "ref": "p1",
      "photo": 1,
      "name": "Blue oxford shirt",
      "category": "tops",
      "description": "Light blue cotton oxford with a button-down collar.",
      "color": "#RRGGBB",
      "colorName": "light blue",
      "pattern": "solid",
      "material": "cotton",
      "season": ["spring", "summer"],
      "occasion": ["casual", "work"],
      "confidence": 0.88,
      "uncertain": ["material"],
      "background": "plain",
      "box": [0.12, 0.3, 0.26, 0.34]
    }
  ],
  "skipped": [
    { "photo": 1, "reason": "too occluded to name", "note": "under the stack" }
  ]
}

"ref" is unique within the answer. "pattern", "material", "uncertain" and
"skipped" may be omitted when they have nothing to say. Every other field,
"box" and "background" included, is required on every piece.`;

/* ---------- reading the answer ---------- */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A box from the model: an object, or the array the flat-lay prompt taught it. */
function readBox(value: unknown): GridBox | undefined {
  let parts: unknown[] | undefined;
  if (Array.isArray(value) && value.length === 4) parts = value;
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    parts = [o.x, o.y, o.w, o.h];
  }
  if (!parts || !parts.every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  const [x, y, w, h] = parts as number[];
  if (w <= 0 || h <= 0) return undefined;
  return {
    x: clamp01(x),
    y: clamp01(y),
    w: Math.min(1, w),
    h: Math.min(1, h),
  };
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const s = v.trim().toLowerCase().slice(0, max);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Read the model's answer to the grid prompt. Forgiving in one direction —
 * prose around the JSON, a fence, an unknown kind — and strict in the other:
 * a non-solo tile keeps no garments, whatever the answer claims. Never
 * throws: this runs behind a file picker, and a crash there tells the owner
 * nothing they can act on.
 */
export function parseGridResponse(text: string): GridRead {
  const empty: GridRead = { tiles: [], dropped: [] };

  let data: unknown;
  try {
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    // Models pad. Take the outermost braces and let JSON judge the middle.
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('no object in the answer');
    data = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return { ...empty, error: "The model's answer was not readable JSON. Nothing was catalogued." };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ...empty, error: 'The answer should be one JSON object.' };
  }
  const root = data as Record<string, unknown>;
  if (!Array.isArray(root.tiles)) {
    return { ...empty, error: 'The answer has no "tiles" list.' };
  }

  const tiles: GridTile[] = [];
  const dropped: GridRead['dropped'] = [];
  const usedRefs = new Set<string>();

  (root.tiles as unknown[]).forEach((raw, i) => {
    let ref = `t${i + 1}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      dropped.push({ ref, reason: 'not an object' });
      return;
    }
    const t = raw as Record<string, unknown>;
    if (typeof t.ref === 'string' && t.ref.trim()) ref = t.ref.trim();
    if (usedRefs.has(ref)) ref = `${ref}-${i + 1}`;
    usedRefs.add(ref);

    const kindRaw = typeof t.kind === 'string' ? t.kind.trim().toLowerCase() : '';
    let note: string | undefined;
    let kind: TileKind;
    if ((KINDS as readonly string[]).includes(kindRaw)) {
      kind = kindRaw as TileKind;
    } else {
      // An unknown kind is never read as solo — that is the safe direction.
      kind = 'other';
      note = kindRaw
        ? `kind "${kindRaw.slice(0, 24)}" not understood — treated as other`
        : 'no kind given — treated as other';
    }

    const confidence = typeof t.confidence === 'number' && Number.isFinite(t.confidence)
      ? clamp01(t.confidence)
      : 0.5;

    const garments: GridGarment[] = [];
    if (Array.isArray(t.garments)) {
      if (kind === 'solo') {
        (t.garments as unknown[]).forEach((g, gi) => {
          const gref = `${ref}-g${gi + 1}`;
          if (!g || typeof g !== 'object' || Array.isArray(g)) {
            dropped.push({ ref: gref, reason: 'not an object' });
            return;
          }
          const o = g as Record<string, unknown>;
          const name = typeof o.name === 'string' ? o.name.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
          if (!name) {
            dropped.push({ ref: gref, reason: 'no name — a piece has to be called something' });
            return;
          }
          garments.push({
            ref: gref,
            name,
            category: typeof o.category === 'string' ? o.category.trim().toLowerCase() : '',
            color: typeof o.color === 'string' ? o.color.trim() : undefined,
            colorName: typeof o.colorName === 'string' ? o.colorName.trim().slice(0, 30) : undefined,
            pattern: typeof o.pattern === 'string' ? o.pattern.trim().toLowerCase().slice(0, 30) : undefined,
            material: typeof o.material === 'string' ? o.material.trim().toLowerCase().slice(0, 30) : undefined,
            season: stringList(o.season, 12),
            tags: stringList(o.tags, 24),
            confidence: typeof o.confidence === 'number' && Number.isFinite(o.confidence)
              ? clamp01(o.confidence)
              : 0.5,
            uncertain: stringList(o.uncertain, 24),
            box: readBox(o.box),
          });
        });
      } else if ((t.garments as unknown[]).length > 0) {
        // The prompt forbids this. The guarantee belongs here, not to the prompt.
        dropped.push({ ref, reason: `garments listed on a tile read as ${kind} — left alone, as promised` });
      }
    }

    tiles.push({
      ref,
      kind,
      confidence,
      box: readBox(t.box),
      note,
      garments,
    });
  });

  return { tiles, dropped };
}

/* ---------- from fractions to pixels ---------- */

/**
 * The tile inset: two per cent of the tile's own size, taken OFF each box.
 * Grid tiles touch; a model's tile box often includes a hair of the
 * neighbour's gutter, and a cropped thumb with someone else's sleeve in the
 * corner reads as a mistake even when the detection was right.
 */
const TILE_INSET = 0.02;

/**
 * The garment margin: two per cent of the garment's own size, ADDED around
 * its box. A box drawn tight clips a cuff; the flat-lay crop has always taken
 * the same breath (lib/harvest.ts).
 */
const GARMENT_BLEED = 0.02;

/** margin > 0 gives the box air; margin < 0 shaves it. Clamped to the image. */
function toPixels(box: GridBox, imgW: number, imgH: number, margin: number): PxBox {
  const mx = box.w * margin;
  const my = box.h * margin;
  const x = Math.max(0, Math.round((box.x - mx) * imgW));
  const y = Math.max(0, Math.round((box.y - my) * imgH));
  const right = Math.min(imgW, Math.round((box.x + box.w + mx) * imgW));
  const bottom = Math.min(imgH, Math.round((box.y + box.h + my) * imgH));
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** The tile's crop in the screenshot's pixels, gutters shaved, clamped. */
export function tileCropPixels(box: GridBox, imgW: number, imgH: number): PxBox {
  return toPixels(box, imgW, imgH, -TILE_INSET);
}

/**
 * A garment's crop in the screenshot's pixels. The garment's box is expressed
 * within its tile, so it is composed with the tile's box first, then given a
 * breath of margin and clamped.
 */
export function garmentCropPixels(garment: GridBox, tile: GridBox, imgW: number, imgH: number, margin: number = GARMENT_BLEED): PxBox {
  const composed: GridBox = {
    x: tile.x + garment.x * tile.w,
    y: tile.y + garment.y * tile.h,
    w: garment.w * tile.w,
    h: garment.h * tile.h,
  };
  return toPixels(composed, imgW, imgH, margin);
}

/**
 * A garment's crop in a single photograph's pixels — the gallery import's
 * box, which is already expressed against the whole image. `margin` is the
 * garment bleed by default; pass a wider one (0.12) for the throwaway roomy
 * crop a background lift is read from — a crop drawn tight has no border of
 * background for the pass to learn from.
 */
export function photoCropPixels(
  box: [number, number, number, number],
  imgW: number,
  imgH: number,
  margin: number = GARMENT_BLEED,
): PxBox {
  return toPixels({ x: box[0], y: box[1], w: box[2], h: box[3] }, imgW, imgH, margin);
}

/** A box worth cropping: finite, on the image, and bigger than a postage stamp of noise. */
export function plausibleBox(box: GridBox | undefined): box is GridBox {
  if (!box) return false;
  const { x, y, w, h } = box;
  if (![x, y, w, h].every(Number.isFinite)) return false;
  if (w < 0.02 || h < 0.02) return false;
  if (x < 0 || y < 0 || x > 0.98 || y > 0.98) return false;
  // A small overhang is a rounding habit, not a lie; the clamp handles it.
  return x + w <= 1.06 && y + h <= 1.06;
}

/**
 * The fallback when the model gave a tile no plausible box: even-thirds grid
 * math. Instagram profile grids are three columns of square-ish tiles in
 * reading order, so the nth tile's place is arithmetic, not guesswork. It is
 * a fallback, not a belief — the model's own box always wins.
 */
export function evenThirds(index: number, count: number): GridBox {
  const cols = 3;
  const rows = Math.max(1, Math.ceil(count / cols));
  return {
    x: (index % cols) / cols,
    y: Math.floor(index / cols) / rows,
    w: 1 / cols,
    h: 1 / rows,
  };
}

/* ---------- from tiles to drafts ---------- */

/** One detection, flattened out of its tile and screenshot. */
export interface Detection {
  /** Unique across the whole import: screenshot, tile, garment. */
  ref: string;
  /** 1-based, matching the order the screenshots were chosen. */
  screenshot: number;
  tileRef: string;
  /** The tile's box — the model's, or the even-thirds fallback. */
  tileBox: GridBox;
  /** True when the box came from grid math rather than the model's eye. */
  tileFallback: boolean;
  garment: GridGarment;
}

/**
 * The garments worth reading at all: every garment on every solo tile, each
 * carrying its resolved tile box. Group, scenery, text and other tiles yield
 * nothing — that is the solo rule, enforced a second time here.
 */
export function soloDetections(read: GridRead, screenshot: number): Detection[] {
  const out: Detection[] = [];
  read.tiles.forEach((tile, i) => {
    if (tile.kind !== 'solo') return;
    const hasBox = plausibleBox(tile.box);
    const tileBox = hasBox ? tile.box! : evenThirds(i, read.tiles.length);
    for (const garment of tile.garments) {
      // garment.ref is already qualified by its tile; the screenshot number
      // makes it unique across the whole import.
      out.push({
        ref: `s${screenshot}-${garment.ref}`,
        screenshot,
        tileRef: tile.ref,
        tileBox,
        tileFallback: !hasBox,
        garment,
      });
    }
  });
  return out;
}

/** A detection already in this import, marked rather than added twice. */
export interface FeedDupe {
  ref: string;
  name: string;
  screenshot: number;
  /** The ref of the draft that was kept. */
  keptRef: string;
}

const SEASON_WORDS = new Set(['spring', 'summer', 'fall', 'winter']);
const OCCASION_WORDS = new Set(['casual', 'work', 'formal', 'performance', 'sport', 'party']);

/**
 * Route the model's loose words onto the ledger's vocabularies. Season hints
 * and tags are both sifted for both — a model that tags a piece "winter" has
 * said something true, whichever pocket it said it in. Words the ledger has
 * no home for are dropped; the description keeps the fabric of the sentence.
 */
function routeWords(garment: GridGarment): { season: string[]; occasion: string[] } {
  const season: string[] = [];
  const occasion: string[] = [];
  for (const word of [...garment.season, ...garment.tags]) {
    if (SEASON_WORDS.has(word) && !season.includes(word)) season.push(word);
    else if (OCCASION_WORDS.has(word) && !occasion.includes(word)) occasion.push(word);
  }
  return { season, occasion };
}

/** What the piece looks like, in the model's own gathered words. */
function describe(garment: GridGarment): string {
  const parts = [
    garment.colorName,
    garment.material,
    garment.pattern && garment.pattern !== 'solid' ? garment.pattern : '',
  ].filter(Boolean);
  if (!parts.length) return 'Read from a feed screenshot.';
  const line = parts.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1) + '.';
}

/**
 * Map detections to intake drafts — the same IntakeDraft the flat-lay bench
 * reviews, produced by the same forgiving reader (a free-text category is
 * matched to the owner's taxonomy there, a guessed colour falls back there,
 * and every repair is recorded there).
 *
 * Dedupe: across several screenshots the same piece often appears twice — a
 * grid reposts, a screenshot overlaps the last. The signature is the piece's
 * name and colour; the first arrival is kept, the rest come back marked as
 * dupes instead of double-adding.
 */
export function toDrafts(detections: Detection[]): {
  drafts: IntakeDraft[];
  dupes: FeedDupe[];
  dropped: Array<{ ref: string; reason: string }>;
} {
  const byRef = new Map(detections.map(d => [d.ref, d]));

  // The handoff file these detections would have written, handed to the same
  // reader the paste box uses — an API answer and a hand-written file cannot
  // diverge in how strictly they are checked.
  const pieces = detections.map(d => {
    const { season, occasion } = routeWords(d.garment);
    return {
      ref: d.ref,
      photo: d.screenshot,
      name: d.garment.name,
      category: d.garment.category,
      color: d.garment.color,
      colorName: d.garment.colorName,
      description: describe(d.garment),
      pattern: d.garment.pattern,
      material: d.garment.material,
      season,
      occasion,
      confidence: d.garment.confidence,
      uncertain: d.garment.uncertain,
    };
  });

  const read = readIntake(JSON.stringify({ toileIntake: 1, pieces }));

  const dropped = read.dropped.map(row => ({
    ref: pieces[row.index]?.ref ?? `row ${row.index + 1}`,
    reason: row.reason,
  }));

  const seen = new Map<string, string>();
  const drafts: IntakeDraft[] = [];
  const dupes: FeedDupe[] = [];

  for (const draft of read.drafts) {
    // Where the record came from. It travels with the draft and lands in the
    // piece's notes — a photograph can say what it saw, never how the piece
    // was acquired, and `source` stays the owner's to tell.
    draft.provenance = 'a feed import';
    const detection = byRef.get(draft.ref);
    const signature = `${draft.name.trim().toLowerCase()}|${draft.color.toUpperCase()}`;
    const keptRef = seen.get(signature);
    if (keptRef) {
      dupes.push({
        ref: draft.ref,
        name: draft.name,
        screenshot: detection?.screenshot ?? 1,
        keptRef,
      });
    } else {
      seen.set(signature, draft.ref);
      drafts.push(draft);
    }
  }

  return { drafts, dupes, dropped };
}

/* ---------- from gallery photographs to drafts ---------- */

/** A detection already in this gallery import, marked rather than added twice. */
export interface GalleryDupe {
  ref: string;
  name: string;
  /** 1-based, matching the order the photographs were chosen. */
  photo: number;
  /** The ref of the draft that was kept. */
  keptRef: string;
}

/**
 * Merge the per-photograph reads of a gallery import into one bench.
 *
 * Each photograph was read on its own (buildPhotoPrompt → readIntake), so
 * refs collide across photographs — every file says "p1". They are re-keyed
 * here with the photograph's number, the photograph number travels with each
 * draft (the crop step cuts from that image, and the bench lists skips
 * against it), and every draft is marked with where it came from.
 *
 * Dedupe: across a burst of photographs the same piece often appears twice —
 * the flat lay and the hanger shot of the same shirt. The signature is the
 * piece's name and colour, same as the feed import's; the first arrival is
 * kept, the rest come back marked as dupes instead of double-adding.
 */
export function galleryDrafts(photos: Array<{ n: number; read: IntakeRead }>): {
  drafts: IntakeDraft[];
  dupes: GalleryDupe[];
  skipped: IntakeSkip[];
  dropped: Array<{ index: number; reason: string }>;
} {
  const drafts: IntakeDraft[] = [];
  const dupes: GalleryDupe[] = [];
  const skipped: IntakeSkip[] = [];
  const dropped: Array<{ index: number; reason: string }> = [];
  const seen = new Map<string, string>();

  for (const { n, read } of photos) {
    for (const row of read.dropped) {
      dropped.push({ index: dropped.length, reason: `photo ${n}: ${row.reason}` });
    }
    skipped.push(...read.skipped.map(s => ({ ...s, photo: n })));
    for (const draft of read.drafts) {
      const ref = `g${n}-${draft.ref}`;
      const signature = `${draft.name.trim().toLowerCase()}|${draft.color.toUpperCase()}`;
      const keptRef = seen.get(signature);
      if (keptRef) {
        dupes.push({ ref, name: draft.name, photo: n, keptRef });
        continue;
      }
      seen.set(signature, ref);
      // Where the record came from travels with the draft and lands in the
      // piece's notes — see toDrafts for why this is never `source`.
      drafts.push({ ...draft, ref, photo: n, provenance: 'a gallery import' });
    }
  }

  return { drafts, dupes, skipped, dropped };
}
