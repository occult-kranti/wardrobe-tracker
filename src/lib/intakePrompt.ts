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

BOX is optional. If you can, give [x, y, w, h] as fractions of the image
(0–1, origin top-left) so the app can crop a thumbnail.

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
"uncertain", "box" and "skipped" may be omitted when they have nothing to
say. Every other field is required on every piece.`;
