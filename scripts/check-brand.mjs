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

/* Control bytes written raw into source.
   This has now cost this repo twice. A heredoc once emitted a literal 0x08
   where `\b` was meant, turning /\btie\b/ into a regex containing a backspace
   character — unmatchable, and it silently blanked two garment tiles. And
   Statistics.tsx carried two raw NUL bytes as sentinel prefixes, which made
   `file` classify the app's largest page as binary data, so grep, git grep and
   ripgrep all returned nothing for it — a sweep that fixed four horizontal
   scrollers missed the fifth because the file was invisible to search.
   Both are invisible in an editor and in review. Write the escape, not the byte. */
// Written with charCodeAt rather than a character class, because a regex for
// this needs backslash escapes and the first draft of this very check had its
// escapes written as the raw bytes they were meant to forbid.
const controlByteAt = s => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 9 || c === 11 || c === 12 || (c > 13 && c < 32) || c === 127) return c;
  }
  return -1;
};

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  const bad = controlByteAt(text);
  if (bad >= 0) {
    add(file, lines.findIndex(l => controlByteAt(l) >= 0) + 1, 'no-raw-control-bytes',
      `0x${bad.toString(16).padStart(2, '0')} written raw — use the escape sequence`);
  }

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

/* Every room declares every colour.
   A theme block that omits a token does not fail, and does not fall back to
   anything sensible — it silently inherits the LIGHT room's value, so a dark
   theme missing one line ships an ink-on-ink surface that no page-level review
   catches because every other page looks right. Two themes have already been
   added by hand here and a third is coming; this is the check that makes adding
   one an all-or-nothing act. */
{
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  const blockOf = selector => {
    const at = css.indexOf(selector);
    if (at < 0) return null;
    // Anchored at the selector itself, not past it: the light room's selector is
    // written `:root {` WITH its brace, so skipping `selector.length` stepped
    // over that brace and matched the next block down the file — which is the
    // dark room. The token-presence check above has been comparing the dark
    // room against itself since it was written, and only passed because the two
    // happen to declare the same names.
    const open = css.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) return css.slice(open, i);
    }
    return null;
  };
  const tokensIn = body =>
    new Set((body ?? '').match(/--color-[\w-]+(?=\s*:)/g) ?? []);

  const base = tokensIn(blockOf(':root {'));
  // The media-query block is nested, so address the selector inside it.
  const rooms = [
    ['prefers-color-scheme: dark', ':root:not([data-theme="light"])'],
    ['data-theme="dark"', ':root[data-theme="dark"]'],
    ['data-theme="salon"', ':root[data-theme="salon"]'],
    ['data-theme="gilt"', ':root[data-theme="gilt"]'],
    ['data-theme="dyehouse"', ':root[data-theme="dyehouse"]'],
    ['data-theme="obsidian"', ':root[data-theme="obsidian"]'],
  ];
  for (const [name, selector] of rooms) {
    const body = blockOf(selector);
    if (body === null) continue; // a room that does not exist yet is not a fault
    const missing = [...base].filter(t => !tokensIn(body).has(t));
    if (missing.length) {
      add(join(SRC, 'index.css'), 0, 'every-room-declares-every-colour',
        `${name} omits ${missing.join(', ')} — it will inherit the light room's value`);
    }
  }

  /* The dark room is declared TWICE — once for `prefers-color-scheme` and once
     for an explicit `data-theme="dark"` — with values that must stay identical.
     Checking presence is not enough: edit one block and forget the other and the
     app ships a split-brain dark theme where choosing dark explicitly looks
     different from having it chosen for you. Nothing else would fail. */
  const valuesIn = body => {
    const out = new Map();
    for (const mm of (body ?? '').matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) {
      out.set(mm[1], mm[2].trim());
    }
    return out;
  };
  const auto = valuesIn(blockOf(':root:not([data-theme="light"])'));
  const explicit = valuesIn(blockOf(':root[data-theme="dark"]'));
  for (const [token, value] of auto) {
    const other = explicit.get(token);
    // Comments live in the value capture; compare the colour, not the prose.
    const clean = v => (v ?? '').split('/*')[0].trim();
    if (other !== undefined && clean(other) !== clean(value)) {
      add(join(SRC, 'index.css'), 0, 'the-dark-room-agrees-with-itself',
        `${token} is ${clean(value)} under prefers-color-scheme but ${clean(other)} under data-theme="dark"`);
    }
  }

  /* The favicons are the MARK, so they carry the seal colour, and they live
     outside src/ where the token rule cannot reach them. Worse, index.html
     URL-encodes its hex as %23BE1231, which the raw-hex pattern cannot match
     even if it did look there. Two layers of invisibility over the one colour a
     user sees before the app has loaded. */
  // Derived from the token sheet rather than listed here, so that changing a
  // token forces the icons to follow instead of quietly diverging: the mark may
  // be painted in the seal, the two grounds, ink, or chalk. Nothing else.
  const hexOf = (body, token) =>
    (body ?? '').match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toUpperCase();
  const light = blockOf(':root {');
  const night = blockOf(':root[data-theme="dark"]');
  const seal = hexOf(light, '--color-seal');
  const allowed = new Set(
    [
      seal,
      hexOf(light, '--color-bg'),
      hexOf(night, '--color-bg'),
      hexOf(light, '--color-text'),
      hexOf(light, '--color-chalk'),
    ].filter(Boolean)
  );
  if (seal) {
    for (const rel of ['index.html', 'public/icon.svg', 'public/icon-maskable.svg']) {
      let text;
      try {
        text = readFileSync(join(ROOT, rel), 'utf8');
      } catch {
        continue;
      }
      const found = [...text.replace(/%23/g, '#').matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0].toUpperCase());
      const strays = found.filter(h => !allowed.has(h));
      if (strays.length) {
        add(join(ROOT, rel), 0, 'the-mark-is-the-seal-colour',
          `${[...new Set(strays)].join(', ')} — the app icons carry --color-seal (${seal}), the grounds, ink or chalk`);
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
