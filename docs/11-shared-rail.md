# The Shared Rail — decision record and design notes

*Added 2026-08-11 by owner decision.*

## What it is

Borrowing between people who already know each other: profiles, one group, one
conversation thread, borrow requests that move through
`asked → lent → returned` (or `declined`), and a loan ledger recording what is
out and what came home. Lives at `/rail`, with a profile page per person at
`/rail/:id`.

## The decision this records

The focus-group requirements reject accounts, cloud sync, and any social graph
(`docs/06-focus-group-requirements.md`, rejected-outright list and §8.6), and the
local-first rule is the product's first dealbreaker. A networked version of this
feature — usernames resolving on a server, real messaging — would break both,
and the app deploys as a static page with no backend at all.

The owner asked for the feature explicitly, twice, with detail (profiles,
groups, conversations, borrow/lend). **The resolution: the full flow ships as
local data.** Profiles are records this closet keeps, the way a contact book
is; the conversation is a log the user maintains; nothing syncs, nothing phones
home, and the page says so in its own copy ("Kept on this device, like a
contact book. Nothing syncs anywhere."). The panel's objection was to feeds,
followers, and surveillance — a named friend you hand a dress to is none of
those. Lending circles are, if anything, the most anti-consumption behaviour
the app could encourage: the panel's repair-studio member ran one informally.

What this preserves: local-first (rule 1) holds — no server exists. What this
amends: "no social graph" is narrowed to "no *networked* social graph" — a
UI for recording lending among known people is sanctioned; follower counts,
discovery, and feeds remain banned.

If a real backend is ever wanted, this UI is the contract for it — but that is
a separate, deliberate decision with hosting, auth, moderation, and cost
attached, and it should be re-put to the panel.

## Design constraints applied

- **No feed mechanics.** One group, one thread, chronological, oldest first.
  No unread counts, no badges, no notification dots.
- **A declined request is a neutral fact.** Status copy is "Staying home" — a
  piece staying home is not a verdict on anyone. No red, no alarm styling.
- **Avatars are garment tags** — the brand's tag motif (clipped corner, eyelet,
  monogram). Never a face, never a body (§2.4 extends naturally here).
- **Bios address clothes and craft, never identity.** The demo personas are
  written that way and `test:demo` greps the circle for gendered address.
- **Friends' pieces are name-only records.** A friend's closet does not exist
  in this app's data; their lendable list is text the user typed, exactly like
  a contact book entry. Only the user's own pieces carry `itemId`s.
- **Voice:** requests read like notes between people who sew — "Asked after
  the Bode dress." / "It came home."

## Schema

`AppState.circle` (schema v3): `profiles`, `groups`, `messages`, `loans` — see
`src/types.ts`. Migration seeds an empty circle on pre-v3 exports and preserves
an existing one verbatim; `scripts/test-migrate.mjs` holds both cases. Lossless
export covers the circle like everything else.

## Demo

Three profiles (`This closet`, Priya, Mo), one group ("The Rail"), a
nine-message thread covering all four request states, one active loan out and
two returned. Twelve `test:demo` assertions pin this.
