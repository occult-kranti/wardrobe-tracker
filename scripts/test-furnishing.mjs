#!/usr/bin/env node
/**
 * test-furnishing.mjs — Test suite for wardrobe furnishing heuristics
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const dir = mkdtempSync(join(tmpdir(), 'furnish-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    furnishing: fileURLToPath(new URL('../src/lib/furnishing.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const furnishingModule = await import(pathToFileURL(join(dir, 'furnishing.js')).href);
const { furnish } = furnishingModule;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

console.log('\n--- 1. FURNISHING HEURISTICS ---');

// We test affinityOf and slotWants indirectly by generating a specific wardrobe
// and seeing what furniture gets generated and where items are placed.
// Alternatively, we could extract the functions via RegExp, but testing through `furnish`
// tests the whole pipeline.

const makeItems = (specs) => {
  let id = 1;
  const items = [];
  for (const [category, count] of Object.entries(specs)) {
    for (let i = 0; i < count; i++) {
      items.push({ id: `item-${id++}`, category, retired: false });
    }
  }
  return items;
};

// 1. A small wardrobe (under 20 items)
const smallWardrobe = makeItems({
  'shirt': 5,
  'jeans': 3,
  'shoes': 3,
}); // 11 items
const smallRes = furnish('seed-small', smallWardrobe, '2026-01-01');

check('Small wardrobe (<20 items) creates hooks, shelves, and a rack (if >=2 shoes)',
  smallRes.furniture.some(f => f.form === 'hooks') &&
  smallRes.furniture.some(f => f.form === 'shelves') &&
  smallRes.furniture.some(f => f.form === 'rack')
);

// 2. A large wardrobe (>= 20 items) triggers almirah and other threshold logic
const largeWardrobe = makeItems({
  'shirt': 10,
  'sweater': 5, // hanging
  'jeans': 8, // folded
  'necklace': 15, // jewellery (needs stand and box)
  'boots': 5, // shoes
  'belt': 3, // bags
}); // 46 items

const largeRes1 = furnish('seed-large1', largeWardrobe, '2026-01-01');
const largeRes2 = furnish('seed-large1', largeWardrobe, '2026-01-01');
const largeResDiff = furnish('seed-large2', largeWardrobe, '2026-01-01');

check('Deterministic placement: Same seed produces same exact furniture layout',
  JSON.stringify(largeRes1.furniture) === JSON.stringify(largeRes2.furniture)
);

check('Deterministic placement: Same seed places items exactly the same',
  JSON.stringify(largeRes1.items) === JSON.stringify(largeRes2.items)
);

check('Different seed produces different layout/distribution',
  JSON.stringify(largeRes1.furniture) !== JSON.stringify(largeResDiff.furniture) ||
  JSON.stringify(largeRes1.items) !== JSON.stringify(largeResDiff.items)
);

// Verify specific furniture types in large wardrobe
const forms = largeRes1.furniture.map(f => f.form);
check('Large wardrobe contains an almirah variant',
  forms.includes('almirah') || forms.includes('almirah-carved') || forms.includes('almirah-fitted')
);
check('Large wardrobe with 15 jewellery has a stand AND a box',
  forms.includes('stand') && forms.includes('box')
);
check('Large wardrobe with 5 shoes has a rack',
  forms.includes('rack')
);
check('Large wardrobe with 15 hanging items has a rail',
  forms.includes('rail')
);

// Source pinning for exact affinity regexes (since we can't test them directly)
const furnishingSource = readFileSync(
  new URL('../src/lib/furnishing.ts', import.meta.url),
  'utf8'
);

check('furnishing.ts categorises shoes correctly',
  furnishingSource.includes('/shoe|boot|sneaker|sandal|footwear/.test(c)'),
  'shoe regex mismatch'
);
check('furnishing.ts categorises jewellery correctly',
  furnishingSource.includes('/jewel|bangle|ring|earring|necklace/.test(c)'),
  'jewellery regex mismatch'
);
check('furnishing.ts categorises bags correctly',
  furnishingSource.includes('/access|bag|belt|scarf|hat/.test(c)'),
  'bags regex mismatch'
);

console.log('\n============================================================');
if (fail === 0) {
  console.log('ALL FURNISHING CHECKS PASSED (exit code 0)');
} else {
  console.log(`${fail} FURNISHING CHECK(S) FAILED`);
}
console.log('============================================================\n');

process.exit(fail ? 1 : 0);
