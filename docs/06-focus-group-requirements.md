# Focus Group → Shipping Requirements

> **Panel:** three LGBTQ+ fashion designers (a nonbinary made-to-order designer, a
> trans womenswear designer/fitter, a queer upcycling & repair studio owner) and
> three shopaholic archetypes (recovering impulse buyer, haul-culture dopamine
> dresser, deal-hunter parent). Moderated for consensus, then reviewed independently
> by a staff developer and a behavioral psychologist. Both experts converged; where
> they differed, the stricter (kinder) reading wins.

---

## 1. What ships now

| # | Feature | Simplest elegant form |
|---|---|---|
| 1 | **Own your taxonomy** | Categories become editable data: rename, add, reorder, and mark any category **quiet** (hidden from browse/generator, no photo expected). Occasions become free-form tags; `performance` ships in the defaults, lowercase, exactly as flat as `work`. |
| 2 | **Maker & source** | `brand` stays one optional text field, placeholder **"Brand, or made by you"**. Beside it one *how it came to you* select: new / secondhand / swapped / gifted / inherited / self-made. Brand stats are a plain ranked table — never a collection page. |
| 3 | **One "fits like" line** | A single free-text field per garment. No size schema, no measurements — measurement taxonomies invite body-surveillance and erase people. It appears in Before You Buy, where "but this one will fit better" goes to die. |
| 4 | **Retire, don't delete** | A piece leaves the closet keeping its full history, with an optional *where it went* reason. Retired pieces vanish from browse, the generator, and comparisons. Hard delete is demoted to "added by mistake". |
| 5 | **Before You Buy** | Two taps from open. Matching runs **across categories** (a jumpsuit competes with a shirt-and-trousers pairing), retire-aware. Your own photos dominate; one aggregate line; two equally weighted exits. |
| 6 | **Bench states + honest generator** | `needs repair` and `at the tailor` join laundry — a torn shirt is neither clean nor dirty, it's benched. The generator deals only clean, unbenched, unretired, non-quiet pieces. |
| 7 | **Wishlist that cools** | Optional cooling-off wait (default 7 days). Total silence during the wait — the silence *is* the intervention. On expiry it asks **once**, inline: Keep / Let it go / Bought. Released items form a quiet ledger: *"$1,340 stayed yours."* |
| 8 | **Never worn, stated once** | A pull-only view: *"14 pieces haven't had a first wear yet. $890 is resting here."* Resting, not wasted. No badge, no notification, no count bubble. |
| 9 | **Data stewardship** | Export serializes the **entire** state generically (fixes a live bug: wishlist is silently dropped today) with `schemaVersion`; import round-trips unknown fields. A quiet, dismissible in-app backup reminder — never a notification. |

**Deferred with reasons:** repair-cost log folded into cost-per-wear (needs a
centralized CPW helper first), category delete/merge with reassignment (data-loss
risk), local PIN lock (worth doing, but must ship with honest copy — localStorage
is plaintext), swap-night packing list.

**Rejected outright:** structured sizing database · any commerce surface (shop
links, affiliate codes, "shop similar") · push notifications of any kind ·
gamification chrome (badges, streaks, confetti, collection-style brand pages) ·
any gender question, gendered section, or gendered art · accounts, cloud sync,
telemetry.

## 2. Binding design amendments to the brand contract

1. **Display face changes to Fraunces**, not Bodoni Moda. The panel asked for "a
   characterful editorial serif — Fraunces territory, warmth and ink traps; not
   Playfair," and independently the engineering judge flagged that didone hairlines
   degrade at 1× and below 22px. Fraunces (variable, Google Fonts, `opsz`/`SOFT`/
   `WONK` axes) satisfies both: editorial character with ink traps that survive
   small sizes and low-DPI screens.
2. **No streak chrome.** The panel was unanimous against badges, streaks, confetti,
   and progress-as-achievement. The brand's "ethical streaks" directive is replaced
   by: cumulative, unloseable, factual totals only ("312 wears recorded"), stated
   like a bank balance.
3. **Icons are technical fashion flats.** Garments drawn laid flat with real
   construction detail (placket, raglan seam, lapel) — a flat contains no body, so
   it assumes nothing about who wears it. The dresses icon must read as *a column
   garment with drape*, never the A-line-with-implied-waist gender glyph. Emoji
   icons are retired in the rebrand's first act.
4. **Never draw bodies.** No mannequins, headless torsos, his/hers silhouettes, or
   Corporate-Memphis blobs.
5. **No-photo state is first-class.** A drawn flat serves as the default garment
   image per category, so photo-free use (essential for privacy-conscious users)
   looks intentional rather than broken.
6. **Stats are neutral territory.** No red, no alarm states, no report-card layout.
   Low wear reads as *quiet lately*, never a verdict. Every category gets identical
   visual weight — dresses are never rendered softer, rounder, or pinker.
7. **Queerness lives in the defaults**, year-round: no rainbow theming, no Pride
   skin, no flag palettes. It shows up as neutral taxonomy, `performance` in the
   occasion list, and copy that addresses clothes rather than identity.

## 3. Copy law

- **Voice:** a knowledgeable friend with a tape measure. Address the *clothes*,
  never the user's identity: *"This coat hasn't been worn since March."*
- **Let numbers carry the feeling:** *"Worn 14 times — $3.12 per wear and
  dropping."* Before You Buy speaks in data, then **stops talking**. The user
  supplies the conclusion.
- **Graceful when they buy anyway:** *"Added. It starts at $0 wears — let's see what
  it does."* Never a lecture on the way out.
- **Retire, never delete:** *"This piece did its work."*
- **Banned vocabulary:** body-verdict words (flattering, slimming, hide, conceal) ·
  gendered address (ladies, girl, queen, babe, his & hers) · shame and diet-culture
  language (closet detox, guilty pleasure, "do you REALLY need it?", wasted money) ·
  "pre-loved" (use secondhand, thrifted, swapped, mended — neutral, even proud).
- **Roughly one exclamation point for the entire app.**

## 4. Divergences and how they were resolved

| Tension | Resolution |
|---|---|
| Fit depth: structured sizes vs "no schema, please" | One free-text line. The fitter's need is met by *what she'd type*, not by a taxonomy that risks body-checking. |
| Accent energy: restrained oxblood vs "beige eco-normcore, give me acid" | One genuinely saturated accent — carmine `#BE1231` — used scarcely. Saturated enough to read as a thread-bright choice, disciplined enough to stay atelier. |
| Recovery nudges vs allergy to notifications | Ship the **silent** cooling-off timer only. No mood tags, no reminders, no push. Silence is the intervention. |
| Matching scope: same-category (simple) vs cross-category (correct) | Cross-category. Category becomes a scored signal, not a gate — the feature fails exactly when it matters otherwise. |
| Brand stats: fit memory vs "don't make it a collection to complete" | One plain ranked text table. No logos, no imagery, no completion mechanics. |

---

*Panel convened 2026-08-11. These requirements and `docs/05-brand-identity.md`
together are the build contract.*
