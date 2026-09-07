import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const out = join(mkdtempSync(join(tmpdir(), 'sim-')), 'similarity.mjs');
await build({ alias: sharedAliases(),
  entryPoints: [fileURLToPath(new URL('../packages/shared/similarity.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});

const { colorDistance, colorCloseness, findSimilarItems, matchSummary } = await import(pathToFileURL(out).href);

const checks = [];
function check(name, ok) {
  checks.push([name, ok]);
}

// 1. colorDistance
check('colorDistance: identical colors are 0 distance', colorDistance('#ffffff', '#ffffff') === 0);
check('colorDistance: black and white are far', colorDistance('#000000', '#ffffff') > 700);
check('colorDistance: red and green are far', colorDistance('#ff0000', '#00ff00') > 0);

// 2. colorCloseness
check('colorCloseness: identical is 1', colorCloseness('#ffffff', '#ffffff') === 1);
check('colorCloseness: far apart is 0', colorCloseness('#000000', '#ffffff') === 0);
check('colorCloseness: close colors are > 0.75', colorCloseness('#fefefe', '#ffffff') > 0.9);

// 3. findSimilarItems scoring weights
const dummyItems = [
  { id: '1', name: 'Blue Shirt', category: 'tops', color: '#0000ff', brand: 'BrandA', occasion: ['work'], wearCount: 10, cost: 50 },
  { id: '2', name: 'Green Shirt', category: 'tops', color: '#00ff00', brand: 'BrandB', occasion: ['casual'], wearCount: 5, cost: '30' },
  { id: '3', name: 'Red Pants', category: 'bottoms', color: '#ff0000', brand: 'BrandC', occasion: ['formal'], wearCount: 2, cost: null },
  { id: '4', name: 'Blue', category: 'bottoms', color: '#0000ff', brand: 'BrandD', occasion: ['work'], wearCount: 0, cost: 0 },
];

const exactMatch = findSimilarItems(dummyItems, { category: 'tops', color: '#0000ff', name: 'Blue Shirt', brand: 'BrandA', occasions: ['work'] });
check('findSimilarItems: exact match scored correctly', exactMatch.length > 0 && exactMatch[0].item.id === '1' && exactMatch[0].score > 0.9);
check('findSimilarItems: reasons list is populated', exactMatch[0]?.reasons.length > 2);

const differentCatMatch = findSimilarItems(dummyItems, { category: 'bottoms', color: '#0000ff', name: 'Blue Shirt', brand: 'BrandA', occasions: ['work'] });
check('findSimilarItems: category crossing requires strong signal (which exact color gives)', differentCatMatch.some(m => m.item.id === '1'));

const excludedMatch = findSimilarItems(dummyItems, { category: 'tops', color: '#0000ff', name: 'Blue Shirt', brand: 'BrandA', occasions: ['work'], excludeId: '1' });
check('findSimilarItems: excludeId respects exclusion', excludedMatch.every(m => m.item.id !== '1'));

// 4. matchSummary
const summaryNull = matchSummary([]);
check('matchSummary: null on empty', summaryNull === null);

const summaryOne = matchSummary([exactMatch[0]]);
check('matchSummary: formats singular piece and wears', summaryOne.includes('1 similar piece') && summaryOne.includes('Total wears: 10'));

const summaryMultiple = matchSummary([exactMatch[0], { item: dummyItems[1], score: 0.5, reasons: [] }]);
check('matchSummary: formats plural pieces and wears', summaryMultiple.includes('2 similar pieces') && summaryMultiple.includes('Total wears: 15'));


let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', '-', name);
  if (!ok) failed++;
}
console.log(failed === 0 ? '\nALL SIMILARITY CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
