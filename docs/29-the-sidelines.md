# The sidelines — the executive review of everything the launch plan does not cover

*Drafted 13 August 2026. docs/28 is the launch plan: what gets built, what
gets filed, what gets sold, and what it costs. This document is the sidelines
— the obligations, setups and risks that are not product work but that a
company needs in order to be a company. It was produced as a four-lens review
of docs/28 and `company/tracker.js`: engineering, finance and operations,
people and governance, product and go-to-market. Each lens was asked the same
question — what is missing — and answered independently. Nothing already in
docs/28 is repeated here; where this document contradicts or re-dates
something in docs/28, it says so. Months are the plan's: month 1 = September
2026, launch = month 10 = June 2027. Conversions at ₹95.5 = US$1. Where a
number is unsourced, or where the honest answer is that nobody checked, it is
flagged in place and collected again in §5. Uncertainty is not laundered into
confidence anywhere in this file.*

Two things were verified directly against the repository and against GitHub
rather than taken from a report, and both turn out to be the two most severe
findings in the document. They are stated at §1.1 and §1.2 with the evidence.

---

## 0. The seven that would hurt most if found late

Ranked by cost of late discovery, not by size. The selection rule was: can
this still be fixed after the fact, and at what price. Items one to four
cannot be fixed after the fact at any price — they need the consent of a
person whose interests will by then have changed, or they destroy something
that no longer exists. Items five to seven are fixable but only by moving the
launch date.

| # | The risk | Must exist by | What breaks if skipped |
|---|---|---|---|
| 1 | **No shareholders' agreement, no vesting, and no bespoke Articles — with the equity conversation scheduled for 22 August.** Indian law does not let you un-issue shares: Section 68 buyback needs free reserves a pre-revenue company has not got, and share-transfer restrictions that live only in an SHA and not in the Articles have historically been held unenforceable against the company (*V.B. Rangaraj v. V.B. Gopalakrishnan*) | Shape agreed **22 Aug 2026**; SHA and bespoke AoA executed **before the SPICe+ filing, ~10 Sep** | Someone holds 10–20% permanently after four months of part-time work. It appears on every cap table shown to every grant committee and every investor, forever, and there is no instrument that recovers it without their agreement |
| 2 | **No IP assignment from Kunjal, Nimesh or Raksha, and no moonlighting warranty.** Section 17 of the Copyright Act gives a *contractor* first ownership absent a written assignment. The company does not exist until mid-September; anything the three write, draw or name before then belongs to them personally | **22 Aug 2026**, before any of the three writes a line of code | The company's only asset contains contributions it does not own and cannot licence. Worse if a joiner's day-job contract assigns their inventions to their employer — no deed they later sign with you cures that |
| 3 | **No LICENSE file on a public repository containing the entire shippable product.** Verified: `occult-kranti/wardrobe-tracker` is public, has no LICENSE, COPYING or NOTICE file, no `license` field in `package.json`, and GitHub's API reports `license: null` | **Month 1**, before the three get push access; the first outside pull request is the hard deadline | No fast store-takedown lever against a clone. And a merged outside PR puts unassigned third-party copyright into the paid binary, discoverable only at diligence, a hundred merges deep |
| 4 | **`migrate()` overwrites the pre-migration bytes and nothing anywhere snapshots them.** Verified in the code: `src/hooks/useLocalStorage.ts` line 43 runs `migrate()` on read, and the debounced writer at line 76 writes the migrated state back. The only backup is the manual, user-initiated export in `src/pages/Settings.tsx` | **Month 3**, before the SQLite migration ships to alpha | One bad migration destroys wardrobes irrecoverably, across every paying user at once, on a product whose entire promise is that it does not lose your data |
| 5 | **The registered office is assumed, not procured — and it becomes a public address on both stores.** SPICe+ needs a utility bill under two months old, a rent or leave-and-licence agreement, and the owner's NOC. A material share of Bengaluru residential landlords refuse | **Before the SPICe+ filing — the tracker dates name reservation 4 Sep and the filing 12 Sep** | The plan's very first task slips two weeks. Then: GST registration rejected at physical verification, ₹1,000/day s.12(8) penalty exposure, and the founder's home address published on Google Play, on Apple's EU trader listing, and in the TM journal, permanently |
| 6 | **The store-to-bank payout chain has a three-to-four month lead time and appears in the plan as one line.** D-U-N-S number → Apple organisation enrolment → Paid Applications Agreement → W-8BEN-E → bank and tax profiles accepted. Each gates the next | Start **month 1**; complete by **month 4–6**, not month 9 | The app is approved by App Review and still cannot be priced above free. Or the wrong US tax form is filed and 30% withholding applies to global revenue, permanently and not practically recoverable |
| 7 | **The launch plan and the internal task board are published as a public website.** `docs/28` and `company/` are committed to the public repo, and the deploy workflow copies `company/` into `dist/company` and force-pushes it to `gh-pages` | **Before the 22 Aug meeting** — cost ₹0 | You have published, dated and signed, your own assessment that the mark is semi-descriptive and vulnerable under s.9(1)(b), that four live collisions exist, and that "this plan does not certify clearance". That is an opponent's opening paragraph written in your hand, and it invites a collision holder to file in classes 9/42 before you do in month 3 |

**Near misses, and why they are not in the table.** TDS on contractors (§2.4)
is worth more rupees than several items above — non-deduction disallows 30%
of the expense under s.40(a)(ia), which on ₹10 lakh of contractor spend is ₹3
lakh of phantom taxable income — but it is fixable at any point before the
ITR due date, which the seven above are not. The absence of a dSYM and
mapping-file archive (§1.3) is severe and permanent, but its blast radius is
one release, not the company. Branch protection (§1.5) is free and takes an
afternoon; it is in the table's spirit but not its weight class.

---

## 1. Engineering

### 1.1 The licence — decide it in month 1, adopt it in month 2–3

**What is true today, verified.** `GET /repos/occult-kranti/wardrobe-tracker`
returns `"private": false` and `"license": null`. There is no LICENSE,
COPYING or NOTICE file anywhere in the tree. `README.md` carries no licence,
copyright or fork language. `package.json` has `"private": true`, which only
blocks `npm publish`, and no `license` field — so every SBOM and licence
scanner reads the project as UNLICENSED.

The legal position is better than it looks and worse than it feels. Absent a
licence, default copyright applies: all rights reserved, under the Copyright
Act 1957 and Berne. But GitHub's Terms of Service (§D.5, "License Grant to
Other Users") mean that by publishing a public repository you have granted
every GitHub user the right to view and fork it. You have not granted
redistribution outside GitHub, modification for distribution, or commercial
use. A fork is licit; shipping a paid clone to Play is not. Zero forks today
is luck, not protection.

The gap that matters is not the theory. It is the **enforcement lever**. When
a clone appears on Play the week after launch you do not litigate — you file
Google Play's copyright removal request or Apple's Content Dispute form, and
both ask you to establish ownership. So three things must be *done*, not
planned, before launch: the founder-to-company assignment deed (already month
2 in the tracker), copyright registration of the source as a literary work
and the drawn plates as artistic works (Form XIV, ₹500 each, month 3–4, plus
the agent's fee — proposed in §2.3 of the plan but with **no task for it in
`SEED_TASKS`**), and assignment clauses in every engagement letter (§3.2).

#### The options, honestly

| Option | What it does | Why it works or fails here |
|---|---|---|
| **Stay unlicensed** | All rights reserved by default | Reads as abandonment. Blocks F-Droid, press reuse, and any honest "open" claim. Leaves users unable to verify the binary claim the whole positioning rests on. Ambiguity is the worst possible property for a takedown filing |
| **MIT / Apache 2.0** | Grants the clone right explicitly | Hands away the only thing being sold. Rule out |
| **AGPL-3.0 + commercial dual-licence** | Clone must open-source; the company sells a proprietary grant | Genuinely effective against *App Store* clones — App Store terms are incompatible with the GPL family (the VLC precedent), so an AGPL fork cannot legally ship on iOS without the holder's dispensation. But it does not block Play clones, the network clause is meaningless in a local-first app with no server, and dual-licensing requires a CLA from every contributor forever — a permanent tax across four people plus an unbounded contractor line |
| **BUSL 1.1** | Source-available; converts to Apache 2.0 on a date, usually +4 years; an "Additional Use Grant" carves out permitted uses | Off-the-shelf, free, understood by grant committees and acquirers. The Additional Use Grant would read roughly: *any use except distributing a compiled application through an application store, or charging for it*. The four-year conversion is a feature here — a 2027 build turning Apache in 2031 is stale code, and the promise of eventual liberation is on-brand |
| **Move the native shell private** | Web app public; Capacitor project, signing config, SQLite layer, biometric lock and store metadata in a private repo | Costs nothing, buys real friction: a cloner must redo the port and the 4.2 armour. Also solves an unrelated problem — store credentials and provisioning config never touch a public repo |

#### Recommendation

**Adopt BUSL 1.1 over the web app — or PolyForm Shield 1.0.0 if the four-year
clock is unwanted — and move the Capacitor shell to a private repo. Both in
month 2–3, before the port starts.** Four reasons, in order.

1. **The trademark is the real anti-clone weapon and it might fail.** A clone
   dies on the mark, not the code. But §5.1 of the plan rates the name as its
   single largest controllable risk, with four live collisions and a Section
   9 descriptiveness problem. The licence is the backstop that works even if
   the mark does not. Deploying both is cheap; relying only on the shaky one
   is not.
2. **A named licence converts a legal argument into a form field.** Takedown
   reviewers at Apple and Google are not lawyers. "Here is my code and here
   is the licence forbidding exactly this" resolves in days. "There is no
   licence, therefore all rights are reserved" resolves in weeks or not at
   all.
3. **A conversion trigger is the licence that matches the product's
   promise.** Pair the BUSL date with an explicit **abandonment clause** in
   the same file: if the company is wound up, or ships no release for 24
   months, the code converts to Apache 2.0 immediately. Publish it as an "If
   we stop" page on the site, alongside the two other commitments that cost
   nothing because they are already architecturally true — the web app stays
   free and static permanently, and the last shipped build keeps full
   lossless export with no time bomb and no server dependency. This is free,
   it is true, and it is the strongest single trust artifact the company
   could ship. It is also the one thing a VC-funded competitor structurally
   cannot copy. Make it a reserved matter in the SHA (§3.4) so it cannot
   later be quietly dropped.
4. **Do not dual-licence.** The CLA discipline it demands forecloses nothing
   BUSL does not.

State in the same file or in `CONTRIBUTING.md` that **outside pull requests
are not accepted**, or are accepted only under a DCO sign-off. One paragraph,
and it eliminates the "whose copyright is this line" question permanently.

**Uncertainty, kept.** I do not know whether an Indian court has tested a
BUSL-style source-available licence, and I would not assume the Indian
enforcement path is smooth. The lever actually being recommended is the store
takedown form, which is contractual and platform-side, not judicial.

#### Licences flowing inward — the shipped binary's own obligations

Not on the roadmap, and a missed one blocks a store submission. 153 packages
in the lockfile. React, React Router, Tailwind and the Capacitor plugins are
MIT/Apache/BSD, and every one requires the copyright notice and licence text
to **travel with binary distribution**. There is no attribution screen in the
app today — Settings has no licences row.

Fonts are a good outcome that could easily have been a launch-blocker.
`public/fonts` carries Fraunces and IBM Plex Mono, and `index.html` line 19
correctly notes they are OFL-licensed. SIL OFL 1.1 permits embedding in a
native app but requires the licence text to accompany the files. Had these
been a commercial webfont licence, this would have been a blocker: most
commercial webfont licences cover web serving only, and app-binary embedding
is a separate paid tier. **Standing rule from here on: any font, icon or
asset gets its licence checked for app-embedding rights before it enters the
repo.**

Same discipline for the P0 museum photography task. Met Open Access (CC0) and
Rijksmuseum public-domain are clean, but many "open licence" collections are
CC BY or CC BY-NC, and the latter is unusable in a paid app. Keep a per-asset
provenance ledger — source URL, licence, retrieval date, required attribution
string — from the first download. Retrofitting provenance for 200 images at
month 9 is a week of misery.

**Action:** generate `THIRD-PARTY-NOTICES.txt` in CI from the lockfile plus
the asset ledger, and render it in a Settings → Licences screen. About two
days, month 4, alongside the port.

### 1.2 The migration gap, and the safety net that does not exist

**The specific danger, verified in the code.** `migrate()` runs on every read
inside `useLocalStorage`'s initialiser — `src/hooks/useLocalStorage.ts` line
43. The resulting state flows through the effect and the debounced writer at
line 76 writes it back over the same key within `SETTLE_MS = 250`. Nothing
anywhere in the tree snapshots the pre-migration bytes. A grep for
backup/snapshot/restore/rollback across `src` returns only unrelated matches
plus the export in `src/pages/Settings.tsx` — which is real, but manual and
user-initiated.

So the moment a user opens a version with a buggy migration, the original
data is gone in a quarter of a second. Today that risk is bounded by a small
localStorage payload. From month 3 it is the localStorage-to-SQLite move,
across every paying user, at once.

#### The five fixes, in priority order

1. **Automatic pre-migration snapshot.** Before any migration whose `from`
   version differs from its `to` version, write the raw pre-migration bytes
   verbatim to a *separate* store — `@capacitor/preferences` for small state,
   `@capacitor/filesystem` for the DB — keyed `snapshot-v{from}-{iso8601}`.
   Keep the last two. Delete a snapshot only after the app has launched and
   written cleanly at least five times on the new version. Add "Restore from
   automatic snapshot" to Settings. **About two days. It converts
   "irrecoverable" to "recoverable" and it is the highest-leverage
   engineering item in this document.**
2. **Migrations validate their own output before committing.** Record counts
   must match, no item may lose a field it had, every id must survive. On any
   mismatch the migration **refuses**, leaves the old store untouched, and
   says: *"This version can't safely upgrade your data. Your closet is
   unchanged — please update again or write to us."* A failed migration that
   does nothing is infinitely better than one that half-succeeds. This is the
   local-first substitute for a server-side kill switch, and it must be a
   release gate, not a nicety.
3. **Write to a new key or table and keep the old one read-only for a full
   release cycle.** Costs disk, buys reversibility.
4. **Pre-import snapshot.** `confirmImport` → `replaceState(pending.state)`
   obliterates the current wardrobe on one confirm click. Snapshot first;
   offer "Undo import" for the session. About one day.
5. **Prompt an export before a schema-changing update applies.** Settings
   already has a 30-day stale-export nudge. On native, before a migration
   runs: *"This update reorganises how your closet is stored. Save a backup
   first."* → share sheet → then migrate.

#### The migration corpus — the release gate that replaces the server

`scripts/test-migrate.mjs` tests one hand-written v1 fixture against spot
fields. That is nowhere near sufficient for the SQLite move. Build, in month
3, before the migration ships to alpha:

- a **corpus** of real exports from every schema version the app has ever
  written, v1 to current, committed as fixtures;
- **adversarial states**: 10,000 items; 50 MB of base64 photos; a truncated
  or partially-written localStorage payload — the exact artifact of a user
  who hit quota mid-session, and the app's own quota toast proves that state
  exists in the wild; emoji and Devanagari names; NUL bytes; dates in 1970
  and 2099; duplicate ids; deeply nested unknown keys;
- **losslessness asserted by full-object set-equality**, not spot fields —
  every key present before must be present after, unknown keys included, per
  the file's own stated promise;
- a **property test**: for randomly generated states,
  `migrate(serialize(migrate(x)))` deep-equals `migrate(x)`, and no key ever
  disappears.

Cost: one to two weeks of the contractor line, **₹60,000–2,00,000** at the
plan's own ₹20–40K/day rate. Add `src/lib/migrate.ts`, `src/types.ts` and
`src/hooks/useLocalStorage.ts` to `CODEOWNERS` so no migration change can
merge without founder review once four people have push access.

#### Staged rollout, and the fact that neither store can roll back

The plan never states the mechanics. They are:

- **Google Play staged rollout** on a percentage of users, haltable
  instantly. Plan: 1% → hold 48 h → 5% → 10% → 20% → 50% → 100%, with the
  halt criterion pre-written — any crash-rate rise in Android vitals, any
  data-loss report, any migration-refusal report. Users on the old version
  stay on the old version.
- **Apple phased release for automatic updates** — roughly a seven-day ramp,
  pausable. **It governs automatic updates only.** Anyone who taps Update
  manually gets the build immediately, so iOS exposure on day one is never
  zero.
- **Neither store supports rollback.** Play will not accept a lower
  `versionCode`. Apple will not un-ship a version. The only iOS reversal is a
  *new* build containing the old code, at a higher version number, through
  App Review.

**Therefore the practice that must exist and does not: a pre-staged rollback
build.** Every release tags its predecessor, and CI keeps the previous
release's code — with `versionCode` and build number already incremented —
built, signed and ready to upload. Target: uploadable within one hour of a
decision. Free, purely process, month 5.

Know the iOS expedited-review path before you need it, and do not plan around
getting one — Apple grants them sparingly. The honest planning assumption is
that **an iOS regression is live for the duration of App Review**, which is
exactly why the self-refusing migration is worth more than any rollout
percentage.

#### Two data-loss vectors specific to this product

**OEM storage cleaners.** Xiaomi HyperOS/MIUI, Samsung One UI and several
other skins ship aggressive storage cleaners and "deep clean" routines that
purge app cache directories, plus battery managers that kill background work.
On the majority-Android, budget-heavy Indian device base this is a live
threat. **Requirement: the SQLite file and the snapshots live in internal app
storage under `Directory.Data`, never a cache directory and never external
storage. Verify on a real Xiaomi and a real Samsung.** Not theoretical, and
not in the plan.

**System backup — decide it deliberately, do not inherit the default.**
Android's Auto Backup for Apps is on by default (`android:allowBackup="true"`)
and backs up app data to the user's own Google Drive up to a size limit — 25
MB per app historically, *verify against current docs*. On iOS, files in the
app container are included in the encrypted device and iCloud backup unless
explicitly excluded. Both are free data-loss insurance, both are user-device
to user-cloud and never to the company, so both are compatible with
local-first. They are also precisely what a hostile reading of *"nothing
leaves your device"* will attack. **Recommendation: keep both on, document
them, and treat them as the answer to "what if I lose my phone"** — a
question this product will be asked constantly and currently answers with
"hope you exported". If kept on, the privacy page and the Play Data safety
declaration must reflect it, and the marketing claim gains a second
qualification alongside the BYOK one. Add it to §5.3's owned-open-questions
table; the interaction with the "Data Not Collected" label needs the same
counsel review the BYOK question already gets.

#### The comms problem nobody has named

**With no accounts, you cannot email your users. Ever.** During an incident
the entire broadcast surface is the website, the store listing's "What's
New", the store description, and the app's own next-launch screen. That is a
structural consequence of the design contract and it deserves a line in §5.1.

Three consequences: the **domain is not "minor; unsourced"** as §4.1 has it —
it is the company's only channel to its customers (§5.2 resolves the timing
tension); keep a pre-written **incident notice template** and a `/status`
page on the static site so publishing takes minutes; and build a
**next-launch notice mechanism** into the app, a small notice bundled at
build time that the *next* release can display. Not a server call. Crude, and
it is the only in-app channel a no-server app can have.

#### The one feature that would most justify the paid SKU

§1.4 lists what triggers the purchase: native camera, SQLite, Face ID,
offline, store updates. It is missing the obvious one: **scheduled local
backup to a user-chosen destination.** A weekly automatic export written via
`@capacitor/filesystem` to a folder the user picked once through the system
picker — which can be their iCloud Drive or Google Drive folder.
User-initiated, no sync, no server, fully contract-compliant, and it directly
answers the risk in this whole section. It is a better paid-tier story than
Face ID. Not on the roadmap. About one week, month 6.

### 1.3 Debugging without telemetry — the answer the plan does not design

The plan states the constraint and stops. Here is the design.

**Start from the crash reporting you are already allowed to have.** The
plan's own boundary rule (§2.5, §5.4) permits "platform-side aggregate
console data". That is not a footnote — it *is* the crash reporting. Both
stores collect crashes with no SDK: **Xcode Organizer / App Store Connect**
gives symbolicated stacks from users who left "Share with App Developers" on,
and **Play Console → Android vitals** gives crash and ANR stacks with
clusters from users opted into "share usage and diagnostics". Coverage is
partial on both platforms — I do not have a reliable current opt-in rate and
will not guess. It is free and contract-compliant, and the plan never claims
it. **Say so explicitly in §2.5**, so that nobody later argues the ban
forbids it and nobody later argues it justifies an SDK.

**What makes it worthless if skipped.** Those stacks are unreadable without
the exact build's **dSYM bundle** (iOS) and **R8/ProGuard `mapping.txt`**
(Android), plus the JS source maps for the web bundle inside the WebView. On
a cloud pipeline — Capawesome, Codemagic — build artifacts sit in the CI
account under a retention window, often 30 days, and are then silently
deleted. **Set up a release-artifact archive**: every store-bound build
writes, to storage outside CI, the IPA/AAB, the dSYM zip, `mapping.txt`, the
Vite source maps, the exact git SHA and the lockfile. A private GitHub repo
using Releases is free (2 GB per file), or an object bucket at roughly
₹100–500/month. **Must exist month 5, before the first TestFlight upload.**
What breaks: a month-14 crash affecting 3% of buyers that you can never
decode. Related and cheap: verify that Vite is shipping `sourcemap: false`,
because a public source map in a paid binary is a free decompile.

**The diagnostic export.** Add a **Settings → Diagnostics** row that builds a
file and hands it to the share sheet. Nothing transmits; the user chooses the
destination. This satisfies "no network call the user did not initiate"
exactly. Contents: app version, build number, git SHA, `SCHEMA_VERSION`;
platform, OS version, device model, WebView version; storage backend in use,
DB file size, free-disk estimate; **migration history** — which migrations
ran, when, from-version to to-version, outcome, record counts before and
after; record counts by type; the error ring buffer; and a structural
fingerprint of the keys present at each level, including unknown keys the
migrator preserved.

Explicitly **excluded, with an assertion test that fails CI if any appears**:
garment names, notes, photos or any `data:` URI, event names, household
member names, and — critically — the BYOK API key. The redactor is the same
machinery §2.5 already specifies for the research export. Build it once and
it serves research, support and bug repro.

**The on-device error ring buffer.** Today the one failure the app catches, a
refused write, goes to a toast and is forgotten
(`useLocalStorage.flush` → `report.current?.(e)` → `WardrobeContext` toast). A
user who hit quota on Tuesday and writes to you on Friday has nothing to
send. Add a bounded persistent log: last ~200 events, capped ~200 KB, written
to **Preferences, not SQLite**, so a corrupted database does not take the log
with it. Each entry: timestamp, category, error name and message, and a stack
with paths but no data values. Nothing transmits and the user can clear it,
so it is not telemetry. **Three to five days, and it is the highest-value
engineering addition in this document after the snapshot.** Month 4.

**The error boundary that saves the wardrobe.** There is no React error
boundary in `src/App.tsx`. `migrate.ts`'s own comments describe a
white-screened modal caused by a string cost value reaching `.toFixed()`. A
render crash today means a blank screen and a user who force-quits. Ship a
top-level boundary whose panel offers, in this order: **1) Export your
wardrobe now** — and the export path must be independent of the crashed
subtree, building the payload straight from storage rather than from context
— 2) Copy diagnostics, 3) Reload, 4) the support address. That turns every
crash from a data-loss scare into a recoverable, reportable event. About two
days, month 4.

**The structure-only repro export.** Because the export is lossless and the
schema is stable, a user can send a shape-preserving, content-stripped export
— real item counts, real category, tag and date structure, names replaced
with `Item 1…n`, photos dropped — that reproduces most bugs without
disclosing a wardrobe. Ship it as the second export button. **It is the
single thing that makes no-telemetry debugging tractable**, and it is a
marketing asset in its own right.

**A public issue template** in the repo — app version and build, platform and
OS version, steps, expected and actual, optional diagnostic attachment. Free,
and it converts diffuse mail into triageable reports. What support actually
sees, and the desk that receives it, is §4.1.

### 1.4 Keys, credentials, and the account nobody has named

**Correct the folk wisdom on the Android keystore first.** "Lose the keystore
and the app can never update" is the received rule and it is now largely
obsolete for new apps. Apps published as AABs are enrolled in **Play App
Signing**: Google holds the app signing key, you hold an **upload key**, and
a lost upload key can be **reset** through Play Console support. That
materially de-risks the classic failure — but only if you enrol at first
upload and do not opt out. **Do not opt out.** The reset is a support process
with a delay, so back up the upload keystore and both passwords anyway.

Apple has no equivalent single point of failure on keys: distribution
certificates and provisioning profiles are revocable and re-issuable at will.
**The irreplaceable Apple asset is not a key — it is account access.**

**The account-ownership decision the plan never makes.** §4.5 says "org store
accounts" at month 2 and never says whose identity holds them. **Apple
Developer Program has exactly one Account Holder** — a single Apple ID that
alone can accept legal agreements, including the Paid Applications Agreement
and the tax and banking forms. Apple pushes new agreement versions routinely,
and until someone accepts, **paid distribution stops**. If that Apple ID is
the founder's personal account and the founder is unreachable, sales halt and
nobody can fix it.

The rule: the Account Holder Apple ID is a company-domain address
(`developer@`), created in month 2, with its password and 2FA recovery in the
company password manager and at least two directors able to recover it. Same
for the Play Console owner. Add named users with roles for everyone else;
never share the owner login. **Apple ID 2FA is bound to trusted devices, and
the founder has no Mac** — the trusted device is a phone. Lose it and you are
in Apple Account Recovery, which takes days to weeks. Mitigations: two
trusted phone numbers, a **second trusted device** (the iOS test devices in
§1.6 serve double duty, which is a real argument for buying them early), and
a printed recovery key held physically by a second director. For Google, two
FIDO2 hardware keys at roughly ₹2,500–5,000 each — buy two so one is a
backup.

**The password manager is an unbudgeted line.** It is not in the
₹2,500–5,000/month infra line, which is already spoken for by Workspace, CI
and the domain. Bitwarden Teams ≈ US$4/user/month ≈ **₹382/user/month**;
1Password Business ≈ US$7.99 ≈ **₹763/user/month**. For four people,
**₹1,500–3,100/month, ≈ ₹18,000–37,000/year**. *Vendor pricing shifts;
confirm at purchase.* **Must exist month 1, before the first account is
created.** Retrofitting scattered credentials out of a personal Chrome
profile after eight accounts exist is how secrets leak. Give the second
director break-glass or emergency access, and keep a sealed printed copy of
the master credential in a physical safe.

**The custody inventory — write this list in month 2.** MCA/SPICe+ **DSC USB
tokens** (physical dongles, legal signing credentials, company property with
a named custodian, and they expire, typically in 1–3 years) · bank account
and net-banking · GST portal · income tax and TRACES · Apple ID plus recovery
key and trusted numbers · Play Console owner plus backup codes · GitHub org
owner · domain registrar, with lock and auto-renew on · Cloudflare ·
Capawesome/Codemagic · upload keystore plus keystore and key passwords ·
Anthropic and any API accounts · Workspace super-admin · the support inbox.
Each entry records who holds it, who is the recovery contact, and where the
recovery codes live.

**Bus factor, made operational.** §5.1 names key-person risk and mitigates it
with documentation. Documentation does not sign an AAB. The ₹0 fixes, all
doable in one afternoon in month 2: a **second GitHub org Owner**; two
directors on the Apple Account Holder recovery path; the sealed master
credential above; and a written *"if the founder is unreachable for 30 days"*
runbook naming where everything is, who can act, and what the statutory
deadlines are. What breaks if skipped: bus-factor-1 on a **paid** app means
people who paid ₹299 lose the ability to ever receive an update — the precise
opposite of the promise the price was charged for. The share and signatory
half of this problem is §3.5.

### 1.5 Repo hardening — one engineer-day, ₹0, month 1

Verified state of `occult-kranti/wardrobe-tracker`:

| Finding | Status |
|---|---|
| Branch protection on `main` | **None** — `/branches/main/protection` returns 404 |
| Rulesets | **None** — `/rulesets` returns `[]` |
| Dependabot alerts | **Not enabled** — `/vulnerability-alerts` returns 404 |
| `dependabot.yml` | Absent |
| `CODEOWNERS` | Absent |
| `SECURITY.md` | Absent |
| `package.json` version | `0.0.0`, against §3.3's claim that it is the single source of truth for semver |
| Lockfile size | 153 packages — genuinely lean, and worth defending as policy |

**Branch protection, month 1, before three people get push access.**
`deploy.yml` triggers on `push: branches: [main]` and force-pushes
`gh-pages`. With no protection, one bad push to main is instantly the live
public site. Protect `main`: no force-push, no deletion, require a PR.
Require status checks — `npm run lint` (which includes `check-brand.mjs`, and
**the CI-enforced brand contract is currently the only enforcement of the
design contract, and it is not required to pass before merge**),
`test:migrate`, `test:demo`, `test:intake`, `build`. Add `CODEOWNERS` on
`src/lib/migrate.ts`, `src/types.ts`, `src/hooks/useLocalStorage.ts`,
`src/index.css` and the design-system files.

**Two concrete weaknesses in `deploy.yml`.** First, the v2 branch is built
inside a write-privileged job: the workflow declares
`permissions: contents: write` at the top, then checks out `v2` and runs
`npm ci` on it, so any lifecycle script in v2's dependency tree executes in a
runner holding a write-scoped token. Fix: default the workflow to
`permissions: contents: read`, grant write only on the deploy job, and build
v2 in a separate read-only job that passes an artifact across. Use
`npm ci --ignore-scripts` wherever the build tolerates it. Second, actions
are pinned by tag rather than SHA (`actions/checkout@v4`,
`actions/setup-node@v4`). First-party `actions/*` are relatively low risk,
but the moment you add a third-party signing or store-upload action — you
will, months 4–5 — pin by full commit SHA. The tj-actions/changed-files
compromise of March 2025 is the canonical illustration.

**Dependency policy.** Enable Dependabot alerts and security updates, and add
a `dependabot.yml` for `npm` and `github-actions`, weekly. ₹0. More important
than the tooling is a stated **dependency budget**, because 153 packages is a
real asset: nothing new enters without a written reason, and prefer vendoring
fifty lines to adding a package. Name the one that matters:
**`@capacitor-community/sqlite` is community-maintained, not first-party
Ionic, and it will hold every user's entire wardrobe.** Pin the exact
version, review the diff on every bump, keep it behind your own storage
interface so it is replaceable, and write down what happens if it goes
unmaintained. It is the highest-consequence third-party line in the product.

**Secrets.** GitHub enables secret scanning and push protection by default on
public repositories, so this is probably already on — verify it in Settings →
Security rather than assume it — and add a local `gitleaks` pre-commit hook.
The specific secret this repo will leak is the **BYOK Anthropic key**, pasted
into a debug commit or into a diagnostic file. Two guards: the hook, and the
CI assertion in §1.3 that the diagnostic builder can never emit it.

**Off-GitHub mirror, month 1.** The repo *is* the company — §5.1 calls
`docs/` "the company brain", and the roadmap, the plan and the trackers all
live in it. A single account suspension, a compromised founder account or a
mistaken force-push loses it. Fix: a scheduled `git push --mirror` to
Codeberg or GitLab (free, ~20 lines of Action); a monthly full
`git clone --mirror` to encrypted local storage plus one offline copy; and,
once support intake lands in Issues, a cron'd `gh api` dump of Issues, PRs
and Releases to JSON, because those live only on GitHub and are not in the
git mirror. ₹0–500/month.

**Versioning discipline.** `package.json` reads `"version": "0.0.0"`. Set it,
and add a CI check asserting that the git tag, `package.json`, the iOS build
number and the Android `versionCode` (monotonic integer) all agree before any
store build is produced. A `versionCode` collision is a rejected upload at
the worst possible moment — during a rollback.

**`SECURITY.md`, month 3.** A public repo for a paid consumer app with a BYOK
key path will receive security reports, and in the Indian context also a
steady trickle of low-quality "bug bounty" extortion mail. Publish a contact
address, a 90-day disclosure expectation, an explicit **no monetary bounty**
policy, and a scope limited to the app. ₹0, and it saves a dozen hours of
ambiguous correspondence.

**Two things in the repo that contradict the plan.** The repository sits in a
**personal GitHub namespace** while the month-2 assignment deed will assert
that the company owns the code, the plates, the names and the domains — and
the live app is served from `occult-kranti.github.io`. Create a GitHub
organisation owned by the company (free tier ₹0), transfer the repo, add at
least two org owners, and move the live app to the company domain, **in month
2, as part of the same task as the deed**. Transfers preserve stars, issues
and redirects; the Pages URL change needs the README, the manifest
`start_url` and any press links updated together. And **`README.md` still
opens with "# TOILE"** while `package.json` says `almari` and
`public/manifest.webmanifest` says "Almari — your wardrobe, on record". The
repo is publicly readable, so the brand is visibly two names at once. No task
anywhere executes the rename across README, docs, manifest, PWA metadata and
the live URL. Add it, gated behind the month-1 clearance verdict — there is
no point renaming to Almari twice.

**Three standing rules to write down now, because each gets broken carelessly
at month 9.**

- **Bundle ID permanence.** `applicationId` and the iOS bundle identifier are
  unchangeable after first publish. Choosing casually at month 3 and
  regretting it at month 9 means a fresh listing with zero ASO history.
  Choose it *after* the month-1 clearance verdict, and let nobody register a
  placeholder "just to test".
- **The toile residue.** The export filename is `toile-backup-<date>.json`
  and the tutorial flags are `toile-toured` and `toile-first-log`. **Rename
  the export filename only** — old files still import, because the importer
  never checks the name — and **leave the internal storage keys alone
  forever**, with a comment saying why. Renaming a storage key is a
  migration, and a casual key rename is precisely the §1.2 scenario.
- **The reproducibility claim.** The positioning is *verifiable* — no
  telemetry, nothing leaves your device — sold as a paid binary built from a
  public repo. Someone will ask how they know the binary matches the source.
  For a Capacitor app the honest answer is that you cannot reproduce a store
  binary bit-for-bit. The cheap, honest substitute: publish the **exact
  commit SHA and the SHA-256 of the built web bundle** with every release,
  alongside a short page stating exactly what is and is not guaranteed. ₹0,
  at launch. Skipping it leaves the trust claim unbacked at the moment a
  hostile reader first tests it.

### 1.6 The test device fleet

Unbudgeted entirely. The plan has an infra line of ₹2,500–5,000/month and no
capex.

| Device | Why it is required, specifically | Cost (INR) |
|---|---|---|
| Old low-RAM Android, 2–3 GB, Android 11–12 | WebView performance and OS storage eviction only manifest here, and this app renders heavy custom SVG and base64 images. This *is* the Indian budget device | 5,000–9,000 (used/refurb) |
| Current mid Android, Android 15/16, 6–8 GB | Android 15+ mandatory edge-to-edge and Capacitor's `SystemBars` insets do not reproduce faithfully in an emulator | 12,000–18,000 |
| One of the two above must be a **Xiaomi (HyperOS/MIUI) or Samsung (One UI)** | The OEM storage-cleaner vector in §1.2 | (covered above) |
| Old iPhone — SE 2nd/3rd gen, or 11/12 | Touch ID versus Face ID divergence in the biometric lock, **and the low-disk eviction test that §5.3 already owns as an open question, due before external TestFlight in month 6** — you cannot fill a simulator's disk or a borrowed phone's | 12,000–22,000 (refurb) |
| Current iPhone, iOS 26 | Face ID, Dynamic Island safe areas, the current SDK requirement. Doubles as the **second Apple trusted device** of §1.4 | 25,000–45,000 |
| Cables, powered hub, spare charger | Four devices tethered to one Windows machine | ~5,000 |
| **Total, one-time — buy months 3–4, before the port reaches QA** | | **₹60,000–1,20,000** |

*The two lenses that costed this independently returned ₹60,000–99,000 and
₹60,000–1,20,000; the wider band is used above.*

Four notes that matter.

- **The biometric app lock cannot be validated in the iOS Simulator.** The
  Simulator can fake enrolment but not the real failure modes: passcode
  fallback, biometry lockout after five failures, a device with nothing
  enrolled, and a device where the user revoked the permission. The lock is
  both 4.2 armour and a paid-SKU justification, so real hardware is not
  optional.
- **Accounting.** A Pvt Ltd buying phones capitalises them as fixed assets
  and depreciates them — tell the CA — and should buy on the company GSTIN
  once registered so input tax credit is claimable. Buying before GST
  registration forfeits the ITC, which on ₹1,00,000 at 18% is roughly
  ₹15,000. Small, and it depends purely on sequencing. It is also a second
  argument for the earlier GST registration in §2.5.
- **Cloud device farms complement, never substitute.** BrowserStack App Live
  runs roughly US$39–49/user/month (≈ ₹3,700–4,700) — subscribe for the
  month-5-to-7 QA window only, not permanently, for breadth across OEM skins.
  Firebase Test Lab has a free tier with Robo tests, and sending your own
  binary to a Google test farm involves no user data, so it is
  contract-clean. Own hardware for depth, farms for breadth.
- **A refurbished Mac mini M2 at ~₹45,000 is worth arguing about.** The plan
  commits to cloud iOS builds and no Mac. A Mac mini buys local Xcode
  debugging, real device provisioning and App Review response turnaround
  measured in hours rather than build-queue cycles. Against Codemagic at
  roughly ₹9.1/minute it pays for itself around the second serious signing or
  provisioning incident. App Review is one of the two named external gates.
  **Recommendation: buy it in month 3.** It is a ₹45,000 hedge on a
  ₹1.6–4L/month burn against a gate that can cost a month.

---

## 2. Money and operations

### 2.1 Getting paid, mechanically

The plan models revenue net of store cut and GST and then stops. The chain
between "a user in Ohio taps Buy" and "rupees clear in a Bengaluru current
account" has about eleven links, and roughly half have multi-week lead times
that are not on the timeline.

**a. D-U-N-S number — apply month 1, the week the CoI arrives.** Free from
Dun & Bradstreet India, nominally about five business days, realistically up
to thirty. Apple organisation enrolment cannot start without it. The tracker
puts Apple enrolment in P3 (months 3–6) with a note that D-U-N-S "needs the
company", and treats it as instantaneous. **The name on the D-U-N-S record
must match the RoC name character for character, including "Private Limited"
spelled out.** A D-U-N-S reading "…Pvt Ltd" against an RoC name of "…Private
Limited" is the most common reason Apple org enrolment stalls for three to
six weeks, and it is fixed by a D&B support ticket, not by anything you
control.

**b. The Paid Applications Agreement is a separate thing from the developer
account.** A free-app developer signs Schedule 1 and is done. Selling
requires accepting the Paid Applications Agreement in App Store Connect, and
it stays "Pending" until three sub-items are green: legal entity information,
bank account, and tax forms. Any one incomplete and the app can be **approved
by App Review and still not purchasable**. This is a **month 4–6 task, not
month 9**.

**c. US tax forms.** For an Indian Pvt Ltd this is **Form W-8BEN-E**, not
W-8BEN — filing the individual form because the founder recognises it is a
real and common error. Three specifics that go wrong:

- **The "Foreign TIN" field takes the company's PAN.** Not the founder's PAN,
  not the CIN, not the TAN. A mismatch or a blank pushes you to the default
  **30% US withholding on US-source income**, not practically recoverable
  without filing a US return (Form 1120-F), an accountant expense larger than
  the withholding at these volumes.
- Entity classification (Chapter 3 status: Corporation) and the treaty claim
  (India–US DTAA) go in Part III. **Whether App Store and Play proceeds are
  characterised as royalties (treaty-capped) or as business profits with no
  US PE (nil) is genuinely contested and provider-specific, and no number is
  invented here.** It is a thirty-minute question for the CA at month 6. The
  cost of getting it wrong is 30% of the roughly 30% of revenue that is
  global — around **₹1.2L/year at the Low scenario, ₹6L/year at Mid**.
- Google Play collects the same information through the payments-profile tax
  interview. Same PAN, same entity name, same trap.

**d. The bank account, chosen for the right things.** Any current account
will take the incorporation money. Not every one will do the rest. Confirm
before opening: **inward foreign remittance handling with an e-FIRA/FIRC
issued per credit**, ideally automatically — this is the document proving
export proceeds were realised in foreign exchange, and the zero-rating
position in §2.5 rests on being able to evidence it, so a bank that makes you
raise a ticket per remittance produces a year of missing FIRCs by the first
GST scrutiny; **a corporate debit or credit card that actually clears USD
SaaS charges**, because many Indian bank debit cards decline recurring
international authorisations by default; and an **average quarterly balance
requirement of ₹25,000 or lower**, since standard private-bank current
accounts often demand ₹1,00,000 AQB with shortfall penalties. Opening takes
one to three weeks after CoI and needs the CoI, MoA/AoA, company PAN, a board
resolution, KYC of every director, and **the registered-office proof** — the
same pack as GST, which is §2.2.

**e. Payout mechanics, and the date this moves.** Both stores pay monthly in
arrears with a minimum. *Working figures, not verified — read them off the
consoles at month 6 rather than budgeting off them:* Play pays around the
15th of the following month with a US$100 minimum; Apple pays roughly 30–45
days after its fiscal month close with a minimum in the low hundreds of
dollars, region-dependent.

The operationally load-bearing consequence: **first cash lands roughly 45–75
days after launch — mid-August 2027 at the earliest. The plan's month-12
raise/no-raise gate is 31 August 2027.** That decision is being made off
approximately one payout cycle, in the same month, possibly before it clears.
**Either move the gate to month 13–14, or pre-commit in writing to deciding
off store-console *sales* data — which is real-time and which §5.4 explicitly
permits reading — rather than off banked cash.** Decide which, now, and put
it in the plan.

**f. Forex — one hour of attention, no more.** Indian banks typically apply a
1.5–3% spread over interbank on inward conversion plus a flat inward
remittance charge of roughly ₹200–500 plus GST per credit. On the Low
scenario's global leg (~₹5.7L/year through forex) a 2% spread is ~₹11,000/year
— noise. At Mid (~₹28L global) it is ~₹57,000/year, worth a rate-card
conversation and worth comparing an INR payout election against a USD one. Do
not spend time on this before month 12; do set a reminder to re-check once
monthly inward remittance exceeds ₹2L.

**g. SOFTEX / EDPMS — flagged, not guessed.** Software exports have
historically required SOFTEX filing through STPI, including for non-STP
units, with a widely-cited de minimis around US$25,000 per invoice. **I
cannot verify the current position, or whether store payouts to an app
developer are in scope, and I will not invent it.** Put it to the CA in
writing at month 6: *"Do our App Store and Play payouts require
SOFTEX/EDPMS declaration, and if so through which route?"* A written "no"
costs nothing. Discovering a "yes" two years of payouts later means
regularisation with the AD bank.

**The five mistakes first-time Indian developers make here**, beyond the
above: creating store accounts on a personal Apple ID or Gmail (§1.4);
accepting the Paid Applications Agreement in launch week; electing INR payout
for convenience and never collecting FIRCs; **letting Apple auto-convert the
base price into India** (§4.4, and it silently breaks the plan's central
revenue number); and **not claiming the GST TCS credit** — Google's TCS
deduction does not auto-credit, it appears on the portal and must be accepted
and claimed, and unclaimed TCS is a straight cash loss. *The s.52 rate was
reduced from 1% in July 2024; confirm the current rate with the CA rather
than quoting it.* One dead tax worth knowing about only so nobody pays a CA
to compute it: **equalisation levy no longer applies** — the 2% e-commerce
levy went in August 2024 and the 6% ad levy in April 2025.

### 2.2 The registered office

**What it actually requires.** The address filed in SPICe+ — or in INC-22
within 30 days — needs proof of address by way of a **utility bill not older
than two months**, a **rent or leave-and-licence agreement** if not owned,
and a **No Objection Certificate from the owner**. A home flat owned by a
parent needs the parent's NOC. A rented flat needs the landlord's NOC, and a
material share of Bengaluru residential landlords refuse — commercial
registration at a residential address complicates their property-tax position
and makes eviction messier. Discovering this in early September, days from
the filing, is a two-week slip on the plan's first task.

**What it costs to skip or fix later.** On the RoC side the registered office
is public on MCA master data; s.12(8) carries **₹1,000 per day up to ₹1
lakh** for default, the RoC can physically verify and initiate strike-off if
the company is not found there, and every RoC, income-tax and GST notice goes
to that address — a home you move out of in month 7 becomes a notice black
hole. On the GST side the principal place of business needs the same pack,
and registration now commonly involves Aadhaar biometric authentication
and/or physical verification of premises; a weak address pack is the standard
reason a small-company GST application is rejected, and GST registration is
on the critical path to being paid.

**The exposure nobody sees coming.** Google Play **publishes a developer
address on every listing**. Apple, for apps distributed in the EU, requires
**DSA trader verification** with a publicly displayed address, phone number
and email, and unverified traders' apps are removed from EU storefronts. The
trademark register publishes the applicant's address in the journal. Net
effect of a home registered office: **the founder's home address and phone
number are on the App Store, on Google Play and in the TM journal,
permanently, for a product whose entire brand is privacy and ownership.**
That is not a compliance problem. It is a brand problem and a personal-safety
problem.

**What to do.** Procure a registered-office or virtual-office service
**before the SPICe+ filing**. Advertised Bengaluru rates cluster around
₹1,000–3,000/month; the providers that will hand you a stamped rent
agreement, an NOC, a utility bill in a usable name, and staff who will
actually receive a GST officer sit at the top of that band or above — call it
**₹2,000–4,000/month, ₹24,000–48,000/year**. Get three quotes and ask each
one directly: *"How many GST registrations have succeeded at this address in
the last twelve months, and will you attend physical verification?"* Some
state GST officers have become hostile to virtual offices; a provider who
cannot answer that is selling you a mailbox. *Whether the cheaper tier
survives verification varies by provider and by how the local officer is
currently treating shared addresses — this is unsourced and must be asked,
not assumed.*

Changing the registered office afterwards means INC-22, updated GST
registration, PAN/TAN correction, bank KYC re-done and amended TM records —
call it ₹10,000–20,000 of professional fees and two weeks of administrative
pain, four separate times over.

Also procure **a company phone number**, ₹200–400/month, for bank OTPs,
GST/Aadhaar, the store accounts and the DSA trader listing. A personal number
wired into all of the above is a single point of failure, and it will end up
printed on the App Store.

### 2.3 The finance stack

**Bookkeeping, and one statutory point nobody expects.** Every company must
maintain its books in accounting software with an **audit-trail (edit-log)
feature that records every change and cannot be disabled** — in force since
FY 2023-24 — and the **statutory auditor is required to report on whether it
was used**. A spreadsheet does not satisfy this. The plan's ₹30–60k
statutory-audit budget assumes an unqualified report; running the first year
on Google Sheets earns a qualification in the very first audited financial
statement the company will ever hand a grant committee or an angel.

- **Zoho Books** — India-built, GST-native, bank feeds, audit trail. There is
  a **free tier for Indian businesses under roughly ₹25 lakh turnover**
  (*verify current terms*); paid plans start around ₹749–899/org/month billed
  annually. Almari is inside the free tier for the whole 18-month plan under
  the Low scenario.
- **TallyPrime** — most CAs prefer it. Silver single-user perpetual ~₹22,500
  plus ~₹4,500/year TSS. Buy it only if the chosen CA insists.

**Set it up in month 1, not at first revenue.** From month 1 there will be
15–25 transactions a month. Reconstructing eighteen months of bank statements
in August 2027 costs CA time, produces a worse audit, and makes the burn
number unavailable exactly when the raise/no-raise gate needs it. Give the CA
read or collaborator access to the ledger rather than emailing statements; it
halves the retainer conversation.

**Corporate card and foreign vendor payments.** Pre-revenue Indian Pvt Ltds
rarely get a corporate *credit* card. The realistic stack is the current
account's **corporate debit card** with international usage enabled, plus a
**virtual-card layer** (Karbon, EnKash, Kodo — typically free or low monthly
at small volumes) so each recurring vendor gets its own number with a hard
limit. That kills two failure modes at once: silent renewal of a tool nobody
uses, and one compromised number taking out every subscription.

**The trap to close in month 1:** paying for Apple Developer, Anthropic, CI
minutes and Workspace on the **founder's personal card**. Three consequences
— the expense needs a reimbursement claim to be deductible at all; the
payments are the founder's LRS remittances rather than the company's, which
is technically the wrong person remitting; and foreign-currency spend on a
personal card carries **TCS under LRS above the annual threshold** (*20%
above ₹10 lakh at last check — verify, it has moved twice*). Get the company
card working **before the Apple and CI subscriptions start**, i.e. before
month 3.

**Section 195 and Form 15CA/15CB.** Two things worth knowing so the CA is
briefed rather than improvising. Post *Engineering Analysis Centre of
Excellence v. CIT* (SC, 2021), payments for standardised or shrink-wrapped
software and cloud subscriptions are generally **not "royalty"**, so no s.195
withholding — some CAs still deduct 10% out of caution, which is a real cost
on the tooling line and should be argued once, at the start. **15CA/15CB
applies to wire remittances**, generally above ₹5 lakh per year per remitter,
at ₹2,000–5,000 per 15CB certificate; card payments sit outside this in
practice, which is a second and quieter reason to have the company card. And
**if any contractor is non-resident** — worth asking at the 22 August meeting
— s.195 withholding, 15CA/15CB and treaty/TRC paperwork apply to every single
payment. Materially more expensive than a resident contractor. Price it into
the decision; do not discover it at the first invoice.

**Invoicing.** Outbound, the company issues almost nothing — store sales run
through the platforms. Two exceptions: **grant disbursements**, which usually
need an invoice or a utilisation request in the incubator's format, and
whatever GST-compliant record the CA decides is needed for the India
app-sales leg once §5.3's seller-of-record question is answered.
**E-invoicing and IRN apply above ₹5 crore turnover — not applicable, so do
not buy an e-invoicing add-on.** Inbound, every contractor invoice must carry
the contractor's **PAN** and their **GSTIN if registered**, and three flags
must be recorded **at engagement, not at payment**: GST-registered yes/no,
**Udyam/MSME-registered yes/no** (§2.4), and non-resident yes/no. Those three
flags determine three different compliance paths.

### 2.4 TDS on contractors — absent from the plan in every form

This is the highest-probability, lowest-glamour financial mistake available.

| Payment | Section | Rate | Threshold |
|---|---|---|---|
| Freelance developer or designer, professional services | **194J** | 10% | ~₹50,000/yr per payee *(raised from ₹30,000 in FY25-26 — confirm the FY26-27 figure)* |
| Contract work if characterised as a works contract | **194C** | 1% individual / 2% company | ₹30,000 single, ₹1,00,000 aggregate *(confirm current)* |
| Founder or director stipend paid **as salary** | **192** | Slab rates, monthly | — |
| Founder or director remuneration **not** as salary | **194J(1)(ba)** | **10%, no threshold, from the first rupee** | none |
| Rent, if a virtual office crosses the limit | 194-I | 10% | annual threshold |
| Any non-resident contractor | **195** | Treaty-dependent, plus 15CA/15CB | none |

The 194J(1)(ba) line catches almost every first-time founder: **director's
remuneration that is not salary attracts 10% TDS with no threshold at all.**
At the plan's ₹50,000–1,00,000/month stipend that is ₹5,000–10,000/month to
deduct and deposit, from the first month it is paid. Decide with the CA in
month 1 whether the stipend is salary (s.192 — cleaner, brings PT and Form
16) or remuneration (s.194J(1)(ba)), and then be consistent.

**Deadlines and penalties.** Deposit by the **7th of the following month**;
March deductions by 30 April. Late deduction 1%/month; late deposit
1.5%/month, computed from the date of deduction rather than the due date.
Quarterly returns — **Form 26Q** (non-salary) and **24Q** (salary) — due 31
July, 31 October, 31 January, 31 May, with a **₹200/day** late fee under
s.234E capped at the TDS amount, plus a s.271H penalty of ₹10,000–1,00,000.
**Form 16A** certificates to contractors, downloaded from TRACES and not
typed by hand, within 15 days of each return due date: 15 August, 15 November,
15 February, 15 June. And the expensive one: **s.40(a)(ia)** — TDS not
deducted, or not deposited before the ITR due date, **disallows 30% of that
expense**. On ₹10 lakh of contractor spend that is ₹3 lakh added back to
taxable income.

**Register on TRACES in month 1–2**, immediately after TAN arrives via
SPICe+. It is a separate registration from the income-tax portal, it is
fiddly, and doing it under deadline in the first quarter is avoidable pain.

**The MSME 45-day rule, quietly severe.** Under **s.43B(h)**, payments to
suppliers registered as Micro or Small under MSMED must be made within **45
days** — 15 where there is no written agreement — failing which **the expense
is disallowed in the year it is incurred** and allowed only in the year of
actual payment. Many Indian freelancers are Udyam-registered. A ₹2 lakh
contractor invoice raised in March and paid in May is disallowed for that
entire financial year. Two free mechanical fixes: ask every contractor at
engagement whether they are Udyam-registered and record it, and never let a
contractor invoice age past 45 days. Separately, **MSME Form 1** is a
half-yearly RoC return, due 31 October and 30 April, reporting dues
outstanding to MSME suppliers beyond 45 days.

**No contractor gets access to the repo or a rupee until all five exist:**
signed agreement, PAN on file, IP assignment and confidentiality clause,
Udyam/GST/residency flags recorded, and an invoice. The IP clause is §3.2.

**Contractor versus employee.** If any of the three works full-time, takes
direction, uses company equipment and is paid monthly, a tax or labour
officer can reclassify them as an employee. At four people the direct
exposure is small — **PF is mandatory at 20 employees and ESI at 10 (20 in
some states), so neither applies** — but **Professional Tax deduction does
apply to employees** (₹200/month in Karnataka above the salary threshold,
with a return), and grant applications and DPIIT self-certification both ask
about employment. The classification test in India turns on **substance, not
the label**: control over *how* the work is done, fixed hours, integration
into the organisation, exclusivity, company-provided tools, a fixed monthly
retainer rather than deliverable-based invoicing, and the absence of the
contractor's own business. Three part-time people who attend a weekly
standing meeting, work to an internally-set roadmap, use company tooling and
get paid the same amount monthly look like employees regardless of what the
contract says. Fix it the cheap way: genuine contractor agreements with
deliverables and milestones, or put them on payroll properly. *The
commencement status of India's four consolidated labour codes has been moving
and is not asserted here — confirm with the CA or CS. The substance-over-label
test itself is stable.*

### 2.5 GST earlier than the plan has it, and the LUT

The plan registers for GST at monetisation, months 9–10. That is the default
advice and it is probably wrong here, for one specific reason: **the
contractor line is front-loaded into months 3–6 at ₹60,000–2,00,000/month.**
If those contractors are GST-registered they charge 18% on top, and
unregistered the company cannot claim it — it is a dead cost.

| Contractor spend, months 3–6 | 18% GST | Recoverable if registered |
|---|---|---|
| Low end, ₹60k/month | ₹43,200 | ₹43,200 |
| High end, ₹2L/month | ₹1,44,000 | ₹1,44,000 |

Against that, voluntary registration starts the return treadmill six months
early: ₹2,000–4,000/month of extra CA cost, so ₹12,000–24,000 over the
period, plus the discipline burden of never missing a return — and a missed
return is a much worse problem than an unclaimed credit. ITC accumulates in
the electronic credit ledger and carries forward against launch-period output
tax, and ITC attributable to zero-rated exports is refundable under the LUT,
so it is not stranded. **This is not a decision to make from a memo. It is a
specific number for the CA to run in month 2, once the contractor mix is
known.** The plan does not currently ask the question, and the answer is
worth up to about ₹1.2 lakh — plus roughly ₹15,000 of ITC on the device fleet
(§1.6). Also **elect QRMP**, available under ₹5 crore turnover: quarterly
returns with a monthly payment challan instead of twelve GSTR-1s and twelve
GSTR-3Bs, which roughly halves the recurring GST retainer.

**The LUT must pre-date the first export.** Without a Letter of Undertaking,
exports are taxable at 18%, paid and then refund-claimed. The LUT is filed
per financial year, so the one covering the launch year must be filed in
**April 2027**. And the plan's threshold framing is likely the wrong mental
model: **registration is probably compulsory from rupee one rather than at
₹20 lakh**, depending on which limb of s.24 applies given Apple's and
Google's respective seller-of-record status in India. *That is §5.3's open
question already; the addition here is only that the threshold framing should
not be relied on.*

### 2.6 What a CA actually costs, and the missing Company Secretary

The plan's ₹1.5–2L/year is a reasonable envelope but it hides the shape. **CA
cost scales with the number of compliance types, not with revenue, and the
step-ups are events rather than thresholds.**

| Trigger | What starts | Incremental cost |
|---|---|---|
| Incorporation (M1) | Bookkeeping review, statutory registers, board minutes | ₹2,000–4,000/mo |
| First contractor or stipend paid (M1–M3) | Monthly TDS challans, quarterly 24Q/26Q, Form 16A | ₹1,000–3,000/mo |
| GST registration (M3 or M9) | GSTR-1/3B or QRMP, TCS reconciliation, LUT | ₹1,500–4,000/mo |
| Anyone on payroll | Payroll run, PT deduction and return, Form 16 | ₹1,000–2,500/mo |
| Annual, always | Statutory audit, AOC-4, MGT-7, ITR, DIR-3 KYC, DPT-3 | ₹25,000–50,000/yr |

**Realistic all-in for a four-person Pvt Ltd doing GST, TDS, payroll and
bookkeeping review: ₹8,000–15,000/month plus ₹25,000–50,000 annual =
₹1.2–2.3 lakh/year.** Annual-filings-only is genuinely ₹30–60k as the plan
says — but the company leaves that state the first month it pays anybody, so
**budget the step-up from month 3, not month 9.**

**Missing entirely: a Company Secretary.** A Pvt Ltd this size needs no
full-time CS, but somebody must maintain the Section 88 registers, draft
board resolutions and file MGT-7 and AOC-4. A part-time practising CS runs
**₹1,500–3,000/month or ₹15,000–35,000/year**. Skip it and the founder signs
a year of board resolutions in one sitting the week before diligence — the
exact artefact that makes an investor's lawyer slow down. Engage at month 2,
alongside the CA.

### 2.7 Insurance

**No sourced Indian premiums exist for a company this size and none are
invented here.** Every band below is what a broker would be expected to come
back with. Treat each as *get three quotes* — ICICI Lombard, Tata AIG, HDFC
Ergo, Bajaj Allianz; brokers doing startup tech lines include SecureNow,
Prudent and Policybazaar for Business. Ask for a combined SME tech package
rather than four separate policies; the bundling discount at this size is
usually larger than any single line.

| Cover | Buy it? | When | Band (unsourced) | Reasoning |
|---|---|---|---|---|
| **Professional indemnity / tech E&O** | Marginal — quote it, probably defer | At launch, month 10 | ₹15,000–40,000/yr for ~₹1 crore | No client contracts, no SLAs, no B2B, so the classic E&O trigger does not exist. The one real exposure is a **storage-migration bug destroying users' wardrobes** against a brand whose promise is *"your closet outlives the app"*. Indian consumer-court damages would be small; defence costs would not. Quote it once the P3 migration is written |
| **Cyber liability** | **No, with one condition** | — | — | The architecture removes the exposure: no server, no accounts, no user data held. But the **research-artifact inbox is a deliberate, concentrated exception** — testers' lossless exports contain photographs of faces, homes, travel dates and household members, sitting in a company mailbox, against a DPDP penalty schedule reaching ₹250 crore. **The correct control is not a policy, it is the redacted research-export variant the plan already specifies — ship it before the first tester export arrives, month 5, not after.** Revisit cover only if raw exports are ever accepted at scale |
| **D&O** | Not yet — budget it into the raise | At term sheet, M12+ | ₹25,000–75,000/yr for ₹1–5 crore | Unnecessary with two resident founder-directors and no outside money. Almost every angel or CCPS term sheet requires it, and the failure mode is discovering it at closing as an unbudgeted condition precedent. Put the line in the Scenario B budget now |
| **Equipment / portable electronics floater** | **Yes, cheap** | M3, with the device fleet | ~1.5–3% of sum insured → **₹6,000–20,000/yr on ₹4–8L of kit** | Mostly for the test-device fleet, which travels to focus groups and diary-study handovers |
| **Key-person / term life on the founder** | **No — do the operational version instead** | M2 | ₹10,000–15,000/yr for ₹1 crore if bought | §5.1 names bus-factor-1 as a top-five risk and does nothing about it. But a payout to a company with no debt, no investors and no succession plan solves nothing. **The actual missing control is credentials escrow (§1.4) and share nomination (§3.5).** Free, and it addresses the risk the insurance does not |
| **Group health** | Not statutory below ESI thresholds | — | ~₹15,000–25,000/person/yr, ₹10L cover, ages 25–35 | Group Mediclaim usually needs 7+ members, so realistically individual policies. Not a company obligation. But if any of the three leaves salaried employment for this, they lose cover on day one. A retention fact, not a compliance one |

### 2.8 Cap table hygiene, from day one

**Do not buy a cap-table tool yet.** EquityList, Trica and Qapita are the
Indian options and all have early-stage tiers, EquityList advertises a free
one. With two shareholders, no ESOP pool and no external instruments, a
maintained spreadsheet plus the statutory registers is genuinely sufficient.
Buy the SaaS the day the ESOP pool or the first CCPS/iSAFE exists — ₹0 now,
₹0–50,000/year later. **The spreadsheet is not the risk. The registers are.**

**Share certificates carry a hard two-month deadline nobody has scheduled.**
Section 56(4)(a): share certificates must be delivered to subscribers **within
two months of incorporation**, on **Form SH-1**, signed by two directors and
stamped under the applicable state Stamp Act. On subscribed capital of a lakh
or so the duty is tens to low hundreds of rupees. The cost is not money — it
is that the certificates either exist or they do not, and non-issue carries a
monetary penalty on the company and every officer in default. *(Confirm the
current quantum with the CS; it has been amended.)* **Deadline: end of month
3, roughly mid-November 2026. It is on no list anywhere in the plan or the
tracker.**

**The statutory registers**, required under Section 88 and kept at the
registered office: **Register of Members (Form MGT-1)** — this, not the
spreadsheet, is the legal record of who owns the company · Register of
Directors and KMP and their shareholding · Register of Share Transfers ·
Register of Charges · **minute books** for board meetings and the AGM. Plus
**BEN-1 declarations** from shareholders on file; BEN-2 filing is generally
not triggered where individuals hold directly, but the declarations should
exist.

**Board meetings.** Almari qualifies as a "small company" — paid-up capital
up to ₹4 crore, turnover up to ₹40 crore — so the minimum is **two board
meetings a year, one per half-year, at least 90 days apart**, not four.
Cheap. Use them: every material decision should be a minuted resolution — the
rename gate, the assignment-deed consideration, each grant application, the
spending-authority matrix, the director's loan (§2.9), the maintenance-mode
trigger (§2.10), and any contractor engagement above a threshold. §2.3 of the
plan says "papering the board approval" for the assignment deed and for
nothing else. **The first board meeting is due within 30 days of
incorporation** (month 1), transacting the auditor appointment, the bank
mandate, the pre-incorporation expense ratification and each director's
MBP-1/DIR-8 disclosures. There is no task for it.

**What the first diligence actually asks for.** SISFS at month 4 wants the
CoI, MoA/AoA, the DPIIT certificate, company PAN, bank details, provisional
or audited financials, **a cap table**, and **a board resolution authorising
the application** — so the registers and the minute book must exist by month
4, not "eventually". Angel or CCPS diligence at month 12 adds the register of
members as primary ownership evidence, share certificates, every RoC filing
(ADT-1, INC-20A, AOC-4, MGT-7, DIR-3 KYC, DPT-3), **IP assignments from every
contributor and not just the founder**, contractor and employment agreements,
TDS return and challan history, GST return history, and a clean FEMA
position. Maintained from month 1 in a single **diligence folder** on Drive,
this costs about ten minutes a month. Assembled under pressure in month 12 it
costs three to six weeks of founder time at exactly the moment the money is
time-sensitive, and it produces back-dated documents — precisely the artefact
that makes a diligence lawyer start asking what else was reconstructed.

### 2.9 How founder money legally enters the company

Missing entirely, and mechanically necessary from month 1. Grants are
back-loaded — SISFS is decided after the month-4 application, Elevate at
month 12 — and revenue starts month 10, so **months 1 to 10 are funded 100%
by the founder.** There are three ways that can happen and only one is right.

- **Personal spend that never touches the company** — what happens by
  default. Not deductible, not in the books, does not carry forward, and
  invisible as founder commitment at SISFS and at any angel conversation.
  Wrong.
- **Fresh share allotments** — Section 42 private placement per tranche: PAS-4
  offer letter, a separate bank account, allotment, **PAS-3 within 15 days**,
  fresh certificates. Far too heavy for topping up ₹2 lakh a month.
- **Unsecured loan from a director — the right answer.** Money received from
  a director is **expressly excluded from "deposits"** under the Companies
  (Acceptance of Deposits) Rules, provided the **director furnishes a written
  declaration that the funds are her own and not borrowed**, and the company
  discloses it in the Board's Report. Interest-free is fine. It sits on the
  balance sheet as a liability, it is **repayable tax-free out of future
  revenue**, and it is documentary proof of founder commitment for every
  grant and diligence conversation.

**Set this up in month 1:** a one-page loan agreement, the written
declaration on file, a board resolution authorising acceptance, and a
standing rule that **every founder rupee goes in as a numbered loan tranche,
never as personal spend.** Two consequences to hold: it makes **DPT-3
(annual, due 30 June)** mandatory, and repayment terms should be documented
from the start so that repaying yourself in FY 2028-29 does not look like
something else.

### 2.10 Spend governance, the monthly close, and the one metric

**Who approves spend.** At four people and ₹1.6–4L/month, the useful control
is one page adopted as the first board resolution. Founder approves alone up
to **₹25,000** per item. Above ₹25,000, or any new recurring subscription, or
any contractor engagement — written agreement from the second director, and
email counts. **No annual-billed plans in year 1**; monthly costs more and
buys the ability to stop. Every recurring charge lives on one card, has a
named owner, and has its renewal date in a shared calendar. The plan already
carries roughly eight recurring vendors — Apple, Play, Workspace, the ASO
tool, CI, the domain, bookkeeping, the password manager — and at a
maintenance burn of ₹1.0–1.1L/month, tool creep is a 5–10% line.

**The monthly close**, by the 10th, 60–90 minutes: bank reconciled in the
ledger and every receipt filed; TDS challan paid by the 7th, confirmed rather
than assumed; GST return status checked; **one page** giving cash at bank,
last month's burn, months of runway at trailing-three-month burn, the
compliance calendar for the next 60 days, and post-launch, units sold against
units-to-stand-still. Circulated to the second director. That is the whole
governance layer. **What breaks without it:** the plan's numbers are 18-month
aggregates, and a founder who does not close monthly discovers a burn
overrun three to four months late — on a ₹29–73L budget, three to four months
of overrun at the top of the range is **₹6–16 lakh**, a fifth of the entire
plan, spent before anyone notices.

**The one metric.** No recurring revenue, no telemetry, a one-time price and
a hard fork at month 12 rules out MRR, NRR, DAU and LTV/CAC — most of them by
architecture rather than by choice. **Post-launch the metric is *units to
stand still*: fixed monthly burn ÷ ₹267.5 net per unit.**

| Burn scenario | ₹/month | **Units/month to stand still** | Annualised | Against the plan's scenarios |
|---|---|---|---|---|
| Maintenance mode | 1,05,000 | **≈ 390** | ≈ 4,700 | ≈ the Low case (5,000/yr) |
| Scenario A midpoint | 2,80,000 | **≈ 1,050** | ≈ 12,600 | **2.5× Low, half of Mid** |
| Scenario A top | 4,00,000 | **≈ 1,500** | ≈ 18,000 | 3.6× Low |

It is computable with no telemetry — burn from the ledger, units from the
store consoles, which §5.4 explicitly permits reading. It translates every
spending decision into one sentence: *"this ₹20,000/month tool costs 75 more
copies a month, forever."* It makes the month-12 gate mechanical. And it
fails loudly: three consecutive months below the maintenance line is not an
opinion about the market, it is the answer.

**Pre-launch there are no units, so the pre-launch form is *months of runway
at trailing-three-month burn* — with a trigger the plan is missing.** §5.1's
risk 3 defines maintenance mode as the correct response to underperformance
and attaches no condition to it. Attach one now, in the first board minute:

> **At six months of runway remaining, the company drops to maintenance mode
> automatically** — contractor line stopped, marketing experiments stopped,
> stipend reduced — **unless the board resolves otherwise in writing.**

Pre-committing the trigger is the entire point. The decision is easy to make
in September 2026 and nearly impossible to make in April 2027.

### 2.11 Small things with teeth

**The compliance calendar itself.** The tracker holds dated tasks; there is
no recurring calendar. Build one in month 1: TDS deposit 7th monthly · GST
11th/20th monthly or QRMP quarterly · TDS returns 31 Jul / 31 Oct / 31 Jan /
31 May · Form 16A 15 days after each · advance tax 15 Jun / 15 Sep / 15 Dec /
15 Mar · PT per state · **DIR-3 KYC by 30 Sep for every director every year —
₹5,000 penalty per director and the DIN is deactivated** · AGM by 30 Sep ·
AOC-4 within 30 days · MGT-7 within 60 days · **DPT-3 by 30 June** · MSME
Form 1 by 31 Oct and 30 Apr. The plan correctly notes RoC lateness is
₹100/day/form, uncapped; the calendar is what makes that number never appear.

**115BAA versus 80-IAC — decide once, in month 1, and write it down.** The
concessional 22% regime under s.115BAA (~25.17% effective) **must be elected
by filing Form 10-IC before the ITR due date, the election is irreversible,
and it forfeits the Chapter VI-A deductions including the s.80-IAC tax
holiday.** For a company whose base rate is 25% anyway (turnover ≤ ₹400
crore), 115BAA saves roughly one percentage point on profits the plan already
caps as modest. **Recommendation: do not elect 115BAA.** Preserve the 80-IAC
optionality the plan calls a lottery ticket, and pay about 1% more on small
profits for it. A free option, and one form not filed.

**Advance tax from FY 2027-28.** Launch is June 2027, so the **15 September
2027** instalment is the first real one, with 234B/234C interest for
shortfall. It lands the same month as the month-12 gate and the Elevate
window. Calendar it now.

**Grant money is not free of accounting.** SISFS tranches typically arrive
through the incubator against **milestone-based utilisation certificates**,
often require a **dedicated bank account**, and constrain permitted expense
heads. Whether a revenue grant is taxable income is a CA question. **Ask the
three shortlisted incubators, in month 3 before the month-4 application, for
their utilisation-certificate format and permitted expense heads** — because
it determines whether the founder stipend, the largest line in Scenario A, is
fundable from grant money at all. Discovering that it is not, after winning
₹20 lakh, means winning ₹20 lakh you cannot spend on the thing you needed it
for.

**The dullest catastrophic failure mode:** the domain lapses, the
privacy-policy URL in both store listings 404s, and both stores treat that as
a policy violation. The app can be pulled from an expired ₹900 renewal. Lock,
auto-renew, multi-year term, company registrar account, registrant email on
Workspace and not a personal Gmail. See §5.2 for the timing question.

**Books retention.** Section 128 requires books of account and vouchers to be
preserved for **eight years**. One Drive folder, one naming convention,
decided in month 1.

---

## 3. People and governance

### 3.1 22 August is a legal event, not a kickoff

The tracker's 22 Aug task reads "Roles and equity conversation · who is a
director, who is a shareholder, who is a contractor". That meeting, as
scheduled, will produce **oral equity promises with three witnesses and no
document**. Oral equity promises are the most common Indian founder dispute
and they are unfalsifiable eighteen months later, when one person remembers
5% and the other remembers 2%.

**What must exist by 21 August. Cost ₹0–25,000, mostly drafting time.**

| Document | Signed by | Why it cannot wait |
|---|---|---|
| **Mutual NDA** | All four, at the top of the meeting, before the agenda | The agenda includes the four Almari collisions, the rename gate, the budget and the grant strategy. Once said aloud with no NDA, none of it is confidential information you can later enforce. A two-page mutual NDA is a template |
| **One-page founders' term sheet** | All four, at the end of the meeting | Binding on exactly three things: confidentiality; IP — everything created from today assigns to the company on incorporation and to the founder personally in the interim; and **no equity is granted until the SHA is executed**. Everything else — splits, roles, titles — recorded as *agreed intent, subject to the SHA* |
| **Pre-incorporation IP assignment + moonlighting warranty** | Kunjal, Nimesh, Raksha | The company does not exist until mid-September. Anything the three write, draw or name between 22 August and incorporation belongs to them personally, with no chain to the company at all |

**What breaks if skipped:** you cannot un-ring the bell. A person who has
contributed for six weeks with no signed assignment and no signed term sheet
has leverage over the entire asset, and the correct time to have asked was
before they contributed. At diligence — SISFS incubator, angel or acquirer —
"we agreed it verbally" is a finding, not an answer.

### 3.2 The SHA and the Articles must precede the SPICe+ filing

The tracker has DSCs due **4 September** and SPICe+ filed **12 September**,
both depending on the 22 August meeting. The moment SPICe+ is filed,
subscriber shares are issued to two people under whatever Articles were
attached. If that is stock Table F with no shareholders' agreement, you have
created shares that are **fully vested from minute one** in a company where
the work has not started, **no transfer restrictions**, **no buyback or call
option** on departure — and a retrofit that now requires the consent of the
person you would be restricting. They can simply say no.

**The Indian specific that makes this urgent.** Share-transfer restrictions
contained only in a shareholders' agreement and not mirrored in the Articles
of Association have historically been held unenforceable against the company
(*V.B. Rangaraj v. V.B. Gopalakrishnan*). **ROFR, tag-along, drag-along,
lock-in and the reverse-vesting call option must go into bespoke Articles
adopted at incorporation**, not just the SHA. Adopting them later means a
special resolution and an MGT-14 filing, with everyone's cooperation.

**Cost:** bespoke AoA drafted alongside the SHA adds roughly **₹10,000–25,000**
over stock Table F; the SHA itself runs **₹25,000–75,000** from a
startup-focused firm. *These are typical Indian market bands from experience,
not sourced figures — get two written quotes, the spread between firms is
large.* **Engaged by 25 August, executed before the SPICe+ filing.**

**A note on the two-director structure.** §2.1 of the plan wants a "second
nominal shareholder, resident Indian". If that person is Kunjal or any of the
three, they are **not nominal** — they are a real holder with real rights
from day one. If the intent genuinely is nominal, that must be papered as
such: small holding, express vesting, express call option, no reserved
matters. And the FEMA-residency check the tracker already lists must be run
on **all four**, not just the second shareholder.

### 3.3 Vesting, including the founder

**The default to adopt: 48-month vesting, 12-month cliff, monthly
thereafter, for all four.** Standard, understood, and what any grant
committee or angel expects to see.

**Spell out "someone leaves at month 4" now, in writing.** With a cliff,
month 4 means **zero shares vest**: the person leaves with nothing but unpaid
expense reimbursement, and the company's title to their work survives because
their assignment was outright and unconditional. Without an agreement, month
4 means whatever was said on 22 August, and their contributions sit in the
codebase under their own copyright. That is the whole argument for doing this
in nine days rather than at leisure.

**Define leaver categories explicitly**, because "he quit" and "we asked him
to go" are not the same event. **Good leaver** — resignation with notice
after the cliff, incapacity, death — keeps vested shares, with unvested
subject to the call option at par or nominal value. **Bad leaver** — breach,
fraud, competing venture, breach of the confidentiality or IP terms — call
option over **vested and unvested** at par. **Death or incapacity** — shares
transmit to heirs, but the SHA should give the company a purchase right at
fair value, otherwise the founder's spouse becomes a co-shareholder with veto
rights over the design contract.

**Implement vesting as a call option, not a buyback.** A Pvt Ltd buying back
its own shares runs into Section 68's limits and timing rules. The workable
Indian mechanism is that shares are *issued* up front and the company or the
continuing founders hold a **compulsory-transfer call option** over the
unvested portion, exercisable on a leaver event, priced at par. Make sure the
lawyer drafts it that way rather than as a "buyback", which will not work
when you need it.

**The founder's own reverse vesting — the part everyone skips.** Two
different things are being paid for with the same shares and they should be
separated. First, **a delivered asset**: a complete, verified, shipped web
app, a hand-drawn SVG design system and 28 documents of research. That is
done and it cannot un-happen. Second, **future service** — the port, the
launch, ten months of company-building — which has not happened and is
exactly what vesting exists to earn. The resolution to write down is a
**vesting credit** for the delivered asset: a tranche of the founder's shares
vested at signing, commonly expressed as 12–18 months of credit or 20–30%
vested up front, with the remainder on the same 48/12 schedule as everyone
else. **The founder should accept reverse vesting on the remainder. Refusing
it while asking three others to vest is the fastest way to lose the three.**

**The trap to avoid, and it is serious: the IP assignment deed must not be
conditional on the founder's continued service.** Vesting belongs on the
**shares**, never on the **assignment**. If the deed contains a reversion —
"rights revert if the founder ceases to be engaged" — the company's title to
its only asset is contingent, and every diligence process from SISFS onward
will treat the company as owning nothing. Assign outright; handle the
founder-leaves case through the share call option and, if a belt-and-braces
exit is wanted, a licence-back for personal non-commercial use. The tracker's
founder-deed task should carry this as a check line.

**Drag, tag and ROFR.** **Tag-along** — any transfer by the majority holder
lets the three minority holders sell pro rata on the same terms — is the only
real protection the three have, and offering it unprompted on 22 August is
worth more goodwill than a point of equity. **Drag-along** matters here for
an unusual reason: under §4.2 the default is no raise and §5.1 risk 3
contemplates maintenance mode, so if the company ever winds down or is
acquihired, a single 2% holder who has stopped answering email can block a
clean transaction. A threshold — holders of ≥75% can compel the rest on
identical terms — is cheap insurance. **ROFR plus a transfer lock-up** for
the first three to four years prevents the "my co-founder sold 3% to his
uncle" problem.

**Titles have statutory weight.** **Director is a legal office, not a
compliment.** A director carries personal liability for statutory defaults —
the tracker's own INC-20A task notes ₹1,000/day per officer. Anyone accepting
a directorship on 22 August should be told, in writing, that they are
accepting personal exposure for filings they will not personally make.
Several people will reasonably decline, and that is a better outcome than
discovering it in month 6. **Shareholder without a directorship** is the
low-obligation option for people joining part-time.

**The ESOP trap that will surprise you.** §4.1 says "create a ~10% pool
before any priced round" and "first engineers typically get 0.5–1%". Two
problems arrive before that. **Contractors cannot receive ESOPs** — under
Rule 12 of the Companies (Share Capital and Debentures) Rules, "employee"
means a permanent employee or a director excluding independent directors, and
a consultant on a monthly retainer is not eligible. So **the plan's central
cost strategy (contractors, not hires) is directly incompatible with its
central compensation strategy (ESOPs)**. Something has to give, and deciding
which on 22 August is far better than discovering it when you try to grant.
The alternatives are direct share allotment at the outset (simplest at this
size, and what the SHA is for), **sweat equity shares** under Section 54
(needs a special resolution and a registered-valuer report — add ₹15,000–40,000
for the valuation), or making the person an actual employee. Second,
**promoters and >10% directors are excluded from ESOPs** under the same rule,
with an exemption for DPIIT-recognised startups that runs for a period from
incorporation — which is precisely why the tracker's ₹0 DPIIT task is worth
more than the trademark rebate it is justified by. *Confirm the current
exemption duration and the exact resolution type for a private company with
the CS; the private-company exemptions have been amended more than once, and
no number is asserted here.* Third, **tax on exercise**: ESOP and sweat
equity are taxable as a perquisite on exercise at fair market value,
requiring a merchant-banker valuation, and the TDS-deferral benefit is
available only to startups holding the **80-IAC certificate**, which §2.2 of
the plan correctly calls a lottery ticket. **Plan on the assumption that the
team gets a tax bill on shares they cannot sell, and say so out loud on 22
August. It changes what people want.** If anyone is being granted rather than
allotted, the scheme document, board resolution, shareholder resolution,
grant letters and the Form SH-6 options register run **₹25,000–60,000**, due
month 2–3.

### 3.4 IP: every link in the chain, and the four that are missing

The company's entire asset is code, drawings and documents. The plan handles
exactly one link.

| Link | Status in the plan | What is needed |
|---|---|---|
| Founder → company, pre-incorporation code, plates, names, domains | **Covered** — tracker, month 2, stamped deed | Add the "unconditional, no reversion" check line (§3.3) |
| Kunjal / Nimesh / Raksha → company, all future contributions | **Missing** | Assignment clause in every engagement letter, plus a standalone confirmatory deed post-incorporation |
| The three → founder personally, for anything made 22 Aug to incorporation | **Missing** | Pre-incorporation assignment signed 22 Aug, rolled into the company by ratification at the first board meeting |
| Any paid designer, illustrator or marketing contractor | **Missing** | Section 17 gives a *contractor* first ownership absent written assignment — a paid illustrator owns their plates by default |
| Outside GitHub contributors | **Missing** | §1.1 — the repo is public with no LICENSE and no CLA |
| AI-tool outputs | Partially covered in §2.3 | Below |

**Section 17 of the Copyright Act, stated plainly for the 22 August
meeting:** an *employee's* work in the course of employment vests in the
employer automatically. A *contractor's* does not — the contractor owns it,
and only a written, signed assignment moves it. Since the plan's explicit
strategy is that "every 'hire someone' instinct is answered with a contractor
line instead", **the plan's own cost strategy is also its largest title
risk.** Every rupee of the ₹60,000–2,00,000/month contractor line and the
₹8,000–20,000/month design line buys work the company does not own unless a
signed assignment exists first.

**Four drafting traps to hand the lawyer**, each of which silently voids or
truncates an otherwise good deed:

1. **Section 19(5)** — if the assignment does not state a **duration**, it is
   deemed **five years**. A deed signed in 2026 with no term expires in 2031,
   quietly, and the company finds out at an acquisition.
2. **Section 19(6)** — if it does not state a **territory**, it is deemed
   **India only**. For an app selling at $4.99 in the US, that is the wrong
   half of the map.
3. **Section 19(4)** — rights not exercised within one year of assignment can
   lapse. Relevant for assets assigned but shelved.
4. **Stamping** — the tracker flags this for the founder deed (unstamped is
   inadmissible under Section 35 of the Stamp Act). The same applies to
   *every* assignment deed. Budget **₹500–2,000 stamp per deed**,
   state-dependent. *Stamp duty is state-specific and the copyright/trademark
   split matters; §5.3 already owns this question for the founder deed — ask
   for it once, priced for four.*

**Moral rights (Section 57).** An author's right of attribution and integrity
survives assignment and, on the Indian position, cannot be assigned outright;
a contractual waiver is standard practice but **its enforceability is not
settled**. Not theoretical here: the hand-drawn plates are the brand. If an
illustrator objects in 2028 to how their flats were modified, you want a
documented waiver-and-consent clause even though its strength is uncertain.
*Flagged as genuinely unsettled rather than solved.*

**The moonlighting warranty — the gap most likely to actually bite.** All
three joiners are part-time, which almost certainly means day jobs. Standard
Indian employment contracts contain broad IP-assignment and moonlighting
clauses. If Kunjal writes Almari code under an employment contract that
assigns her inventions to her employer, **her employer may own that code, and
no deed she signs with you cures it.** Required on 22 August: a written
warranty from each — no conflicting IP obligation, no confidential
information of any employer used, no work on Almari on employer time or
equipment; a **written NOC from the employer** where an existing contract is
broad, before they write a line, which is awkward to ask for and catastrophic
to skip; and practically, separate machines or at minimum separate accounts,
separate email, no employer-issued laptop, no employer VPN.

**AI-tool outputs.** §2.3 correctly notes that Anthropic assigns output
rights to the customer — but **the customer is the account holder**. If
Kunjal runs Claude Code on her personal subscription, the assignment runs to
Kunjal, and the chain to the company is only as strong as her contributor
agreement. Two rules: **company-paid seats for anyone touching code** —
roughly ₹1,900–2,900/month per Pro-tier seat, more for higher tiers, *confirm
current list price at purchase* — and an express clause in every engagement
letter covering prompts, outputs and derived works. §2.3's own advice, that
"everyone who prompts AI tools" must be inside the assignment chain,
currently has no task, no owner and no date.

**On non-competes, so nobody pays for one.** Section 27 of the Indian
Contract Act voids agreements in restraint of trade, and Indian courts have
consistently declined to enforce post-employment non-competes. If a lawyer
hands over a US-derived template with a twelve-month non-compete, that clause
is decorative. The real protection is the confidentiality obligation, the IP
assignment, and a non-solicitation-of-confidential-information clause, all of
which *are* enforceable. Do not pay for the illusion.

### 3.5 The paperwork set, per person, before their first day

1. **Engagement or offer letter** — scope, deliverables, fees or salary,
   notice period, term. Attaches everything below as schedules.
2. **IP assignment** with the Section 19 fixes — as a schedule *and* as a
   standalone stamped deed after incorporation.
3. **Confidentiality**, surviving termination indefinitely for trade secrets,
   and specifically naming the trademark position and the rename gate, the
   research-protocol data, the grant applications, and a **no-public-
   announcement rule** — no LinkedIn "excited to join Almari", no handle
   registrations, no domain purchases in their own names — until the month-8
   opposition-window check clears. That last one is the kind of thing an
   enthusiastic new joiner does within an hour of the meeting.
4. **Moonlighting and conflict warranty** (§3.4).
5. **The reading-list acknowledgment** (§3.7), which makes the vetoes a
   contractual deliverable standard rather than a cultural preference.
6. **Data-handling addendum** for anyone touching tester exports under the
   §2.5 research protocol.

**Cost: ₹15,000–40,000 once** for a lawyer-drafted template set — engagement
letter, contractor agreement, employment contract, NDA, assignment deed —
reusable forever. *Typical market pricing, not sourced.* **Drafted month 0–1;
executed before any non-founder does any work.**

**The genuinely awkward category: a person paid only in equity, with no
cash.** That is neither employee nor contractor, has no statutory home in
Indian law, and is the highest-dispute-risk arrangement there is — no
payslip, no invoice, no notice period, and total ambiguity about what they
were owed. If any of the three joins for equity alone, that arrangement needs
the **most** paper, not the least: a written scope with milestones, an
express statement that no employment relationship is created, and a vesting
schedule tied to time rather than to unmeasurable "contribution".

**Two ₹0 items that prevent governance seizing up.** First, **share
nomination (Form SH-13)** from every shareholder, naming who takes their
shares on death. Without it, a deceased founder's controlling stake enters
succession, and until probate or a succession certificate issues — which in
India can take many months — nobody can pass a shareholder resolution, change
the bank mandate, or sign anything requiring shareholder consent. Fifteen
minutes in month 1. Pair it with the death-and-disability buyout clause in
§3.3 so the outcome is a transaction rather than a deadlock. Second, **do not
set a sole-signatory bank mandate.** Joint or dual signatory above a
threshold, or a second authorised signatory — otherwise the company cannot
pay the CA, the auditor or the Apple renewal if one person is unreachable.
Must be decided at account opening; it is painful to change afterwards.

**Pre-incorporation expenses.** Between now and the bank account opening the
founder personally pays for DSCs, the attorney retainer, domains and possibly
the Apple enrolment. Under the Specific Relief Act, pre-incorporation
expenses can be adopted by the company if the arrangement is warranted by the
terms of incorporation and the company accepts it after formation.
Practically: **keep a dated expense schedule with receipts from today, and
ratify it as an agenda item at the first board meeting.** Skip it and those
rupees are gone, and the opening books start with an unexplained hole.

### 3.6 Decision rights, and protecting the vetoes from people who were not in the room

The design contract was set by a moderated focus group of six people, none of
whom are Kunjal, Nimesh or Raksha. **Documents do not defend themselves
against a well-argued, well-meaning proposal from a new colleague who was not
there.** Four mechanisms, in ascending order of strength.

**1. Reserved matters in the SHA — legal, and the highest-leverage item in
this section.** The §5.4 never-list becomes a schedule to the shareholders'
agreement, amendable only by **unanimous written consent of all
shareholders**, not a board majority. That is what makes the contract survive
a future investor conversation. §5.4's own sentence — "a funding conversation
that requires any of these is a conversation about a different company" — is
currently a sentiment with no instrument behind it. **₹0 incremental if
drafted with the SHA.** Put the continuity covenant of §1.1 in the same
schedule.

**2. Enforce it in CI, not in review.** The repo already has a brand-contract
gate over 25 files and 100+ checks. Extend it with a **grep-level ban list** —
affiliate and referral URL patterns, analytics SDK package names in
`package.json`, notification APIs, the banned copy vocabulary — so that a
violation fails the build rather than depending on a human catching it in a
diff. **One day of work, month 1.** This is how the vetoes survive a team
that grows, and it is the mechanism most consistent with how this project
already works. Pair it with CODEOWNERS and branch protection on the design
system, `docs/05`, `docs/06` and the brand-contract script (§1.5).

**3. The amendment protocol — procedural.** New people must have a
*legitimate way to disagree* or they will find an illegitimate one. The
tracker already contains the model in the dress-form task: *"Either redraw it
as a coat stand or amend the clause on the record — but decide, rather than
leaving a silent exception."* Formalise that as the standing rule: **any veto
can be challenged, in writing, in docs/07, with reasoning; it cannot be
eroded silently.** An amendment to a focus-group veto additionally requires
re-testing with a cohort drawn from the original archetypes.

**4. A living constituency — practical.** Retain two of the original panel
members as **paid design reviewers**, roughly ₹5,000–10,000 per session, four
sessions a year, ≈₹40,000/year, which fits inside the existing design line.
The vetoes then have people behind them rather than a document, and the alpha
cohorts in §4.4 already assume continued contact with these archetypes. It
converts "the founder says no" into "the panel says no", which is a far more
durable answer.

**Who decides what:**

| Domain | Decides | Consulted | Cannot be overridden by |
|---|---|---|---|
| Product scope, roadmap order, design | Founder | All four | — |
| Anything touching the §5.4 never-list | **Unanimous, in writing, per the amendment protocol** | Panel reviewers | Any single person, including the founder |
| Legal risk — TM, IP, DPDP, store policy | Attorney advises; founder decides the business trade-off | All four | Speed |
| Money above ₹25,000 | Founder plus one other signatory | — | — |
| Statutory filings and deadlines | Named owner per filing; CA executes | Board | — |
| Brand and copy-law compliance on external surfaces | Founder or a named delegate | — | Marketing convenience |

**Escalation, written down:** disagreement → raised in the weekly call → if
unresolved, a written position in docs/07 within 48 hours → founder decides
and records the reasoning → if it touches the never-list, it goes to the
unanimity rule instead and does not ship in the meantime. **Default while a
veto question is open is: do not ship.**

**Cadence for four part-time people.** **Weekly, 45 minutes, fixed slot,
agenda in advance** — anything without an agenda item is cancelled, not held.
**Monthly, 90 minutes:** money, the roadmap against §4.5's calendar, and the
§5.3 open-questions table walked item by item; this is also where the
external gates — TM opposition status, App Review, grant windows — get
checked so they are never discovered late. **Statutory board meetings** per
§2.8. And **a written decision log**: docs/07 already is one, so extend it to
company decisions rather than only design ones. It is the cheapest governance
artifact you will ever maintain and the one an incubator will ask for.

### 3.7 Onboarding the three onto the design contract

**The reading list, contractually acknowledged**, in this order, roughly two
hours:

1. `HANDOFF.md` §"Rules that are not negotiable" — the seven dealbreakers,
   one page.
2. `docs/06-focus-group-requirements.md` — especially §2 (binding amendments)
   and §3 (copy law), and §1's "Rejected outright" list.
3. `docs/05-brand-identity.md` — the design contract; and
   `skills/wardrobe-brand/SKILL.md` before any UI change.
4. `docs/07-design-decision-log.md` — not for the decisions but for the
   *form*: this is how you disagree here.
5. `docs/28-the-company.md` §5.4, §2.6 (the persona rule) and §4.3 (the copy
   law travelling to external surfaces).

**A one-page veto card, printed, in the engagement letter.** No accounts · no
cloud sync · no telemetry or analytics SDK in the binary · no ads · no
commerce or affiliate surfaces · no subscriptions · no item caps · no
notifications · no gamification chrome · no gendered anything · no required
field that erases someone · lossless export forever. Plus the copy law's
banned vocabulary. Twelve lines. This is what someone actually reads.

**A named brief for every external surface.** §4.3 already knows this — "a
contractor paid from the marketing line will write 'Organize your closet
today!' unless told otherwise" — but the tracker has it as one task with no
owner. Make the copy-law brief a mandatory attachment to every marketing
engagement letter, and make acceptance of deliverables conditional on it.

**A probation gate for design authority.** New contributors' UI work goes
through the critic pass — already a standing rule in the P1 task — for the
first three merged changes, then relaxes. Framed as onboarding, not distrust.

### 3.8 The repository is currently publishing the trademark position

This is the sharpest single finding in the review and it is entirely fixable
this week, for ₹0.

`docs/28-the-company.md` and `company/tracker.js` are committed to the public
repository, and the deploy workflow copies `company/` into `dist/company` and
force-pushes it to `gh-pages` — so **the launch plan and the internal task
board are served as a public website.** What that publishes, to anyone
including the four collision holders:

- that you have identified the 2019 ALMARI, Shop Almari, My Almari and
  Almaari Fashion as collisions, and that you assess Shop Almari as "the
  closest collision: an app, in clothing";
- that you regard the mark as semi-descriptive and vulnerable under
  s.9(1)(b), and that **"this plan does not certify clearance"**;
- your rename gate, its price, and the exact date of your month-8 go/no-go;
- your budget, your founder stipend band, your funding strategy and your
  grant applications.

**Two concrete harms, not hypothetical ones.** A documented, dated, public
statement of your own awareness of a prior user in the same field cuts
directly against a bona-fide-adoption position and is usable material for an
opponent's counsel — you have written their opening paragraph for them. And
publicly signalling intent to adopt "Almari" for a wardrobe app, months
before you file in month 3, invites a collision holder to file first in
classes 9 and 42.

**The fix, this week:** move `docs/28`, `company/` and the deploy step's copy
of `company/` into a **private repository** — a GitHub org private repo is
free — and keep the app itself public. Purge them from `gh-pages` and
re-deploy. **Note plainly that git history and any existing forks or clones
persist. This reduces exposure going forward; it does not erase it.** Ask
counsel at the month-1 engagement whether anything already published needs to
be addressed in the TM-A strategy.

**The Supabase sync in `company/README-SYNC.md` compounds it.** The proposed
RLS policies (`using (true)` / `with check (true)`) mean **anyone holding the
anon key may read, insert and update** — and the anon key is pasted into
`tracker.js`, which is served publicly. The README says "signing in is a name
badge, not a password" and warns against putting secrets in it, which is
honest, but **the board itself is the sensitive artifact**: it holds the
equity conversation, the legal briefs and the rename gate. Before enabling
sync, either put the board behind Supabase Auth with per-user policies, or
accept that it is a public document and move all people and legal content out
of it. **Do not enable it as documented while the board contains the items it
currently contains.**

---

## 4. Product and go-to-market

### 4.1 Support operations — the only signal channel there is

With no telemetry, **support mail plus store reviews are the product
analytics.** That needs a mechanism, not a good intention.

**Volume, at the plan's own funnel.** Contact rates below are judgment, built
on §1.4's numbers; they are stated so they can be argued with.

| | Paid buyers contacting (≈3%, first 90 days) | Free web/PWA users contacting (≈0.2%) | Steady state | Launch spike (weeks 1–6, ≈3.5×) |
|---|---|---|---|---|
| **Low** (5K units) | ~150/yr | ~200/yr | **~7/week** | ~25/week |
| **Mid** (25K units) | ~750/yr | ~1,000/yr | **~34/week** | ~120/week |
| **High** (100K units) | ~3,000/yr | ~4,000/yr | **~135/week** | ~470/week |

The free-web-app column is the one the plan will not expect: the web app is
public, complete and free, and **it will generate more mail than the paid
app, from people who have paid nothing, forever.** That is the cost of the
free tier and it should be named as such.

**Time per ticket is higher here than the industry default** — a local-first
app with no accounts has no lookup, no server-side record and no restore.
Blended estimate ~10 minutes, with data-loss and import/export threads
running 20–30. Low case is ~1.2 hr/week steady and 4–5 hr/week during the
spike: comfortably solo. Mid case is ~6 hr/week steady and **~20 hr/week
during the launch spike**, which is where Kunjal, Nimesh and Raksha stop
being roadmap names and become a rota. **Decide the rota in month 9, not
month 10.**

**Expected ticket mix** (judgment; the shape is what matters): ~35% "how do
I…", answerable by docs that do not yet exist · ~20% device change, phone
lost, "where did my wardrobe go" · ~15% import/export failures · ~10% bug
reports · ~10% feature requests, overwhelmingly **sync**, the one thing
launch does not have · ~5% refund and billing · ~5% BYOK key setup. **Over
half of that volume is preventable by documentation and by an export habit
built into onboarding**, which is why the help site is not a support cost —
it is the support strategy (§4.6).

**Tooling: a shared inbox is genuinely enough. Say it and stop there.**
`help@<domain>` as a **Google Group with collaborative inbox enabled**,
delivering to the founder plus one other. Workspace is already in the §4.1
budget at ~₹270/user/month. Assign, resolve and search are built in. Marginal
cost ₹0. **Do not buy Zendesk, Freshdesk or Help Scout at launch** — the
break-even is somewhere north of ~50 tickets/week, i.e. the Mid case,
post-launch. Create the address in **month 2** so it is aged and reachable by
the time it appears on a store listing, and note that both stores require a
support email or URL on the listing anyway.

**Three controls to write down in month 4, because they are cheap now and
impossible to retrofit.**

1. **A support-data retention rule.** §2.5 says "short retention on support
   threads" and nothing implements it. Set 12 months, configure the Workspace
   auto-delete rule, and write it into the privacy policy. Support mail is
   the only place the company holds personal data — an email address, and
   inevitably screenshots of people's clothes and homes.
2. **A standing instruction never to ask for user data.** Canned line:
   *"Please don't send us your export or your photos — we can't use them and
   we'd rather not hold them."* This is the operational expression of the
   whole positioning, and one contractor answering one ticket badly undoes
   it. The structure-only repro export of §1.3 is what you ask for instead.
3. **A published response-time commitment you can actually keep.** For a solo
   founder in one time zone: **"we answer within three working days."** Not
   24 hours. On the help site and in the auto-reply. An honest slow SLA beats
   a broken fast one, and this brand cannot afford a broken promise of any
   size.

Also decide in writing: **the answer language policy.** India-first
distribution means Hindi, Marathi, Tamil and Bengali mail. "We answer in
English" is a fine answer. Not having one is not.

**Store-review response.** Both stores allow one developer reply per review,
editable, with the reviewer notified and able to revise their rating. This is
the only *public* customer-facing channel the company has, and on a
no-telemetry app it is the only visible evidence that anyone is home. **A
fixed 30-minute weekly slot from launch.** Reply to every 1–3 star review and
every review containing a question. Do not reply to bare 5-stars. Never use
canned text — for a trust brand, visibly templated replies are corrosive and
they are visible. Never ask anyone to change their rating.

**The ASO handicap nobody has named.** The design contract bans
notifications, nags and gamification. The industry-standard rating prompt
(`SKStoreReviewController`, Play In-App Review) is exactly such a nag — and
ratings *volume* is a direct store-ranking input. **Almari will structurally
accumulate ratings at a fraction of competitors' rates, on both stores,
forever.** That is a real ASO cost of the contract. Decide it explicitly
rather than discovering it: either accept it — the recommendation here, since
it is consistent and "we never ask you to rate us" is itself a line worth
saying — or make a reasoned exception once, on the record, the way the plan
handles its other contract questions. **Day-one reality:** beta testers
cannot leave public reviews, since TestFlight and closed-track feedback are
private. Almari launches with **zero ratings on both stores**, against
competitors with tens of thousands. That makes the press and influencer wave,
scheduled at month 11, **arguably a month too late — it should overlap
launch**, precisely because it is the only ratings-seeding mechanism
available.

**The mechanism that replaces instrumentation: a monthly support ledger.** A
spreadsheet, one row per ticket, tagged by the seven categories above,
reviewed on a scheduled monthly date against the roadmap — plus a monthly
export of all store reviews, which the AppTweak/AppFollow line already does,
read as a corpus rather than as individual complaints. **Rule: every ticket
that reveals a confusion generates a docs page, not just a reply.** That is
the flywheel.

### 4.2 Refunds and store consumer rules

The two platforms are not symmetric and the plan assumes they are.

**Apple** is merchant of record. All refunds run through Apple
(`reportaproblem.apple.com`). The developer cannot issue, deny or usually
even see a refund without a server receiving App Store Server Notifications,
which Almari will not have. Refunded amounts are clawed back from future
proceeds. **Founder workload: effectively zero.** The correct support reply is
a link to Apple's page.

**Google Play** auto-refunds within 48 hours of purchase. **After 48 hours,
Google routes the user to the developer**, and the developer issues or
declines manually through Play Console order management. **That is real
recurring founder work on Android — the plan's primary market.** Google
tracks developer responsiveness here. At Low volume it is a handful of
actions a month; at Mid it is weekly. *Verify at account setup that Play's
post-48-hour routing still places the decision entirely with the developer;
it was true recently.*

**Rate and money.** Paid-app refund rates typically run 1–3%. At Low that is
50–150 refunds, ₹15,000–45,000/year — financially irrelevant, operationally
real. The free web app in front of the paid app should suppress this rate
meaningfully, because buyers know exactly what they are getting, and that is
a genuine and under-claimed benefit of the free tier.

**But the free tier creates one specific refund reason:** *"this is the same
as the free website, why did I pay?"* The only defence is listing copy that
states plainly what ₹299 buys — native camera intake, eviction-safe SQLite
storage, Face ID lock, guaranteed offline, store-managed updates. §1.4
already knows this list. **It has to appear in the first screenshot caption
and the first line of the description**, not buried. Skipping it converts
directly into refunds *and* 1-star reviews, and the reviews are far more
expensive than the refunds.

**The Indian consumer-protection angle, stated honestly.** The Consumer
Protection Act 2019 and the Consumer Protection (E-Commerce) Rules 2020
impose grievance-officer, disclosure and redressal-timeline obligations on
"e-commerce entities" and on sellers using marketplaces. **Whether a
developer selling through Apple or Google as merchant of record is a "seller"
under those Rules is not resolved here, and I have not seen it tested.** Three
things worth doing regardless, because they are nearly free and look bad only
if absent: publish a **named grievance contact** — name, email, response
window — on the company website, the same address as `help@` being fine;
acknowledge complaints within 48 hours and resolve within 30 days as a
published policy, matching the E-Commerce Rules' shape whether or not they
bind; and **do not put a US-style binding-arbitration or foreign-law-and-forum
clause in the terms**, which is very likely unenforceable against an Indian
consumer under the CPA's consumer-forum jurisdiction and reads worse than it
protects. Ask the same counsel handling the TM to confirm applicability — a
question inside an existing engagement, not a new one.

### 4.3 Store assets are a four-week workstream, not a three-day task

The plan allocates **3 days** ("Store listings and ASO copy") at month 9. The
honest figure is **3–4 calendar weeks of design work, starting month 7.**
This is the single item most likely to slip the launch by a month for no good
reason.

**Screenshots.** Apple requires a 6.9″ iPhone set, plus a 13″ iPad set *if*
iPad is supported — decide that early, because iPad support means a second
design pass and not a checkbox — up to 10 per set. Google Play requires a
phone set (2–8), **plus 7″ and 10″ tablet sets** if tablet form factors are
declared, plus a **1024×500 feature graphic**, which is mandatory and the
single most-forgotten Play asset. Each screenshot needs a caption written
under the copy law — no exclamation points, no urgency, address the clothes —
and **store convention is the exact opposite, so whoever writes these must be
told.**

*Good news the plan can bank:* the repo already has a capture harness —
`scripts/screenshot.mjs`, `shot-closet.mjs`, `snap-states.mjs` — and a CI
brand contract, so raw capture is nearly free. The three to four weeks is
**composition**: device framing, caption writing, ordering, dark and light
variants, and re-cutting when the port changes the UI.

**App preview video.** Apple allows up to three, 15–30 seconds, captured
on-device at exact resolutions, no hands, no device frames, with a chosen
first-frame poster. Play takes a YouTube URL with looser rules. The repo's
existing `demo.mp4` (96s) and `demo-vertical.mp4` (54s) **will not pass as-is**
— wrong length, wrong capture provenance. Budget a re-cut: about 3 days if
the existing footage can be re-shot on device, **₹15,000–40,000** if
contracted.

**Icon variants — a hard 2026 requirement the plan half-knows.** §3.2
correctly notes the Xcode 26 SDK mandate but not its icon consequence: iOS 26
expects a layered icon with **light, dark and tinted variants** produced
through Apple's Icon Composer, and Android needs an **adaptive icon**
(separate foreground and background layers) plus a **monochrome layer** for
themed icons. The repo has `public/icon.svg` and `public/icon-maskable.svg` —
PWA-grade, single-layer, not sufficient for either store. This is
illustration work on the existing hand-drawn house style: 3–4 days, belonging
to whoever draws the plates.

**Listing text and keyword research are two different disciplines and cannot
be one document.** Apple: name 30 characters, subtitle 30, promotional text
170 — editable without review, which makes it the only fast-moving copy
surface — description 4000, and a **keywords field of 100 characters**. Play:
title 30, short description 80, full description 4000, and **no keyword
field**, so Play indexes title plus short plus full description and keywords
must be written into prose. **Apple's 100-character keyword field is the
highest-leverage asset in this workstream** and deserves a dedicated day with
the ASO tool. Two hard rules: **no competitor trademarks** — both stores
prohibit it, and it is also a §2.4 own-goal — and no film or TV provenance
terms, since §2.6's rule explicitly extends to ASO keywords.

**Who does it, and what it costs.** The design and illustration contractor
line scaled to a fixed-scope sprint, or Raksha if her role covers design.
**₹40,000–80,000** for screenshots, icons and captions; **₹15,000–40,000**
for the preview video. Keyword research is founder work with the
already-budgeted ASO tool. **Calendar: month 7 start, month 8 review, month 9
upload with the submission. The plan's month-9 "store listings final" is the
deadline, not the task.**

**Three submission-form items that also live here and block a build.**
**Age ratings** — the IARC questionnaire on Play and Apple's rating
questionnaire, both revised in 2025 with new tiers; **BYOK may pull the app
out of the 4+/Everyone bucket by introducing third-party content transfer,
so check before submitting.** **Export and encryption compliance** — if
SQLCipher ships (§3.2 proposes it), that is third-party cryptography and it
voids the "HTTPS only" self-classification exemption. **Decide SQLCipher
yes/no at month 3 with its export-compliance consequence attached**, and file
at submission in month 9; ₹0–40,000 if a classification is needed.
Discovering this at the submission form blocks the month-9 submission. And
**Apple's Accessibility Nutrition Labels** (§4.7).

### 4.4 Pricing mechanics — and the number the whole plan rests on

**You cannot type a price on Apple.** Prices come from a fixed grid of ~900
price points per currency. You choose one **base storefront** and Apple
auto-generates every other storefront from it, including local tax and
rounding. **If you set $4.99 with a US base and accept auto-conversion, the
India storefront lands around ₹449–₹499, not ₹299.** The entire 70/30
India/global blended-net arithmetic in §1.4 — ₹267.5 per unit, the ₹13.4L Low
case, the whole financial argument — assumes ₹299 in India. Getting it
requires either setting India as the base storefront or manually pinning the
India price and **disabling automatic FX-driven price updates**, which
otherwise silently move it later. **That is fifteen minutes of Console work
that nobody currently owns, guarding the plan's most load-bearing number.**

*Uncertainty, stated plainly: ₹299 is very likely an available Apple India
price point — Apple's India grid uses ₹99/₹149/₹199/₹299/₹399/₹499-style
endings — but this is unverified. **Verify in App Store Connect at month 4,
not month 9.** If it is not available, the nearest neighbour changes the
arithmetic and the plan should know early.*

**Google Play** is far more permissive: per-country prices are directly
settable, so ₹299 and $4.99 both go in as typed. Play will suggest local
rounding; take it. Keep charm endings on both — ₹299 never ₹300, $4.99 never
$5.00. Apple's grid enforces this; on Play you must set it yourself.

**Three price bands, not 175.**

| Band | Price | Rationale |
|---|---|---|
| India | ₹299 | §1.4's argument, unchanged |
| US / UK / EEA / CA / AU / JP / SG / UAE | $4.99 equivalent | Stylebook's proven price class |
| **South Asia and large low-ARPU markets** — PK, BD, LK, NP, NG, ID, PH, VN, EG, BR | ~$1.99–2.99 equivalent | The diaspora and South-Asian markets are Almari's *natural* second market — a Hindi-named wardrobe app with festival-and-ceremony features. Charging $4.99 in Dhaka is the same mistake $8/month is in Delhi |

A few hours of Console work in each store, once. The gain is not revenue
optimisation — at these unit economics the delta is small either way. The
gain is not structurally excluding the markets most likely to want this
product.

**Launch pricing: one price, no sales, ever — and publish that as a stated
policy.** The design contract already decides this even though the plan does
not connect the dots: §4.3's copy law bans "urgency or discount framing", and
a launch price *is* urgency framing by construction. For a one-time purchase
there is also a structural trap that subscriptions do not have — everyone who
buys at ₹299 after a ₹149 launch week concludes they overpaid, and there is
no recurring relationship in which to make it up. Stylebook has held one
price for two decades. **"We have never had a sale and never will" is better
marketing than any sale, and it is the pricing expression of the same promise
the product makes.**

**The right instrument instead, and it is free: promo codes.** Apple provides
100 per app version per year; Play generates them in Console, *with quantity
limits worth verifying*. These are gifts, not discounts, and they are correct
for two audiences. **Every alpha and beta tester** — TestFlight testers get
the app free during beta and then have to *pay* at launch, after giving you a
year of unpaid diary studies and moderated sessions, which is a genuinely bad
taste and completely avoidable. **Allocate codes for the full cohort in month
9.** And press plus the nano and micro influencers, who are briefed to do
"honest wardrobe audits, not promo codes" — exactly right for the *audience*
and exactly wrong for the *reviewer*, who should not be paying for the thing
they are reviewing.

**Price changes later.** Raising a one-time price post-launch is fine and
does not affect existing owners. *Lowering* it punishes the earliest buyers,
who are by construction the evangelists. Treat a price cut as a decision
requiring the same explicitness the plan gives the funding fork.

### 4.5 The legal documents users see

Three separate documents. The plan names only "a plain privacy policy" and
has no task for any of them.

**Privacy policy** — mandatory URL on both store listings, must be publicly
reachable, and **required before a TestFlight external build ships**. Draft
**month 3–4**, because the month-5 alpha puts a build in strangers' hands.
Both stores block submission on a non-resolving policy URL, so it must be
live a month ahead of the month-9 submission at the very latest. The Play
Data safety form and Apple privacy labels are gated on the BYOK question that
§5.3 already owns — **which means that open question has a hard month-8
deadline, not the vague "before the BYOK build ships".**

**Terms of use** for the website and the help site.

**EULA — and the two platforms differ.** Apple applies its Standard Licensed
Application EULA automatically unless you supply a custom one. **Google Play
applies no default developer EULA at all** — absent your own, the only
governing document is Play's own ToS. For an app whose entire promise is data
permanence, a short custom EULA is worth the money for one reason above all:

> **an explicit, conspicuous statement that the company holds no copy of the
> user's data and cannot recover it, with liability capped at the purchase
> price.**

That is the single largest legal and reputational exposure this product has,
and it is unaddressed. Note the Indian constraint: a *total* exclusion of
liability may be struck as an unfair contract term under CPA 2019 s.2(46),
whereas **a cap at the ₹299 purchase price is far more defensible.** Have
counsel draft it that way rather than importing a US template.

**Cost: ₹25,000–60,000** with the same counsel handling the TM work. *That is
an estimate — ask for a fixed quote rather than trusting the number.*

**The claim-accuracy risk, which is specific to this company.** A privacy
policy here is not a compliance checkbox. **It is the product's central
claim, in legally operative form.** Three failure modes:

1. **The unqualified "never leaves your device" claim becomes false the
   moment BYOK ships.** §3.4 has the correct qualification sentence and §4.3
   says it travels — but it must travel *into the policy itself*, which is
   the document a regulator or a store reviewer reads. The policy must say:
   nothing leaves the device unless the user connects their own AI key; then
   photographs go only to the provider the user chose, under the user's own
   account and that provider's terms; Almari never receives, sees, stores or
   routes them.
2. **It must not accidentally make Almari a Data Fiduciary.** A policy
   written in the conventional voice — "we process your photos to identify
   garments" — describes the company as determining purpose and means, the
   exact test §2.5's whole DPDP argument turns on. **The BYOK section must be
   written as a description of a flow the *user* initiates and directs, not a
   service the company provides.** Put that risk in the brief to counsel
   explicitly.
3. **A false privacy representation is an unfair trade practice under CPA
   2019, an FTC §5 deception issue for US-storefront sales, and grounds for
   store removal via a privacy-label mismatch.** Same exposure, three
   jurisdictions.

Two disciplines that cost nothing and are worth more here than at almost any
other company. **The website itself must have zero analytics** — §2.5 already
commits to this and it must stay true, including any contractor-built
marketing page, because one Google Analytics tag added by a freelancer
falsifies the policy. And **version the privacy policy with a dated, public
changelog.** A trust brand that silently edits its privacy policy has broken
the only thing it sells. Keep the diffs public. It is cheap, it is unusual,
and it is the sort of thing the privacy-community cohort in §4.4 notices and
repeats.

### 4.6 Help and documentation

There is no account, no server and no in-app support channel. Help has to
live in two places at once, and the plan has neither.

**A public help site**, because both stores demand it. Apple requires a
**Support URL** in the listing and rejects placeholders and dead links
(Guideline 1.5) — a real and common rejection that would land in the plan's
single budgeted month-9 rejection cycle for an entirely avoidable reason.
Play requires a contact email and takes a website. Static pages on the
company domain, hosted on the Cloudflare Pages the plan already uses. **₹0
hosting.**

**Bundled in-app help**, because a local-first app must work offline and
linking out to the web from inside the binary breaks exactly when the user
needs it most. The port ships help as bundled content, not a WebView pointing
at a URL.

**The roughly ten pages:** Getting started · Adding garments, the three
intake paths · The ledger and cost-per-wear · **Backup and changing your
phone** · Exporting and importing · Using your own AI key · Troubleshooting ·
What the paid app adds over the free web app · Accessibility statement ·
Privacy and terms. **About one week of writing, month 6–7, sourced from the
beta support mail** so the pages answer real questions rather than imagined
ones. Written by whoever wrote the P1 tutorial copy — the voice must match,
and this app's voice is unusually specific.

**The page that must not be soft**, and the one every competitor gets wrong
in the opposite direction:

> **"How Almari keeps your data — and how you can lose it."**

One page, linked from the store listing description, from Settings, and from
the first-run welcome sheet. It states without hedging: if you lose the
device and have not exported, **the data is gone** — there is no server, no
account, no recovery, and nobody at Almari can restore it because nobody at
Almari ever had it; **there is no cross-device sync at launch**, and "sync
you own" is file-based and user-driven, so say what it is and is not; and
**the export file is the backup, nothing else is** — here is how to make one
and where to put it.

Putting this *before* the purchase looks like it costs conversion. It is
actually the highest-leverage refund-and-1-star suppressor available, and it
converts the second-largest ticket category — ~20% of tickets, and the
emotionally worst ones — from an unanswerable complaint into a thing the user
was told and can act on.

**The product consequence:** if ~20% of tickets are lost-data tickets, the
honest fix is not a docs page. It is an **export prompt in onboarding**, and
a periodic non-nagging reminder that an export exists. That is a P1/P2 scope
question, it is not currently in the tutorial's five stops, and it should be
considered for the sixth. It pairs with the scheduled local backup feature in
§1.2.

### 4.7 Accessibility as an obligation

The repo's AA contrast claim is real and well-defended —
`scripts/test-contrast.mjs` measures computed tokens across all six themes in
a browser, which is more rigour than most shipped apps have. **But contrast
is one success criterion of roughly fifty**, and the current state has
specific, checkable gaps.

| Gap | Evidence | Fix |
|---|---|---|
| **Dynamic Type does not reach the WebView** | Tailwind `rem` sizing plus hard `px` values at `src/index.css:415, 832, 843` | iOS WKWebView does **not** scale CSS `rem` with Dynamic Type — only `font: -apple-system-body` responds. Android WebView *does* apply the system font scale. The same build fails "Larger Text" on iOS and may break layout at Android's 200% non-linear scaling. **Opposite bugs, both invisible on desktop.** Must be verified on real devices during P3 |
| **Almost no live regions** | `aria-live` appears in exactly one file, `Toast.tsx` | The two-tap wear log's confirmation is the app's core interaction. With VoiceOver or TalkBack, an unannounced state change means the user does not know it worked |
| **Non-text contrast untested** | `test-contrast.mjs` measures text and background token pairs only | WCAG 1.4.11 requires 3:1 for UI components and graphical objects, and this app is unusually SVG-heavy — the drawn plates, the tile hairlines added to the garment tiles, the room frames. Extend the existing harness; it is the cheapest possible fix because the harness already exists |
| **Focus management in modals unverified** | Five modal or sheet components, no focus-trap evidence found | Keyboard and switch-control users get lost |
| Reduced motion | `prefers-reduced-motion` handled in `Glass.tsx`, `springs.ts`, `index.css`, `v2.css` | **Already good.** Verify it survives the Capacitor port |

**Store-level expectations.** **Apple's Accessibility Nutrition Labels** now
appear on App Store product pages, with developers declaring per app which
features are supported — VoiceOver, Voice Control, Larger Text, Sufficient
Contrast, Reduced Motion, Captions, Differentiate Without Color. *Whether
they are mandatory for new submissions as of mid-2026 is not confirmed here —
verify in App Store Connect before month 9.* Either way, **you must not
declare "Larger Text" if the Dynamic Type problem is unfixed.** A false
accessibility declaration on a store page is a worse failure for this brand
than an honest omission, and it is exactly the kind of small dishonesty the
positioning cannot absorb.

**The regulatory question, not guessed at.** The **European Accessibility
Act** applied from 28 June 2025 to consumer digital products and services in
the EU, and Almari sells on EU storefronts. There is a **microenterprise
exemption** for service providers — under 10 people, turnover under €2M —
which Almari would comfortably meet on the numbers. **But how a paid mobile
app distributed via a store is classified under the EAA, and how durable the
turnover-conditional exemption is, is not something this review can resolve,
and it is not asserted.** Get a one-line view from counsel at month 8, and
note that the exemption evaporates if the company ever grows into the Mid or
High scenarios. The ₹0 hedge if the answer is unclear and late: restrict EU
availability at launch in both consoles. **India:** the RPwD Act 2016
accessibility rules are aimed principally at government and public services;
this review does not assert that they bind a private consumer app and has not
seen them enforced that way. Same answer — ask, do not guess.

**What to actually do, month 5–6, before the port hardens**, because Dynamic
Type is a *code* change to the type system rather than a polish item, and
doing it after the storage migration means re-testing everything:

1. One full VoiceOver pass and one TalkBack pass on the two-tap log, garment
   intake, and export. ~2 days.
2. Fix the Dynamic Type path — `-apple-system-body`-relative sizing, or
   Capacitor `textZoom` handling. ~2–3 days.
3. Extend `test-contrast.mjs` to non-text contrast and add a focus-trap check
   to the existing 100+ checks. ~1 day. **This is the highest-value item
   because it becomes a permanent CI gate**, in the same spirit as the brand
   contract.
4. Write the accessibility statement page describing honestly what is and is
   not supported.

**Cost:** about one engineer-week — ₹0 if the founder does it, or
**₹1,00,000–2,00,000** at the plan's own ₹20–40K/day contractor rate — plus
**₹40,000–1,00,000** for a contracted external audit with a screen-reader
specialist. *The audit range is a general market estimate for Indian
accessibility consultancies and should be treated as soft.* **Recommendation:
do the in-house week regardless; buy the external audit only if the Mid case
materialises.**

The argument for doing this properly is not compliance. **It is that a
wardrobe ledger for someone with low vision — who genuinely cannot tell two
navy shirts apart in a drawer — is one of the strongest use cases this
product has, and it is currently untested.**

### 4.8 Trademark watch, and handling the four collisions at launch

The plan is thorough through registration and then stops. **Registration is
where the ongoing obligation begins.**

**The load-bearing mechanic:** when a third party applies for a confusingly
similar mark, it is published in the weekly Trade Marks Journal and you have
a **fixed four-month window from publication** to oppose. Miss it and your
only remedy is rectification or cancellation — far slower, far more
expensive. **Nobody notifies you.**

A paid watch service is not required at this size. **Calendared discipline
is:** a **monthly** public search on `tmrsearch.ipindia.gov.in` for ALMARI /
ALMAARI / ALMIRAH across classes 9, 42, 35 and 25 — the same four classes the
clearance search covers, 20 minutes; a **monthly** app-store search for the
same terms on both stores, because a copycat listing does more commercial
damage than a registry filing ever will and both stores have IP complaint
forms (Apple's Content Dispute process, Google's trademark complaint form)
which neither strictly require a registration but both move much faster with
one; and **renewal at 10 years**, calendared now, in whatever survives the
founder, because IP India's reminders are not reliable enough to depend on.
*Indian agents offer TM watch services in a range around ₹3,000–10,000 per
year per mark, but that figure is not confidently sourced — treat it as a
placeholder to quote against.* Given the manual routine takes under an hour a
month, buy the service only if the discipline visibly fails twice.

**A coexistence posture, not a fight.** The rename gate is at month 8. A
cease-and-desist can arrive at month 11, from a launch that just generated
press, and launch week is the worst imaginable time to write a playbook. Four
rules:

1. **Never use "Almari" in a Class 25 or Class 35 sense.** No clothing, no
   marketplace, no resale, no "shop" or "buy" language anywhere in the
   listing, the ASO keywords, the press kit or the influencer briefs. §5.4
   already bans commerce surfaces — this extends the ban to *vocabulary*,
   which is what a passing-off claim from ALMARI (2019) or My Almari would
   actually seize on. Add it to the copy-law brief in the existing `market`
   task.
2. **Always the composite device mark plus a fixed descriptor.** "Almari —
   wardrobe ledger", never bare "Almari". Double duty: it builds the acquired
   distinctiveness §2.4 needs against Section 9, and it separates the market
   signal from four incumbents.
3. **The store name field must carry the differentiator, for a platform
   reason and not just a legal one.** "Shop Almari" already occupies App
   Store search for the term, and **Apple rejects app names confusingly
   similar to existing listings** (Guidelines 4.1 / 5.2.1). A bare "Almari"
   in the 30-character name field risks a *metadata rejection* independent of
   any trademark dispute, landing inside the single budgeted month-9
   rejection cycle. **Decide the exact store name string at month 7, with the
   attorney, alongside the ASO work.**
4. **Pre-draft the C&D response at month 9.** Two pages: a factual
   coexistence argument — different class, different function, no commerce,
   no clothing sold, distinct device mark, dated use evidence from the file
   §2.4 already opens — plus **a decision rule agreed in advance about what
   triggers a rename versus a reply.** Write it while calm. Renaming
   post-launch costs several lakh and years, which is precisely why the
   trigger must be defined before the emotional context exists, exactly as
   the plan reasoned for the month-8 gate.

---

## 5. What this changes about the plan

### 5.1 The five things that move dates

Everything else in this document is money or hygiene. These five change the
calendar in docs/28 §4.5.

1. **The SHA, the bespoke Articles and the registered office gate the
   incorporation itself.** The tracker dates name reservation and DSCs at 4
   September and the SPICe+ filing at 12 September. Both the address pack
   (§2.2) and the Articles (§3.2) must precede the filing, and the lawyer
   must be engaged by roughly 25 August for that to be possible. **If either
   slips, the filing slips — and the filing is the root of the dependency
   tree.** This is the only date in the plan that is under three weeks away.
2. **The payout chain moves from month 9–10 to months 1–6.** D-U-N-S applied
   for in month 1, Apple org enrolment as soon as it lands, the Paid
   Applications Agreement plus W-8BEN-E plus bank and tax profiles complete
   by month 6 (§2.1). This does not add work to the launch window — it
   removes work from it.
3. **Store assets move from month 9 to month 7.** Three days becomes three to
   four weeks (§4.3). This is the single most likely cause of a one-month
   launch slip in the whole plan.
4. **Accessibility, specifically Dynamic Type, moves to months 5–6, before
   the port hardens** (§4.7). It is a type-system code change, not polish,
   and doing it after the storage migration means re-testing everything.
5. **The month-12 raise/no-raise gate is mis-dated.** First cash lands
   roughly 45–75 days after launch — mid-August 2027 at the earliest — and
   the gate is 31 August 2027 (§2.1e). **Move it to month 13–14, or
   pre-commit in writing to deciding off store-console sales data rather than
   banked cash.** Either is fine. Leaving it as-is is not.

Two more that gate a phase rather than a date: **the migration corpus,
snapshot and self-refusing migration must be done before the SQLite migration
reaches alpha in month 3** (§1.2), and **GST registration probably belongs at
month 3 rather than month 9**, subject to the CA running the number in month
2 (§2.5).

### 5.2 Where the four lenses disagree

Two genuine conflicts, surfaced rather than smoothed.

**Domain timing.** The engineering and GTM lenses both want the `.com` and
`.in` registered in **month 1** — the domain is the company's only broadcast
channel to users who have no accounts (§1.2), it carries the mandatory store
Support URL, and it is the registrant of record for `support@`. The finance
lens says defensive domains are **brand spend before clearance**, which the
plan's own rule forbids, and should wait for the month-1 to month-3 attorney
verdict. **Resolution recommended here:** register the primary `.com` and
`.in` pair in month 1 as infrastructure, not brand — the name is already
public via the repo, the exposure is ₹15,000–25,000 for a five-year locked
pair, and the alternative is having no customer channel through the entire
build. Hold the wider defensive set — `.app`, `.co.in`, the social handles —
until the clearance verdict, which is where the real brand spend lives. **Put
this on the 22 August agenda rather than deciding it silently**, because it
is an explicit exception to a rule the plan wrote.

**Listing localisation.** The engineering lens recommends localising the store
*listing* into Hindi and possibly four to six Indian languages while shipping
the app in English, at ₹5,000–15,000, because it is cheap and directly
ASO-relevant. The GTM lens recommends **en-IN and en-US only, holding hi-IN**,
because localised metadata against an English-only UI is a well-known 1-star
generator — people install expecting a Hindi app. **Recommendation: hold
hi-IN**, on the GTM reasoning, which names a specific failure mode where the
other names only a benefit. Deferring costs nothing and reverses easily;
shipping it and retracting it does not. But **decide it on the record at
month 8**, because "Almari" is a Hindi word and the temptation will be
strong, and left unmade this gets decided by whoever writes the listing at
11 p.m. the night before submission.

### 5.3 The honest cost roll-up

The four lenses each costed their own slice and each concluded, separately,
that they were adding 1–12% of budget. **Summed and de-duplicated, they are
not.** The table below removes double-counting — the device fleet, the
password manager, the domains, the legal templates and the accessibility pass
were each costed by two or more lenses — and splits the result into the two
categories that matter, because they behave completely differently.

**Category A — new money. Items with no line in docs/28 at all.**

| Item | Cost (INR) | When | Note |
|---|---|---|---|
| Founding legal: SHA + bespoke AoA + template set + founder deed + three contributor deeds + stamping + TM attorney clearance | 1,50,000–3,00,000 | Months 0–3 | *Bands are typical Indian market pricing from experience, not sourced — get two written quotes.* Partly absorbs the TM attorney fee docs/28 §2.4 already flags as unsourced, so it is not wholly new |
| User-facing legal documents: privacy policy, terms, EULA | 25,000–60,000 | Month 3–4 | *Estimate; ask for a fixed quote* |
| Test device fleet | 60,000–1,20,000 | Months 3–4 | Capitalised and depreciated; buy on the GSTIN for ~₹15,000 of ITC |
| Refurbished Mac mini M2 | 0–45,000 | Month 3 | Recommended, not required |
| Primary domain pair, five-year term, locked | 15,000–25,000 | Month 1 | §5.2 |
| Two FIDO2 hardware keys | 5,000–10,000 | Month 2 | |
| Copyright registration — source, plates, logo | 1,000–3,000 + agent fee | Months 3–4 | Agent fee unsourced |
| Cloud device farm, three months only | 11,000–14,000 | Months 5–7 | |
| Export-compliance classification, if SQLCipher ships | 0–40,000 | Month 3 decision, month 9 filing | |
| **Category A one-time total** | **≈ ₹2.7–6.2 lakh** | | |

**Category A recurring**, first full year: password manager for four seats
₹18,000–37,000 · registered or virtual office ₹24,000–48,000 · part-time
Company Secretary ₹15,000–35,000 · CA retainer step-up from month 3
₹30,000–70,000 · company-paid AI seats, two to three, ₹45,000–1,05,000 ·
equipment insurance ₹6,000–20,000 · company phone line ₹2,400–4,800 ·
bookkeeping ₹0–9,000 · release-artifact archive and off-GitHub mirror
₹0–12,000 · defensive domains post-clearance ₹5,000–11,000. **≈ ₹1.45–3.5
lakh/year, or roughly ₹12,000–29,000/month.** Deferred and conditional:
tech E&O ₹15,000–40,000/year from month 10 if quoted and taken; D&O
₹25,000–75,000/year only at a term sheet; ESOP scheme documents
₹25,000–60,000 plus a ₹15,000–40,000 valuation only if that route is chosen.
*Every insurance band is unsourced — treat them as prompts for a broker call,
not as budget lines.*

**Category B — not new money, but new claims on lines docs/28 has already
spent.** This is the more dangerous category, because it looks free.

| Item | Cost (INR) | Which existing line |
|---|---|---|
| Migration corpus, adversarial fixtures, property tests | 60,000–2,00,000 | Contractor |
| Snapshot, restore, error boundary, ring buffer, diagnostic export | 1,20,000–3,00,000 | Contractor |
| Accessibility: VoiceOver/TalkBack pass, Dynamic Type fix, CI gates | 0–2,00,000 | Contractor (₹0 if the founder does it) |
| Store assets: screenshots, icons, captions | 40,000–80,000 | Design/illustration |
| App preview video re-cut | 0–40,000 | Design/illustration |
| Never-list CI ban list, repo hardening, artifact archive setup | ~2 engineer-days | Founder time |
| **Category B total** | **≈ ₹2.2–8.2 lakh** | |

**The finding none of the four lenses could see on its own.** On the reports'
own reading of docs/28, the contractor line is ₹60,000–2,00,000/month
front-loaded into months 3–6 — **₹2.4–8.0 lakh in total.** Category B's
engineering items alone are ₹1.8–7.0 lakh of that, before the design items.
**The safety, accessibility and store-asset work this review adds would
consume essentially the entire budgeted contractor line, leaving nothing for
the port itself.** That is not a rounding error and it is not solved by
finding a slightly cheaper vendor.

**Total demand on the plan across months 0–12: roughly ₹6.4–17.9 lakh.**
Against Scenario A's 18-month band of ₹28.8–72 lakh that is **22–25%** — not
the 1–12% each individual lens estimated, because each lens only saw its own
slice.

### 5.4 Does the bootstrap budget still hold

**Partly. The recurring side holds. The one-time and contractor sides do
not.**

The recurring addition of ₹12,000–29,000/month against a ₹1.6–4L/month burn
is 7% at the low end and under 2% at the high end. That is absorbable and
needs no change to the plan.

The Category A one-time of ₹2.7–6.2 lakh is roughly one and a half to two
months of low-end burn, concentrated in months 0–4 — the months before any
grant is decided and ten months before any revenue. It is affordable but it
is front-loaded onto founder money, which makes the director's-loan mechanism
in §2.9 a month-1 necessity rather than a nicety.

**The contractor collision is the real problem, and it does not need more
money — it needs a decision.** Three options, and the plan should pick one on
the record:

- **Raise the contractor line.** Scenario A's low end of ₹1.6L/month no
  longer holds if all of Section 1's engineering is done. Raising the low end
  to roughly ₹1.9–2.0L/month restores the headroom.
- **Move the port.** Accept that months 3–6 buy data-safety and accessibility
  work, and that launch moves from month 10 to month 11.
- **Cut scope elsewhere in P2/P3.** The one thing that cannot be cut is §1.2:
  a product whose whole promise is that it does not lose your data cannot
  ship a migration with no snapshot and no self-validation.

**The honest sentence:** the ₹1.6L/month low end of Scenario A was priced for
building and selling the app. It was not priced for the app surviving its own
updates, and it was not priced for the company surviving one person's bad
week. Those two things are what this document adds, and together they cost
roughly a fifth to a quarter of the plan.

### 5.5 What is genuinely cheap — the ₹0 list

Everything below costs nothing but a decision and an afternoon, and each one
appears somewhere above. Collected here because the temptation is to read a
document this long and conclude it is all expensive.

**Month 1, one engineer-day total:** branch protection on `main` with
required status checks · `CODEOWNERS` on the migration, types, storage and
design-system files · Dependabot alerts and `dependabot.yml` · secret
scanning verified and a `gitleaks` pre-commit hook · the off-GitHub mirror ·
`package.json` version set and a version-agreement CI check · a second GitHub
org Owner.

**Month 1, one afternoon of paperwork:** share nominations (SH-13) for every
shareholder · a second bank signatory or dual mandate at account opening ·
the director's-loan instrument and declaration · the compliance calendar ·
the diligence folder · the books-retention naming convention · the decision
not to elect 115BAA.

**Month 2, one afternoon:** the custody inventory · two directors on the
Apple Account Holder recovery path · a sealed printed master credential with
a second director · the "if the founder is unreachable for 30 days" runbook ·
opting into Play App Signing at first upload.

**Before 22 August, ₹0:** move `docs/28` and `company/` to a private repo and
purge `gh-pages` (§3.8) · the mutual NDA · the moonlighting warranties.

**Across the plan, ₹0:** the spend-approval matrix · the monthly close · the
six-months-runway maintenance-mode trigger as a board minute · the
never-list as a schedule of reserved matters in the SHA · the amendment
protocol · the reading-list acknowledgment · the "If we stop" page and the
continuity covenant · publishing the commit SHA and bundle hash with each
release · the pre-staged rollback build · the standing licence-check rule for
new assets · the bundle-ID and toile-residue rules · the store-review reply
slot · the monthly TM watch · the monthly support ledger.

---

## 6. Sequenced: the next fortnight

Today is 13 August 2026. The tracker has two meetings: **15 August**, half a
day, founder and Kunjal, to walk the eleven phases, agree what P0 contains,
decide who owns the company-formation track, and set the agenda for the 22nd.
**22 August**, a full day, all four, to finalise the team, distribute work
and brief the legal questions. After that the tracker jumps to 4 September
for name reservation and DSCs, and 12 September for the SPICe+ filing.

**The organising principle for the fortnight: nothing that is expensive to
undo may happen before the instrument that makes it undoable is signed.**
That means equity and code, in that order.

### Today to Friday 14 August — before the first meeting

| Do | Why | Cost |
|---|---|---|
| **Move `docs/28`, `company/` and the deploy step's copy of `company/` to a private repo. Purge them from `gh-pages` and re-deploy** | §3.8. The trademark position, the rename gate, the budget and the grant strategy are currently a public website. This is the only item on the list that is worse tomorrow than today | ₹0, an hour |
| **Draft the two-page mutual NDA** from a template | So it can be signed at the top of the 22nd, before the agenda is spoken aloud | ₹0 |
| **Contact two startup-focused law firms** for written quotes on the SHA plus bespoke Articles plus the template set | §3.2 requires engagement by ~25 August for execution before the SPICe+ filing. Two quotes, because the spread between firms is large and every band in this document is unsourced | ₹0 to ask |
| **Start the registered-office quotes** — three providers, each asked the GST-verification question in §2.2 verbatim | It gates the SPICe+ filing on 12 September and the lead time is unknown | ₹0 to ask |
| **Open a dated pre-incorporation expense schedule** with receipts from today | §3.5. Ratified at the first board meeting; otherwise those rupees are simply gone | ₹0 |

### 15 August — founder and Kunjal

The tracker's agenda stands. Four things must be added to it, and all four
are decisions that shape the 22nd rather than work items.

1. **Agree the equity *process*, before any number is discussed with three
   people in the room.** Specifically: that nothing is issued on the 22nd,
   that the meeting produces a one-page term sheet and not a promise, and
   that the SHA and bespoke Articles are executed before the SPICe+ filing.
   Kunjal is the likely second director and second shareholder, so **this is
   the conversation that has to be had with one person before it is had with
   four.** If Kunjal is the "second nominal shareholder" of §2.1, settle now
   whether that is genuinely nominal — small holding, express vesting,
   express call option, no reserved matters — or whether Kunjal is a real
   holder with real rights. Do not leave it ambiguous into the 22nd.
2. **Decide who owns the company-formation track** — which is already on the
   agenda — and add to it the four month-1 lead-time items that gate
   everything downstream: the registered office, the D-U-N-S application, the
   bank account, and the lawyer engagement.
3. **Decide the founder's own reverse-vesting position** (§3.3), including
   the vesting credit for the delivered asset. Going into a four-person
   meeting asking three people to vest without having settled your own
   position is the fastest way to lose them.
4. **Settle the domain exception** (§5.2) and the licence direction (§1.1) so
   that both can be stated as decisions on the 22nd rather than reopened as
   debates.

### 15 to 21 August — the week between

- **Engage the lawyer.** By 25 August at the outside; earlier is better,
  because the SHA, the bespoke Articles, the template set and the founder
  deed are one brief, not four. Brief includes: reverse vesting as a **call
  option at par, not a buyback** (§3.3); the never-list as a schedule of
  reserved matters requiring unanimity (§3.6); the Section 19(4)(5)(6)
  duration and territory fixes and the stamping question priced for four
  deeds (§3.4); the founder deed drafted **unconditional, with no service
  reversion** (§3.3); and the moral-rights waiver (§3.4).
- **Draft the one-page founders' term sheet**, binding on exactly three
  things: confidentiality, IP assignment from today, and no equity until the
  SHA.
- **Draft the pre-incorporation IP assignment and the moonlighting warranty**
  for the three. These do not need to be beautiful; they need to be signed on
  the 22nd.
- **Register the primary `.com` and `.in` pair**, five-year term, registrar
  lock and auto-renew on, privacy protection on, in a company-destined
  registrar account with a non-personal registrant email (§5.2).
- **Set up the password manager and put the first credentials in it** before
  any account is shared (§1.4).

### 22 August — the four-person meeting

**Signed at the top of the meeting, before the agenda is spoken:** the mutual
NDA. The agenda contains the four Almari collisions, the rename gate, the
budget and the grant strategy, and none of it is enforceable as confidential
information once said aloud without it.

**Six things must be settled before anyone writes a line of code or is
promised equity.**

1. **The shape, not the numbers, of the cap table.** Who is a director, who
   is a shareholder, who is a contractor — and **issue nothing.** Say plainly
   that the SHA governs and that nothing is granted until it is executed.
2. **Say the four hard things out loud**, because each changes what people
   want and each is worse discovered later. **Director is a legal office with
   personal liability** for statutory defaults at ₹1,000/day per officer, and
   people may reasonably decline (§3.3). **Contractors cannot receive ESOPs**
   under Rule 12, so the plan's cost strategy and its compensation strategy
   are incompatible and something has to give (§3.3). **ESOP and sweat equity
   are taxable as a perquisite on exercise**, so the team may get a tax bill
   on shares they cannot sell (§3.3). And **a person paid only in equity has
   no statutory home in Indian law** and needs the most paper, not the least
   (§3.5).
3. **Sign the pre-incorporation IP assignment and the moonlighting warranty**
   — all three, that day. **The company does not exist until mid-September.**
   Anything written, drawn or named between now and then belongs to the
   individual unless assigned. And where a joiner's day-job contract is
   broad, **a written NOC from their employer before they write a line** —
   awkward to ask for, incurable to skip.
4. **Sign the founders' term sheet**, binding on confidentiality, IP and
   no-equity-until-SHA. Everything else recorded as agreed intent, subject to
   the SHA.
5. **Brief the legal questions**, which is already on the agenda, extended:
   the four collisions and the founder deed as listed, **plus** whether
   anyone joining is non-resident (FEMA — and if so, s.195, 15CA/15CB and
   treaty paperwork on every payment, §2.3), whether anyone is
   Udyam-registered (§2.4), and the stamp-duty question priced for four
   deeds.
6. **Set the confidentiality rules that a new joiner breaks within an hour**:
   no LinkedIn announcement, no handle registrations, no domain purchases in
   their own names, until the month-8 opposition-window check clears (§3.5).

**Also assigned that day, since the tracker's own check line says "assign the
M1 company tasks":** the registered office, the D-U-N-S application, the bank
account with its FIRC and AQB requirements and its **non-sole-signatory
mandate**, TRACES registration, the accounting software, the CA and CS
engagements including the TDS mechanism and the GST-at-month-3 question, and
the branch-protection afternoon.

### Between 22 August and the 12 September filing

Three things must complete in that window, in this order.

1. **The SHA and the bespoke Articles, executed before SPICe+ is filed.** The
   moment the filing goes in, subscriber shares are issued under whatever
   Articles were attached, and every restriction you did not put in them
   afterwards requires the consent of the person you would be restricting.
2. **The registered-office pack** — stamped rent agreement, NOC, utility bill
   — in hand before the filing, and before the 4 September name reservation
   if the provider needs lead time.
3. **The template set signed by all three** — engagement letter, IP
   assignment schedule, confidentiality, moonlighting warranty, reading-list
   acknowledgment — **before any of them gets push access to the repo.**
   Paired with the branch-protection and CODEOWNERS afternoon, so that the
   first non-founder commit lands in a repo that is protected, and under a
   licence decision that has been made.

**The one sentence to carry into both meetings:** the roadmap in docs/28 is a
plan for building and selling the app, and it is a good one. What is missing
is the plan for the app surviving its own updates, and the company surviving
one person's bad week — and of the seven most serious items, four cannot be
fixed after the fact at any price, and three of those four are settled or
lost in the next nine days.
