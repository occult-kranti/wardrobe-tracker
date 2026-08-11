# The salon — the third theme

*Added 2026-08-11.*

## What was asked, and what shipped

The owner asked for "a theme colour for women". That cannot ship as framed:
`docs/06-focus-group-requirements.md` rejects outright "any gender question,
gendered section, or gendered art" (§ rejected list), rules that queerness lives
in the defaults rather than in identity-keyed skins (§2.7), and names *pinker* as
a prohibited rendering in as many words (§2.6).

What shipped is the palette the request was reaching for — warmth, depth, a
couture register distinct from the existing ink-and-carmine — **available to
everyone**, as a third theme beside the pattern room and the atelier at night.
It is named for a room, never for a person. No token, settings string, doc line
or commit message references gender.

## Name

`the salon` — the couture term for the room where a collection is shown. The
house vocabulary is now three rooms in one building: **the pattern room** (where
cloth is cut) · **the salon** (where it is shown) · **the atelier at night**.

## The two decisions that carry it

**1. The warmth is hue only.** The ground rotates 37° warm of the pattern room
and holds chroma at **0.019** — statistically identical to the light ground that
already ships under garment photos (0.018). A ground with chroma exerts
simultaneous contrast on everything laid on it, dragging each photograph's hue
toward the complement; a mint ground makes every red garment read hotter and
every white one read pink. The induction budget here is unchanged.

**2. The rose lives in the neutral, never the accent.** Blush raises
approachability and is also the one colour that gets gender-coded on sight. Spent
at chroma 0.019 in the carpet it is an undertone and cannot become a signal. A
palette whose rose is in the accent is a gendered skin; a palette whose rose is
in the neutral is a warm room. This is simultaneously the colour-theory
requirement and the reason the theme does not read as "a pink theme".

**The accent is deliberately weaker than cloth.** Damson at chroma 0.140 against
carmine's 0.198. On a warm ground a carmine-chroma accent starts competing with
red, wine, rust and coral garments for the same perceptual slot. Losing that
contest to an actual red garment is the correct outcome for an interface colour
in a wardrobe app.

In stylist's vocabulary: the ground is a **Soft Autumn** neutral (warm hue,
medium-light value, low chroma — the family prescribed for non-competition), the
accent a **Deep Winter** wine. The shipped light theme is a Light Spring cream
carrying a Bright Winter carmine. The salon is the soft/deep register of the same
house, not a hue rotation of it.

## Measured contrast

Every pair below is measured against the **real computed tokens in a browser**,
not from the spec, by `npm run test:contrast`.

| Pair | Salon | AA 4.5:1 |
|---|---|---|
| `text` on `bg` | 12.56 | pass |
| `text` on `surface` | 14.82 | pass |
| `text` on `mat` | 13.79 | pass |
| `text-2` on `bg` | 6.02 | pass |
| `text-2` on `surface` | 7.10 | pass |
| `text-2` on `sunken` | 5.20 | pass |
| `accent` on `bg` | 5.95 | pass |
| `accent` on `sunken` | 5.14 | pass — tightest |
| `on-accent` on `accent-fill` | 7.60 | pass |
| `chalk` on `danger-fill` | 10.93 | pass |
| `on-ink` on `ink-fill` | 14.82 | pass |

Tightest pair: **5.14:1**, 14% over AA.

## What the measurement caught

Writing the check found a defect in the **shipped dark theme** — the default one.
`accent` `#E85C70` on `sunken` `#2A251C` measured **4.49:1**, missing AA by 0.01.
No one can eyeball that, and no suite was checking it. The accent moved to
`#E96070`, which measures 4.62:1. One hex digit, and the app's default theme now
passes where it had been failing since it shipped.

That is why `scripts/test-contrast.mjs` exists rather than a table in a document:
themes get added by humans with a colour picker, and a table cannot fail a build.

## The theme is device-level

`settings.theme` used to live in `AppSettings`, per wardrobe. With more than one
wardrobe on a device, opening a different closet flipped the whole interface to
another palette mid-session. The theme belongs to the eyes looking at the screen,
so it now lives in its own `toile-theme` key. The old field is still read from
older exports and ignored.
