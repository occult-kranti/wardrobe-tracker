# 35 — The Alpha Panel

> **Status:** complete · **Convened:** 2026-08-18 · **Panel:** three simulated
> alpha reviewers — personas, not people — run against the mobile-first build
> (living feed, optional sign-in with opt-in Supabase sync, AI photo intake via
> relay). **Companions:** the honors spec in `docs/36-badges-rewards.md`; the
> roadmap fold-in appended to `docs/33-alpha-mobile-roadmap.md`.

---

## Moderator's summary

Four through-lines survive the noise of individual taste.

1. **Trust is the product, and the panel audited trust hardest.** Robin read the
   code and the docs; Dev asked who pays for the server; Maya noticed the
   installed app is named Almari while the internals still say TOILE. None of
   these are feature requests. The category research (`docs/24`) already told us
   the winning frame is *ownership, portability, permanence* — "your closet
   outlives the app". Every finding in this document either strengthens or
   corrodes that frame. The corrosions are all cheap to fix; the one structural
   gap — an operator-readable synced blob — already has a plan (`docs/34` H3)
   and now has a user-visible reason to be committed rather than optional.
2. **The feed's social framing outruns its reality.** The feed looks like a
   place friends post. It is, today, a stage with eleven sample wardrobes on
   it. Maya enjoyed it until she realised no friend can ever join; then it
   became "set dressing". Dev never believed in it and wants the tab-bar slot
   back. The fix is not more simulation — it is honesty about what the fiction
   is for, plus an owner decision about the slot.
3. **The numbers-driven user is under-served in the Ledger.** Dev installed for
   the ledger and found it one cut short everywhere: no per-category cost per
   wear (CPW), no marginal monthly CPW, no utilization trend, no comma-separated
   values (CSV) export. These are the exact artefacts Indyx and Cladwell charge
   $75–96/yr for (`docs/24` §2); giving them away better is the cheapest
   differentiation available.
4. **Onboarding is good — protect it.** No account wall, a skippable tour,
   drawn flats that kill photo-dread, and the two-tap log were praised by all
   three, unprompted. The risks to it are accretion (Maya's overloaded Today
   screen) and premature asks (sign-in before the third piece).

**Where the panel genuinely splits:** the feed (Maya wants it more real, Dev
wants it demoted) and badges (Maya wants them if positive and private, Dev
wants them off by default with a kill switch or not at all, Robin wants the
written veto amended in the open or honored). Both splits are resolved below as
owner decisions, not by pretending consensus.

---

## The panelists

### Maya — 22, fashion student, Android, heavy Instagram/Depop/Pinterest

**Loved:** no account wall; skippable tour; drawn flats kill photo-dread; the
two-tap log is "best-in-class".

**Issues:**

1. Brand whiplash — installed "Almari", but app internals and wordmarks still
   say TOILE.
2. Closet filter chips clip on her phone.
3. Feed personas are fake — once she realises friends cannot really join, the
   feed is set dressing.
4. "Set aside" (the private save) should grow into named collections.
5. No notifications means nothing pulls her back.

**Overload:** the Today screen stacks too much — greeting, log card, resting
note, four numbers, category bars, entries.

**Wants:** comments and direct messages (DMs) tied to feed posts; feed search;
a shareable outfit-card export at Instagram-story size (9:16).

**Sync:** would enable day one; do not show sign-in before roughly three pieces
are catalogued.

**Badges:** fine if positive and private — but she noted the founding docs
vetoed badges and asked that the tension be resolved openly; without any
visibility she would never notice them.

**Day-2 verdict:** only if logging stays under five seconds and the ledger pays
off.

### Dev — 34, consultant, iPhone, 80+ pieces, numbers-driven

**The ledger is why he installed.**

**Issues:**

1. No per-category CPW — the most decision-useful cut.
2. No CSV export or import path — an adoption killer for him.
3. No season coverage or utilization trend.
4. CPW-over-time is hidden for three months and only cumulative — he wants
   marginal monthly figures.
5. The feed wastes a tab-bar slot — move it to More.

**Loved:** the resting-dollars line; plans-not-wears honesty; same-as-yesterday
logging.

**Sync:** yes, but "who pays for the server?" needs a straight answer.

**Badges:** hates gamification theatre — off by default with a kill switch, or
not at all.

**Day-2 verdict:** yes.

### Robin — 41, vintage collector, desktop, privacy-skeptic, verified the code

**Issues:**

1. README/PLAN still claim "no account, no cloud" while sign-in and sync ship —
   docs lying by staleness. *(A QA squad is repairing the docs concurrently;
   recorded here as resolved-in-flight.)*
2. The synced blob is plaintext JSONB (a PostgreSQL binary JSON column) at rest
   — row-level security (RLS) protects against other users, not against the
   operator or host. Copy must say who can read it; client-side encryption is
   the real answer.
3. The AI relay never names the upstream model or provider at send time.
4. Last-writer-wins is silent whole-wardrobe loss — disclosed, but it will bite
   exactly the people who opt in to sync.
5. Badges violate written non-negotiable #4 (`PLAN.md`) unless the rule is
   amended in the open.

**Loved:** the export is genuinely lossless (verified against the tests); the
snapshot-post consent model; AI intake asks before sending.

**Day-2 verdict:** yes, in device mode; full trust requires end-to-end (E2E)
encryption of the synced blob.

---

## The expert loop

### Senior tech lead — feasibility and order of work

Ranked by value-per-effort, with the trust frame as the tiebreaker.

**Ship now (days, no architecture):**

- **Disclosure pack.** Sync copy names who can read the blob today (the project
  operator and the database host); the relay names the upstream model and
  provider at send time; a plain who-pays line ("the owner's Supabase project,
  free tier, costs you nothing"). Pure copy and one consent-line change; the
  highest trust-per-hour in the document. Addresses Robin 2–3, Dev's who-pays.
- **Ledger pack.** Per-category CPW is a group-by over the existing
  `costPerWear` helper; marginal monthly CPW groups wear logs by month against
  spend and stops hiding the chart for three months; utilization trend is
  wears-per-active-piece over time from `wearLogs`; CSV export serializes
  `items` + `wearLogs` alongside the existing JSON. All derivable from
  `AppState`; no schema change. Addresses Dev 1–4.
- **Brand sweep.** TOILE → Almari across wordmarks, page titles, and internal
  copy. Storage keys stay byte-identical (migration risk for zero benefit).
  Addresses Maya 1.
- **Chip-row fix.** Horizontal-scroll or wrap for closet filter chips at
  360–390px, verified through the existing 390px suites. Addresses Maya 2.
- **Sign-in timing.** Defer any sign-in surface until ≥3 pieces are catalogued.
  One flag, one copy line. Addresses Maya's sync note.

**Next (weeks):**

- **Shareable outfit card.** A 1080×1920 render of the existing recap-card art
  (already on the Phase 3 list in `PLAN.md`), client-side canvas/SVG, no
  server. This is Maya's export and the project's only organic distribution
  channel that requires no social graph.
- **Named collections from saves.** `savedPostIds` already exists; collections
  are a named grouping over it plus a Profile section. Community-layer data,
  stays local. Addresses Maya 4.
- **Last-writer-wins mitigation.** Phase B's per-entity merge fixed cross-tab
  loss; cross-device sync needs field-level merge or conflict surfacing.
  Interim: the disclosure pack says the quiet part loud.

**Committed target (the quarter):**

- **E2E-encrypted sync.** `docs/34` H3 already designs per-device keys and
  opaque blobs. The panel turns it from "optional, later" into *the* trust
  unlock: Robin's full trust is gated on it, and the who-can-read copy is
  embarrassing until it ships. Recommend promoting it to a committed target
  with sync staying opt-in and off by default until it lands.

**The notification reality, stated plainly:** push notifications are vetoed
(`docs/06` rejected outright) and a serverless progressive web app (PWA) has no
push infrastructure anyway. There is no notification-free re-engagement trick
that fits the brand. Re-engagement rests on the two-tap loop's cheapness, the
ledger's payoff, and the home-screen icon's presence — and it is measured, not
assumed, through the diary-study gates in the alpha kit (`docs/33` G2). If
those gates fail, that is a product finding, not a permission slip for push.

**Feed in the tab bar:** cheap to move, expensive to decide — see the designer
and the owner decision below.

### Principal designer

**Today, folded.** Maya's overload list is accurate; the page currently stacks
greeting, hero log card, insight line, a four-number stat row, category bars,
and recent entries. Diagnosis: the page answers "what went on the record
today?" (its own stated job) *and* previews the whole Ledger, and the second
job is the overload. Prescription:

- **Stays:** the greeting masthead (the room's voice, one line), the hero log
  card (the habit loop's only moving part), the one honest insight (already
  singular and rotating — the resting note folds into it), and the recent
  entries (the proof the record is alive).
- **Folds:** the four-stat row collapses to one quiet line — "238 wears on the
  record" — linking to the Ledger; the category bars move to the Ledger/Closet
  where numbers belong. This is the docs/02 progressive-disclosure rule applied
  to our own page: show the essential first, expand on request.

**The badge tension, resolved visually.** The veto in `PLAN.md` #4 and
`docs/06` §2.2 was against gamification *chrome* — public counts, streaks,
confetti, progress-as-achievement. The pattern that satisfies Maya (positive,
private, noticeable), Dev (off by default, kill switch), and Robin (amend the
rule in the open) is: an off-by-default Settings toggle; a quiet letterpress
"Honors" plate on Profile showing only what has been earned — never greyed-out
unearned slots, which are completion meters under another name; awards named
like atelier honors in pattern-room diction; at most one calm line on the
Ledger when one is earned. Sample wardrobes show their honors, which answers
Maya's visibility point without a single toast. Full spec: `docs/36`. The
amendment itself is the owner's call, made in the open — decision 1 below.

**Feed honesty when the personas are synthetic.** Three options, in ascending
order of surgery:

1. **Label them.** Every sample-wardrobe post and profile carries a standing
   "Sample wardrobe" marker, and the feed's first-run card says what the
   samples are for: *"These closets ship with Almari to show what a living
   feed looks like."* The fiction stays warm but becomes legible. Cheap;
   recommended regardless of what else is decided.
2. **Reframe the room.** Rename the feed's framing away from implied friends
   (the salon/look-book register the brand already uses) so the promise matches
   the population.
3. **Demote the tab.** Move the feed to More, as Dev asks, and give the slot to
   the Ledger. Correct if the alpha diary data shows the feed earns no opens;
   premature before it.

Recommendation: ship 1 now, keep the tab for the alpha window, let the G2
diary gates arbitrate 3. The panel is split; the data should settle it.

### Behavioral researcher

Frameworks applied, each defined on first use; claims grounded in this repo's
own `docs/02` and `docs/06` rather than imported cargo.

**Technology Acceptance Model (TAM — Davis's two-gate model: people adopt what
they perceive as useful and perceive as easy).** Almari scores unusually high
on both gates for the cataloguing chore that kills the category (`docs/24` §5:
the 6–8-hour setup wall): perceived usefulness lands through the ledger (Dev)
and the drawn flats (Maya); perceived ease lands through the skippable tour and
the two-tap log, which satisfies docs/02's one-tap rule. The TAM threat is not
usability — it is trust erosion taxing perceived usefulness for the privacy
segment (Robin). Every disclosure fix above is therefore adoption work, not
compliance decoration.

**Self-Determination Theory (SDT — Deci & Ryan: motivation sustains when
autonomy, competence, and relatedness are fed).**

- *Autonomy:* strong. No account wall, everything opt-in, device mode
  first-class, export lossless — the user can leave, which is why they stay.
- *Competence:* strong and on-brand. "Worn 14 times — $3.12 per wear and
  dropping" (`docs/06` copy law) lets numbers carry the feeling; the user
  supplies the conclusion. This is docs/02's sustainability-without-preachiness
  executed correctly.
- *Relatedness:* the weak leg, and currently faked. Synthetic personas simulate
  a community the user cannot join; SDT predicts exactly Maya's reaction —
  discovered pretence is worse than absence, because it converts warmth into
  evidence of manipulation. The honest relatedness the app already has is the
  Shared Rail (named people, real loans) — local, small, and true. Feed
  labelling plus real Rail mechanics beats a bigger fiction.

**Hook model (Eyal: trigger → action → variable reward → investment) and the
Fogg Behavior Model (a behavior happens when motivation, ability, and a prompt
converge; B=MAP).** The loop: *action* is nearly frictionless (two taps, under
five seconds — Maya's stated day-2 condition, so treat that latency as a
hard requirement, not a nicety). *Investment* compounds — every logged wear
raises the value of the record and the cost of leaving. *Variable reward* is
deliberately thin (the rotating insight, CPW drifting down); copy law keeps it
from becoming a slot machine, which is correct for this brand. The structural
weakness is the *trigger/prompt*: external triggers are vetoed (no
notifications), so the loop depends on internal triggers ("what did I wear
yesterday", "what will I wear tomorrow") plus icon presence. Fogg's model says
ability this high can carry a weak prompt — but only while motivation holds,
which is what the ledger payoff is for. This is the honest version of Maya's
"nothing pulls me back": true, known, and priced in; measure it with the diary
gates rather than patch it with push.

**Ethical-persuasion audit.** The bright line from `docs/06` and `docs/02`:
reduce the user's decision fatigue, never exploit it; show positive impact,
never negative consequence. Where psych-marketing tactics would violate the
brand: streaks (loss-framed obligation), push (manufactured urgency), public
counts (social comparison), guilt framing of resting pieces, and any
engagement metric shown to its own subject. Where motivation can be honest:
cumulative unloseable facts stated like a bank balance; resting-not-wasted
framing; cooling-off silence as the intervention; and — if the owner amends the
veto — private, positive, off-by-default honors, which are competence support
in SDT terms. Honors cross into theatre the moment they become public,
comparative, progress-bared, or default-on: that is Dev's kill switch and
Robin's open amendment, and both are right.

**SAMR-style iteration (Substitution, Augmentation, Modification,
Redefinition — a ladder borrowed from education technology: does the tool
replace an old one, improve it, reshape the task, or enable a previously
impossible one).** Alpha should ship *substitution* and *augmentation* only:
the spreadsheet replaced, logging augmented to two taps. *Modification* is
already visible in Before You Buy changing purchase decisions. *Redefinition*
— the wardrobe record that outlives its app, portable and encrypted, shared
rail and all — is the post-alpha story, and E2E sync is its first chapter.
Resisting the urge to ship redefinition features in alpha is what keeps the
loop under five seconds.

### Cross-app comparison

Condensed from `docs/24` (figures sourced there) with panel input. Almari is
the former Toile; the benchmark predates the rename.

| | **Cost** | **Item cap** | **Analytics** | **Privacy** | **Social** | **Export** |
|---|---|---|---|---|---|---|
| **Whering** | Free; commerce-funded (eBay Ventures led the round) | None | CPW free, ledger partial | Account required; discloses sharing photos/videos with third parties; ads use | Full community | Partial |
| **Acloset** | Free to 100 items; then $3.99–$24.99/mo | **100** | CPW partial | Collects purchase history; precise location shared for advertising | Full community | Partial |
| **Indyx** | Cataloguing free; Insider $74.99/yr | None | **Analytics paywalled** | Account required | Social styling | Partial |
| **Cladwell** | 1 outfit/day free; $7.99/mo | 1 outfit/day free | **Analytics paywalled** | Account required | Minimal | Partial |
| **Almari** | Free; no revenue model, no server cost to the user | **None** | Free full ledger — *panel gap: no per-category CPW, trends, or CSV yet* | No account; device-local; opt-in sync is operator-readable today (Robin) | Synthetic personas only — make the fiction legible (Maya) | **Full, lossless (Robin verified)** |

The panel's reading: Almari wins the rows the category monetizes (analytics,
caps, export) and loses exactly where the panel said — sync trust, feed truth,
and the last analytics cuts.

---

## Decisions requested of the owner

1. **Badges / honors — amend non-negotiable #4 in the open?** Approve
   `docs/36-badges-rewards.md` as a written amendment to `PLAN.md` #4 (private,
   positive, off by default, unloseable facts, no progress chrome), or decline
   and let the veto stand. The panel is split; all three agree the worst
   outcome is shipping them against the written rule. *Recommended: approve the
   narrowed amendment; the spec's constraints are the veto's spirit.*
2. **E2E sync encryption — committed target or staying optional?** Promote
   `docs/34` H3 from an optional future to the committed gate for sync leaving
   "off by default", with the operator-readable interim disclosed in copy until
   it ships. *Recommended: commit.*
3. **Feed framing.** Label the personas as sample wardrobes now (cheap, honest)
   and: (a) keep the tab through alpha and let the diary gates arbitrate, or
   (b) demote the feed to More immediately per Dev. *Recommended: label now,
   keep the tab for the alpha window, decide on diary data.*
4. **Who-pays disclosure.** Publish the straight answer Dev asked for — the
   relay and sync run on the owner's Supabase project, free tier, costing
   testers nothing; if that ever changes, the app says so before it asks for
   anything. *Recommended: publish in Settings and the README.*

---

## Owner decisions (2026-08-19)

1. **Badges / honors — confirmed.** The `PLAN.md` #4 amendment (2026-08-18)
   stands as written; the feature is spec'd in `docs/36`, not yet built.
2. **E2E-encrypted sync — committed.** The H3 item is promoted from optional
   to the committed gate for sync leaving off-by-default; the amendment note
   now stands in `docs/34` §3.
3. **Feed personas labelled — shipped.** Sample-wardrobe posts carry a "sample
   wardrobe" tag beside the author line (`Feed.tsx`); profile pages already
   carry the marker in the account line.
4. **Who-pays — shipped.** The straight answer is published in Settings →
   About and on the Door's account panel.
