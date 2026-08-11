# Verification

Everything in this project is checked by something that fails loudly. This is the
map of what runs, what it protects, and how to run it.

```bash
npm run verify        # build + brand contract + migration + demo data (no browser)
npm run test:smoke    # full browser suite — needs a preview server, see below
npm run shots         # screenshots of every route, mobile + desktop
```

## The suites

| Command | What it protects | Count |
|---|---|---|
| `npm run build` | Typecheck + production bundle | — |
| `npm run lint` | oxlint **and** the brand contract | — |
| `npm run lint:brand` | The Toile design contract, mechanically | — |
| `npm run test:migrate` | Nobody's closet is ever lost to a schema change | 22 |
| `npm run test:demo` | The sample wardrobe stays complete, consistent, and offline-safe | 43 |
| `npm run test:art` | Every baked garment plate actually renders in Chromium | 1/plate |
| `npm run test:contrast` | Every text pair in every theme clears WCAG AA | 11/theme |
| `npm run test:smoke` | The real app in a real browser | 36 |

### `lint:brand` — the design contract, enforced

`scripts/check-brand.mjs`. The engineering judge warned that Toile's
distinctiveness lives in labour-intensive details that get cut first under
deadline, so they are machine-checked: no `lucide-react`, no emoji, no raw hex
outside the token sheet, radius 2 only, no drop shadows, exactly one pattern
notch per icon, the banned-copy list, and the one-exclamation-point budget.

Adding a colour? Add a **token** in `src/index.css`. The linter will reject a
literal hex in a component, which is the point.

### `test:migrate` — the lossless promise

`scripts/test-migrate.mjs` feeds a real v1 payload through `src/lib/migrate.ts`
and asserts every wear survives, custom categories and occasion tags are adopted
rather than dropped, `purchased: boolean` becomes `status`, unknown top-level
keys round-trip, and migration is idempotent and safe on null/garbage.

**If you change `AppState`, add a case here first.** "Lossless export, forever"
is a promise to users, and this file is where it is kept.

### `test:demo` — the sample wardrobe

`scripts/test-demo.mjs` asserts the demo exercises every feature at once and
never reaches the network (all imagery is inline SVG data-URIs, so the demo
honours the offline-first promise too). Since the history became simulated, it
also asserts the fixture obeys `logWear`'s own invariant — every `wearCount`
and `lastWorn` equals what the logs imply, outfit totals match, nothing is worn
before it was added or after it retired, the charted year has no empty months,
and the seasonal swing is actually visible. The Shared Rail demo is pinned by
twelve more: three profiles, one group, all four request states, resolving
references, and no gendered address anywhere in the circle copy.

### `test:art` — the drawn plates

`scripts/test-art.mjs` loads every baked garment plate from
`src/lib/garmentArt.ts` into a real Chromium `<img>` and asserts it renders.
A malformed SVG in a data-URI throws nowhere — it just draws the broken-image
glyph in the middle of the closet — which is exactly how five plates once
shipped broken while every other suite stayed green. Regenerate plates with
`node scripts/build-garment-art.mjs <dir>`.

### `test:smoke` — the app in a browser

`scripts/smoke.mjs` drives Chromium over a **v1-seeded** closet: all 8 routes
render with no console errors, legacy data migrates and displays, no emoji leak
into the UI, every image has alt text, every button has an accessible name, every
interactive target is ≥44px, dark tokens apply, the compare page carries no
commerce language, and empty states draw real artwork.

```bash
npx playwright install chromium   # once
npm run build && npx vite preview --port 4173 &
npm run test:smoke
```

Two traps this harness has already fallen into — don't reintroduce them:

1. **Hash navigation does not reload the app.** `page.goto(url + '#/route')` from
   the same document is a same-document navigation, so React keeps its in-memory
   state and never re-reads localStorage. Every route visit calls `page.reload()`.
   Without it the whole suite silently tested an *empty* closet and still passed.
2. **`waitUntil: 'networkidle'` hangs** when the sandbox blocks Google Fonts and
   Fontshare. The harness aborts font requests and waits on `domcontentloaded`,
   and filters those aborts out of the console-error assertion so they aren't
   miscounted as app errors.

### `shots` — screenshots

`scripts/screenshot.mjs` seeds the real demo wardrobe and captures all 8 routes at
390×844 and 1440×900, plus empty states. Use these for design review — several
real defects (garments dissolving into the mat, sub-44px targets) were only
visible in pixels, not in code.

## Bugs these suites have actually caught

Kept as a record of what "verified" bought, and why the checks are shaped as they
are:

- Wear logs shifting by a day for anyone not on UTC (`toISOString()` on a local date)
- Outfit wears never crediting the pieces inside the outfit
- Calendar scheduling logging every future plan as *today*
- Export silently dropping the entire wishlist
- Buttons at 40px and filter chips at 32px, under the 44px floor
- Near-black garments rendering *darker than the mat*, losing their silhouette
- The smoke suite itself passing against an empty closet
