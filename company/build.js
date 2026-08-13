/* ============================================================================
   THE CUTTING ROOM — the technical plan, as work.

   Data for the shared board engine (board.js). This board is for the people
   writing the code: two to four developers who should be able to pick a task,
   read why it exists, and know when it is done without asking.

   Every task carries its reason. A plan that only says WHAT gets argued with;
   a plan that says WHY gets executed.
   ========================================================================== */

const BOARD_KEY = 'cuttingroom';
const BOARD_TITLE = 'The Cutting Room';

const SYNC = {
  // Same table as the Workroom, a different row. See company/README-SYNC.md.
  url: '',
  key: '',
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
];

const TAGS = ['blocker', 'architecture', 'data-safety', 'mobile', 'security', 'testing', 'performance', 'accessibility', 'tooling', 'release', 'docs', 'ai-workflow'];

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
    check: 'Settings to Preferences, the wardrobe to SQLite · reuse the existing migration layer, do not write a second one · localStorage demoted to a cache · a migration test with a real 300-piece wardrobe and photographs · the snapshot from the data-safety phase must already be in place' },
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
  { g: 'release', t: 'Stand up cloud iOS builds from Windows', a: [], tags: ['release', 'mobile'], status: 'next', est: '4 days',
    why: 'Nobody on this team owns a Mac. Signing and TestFlight uploads have to run somewhere else, reliably, from day one rather than the week of launch.',
    check: 'A build service producing a signed TestFlight upload · certificates and profiles owned by the company account, not a person · a second person able to run a release' },
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
];
