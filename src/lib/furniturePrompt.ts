import { FORM_MAX_SLOTS, FURNITURE_FORMS, MAX_FURNITURE_NAME, MAX_SLOT_LABEL, type FurnitureForm } from '@almari/shared/types';

/**
 * READING A PIECE OF FURNITURE OUT OF A PHOTOGRAPH.
 *
 * Drawing a place by hand is four taps and takes ten seconds, so this exists
 * for one reason only: an almirah's inside is not obvious from outside, and
 * telling the app "hanging on the left, three shelves and a locker on the
 * right, drawer underneath" is exactly the sentence a photograph already
 * contains. Point the camera at the open doors.
 *
 * Everything the other two prompts learned applies here:
 *   · JSON only, because prose has to be parsed out and prose is where models
 *     wander.
 *   · Never describe a person. This one has its own reason — a wardrobe
 *     photographed in a bedroom often has someone in the mirror on its door.
 *   · Say so when the answer is "that is not furniture", rather than inventing
 *     a chest of drawers out of a bookcase.
 *   · Nothing is written until the person says yes. The read produces a
 *     DRAWING to look at, and the drawing is what they approve.
 */

/** The wording the prompt vetoes, named once so the prompt can quote it. */
const VETOED_WORDS = '"women\'s", "men\'s", "ladies"'; // scrubs-gendered forbids-word

const FORM_LINES = [
  '  rail            a rod and what hangs on it; sections along its length',
  '  chest           drawers, one above another',
  '  shelves         an open case of shelves, nothing hanging',
  '  almirah         a tall PRESSED-STEEL wardrobe, usually two doors, often',
  '                  with a mirror; inside it is divided — hanging on one side,',
  '                  shelves and a small lockable compartment on the other,',
  '                  sometimes a drawer under everything',
  '  almirah-carved  the same divided interior in an OLD WOODEN case: panelled',
  '                  doors, a cornice or pediment, turned or bracket feet',
  '  box             a lidded box of shallow trays — jewellery, watches',
  '  hooks           a batten of pegs: bags, belts, scarves',
  '  stand           a post that bangles or bracelets stack on',
  '  rack            leaning tiers for shoes',
].join('\n');

/**
 * The almirah's compartments are not interchangeable, so the count is not a
 * free number: it says how much of a fixed interior is present. Spelling that
 * out in the prompt is what stops a model answering "6" for a wardrobe with
 * one rail and one shelf in it.
 */
const ALMIRAH_LADDER = [
  '  1  a hanging side only',
  '  2  a hanging side and shelves',
  '  3  a hanging side, a locker, and shelves',
  '  4  a hanging side, a locker, shelves, and a drawer',
  '  5  as 4, with the shelves counted as two (upper and lower)',
  '  6  as 4, with the shelves counted as three (upper, middle, lower)',
].join('\n');

const MAX_LINES = FURNITURE_FORMS.map(f => `  ${f.padEnd(15)} at most ${FORM_MAX_SLOTS[f]}`).join('\n');

export const FURNITURE_PROMPT = `You are reading ONE piece of furniture out of a photograph, for a personal
wardrobe app that draws it and lets its owner file clothes into it. Return
ONLY a JSON object — no prose before or after, no markdown fences.

WHAT TO LOOK AT
The photograph shows a wardrobe, almirah, chest, rail, shelf unit, box,
rack, stand, or row of pegs — usually open, so its inside is visible. Read
the ONE piece that fills most of the frame. If several are visible, read
the nearest and largest, and say so in "note".

WHAT TO IGNORE
- The clothes in it. You are reading the FURNITURE, not its contents. Never
  list, count, name or describe a garment.
- Any person, including a reflection in a mirror on the door. Do not
  describe them, do not mention them, do not let them into any field.
- The room, the walls, the floor and anything standing beside the piece.

IF IT IS NOT FURNITURE
Set "isFurniture" to false, put one plain sentence in "note" saying what you
see instead, and leave every other field out. Do not guess a chest of
drawers from a bookcase, a fridge, or a door.

FORM — use exactly one of these ids:
${FORM_LINES}
An almirah is the commonest wardrobe in South Asia. What distinguishes it
from "shelves" or "chest" is that ONE case holds BOTH a hanging section and
shelves. If you can see a hanging rail and shelves inside the same case,
it is an almirah — steel or carved — and not anything else.

SLOTS — an integer: how many compartments the owner would file into.
For chest, shelves, box and rack, count what you can actually see: drawers,
shelves, trays, tiers. Count from the TOP DOWN — the first label you return
must be the topmost compartment, not the bottom one. For rail and hooks,
count sections or pegs left to right.
For almirah and almirah-carved the compartments are fixed and the number
says how much of the interior is there:
${ALMIRAH_LADDER}
Never exceed the maximum for the form you chose:
${MAX_LINES}
If you count more than the maximum, return the maximum and say what you
actually counted in "note".

LABELS — one short name per slot, in the same order, top to bottom or left
to right. Under ${MAX_SLOT_LABEL} characters each. Plain words for what is
there: "Top drawer", "Shirts", "The locker". No two labels the same. Never
name a garment you can see inside.

NAME — a short name for the whole piece, under ${MAX_FURNITURE_NAME}
characters, of the kind someone would say out loud: "Steel almirah",
"Bedroom chest", "The hall rail". Never gendered wording (never
${VETOED_WORDS}), never a brand you cannot read, never a judgement about the
furniture, the room, or whoever owns it.

CONFIDENCE — "high", "fair" or "low", for how sure you are of FORM and
SLOTS together. Low is a fine answer and a useful one.

RETURN EXACTLY THIS SHAPE
{
  "isFurniture": true,
  "form": "almirah",
  "slots": 4,
  "labels": ["The hanging side", "Locker", "Shelves", "The drawer"],
  "name": "Steel almirah",
  "confidence": "high",
  "note": ""
}`;

export interface FurnitureRead {
  isFurniture: boolean;
  form: FurnitureForm;
  slots: number;
  labels: string[];
  name: string;
  confidence: 'high' | 'fair' | 'low';
  note: string;
  /**
   * Everything that had to be corrected on the way in, in the app's own voice.
   * Shown to the person before anything is written, because a read that had to
   * be repaired four times is a read worth looking at twice.
   */
  repairs: string[];
}

/** Words the app will not carry, whoever wrote them. */
const ABOUT_A_BODY = /\b(flatter(?:ing|s)?|slim(?:ming)?|petite|plus[- ]size|curvy|ladies|wom[ae]n'?s|m[ae]n'?s)\b/gi; // scrubs-gendered forbids-word

function clean(value: unknown, limit: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(ABOUT_A_BODY, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Read the model's answer, and never trust it.
 *
 * Same contract as the garment parser: it repairs rather than rejects, and it
 * REPORTS every repair. A model that returns nine labels for a four-drawer
 * chest has told us something about how carefully it looked, and the person
 * about to accept the drawing should get to know that.
 */
export function readFurniture(raw: string): FurnitureRead {
  const repairs: string[] = [];
  let parsed: Record<string, unknown> = {};

  // Models fence JSON in markdown about a third of the time however plainly
  // they are asked not to. Take the first {...} and move on.
  const body = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {
      isFurniture: false, form: 'chest', slots: 1, labels: [], name: '',
      confidence: 'low', note: '',
      repairs: ['that answer did not come back as something this could read'],
    };
  }

  const note = clean(parsed.note, 240);
  if (parsed.isFurniture === false) {
    return {
      isFurniture: false, form: 'chest', slots: 1, labels: [], name: '',
      confidence: 'low', note, repairs,
    };
  }

  let form = parsed.form as FurnitureForm;
  if (!FURNITURE_FORMS.includes(form)) {
    repairs.push(`it named a kind of furniture this cannot draw — set to a chest, which holds anything`);
    form = 'chest';
  }

  const ceiling = FORM_MAX_SLOTS[form];
  let slots = Math.round(Number(parsed.slots));
  if (!Number.isFinite(slots) || slots < 1) {
    repairs.push('it gave no usable number of compartments — set to one');
    slots = 1;
  } else if (slots > ceiling) {
    repairs.push(`it counted ${slots}, which is more than this drawing holds — set to ${ceiling}`);
    slots = ceiling;
  }

  const given = Array.isArray(parsed.labels) ? parsed.labels : [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const entry of given) {
    const label = clean(entry, MAX_SLOT_LABEL);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  if (given.length !== labels.length) {
    repairs.push('some compartment names came back empty or repeated — those were dropped');
  }
  if (labels.length > slots) {
    labels.length = slots;
    repairs.push('it named more compartments than it counted — the extra names were dropped');
  }
  if (labels.length < slots) {
    repairs.push('it named fewer compartments than it counted — the rest keep their usual names');
  }

  const name = clean(parsed.name, MAX_FURNITURE_NAME);
  const confidence =
    parsed.confidence === 'high' || parsed.confidence === 'fair' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'low';

  return { isFurniture: true, form, slots, labels, name, confidence, note, repairs };
}
