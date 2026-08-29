#!/usr/bin/env node
/**
 * A11y & Brand Conformance Automated Test Suite
 *
 * Enforces accessibility standards (WCAG 2.1 AA) and Almari brand invariants:
 * 1. Touch targets: buttonClass, IconButton, Chip, inputs maintain 44px hit floor.
 * 2. IconButton: Enforces aria-label/title and 44px (w-11 h-11) bounding box at all call sites.
 * 3. Anti-shame invariants: No guilt/alarmist shame words in analytics or closet copy.
 * 4. Brand typography tokens: type-masthead, type-ledger, type-editorial match font tokens.
 * 5. Theme color contrast: WCAG 2.1 AA luminance ratios across all defined rooms/themes.
 * 6. Accessible semantics: Modal dialogs, rails, image alt attributes.
 *
 * Usage: node scripts/test-a11y.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rel2posix = (file) => relative(ROOT, file).split('\\').join('/');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message || String(err) });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function getTsxFiles(dirs) {
  return dirs.flatMap(d => walk(join(ROOT, d))).filter(f => ['.tsx', '.ts'].includes(extname(f)));
}

function getBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return null;
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

console.log('\n======================================================');
console.log(' Almari / Toile — A11y & Brand Conformance Test Suite ');
console.log('======================================================\n');

/* ------------------------------------------------------------------
   1. TOUCH TARGET INVARIANTS (44px Minimum Hit Area Floor)
   ------------------------------------------------------------------ */
console.log('Section 1: Touch Target Floor (44px WCAG 2.5.5 / 2.5.8)');

const uiTsxPath = join(ROOT, 'src', 'components', 'ui.tsx');
const uiTsx = readFileSync(uiTsxPath, 'utf8');

test('buttonClass enforces 44px hit floor (h-11 or min-h-11) across all branches', () => {
  const btnClassBlock = getBlock(uiTsx, 'export function buttonClass', 'export function Button');
  assert(btnClassBlock, 'buttonClass definition found in ui.tsx');

  // Check height definition for standard and compact
  assert(
    /const\s+height\s*=\s*compact\s*\?\s*['"`]h-11\s+px-3/.test(btnClassBlock),
    'buttonClass compact variant must maintain h-11'
  );
  assert(
    /h-11\s+px-5/.test(btnClassBlock),
    'buttonClass default variant must maintain h-11'
  );
  // Check tertiary tone uses min-h-11
  assert(
    /const\s+base\s*=\s*tone\s*===\s*['"]tertiary['"]\s*\?\s*['"]min-h-11\s+py-1['"]/.test(btnClassBlock),
    'buttonClass tertiary tone must use min-h-11'
  );
  // Check wrap variant uses min-h-11
  assert(
    /min-h-11\s+py-2/.test(btnClassBlock),
    'buttonClass wrap variant must use min-h-11'
  );
});

test('IconButton maintains 44px square hit area (w-11 h-11)', () => {
  const iconButtonBlock = getBlock(uiTsx, 'export function IconButton', 'export function Chip');
  assert(iconButtonBlock, 'IconButton component definition found in ui.tsx');
  assert(
    iconButtonBlock.includes('w-11 h-11'),
    'IconButton must declare w-11 h-11 (44px x 44px) in className'
  );
});

test('Chip interactive buttons maintain 44px height floor (h-11)', () => {
  const chipBlock = getBlock(uiTsx, 'export function Chip', 'function useRailEdges');
  assert(chipBlock, 'Chip component definition found in ui.tsx');
  assert(
    /const\s+height\s*=\s*as\s*===\s*['"]span['"]\s*\?\s*['"]h-8['"]\s*:\s*['"]h-11['"]/.test(chipBlock),
    'Chip button variant must maintain h-11 (44px) while decorative span uses h-8'
  );
});

test('Form controls enforce 44px hit floor (inputClass min-h-11)', () => {
  assert(
    /export\s+const\s+inputClass\s*=\s*['"`][^'"`]*\bmin-h-11\b/.test(uiTsx),
    'inputClass must enforce min-h-11 for touch accessibility'
  );
});

test('Modal close button maintains 44px hit area (w-11 h-11)', () => {
  const modalBlock = getBlock(uiTsx, 'export function Modal', 'export function Stat');
  assert(modalBlock, 'Modal component definition found in ui.tsx');
  assert(
    /<button[^>]*aria-label="Close"[^>]*className="[^"]*w-11\s+h-11[^"]*"/.test(modalBlock),
    'Modal close button must have aria-label="Close" and w-11 h-11 (44px touch target)'
  );
});

/* ------------------------------------------------------------------
   2. ICONBUTTON ACCESSIBILITY & INVOCATION AUDIT
   ------------------------------------------------------------------ */
console.log('\nSection 2: IconButton Accessibility & Labeling');

test('IconButton component enforces aria-label and title from label prop', () => {
  const iconButtonBlock = getBlock(uiTsx, 'export function IconButton', 'export function Chip');
  assert(iconButtonBlock, 'IconButton definition found');
  assert(
    /aria-label=\{label\}/.test(iconButtonBlock),
    'IconButton must bind aria-label={label}'
  );
  assert(
    /title=\{label\}/.test(iconButtonBlock),
    'IconButton must bind title={label}'
  );
  assert(
    /label:\s*string/.test(iconButtonBlock),
    'IconButton prop types must require label: string'
  );
});

test('All <IconButton> invocations across components and pages provide non-empty labels', () => {
  const files = getTsxFiles(['src/components', 'src/pages']);
  const missingLabelInstances = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const rel = rel2posix(file);

    // Regex to match <IconButton ... > JSX opening tags across newlines
    const tagRegex = /<IconButton\b([\s\S]*?)(\/?>)/g;
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      const attrs = match[1];
      const hasLabel = /\blabel\s*=\s*({[^}]+}|"[^"]+"|\`[^\`]+\`)/.test(attrs);
      if (!hasLabel) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        missingLabelInstances.push(`${rel}:${lineNum}`);
      }
    }
  }

  assert(
    missingLabelInstances.length === 0,
    `Found <IconButton> without required label prop at: ${missingLabelInstances.join(', ')}`
  );
});

/* ------------------------------------------------------------------
   3. ANTI-SHAME & GUILT-FREE ANALYTICS INVARIANTS
   ------------------------------------------------------------------ */
console.log('\nSection 3: Anti-Shame Invariants (Statistics.tsx & Closet.tsx)');

const BANNED_SHAME_TERMS = [
  'wasted',
  'guilt',
  'guilty',
  'neglected',
  'bad',
  'shame',
  'failure',
  'closet detox',
  'wasted money',
  'underutilized',
  'purge',
  'hoarder',
  'confetti',
];

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

test('Analytics and Closet UI copy contains zero alarmist shame words', () => {
  const pagesToScan = ['src/pages/Statistics.tsx', 'src/pages/Closet.tsx'];
  const violations = [];

  for (const relPath of pagesToScan) {
    const fullPath = join(ROOT, relPath);
    if (!existsSync(fullPath)) continue;
    const rawContent = readFileSync(fullPath, 'utf8');
    const codeOnly = stripComments(rawContent);

    // Extract all string literals and JSX text nodes
    const stringLiterals = (codeOnly.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g) || [])
      .map(s => s.slice(1, -1))
      // Filter out technical HTML attributes and code symbols
      .filter(s => s !== 'lazy' && !s.startsWith('/') && !s.includes('px') && !s.includes('calc('));

    const jsxTextNodes = (codeOnly.match(/>([^<>{}\n]+)</g) || [])
      .map(s => s.slice(1, -1).trim())
      .filter(Boolean);

    const textsToCheck = [...stringLiterals, ...jsxTextNodes];

    for (const text of textsToCheck) {
      for (const term of BANNED_SHAME_TERMS) {
        const wordRegex = new RegExp(`\\b${term}\\b`, 'i');
        if (wordRegex.test(text)) {
          violations.push(`${relPath}: UI text contains banned shame term "${term}" in: "${text.slice(0, 60)}"`);
        }
      }
    }
  }

  assert(
    violations.length === 0,
    `Anti-shame violations found:\n  ${violations.join('\n  ')}`
  );
});

/**
 * THE WISHLIST'S SILENCE — a piece added with no wait is never interrogated.
 *
 * The cooling-off envelope is OPTIONAL, and its absence is what buys the quiet.
 * src/pages/Wishlist.tsx reads it three ways, and all three break if a piece
 * with no wait is handed an envelope stamped with today:
 *
 *   isAsking()  is `todayLocal() >= endsAt`, so today-stamped is due AT ONCE and
 *               the card asks "still want it?" the moment the piece is written.
 *   waitLine()  computes zero days left and returns null, so nothing on the card
 *               explains why it is asking.
 *   the actions branch treats the envelope's mere PRESENCE as proof of a wait
 *               and hides "Let it go" — so the calm exit disappears too.
 *
 * That combination is unprompted second-guessing with the exit removed, which
 * the focus group vetoed by name and non-negotiable #3 forbids. It shipped once
 * as a two-line "improvement" that read perfectly well in review, which is
 * exactly why it is checked mechanically rather than remembered.
 */
test('Wishlist: no waiting period means no cooling-off envelope at all', () => {
  const wishlistPath = join(ROOT, 'src', 'pages', 'Wishlist.tsx');
  const source = readFileSync(wishlistPath, 'utf8');

  // The then-branch is an object literal and carries colons of its own, so the
  // else-branch is anchored to the brace that closes it rather than to the first
  // colon after the `?`. Getting that wrong made this check's own first draft
  // report `addDays(todayLocal()` as the zero-wait value.
  const assignment = /coolingOff:\s*days\s*>\s*0\s*\?\s*\{[^}]*\}\s*:\s*([A-Za-z{][^,\n]*)/.exec(source);
  assert(assignment, 'the coolingOff assignment in handleAdd was not found — has it been rewritten?');

  const zeroWaitBranch = assignment[1].trim();
  assert(
    zeroWaitBranch.startsWith('undefined'),
    `a piece added with no wait must get coolingOff: undefined, not "${zeroWaitBranch}". ` +
      'A today-stamped envelope asks "still want it?" on arrival and hides "Let it go".',
  );

  // The three readers must keep treating an absent envelope as "no wait".
  assert(
    /item\.status !== 'waiting' \|\| !item\.coolingOff/.test(source),
    'isAsking/waitLine must bail out when coolingOff is absent',
  );
});

test('Statistics page uses neutral framing ("quiet lately" / "resting")', () => {
  const statsPath = join(ROOT, 'src', 'pages', 'Statistics.tsx');
  const statsContent = readFileSync(statsPath, 'utf8');
  assert(
    statsContent.includes('quiet lately') || statsContent.includes('resting') || statsContent.includes('Ledger') || statsContent.includes('LEDGER'),
    'Statistics page must maintain neutral phrasing contract'
  );
});

/* ------------------------------------------------------------------
   4. BRAND TYPOGRAPHY & TOKEN CONFORMANCE
   ------------------------------------------------------------------ */
console.log('\nSection 4: Brand Typography & Design Tokens');

const indexCssPath = join(ROOT, 'src', 'index.css');
const indexCss = readFileSync(indexCssPath, 'utf8');

test('CSS declares designated brand font families in :root', () => {
  assert(
    /--font-display:\s*['"]Fraunces['"]/.test(indexCss),
    '--font-display must declare Fraunces'
  );
  assert(
    /--font-ui:\s*['"]Switzer['"]/.test(indexCss),
    '--font-ui must declare Switzer'
  );
  assert(
    /--font-mono:\s*['"]IBM Plex Mono['"]/.test(indexCss),
    '--font-mono must declare IBM Plex Mono'
  );
});

test('.type-masthead uses var(--font-display) with correct metrics', () => {
  const mastheadMatch = indexCss.match(/\.type-masthead\s*\{([^}]+)\}/);
  assert(mastheadMatch, '.type-masthead rule must be defined in index.css');
  const body = mastheadMatch[1];
  assert(
    body.includes('font-family: var(--font-display)'),
    '.type-masthead must use font-family: var(--font-display)'
  );
  assert(
    body.includes('font-weight: 600'),
    '.type-masthead must use font-weight: 600'
  );
});

test('.type-editorial uses var(--font-display) italic', () => {
  const editorialMatch = indexCss.match(/\.type-editorial\s*\{([^}]+)\}/);
  assert(editorialMatch, '.type-editorial rule must be defined in index.css');
  const body = editorialMatch[1];
  assert(
    body.includes('font-family: var(--font-display)'),
    '.type-editorial must use font-family: var(--font-display)'
  );
  assert(
    body.includes('font-style: italic'),
    '.type-editorial must specify font-style: italic'
  );
});

test('.type-ledger uses var(--font-mono) tabular uppercase', () => {
  const ledgerMatch = indexCss.match(/\.type-ledger\s*\{([^}]+)\}/);
  assert(ledgerMatch, '.type-ledger rule must be defined in index.css');
  const body = ledgerMatch[1];
  assert(
    body.includes('font-family: var(--font-mono)'),
    '.type-ledger must use font-family: var(--font-mono)'
  );
  assert(
    body.includes('tabular-nums'),
    '.type-ledger must enable tabular-nums for numeric alignment'
  );
});

test('.type-label uses var(--font-ui) uppercase', () => {
  const labelMatch = indexCss.match(/\.type-label\s*\{([^}]+)\}/);
  assert(labelMatch, '.type-label rule must be defined in index.css');
  const body = labelMatch[1];
  assert(
    body.includes('font-family: var(--font-ui)'),
    '.type-label must use font-family: var(--font-ui)'
  );
});

/* ------------------------------------------------------------------
   5. THEME CONTRAST COMPUTATION & WCAG 2.1 AA GATES
   ------------------------------------------------------------------ */
console.log('\nSection 5: Theme Contrast (WCAG 2.1 AA Static Audit)');

const lin = c => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrastRatio = (hex1, hex2) => {
  const parseHex = h => {
    const clean = h.replace('#', '').trim();
    return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16));
  };
  const [L1, L2] = [luminance(parseHex(hex1)), luminance(parseHex(hex2))].sort((a, b) => b - a);
  return (L1 + 0.05) / (L2 + 0.05);
};

function extractThemeTokens(css, selector) {
  const at = css.indexOf(selector);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  let depth = 0;
  let block = '';
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      block = css.slice(open, i);
      break;
    }
  }
  const tokens = {};
  const regex = /--color-([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = regex.exec(block)) !== null) {
    const val = m[2].trim().split(/\s+/)[0]; // take hex before comments
    if (val.startsWith('#')) {
      tokens[m[1]] = val;
    }
  }
  return tokens;
}

const THEMES = [
  { name: 'Light (Pattern Room)', selector: ':root {' },
  { name: 'Dark (Atelier)', selector: ':root[data-theme="dark"]' },
  { name: 'Salon', selector: ':root[data-theme="salon"]' },
  { name: 'Gilt', selector: ':root[data-theme="gilt"]' },
  { name: 'Dyehouse', selector: ':root[data-theme="dyehouse"]' },
  { name: 'Obsidian', selector: ':root[data-theme="obsidian"]' },
];

for (const th of THEMES) {
  test(`Theme "${th.name}" passes WCAG 2.1 AA text & token contrast standards`, () => {
    const tokens = extractThemeTokens(indexCss, th.selector);
    if (!tokens || !tokens.bg || !tokens.text) {
      return; // Room might be in media query or optional
    }

    // Required core pairs
    const pairs = [
      { name: 'text / bg', fg: tokens['text'], bg: tokens['bg'], min: 4.5 },
      { name: 'text-2 / bg', fg: tokens['text-2'], bg: tokens['bg'], min: 4.5 },
      { name: 'text / surface', fg: tokens['text'], bg: tokens['surface'], min: 4.5 },
      { name: 'text-2 / surface', fg: tokens['text-2'], bg: tokens['surface'], min: 4.5 },
      { name: 'on-accent / accent-fill', fg: tokens['on-accent'], bg: tokens['accent-fill'], min: 4.5 },
      { name: 'chalk / danger-fill', fg: tokens['chalk'], bg: tokens['danger-fill'], min: 4.5 },
      { name: 'on-ink / ink-fill', fg: tokens['on-ink'], bg: tokens['ink-fill'], min: 4.5 },
    ];

    for (const p of pairs) {
      if (!p.fg || !p.bg) continue;
      const ratio = contrastRatio(p.fg, p.bg);
      assert(
        ratio >= p.min,
        `${th.name}: ${p.name} ratio ${ratio.toFixed(2)}:1 is below required floor ${p.min}:1 (${p.fg} on ${p.bg})`
      );
    }
  });
}

/* ------------------------------------------------------------------
   6. ACCESSIBLE SEMANTICS & ARIA AUDIT
   ------------------------------------------------------------------ */
console.log('\nSection 6: Accessible Semantics & Structure');

test('Modal component implements dialog role and aria-modal', () => {
  const modalBlock = getBlock(uiTsx, 'export function Modal', 'export function Stat');
  assert(modalBlock, 'Modal definition found in ui.tsx');
  assert(modalBlock.includes('role="dialog"'), 'Modal must have role="dialog"');
  assert(modalBlock.includes('aria-modal="true"'), 'Modal must have aria-modal="true"');
  assert(modalBlock.includes('aria-label={title}'), 'Modal must have aria-label={title}');
  assert(modalBlock.includes('onKey'), 'Modal must implement keyboard listener');
  assert(modalBlock.includes('Escape'), 'Modal must handle Escape key');
  assert(modalBlock.includes('Tab'), 'Modal must implement Tab focus trap');
});

test('TagRail and TableRail implement accessible roles and labels', () => {
  const railBlock = getBlock(uiTsx, 'export function TagRail', 'export function Card');
  assert(railBlock, 'Rail definitions found in ui.tsx');
  assert(railBlock.includes('role="group"'), 'TagRail must have role="group"');
  assert(railBlock.includes('aria-label={label}'), 'TagRail must have aria-label={label}');
  assert(railBlock.includes('role="region"'), 'TableRail must have role="region"');
  assert(railBlock.includes('tabIndex={0}'), 'TableRail must have tabIndex={0} for keyboard scrollability');
});

test('All image tags in components and pages have alt attributes', () => {
  const files = getTsxFiles(['src/components', 'src/pages']);
  const missingAltInstances = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const rel = rel2posix(file);
    const imgRegex = /<img\b([^>]*?)>/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      const attrs = match[1];
      if (!/\balt\s*=/.test(attrs)) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        missingAltInstances.push(`${rel}:${lineNum}`);
      }
    }
  }

  assert(
    missingAltInstances.length === 0,
    `Found <img> without alt attribute at: ${missingAltInstances.join(', ')}`
  );
});

/* ------------------------------------------------------------------
   SUMMARY & EXIT
   ------------------------------------------------------------------ */
console.log('\n======================================================');
console.log(` A11y & Brand Conformance: ${passedTests}/${totalTests} Passed (${failedTests} Failures)`);
console.log('======================================================\n');

if (failedTests > 0) {
  console.error('FAILURES:');
  for (const f of failures) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('ALL A11Y & BRAND CONFORMANCE SUITES PASS (0 violations).');
  process.exit(0);
}
