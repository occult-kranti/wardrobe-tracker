# The gilding room — the fourth theme, and the bold one

*Added 2026-08-11, at the owner's direction: "be bold and try out stuff — colour
combinations… take inspirations from artists, shades and themes of light pink and
golden or such, elegant and beautiful."*

## The reference

**Klimt's gold period** — the gold ground of the *Portrait of Adele Bloch-Bauer*
and *The Kiss*, where ornament in gold leaf carries the whole surface and the
rose tones sit inside it. And, closer to these wardrobes, **zari** — the gold
thread of Banarasi silk and wedding lehengas, where gold is not an accent on the
cloth but the structure of it. Both say the same thing: gold works when it is the
*surface*, not a highlight.

## What the request asked for, and how it ships

The owner asked for light pink and gold. The focus-group contract has two
standing rules that shape how that lands (`docs/06`): §2.7 — no identity-keyed
skins — and §2.6 — the accent never carries a blush. The salon already
established the pattern: the register the request is reaching for, shipped as a
room, available to everyone, named for a workshop.

So: **the gilding room** — where gold leaf is laid. The boldest room in the
building, and bold in the two places boldness does not cost the product:

1. **The ground is rose silk, and it is genuinely rose.** Chroma 0.028 — half
   again the salon's 0.019, immediately felt as colour rather than as warm
   white. The user's complaint was "simple black, white, warm white"; this
   ground is none of those.
2. **The hairlines are gold.** `--color-border: #D3A47F` at chroma 0.075 is the
   most chromatic border in the house — every plate edge, every basting stitch,
   every rule draws in gold — and the pattern-paper crosses are drawn in the
   leaf itself (`--pattern-ink: 162,117,31` at 10%, double the light room's 6%).
   In the other rooms the ornament is ink on paper; here it is gold on silk,
   which is the Klimt move.
3. **The photographs are protected.** The mat under garment photos holds chroma
   0.022, quieter than the room around it, so the boldness *surrounds* the
   clothes rather than tinting them — same physics as every other room
   (docs/13's simultaneous-contrast budget).
4. **The accent is still washing blue**, restated for this ground (`#0E566E`).
   docs/14: a brand colour that changes per theme is not a brand colour. Blue
   against rose-gold is also simply correct — it is the counterpoint colour in
   the gold-period portraits themselves.
5. **The wax keeps its token.** `--color-seal: #BE1231` measures 4.82:1 on the
   silk.

No token, settings string, doc line or commit message references gender. The
room joins the same vocabulary as the other three: pattern room (cut), salon
(shown), gilding room (finished), atelier at night (closed).

## The measured palette

Verified in a browser against computed tokens by `test:contrast` — 18 pairs,
all passing their floors:

| pair | ratio | floor |
|---|---|---|
| text `#33201C` / bg `#F3DCD4` | 11.73 | 4.5 |
| text-2 `#6E453C` / bg | 6.20 | 4.5 |
| text-2 / sunken `#E9C8BC` | **5.22** | 4.5 |
| accent `#0E566E` / bg | 6.21 | 4.5 |
| accent / sunken | **5.22** | 4.5 |
| accent / mat `#F6E9E1` | 6.86 | 4.5 |
| on-accent `#FFF8F2` / accent fill | 7.75 | 4.5 |
| chalk / danger-fill `#701A1E` | 10.76 | 4.5 |
| on-ink / ink-fill | 13.52 | 4.5 |
| chalk / seal `#BE1231` | 6.01 | 4.5 |
| accent-on-ink `#7CBEDC` / ink | 7.52 | 3 (1.4.11) |
| seal / bg | 4.82 | 3 (1.4.11) |

Tightest pair: 5.22:1, 16% over AA. The gold border measures 1.70:1 against the
ground — the *strongest* border presence in the house (the pattern room's is
1.35) while staying decorative, which is the §2 rule for gold: never text, never
a labeled fill.

## In the same pass: the closets became lived-in

All 174 sample pieces read "Ready" with every other bench chip at 0 — a
showroom, not a wardrobe. Bench states are now derived from the same wear log as
everything else (deterministic, like every fixture choice): pieces worn in the
last days queue for the wash, a few are in the machine, the hardest-worked
pieces need repair, and exactly one structured garment is at the tailor —
because "at the tailor" is an errand, and four open errands read as staged.
Jewellery never queues for the wash. `test:demo` now asserts every state is
inhabited, clean stays the strong majority, and nothing unworn queues for
laundry.

`PERSONA_SEED_VERSION` was introduced alongside: sample wardrobes stamped with
an older seed number are rebuilt at boot, so a fix to the seed reaches browsers
that installed the samples last week — previously it only reached people who had
never opened the app. Real wardrobes are never touched.

## Addendum, same day: the ground art and the mountings

The owner asked the room to go further: borders styled after traditional gold
Japanese work, and the rose ground paired with a deeper colour below it
carrying closet linework.

**The Japanese references, joining Klimt.** The *byōbu* folding screen — gold
ground with stylised *kasumi* mist bands, where the gold and the clouds ARE the
picture space — and the *kakemono* hanging scroll, whose mounting frames the
work twice: an inner brocade border inside an outer mount.

**What ships:**

1. **The ground carries its artwork.** Below the rose silk, a deeper band
   (`--color-bg-deep`) rises from the page bottom, and standing in it, drawn in
   gold line at 20–38%, an armoire with one door open — rail, hanging garments,
   drawers — with kasumi bands drifting through. Fixed to the viewport
   bottom-right, so the room appears to stand behind the paper and the content
   scrolls past it. Hand-coded SVG in the stylesheet, no raster. The photo grid
   still sits on flat mats; §6.1's rule that ornament never sits behind the
   clothes is untouched — the artwork surrounds them.
2. **Every plate takes the kakemono mounting.** The card's own gold hairline,
   then a second, fainter gold rule floated 3px outside it — the double frame
   of a scroll mounting, on outfit cards, stat plates, and modals alike. The
   masthead's thin second rule is drawn in the leaf. Gold stays a frame colour
   throughout, never text — §2's rule for gold, kept.
3. **`--color-bg-deep` joins the token sheet in every room** (the all-rooms
   check requires it), and because captions scroll across the band, the
   contrast suite gates `text/bg-deep` and `text-2/bg-deep` in all four rooms —
   which immediately caught the first band hex at 4.45:1, 0.05 under AA. It
   ships at `#E4BAAB`, 4.62:1. Twenty gated pairs per room now; eighty in all.
