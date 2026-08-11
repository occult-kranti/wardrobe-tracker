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
| `npm run test:migrate` | Nobody's closet is ever lost to a schema change | 25 |
| `npm run test:demo` | The sample wardrobes stay complete, consistent, and offline-safe | 82 |
| `npm run test:art` | Every baked garment plate actually renders in Chromium | 1/plate |
| `npm run test:contrast` | Every colour pair in every room clears its floor | 18/room |
| `npm run test:smoke` | The real app in a real browser | 50 |

### `lint:brand` — the design contract, enforced

`scripts/check-brand.mjs`. The engineering judge warned that Toile's
distinctiveness lives in labour-intensive details that get cut first under
deadline, so they are machine-checked: no `lucide-react`, no emoji, no raw hex
outside the token sheet, radius 2 only, no drop shadows, exactly one pattern
notch per icon, the banned-copy list, and the one-exclamation-point budget.

Four rules were added after they had each already cost something:

- **`no-raw-control-bytes`** — twice now a raw control byte has shipped and been
  invisible in every editor and every review. A heredoc emitted 0x08 where a
  word-boundary escape was meant, producing an unmatchable regex that silently
  blanked two garment tiles; and two raw NULs made the app's largest page read as
  binary, so grep, git grep and ripgrep all returned nothing for it. Written with
  `charCodeAt` and no escape sequences at all, because the first draft of this
  very rule had its escapes written as the bytes it forbids.
- **`every-room-declares-every-colour`** — a theme block that omits a token does
  not fail. It silently inherits the light room's value, so one missing line
  ships an ink-on-ink surface that no page-level review catches.
- **`the-dark-room-agrees-with-itself`** — the dark palette is declared twice,
  once under `prefers-color-scheme` and once under `data-theme`. Nothing compared
  them, so editing one and forgetting the other made explicit dark quietly stop
  matching automatic dark.
- **`the-mark-is-the-seal-colour`** — the app icons live outside `src/`, and
  `index.html` URL-encodes its hex as `%23BE1231`, which the raw-hex pattern
  cannot match even where it does look. The one colour a user sees before the app
  loads was invisible twice over. The allowed palette is derived from the token
  sheet, so changing a token forces the icons to follow.

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

### `test:contrast` — every room, measured

`scripts/test-contrast.mjs` reads the **real computed tokens** out of a browser
for each theme and measures every colour pair the app actually renders. It exists
because a table in a document cannot fail a build: themes get added by humans
with a colour picker, and the first run of this check found the shipped *dark*
theme — the default — missing AA on `accent` over `sunken` by 0.01. See
`docs/13-the-salon.md`.

Text pairs answer to AA's 4.5:1. Graphics — the 2px rule under a primary button's
label, the wax seal against its ground — answer to the **3:1 of WCAG 1.4.11**,
because holding a hairline to a text bar only darkens a palette for no legibility
gained. `border/bg` is measured and printed but never gates: a chalk hairline is
decorative and no clause governs it, so failing the build on a number nobody
agreed on would be theatre.

Two pairs were added after a judge pass walked the app by hand and found what the
suite was not looking at: `accent/mat`, where the dark room's accent had been
sitting at **4.37:1 under AA on the tile every garment photograph lands on**, and
`chalk/seal` + `seal/bg` for the mark. 54 gated pairs across three rooms.

### `test:art` — the drawn plates

`scripts/test-art.mjs` loads every baked garment plate from
`src/lib/garmentArt.ts` into a real Chromium `<img>` and asserts it renders.
A malformed SVG in a data-URI throws nowhere — it just draws the broken-image
glyph in the middle of the closet — which is exactly how five plates once
shipped broken while every other suite stayed green. Regenerate plates with
`node scripts/build-garment-art.mjs <dir>`.

### `test:smoke` — the app in a browser

`scripts/smoke.mjs` drives Chromium over a **v1-seeded** closet: all 13 routes
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

`scripts/screenshot.mjs` seeds the real demo wardrobe and captures every route at
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
- The sample wardrobe asserting 639 wears while its own logs implied 133
- Five garment plates baked into malformed SVG, rendering as broken-image glyphs
- The default dark theme failing WCAG AA on one pair by 0.01
- Persona costs generated at rupee magnitudes and printed with a dollar sign
- The accent failing 1.4.11 on the selected chip's eyelet — 2.11–2.72:1 in three
  rooms, on the atom the app repeats more than any other
- The dark room's accent under AA on the photo mat, in the shipped default
- Two chip rows drawn 4px ON TOP of each other, because Tailwind v4 emits
  `space-y-*` at zero specificity and the `-mb-1` beside it replaced the gap
  rather than trimming it
- A page with a working context method that nothing ever called, and an empty
  state with no action — Events could not be reached at all
- Two raw NUL bytes making the app's largest page invisible to grep, git grep and
  ripgrep, which is why a sweep of five horizontal scrollers fixed only four
- `blockOf` in the brand linter matching the wrong CSS block, so the
  every-room-declares-every-colour check had been comparing the dark room against
  itself since the day it was written
