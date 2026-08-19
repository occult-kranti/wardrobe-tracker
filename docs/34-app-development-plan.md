# 34 — The app development plan: Expo, Supabase, and the QR alpha

> **Status:** plan of record · **Owner:** project lead · **Opened:** 2026-08-18
> **Supersedes:** docs/32-the-two-ports.md on the native toolchain only (the
> Capacitor verdict). Its storage research (§"do not adopt SQLite", the photo
> architecture, atomic writes, relative paths) **still stands** and is reused
> below, re-expressed for the Expo filesystem. Its store-operations research
> (accounts, D-U-N-S, BillDesk KYC, review timelines) is untouched — it returns
> verbatim the day Almari leaves the QR alpha for the stores.

This document is the build plan for the native app: **Expo + React Native**,
**Supabase** as the backend, and a **two-week, 20–50-tester alpha distributed
by QR code with no app-store publishing**. The scaffold lives in `app/`.

---

## 1. Decision record

**Decided by the owner: the native app is built with Expo + React Native.**
This supersedes the Capacitor 8.5 verdict in docs/32. The reasons, stated
plainly so the trade is on the record:

1. **Owner call.** Direction settled; this document plans the execution, not
   the argument.
2. **The React mental model carries over.** The team writes React all day.
   React Native reuses the *thinking* — components, hooks, context, the state
   shapes in `src/types.ts` — even where it cannot reuse the DOM-bound code.
   (docs/32's arithmetic stands and is not contradicted: RN reuses knowledge,
   not components. The port is a re-authoring of UI over shared logic.)
3. **OTA updates make a QR alpha possible without stores.** EAS Update serves
   the JS bundle over the air; testers scan a QR and run the app in Expo Go.
   No App Store review, no Play track, no TestFlight. For 20–50 testers over
   two weeks this is the entire distribution story (§8).
4. **One codebase for iOS + Android.** The genuinely platform-specific surface
   is config and QA, same conclusion docs/32 reached for Capacitor.
5. **The web PWA stays exactly as it is.** It remains the free web channel;
   nothing in `src/` changes to accommodate the app. The app ports logic; the
   web never imports the app.

What is given up, honestly: the 33 files / 14,680 lines of web UI, the 889-line
stylesheet and the CSS cascade do not port — the screens are re-authored in RN
against the same design contract. That is accepted knowingly because the alpha
does not need pixel-parity, it needs the maths, the state model, and the tone.

---

## 2. Architecture

### 2.1 The `app/` workspace (scaffolded)

Created with `npx create-expo-app@latest app --template blank-typescript
--no-install`, then `npm install` inside `app/` only. Expo SDK 57, React
Native 0.86.2, React 19.2.3, TypeScript 6.0.3. `tsc --noEmit` is green on the
scaffold. No native build run, no prebuild, no eject — and none planned.

- `app/app.json` — name `Almari`, slug `almari`, scheme `almari`,
  `userInterfaceStyle: "automatic"`, placeholder icon/splash (brand source of
  truth is `public/icon.svg`; rasterize before any alpha build),
  `runtimeVersion: { "policy": "appVersion" }`, and an `updates` +
  `extra.eas.projectId` placeholder pair carrying `REPLACE-WITH-EAS-PROJECT-ID`
  (owner action, §10).
- `app/eas.json` — `development` profile (dev client **false**, the Expo Go
  path, channel `development`) and `preview` profile (internal distribution,
  Android **APK**, channel `preview`). CLI floor pinned at `>= 16.0.0`.
- `app/README.md` — run instructions and the phase map.
- `app/.gitignore` — the Expo template standard (node_modules, `.expo/`,
  `dist/`, native dirs, keystores, `.env*.local`). The repo-root `.gitignore`
  already ignores unanchored `node_modules` and `dist`, so `app/node_modules`
  and `app/dist` are covered twice; no root change was needed.

Target layout as phases land (expo-router's `app/` directory convention
nests inside our `app/` workspace as `app/src/app/` — chosen over the template
default so the router root and the package root stay greppably distinct):

```
app/
  src/
    app/                # expo-router routes: _layout, (tabs)/, screens
    components/         # RN plates, tiles, sheets — component law holds
    lib/                # app-only helpers (storage adapter, sync client)
    tokens/             # design tokens: the six themes as typed objects
    icons/              # hand-coded SVG flats ported via react-native-svg
    assets/fonts/       # Fraunces, Switzer, IBM Plex Mono (local files)
```

### 2.2 Module map — screens mirror the web routes

One screen module per web route in `src/lib/routes.ts`; the web page it ports
is named so nothing is re-designed from memory:

| Screen (expo-router) | Ports | Web source |
|---|---|---|
| `/(tabs)/today` | Today — the two-tap log | `src/pages/Dashboard.tsx` |
| `/(tabs)/closet` | Closet grid + item detail | `src/pages/Closet.tsx` |
| `/(tabs)/outfits` | Outfits | `src/pages/Outfits.tsx` |
| `/(tabs)/feed` | The living feed (local personas) | `src/pages/Feed.tsx` |
| `/(tabs)/more` | The More sheet | `src/components/Layout.tsx` |
| `/calendar` | Calendar | `src/pages/Calendar.tsx` |
| `/ledger` | Ledger (the maths, §6) | `src/pages/Statistics.tsx` |
| `/wishlist` | Wishlist | `src/pages/Wishlist.tsx` |
| `/compare` | Before You Buy | `src/pages/BeforeYouBuy.tsx` |
| `/events` | Events | `src/pages/Events.tsx` |
| `/furniture`, `/furniture/[id]` | The dressing room | `src/pages/Furniture.tsx` |
| `/rail`, `/chats`, `/profile` | Shared Rail (local preview) | `Rail/Chats/Profile.tsx` |
| `/intake` | Photo intake (camera + AI proxy) | `src/pages/Intake.tsx` |
| `/settings` | Settings, storage choice, export | `src/pages/Settings.tsx` |
| `/open` | Wardrobe switcher / sign-in | `src/pages/Door.tsx` |

Tab order and what sits under More follow the web `Layout.tsx`; navigation
decisions that differ (bottom tabs vs the web rail) are a design-pass item
(Phase 3), not Phase 0.

### 2.3 Navigation — expo-router

File-based routing, typed routes experiment on. The router mirrors
`src/lib/routes.ts` one-for-one so deep links (`scheme: almari`) name the same
addresses the web has shipped — `almari://closet` is the same sentence as
`/closet`. The route guard + `safeNext` logic ports verbatim (it is string
arithmetic, already pure).

### 2.4 State — React context + an AsyncStorage adapter

The web's `useLocalStorage` (`src/hooks/useLocalStorage.ts`) is the semantics
contract, and the adapter must reproduce all four of its laws:

1. **Writes never inside the state updater** — one write per committed state,
   coalesced over a 250 ms settle window.
2. **A failed write is said out loud** — the `onError` path surfaces quota and
   serialisation failures in the UI, once per run of trouble, not per keystroke.
3. **Pending writes flush on backgrounding/unmount** — `pagehide`/
   `visibilitychange` map to `AppState` changes in RN.
4. **Migrate on read** — every load passes through `migrate()` (the ported
   `src/lib/migrate.ts`), preserving the lossless-forever promise.

Shape: `WardrobeContext` + `SessionContext` mirroring the web contexts
(`src/context/`), backed by `@react-native-async-storage/async-storage` for
metadata/settings/registry and `expo-file-system` for the wardrobe document
and photos. Storage keys keep their meanings; the names may be native-fresh
(`almari-*`) because key strings are not part of the export format — the
JSON document is, and it must round-trip with the web exporter.

Photo storage inherits docs/32's five rules, re-expressed: the wardrobe
document stores **relative paths, never bytes**; photos live as JPEG files
under `FileSystem.documentDirectory` (`photos/<garmentId>/full.jpg` long edge
1600 q0.82, `thumb.jpg` long edge 400 q0.75); writes are atomic
(write `.tmp`, then `moveAsync` rename); no media-library identifiers are
ever held. AsyncStorage's effective ceiling (~6 MB on Android by default) is
why the document must not carry photos — a few hundred KB of JSON is fine.

### 2.5 Design tokens — the six themes

`src/index.css` holds 44 custom properties × 6 themes (231 declarations —
docs/32 measured). The port is a typed `tokens/themes.ts` module: one
`Record<ThemeName, ThemeTokens>` object, every property a camelCase key, plus
the shared constants (radius 2, hairline widths, the 13px label floor, font
stacks). Themes: `light`, `dark`, `salon`, `gilt`, `dyehouse` (the default —
`THEME_ORDER[0]` in `src/lib/accounts.ts`), `obsidian`, plus `system`
resolving via RN's `useColorScheme`. The theme is device-level state, not
wardrobe-level — the same rule the web landed on, for the same reason
(`toile-theme`, docs comment in accounts.ts). The component law
(`.claude/skills/wardrobe-brand/SKILL.md`) binds RN components unchanged;
`scripts/check-brand.mjs` gains an `app/` pass before the design pass ships.

### 2.6 Icons — hand-coded SVG flats via react-native-svg

`src/components/icons.tsx` holds 46 exported icon components, all
hand-authored flats. Port strategy: mechanical JSX → `react-native-svg`
(`Svg/Path/Line/Circle`), one component per web icon, same viewBox, same
stroke/fill tokens reading the theme object. The 49 generated garment plates
(`src/lib/garmentArt.ts` output) are *generated SVG strings* — on RN they
render through `react-native-svg`'s `SvgXml`, no re-authoring. The full-SVG
feature risk docs/32 noted for `flutter_svg` does not apply to
`react-native-svg` for these plates, but a visual diff pass is a Phase 3
acceptance check.

### 2.7 Fonts

Fraunces (display) and IBM Plex Mono ship as local woff2 in `public/fonts`;
Switzer (UI) is currently a Fontshare CDN link in `index.html` — **native has
no CDN**, so Switzer files must be downloaded and bundled
(`app/src/assets/fonts/`). Load with `expo-font`'s `useFonts`, gate first
paint on load, and pick TTF/OTF over woff2 for reliability on-device
(unverified: woff2 support in `expo-font` — convert if the loader rejects
them). Fallback stacks mirror the CSS: Georgia for Fraunces, system sans for
Switzer, Menlo for IBM Plex Mono.

### 2.8 Shared-code strategy — `packages/shared/` (planned, NOT done)

The pure logic is already framework-free TypeScript — verified today: no
`document`/`window`/`localStorage` references in `dates.ts`, `cost.ts`,
`similarity.ts`, `migrate.ts`, `feedEngine.ts`, `intake.ts`, or `types.ts`.
The lift, when scheduled:

1. Create `packages/shared/` with its own `package.json`
   (`@almari/shared`, private, no build step — both consumers transpile TS
   source directly) and move: `src/types.ts`, and from `src/lib/`:
   `dates.ts`, `cost.ts`, `similarity.ts`, `migrate.ts`, `feedEngine.ts`,
   `intake.ts`, `routes.ts`. DOM-coupled files stay in web (`cutout.ts`,
   `sound.ts`, `install.ts`, all `*Art.ts` generators, `accounts.ts`,
   `anthropic.ts`). `feedEngine.ts` pulls `personaData.ts` +
   `communitySeed.ts` with it — audit those two for photo imports before the
   move (persona data references image paths under `public/`, which web
   serves by URL and native must bundle as assets — the one real seam).
2. **Web consumes** via vite `resolve.alias: { '@almari/shared': ... }` plus
   `tsconfig.app.json` `paths`; imports in `src/` change mechanically.
3. **App consumes** via Metro monorepo config (`watchFolders`,
   `nodeModulesPaths` in `app/metro.config.js`) and matching tsconfig paths
   (`experiments.tsconfigPaths`).
4. **tsconfig:** keep it simple — path aliases in each consumer, no project
   references (references buy build-order guarantees we don't need with
   source consumption, and they fight esbuild).
5. **Test the move with the existing suites**: `test:migrate`, `test:feed`,
   `test:intake` must stay green untouched — they are the proof the lift was
   lossless.

**Risks, named now:**

- **esbuild bundling.** The `scripts/test-*.mjs` suites bundle with esbuild;
  every alias vite knows must be repeated in esbuild's `alias` option or the
  scripts break silently. The verification step is rerunning all suites, not
  eyeballing.
- **Metro resolution.** Monorepo Metro is the classic footgun — duplicate
  `react` copies across root and `app/` cause "invalid hook call" crashes.
  Mitigate: `nodeModulesPaths` pinned, app deps installed only in `app/`,
  and the shared package carries **zero runtime dependencies**.
- **Asset-path seam.** Any shared module that names a `/wardrobe/...` URL
  assumes a web server. Native needs `require()`d assets or shipped files —
  keep URL-building in web code, pass resolved URIs in.
- **Editor DX.** Two tsconfigs pointing at one source; `paths` in both or
  IntelliSense lies while the bundler works.

Until this lift is scheduled, the app does not copy these files — Phase 1
starts after it, so there is exactly one source of the maths.

---

## 3. Backend — Supabase

Auth + Postgres + edge functions. Setup steps and env vars live in
`supabase/README-SETUP.md` (to be authored by the AUTH+SYNC squad; pointed at
from §10). The app treats Supabase as **opt-in sync**, never a requirement.

*(Amended 2026-08-19 by owner decision — `docs/35` decision 2: the H3 backend
item from `docs/33` Phase H — E2E-encrypted sync with per-device keys and
opaque blobs — is promoted from optional to the committed trust target, the
gate for sync leaving off-by-default. Until it lands, the §3.2 blob is
operator-readable and user-facing copy says so plainly.)*

### 3.1 Schema v1

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  handle text unique,
  created_at timestamptz not null default now()
);

create table wardrobes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table wardrobes enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own wardrobes" on wardrobes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3.2 Sync model — whole-state blob, last-writer-wins (alpha semantics)

`wardrobes.state` is the entire migrated `AppState` JSON document — the same
blob `useLocalStorage` writes today. This is deliberate: Almari has no
queries (docs/32), so row-per-item normalisation buys nothing and costs a
second schema to keep honest. Alpha conflict rule is **last-writer-wins on
`updated_at`**: on pull, newer remote replaces local; on push, local wins if
its clock is newer. Multi-device simultaneous editing will lose writes; the
alpha accepts this because the storage-choice UI (§4) frames sync as backup,
not collaboration. `updated_at` bumps on every write, server-side trigger or
client-stamped (client-stamped for alpha; note clock skew in §11).

### 3.3 The ai-proxy edge function

OpenAI-compatible chat-completions passthrough to Kimi; the API key lives
server-side only. **Already deployed as a Cloudflare worker** at
`workers/ai-proxy` (`almari-ai-proxy`, `POST /v1/chat/completions` →
`https://api.kimi.com/coding/v1/chat/completions`, secret `KIMI_KEY`, no
logging). The app should call **one** proxy, not two: keep the Cloudflare
worker (done, tested) and treat a Supabase edge-function port as optional
consolidation, not new surface. Decision recorded for the owner (§10).

### 3.4 Phase-2 tables — design only, product-gated

```sql
-- NOT FOR ALPHA. Design sketch only.
create table community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  post jsonb not null,          -- FeedPost from src/types.ts
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  household jsonb not null,     -- Household from src/types.ts
  created_at timestamptz not null default now()
);
```

Networked social features are a **product gate, not a technical one**: the
docs/11 panel rejected feeds and followers, and D1 (docs/33) permits only
metric-free sharing. These tables exist here so the day the panel
conversation happens, the schema question is already answered — not before.
RLS for scoped sharing (`postVisibleTo` in `src/types.ts`) is designed then,
not now.

---

## 4. Storage choice per user

Every wardrobe chooses, at creation and changeable any time in Settings:

- **On this device (default).** AsyncStorage + filesystem photos. Nothing
  leaves the phone. This is the house promise and stays the default.
- **Synced (opt-in).** The wardrobe blob also pushes to Supabase under the
  signed-in account; pull-on-launch with LWW (§3.2).

**UX copy points** (copy law applies — no exclamation points, address the
clothes):

- Choice moment (wardrobe creation): *"This wardrobe lives on this device.
  Sync is off; you can turn it on in Settings whenever."*
- Enabling sync: *"A copy of this wardrobe will be kept with your Almari
  account. The copy on this device is always the one that opens offline."*
- Sign-out: *"Signing out stops syncing. Nothing on this device is removed."*
- Account deletion: *"Deleting your account removes every synced copy. The
  wardrobes on this device stay yours."*

**Edge cases, decided now:**

- **Sign-out never deletes local data.** The local blob and photos are
  untouched; the sync link detaches.
- **Offline queue:** pushes attempted and failed are retried on next launch
  and on network return (`@react-native-community/netinfo`); there is no
  visible queue UI in alpha — the last-synced line in Settings is the truth.
- **Conflict:** newer `updated_at` wins, whole blob. Ties: keep local (the
  copy in the hand beats the copy in the cloud).
- **Sample wardrobes never sync** — `Account.isSample` rows are excluded at
  the sync client, not by policy.
- **Account deletion wipes cloud rows** via `on delete cascade` from
  `auth.users`; the app also issues explicit deletes first so the action is
  one user-visible step with a confirmation.
- **Photos are not synced in alpha** (blob carries paths, not bytes —
  docs/32's rule). Sync therefore restores metadata, not pictures; the
  Settings copy must say so plainly. Photo sync is a phase-2 decision.

---

## 5. The maths

Formulas and their single sources. The native app must not re-derive any of
these — it imports `packages/shared` (§2.8). Recorded here so the port can be
reviewed against truth:

- **Cost-per-wear** (`src/lib/cost.ts`): sanitiser `isRecordedAmount`
  (finite number ≥ 0; a recorded 0 is a real answer — inherited, gifted).
  Basis = `cost + Σ repairs` (`costBasis`; `RepairEntry` reserved, not yet a
  field — the seam is the point). CPW = `basis / floor(wearCount)` with
  precedence `no-cost → no-wears → free → ok`, exactly one reason returned.
  Aggregate CPW (`aggregateCostPerWear`): Σbasis ÷ Σwears, denominator
  `costed-wears` (only paid-for pieces — a 96-wear heirloom must not deflate
  the average) or `all-wears`, default `costed-wears`. Formatters:
  `formatMoney` (whole, separators), `formatPrice` (value-preserving),
  `formatPerWear` (2dp, `—` for null).
- **Utilization %:** **the web deliberately has none** — a percentage-of-
  closet-worn is a completion meter, and the design law bans those
  (`src/types.ts` furniture docs, docs/06). The Ledger instead shows
  wears-by-category (count + wear share per category,
  `src/pages/Statistics.tsx` §categories). The native app must not invent a
  utilization number without a design-contract amendment.
- **Re-wear rate** (`src/pages/Statistics.tsx` §re-wear): wears ÷ distinct
  pieces worn per whole month, over the last ≤6 complete months only
  (partial months excluded; the rate falls mechanically as wardrobes grow,
  so it is windowed, never a lifetime trend). Displayed per month plus a
  simple average.
- **Monthly activity** (`src/pages/Statistics.tsx` §months): one pass builds
  a 12-month series anchored on the current month — wears per month
  (log.itemIds ∩ active items), distinct pieces per month, spend owned by
  month-end, cumulative costed wears, and cumulative CPW (spend ÷ cumulative
  costed wears; the current month is flagged `partial` and never charted
  beside whole months). Minimum 3 months before the CPW curve is shown.
- **Similarity scoring** (`src/lib/similarity.ts`) — exact weights:
  `score = 0.45·colorCloseness + 0.25·occasionOverlap + 0.15·sameCategory +
  0.10·brandMatch + 0.05·nameOverlap`, shown when `score ≥ 0.3` with ≥1
  stated reason, top 4. `colorCloseness` = `max(0, 1 − d/250)` where `d` is
  the redmean perceptual distance. Cross-category matches need a second
  signal (closeness > 0.75 or a shared name word) — a greige belt is not a
  camel coat. Retired items never match; the query item is excluded by id.
- **Deterministic persona schedule** (`src/lib/feedEngine.ts`): seeded PRNG
  = FNV-1a 32-bit hash (offset `2166136261`, prime `16777619`) over
  pipe-joined parts, then a mulberry-style finaliser (`+0x6d2b79f5`, xorshift
  mix) → uniform 0..1. Same persona + same date ⇒ same post; ids are
  `feed-<personaId>-<date>` so boot merges are idempotent and tombstones
  (`removedPostIds`) stick. Window: `SCHEDULE_DAYS = 21` back, pruned past
  `PRUNE_DAYS = 30`. Cadence per persona: `0.28 + rand('pace')·0.27`
  (roughly every 2nd–4th day). Post hour: `17 + floor(rand·6)`.
- **Dates** (`src/lib/dates.ts`): all log dates are local `YYYY-MM-DD`,
  never `toISOString()` — that shifts days west of UTC in the evening. The
  port must keep `formatLocalDate`/`addDays`/`daysSince` semantics exactly;
  DST-safe because arithmetic is via `Date` at local midnight, not
  millisecond addition.

---

## 6. Phased build run

Each phase lists steps, acceptance checks, and the edge cases that must be
tested before it closes. Alpha gates (docs/28 §4.4) bind Phase 4: ≤2-tap
assisted logging, ≥60% week-1 diary completion, ≥40% week-12 logging — all
measured manually, no telemetry.

### Phase 0 — setup

**Steps:** workspace polish (done: scaffold, app.json, eas.json, README);
tokens module (§2.5); fonts bundled + `useFonts` gate (§2.7); icon port
harness + first five icons (§2.6); expo-router skeleton with every route
from §2.2 rendering its name; AsyncStorage adapter implementing §2.4's four
laws; `packages/shared` lift (§2.8); CI (§9).

**Acceptance:** `npx expo start` QR boots the skeleton in Expo Go on one
Android and one iPhone; every route renders; theme switch repaints all six
rooms; `tsc --noEmit` + jest green in CI; web suites still green after the
shared lift.

**Edge cases:** first-boot font fallback before load completes; `system`
theme flips while the app is backgrounded; AsyncStorage returning corrupted
JSON on first boot (adapter falls back to `initialState`, says nothing is
lost, offers export of the corpse).

### Phase 1 — basics

**Steps:** Supabase email+password auth (`@supabase/supabase-js` with an
AsyncStorage session adapter); storage-choice UI (§4); closet CRUD with
photos — `expo-image-picker` for capture/library, `expo-image-manipulator`
to compress to the docs/32 geometry (full 1600 q0.82 / thumb 400 q0.75) —
this is where the "unify the three intake paths behind one resize" lesson
lands on day one, not as a refactor; Today two-tap log; local-first default
confirmed end-to-end.

**Acceptance:** add a piece from camera on a real phone, see it in the grid
in under a second; two taps log a wear (stopwatched — the §4.4 gate starts
here); kill the app mid-write, nothing lost (atomic writes); sign in, sync
on, second device pull restores metadata.

**Edge cases:** photo permission denied (copy names the door, offers
library-only path); a 12 MP photo compressed before write; wear logged at
23:59:59 and again at 00:00:01 (two dates, both count); sign-in with no
network (local wardrobe opens anyway — sync is never the gate).

### Phase 2 — features

**Steps:** outfits (build, wear, photograph); calendar (planned vs worn —
`planned` flag semantics from `src/types.ts`); ledger (§6 maths via shared);
wishlist + cooling-off; before-you-buy (similarity via shared); intake —
camera → ai-proxy (§3.3) → forgiving parse (shared `intake.ts`) → review
screen; feed — the local persona engine (shared `feedEngine.ts`), no
network, no metrics; settings/export — the export must produce a file the
**web app can import** and vice versa (the round-trip test is the alpha's
migration story).

**Acceptance:** every §2.2 screen functional; export→import round-trip
lossless in both directions against `scripts/test-migrate.mjs` fixtures;
feed repopulates deterministically after reinstall from the same personas.

**Edge cases:** AI proxy down / key exhausted → intake falls back to manual
entry, copy says the stranger went home; import of a hand-edited export with
`cost: "420"` (migrate parses, never crashes — the historical modal bug);
planned log for a date that passes unconfirmed (stays a plan, never becomes
a wear).

### Phase 3 — design pass

**Steps:** brand fidelity pass against
`.claude/skills/wardrobe-brand/SKILL.md` (radius 2, letterpress hairlines,
13px label floor, copy law); motion — springs ported from
`src/lib/springs.ts` to reanimated equivalents, reduced-motion honoured; the
six themes polished dark-first; tablet/desktop layouts (wide grids, rail
analogues); icon + garment-plate visual diff vs web.

**Acceptance:** design-critic screenshot review passes on 390px phone and
10" tablet, all six themes; `check-brand` extended to `app/` is green.

**Edge cases:** dynamic type at 200% (nothing clips, sheets still dismiss);
long furniture names (the 60-char rule is a drawing limit, not a storage
limit — clip at render, never truncate data); RTL smoke pass.

### Phase 4 — edge cases + hardening

**Steps + tests (each is an acceptance line):**

- **Corrupted storage:** garbage in the wardrobe key → migrate falls back,
  app opens, user told once, corpse exportable.
- **Quota:** fill storage (hundreds of compressed photos) → the `onError`
  law fires, in-memory work survives, copy says what to do.
- **Offline-first boot:** airplane-mode cold start opens the wardrobe with
  zero network; sync retries silently.
- **Timezones/DST:** wear logs across a DST jump; a log made at 23:50 in
  IST visible correctly after flying to PST (dates are local-day strings —
  the record says the day you wore it where you were); `daysSince` never
  returns negative.
- **Migration from web export JSON:** every fixture in
  `scripts/test-migrate.mjs` imports identically on-device.
- **Accessibility:** every control carries an `accessibilityLabel` (screen-
  reader pass over Today/Closet/log flow); dynamic type; contrast per theme
  held to the web's `test:contrast` ratios.
- **Performance:** 500-piece closet with photos — grid scroll at 60 fps on a
  mid-range Android (FlashList, thumb-only in grids); cold start to
  interactive < 2 s on the same device.

**Alpha exit gates (docs/28 §4.4, pre-registered):** median assisted logging
≤ 2 taps; ≥60% diary week-1 completion; ≥40% week-12 logging. Measured by
moderated sessions + diary studies, never by instrumenting the app.

---

## 7. QR alpha distribution

**Channel 1 — Expo Go + EAS Update (both platforms).** With `updates.url`
configured (owner supplies the EAS project id, §10) and `expo-updates`
installed: `eas update --branch preview --message "alpha 1"` publishes an
OTA bundle; the project page on expo.dev shows a QR; testers install **Expo
Go** once and scan. Every subsequent `eas update` on the `preview` channel
reaches them on next launch — this is how the two-week iteration loop works
without re-distributing anything. Runtime pinning: `runtimeVersion:
{ policy: "appVersion" }` (already in `app.json`) means updates only land on
matching app versions — bump `version` when native deps change so an
incompatible JS bundle can never load over an older Expo Go.

**Channel 2 — Android fallback APK.** `eas build --profile preview
--platform android` → internal-distribution APK with its own link/QR. For
testers whose Expo Go misbehaves or who want a real icon. The APK embeds
the `preview` channel, so OTA updates still flow.

**iOS is Expo Go only.** No store, no TestFlight, no Apple Developer account
needed for 20–50 testers. If a tester has no appetite for Expo Go, the PWA
is the honest fallback — it is the same product on the web.

**The two-week plan:** day 0 — publish alpha 1, QR to the cohort with the
docs/33 G2 kit (consent text, diary template, feedback form); days 1–13 —
bug-fix `eas update`s as needed (OTA, no re-scan); day 7 — diary check-in;
day 14 — close-out survey + voluntary research-export collection under the
§2.5 protocol (written consent, 18+, fixed retention, redacted variant
preferred).

**Known limits and mitigations:**

- **Expo Go supports only built-in SDK modules.** Constraint: Phase 1–2
  dependency choices must stay inside the Expo SDK or the Expo Go path
  dies. Mitigation: any must-have native module (none planned) forces
  channel 2 / dev builds for everyone.
- **Expo Go tracks the latest SDK.** Our SDK-57 pin drifts from the store
  build over months; for a two-week alpha this is a non-issue — publish
  while current, verify on a fresh install of Expo Go the day before.
- **OTA updates need the project id + channel hygiene.** One channel
  (`preview`) for the whole alpha; no per-tester channels at this scale.
- **Expo Go is a moving target** (Expo steers toward dev builds).
  Mitigation in §11: the APK path already works; an iOS dev-build path is
  a one-profile eas.json addition, gated on the owner's Apple account.

---

## 8. Tooling & environments

- **Node 24 (24.18 verified) + npm (11.16)** — both workspaces. App installs
  happen **only inside `app/`**; root stays web-only.
- **Python 3.12 + Pillow** via `requirements.txt` in a venv — build-time
  photo/icon pipeline only (rasterising `public/icon.svg` to the app icon
  set; garment plates). Never a runtime dependency, never inside `app/`.
- **eas-cli** (`npm i -g eas-cli` or `npx eas`) — updates and preview builds.
  Owner-authenticated.
- **Playwright stays web-only.** App testing: **jest + jest-expo +
  @testing-library/react-native**; pure-logic suites reuse the shared
  package's fixtures (the `scripts/test-*.mjs` corpus stays the web's
  source of truth).
- **CI sketch (GitHub Actions),** one job appended to the existing workflow
  or a new `app.yml`:

```yaml
name: app
on: [push, pull_request]
jobs:
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
        working-directory: app
      - run: npx tsc --noEmit
        working-directory: app
      - run: npm test
        working-directory: app
```

  EAS builds do **not** run in CI for alpha — `eas build` is an
  owner-triggered manual step (credits and credentials stay human).

---

## 9. Owner asks

Things only the owner can provide, in the order phases will need them:

1. **EAS account + project id.** Create the Expo account, run `eas init` in
   `app/`, replace both `REPLACE-WITH-EAS-PROJECT-ID` placeholders in
   `app/app.json`. Blocks §7 channel 1. (Free tier is enough for the alpha.)
2. **Supabase setup.** Create the project, run §3.1's SQL, hand over the
   anon URL + key. Steps to live in `supabase/README-SETUP.md` — **to be
   authored by the AUTH+SYNC squad** (wave 3); this doc only points.
3. **Proxy consolidation decision:** keep the deployed Cloudflare worker
   (`workers/ai-proxy`) as the single ai-proxy, or port it to a Supabase
   edge function. Default: keep Cloudflare; port only if one-vendor ops
   becomes worth a redeploy.
4. **Apple Developer account** — only if/when leaving Expo Go (dev builds,
   TestFlight, store). Not needed for the QR alpha. $99, knowingly deferred.
5. **Phase-2 social features** — the panel conversation docs/11 requires
   before `community_posts`/`households` graduate from §3.4's sketch.
6. **Brand assets:** confirm `public/icon.svg` is the mark to rasterise for
   the app icon/splash (the scaffold ships template placeholders).

---

## 10. Risks & mitigations

| Risk | Shape | Mitigation |
|---|---|---|
| **Expo Go deprecation path** | Expo steers to dev builds; Go could shrink or vanish mid-programme | Android APK channel already in eas.json; iOS dev-build profile is a one-block addition gated on the owner's Apple account; the PWA is the standing fallback for every tester |
| **OTA limits** | Updates serve JS only — a native-module change silently bricks channel 1 | `runtimeVersion: appVersion` pinning (set); rule: bump `app.json` version on any native-dep change; CI lists added native deps on PR |
| **Kimi quota shared across alpha** | One server-side key, 50 testers hammering intake | Rate-limit at the proxy (per-IP/day) before alpha 1; intake degrades to manual entry with honest copy; quota dashboard check weekly |
| **Blob-sync data growth** | Whole-state JSON per write; wardrobes `state` row grows with the closet | A 500-garment wardrobe without photos is a few hundred KB (docs/32 measured) — fine; revisit only if a real blob crosses ~1 MB (log row size at sync, alert the lead) |
| **Schema versioning** | Web and app evolve; a newer export must never die on an older app | `SCHEMA_VERSION` lives in the shared `migrate.ts` port; lossless-forever + unknown-keys-preserved are already the law; web↔app round-trip test in Phase 2 acceptance |
| **LWW data loss** | Two devices, one wardrobe, simultaneous edits — newer wins, edits lost | Alpha accepts it; §4 copy frames sync as backup; post-alpha, per-field merge is a designed next step, not a patch |
| **Client clock skew** | `updated_at` client-stamped in alpha | Server-side `now()` trigger is the one-line fix when it bites; conflicts also resolve to local on ties |
| **woff2 font loading** | `expo-font` woff2 support unverified on-device | Convert to TTF/OTF at Phase 0 if the loader rejects; Switzer downloadable from Fontshare (free licence — confirm the licence file travels into `app/src/assets/fonts/`) |
| **Metro monorepo hooks crash** | Duplicate React from root + app node_modules | Shared package has zero deps; `nodeModulesPaths` pinned; install only inside `app/` |

---

## 11. What is not verified

- **`expo-font` loading woff2 on-device** — assumed convertible, not tested.
- **Expo Go's current SDK parity with the SDK-57 scaffold** — verify on a
  fresh store install the day before alpha 1 ships.
- **EAS Update free-tier limits** (bandwidth/monthly active users at 50
  testers) — expected ample, not confirmed against the August 2026 pricing
  page.
- **AsyncStorage effective ceiling per Android device** — the ~6 MB figure
  is historical default; not load-tested on the alpha device matrix.
- **`eas.json` CLI floor `>= 16.0.0`** — a placeholder pin; set it to the
  version the owner actually installs.
- **The `updates.url`/`projectId` placeholders are unfilled** — by design;
  §9 item 1.
