#!/usr/bin/env node
/**
 * The model bake-off: the app's own intake prompt, the house relay, and real
 * wardrobe photographs. Times each candidate model and checks the answer
 * actually parses with the app's own reader, then prints what each model
 * said it found so quality can be compared piece by piece.
 *
 *   node scripts/model-bakeoff.mjs            # the standing candidates
 *   node scripts/model-bakeoff.mjs --trials 3 # more repetitions, less noise
 *
 * No key is needed and none should be given: the relay holds the provider
 * keys server-side and routes a `claude*` model to Anthropic. Requires the
 * Pillow venv (see requirements.txt) — the photographs are prepared exactly
 * as the app prepares them, longest edge 1400, JPEG q88.
 *
 * Written for the model-policy review: a model is switched on measurement,
 * never on assumption. Re-run it the next time the lineup moves.
 */
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PY = process.platform === 'win32'
  ? join(ROOT, '.venv', 'Scripts', 'python.exe')
  : join(ROOT, '.venv', 'bin', 'python');
const RELAY = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';
const MAX_TOKENS = 8000; // what src/lib/anthropic.ts sends today

const TRIALS = Number(process.argv[process.argv.indexOf('--trials') + 1]) || 2;

const dir = mkdtempSync(join(tmpdir(), 'bakeoff-'));
await build({ alias: sharedAliases(),
  entryPoints: { intake: join(ROOT, 'packages/shared/intake.ts'), intakePrompt: join(ROOT, 'src/lib/intakePrompt.ts') },
  bundle: true, format: 'esm', outdir: dir, logLevel: 'error',
});
const intake = await import(pathToFileURL(join(dir, 'intake.js')).href);
const P = await import(pathToFileURL(join(dir, 'intakePrompt.js')).href);

/**
 * Each photograph is read with the prompt the app would actually use for it:
 * a wardrobe laid out gets INTAKE_PROMPT, one outfit as worn gets
 * OUTFIT_PROMPT. Reading a worn outfit with the cataloguing prompt is what
 * an unfair bake-off looks like — the model answers correctly and the
 * reader finds nothing.
 */
const PROMPT_FOR = {
  'bed.png': P.INTAKE_PROMPT,
  'todaysoutfit1.png': P.OUTFIT_PROMPT,
  'todaysoutfit2.png': P.OUTFIT_PROMPT,
  'test2.png': P.OUTFIT_PROMPT,
};

/* The garment photographs — the ones that actually carry clothes. */
const NAMES = ['bed.png', 'todaysoutfit1.png', 'todaysoutfit2.png', 'test2.png'];
const PHOTOS = NAMES.map(n => join(ROOT, 'test_images', n)).filter(existsSync);

function prepare(file) {
  const out = join(dir, `prep-${file.split(/[\\/]/).pop()}.jpg`);
  execFileSync(PY, ['-c', `
import sys
from PIL import Image
img = Image.open(sys.argv[1]).convert('RGB')
s = min(1, 1400 / max(img.width, img.height))
img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))))
img.save(sys.argv[2], 'JPEG', quality=88)
`.trim(), file, out], { encoding: 'utf8' });
  return readFileSync(out).toString('base64');
}

/**
 * Thinking is ON by default on the 5-series and spends from the same
 * max_tokens as the answer — so the candidates are timed with it off, which
 * is the shape the app would actually ship.
 */
const CONFIGS = [
  // Fable 5 thinks always; `thinking:{type:'disabled'}` is a 400 on it. Thinking
  // spends from the same max_tokens as the answer, so headroom is the only lever
  // — which is why the shipped ceiling is 16000, not 8000.
  { label: 'fable-5 (current)', model: 'claude-fable-5', extra: {}, maxTokens: 16000 },
  { label: 'opus-5 think-off', model: 'claude-opus-5', extra: { thinking: { type: 'disabled' } } },
  // The previous default, kept as the baseline any new candidate has to beat.
  { label: 'sonnet-4-5 (was)', model: 'claude-sonnet-4-5', extra: {} },
];

const prepared = Object.fromEntries(PHOTOS.map(p => [p.split(/[\\/]/).pop(), prepare(p)]));
console.log(`photographs: ${Object.keys(prepared).join(', ')}`);
console.log(`max_tokens: ${MAX_TOKENS} · trials per cell: ${TRIALS}\n`);

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const results = [];

for (const cfg of CONFIGS) {
  for (const [name, b64] of Object.entries(prepared)) {
    for (let t = 0; t < TRIALS; t++) {
      const body = {
        model: cfg.model, max_tokens: cfg.maxTokens ?? MAX_TOKENS, ...cfg.extra,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: PROMPT_FOR[name] ?? P.INTAKE_PROMPT },
          ],
        }],
      };
      const t0 = Date.now();
      const row = { config: cfg.label, photo: name, trial: t };
      try {
        const res = await fetch(RELAY, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        row.ms = Date.now() - t0;
        const txt = await res.text();
        row.status = res.status;
        if (!res.ok) { row.error = txt.slice(0, 160); }
        else {
          const json = JSON.parse(txt);
          const text = (json.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim();
          const read = intake.readIntake(text);
          row.stop = json.stop_reason;
          row.outTok = json.usage?.output_tokens;
          row.pieces = read.drafts?.length ?? 0;
          row.skips = read.skips?.length ?? 0;
          row.names = (read.drafts ?? []).map(d => d.name);
        }
      } catch (e) { row.ms = Date.now() - t0; row.error = String(e).slice(0, 160); }
      results.push(row);
      process.stdout.write(
        `${row.config.padEnd(22)} ${name.padEnd(18)} t${t} ${String(row.ms + 'ms').padEnd(9)} ` +
        (row.error ? `ERROR ${row.error}` : `pieces=${row.pieces} skips=${row.skips} stop=${row.stop} out=${row.outTok}`) + '\n'
      );
    }
  }
}

console.log('\n=== median latency per photograph (ms) ===');
const head = ['config', ...Object.keys(prepared)];
console.log(head.map((h, i) => (i ? h.padEnd(18) : h.padEnd(22))).join(''));
for (const cfg of CONFIGS) {
  const cells = Object.keys(prepared).map(n => {
    const ok = results.filter(r => r.config === cfg.label && r.photo === n && !r.error);
    return ok.length ? String(median(ok.map(r => r.ms))).padEnd(18) : 'ERR'.padEnd(18);
  });
  console.log(cfg.label.padEnd(22) + cells.join(''));
}

console.log('\n=== what each model found (first trial) ===');
for (const n of Object.keys(prepared)) {
  console.log(`\n· ${n}`);
  for (const cfg of CONFIGS) {
    const r = results.find(x => x.config === cfg.label && x.photo === n && x.trial === 0);
    console.log(`   ${cfg.label.padEnd(22)} ${r?.error ? 'ERROR' : (r.names?.length ? r.names.join(' | ') : `(nothing — ${r.skips} skips)`)}`);
  }
}

console.log('\n=== verdict inputs ===');
for (const cfg of CONFIGS) {
  const ok = results.filter(r => r.config === cfg.label && !r.error);
  const all = results.filter(r => r.config === cfg.label);
  const overall = ok.length ? median(ok.map(r => r.ms)) : 0;
  const pieces = ok.reduce((s, r) => s + (r.pieces ?? 0), 0);
  console.log(`${cfg.label.padEnd(22)} medianAll=${String(overall + 'ms').padEnd(9)} totalPieces=${String(pieces).padEnd(4)} errors=${all.length - ok.length}`);
}
