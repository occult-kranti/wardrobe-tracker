#!/usr/bin/env node
/**
 * The photo-intake suite: runs the REAL parser (src/lib/intake.ts) over the
 * fixtures produced by running docs/23's prompt against real photographs, plus
 * a row of adversarial files a model will eventually hand us.
 *
 * The fixtures are not invented. Five photographs were catalogued while the
 * prompt was being written — a flat lay, a hanging rail, a toiletries closet,
 * a linen closet and a street heap — and two of the five contained no
 * wearable pieces at all. A prompt that cannot say "nothing here" is a prompt
 * that will happily invent a wardrobe, so the empty answers are tests too.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'intake-')), 'i.mjs');
await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/intake.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const { readIntake, draftToItem, findDuplicates } = await import(pathToFileURL(out).href);

// The fixtures ARE the files the app ships and loads, so the suite tests
// exactly what a user can open in the sample bench.
const FIXTURES = fileURLToPath(new URL('../public/intake-samples/', import.meta.url));
const read = name => readIntake(readFileSync(join(FIXTURES, name), 'utf8'));

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

/* ---------- the real photographs ---------- */

const flat = read('flatlay.json');
check('flat lay: file reads', !flat.error, flat.error ?? '');
check('flat lay: three pieces', flat.drafts.length === 3, String(flat.drafts.length));
check('flat lay: nothing dropped', flat.dropped.length === 0, JSON.stringify(flat.dropped));
check(
  'flat lay: categories are real ids',
  flat.drafts.every(d => ['tops', 'bottoms', 'shoes'].includes(d.category)),
  flat.drafts.map(d => d.category).join(',')
);
check(
  'flat lay: the ambiguous piece carries its doubt',
  flat.drafts.some(d => d.confidence < 0.7 && d.uncertain.includes('category')),
  'the clip-hung trousers could be a skirt'
);
check('flat lay: every colour is a hex', flat.drafts.every(d => /^#[0-9A-F]{6}$/.test(d.color)));

const rail = read('hanging-closet.json');
check('hanging rail: ten pieces', rail.drafts.length === 10, String(rail.drafts.length));
check('hanging rail: three skips recorded', rail.skipped.length === 3, String(rail.skipped.length));
check(
  'hanging rail: the towel is skipped, not catalogued',
  rail.skipped.some(s => /towel/i.test(s.note ?? '')) &&
    !rail.drafts.some(d => /towel/i.test(d.name)),
);
check(
  'hanging rail: occluded pieces come in under 0.7',
  rail.drafts.filter(d => d.confidence < 0.7).length >= 3,
  `${rail.drafts.filter(d => d.confidence < 0.7).length} of 10`
);
check(
  'hanging rail: no brand invented from a half-legible label',
  rail.drafts.every(d => d.brand === undefined),
);

const none = read('nothing-wearable.json');
check('nothing wearable: reads cleanly', !none.error);
check('nothing wearable: zero pieces', none.drafts.length === 0, String(none.drafts.length));
check('nothing wearable: says why, three times', none.skipped.length === 3, String(none.skipped.length));

/* ---------- the house voice ---------- */

const allDrafts = [...flat.drafts, ...rail.drafts];
check(
  'no gendered wording anywhere',
  !allDrafts.some(d => /\b(wom[ae]n'?s|m[ae]n'?s|ladies'?|unisex)\b/i.test(`${d.name} ${d.description}`)),
);
check('no exclamation points', !allDrafts.some(d => /!/.test(`${d.name} ${d.description}`)));
check(
  'descriptions stay one line and under 110 characters',
  allDrafts.every(d => !d.description.includes('\n') && d.description.length <= 110),
  `longest ${Math.max(...allDrafts.map(d => d.description.length))}`
);
check(
  'names are two to four words',
  allDrafts.every(d => {
    const n = d.name.trim().split(/\s+/).length;
    return n >= 2 && n <= 4;
  }),
);
check(
  'no judgement words in descriptions',
  !allDrafts.some(d => /\b(flattering|slimming|stylish|beautiful|cheap|expensive|classy)\b/i.test(d.description)),
);

/* ---------- what the app does with a draft ---------- */

const item = draftToItem(flat.drafts[0]);
check('draft → item: no history is invented', !('wearCount' in item) && !('lastWorn' in item) && !('cost' in item));
check('draft → item: photo is left empty for the drawn flat', item.imageUrl === '');
check('draft → item: the description becomes the note', (item.notes ?? '').startsWith('White jersey top'));
check('draft → item: source is left for the owner', item.source === undefined);

const dupes = findDuplicates(flat.drafts, [
  { name: 'white mesh trainers', id: 'x', category: 'shoes', color: '#fff', season: [], occasion: [], imageUrl: '', dateAdded: '2026-01-01', wearCount: 0, favorite: false, laundryStatus: 'clean' },
]);
check('duplicate names are caught case-insensitively', dupes.size === 1);

/* ---------- adversarial files ---------- */

const bad = [
  ['not json at all', 'Sure! Here are the clothes I found:', /not valid JSON/],
  ['fenced json', '```json\n{"toileIntake":1,"pieces":[{"ref":"a","name":"Grey tee","category":"tops","color":"#888888","description":"A grey tee.","season":[],"occasion":[],"confidence":0.9}]}\n```', null],
  ['a future version', '{"toileIntake":9,"pieces":[]}', /version 9/],
  ['no pieces list', '{"toileIntake":1}', /no "pieces" list/],
  ['an array at the root', '[]', /one JSON object/],
];
for (const [label, text, expect] of bad) {
  const r = readIntake(text);
  if (expect) check(`rejects ${label} with a usable message`, Boolean(r.error && expect.test(r.error)), r.error ?? 'no error');
  else check(`accepts ${label}`, !r.error && r.drafts.length === 1, r.error ?? '');
}

const messy = readIntake(JSON.stringify({
  toileIntake: 1,
  pieces: [
    { ref: 'a', name: "Women's silk blouse", category: 'shirt', color: 'blue', description: 'A flattering blouse.', season: ['spring', 'monsoon'], occasion: ['work', 'brunch'], confidence: 3 },
    { ref: 'a', name: '  ', category: 'tops', color: '#fff' },
    { name: 'Tote bag', category: 'handbag', color: '#abc', season: 'summer', occasion: null, confidence: 'high' },
    'a string where an object should be',
  ],
}));
check('messy file: two rows survive, two are dropped', messy.drafts.length === 2 && messy.dropped.length === 2, `${messy.drafts.length}/${messy.dropped.length}`);
check('messy file: gendered name is scrubbed', messy.drafts[0].name === 'silk blouse', messy.drafts[0].name);
check('messy file: "shirt" maps to tops', messy.drafts[0].category === 'tops');
check('messy file: unparseable colour falls back', /^#[0-9A-F]{6}$/.test(messy.drafts[0].color));
check('messy file: confidence is clamped to 1', messy.drafts[0].confidence === 1);
check('messy file: invented seasons are dropped', JSON.stringify(messy.drafts[0].season) === '["spring"]');
check('messy file: invented occasions are dropped', JSON.stringify(messy.drafts[0].occasion) === '["work"]');
check('messy file: short hex expands', messy.drafts[1].color === '#AABBCC', messy.drafts[1].color);
check('messy file: "handbag" maps to accessories', messy.drafts[1].category === 'accessories');
check('messy file: repairs are recorded, not hidden', messy.drafts.every(d => d.repairs.length > 0));
check('messy file: the blank name is dropped with a reason', messy.dropped.some(d => /no name/.test(d.reason)));

/* ---------- the prompt the app copies is the prompt the doc prints ---------- */

{
  const promptTs = readFileSync(fileURLToPath(new URL('../src/lib/intakePrompt.ts', import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n');

  /** The body of one named template literal, unescaped. */
  const literal = name => {
    const at = promptTs.indexOf(`export const ${name} = \``);
    if (at < 0) return '';
    const open = promptTs.indexOf('`', at);
    const close = promptTs.indexOf('`;', open + 1);
    return promptTs.slice(open + 1, close)
      .replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\')
      .trim();
  };

  const intake = literal('INTAKE_PROMPT');
  const outfit = literal('OUTFIT_PROMPT');
  check('both prompts are readable in the source', intake.length > 500 && outfit.length > 500,
    `${intake.length} / ${outfit.length} chars`);

  // Normalised: a Windows checkout hands us CRLF, and the fence regex and the
  // char-for-char prompt comparison below both assume LF.
  const doc = readFileSync(fileURLToPath(new URL('../docs/23-photo-intake.md', import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n');
  const fences = [...doc.matchAll(/> ```\n([\s\S]*?)\n> ```/g)].map(m =>
    m[1].split('\n').map(l => (l.startsWith('> ') ? l.slice(2) : l.replace(/^>/, ''))).join('\n').trim());
  check('docs/23 prints both prompts', fences.length >= 2, `${fences.length} fenced blocks`);

  // The prompt the app sends is the prompt the doc prints. The outfit prompt
  // interpolates its vetoed-word list, so the doc holds the resolved text —
  // compare on the resolved form, which is what a reader would paste.
  const vetoed = promptTs.match(/const VETOED_WORDS = '([^']*(?:\\'[^']*)*)'/);
  const resolved = vetoed
    ? outfit.replace('${VETOED_WORDS}', vetoed[1].replace(/\\'/g, "'"))
    : outfit;

  check('the flat-lay prompt matches docs/23', fences.includes(intake),
    `${intake.length} chars, doc has ${fences.map(f => f.length).join('/')}`);
  check('the worn-outfit prompt matches docs/23', fences.includes(resolved),
    `${resolved.length} chars, doc has ${fences.map(f => f.length).join('/')}`);

  check('the flat-lay prompt still forbids gendered wording', /never "wom/i.test(intake));
  check('the flat-lay prompt still forbids markdown fences', /no markdown\s*\n?\s*fences/i.test(intake));
  check('the flat-lay prompt still names all eight categories',
    ['tops','bottoms','dresses','layers','outerwear','shoes','jewellery','accessories'].every(c => intake.includes(c)));

  // The rule that matters most in the worn prompt, asserted where it cannot
  // be quietly softened later.
  check('the worn prompt refuses to describe the person',
    /THE PERSON IS NOT THE SUBJECT/.test(outfit) && /not one word about the\s*\n?\s*person/i.test(outfit));
  check('the worn prompt names the vetoed vocabulary it forbids', /VETOED_WORDS/.test(outfit));
  check('the worn prompt still names all eight categories',
    ['tops','bottoms','dresses','layers','outerwear','shoes','jewellery','accessories'].every(c => outfit.includes(c)));
  check('both prompts require a box, because the app crops along it',
    /BOX is required/.test(intake) && /BOX is required/.test(outfit));
}

/* ---------- every sample the bench offers has a file behind it ---------- */

{
  const samples = readFileSync(fileURLToPath(new URL('../src/lib/intakeSamples.ts', import.meta.url)), 'utf8');
  // A sample may decline to bundle its photograph (the owner's own); what it
  // may not do is name one that isn't there.
  const photos = [...samples.matchAll(/^\s*photo: '([^']+)'/gm)].map(m => m[1]);
  const filesRef = [...samples.matchAll(/file: '([^']+)'/g)].map(m => m[1]);
  const pub = fileURLToPath(new URL('../public/', import.meta.url));
  const { existsSync } = await import('node:fs');
  check('every sample names a file that exists', filesRef.every(f => existsSync(join(pub, f))), filesRef.filter(f => !existsSync(join(pub, f))).join(','));
  const missingPhotos = photos.filter(f => !existsSync(join(pub, f)));
  check('every photograph a sample names is bundled', missingPhotos.length === 0, missingPhotos.join(','));
  check('a sample without a photograph explains itself',
    !/photoNote/.test(samples) || /photoNote: '[^']+'/.test(samples));
}

/* ---------- every fixture parses ---------- */

for (const f of readdirSync(FIXTURES).filter(f => f.endsWith('.json'))) {
  const r = read(f);
  check(`${f} parses with no dropped rows`, !r.error && r.dropped.length === 0, r.error ?? '');
}

console.log(failed === 0 ? '\nALL INTAKE CHECKS PASSED' : `\n${failed} INTAKE CHECKS FAILED`);
process.exit(failed ? 1 : 0);
