# The product review of 2026-08-12 — three panels, one plan, first doors hung

Snapshots of all 14 routes (desktop + mobile, signed in as Meher) went to three
independent panels: a designer-developer consult, a six-voice simulated focus
group, and a marketing lead with live market research. Their reports converged
hard. This file is the synthesis and the record of what shipped versus what
waits.

## The finding that outranked every feature

**The record lied.** A plan was recognised by its date being in the future, so
every plan silently became a "wear" the morning its day arrived — Today claimed
the day was on the record, the Calendar sealed it with the wear-eyelet, the
Ledger counted it — while no wear count had moved. Undo on that fiction
decremented counts that were never incremented. Shipped fix: the `planned` flag
is STORED (schema v5, migration first), matured plans render as a question on
Today — "You had X down for today. [Wore it] [It didn't happen]" — and
`removeWearLog` reads the flag and recomputes `lastWorn` from the surviving
record.

## Shipped in this pass

- **The honest ledger** (above) — the one place the product actively lied.
- **Amend the record** — `updateItem` had zero call sites; the intake form now
  reopens prefilled from the piece ("Amend the record"), photo-later included.
- **Wash day in one motion** — the bench filter became a verb: "Send them all
  to the wash" / "The wash is done", over the existing State rail.
- **The household layer** (docs/19) — roommates/partners/family with
  overlapping membership, the fifth share scope, and pass-it-on with the tray.
- **Presentation groundwork** — the VLM design brief and full-app screenshot
  set ship in `design-handoff/` (+ `.zip`).

## Ranked and waiting (each verified real, none started)

1. Owner-initiated lending on the piece itself — the task all six focus-group
   voices failed; `setLendable` and the loans ledger exist unwired, and Chats'
   borrow flow never writes the Rail's ledger. The three social surfaces need
   one shared fact-store for loans.
2. Events as a packing surface — attach saved outfits to days, aggregate the
   unique pieces as a checklist with wash-state marks; wire `removeEvent`.
3. Closet sort + "not worn since" filter — every insight is computed and capped
   at top-5 with no drill-through.
4. Past-date logging from the Calendar (mechanism exists; UI hides it) and
   "same as yesterday" on Today.
5. Wishlist price + CPW projection in Before You Buy; a kept record of declined
   purchases ("the brake's wins").
6. Positioning: the chooser as landing page, the ownership line ("Kept in this
   browser · Works offline · Export anytime"), OG description; look-as-image
   export; CSV export.
7. Month calendar view; the year rollup card in the Ledger.
8. Events' hardcoded top/bottom/shoes expectation vs own-your-taxonomy.

## Market context (sourced, 2026-08)

Whering raised $7M (eBay/Google funds) and is now openly a commerce/AI funnel;
Alta raised $11M for agentic shopping; Indyx's reviews complain of gated
analytics, affiliate links, and failing offline; Acloset erodes on crashes and
vanished wardrobes; Save Your Wardrobe left consumer. A privacy flank
(OpenWardrobe, Wardrowbe, FitWardrobe) markets "your data stays yours" but none
is polished. Subscription fatigue hardened (~41% report it). **"The record is
yours" is an open lane, and this is the only finished, designed product in
it** — which is why the honesty fix shipped first: the differentiator is only
worth owning if the record is true.
