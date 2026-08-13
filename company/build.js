/* ============================================================================
   THE TECH WORKBENCH — the technical plan, as work.

   Data for the shared board engine (board.js). This board is for the people
   writing the code: two to four developers who should be able to pick a task,
   read why it exists, and know when it is done without asking.

   Every task carries its reason. A plan that only says WHAT gets argued with;
   a plan that says WHY gets executed.
   ========================================================================== */

const BOARD_KEY = 'workbench';
/* This board was called "The Cutting Room" until 13 Aug 2026. BOARD_KEY
   namespaces localStorage, so renaming it without this line would have left
   every saved edit, note and sign-in stranded under the old key — the board
   would have looked freshly seeded and nobody would have known why. The engine
   migrates the old keys once, then leaves them alone. */
const BOARD_KEY_WAS = 'cuttingroom';
const BOARD_TITLE = 'The Tech Workbench';

/* SHARED, and deliberately wide open. The three policies on this table are the
   `using (true)` set, so the key below grants read AND write to anyone who has
   it — and it is committed to a public repository, so that is everyone who
   finds the URL. Verified on 13 Aug 2026: anonymous insert returns 201,
   anonymous update returns 204. Delete is the only thing refused, and only
   because no delete policy exists.

   This is a knowing trade for a test on an unlisted URL. It stops being
   acceptable the moment this board holds anything about a real person — a
   tester's email, a candidate's name, a journalist's number — because at that
   point it is a personal-data breach and the company answers for it.

   To close it: turn on Supabase Auth, invite the team, replace the three
   policies with the `auth.uid() is not null` versions commented in
   company/README-SYNC.md, and rotate this key. Rotating is required, not
   optional — it is in the git history permanently. */
const SYNC = {
  // Same table as the Workroom, a different row. See company/README-SYNC.md.
  url: 'https://wvupsqfevlrmhqfjreyx.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXBzcWZldmxybWhxZmpyZXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTAzMzMsImV4cCI6MjEwMjIyNjMzM30.BaCK355UlbgyJuN7qBywmN0-tAKd6yrwFd_67nfzJVw',
  table: 'almari_workroom',
  row: 2,
  pollMs: 5000,
};

const PEOPLE = [
  { id: 'hm',     name: 'Hrudayangam', initials: 'HM', role: 'Lead — architecture, review, the design contract', tint: 'ink' },
  { id: 'kunjal', name: 'Kunjal',      initials: 'K',  role: 'Developer — set at the 22 Aug meeting', tint: 'blue' },
  { id: 'nimesh', name: 'Nimesh',      initials: 'N',  role: 'Developer — set at the 22 Aug meeting', tint: 'green' },
  { id: 'raksha', name: 'Raksha',      initials: 'R',  role: 'Developer — set at the 22 Aug meeting', tint: 'gold' },
];

const GROUPS = [
  { id: 'found',  name: 'Found in review',     window: 'Do these first',                     note: 'Defects confirmed in the code by a six-lens engineering review. Each one was verified, not inferred.' },
  { id: 'ground', name: 'Ground rules',        window: 'Week 1 — before any feature work', note: 'Nobody writes application code until these exist. They are what makes four people safe in one repo.' },
  { id: 'safety', name: 'Data safety',         window: 'Weeks 1–4 — ahead of the port',     note: 'The app has no server, so a bad write is unrecoverable. This is the highest-severity work on the board.' },
  { id: 'arch',   name: 'Architecture',        window: 'Weeks 2–6',                          note: 'The refactors that pay for themselves before three more people start committing.' },
  { id: 'qa',     name: 'Testing & CI',        window: 'Weeks 2–8',                          note: 'There is no unit-test runner today. The suites that exist are good; they are not enough for a team.' },
  { id: 'native', name: 'The native port',     window: 'Weeks 6–20',                         note: 'Capacitor around the existing app. Storage moves first so the alpha tests what ships.' },
  { id: 'sec',    name: 'Security & privacy',  window: 'Weeks 8–20',                         note: 'A local-first app has a small attack surface and a large promise. Both matter.' },
  { id: 'perf',   name: 'Performance & access', window: 'Weeks 10–22',                       note: 'One 1MB bundle, base64 photographs, and a mid-range Android phone in India.' },
  { id: 'release', name: 'Release engineering', window: 'Weeks 12–26',                       note: 'Built from Windows, signed in the cloud, shipped to two stores that do not allow rollback.' },
  { id: 'ai',     name: 'Working with Claude Code', window: 'Ongoing',                       note: 'How the team uses the tool that built this, and what stays human.' },

  /* The two ports. See docs/32-the-two-ports.md. These are deliberately three
     groups rather than one: the shared layer blocks both platforms, and the
     platform tracks then run beside each other rather than one after the other.
     Group the board by Person to see them as lanes. */
  { id: 'shared',  name: 'The shared layer',     window: 'Weeks 1–3 — blocks both platforms', note: 'One codebase, one UI, one test suite. About 85% of the port lives here and neither store track can move until it does.' },
  { id: 'android', name: 'The Android track',    window: 'Aug – late Oct 2026',                note: 'Ships first, and the reason is not Google: Android builds on Windows and iOS does not. Target 20 Oct – 10 Nov; quote the outer date.' },
  { id: 'ios',     name: 'The iOS track',        window: 'Aug – early Dec 2026',               note: 'Six weeks behind Android because Apple\'s gates are serial: incorporation, then D-U-N-S, then verification, then agreements. Fallback 20 Jan 2027.' },
];

const TAGS = ['blocker', 'architecture', 'data-safety', 'mobile', 'security', 'testing', 'performance', 'accessibility', 'tooling', 'release', 'docs', 'ai-workflow', 'ios', 'android', 'external-gate', 'money', 'one-way-door', 'legal'];

const SEED_TASKS = [
  /* ---- found in review ------------------------------------------------- */
  { g: 'found', t: 'Stop fetching Switzer from Fontshare on every launch', a: [], tags: ['blocker', 'security', 'performance'], status: 'next', current: true, est: '1 day',
    why: 'index.html line 86 loads a stylesheet from api.fontshare.com, render-blocking, on every single launch. That makes two of the product\'s central claims untrue at once: the README says "no network call" and "Collects: Nothing", and the app claims to work offline. Every launch tells a third party the user\'s IP address and that they opened their wardrobe. The commit that self-hosted the type moved Fraunces and IBM Plex Mono into public/fonts and left Switzer behind.',
    check: 'Check the Switzer licence permits self-hosting and app embedding before downloading anything; most webfont licences cover web serving only, and this one ships inside a paid binary · self-host the woff2 next to the other two families · delete the preconnect on line 13 too · add a CI check that fails the build on any external URL in index.html or src, so the promise is enforced rather than remembered · the company pages under company/ do the same thing and should follow' },
  { g: 'found', t: 'Run CI on pull requests', a: ['hm'], tags: ['blocker', 'tooling', 'testing'], status: 'next', current: true, est: '2 hours',
    why: 'deploy.yml triggers only on push to main and workflow_dispatch. There is no pull_request trigger anywhere, so a branch or a PR runs zero checks. Three developers are about to start opening PRs into a repository where nothing verifies them until after they are merged and already live.',
    check: 'A pull_request workflow running typecheck, oxlint, the brand contract, the migration and demo suites · make those checks required in branch protection · keep the deploy job on main only' },
  { g: 'found', t: 'Make npm run verify actually verify', a: [], tags: ['blocker', 'testing'], status: 'next', est: '1 hour',
    why: 'verify runs build, the brand contract, and the migrate, demo and intake suites. It silently omits oxlint and the contrast suite, so the command everyone trusts as the gate passes while genuine lint errors and an AA contrast regression sit in the tree. The contrast suite once caught the dark theme failing AA by 0.01, which is exactly the class of bug nobody catches by eye.',
    check: 'Add lint and test:contrast to the verify chain · add test:cast and test:art, which also exist and also never run · one command that means what its name says' },
  { g: 'found', t: 'Move the BYOK API key out of localStorage', a: [], tags: ['blocker', 'security'], status: 'next', est: '2 days',
    why: 'The bring-your-own-key value is held in plaintext web storage, readable by any script that ever runs in the WebView and captured by any backup that copies the origin. A user\'s API key is a billable credential.',
    check: 'Keychain on iOS, Keystore on Android, through a Capacitor plugin · never in web storage, never in an export file, never in a log line · the export must be checked for it explicitly, since the export is lossless by design' },
  { g: 'found', t: 'Fix the export button inside the WebView', a: [], tags: ['blocker', 'mobile', 'data-safety'], status: 'next', est: '1 day',
    why: 'The export uses an anchor with a download attribute, which does not work in WKWebView. The lossless export is the product\'s central promise and its only backup mechanism, and it silently does nothing in the very build the company intends to sell.',
    check: 'Route the export through the Filesystem and Share plugins on native · keep the anchor path on web · test it on a real iPhone before any TestFlight build, because this is the one feature that must never be broken' },
  { g: 'found', t: 'Get the demo wardrobes off the cold-start path', a: [], tags: ['performance'], status: 'next', est: '3 days',
    why: 'The entry chunk is 1,027,182 bytes raw and about 580KB of it is demo, persona and illustration data. personaData.ts is reachable from SessionContext, so every real user downloads and parses eight sample wardrobes they will never open, before their own closet renders.',
    check: 'Dynamic import the persona data behind the sample-wardrobe action · measure the entry chunk before and after · a CI budget so it cannot creep back' },
  { g: 'found', t: 'Fix the empty-cost bug that records a zero', a: [], tags: ['data-safety'], status: 'next', est: '2 hours',
    why: 'An empty cost string is coerced to a recorded zero rather than left absent. A recorded zero is a fact in the ledger: it says this piece cost nothing, which drags cost-per-wear down and quietly corrupts the single number the product exists to compute.',
    check: 'Absent and zero must stay distinguishable end to end · a property test asserting an empty input never becomes a recorded zero · check what already-stored data this has affected' },
  { g: 'found', t: 'Turn on the accessibility linter that is already installed', a: [], tags: ['accessibility'], status: 'next', est: '1 day',
    why: 'oxlint ships with a jsx-a11y plugin that is present but not enabled. Switching it on surfaces eleven findings across seven rules, two of which are real keyboard traps in the modal, and it costs nothing to run.',
    check: 'Enable the plugin · fix the two keyboard bugs first, since a modal you cannot leave by keyboard is a genuine barrier · triage the rest · then make it a CI gate so the count cannot grow' },
  { g: 'found', t: 'Put the brand skill where tools can find it', a: [], tags: ['tooling', 'ai-workflow'], status: 'next', est: '1 hour',
    why: 'The brand contract skill lives in skills/ rather than .claude/skills/, so the assistant the team is about to rely on cannot discover it automatically. The one document that keeps the design honest is the one document not wired in. The skills README also documents an API that does not exist.',
    check: 'Move to .claude/skills/ and confirm it loads · correct or delete the README that describes a fictional interface' },

  /* ---- ground rules --------------------------------------------------- */
  { g: 'ground', t: 'Turn on branch protection and required checks for main', a: ['hm'], tags: ['blocker', 'tooling'], status: 'next', current: true, est: '1 hour',
    why: 'Verified today: main has no protection rule, zero rulesets, and vulnerability alerts are off, on a repository whose every push to main force-pushes the live site. Three more people are about to get write access.',
    check: 'Require a pull request · require the lint, typecheck and test jobs to pass · no force pushes to main · enable Dependabot alerts and security updates · enable secret scanning' },
  { g: 'ground', t: 'Write CLAUDE.md, the repository brief every session reads', a: ['hm'], tags: ['docs', 'ai-workflow'], status: 'next', est: '3 hours',
    why: 'Four people and an AI assistant all guessing at the same conventions is how a design contract quietly dies. One file, loaded automatically, that states the stack, the commands, the vetoes and the review rules.',
    check: 'The binding vetoes verbatim · the copy law · run the brand contract before any UI change · the verify command · what must never be added (telemetry, analytics SDKs, commerce, accounts)' },
  { g: 'ground', t: 'Adopt a branch and pull-request convention', a: [], tags: ['tooling', 'docs'], status: 'next', est: '2 hours',
    why: 'Short-lived branches off main, one reviewer, squash merge. Written down once so nobody has to ask, and so review is a habit rather than an event.',
    check: 'A PR template naming the design-contract checklist · what needs a screenshot (any UI change, both themes, 390px) · who reviews what' },
  { g: 'ground', t: 'Add Prettier and make formatting unarguable', a: [], tags: ['tooling'], status: 'next', est: '2 hours',
    why: 'oxlint covers correctness, not layout. Formatting arguments in review are pure waste and they get worse with team size.',
    check: 'Format on save, a CI check, and one commit that reformats everything so no later diff is noise' },
  { g: 'ground', t: 'Decide the licence and commit LICENSE', a: ['hm'], tags: ['blocker', 'docs'], status: 'next', current: true, est: '2 days',
    why: 'Verified today: the repository is public, contains the entire shippable product, and has no LICENSE file, no license field, and GitHub reports license null. The revenue model is a paid binary of exactly this code, and the first outside pull request is the hard deadline, because a merged PR puts copyright the company does not own into its only asset.',
    check: 'A source-available licence rather than MIT or Apache, which grant away the thing being sold · set the package.json license field, currently read as UNLICENSED by every scanner · CONTRIBUTING states whether outside pull requests are accepted at all · consider keeping the native shell and signing config in a private repository' },

  /* ---- data safety ----------------------------------------------------- */
  { g: 'safety', t: 'Snapshot the pre-migration bytes before any migration writes', a: [], tags: ['blocker', 'data-safety'], status: 'next', current: true, est: '3 days',
    why: 'Verified in the code: useLocalStorage.ts runs migrate() on read at line 43, and the debounced writer commits the migrated state back over the same key at line 76. The original bytes survive only until the user first edits anything. Nothing snapshots them, and the only backup is an export the user had to remember to take. There is no server and therefore no restore.',
    check: 'Write the raw pre-migration string to a separate key before the first write of a migrated state · keep the last two · a Restore from snapshot row in Settings · snapshot before import too, which replaces the whole wardrobe in one click · watch the quota: a full snapshot doubles storage for a photo-heavy closet, which is the exact failure this file already fights, so decide the size threshold deliberately' },
  { g: 'safety', t: 'Property-test the migration layer', a: [], tags: ['data-safety', 'testing'], status: 'next', est: '4 days',
    why: 'migrate() is the most dangerous function in the codebase: it runs on every load, over data the company can never recover. The existing 53 checks are example-based, so they only cover the shapes somebody thought of.',
    check: 'fast-check over generated wardrobe states · the invariants: no field is ever dropped, unknown fields survive, wear counts never change, migrate is idempotent, malformed input never throws · round-trip export then import equals the original' },
  { g: 'safety', t: 'Make storage failure loud on every path', a: [], tags: ['data-safety'], status: 'next', est: '2 days',
    why: 'A silently failed write is the failure every rival gets reviewed for. The hook already reports quota errors once per run; the same discipline has to survive the move to native storage.',
    check: 'Quota exceeded surfaces a toast that says what to do · a failed write never leaves the UI looking saved · test with a deliberately filled quota' },
  { g: 'safety', t: 'Write the data-loss incident playbook', a: ['hm'], tags: ['data-safety', 'docs'], status: 'next', est: '1 day',
    why: 'With no server there is no hotfix faster than App Review, and no way to push a repair. The response has to be decided before it is needed.',
    check: 'Halt the Play staged rollout · what to tell people and where · how to walk somebody through a snapshot restore over email · what evidence to ask for when the app cannot phone home' },

  /* ---- architecture ---------------------------------------------------- */
  { g: 'arch', t: 'Put a storage layer in front of every read and write', a: [], tags: ['blocker', 'architecture'], status: 'next', est: '1 week',
    why: 'localStorage is called from the hook today, and the native build needs SQLite while any future sync needs something else again. One interface now means the port is a new adapter rather than a rewrite of every call site.',
    check: 'get, set, remove, list, plus a transaction boundary · localStorage adapter first, behaviour unchanged · the existing suites pass untouched, which is the proof the boundary is right' },
  { g: 'arch', t: 'Split the bundle by route', a: [], tags: ['architecture', 'performance'], status: 'next', est: '3 days',
    why: 'One ~1MB JavaScript bundle is shipped to a phone on 4G before anything renders, and most of it is pages the person may never open.',
    check: 'React.lazy per route, Today and the closet eager · measure before and after with rollup-plugin-visualizer · a CI budget that fails the build if the entry chunk grows past an agreed size' },
  { g: 'arch', t: 'Add error boundaries so one bad render is not a white screen', a: [], tags: ['architecture'], status: 'next', est: '2 days',
    why: 'A crash in one page currently takes the whole app down, and there is no crash reporting to tell anyone it happened.',
    check: 'A boundary per route · a recovery that keeps the record intact and offers the export · copy that follows the house voice, no exclamation points' },
  { g: 'arch', t: 'Review the context split for re-render cost', a: [], tags: ['architecture', 'performance'], status: 'next', est: '3 days',
    why: 'WardrobeContext holds the whole wardrobe; any change re-renders every consumer. It is fine at 30 pieces and not obviously fine at 300 with photographs.',
    check: 'Profile a 300-piece closet · split the context or memoise selectors only where the profile says so · no speculative optimisation' },

  /* ---- testing & CI ----------------------------------------------------- */
  { g: 'qa', t: 'Add Vitest alongside the existing suites', a: [], tags: ['blocker', 'testing'], status: 'next', est: '3 days',
    why: 'There is no unit-test runner at all. The pure modules are where bugs are cheapest to catch and where a new contributor is most likely to break something invisibly.',
    check: 'Start with migrate.ts, cost.ts, dates.ts, similarity.ts · run in CI on every PR · keep the existing script suites, which test things unit tests cannot' },
  { g: 'qa', t: 'Build the CI matrix and make it fast enough to be respected', a: [], tags: ['testing', 'tooling'], status: 'next', est: '3 days',
    why: 'A pipeline nobody waits for is a pipeline people learn to bypass. It also has to run the brand contract, which is the only thing keeping the design honest.',
    check: 'On PR: typecheck, lint, brand contract, unit tests, the migration suite · on main: add the browser suites and the build · a wall-clock target under ten minutes · cache node_modules and Playwright browsers' },
  { g: 'qa', t: 'Write the definition of done, and put it in the PR template', a: ['hm'], tags: ['testing', 'docs'], status: 'next', est: '2 hours',
    why: 'Four part-time people need the bar written down, or it becomes whatever the last reviewer felt like.',
    check: 'Tests for new logic · both themes checked · 390px checked · brand contract passes · no new dependency without a reason in the PR body' },
  { g: 'qa', t: 'Choose and stand up device testing', a: [], tags: ['testing', 'mobile'], status: 'next', est: '4 days',
    why: 'India is an Android market with a long tail of low-RAM devices and old WebViews, and the emulator lies about all of it.',
    check: 'One real low-end Android and one older iPhone in hand · a cloud device farm for the matrix · a written smoke script somebody can run in fifteen minutes before a release' },

  /* ---- the native port -------------------------------------------------- */
  { g: 'native', t: 'Scaffold the Capacitor project for iOS and Android', a: [], tags: ['mobile'], status: 'next', est: '3 days',
    why: 'Capacitor wraps the app that already exists. A React Native rewrite would rebuild the entire Tailwind and SVG design system for nothing a user can see.',
    check: 'Current major version, not the one that just left maintenance · capacitor.config.ts committed · both platforms building locally before any feature work' },
  { g: 'native', t: 'Move the source of truth to native storage', a: [], tags: ['blocker', 'mobile', 'data-safety'], status: 'next', est: '2 weeks',
    why: 'WebView storage is transient: the operating system reclaims it under disk pressure and iOS offers no opt-out. This is the single riskiest change in the whole port, which is why it happens early enough for the alpha to test it.',
    check: 'REVISED by docs/32 — NOT SQLite in v1 · settings to Preferences, the wardrobe document to a JSON file on the filesystem, photographs to individual JPEGs · reuse the existing migration layer, do not write a second one · localStorage demoted to a cache · a migration test with a real 300-piece wardrobe and photographs · the snapshot from the data-safety phase must already be in place',
    dep: 'Build the storage adapter interface' },
  { g: 'native', t: 'Wire the native capabilities', a: [], tags: ['mobile'], status: 'next', est: '1 week',
    why: 'Camera, filesystem, share and haptics are what make this an app rather than a website in a box, and each is also evidence against the minimum-functionality rejection that wrapped apps attract.',
    check: 'Camera intake into the existing add-item flow · share sheet for the export, which turns the lossless promise into a real file · haptics on the two-tap log only, never as decoration' },
  { g: 'native', t: 'Add the biometric lock', a: [], tags: ['mobile', 'security'], status: 'next', est: '3 days',
    why: 'A privacy feature that fits an app with no account, and more evidence of native function. Ship it with honest copy: it guards the screen, not the disk.',
    check: 'Opt in, never default on · a working escape route if biometrics fail · the copy states plainly what it does and does not protect' },
  { g: 'native', t: 'Assemble the minimum-functionality case before submitting', a: ['hm'], tags: ['mobile', 'release'], status: 'next', est: '2 days',
    why: 'Guideline 4.2 is the top rejection reason for wrapped web apps, and the review notes are the place to argue it, not a resubmission.',
    check: 'No browser chrome anywhere · genuine offline, demonstrated · native camera, share, haptics, biometrics · a reviewer note naming each' },

  /* ---- security -------------------------------------------------------- */
  { g: 'sec', t: 'Write the threat model down', a: ['hm'], tags: ['security', 'docs'], status: 'next', est: '2 days',
    why: 'The attack surface is unusual: no server to breach, but a device that can be stolen, shared, or backed up somewhere the person did not think about.',
    check: 'Device theft and shared devices · another app on the device · WebView specifics · the optional bring-your-own-key feature · supply chain · what is explicitly out of scope, and why' },
  { g: 'sec', t: 'Harden the WebView for release builds', a: [], tags: ['security', 'mobile'], status: 'next', est: '2 days',
    why: 'A permissive WebView is the one genuinely large hole in an otherwise small surface.',
    check: 'Restrict navigation to the app origin · a content security policy · debugging off in release · no arbitrary file access' },
  { g: 'sec', t: 'Lock down dependencies and secrets', a: [], tags: ['security', 'tooling'], status: 'next', est: '2 days',
    why: 'The lockfile is the largest piece of code nobody on the team wrote, and signing keys are the one asset that cannot be regenerated.',
    check: 'Renovate or Dependabot with a review rule, not auto-merge · secret scanning on · a documented custody plan for the Android keystore, which is unrecoverable and ends the app updating if lost' },
  { g: 'sec', t: 'Decide the bring-your-own-key storage and disclosure', a: [], tags: ['security', 'blocker'], status: 'next', est: '3 days',
    why: 'The moment the app sends a photograph to a model on the user key, the absolute privacy claim stops being true and the store data declarations may stop being accurate. This is a product decision with a legal edge, not a code detail.',
    check: 'Key in the platform keychain, never in web storage, never logged · the privacy copy qualified everywhere it appears · the get-a-key link carries no referral code, ever · resolve the store declaration question before this ships, or ship v1 without it' },

  /* ---- performance & accessibility -------------------------------------- */
  { g: 'perf', t: 'Set performance budgets and measure on a real cheap phone', a: [], tags: ['performance'], status: 'next', est: '3 days',
    why: 'The target user is on a mid-range Android in India, not the developer laptop the app currently feels fast on.',
    check: 'A budget for the entry chunk, time to interactive and the closet grid · measured on a real low-end device · Lighthouse in CI as the regression alarm, device numbers as the truth' },
  { g: 'perf', t: 'Fix the image pipeline', a: [], tags: ['performance', 'data-safety'], status: 'next', est: '1 week',
    why: 'Base64 photographs in localStorage is the arrangement that both fills the quota and slows every read. It is the single largest performance and safety problem in the app.',
    check: 'Photographs out of the JSON blob and into files or IndexedDB, behind the storage layer · thumbnails for the grid, full size only on the detail view · WebP · measure a 300-piece closet before and after' },
  { g: 'perf', t: 'Move the background cutout off the main thread', a: [], tags: ['performance'], status: 'next', est: '4 days',
    why: 'It runs for a few hundred milliseconds on the main thread today, which is a visible freeze on a slower phone during the app\'s most-demoed feature.',
    check: 'A Web Worker, with the UI showing honest progress · no change to the drawn result · verified on the cheap device' },
  { g: 'perf', t: 'Run the accessibility pass and write the checklist', a: [], tags: ['accessibility'], status: 'next', est: '1 week',
    why: 'The palette is already contrast-checked in both themes; the rest of accessibility is untested. On a paid app it is an obligation, and store policy is moving the same way.',
    check: 'axe in CI for the machine-checkable half · VoiceOver and TalkBack scripts for the half it cannot check · touch targets, dynamic type, focus order after route changes, reduced motion · a per-component checklist in the PR template' },

  /* ---- release --------------------------------------------------------- */
  { g: 'release', t: 'Stand up cloud iOS builds from Windows', a: [], tags: ['release', 'mobile'], status: 'blocked', est: '4 days',
    why: 'SUPERSEDED by docs/32 — buying a Mac mini won on arithmetic, and cloud-only turned out to be impossible anyway. Apple enrolment in India runs through the Apple Developer app and is device-bound, so a Windows-only team cannot enrol at all, let alone build. What survives of this task is the CI half: Xcode Cloud gives 25 hours a month free with the membership, and a working cloud path is the answer to the bus factor of one Mac.',
    check: 'Keep this open only as the CI-redundancy task · Xcode Cloud first, GitHub Actions macOS at $0.062/min as the documented fallback · run the fallback once a month so it does not rot · see the Mac mini task in the iOS track',
    dep: 'Order the Mac mini' },
  { g: 'release', t: 'Fix version discipline in one place', a: [], tags: ['release', 'tooling'], status: 'next', est: '1 day',
    why: 'Two stores, two version schemes, and a monotonic build number that cannot ever go backwards.',
    check: 'Single source in package.json · derived at build time for both platforms · tags cut by CI only · the full verify must pass before any store build exists' },
  { g: 'release', t: 'Write the release checklist and the rollback plan', a: ['hm'], tags: ['release', 'docs'], status: 'next', est: '1 day',
    why: 'Neither store lets you un-ship a version. The only real levers are a staged rollout and a fast forward-fix, and both have to be arranged in advance.',
    check: 'Android staged rollout starting small, with the halt criteria written down · iOS phased release · a pre-built previous version ready to resubmit · who decides to halt, and on what signal' },
  { g: 'release', t: 'Produce the store assets', a: [], tags: ['release'], status: 'next', est: '1 week',
    why: 'Screenshots for every required device size, an icon set, and listing copy are a genuine workstream that teams routinely discover the week they wanted to launch.',
    check: 'Screenshots generated from the real app, not mocked · listing copy under the house copy law, no exclamation points, no urgency · privacy policy URL live before submission, which both stores require even when nothing is collected' },

  /* ---- working with Claude Code ----------------------------------------- */
  { g: 'ai', t: 'Agree what the AI may and may not decide', a: ['hm'], tags: ['ai-workflow', 'docs'], status: 'next', est: '2 hours',
    why: 'The assistant is good at mechanical breadth and bad at knowing which rules are load-bearing. The vetoes exist because a focus group set them, and no model was in that room.',
    check: 'Human review is mandatory for: the design contract, the copy law, anything touching migrate() or storage, security, and dependencies · everything else is reviewable at normal speed' },
  { g: 'ai', t: 'Make the guardrails automatic rather than remembered', a: [], tags: ['ai-workflow', 'tooling'], status: 'next', est: '2 days',
    why: 'The brand-contract linter already catches raw hexes, emoji, banned words and wrong radii in CI. Every rule moved from a document into a check is a rule that survives a tired reviewer.',
    check: 'The contract runs on every PR · extend it where a rule keeps getting broken · a failing check must explain the rule, not just the line' },
  { g: 'ai', t: 'Write the prompt patterns for this codebase', a: [], tags: ['ai-workflow', 'docs'], status: 'next', est: '1 day',
    why: 'The same tasks recur: add a plugin behind the storage layer, write a migration with property tests, do an accessibility pass on a component. Writing the brief once makes the results consistent across four people.',
    check: 'Each pattern names the files to read first, the tests that must pass, and the contract rules that apply' },
  { g: 'ai', t: 'Sandbox any agent that runs in CI', a: ['hm'], tags: ['ai-workflow', 'security'], status: 'next', est: '2 hours',
    why: 'An assistant with repository write access, triggered by pull requests, will eventually read a pull request written by somebody hostile.',
    check: 'Least-privilege token · no secrets in the agent environment · agent-authored changes always land as a PR a human approves' },

  /* ---- the shared layer: blocks both platforms ------------------------- */
  { g: 'shared', t: 'Build the storage adapter interface', a: [], tags: ['blocker', 'architecture', 'data-safety'], status: 'next', current: true, est: '1 week', due: '2026-08-21',
    why: 'This is the one thing that has to be serialised. The photo pipeline, the migration and both platform integrations all sit on top of it, so until it is merged nobody else can start. It is also what turns SQLite from a rewrite into a later, contained decision, and what lets the existing Node harnesses run against a fake instead of a device.',
    check: 'One interface: readWardrobe, writeWardrobe, writePhoto, photoUrl · a localStorage implementation for web and a native one for device · nothing else in src/ touches storage directly · the existing test suites run green against the fake · merged before any other port task begins' },
  { g: 'shared', t: 'Move photographs out of localStorage onto the filesystem', a: [], tags: ['blocker', 'data-safety', 'mobile', 'performance'], status: 'next', est: '1 week', due: '2026-08-28',
    why: 'Today every garment photo is a base64 PNG string inside one JSON blob, and useLocalStorage rewrites the entire application state — every photograph included — on every change. Capacitor documents WebView storage as transient: the operating system reclaims it when the device runs low on space. So this is not a slowness problem, it is a data-loss problem, and it is the failure the whole port exists to escape.',
    check: 'photos/<garmentId>/full.jpg at long edge 1600 q0.82 and thumb.jpg at 400 q0.75 · photos in Directory.LibraryNoCloud, NOT Directory.Data — on iOS Data maps to Documents and is iCloud-backed, so every wardrobe would silently spend the user\'s quota · metadata JSON in Directory.Data, where it should ride the backup · never Cache, Temporary or External · RELATIVE paths only, never absolute: the iOS container UUID changes across updates and restores, so an absolute path detonates on somebody else\'s device months later · never hold PHAsset identifiers, which are nil under limited access and revocable · the grid reads through Capacitor.convertFileSrc() so bytes never cross the JS bridge · write the JSON as .tmp then rename',
    dep: 'Build the storage adapter interface' },
  { g: 'shared', t: 'Unify the three intake paths behind one resize', a: [], tags: ['blocker', 'data-safety', 'performance'], status: 'next', est: '3 days', due: '2026-08-26',
    why: 'The cut-out path caps images at OUT_EDGE 512, about 200KB. The manual add path does no resizing at all — a raw phone JPEG goes straight to base64. Storage quota dies at roughly four garments on that path, today, on the web. It is the highest-value single refactor in the port and it belongs before the storage move rather than after, because otherwise the migration carries the bug across.',
    check: 'One resize function, three callers · measure the worst case with a modern phone camera JPEG · a test that fails if any intake path writes an unresized image' },
  { g: 'shared', t: 'Write the migration test before the migration', a: [], tags: ['blocker', 'data-safety', 'testing'], status: 'next', est: '3 days', due: '2026-08-21',
    why: 'The product promise is that your data is yours, permanently. A migration that silently drops wears or photographs is worse than any store rejection, and on iOS you cannot hot-fix it. A tester who loses a wardrobe is a permanent reputational event in a four-person company.',
    check: 'The test exists and fails before the migration code exists · a real 300-piece wardrobe with photographs as the corpus · round trip: export from device, import into the web app, compare byte for byte · force a full export before the first migration runs · keep the pre-migration payload until the app has opened successfully twice · this is the gate for alpha round one, and failing it stops the alpha' },
  { g: 'shared', t: 'Decide the anthropic.ts disclosure question', a: ['hm'], tags: ['blocker', 'legal', 'security'], status: 'next', current: true, est: 'a decision, not a day', due: '2026-08-18',
    why: 'src/lib/anthropic.ts line 21 posts to api.anthropic.com and line 141 attaches the user\'s photograph. Under Google\'s definitions that is collection and sharing, and the ephemeral-processing exception does not save it because Anthropic retains inputs for 30 days. A "no data collected" declaration shipped beside that code is the exact mismatch stores enforce against. Nothing else can be written until this is decided: not the privacy policy, not the Data safety form, not the nutrition label, not the store listing.',
    check: 'Option A — ship it and declare Photos, collected and shared, optional, app functionality · Option B — feature-flag it off for v1 so the claim is simply true, and reintroduce later · either way the README sentence "Collects: Nothing... no network call" must change, because it is already false on the web today · write the decision down in docs/32 so nobody relitigates it in October' },
  { g: 'shared', t: 'Get a signed hello-world shell onto a real device on both platforms', a: [], tags: ['blocker', 'mobile', 'release'], status: 'next', est: '3 days', due: '2026-08-23',
    why: 'Until one signed build exists on each platform, nobody can test anything, and every estimate downstream is a guess. This is deliberately scheduled before any porting work: it finds the signing, provisioning and toolchain problems while they are cheap and nothing else is waiting on them.',
    check: 'Android: npx cap add android, upload keystore, on a physical phone · iOS: npx cap add ios, Individual account, on a physical iPhone over USB · both from a clean checkout by a second person, so the setup is reproducible rather than resident in one head' },
  { g: 'shared', t: 'Pin the toolchain for the whole launch run', a: [], tags: ['mobile', 'tooling', 'blocker'], status: 'next', est: '2 hours', due: '2026-08-21',
    why: 'Xcode 26 has been mandatory since April 2026 and Capacitor 8 requires it, but Xcode 27 is arriving and Capacitor 8.5 already changed iOS behaviour to suit it. A toolchain that moves under a four-person team during a first launch costs days nobody has budgeted.',
    check: 'Pin Xcode 26.x and Capacitor 8.5 · commit the exact versions into CI config · do not install an Xcode 27 beta on the only Mac before launch · schedule the UIScene and Capacitor 9 migration as post-launch work with its own test gate' },
  { g: 'shared', t: 'Move the native shell to a private repository', a: [], tags: ['security', 'mobile', 'release'], status: 'next', est: '1 day',
    why: 'The ios/ and android/ directories accumulate signing configuration, store credentials and provisioning detail. None of that can sit in a public repository, and it will arrive there gradually and unnoticed unless the split happens before the directories exist.',
    check: 'Web app stays public · shell, store metadata and CI secrets private · trunk-based with short-lived branches, no long-lived ios or android branches — they would diverge on the 85% that is shared · release with tags triggering a separate mobile.yml, leaving the Pages deploy on main untouched' },

  /* ---- the Android track ------------------------------------------------ */
  { g: 'android', t: 'Choose the organisation Play account, not a personal one', a: ['hm'], tags: ['blocker', 'android', 'external-gate'], status: 'next', current: true, est: 'a decision', due: '2026-08-16',
    why: 'Personal accounts created after 13 November 2023 must run a closed test with twelve testers opted in for fourteen continuous days before they may even apply for production access, and that application then takes up to seven days. Organisation accounts are exempt from all of it. That exemption is worth about three weeks and it is the single largest schedule lever on this platform. It costs a D-U-N-S number, which Apple requires anyway.',
    check: 'Confirm the exemption in the Play Console before committing the schedule to it — the researcher inferred it from the scope of Google\'s page rather than an affirmative statement · organisation also puts revenue in the company\'s payments profile rather than an individual\'s PAN, which is the point of incorporating' },
  { g: 'android', t: 'Order four Android test devices', a: [], tags: ['android', 'testing'], status: 'next', current: true, est: '1 hour', due: '2026-08-16',
    why: 'A WebView app breaks on ColorOS, One UI and HyperOS in ways no emulator shows, and the Indian market is weighted towards vivo, Oppo and realme rather than the Pixel a developer reaches for. This is a week-one task purely because of shipping time.',
    check: 'Weight the matrix towards vivo, Oppo and realme mid-range · include one low-RAM device for the 60fps scroll target with 100+ garments · about ₹51,000 for the set' },
  { g: 'android', t: 'Generate the upload keystore and store it in three places', a: [], tags: ['blocker', 'android', 'security', 'release'], status: 'next', est: '2 hours', due: '2026-08-16',
    why: 'Play App Signing separates the upload key from the app signing key, which means a lost upload key is recoverable — but only through a support process that costs days. Losing it during launch week is the kind of avoidable disaster that ends up in a retrospective.',
    check: 'Generate, then store in the team password manager, an encrypted offline copy, and GitHub Actions secrets · never in the repository · document the recovery path before you need it · a second person must be able to run a release' },
  { g: 'android', t: 'Set minSdk to 26 and confirm targetSdk 36', a: [], tags: ['android', 'security', 'mobile'], status: 'next', est: '1 hour', due: '2026-08-30',
    why: 'From 31 August 2026 new apps must target Android 16 / API 36, and Capacitor 8 already does — so that half is a checkpoint, not work, provided nobody pins it lower. The minSdk half is the real decision: on Android 7 to 9 the WebView is Chrome, permanently frozen and unpatched. For an app that is entirely a WebView, going 24 to 26 deletes two OS generations of dead engine for half a percentage point of reach.',
    check: 'minSdkVersion 26, targetSdkVersion 36 · a CI assertion on the merged manifest so neither can drift · confirm the reach cost against current distribution numbers rather than the ones quoted here' },
  { g: 'android', t: 'Set the price before releasing to any track at all', a: [], tags: ['blocker', 'android', 'money', 'one-way-door'], status: 'next', est: '30 minutes', due: '2026-09-25',
    why: 'Once an app has been offered free it can never be changed to paid, and the package name is burned permanently. Google does not document whether a release to a testing track counts as being offered free, so the safe reading is that it does. Getting this wrong costs the package name and a fresh $25 account.',
    check: 'Price set before the first internal release, not before the first production release · India price point chosen · remember only internal testers get a paid app free, so closed and open testers would have to buy it — which is why internal is the only track worth using',
    dep: 'Choose the organisation Play account' },
  { g: 'android', t: 'Enrol the account in an Account Group for the 15% tier', a: [], tags: ['android', 'money'], status: 'next', est: '1 hour',
    why: 'The reduced service fee is not granted automatically by revenue level; it has to be applied for. Not doing it means paying 30% instead of 15% — double, on every sale, silently, until somebody notices.',
    check: 'Enrol as soon as the account exists · note that Google split service and billing fees on 30 June 2026, rolled out by the buyer\'s region, and India stays on the old structure until 30 September 2027' },
  { g: 'android', t: 'Start the BillDesk KYC the day the merchant profile exists', a: [], tags: ['blocker', 'android', 'external-gate', 'money'], status: 'next', est: 'unknown — that is the problem',
    why: 'Under the Reserve Bank\'s cross-border payment-aggregator rules an Indian developer taking Play revenue must clear a BillDesk KYC. It blocks all sales, it has no published turnaround, and it appears in no generic Play launch guide — it was not in the brief and would have been discovered in October. An external gate of unknown length has to start as early as possible, which is the only lever available on it.',
    check: 'Begin the moment the merchant profile exists · treat the duration as unknown in the schedule rather than assuming it is short · escalate through Google support if it stalls, because nothing downstream of it can be worked around' },
  { g: 'android', t: 'Ship zero dangerous permissions', a: [], tags: ['android', 'security', 'accessibility'], status: 'next', est: '2 days',
    why: 'Capacitor\'s Camera plugin already uses the Android Photo Picker and needs no permission at all unless saveToGallery is set. A permission prompt on an app whose entire pitch is that it does not want your data is a self-inflicted wound, and Google audits the declarations.',
    check: 'Never add READ_MEDIA_IMAGES · a CI assertion that the merged manifest declares no dangerous permission · check every plugin\'s own manifest contributions, not just ours' },
  { g: 'android', t: 'Fill the Data safety form and the IARC questionnaire', a: [], tags: ['android', 'legal', 'blocker'], status: 'next', est: '1 day', due: '2026-09-20',
    why: 'Google audits Data safety declarations against observed app behaviour, and a mismatch is an enforcement action rather than a warning. The answers depend entirely on the anthropic.ts decision, which is why that decision is dated a month earlier than this task.',
    check: 'Answers derived from the anthropic.ts decision, not from the marketing copy · privacy policy URL live and stable, required even when nothing is collected · content rating through the IARC questionnaire',
    dep: 'Decide the anthropic.ts disclosure question' },
  { g: 'android', t: 'Build the Play release pipeline to the internal track', a: [], tags: ['android', 'release', 'tooling'], status: 'next', est: '3 days', due: '2026-08-30',
    why: 'Internal testing has no review and goes live in minutes, with a hundred seats and the paid app free to testers. It is the only track this launch needs, and having the pipeline early is what lets real-device testing start in week three rather than week eight.',
    check: 'GitHub Actions: build, sign, upload to internal · keystore from secrets · the optional $25 hedge account with a throwaway package name lets this be proven before the real account exists — but never publish the real package name on it' },

  /* ---- the iOS track ---------------------------------------------------- */
  { g: 'ios', t: 'Verify the Mac mini price, then order it', a: ['hm'], tags: ['blocker', 'ios', 'money'], status: 'next', current: true, est: '1 hour', due: '2026-08-16',
    why: 'iOS cannot be built on Windows at all, and Apple enrolment in India runs through the Apple Developer app on an Apple device — so a Windows-only team cannot even enrol. The Mac is not a tooling preference, it is a procurement gate standing in front of the entire iOS track. Buying beats renting: it pays for itself against the cheapest usable cloud Mac in about six months, and it doubles as the enrolment device.',
    check: 'Open apple.com/in/shop/buy-mac/mac-mini and check the live price first — ₹79,900 is May 2026 trade press, and a second source quoted ₹1,18,900 for what may be a different configuration, so this is a ±₹39,000 uncertainty on the largest line item · order the same day the price is confirmed · everything else on this track waits on it' },
  { g: 'ios', t: 'Enrol as an Individual as a deliberate stopgap', a: ['hm'], tags: ['ios', 'money', 'external-gate'], status: 'next', est: '1 day', due: '2026-08-23',
    why: 'Apple\'s organisation gates are serial and total six to ten weeks after incorporation: D-U-N-S, then verification, then the agreements chain. An Individual account costs $99 that will be knowingly wasted, and buys the right to do every piece of engineering, signing and TestFlight work while that paperwork grinds. It is what keeps the two tracks independent, and it is the best-value line in the plan.',
    check: 'Enrol from the Mac via the Apple Developer app · never sell under it — the seller name becomes a personal legal name · confirm the individual-to-organisation migration path with Apple Developer Support early, because only third-party guides describe it',
    dep: 'Verify the Mac mini price' },
  { g: 'ios', t: 'Request the D-U-N-S number the day the CoI lands', a: [], tags: ['blocker', 'ios', 'android', 'external-gate'], status: 'next', est: '7 business days of waiting',
    why: 'This one number gates both stores — Apple\'s organisation enrolment and Google\'s organisation account — so it is requested once and serves both. It is free, it takes about seven business days, and Apple states plainly that expediting does not shorten it. It cannot be started before the Certificate of Incorporation exists, which makes incorporation the head of the critical path for the whole mobile launch.',
    check: 'Request the same day the CoI arrives, not the same week · free from Dun & Bradstreet · confirm the legal entity details match the CoI exactly, because a mismatch restarts it' },
  { g: 'ios', t: 'Submit the Apple organisation enrolment the day D-U-N-S lands', a: [], tags: ['ios', 'external-gate'], status: 'next', est: '1–3 weeks of waiting',
    why: 'Apple publishes no service level for organisation verification, so one to three weeks is a budget rather than a number. The things that cause re-requests are knowable in advance: a company website that does not exist, an email address that is not on the company domain, and unclear binding authority for the person enrolling.',
    check: 'Website live before submitting · work email on the company domain · the person enrolling has binding authority and can prove it · be ready for a notarised-document request',
    dep: 'Request the D-U-N-S number' },
  { g: 'ios', t: 'Build the minimum-functionality dossier before first submission', a: [], tags: ['blocker', 'ios', 'mobile'], status: 'next', est: '2 weeks', due: '2026-09-27',
    why: 'A WebView wrapper in a populated category from a brand-new account is the exact profile guidelines 4.2 and 4.3(b) target, and 4.3(b) was rewritten in June 2026 into an ongoing removal power rather than just a submission filter. This is the single highest-probability failure on the iOS track, and it is entirely mitigable with two weeks of native work. It is not polish; it is the rejection defence.',
    check: 'A WidgetKit home-screen widget · Share Sheet intake · an App Intents shortcut · Files-app export · haptics on the two-tap log · name every one of them in the Notes for Review and state that all assets ship in the bundle · use the external TestFlight round as a dry run, since Beta App Review applies the same guidelines' },
  { g: 'ios', t: 'Write PrivacyInfo.xcprivacy in the same commit as the plugins', a: [], tags: ['ios', 'legal', 'blocker'], status: 'next', est: '4 hours',
    why: 'A missing or wrong privacy manifest is an upload-time rejection, ITMS-91053, discovered at the worst possible moment. @capacitor/preferences uses NSUserDefaults, which is a required-reason API, and the filesystem plugins may touch file-timestamp and disk-space categories.',
    check: 'NSPrivacyTracking false, empty tracking domains, accurate NSPrivacyAccessedAPITypes including CA92.1 for UserDefaults · audit every plugin for its own manifest · do a throwaway upload to App Store Connect in week seven, months before it matters, purely to surface validation errors early' },
  { g: 'ios', t: 'Clear the agreements chain on one checklist day', a: [], tags: ['blocker', 'ios', 'money', 'external-gate'], status: 'next', est: '1 day of filing, weeks of waiting', due: '2026-10-09',
    why: 'Pending Agreement is what blocks a launch after everything else is ready. Tax forms cannot be submitted until the Paid Apps Agreement is signed, banking needs the company current account, and the Small Business Program rate only takes effect fifteen days after the end of the fiscal month of approval — so approval slipping past end-October means the first weeks of sales bill at 30% instead of 15%.',
    check: 'One day, all of it: Paid Apps Agreement, W-8BEN-E with the treaty position pre-drafted by the CA, banking, Small Business Program, DSA trader status with registered office and company phone · verify every agreement reads Active rather than Pending before touching Pricing · one third-party source claims tax-form processing can take up to 90 days, which if true is the real binding constraint on the iOS date',
    dep: 'Submit the Apple organisation enrolment' },
  { g: 'ios', t: 'Put signing in fastlane match with an encrypted backend', a: [], tags: ['ios', 'security', 'release'], status: 'next', est: '1 day',
    why: 'One Mac, one enrolment device, one person who knows the signing setup: the bus factor is one across hardware, credentials and knowledge, and a dead machine or an unavailable lead stops all iOS work.',
    check: 'match with a private encrypted git backend so any Mac can reconstitute the state · MATCH_PASSWORD, the App Store Connect .p8, Key ID and Issuer ID in the team password manager, because the .p8 cannot be downloaded twice · a second person added to App Store Connect as Admin · at least two people have run a release end to end before launch' },

  /* ---- cross-cutting, and currently nobody's ---------------------------- */
  { g: 'ground', t: 'Get the company website and privacy policy live', a: [], tags: ['blocker', 'legal', 'external-gate', 'docs'], status: 'next', current: true, est: '3 days', due: '2026-08-31',
    why: 'This is the most under-owned item in the whole plan and it gates more than it looks. Apple will not verify an organisation without a real company website, both stores require a stable privacy-policy URL even when nothing is collected, and the DSA trader declaration needs a registered address and phone number. It has no owner today.',
    check: 'Domain registered · a real site, not a placeholder · privacy policy at a stable URL, written after the anthropic.ts decision and matching it exactly · registered office address and company phone published · assign this to a person this week',
    dep: 'Decide the anthropic.ts disclosure question' },
  { g: 'ground', t: 'Brief the CA on the four unresolved tax questions', a: [], tags: ['legal', 'money', 'external-gate'], status: 'next', est: '1 meeting',
    why: 'Indian GST on store revenue was researched and came back unsettled in four places that a researcher cannot close. Getting these wrong is not a rounding error: reverse charge on the store\'s service fee probably forces GST registration from the first rupee regardless of the twenty-lakh threshold.',
    check: 'Who is the recipient of the supply — the store or the end user — per country, which drives the whole export analysis · whether the store\'s service fee triggers reverse charge and therefore compulsory registration · gross versus net valuation for GST on Indian sales · the current rate on software services after the September 2025 overhaul, because 18% could not be confirmed for August 2026 · also: file the LUT in Form GST RFD-11 annually, and collect the bank FIRC for every store remittance even though nothing asks for it monthly' },
];
