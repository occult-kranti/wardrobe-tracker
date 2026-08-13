import { chromium } from 'playwright';
const b = await chromium.launch();

async function probe(label, signedIn) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).split('\n')[0].slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });

  await p.goto('http://localhost:4174/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  if (signedIn) {
    const inst = p.getByRole('button', { name: /sample wardrobes/i });
    if (await inst.count()) { await inst.click(); await p.waitForTimeout(1000); }
    await p.getByRole('button', { name: /meher/i }).first().click();
    await p.waitForTimeout(900);
  }
  // now try the feed
  await p.goto('http://localhost:4174/#/feed', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  const state = await p.evaluate(() => ({
    url: location.hash,
    bodyText: (document.body.innerText || '').slice(0, 200).replace(/\n+/g, ' | '),
    rootChildren: document.getElementById('root')?.children.length ?? -1,
    hasNav: !!document.querySelector('nav'),
  }));
  console.log(`\n=== ${label} ===`);
  console.log('state:', JSON.stringify(state));
  console.log('errors:', errs.length ? errs.slice(0, 4).join('\n         ') : 'none');
  await ctx.close();
}

await probe('NOT signed in → /feed', false);
await probe('signed in → /feed', true);
await b.close();
