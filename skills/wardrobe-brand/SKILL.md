---
name: wardrobe-brand
description: The Toile brand contract for this wardrobe app. Load before ANY UI, styling, copy, icon, or artwork change - it defines the binding tokens, drawing rules, voice, and psychology directives that every visual and written change must follow.
---

# Toile — working rules

The full contract is `docs/05-brand-identity.md`. This is the operational digest.
When these rules conflict with a request, follow the rules and note the conflict.

## Non-negotiables

1. **Tokens only.** Every color comes from the CSS variables in `src/index.css`
   (`--color-bg/surface/sunken/mat/text/text-2/border/accent/accent-hover/
   accent-fill/success/warning/danger/gold/charcoal/chalk`). Never introduce a raw
   hex in a component. Both themes are set via `data-theme` on `<html>`.
2. **One carmine per region; exactly one primary button per view.** The hero
   treatment (carmine fill) belongs to "log wear" actions only.
3. **Radius 2 everywhere** (circles only for eyelets/seals). **No drop shadows** —
   depth is hairline borders, manila layering, plate edges.
4. **Nothing decorative behind clothing photos.** Photo tiles are flat
   `--color-surface` (light) / `--color-mat` (dark). Pattern-paper crosses and
   seam arcs live on page grounds and empty states only.
5. **Type:** Fraunces ≥20px only (mastheads, hero numerals, italic editorial
   labels). Switzer for UI/body; interactive labels ≥13px. IBM Plex Mono ≤15px
   for ledger data/chips; 11px mono is non-interactive metadata only.
6. **Icons** live in `src/components/icons.tsx`: 24×24, 1.5px stroke,
   `currentColor`, butt caps, miter joins, half-grid coordinates, and **exactly
   one 2px 45° notch in the NE quadrant** per icon. Garment icons are **technical
   fashion flats** — real construction detail, never a body, never the A-line
   gender glyph for dresses. New icons must be indistinguishable in style from the
   set. Never emoji, never lucide.
7. **Motion:** 140–200ms ease-out fades; stroke-dashoffset draw-ins; numeral
   tick-ups; the seal-press (1.15→0.96→1, 180ms) for wear-logging only. Everything
   collapses to opacity under `prefers-reduced-motion`.
8. **Voice:** house tailor. Dry, exact, warm at reward moments ("Logged. Worn 14
   times."), plain in utility/destructive flows, **no exclamation points**, no
   shame copy, no gendered assumptions about categories or bodies.
9. **Psychology floor:** log-wear ≤2 taps from Today; **zero gamification chrome**
   (no badges, streaks, confetti, progress-as-achievement) — only cumulative
   factual totals; Before You Buy = savvy friend, never parent (no guilt scores,
   no red warnings, and never any commerce/affiliate surface); no social graph;
   44px touch targets; AA contrast (4.5:1 text) in BOTH themes for any new pair.
10. **Copy law:** address the clothes, never the user's identity. Retire, never
   delete. Banned: body-verdict words (flattering, slimming, hide), gendered
   address (ladies, girl, babe, his & hers), shame/diet language (closet detox,
   "do you REALLY need it?", wasted money), and "pre-loved". Roughly one
   exclamation point for the entire app. See `docs/06-focus-group-requirements.md`.

## Where things live

- Tokens/utilities: `src/index.css` (`.masthead-rule`, `.basting`, `.plate`,
  `.tag-chip`, pattern-paper ground)
- Icons: `src/components/icons.tsx` · Art/plates/logo/seal: `src/components/art.tsx`
- Primitives: `src/components/ui.tsx` (Button, Chip, Card, Modal, Field, Masthead)
- Agents: `.claude/agents/design-critic.md` (post-change review),
  `.claude/agents/brand-artist.md` (new artwork)

## Checklist for any UI PR

- [ ] No raw hexes, no emoji-as-UI, no lucide imports
- [ ] Dark theme checked (especially photos on `--color-mat`)
- [ ] One primary button per view; hero carmine only for log-wear
- [ ] New icons carry the NE notch and pass 20px legibility
- [ ] Copy has no exclamation points and no shame framing
- [ ] Run the design-critic agent on screenshots before merging
