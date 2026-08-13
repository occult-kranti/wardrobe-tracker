# TOILE — Brand Identity & Design Contract

> **Toile** */twahl/ — n.* An early garment prototype sewn in plain cloth; the tailor's
> working record of what a piece really is.
>
> **Tagline:** *Your wardrobe, on record.*
>
> This document is the binding design contract for the app. It was produced by a
> three-concept competition (Toile / Loden / Snip) judged by a consumer-psychologist,
> a principal designer, and a staff engineer-illustrator; Toile won 2 of 3 verdicts and
> the strongest usability + feasibility + cohesion scores. The losing concepts' best
> elements are grafted in below and are **load-bearing, not optional**.

---

## 1. Positioning & voice

**The house tailor, not the tech startup.** Almari is a private ledger for a real
wardrobe — quantified-self meets craft. It is the anti-Acloset: no account, no feed,
no paywall ambush, no device lock-in. The record is yours; one-tap export is the
brand's proof gesture.

Voice: measured, exact, discreetly warm. Knowledgeable captions, dry wit, **no
exclamation points**. Plain functional language in daily utility surfaces and all
destructive/settings flows; the atelier metaphor is concentrated at onboarding and
reward moments only (anti-twee rule).

**Reward copy** (grafted from Snip, tuned dry): verb-first, two beats, at
confirmation moments only — "Logged. Worn 14 times." / "Noted. That's four navy
tees now." Never shame: "Welcome back," never "You missed 3 days."

---

## 2. Palette — light ("the pattern room")

Every text pair verified WCAG AA by an independent judge pass.

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#F4EFE2` | Pattern-cutting paper. Page ground. |
| `--color-surface` | `#FBF8F0` | Muslin. Cards **and the tile behind every clothing photo**. |
| `--color-sunken` | `#EAE1CC` | Manila tag. Table stripes, wells, inactive chips. |
| `--color-text` | `#201D18` | Iron-gall ink (14.6:1 on bg). |
| `--color-text-2` | `#5C554A` | Faded ink. Captions, metadata (6.5:1 on bg). |
| `--color-border` | `#D8CFBA` | Chalk hairline. |
| `--color-accent` | `#105F7D` | Washing blue. **The interface accent** — amended 2026-08-11, see below. |
| `--color-accent-hover` | `#0D4F68` | The blue pressed harder. |
| `--color-accent-on-ink` | `#7CBEDC` | The accent stated on the ink FILL, not on paper. |
| `--color-seal` | `#BE1231` | Sealing-wax carmine. The mark: seal, wordmark rule, favicon, recap card. |
| `--color-success` | `#2E6B4F` | Bottle green. Money-not-spent, confirmations. |
| `--color-warning` | `#7D5813` | Chalk ochre — darkened from concept's `#8A6116`, which measured 4.25:1 on manila; this hex passes 4.5:1 everywhere. |
| `--color-danger` | `#771324` | Oxblood. Graver than the house red. |
| `--color-gold` | `#C9A227` | Basting thread. **Decorative only** — never text, never fills with labels. |
| `--color-charcoal` | `#3A362E` | Pressing iron. Secondary dark fills, chart ink. |
| `--color-chalk` | `#FFFDF6` | Tailor's chalk. Labels on dark fills, monogram T. |

## 3. Palette — dark ("the atelier at night")

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#17140F` | Ink cloth. |
| `--color-surface` | `#201C15` | Pressed wool. |
| `--color-sunken` | `#2A251C` | Sunken wells. |
| `--color-mat` | `#2B2A22` | **Photo mat** (grafted from Loden): lifted tile behind clothing photos so black/navy garments keep their edges. Light mode maps this to `surface`. |
| `--color-text` | `#EFE9D9` | Chalk. |
| `--color-text-2` | `#A89F8D` | Dusty chalk. |
| `--color-border` | `#383226` | Seam shadow. |
| `--color-accent` (text/icons) | `#6FB6D6` | Washing blue lifted for ink cloth (8.17:1 on bg). |
| `--color-accent-hover` | `#8CC6E0` | |
| `--color-accent-fill` | `#105F7D` | Button fills, chalk label at 6.98:1. Light mode maps this to `accent`. |
| `--color-seal` | `#CE1837` | The wax stated for a dark ground; carmine itself measures 2.90:1 here. |
| `--color-success` | `#58A97F` | |
| `--color-warning` | `#D9A93F` | |
| `--color-danger` | `#F297A4` | Danger text. Fills use `#8C1B32` + chalk label. |
| `--color-gold` | `#D9B44A` | Decorative only. |

**Rule of scarcity:** one accent element per view region. The eye trusts a page
that highlights almost nothing. **Exactly one primary button per view** (written
law, grafted from Loden).

> **Amended 2026-08-11** by a three-judge pass, 2 of 3 (`docs/14-the-brand-colour.md`).
> **The brand colour splits in two.** `--color-seal` is sealing-wax carmine
> `#BE1231` — the hex `docs/06` §4 names, unchanged, on exactly four surfaces:
> the wax seal, the wordmark underline, the favicon, and the recap card.
> `--color-accent` becomes **washing blue** and carries the whole interface.
>
> The house had been spending a wax colour on seven things that are not wax, and
> it cost three measured defects. Carmine's chroma is 0.198 — and so is the most
> saturated garment in the seeds, *because it is this same hex*: a silk scarf and
> a set of glass bangles ship in the brand colour, so the interface was not
> louder than cloth, it was indistinguishable from it. Accent and danger sat 2.6°
> apart in hue, which simulates to **0.2–0.3°** in all three dichromacies — "log
> a wear" and "delete forever" were one colour to every dichromat. And §6.5 had
> already barred red from every chart, closing a whole surface class to the brand.
>
> Washing blue holds 157–171° of hue opposition to danger under every deficiency,
> and at chroma 0.085 it loses to real cloth, which this contract requires and
> carmine never did. In the pattern room exactly one object is red, and it is the
> wax: a 2px nav rule is not wax, an eyelet is a brass grommet, a focus ring is
> not wax.
>
> This is the only verdict on the ballot that overrides nothing. §4 of the
> focus-group document names `#BE1231` by hex; that hex still ships, at that
> chroma, on the proof-gesture surfaces. Full dissent — including the argument
> that blue was never given the cultural test that disqualified saffron, and the
> single measurement that would reverse the ruling — is recorded in `docs/14`.

## 4. Typography

> **Amended 2026-08-11** by the focus-group panel (`docs/06-focus-group-requirements.md`):
> display face changed from Bodoni Moda to **Fraunces**. The panel asked for ink-trap
> warmth ("Fraunces territory; not Playfair") and the engineering judge independently
> flagged that didone hairlines degrade at 1× and below 22px. Fraunces keeps the
> editorial voice while surviving small sizes and low-DPI screens.

| Face | Source | Use |
|---|---|---|
| **Fraunces** (var., `opsz`/`SOFT`/`WONK`) | Google Fonts | Display. Wordmark + mastheads (700), H1–H2 (600), *Italic 400* for editorial labels ("Cost per wear"). Hero numerals 600. **Never below 20px** except the wordmark. |
| **Switzer** 400/500/600 | Fontshare | UI/body. Body 15px/1.6. Buttons + nav: 13px 600 ALL CAPS tracked +0.08em (garment-tag typesetting; 13px floor grafted from Loden — 12px was below the legibility floor). |
| **IBM Plex Mono** 400/500 | Google Fonts | The ledger voice: tables, prices, dates, specimen numbers, tag chips. 11–13px caps tracked +0.06em. **Never above 15px.** 11px is for non-interactive metadata only. |

Scale (px): 64 · 40 · 28 · 22 · 17 · 15 · 13 · 11.

## 5. Iconography — "technical flats"

Drawn the way a pattern-drafter draws a garment. Grid 24×24, 20×20 live area,
coordinates snapped to the 0.5 half-grid. Stroke **1.5px `currentColor`, butt caps,
miter joins**. Outer corners dead sharp; interior garment curves radius ≤2. Curves
are reserved for cloth; structure stays rectilinear.

**The pattern notch (fingerprint):** every icon carries exactly one 2px 45° tick
crossing a principal stroke in the **north-east quadrant**. Never omitted, never
duplicated.

States: muted = basting dash (`stroke-dasharray 2 2`); active = ink fill with
interior details redrawn in surface color. Never emoji. Never accent-tinted —
except the single "log wear" action, which may fill with the accent.

## 6. Art direction (all hand-coded SVG/CSS, zero rasters)

1. **Pattern-paper ground:** 24×24 tiled data-URI, one 3px `+` cross per tile,
   0.75px stroke, ink at 6% (dark: chalk at 5%). Sparse seam arcs (1px,
   dasharray 6 4, ink 3%) on empty/marketing surfaces only.
   **NEVER any ornament behind the photo grid** — closet tiles sit on flat muslin.
2. **Empty-state plates:** 1.5px ink contour drawings (~200×160), one accent
   detail each, caption in Bodoni Italic. No items → wire hanger + measuring tape.
   No outfits → dress form with chalk marks. No log → open ledger + garment tag.
   Empty wishlist → suitcase with string tags.
3. **Logo:** wordmark TOILE, Bodoni 700 caps tracked +0.18em, over a hand-wavered
   2-segment chalk underline in `--color-seal`. Monogram: a vertical garment tag
   (clipped top corners, 6px eyelet, S-curve string) bearing a Bodoni "T".
   Favicon: eyelet + T on the seal colour. **Amended 2026-08-12** (judge pass):
   the favicon is now the hanger-only cut of the tag mark — eyelet kept as the
   hook's eye, the T replaced by the flat hanger — chalk on the seal colour.
4. **Wax seal:** flat `--color-seal` circle, chalk T, rotated **−3°** (hand-pressed
   graft), used on the exported recap card and seal-press confirmations.
   `src/components/art.tsx` contains no hex at all — it paints in tokens — so
   these two names are load-bearing: drawn in `--color-accent` they would have
   turned blue with the interface, silently, with nothing in the build to say so.
5. **Charts as art:** hairline axes, ink bars, basting-dash projection lines,
   display numerals, on muslin plates in double-rule frames.

   > **Amended 2026-08-11** by the focus-group panel
   > (`docs/06-focus-group-requirements.md` §2.6). The carmine hero bar is
   > **withdrawn**. §2.6 reads "Stats are neutral territory… **every category gets
   > identical visual weight** — dresses are never rendered softer, rounder, or
   > pinker," and colouring exactly one bar is that operation regardless of what
   > selects it; in dark mode the accent resolves to a chalk red, so the singled-out
   > row rendered literally pinker. Bars are `--color-text` throughout, in every
   > chart. The focal point is carried by a **basting-dash leader line and a mono
   > callout** — the projection-line clause of this same section, which had never
   > been built. §2.6 post-dates this contract and the stricter reading wins.
   >
   > This resolves the conflict recorded as finding 10 in `docs/09-design-critique.md`.

**Signature motifs** (used consistently, nowhere else in the market):
tag-shaped chips with a left eyelet · basting-stitch dividers (1px dash 4 3 with
bar-tack ends) · the double rule (2px + 0.5px, 3px apart) under mastheads ·
chalk registration crosses at card corners on hover · the pattern notch as
selected-tab marker · the eyelet as bullet, calendar wear-dot (filled with the accent
when worn), and chip punch-hole.

## 7. Component law

- **Geometry:** radius 2 globally (only eyelets/seals are circles). **No drop
  shadows** — depth via hairlines, manila layering, and a 1px-offset plate edge.
  8px spacing grid.
- **Buttons:** 44px tall (compact narrows padding only, never the hit area —
  the 44px accessibility floor outranks the original 40px figure), radius 2,
  13px Switzer 600 caps. Primary =
  ink fill/cream label (dark: chalk fill/ink label); hover slides a 2px rule in
  under the label, drawn in `--color-accent-on-ink` — the accent stated against
  that FILL, since the fill is ink in the light rooms and chalk in the dark one
  and no single hex is legible on both. **Hero action only** ("LOG TODAY'S WEAR")
  = accent fill. Secondary = 1px ink border, hover gains corner crosses
  (`.registered`). Tertiary = accent underlined text. Destructive = oxblood.
- **Inputs:** ledger style — no boxes; 1px bottom rule, label above in 11px mono
  caps; focus thickens rule to 2px accent. Search is the one boxed input,
  tag-shaped with eyelet.
- **Garment cards:** borderless muslin/mat tiles, 4:5, nothing competes with the
  photo. Below: name 13px Switzer 500 + **specimen caption** (grafted from Loden)
  in Plex Mono: `№ 041 · ZARA · 14 WEARS`. Hover: 1px ink border + corner crosses.
  No scale transforms.
- **Nav:** desktop 220px rail, active = 2px accent left rule + filled icon.
  Mobile = 56px bottom tag-bar, 5 slots, active icon gets an accent eyelet dot.
- **Mastheads:** Bodoni 28–40px over a double rule; date/count in mono at right.
- **Modals:** centered paper sheet ≤480px, 1px ink border + plate edge, Bodoni
  22px title over double rule, ink backdrop at 40%.
- **Motion:** 140–200ms ease-out fades only. Signature exceptions: dashes/strings
  draw in via `stroke-dashoffset` (300ms); numerals tick up (400ms); and the
  **seal-press** (grafted from Loden, the one sanctioned bounce): logging a wear
  presses in at scale 1.15→0.96→1, 180ms. No parallax, no shimmer — loading states
  are basting-dash outlines. `prefers-reduced-motion` collapses everything to
  opacity.
- **Onboarding/coach marks:** dotted leader lines (dasharray `0.1 4`, round caps,
  3px ring terminus) + mono labels — tailor's annotations on pattern paper.

## 8. Psychology directives (binding)

1. **Log today's wear in ≤2 taps**, from a thumb-zone hero action that never
   requires scrolling. Suggestions ≤6. Closet browsing is the fallback, never the
   default path.
2. **No streak chrome at all** (amended by panel): no badges, streaks, confetti, or
   progress-as-achievement. Only cumulative, unloseable, factual totals ("312 wears
   recorded"), stated like a bank balance. No guilt notifications — no notifications.
3. **Variable reward = insight, not slot machine:** after each log, one honest,
   dismissible payoff card (cost-per-wear fell / first wear in 94 days / most-worn
   this month).
4. **Cold start:** value at item #1 (specimen framing + endowed progress), ghost
   cards showing the filled state, exactly one CTA on empty screens.
5. **Before You Buy is a savvy friend, never a parent:** show what you own, wears,
   cost-per-wear; never guilt scores, never red warnings, never shame copy.
6. **No social graph.** Sharing is an opt-in printed artifact (sealed recap card).
7. **ADHD floor:** one task per screen in flows, forgiving inputs, undo over
   confirm where safe, consistent nav, zero visual noise on the logging path.

## 9. Known risks (engineering QA list)

- Bodoni hairlines below 22px or on 1× displays → enforce the floor in tokens.
- 1.5px butt/miter strokes blur at non-integer DPR → QA icons at 1×, 1.5×, 2×.
- Pattern notch may read as artifact below 20px → keep icons ≥20px rendered.
- Ornament creep: motifs accumulate → photo-grid purity rule wins every conflict.
- Twee fatigue → metaphor budget: onboarding + rewards only.

---

*Contract ratified 2026-08-11. Amended the same day by a documented judge pass:
the display face (Fraunces), the streak ban, the carmine hero bar's withdrawal,
and the brand-colour split. Amend only with a documented judge pass.*
