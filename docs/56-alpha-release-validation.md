# Rose atelier, event stylist and AI workbench release

Owner direction on 7 September 2026 authorized the navigation/theme redesign, Obsidian border repair, model/prompt work, portal improvements, GitHub commit, merge and publication. The release preserves the five previously unpublished main-branch commits and adds the reviewed implementation on a feature branch.

## What changed

- The web alpha opens in warm Rose atelier, with rose-gold and silver details. Explicit saved theme choices remain respected. The former House main tab is Outfits; Profile is in More; Outfits links to Calendar.
- Saved outfits remain visible even when their garments are retired or missing. Unsafe new wear actions explain the limitation. Weather-aware event styling and refinement use only eligible closet IDs, with Claude Fable 5.1 as the default.
- All six themes use measurable corner ornaments on padded cards. Empty border lanes keep the Obsidian geometry clear of text, photos, pin/scissors controls and keyboard focus. The outer saved-outfit grid no longer repeats a decorative frame.
- The separate operator portal compares flat-lay intake, worn-outfit intake, event styling and custom prompts across up to four selected models per run. It shows exact submitted inputs, local crop previews, validation, returned model, latency, usage, cost estimates and optional review notes.
- Admin test requests authenticate before body reads or provider calls. No arbitrary upstream URL, external image URL or tool payload is forwarded. Admin tokens and test material stay in page memory; exports are explicit. Stats and test responses carry no-store headers.

## Local verification

The coordinating root ran the full serialized `npm run verify` gate, including build, lint, consumer/portal isolation, shared alias parity and the existing offline suites. The new cost and admin-auth suites pass; strict operational-statistics parsing also passes its 12 grouped cases.

Browser verification passed for the full alpha routes and features, the nine focused Rose/Outfits scenarios, all six theme contrast checks, the existing portal shell suite, and eight new workbench scenarios. The border suite covers 18 theme-by-width cases at 320/390/1440px and additional Closet, Wishlist and Settings screens. A refreshed alpha audit covers 58 states across 21 routes with zero horizontal overflow or page errors. Synthetic fixtures and intercepted replies test UI behavior without reading a private wardrobe.

The border artist/reviewer inspected all eight representative captures. Corners, controls, text and photos remain separate in each theme. Clean captures wait for the actual Pin toast to disappear. Portal comparison captures cover 390px and 1280px. Generated evidence lives in ignored `shots/border-ornaments`, `shots/rose-atelier`, `shots/alpha-review`, and `shots/portal-workbench`; it is available through the [local links](49-alpha-links.md).

Two issues surfaced during verification and were fixed: a stale feature assertion still expected background-image ornaments, and Kimi rejected empty system messages. The updated assertion inspects visible SVG corners; the admin adapter now omits empty system messages, with an offline regression and a successful live retry.

## Live model evidence

A code-native synthetic illustration (white tee, navy trousers and two black shoes) was sent through the real admin-gate source running under a local test credential, then through the deployed provider relay. A separate synthetic event case used the real event prompt and known-ID parser. Actual returned model IDs matched the requested models.

| Test | Result | Estimated USD from returned usage |
|---|---|---:|
| Fable 5.1 image intake | 3 pieces accepted, 0 dropped | 0.094740 |
| Opus 5 image intake | 4 pieces accepted, 0 dropped | 0.043285 |
| Gemini 3.7 Flash image intake | 3 pieces accepted, 0 dropped | 0.007694 |
| Kimi K3 image intake, after protocol fix | 4 pieces accepted, 0 dropped | Unavailable: subscription quota |
| Fable 5.1 event styling | 3 known garment IDs; schema accepted | 0.040270 |

These are sample outcomes, not a benchmark, invoice or claim of visual/styling accuracy. Different piece counts require human review. Known metered estimates total about$0.186; Kimi subscription usage is not added as zero. [Dated pricing sources and accounting](54-model-pricing.md) explain the estimates. The original image refusal and successful retry remain in the local report.

The deployed admin-ai endpoint refused an invalid token with401. No production ADMIN_TOKEN was available in the local environment, so a successful valid-token request against that deployed gate was **not** exercised; the local gate-source test and the live provider relay are separate evidence. The portal requires the operator's existing admin token. The ai-proxy, admin-ai and no-store admin-stats changes were deployed independently of GitHub Pages. The optional usage collector was not deployed by this release.

## Publication and repository layout

The portal builds into `dist-portal`, outside the consumer artifact. The existing consumer isolation gate still rejects operator modules or a portal directory inside a consumer build. After the consumer precache is generated and checked, `stage-portal.mjs` copies only the separate public shell to `/portal/`. The updated worker bypasses that path; an older installed worker can still cache an older public shell until it updates. This is a shared-origin deployment, with authentication enforced at the server.

The Pages workflow retains the alpha guide, both demonstrations, explicitly named company boards, mobile gallery, V2 branch build and social showcase branch build. Company planning files are still excluded. [All addresses](49-alpha-links.md) and the [repository guide](README.md) identify each source and generated artifact. The GitHub release PR and Pages workflow carry merge/deployment status; hosted HTTP and route checks follow publication.
