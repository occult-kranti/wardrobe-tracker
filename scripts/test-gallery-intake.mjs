#!/usr/bin/env node
/**
 * The gallery-intake suite: the single-photo prompt, the merge and dedupe of
 * several per-photograph reads, the crop math, and the background lift's
 * guard rails — and, when asked, a live run over the real photographs in
 * test_images/ against the Kimi API.
 *
 * Pure mode runs everywhere:
 *
 *   node scripts/test-gallery-intake.mjs
 *
 * Live mode asks the house relay, which holds the key server-side — nothing
 * to set in the environment:
 *
 *   node scripts/test-gallery-intake.mjs --live
 *
 * Live mode reads each photograph with the app's own prompt, crops along the
 * returned boxes with Pillow, then runs the on-device background lift (the
 * real cutout.ts, in a real browser via playwright) on each roomy crop. The
 * crops and lifts land in a temp dir whose path is printed — they are meant
 * to be looked at, not just asserted.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'galleryintake-'));
await build({ alias: sharedAliases(),
  entryPoints: {
    feedIntake: fileURLToPath(new URL('../src/lib/feedIntake.ts', import.meta.url)),
    intake: fileURLToPath(new URL('../packages/shared/intake.ts', import.meta.url)),
    cutout: fileURLToPath(new URL('../src/lib/cutout.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});
const FI = await import(pathToFileURL(join(dir, 'feedIntake.js')).href);
const intake = await import(pathToFileURL(join(dir, 'intake.js')).href);
const cutout = await import(pathToFileURL(join(dir, 'cutout.js')).href);

const { buildPhotoPrompt, galleryDrafts, photoCropPixels } = FI;
const { readIntake } = intake;
const { frameIsUniform } = cutout;

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

/* ================= the prompt ================= */

{
  const p = buildPhotoPrompt();
  check('the photo prompt is substantial', p.length > 1500, `${p.length} chars`);
  check('the photo prompt demands JSON only', /ONLY a JSON\s*\n?\s*object/.test(p) && /no markdown\s*\n?\s*fences/i.test(p));
  check('the photo prompt refuses to describe the person', /never the person/.test(p));
  check('the photo prompt leaves two-or-more-people photos alone', /TWO OR MORE\s*\n?\s*people/.test(p) && /empty\s*\n?\s*"pieces" list/.test(p));
  check('the photo prompt requires the box and says why', /BOX is required/.test(p) && /crops the photograph along/.test(p));
  check('the photo prompt asks about the background for the lift',
    /BACKGROUND is one word/.test(p) && ['plain', 'busy', 'none'].every(w => p.includes(w)));
  check('the photo prompt names the ledger categories',
    ['tops', 'bottoms', 'dresses', 'layers', 'outerwear', 'shoes', 'jewellery', 'accessories'].every(c => p.includes(c)));
  check('the photo prompt asks for doubts, stated', /"uncertain"/.test(p) && /openly unsure than\s*\n?\s*smoothly wrong/.test(p));
  check('the photo prompt prints its shape', p.includes('"toileIntake": 1') && p.includes('"pieces"'));
}

/* ================= the merge, on golden reads ================= */

const photo = (n, pieces, skipped = []) => JSON.stringify({ toileIntake: 1, photos: [{ n }], pieces, skipped });

{
  const read1 = readIntake(photo(1, [
    {
      ref: 'p1', photo: 1, name: 'Navy hoodie', category: 'layers',
      description: 'Navy cotton fleece hoodie with a kangaroo pocket.',
      color: '#1D2440', colorName: 'navy', season: ['fall', 'winter'], occasion: ['casual'],
      confidence: 0.9, uncertain: ['material'], background: 'plain', box: [0.1, 0.1, 0.5, 0.6],
    },
    {
      ref: 'p2', photo: 1, name: 'Grey tee', category: 'shirt',
      description: 'Grey marl tee with a crew neck.',
      color: '#9A9A9A', colorName: 'grey', season: [], occasion: ['casual'],
      confidence: 0.7, background: 'busy', box: [0.55, 0.2, 0.3, 0.4],
    },
  ], [{ reason: 'too dark to name', note: 'a pile in the corner' }]));
  const read2 = readIntake(photo(2, [
    {
      // The same hoodie, a photograph later — same name, same colour.
      ref: 'p1', photo: 1, name: 'Navy hoodie', category: 'layers',
      description: 'Navy hoodie on a hanger.',
      color: '#1d2440', colorName: 'navy', season: ['fall'], occasion: ['casual'],
      confidence: 0.8, background: 'plain', box: [0.2, 0.1, 0.4, 0.7],
    },
    {
      ref: 'p2', photo: 1, name: 'Brass tacks', category: 'gadget',
      description: 'A jar of brass tacks.',
      color: 'brass', season: [], occasion: [], confidence: 0.4, uncertain: ['name'],
      box: [0.7, 0.7, 0.1, 0.1],
    },
  ]));

  check('golden reads parse', !read1.error && !read2.error, (read1.error ?? '') + (read2.error ?? ''));
  const { drafts, dupes, skipped, dropped } = galleryDrafts([
    { n: 1, read: read1 },
    { n: 2, read: read2 },
  ]);

  check('merge: three pieces from two photographs, the dupe marked not added',
    drafts.length === 3 && dupes.length === 1 && dupes[0].name === 'Navy hoodie' && dupes[0].photo === 2,
    `${drafts.length} drafts, ${dupes.length} dupes`);
  check('merge: refs are re-keyed unique across photographs',
    JSON.stringify(drafts.map(d => d.ref)) === JSON.stringify(['g1-p1', 'g1-p2', 'g2-p2']),
    drafts.map(d => d.ref).join(','));
  check('merge: the photo number travels with the draft',
    drafts.map(d => d.photo).join(',') === '1,1,2');
  check('merge: every piece says where it came from',
    drafts.every(d => d.provenance === 'a gallery import'));
  check('merge: boxes survive the merge', drafts.every(d => Array.isArray(d.box) && d.box.length === 4));
  check('merge: a free-text category is matched ("shirt" → tops)',
    drafts.find(d => d.name === 'Grey tee')?.category === 'tops');
  check('merge: an unknown category lands in accessories with the repair said',
    drafts.find(d => d.name === 'Brass tacks')?.category === 'accessories' &&
    (drafts.find(d => d.name === 'Brass tacks')?.repairs.length ?? 0) > 0);
  check('merge: the model’s doubts travel with the piece',
    drafts.find(d => d.name === 'Navy hoodie')?.uncertain.includes('material'));
  check('merge: skips keep their photograph number',
    skipped.length === 1 && skipped[0].photo === 1 && /too dark/.test(skipped[0].reason));
  check('merge: nothing usable is dropped', dropped.length === 0, JSON.stringify(dropped));

  const item = intake.draftToItem(drafts[0]);
  check('draft → item: the provenance lands in the notes', /From a gallery import\./.test(item.notes ?? ''), item.notes ?? '');

  // A colour alone does not make a dupe — the name must match too.
  const read3 = readIntake(photo(3, [
    { ref: 'p1', name: 'Navy sweatshirt', category: 'layers', description: 'Navy sweatshirt.', color: '#1D2440', season: [], occasion: [], confidence: 0.8, box: [0, 0, 0.5, 0.5] },
  ]));
  const twice = galleryDrafts([{ n: 1, read: read1 }, { n: 3, read: read3 }]);
  check('same colour, different name: not a dupe', twice.drafts.length === 3 && twice.dupes.length === 0);
}

/* ================= the crop math ================= */

{
  // Hand-checked: 2% of the box's own size added around it, clamped.
  const px = photoCropPixels([0.12, 0.3, 0.26, 0.34], 1240, 1480);
  check('photo crop: bleed math is exact',
    px.x === 142 && px.y === 434 && px.w === 336 && px.h === 523,
    JSON.stringify(px));

  const edge = photoCropPixels([0.95, 0.95, 0.1, 0.1], 1000, 1000);
  check('photo crop: an overflowing box is clamped to the image',
    edge.x >= 0 && edge.y >= 0 && edge.x + edge.w <= 1000 && edge.y + edge.h <= 1000,
    JSON.stringify(edge));

  const roomy = photoCropPixels([0.4, 0.4, 0.2, 0.2], 1000, 1000, 0.12);
  const tight = photoCropPixels([0.4, 0.4, 0.2, 0.2], 1000, 1000);
  check('photo crop: the lift margin is wider than the display bleed',
    roomy.w > tight.w && roomy.h > tight.h, `roomy ${roomy.w} vs tight ${tight.w}`);
}

/* ================= the lift's guard rails ================= */

{
  const uniform = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < uniform.length; i += 4) { uniform[i] = 200; uniform[i + 1] = 195; uniform[i + 2] = 190; uniform[i + 3] = 255; }
  check('guard: a uniform frame has nothing to estimate', frameIsUniform(uniform, 64, 64) === true);

  // Quiet JPEG-ish noise on a flat wall is still not a garment photograph.
  const wall = new Uint8ClampedArray(64 * 64 * 4);
  let seed = 7;
  for (let i = 0; i < wall.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const n = (seed % 5) - 2; // ±2 per channel
    wall[i] = 200 + n; wall[i + 1] = 196 + n; wall[i + 2] = 192 + n; wall[i + 3] = 255;
  }
  check('guard: a flat wall under noise is still degenerate', frameIsUniform(wall, 64, 64) === true);

  // A garment-shaped step: half the frame a different colour entirely.
  const garment = new Uint8ClampedArray(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const at = (y * 64 + x) * 4;
    const dark = x >= 16 && x < 48 && y >= 8 && y < 56;
    garment[at] = dark ? 30 : 210; garment[at + 1] = dark ? 36 : 204; garment[at + 2] = dark ? 64 : 198; garment[at + 3] = 255;
  }
  check('guard: a real subject is worth attempting', frameIsUniform(garment, 64, 64) === false);

  check('guard: a too-small frame is degenerate', frameIsUniform(uniform, 1, 1) === true);
}

/* ================= the doc prints this prompt ================= */

{
  const doc = readFileSync(fileURLToPath(new URL('../docs/23-photo-intake.md', import.meta.url)), 'utf8')
    .replace(/\r\n/g, '\n');
  // Same extraction as test-intake.mjs: `> ```-fenced blocks, dedented.
  const plainFences = [...doc.matchAll(/> ```\n([\s\S]*?)\n> ```/g)].map(m =>
    m[1].split('\n').map(l => (l.startsWith('> ') ? l.slice(2) : l.replace(/^>/, ''))).join('\n').trim());
  check('docs/23 prints the gallery prompt verbatim', plainFences.includes(buildPhotoPrompt().trim()),
    `${plainFences.length} fenced blocks in the doc`);
}

/* ================= live: the real photographs, the real API ================= */

const LIVE = process.argv.includes('--live');

if (!LIVE) {
  console.log('\n(live mode skipped — run with --live; the relay holds the key)');
} else {
  console.log('\n--- live mode: the real test_images through the relay (Claude Fable 5) ---');
  // No key here and none needed: the relay (supabase/functions/ai-proxy) holds
  // the provider keys server-side and routes a `claude*` model to Anthropic.
  const RELAY = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';
  const MODEL = 'claude-fable-5';
  const SRC = fileURLToPath(new URL('../test_images', import.meta.url));
  const NAMES = ['todaysoutfit1.png', 'todaysoutfit2.png', 'test.png', 'test2.png', 'bed.png'];
  const files = NAMES.map(n => join(SRC, n)).filter(f => existsSync(f));
  check('live: the test photographs are present', files.length === NAMES.length, `${files.length} of ${NAMES.length}`);

  // The browser-side lift: the real cutout.ts as an iife, in a real browser.
  const iife = join(dir, 'cutout.iife.js');
  await build({ alias: sharedAliases(),
    entryPoints: [fileURLToPath(new URL('../src/lib/cutout.ts', import.meta.url))],
    bundle: true, format: 'iife', globalName: 'cutoutLib', outfile: iife, logLevel: 'error',
  });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const liftPage = await (await browser.newContext()).newPage();
  await liftPage.addScriptTag({ path: iife });

  const liftOne = dataUrl => liftPage.evaluate(async src => {
    const img = await new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('would not open'));
      el.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const lift = await window.cutoutLib.liftBackground(canvas);
    return lift ? { url: lift.url, covered: lift.covered, fit: lift.fit } : null;
  }, dataUrl);

  const rows = [];
  let totalPieces = 0;
  for (const file of files) {
    const name = file.split(/[\\/]/).pop();
    // Prepare exactly as the app does: longest edge 1400, JPEG.
    const prepared = join(dir, `prepared-${name}.jpg`);
    execFileSync('python', ['-c', `
import sys
from PIL import Image
img = Image.open(sys.argv[1]).convert('RGB')
s = min(1, 1400 / max(img.width, img.height))
img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))))
img.save(sys.argv[2], 'JPEG', quality=88)
print(str(img.width) + 'x' + str(img.height))
`.trim(), file, prepared], { encoding: 'utf8' }).trim();
    const buf = readFileSync(prepared);
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8;
    const imgW = buf.length && isJpeg ? readJpegDims(buf).w : 0;
    const imgH = buf.length && isJpeg ? readJpegDims(buf).h : 0;

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
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } },
            { type: 'text', text: buildPhotoPrompt() },
          ],
        }],
      }),
    });
    const body = await res.json().catch(() => null);
    const answer = ((body?.content ?? []).filter(b => b?.type === 'text').map(b => b.text).join('\n')).trim();
    check(`live: ${name} answered 200 with text`, res.status === 200 && answer.length > 10,
      `status ${res.status}, ${answer.length} chars`);

    const read = readIntake(answer);
    check(`live: ${name} parses as an intake file`, !read.error, read.error ?? '');
    check(`live: ${name} boxes stay inside the frame`,
      read.drafts.every(d => !d.box || (d.box[0] >= 0 && d.box[1] >= 0 && d.box[0] + d.box[2] <= 1.001 && d.box[1] + d.box[3] <= 1.001)), '');
    totalPieces += read.drafts.length;

    // The crops, with the app's own pixel math, cut by Pillow; the lifts, with
    // the app's own pass, cut by the browser.
    const cropsDir = join(dir, `crops-${name}`);
    const manifest = read.drafts.filter(d => d.box).map((d, i) => ({
      file: `${i + 1}-${d.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`,
      ref: d.ref,
      background: d.background ?? '?',
      ...photoCropPixels(d.box, imgW, imgH),
      roomy: photoCropPixels(d.box, imgW, imgH, 0.12),
    })).filter(e => e.w >= 8 && e.h >= 8);
    let cropped = 0;
    let lifted = 0;
    if (manifest.length) {
      const manifestPath = join(dir, `manifest-${name}.json`);
      writeFileSync(manifestPath, JSON.stringify(manifest));
      execFileSync('python', ['-c', `
import json, os, sys
from PIL import Image
src, manifest, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src)
os.makedirs(outdir, exist_ok=True)
for e in json.load(open(manifest)):
    for tag, b in (('', e), ('roomy-', e['roomy'])):
        c = img.crop((b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']))
        s = min(1, 520 / max(c.width, c.height))
        c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))))
        c.convert('RGB').save(os.path.join(outdir, tag + e['file']), 'JPEG', quality=88)
`.trim(), prepared, manifestPath, cropsDir], { encoding: 'utf8' });
      for (const e of manifest) {
        const f = join(cropsDir, e.file);
        const head = existsSync(f) ? readFileSync(f).subarray(0, 2) : null;
        // A bracelet crops to a sliver — small is fine, empty is not.
        if (head && head[0] === 0xFF && head[1] === 0xD8 && statSync(f).size > 400) cropped++;
        // The lift is attempted where the page would attempt it: ground the
        // model did not call busy, on the roomy crop. A null is the honest
        // fallback — the clean crop stays.
        if (e.background === 'busy') continue;
        const roomy = readFileSync(join(cropsDir, `roomy-${e.file}`));
        const lift = await liftOne(`data:image/jpeg;base64,${roomy.toString('base64')}`);
        if (lift) {
          const out = join(cropsDir, `lifted-${e.file.replace(/\.jpg$/, '.png')}`);
          writeFileSync(out, Buffer.from(lift.url.split(',')[1], 'base64'));
          const png = readFileSync(out);
          if (png[0] === 0x89 && png[1] === 0x50 && statSync(out).size > 1500) lifted++;
          console.log(`      lift ${e.file}: covered ${lift.covered.toFixed(2)}, fit ${lift.fit.toFixed(2)}, ${Math.round(statSync(out).size / 1024)}KB`);
        }
      }
    }
    check(`live: ${name} crops are real JPEGs`, manifest.length === 0 || cropped === manifest.length,
      `${cropped}/${manifest.length}`);
    rows.push({
      file: name,
      pieces: read.drafts.length,
      skipped: read.skipped.length,
      crops: `${cropped}/${manifest.length}`,
      lifted,
      names: read.drafts.map(d => d.name).join(' | '),
    });
  }

  check('live: the run found garments somewhere', totalPieces > 0, `${totalPieces} pieces`);
  console.log('\n    file              pieces  skipped  crops  lifted');
  for (const r of rows) {
    console.log(`    ${r.file.padEnd(18)} ${String(r.pieces).padEnd(7)} ${String(r.skipped).padEnd(8)} ${String(r.crops).padEnd(6)} ${r.lifted}`);
    if (r.names) console.log(`      ${r.names}`);
  }
  console.log(`\n    artifacts kept at: ${dir}`);

  await browser.close();
}

/** JPEG dimensions from the header — the crop math needs them. */
function readJpegDims(buf) {
  let at = 2;
  while (at + 9 < buf.length) {
    if (buf[at] !== 0xFF) { at++; continue; }
    const marker = buf[at + 1];
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      return { h: buf.readUInt16BE(at + 5), w: buf.readUInt16BE(at + 7) };
    }
    at += 2 + buf.readUInt16BE(at + 2);
  }
  return { w: 0, h: 0 };
}

console.log(failed === 0 ? '\nALL GALLERY-INTAKE CHECKS PASSED' : `\n${failed} GALLERY-INTAKE CHECKS FAILED`);
process.exit(failed ? 1 : 0);
