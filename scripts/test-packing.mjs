#!/usr/bin/env node
/**
 * test-packing.mjs — Test suite for Packing List modal logic:
 *
 * 1. Capsule Density Math:
 *    - (itemCount / Math.max(days, 1)).toFixed(1) across trip lengths (2d, 3d, 5d, 7d, 14d)
 *    - Zero-day and negative-day guards, zero-item capsules, single-item capsules.
 * 2. Text Export Generation:
 *    - Header formatting: PACKING LIST (${days} days · ${count} pieces)
 *    - Item row formatting: [x] <Name> (<Category>) for packed, [ ] <Name> (<Category>) for unpacked
 *    - Category label resolution with default and custom category dictionaries
 *    - 40-character divider rules and 'Packed with Almari' signature
 *    - Empty selection guard
 * 3. Item Search Filter Behavior:
 *    - Case-insensitive substring matching against item name
 *    - Brand matching (with safe handling of undefined/empty brands)
 *    - Category label matching via categoryLabel(settings, item.category)
 *    - Query trimming and whitespace normalization
 *    - Non-matching and multiple-matching filter results
 * 4. Component Contract Pinning:
 *    - Asserts src/components/PackingListModal.tsx preserves the density formula,
 *      divider width, signature line, preset trip lengths, and search predicates.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const dir = mkdtempSync(join(tmpdir(), 'packing-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const types = await import(pathToFileURL(join(dir, 'types.js')).href);
const { categoryLabel, DEFAULT_CATEGORIES } = types;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

// Mock settings fixtures
const standardSettings = {
  categories: DEFAULT_CATEGORIES ?? [
    { id: 'tops', label: 'Tops' },
    { id: 'bottoms', label: 'Bottoms' },
    { id: 'dresses', label: 'Dresses & Jumpsuits' },
    { id: 'outerwear', label: 'Outerwear' },
    { id: 'shoes', label: 'Shoes' },
    { id: 'accessories', label: 'Accessories' },
  ],
};

const customSettings = {
  categories: [
    { id: 'tops', label: 'Tops' },
    { id: 'bottoms', label: 'Trousers & Skirts' },
    { id: 'ethnic', label: 'Kurta & Sarees' },
    { id: 'outerwear', label: 'Jackets & Coats' },
    { id: 'shoes', label: 'Footwear' },
    { id: 'accessories', label: 'Jewellery & Stoles' },
  ],
};

/* ==========================================================================
   1. CAPSULE DENSITY CALCULATION TESTS
   ========================================================================== */
console.log('\n--- 1. CAPSULE DENSITY MATH ---');

/** Density math as implemented in PackingListModal.tsx */
function calculateCapsuleDensity(itemCount, tripDays) {
  return (itemCount / Math.max(tripDays, 1)).toFixed(1);
}

function formatCapsuleDensity(itemCount, tripDays) {
  return `Capsule density: ${calculateCapsuleDensity(itemCount, tripDays)} pieces / day`;
}

// Standard trip lengths defined in UI: [2, 3, 5, 7, 14]
const PRESET_TRIP_DAYS = [2, 3, 5, 7, 14];

// Test case table: [itemCount, days, expectedDensity]
const DENSITY_TEST_CASES = [
  // 10-item wardrobe across preset durations
  [10, 2, '5.0'],
  [10, 3, '3.3'],
  [10, 5, '2.0'],
  [10, 7, '1.4'],
  [10, 14, '0.7'],

  // 4-item minimalist capsule
  [4, 2, '2.0'],
  [4, 3, '1.3'],
  [4, 5, '0.8'],
  [4, 7, '0.6'],
  [4, 14, '0.3'],

  // 1-item single piece
  [1, 1, '1.0'],
  [1, 2, '0.5'],
  [1, 3, '0.3'],
  [1, 7, '0.1'],
  [1, 14, '0.1'],

  // 21-item comprehensive travel capsule
  [21, 2, '10.5'],
  [21, 3, '7.0'],
  [21, 5, '4.2'],
  [21, 7, '3.0'],
  [21, 14, '1.5'],

  // Zero items
  [0, 3, '0.0'],
  [0, 7, '0.0'],
  [0, 14, '0.0'],
];

for (const [items, days, expected] of DENSITY_TEST_CASES) {
  const got = calculateCapsuleDensity(items, days);
  check(
    `density for ${items} items over ${days}d is ${expected}`,
    got === expected,
    `got ${got}, expected ${expected}`
  );
}

// Edge case: division by zero guard via Math.max(days, 1)
check('0 days is guarded by Math.max(days, 1) to treat as 1 day',
  calculateCapsuleDensity(6, 0) === '6.0',
  `got ${calculateCapsuleDensity(6, 0)}`
);

check('negative days are guarded to 1 day',
  calculateCapsuleDensity(8, -5) === '8.0',
  `got ${calculateCapsuleDensity(8, -5)}`
);

// Formatted string output check
check('formatCapsuleDensity matches UI template string',
  formatCapsuleDensity(12, 3) === 'Capsule density: 4.0 pieces / day',
  `got "${formatCapsuleDensity(12, 3)}"`
);

/* ==========================================================================
   2. PACKING LIST TEXT EXPORT GENERATION TESTS
   ========================================================================== */
console.log('\n--- 2. PACKING LIST TEXT EXPORT ---');

/** Text export generator matching PackingListModal.tsx copyAsText logic */
function buildPackingListExportText(tripDays, selectedItems, packedIds, settings) {
  if (!selectedItems || selectedItems.length === 0) return null;
  const lines = [
    `PACKING LIST (${tripDays} days · ${selectedItems.length} pieces)`,
    '----------------------------------------',
    ...selectedItems.map(
      i => `[${packedIds.has(i.id) ? 'x' : ' '}] ${i.name} (${categoryLabel(settings, i.category)})`
    ),
    '----------------------------------------',
    'Packed with Almari',
  ];
  return lines.join('\n');
}

const sampleItems = [
  { id: 'item-1', name: 'White Linen Shirt', category: 'tops', brand: 'Muji' },
  { id: 'item-2', name: 'Raw Indigo Selvedge Denim', category: 'bottoms', brand: 'Nudie' },
  { id: 'item-3', name: 'Merino Wool Cardigan', category: 'outerwear', brand: 'Uniqlo' },
  { id: 'item-4', name: 'Tussar Silk Kurta', category: 'ethnic', brand: 'FabIndia' },
  { id: 'item-5', name: 'Leather Chelsea Boots', category: 'shoes', brand: 'Blundstone' },
];

// Test empty selectedItems guard
check('empty selection returns null (no export generated)',
  buildPackingListExportText(3, [], new Set(), standardSettings) === null
);

// Test all unpacked items
const allUnpackedSet = new Set();
const exportUnpacked = buildPackingListExportText(3, sampleItems.slice(0, 3), allUnpackedSet, standardSettings);
const expectedUnpacked = [
  'PACKING LIST (3 days · 3 pieces)',
  '----------------------------------------',
  '[ ] White Linen Shirt (Tops)',
  '[ ] Raw Indigo Selvedge Denim (Bottoms)',
  '[ ] Merino Wool Cardigan (Outerwear)',
  '----------------------------------------',
  'Packed with Almari',
].join('\n');

check('export with all items unpacked formats correct [ ] checkmarks',
  exportUnpacked === expectedUnpacked,
  `got:\n${exportUnpacked}`
);

// Test all packed items
const allPackedSet = new Set(['item-1', 'item-2', 'item-3']);
const exportPacked = buildPackingListExportText(5, sampleItems.slice(0, 3), allPackedSet, standardSettings);
const expectedPacked = [
  'PACKING LIST (5 days · 3 pieces)',
  '----------------------------------------',
  '[x] White Linen Shirt (Tops)',
  '[x] Raw Indigo Selvedge Denim (Bottoms)',
  '[x] Merino Wool Cardigan (Outerwear)',
  '----------------------------------------',
  'Packed with Almari',
].join('\n');

check('export with all items packed formats correct [x] checkmarks',
  exportPacked === expectedPacked,
  `got:\n${exportPacked}`
);

// Test mixed packed/unpacked state
const mixedPackedSet = new Set(['item-1', 'item-3']);
const exportMixed = buildPackingListExportText(7, sampleItems.slice(0, 3), mixedPackedSet, standardSettings);
const expectedMixed = [
  'PACKING LIST (7 days · 3 pieces)',
  '----------------------------------------',
  '[x] White Linen Shirt (Tops)',
  '[ ] Raw Indigo Selvedge Denim (Bottoms)',
  '[x] Merino Wool Cardigan (Outerwear)',
  '----------------------------------------',
  'Packed with Almari',
].join('\n');

check('export with mixed status toggles [x] and [ ] precisely per item',
  exportMixed === expectedMixed,
  `got:\n${exportMixed}`
);

// Test custom category labels
const exportCustom = buildPackingListExportText(14, [sampleItems[1], sampleItems[3]], new Set(['item-4']), customSettings);
const expectedCustom = [
  'PACKING LIST (14 days · 2 pieces)',
  '----------------------------------------',
  '[ ] Raw Indigo Selvedge Denim (Trousers & Skirts)',
  '[x] Tussar Silk Kurta (Kurta & Sarees)',
  '----------------------------------------',
  'Packed with Almari',
].join('\n');

check('export resolves custom category labels from settings',
  exportCustom === expectedCustom,
  `got:\n${exportCustom}`
);

// Test fallback for unmapped category ID
const unmappedItem = [{ id: 'item-99', name: 'Vintage Scarf', category: 'vintage-acc' }];
const exportFallback = buildPackingListExportText(2, unmappedItem, new Set(), standardSettings);
const expectedFallback = [
  'PACKING LIST (2 days · 1 pieces)',
  '----------------------------------------',
  '[ ] Vintage Scarf (vintage-acc)',
  '----------------------------------------',
  'Packed with Almari',
].join('\n');

check('export falls back to raw category ID when category is not in settings dictionary',
  exportFallback === expectedFallback,
  `got:\n${exportFallback}`
);

// Verify exact structural properties:
// - Header: 'PACKING LIST (${days} days · ${count} pieces)'
// - Divider rule: exactly 40 '-' characters
// - Signature: exactly 'Packed with Almari'
// - Total line count: count + 4
if (exportMixed) {
  const lines = exportMixed.split('\n');
  check('export header matches regex /PACKING LIST \\(\\d+ days · \\d+ pieces\\)/',
    /^PACKING LIST \(\d+ days · \d+ pieces\)$/.test(lines[0]),
    lines[0]
  );
  check('top divider is exactly 40 hyphens',
    lines[1] === '----------------------------------------' && lines[1].length === 40,
    `length ${lines[1]?.length}`
  );
  check('bottom divider is exactly 40 hyphens',
    lines[lines.length - 2] === '----------------------------------------' && lines[lines.length - 2].length === 40,
    `length ${lines[lines.length - 2]?.length}`
  );
  check('signature line is "Packed with Almari"',
    lines[lines.length - 1] === 'Packed with Almari',
    lines[lines.length - 1]
  );
  check('line count equals items + 4 (header, top divider, bottom divider, signature)',
    lines.length === 3 + 4,
    `got ${lines.length} lines`
  );
}

/* ==========================================================================
   3. ITEM SEARCH FILTER BEHAVIOR TESTS
   ========================================================================== */
console.log('\n--- 3. ITEM SEARCH FILTER BEHAVIOR ---');

/** Search filter as implemented in PackingListModal.tsx */
function filterPackingClosetItems(activeItems, search, settings) {
  const q = search.trim().toLowerCase();
  if (!q) return activeItems;
  return activeItems.filter(
    item =>
      item.name.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q)) ||
      categoryLabel(settings, item.category).toLowerCase().includes(q)
  );
}

const closetInventory = [
  { id: '1', name: 'White Oxford Shirt', brand: 'Ralph Lauren', category: 'tops' },
  { id: '2', name: 'Navy Linen Shirt', brand: 'Muji', category: 'tops' },
  { id: '3', name: 'Chino Trousers', brand: 'Uniqlo', category: 'bottoms' },
  { id: '4', name: 'Pleated Silk Dress', brand: 'Toast', category: 'dresses' },
  { id: '5', name: 'Denim Trucker Jacket', brand: 'Levi\'s', category: 'outerwear' },
  { id: '6', name: 'Khadi Kurta', brand: 'FabIndia', category: 'ethnic' },
  { id: '7', name: 'Canvas Sneakers', brand: undefined, category: 'shoes' },
  { id: '8', name: 'Silver Signet Ring', brand: '', category: 'accessories' },
];

// Test 1: Empty and whitespace queries
check('empty query "" returns all active items without filtering',
  filterPackingClosetItems(closetInventory, '', standardSettings).length === closetInventory.length
);

check('whitespace query "   " returns all active items',
  filterPackingClosetItems(closetInventory, '   \t  ', standardSettings).length === closetInventory.length
);

// Test 2: Name matching (case-insensitive substring)
check('name search "oxford" finds "White Oxford Shirt"',
  filterPackingClosetItems(closetInventory, 'oxford', standardSettings).map(i => i.id).join(',') === '1'
);

check('name search "SHIRT" finds both Oxford and Linen shirts',
  filterPackingClosetItems(closetInventory, 'SHIRT', standardSettings).length === 2
);

check('name search with mixed casing "LiNeN" finds Linen shirt',
  filterPackingClosetItems(closetInventory, 'LiNeN', standardSettings).map(i => i.id).join(',') === '2'
);

// Test 3: Brand matching
check('brand search "Muji" matches item by brand',
  filterPackingClosetItems(closetInventory, 'muji', standardSettings).map(i => i.id).join(',') === '2'
);

check('brand search "FabIndia" matches ethnic kurta',
  filterPackingClosetItems(closetInventory, 'fabindia', standardSettings).map(i => i.id).join(',') === '6'
);

check('brand search partial "ralph" matches Ralph Lauren',
  filterPackingClosetItems(closetInventory, 'ralph', standardSettings).map(i => i.id).join(',') === '1'
);

check('brand matching safely ignores undefined and empty string brands',
  (() => {
    const res = filterPackingClosetItems(closetInventory, 'canvas', standardSettings);
    return res.length === 1 && res[0].id === '7';
  })()
);

// Test 4: Category label matching
check('category search "outerwear" matches Denim Trucker Jacket',
  filterPackingClosetItems(closetInventory, 'outerwear', standardSettings).map(i => i.id).join(',') === '5'
);

check('category search "bottoms" matches Chino Trousers',
  filterPackingClosetItems(closetInventory, 'bottoms', standardSettings).map(i => i.id).join(',') === '3'
);

check('category search "One-pieces" matches dresses category under standardSettings',
  filterPackingClosetItems(closetInventory, 'one-piece', standardSettings).map(i => i.id).join(',') === '4'
);

check('category search "shoes" matches Canvas Sneakers',
  filterPackingClosetItems(closetInventory, 'shoes', standardSettings).map(i => i.id).join(',') === '7'
);

// Test 5: Custom category label resolution
check('custom category search "Kurta & Sarees" matches ethnic item under customSettings',
  filterPackingClosetItems(closetInventory, 'saree', customSettings).map(i => i.id).join(',') === '6'
);

check('custom category search "Footwear" matches shoes under customSettings',
  filterPackingClosetItems(closetInventory, 'footwear', customSettings).map(i => i.id).join(',') === '7'
);

// Test 6: Non-matching search
check('non-matching search query returns empty array',
  filterPackingClosetItems(closetInventory, 'nonexistentgarment123', standardSettings).length === 0
);

// Test 7: Leading and trailing whitespace in search query is trimmed
check('search query with surrounding spaces "  chino  " matches Chino Trousers',
  filterPackingClosetItems(closetInventory, '  chino  ', standardSettings).map(i => i.id).join(',') === '3'
);

/* ==========================================================================
   4. SOURCE PINNING & CONTRACT VERIFICATION
   ========================================================================== */
console.log('\n--- 4. COMPONENT SOURCE CONTRACT PINNING ---');

const modalSource = readFileSync(
  new URL('../src/components/PackingListModal.tsx', import.meta.url),
  'utf8'
);

check('PackingListModal contains the exact density calculation formula',
  modalSource.includes('(selectedItems.length / Math.max(tripDays, 1)).toFixed(1)'),
  'Formula divergence detected in PackingListModal.tsx'
);

check('PackingListModal contains standard trip length buttons: 2, 3, 5, 7, 14',
  modalSource.includes('[2, 3, 5, 7, 14]'),
  'Trip length presets modified in PackingListModal.tsx'
);

check('PackingListModal text export contains header template PACKING LIST (${tripDays} days · ${selectedItems.length} pieces)',
  modalSource.includes('`PACKING LIST (${tripDays} days · ${selectedItems.length} pieces)`'),
  'Header template string mismatch'
);

check('PackingListModal text export uses 40-character divider rule',
  modalSource.includes("'----------------------------------------'"),
  'Divider rule mismatch'
);

check('PackingListModal text export contains signature "Packed with Almari"',
  modalSource.includes("'Packed with Almari'"),
  'Brand signature mismatch'
);

check('PackingListModal search filter checks name, brand, and categoryLabel with trim().toLowerCase()',
  modalSource.includes('search.trim().toLowerCase()') &&
  modalSource.includes('item.name.toLowerCase().includes(q)') &&
  modalSource.includes('item.brand.toLowerCase().includes(q)') &&
  modalSource.includes('categoryLabel(settings, item.category).toLowerCase().includes(q)'),
  'Search filter predicates mismatch'
);

/* ==========================================================================
   SUMMARY & EXIT
   ========================================================================== */
console.log('\n============================================================');
if (fail === 0) {
  console.log('ALL PACKING LIST CHECKS PASSED (exit code 0)');
} else {
  console.log(`${fail} PACKING LIST CHECK(S) FAILED`);
}
console.log('============================================================\n');

process.exit(fail ? 1 : 0);