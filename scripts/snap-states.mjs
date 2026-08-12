// Snapshots every route across the three closet fill-states, plus the
// complete-fill state through DIFFERENT personas — the product tested on the
// data it will actually meet, not only on its best closet.
//
// Usage: node scripts/snap-states.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? './state-shots';
mkdirSync(out, { recursive: true });
const states = JSON.parse(readFileSync(new URL('./fill-states.json', import.meta.url), 'utf8'));

const ROUTES = ['/', '/closet', '/outfits', '/calendar', '/ledger', '/wishlist', '/compare', '/events', '/feed', '/chats', '/profile', '/settings'];
const b = await chromium.launch();

async function page(width, height) {
  const ctx = await b.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  for (const h of ['**://fonts.googleapis.com/**', '**://fonts.gstatic.com/**', '**://api.fontshare.com/**']) {
    await p.route(h, r => r.abort());
  }
  return { ctx, p };
}

async function shoot(p, prefix, routes, viewportName) {
  for (const route of routes) {
    await p.goto(`http://localhost:4173/#${route}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(650);
    const slug = route === '/' ? 'today' : route.slice(1).replace(/\//g, '-');
    await p.screenshot({ path: `${out}/${prefix}-${slug}-${viewportName}.png`, fullPage: viewportName === 'desktop' });
  }
}

// ---------- fill states: a single non-sample wardrobe seeded directly ----------
for (const [name, state] of Object.entries(states)) {
  for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
    const { ctx, p } = await page(vp.w, vp.h);
    await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
    await p.evaluate(([s]) => {
      const acc = { id: 'tester', name: 'Sam Kade', handle: '@sam', monogram: 'SK', color: 'var(--color-accent)', createdAt: '2026-06-01' };
      localStorage.setItem('toile-accounts', JSON.stringify([acc]));
      localStorage.setItem('toile-session', JSON.stringify({ activeId: 'tester' }));
      localStorage.setItem('wardrobe-tracker:tester', JSON.stringify(s));
    }, [state]);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(500);
    // Mobile gets the four load-bearing routes; desktop gets everything.
    await shoot(p, name, vp.n === 'desktop' ? ROUTES : ['/', '/closet', '/outfits', '/ledger'], vp.n);
    await ctx.close();
  }
  console.log('state done:', name);
}

// ---------- complete fill: three different personas, key routes each ----------
const PERSONA_ROUTES = {
  aarav: ['/', '/closet', '/ledger', '/events'],
  vikram: ['/', '/outfits', '/calendar', '/profile'],
  meher: ['/', '/closet', '/feed', '/chats'],
};
for (const [who, routes] of Object.entries(PERSONA_ROUTES)) {
  const { ctx, p } = await page(1440, 900);
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  const install = p.getByRole('button', { name: /sample/i }).first();
  if (await install.count()) { await install.click(); await p.waitForTimeout(500); }
  const open = p.getByRole('button', { name: new RegExp(who, 'i') }).first();
  if (await open.count()) { await open.click(); await p.waitForTimeout(600); }
  await shoot(p, `full-${who}`, routes, 'desktop');
  await ctx.close();
  console.log('persona done:', who);
}

await b.close();
console.log('all snapshots written to', out);
