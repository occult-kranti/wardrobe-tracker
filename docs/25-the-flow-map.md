# 25 — The flow map

Every address in this app, what it is for, what reaches it, and what it reaches.

The authoritative lists are `src/lib/routes.ts` (the addresses), `src/App.tsx`
(the route table) and `src/components/Layout.tsx` (the navigation). This document
is derived from them and is worth exactly as much as its accuracy — when they
disagree, they are right and this is stale.

## The rule this document exists to keep

> **Every address that is not in the navigation carries a named way back to the
> page that owns it, and its owner's tab stays lit while you are there.**

Both halves matter, and both were broken when this was first written. A page with
no in-page exit is escapable only by the browser's own back button — which a
person running this from their home screen does not have. And a page that lights
no nav item leaves the chrome that is always on screen saying nothing about where
you are.

## The addresses

| Route | For | In the nav | Reached from | Reaches |
|---|---|---|---|---|
| `/` | Today — the daily surface; logging a wear lives here | yes, slot 1 | the wordmark, the door, switching wardrobes | outfits, ledger, closet, calendar |
| `/closet` | the clothes themselves | yes, slot 2 | nav; Today; Ledger; Outfits; Intake; the Dressing room | intake, the dressing room, a place |
| `/outfits` | saved looks | yes, slot 3 | nav; Calendar; Today; Feed; Profile | closet |
| **`/furniture`** | **the Dressing room** — where a garment lives | **no** | the room on the Closet | closet, a place |
| **`/furniture/:id`** | one piece of furniture, open | no | the room's bays; the Dressing room index | the dressing room |
| `/calendar` | the wear calendar | yes | nav; Today | outfits |
| `/events` | dated occasions | yes (More) | nav | wishlist |
| `/ledger` | the numbers | yes | nav; Today; the `/stats` redirect | closet |
| `/wishlist` | wanted, not owned | yes | nav; Events | before you buy |
| `/compare` | Before you buy | yes | nav; Wishlist | — |
| `/feed` | the household feed | yes, slot 4 | nav; Profile | outfits, a profile |
| `/chats` | conversations | yes (More) | nav; the Shared rail | a conversation, profile |
| **`/chats/:id`** | one conversation | no | Chats | chats |
| `/profile` | your profile | yes (More) | nav; Chats | outfits, feed |
| **`/profile/:id`** | someone's profile | no | the Feed's author lines | feed |
| `/rail` | the Shared rail | yes (More) | nav | a neighbour's rail, chats |
| **`/rail/:id`** | a neighbour's rail | no | the Shared rail | the shared rail |
| **`/intake`** | cataloguing from photographs | no | the Closet masthead; Settings | closet |
| `/settings` | settings | yes | nav | intake |
| `/open` | wardrobes — switch or start | yes (More) | nav; the desktop rail's footer | a new wardrobe |
| `/open/new` | start a wardrobe | no | Wardrobes; the door | — |
| `/stats` | a legacy bookmark | no | old bookmarks only | ledger |

## Modals, which are not addresses

No URL, no back button, closed with Escape or the backdrop: **Add a piece**
(Layout and Closet), **the piece detail**, **the retire sheet**, **the filter
drawer**, **Draw a place**, **Put things in**, **the share sheet**.

That is a deliberate line. A modal is a thing you are doing *to* the page behind
it; an address is a place you went. Anything that survives a refresh is an
address.

## Held addresses

Two pages have no tab of their own and are reached from inside the Closet: the
**Dressing room** and the **photo bench**. The Closet's tab stays lit while you
are in either — `HELD_BY` in `Layout.tsx`. Without it the whole rail went dark,
which is the same defect `owns()` was patched for once already, for a
conversation and a neighbour's rail.

## What this map has caught

Written down because each was found by drawing the map rather than by using the
app, and each would have been found again the same way:

- **The Dressing room had no way out.** It is reached from inside the Closet and
  is in no nav list, so before the back link the only exit was the browser's own.
- **The photo bench had the same hole**, and for the same reason.
- **`/open` was unreachable below 1024px.** Its only link lived in the desktop
  rail's footer, which is `hidden lg:flex` — so on the viewport most households
  use, switching or adding a wardrobe meant typing the address.
- **Two tests were false greens.** `no route is a dead end` and `it can be left
  again` both counted links across the whole document, and every route sits
  inside `Layout` and inherits its rail — so neither assertion could ever fail.
  Scoped to `main`, the first immediately found three stranded routes. A test
  that cannot fail is worse than no test, because it is also a claim.
