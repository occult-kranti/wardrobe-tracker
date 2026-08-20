/**
 * THE ONE THING IN THE NATIVE APP THAT LEAVES THE PHONE, ONE PHOTOGRAPH AT
 * A TIME.
 *
 * Everything else here is local by construction: no analytics, no tracking,
 * and a wardrobe only syncs if its owner switched that on. This file is the
 * other exception, and it is an exception the person makes deliberately, one
 * photograph at a time, by pressing a button on a screen that says exactly
 * where the photograph goes.
 *
 * MIRRORED, NOT IMPORTED. The web's src/lib/anthropic.ts is the source of
 * truth for the call and src/lib/intakePrompt.ts for the prompt; neither is
 * imported, because the app never reaches into the web tree (docs/34 §2.8 —
 * only packages/shared crosses). What IS imported is the PARSER:
 * @almari/shared/intake's readIntake, so a photograph read on the phone and
 * a handoff file pasted into the browser meet exactly the same strictness.
 * The prompt below is a verbatim mirror and __tests__/intake-client-prompt
 * fails the moment the two drift by one character.
 *
 * WHAT THE APP DOES NOT HAVE, ON PURPOSE:
 *  - NO KEY. The relay is a Supabase edge function on the owner's project
 *    (supabase/functions/ai-proxy) which holds the provider key server-side
 *    and routes by the model's name. The app POSTs the provider's own request
 *    shape and sends no key, because it does not have one. A key on a phone
 *    is a key in a backup; scripts/check-native-storage.mjs polices the
 *    storage side of that and this file is the other half.
 *  - NO BYOK OVERRIDE, NO LEGACY KEY. The web keeps both (Settings, and keys
 *    saved before the relay existed) and both live in localStorage. Neither
 *    is ported: the moment the app accepts a key it has to store one.
 *  - NO CUTOUT. What comes back is coordinates, not pictures — the web cuts
 *    on-device in lib/cutout.ts, which is canvas work. The single-piece flow
 *    here needs no cutting: the photograph the person chose IS the piece's
 *    photograph, and the model's words fill the form beside it.
 *
 * NOTHING IS EVER WRITTEN BY THIS FILE. It returns a DRAFT. The web's own
 * law, from AddItemModal: "what comes back is words, and it lands in the
 * fields as a DRAFT — every value is still sitting in an input the person can
 * change before anything is written. Nothing is saved by this button."
 */
import { readIntake, type IntakeDraft } from '@almari/shared/intake';

/* ---------- the relay ---------- */

/** supabase/functions/ai-proxy on the owner's project. Mirrors src/lib/anthropic.ts. */
export const RELAY_ENDPOINT =
  'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';

/**
 * Claude Fable 5 by Anthropic — the model the relay asks by default and the
 * name every disclosure line in this app gives. The relay routes by the
 * model's name: a `claude*` model is forwarded to Anthropic, anything else to
 * Kimi by Moonshot AI.
 */
export const RELAY_MODEL = 'claude-fable-5';

/** How the model is NAMED to a person. docs/35: name the model wherever a
    photograph is read. Derived from nothing — this is the copy. */
export const MODEL_LABEL = 'Claude Fable by Anthropic';

/** The relay speaks the provider's own shape — Anthropic Messages for claude*. */
const RELAY_SPEAKS_ANTHROPIC = RELAY_MODEL.startsWith('claude');

const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Generous on purpose, and the web's own number. A reasoning model spends its
 * thinking from the same budget as its answer, so the ceiling has to leave
 * room for both — too low and the thinking eats the whole allowance and the
 * answer arrives empty. Fable 5 always thinks and cannot be told not to.
 */
export const MAX_TOKENS = 16000;

/**
 * THE DISCLOSURE — shown wherever this file is reachable from.
 *
 * docs/35's rule is to name the model wherever a photograph is read, and the
 * web says it in the same breath as the button (AddItemModal, Intake,
 * Furniture). One sentence, no exclamation, no reassurance the app cannot
 * keep: the key really is on the server and the photograph really does make
 * exactly one journey.
 */
export const AI_DISCLOSURE =
  `Reading the photograph is the one step here that uses the network. It goes to ${MODEL_LABEL}, through Almari’s relay — the key is held on the server, never on this device — and comes back as words. Nothing is saved until you press add.`;

/* ---------- the photograph ---------- */

export interface PreparedPhoto {
  /** Base64 WITHOUT the data: prefix, which the Anthropic shape wants. */
  base64: string;
  /** 'image/jpeg' for anything the picker re-encodes; whatever the file is otherwise. */
  mediaType: string;
}

/**
 * The web shrinks to a 1400px edge and re-encodes at JPEG 0.88 before
 * sending (anthropic.ts prepareImage): a provider ignores detail above about
 * 1568px, and a smaller image is a faster answer.
 *
 * ON NATIVE THAT RESIZE IS NOT AVAILABLE IN EXPO GO. There is no canvas, and
 * the module that would do it — expo-image-manipulator — is not among this
 * app's dependencies; adding one is an owner decision, not a porting detail.
 * What the picker CAN do is re-encode at a quality, so the discipline is
 * kept where it can be kept: every read-bound pick asks for JPEG at this
 * quality, and the size ceiling below refuses anything still too large
 * rather than letting the provider answer 400 for us.
 */
export const SEND_QUALITY = 0.7;

/**
 * Five megabytes is the provider's own per-image ceiling. Checked here so a
 * person gets a sentence they can act on instead of a 400 they cannot.
 * base64 carries three bytes in four characters, hence the 3/4.
 */
const MAX_IMAGE_BYTES = 5_000_000;

function tooBig(base64: string): boolean {
  return Math.floor((base64.length * 3) / 4) > MAX_IMAGE_BYTES;
}

/* ---------- what went wrong, said the way a person can act on ---------- */

/**
 * Ports explainProvider from src/lib/anthropic.ts, own=false — the relay is
 * always somebody else's key here, because the app never holds one.
 *
 * The 503 is the one worth reading twice: it means the house has not set the
 * relay's key, or the deploy predates the secret. That is not the person's
 * fault and the copy must not make it sound like it is.
 */
export function explainRelay(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'The relay’s key was refused — that is the house’s to fix, not yours. Nothing was catalogued.';
  }
  if (status === 429) return `${MODEL_LABEL} is rate-limiting. Wait a minute and try again.`;
  if (status === 400 && /credit|billing/i.test(body)) {
    return 'That account has no credit left for the API. Nothing was catalogued.';
  }
  if (status === 400) return 'The provider refused the request. The photograph may be too large.';
  if (status === 503 && /not configured/i.test(body)) {
    return 'The relay has no key yet — whoever runs this house has not set one. Everything else in Almari works without it; type the piece in and it is recorded just the same.';
  }
  if (status >= 500) return `${MODEL_LABEL} is having trouble. Nothing was catalogued; try again shortly.`;
  return `The request failed (${status}). Nothing was catalogued.`;
}

const OFFLINE =
  'Could not reach the relay. Check the connection — everything else in Almari works offline.';

/* ---------- the Anthropic Messages shape ---------- */

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

/** The text of a Messages response — reasoning parts, if any, are left on the floor. */
function anthropicText(json: { content?: AnthropicTextBlock[] }): string {
  return (json.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n')
    .trim();
}

/**
 * One POST to the relay, with NO KEY — the relay holds the provider key
 * server-side and adds it there. Byte-for-byte the web's request body:
 * model, max_tokens, one user message whose content is an image block
 * followed by a text block. No thinking parameter, no temperature, no top_p,
 * no assistant prefill — Fable 5 accepts none of them and answers 400.
 *
 * Returns the model's raw text. Parsing is @almari/shared/intake's job.
 */
export async function readPhotograph(
  image: PreparedPhoto,
  prompt: string,
): Promise<{ text: string; model: string }> {
  if (!image.base64) throw new Error('There was no photograph to read.');
  if (tooBig(image.base64)) {
    throw new Error(
      'That photograph is too large to send. Take it again, or choose one from the library — the app asks the camera for a smaller copy.',
    );
  }
  if (!RELAY_SPEAKS_ANTHROPIC) {
    // Unreachable while RELAY_MODEL is a claude* name, and stated rather than
    // assumed: the day the relay's default changes, this file must change too.
    throw new Error('This build only speaks the Anthropic Messages shape.');
  }

  let res: Response;
  try {
    res = await fetch(RELAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: RELAY_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error(OFFLINE);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(explainRelay(res.status, body));
  }

  let json: { content?: AnthropicTextBlock[] };
  try {
    json = (await res.json()) as { content?: AnthropicTextBlock[] };
  } catch {
    throw new Error('The relay answered with something that was not an answer. Try again shortly.');
  }
  const text = anthropicText(json);
  if (!text) throw new Error('The model returned nothing readable. Try the photograph again.');
  return { text, model: RELAY_MODEL };
}

/* ---------- one photograph, one piece ---------- */

export interface PieceRead {
  /** The row to fill the form with. Never written by this module. */
  draft: IntakeDraft;
  /** How many pieces the model found, so the screen can say it saw more. */
  found: number;
  /** Which model read it, for the line under the form. */
  model: string;
}

/**
 * Read one photograph of one piece.
 *
 * Ports AddItemModal.readThisPhoto: one photograph of one piece should give
 * one row, and if the model finds several, take the most confident and SAY
 * SO rather than picking silently. The caller shows `found` and lets the
 * person correct anything before pressing add.
 *
 * Throws with a sentence a person can act on. Never writes, never returns a
 * ClothingItem — draftToItem exists in @almari/shared/intake for the moment
 * the person actually presses add, and even then the form's own values win,
 * because they are the ones that were on screen.
 */
export async function readPieceFromPhoto(image: PreparedPhoto): Promise<PieceRead> {
  const { text, model } = await readPhotograph(image, INTAKE_PROMPT);
  const read = readIntake(text);
  if (read.error || read.drafts.length === 0) {
    throw new Error(read.error ?? 'Nothing wearable was found in that photograph.');
  }
  const best = [...read.drafts].sort((a, b) => b.confidence - a.confidence)[0];
  return { draft: best, found: read.drafts.length, model };
}

/* ---------- the prompt ---------- */

/**
 * A VERBATIM MIRROR of src/lib/intakePrompt.ts.
 *
 * It is not imported (the app never reaches into the web tree) and it is not
 * paraphrased (the JSON contract the prompt describes is the contract
 * readIntake enforces; a reworded prompt is a different contract wearing the
 * same name). __tests__/intake-client-prompt.test.ts reads the web file off
 * the disk and fails on the first character of drift, line endings
 * normalised, so this copy cannot quietly rot.
 */
export const INTAKE_PROMPT = `You are cataloguing a wardrobe from photographs for a personal clothing
ledger. Return ONLY a JSON object — no prose before or after, no markdown
fences.

WHAT TO LOOK AT
Each photograph shows garments laid out (on a bed, floor, or table) or
hanging (in a closet or on a rail). Identify every distinct garment,
footwear item, bag, or piece of jewellery you can see well enough to name.

WHAT TO IGNORE
- Furniture, hangers, walls, floors, plants, phones, cups, and anything that
  is not a wearable piece.
- Any garment being worn by a person. If people appear, do not describe
  them, do not count their clothes, and never mention them in any field.
- Pieces too occluded, blurred, or dark to name honestly. List them in
  "skipped" instead of guessing.

ONE ROW PER PIECE
A folded stack is several pieces only if you can distinguish them; if you
cannot, record one row and say so in "note". A matched set that is worn as
one thing (a suit worn as a suit, a saree with its blouse, pyjamas) is ONE
row. A jacket and trousers that plainly separate are TWO rows.

CATEGORY — use exactly one of these ids:
  tops         shirts, tees, blouses, knits, kurtas, camisoles
  bottoms      trousers, jeans, skirts, shorts, leggings
  dresses      one-pieces: dresses, jumpsuits, gowns, robes, sarees
  layers       cardigans, hoodies, blazers, waistcoats, overshirts
  outerwear    coats, parkas, rain shells, heavy jackets
  shoes        every kind of footwear, including sandals and boots
  jewellery    earrings, necklaces, rings, bangles, watches
  accessories  bags, belts, scarves, hats, sunglasses, socks, ties
Rules that settle the usual arguments: if it is worn over another top and
could come off indoors, it is layers; if it is for weather, it is outerwear.
A watch is jewellery. A bag is accessories. When two ids are defensible,
pick the one the owner would look under, and add the field name to
"uncertain".

NAME — two to four words, the words a person would actually use: "Blue
oxford shirt", "Black ankle boots", "Gold hoops". No marketing adjectives,
no size, no gendered wording (never "women's", "men's", "ladies").

DESCRIPTION — exactly one sentence, factual, under 110 characters. Say what
it is, its colour, and at most one detail you can genuinely see (weave,
collar, closure, print). Never guess price, quality, brand, era, or who it
would suit. Never flatter and never judge.

COLOUR — "color" is a hex you sample from the largest area of the piece;
"colorName" is the plain word for it ("navy", "oatmeal", "rust").

BRAND — only if a logo or label is legibly readable in the photo. Otherwise
omit the field. Never infer a brand from the look of a piece.

SEASON and OCCASION are your best guess from the fabric weight and cut.
season: any of spring, summer, fall, winter.
occasion: any of casual, work, formal, performance, sport, party.

CONFIDENCE is 0 to 1 for the row as a whole. Put the names of any fields you
guessed weakly into "uncertain". It is better to be openly unsure than to be
smoothly wrong: this file is going into someone's permanent record.

BOX is required on every piece, and it is the field the app depends on most:
it crops the photograph along these coordinates to make the picture that ends
up in the closet, and then lifts that crop off its background. Give
[x, y, w, h] as fractions of the image (0–1, origin top-left, x/y are the
top-left corner of the box).

Draw it TIGHT around the piece — the smallest rectangle that still contains
all of it. A box with a hand's width of bedsheet around the garment produces
a thumbnail that is mostly bedsheet. If a piece is partly hidden, box the
part you can see and add "box" to "uncertain". If you genuinely cannot place
it, put the piece in "skipped" rather than inventing coordinates: a wrong box
crops someone's closet to a picture of a floor.


BACKGROUND is one word describing what the piece is lying on or hanging
against, judged for one purpose: the app cuts the piece out along your box
and then tries to lift it off its background on the device. Tell it whether
that will work.
  plain   an even sheet, wall, floor or seamless studio ground — will lift
  busy    a patterned duvet, a rug, a crowded rail, another garment behind it
  none    already cut out, on white or transparent — nothing to lift
Say "busy" whenever the piece and what it lies on are close in colour, even
if the surface itself is plain. A wrong "plain" costs the owner a sleeve.

RETURN EXACTLY THIS SHAPE:
{
  "toileIntake": 1,
  "capturedAt": "YYYY-MM-DD",
  "photos": [{ "n": 1, "note": "clothes laid out on a bed" }],
  "pieces": [
    {
      "ref": "p1",
      "photo": 1,
      "name": "Blue oxford shirt",
      "category": "tops",
      "description": "Light blue cotton oxford with a button-down collar.",
      "color": "#A9C3DC",
      "colorName": "light blue",
      "pattern": "solid",
      "material": "cotton",
      "season": ["spring", "summer", "fall"],
      "occasion": ["casual", "work"],
      "confidence": 0.88,
      "uncertain": ["material"],
      "background": "plain",
      "box": [0.12, 0.30, 0.26, 0.34]
    }
  ],
  "skipped": [
    { "photo": 1, "reason": "too occluded to name", "note": "dark fabric under the stack" }
  ]
}

"ref" is unique across the file. "pattern", "material", "brand",
"uncertain" and "skipped" may be omitted when they have nothing to say.
Every other field, "box" and "background" included, is required on every
piece.`;
