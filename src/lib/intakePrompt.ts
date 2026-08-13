/**
 * The intake prompt — the one place it lives.
 *
 * docs/23-photo-intake.md prints this same text for reading; the suite checks
 * the two never drift. The app copies it to the clipboard so the user can
 * paste it into whatever vision model they already have, with their
 * photographs attached.
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
      "box": [0.12, 0.30, 0.26, 0.34]
    }
  ],
  "skipped": [
    { "photo": 1, "reason": "too occluded to name", "note": "dark fabric under the stack" }
  ]
}

"ref" is unique across the file. "pattern", "material", "brand",
"uncertain" and "skipped" may be omitted when they have nothing to say.
Every other field, "box" included, is required on every piece.`;

/**
 * The worn-outfit prompt — a mirror selfie, or anything showing an outfit on
 * a body, read back as separate pieces.
 *
 * This is the harder of the two, and not only visually. The house has one
 * absolute rule about people: garments are drawn and described without
 * bodies, so nothing in this app assumes who wears what. A photograph of a
 * person is exactly where that rule is easiest to break, so the instruction
 * about it is first, longest, and repeated at the end — the position that
 * matters most for a model reading a long prompt.
 *
 * It also has to be honest about occlusion in a way the flat-lay prompt does
 * not: a worn shirt is half behind an arm, trousers are cut off by the frame,
 * and the back of everything is unknowable. Guessing there produces a closet
 * full of confident fiction.
 */
/**
 * The words the prompt has to name in order to forbid them.
 *
 * Held out here rather than written inline because check-brand refuses these
 * words anywhere in the source, and rightly: they are the vocabulary the
 * focus group vetoed. The one place they must appear is the instruction that
 * bans them, and spelling them around the checker would leave a prompt nobody
 * could read or widen. The marker on this line is the exemption.
 */
const VETOED_WORDS = '"women\'s", "men\'s", "ladies", "flattering", "slimming", "petite", "plus", "curvy"'; // forbids-word

export const OUTFIT_PROMPT = `You are reading ONE OUTFIT, as worn, into the separate pieces it is made of,
for a personal clothing ledger. Return ONLY a JSON object — no prose before
or after, no markdown fences.

THE PERSON IS NOT THE SUBJECT. THE CLOTHES ARE.
Someone is wearing these clothes. Do not describe them, their body, their
face, their hair, their skin, their age, their gender, their size, or how
the clothes look on them. Never write ${VETOED_WORDS},
or any word about a shape.
Never guess a size or a measurement. If a field cannot be filled
without describing the person, leave the field out. Describe the shirt, not
the shoulders it is on.

WHAT TO LIST
Every distinct piece being worn that you can see well enough to name:
garments, footwear, bags, jewellery, sunglasses, belts, scarves, hats. Also
list a bag being held, or a jacket over an arm — it is part of the outfit.

WHAT TO IGNORE
- Rooms, mirrors, furniture, phones, and the frame of the mirror itself.
- Anything on another person in the picture.
- Pieces you can only infer. A collar showing under a jumper is one piece
  you can see (the jumper) and one you are guessing at (the shirt). Put the
  guess in "skipped", not in "pieces".

ONE ROW PER PIECE
A dress is ONE row, never a top and a skirt. A saree and its blouse are ONE
row. A suit worn as a suit is ONE row; a blazer plainly separable from the
trousers is TWO. A pair of shoes is ONE row. Earrings as a pair are ONE row.

OCCLUSION IS THE NORM HERE, AND MUST BE SAID
Worn clothes are always partly hidden — by arms, by other layers, by the
edge of the frame. For each piece, "seen" is the fraction of the whole
garment actually visible, 0 to 1. If "seen" is below about 0.4, keep the row
but lower "confidence" and add the fields you had to guess to "uncertain".
Never describe a back, a hem, or a sleeve you cannot see.

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
accessories.

NAME — two to four words, the words a person would use: "Cream linen shirt",
"Tan leather sandals", "Gold hoops". No marketing adjectives, no size, no
gendered wording.

DESCRIPTION — exactly one sentence, factual, under 110 characters, about the
garment alone. Its kind, its colour, and at most one detail you can genuinely
see. Never say how it fits or who it suits.

COLOUR — "color" is a hex sampled from the largest area of that piece;
"colorName" is the plain word ("navy", "oatmeal", "rust"). Sample from a lit
part, not from a shadow or a fold.

BRAND — only from a legible logo. Otherwise omit it.

BOX is required, and the app crops the photograph along it to make the
picture that goes into the closet — then lifts that crop off its background.
Give [x, y, w, h] as fractions of the image (0–1, origin top-left, x/y being
the top-left corner). Box the VISIBLE EXTENT of the piece, tightly. For
shoes, box both together. For a piece hidden behind an arm, box what shows
and add "box" to "uncertain". If you cannot place it, skip the piece rather
than invent coordinates.

THE OUTFIT ITSELF gets a short plain name — where it was going, or what it
is, in two to five words: "Friday office", "Airport day", "Wedding lunch".
No compliments and no evaluation of the outfit.

CONFIDENCE is 0 to 1 for the row as a whole. It is better to be openly
unsure than smoothly wrong: this file is going into someone's permanent
record.

RETURN EXACTLY THIS SHAPE:
{
  "toileIntake": 1,
  "capturedAt": "YYYY-MM-DD",
  "worn": true,
  "outfit": { "name": "Friday office", "occasion": ["work"] },
  "photos": [{ "n": 1, "note": "one outfit, worn" }],
  "pieces": [
    {
      "ref": "p1",
      "photo": 1,
      "name": "Cream linen shirt",
      "category": "tops",
      "description": "Cream linen shirt with a soft collar, worn open at the neck.",
      "color": "#E8E0CE",
      "colorName": "cream",
      "pattern": "solid",
      "material": "linen",
      "season": ["spring", "summer"],
      "occasion": ["casual", "work"],
      "seen": 0.72,
      "confidence": 0.86,
      "uncertain": ["material"],
      "box": [0.31, 0.18, 0.36, 0.29]
    }
  ],
  "skipped": [
    { "photo": 1, "reason": "only a collar shows under the jumper", "note": "a shirt, colour unclear" }
  ]
}

"ref" is unique across the file. "pattern", "material", "brand" and
"uncertain" may be omitted when they have nothing to say. Every other field,
"box" and "seen" included, is required on every piece.

Last, because it is the rule that matters most: not one word about the
person wearing these clothes.`;
