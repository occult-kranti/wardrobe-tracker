# V2 — the plan, the questions, the replan

*Branch `v2`, 2026-08-12. The owner's brief: "completely recode... use 3d
physics and elements to create a new modern theme over this simple yet
beautiful functioning amazing website... this is going to be the v2."*

## Plan (first draft)

A modern presentation layer over the SAME functioning app: obsidian-glass
surfaces, real depth, spring physics. Full three.js scene, WebGL closet,
physics engine dependency.

## Question it

1. **A WebGL scene or a physics library breaks the deploy physics.** This is a
   static Pages site whose whole identity is "small, yours, works offline."
   three.js + a physics engine is ~600KB before the wardrobe loads, needs WebGL
   context management, and dies ungracefully on low-end devices. The brief says
   "3d physics AND ELEMENTS" — the *feel* of dimension and mass, not a game
   engine.
2. **Replacing the room system throws away measured work.** Six rooms, 120
   gated contrast pairs — v2 must not un-measure the house. The glass must sit
   ON the token system, not beside it.
3. **Motion without governance breaks the product's own floor.** The v1
   contract collapses everything under prefers-reduced-motion; a spring system
   must obey the same law or v2 is a regression for anyone with vestibular
   sensitivity.

## Replan (what actually ships)

Hand-rolled, dependency-free, on top of the working app:

1. **A spring engine** (`src/lib/springs.ts`, ~100 lines): critically-tunable
   spring integrator on requestAnimationFrame that SLEEPS when settled — no
   continuous rAF. Config presets: `press` (stiff, fast), `tilt` (soft),
   `drift` (slow parallax).
2. **Glass materials** (`src/v2.css`): translucent surfaces with
   backdrop-filter blur, a 1px light-edge (top-lit), layered elevation
   (0/1/2/3 with defined translateZ and shadow-free depth cues), and a
   pointer-tracked SPECULAR SHEEN — a radial highlight that follows the cursor
   across plates, which is what "obsidian reflecting" means in an interface.
   `@supports not (backdrop-filter)` falls back to solid surfaces.
3. **Physics behaviours**: card tilt toward the pointer (max 4°, perspective
   1000px, spring-smoothed, desktop pointer only), button press with mass
   (scale 0.97 + spring return), modal pop (spring overshoot ~1.02), staggered
   list entrance, frieze parallax at three depths.
4. **Rooms stay.** V2 defaults to the obsidian room; all six remain, all
   measured. The glass reads the tokens, so every room gets the material.
5. **Reduced motion**: springs resolve instantly, tilt and sheen disable,
   entrances become fades — one media query gates the whole engine.

Deploys to `gh-pages/v2/` (base `/wardrobe-tracker/v2/`), so v1 stays the root
and v2 is a parallel world at `/v2/`.
