# Wardrobes, profiles, the feed and conversations — decision record

*Added 2026-08-11 by owner decision, extending `docs/11-shared-rail.md`.*

## What shipped

Three worked wardrobes on one device (Aarav Menon, Vikram Sethi, Meher Kapoor),
switchable, each with its own closet, taxonomy, calendar, outfits, events and
wear history. A profile page per wardrobe, a shared feed of what each has chosen
to show, a group conversation and a direct thread per pair, and events that hold
outfits against dated occasions.

## The decisions, and the rules they had to clear

### "Sign in / create accounts" with no server

The owner asked for login, sign-up and accounts. There is no backend, the app
deploys as a static page, and hard rule 1 forbids accounts outright.

**Resolution:** the screens do exactly what they can honestly do — *Open a
wardrobe* and *Start a wardrobe* — and say so in their own copy: "Nothing here
is an account. These are wardrobes kept in this browser." Every capability the
request wanted (separate profiles, switching, per-profile calendars and feeds)
is delivered; only the pretence of authentication is not. This is the same
resolution `docs/11` reached and for the same reason: copy that implies your
clothes are going somewhere they are not is the one thing the panel said would
destroy trust.

### A feed, against "no social graph"

`docs/11` narrowed the panel's ban to *networked* social graphs and sanctioned a
UI for recording lending among known people. A feed sits closer to the line.

**Resolution:** it is a shared rail, not a stage. Absent, deliberately: likes,
reactions, counts, followers, discovery, algorithmic ranking, unread badges,
"seen by", streaks, share counts, and comments under a share. Ordering is
reverse-chronological — the only ordering that cannot be gamed and cannot be
mistaken for a judgement. Talk about a garment happens in a conversation, where
it is a conversation, rather than under it, where it would be an audience.

### Storage: one key per wardrobe

Measured before choosing. Chromium's quota probes to 5,222,400 chars; the
existing demo state is 426,459, of which 79% is inline SVG data-URIs. Nesting
three closets in one blob would rewrite ~600KB on every keystroke, share one
quota with silent failure, and require a filter in every selector that, if ever
missed, pools three people's clothes into one Ledger total.

So: `wardrobe-tracker:<id>` per wardrobe, a small registry, a session key, and
one shared store. `WardrobeProvider` is keyed by the active id in `App`, which
remounts it on a switch — that single `key` is the whole safety story, because
`useLocalStorage` reads storage only in its `useState` initializer.

**The upgrade path is not optional.** Anyone with a closet at the old bare key is
adopted into a wardrobe and opened straight into it. Losing a catalogued closet
to a refactor would break the promise this project keeps above all others.

### Feed rows render a wardrobe that is not loaded

**Snapshots, not a live join.** Sharing copies a self-contained record — name,
photograph, piece names, occasion — into the shared store. Chosen over reading
other wardrobes' stores directly because it makes consent *structural*: there is
no code path that can render an unshared piece, since unshared pieces are not in
the store the feed reads. A live join would make privacy a filter predicate, one
careless refactor from a leak, and would silently rewrite dated statements —
colliding with retire-don't-delete, where history must not change after the fact.

The cost is staleness. That is correct here: a share is a dated statement.

### Imagery

84 photographs, compressed 55MB → 2.6MB, served as files from `public/wardrobe/`
and referenced by relative path. They cannot be data-URIs — localStorage caps
near 5MB. Paths resolve against the built site's own origin, so nothing is
fetched from a network and the offline-first assertion still holds.

The retailer product shots were included after the owner confirmed reuse rights,
having been asked; their own manifest carried a "verify reuse rights before
publication" note.

### Two violations caught at import

The source persona pack carries fields that could not ship:

- **`body`** — height, weight, chest/waist/hip. A measurement taxonomy is what
  §1.3 refused. Dropped entirely at import: data that never enters the build
  cannot leak onto a screen later.
- **`colourSeason`** — a palette fact followed by an appearance verdict written
  with a gendered pronoun ("optic white and neon wash him out", "beige drains
  him", "she wears it as a backdrop"). The palette survives; the verdict does not.

### Events, and "find product / link with brands"

Events ship: trips, festivals, weddings, offsites, with outfits reserved against
their days, three per wardrobe. Reserving moves no wear count — the day is still
logged when it arrives.

**"Find product and complete the outfit", with brand links, does not ship as
asked.** Hard rule 2 bans every commerce surface, and §8.5 states the reason: a
feature that talks you out of buying cannot profit from buying. What shipped is
**"Complete the look"**: it finds what a reserved look is missing and fills it
from pieces already in the closet, most-worn first, and routes a genuine gap to
the wishlist where the cooling-off wait lives. The seam for a future brand
integration is clean, but taking it would require the panel's rules to change,
not just the code.

### A theme "for women"

Requested, and not built as requested. Hard rule 5 and §2.7 forbid gendering
anything — the app asks what you own, never who you are, and a gender-gated
theme is precisely the prohibited operation. A third palette, grounded in colour
theory and available to everyone, remains open work in `docs/10-roadmap.md`.

## Schema

v4. `AppState` gains `events`; `Outfit` gains an optional `imageUrl`. Accounts,
the session and the shared store live outside `AppState` in their own keys, with
their own defensive loaders. `scripts/test-migrate.mjs` holds a case for each,
including malformed input.
