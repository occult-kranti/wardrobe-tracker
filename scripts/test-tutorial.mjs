#!/usr/bin/env node
/**
 * test-tutorial.mjs — Test suite for tutorial and walkthrough states
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';

// Setup mock for localStorage before importing any modules that use it
globalThis.window = {
  localStorage: (() => {
    let store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value.toString(); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; },
    };
  })()
};

const dir = mkdtempSync(join(tmpdir(), 'tutorial-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    tutorial: fileURLToPath(new URL('../src/lib/tutorial.ts', import.meta.url)),
    tutorials: fileURLToPath(new URL('../src/lib/tutorials.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const tutorialModule = await import(pathToFileURL(join(dir, 'tutorial.js')).href);
const { tourState, markTourDone, requestTour } = tutorialModule;

const tutorialsModule = await import(pathToFileURL(join(dir, 'tutorials.js')).href);
const { tutorialFor, tutorialPaths } = tutorialsModule;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

console.log('\n--- 1. TOUR STATE MACHINE ---');

// Fresh start
globalThis.window.localStorage.clear();
check('Initial tourState is "new"', tourState() === 'new');

markTourDone();
check('After markTourDone, tourState is "done"', tourState() === 'done');

requestTour();
check('After requestTour, tourState is "again"', tourState() === 'again');

markTourDone();
check('After markTourDone again, tourState is "done"', tourState() === 'done');

// LocalStorage unavailable simulates silent failure
const realLocalStorage = globalThis.window.localStorage;
globalThis.window.localStorage = {
  getItem: () => { throw new Error('Denied'); },
  setItem: () => { throw new Error('Denied'); }
};

check('When localStorage throws, tourState fails silently to "done" (do not nag)', tourState() === 'done');

// Restore
globalThis.window.localStorage = realLocalStorage;

console.log('\n--- 2. WALKTHROUGHS 5-STEP CEILING INVARIANT ---');

const paths = tutorialPaths();
check('Has registered tutorial paths', paths.length > 0);

let maxExceeded = false;
for (const p of paths) {
  const t = tutorialFor(p);
  if (t && t.steps.length > 5) {
    maxExceeded = true;
    check(`Tutorial for ${p} exceeds 5 steps (has ${t.steps.length})`, false);
  }
}

if (!maxExceeded) {
  check('All tutorials obey the 5-step ceiling invariant', true);
}

console.log('\n============================================================');
if (fail === 0) {
  console.log('ALL TUTORIAL CHECKS PASSED (exit code 0)');
} else {
  console.log(`${fail} TUTORIAL CHECK(S) FAILED`);
}
console.log('============================================================\n');

process.exit(fail ? 1 : 0);
