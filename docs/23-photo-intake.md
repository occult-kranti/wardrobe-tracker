# 23 — Cataloguing from photographs

The slowest thing about a wardrobe app is the first hour. Toile's answer is not
to make the form shorter but to let a photograph do the typing: lay the clothes
out, photograph them, hand the photograph to a vision model with the prompt
below, and drop the file it returns into **Settings → Catalogue from photos**.

There are two prompts, because there are two photographs worth taking: a
**flat lay** of many pieces at once, and **one outfit as worn** — a mirror
shot. The second is the faster road into a closet, and the harder prompt to
write, because the house rule about people is absolute.

Two ways to use either one. On the bench, the photograph itself goes to Kimi
K3 by Moonshot AI, through the house's relay, which holds the key on the
server so no device ever has one; the model answers with words and
coordinates, and the cropping, the background removal and the writing all
happen on the device. Or copy the prompt into whatever model you already have
and bring the file back, which touches no network at all. The relay keeps
nothing — it is a pass-through, and the record stays on the device.

---

## 1. The flat-lay prompt

For clothes laid out or hanging. Paste it verbatim, then attach one or
more photographs.

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
> BOX is required on every piece, and it is the field the app depends on most:
> it crops the photograph along these coordinates to make the picture that ends
> up in the closet, and then lifts that crop off its background. Give
> [x, y, w, h] as fractions of the image (0–1, origin top-left, x/y are the
> top-left corner of the box).
>
> Draw it TIGHT around the piece — the smallest rectangle that still contains
> all of it. A box with a hand's width of bedsheet around the garment produces
> a thumbnail that is mostly bedsheet. If a piece is partly hidden, box the
> part you can see and add "box" to "uncertain". If you genuinely cannot place
> it, put the piece in "skipped" rather than inventing coordinates: a wrong box
> crops someone's closet to a picture of a floor.
>
>
> BACKGROUND is one word describing what the piece is lying on or hanging
> against, judged for one purpose: the app cuts the piece out along your box
> and then tries to lift it off its background on the device. Tell it whether
> that will work.
>   plain   an even sheet, wall, floor or seamless studio ground — will lift
>   busy    a patterned duvet, a rug, a crowded rail, another garment behind it
>   none    already cut out, on white or transparent — nothing to lift
> Say "busy" whenever the piece and what it lies on are close in colour, even
> if the surface itself is plain. A wrong "plain" costs the owner a sleeve.
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
>       "background": "plain",
>       "box": [0.12, 0.30, 0.26, 0.34]
>     }
>   ],
>   "skipped": [
>     { "photo": 1, "reason": "too occluded to name", "note": "dark fabric under the stack" }
>   ]
> }
>
> "ref" is unique across the file. "pattern", "material", "brand",
> "uncertain" and "skipped" may be omitted when they have nothing to say.
> Every other field, "box" and "background" included, is required on every
> piece.
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

---

## 1b. The worn-outfit prompt

For a mirror shot, or anything showing one outfit on a body. It returns the
same shape, plus an `outfit` name and a `seen` fraction per piece, because
worn clothes are always partly hidden. Its first and last instruction is the
same one: describe the garment, never the person wearing it.

> ```
> You are reading ONE OUTFIT, as worn, into the separate pieces it is made of,
> for a personal clothing ledger. Return ONLY a JSON object — no prose before
> or after, no markdown fences.
>
> THE PERSON IS NOT THE SUBJECT. THE CLOTHES ARE.
> Someone is wearing these clothes. Do not describe them, their body, their
> face, their hair, their skin, their age, their gender, their size, or how
> the clothes look on them. Never write "women\,
> or any word about a shape.
> Never guess a size or a measurement. If a field cannot be filled
> without describing the person, leave the field out. Describe the shirt, not
> the shoulders it is on.
>
> WHAT TO LIST
> Every distinct piece being worn that you can see well enough to name:
> garments, footwear, bags, jewellery, sunglasses, belts, scarves, hats. Also
> list a bag being held, or a jacket over an arm — it is part of the outfit.
>
> WHAT TO IGNORE
> - Rooms, mirrors, furniture, phones, and the frame of the mirror itself.
> - Anything on another person in the picture.
> - Pieces you can only infer. A collar showing under a jumper is one piece
>   you can see (the jumper) and one you are guessing at (the shirt). Put the
>   guess in "skipped", not in "pieces".
>
> ONE ROW PER PIECE
> A dress is ONE row, never a top and a skirt. A saree and its blouse are ONE
> row. A suit worn as a suit is ONE row; a blazer plainly separable from the
> trousers is TWO. A pair of shoes is ONE row. Earrings as a pair are ONE row.
>
> OCCLUSION IS THE NORM HERE, AND MUST BE SAID
> Worn clothes are always partly hidden — by arms, by other layers, by the
> edge of the frame. For each piece, "seen" is the fraction of the whole
> garment actually visible, 0 to 1. If "seen" is below about 0.4, keep the row
> but lower "confidence" and add the fields you had to guess to "uncertain".
> Never describe a back, a hem, or a sleeve you cannot see.
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
> If it is worn over another top and could come off indoors, it is layers; if
> it is for weather, it is outerwear. A watch is jewellery. A bag is
> accessories.
>
> NAME — two to four words, the words a person would use: "Cream linen shirt",
> "Tan leather sandals", "Gold hoops". No marketing adjectives, no size, no
> gendered wording.
>
> DESCRIPTION — exactly one sentence, factual, under 110 characters, about the
> garment alone. Its kind, its colour, and at most one detail you can genuinely
> see. Never say how it fits or who it suits.
>
> COLOUR — "color" is a hex sampled from the largest area of that piece;
> "colorName" is the plain word ("navy", "oatmeal", "rust"). Sample from a lit
> part, not from a shadow or a fold.
>
> BRAND — only from a legible logo. Otherwise omit it.
>
> BOX is required, and the app crops the photograph along it to make the
> picture that goes into the closet — then lifts that crop off its background.
> Give [x, y, w, h] as fractions of the image (0–1, origin top-left, x/y being
> the top-left corner). Box the VISIBLE EXTENT of the piece, tightly. For
> shoes, box both together. For a piece hidden behind an arm, box what shows
> and add "box" to "uncertain". If you cannot place it, skip the piece rather
> than invent coordinates.
>
> BACKGROUND is one word describing what the piece is lying on or hanging
> against, judged for one purpose: the app cuts the piece out along your box
> and then tries to lift it off its background on the device. Tell it whether
> that will work.
>   plain   an even sheet, wall, floor or seamless studio ground — will lift
>   busy    a patterned duvet, a rug, a crowded rail, another garment behind it
>   none    already cut out, on white or transparent — nothing to lift
> Say "busy" whenever the piece and what it lies on are close in colour, even
> if the surface itself is plain. A wrong "plain" costs the owner a sleeve.
> A worn photograph is almost always "busy": there is a room behind the person,
> and the garments touch each other. Say so.
>
> THE OUTFIT ITSELF gets a short plain name — where it was going, or what it
> is, in two to five words: "Friday office", "Airport day", "Wedding lunch".
> No compliments and no evaluation of the outfit.
>
> CONFIDENCE is 0 to 1 for the row as a whole. It is better to be openly
> unsure than smoothly wrong: this file is going into someone's permanent
> record.
>
> RETURN EXACTLY THIS SHAPE:
> {
>   "toileIntake": 1,
>   "capturedAt": "YYYY-MM-DD",
>   "worn": true,
>   "outfit": { "name": "Friday office", "occasion": ["work"] },
>   "photos": [{ "n": 1, "note": "one outfit, worn" }],
>   "pieces": [
>     {
>       "ref": "p1",
>       "photo": 1,
>       "name": "Cream linen shirt",
>       "category": "tops",
>       "description": "Cream linen shirt with a soft collar, worn open at the neck.",
>       "color": "#E8E0CE",
>       "colorName": "cream",
>       "pattern": "solid",
>       "material": "linen",
>       "season": ["spring", "summer"],
>       "occasion": ["casual", "work"],
>       "seen": 0.72,
>       "confidence": 0.86,
>       "uncertain": ["material"],
>       "background": "busy",
>       "box": [0.31, 0.18, 0.36, 0.29]
>     }
>   ],
>   "skipped": [
>     { "photo": 1, "reason": "only a collar shows under the jumper", "note": "a shirt, colour unclear" }
>   ]
> }
>
> "ref" is unique across the file. "pattern", "material", "brand" and
> "uncertain" may be omitted when they have nothing to say. Every other field,
> "box", "seen" and "background" included, is required on every piece.
>
> Last, because it is the rule that matters most: not one word about the
> person wearing these clothes.
> ```

---

## 2b. The feed-grid prompt

A flat lay is a photograph taken on purpose. A feed screenshot is one you
already have: a profile grid holds a dozen posts at once, and some of them
are outfits. The flow lives at **Settings → Catalogue from photos → From a
feed screenshot**, and at the closet's own "From a feed" link: one to nine
screenshots, one journey out per screenshot, and every piece lands on the
same review bench as a draft. Nothing is written until the owner says so.

The prompt below is what is sent. Its discipline is the old one's — JSON
only, doubts stated, boxes the app can crop along — with one rule ahead of
all the others: **a tile showing two or more people is left alone.** Group
photos are classified, listed on the bench as "Left alone — a group photo",
and never read for garments. A collage of several photographs stitched into
one tile is not a solo post either: "solo" is the only kind that is read,
and it must be earned. The rule is enforced twice — the prompt asks, and the
parser guarantees it: a non-solo tile keeps no garments, whatever the answer
claims.

What comes back per tile is a kind and a box; per garment, a second box
within the tile. The app crops on the device: the tile box gets a 2% inset
(grid tiles touch, and a hair of the neighbour's gutter in a thumbnail reads
as a mistake), the garment box gets a 2% breath of margin (a box drawn tight
clips a cuff), and the crop is downscaled to a 520px JPEG, which becomes the
draft's photo. A tile the model could not box falls back to even-thirds grid
math, and says so on the bench.

Season hints and tags route onto the ledger's own vocabularies; words it has
no home for are dropped. The same piece appearing in two screenshots is
marked as a dupe rather than added twice — the signature is its name and
colour. Every piece carries "From a feed import." in its notes; how the
garment was actually acquired stays the owner's to tell, as always.

The network sentence on the card is the photograph bench's own: the
screenshots go to Claude by Anthropic, through Almari's relay, which holds
the key on the server, only when the button is pressed. Group photos are
left alone, and nothing is written until you say so.

> ```
> You are reading a SCREENSHOT of an Instagram profile grid — many posts
> at once — for a personal clothing ledger. Return ONLY a JSON object, no
> prose before or after, no markdown fences.
>
> THE GRID
> Find every post tile in the grid. For each one give "box": {"x", "y", "w",
> "h"} as fractions of the WHOLE screenshot (0 to 1, origin top-left, x and y
> the top-left corner of the tile). Profile headers, buttons, captions and
> icons around the grid are not tiles. If the grid is scrolled and a tile is
> partly cut off, box the part you can see.
>
> THE ONE RULE ABOUT PEOPLE
> A tile showing ONE person is read for its clothes. A tile showing TWO OR
> MORE people is left alone entirely: classify it "group", give it an empty
> garments list, and never describe anyone in it. Whatever the tile, describe
> the clothes and never the person — no word about a body, a face, an age, a
> size, or who a garment would suit.
>
> KIND — classify every tile as exactly one of:
>   solo     one person's outfit in ONE photograph, or one photograph of
>            garments with no person at all (a flat lay, a hanger shot, a
>            product photo)
>   group    two or more people — left alone, always
>   scenery  a place, a meal, a pet, a view — no clothes as the subject
>   text     a graphic of words
>   other    anything else, including a collage of several photographs
>            stitched into one tile
> "confidence" is 0 to 1 for the classification. A tile you cannot classify
> with any confidence is "other". A tile stitching two or more photographs
> together is a collage: classify it "other", never "solo". When you hesitate
> between "solo" and anything else, choose the other kind — "solo" is the only
> kind that is read for garments, and it must be earned.
>
> GARMENTS — only on "solo" tiles. Every other kind carries an empty list.
> For each garment visible well enough to name:
>   name       two to four plain words: "Blue oxford shirt", "Gold hoops". No
>              marketing adjectives, no size, no gendered wording.
>   category   one plain word — tops, bottoms, dresses, layers, outerwear,
>              shoes, jewellery, accessories. The ledger's own categories are
>              the owner's; this word is matched to them later.
>   color      a hex sampled from the largest area of the piece, "#RRGGBB"
>   colorName  the plain word for it ("navy", "oatmeal", "rust")
>   pattern    one word ("solid", "striped", "floral") — omit if unclear
>   material   your best read of the fabric — omit if you cannot tell
>   season     any of spring, summer, fall, winter, from fabric weight and cut
>   tags       occasion and style words: casual, work, formal, sport, party
>   confidence 0 to 1 for the garment as a whole
>   uncertain  the names of any fields you guessed weakly
>   box        {"x", "y", "w", "h"} of the garment WITHIN ITS TILE (0 to 1,
>              origin at the tile's own top-left). Tight around the piece. If
>              you cannot place it, omit the box rather than inventing one.
>
> It is better to be openly unsure than smoothly wrong: this file is going
> into someone's permanent record.
>
> RETURN EXACTLY THIS SHAPE:
> {
>   "feedGrid": 1,
>   "tiles": [
>     {
>       "ref": "t1",
>       "kind": "solo",
>       "confidence": 0.9,
>       "box": { "x": 0.0, "y": 0.25, "w": 0.333, "h": 0.22 },
>       "garments": [
>         {
>           "ref": "g1",
>           "name": "Blue oxford shirt",
>           "category": "tops",
>           "color": "#RRGGBB",
>           "colorName": "light blue",
>           "pattern": "solid",
>           "material": "cotton",
>           "season": ["spring", "summer"],
>           "tags": ["casual", "work"],
>           "confidence": 0.85,
>           "uncertain": ["material"],
>           "box": { "x": 0.15, "y": 0.1, "w": 0.7, "h": 0.55 }
>         }
>       ]
>     },
>     {
>       "ref": "t2",
>       "kind": "group",
>       "confidence": 0.95,
>       "box": { "x": 0.333, "y": 0.25, "w": 0.333, "h": 0.22 },
>       "garments": []
>     }
>   ]
> }
>
> "ref" is unique within the answer. Tiles are in reading order, left to
> right, top to bottom. "pattern", "material" and "uncertain" may be omitted
> when they have nothing to say. Every other field is required on every tile
> and every garment.
> ```

Trying it on a real screenshot, with the owner's key in the environment and
never written down:

```sh
KIMI_KEY=... node scripts/test-feed-intake.mjs --live <screenshot.png>
```

With no screenshot given, `--live` builds a synthetic 2×2 grid from the
wardrobe photo pool — three solo tiles, and one photograph of three people,
the group the solo rule exists to leave alone — and runs the whole pipeline
against the real API, verifying the crops as JPEGs. The pure half of the
suite (parser, crop math, the solo rule, drafts, dedupe) needs no key at
all: `npm run test:feedintake`.

---

## 2c. The gallery prompt

For the owner's own photographs, chosen many at a time — flat lays, hanger
shots, one outfit as worn. One photograph per call; the answer is the same
handoff file, so the reader is the same reader. A photograph of two or more
people gets an empty answer, by rule.

> ```
> You are reading ONE photograph for a personal clothing ledger — clothes
> laid out or hanging, or one person's outfit as worn. Return ONLY a JSON
> object, no prose before or after, no markdown fences.
>
> THE ONE RULE ABOUT PEOPLE
> The clothes are the subject, never a person. Whatever the photograph shows,
> describe the clothes and never the person — no word about a body, a face,
> hair, an age, a size, or who a garment would suit. What one person happens
> to be wearing is read like any other clothes: the shirt, not the shoulders
> it is on. If the photograph shows TWO OR MORE people, return an empty
> "pieces" list and say so in "skipped".
>
> WHAT TO LOOK AT
> Identify every distinct garment, footwear item, bag, or piece of jewellery
> you can see well enough to name — laid out, hanging, or worn. Furniture,
> hangers, walls, floors, mirrors, phones and rooms are not pieces. Pieces too
> occluded, blurred or dark to name honestly go in "skipped", never guessed
> at.
>
> ONE ROW PER PIECE
> A folded stack is several pieces only if you can distinguish them; if you
> cannot, record one row and say so. A matched set worn as one thing (a suit
> worn as a suit, a saree with its blouse) is ONE row; pieces that plainly
> separate are TWO. A dress is ONE row, never a top and a skirt. A pair of
> shoes is ONE row.
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
> If it is worn over another top and could come off indoors, it is layers; if
> it is for weather, it is outerwear. A watch is jewellery. A bag is
> accessories. When two ids are defensible, pick the one the owner would look
> under, and add the field name to "uncertain".
>
> NAME — two to four plain words, the words a person would actually use:
> "Blue oxford shirt", "Black ankle boots", "Gold hoops". No marketing
> adjectives, no size, no gendered wording.
>
> DESCRIPTION — exactly one sentence, factual, under 110 characters. Say what
> it is, its colour, and at most one detail you can genuinely see (weave,
> collar, closure, print). Never guess price, quality, brand or era. Never
> flatter and never judge.
>
> COLOUR — "color" is a hex sampled from the largest area of the piece,
> "#RRGGBB"; "colorName" is the plain word for it ("navy", "oatmeal", "rust").
>
> SEASON — any of spring, summer, fall, winter, from fabric weight and cut.
> OCCASION — any of casual, work, formal, performance, sport, party.
>
> CONFIDENCE is 0 to 1 for the row as a whole. Put the names of any fields you
> guessed weakly into "uncertain". It is better to be openly unsure than
> smoothly wrong: this file is going into someone's permanent record.
>
> BOX is required on every piece, and it is the field the app depends on most:
> it crops the photograph along these coordinates to make the picture that ends
> up in the closet. Give [x, y, w, h] as fractions of the image (0 to 1, origin
> top-left, x and y the top-left corner of the box). Draw it TIGHT around the
> piece — the smallest rectangle that still contains all of it. A worn piece:
> box what shows. If you genuinely cannot place a piece, put it in "skipped"
> rather than inventing coordinates: a wrong box crops someone's closet to a
> picture of a floor.
>
> BACKGROUND is one word describing what the piece is lying on or hanging
> against, judged for one purpose: whether the piece could be lifted off its
> background on the device. Tell it plainly.
>   plain   an even sheet, wall, floor or seamless studio ground — would lift
>   busy    a patterned duvet, a rug, a crowded rail, another garment behind
>           it or touching it, or a room behind a worn outfit
>   none    already cut out, on white or transparent — nothing to lift
> Say "busy" whenever the piece and what it lies on are close in colour, or the
> piece is touching another garment. A worn outfit is almost always "busy":
> there is a room behind it and the garments touch each other.
>
> RETURN EXACTLY THIS SHAPE:
> {
>   "toileIntake": 1,
>   "photos": [{ "n": 1, "note": "clothes laid out on a bed" }],
>   "pieces": [
>     {
>       "ref": "p1",
>       "photo": 1,
>       "name": "Blue oxford shirt",
>       "category": "tops",
>       "description": "Light blue cotton oxford with a button-down collar.",
>       "color": "#RRGGBB",
>       "colorName": "light blue",
>       "pattern": "solid",
>       "material": "cotton",
>       "season": ["spring", "summer"],
>       "occasion": ["casual", "work"],
>       "confidence": 0.88,
>       "uncertain": ["material"],
>       "background": "plain",
>       "box": [0.12, 0.3, 0.26, 0.34]
>     }
>   ],
>   "skipped": [
>     { "photo": 1, "reason": "too occluded to name", "note": "under the stack" }
>   ]
> }
>
> "ref" is unique within the answer. "pattern", "material", "uncertain" and
> "skipped" may be omitted when they have nothing to say. Every other field,
> "box" and "background" included, is required on every piece.
> ```

Running it against the real files, with the Kimi key in the environment and
never written down:

```sh
KIMI_KEY=... node scripts/test-gallery-intake.mjs --live
```

It reads every photograph in `test_images/`, writes the crops (and, as evidence,
the lifts where the model called the ground plain) to a temp dir, and prints the
table.
The pure half — prompt, merge, dedupe, crop math, the lift's guard rails —
needs no key at all: `npm run test:galleryintake`.
