# The brand colour — the split of 2026-08-11

*A documented judge pass, as `docs/05-brand-identity.md` requires for any amendment.*

## The ruling in one line

**Sealing-wax carmine `#BE1231` keeps the mark. Washing blue `#105F7D` takes the interface.**

Carmine now paints exactly four surfaces — the wax seal, the wordmark underline, the favicon,
and the exported recap card — through a new token, `--color-seal`. Everything the *interface*
does with colour, the nav's active rule, the chip eyelet, the calendar wear dot, the focus ring,
links, the hero fill, moves to washing blue through `--color-accent*`.

Panel: three independent judges — a consumer psychologist, a principal product designer, and a
staff engineer-illustrator holding the accessibility seat. Each ruled without sight of the others.
**Two of three ruled SPLIT.** The dissent is recorded in full below, because it is a good argument
and the next person to open this file should read it before reopening the question.

## Why the incumbent had to move

Five defects were alleged. Four survived independent recomputation; one turned out to be
understated, and its correction is the strongest single fact in this document.

**1. The interface was indistinguishable from cloth.** The brief and the contract both require the
UI accent to lose to a photograph of a garment. The original finding was that carmine at chroma
0.198 is 36% more chromatic than the most saturated garment in the demo. That figure was wrong,
because it counted only one of the two seed files. Measured across all **131 distinct garment
colours** in both seeds, the most chromatic garment is **0.198 — and it is `#BE1231` itself**.
A Silk Square Scarf and a Glass Bangle Set ship in the brand colour; the hex appears ten times
across the seeds. The interface did not merely out-shout cloth. It *was* cloth.

**2. Accent and danger were the same colour to a dichromat.** Carmine sits 2.6° from oxblood
`#771324` in hue. Simulated (Brettel 1997), that gap is **0.2–0.3° in all three dichromacies**:
"log a wear" and "delete forever" were one colour separated by lightness alone. Under deuteranopia
carmine also collapses toward the success token — ΔE 0.073 at 1.21:1, which puts the primary
action and the confirmation of that action on top of each other. §8.7's ADHD floor exists to
prevent exactly this. Washing blue holds **157–171° of hue opposition to danger** through all
three deficiencies.

**3. Red had already been evicted from an entire surface class.** The §6.5 amendment ("stats are
neutral territory") removed the accent from every chart in the app. A brand colour permanently
barred from the analytics surfaces is a brand colour doing half a job.

**4. Carmine is chroma-identical to a markdown ticket.** Selfridges' sale red measures L 0.489 /
C 0.198 / H 26.0; carmine is 0.512 / 0.198 / 20.8. In a house whose contract refuses every
commerce surface.

**5. And the lane could not be repaired from inside.** Desaturating carmine at constant lightness
gives `#AB484C`, a dusty rose — §2.6's *named* prohibition. Darkening gives `#7F1F29`, the
restrained oxblood the focus group explicitly rejected. At hue 20° the AA-legal chroma ceiling is
0.226, so carmine already sits at 88% of the wall.

## Why washing blue, and why it is not a tech-startup blue

Laundry blue is the ultramarine cube that stops white linen reading yellow — the one historic
pigment whose whole job is correcting the colour of cloth. It belongs to the same building as
pattern paper, manila, chalk and basting thread. The decisive material argument came from the
design seat: **in the pattern room exactly one object is red, and it is the wax.** A 2px nav rule
is not wax. A punched eyelet is a brass grommet. A focus ring is not wax. The house had been
spending a wax colour on seven things that are not wax, and the split is a material rule, not a
committee compromise — the house already ships one such rule in `--color-gold`, decorative-only,
never text.

At chroma 0.085 washing blue is **less chromatic than 13 of the 131 garment colours** in the
seeds. It cannot out-shout a photograph. That is the property carmine never had.

## What the evidence did NOT support

Two findings were struck by two judges independently, and are recorded here so nobody
re-imports them:

- **Zhou et al. (2025) on low saturation and perceived luxury.** Peer-reviewed, and irrelevant:
  its dependent variables are perceived luxury and willingness to pay. Toile is free, local-first
  and contractually refuses every commerce surface. There is no WTP to move. Citing it here would
  be the same category error the proposal charges against carmine.
- **"62–90% of judgement is colour."** Folklore. Singh (2006) is a literature review about first
  impressions, mutated by blog reposts. Not cited.
- **Elliot & Maier's red-avoidance effect** was de-weighted to nothing: it is an *achievement*-
  context finding, and §8.2 removed achievement from this product.

## The dissent, in full

The consumer psychologist ruled **SHIP MADDER** (`#91362E`, C 0.125) and rejected SPLIT explicitly.
Three arguments worth keeping:

1. **The cue argument.** The focus-group panel contained a recovering impulse buyer and a
   haul-culture dopamine dresser. For them a high-chroma red is the stimulus that trained the
   behaviour they came here to stop — and in this app it has no purchase moment to do work in, so
   it just fires, on the logging path, daily. That argues for leaving carmine's *chroma*. It does
   not by itself argue for leaving red.
2. **Blue was never given the cultural test that disqualified saffron.** The proposal ruled out a
   marigold accent because saffron-white-green reconstructs the Indian tricolour against a cream
   ground and a bottle-green success token — then never ran the same test on blue. In Indian
   visual culture *nīl* is Krishna, indigo dyeing, Ambedkarite blue, and Ujala bluing: the
   whitening aisle, in a house that bans body-verdict vocabulary. Silence is not achieved by
   choosing the hemisphere you did not audit.
3. **A measured collision the majority did not weigh.** Washing blue's weakest pair is
   accent-versus-success under **tritanopia**: ΔE 0.040, 1.12:1. That is worse than carmine's
   worst pair. The engineering seat ruled for blue anyway on prevalence — deuteranopia runs ~6% of
   males, tritan-line deficiency ~0.01–0.2% — and stated the measurement that would flip the
   verdict: **if tritan prevalence in this user base ever exceeds deutan prevalence, the
   arithmetic inverts and the ruling should be revisited.**

Madder was not adopted. It fails on its own numbers: madder-versus-danger collapses to under 4° of
hue in all three dichromacies, and madder-versus-success under deuteranopia measures ΔE 0.044 —
*worse* than the incumbent's 0.073. It fixes the chroma defect and deepens the one the ADHD floor
is about.

## `docs/06-focus-group-requirements.md` §4 is honoured, not overridden

This is most of why SPLIT won, and it is a procedural point rather than an aesthetic one.

§4 resolves the tension "restrained oxblood vs give me acid" by naming `#BE1231` **by hex** as the
house's one genuinely saturated statement. That document is binding. SPLIT still ships that hex,
at that chroma, on the seal, the favicon, the wordmark and the recap card — the *proof gesture*
surfaces, which is where a saturated statement was always meant to live. Nothing is overridden;
the accent simply becomes scarcer, which §3's rule of scarcity asks for in as many words.

Full replacement would have required overriding a named hex in a binding document. Madder would
have required overriding it *and* landing on §2.6's "never softer". SPLIT was the only verdict on
the ballot that needed no override at all.

**The honest cost of SPLIT**, stated by the judge who voted for it: the house now ships two
saturated colours, and §2 says "the single saturated color". The defence is that they are never
peers — one is an interface and one is a mark, they are separated by role rather than by region,
and only one of them is ever adjacent to a photograph. The place to watch is Today's card, which
carries a carmine seal about 60px from a blue UNDO. Reviewed on a real screenshot at 1440 and 390;
it reads as hierarchy (seal = a record made, blue = a thing to do) rather than as a flag.

## The measured palette

Every figure below was computed twice, independently, and then verified in a browser against the
real computed tokens by `scripts/test-contrast.mjs`.

| room | token | hex | bg | sunken | surface | mat |
|---|---|---|---|---|---|---|
| pattern room | `--color-accent` / `-fill` | `#105F7D` | 6.19 | 5.46 | 6.70 | 6.70 |
| | `--color-accent-hover` | `#0D4F68` | 7.83 | 6.91 | 8.47 | 8.47 |
| | `--color-accent-on-ink` | `#7CBEDC` | — | — | — | 8.20 on ink |
| | `--color-seal` | `#BE1231` | 5.51 | | 5.96 | chalk T 6.21 |
| atelier at night | `--color-accent` | `#6FB6D6` | 8.17 | 6.77 | 7.54 | **6.41** |
| | `--color-accent-hover` | `#8CC6E0` | 9.86 | 8.17 | 9.10 | 7.73 |
| | `--color-accent-fill` | `#105F7D` | chalk label 6.98 | | | |
| | `--color-seal` | `#CE1837` | 3.33 | | 3.08 | chalk T 4.55 |
| the salon | `--color-accent` / `-fill` | `#0F5570` | 6.08 | 5.26 | 7.18 | 6.68 |
| | `--color-accent-hover` | `#0B4257` | 8.05 | 6.96 | 9.49 | 8.83 |
| | `--color-seal` | `#BE1231` | 4.68 | | 5.52 | chalk T 6.10 |

Two notes on that table.

**The dark room's wax is lifted.** `#BE1231` measures 2.90:1 on the atelier's ink cloth, under the
3:1 WCAG 1.4.11 asks of a graphic. `#CE1837` is the same wax stated for a dark ground: 3.33:1
against the room, and the chalk T on it still clears AA at 4.55:1. Raising it further trades the
seal's legibility for the T's; this is the point where both clear.

**The salon gave up its private accent.** It used to own damson `#8E2A55`. A brand colour that
changes per theme is not a brand colour. The salon keeps its character where that character always
actually lived — the greige carpet, the rose spent in the neutral at chroma 0.019, the antique
brass — rather than in an accent of its own.

## Two defects this pass found by accident, and fixed

**The accent was failing non-text contrast on the app's most-repeated atom.** A selected chip fills
with ink and drew its eyelet in `text-accent` — the accent as read on *paper*. Measured: 2.66:1 in
the pattern room, 2.72:1 in the atelier, 2.11:1 in the salon, against a 3:1 floor. Two judges found
it independently while walking the app. It now uses `--color-accent-on-ink`, a token that existed
and had never been pointed at.

**The dark room's accent was under AA on the photo mat**, at 4.37:1 — in the shipped default theme,
on the tile every garment photograph lands on. Nothing caught it because `test-contrast.mjs` gated
`text/mat` and had no `accent/mat` pair. That pair is gated now, in every room, and so are
`chalk/seal` and `seal/bg`.

## What enforces this

- `scripts/test-contrast.mjs` — 18 pairs × 3 rooms, measured in a browser against the real computed
  tokens. Text pairs answer to 4.5:1; graphics answer to the 3:1 of WCAG 1.4.11 rather than being
  held to a text bar they were never subject to.
- `scripts/check-brand.mjs` — `every-room-declares-every-colour` (a theme that omits a token
  silently inherits the light room's value); `the-dark-room-agrees-with-itself` (the dark palette
  is declared twice, once for `prefers-color-scheme` and once for `data-theme`, and the two must
  match or explicit dark looks different from automatic dark); `the-mark-is-the-seal-colour` (the
  favicons live outside `src/` and `index.html` URL-encodes its hex as `%23BE1231`, so the mark was
  invisible to the linter twice over — the allowed palette is now derived from the token sheet, so
  changing a token forces the icons to follow).

---

*Judge pass convened and ruled 2026-08-11. Supersedes the palette rows of
`docs/05-brand-identity.md` §2 and §3 for the accent tokens only; `docs/06` §4 stands unamended.*
