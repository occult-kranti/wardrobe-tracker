# 37 — The Alpha Kit

> **Status:** ready to fill and send · **Owner:** project lead · **Opened:** 2026-08-18
> **What this is:** everything needed to hand the Almari alpha to 20–50 people
> with no engineer present. Sections marked **[send to testers]** are written to
> be copied to testers as-is. Everything else is for the moderator and the team.
>
> This kit answers to: the pre-registered gates in `docs/28-the-company.md` §4.4
> (median assisted logging ≤ 2 taps; ≥60% week-1 diary completion; ≥40% week-12
> logging — all measured manually, no telemetry), phase G of
> `docs/33-alpha-mobile-roadmap.md`, and the QR distribution plan in
> `docs/34-app-development-plan.md` §7.
>
> Placeholders in `[square brackets]` are owner fills. The list is in §11.
> Nothing goes to a tester before every placeholder is resolved.

---

## 0. How to use this kit

| § | Section | Audience |
|---|---|---|
| 1 | Recruitment & cohorts | Team (screening form goes to applicants) |
| 2 | Install instructions | **Send to testers** |
| 3 | Consent & privacy note | **Send to testers** — before they install |
| 4 | Feedback form | **Send to testers** — at day 7 |
| 5 | Diary-study template | **Send to testers** — at day 0 |
| 6 | Moderator script | Moderator |
| 7 | Measurement vs gates | Team — read before day 0, do not revise after |
| 8 | Device matrix & known limits | Team |
| 9 | Issue triage | Team (the report template goes to testers) |
| 10 | Alpha calendar | Team |
| 11 | Open items for the owner | Owner |

One person runs this alpha: the **moderator**. They send every message, run
every session, count every tap, and file every report. The app has no
notifications and no telemetry by design, so every nudge and every measurement
in this document is a human doing something by hand. That is not a workaround;
it is the product's promise kept.

---

## 1. Recruitment & cohorts

**Target: 20–50 testers, three cohorts.** Minimum viable is 20; above 50 the
manual nudges and replies stop being manageable for one moderator.

| Cohort | Who | Share | Why they are here |
|---|---|---|---|
| A — Mobile-first Gen-Z fashion users | Phone-first, dress with intent most days, the demographic that is starting to pay for apps | ~40% | The daily-loop test. If logging a wear is too slow for them, the app fails its core promise |
| B — Power users | Own 50+ pieces, have tried to catalogue a wardrobe before | ~30% | The stress test. Big closets expose slow grids, heavy imports, and maths that breaks at scale |
| C — Privacy-conscious users | Read privacy policies, avoid accounts, come from privacy communities | ~30% | The trust test. They will check whether "nothing leaves your device" is true, and say so |

Recruit where the cohorts already are, per `docs/28-the-company.md` §4.4:
India metro Gen-Z fashion circles, privacy communities (global), and the
shopaholic/designer archetypes the focus group was built from. Every tester
must be 18 or older — the research-data protocol allows no exceptions.

**Screening questions** — send as the signup form. Seven questions, practical:

1. Are you 18 or older? (required — we cannot include under-18s)
2. What do you use day to day: iPhone, Android, or mostly a computer? (Rough
   model if you know it — e.g. "iPhone 12", "Pixel 6".)
3. Roughly how many pieces of clothing do you own? (Under 20 / 20–50 /
   50–100 / 100+)
4. Have you used a wardrobe or closet app before? Which one, and what made
   you keep it or drop it?
5. The alpha asks for one 30-second diary entry a day for 14 days. Can you
   commit to that?
6. Are you willing to join one 30-minute session (video call or in person)
   during the two weeks, where we watch you use the app?
7. Which of these sounds most like you?
   a. I follow fashion and put real thought into what I wear most days
   b. I own a lot of clothes and have tried to catalogue them
   c. I avoid apps that track me and I read privacy policies

Question 7 assigns the cohort (a→A, b→B, c→C). Question 2 assigns the track
(PWA or Expo Go native). Question 3 flags power users for cohort B even if
they answered a or c — a 50+ piece wardrobe is the harder test and wins the
assignment.

---

## 2. Install instructions — [send to testers]

> Written to be forwarded as-is. Fill `[brackets]` before sending.

You can run Almari three ways. Pick the one that matches what you told us in
the signup form. If anything below fails, reply to `[contact channel]` and a
human will walk you through it.

### Option 1 — iPhone (web app, Safari)

1. Open **Safari** (this only works in Safari, not Chrome or another browser).
2. Go to `[PWA URL — the live site]`.
3. Tap the **Share** button (the square with an arrow pointing up, at the
   bottom of the screen).
4. Scroll down and tap **Add to Home Screen**.
5. Tap **Add** (top right).

**Done looks like:** the Almari icon sits on your home screen. Tapping it
opens Almari full screen — no Safari address bar. After the first open it
also works with no signal.

### Option 2 — Android (web app, Chrome)

1. Open **Chrome** and go to `[PWA URL — the live site]`.
2. Either:
   - tap the install prompt if one appears (**Add Almari to Home screen**), or
   - tap the **⋮** menu (top right) → **Add to Home screen** or
     **Install app**.
3. Tap **Install** / **Add**.

**Done looks like:** the Almari icon in your app drawer or home screen.
Tapping it opens full screen, not a browser tab. Works offline after the
first open.

### Option 3 — Desktop (any modern browser)

1. Go to `[PWA URL — the live site]` in Chrome, Firefox, or Safari.
2. Optional, Chrome/Edge: click the install icon in the address bar (or the
   menu → **Install Almari**) to get it as its own window. Safari on macOS:
   **File → Add to Dock**. Firefox: just bookmark it.
3. Use it like any site.

**Done looks like:** the app loads and you can start a wardrobe. Your data
lives in that browser on that machine — do not clear the browser's site data
unless you have exported a backup from Settings first.

### Option 4 — The native track (Expo Go, iPhone and Android)

This is the test build of the native app. It runs inside Expo's free viewer
app, and we update it over the air — you never reinstall during the alpha.

1. Install **Expo Go** from the App Store or Google Play (free, from Expo).
2. Wait for our message with the **QR code** (and a link, as backup). We send
   it to you directly — it is not public.
3. Scan it:
   - **iPhone:** point the regular Camera app at the QR code and tap the
     notification that appears — it opens in Expo Go.
   - **Android:** open Expo Go and use its built-in scanner, or tap the link
     we sent.
4. Almari loads inside Expo Go.

**Done looks like:** Almari's start screen inside Expo Go. From then on, open
Expo Go and Almari is in your recent projects. When we fix something, the fix
is there the next time you open the app — no new scan, no reinstall.

**If it misbehaves:** the build is pinned to a specific Expo version (SDK 57,
and updates only land on the app version they were built for). If an Expo Go
update ever makes it say the project is incompatible, tell us and use the
web version (Option 1 or 2) meanwhile — it is the same product. Android
testers can also ask us for the direct-install (APK) link instead of Expo Go.

### Good to know, whichever option you picked

- **Your wardrobe lives on your device.** Clearing the browser's site data,
  or deleting the app without an export, deletes the wardrobe. Export a
  backup from **Settings** any time — it is one JSON file with everything in
  it.
- **The sample wardrobes are demos.** Install them to look around, but do not
  keep anything you care about inside one: sample closets are rebuilt in
  place when we ship updates. Your own wardrobe is never touched by that.
- **Almari will never notify you.** There are no push notifications, no
  reminders, no badges. If you hear from the alpha, it is a person — the
  moderator — never the app.

---

## 3. Consent & privacy note — [send to testers]

> Send this before install. A tester replies "I agree" in writing
> (email/message is fine) before day 0 counts for them.

**What you are agreeing to.** You use Almari as your wardrobe app for two
weeks. You keep a tiny daily diary (§5), fill in one feedback form midway
(§4), and — if you are up for it — join one 30-minute session where we watch
you use the app and a closing chat at the end. That is the whole ask.

**What the app collects: nothing.** Almari has no analytics, no telemetry, no
tracking, and no account by default. Your wardrobe data is stored on your
device and nowhere else. We cannot see what you log, when you open the app,
or whether you open it at all — the app has no way to tell us. That is why
this study exists: the only way we learn anything is you telling us.

**Two exceptions, both optional, both under your control:**

1. **Sync.** If you create an account and turn on sync, a copy of your
   wardrobe data is kept on our sync server (Supabase) under your account, as
   a backup. It is off by default. Signing in exists only to run sync — there
   is no other reason the app ever asks.
2. **Photo intake.** If you use the AI photo-intake feature, the photos you
   choose are sent to the AI provider through our proxy so they can be read
   into wardrobe entries. Only the photos you pick, only when you use it.
   Everything else — including the background-cutout feature — runs entirely
   on your device.

**What we ask you to share, manually:**

- Your daily diary entries and the mid-point feedback form.
- Bug reports, when something breaks (template in §9).
- Optionally, at the end: an export of your wardrobe data. If you choose
  this, we prefer the **research export** variant in Settings — it strips
  photos and free text and carries only the data shape and counts. The full
  export is yours to keep, not ours to ask for.

**How we store what you send us.** Whatever you share is kept separate from
any other system, accessible only to the alpha team, used only to improve
Almari, and deleted by `[deletion date — fixed retention date for this
study]`. It is never sold, never shared, and never used for marketing.

**Withdrawing.** You can leave the alpha at any time, for any reason, by
telling us. We delete everything you sent us. Deleting the app (or clearing
site data) removes what is on your device. No hard feelings and no follow-up
beyond one confirmation message.

**You must be 18 or older to take part.**

Questions before you agree: `[contact channel]`.

---

## 4. Feedback form — [send to testers at day 7]

> One form, sent at the mid-point. Answer as much as you can; short honest
> answers beat long polite ones. Every "I don't know" is useful data.

**Getting started**

1. How long did it take from installing Almari to having your first piece in
   the closet? (A guess is fine.)
2. Did anything make you stop, re-read, or ask someone for help? What?
3. Describe adding your first piece. Did you use a photo, the drawn flat, or
   the AI photo intake? What slowed you down?

**The daily loop**

4. When you log what you wore, how many taps does it actually take you?
   (Count once today if you can.)
5. Did you miss any days? What happened — forgot, too busy, or the app made
   it not worth it?
6. Does the Today screen ask the right question? If not, what should it ask?

**The feed**

7. Did you open the feed? What did you expect to find, and what did you
   actually find?
8. Did you share a look? If yes: was choosing who sees it clear? If no: why
   not?
9. The feed has no likes, no counts, and no followers. How did that land —
   relief, indifference, or missing something?

**Sync**

10. Did you stay local-only, or sign in and turn on sync? What made the
    decision for you?

**Trust**

11. The app says nothing leaves your device unless you opt in. Do you believe
    it? What would make you more sure — or what made you doubt it?
12. Did anything in the app make you trust it less? Anything that made you
    trust it more?

**Bugs**

13. Did anything break or look wrong? For each one:
    - What happened?
    - What did you expect instead?
    - Steps — what you tapped, in order (1, 2, 3…)
    - Your device and how you run Almari (iPhone Safari web app / Android
      Chrome web app / Expo Go / desktop browser)
    - How often: once / sometimes / every time
    - Screenshot or screen recording, if easy

**The number**

14. On a scale of 0–10, would you keep using Almari after the alpha?
    (0 = deleting it today, 10 = it stays on my home screen.) Then the
    important part: why that number?

**Open field**

15. Anything we should have asked and did not. Anything you want to say.

---

## 5. Diary-study template — [send to testers at day 0]

> Two weeks. One tiny entry a day — under 30 seconds, honestly. Reply to the
> moderator's thread each day, whenever suits you. Same-day is best; if a day
> slips, send it the next morning and say so. Batch-sending all seven on day
> 7 is better than silence, but it weakens the data — the point is what
> happened *that day*.

**Daily entry — copy this, fill it, send it:**

```
Date:
Did you wear anything today?            yes / no
Did you log it in Almari?               yes / no / partly
If you logged: how many taps did it take?   (count if you can, guess if not)
Anything confusing, broken, or annoying today?   (one line, or "no")
```

That is the whole entry. Four lines. If you wore nothing, two lines.

**Weekly reflection — at the end of each week, three questions:**

1. What did you actually use this week?
2. What did you ignore or avoid, and why?
3. If you could change one thing, what would it be?

**Why this matters:** we deliberately cannot see how you use the app — there
is no analytics. This diary is the entire measurement of whether the daily
loop works, and one of the alpha's pass/fail gates is how many testers
complete week 1 of it. Skipped days are data too: if you stopped because it
felt pointless, write that once and we will count it honestly.

---

## 6. Moderator script — 30-minute sessions

Run at least one moderated session per cohort early in week 1; more is
better. Video call with screen-share or in person both work. Have the timer,
the note template, and the tap counter ready before the call. Confirm written
consent before starting. Record only with explicit permission; notes alone
are fine.

**Intro (3 min).** Read the spirit, not necessarily the words:

- "We're testing the app, not you. Nothing you do here is wrong."
- "Think out loud — say what you're looking for, what you'd tap, what
  confuses you. Silence tells us nothing."
- "I won't help unless you're properly stuck. If I stay quiet, it's because
  you're giving us exactly what we need."
- "You can stop at any time, skip anything, and ask me anything at the end."

**Task 1 — Install (4 min).** "Get Almari onto your phone as if a friend had
sent you the link." Watch: do they find Add to Home Screen without help on
iOS? Do they look for an install prompt that iOS never shows? On the Expo Go
track: does the QR scan work first try?

**Task 2 — Add three pieces (6 min).** "Add three things you actually own."
Watch: photo vs drawn flat vs AI intake; where they hesitate on optional
fields; whether the first piece feels like work. Note anything they say about
photographing their closet — the first hour is the known slow part.

**Task 3 — Log today (3 min).** "Log what you're wearing today." **This is
gate 1.** From the moment they are on the Today screen with the intent to
log, count discrete taps out loud with them until the wear is saved. Record
the count and the exact path. Stopwatch as backup colour, but the tap count
is the gate number. If they log by a different route than the intended one,
record both counts separately.

**Task 4 — Find cost-per-wear (4 min).** "What does your most-worn thing cost
you per wear?" Watch: do they find the Ledger unaided? Do the numbers read
as plain facts, or does anything feel like a judgement? Verbatim quotes
matter here.

**Task 5 — Share a look to the feed (4 min).** "Put one outfit from your
closet onto the feed." Watch: is the audience/scope choice understood? Their
reaction to there being no likes or counts — note the first sentence they
say, word for word.

**Closing questions (6 min).**

- What almost stopped you at any point?
- What would you delete from this app?
- Who is this for? Is it for you?
- 0–10, would you keep using it after the alpha? Why that number?
- What should I have asked and didn't?

**Note-taking template — one per session:**

```
Session: [tester id / cohort] · [date] · [moderator] · [PWA iOS / PWA Android
/ desktop / Expo Go]
Consent confirmed: yes
Task 1 install:        completed y/n/partial · time · path · hesitations, quotes
Task 2 add 3 pieces:   completed y/n/partial · time · intake path chosen · friction
Task 3 log today:      TAP COUNT = [n] · path taken · stopwatch [s] · second path?
Task 4 cost-per-wear:  found y/n · where they looked first · reaction (verbatim)
Task 5 share a look:   completed y/n · scope chosen · reaction to no metrics (verbatim)
Closing:               0–10 = [n] · why (verbatim) · what almost stopped them
Bug candidates:        [list, with severity guess per §9]
Promised follow-ups:   [what we owe this tester]
```

File notes on the workroom board (§9) the same day. Memory decays; the gates
do not forgive it.

---

## 7. Measurement vs gates

The three gates are pre-registered in `docs/28-the-company.md` §4.4 and are
absolute. They are measured **only** through the manual channels in this kit.
Nobody instruments the app to check them — that would break the promise the
gates exist to protect. The circulating "28% D90 fashion-app retention"
figure is unsourced and appears in no gate, no comparison, and no writeup.

**Definitions below are fixed now, before day 0. Do not revise them after the
alpha starts.**

| Gate | Pass | How it is measured |
|---|---|---|
| 1 — Two-tap log | **Median assisted logging flow ≤ 2 taps** across all moderated sessions | The moderator counts discrete taps in every §6 session, from the Today screen (app open, intent stated) to the wear saved. The gate number is the median of those counts. Cold-start-to-logged is recorded too, but as context, not the gate. |
| 2 — Diary completion | **≥60% of diary participants complete week 1** | A *diary participant* = a tester who returns at least one daily entry. *Week 1 complete* = at least 6 of 7 daily entries for days 1–7, received by end of day 9. Pass = completions ÷ participants ≥ 0.60. |
| 3 — Week-12 logging | **≥40% of the alpha cohort logged at least one wear in week 12** | At week 12 the moderator sends every original tester one direct question: "In the last 7 days, did you log at least one wear in Almari?" Pass = yes ÷ the whole original cohort, with **non-respondents counted as no**. Conservative on purpose, so a flattering response rate cannot fake a pass. |

**What a pass means:** the gate's number is met by these measurements, by
these definitions, with the arithmetic shown in the close-out notes. Nothing
softer.

**What a failure means:** iterate, not launch. A failed gate blocks the claim
it protects; it does not kill the project.

- Gate 1 fails → the logging flow is too slow. Simplify it and re-run
  moderated sessions (a fresh cohort, or the same testers after the fix) until
  the median passes. Do not ship store builds on a flow that failed.
- Gate 2 fails → the diary itself or the daily loop is too heavy. Read the
  skipped-day reasons first; they say which. Fix the friction, re-run with a
  new cohort.
- Gate 3 fails → the habit did not survive novelty. This is the retention
  truth-teller; no cosmetic fix answers it. The product loop needs rework
  before any launch spend.

**Never** relax a gate retroactively, redefine a denominator after seeing the
numbers, or average a failure away. A gate you can negotiate with is not a
gate.

---

## 8. Device matrix & known limits

**Test matrix** (from `docs/33` G3):

| Platform | Viewport / OS | Track |
|---|---|---|
| iOS Safari | 390px (iPhone 12–15 class) | PWA — primary |
| Android Chrome | 360px and 412px | PWA — primary |
| Desktop | Chrome, Firefox, Safari (latest) | Browser tab or installed PWA — secondary |
| iOS + Android | Same phones as above | Expo Go — native track |

**Known PWA limits — tell testers the ones that bite, log the rest:**

- iOS has **no install prompt**. Add to Home Screen is manual (Share → Add to
  Home Screen). Expect task 1 of the moderated session to catch people here.
- **No push notifications on any platform** — by design, not by limitation.
  Every nudge in this alpha is a human message from the moderator.
- **No background sync.** The PWA does its work while open.
- The home-screen icon should be the Almari mark (a real PNG ships with this
  build). If an iPhone shows a grey page-screenshot tile instead, that is a
  bug — collect it as a report.
- Data lives in the browser's site storage. Clearing site data, or wiping the
  device without an export, deletes the wardrobe. The export habit (Settings
  → export) is the mitigation; the app reminds gently, and the install
  instructions say it plainly.
- Each browser on each device is a separate wardrobe unless the tester syncs
  or moves an export by hand.
- **Sample wardrobes are rebuilt in place when we ship updates.** Said in the
  install notes, repeated here because it will still surprise someone: nothing
  a tester cares about should live inside a sample closet. Their own wardrobe
  is never reseeded.

**Known Expo Go / native-track limits** (from `docs/34` §7, §10, §11):

- Expo Go supports only the built-in Expo SDK modules. If a tester reports a
  feature "missing" on the native track that exists on the PWA, check this
  first.
- The build is pinned: SDK 57, and `runtimeVersion: appVersion` means an
  over-the-air update only lands on the app version it was built for. If Expo
  Go itself updates in the store and starts rejecting the project, that is
  the known SDK-drift case: move the tester to the PWA (same product) and
  tell the lead.
- OTA updates land on next launch, on the single `preview` channel. No
  per-tester channels at this scale.
- **iOS is Expo Go only** — no TestFlight, no store build during the alpha.
  The PWA is the standing fallback for any tester, on any platform, at any
  point in the two weeks.
- **The day before day 0:** verify the QR on a *fresh* store install of Expo
  Go, on one iPhone and one Android. This check is a calendar line, not a
  nice-to-have.

---

## 9. Issue triage

**Severity ladder:**

| Severity | What it looks like | Response |
|---|---|---|
| **S1 — blocks alpha** | Crash, freeze, or any data loss: a piece, a wear log, or a wardrobe disappears | Same-day fix; OTA update (native) or deploy (PWA) as soon as it is green. If data loss is confirmed, pause new installs until the fix ships. The project lead owns this call. |
| **S2 — fix same week** | Wrong output: cost-per-wear miscounts, a wear lands on the wrong day, sync misbehaves, an export will not import | Fixed within the week, shipped in the next update, tester told when it lands. |
| **S3 — papercut** | Visual glitch, confusing copy, an awkward flow that still completes | Backlog. Batched into a weekly update. Logged, not forgotten. |
| **S4 — question or suggestion** | Not a defect | Answer the tester directly within a day; file the substance as a research note. |

**Report template** — give this to testers at day 0 and again inside the
feedback form (§4 question 13):

- What happened?
- What did you expect instead?
- Steps — what you tapped, in order (1, 2, 3…)
- Your device and how you run Almari (iPhone Safari web app / Android Chrome
  web app / Expo Go / desktop browser)
- How often: once / sometimes / every time
- Screenshot or screen recording, if easy

**Where reports land.** Testers report to `[contact channel]` — they never
file into internal tools themselves. The moderator copies every report onto
the internal workroom board (the company tracker) with a severity, a cohort
tag, and the session/diary context it came from, and closes the loop with the
tester when it is fixed. Every report gets a severity within one weekday.
Nothing a tester sends should fall into a void — silence is the fastest way
to lose a cohort.

---

## 10. Alpha calendar

The app never nags — no notifications, no badges. Every touchpoint below is a
human message from the moderator, sent by hand.

| When | What happens |
|---|---|
| **Before day 0** | Alpha-1 build published (PWA deploy + `eas update` on the `preview` channel). QR verified on a fresh Expo Go install on one iPhone and one Android. PWA URL verified on a fresh phone. Consent text, install instructions, diary template, and feedback form all filled and ready. Cohorts assigned from screening answers. |
| **Day 0** | Invites go out: consent note (§3) first, then install instructions (§2) and the diary template (§5) once consent comes back in writing. Same-day install help for anyone stuck. |
| **Day 1** | The moderator confirms every tester is installed, one by one. Stragglers get 1:1 help. Nobody starts day 2 uninstalled. |
| **Day 2** | **First-diary nudge** — a short personal message from the moderator to anyone who has not sent a day-1 entry. This is a human email/message; the app itself sends nothing, ever. |
| **Day 7** | Mid-point: the feedback form (§4) goes out, plus a diary check-in — one gentle human reminder to anyone behind on entries. Week-1 diary completion is computed here for gate 2 (entries due by end of day 9). |
| **Days 1–13** | Bug fixes ship as OTA updates / deploys as they land (§9 ladder). No re-scan, no reinstall for testers. |
| **Day 14** | Close-out: 30-minute closing interview per volunteer (the §6 closing questions work async for the rest), voluntary research-export collection under the consent protocol (§3 — redacted variant preferred), and the thank-you. |
| **Week 12** | The one-question follow-up to the whole original cohort for gate 3 (§7). Non-respondents count as no. |

**What testers get.** Our thanks, honestly meant, and — if they want it —
their name, handle, or pseudonym in the app's credits page. The default is no
name; appearing is opt-in, and they choose the name that appears. That is the
whole reward. Say it plainly at day 0 so nobody expects more.

---

## 11. Open items — owner fills before anything is sent

1. **Tester contact channel** — the email address or form link used in §2,
   §3, §9, and every nudge. One channel, owned by the moderator.
2. **Who moderates** — the named human who runs sessions, sends nudges, and
   files triage. One person, named here: `[moderator name]`.
3. **PWA URL** — confirm the alpha points at the live site
   (`https://occult-kranti.github.io/wardrobe-tracker/`) or name another host.
4. **EAS project id + QR** — `app.json` placeholders replaced
   (`REPLACE-WITH-EAS-PROJECT-ID`), `eas update --branch preview` published,
   and the QR/link from the expo.dev project page pasted into the day-0
   invite. Blocks the native track (docs/34 §9 item 1).
5. **Android APK link** — only if the channel-2 fallback is offered
   (`eas build --profile preview --platform android`, internal distribution).
6. **Retention date** — the fixed deletion date for shared research data, per
   the research-data protocol (docs/28 §2.5). Goes into §3.
7. **Credits-page mechanism** — confirm where opt-in tester names live in the
   app before promising it at day 0.

When all seven are filled, this kit can be handed to 20–50 people with no
engineer present — which is the phase-G bar.
