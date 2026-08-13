import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
await p.goto('http://localhost:4174/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
const inst = p.getByRole('button', { name: /sample wardrobes/i });
if (await inst.count()) { await inst.click(); await p.waitForTimeout(900); }
await p.getByRole('button', { name: /meher/i }).first().click();
await p.waitForTimeout(700);
for (const route of ['/outfits','/','/closet','/feed','/ledger']) {
  await p.goto('http://localhost:4174/#' + route, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= W + 1) return null;
    // the shallowest elements that stick out — the cause, not the symptoms
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.right > W + 1 || rect.left < -1) {
        const depth = (() => { let d = 0, n = el; while (n.parentElement) { d++; n = n.parentElement; } return d; })();
        out.push({ depth, tag: el.tagName, cls: String(el.className).slice(0, 58),
                   left: Math.round(rect.left), right: Math.round(rect.right) });
      }
    }
    out.sort((a, b) => a.depth - b.depth);
    return { W, scrollW: document.documentElement.scrollWidth, top: out.slice(0, 4) };
  });
  console.log('\n' + route, r ? `overflow ${r.scrollW - r.W}px` : 'clean');
  if (r) r.top.forEach(o => console.log('   d' + o.depth, o.tag, o.cls, `[${o.left}..${o.right}]`));
}
await b.close();
