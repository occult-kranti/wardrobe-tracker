# Households — under this roof

*Added 2026-08-12. Designed by a five-voice focus group (a couple, three
roommates, a parent, a privacy-focused shared-laptop user, and one person in
all three kinds at once); built exactly to their settled spec.*

## The model

`Household { id, name?, kind, members: [{accountId, joined?}] }` in the shared
store. **The kind describes the room, not what any two members are to each
other** — one person belongs to a partners household, a housemates household
and a family household at once, because those are three rooms, not three
labels on one edge. No roles, no shape, no size checks (§2.7: no field can
encode couple-shape). A member without `joined` is an invitation waiting for
its yes.

## What each kind unlocks — and never unlocks

- **Housemates** → a group thread that follows the roof (appears at the second
  yes; membership tracks joins and leaves). Never: laundry visibility,
  auto-lendable lists, chores.
- **Partners** → a fifth share scope, "Just the household" — joined members
  only; an unanswered invitation shows nothing. Never: merged closets, shared
  editing, never the default scope.
- **Family** → **pass it on**: retiring can offer a piece to family. The offer
  is a frozen snapshot in the shared store; it appears in the receiver's
  closet as a pull-only tray card (no badge, no bubble) and lands only when
  they accept — `source: inherited`, wear count 0, provenance attached ("From
  Aarav. 12 wears in their record."). The giver's wears stay in the giver's
  ledger. Never: wear-history transfer, read-back, silent insertion.

## The veto list (unanimous, chaired by the privacy seat)

1. Never a live read of another wardrobe's store — every crossing is a snapshot.
2. Never silent insertion — everything arrives through the tray, accepted from inside.
3. Never membership without acceptance; leaving is unilateral and asks no one.
4. No kind unlocks closet browsing, wear read-back, laundry or spend visibility.
5. Never changes anyone's default share scope.
6. A household stores ids and a kind, nothing else.
7. No notifications, badges or count bubbles.
8. Never transfer wear history.
9. No admin hierarchy — membership is flat.

## Where it lives

Management on your own Profile ("Under this roof") — not the chooser (consent
flows from inside an open wardrobe) and not Settings (that page is one
wardrobe's internals; a household is between wardrobes). The samples ship with
Vikram under all three roofs: partners with Meher, The Indiranagar flat with
Aarav, and the Menon-Sethi family — where Meher holds an unanswered invitation
and a Type-III denim jacket waits in her tray, so Join and Take-it-in are
demonstrable on first open.

Artwork: the household kind marks are specified in `design-handoff/PROMPT.md`
(the VLM brief) — geometry constraints, stroke registers, notch rules, and the
required deliverables for the engineer to transcribe.
