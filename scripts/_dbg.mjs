import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
await p.goto('http://localhost:4174/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
const inst = p.getByRole('button', { name: /sample wardrobes/i });
if (await inst.count()) { await inst.click(); await p.waitForTimeout(900); }
await p.getByRole('button', { name: /meher/i }).first().click();
await p.waitForTimeout(800);

for (const route of ['/', '/outfits']) {
  await p.goto('http://localhost:4174/#' + route, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const info = await p.evaluate(() => {
    const navs = [...document.querySelectorAll('nav')].map(n => {
      const cs = getComputedStyle(n), r = n.getBoundingClientRect();
      return { label: n.getAttribute('aria-label'), pos: cs.position, disp: cs.display,
               top: Math.round(r.top), h: Math.round(r.height), cls: n.className.slice(0, 60) };
    });
    // what is widest?
    const doc = document.documentElement;
    let worst = null;
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1) {
        const over = Math.round(r.right - doc.clientWidth);
        if (!worst || over > worst.over) worst = { over, tag: el.tagName, cls: String(el.className).slice(0, 70), w: Math.round(r.width) };
      }
    }
    return { vh: window.innerHeight, docW: doc.clientWidth, scrollW: doc.scrollWidth, navs, worst };
  });
  console.log('\n=== ' + route, 'vh=' + info.vh, 'docW=' + info.docW, 'scrollW=' + info.scrollW);
  info.navs.forEach(n => console.log('   nav', JSON.stringify(n)));
  if (info.worst) console.log('   widest overflow:', JSON.stringify(info.worst));
}
await b.close();
