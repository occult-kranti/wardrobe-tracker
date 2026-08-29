#!/usr/bin/env node
/**
 * THE PORTAL IS NOT PUBLISHED, AND THIS IS WHAT MAKES THAT TRUE RATHER THAN
 * MERELY CURRENTLY THE CASE.
 *
 * Owner's ruling, 2026-08-28: the project-lead board stays on the owner's own
 * machine. It is not deployed.
 *
 * Today that holds by omission — .github/workflows/deploy.yml runs `npm run
 * build`, which builds only index.html, and never runs `build:portal`. Omission
 * is a weak guarantee. `deploy.yml` force-pushes the WHOLE of dist/ to
 * gh-pages, so anything that lands in dist/ ships; and the board's only lock is
 * one static ADMIN_TOKEN with no rotation, behind an endpoint whose CORS is
 * open. One helpful line in a workflow file, or one `npm run build:portal`
 * before a deploy on somebody's laptop, publishes an admin dashboard to the
 * open web. Nothing in the build would have said a word.
 *
 * So this check states the rule and enforces it, and it enforces TWO things
 * that are easy to confuse:
 *
 *   1. THE BOARD IS NOT IN THE SHIPPED BUILD. dist/ carries no portal.html and
 *      no dist/portal/ directory. (dist/portal is where `build:portal` writes,
 *      and `npm run build` empties dist/ — so in the normal order it is already
 *      gone. This catches the abnormal order.)
 *
 *   2. THE CONSUMER APP CARRIES NONE OF THE OPERATOR'S TOOLING. No chunk of
 *      the shipped bundle mentions the stats endpoint, the admin token key, or
 *      the admin header. This is the stronger and more interesting half: it is
 *      how we know the split is real rather than cosmetic. If somebody ever
 *      imports the portal's stats client from a page — the obvious "reuse" —
 *      the app would start shipping the operator's plumbing to fifty testers,
 *      and this is the line that stops it.
 *
 * It is deliberately NOT a check that the portal builds. The portal has its own
 * suite (scripts/test-portal.mjs) for that.
 *
 * Usage:
 *   node scripts/check-portal-not-shipped.mjs              check dist/
 *   node scripts/check-portal-not-shipped.mjs --red-proof  prove the check bites
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RED_PROOF = process.argv.includes('--red-proof');

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

/** Strings that belong to the operator's board and must never ship to a tester. */
const OPERATOR_MARKERS = [
  'functions/v1/admin-stats',
  'almari-admin-token',
  'x-admin-token',
];

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * The whole check, against one built directory. Returns the failure list so the
 * red-proof can run it over a deliberately poisoned copy and require hits.
 */
function inspect(distDir) {
  const problems = [];

  if (existsSync(join(distDir, 'portal.html'))) {
    problems.push('portal.html is in the build — the board would be published');
  }
  if (existsSync(join(distDir, 'portal'))) {
    problems.push('dist/portal/ is in the build — the board would be published');
  }

  const files = existsSync(distDir) ? walk(distDir) : [];
  const shipped = files.filter(f => /\.(js|css|html)$/.test(f));
  for (const file of shipped) {
    // The service worker names every emitted file; a portal chunk would show up
    // there first, and its own precache list is the loudest possible tell.
    const text = readFileSync(file, 'utf8');
    for (const marker of OPERATOR_MARKERS) {
      if (text.includes(marker)) {
        problems.push(`${relative(distDir, file).split('\\').join('/')} carries "${marker}"`);
      }
    }
  }

  return { problems, scanned: shipped.length };
}

/* ---------------- the real run ---------------- */

const dist = join(ROOT, 'dist');

if (!existsSync(dist)) {
  console.log('SKIP - there is no dist/ to inspect. Run `npm run build` first.');
  console.log('       This check is about what a deploy would carry, so with no build there is nothing to say.');
  process.exit(0);
}

const { problems, scanned } = inspect(dist);

check('the shipped build carries no portal entry point', !problems.some(p => p.includes('published')),
  problems.filter(p => p.includes('published')).join('; '));
check('no shipped chunk carries the operator\'s tooling', !problems.some(p => p.includes('carries')),
  problems.filter(p => p.includes('carries')).slice(0, 3).join('; '));
check('there was actually something to scan', scanned > 0, `${scanned} files`);

/* ---------------- the red-proof ---------------- */

if (RED_PROOF) {
  console.log('');
  console.log('=== red-proof: a build with the board and its tooling planted in it ===');
  const decoy = mkdtempSync(join(tmpdir(), 'portal-ship-'));
  try {
    mkdirSync(join(decoy, 'assets'), { recursive: true });
    writeFileSync(join(decoy, 'index.html'), '<!doctype html><title>app</title>');
    writeFileSync(join(decoy, 'portal.html'), '<!doctype html><title>board</title>');
    mkdirSync(join(decoy, 'portal'), { recursive: true });
    writeFileSync(
      join(decoy, 'assets', 'index-deadbeef.js'),
      'const E="https://example.supabase.co/functions/v1/admin-stats";sessionStorage.getItem("almari-admin-token");',
    );

    const { problems: caught } = inspect(decoy);
    const sawEntry = caught.some(p => p.includes('portal.html'));
    const sawDir = caught.some(p => p.includes('dist/portal/'));
    const sawTooling = caught.some(p => p.includes('admin-stats')) && caught.some(p => p.includes('almari-admin-token'));

    check('red-proof: the planted portal entry is caught', sawEntry);
    check('red-proof: the planted portal directory is caught', sawDir);
    check('red-proof: the planted operator tooling is caught', sawTooling, `${caught.length} problems`);
  } finally {
    rmSync(decoy, { recursive: true, force: true });
  }
}

console.log('');
console.log(
  failed === 0
    ? 'the board stays on the owner\'s machine: nothing in the build would publish it'
    : `${failed} failed — a deploy from this build would ship the operator's board`,
);
process.exit(failed === 0 ? 0 : 1);
