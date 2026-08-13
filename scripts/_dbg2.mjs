import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
await p.goto('http://localhost:4174/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
const inst = p.getByRole('button', { name: /sample wardrobes/i });
if (await inst.count()) { await inst.click(); await p.waitForTimeout(900); }
await p.getByRole('button', { name: /meher/i }).first().click();
await p.waitForTimeout(700);
await p.goto('http://localhost:4174/#/outfits', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(700);
console.log(await p.evaluate(() => {
  const el = [...document.querySelectorAll('.rail')][0];
  if (!el) return 'no rail';
  const chain = [];
  let n = el;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n), r = n.getBoundingClientRect();
    chain.push({
      tag: n.tagName, cls: String(n.className).slice(0, 46),
      w: Math.round(r.width), scrollW: n.scrollWidth,
      ox: cs.overflowX, minW: cs.minWidth, disp: cs.display, flex: cs.flex,
    });
    n = n.parentElement;
  }
  return chain.slice(0, 7);
}));
await b.close();
