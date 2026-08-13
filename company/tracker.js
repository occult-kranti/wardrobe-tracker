/* ============================================================================
   ALMARI — THE WORKROOM
   Project tracking portal. Seed data + application.

   The seed below is the launch plan (docs/28-the-company.md) decomposed into
   assignable work, in dependency order, with the external gates marked. Every
   task's `why` is the reason it exists in the plan, so nobody has to re-read
   80 pages to know why they are doing something.

   STORAGE. Two modes, chosen by whether SYNC.url is filled in below:
     · local  — this browser only. Honest default; nothing to set up.
     · shared — one Supabase table, polled; everyone sees everyone's edits.
   See README-SYNC.md in this folder for the five-minute setup.
   ========================================================================== */

const SYNC = {
  // Paste these two from Supabase → Project Settings → API. Until then the
  // portal runs per-device and says so plainly in the header.
  url: '',            // https://<project>.supabase.co
  key: '',            // the anon / publishable key (safe in a page; RLS guards it)
  table: 'almari_workroom',
  row: 1,
  pollMs: 5000,
};

/* ---------------------------------------------------------------- people -- */

const PEOPLE = [
  { id: 'hm',     name: 'Hrudayangam', initials: 'HM', role: 'Founder — product, code, design', tint: 'ink' },
  { id: 'kunjal', name: 'Kunjal',      initials: 'K',  role: 'To be set at the 22 Aug meeting', tint: 'blue' },
  { id: 'nimesh', name: 'Nimesh',      initials: 'N',  role: 'To be set at the 22 Aug meeting', tint: 'green' },
  { id: 'raksha', name: 'Raksha',      initials: 'R',  role: 'To be set at the 22 Aug meeting', tint: 'gold' },
];

/* ---------------------------------------------------------------- phases -- */

const GROUPS = [
  { id: 'now',       name: 'This fortnight',      window: '13–22 Aug 2026',  note: 'Before the plan starts: the two meetings that set it.' },
  { id: 'company',   name: 'The company',         window: 'M1–M2 · Sep–Oct', note: 'Incorporation and the statutory clock it starts.' },
  { id: 'mark',      name: 'The mark',            window: 'M1–M8',           note: 'Clearance, filing, and the opposition gate. External gate.' },
  { id: 'p0',        name: 'P0 — hardening',      window: 'M1–M2',           note: 'The repo’s own next-steps ledger, cleared.' },
  { id: 'p1',        name: 'P1 — the tutorial',   window: 'M2–M3',           note: 'docs/27, built to spec.' },
  { id: 'p3',        name: 'P3 — the native port', window: 'M3–M6',          note: 'Capacitor. Storage moves early so the alpha tests what ships.' },
  { id: 'p2',        name: 'P2 — offline & sync', window: 'M6–M7',           note: 'True offline, then sync-you-own.' },
  { id: 'test',      name: 'Alpha & beta',        window: 'M5–M9',           note: 'Measurement by consent — the app will never phone home.' },
  { id: 'launch',    name: 'The stores',          window: 'M9–M10',          note: 'App Review is the second external gate.' },
  { id: 'money',     name: 'Money',               window: 'M2–M12',          note: 'Grants are the raise. VC is a named fork, off by default.' },
  { id: 'market',    name: 'Marketing',           window: 'M7–M12',          note: 'Organic-first, because a one-time price cannot outbid subscriptions.' },
];

const TAGS = ['meeting', 'legal', 'critical-path', 'external-gate', 'product', 'design', 'mobile', 'testing', 'launch', 'money', 'marketing', 'research', 'compliance'];

/* ----------------------------------------------------------------- tasks -- */
/* status: next | ongoing | done | blocked      current: the pinned focus      */

const SEED_TASKS = [
  /* ---- this fortnight ------------------------------------------------- */
  { g: 'now', t: 'Meet Kunjal — plan next steps, finalise the roadmap', due: '2026-08-15',
    a: ['hm', 'kunjal'], tags: ['meeting', 'critical-path'], status: 'next', current: true, est: 'half a day',
    why: 'The first working session on this plan. Everything downstream assumes the roadmap has been agreed by two people, not one.',
    check: 'Walk the eleven phases below · agree what P0 actually contains · decide which of the two of you owns the company formation track · set the agenda for the 22nd' },
  { g: 'now', t: 'Meet Kunjal, Nimesh and Raksha — finalise team, distribute work, consult legalities', due: '2026-08-22',
    a: ['hm', 'kunjal', 'nimesh', 'raksha'], tags: ['meeting', 'legal', 'critical-path'], status: 'next', est: 'a day',
    why: 'The team meeting. Roles here become the assignees on every task in this portal, and the legal questions raised here are what the attorney and CA get briefed on in month one.',
    check: 'Roles and equity conversation · who is a director, who is a shareholder, who is a contractor · brief the legal questions: the four Almari collisions, the founder assignment deed, whether anyone joining is a non-resident (FEMA) · assign the M1 company tasks below' },

  /* ---- the company ---------------------------------------------------- */
  { g: 'company', t: 'Reserve the name and buy DSCs for both directors', due: '2026-09-04',
    a: ['hm'], tags: ['legal'], status: 'next', est: '2 days', dep: 'Meet Kunjal, Nimesh and Raksha',
    why: 'First step of SPICe+. Name reservation covers two options — have a fallback ready in case the mark clearance goes badly.',
    check: 'Two name options filed · DSC for each director (₹1,500–2,500 each)' },
  { g: 'company', t: 'File SPICe+ — Private Limited, authorised capital ₹10 lakh', due: '2026-09-12',
    a: ['hm'], tags: ['legal', 'critical-path'], status: 'next', est: '1 week to certificate',
    why: 'Pvt Ltd over LLP/OPC because only a company can issue CCPS and grant ESOPs — the optionality the funding fork needs. ₹10L keeps us in the zero-MCA-fee slab.',
    check: 'Capital ≤ ₹15L so the MCA fee is nil · budget to the itemised high end ≈ ₹34K · certificate expected 10–20 working days' },
  { g: 'company', t: 'Open the current account and deposit subscription capital',
    a: ['hm'], tags: ['legal'], status: 'next', est: '2 days',
    why: 'INC-20A cannot be filed until the subscription money is actually in the company account.' },
  { g: 'company', t: 'File ADT-1 — first auditor, within 30 days', due: '2026-10-12',
    a: ['hm'], tags: ['legal', 'compliance'], status: 'next', est: '1 day',
    why: 'Statutory, 30 days from incorporation. A missed filing is the cheapest possible own goal.' },
  { g: 'company', t: 'File INC-20A — commencement of business, within 180 days',
    a: ['hm'], tags: ['legal', 'compliance'], status: 'next', est: '1 day',
    why: 'Late means ₹50,000 on the company plus ₹1,000/day per officer. There is no version of this worth being casual about.' },
  { g: 'company', t: 'Shops & Establishments registration and Professional Tax enrolment',
    a: ['hm'], tags: ['legal', 'compliance'], status: 'next', est: '2 days',
    why: 'Mandatory at state level within ~30 days of commencing business, including from a home office. Missed by most first-time founders and by the plan’s own first draft.' },
  { g: 'company', t: 'Udyam / MSME registration', a: ['hm'], tags: ['legal'], status: 'next', est: '1 hour',
    why: 'Free, and independently unlocks the small-entity trademark fee — a costless hedge if DPIIT recognition is slow.' },
  { g: 'company', t: 'DPIIT Startup India recognition', due: '2026-09-25',
    a: ['hm'], tags: ['legal', 'money'], status: 'next', est: '2–10 working days',
    why: 'Chiefly for the 50% trademark rebate and SISFS eligibility. Apply the week the certificate of incorporation arrives — but never delay the TM filing waiting for it.',
    check: 'Free via NSWS · unlocks SISFS · 80-IAC is a separate IMB application and a lottery ticket, not a plan' },
  { g: 'company', t: 'Founder IP assignment deed — on stamp paper, with consideration set',
    a: ['hm'], tags: ['legal', 'critical-path'], status: 'next', est: '3 days',
    why: 'The codebase predates the company, so the company owns none of it by default. An unstamped deed is inadmissible in evidence, which defeats its entire purpose in diligence.',
    check: 'Asset schedule: code, SVG plates, names, domains · counsel splits copyright vs mark/goodwill for duty · CA fixes defensible consideration (s.56(2)(x)) · board approval papered' },
  { g: 'company', t: 'Confirm the second shareholder is resident', a: ['hm'], tags: ['legal', 'compliance'], status: 'next', est: '1 hour',
    why: 'Keeps the cap table FEMA-clean until a foreign raise is a deliberate decision rather than an accident with a 30-day filing attached.' },

  /* ---- the mark ------------------------------------------------------- */
  { g: 'mark', t: 'Attorney clearance search on ALMARI', due: '2026-09-20',
    a: ['hm'], tags: ['legal', 'external-gate', 'critical-path'], status: 'next', current: true, est: '1–2 weeks',
    why: 'Four live collisions are already known: a 2019 garment-storage startup of the same name, a secondhand-clothing app, a preloved marketplace, and a saree brand. Plus the word means "wardrobe", which invites a descriptiveness objection. This search happens before a rupee of brand spend.',
    check: 'ALMARI / ALMAARI / ALMIRAH across classes 9, 42, 35, 25 · registered vs unregistered status of all four · passing-off exposure from the 2019 user specifically · common-law: app stores, MCA, handles, domains' },
  { g: 'mark', t: 'Decide the use claim and open the use-evidence file', a: ['hm'], tags: ['legal'], status: 'next', est: '1 day',
    why: 'Proposed-to-be-used versus a claimed user date is a decision with consequences for both the acquired-distinctiveness argument and any future prior-user defence. The evidence file needs to start on day one, not when it is needed.' },
  { g: 'mark', t: 'Rename decision gate', a: ['hm', 'kunjal'], tags: ['legal', 'external-gate'], status: 'next', est: '1 day',
    why: 'Renaming now costs ₹25–75K. Renaming after launch costs store listings, ASO history, press pointing at the wrong name, and possibly years of opposition defence. The gate exists so attachment to the name cannot outvote the search result.' },
  { g: 'mark', t: 'File TM-A — word and device, classes 9 + 42, expedited', due: '2026-11-06',
    a: ['hm'], tags: ['legal', 'critical-path'], status: 'next', est: '2 days',
    why: 'Device mark alongside the word, because a device is registrable where a semi-descriptive word is weak. Class 35 is where the marketplaces trade; the design contract bars commerce forever, so we never enter it.',
    check: '₹9,000 at the recognised-startup rate · expedited examination ₹20,000 surfaces objections before launch · Shop Almari likely overlaps class 9 — the search must resolve it' },
  { g: 'mark', t: 'Opposition-window status check — before any launch spend', due: '2027-04-30',
    a: ['hm'], tags: ['legal', 'external-gate', 'critical-path'], status: 'next', est: '1 day',
    why: 'A passed clearance search does not prevent opposition. If a credible senior user opposes, the rename gate is invoked here — before store listings and PR money are spent, not after.' },

  /* ---- P0 ------------------------------------------------------------- */
  { g: 'p0', t: 'Photograph the five briefed wardrobes from open-licence museum collections',
    a: [], tags: ['product', 'design'], status: 'next', est: '3–5 days',
    why: 'The repo’s own ledger calls this the single biggest visible improvement. Four of the five period wardrobes currently show drawn flats where a real photograph exists in the public domain.',
    check: 'Met Open Access · Rijksmuseum · LACMA · add PHOTO_RULES entries · keep every image bundled, no network access' },
  { g: 'p0', t: 'Closet masthead — make Today’s outfit the primary action', a: [], tags: ['design'], status: 'next', est: '1 day',
    why: 'The masthead costs 181px and carries no primary. Roughly 70px comes back and the page gains the one primary button the component law requires.' },
  { g: 'p0', t: 'Closet empty state — three CTAs down to one', a: [], tags: ['design'], status: 'next', est: '2 hours',
    why: 'The contract says exactly one action per empty screen. This one has three.' },
  { g: 'p0', t: 'Room frame sizing bug', a: [], tags: ['product'], status: 'next', est: '2 hours',
    why: 'The frame is sized to the plate rather than to the furniture, so wall lines land wrong on small rooms.' },
  { g: 'p0', t: 'The dress form versus "never draw bodies"', a: [], tags: ['design'], status: 'next', est: '1 day',
    why: 'A dress form may violate the oldest rule in the contract. Either redraw it as a coat stand or amend the clause on the record — but decide, rather than leaving a silent exception.' },
  { g: 'p0', t: 'Room shows oldest furniture first', a: [], tags: ['product'], status: 'next', est: '3 hours',
    why: 'Insertion order means a newly drawn piece can be invisible. Widen the frame or mark the newest — do not sort, because the room’s order is meaningful.' },

  /* ---- P1 ------------------------------------------------------------- */
  { g: 'p1', t: 'PlateFirstFitting and the coach-mark chip into art.tsx / ui.tsx',
    a: [], tags: ['design', 'product'], status: 'next', est: '2 days',
    why: 'Both are drawn and specified in docs/27 Appendix A — the tailor’s table plate and the chip-plus-leader-line geometry. This is a paste-and-wire job, not a design job.' },
  { g: 'p1', t: 'TutorialLayer — five stops, toile-toured flag', a: [], tags: ['product'], status: 'next', est: '3 days',
    why: 'The tour is an annotation layer, not a modal: no scrim, page stays live, one mark at a time, anchored by data-tour attributes.',
    check: 'Today · the closet · the ledger · the wishlist · Settings export · missing anchor skips silently' },
  { g: 'p1', t: 'Welcome sheet on first entry, and the Settings re-entry row', a: [], tags: ['product'], status: 'next', est: '1 day',
    why: 'One sheet, once, with two equally final exits. Re-entry lives in Settings so the tour is discoverable without ever nagging.' },
  { g: 'p1', t: 'First-log toast behind toile-first-log', a: [], tags: ['product'], status: 'next', est: '2 hours',
    why: '"Logged. The record has begun." Once per device, on the first real wear. Then nothing, forever.' },
  { g: 'p1', t: 'Screenshots and a design-critic pass on all five stops', a: [], tags: ['design', 'testing'], status: 'next', est: '1 day',
    why: 'Standing rule for any UI change: both themes, 390px and desktop, critic before merge.' },

  /* ---- P3 ------------------------------------------------------------- */
  { g: 'p3', t: 'Capacitor 8 scaffold — iOS and Android', a: [], tags: ['mobile'], status: 'next', est: '3 days',
    why: 'Capacitor over a React Native rewrite: the entire Tailwind/DOM UI and the SVG design system would have to be rebuilt in RN primitives for no user-visible gain. Start on 8.x — v7 left maintenance in June 2026 and Xcode 26 SDK builds are mandatory since April.' },
  { g: 'p3', t: 'Storage migration — localStorage to SQLite and Preferences', a: [], tags: ['mobile', 'critical-path'], status: 'next', est: '1–2 weeks',
    why: 'The real port work. WebView storage is transient — the OS reclaims it under disk pressure and iOS offers no persisted opt-out. This moves the source of truth to native ground, early, so the alpha tests the architecture that will actually ship.',
    check: 'Reuse the existing lossless migration layer, do not write a second one · settings to Preferences · wardrobe to SQLite · localStorage demoted to cache' },
  { g: 'p3', t: 'Native plugins — camera, filesystem, share, haptics', a: [], tags: ['mobile'], status: 'next', est: '3 days',
    why: 'Each is also Guideline 4.2 armour: a wrapper with no platform features is the top rejection vector. Share turns the lossless export promise into a real file the person can put somewhere.' },
  { g: 'p3', t: 'Biometric app lock', a: [], tags: ['mobile'], status: 'next', est: '2 days',
    why: 'A privacy feature that fits an app with no account, and one more piece of 4.2 armour. Ship with honest copy — the data underneath is still device storage.' },
  { g: 'p3', t: 'Cloud build pipeline, signing, versioning discipline', a: [], tags: ['mobile'], status: 'next', est: '3 days',
    why: 'No Mac is owned. Capawesome or Codemagic drives iOS signing; fastlane on Windows is Android-lanes-only.',
    check: 'Version single-sourced from package.json · monotonic Android versionCode · tags cut from CI only · the 100+ checks and the brand contract gate every store build' },
  { g: 'p3', t: 'Apple Developer Program enrolment (organisation)', a: ['hm'], tags: ['mobile', 'legal'], status: 'next', est: '1–3 weeks',
    why: 'Organisation enrolment needs the D-U-N-S number, which needs the company. $99/year, and the long pole is verification, not payment.' },
  { g: 'p3', t: 'Google Play organisation account — and verify the 12-tester exemption', a: ['hm'], tags: ['mobile', 'legal'], status: 'next', est: '1 week',
    why: 'A personal account created after Nov 2023 must run 12 testers for 14 continuous days before production. An organisation account should exempt us — verify at creation, because if it does not, that clock has to start months earlier.' },

  /* ---- P2 ------------------------------------------------------------- */
  { g: 'p2', t: 'Finish the service worker — true offline', a: [], tags: ['product'], status: 'next', est: '3 days',
    why: 'The manifest and icons shipped; the worker did not. Genuine offline is both a user promise and the honest answer to Guideline 4.2.' },
  { g: 'p2', t: 'Sync you own — file-based, between devices', a: [], tags: ['product'], status: 'next', est: '1 week',
    why: 'The largest remaining gap against every rival, and the migration layer already round-trips losslessly. A file the person controls — never an account, never a server.' },

  /* ---- testing -------------------------------------------------------- */
  { g: 'test', t: 'Write the research-data protocol', a: [], tags: ['testing', 'legal', 'compliance'], status: 'next', est: '2 days',
    why: 'The moment a tester’s export lands in a company inbox, the company is processing personal data — a wardrobe export contains photographs, travel dates and household members. The no-server privacy argument does not cover the research programme unless this exists.',
    check: 'Written consent per tester · 18+ only · fixed deletion date · segregated storage · a redacted research-export variant that ships schema and counts, not photographs' },
  { g: 'test', t: 'Recruit the alpha cohorts', a: [], tags: ['testing'], status: 'next', est: '2 weeks',
    why: 'The original focus group set the contract; the same archetypes continue, plus India metro Gen-Z (who actually pay for apps) and a privacy-community cohort.' },
  { g: 'test', t: 'Internal TestFlight', a: [], tags: ['testing', 'mobile'], status: 'next', est: 'ongoing',
    why: '100 testers, instant, included in the membership. First real build in real hands.' },
  { g: 'test', t: 'Moderated alpha sessions and diary study #1', a: [], tags: ['testing', 'research'], status: 'next', est: '2 weeks',
    why: 'The app will never phone home, so measurement is by consent: watch people use it, and ask them to keep a week’s log.',
    check: 'Stopwatch the two-tap promise · note where the tutorial’s five stops land or fail' },
  { g: 'test', t: 'Play closed track QA', a: [], tags: ['testing', 'mobile'], status: 'next', est: '2 weeks',
    why: 'Android-side shakeout. If the organisation-account exemption failed, this is also where the 14-day clock runs.' },
  { g: 'test', t: 'Open beta and diary study #2', a: [], tags: ['testing'], status: 'next', est: '4 weeks',
    why: 'Play open track and TestFlight external. Wider cohort, same consented measurement.' },
  { g: 'test', t: 'Pre-register the launch gates', a: [], tags: ['testing', 'research'], status: 'next', est: '1 day',
    why: 'Absolute thresholds on our own cohorts, decided before the data arrives so they cannot be moved afterwards. The category’s 28% retention figure does not survive sourcing and appears in no gate, pitch, or listing.',
    check: '≥40% of the alpha cohort logs a wear in week 12 · ≥60% complete diary week one · median assisted log ≤ two taps' },

  /* ---- launch --------------------------------------------------------- */
  { g: 'launch', t: 'Store listings and ASO copy — under the copy law', a: [], tags: ['launch', 'marketing'], status: 'next', est: '3 days',
    why: 'The copy law travels: no exclamation points, no urgency, address the clothes. Store convention is the opposite, so anyone writing this copy has to be told.' },
  { g: 'launch', t: 'Resolve the BYOK question, then file the privacy declarations', a: [], tags: ['launch', 'legal'], status: 'next', est: '3 days',
    why: 'Today the app truthfully declares no data collected. Bring-your-own-key intake sends photographs off-device to the user’s own provider — that has to be reconciled with both stores’ definitions before it ships, or the label becomes a misdeclaration.',
    check: 'Either ship v1 without BYOK and keep the clean label, or declare the optional user-initiated flow · the get-a-key link carries no referral code, ever' },
  { g: 'launch', t: 'GST registration and TCS reconciliation', a: ['hm'], tags: ['legal', 'money'], status: 'next', est: '1 week',
    why: 'Indian app sales attract 18% GST and Google deducts TCS. This is settled with the CA before the first paid sale, not after.' },
  { g: 'launch', t: 'App Review submission — one rejection cycle budgeted', due: '2027-05-31',
    a: [], tags: ['launch', 'external-gate', 'critical-path'], status: 'next', est: '2–4 weeks',
    why: 'The second external gate. Guideline 4.2 is the risk; the armour is the native work in P3 plus genuine offline.' },
  { g: 'launch', t: 'Launch on both platforms', a: [], tags: ['launch'], status: 'next', est: '1 week',
    why: 'First revenue. The web app is unchanged and still free — that is the point, not a concession.' },

  /* ---- money ---------------------------------------------------------- */
  { g: 'money', t: 'Shortlist three DPIIT incubators and apply to SISFS', a: [], tags: ['money'], status: 'next', est: '3 weeks',
    why: 'Up to ₹20L grant plus ₹50L in convertible instruments. Non-dilutive money fits a company shaped like this one — but the convertible half is not free, and the application will be read by people who screen for scale intent.',
    check: 'Which incubators have funded a utility or privacy-first app before?' },
  { g: 'money', t: 'MeitY GENESIS application', a: [], tags: ['money'], status: 'next', est: '2 weeks',
    why: '₹10L early-stage with no match required; the ₹50L tranche needs matching capital we do not have.' },
  { g: 'money', t: 'Karnataka Elevate — the M12 window', due: '2027-08-15',
    a: [], tags: ['money'], status: 'next', est: '3 weeks',
    why: 'Up to ₹50L, one annual window (mid-Aug to mid-Sep). Missing it costs a year, which is why it is dated here rather than left to memory.' },
  { g: 'money', t: 'Write the FEMA gate into the funding process', a: ['hm'], tags: ['legal', 'money', 'compliance'], status: 'next', est: '1 day',
    why: 'The most common compliance miss in a first Indian raise. Any non-resident money in any instrument means a valuation report, FC-GPR within 30 days of allotment, and the FLA return annually thereafter.' },
  { g: 'money', t: 'Raise or no-raise decision', due: '2027-08-31',
    a: ['hm'], tags: ['money'], status: 'next', est: '1 week',
    why: 'Default is no raise. Venture money would require adding a cloud or B2B line the design contract forbids — so taking it is a decision to renegotiate the contract in the open, never a drift.' },

  /* ---- marketing ------------------------------------------------------ */
  { g: 'market', t: 'Verification pass, then publish the competitive benchmark', a: [], tags: ['marketing', 'research'], status: 'next', est: '1 week',
    why: 'It is genuinely good standalone content, but published under the company name it becomes comparative advertising. Unverified prices and characterisations of competitors’ health are a disparagement risk and, worse for a trust brand, a chance to be publicly wrong.',
    check: 'Re-verify every price and cap against live listings with dated screenshots · "as of" header · observable facts only, no "dormant" or "died" · the 28% figure deleted · attorney reads it as marketing' },
  { g: 'market', t: 'Brief every external surface on the copy law', a: [], tags: ['marketing'], status: 'next', est: '1 day',
    why: 'A contractor paid from the marketing line will write "Organize your closet today!" unless told otherwise. Waste statistics describe the industry in aggregate, never the reader’s own wardrobe — the moment they point at the reader they are a shame mechanic.' },
  { g: 'market', t: 'Nano and micro collaborations', a: [], tags: ['marketing'], status: 'next', est: 'ongoing',
    why: 'Honest wardrobe audits, not promo codes — there is nothing to code. Nano tier carries the best engagement for the money.' },
  { g: 'market', t: 'Press on the craft', a: [], tags: ['marketing'], status: 'next', est: 'ongoing',
    why: 'Three angles: ownership and permanence, the thirty-wears arithmetic, and the hand-drawn plates. The sample wardrobes are pitched as costume-design-grade briefs — nobody confirms, denies, or hints at a source work, on the record or off it.' },
];

/* ========================================================================== */
/* STATE                                                                      */
/* ========================================================================== */

const uid = () => 't' + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();

function buildSeed() {
  const tasks = SEED_TASKS.map((s, i) => ({
    id: 'seed-' + i,
    title: s.t,
    group: s.g,
    status: s.status || 'next',
    current: !!s.current,
    assignees: s.a || [],
    tags: s.tags || [],
    due: s.due || '',
    est: s.est || '',
    why: s.why || '',
    check: s.check || '',
    dep: s.dep || '',
    comments: [],
    updatedAt: nowISO(),
    order: i,
  }));
  return { version: 1, tasks, people: PEOPLE.slice(), updatedAt: nowISO() };
}

let STATE = buildSeed();
let ME = null;
let VIEW = { group: 'all', person: 'all', tag: 'all', status: 'all', q: '', mode: 'board' };
let SELECTED = new Set();
let OPEN_TASK = null;
let SYNCING = false;
let LAST_SYNC = null;

/* ------------------------------------------------------------- storage --- */

const LOCAL_KEY = 'almari-workroom-state';
const ME_KEY = 'almari-workroom-me';
const shared = () => !!(SYNC.url && SYNC.key);

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) return parsed;
    }
  } catch { /* fall through to seed */ }
  return null;
}

function saveLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(STATE)); } catch { /* private mode */ }
}

/* Shared mode: one JSON row, merged per task on write so two people editing
   different tasks never clobber each other. Last write wins per task. */
async function pullShared() {
  const r = await fetch(`${SYNC.url}/rest/v1/${SYNC.table}?id=eq.${SYNC.row}&select=doc`, {
    headers: { apikey: SYNC.key, Authorization: `Bearer ${SYNC.key}` },
  });
  if (!r.ok) throw new Error('pull ' + r.status);
  const rows = await r.json();
  return rows && rows[0] && rows[0].doc ? rows[0].doc : null;
}

async function pushShared(doc) {
  const r = await fetch(`${SYNC.url}/rest/v1/${SYNC.table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SYNC.key, Authorization: `Bearer ${SYNC.key}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: SYNC.row, doc, updated_at: nowISO() }),
  });
  if (!r.ok) throw new Error('push ' + r.status);
}

function mergeDocs(mine, theirs) {
  if (!theirs) return mine;
  const byId = new Map(theirs.tasks.map(t => [t.id, t]));
  for (const t of mine.tasks) {
    const other = byId.get(t.id);
    if (!other || (t.updatedAt || '') >= (other.updatedAt || '')) byId.set(t.id, t);
  }
  const people = [...theirs.people];
  for (const p of mine.people) if (!people.some(x => x.id === p.id)) people.push(p);
  return { version: 1, tasks: [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), people, updatedAt: nowISO() };
}

async function persist() {
  STATE.updatedAt = nowISO();
  saveLocal();
  if (!shared()) return;
  try {
    SYNCING = true; paintSyncState();
    const remote = await pullShared();
    STATE = mergeDocs(STATE, remote);
    await pushShared(STATE);
    LAST_SYNC = new Date();
    saveLocal();
  } catch (e) {
    console.warn('sync failed', e);
  } finally { SYNCING = false; paintSyncState(); render(); }
}

async function poll() {
  if (!shared() || SYNCING) return;
  try {
    const remote = await pullShared();
    if (!remote) return;
    if ((remote.updatedAt || '') > (STATE.updatedAt || '')) {
      STATE = mergeDocs(STATE, remote);
      saveLocal(); render();
    }
    LAST_SYNC = new Date(); paintSyncState();
  } catch { /* offline; the portal keeps working */ }
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const personById = id => STATE.people.find(p => p.id === id);
const groupById = id => GROUPS.find(g => g.id === id);

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function daysUntil(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((dt - today) / 86400000);
}

function touch(task) { task.updatedAt = nowISO(); }

/* ========================================================================== */
/* RENDER                                                                     */
/* ========================================================================== */

function visibleTasks() {
  const q = VIEW.q.trim().toLowerCase();
  return STATE.tasks.filter(t => {
    if (VIEW.group !== 'all' && t.group !== VIEW.group) return false;
    if (VIEW.person !== 'all' && !(t.assignees || []).includes(VIEW.person)) return false;
    if (VIEW.person === 'unassigned' && (t.assignees || []).length) return false;
    if (VIEW.tag !== 'all' && !(t.tags || []).includes(VIEW.tag)) return false;
    if (VIEW.status !== 'all' && t.status !== VIEW.status) return false;
    if (q && !(`${t.title} ${t.why} ${t.check}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

function paintSyncState() {
  const el = $('#syncState'); if (!el) return;
  if (!shared()) {
    el.innerHTML = `<span class="dot local"></span>This device only · <a href="#setup" id="setupLink">make it shared</a>`;
  } else if (SYNCING) {
    el.innerHTML = `<span class="dot sync"></span>Saving to the team…`;
  } else {
    el.innerHTML = `<span class="dot ok"></span>Shared${LAST_SYNC ? ' · ' + LAST_SYNC.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}`;
  }
}

function avatar(id, size) {
  const p = personById(id);
  if (!p) return '';
  return `<span class="av ${p.tint} ${size || ''}" title="${esc(p.name)}">${esc(p.initials)}</span>`;
}

function taskRow(t) {
  const g = groupById(t.group);
  const d = daysUntil(t.due);
  const overdue = d !== null && d < 0 && t.status !== 'done';
  const soon = d !== null && d >= 0 && d <= 7 && t.status !== 'done';
  return `
  <article class="task ${t.status} ${t.current ? 'is-current' : ''} ${SELECTED.has(t.id) ? 'is-sel' : ''}" data-id="${t.id}">
    <label class="pick"><input type="checkbox" ${SELECTED.has(t.id) ? 'checked' : ''} data-pick="${t.id}" aria-label="Select"></label>
    <div class="task-body" data-open="${t.id}">
      <div class="task-top">
        <span class="st st-${t.status}">${t.status === 'ongoing' ? 'On now' : t.status === 'done' ? 'Done' : t.status === 'blocked' ? 'Blocked' : 'Next'}</span>
        ${t.current ? '<span class="pin">Current focus</span>' : ''}
        ${g && VIEW.group === 'all' ? `<span class="gtag">${esc(g.name)}</span>` : ''}
      </div>
      <h4>${esc(t.title)}</h4>
      ${t.why ? `<p class="why">${esc(t.why)}</p>` : ''}
      <div class="task-meta">
        ${(t.assignees || []).length ? `<span class="avs">${t.assignees.map(a => avatar(a, 'sm')).join('')}</span>` : '<span class="unassigned">Unassigned</span>'}
        ${t.due ? `<span class="due ${overdue ? 'overdue' : soon ? 'soon' : ''}">${esc(fmtDate(t.due))}${d !== null && t.status !== 'done' ? ` · ${d < 0 ? `${-d}d late` : d === 0 ? 'today' : `in ${d}d`}` : ''}</span>` : ''}
        ${t.est ? `<span class="est">${esc(t.est)}</span>` : ''}
        ${(t.tags || []).map(x => `<span class="tg">${esc(x)}</span>`).join('')}
        ${(t.comments || []).length ? `<span class="cm">${t.comments.length} note${t.comments.length > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function renderBoard() {
  const tasks = visibleTasks();
  const groups = VIEW.group === 'all' ? GROUPS : GROUPS.filter(g => g.id === VIEW.group);
  let html = '';
  for (const g of groups) {
    const mine = tasks.filter(t => t.group === g.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!mine.length) continue;
    const done = mine.filter(t => t.status === 'done').length;
    html += `
    <section class="phase">
      <header class="phase-head">
        <div>
          <h3>${esc(g.name)}</h3>
          <p class="phase-note">${esc(g.note)}</p>
        </div>
        <div class="phase-meta">
          <span class="win">${esc(g.window)}</span>
          <span class="count">${done}/${mine.length} done</span>
        </div>
      </header>
      <div class="tasks">${mine.map(taskRow).join('')}</div>
    </section>`;
  }
  return html || `<p class="empty">Nothing matches those filters.</p>`;
}

function renderTimeline() {
  const dated = visibleTasks().filter(t => t.due).sort((a, b) => a.due.localeCompare(b.due));
  const undated = visibleTasks().filter(t => !t.due);
  const byMonth = new Map();
  for (const t of dated) {
    const k = t.due.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(t);
  }
  let html = '<div class="timeline">';
  for (const [month, list] of byMonth) {
    const label = new Date(month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    html += `<section class="tl-month"><h3>${esc(label)}</h3>`;
    for (const t of list) {
      const d = daysUntil(t.due);
      html += `
      <div class="tl-row ${t.status} ${t.current ? 'is-current' : ''}" data-open="${t.id}">
        <span class="tl-date">${esc(fmtDate(t.due))}</span>
        <span class="tl-bar"></span>
        <span class="tl-title">${esc(t.title)}</span>
        <span class="tl-people">${(t.assignees || []).map(a => avatar(a, 'sm')).join('')}</span>
        ${d !== null && t.status !== 'done' ? `<span class="tl-when ${d < 0 ? 'overdue' : d <= 7 ? 'soon' : ''}">${d < 0 ? `${-d}d late` : d === 0 ? 'today' : `in ${d}d`}</span>` : ''}
      </div>`;
    }
    html += `</section>`;
  }
  if (undated.length) {
    html += `<section class="tl-month"><h3>No date yet</h3>
      ${undated.map(t => `<div class="tl-row ${t.status}" data-open="${t.id}"><span class="tl-date">—</span><span class="tl-bar"></span><span class="tl-title">${esc(t.title)}</span><span class="tl-people">${(t.assignees || []).map(a => avatar(a, 'sm')).join('')}</span></div>`).join('')}
    </section>`;
  }
  return html + '</div>';
}

function renderPeople() {
  const html = STATE.people.map(p => {
    const mine = STATE.tasks.filter(t => (t.assignees || []).includes(p.id));
    const open = mine.filter(t => t.status !== 'done');
    const now = mine.filter(t => t.status === 'ongoing' || t.current);
    return `
    <section class="plate person-card">
      <div class="person-head">${avatar(p.id, 'lg')}<div><h3>${esc(p.name)}</h3><p class="phase-note">${esc(p.role || '')}</p></div></div>
      <p class="person-nums"><b>${open.length}</b> open · <b>${now.length}</b> on now · <b>${mine.length - open.length}</b> done</p>
      <div class="tasks compact">${mine.length ? mine.slice(0, 40).map(taskRow).join('') : '<p class="empty">Nothing assigned yet.</p>'}</div>
    </section>`;
  }).join('');
  return html;
}

function render() {
  const main = $('#main');
  main.innerHTML = VIEW.mode === 'timeline' ? renderTimeline()
    : VIEW.mode === 'people' ? renderPeople()
    : renderBoard();

  const total = STATE.tasks.length;
  const done = STATE.tasks.filter(t => t.status === 'done').length;
  const ongoing = STATE.tasks.filter(t => t.status === 'ongoing').length;
  const blocked = STATE.tasks.filter(t => t.status === 'blocked').length;
  $('#stats').innerHTML = `<b>${done}</b>/${total} done · <b>${ongoing}</b> on now${blocked ? ` · <b>${blocked}</b> blocked` : ''}`;

  $('#bulkbar').hidden = SELECTED.size === 0;
  $('#bulkcount').textContent = `${SELECTED.size} selected`;
  paintSyncState();
  if (OPEN_TASK) paintDrawer();
}

/* ------------------------------------------------------------- drawer ---- */

function paintDrawer() {
  const t = STATE.tasks.find(x => x.id === OPEN_TASK);
  const dr = $('#drawer');
  if (!t) { dr.hidden = true; OPEN_TASK = null; return; }
  dr.hidden = false;
  const g = groupById(t.group);
  dr.innerHTML = `
    <div class="dr-head">
      <span class="kicker">${esc(g ? g.name : '')} · ${esc(g ? g.window : '')}</span>
      <button class="x" id="drClose" aria-label="Close">✕</button>
    </div>
    <input class="dr-title" id="drTitle" value="${esc(t.title)}" ${ME ? '' : 'disabled'}>
    <div class="dr-row">
      <label>Status</label>
      <div class="segs" id="drStatus">
        ${['next', 'ongoing', 'blocked', 'done'].map(s => `<button class="seg ${t.status === s ? 'on' : ''}" data-status="${s}" ${ME ? '' : 'disabled'}>${s === 'ongoing' ? 'On now' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="dr-row">
      <label>Current focus</label>
      <button class="toggle ${t.current ? 'on' : ''}" id="drCurrent" ${ME ? '' : 'disabled'}>${t.current ? 'Pinned as current' : 'Pin as current'}</button>
    </div>
    <div class="dr-row">
      <label>Assigned to</label>
      <div class="chips" id="drPeople">
        ${STATE.people.map(p => `<button class="chip ${(t.assignees || []).includes(p.id) ? 'on' : ''}" data-person="${p.id}" ${ME ? '' : 'disabled'}>${avatar(p.id, 'sm')} ${esc(p.name)}</button>`).join('')}
      </div>
    </div>
    <div class="dr-row">
      <label>Tags</label>
      <div class="chips" id="drTags">
        ${TAGS.map(x => `<button class="chip ${(t.tags || []).includes(x) ? 'on' : ''}" data-tag="${x}" ${ME ? '' : 'disabled'}>${esc(x)}</button>`).join('')}
      </div>
    </div>
    <div class="dr-row two">
      <div><label>Due</label><input type="date" id="drDue" value="${esc(t.due || '')}" ${ME ? '' : 'disabled'}></div>
      <div><label>Estimate</label><input id="drEst" value="${esc(t.est || '')}" placeholder="e.g. 3 days" ${ME ? '' : 'disabled'}></div>
    </div>
    <div class="dr-row"><label>Why this exists</label><textarea id="drWhy" rows="4" ${ME ? '' : 'disabled'}>${esc(t.why || '')}</textarea></div>
    <div class="dr-row"><label>Checklist / notes</label><textarea id="drCheck" rows="3" ${ME ? '' : 'disabled'}>${esc(t.check || '')}</textarea></div>
    ${t.dep ? `<p class="dep">Waits on: ${esc(t.dep)}</p>` : ''}
    <div class="dr-row">
      <label>Notes from the team</label>
      <div class="comments">
        ${(t.comments || []).length ? t.comments.map(c => `
          <div class="comment">${avatar(c.by, 'sm')}<div><b>${esc(personById(c.by)?.name || c.by)}</b> <span class="ts">${new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><p>${esc(c.text)}</p></div></div>`).join('')
          : '<p class="empty small">No notes yet.</p>'}
      </div>
      ${ME ? `<div class="add-comment"><textarea id="drComment" rows="2" placeholder="Add a note as ${esc(personById(ME)?.name)}…"></textarea><button class="btn" id="drAddComment">Add note</button></div>`
        : '<p class="empty small">Sign in to add a note.</p>'}
    </div>
    <p class="dr-foot">Last change ${new Date(t.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
  `;
  wireDrawer(t);
}

function wireDrawer(t) {
  const save = () => { touch(t); persist(); render(); };
  $('#drClose').onclick = () => { OPEN_TASK = null; $('#drawer').hidden = true; };
  if (!ME) return;
  $('#drTitle').onchange = e => { t.title = e.target.value.trim() || t.title; save(); };
  $('#drDue').onchange = e => { t.due = e.target.value; save(); };
  $('#drEst').onchange = e => { t.est = e.target.value; save(); };
  $('#drWhy').onchange = e => { t.why = e.target.value; save(); };
  $('#drCheck').onchange = e => { t.check = e.target.value; save(); };
  $('#drCurrent').onclick = () => { t.current = !t.current; save(); };
  $('#drStatus').onclick = e => {
    const b = e.target.closest('[data-status]'); if (!b) return;
    t.status = b.dataset.status; save();
  };
  $('#drPeople').onclick = e => {
    const b = e.target.closest('[data-person]'); if (!b) return;
    const id = b.dataset.person;
    t.assignees = (t.assignees || []).includes(id) ? t.assignees.filter(x => x !== id) : [...(t.assignees || []), id];
    save();
  };
  $('#drTags').onclick = e => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    const x = b.dataset.tag;
    t.tags = (t.tags || []).includes(x) ? t.tags.filter(y => y !== x) : [...(t.tags || []), x];
    save();
  };
  const add = $('#drAddComment');
  if (add) add.onclick = () => {
    const box = $('#drComment');
    const text = box.value.trim(); if (!text) return;
    t.comments = [...(t.comments || []), { by: ME, at: nowISO(), text }];
    box.value = ''; save();
  };
}

/* ========================================================================== */
/* IDENTITY                                                                   */
/* ========================================================================== */

function paintIdentity() {
  const el = $('#who');
  if (ME) {
    const p = personById(ME);
    el.innerHTML = `${avatar(ME, 'sm')} <span>${esc(p ? p.name : ME)}</span> <button class="link" id="signOut">not you?</button>`;
    $('#signOut').onclick = () => { ME = null; localStorage.removeItem(ME_KEY); paintIdentity(); render(); };
  } else {
    el.innerHTML = `<button class="btn small" id="signIn">Sign in</button>`;
    $('#signIn').onclick = openSignIn;
  }
  $('#newTaskBtn').disabled = !ME;
}

function openSignIn() {
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = `
    <div class="sheet">
      <h3>Who is working?</h3>
      <p class="phase-note">This is a name badge, not a password. Anyone with the link can pick any name — it labels your edits and notes so the team knows who did what.</p>
      <div class="who-list">
        ${STATE.people.map(p => `<button class="who-btn" data-who="${p.id}">${avatar(p.id, 'lg')}<span><b>${esc(p.name)}</b><small>${esc(p.role || '')}</small></span></button>`).join('')}
      </div>
      <div class="add-person">
        <input id="newPersonName" placeholder="Someone else — their name">
        <button class="btn" id="addPersonBtn">Add them</button>
      </div>
      <button class="link" id="closeModal">Cancel</button>
    </div>`;
  m.querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
    ME = b.dataset.who; localStorage.setItem(ME_KEY, ME);
    m.hidden = true; paintIdentity(); render();
  });
  $('#closeModal').onclick = () => { m.hidden = true; };
  $('#addPersonBtn').onclick = () => {
    const name = $('#newPersonName').value.trim(); if (!name) return;
    const tints = ['ink', 'blue', 'green', 'gold', 'plum'];
    const p = {
      id: 'p' + Math.random().toString(36).slice(2, 7),
      name,
      initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      role: 'Added ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      tint: tints[STATE.people.length % tints.length],
    };
    STATE.people.push(p); ME = p.id; localStorage.setItem(ME_KEY, ME);
    persist(); m.hidden = true; paintIdentity(); render();
  };
}

/* ========================================================================== */
/* WIRING                                                                     */
/* ========================================================================== */

function newTask() {
  if (!ME) return;
  const t = {
    id: uid(), title: 'New task', group: VIEW.group === 'all' ? 'now' : VIEW.group,
    status: 'next', current: false, assignees: [], tags: [], due: '', est: '',
    why: '', check: '', dep: '', comments: [], updatedAt: nowISO(),
    order: STATE.tasks.length + 1,
  };
  STATE.tasks.push(t); persist(); OPEN_TASK = t.id; render(); paintDrawer();
}

function bulk(fn) {
  for (const id of SELECTED) {
    const t = STATE.tasks.find(x => x.id === id);
    if (t) { fn(t); touch(t); }
  }
  SELECTED.clear(); persist(); render();
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `almari-workroom-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}

function wire() {
  $('#main').addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const id = pick.dataset.pick;
      SELECTED.has(id) ? SELECTED.delete(id) : SELECTED.add(id);
      render(); return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { OPEN_TASK = open.dataset.open; paintDrawer(); }
  });

  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    const [k, v] = b.dataset.filter.split(':');
    VIEW[k] = v;
    $('#filters').querySelectorAll(`[data-filter^="${k}:"]`).forEach(x => x.classList.toggle('on', x === b));
    render();
  });

  $('#modeBoard').onclick = () => setMode('board');
  $('#modeTimeline').onclick = () => setMode('timeline');
  $('#modePeople').onclick = () => setMode('people');
  $('#search').oninput = e => { VIEW.q = e.target.value; render(); };
  $('#newTaskBtn').onclick = newTask;
  $('#exportBtn').onclick = exportJSON;

  $('#bulkNext').onclick = () => bulk(t => t.status = 'next');
  $('#bulkOngoing').onclick = () => bulk(t => t.status = 'ongoing');
  $('#bulkDone').onclick = () => bulk(t => t.status = 'done');
  $('#bulkCurrent').onclick = () => bulk(t => t.current = true);
  $('#bulkMine').onclick = () => { if (ME) bulk(t => { if (!t.assignees.includes(ME)) t.assignees.push(ME); }); };
  $('#bulkClear').onclick = () => { SELECTED.clear(); render(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#modal').hidden = true; if (OPEN_TASK) { OPEN_TASK = null; $('#drawer').hidden = true; } }
  });
}

function setMode(m) {
  VIEW.mode = m;
  ['Board', 'Timeline', 'People'].forEach(x => $('#mode' + x).classList.toggle('on', x.toLowerCase() === m));
  render();
}

function buildFilters() {
  const groupBtns = [`<button class="fchip on" data-filter="group:all">All phases</button>`]
    .concat(GROUPS.map(g => `<button class="fchip" data-filter="group:${g.id}">${esc(g.name)}</button>`)).join('');
  const peopleBtns = [`<button class="fchip on" data-filter="person:all">Everyone</button>`]
    .concat(STATE.people.map(p => `<button class="fchip" data-filter="person:${p.id}">${esc(p.name)}</button>`))
    .concat([`<button class="fchip" data-filter="person:unassigned">Unassigned</button>`]).join('');
  const statusBtns = ['all', 'next', 'ongoing', 'blocked', 'done']
    .map(s => `<button class="fchip ${s === 'all' ? 'on' : ''}" data-filter="status:${s}">${s === 'all' ? 'Any status' : s === 'ongoing' ? 'On now' : s[0].toUpperCase() + s.slice(1)}</button>`).join('');
  const tagBtns = [`<button class="fchip on" data-filter="tag:all">Any tag</button>`]
    .concat(TAGS.map(x => `<button class="fchip" data-filter="tag:${x}">${esc(x)}</button>`)).join('');
  $('#filters').innerHTML = `
    <div class="frow">${groupBtns}</div>
    <div class="frow">${peopleBtns}</div>
    <div class="frow">${statusBtns}${tagBtns}</div>`;
}

/* ------------------------------------------------------------------ boot -- */

async function boot() {
  const local = loadLocal();
  if (local) STATE = local;
  ME = localStorage.getItem(ME_KEY);

  if (shared()) {
    try {
      const remote = await pullShared();
      if (remote) STATE = mergeDocs(STATE, remote);
      else await pushShared(STATE);
      LAST_SYNC = new Date();
    } catch (e) { console.warn('initial sync failed', e); }
    setInterval(poll, SYNC.pollMs);
  }

  buildFilters(); wire(); paintIdentity(); render();
}

document.addEventListener('DOMContentLoaded', boot);
