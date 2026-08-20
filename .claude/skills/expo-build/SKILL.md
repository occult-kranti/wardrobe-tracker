---
name: expo-build
description: The operational digest for building Almari's native app in app/ (Expo SDK 57 + React Native). Load before ANY work inside app/ - it pins the SDK docs rule, the shared-code strategy, the Supabase backend facts, the QR alpha distribution flow, and the web suites that must keep passing.
---

# Almari — the Expo build, working rules

The plan of record is `docs/34-app-development-plan.md`. This is the
operational digest; when the two disagree, the doc wins and this file gets
fixed. Companion: `.claude/skills/wardrobe-brand/SKILL.md` — the component law
(radius 2, letterpress hairlines, 13px label floor, copy law) binds React
Native components unchanged.

## The one hard rule

**Expo HAS CHANGED.** Before writing any code in `app/`, read the exact
versioned docs at https://docs.expo.dev/versions/v57.0.0/ (`app/AGENTS.md`,
the only file `app/CLAUDE.md` loads). APIs you remember may be renamed or
removed; check the versioned page, not memory.

Pinned versions (`app/package.json`): Expo SDK `~57.0.14`, React Native
`0.86.2`, React `19.2.3`, TypeScript `~6.0.3`.

## Shared-code strategy — `packages/shared/` (planned, NOT done)

The pure logic is framework-free TypeScript, verified: no `document`/`window`/
`localStorage` in `dates.ts`, `cost.ts`, `similarity.ts`, `migrate.ts`,
`feedEngine.ts`, `intake.ts`, or `types.ts`. The lift (docs/34 §2.8), when
scheduled:

1. Create `packages/shared/` (`@almari/shared`, private, no build step) and
   move `src/types.ts` plus from `src/lib/`: `dates.ts`, `cost.ts`,
   `similarity.ts`, `migrate.ts`, `feedEngine.ts`, `intake.ts`, `routes.ts`.
   DOM-coupled files stay in web (`cutout.ts`, `sound.ts`, `install.ts`,
   `*Art.ts`, `accounts.ts`, `anthropic.ts`). `feedEngine.ts` pulls
   `personaData.ts` + `communitySeed.ts` — audit those for photo imports
   first; web serves `/wardrobe/...` by URL, native must bundle assets (the
   one real seam).
2. Web consumes via vite `resolve.alias` + `tsconfig.app.json` paths. **Every
   alias vite knows must be repeated in the `esbuild` alias option in the
   `scripts/test-*.mjs` suites or they break silently.**
3. App consumes via Metro monorepo config (`watchFolders`, `nodeModulesPaths`)
   + tsconfig paths. Duplicate `react` copies cause "invalid hook call" —
   the shared package carries zero runtime dependencies.
4. Proof the lift was lossless: `test:migrate`, `test:feed`, `test:intake`
   stay green untouched.

**Until the lift lands, the app copies nothing** — Phase 1 starts after it,
so there is exactly one source of the maths (docs/34 §5 records the formulas
to review against: CPW precedence, similarity weights 0.45/0.25/0.15/0.10/
0.05, FNV-1a + mulberry PRNG, local `YYYY-MM-DD` dates).

## Supabase facts

- Project `wvupsqfevlrmhqfjreyx` — URL `https://wvupsqfevlrmhqfjreyx.supabase.co`.
- Tables `profiles` and `wardrobes` (`state jsonb`, `updated_at`); RLS is
  owner-only (`auth.uid() = id` / `= user_id`). Setup SQL: `supabase/setup.sql`
  (idempotent); runbook: `supabase/README-SETUP.md`.
- The publishable anon key lives in `src/lib/supabase.ts` — safe by design;
  RLS is the lock. Secrets live in Supabase's secret store, **never in the
  repo**; `KIMI_KEY` is set.
- Sync semantics: whole-state blob, last-writer-wins by `updated_at`
  (client-stamped in alpha; ties keep local). E2E-encrypted sync is the
  committed trust target (docs/35 owner decision 2); until it lands the blob
  is operator-readable and the copy says so.

## The ai-proxy edge function

`supabase/functions/ai-proxy/index.ts` — a pass-through, Deno runtime:

- App POSTs an OpenAI-compatible chat-completions body to
  `/functions/v1/ai-proxy` **with no key**; the function attaches `KIMI_KEY`
  and forwards untouched to `https://api.kimi.com/coding/v1/chat/completions`.
- Model id is `k3` (Kimi K3 by Moonshot AI). K3 is a **reasoning model**:
  reasoning rides in `reasoning_content` and spends the same token budget, so
  `max_tokens` must be ≥ 8000 (web uses 8000). The answer is always
  `choices[0].message.content`.
- `verify_jwt = false` (set in `supabase/config.toml`) — the app has no key to
  send, so CORS is open and the key is the lock. It logs and stores nothing.
- Redeploy: `supabase functions deploy ai-proxy` (from the repo root, after
  `supabase link --project-ref wvupsqfevlrmhqfjreyx`); from elsewhere add
  `--no-verify-jwt`. A 503 "not configured" means `KIMI_KEY` is unset or the
  deploy predates the secret — redeploy.
- `workers/ai-proxy` is the parked Cloudflare attempt (a worker cannot fetch
  Cloudflare-fronted upstreams); the Supabase function is the one proxy.

## QR alpha distribution

- EAS project id: `1b9ec18c-58dc-4052-a50d-219cb2376e64` (owner's Expo login:
  occult-kranti). **Note:** the id currently sits in a stray repo-root
  `app.json`; `app/app.json` still carries `REPLACE-WITH-EAS-PROJECT-ID`
  placeholders in `updates.url` and `extra.eas.projectId` — swapping them is
  an owner/build-squad action before any OTA publish.
- Channel 1 — Expo Go + EAS Update: `eas update --branch preview --message
  "alpha N"` publishes OTA; the expo.dev project page shows the QR; testers
  install Expo Go once and scan. One channel (`preview`) for the whole alpha.
- Channel 2 — Android fallback: `eas build --profile preview --platform
  android` → internal-distribution APK, embeds the `preview` channel.
- iOS is Expo Go only — no store, no TestFlight for the alpha.
- **The store builds of Expo Go lag the SDK.** Confirmed live 2026-08-19: the
  Play Store Expo Go does not support SDK 57 (Expo is "still waiting on
  approval"), so a fully-updated phone still shows "Project is incompatible
  with this version of Expo Go". The fix is on the device, never in the code:
  open https://expo.dev/go on the phone, select SDK 57, install the Android
  build from there — or plug the phone in over USB and press `a` in a running
  `npx expo start` (the CLI installs the matching Expo Go itself). The alpha
  kit and every QR page must link expo.dev/go, not the Play Store.
- `runtimeVersion: { policy: "appVersion" }` is set: bump `app.json` `version`
  on any native-dependency change so an incompatible JS bundle can never load
  over an older Expo Go. Expo Go supports only built-in SDK modules — Phase
  1–2 dependency choices must stay inside the Expo SDK.

## The `app/` layout

Scaffolded from `create-expo-app --template blank-typescript` (no prebuild,
no eject — none planned). Today: `App.tsx`, `index.ts`, `app.json`, `eas.json`
(`development` = Expo Go path; `preview` = internal APK), `assets/`
(placeholder icon/splash — rasterize `public/icon.svg` before any alpha
build). Target layout as phases land (docs/34 §2.1):

```
app/src/app/            # expo-router routes (typed routes on)
app/src/components/     # RN plates, tiles, sheets — component law holds
app/src/lib/            # app-only helpers (storage adapter, sync client)
app/src/tokens/         # the six themes as typed objects
app/src/icons/          # hand-coded SVG flats via react-native-svg
app/src/assets/fonts/   # Fraunces, Switzer, IBM Plex Mono (local files)
```

Run: `cd app && npm install && npx expo start`. Installs happen **only**
inside `app/`; the repo root stays web-only. The web never imports the app.

## Suites that must keep passing (the web is feature-complete)

- `npm run verify` — build + `lint:brand` + `test:migrate` + `test:demo` +
  `test:intake` + `test:feed` + `test:sync` + `test:feedintake` +
  `test:galleryintake`. No browser needed.
- Browser suites: `npx vite preview --port 4174` then `npm run test:flows` and
  `npm run test:features`; `test:smoke` / `test:contrast` / `shots` run
  against port 4173.
- Live AI suites (need the owner's key in the environment, never written
  down): `KIMI_KEY=... node scripts/test-feed-intake.mjs --live [shot.png]`
  and `KIMI_KEY=... node scripts/test-gallery-intake.mjs --live`.
- App-side testing (when the app has code): jest + jest-expo +
  @testing-library/react-native, mirroring the node suites; `tsc --noEmit`
  green in `app/`. The `scripts/test-*.mjs` corpus stays the web's source of
  truth.

## Checklist for any app/ PR

- [ ] The SDK-57 versioned docs were read this session, not remembered
- [ ] No shared-logic copies — maths come from `packages/shared` once lifted
- [ ] No new native dependency without an owner call (Expo Go path dies)
- [ ] No secrets anywhere in the repo; the relay is the only AI path
- [ ] `npx tsc --noEmit` green in `app/`; web `npm run verify` still green
- [ ] Component law held: radius 2, hairlines, 13px label floor, copy law
