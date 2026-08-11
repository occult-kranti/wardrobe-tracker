#!/usr/bin/env node
/**
 * Measures every text/background pair the app actually renders, in every theme,
 * against the real computed tokens in a browser.
 *
 * Written after a spec claimed contrast figures and the shipped dark theme
 * turned out to miss AA on `accent` over `sunken` by 0.01 — a number no one can
 * eyeball and no other suite was checking. Themes are added by humans with a
 * colour picker; this is what stops the next one shipping a pair at 4.3.
 *
 * Needs a preview server: npm run build && npx vite preview --port 4173
 */
import { chromium } from 'playwright';
const lin = c => { c/=255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const Y = ([r,g,b]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
const ratio = (a,b) => { const [hi,lo]=[Y(a),Y(b)].sort((x,y)=>y-x); return (hi+0.05)/(lo+0.05); };
const parse = s => s.match(/\d+/g).slice(0,3).map(Number);

let failed = 0;
const b = await chromium.launch();
const p = await b.newPage();
for (const h of ['**://fonts.googleapis.com/**','**://fonts.gstatic.com/**','**://api.fontshare.com/**']) await p.route(h, r => r.abort());
await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });

for (const theme of ['light','dark','salon','gilt']) {
  const t = await p.evaluate(th => {
    document.documentElement.setAttribute('data-theme', th);
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    return {
      bg:g('--color-bg'), surface:g('--color-surface'), sunken:g('--color-sunken'), mat:g('--color-mat'),
      text:g('--color-text'), text2:g('--color-text-2'), accent:g('--color-accent'),
      accentFill:g('--color-accent-fill'), onAccent:g('--color-on-accent'),
      accentOnInk:g('--color-accent-on-ink'),
      seal:g('--color-seal'),
      dangerFill:g('--color-danger-fill'), chalk:g('--color-chalk'),
      inkFill:g('--color-ink-fill'), onInk:g('--color-on-ink'),
      border:g('--color-border'),
    };
  }, theme);
  const hex = s => s.startsWith('#') ? [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)) : parse(s);
  // Text pairs answer to AA 4.5:1. The last group is not text: WCAG 1.4.11 sets
  // 3:1 for graphical objects and interface component boundaries, and holding a
  // 2px rule or a hairline to the text bar would only push the palette darker
  // for no legibility gained.
  const pairs = [
    ['text/bg', t.text, t.bg, 4.5], ['text/surface', t.text, t.surface, 4.5],
    ['text-2/bg', t.text2, t.bg, 4.5], ['text-2/surface', t.text2, t.surface, 4.5],
    ['text-2/sunken', t.text2, t.sunken, 4.5], ['text/mat', t.text, t.mat, 4.5],
    ['accent/bg', t.accent, t.bg, 4.5], ['accent/sunken', t.accent, t.sunken, 4.5],
    ['accent/surface', t.accent, t.surface, 4.5],
    // The mat pair was never gated, and the dark room's accent had been sitting
    // on it at 4.37:1 — under AA, in the shipped default, on the tile every
    // garment photograph lands on.
    ['accent/mat', t.accent, t.mat, 4.5],
    ['on-accent/accent-fill', t.onAccent, t.accentFill, 4.5],
    ['chalk/danger-fill', t.chalk, t.dangerFill, 4.5],
    ['on-ink/ink-fill', t.onInk, t.inkFill, 4.5],
    ['chalk/seal', t.chalk, t.seal, 4.5],
    // non-text
    ['accent-on-ink/ink-fill *', t.accentOnInk, t.inkFill, 3],
    ['seal/bg *', t.seal, t.bg, 3],
    // Measured but never a gate: a chalk hairline is decorative, always paired
    // with layering or a label, and no WCAG clause governs it. It is printed so
    // a theme author can see how faint their border really is — the light room's
    // is the faintest in the house — without a number nobody agreed on failing
    // the build.
    ['border/bg (fyi)', t.border, t.bg, null],
  ];
  const rows = pairs.map(([n,a,c,min]) => [n, ratio(hex(a), hex(c)), min]);
  const gated = rows.filter(r => r[2] !== null);
  const worst = gated.reduce((m,r) => (r[1]/r[2]) < (m[1]/m[2]) ? r : m);
  const fails = gated.filter(r => r[1] < r[2]);
  for (const [n, r, min] of rows) {
    if (min === null) console.log('    ', '-', `${theme}: ${n}`, `(${r.toFixed(2)}:1)`);
    else console.log(r >= min ? 'PASS' : 'FAIL', '-', `${theme}: ${n}`, `(${r.toFixed(2)}:1, floor ${min})`);
  }
  console.log(`  ${theme} tightest against its own floor: ${worst[0]} at ${worst[1].toFixed(2)}:1 (floor ${worst[2]})`);
  failed += fails.length;
}
await b.close();
console.log(failed === 0 ? 'ALL THEMES PASS (text 4.5:1, * non-text per WCAG 1.4.11)' : `${failed} PAIRS BELOW THEIR FLOOR`);
process.exit(failed ? 1 : 0);
