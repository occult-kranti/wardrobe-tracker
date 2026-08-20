/**
 * The house's flags. One constant, read by both apps and by every suite.
 *
 * FEED_ENABLED hides the Look Book — the feed, Explore, story decks, and the
 * two places a wardrobe puts a look on show. Hidden, never deleted: the pages,
 * the engine and their suites all stay in the tree, and the branch
 * `feed-showcase` differs from this one by exactly one line, `= true`.
 *
 * NEVER AN ENV VAR, and the reason is concrete rather than tidy: an Expo Go
 * tester carries no environment, so a flag read from one would be true on the
 * bench and undefined on the phone that matters. One constant also means one
 * commit — the flip is reviewable as a single diff, not as a deployment
 * setting somebody has to remember.
 *
 * Resolved through the existing package-root alias (packages/shared/aliases.mjs),
 * so vite, esbuild, Metro and every scripts/test-*.mjs call site see the same
 * value. No alias change, no parity-check change.
 *
 * The `: boolean` annotation is deliberate. Without it the export narrows to
 * the literal `false`, and TypeScript then reads the flag-on half of every gate
 * as dead code — which is precisely the half the showcase branch needs to
 * typecheck. Both branches must compile from this one file.
 */
export const FEED_ENABLED: boolean = false;
