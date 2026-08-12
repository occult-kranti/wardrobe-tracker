# 23 — Cataloguing from photographs

The slowest thing about a wardrobe app is the first hour. Toile's answer is not
to make the form shorter but to let a photograph do the typing: lay the clothes
out, photograph them, hand the photograph to a vision model with the prompt
below, and drop the file it returns into **Settings → Catalogue from photos**.

Nothing about this is a network feature. The model runs wherever the user
already has one (a chat window, an API, a local model); Toile only reads the
file. No image ever leaves the device through us, because we never see it.

---

## 1. The prompt

Paste this verbatim, then attach one or more photographs.

> ```
> You are cataloguing a wardrobe from photographs for a personal clothing
> ledger. Return ONLY a JSON object — no prose before or after, no markdown
> fences.
>
> WHAT TO LOOK AT
> Each photograph shows garments laid out (on a bed, floor, or table) or
> hanging (in a closet or on a rail). Identify every distinct garment,
> footwear item, bag, or piece of jewellery you can see well enough to name.
>
> WHAT TO IGNORE
> - Furniture, hangers, walls, floors, plants, phones, cups, and anything that
>   is not a wearable piece.
> - Any garment being worn by a person. If people appear, do not describe
>   them, do not count their clothes, and never mention them in any field.
> - Pieces too occluded, blurred, or dark to name honestly. List them in
>   "skipped" instead of guessing.
>
> ONE ROW PER PIECE
> A folded stack is several pieces only if you can distinguish them; if you
> cannot, record one row and say so in "note". A matched set that is worn as
> one thing (a suit worn as a suit, a saree with its blouse, pyjamas) is ONE
> row. A jacket and trousers that plainly separate are TWO rows.
>
> CATEGORY — use exactly one of these ids:
>   tops         shirts, tees, blouses, knits, kurtas, camisoles
>   bottoms      trousers, jeans, skirts, shorts, leggings
>   dresses      one-pieces: dresses, jumpsuits, gowns, robes, sarees
>   layers       cardigans, hoodies, blazers, waistcoats, overshirts
>   outerwear    coats, parkas, rain shells, heavy jackets
>   shoes        every kind of footwear, including sandals and boots
>   jewellery    earrings, necklaces, rings, bangles, watches
>   accessories  bags, belts, scarves, hats, sunglasses, socks, ties
> Rules that settle the usual arguments: if it is worn over another top and
> could come off indoors, it is layers; if it is for weather, it is outerwear.
> A watch is jewellery. A bag is accessories. When two ids are defensible,
> pick the one the owner would look under, and add the field name to
> "uncertain".
>
> NAME — two to four words, the words a person would actually use: "Blue
> oxford shirt", "Black ankle boots", "Gold hoops". No marketing adjectives,
> no size, no gendered wording (never "women's", "men's", "ladies").
>
> DESCRIPTION — exactly one sentence, factual, under 110 characters. Say what
> it is, its colour, and at most one detail you can genuinely see (weave,
> collar, closure, print). Never guess price, quality, brand, era, or who it
> would suit. Never flatter and never judge.
>
> COLOUR — "color" is a hex you sample from the largest area of the piece;
> "colorName" is the plain word for it ("navy", "oatmeal", "rust").
>
> BRAND — only if a logo or label is legibly readable in the photo. Otherwise
> omit the field. Never infer a brand from the look of a piece.
>
> SEASON and OCCASION are your best guess from the fabric weight and cut.
> season: any of spring, summer, fall, winter.
> occasion: any of casual, work, formal, performance, sport, party.
>
> CONFIDENCE is 0 to 1 for the row as a whole. Put the names of any fields you
> guessed weakly into "uncertain". It is better to be openly unsure than to be
> smoothly wrong: this file is going into someone's permanent record.
>
> BOX is optional. If you can, give [x, y, w, h] as fractions of the image
> (0–1, origin top-left) so the app can crop a thumbnail.
>
> RETURN EXACTLY THIS SHAPE:
> {
>   "toileIntake": 1,
>   "capturedAt": "YYYY-MM-DD",
>   "photos": [{ "n": 1, "note": "clothes laid out on a bed" }],
>   "pieces": [
>     {
>       "ref": "p1",
>       "photo": 1,
>       "name": "Blue oxford shirt",
>       "category": "tops",
>       "description": "Light blue cotton oxford with a button-down collar.",
>       "color": "#A9C3DC",
>       "colorName": "light blue",
>       "pattern": "solid",
>       "material": "cotton",
>       "season": ["spring", "summer", "fall"],
>       "occasion": ["casual", "work"],
>       "confidence": 0.88,
>       "uncertain": ["material"],
>       "box": [0.12, 0.30, 0.26, 0.34]
>     }
>   ],
>   "skipped": [
>     { "photo": 1, "reason": "too occluded to name", "note": "dark fabric under the stack" }
>   ]
> }
>
> "ref" is unique across the file. "pattern", "material", "brand",
> "uncertain", "box" and "skipped" may be omitted when they have nothing to
> say. Every other field is required on every piece.
> ```

## 2. The handoff file

`toileIntake: 1` is the version. The importer accepts a file with any number
of `pieces` and ignores fields it does not know, so a model that adds extra
keys is not an error.

| Field | Required | Notes |
|---|---|---|
| `name` | yes | trimmed to 60 characters |
| `category` | yes | one of the eight ids; anything else lands in `accessories` and is flagged for review |
| `description` | yes | becomes the piece's note |
| `color` | yes | `#RRGGBB`; an unparseable value falls back to the closet's first preset |
| `colorName` | no | kept in the note when the hex is guessed |
| `season` / `occasion` | yes | unknown values dropped; empty means all seasons |
| `confidence` | yes | under 0.6 the row arrives pre-flagged "needs your eye" |
| `uncertain` | no | field names, shown as a hint on the review screen |
| `box` | no | used to crop a thumbnail if the user supplies the original photo |

The importer never writes `wearCount`, `lastWorn`, or `cost` — a piece that
has just been catalogued has no history, and the ledger derives those from
logs. `source` defaults to `new` and is the user's to correct.

## 3. Trying it without a model

The app ships the bench: **Settings → Catalogue from photos** carries a
**Copy the prompt** button and six real photographs, each with the honest file
the prompt returned for it. Open any of them to watch the whole flow without
running anything.

Three of the six hold no clothes: a cupboard of shampoo, a linen closet, and a
street with a heap of fabric forty feet away. They are in the bench on purpose.
A prompt that cannot answer "nothing here" will invent a wardrobe, and the only
convincing way to show that this one doesn't is to let anyone point it at a
cupboard full of soap and watch it decline.

The photographs live in `public/intake-samples/` beside their `.json`, which
are the very files `npm run test:intake` runs its assertions over — the sample
you can open is the fixture the suite checks.

## 4. What the app does with it

1. **Settings → Catalogue from photos** takes the file (or pasted JSON).
2. Every piece arrives as a **draft** on a review screen: name, category,
   colour, and the one-line description, with low-confidence rows and
   uncertain fields marked. Nothing is added until the user says so.
3. Names that already exist in the closet are marked as possible duplicates
   and unticked by default.
4. "Add the ticked pieces" writes them, each with today's date and an empty
   photo — the drawn flat covers it until the user adds one.

The review step is not a formality. A vision model is a fast, confident
stranger who has never seen your clothes before; the record is yours, so the
last word is too.

## 5. Testing the prompt

`scripts/test-intake.mjs` validates handoff files against the importer's own
parser and reports what it would drop. Three real photographs were catalogued
with this prompt while writing it — a flat lay, a pile, and a full closet —
and their outputs live in `scripts/intake-fixtures/`. The suite runs them on
every build.

What the first draft of the prompt got wrong, and what the wording above
fixes:

- It described people's clothes in a room photo. → the ignore rule now names
  worn garments explicitly.
- It split a suit into three rows and merged a folded stack into one. → the
  one-row-per-piece rule now gives both cases a ruling.
- It wrote "women's blouse" and "flattering cut". → the name and description
  rules now forbid gendered wording and any judgement.
- It invented brands from silhouettes. → brand is now legible-label-only.
- It returned markdown fences around the JSON. → the first line now says
  "ONLY a JSON object — no markdown fences".
- It reported confidence 0.95 on pieces half-hidden under others. → the
  confidence rule now names the stakes.
