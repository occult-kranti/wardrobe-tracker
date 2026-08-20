#!/usr/bin/env node
/**
 * The deep-link threat model for safeNext().
 *
 * On the web, safeNext (src/lib/routes.ts) guards one value read off the URL
 * bar: ?next= on the door. The attacker has to talk somebody into clicking a
 * link. On the phone the same function faces a harsher threat — the app
 * declares the `almari:` scheme in app/app.json, and ANY app installed on that
 * device can send it a deep link, silently, with no click and no address bar
 * to inspect afterwards. So this file treats safeNext as a security boundary
 * and feeds it what a hostile neighbour would send.
 *
 * Three things are asserted, and the third is where the findings are:
 *
 *   1. REJECTION. Every hostile input returns null.
 *   2. ADMISSION. Every legitimate in-app path is still allowed through. A
 *      guard that rejects everything is not a passing guard, it is a broken
 *      app, so the happy path is asserted as hard as the attacks.
 *   3. NORMALISATION. Whatever safeNext admits must survive being normalised
 *      by a URL parser and still be a route we have, and still not be the
 *      door. Nothing in this repo hands the raw string straight to a socket;
 *      it is handed to a router, and every router, every WebView and every
 *      browser resolves `..` and folds `\` into `/` before it matches. The
 *      guard's own docstring promises "never an address we do not have" and
 *      "never back to the door itself"; check 3 is that promise measured
 *      after normalisation instead of before.
 *
 * The normaliser is `new URL(raw, base).pathname`, which is the WHATWG
 * algorithm every one of those consumers implements. It is not a reimplemented
 * guess.
 *
 * Usage:
 *   node scripts/test-routes.mjs             run the table
 *   node scripts/test-routes.mjs --red-proof prove the table bites
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** A host that cannot exist, so an origin escape is unmistakable in the output. */
const BASE = 'https://almari.invalid';

/* ---------- the input table ----------
   `reject` means safeNext must return null. `allow` means it must return a
   usable in-app path. Every row says why it is in the table, because a threat
   nobody can explain gets deleted by the next person in a hurry. */
const INPUTS = [
  // --- the deep-link scheme itself. Any app on the phone can send these. ---
  ['almari://evil', 'reject', 'a deep link with a HOST — on native this is the whole attack'],
  ['almari://evil.com/closet', 'reject', 'a host wearing a real route as a costume'],
  ['almari:/closet', 'reject', 'scheme plus a path that looks in-app; still not a bare path'],
  ['almari:closet', 'reject', 'opaque scheme data'],
  ['ALMARI://evil', 'reject', 'schemes are case-insensitive; the guard must not be'],
  ['almari://', 'reject', 'the scheme with nothing after it'],

  // --- absolute and protocol-relative URLs ---
  ['https://evil.com', 'reject', 'the plain open redirect'],
  ['http://evil.com', 'reject', 'the same, downgraded'],
  ['//evil.com', 'reject', 'protocol-relative: inherits https and leaves the origin'],
  ['///evil.com', 'reject', 'three slashes, which browsers fold back to two'],
  ['//evil.com/closet', 'reject', 'a foreign host carrying a route we do have'],
  ['https:evil.com', 'reject', 'scheme with no slashes; still not a path'],
  ['javascript:alert(1)', 'reject', 'the scheme that runs rather than navigates'],
  ['data:text/html,<script>1</script>', 'reject', 'a document with no origin at all'],
  ['file:///etc/passwd', 'reject', 'a local file, which a WebView would happily read'],

  // --- backslash, the classic bypass: browsers fold \ into / when parsing ---
  ['/\\evil.com', 'reject', 'reads as //evil.com the moment a URL parser sees it'],
  ['\\\\evil.com', 'reject', 'a UNC-looking pair of backslashes'],
  ['/\\/evil.com', 'reject', 'mixed slashes, same destination'],
  ['\\/evil.com', 'reject', 'the same pair the other way round'],

  // --- encoding, in case something decodes before or after the guard ---
  ['%2F%2Fevil.com', 'reject', 'percent-encoded //, in case a caller decodes twice'],
  ['/%2F%2Fevil.com', 'reject', 'a leading slash then an encoded one'],
  ['/%5Cevil.com', 'reject', 'a percent-encoded backslash'],
  ['/%2e%2e/%2e%2e/open', 'reject', 'encoded dot-dot aimed back at the door'],

  // --- whitespace and control characters, which parsers strip ---
  //     The non-printing ones are written as \uXXXX escapes on purpose. A raw
  //     control byte has shipped from this repo twice — see the
  //     no-raw-control-bytes rule in docs/08-verification.md — because it is
  //     invisible in every editor and every review and greppable by nothing.
  //     These bytes are spelled, never pasted.
  [' //evil.com', 'reject', 'a leading space; URL parsing strips it and the // survives'],
  ['\t//evil.com', 'reject', 'a leading tab — stripped by the same rule'],
  ['\n//evil.com', 'reject', 'a leading newline'],
  ['\r\n//evil.com', 'reject', 'CRLF, the pair that also splits headers'],
  ['\u0000/closet', 'reject', 'a NUL prefix on an otherwise real route'],
  ['\u000b/closet', 'reject', 'a vertical tab prefix'],
  ['/closet\u0000', 'reject', 'a NUL suffix — a truncating parser would see /closet'],
  ['/closet\t', 'reject', 'a trailing tab'],
  ['/\u2028//evil.com', 'reject', 'a line separator, which is whitespace to some parsers'],
  ['\u0085//evil.com', 'reject', 'NEL, whitespace in some parsers and not in others'],

  // --- not paths at all ---
  ['', 'reject', 'the empty string'],
  ['closet', 'reject', 'a relative path, which resolves against whatever page is open'],
  ['./closet', 'reject', 'an explicitly relative path'],
  ['../closet', 'reject', 'a relative path that climbs first'],
  ['/../closet', 'reject', 'climbing above the root'],
  ['/./closet', 'reject', 'a same-directory hop the router would not match'],
  ['/CLOSET', 'reject', 'a route we do not have; casing is not a route table'],
  ['/closet/', 'reject', 'a trailing slash is a different string and not in the table'],
  ['/nonsense', 'reject', 'an address we simply do not have'],

  // --- the door. safeNext exists partly so opening a wardrobe cannot send
  //     you back to the screen you just came from. ---
  ['/open', 'reject', 'the door itself'],
  ['/open/new', 'reject', 'the door, one room in'],
  ['/open?next=/closet', 'reject', 'the door with its own query attached'],

  // --- the happy path. These MUST come back. ---
  ['/', 'allow', 'today, the default landing'],
  ['/closet', 'allow', 'the closet'],
  ['/feed', 'allow', 'the feed'],
  ['/intake', 'allow', 'photo intake, the route a share-sheet deep link wants'],
  ['/settings', 'allow', 'settings'],
  ['/rail/abc', 'allow', "a neighbour's rail, by id"],
  ['/profile/xyz', 'allow', 'a profile, by id'],
  ['/chats/c-1', 'allow', 'a conversation, by id — the notification tap target'],
  ['/furniture/f-1', 'allow', 'a place in the dressing room, by id'],
  ['/closet?filter=tops', 'allow', 'a route with a query it is allowed to carry'],
  ['/closet#swatches', 'allow', 'a route with a fragment'],
  ['/explore', 'allow', 'explore, the browsable grid over what is on show'],
  ['/explore/post-1', 'allow', 'something on show, by id — the tile tap target'],
  ['/story/w-abc', 'allow', 'a story deck, by wardrobe id — the rail tap target'],
  ['/story/commons', 'allow', 'the guests from the commons, the rail\'s last slot'],

  // --- traversal and doubled slashes inside an :id segment. These are the
  //     rows that catch the finding: known() treats everything after the stem
  //     as an opaque id, `..` included. ---
  ['/profile/../../evil.com', 'reject', 'normalises to /evil.com, an address we do not have'],
  ['/profile/../open', 'reject', 'normalises to /open — straight back to the door'],
  ['/furniture/../open/new', 'reject', 'normalises to /open/new'],
  ['/profile/a/../../../open', 'reject', 'climbs three levels to reach the door'],
  ['/rail//evil.com', 'reject', 'known() says yes but /rail/:id cannot match an empty segment — the guard approves a 404'],
  ['/chats/\\evil.com', 'reject', 'the parser rewrites this to /chats/evil.com: the guard approves one address, the router visits another'],
  ['/explore/../open', 'reject', 'climbing from the grid back to the door'],
  ['/story//evil.com', 'reject', 'an empty story-id segment hiding a host'],
];

/**
 * What a router, a WebView or a browser makes of the string safeNext returned.
 * This is the WHATWG URL algorithm, not a reimplementation of it.
 */
function normalise(raw) {
  try {
    const u = new URL(raw, BASE);
    return { ok: true, pathname: u.pathname, origin: u.origin };
  } catch {
    return { ok: false, pathname: null, origin: null };
  }
}

async function loadRoutes() {
  const dir = mkdtempSync(join(tmpdir(), 'routes-'));
  await build({ alias: sharedAliases(),
    entryPoints: [fileURLToPath(new URL('../src/lib/routes.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    outfile: join(dir, 'routes.mjs'),
    logLevel: 'error',
  });
  return import(pathToFileURL(join(dir, 'routes.mjs')).href);
}

function runTable(safeNext, known, ROUTES, { quiet = false } = {}) {
  let fail = 0;
  const failures = [];
  const check = (label, ok, detail = '') => {
    if (!quiet || !ok) {
      console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
    }
    if (!ok) { fail++; failures.push(label); }
  };

  /* --- 1 and 2: rejection and admission --- */
  for (const [input, verdict, why] of INPUTS) {
    const got = safeNext(input);
    const shown = JSON.stringify(input);
    if (verdict === 'reject') {
      check(`refuses ${shown} — ${why}`, got === null, `admitted ${JSON.stringify(got)}`);
    } else {
      check(`admits ${shown} — ${why}`, got === input, `returned ${JSON.stringify(got)}`);
    }
  }

  /* --- 3: whatever was admitted must survive normalisation --- */
  for (const [input] of INPUTS) {
    const got = safeNext(input);
    if (got === null) continue;
    const n = normalise(got);
    const shown = JSON.stringify(input);
    check(
      `${shown} is still same-origin once a URL parser has read it`,
      n.ok && n.origin === BASE,
      n.ok ? `escaped to ${n.origin}` : 'unparseable'
    );
    check(
      `${shown} normalises to an address we actually have`,
      n.ok && known(n.pathname),
      n.ok ? `normalises to ${JSON.stringify(n.pathname)}, which is not in ROUTES` : 'unparseable'
    );
    check(
      `${shown} does not normalise back to the door`,
      n.ok && n.pathname !== '/open' && !n.pathname.startsWith('/open/'),
      n.ok ? `normalises to ${JSON.stringify(n.pathname)}` : 'unparseable'
    );
    check(
      `${shown} does not normalise to a protocol-relative path`,
      n.ok && !n.pathname.startsWith('//'),
      n.ok ? `normalises to ${JSON.stringify(n.pathname)}` : 'unparseable'
    );
  }

  /* --- every route in the table is reachable through the guard, or is the
         door, or takes an id. Otherwise a route can quietly stop being a legal
         redirect target and nobody notices until a deep link dies. --- */
  for (const { path } of ROUTES) {
    if (path === '/open' || path.startsWith('/open/')) continue;
    const probe = path.includes('/:') ? `${path.slice(0, path.indexOf('/:'))}/probe-id` : path;
    check(`${path} is reachable as a redirect target (${probe})`, safeNext(probe) === probe, JSON.stringify(safeNext(probe)));
  }

  return { fail, failures };
}

/* ---------- the red-proof ----------
   Three weakened guards, each of which the table must catch. The point of the
   third is that it is only caught by the ADMISSION rows: it proves the happy
   path is load-bearing and this file is not a guard that would applaud
   `() => null`. */
const WEAKENED = [
  {
    name: 'a guard that only checks the leading slash (no route allowlist)',
    safeNext: raw => (raw && raw.startsWith('/') ? raw : null),
    known: () => true,
  },
  {
    name: 'a guard that blocks // but forgets the door',
    safeNext: (raw, known) => {
      if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
      const path = raw.split('?')[0].split('#')[0];
      return known(path) ? raw : null;
    },
    known: null, // filled in with the real known()
  },
  {
    name: 'a guard that refuses everything',
    safeNext: () => null,
    known: () => false,
  },
];

async function main() {
  const { safeNext, known, ROUTES } = await loadRoutes();

  if (process.argv.includes('--red-proof')) {
    let bad = 0;
    for (const w of WEAKENED) {
      console.log(`\n=== weakened guard: ${w.name} ===`);
      const guard = w.known === null ? raw => w.safeNext(raw, known) : w.safeNext;
      const k = w.known === null ? known : w.known;
      const { fail, failures } = runTable(guard, k, ROUTES, { quiet: true });
      for (const f of failures.slice(0, 4)) console.log('    caught:', f);
      console.log(fail > 0
        ? `RED-PROOF OK - the table produced ${fail} FAIL line(s)`
        : 'RED-PROOF FAILED - the table applauded a guard it should have caught');
      if (fail === 0) bad++;
    }
    console.log(bad === 0 ? '\nALL RED-PROOFS PASSED' : `\n${bad} RED-PROOF(S) FAILED`);
    process.exit(bad ? 1 : 0);
  }

  const { fail } = runTable(safeNext, known, ROUTES);
  if (fail > 0) {
    console.log('\nREAD THIS BEFORE TOUCHING THIS FILE. A FAIL here is a finding about');
    console.log('src/lib/routes.ts, not about the table. safeNext admitted something its own');
    console.log('docstring promises it will not. Fix known()/safeNext — normalise the path');
    console.log('before matching it — and do not widen a row here to make the line go green.');
  }
  console.log(fail === 0 ? '\nALL ROUTE CHECKS PASSED' : `\n${fail} ROUTE CHECKS FAILED`);
  process.exit(fail ? 1 : 0);
}

await main();
