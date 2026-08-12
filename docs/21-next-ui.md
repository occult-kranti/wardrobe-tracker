# 21 — The next features, planned as interfaces

Continues the ranked backlog of docs/18 §synthesis. That document decided *what*
is worth building; this one decides *what it looks like and where it lives*
before any of it is coded. Every item here ships under the three-closets rule
(docs/18, 2026-08-12 addendum): screenshotted in the starting, average, and
complete fill-states, or it is not done.

## 1. Owner-initiated lending — "Lend it out"

The pass-on tray moves whole garments between wardrobes forever. Lending is the
temporary version, and it is the most-requested social act in the focus group
notes: *"my sister has my black shawl right now and the app thinks it's in my
closet."*

**Where it lives.** ItemDetail gains a third action beside Retire and Amend:
**"Lend it out"**. Not on the card grid — lending is deliberate, not a
drive-by.

**The flow.** One modal, two fields: *to whom* (chips: household members and
followed profiles, same source as pass-on recipients) and *until when*
(optional; a date or blank for "until it comes back"). No message, no
notification — the veto list from docs/19 applies to lending exactly as to
passes: the tray model, snapshots not references, membership by yes only.

**What the closet shows.** A lent piece stays in the owner's grid — it is
still their piece — but its tile carries a `LENT TO PRIYA` ledger chip where
the laundry state normally sits, and it is excluded from "Draw a set" and the
outfit builder's clean-pieces pool (you cannot wear what is across town). The
borrower sees it in a "Borrowed" bench on their Closet page, wearable and
loggable; their wear logs annotate the loan record, and the wear history
travels home with the piece when it is returned — wears happened to the
garment, wherever it slept. This is the one deliberate exception to the
no-wear-history-transfer veto, and it is what distinguishes a loan (one
garment, one history) from a pass (a new chapter, clean page).

**Return.** Either side can end the loan. "It came back" on the owner's tile;
"I gave it back" on the borrower's bench. No confirmation round-trip — the
first tap settles it, the other side's view updates.

**States.** Starting: feature invisible (no household, no follows — the chips
row empty hides the action). Average: one piece lent, one borrowed. Complete:
Meher lends the kantha jacket she was passed — the full circle.

## 2. Events packing surface — "What's coming"

Events currently answer *"what did I wear to things like this."* The packing
surface answers *"what am I taking."*

**Where it lives.** An event's detail view gains a **"Pack for it"** section
under the outfit suggestions: a small bench the user fills by tapping pieces
from a filtered picker (clean pieces first, occasion pre-filtered to the
event's kind). Multi-day events allow one bench per day, collapsed to chips.

**What it does with the data.** Packed pieces get a quiet `SPOKEN FOR — GOA,
DEC 12` chip in the closet grid, and the wash-day flow warns when a packed
piece is headed for the laundry inside three days of the event. On the event's
morning, Today offers the bench as a one-tap log, same gesture as outfits.

**States.** Starting: section hidden until the first event exists. Average: one
wedding, half-packed. Complete: Vikram's board-week benches, one per day.

## 3. Closet sort — the ledger's own order

The grid's fixed order (newest first) stops serving at 30+ pieces. One **sort
control** on the Closet masthead, ledger idiom, four orders: *Newest* (default),
*Most worn*, *Longest quiet*, *Highest cost per wear*. No grouping UI, no
drag-to-arrange — the record sorts, the user doesn't file.

**States.** Identical control in all three; the screenshots prove the orders
are legible at 4, 32, and 60 pieces.

## 4. Past-date logging + "same as yesterday"

The calendar can already show any day; it cannot yet *write* one. Two gestures:

- **Calendar day → "Add what you wore."** The same picker as Today, stamped
  with the tapped date. Stored logs carry no `planned` flag when the date is
  past — the honest-ledger rule (docs/13) already judges by the stored flag,
  so backfilled days mature nothing.
- **Today → "Same as yesterday."** One tertiary button beside "Log today's
  wear", visible only when yesterday has a real (non-planned) log and today has
  none. It copies yesterday's pieces into today's log in one tap — the single
  highest-leverage reduction of the logging cost the product will ever ship.

## 5. Wishlist price and the projection

The wishlist knows wanting; it should know arithmetic. An optional **price**
field on wishlist entries (the cooling-off card already has the room), and
under it the projection: *"at your average 3.4 wears/month for outerwear,
this reaches $2/wear in 14 months."* Derived from the ledger's own category
rates — the app's one predictive sentence, stated like a fact and not a nudge,
because the numbers are the user's own.

## 6. V2 Vitrine, phase 2 (docs/20)

The consultant spec's remaining moves, in order of visible return: the
specular sheen following device tilt on mobile (DeviceOrientation, permission-
gated, reduced-motion off), spring-staggered route transitions keyed to
navigation direction, and the closet grid's depth shuffle (pieces rise 4px on
hover with true cast shadows from the room's light angle). Each lands behind
the same reduced-motion gate as the spring engine; the glass never bends.

---

Sequence: 4 first (it is two afternoons and pays rent daily), then 3, then 2,
then 1 (the only one with cross-wardrobe writes), then 5, with 6 running on
the v2 branch in parallel. Each lands with its three-states screenshot row in
this file's changelog.
