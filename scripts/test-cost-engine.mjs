#!/usr/bin/env node
/**
 * test-cost-engine.mjs — Comprehensive test suite for the centralized Cost Engine.
 *
 * Verifies:
 * 1. costBasis handling of purchase costs, repairs array, and unrecorded prices.
 * 2. costPerWear reason precedence: no-cost, no-wears, free, ok.
 * 3. aggregateCostPerWear denominators: costed-wears vs all-wears.
 * 4. calculateRewearRate arithmetic: wears / distinct pieces.
 * 5. formatMoney, formatPrice, formatPerWear under Indian numbering system (en-IN).
 * 6. Edge cases: negative numbers, non-numeric strings, NaN, zero division guards.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'cost-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    cost: fileURLToPath(new URL('../packages/shared/cost.ts', import.meta.url)),
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const costModule = await import(pathToFileURL(join(dir, 'cost.js')).href);
const {
  isRecordedAmount, costBasis, costPerWear, aggregateCostPerWear,
  calculateRewearRate, formatMoney, formatPrice, formatPerWear,
} = costModule;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

console.log('\n--- COST BASIS & REPAIRS ---');

check('isRecordedAmount accepts positive numbers and zero',
  isRecordedAmount(0) && isRecordedAmount(1500) && isRecordedAmount(49.99)
);
check('isRecordedAmount rejects negative numbers, NaN, and strings',
  !isRecordedAmount(-10) && !isRecordedAmount(NaN) && !isRecordedAmount('500') && !isRecordedAmount(null)
);

const plainItem = { cost: 3000, wearCount: 10 };
check('costBasis computes purchase price without repairs',
  costBasis(plainItem) === 3000,
  `got ${costBasis(plainItem)}`
);

const repairedItem = {
  cost: 4000,
  wearCount: 8,
  repairs: [
    { date: '2026-01-10', cost: 500, note: 'hemming' },
    { date: '2026-03-15', cost: 300, note: 'button replacement' },
  ],
};
check('costBasis includes valid repair costs',
  costBasis(repairedItem) === 4800,
  `got ${costBasis(repairedItem)}`
);

const unrecordedWithRepairs = {
  cost: undefined,
  wearCount: 4,
  repairs: [{ date: '2026-02-01', cost: 600 }],
};
check('costBasis returns repair sum when purchase cost is unrecorded',
  costBasis(unrecordedWithRepairs) === 600,
  `got ${costBasis(unrecordedWithRepairs)}`
);

const zeroCostItem = { cost: 0, wearCount: 15 };
check('costBasis honors explicit zero cost (heirloom/gift)',
  costBasis(zeroCostItem) === 0,
  `got ${costBasis(zeroCostItem)}`
);

console.log('\n--- COST PER WEAR REASONS ---');

check('costPerWear returns no-cost for unrecorded item',
  costPerWear({ cost: undefined, wearCount: 5 }).reason === 'no-cost' &&
  costPerWear({ cost: undefined, wearCount: 5 }).value === null
);

check('costPerWear returns no-wears for unworn item',
  costPerWear({ cost: 2500, wearCount: 0 }).reason === 'no-wears' &&
  costPerWear({ cost: 2500, wearCount: 0 }).value === null
);

check('costPerWear returns free for 0 cost with wears',
  costPerWear({ cost: 0, wearCount: 20 }).reason === 'free' &&
  costPerWear({ cost: 0, wearCount: 20 }).value === 0
);

const regularCPW = costPerWear({ cost: 2000, wearCount: 10 });
check('costPerWear computes accurate division for paid items',
  regularCPW.reason === 'ok' && regularCPW.value === 200,
  `got ${regularCPW.value}`
);

const repairedCPW = costPerWear(repairedItem);
check('costPerWear folds repairs into basis and divides by wears',
  repairedCPW.reason === 'ok' && repairedCPW.value === 600,
  `got ${repairedCPW.value} (4800/8)`
);

console.log('\n--- AGGREGATE COST & RE-WEAR RATE ---');

const wardrobe = [
  { cost: 3000, wearCount: 10 },
  { cost: 2000, wearCount: 5 },
  { cost: 0, wearCount: 15 }, // gift
  { cost: undefined, wearCount: 8 }, // unrecorded
  { cost: 5000, wearCount: 0 }, // unworn
];

const costedAgg = aggregateCostPerWear(wardrobe, { denominator: 'costed-wears' });
// costed: 3000 (10w) + 2000 (5w) + 5000 (0w) = 10,000 basis, 15 wears -> 10000 / 15 = 666.666...
check('aggregateCostPerWear with costed-wears sums paid pieces and paid wears',
  costedAgg.basis === 10000 && costedAgg.wears === 15 && costedAgg.costedPieces === 3 &&
  Math.abs((costedAgg.value ?? 0) - (10000 / 15)) < 0.001,
  `got basis ${costedAgg.basis}, wears ${costedAgg.wears}, value ${costedAgg.value}`
);

const allAgg = aggregateCostPerWear(wardrobe, { denominator: 'all-wears' });
// all wears: 10 + 5 + 15 + 8 + 0 = 38 wears -> 10000 / 38 = 263.157...
check('aggregateCostPerWear with all-wears divides by every wear in closet',
  allAgg.basis === 10000 && allAgg.wears === 38 &&
  Math.abs((allAgg.value ?? 0) - (10000 / 38)) < 0.001,
  `got basis ${allAgg.basis}, wears ${allAgg.wears}, value ${allAgg.value}`
);

const rewearResult = calculateRewearRate(wardrobe);
// wardrobe has 4 worn pieces (wears > 0: 10, 5, 15, 8 = 38 total), 1 unworn (0 wears).
// distinct pieces = 4, total wears = 38 -> rate = 38 / 4 = 9.5
check('calculateRewearRate divides total wears by distinct active pieces',
  rewearResult.totalWears === 38 && rewearResult.distinctPieces === 4 && rewearResult.rate === 9.5,
  `got wears ${rewearResult.totalWears}, distinct ${rewearResult.distinctPieces}, rate ${rewearResult.rate}`
);

console.log('\n--- FORMATTING UNDER EN-IN ---');

check('formatMoney formats with rupee symbol and Indian grouping',
  formatMoney(134000) === '₹1,34,000' && formatMoney(2500) === '₹2,500',
  `got ${formatMoney(134000)}`
);

check('formatPrice preserves exact decimals when present',
  formatPrice(450) === '₹450' && formatPrice(450.5) === '₹450.50',
  `got ${formatPrice(450.5)}`
);

check('formatPerWear handles null and numbers with 2 decimals',
  formatPerWear(null) === '—' && formatPerWear(12.5) === '₹12.50' && formatPerWear(12.3456) === '₹12.35',
  `got ${formatPerWear(12.3456)}`
);

console.log(`\nALL COST ENGINE CHECKS COMPLETED: ${fail === 0 ? 'ALL PASSED' : `${fail} FAILED`}`);
if (fail > 0) process.exit(1);

