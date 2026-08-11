# Design Decision Log

## 2026-08-11 — "Midnight Atelier" superseded by Toile

A dark editorial theme called *Midnight Atelier* was pushed to `main`
(commit `549ae27`) in parallel with this redesign. It was reviewed against the
brand contract and the focus-group requirements and **superseded**. The decision
was confirmed by the project owner.

This log exists so the reasoning outlives the conversation, and so the parts of
that work worth keeping were actually kept.

### What it got right (and what we carried forward)

- **Dark editorial is the right mood for this product.** Cataloguing happens at
  night, and the owner asked for it twice. Toile's dark palette ("the atelier at
  night") is now the **default theme**, with light paper one tap away.
- **Warm metallic accents read as expensive.** Toile already carries a basting
  gold (`#C9A227`) for decorative rules and dividers; that instinct was sound.
- **Retiring emoji from the interface.** Its pages dropped emoji from the UI,
  which was the panel's stated first act. Toile completes the job — the emoji
  were still present in `types.ts` as the category icon source of truth.
- **Hand-drawn SVG over stock illustration.** Correct call, kept.

### Why it could not ship as the identity

Measured, not asserted:

| Finding | Evidence |
|---|---|
| **Contrast failures** | `text-muted #6B6156` on card `#1A1A1D` = **2.87:1** (WCAG AA needs 4.5:1) — and that token carries metadata across the app. `wine #8B3A3A` on bg = **2.57:1**. `accent-dim #8B7347` = 4.32:1, large text only. |
| **Playfair Display** | The designer panel named this face specifically as the one to avoid: *"a characterful editorial serif (Fraunces territory — warmth and ink traps; **not Playfair**)."* |
| **A drawn body** | `EmptyOutfitArt` contains *"Central figure — abstract fashion form"* with a neckline. The panel was unanimous: **never draw bodies** — no mannequins, torsos, or silhouettes, because a garment flat assumes nothing about who wears it. |
| **Sparkles** | Sparkle motifs in `EmptyClosetArt` plus `✨` in `types.ts`. The panel listed sparkle-as-design-language among the things that trigger deletion. |
| **Dark-only** | No `prefers-color-scheme` or `data-theme` handling at all. Removes user choice; daylight garment review and light-sensitivity needs both go unserved. Dark should be a real pass, not the only pass. |
| **Emoji at the data layer** | `types.ts` still shipped `👕👖👗🧥👟👜✨` as `CATEGORY_ICONS`. |
| **Generic icons** | `lucide-react` still in use — no ownable icon language. |
| **Zero panel requirements** | It is a visual reskin of the *old* feature set. Missing: brand + source, `fitsLike`, retire-don't-delete, bench/mending states, wishlist cooling-off, user-owned taxonomy, the never-worn ledger, and Before You Buy — every one of which the focus group ranked **must** or **strong-want**. |

### The decision

Toile ships. It satisfies the contract that the research, the judge panel, and
the focus group jointly produced, and it is a strict superset of Midnight
Atelier's functionality. Midnight Atelier's aesthetic preference is honored
through Toile's dark-first default rather than through its implementation.

### Merge handling

`origin/main` was merged into the redesign branch. Where both rewrote the same
file, **Toile's version was taken wholesale** — the two are alternative rewrites
of the same surfaces, not complementary changes, so line-level merging would
have produced an incoherent hybrid violating both contracts.

---

## 2026-08-11 — Display face: Bodoni Moda → Fraunces

Two independent signals agreed, so the brand contract was amended before any
component was built: the focus-group designers asked for ink-trap warmth
("Fraunces territory; not Playfair"), and the engineering judge flagged that
didone hairlines degrade at 1× and below 22px. Fraunces satisfies both.

## 2026-08-11 — Ethical streaks → no streak chrome at all

The brand contract originally allowed "ethical streaks" (consistency over
perfection). The focus group was unanimously against badges, streaks, confetti,
and progress-as-achievement in any form. The stricter reading won: only
cumulative, unloseable, factual totals, stated like a bank balance.

## 2026-08-11 — Similarity matching: same-category gate → scored signal

The first implementation of Before You Buy gated matches to the same category.
The designers argued the feature fails precisely when it matters — a jumpsuit
competes with a shirt-and-trousers pairing you already own. Category became one
scored signal among several. Retired pieces are excluded from comparison.
