# The two ports — iOS and Android, run in parallel

**Date:** Thursday 13 August 2026
**Status:** Plan of record for the mobile launch. Supersedes `docs/28-the-company.md` §3.2 on storage.
**Companion boards:** [The Tech Workbench](../company/build.html) holds this as work. [The Workroom](../company/tracker.html) holds the company around it.

This document exists because "launch on iOS and Android" is not one project. It is
two release pipelines with different gatekeepers, different waiting times,
different money, and — this is the part that surprised us — different earliest
possible dates, sharing a single codebase between them. Planning them as one
line on a chart is how teams discover in November that one of them needed to
start in August.

Four specialists were briefed independently: an iOS release engineer, an Android
release engineer, a principal engineer on the toolchain, and a product designer
on the board itself. They disagreed in two places. Both disagreements are
resolved below, in the open, because a plan that hides its disputes is a plan
nobody can argue with later.

---

## The verdict, first

**Capacitor 8.5. Not Flutter. The question is not close, and the reason is
arithmetic rather than taste.**

Flutter renders its own pixels with its own layout engine. There is no DOM and
no CSS cascade, which means it can reuse exactly none of what Almari already is:

| What exists today | Measured |
|---|---|
| React components | 33 files, 14,680 lines |
| Hand-authored SVG | 69 `<svg>` roots, **1,363 `<path>` elements** |
| Generated garment plates | 49 plates, 233,796 bytes of self-contained SVG |
| Design tokens | 44 properties × **6 themes**, 231 declarations |
| Stylesheet | 889 lines |
| Verification harnesses | 9 suites, 2,746 lines |

Choosing Flutter means re-authoring all of that in Dart — **40–60 person-weeks**
— to arrive at an app that does exactly what the Capacitor build does, except
with *lower* artwork fidelity, because `flutter_svg` does not implement the full
SVG feature set the plates rely on. The Capacitor path is **8–12 person-weeks**,
of which roughly four (the storage re-architecture) you would have to do under
Flutter as well. The incremental price of Flutter is therefore 35–50
person-weeks of a four-person team, some of whom do not code, for zero
user-visible gain.

React Native is the only defensible alternative and it is still wrong here: it
reuses your React *knowledge* and roughly none of your React *code*, because it
also has no DOM and no CSS. Its rewrite cost is 70–80% of Flutter's.

Keep the PWA as the free web channel. Never as the paid product — you cannot
sell a PWA on a store, and the store is the business model.

---

## Three findings that change the plan as it was written

### 1. Android ships first, and the reason is not Google

An Android release can be built, signed and uploaded **from a Windows machine
today**. An iOS release cannot be built on Windows at all. Worse, Apple's
enrolment in India is Apple-Developer-app-only and device-bound: a Windows-only
team cannot even *enrol*, let alone build.

So the Mac is not a tooling preference, it is a **procurement gate standing in
front of the entire iOS track**. Order it in week 0, before any other decision
is settled.

| Path | Year 1 | Year 2 |
|---|---|---|
| **Buy a Mac mini M4** (16 GB / 512 GB), India MRP incl. taxes | **₹79,900** | ₹0 |
| MacStadium M4.S @ $149/mo | ₹1,70,486 | ₹1,70,486 |
| AWS EC2 Mac, two sessions a week | ≈₹2,09,000 | same |

AWS EC2 Mac carries a **24-hour minimum allocation** — AWS documents this as
compliance with Apple's macOS licence — so a single build session costs $21.07
minimum. Buying pays for itself against the cheapest usable cloud option in
**5.6 months**, and the machine doubles as the enrolment device. Buy it.

> **Verify before you spend:** ₹79,900 is May 2026 trade press. Apple India's
> live price did not render for the researcher, and a second source quoted
> ₹1,18,900 for a 512 GB configuration that may be an M4 Pro or a reseller
> price. This is the largest single line item in the plan. Open
> apple.com/in/shop/buy-mac/mac-mini in a browser before ordering.

### 2. The Play organisation account skips a three-week gate

Personal Play accounts created after 13 November 2023 must run a closed test
with **12 testers opted in continuously for 14 days** before they may even
*apply* for production access — and that application then takes "7 days or
less". **Organisation accounts are exempt from this entirely.**

That exemption is worth roughly three weeks and it is the single biggest
schedule lever available on Android. It costs a D-U-N-S number, which you need
for Apple anyway.

It compounds with a second rule: **only *internal* testers get a paid app for
free.** Closed and open testers must buy it. On the personal route, twelve
people would each have to purchase the app and stay opted in for a fortnight.
On the organisation route, internal testing — 100 seats, no review, live in
minutes — covers the entire pre-launch programme.

### 3. "Collects nothing" is not true, and both stores will ask

This is the highest-risk item in the plan and it was found by reading the code,
not the marketing.

`src/lib/anthropic.ts` line 21 posts to `https://api.anthropic.com/v1/messages`,
and line 141 attaches the user's photograph as base64. Under Google's
definitions that is both *collection* ("transmitting data from your app off a
user's device") and *sharing* (transferring to a third party). A "No data
collected" Data safety declaration shipped alongside that code is precisely the
mismatch Google enforces against.

The feature is defensible on its own terms, and the file's own header is honest
about it. It is opt-in, it uses the person's own API key, nothing is sent until
a button is pressed, there is no proxy in the middle, and what comes back is
coordinates rather than pictures. **None of that changes the store answer**, and
one detail closes the obvious escape route: Google's exception for ephemeral
processing does not apply, because Anthropic retains inputs for 30 days.

So this is a real decision, and it belongs to the lead rather than to a
researcher. Two honest options:

**Option A — ship it, declare it accurately.** Data safety says *Photos and
videos — collected and shared — optional — app functionality*. Google accepts
optional collection; what it enforces against is a false negative. Keeps a
feature that is genuinely useful and genuinely consented.

**Option B — feature-flag it off for the v1 mobile builds.** Then "no data
collected" is true, the privacy policy is four sentences, both store forms are
trivial, and the product's central claim needs no asterisk. Reintroduce it
post-launch with the declarations already written.

The Android researcher recommends B. The case for B is not really about
compliance — it is that the promise *is* the product, and a paid app whose
differentiator is "nothing leaves your device" spends something real the first
time it has to explain an exception. The case for A is that the exception is
already well-designed and removing it guts the fastest way to get garments into
a wardrobe.

**Whichever is chosen, the claim has to change**, because the sentence in the
README — "Collects: Nothing… no network call" — is already false today, on the
web, before any port. And the iOS researcher's answer of "Data Not Collected
across all 13 categories" was written without knowledge of this file: it **must
not be used as written**, under either option.

---

## The disagreement, resolved: do not adopt SQLite in v1

The Android plan schedules a `localStorage` → `@capacitor-community/sqlite`
migration in week 2. The toolchain review argues against it. **The toolchain
review is right**, and `docs/28-the-company.md` §3.2 is superseded on this point.

The argument:

1. **Almari has no queries.** The data model is one JSON document per wardrobe —
   no joins, no partial loads. A 500-garment wardrobe *without photos in it* is
   a few hundred kilobytes.
2. **Two existential migrations at once doubles the blast radius** at the exact
   moment you have the fewest users to tell you it broke.
3. **The dependency is a much larger bet than it looks**, and this is the part
   that moved the recommendation from "defer" to "do not". `@capacitor-community/sqlite`
   is now maintained by the founder of Capawesome, who sells a closed $99/month
   competitor and has publicly disparaged the community plugin. It carries 19
   open issues with zero comments, including an unanswered *"database corrupted
   and cleared"*. Its web layer depends on the abandoned `jeep-sqlite`. Its
   `iOSDatabaseLocation` setting silently excludes the database from backup
   **and** from device transfer. Blob support is broken. It is also the only
   `.so` dependency in the tree, which drags in Android's 16 KB page-size rule.
   `docs/29` already called it "the highest-consequence third-party line in the
   product"; that was an understatement.
4. SQLite's real wins — indexed query, partial load, transactional writes — are
   wins at a scale Almari has not reached.

**What v1 ships instead:**

| Data | Store |
|---|---|
| Garment photos | `Filesystem`, `Directory.Data`, JPEG files |
| Wardrobe document | `Filesystem`, `Directory.Data`, `wardrobes/<id>.json` |
| Settings, theme, session, migration bookkeeping | `@capacitor/preferences` |
| Anything at all | **not `localStorage`** |

Revisit SQLite when a real wardrobe crosses ~2,000 garments, or when launch-time
JSON parse exceeds ~100 ms on the P90 device. Measure; do not guess.

### The photo architecture, which matters more than the framework

Almari today writes every garment photograph as a `data:image/png;base64` string
into one JSON blob in `localStorage` (`src/lib/cutout.ts:795,827`;
`src/hooks/useLocalStorage.ts:76`). A 1000px-edge PNG data URL is roughly 1–3 MB
of string per garment, and the hook serialises *the entire application state,
every photo included*, on every committed change.

On mobile that is not merely slow, it is **lossy**. Capacitor's own
documentation states WebView storage "must be considered transient… the OS will
reclaim local storage from Web Views if a device is running low on space."

```
photos/<garmentId>/full.jpg     # long edge 1600, JPEG q0.82  → Directory.LibraryNoCloud
photos/<garmentId>/thumb.jpg    # long edge 400,  JPEG q0.75  → Directory.LibraryNoCloud
wardrobes/<id>.json             # metadata only, never bytes  → Directory.Data
```

Five rules, none negotiable:

- **The document stores the path, never the bytes.**
- **Store relative paths only. Never absolute.** The iOS container UUID changes
  across updates and restores (Apple TN2406), so an absolute path is a
  time-bomb that detonates on somebody else's device, months later. This is the
  highest-severity trap in the design.
- **The grid reads photos through `Capacitor.convertFileSrc()`** — a native URL
  the WebView fetches directly, so bytes never cross the JS bridge.
- **Write atomically**: `wardrobes/<id>.json.tmp`, then rename. A partial write
  during an app kill is the one way a JSON document store loses everything.
- **Never hold `PHAsset` identifiers.** They are nil under limited access,
  mutable, and revocable — the user can take the photo away from you.

**Photos go in `Directory.LibraryNoCloud`, not `Directory.Data`.** The
researcher's first pass said `Data` and then corrected itself: on iOS `Data`
maps to Documents, which is iCloud-backed, so every wardrobe would silently
spend the user's iCloud quota. Metadata in `Data` is fine and desirable — it is
small and *should* ride the backup. Not `Cache` or `Temporary` for anything:
the OS deletes those under pressure, which is the failure being escaped. Not
`External` — inaccessible from Android 10+.

**Android Auto Backup caps an app at 25 MB**, so cloud backup of photos is
impossible there regardless. That makes the user-controlled export not a
convenience but *the entire backup story* — which is why the finding that
**the export button is inert in WKWebView** (`<a download>` + `createObjectURL`
do nothing there) is existential rather than cosmetic. It is already on the
board from the earlier engineering review.

### One more measurement, and it is worse than the architecture

The cut-out intake path caps images at `OUT_EDGE = 512` (~200 KB). **The manual
add path does no resizing at all** — a raw phone JPEG goes straight to base64.
Storage quota dies at roughly **four garments** on that path. Unifying the three
intake paths behind one resize is the highest-value single refactor in the port,
and it is worth doing before the storage move rather than after.

---

## Two timelines

Both tracks assume the Pvt Ltd Certificate of Incorporation lands by early
September. **If it slips, everything downstream slides one-for-one.** Confirm
where incorporation actually stands before trusting either column.

Legend: 🔒 external gate, nobody on the team can compress it · ⚙️ work you control.

### Android — target late October 2026

| Week | Dates | Android |
|---|---|---|
| W1 | 13–16 Aug | ⚙️ Decide account type (organisation). Generate the upload keystore. `npx cap add android`, first build on a physical device. Set `minSdk 26`, confirm `targetSdk 36`. **Order the four test devices** — shipping time is why this is week 1. |
| W2 | 17–23 Aug | ⚙️ Storage adapter interface, then filesystem photos. Export/import must survive it. Back button, safe areas, status bar. |
| W3 | 24–30 Aug | ⚙️ GitHub Actions: build → sign → internal track. **First internal release.** Store listing assets. Privacy policy published. |
| W4 | 31 Aug–6 Sep | 🔒 **CIN expected → request D-U-N-S the same day.** ⚙️ Device testing across the real matrix. |
| W5–6 | 7–20 Sep | 🔒 D-U-N-S pending. ⚙️ Fix what device testing found. Recruit 12–20 testers on real Indian devices. Feature freeze. |
| W7 | 21–27 Sep | 🔒 **D-U-N-S expected** → create the organisation Play account, pay $25, submit verification. ⚙️ **Set the app to paid with a price before anything else.** |
| W8–9 | 28 Sep–11 Oct | 🔒 Account + merchant verification. 🔒 **BillDesk KYC — India-only, blocks all sales, no published turnaround.** ⚙️ Data safety, IARC, bug burn-down. |
| W10–12 | 12 Oct–1 Nov | 🔒 **First production review — 7–14 days, the softest number in this plan.** Staged rollout at 20% for 48 hours. |

**Honest band: 20 October to 10 November. Quote the outer date.**

**31 August is a hard external date**: new apps and updates must target Android
16 / API 36. Capacitor 8 already sets this. It is a checkpoint, not work —
provided nobody pins a lower target.

### iOS — target first week of December 2026

| Week | Dates | iOS |
|---|---|---|
| W0 | 13–16 Aug | ⚙️ **Order the Mac mini today.** Register the domain. |
| W1 | 17–23 Aug | ⚙️ Mac arrives. Xcode 26. **Enrol as an Individual ($99, knowingly sunk)** from the Mac. First `npx cap add ios`. ⚙️ Company website live — it gates org enrolment *and* produces the required privacy-policy URL. |
| W2–3 | 24 Aug–6 Sep | ⚙️ Same storage work as Android — this is shared, not duplicated. Migration test written **first**. 🔒 CoI expected → D-U-N-S same day. |
| W4–5 | 7–20 Sep | 🔒 D-U-N-S, then **submit organisation enrolment**. ⚙️ `PHPickerViewController` intake. `PrivacyInfo.xcprivacy`. Files-app export. First device build. |
| W6–7 | 21 Sep–4 Oct | 🔒 Apple verification. ⚙️ **The 4.2/4.3 dossier** — widget, Share Sheet, App Intents. **First TestFlight upload.** |
| W8–9 | 5–18 Oct | 🔒 **Org account live** → Paid Apps Agreement, W-8BEN-E, banking, **Small Business Program**, DSA trader status, all on one checklist day. ⚙️ Alpha rounds 1 and 2, internal TestFlight. |
| W10–13 | 19 Oct–15 Nov | ⚙️ Metadata, screenshots, nutrition label. External TestFlight as a rehearsal for review. 🔒 All agreements must read **Active** before Pricing is touched. |
| W14–16 | 16 Nov–6 Dec | 🔒 **App Store review.** Assume one rejection; 4.2 is the likely cause. Approval → **manual** release. |

**Fallback: 20 January 2027.** December review slows and Apple has historically
restricted release changes around the holiday. If you are not approved by
~10 December, hold. Approved-but-unreleased is a fine place to sit.

### Why iOS is six weeks behind, in one table

| Gate | Android | iOS |
|---|---|---|
| Can build on Windows | **Yes** | No — hardware procurement first |
| Account fee | $25 once, no renewal | $99/year |
| Pre-production testing gate | None (organisation account) | None, but TestFlight needs the account |
| External latency after incorporation | ~4 weeks | **6–10 weeks**, serial |
| First review | 7–14 days | 1–5 days, but a harder guideline bar |

Apple's chain is **CoI → D-U-N-S (~7 business days, and Apple states expediting
does not help) → org verification (no published SLA, budget 1–3 weeks) → Paid
Apps Agreement + tax + banking (weeks) → only then can a price be set.** That
chain, not the engineering, sets the iOS date.

**The Individual enrolment stopgap is what keeps the tracks independent.** $99,
knowingly wasted, buys the right to do every piece of iOS engineering, signing
and TestFlight while the organisation paperwork grinds. It is the best-value
line in this document.

---

## Running both in parallel with four people

**There is one codebase, one UI, one design system, one test suite.** iOS and
Android run the same `dist/`. There is no "Android team" and "iOS team" writing
features twice. **Genuinely platform-specific work is under 15% of the port**,
concentrated in config, signing, store operations and QA — not in features.

### Who owns what

- **The web layer** — storage adapter, photo pipeline, migration, native-feel
  pass. Roughly **70% of the engineering hours**, and platform-agnostic. Your
  strongest engineer.
- **Android end-to-end** — Windows machine, Android Studio, keystore, Play
  Console, edge-to-edge, a real mid-range device. Can be a lighter coder: this
  is configuration and QA more than programming.
- **iOS end-to-end** — needs the Mac. Certificates, provisioning, `Info.plist`,
  App Store Connect, TestFlight, keyboard behaviour, edge-swipe feel.
- **Store operations and QA** — screenshots, metadata, privacy declarations, the
  4.2 narrative, the migration test corpus, structured device testing. **This
  role does not require coding**, and it is the one most teams skip and most
  regret skipping.

### The four things that do not parallelise

1. **The storage adapter interface blocks everything.** Photo pipeline,
   migration and both platform integrations sit on it. Week one, one person,
   merged before anything else starts. *If you serialise nothing else,
   serialise this.*
2. **Store account enrolment.** Weeks of wall-clock on both platforms, gating
   TestFlight and the Play internal track. Start on day one, before code.
3. **The first signed build on each platform.** Until one exists nobody can
   test anything. "Hello-world Capacitor shell, signed, on a real device, both
   platforms" is an explicit week-one milestone.
4. **The migration.** It must land before any external tester holds real data.
   A tester who loses a wardrobe is a permanent reputational event in a
   four-person company.

Note that **iOS and Android are not serialised against each other**. They are
serialised against the shared layer. That is the entire benefit of the choice.

### Branches

Trunk-based, short-lived branches. **No long-lived `ios` or `android`
branches** — they would diverge on the 85% that is shared, and merging them
back is the exact failure this architecture exists to avoid.

```
main ──────────────────────────────────►  web (Pages) + app releases
  ├── port/storage-adapter    (1 wk, blocks all)
  ├── port/photo-pipeline
  ├── port/native-feel
  ├── port/ios-config
  └── port/android-config
```

`v2` stays as-is; do not entangle the port with it. Release with tags
(`v1.0.0-android.1`) triggering a separate `mobile.yml`. **Move the native shell
to a private repository** — `ios/` and `android/` accumulate signing
configuration and store credentials, and those must never sit in a public repo.

---

## Android Studio, Xcode, and what AI actually does here

**With Capacitor you spend very little time in either IDE.** Be blunt about it.
You need them for emulators and simulators, the signing UI, native debugging,
profiling, and build configuration. You do not write the app in them.

On agents, the honest position. The only RCT-grade evidence — METR, July 2025
([arXiv 2507.09089](https://arxiv.org/abs/2507.09089)) — found experienced
developers **19% slower** with AI while believing they were faster. METR's
February 2026 follow-up declines to quantify uplift at all. Vendor "10x" claims
are unsourced and should not appear in any plan this team writes.

Where agents genuinely help on **this** port: mechanical adapter work against a
verifiable test harness, plugin wiring, platform config files, and migration
test-corpus generation. The repo already has 2,746 lines of verification
harness, which is exactly the ground truth that makes agentic work checkable.

Where they do not: design judgement, App Store review responses, architecture
decisions, and anything touching the design contract. The contract now lives at
`.claude/skills/wardrobe-brand/SKILL.md` — moved there this week, because it was
sitting in `skills/` where Claude Code could not discover it, which meant the
one document that keeps the design honest was invisible to the assistant the
team is about to rely on.

**A human reviews every agent output, every time.** Budget the review hours
rather than assuming them away.

---

## Money

| | Android | iOS |
|---|---|---|
| Account | **$25 once**, no renewal | **$99/year** |
| Hardware | 4 test devices, ~₹40,000 | **Mac mini ₹79,900** + 1–2 test iPhones ₹35,000–65,000 |
| CI | GitHub Actions (free tier adequate) | **Xcode Cloud, 25 hrs/month free with membership** |
| Store commission | ~15% on the first $1M | 15% under the Small Business Program |
| **One-time** | **~₹55,400 (~$630)** | **₹1.28–1.79 lakh (~$1,343–1,878)** |
| **Recurring** | **₹0** | **~₹13,000–17,000/yr** |

**Neither 15% rate is automatic. Both must be applied for, and both have a
deadline shape that punishes lateness.**

- **Apple's Small Business Program** rate takes effect **15 days after the end
  of the fiscal month of approval**. Enrol the day the org account exists.
  Approval by end-October means 15% from mid-November; miss it and the first
  weeks of sales bill at 30% — double.
- **Google's reduced tier requires enrolling the account in an Account Group.**
  It is not granted by revenue level. Not enrolling means 30%, also double.
  Google additionally restructured the fee on 30 June 2026, splitting service
  from billing and rolling it out **by the buyer's region**; India stays on the
  old structure until 30 September 2027.

### The India gate that appears in no launch guide

**BillDesk KYC.** Under the RBI's payment-aggregator cross-border rules, an
Indian developer taking Play revenue must clear a BillDesk KYC process. It
**blocks all sales** until complete, it has **no published turnaround**, and it
was in neither the brief nor any generic Play launch checklist. Start it the
moment the merchant profile exists and treat its duration as unknown.

### The one-way doors, all clustered in week 7

- **Free → paid is permanent.** Once an app has been offered free it can never
  be changed to paid; you would burn the package name forever. Google does *not*
  document whether a release to a testing track counts as "offered free" — so
  **set the price before releasing to any track at all**, including internal.
- **Linking the payments profile happens once.** Redoing it costs another $25
  and a new account.
- **The business country is frozen** at account creation.

Indian GST on store revenue was researched separately and is **not settled**.
The short version: TCS under s.52 CGST is withheld by Google and is *not* your
GST paid, merely credit; a LUT in Form GST RFD-11 is filed annually to export
without paying IGST; and reverse charge on Google's service fee probably forces
registration from the first rupee regardless of the ₹20 lakh threshold. Four
questions need a chartered accountant, not a researcher — chief among them
whether the store is your customer or merely your collection agent, which drives
the entire export analysis. Do not build pricing on an 18% assumption: the rate
schedules were overhauled in September 2025 and the current position for
software services could not be confirmed.

---

## The handoff: from this document to the board

This document is the argument. **The Tech Workbench is the instruction.** Once
this is agreed, nobody should be working from this file — they should be working
from a task with a name on it and a date.

The rule for the port: **every task on the board carries why it exists**, in
plain words, before it carries an estimate. A plan that only says *what* gets
argued with. A plan that says *why* gets executed. That field is enforced by the
test suite — `every task says why it exists` fails the build if it is empty.

Reading order for somebody joining:

1. `.claude/skills/wardrobe-brand/SKILL.md` — the design contract. Before any UI change.
2. This document — why the port is shaped the way it is.
3. The Tech Workbench, filtered to their own name — what they are doing this week.
4. `docs/29-the-sidelines.md` — what the CEO review said would hurt most.

---

## Decisions needed this week

| # | Decision | Owner | Why it cannot wait |
|---|---|---|---|
| 1 | **Order the Mac mini** (~₹79,900, price to be re-checked) | Lead | It gates the entire iOS track including enrolment |
| 2 | **Individual Apple enrolment as a stopgap** ($99, knowingly sunk) | Lead | It is what makes the two tracks independent |
| 3 | **Organisation Play account, not personal** | Lead | Skips the 12-tester / 14-day gate; worth ~3 weeks |
| 4 | **The `anthropic.ts` disclosure question** | Lead + whoever writes the privacy policy | It blocks the privacy policy, the Data safety form and the nutrition label |
| 5 | **Confirm where incorporation actually stands** | Kunjal / CS | Both timelines assume a CoI by early September |
| 6 | **Domain + company website live by 31 August** | *Unassigned — the most under-owned item in the plan* | Gates Apple org enrolment and the privacy-policy URL |
| 7 | **Assign the 4.2/4.3 native surfaces** — widget, Share Sheet, App Intents | — | Not polish; it is the rejection defence |
| 8 | **Order four Android test devices** | — | Shipping time is the reason this is a week-1 decision |

---

## What is not verified

Honesty about the edges of the research, so nobody treats an estimate as a fact.

- **Apple's organisation verification turnaround.** No published SLA. 1–3 weeks
  is a budget, not a number. Only observable by doing it.
- **Google's first-production-review time.** 7–14 days is third-party
  observation; Google publishes no SLA. The softest number in the Android plan,
  and it is terminal in the schedule.
- **Apple's tax-form processing.** One third-party source claims up to 90 days.
  If true, this is the binding constraint on the iOS launch, not review.
- **The live Mac mini price in INR** — ±₹39,000 on the largest line item.
- **`@capacitor-community/sqlite` has a Capacitor 8 build.** Deferred by the
  storage decision above, but verify before any future adoption.
- **Whether GitHub still applies a 10× macOS minute multiplier** after the
  January 2026 repricing. Docs say no; docs also do not retire it.
- **Apple's 2026 holiday App Store schedule**, usually published in November.
  It decides whether December or January is the real date.
- **Indian GST on software services as of August 2026**, post the September 2025
  rate overhaul. Do not assume 18%.

The full research — 82,929 bytes on iOS, 71,059 on Android, 70,395 on the
toolchain, roughly 60 cited URLs each with every claim marked verified,
secondary or unverified — sits behind this summary. Where this document and a
detail report disagree, this document is the decision and the report is the
evidence.
