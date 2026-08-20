#!/usr/bin/env node
/**
 * Builds the cofounder's closet from his own photographs.
 *
 * The authored wardrobe in personaCast.ts is the app owner's real closet, and
 * until now its tiles were pool photographs standing in. This script replaces
 * the stand-ins with crops of the real garments, read out of his camera roll
 * by the app's own intake pipeline — nothing here is generated art, and no
 * pool photograph survives:
 *
 *   1. the five solo/flat-lay photographs in test_images/ go through the
 *      gallery prompt (buildPhotoPrompt), one call each;
 *   2. the two feed screenshots go through the grid prompt (buildGridPrompt),
 *      solo tiles only — group photographs are left alone, by design;
 *   3. every detection is merged into ONE piece list: the same garment
 *      photographed twice is one piece, and the best crop wins;
 *   4. each piece is cropped with the app's own pixel math (photoCropPixels /
 *      garmentCropPixels), cut by Pillow at max edge 520, JPEG q88, and
 *      written to public/wardrobe/cofounder/<deterministic-slug>.jpg;
 *   5. a final table is printed — piece, category, colour, hex, source
 *      photograph, file — which is what the authored brief is built from.
 *
 * The relay holds the provider key server-side; nothing to set in the
 * environment. Runnable any time:
 *
 *   node scripts/build-cofounder-closet.mjs
 *   node scripts/build-cofounder-closet.mjs --fresh   # ignore cached reads
 *
 * Reads are cached under node_modules/.cache/cofounder-intake/ keyed by the
 * hash of the exact image bytes sent: the model's eye varies run to run, and
 * the brief in personaCast.ts is written against ONE set of reads — the cache
 * is what keeps re-runs in agreement with the committed closet. --fresh pays
 * for new reads and starts that agreement over.
 *
 * test_images/ is gitignored and never committed; the crops it produces are
 * the owner's own garments and ship in public/.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import {
  mkdtempSync, readFileSync, writeFileSync, existsSync,
  mkdirSync, readdirSync, unlinkSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const RELAY = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';
const MODEL = 'claude-fable-5';
const SRC = fileURLToPath(new URL('../test_images', import.meta.url));
const OUT = fileURLToPath(new URL('../public/wardrobe/cofounder', import.meta.url));
const CACHE = fileURLToPath(new URL('../node_modules/.cache/cofounder-intake', import.meta.url));
const FRESH = process.argv.includes('--fresh');
const GALLERY = ['todaysoutfit1.png', 'todaysoutfit2.png', 'test.png', 'test2.png', 'bed.png'];
const FEEDS = ['insta feed.png', 'instafeed2.png'];

const dir = mkdtempSync(join(tmpdir(), 'cofounder-'));
await build({ alias: sharedAliases(),
  entryPoints: {
    feedIntake: fileURLToPath(new URL('../src/lib/feedIntake.ts', import.meta.url)),
    intake: fileURLToPath(new URL('../packages/shared/intake.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});
const FI = await import(pathToFileURL(join(dir, 'feedIntake.js')).href);
const intake = await import(pathToFileURL(join(dir, 'intake.js')).href);
const {
  buildPhotoPrompt, buildGridPrompt, parseGridResponse,
  soloDetections, toDrafts, photoCropPixels, garmentCropPixels, tileCropPixels,
} = FI;
const { readIntake } = intake;

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

/** One call to the house relay, in the Anthropic Messages shape; one retry.
 *  Answers are cached by the hash of the exact bytes sent, so a re-run argues
 *  with the same reads the closet was authored from. */
async function ask(buf, mediaType, prompt, kind, label) {
  const key = createHash('sha256').update(kind).update(buf).digest('hex').slice(0, 24);
  const slot = join(CACHE, `${key}.txt`);
  if (!FRESH && existsSync(slot)) {
    console.log(`  ... ${label}: cached read`);
    return readFileSync(slot, 'utf8');
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(RELAY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        // Matches MAX_TOKENS in src/lib/anthropic.ts: Fable 5 always thinks, and
        // the thinking comes out of this same budget as the answer.
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    const body = await res.json().catch(() => null);
    const answer = ((body?.content ?? []).filter(b => b?.type === 'text').map(b => b.text).join('\n')).trim();
    if (res.status === 200 && answer.length > 10) {
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(slot, answer);
      return answer;
    }
    console.log(`  ... ${label}: attempt ${attempt} answered status ${res.status}, ${answer.length} chars`);
  }
  return '';
}

/* ================= the reads ================= */

// Every detection, from either pipeline, flattened to one shape: what it is,
// and exactly which pixels of which image to cut for it.
const candidates = [];

// -- the solo and flat-lay photographs, through the gallery prompt
for (const name of GALLERY) {
  const file = join(SRC, name);
  if (!existsSync(file)) { check(`gallery: ${name} is present`, false); continue; }
  // Prepared exactly as the app does: longest edge 1400, JPEG.
  const prepared = join(dir, `prepared-${name.replace(/\s+/g, '_')}.jpg`);
  const dims = execFileSync('python', ['-c', `
import sys
from PIL import Image
img = Image.open(sys.argv[1]).convert('RGB')
s = min(1, 1400 / max(img.width, img.height))
img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))))
img.save(sys.argv[2], 'JPEG', quality=88)
print(str(img.width) + 'x' + str(img.height))
`.trim(), file, prepared], { encoding: 'utf8' }).trim();
  const [imgW, imgH] = dims.split('x').map(Number);

  const answer = await ask(readFileSync(prepared), 'image/jpeg', buildPhotoPrompt(), 'gallery', name);
  const read = readIntake(answer);
  check(`gallery: ${name} parses as an intake file`, !read.error, read.error ?? `${answer.length} chars`);
  if (read.error) continue;
  for (const d of read.drafts) {
    if (!d.box) { console.log(`  ... ${name}: "${d.name}" came back with no box — nothing to crop`); continue; }
    const px = photoCropPixels(d.box, imgW, imgH);
    candidates.push({
      name: d.name, category: d.category, color: d.color, confidence: d.confidence ?? 0,
      source: name, img: prepared, px, loose: false,
    });
  }
  console.log(`  ${name}: ${read.drafts.length} pieces — ${read.drafts.map(d => d.name).join(' | ')}`);
}

// -- the feed screenshots, through the grid prompt; solo tiles only
for (const name of FEEDS) {
  const file = join(SRC, name);
  if (!existsSync(file)) { check(`feed: ${name} is present`, false); continue; }
  const buf = readFileSync(file);
  const isPng = buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50;
  const imgW = isPng ? buf.readUInt32BE(16) : 0;
  const imgH = isPng ? buf.readUInt32BE(20) : 0;
  check(`feed: ${name} is a PNG with readable dimensions`, isPng && imgW > 0 && imgH > 0, `${imgW}x${imgH}`);

  const answer = await ask(buf, 'image/png', buildGridPrompt(), 'grid', name);
  const read = parseGridResponse(answer);
  check(`feed: ${name} parses as a grid read`, !read.error, read.error ?? `${answer.length} chars`);
  if (read.error) continue;
  const n = FEEDS.indexOf(name) + 1;
  const det = soloDetections(read, n);
  const { drafts } = toDrafts(det);
  const byRef = new Map(det.map(d => [d.ref, d]));
  console.log(`  ${name}: tiles ${read.tiles.map(t => `${t.ref}:${t.kind}`).join(' ')}`);
  for (const d of drafts) {
    const hit = byRef.get(d.ref);
    if (!hit) continue;
    const g = hit.garment;
    const loose = !(g.box && g.confidence >= 0.5);
    const px = loose
      ? tileCropPixels(hit.tileBox, imgW, imgH)
      : garmentCropPixels(g.box, hit.tileBox, imgW, imgH);
    candidates.push({
      name: d.name, category: d.category, color: d.color, confidence: d.confidence ?? 0,
      source: name, img: file, px, loose,
    });
  }
  console.log(`  ${name}: ${drafts.length} garments — ${drafts.map(d => d.name).join(' | ')}`);
}

check('the run found garments somewhere', candidates.length > 0, `${candidates.length} detections`);

/* ================= the merge: one garment, one piece ================= */

const STOP = new Set(['and', 'the', 'a', 'an', 'of', 'with']);
function tokens(name) {
  let s = ` ${name.toLowerCase().replace(/&/g, ' and ')} `;
  s = s.replace(/\bt-?shirts?\b/g, ' tshirt ').replace(/\btees?\b/g, ' tshirt ').replace(/\bgray\b/g, ' grey ');
  return new Set(s.split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)));
}
function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function colorDist(a, b) {
  const x = hexRgb(a); const y = hexRgb(b);
  if (!x || !y) return 0; // an unread colour blocks nothing; the names still have to agree
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
}
function jaccard(a, b) {
  const inter = [...a].filter(t => b.has(t)).length;
  return inter / (a.size + b.size - inter);
}
function subset(a, b) { return [...a].every(t => b.has(t)); }
// A watch is jewellery to one read and an accessory to the next; the same
// physical piece must not split over a filing difference.
const catCompat = (a, b) =>
  a === b || (['jewellery', 'accessories'].includes(a) && ['jewellery', 'accessories'].includes(b));

// Union-find. Two detections are the same garment only when their NAMES say
// so — one name's words contain the other's ("Black watch" / "Black digital
// watch") or the overlap is heavy — and their colours do not contradict and
// their categories can file together. Boxes never vote: a tee under an open
// jacket overlaps its jacket almost exactly, and two shirts in one flat-lay
// lean on each other, and neither pair is one garment.
const parent = candidates.map((_, i) => i);
const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const union = (i, j) => { parent[find(i)] = find(j); };
const toks = candidates.map(c => tokens(c.name));

/* Reviewed non-merges: name pairs the rules above would join and the
   photographs themselves keep apart. The plain black kurta and the
   sangeet night's embellished long coat are both black and both called a
   kurta by a hurried read; side by side in the crops they are two pieces,
   and the wedding event reserves them for different nights. */
const NEVER_MERGE = [
  [/^black kurta$/i, /black embellished/i],
];
const blocked = (a, b) =>
  NEVER_MERGE.some(([x, y]) => (x.test(a.name) && y.test(b.name)) || (y.test(a.name) && x.test(b.name)));

for (let i = 0; i < candidates.length; i++) {
  for (let j = i + 1; j < candidates.length; j++) {
    const a = candidates[i]; const b = candidates[j];
    if (!catCompat(a.category, b.category)) continue;
    if (colorDist(a.color, b.color) > 90) continue;
    if (blocked(a, b)) continue;
    if (subset(toks[i], toks[j]) || subset(toks[j], toks[i]) || jaccard(toks[i], toks[j]) >= 0.6) union(i, j);
  }
}

const groups = new Map();
for (let i = 0; i < candidates.length; i++) {
  const root = find(i);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(i);
}

// The representative detection of a group is the crop that ships. Confidence
// alone picks wrong — a confident read with a postage-stamp box beats a calm
// read of the whole garment every time unless the crop's size talks too:
// score the confidence by how much frame the box actually covers.
const pieces = [...groups.values()].map(memberIdx => {
  const members = memberIdx.map(i => candidates[i]);
  const score = c => c.confidence * Math.min(1, (c.px.w * c.px.h) / (220 * 220));
  members.sort((a, b) => score(b) - score(a) || (b.px.w * b.px.h) - (a.px.w * a.px.h) || a.name.localeCompare(b.name));
  const rep = members[0];
  // The piece takes the most specific name in its group — "Black digital
  // watch", not "Black watch" — as long as the longer name grew from the
  // shorter one rather than past it.
  let named = rep;
  for (const m of members) {
    const have = tokens(named.name); const more = tokens(m.name);
    if (subset(have, more) && more.size > have.size) named = m;
  }
  return {
    name: named.name, category: rep.category, color: rep.color,
    confidence: rep.confidence, source: rep.source, img: rep.img, px: rep.px, loose: rep.loose,
    also: members.slice(1).map(m => `${m.name} @ ${m.source}`),
  };
});

if (pieces.some(p => p.also.length)) {
  console.log('\n  merged (same garment, photographed again):');
  for (const p of pieces.filter(p => p.also.length)) {
    console.log(`    ${p.name}  <=  ${p.also.join('  |  ')}`);
  }
}

/* Pieces reviewed out of the closet, each by looking at the crop it would
   ship. Small things — studs, bracelets, frames, caps — are read off worn
   photographs at a handful of pixels, and a box that lands a centimetre off
   the garment is a crop of wall, or sidewalk, or somebody's chin. The rule is
   the same one photoFor() keeps: no honest crop, no tile. A fresh run
   (--fresh) may name these differently; the patterns err toward keeping, and
   the table below is there to be reviewed again. */
const DROPS = [
  [/earring|hoop/i, 'a smudge of earlobe; the hoop never resolves'],
  [/bracelet/i, 'a wrist sliver — the bracelet never fills its box'],
  [/\bwatch\b/i, 'the box never finds the dial — a wrist sliver at best'],
  [/eyeglasses|\bglasses\b/i, 'the box landed off the frames entirely'],
  [/baseball cap/i, 'a background blur, not the cap'],
  [/beanie|dog hat/i, 'a sliver of wall; the hat is only ever on his head in another piece\'s tile'],
  [/sneaker|\bshoes\b|\btrainers\b/i, 'a sidewalk sliver'],
  [/^graphic print tee$/i, 'the box found a chin, not the tee'],
  [/^light blue t-shirt$/i, 'a portrait with a shoulder of tee'],
  [/^black jacket$/i, 'the box found the evening and the shoes, not the jacket'],
  [/polka dot/i, 'the crop shows plain white cloth; it cannot stand for the shorts'],
  [/^white graphic tee$/i, 'a face under the dog-ear hat; the tee is the bottom edge'],
];
const kept = [];
const droppedOut = [];
for (const p of pieces) {
  const why = DROPS.find(([re]) => re.test(p.name));
  if (why) droppedOut.push({ p, reason: why[1] });
  else kept.push(p);
}
pieces.length = 0;
pieces.push(...kept);
if (droppedOut.length) {
  console.log('\n  dropped (the crop cannot stand for the piece):');
  for (const { p, reason } of droppedOut) console.log(`    ${p.name} @ ${p.source} — ${reason}`);
}

/* ================= the crops ================= */

mkdirSync(OUT, { recursive: true });
// Stale crops from an earlier run would linger as files no piece points at.
for (const f of readdirSync(OUT).filter(f => f.endsWith('.jpg'))) unlinkSync(join(OUT, f));

const slugOf = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const usedSlugs = new Set();
for (const p of pieces) {
  let slug = slugOf(p.name);
  for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugOf(p.name)}-${n}`;
  usedSlugs.add(slug);
  p.file = `${slug}.jpg`;
}

const croppable = pieces.filter(p => p.px.w >= 8 && p.px.h >= 8);
const skipped = pieces.filter(p => p.px.w < 8 || p.px.h < 8);
for (const p of skipped) console.log(`  ... ${p.name}: crop too small (${p.px.w}x${p.px.h}) — dropped`);

const manifestPath = join(dir, 'crops.json');
writeFileSync(manifestPath, JSON.stringify(croppable.map(p => ({ img: p.img, file: p.file, ...p.px }))));
execFileSync('python', ['-c', `
import json, os, sys
from PIL import Image
manifest, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
for e in json.load(open(manifest)):
    img = Image.open(e['img'])
    c = img.crop((e['x'], e['y'], e['x'] + e['w'], e['y'] + e['h']))
    s = min(1, 520 / max(c.width, c.height))
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))))
    c.convert('RGB').save(os.path.join(outdir, e['file']), 'JPEG', quality=88)
`.trim(), manifestPath, OUT], { encoding: 'utf8' });

let cut = 0;
for (const p of croppable) {
  const f = join(OUT, p.file);
  const head = existsSync(f) ? readFileSync(f).subarray(0, 2) : null;
  if (head && head[0] === 0xFF && head[1] === 0xD8 && statSync(f).size > 400) cut++;
  else console.log(`  ... ${p.file} did not come out a real JPEG`);
}
check('every crop is a real JPEG in public/wardrobe/cofounder', cut === croppable.length, `${cut}/${croppable.length}`);

/* ================= the table ================= */

// A colour word for the table, nearest of a small named set — the brief's
// author still writes the final word; this only keeps the table honest.
const NAMED = {
  black: '#1a1a1a', white: '#f5f5f5', grey: '#8a8a8a', navy: '#1f2a44', blue: '#3b6ea5',
  'light blue': '#a8c8e0', red: '#b23a2e', maroon: '#5e2f26', brown: '#7a5230', cream: '#ede6d6',
  beige: '#d9cdb4', mustard: '#e3b31c', yellow: '#e8c832', pink: '#e8a8b8', turquoise: '#40c8c0',
  green: '#3a6b4a', orange: '#d07a2a', lavender: '#c9b8e8', silver: '#c0c0c0', gold: '#c8a038',
};
function colourWord(hex) {
  const rgb = hexRgb(hex);
  if (!rgb) return '-';
  let best = '-'; let bestD = Infinity;
  for (const [word, h] of Object.entries(NAMED)) {
    const d = colorDist(hex, h);
    if (d < bestD) { bestD = d; best = word; }
  }
  return best;
}

const CAT_ORDER = ['tops', 'bottoms', 'layers', 'outerwear', 'dresses', 'shoes', 'jewellery', 'accessories'];
croppable.sort((a, b) =>
  CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));

console.log(`\n  ${croppable.length} pieces, cut from ${GALLERY.length + FEEDS.length} photographs:\n`);
console.log(`    ${'piece'.padEnd(30)} ${'category'.padEnd(12)} ${'colour'.padEnd(11)} ${'hex'.padEnd(8)} ${'source'.padEnd(19)} file`);
for (const p of croppable) {
  console.log(
    `    ${p.name.slice(0, 29).padEnd(30)} ${p.category.padEnd(12)} ${colourWord(p.color).padEnd(11)} ` +
    `${(p.color ?? '-').padEnd(8)} ${p.source.padEnd(19)} ${p.file}${p.loose ? '  (tile crop)' : ''}`,
  );
}

writeFileSync(join(dir, 'pieces.json'), JSON.stringify(croppable.map(p => ({
  name: p.name, category: p.category, color: p.color, source: p.source, file: p.file,
})), null, 2));
console.log(`\n  crops in: ${OUT}`);
console.log(`  machine-readable list: ${join(dir, 'pieces.json')}`);

console.log(failed === 0 ? '\nCLOSET BUILT' : `\n${failed} CHECKS FAILED`);
process.exit(failed ? 1 : 0);
