#!/usr/bin/env node
/** Consumer isolation gate, retained command name for existing automation.
 * Owner authorized a public /portal/ shell on 2026-09-07. It is built into
 * dist-portal and copied only AFTER this gate and the consumer precache build.
 * This check continues to reject operator modules in the consumer artifact.
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
  'functions/v1/admin-ai',
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
    ? 'consumer artifact is isolated from the separately published operator shell'
    : `${failed} failed — a deploy from this build would ship the operator's board`,
);
process.exit(failed === 0 ? 0 : 1);
