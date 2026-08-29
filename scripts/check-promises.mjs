#!/usr/bin/env node
/**
 * check-promises.mjs — the gate that stops the repo lying about itself.
 *
 * "Local-first, forever. No accounts, no cloud sync, no telemetry." is
 * written, almost verbatim, in half a dozen documents this repo ships —
 * PLAN.md's non-negotiable #1, the README's front-page pitch, CLAUDE.md's
 * orientation, GEMINI.md's contract list, the public status page, the
 * alpha tester's own landing page. Every one of those was true the day it
 * was written. On 2026-08-28 the owner amended PLAN.md non-negotiable #1 to
 * admit one thing — an opt-in, consent-gated, revocable alpha usage record
 * (src/lib/usage.ts) — and from that moment every one of those documents
 * that still asserts the OLD, unqualified promise is not stale prose, it is
 * a lie a tester can read. A privacy promise is exactly the kind of claim
 * nobody re-verifies against the code before believing it; the whole value
 * of writing it down is that people stop checking. This check is what
 * re-checks it, on every run of verify, forever.
 *
 * WHERE IT LOOKS: every document this repo publishes or hands to a person —
 * the root *.md files, all of docs/**\/*.md, company/**\/*.html,
 * public/**\/*.html, and every .claude/skills/**\/SKILL.md. It is a WALK, not
 * a list, and that is the correction of 2026-08-28: the first version of this
 * file named eight files by hand, and the file it did not name was
 * docs/37-alpha-kit.md — the alpha kit, whose §3 is the consent note a tester
 * reads and agrees to in writing BEFORE day 0. It said "what the app collects:
 * nothing" and counted two exceptions where there are three, and this check
 * passed green over it, because a hardcoded list can only ever police the
 * documents somebody remembered. A privacy promise nobody re-verifies is
 * exactly the kind that gets copied into a ninth file next week, so the reach
 * has to be the tree.
 *
 * The one exclusion is docs/attic/, an archive of deleted code kept for
 * reference. Nothing there is published, nothing there is maintained, and
 * rewriting an archive to keep a linter quiet would falsify the record of what
 * this repo used to be. Missing directories are skipped, not failed — a doc
 * that does not exist cannot lie.
 *
 * WHEN IT IS ARMED: only once src/lib/usage.ts exists. Before that file
 * exists, "no telemetry" is simply true, and failing the build on it would
 * be a check inventing a problem rather than finding one — the same
 * discipline scripts/check-native-storage.mjs uses for a rule that has
 * nothing to police yet.
 *
 * THE HARD PART, AND THE WHOLE POINT OF THIS FILE: telling a document that
 * is LYING (still asserting the absolute promise) from a document that is
 * HONEST (correctly describing the amendment, or quoting the old promise
 * specifically to explain it changed). A sentence like "no telemetry" is
 * flagged unless the SAME general neighbourhood of text also names the
 * actual amendment — not just any nearby amendment, because this repo's
 * documents carry TWO unrelated 2026 amendments back to back (the 2026-08-18
 * optional-account-for-sync amendment, and the 2026-08-28 usage-record
 * amendment), and a naive "is the word 'amended' anywhere near here" check
 * would be fooled by the FIRST one while the promise about TELEMETRY
 * specifically is still being broken. PLAN.md is the concrete trap: its
 * non-negotiable #1 amendment note talks about accounts and sync — "Amended
 * 2026-08-18 ... an optional account is admitted ... Sync is opt-in per
 * wardrobe" — and then closes with "Telemetry stays banned.", stale and now
 * false, sitting one clause away from three separate honest-sounding words
 * ("Amended", "opt-in", "admitted"). A qualifier list of generic words like
 * "amended" or "opt-in" would be silently satisfied by the ACCOUNT
 * amendment and wave the false TELEMETRY sentence through. So the qualifier
 * patterns below are deliberately narrow and deliberately about the usage
 * record specifically: "usage record", "alpha usage", "opt-in usage",
 * "usage collector", "consent panel", "consent checkbox", "src/lib/usage",
 * "2026-08-28" (the actual date of THIS amendment, distinct from the
 * account amendment's 2026-08-18) — phrases a document can only be using if
 * it is actually talking about the thing that changed the promise, not
 * about the unrelated thing that changed two weeks earlier. Verified by
 * hand against every real match in this repo as of 2026-08-28 (see the
 * squad report); a --red-proof below proves the discrimination both ways —
 * it must catch a lie and it must NOT flag a sentence that correctly names
 * the amendment.
 *
 * WHAT IT DELIBERATELY DOES NOT FLAG: "nothing is sent anywhere you did not
 * send it" (README.md) is not, on its own, an absolute-telemetry pattern —
 * it is compatible with an opt-in record, where consenting IS the sending.
 * Adding a bare "nothing is sent" pattern would over-fire on legitimate
 * descriptions of the relay and the sync push, which also only send things
 * a person asked for. The patterns below only fire on phrases that name
 * telemetry/tracking/analytics/collection directly and negate them
 * absolutely — never on a generic "nothing leaves" sentence about something
 * else on the page.
 *
 * Usage:
 *   node scripts/check-promises.mjs              scan the real repo
 *   node scripts/check-promises.mjs --red-proof   prove the check bites,
 *                                                  and prove it does not
 *                                                  over-fire on an honest
 *                                                  amendment sentence
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const RED_PROOF = process.argv.includes('--red-proof');

/* ---------- the patterns: an absolute promise, and what rescues it ---------- */

/**
 * Each entry matches a specific, real phrasing of the old absolute promise.
 * Deliberately narrow rather than a single loose regex — a broad pattern
 * like /\bno\b.*\btelemetry\b/ would also match "no shame mechanics ...
 * telemetry stays banned" spanning unrelated clauses, and a check that
 * cannot tell where one promise ends and the next begins is not precise
 * enough to be trusted on documents this important.
 */
const OFFENSE_PATTERNS = [
  ['no telemetry', /\bno\s+telemetry\b/gi],
  ['no tracking (or telemetry)', /\bno\s+tracking\b(?:\s+or\s+telemetry\b)?/gi],
  ['no analytics', /\bno\s+analytics\b/gi],
  ['telemetry stays banned', /\btelemetry\s+stays\s+banned\b/gi],
  ['nothing is collected / tracked', /\bnothing\s+is\s+(?:collected|tracked)\b/gi],
  ['does not track / collect', /\bdoes(?:n't|\s+not)\s+(?:track|collect)\b/gi],
  ['reports nothing about you', /\breports?\s+nothing\s+about\s+you\b/gi],
];

/**
 * Phrases that, found within the SAME BLOCK as a match, mean the sentence is
 * correctly describing the 2026-08-28 amendment rather than still asserting
 * the old promise. Deliberately specific to THIS amendment (never a generic
 * "opt-in" or "amended", which the account-sync amendment of 2026-08-18 also
 * uses) — see the file header for the exact trap in PLAN.md this guards
 * against.
 */
const QUALIFIER = /usage record|alpha usage|opt-in usage|opt-in alpha|usage collector|consent-gated|consent panel|consent checkbox|revocable consent|src\/lib\/usage|2026-08-28/i;

/**
 * A "block" is the enclosing prose unit — a Markdown numbered-list item, an
 * HTML `<li>` or `<p>`, or a paragraph between blank lines — not a fixed
 * character count. A fixed window was tried first and it failed on real
 * copy: PLAN.md's non-negotiable #1, once correctly rewritten, states the
 * old promise, THEN explains in the following sentence that it is history,
 * THEN carries both amendments in full — and the specific words that prove
 * it (`2026-08-28`, `opt-in usage record`) land more than 550 characters
 * after "no telemetry", well outside any window small enough to stay
 * precise elsewhere. A block boundary follows the prose instead of guessing
 * its length: walk backward from the match to the nearest boundary marker,
 * forward to the next one, and search everything between. Opening markers
 * (`<li>`, `<p>`) bound the backward walk — they mark where a block BEGINS;
 * closing markers (`</li>`, `</p>`) bound the forward walk — they mark
 * where it ENDS. Capped at a few thousand characters each way so a
 * boundary-free file (no blank lines at all) cannot make this scan
 * unbounded.
 */
const FORWARD_BOUNDARY = /\n\s*\n|\n\d+\.\s|<\/li>|<\/p>/g;
const BACKWARD_BOUNDARY = /\n\s*\n|\n\d+\.\s|<li[ >]|<p[ >]/g;
const FORWARD_CAP = 4000;
const BACKWARD_CAP = 600;

function blockAround(text, matchStart, matchEnd) {
  const backSlice = text.slice(Math.max(0, matchStart - BACKWARD_CAP), matchStart);
  BACKWARD_BOUNDARY.lastIndex = 0;
  let lastBoundary = -1;
  let bm;
  while ((bm = BACKWARD_BOUNDARY.exec(backSlice)) !== null) lastBoundary = bm.index + bm[0].length;
  const blockStart = lastBoundary >= 0
    ? Math.max(0, matchStart - BACKWARD_CAP) + lastBoundary
    : Math.max(0, matchStart - BACKWARD_CAP);

  const forwardSlice = text.slice(matchEnd, Math.min(text.length, matchEnd + FORWARD_CAP));
  FORWARD_BOUNDARY.lastIndex = 0;
  const fm = FORWARD_BOUNDARY.exec(forwardSlice);
  const blockEnd = fm ? matchEnd + fm.index : Math.min(text.length, matchEnd + FORWARD_CAP);

  return text.slice(blockStart, blockEnd);
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * THE SUPERSEDED-RECORD BANNER, AND WHY A WHOLE-FILE ESCAPE IS THE HONEST ONE.
 *
 * `docs/NN-*.md` are DATED DECISION RECORDS. docs/28 argues a business case in
 * October's words; docs/29 weighs strategies; docs/33 and docs/34 are plans
 * written before this amendment existed. Every one of them says "no telemetry"
 * because that was true, and was the whole point, when it was written.
 *
 * There are two wrong ways to handle that and one right one.
 *
 *   Rewriting the sentences is FALSIFYING THE RECORD. A decision log whose past
 *   entries are edited to agree with the present is worth nothing — you can no
 *   longer tell what was believed when, which is the only reason to keep one.
 *   This repo already knows this: HANDOFF.md keeps its resolved push-blocker
 *   note and says out loud that a stale blocker is worse than no note.
 *
 *   Exempting docs/ wholesale is the other failure: the promise would then be
 *   live and unqualified in a dozen files nothing checks.
 *
 * So: a dated record may keep its historical prose IF it carries a banner near
 * the top saying the promise was superseded and pointing at the document that
 * now describes what is collected. The banner is the qualifier, applied to the
 * whole file rather than to a paragraph, because the thing being qualified is
 * the file's age and not any one sentence.
 *
 * This escape is deliberately NOT available to PLAN.md, README.md, CLAUDE.md,
 * AGENTS.md, GEMINI.md, company/**, public/** or the skills. Those are LIVING
 * documents — a tester or a contributor reads them as current — and they must
 * be corrected in the body, which they have been.
 */
const SUPERSEDED_BANNER = /superseded[^\n]{0,120}(2026-08-28|usage record|docs\/45)/i;

/** Only a dated record under docs/ may be qualified by a banner. */
function bannerMayApply(relPath) {
  return /^docs\/\d+-/.test(relPath.split('\\').join('/'));
}

/** Is the banner present in the file's opening — where a reader would meet it? */
function carriesBanner(text) {
  return SUPERSEDED_BANNER.test(text.split('\n').slice(0, 40).join('\n'));
}

/**
 * Scan one file's text and return every unqualified promise found. Each
 * hit carries the pattern name, the line, and a snippet — enough for a
 * report to be acted on without re-opening the file to find the sentence.
 */
function scanText(text) {
  const hits = [];
  for (const [name, re] of OFFENSE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const block = blockAround(text, m.index, m.index + m[0].length);
      if (QUALIFIER.test(block)) continue; // honestly describes the amendment
      hits.push({
        pattern: name,
        line: lineOf(text, m.index),
        snippet: text.slice(Math.max(0, m.index - 40), Math.min(text.length, m.index + m[0].length + 40)).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return hits;
}

/* ---------- the run itself ---------- */

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

function runScan(root, { quiet = false } = {}) {
  const usagePath = path.join(root, 'src', 'lib', 'usage.ts');
  const armed = existsSync(usagePath);
  if (!armed) {
    if (!quiet) console.log(`PASS - src/lib/usage.ts does not exist at ${root}, so "no telemetry" is still simply true — the guard is not armed yet`);
    return { armed: false, failures: [] };
  }

  const failures = [];
  const scanned = docFilesUnder(root);
  let clean = 0;
  for (const abs of scanned) {
    if (!existsSync(abs)) continue;
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch (err) {
      // A file that cannot be read is reported, never silently skipped: a
      // scan that quietly drops documents is the failure mode this whole
      // rewrite exists to end.
      if (!quiet) console.log(`FAIL - ${path.relative(root, abs)} could not be read (${err.code ?? err.message})`);
      failures.push({ file: path.relative(root, abs).split(path.sep).join('/'), pattern: 'unreadable', line: 0, snippet: String(err.message) });
      continue;
    }
    const rel = path.relative(root, abs).split(path.sep).join('/');
    // A dated record that declares itself superseded keeps its historical
    // prose. See SUPERSEDED_BANNER above for why this is a whole-file escape
    // and why only docs/NN-*.md may use it.
    if (bannerMayApply(rel) && carriesBanner(text)) {
      clean++;
      continue;
    }
    const hits = scanText(text);
    if (hits.length === 0) {
      clean++;
      continue;
    }
    for (const hit of hits) {
      failures.push({ file: rel, ...hit });
      if (!quiet) {
        console.log(
          `FAIL - ${rel}:${hit.line} still asserts an unqualified promise ("${hit.pattern}") — ` +
          `"…${hit.snippet}…" — but src/lib/usage.ts now exists, so this is no longer true`
        );
      }
    }
  }
  // One line for the clean majority, rather than sixty PASS lines that bury
  // the handful of FAILs somebody actually has to act on.
  if (!quiet) {
    console.log(
      `PASS - ${clean} of ${scanned.length} scanned document(s) carry no unqualified ` +
      `"no telemetry" style promise`
    );
  }
  return { armed: true, failures };
}

/**
 * Walk `dir` and return every file whose basename `accept`s, sorted so two
 * runs on the same tree report in the same order. A directory that does not
 * exist yields nothing rather than throwing: this check runs against fixture
 * trees in --red-proof that have no docs/ or company/ at all.
 */
function walkFiles(dir, accept, { recurse = true, skipDir = () => false } = {}) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recurse && !skipDir(abs)) found.push(...walkFiles(abs, accept, { recurse, skipDir }));
    } else if (entry.isFile() && accept(entry.name)) {
      found.push(abs);
    }
  }
  return found;
}

/**
 * Every document that can carry the promise to a reader. See the header for
 * why this is a walk rather than the list of eight files it replaced, and why
 * docs/attic/ — an archive of deleted code, published nowhere — is the single
 * directory held out of it.
 */
function docFilesUnder(root) {
  const isMarkdown = (name) => name.endsWith('.md');
  const isHtml = (name) => name.endsWith('.html');
  const attic = path.join(root, 'docs', 'attic');
  return [
    ...walkFiles(root, isMarkdown, { recurse: false }),
    ...walkFiles(path.join(root, 'docs'), isMarkdown, { skipDir: (abs) => abs === attic }),
    ...walkFiles(path.join(root, 'company'), isHtml),
    ...walkFiles(path.join(root, 'public'), isHtml),
    ...walkFiles(path.join(root, '.claude', 'skills'), (name) => name === 'SKILL.md'),
  ];
}

/* ---------- --red-proof: prove the guard catches a lie, and does not invent one ----------
   Two fabricated trees in the system temp directory, never inside this
   repo (several squads are editing it at once; a fixture dropped into the
   real tree is a worse bug than the one being proven). Fixture A carries a
   src/lib/usage.ts (so the guard is armed) and a document with the stale,
   unqualified promise — the guard must fail it. Fixture B is armed the same
   way but its document correctly names the amendment (the actual qualifier
   phrases) right next to the old promise — the guard must NOT fail it,
   because flagging an honestly-updated document would train people to
   silence the check instead of trusting it. */
/** Write `content` to root/relPath, creating parent directories first. */
function writeFixture(root, relPath, content) {
  const abs = path.join(root, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function runRedProof() {
  let bad = 0;

  const lyingRoot = mkdtempSync(path.join(tmpdir(), 'promises-red-lie-'));
  writeFixture(lyingRoot, path.join('src', 'lib', 'usage.ts'), 'export const EVENT_NAMES = [];\n');
  writeFixture(
    lyingRoot,
    'PLAN.md',
    [
      '# TOILE — Project Plan',
      '',
      '## Non-negotiables',
      '',
      '1. **Local-first, forever.** No accounts, no cloud sync, no telemetry.',
      '   *(Amended 2026-08-18 by owner direction: an optional account is admitted,',
      '   and sync is opt-in per wardrobe and off by default. Telemetry stays banned.)*',
      '',
    ].join('\n')
  );
  console.log('\n=== red-proof fixture: an armed repo whose PLAN.md still asserts the old absolute promise ===');
  const lyingResult = runScan(lyingRoot, { quiet: true });
  const caughtTheLie = lyingResult.armed && lyingResult.failures.length > 0
    && lyingResult.failures.some((f) => f.file === 'PLAN.md');
  for (const f of lyingResult.failures) console.log(`    caught: ${f.file}:${f.line} (${f.pattern})`);
  console.log(caughtTheLie
    ? 'RED-PROOF OK — the stale, unqualified promise in PLAN.md was caught'
    : 'RED-PROOF FAILED — the stale promise in PLAN.md was NOT caught');
  if (!caughtTheLie) bad++;
  rmSync(lyingRoot, { recursive: true, force: true });

  const honestRoot = mkdtempSync(path.join(tmpdir(), 'promises-red-honest-'));
  writeFixture(honestRoot, path.join('src', 'lib', 'usage.ts'), 'export const EVENT_NAMES = [];\n');
  writeFixture(
    honestRoot,
    'PLAN.md',
    [
      '# TOILE — Project Plan',
      '',
      '## Non-negotiables',
      '',
      '1. **Local-first, forever.** No accounts, no cloud sync, no telemetry beyond an',
      '   opt-in alpha usage record (amended 2026-08-28; see docs/35 and src/lib/usage.ts).',
      '   The record is consent-gated behind a consent panel and revocable at any time.',
      '',
    ].join('\n')
  );
  console.log('\n=== red-proof fixture: an armed repo whose PLAN.md correctly names the amendment ===');
  const honestResult = runScan(honestRoot, { quiet: true });
  const wronglyFlagged = honestResult.failures.some((f) => f.file === 'PLAN.md');
  for (const f of honestResult.failures) console.log(`    wrongly caught: ${f.file}:${f.line} (${f.pattern})`);
  console.log(!wronglyFlagged
    ? 'RED-PROOF OK — the honestly-amended sentence was NOT flagged'
    : 'RED-PROOF FAILED — an honest, correctly-qualified sentence was flagged as a lie');
  if (wronglyFlagged) bad++;
  rmSync(honestRoot, { recursive: true, force: true });

  console.log(bad === 0 ? '\nALL RED-PROOFS PASSED' : `\n${bad} RED-PROOF(S) FAILED`);
  process.exit(bad ? 1 : 0);
}

/* ---------- entry ---------- */

if (RED_PROOF) {
  runRedProof();
} else {
  const { failures, armed } = runScan(ROOT);
  check(
    'no document asserts the old, unqualified "no telemetry" promise now that src/lib/usage.ts exists',
    !armed || failures.length === 0,
    failures.length ? `${failures.length} unqualified promise(s) found — see FAIL lines above` : (armed ? `${docFilesUnder(ROOT).length} document(s) scanned` : 'guard not yet armed')
  );
  console.log('');
  if (fail) {
    console.log(`check:promises: ${fail} failure(s) — the repo is asserting a promise the code no longer keeps`);
    process.exit(1);
  }
  console.log('check:promises: every scanned document is honest about the alpha usage record');
}
