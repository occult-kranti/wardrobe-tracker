---
name: toile-social
description: Rules for Toile's multi-wardrobe and social surfaces - accounts, profiles, the feed, conversations, sharing, and events. Load before touching sign-in, profiles, feed, chats, events, or anything that crosses between wardrobes.
---

# Toile — wardrobes, sharing, and the social surfaces

Companion to `skills/wardrobe-brand/SKILL.md`, which still governs everything
visual. This file covers what that one does not: more than one wardrobe on a
device, and the little that is shared between them.

Full reasoning: `docs/11-shared-rail.md`, `docs/12-wardrobes-and-feed.md`.

## The four verbs — never blur these

| Verb | UI words | What moves | Where it lands |
|---|---|---|---|
| **Show** | "Attach" | nothing | a snapshot inside one message |
| **Share** | "Share this look" | nothing | a post in the shared store |
| **Ask** | "Ask after it" | nothing | a request on a message, status `asked` |
| **Lend** | "Lend it" | the garment | a loan row |

Attaching shows a piece; it does not lend it. Only the owner may lend.

## Non-negotiables

1. **There is no server.** Never write copy implying an account, a login, sync,
   or that anything leaves the device. "Open a wardrobe", not "sign in". If a
   passphrase is ever added it is a **curtain, not a safe** — localStorage is
   plaintext and the UI must say so.
2. **One store per wardrobe.** `wardrobe-tracker:<id>`, read only by
   `WardrobeProvider`, which `App` keys by the active id so switching remounts
   it. `useLocalStorage` reads storage only in its `useState` initializer — drop
   the `key` and one closet's contents land under another's key.
3. **The feed is not a performance surface.** No likes, reactions, counts,
   followers, unread badges, "seen by", streaks, or ranking of any kind. Order is
   reverse-chronological and that is the whole algorithm. Filters are the user
   asking a question; ranking is the app answering one they did not ask.
4. **Shared looks are SNAPSHOTS**, captured at share time — name, photograph,
   piece names, occasion. Never read another wardrobe's store to render a feed
   row. This makes consent structural rather than a filter predicate one refactor
   away from leaking, and it keeps a dated statement true after the fact.
5. **Avatars are garment tags with a monogram.** Never a face, never a body. A
   persona's own outfit photograph may appear on a profile as what it is — a
   look, in its 4:5 frame, with a caption — never cropped into a portrait.
6. **No measurements, ever.** Height, weight, chest/waist/hip is a
   body-surveillance taxonomy (§1.3). The persona importer drops the field so it
   cannot reach a screen later.
7. **No appearance verdicts.** A colour palette is a fact about cloth. "Optic
   white washes him out" is a judgement about a person, and carries a gendered
   pronoun besides. The importer keeps the palette and discards the verdict.
8. **A declined request is a neutral fact.** The word is "Staying home". No red,
   no alarm styling. A piece not going out is not a verdict on whoever asked.
9. **No commerce.** "Complete the look" fills gaps from pieces already owned and
   sends a genuine gap to the wishlist, where the cooling-off wait is. It never
   suggests anything to buy and never links a retailer.
10. **Reserving is not wearing.** An event reservation moves no wear count. The
    day still gets logged when it arrives, like any planned calendar day.

## Where things live

- Accounts registry, session, shared store: `src/lib/accounts.ts`
- Session + community state: `src/context/SessionContext.tsx`
- Shared UI (`AccountMark`, `LookCard`, `PieceCard`): `src/components/social.tsx`
- Pages: `SignIn`, `SwitchWardrobe`, `Profile`, `Feed`, `Chats`, `Events`
- Persona seeds: `src/lib/personaData.ts` (generated — edit the builder, not it)
- Builders: `scripts/build-persona-data.mjs`, `scripts/build-persona-images.mjs`

## Adding a wardrobe's data

Photographs go in `public/wardrobe/` and are referenced by **relative path**,
never inlined: 84 images are ~55MB raw and localStorage caps near 5MB. Paths
resolve against the built site's own origin, so the offline-first assertion in
`scripts/test-demo.mjs` still holds. Run the two builders; never hand-edit the
generated modules.

## Checklist for any change here

- [ ] No copy implying a server, an account, or sync
- [ ] No engagement mechanics reintroduced (likes, counts, badges, ranking)
- [ ] Feed rows read only from the shared store, never another wardrobe's
- [ ] Avatars are tags; no face, no body, no measurements
- [ ] `AppState` change? Migration case in `scripts/test-migrate.mjs` FIRST
- [ ] Persona seed change? Re-run the builders and `npm run test:demo`
- [ ] Switching wardrobes still changes the closet (smoke covers 13 routes)
