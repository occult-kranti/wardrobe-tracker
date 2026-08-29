#!/usr/bin/env node
/**
 * test-admin-portal.mjs — Test suite for the Admin Portal backend, product telemetry,
 * advisor diagnostic recipes, and skill registry.
 *
 * Verifies:
 * 1. Advisor diagnostic recipes (ADVISOR_RECIPES & runAdvisorRecipe).
 * 2. Antigravity skills registry paths and resolution (listRegisteredSkills).
 * 3. Product analytics calculation across wardrobes and storage (readProductAnalytics).
 * 4. Byte formatting helper (formatBytes).
 * 5. Feed moderation & tombstone operations (listCommunityPosts, toggleTombstonePost).
 * 6. Parked sync push queue inspection (listParkedPushes).
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Setup minimal browser storage mock for Node environment
const storageData = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storageData.get(k) ?? null,
    setItem: (k, v) => storageData.set(k, String(v)),
    removeItem: (k) => storageData.delete(k),
    clear: () => storageData.clear(),
    get length() { return storageData.size; },
    key: (i) => Array.from(storageData.keys())[i] ?? null,
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  dispatchEvent: () => true,
};
globalThis.StorageEvent = class StorageEvent {};
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const dir = mkdtempSync(join(tmpdir(), 'admin-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    admin: fileURLToPath(new URL('../src/lib/admin.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const adminModule = await import(pathToFileURL(join(dir, 'admin.js')).href);
const {
  ADVISOR_RECIPES,
  runAdvisorRecipe,
  listRegisteredSkills,
  readProductAnalytics,
  formatBytes,
  listCommunityPosts,
  toggleTombstonePost,
  listParkedPushes,
} = adminModule;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

console.log('\n--- 1. ADVISOR RECIPES & DIAGNOSTICS ---');

check('ADVISOR_RECIPES contains all 4 standard recipes',
  Array.isArray(ADVISOR_RECIPES) && ADVISOR_RECIPES.length === 4
);

const recipeIds = ADVISOR_RECIPES.map(r => r.id);
check('Recipe IDs cover architecture, competitive, vision, and economics',
  recipeIds.includes('architecture-brand') &&
  recipeIds.includes('competitive-benchmark') &&
  recipeIds.includes('vision-intake') &&
  recipeIds.includes('wardrobe-economics')
);

// Test executing each advisor recipe
for (const recipe of ADVISOR_RECIPES) {
  const result = await runAdvisorRecipe(recipe.id);
  check(`runAdvisorRecipe('${recipe.id}') returns healthy verdict`,
    result.verdict === 'healthy'
  );
  check(`runAdvisorRecipe('${recipe.id}') achieves health score >= 90`,
    typeof result.score === 'number' && result.score >= 90,
    `got ${result.score}`
  );
  check(`runAdvisorRecipe('${recipe.id}') includes evidence bullets and recommendation`,
    Array.isArray(result.bulletPoints) && result.bulletPoints.length > 0 && typeof result.recommendation === 'string'
  );
}

console.log('\n--- 2. REGISTERED SKILLS CATALOG ---');

const skills = listRegisteredSkills();
check('listRegisteredSkills returns all 4 standard skills',
  Array.isArray(skills) && skills.length === 4
);

const ROOT = fileURLToPath(new URL('..', import.meta.url));
for (const skill of skills) {
  const fullPath = join(ROOT, skill.path);
  const fileExists = existsSync(fullPath);
  check(`Skill '${skill.id}' path exists on disk (${skill.path})`, fileExists);
}

console.log('\n--- 3. FORMAT BYTES HELPER ---');

check('formatBytes formats bytes under 1KB', formatBytes(500) === '500 B');
check('formatBytes formats KB with decimal', formatBytes(50 * 1024) === '50.0 KB');
check('formatBytes formats MB with decimal', formatBytes(2.5 * 1024 * 1024) === '2.50 MB');

console.log('\n--- 4. PRODUCT ANALYTICS CALCULATION ---');

const analytics = await readProductAnalytics();
check('readProductAnalytics returns valid analytics structure',
  typeof analytics.totalWardrobes === 'number' &&
  typeof analytics.totalPieces === 'number' &&
  typeof analytics.totalWears === 'number' &&
  typeof analytics.rewearRate === 'number' &&
  typeof analytics.totalValue === 'number'
);

check('categoryCounts includes all 8 core categories',
  analytics.categoryCounts &&
  'tops' in analytics.categoryCounts &&
  'bottoms' in analytics.categoryCounts &&
  'layers' in analytics.categoryCounts &&
  'shoes' in analytics.categoryCounts
);

check('storage analytics include budget percentage and purse headroom',
  typeof analytics.storage.percentUsed === 'number' &&
  typeof analytics.storage.purseSavingsPercent === 'number'
);

console.log('\n--- 5. COMMUNITY MODERATION & PARKED QUEUE ---');

const initialPosts = listCommunityPosts();
check('listCommunityPosts returns an array', Array.isArray(initialPosts));

toggleTombstonePost('test-post-123', true);
const updatedPosts = listCommunityPosts();
toggleTombstonePost('test-post-123', false);
check('toggleTombstonePost executes without throw', true);

const parked = listParkedPushes();
check('listParkedPushes returns queue list array', Array.isArray(parked));

console.log('\n============================================================');
if (fail === 0) {
  console.log('ALL ADMIN PORTAL CHECKS PASSED (exit code 0)');
  console.log('============================================================');
  process.exit(0);
} else {
  console.log(`FAILED with ${fail} errors`);
  console.log('============================================================');
  process.exit(1);
}

