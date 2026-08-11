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

for (const theme of ['light','dark','salon']) {
  const t = await p.evaluate(th => {
    document.documentElement.setAttribute('data-theme', th);
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    return {
      bg:g('--color-bg'), surface:g('--color-surface'), sunken:g('--color-sunken'), mat:g('--color-mat'),
      text:g('--color-text'), text2:g('--color-text-2'), accent:g('--color-accent'),
      accentFill:g('--color-accent-fill'), onAccent:g('--color-on-accent'),
      dangerFill:g('--color-danger-fill'), chalk:g('--color-chalk'),
      inkFill:g('--color-ink-fill'), onInk:g('--color-on-ink'),
    };
  }, theme);
  const hex = s => s.startsWith('#') ? [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)) : parse(s);
  const pairs = [
    ['text/bg', t.text, t.bg], ['text/surface', t.text, t.surface],
    ['text-2/bg', t.text2, t.bg], ['text-2/surface', t.text2, t.surface],
    ['text-2/sunken', t.text2, t.sunken], ['text/mat', t.text, t.mat],
    ['accent/bg', t.accent, t.bg], ['accent/sunken', t.accent, t.sunken],
    ['on-accent/accent-fill', t.onAccent, t.accentFill],
    ['chalk/danger-fill', t.chalk, t.dangerFill],
    ['on-ink/ink-fill', t.onInk, t.inkFill],
  ];
  const rows = pairs.map(([n,a,c]) => [n, ratio(hex(a), hex(c))]);
  const min = rows.reduce((m,r) => r[1] < m[1] ? r : m);
  const fails = rows.filter(r => r[1] < 4.5);
  for (const [n, r] of rows) {
    console.log(r >= 4.5 ? 'PASS' : 'FAIL', '-', `${theme}: ${n}`, `(${r.toFixed(2)}:1)`);
  }
  console.log(`  ${theme} tightest: ${min[0]} at ${min[1].toFixed(2)}:1`);
  failed += fails.length;
}
await b.close();
console.log(failed === 0 ? 'ALL THEMES PASS AA 4.5:1' : `${failed} PAIRS BELOW AA`);
process.exit(failed ? 1 : 0);
