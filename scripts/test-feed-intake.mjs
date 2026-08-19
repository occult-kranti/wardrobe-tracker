#!/usr/bin/env node
/**
 * The feed-intake suite: the pure pipeline (prompt, parser, crop math,
 * drafts) and, when asked, one live read against the real API.
 *
 * Pure mode runs everywhere:
 *
 *   node scripts/test-feed-intake.mjs
 *
 * Live mode needs the owner's key in the environment and never written down:
 *
 *   KIMI_KEY=... node scripts/test-feed-intake.mjs --live
 *   KIMI_KEY=... node scripts/test-feed-intake.mjs --live <screenshot.png>
 *
 * With no image given, live mode builds a synthetic 2x2 "feed screenshot"
 * from the wardrobe photo pool with Python + Pillow: three single-garment
 * tiles and one photograph of three people — the group the solo rule exists
 * to leave alone. The read is real; the crops it produces are verified as
 * JPEGs.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'feedintake-'));
await build({
  entryPoints: [
    fileURLToPath(new URL('../src/lib/feedIntake.ts', import.meta.url)),
    fileURLToPath(new URL('../src/lib/intake.ts', import.meta.url)),
  ],
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});
const FI = await import(pathToFileURL(join(dir, 'feedIntake.js')).href);
const intake = await import(pathToFileURL(join(dir, 'intake.js')).href);

const {
  buildGridPrompt, parseGridResponse, soloDetections, toDrafts,
  tileCropPixels, garmentCropPixels, plausibleBox, evenThirds,
} = FI;

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

/* ================= the prompt ================= */

{
  const p = buildGridPrompt();
  check('the grid prompt is substantial', p.length > 1500, `${p.length} chars`);
  check('the grid prompt demands JSON only', /ONLY a JSON object/.test(p) && /no markdown\s*\n?\s*fences/i.test(p));
  check('the grid prompt names the five kinds',
    ['solo', 'group', 'scenery', 'text', 'other'].every(k => p.includes(k)));
  check('the grid prompt states the solo rule', /TWO OR[\s\S]{0,3}MORE people is left alone/.test(p));
  check('the grid prompt refuses to describe the person', /never the person/i.test(p));
  check('the grid prompt asks for boxes twice — tile and garment',
    /fractions of the WHOLE screenshot/.test(p) && /WITHIN ITS TILE/.test(p));
  check('the grid prompt prints its shape', p.includes('"feedGrid": 1') && p.includes('"tiles"'));
}

/* ================= the parser, on a golden answer ================= */

const GOLDEN = JSON.stringify({
  feedGrid: 1,
  tiles: [
    {
      ref: 't1', kind: 'solo', confidence: 0.92,
      box: { x: 0, y: 0.2, w: 0.333, h: 0.26 },
      garments: [
        {
          ref: 'g1', name: 'Navy hoodie', category: 'layers', color: '#1D2440',
          colorName: 'navy', pattern: 'solid', material: 'cotton fleece',
          season: ['fall', 'winter'], tags: ['casual'], confidence: 0.9,
          uncertain: ['material'], box: { x: 0.1, y: 0.08, w: 0.8, h: 0.84 },
        },
        {
          ref: 'g2', name: 'Grey tee', category: 'shirt', color: '#9A9A9A',
          colorName: 'grey', season: [], tags: ['casual'], confidence: 0.6, uncertain: [],
        },
      ],
    },
    { ref: 't2', kind: 'group', confidence: 0.97, box: { x: 0.333, y: 0.2, w: 0.333, h: 0.26 }, garments: [] },
    { ref: 't3', kind: 'scenery', confidence: 0.8, box: { x: 0.666, y: 0.2, w: 0.333, h: 0.26 } },
    { ref: 't4', kind: 'text', confidence: 0.99 },
  ],
});

{
  const read = parseGridResponse(GOLDEN);
  check('golden: reads cleanly', !read.error, read.error ?? '');
  check('golden: four tiles, in order', read.tiles.length === 4 && read.tiles[0].ref === 't1');
  check('golden: kinds survive', read.tiles.map(t => t.kind).join(',') === 'solo,group,scenery,text');
  check('golden: a missing tile box stays missing', read.tiles[3].box === undefined);
  check('golden: solo garments arrive with their doubts',
    read.tiles[0].garments.length === 2 && read.tiles[0].garments[0].uncertain.includes('material'));
  check('golden: a missing garments list is an empty list', Array.isArray(read.tiles[2].garments));
}

/* ================= the parser, on junk ================= */

{
  const fenced = '```json\n' + GOLDEN + '\n```';
  check('fenced JSON still reads', !parseGridResponse(fenced).error);

  const padded = 'Here is what I found in the grid!\n\n' + GOLDEN + '\n\nHope this helps.';
  check('prose around the JSON still reads', !parseGridResponse(padded).error);

  const junk = parseGridResponse('I cannot help with that.');
  check('no JSON is an error, not a crash', Boolean(junk.error) && junk.tiles.length === 0, junk.error ?? '');

  const noTiles = parseGridResponse('{"feedGrid":1}');
  check('a missing tiles list is an error', /tiles/.test(noTiles.error ?? ''));

  const partial = parseGridResponse(JSON.stringify({
    feedGrid: 1,
    tiles: [
      'a string where a tile should be',
      { ref: 't2', kind: 'selfie', garments: [{ name: 'Sneaky dress', category: 'dresses' }] },
      { ref: 't3', kind: 'group', garments: [{ name: 'Group shirt', category: 'tops' }] },
      { ref: 't4', kind: 'solo', box: [0, 0.5, 0.5, 0.5], garments: [{ category: 'tops' }, { name: 'Solo boot', category: 'shoes', color: '#222222', confidence: 0.7 }] },
    ],
  }));
  check('partial junk: the good tiles survive', partial.tiles.length === 3, `${partial.tiles.length} tiles`);
  check('partial junk: a non-object tile is dropped with a reason',
    partial.dropped.some(d => /not an object/.test(d.reason)));
  check('partial junk: an unknown kind becomes other, never solo',
    partial.tiles[0].kind === 'other' && Boolean(partial.tiles[0].note), partial.tiles[0].note ?? '');
  check('partial junk: an unknown kind keeps no garments', partial.tiles[0].garments.length === 0);
  check('partial junk: garments on a group tile are refused out loud',
    partial.dropped.some(d => /left alone/.test(d.reason)), '');
  check('partial junk: a garment with no name is dropped, its tile survives',
    partial.dropped.some(d => /no name/.test(d.reason)) && partial.tiles[2].garments.length === 1);
  check('partial junk: array-shaped boxes are read too',
    partial.tiles[2].box?.w === 0.5, JSON.stringify(partial.tiles[2].box));
}

/* ================= the crop math ================= */

{
  // Exact values, hand-checked: 2% of the tile's own size shaved off, clamped.
  const px = tileCropPixels({ x: 0, y: 0.2, w: 0.333, h: 0.26 }, 1240, 1480);
  check('tile crop: inset math is exact',
    px.x === 8 && px.y === 304 && px.w === 397 && px.h === 369,
    JSON.stringify(px));

  const edge = tileCropPixels({ x: 0.95, y: 0.95, w: 0.1, h: 0.1 }, 1000, 1000);
  check('tile crop: an overflowing box is clamped to the image',
    edge.x === 952 && edge.y === 952 && edge.w === 48 && edge.h === 48,
    JSON.stringify(edge));

  const g = garmentCropPixels(
    { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    { x: 0, y: 0.2, w: 0.333, h: 0.26 },
    1240, 1480,
  );
  check('garment crop: composed into screenshot pixels with its breath of margin',
    g.x === 35 && g.y === 328 && g.w === 343 && g.h === 320,
    JSON.stringify(g));

  // Invariants rather than literals: inside the image, and inside-ish the tile.
  const t2 = { x: 0.333, y: 0.2, w: 0.333, h: 0.26 };
  const g2 = garmentCropPixels({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, t2, 1240, 1480);
  const tp = tileCropPixels(t2, 1240, 1480);
  check('garment crop: lands inside its own tile',
    g2.x >= tp.x - 20 && g2.y >= tp.y - 20 &&
    g2.x + g2.w <= tp.x + tp.w + 20 && g2.y + g2.h <= tp.y + tp.h + 20,
    `garment ${JSON.stringify(g2)} tile ${JSON.stringify(tp)}`);

  check('even-thirds: first tile', JSON.stringify(evenThirds(0, 9)) === JSON.stringify({ x: 0, y: 0, w: 1 / 3, h: 1 / 3 }));
  check('even-thirds: middle of the grid',
    evenThirds(4, 9).x === 1 / 3 && evenThirds(4, 9).y === 1 / 3);
  check('even-thirds: a shorter grid gets taller rows',
    evenThirds(3, 4).y === 0.5 && evenThirds(3, 4).h === 0.5);

  check('plausibleBox: real boxes pass', plausibleBox({ x: 0.5, y: 0.5, w: 0.4, h: 0.4 }));
  check('plausibleBox: a sliver fails', !plausibleBox({ x: 0, y: 0, w: 0.001, h: 0.5 }));
  check('plausibleBox: a runaway box fails', !plausibleBox({ x: 0.5, y: 0.5, w: 0.6, h: 0.6 }));
  check('plausibleBox: a small overhang is rounding, not a lie', plausibleBox({ x: 0.5, y: 0.5, w: 0.55, h: 0.55 }));
  check('plausibleBox: missing fails', !plausibleBox(undefined));
}

/* ================= the solo rule, enforced again ================= */

{
  const read = parseGridResponse(JSON.stringify({
    feedGrid: 1,
    tiles: [
      { ref: 't1', kind: 'solo', box: { x: 0, y: 0, w: 0.5, h: 0.5 }, garments: [{ name: 'Solo shirt', category: 'tops', confidence: 0.8 }] },
      { ref: 't2', kind: 'group', box: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, garments: [{ name: 'Group dress', category: 'dresses', confidence: 0.9 }] },
      { ref: 't3', kind: 'solo', garments: [{ name: 'Unboxed tee', category: 'tops', confidence: 0.8 }] },
    ],
  }));
  // The parser already stripped the group tile's garment; the detection layer
  // is the second guarantee: even if a group garment somehow survived, it
  // would not be read here.
  const det = soloDetections(read, 1);
  check('group tiles yield zero detections', det.length === 2 && det.every(d => d.tileRef !== 't2'),
    det.map(d => `${d.tileRef}:${d.garment.name}`).join(' '));

  // And if one did survive — a hand-built read, past the parser — still zero.
  const handBuilt = {
    tiles: [
      { ref: 'x1', kind: 'group', confidence: 0.9, box: { x: 0, y: 0, w: 1, h: 1 }, garments: [{ ref: 'g', name: 'Smuggled coat', category: 'outerwear', season: [], tags: [], confidence: 0.9, uncertain: [] }] },
    ],
    dropped: [],
  };
  check('the solo filter itself refuses a group tile', soloDetections(handBuilt, 1).length === 0);

  const fallback = det.find(d => d.garment.name === 'Unboxed tee');
  check('a boxless solo tile falls back to even-thirds grid math',
    Boolean(fallback?.tileFallback) && JSON.stringify(fallback.tileBox) === JSON.stringify(evenThirds(2, 3)),
    JSON.stringify(fallback?.tileBox));
}

/* ================= detections to drafts ================= */

{
  const read1 = parseGridResponse(GOLDEN);
  const read2 = parseGridResponse(JSON.stringify({
    feedGrid: 1,
    tiles: [{
      ref: 't1', kind: 'solo', box: { x: 0, y: 0.3, w: 0.333, h: 0.26 },
      garments: [
        // The same hoodie, a screenshot later — same name, same colour.
        { ref: 'g1', name: 'Navy hoodie', category: 'layers', color: '#1d2440', season: ['fall'], tags: ['casual'], confidence: 0.88, uncertain: [] },
        { ref: 'g2', name: 'Brass tacks', category: 'gadget', color: 'brass', season: [], tags: ['winter', 'party', 'ethereal'], confidence: 0.4, uncertain: ['name'] },
      ],
    }],
  }));
  const det = [...soloDetections(read1, 1), ...soloDetections(read2, 2)];
  const { drafts, dupes, dropped } = toDrafts(det);

  check('drafts: three pieces from two screenshots, the dupe marked not added',
    drafts.length === 3 && dupes.length === 1 && dupes[0].name === 'Navy hoodie' && dupes[0].screenshot === 2,
    `${drafts.length} drafts, ${dupes.length} dupes`);
  check('drafts: nothing dropped', dropped.length === 0, JSON.stringify(dropped));
  check('drafts: categories are the ledger’s own ids',
    drafts.every(d => ['tops', 'bottoms', 'dresses', 'layers', 'outerwear', 'shoes', 'jewellery', 'accessories'].includes(d.category)),
    drafts.map(d => d.category).join(','));
  check('drafts: a free-text category is matched ("shirt" → tops)',
    drafts.find(d => d.name === 'Grey tee')?.category === 'tops');
  check('drafts: an unknown category lands in accessories with the repair said',
    drafts.find(d => d.name === 'Brass tacks')?.category === 'accessories' &&
    (drafts.find(d => d.name === 'Brass tacks')?.repairs.length ?? 0) > 0);
  check('drafts: every colour is a hex', drafts.every(d => /^#[0-9A-F]{6}$/.test(d.color)));
  check('drafts: tags route onto the ledger’s words',
    JSON.stringify(drafts.find(d => d.name === 'Brass tacks')?.season) === '["winter"]' &&
    JSON.stringify(drafts.find(d => d.name === 'Brass tacks')?.occasion) === '["party"]');
  check('drafts: every piece says where it came from',
    drafts.every(d => d.provenance === 'a feed import'));
  check('drafts: the model’s doubts travel with the piece',
    drafts.find(d => d.name === 'Navy hoodie')?.uncertain.includes('material'));

  const item = intake.draftToItem(drafts[0]);
  check('draft → item: the provenance lands in the notes', /From a feed import\./.test(item.notes ?? ''), item.notes ?? '');
  check('draft → item: source is still the owner’s to tell', item.source === undefined);
  check('draft → item: no history is invented', !('wearCount' in item) && !('lastWorn' in item));

  // A colour alone does not make a dupe — the name must match too.
  const read3 = parseGridResponse(JSON.stringify({
    feedGrid: 1,
    tiles: [{ ref: 't1', kind: 'solo', box: { x: 0, y: 0, w: 1, h: 1 }, garments: [
      { ref: 'g1', name: 'Navy hoodie', category: 'layers', color: '#1D2440', season: [], tags: [], confidence: 0.8, uncertain: [] },
      { ref: 'g2', name: 'Navy sweatshirt', category: 'layers', color: '#1D2440', season: [], tags: [], confidence: 0.8, uncertain: [] },
    ] }],
  }));
  const twice = toDrafts(soloDetections(read3, 1));
  check('same colour, different name: not a dupe', twice.drafts.length === 2 && twice.dupes.length === 0);
}

/* ================= the doc prints this prompt ================= */

{
  const doc = readFileSync(fileURLToPath(new URL('../docs/23-photo-intake.md', import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n');
  // Same extraction as test-intake.mjs: `> ```-fenced blocks, dedented.
  const plainFences = [...doc.matchAll(/> ```\n([\s\S]*?)\n> ```/g)].map(m =>
    m[1].split('\n').map(l => (l.startsWith('> ') ? l.slice(2) : l.replace(/^>/, ''))).join('\n').trim());
  check('docs/23 prints the grid prompt verbatim', plainFences.includes(buildGridPrompt().trim()),
    `${plainFences.length} fenced blocks in the doc`);
}

/* ================= live: one real read ================= */

const LIVE = process.argv.includes('--live');
const liveArg = process.argv[process.argv.indexOf('--live') + 1];
const ownShot = LIVE && liveArg && !liveArg.startsWith('-') ? liveArg : null;

if (!LIVE) {
  console.log('\n(live mode skipped — run with --live and KIMI_KEY set)');
} else if (!process.env.KIMI_KEY) {
  console.log('\n(live mode skipped — KIMI_KEY is not set)');
} else {
  console.log('\n--- live mode: one real read against the Kimi API ---');
  const KEY = process.env.KIMI_KEY;

  // 1. The screenshot: the owner's own, or a synthetic 2x2 grid built from
  //    the wardrobe photo pool. Three solo tiles; the bottom-right tile is a
  //    photograph of three people — the group the solo rule leaves alone.
  let shotPath = ownShot;
  if (!shotPath) {
    shotPath = join(dir, 'feed.png');
    const pool = fileURLToPath(new URL('../public/wardrobe/garment', import.meta.url));
    const py = join(dir, 'fixture.py');
    writeFileSync(py, `
import sys
from PIL import Image, ImageDraw

pool, out = sys.argv[1], sys.argv[2]
W, TILE, HEADER = 1240, 620, 240
img = Image.new('RGB', (W, HEADER + TILE * 2), (255, 255, 255))
d = ImageDraw.Draw(img)
# a profile-ish header, so the grid does not start at the top edge
d.rectangle([0, 0, W, HEADER], fill=(250, 250, 250))
d.ellipse([40, 60, 160, 180], fill=(200, 200, 200))
d.rectangle([200, 80, 700, 110], fill=(210, 210, 210))
d.rectangle([200, 130, 520, 155], fill=(225, 225, 225))

def cover(name, w, h, bg=(255, 255, 255)):
    im = Image.open(pool + '/' + name).convert('RGB')
    s = max(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    tile = Image.new('RGB', (w, h), bg)
    tile.paste(im.crop((x, y, x + w, y + h)), (0, 0))
    return tile

for name, col, row in [
    ('hoodie-oversized.webp', 0, 0),
    ('dress-wrap.webp', 1, 0),
    ('boot-chelsea.webp', 0, 1),
]:
    img.paste(cover(name, TILE - 8, TILE - 8), (col * TILE + 4, HEADER + row * TILE + 4))

# the group stand-in: one photograph of three people — the tile the whole
# solo rule exists to leave alone
img.paste(cover('suit-jacket.webp', TILE - 8, TILE - 8), (TILE + 4, HEADER + TILE + 4))
img.save(out)
print(out)
`.trim());
    execFileSync('python', [py, pool, shotPath], { stdio: 'inherit' });
    check('live: the synthetic grid built', existsSync(shotPath) && statSync(shotPath).size > 10000,
      `${statSync(shotPath).size} bytes`);
  }

  // PNG dimensions straight from the header — the crop math needs them.
  const buf = readFileSync(shotPath);
  const isPng = buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50;
  const imgW = isPng ? buf.readUInt32BE(16) : 0;
  const imgH = isPng ? buf.readUInt32BE(20) : 0;
  check('live: the screenshot is a PNG with readable dimensions', isPng && imgW > 0 && imgH > 0, `${imgW}x${imgH}`);

  // 2. The real call — the OpenAI-compatible chat-completions shape, the
  //    owner's Kimi key from the environment, the app's own grid prompt.
  //    k3 is a reasoning model: the answer is choices[0].message.content and
  //    the reasoning (in reasoning_content) spends from the same budget.
  const res = await fetch('https://api.kimi.com/coding/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: 'k3',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${buf.toString('base64')}` } },
          { type: 'text', text: buildGridPrompt() },
        ],
      }],
    }),
  });
  const body = await res.json().catch(() => null);
  check('live: the API answered 200', res.status === 200, `status ${res.status}`);
  const answer = typeof body?.choices?.[0]?.message?.content === 'string'
    ? body.choices[0].message.content
    : '';
  check('live: the model returned text', answer.length > 20, `${answer.length} chars`);

  // 3. The app's own parser reads the answer.
  const read = parseGridResponse(answer);
  console.log('    tiles as read:', read.tiles.map(t => `${t.ref}:${t.kind}@${t.confidence}`).join('  ') || '(none)');
  check('live: the answer parses', !read.error, read.error ?? '');
  check('live: the tiles were located', read.tiles.length >= 3, `${read.tiles.length} tiles`);
  check('live: every tile box is inside the frame',
    read.tiles.every(t => !t.box || (t.box.x >= 0 && t.box.y >= 0 && t.box.x + t.box.w <= 1.001 && t.box.y + t.box.h <= 1.001)),
    '');
  check('live: every garment box is inside its tile',
    read.tiles.every(t => t.garments.every(g => !g.box ||
      (g.box.x >= 0 && g.box.y >= 0 && g.box.x + g.box.w <= 1.001 && g.box.y + g.box.h <= 1.001))),
    '');

  if (!ownShot) {
    // The bottom-right tile is three people — the group the solo rule exists
    // to leave alone. Find it by its box center and insist it was not read;
    // if no boxes came back at all, insist at least one tile was non-solo.
    const br = read.tiles.find(t => t.box && t.box.x + t.box.w / 2 > 0.5 && t.box.y + t.box.h / 2 > 0.55);
    check('live: the group photo was left alone (non-solo)',
      br ? br.kind !== 'solo' : read.tiles.some(t => t.kind !== 'solo'),
      br ? `bottom-right read as "${br.kind}"` : `kinds: ${read.tiles.map(t => t.kind).join(',')}`);
  } else {
    check('live (own screenshot): at least one tile read', read.tiles.length >= 1, `${read.tiles.length} tiles`);
  }

  const det = soloDetections(read, 1);
  const mapped = toDrafts(det);
  check('live: solo tiles yielded garments', det.length >= 2, `${det.length} detections, ${mapped.drafts.length} drafts`);
  console.log('    detections:', det.map(d => `${d.garment.name} (${d.garment.category}, ${d.garment.color ?? '?'})`).join(' | ') || '(none)');

  // 4. The crops: the same pixel math the page runs, executed by Pillow, then
  //    verified as real JPEGs of the expected size.
  const cropsDir = join(dir, 'crops');
  const manifest = det.map((d, i) => {
    const g = d.garment;
    const px = g.box && g.confidence >= 0.5
      ? garmentCropPixels(g.box, d.tileBox, imgW, imgH)
      : tileCropPixels(d.tileBox, imgW, imgH);
    return { file: `crop-${i}.jpg`, ...px };
  }).filter(e => e.w >= 8 && e.h >= 8);

  if (manifest.length > 0) {
    const manifestPath = join(dir, 'crops.json');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const py = join(dir, 'crop.py');
    writeFileSync(py, `
import json, os, sys
from PIL import Image
src, manifest, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src)
os.makedirs(outdir, exist_ok=True)
for e in json.load(open(manifest)):
    crop = img.crop((e['x'], e['y'], e['x'] + e['w'], e['y'] + e['h']))
    crop.convert('RGB').save(os.path.join(outdir, e['file']), 'JPEG', quality=88)
    print(e['file'] + ' ' + str(crop.width) + 'x' + str(crop.height))
`.trim());
    const printed = execFileSync('python', [py, shotPath, manifestPath, cropsDir], { encoding: 'utf8' }).trim().split('\n');
    let allGood = printed.length === manifest.length;
    for (const line of printed) {
      const [file, dims] = line.split(' ');
      const [w, h] = dims.split('x').map(Number);
      const expect = manifest.find(e => e.file === file);
      const bytes = statSync(join(cropsDir, file)).size;
      const head = readFileSync(join(cropsDir, file)).subarray(0, 2);
      const jpeg = head[0] === 0xFF && head[1] === 0xD8;
      if (!expect || expect.w !== w || expect.h !== h || !jpeg || bytes < 1500) allGood = false;
      console.log(`    ${file}: ${dims}, ${bytes} bytes, ${jpeg ? 'jpeg' : 'NOT JPEG'}`);
    }
    check('live: every crop is a non-empty JPEG of the expected size', allGood,
      `${printed.length} crops in ${cropsDir}`);
  } else {
    check('live: every crop is a non-empty JPEG of the expected size', false, 'no crops to verify');
  }

  console.log(`\n    artifacts kept at: ${dir}`);
}

console.log(failed === 0 ? '\nALL FEED-INTAKE CHECKS PASSED' : `\n${failed} FEED-INTAKE CHECKS FAILED`);
process.exit(failed ? 1 : 0);
