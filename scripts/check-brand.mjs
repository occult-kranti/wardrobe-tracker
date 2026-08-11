#!/usr/bin/env node
/**
 * Brand-contract linter for Toile.
 *
 * The panel's directives and the design contract are only real if something
 * enforces them — the judges warned that the labour-intensive details are the
 * first things cut under deadline. This runs in CI.
 *
 * Usage: node scripts/check-brand.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC).filter(f => ['.ts', '.tsx', '.css'].includes(extname(f)));
const violations = [];
const add = (file, line, rule, detail) =>
  violations.push({ file: relative(ROOT, file), line, rule, detail });

// Files allowed to define raw colour values: the token sheet, the icon/art
// studio (which paints seals and swatches), and the demo seed data.
const COLOR_ALLOWED = new Set([
  'src/index.css',
  'src/components/art.tsx',
  'src/lib/demoData.ts',
  'src/types.ts',        // PRESET_COLORS is the user-facing swatch palette
  'src/lib/similarity.ts',
  'src/lib/garmentArt.ts', // generated garment plates; artwork, like art.tsx
  'src/lib/personaData.ts', // generated closets; the hexes are garment colours
]);

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const HEX = /#[0-9a-fA-F]{6}\b/;
const BAD_RADIUS = /rounded-(sm|md|lg|xl|2xl|3xl)\b/;
const SHADOW = /\bshadow-(sm|md|lg|xl|2xl)\b/;
const BANNED_WORDS = [
  'flattering', 'slimming', 'pre-loved', 'closet detox', 'guilty pleasure',
  'wasted money', 'girlboss',
];
// Whole-word matches only, to avoid flagging "ladies" inside unrelated prose.
const BANNED_ADDRESS = /\b(ladies|babe|queen|his & hers|his and hers)\b/i;

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  if (rel !== 'src/lib/demoData.ts' && /lucide-react/.test(text)) {
    add(file, lines.findIndex(l => l.includes('lucide-react')) + 1, 'no-lucide',
      'lucide-react is banned — use src/components/icons.tsx');
  }

  lines.forEach((line, i) => {
    const n = i + 1;

    if (EMOJI.test(line)) {
      add(file, n, 'no-emoji', line.trim().slice(0, 80));
    }
    // The comment exemption used to be `!line.includes('//')`, which let a raw
    // hex through on ANY line containing a URL — an inline SVG carrying
    // xmlns="http://..." bypassed the token rule entirely. Only a line that is
    // actually a comment is exempt now.
    const trimmed = line.trim();
    const isComment =
      trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    if (!COLOR_ALLOWED.has(rel) && HEX.test(line) && !isComment) {
      add(file, n, 'no-raw-hex', `${line.trim().slice(0, 80)} — use a token`);
    }
    if (BAD_RADIUS.test(line)) {
      add(file, n, 'radius-2-only', `${line.match(BAD_RADIUS)[0]} — radius is 2px globally`);
    }
    if (SHADOW.test(line)) {
      add(file, n, 'no-drop-shadow', `${line.match(SHADOW)[0]} — depth is plate/plate-ink`);
    }
    for (const word of BANNED_WORDS) {
      if (line.toLowerCase().includes(word)) {
        add(file, n, 'banned-copy', `"${word}"`);
      }
    }
    if (BANNED_ADDRESS.test(line) && /['"`>]/.test(line)) {
      add(file, n, 'banned-address', line.trim().slice(0, 80));
    }
  });

  // Every icon in the set must carry exactly one pattern notch.
  if (rel === 'src/components/icons.tsx') {
    const blocks = text.split(/export const Icon/).slice(1);
    for (const block of blocks) {
      const name = block.match(/^(\w+)/)?.[1] ?? '?';
      if (['Eyelet', 'EyeletFilled'].includes(name)) continue;
      const notches = (block.match(/<Notch/g) || []).length;
      if (notches !== 1) {
        add(file, 0, 'one-notch-per-icon', `Icon${name} has ${notches} notches, needs exactly 1`);
      }
    }
  }
}

// Exclamation-point budget: roughly one for the whole app.
let bangs = 0;
for (const file of files.filter(f => extname(f) === '.tsx')) {
  const text = readFileSync(file, 'utf8');
  // Only count them inside visible string/JSX text, not in code like `!x`.
  for (const m of text.matchAll(/["'`>][^"'`<>]{4,}?!(?:["'`<]|\s)/g)) {
    bangs++;
    if (bangs > 1) add(file, 0, 'exclamation-budget', m[0].trim().slice(0, 60));
  }
}

const byRule = violations.reduce((acc, v) => {
  (acc[v.rule] ||= []).push(v);
  return acc;
}, {});

if (violations.length === 0) {
  console.log(`Brand contract: clean across ${files.length} files.`);
  process.exit(0);
}

console.log(`Brand contract: ${violations.length} violation(s) across ${files.length} files.\n`);
for (const [rule, list] of Object.entries(byRule)) {
  console.log(`${rule} (${list.length}):`);
  for (const v of list.slice(0, 12)) {
    console.log(`  ${v.file}${v.line ? `:${v.line}` : ''} — ${v.detail}`);
  }
  if (list.length > 12) console.log(`  …and ${list.length - 12} more`);
  console.log();
}
process.exit(1);
