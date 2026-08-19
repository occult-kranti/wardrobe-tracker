# Almari — the native app (Expo + React Native)

This is the native build of [Almari](../README.md), the local-first wardrobe
app. The full plan of record — decisions, backend, phases, alpha distribution —
is **[docs/34-app-development-plan.md](../docs/34-app-development-plan.md)**.
Read it before writing feature code here.

## Status

Scaffolded from `create-expo-app` (`blank-typescript`, Expo SDK 57). Phase 0
groundwork only: no screens, no shared logic, no backend wiring yet.

## Run it

```sh
cd app
npm install        # once
npx expo start     # shows a QR code
```

Scan the QR with **Expo Go** (App Store / Play) on a phone on the same network.
That is the whole alpha distribution channel — see docs/34 §"QR alpha
distribution".

## Phases (summary — details in docs/34)

- **Phase 0 — setup:** design-token port, fonts, icons, expo-router skeleton,
  AsyncStorage adapter, CI.
- **Phase 1 — basics:** Supabase auth, closet CRUD + photos, two-tap Today log.
  Local-first default; sync is opt-in.
- **Phase 2 — features:** outfits, calendar, ledger, wishlist, before-you-buy,
  intake, local persona feed, settings/export.
- **Phase 3 — design pass:** brand fidelity, motion, themes, tablet layouts.
- **Phase 4 — hardening:** corrupted storage, offline boot, DST, web-export
  migration, accessibility, 500-piece performance.

## Where the shared logic lives

The framework-free maths (`cost.ts`, `similarity.ts`, `migrate.ts`, `dates.ts`,
`feedEngine.ts`, `intake.ts`, `types.ts`) currently lives in the web app's
`src/lib/` at the repo root. The plan (docs/34 §"Shared-code strategy") is to
lift it into `packages/shared/`, consumed by web (vite alias) and app (Metro)
alike — **not done yet**; until then the app re-implements nothing and Phase 0
copies nothing.

## Rules of the house

- No `npm install` at the repo root for app work — only inside `app/`.
- No `expo prebuild` / eject. No native builds locally.
- `app.json` contains `REPLACE-WITH-EAS-PROJECT-ID` placeholders — the owner
  supplies the EAS project id before any OTA update can publish.
