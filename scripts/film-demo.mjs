// Films the product demo: one continuous take from an empty device to a full
// house — starting a wardrobe, cataloguing the first pieces, logging a wear,
// then opening the sample closets and walking every tool, ending on a montage
// through the rooms. Produces a .webm in the output dir.
//
// Usage: node scripts/film-demo.mjs <outDir>   (needs the preview on :4173)
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';

const out = process.argv[2] ?? './demo-film';
mkdirSync(out, { recursive: true });

const W = 1280;
const H = 800;
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: out, size: { width: W, height: H } },
});
const p = await ctx.newPage();
for (const h of ['**://fonts.googleapis.com/**', '**://fonts.gstatic.com/**']) {
  await p.route(h, r => r.abort());
}

const wait = ms => p.waitForTimeout(ms);

/** The narrator: a small serif chip that names each scene. */
async function caption(text) {
  await p.evaluate(t => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText = [
        'position:fixed', 'bottom:26px', 'left:50%', 'transform:translateX(-50%)',
        'padding:9px 20px', 'background:rgba(16,14,12,0.88)', 'color:#F6F1E7',
        'font:500 14px Georgia,serif', 'letter-spacing:0.14em', 'text-transform:uppercase',
        'border:1px solid rgba(211,154,133,0.55)', 'border-radius:2px',
        'z-index:99999', 'pointer-events:none', 'transition:opacity 300ms',
        'white-space:nowrap',
      ].join(';');
      document.body.appendChild(el);
    }
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = t; el.style.opacity = '1'; }, 300);
  }, text);
  await wait(700);
}

/** Scenes that miss a selector should cost a warning, not the whole film —
    and must not leave a dialog open to swallow every later click. */
async function scene(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`scene skipped: ${name} — ${String(err).split('\n')[0]}`);
    await p.keyboard.press('Escape').catch(() => {});
    await wait(300);
    await p.keyboard.press('Escape').catch(() => {});
  }
}

async function type(selector, text) {
  await p.click(selector);
  await p.fill(selector, '');
  await p.type(selector, text, { delay: 55 });
}

await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
await wait(1400);

/* ---------- Act I: a wardrobe begins ---------- */

await scene('start a wardrobe', async () => {
  await caption('It begins empty, on this device');
  await wait(900);
  await p.getByRole('button', { name: 'Start a wardrobe' }).click();
  await wait(900);
  await type('#su-name', 'Sam Kade');
  await type('#su-city', 'Lisbon');
  await type('#su-line', 'Mends before replacing');
  await wait(500);
  await p.getByRole('button', { name: 'Start it' }).click();
  await wait(1600);
});

await scene('the empty closet', async () => {
  await p.goto('http://localhost:4173/#/closet', { waitUntil: 'domcontentloaded' });
  await caption('The closet, before the record');
  await wait(1700);
});

const addPiece = async (name, category, cost) => {
  await p.getByRole('button', { name: 'Add a piece' }).first().click();
  await wait(800);
  const dlg = p.getByRole('dialog');
  await type('#add-item-name', name);
  const chip = dlg.getByRole('button', { name: new RegExp(`^${category}$`, 'i') }).first();
  if (await chip.count()) await chip.click();
  await wait(300);
  if (cost) {
    await p.fill('#add-item-cost', String(cost));
    await wait(300);
  }
  await wait(400);
  await dlg.getByRole('button', { name: /add to the closet/i }).click();
  await wait(1000);
};

await scene('first pieces', async () => {
  await caption('Cataloguing the first pieces');
  await addPiece('White poplin shirt', 'tops', 45);
  await addPiece('Dark straight jeans', 'bottoms', 80);
  await wait(800);
});

await scene('first wear', async () => {
  await p.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' });
  await caption('The first entry in the ledger');
  await wait(1000);
  await p.getByRole('button', { name: /log today's wear|log another/i }).first().click();
  await wait(900);
  const dialog = p.getByRole('dialog');
  const pickInstead = dialog.getByRole('button', { name: /pick pieces instead/i }).first();
  if (await pickInstead.count()) { await pickInstead.click(); await wait(600); }
  await dialog.getByRole('button', { name: /white poplin shirt/i }).first().click();
  await wait(400);
  await dialog.getByRole('button', { name: /dark straight jeans/i }).first().click();
  await wait(400);
  await dialog.getByRole('button', { name: /^log (this|\d+ pieces)/i }).first().click();
  await wait(1500);
});

/* ---------- Act II: the full house ---------- */

await scene('open the samples', async () => {
  await caption('Three sample closets, a year of wear');
  await p.goto('http://localhost:4173/#/open', { waitUntil: 'domcontentloaded' });
  await wait(1000);
  const install = p.getByRole('button', { name: /sample wardrobes/i });
  if (await install.count()) { await install.click(); await wait(1200); }
  await p.getByRole('button', { name: /meher/i }).first().click();
  await wait(1800);
});

const tour = [
  ['/closet', 'A closet catalogued in full', 2600],
  ['/outfits', 'Looks, kept and repeated', 2400],
  ['/calendar', 'Every day it was worn', 2400],
  ['/ledger', 'Cost per wear, honestly counted', 2600],
  ['/wishlist', 'Wanting, with a cooling-off period', 2200],
  ['/compare', 'Before you buy: the case against', 2200],
  ['/events', 'Dressing for what is coming', 2200],
  ['/feed', 'The people whose closets you know', 2200],
  ['/chats', 'Borrowing, lending, passing on', 2200],
  ['/profile', 'Households under one roof', 2400],
];

for (const [route, text, hold] of tour) {
  await scene(`tour ${route}`, async () => {
    await p.goto(`http://localhost:4173/#${route}`, { waitUntil: 'domcontentloaded' });
    await caption(text);
    await wait(hold);
    // The wishlist is shown by USING it — an entry goes on the list and the
    // cooling-off clock starts, which is the whole argument of the page.
    if (route === '/wishlist') {
      const considering = p.getByRole('button', { name: /add something/i }).filter({ visible: true }).first();
      const add = (await considering.count())
        ? considering
        : p.getByRole('button', { name: /^add$/i }).filter({ visible: true }).first();
      if (await add.count()) {
        await add.click();
        await wait(700);
        await type('#wish-name', 'Camel wool coat');
        await wait(400);
        await p.getByRole('button', { name: /put it on the list/i }).filter({ visible: true }).first().click();
        await wait(1600);
      }
      return;
    }
    // A gentle scroll so the page's depth is seen.
    await p.mouse.wheel(0, 420);
    await wait(1100);
    await p.mouse.wheel(0, -420);
    await wait(500);
  });
}

await scene('a piece up close', async () => {
  await caption('Every piece keeps its record');
  await p.goto('http://localhost:4173/#/closet', { waitUntil: 'domcontentloaded' });
  await wait(1200);
  const card = p.getByRole('button', { name: /kantha|silk|linen|denim/i }).first();
  if (await card.count()) {
    await card.click();
    await wait(2400);
    await p.keyboard.press('Escape');
    await wait(600);
  }
});

/* ---------- Act III: the rooms ---------- */

await scene('the rooms', async () => {
  await p.goto('http://localhost:4173/#/', { waitUntil: 'domcontentloaded' });
  await caption('Six rooms to keep it in');
  await wait(900);
  const themeButton = p.getByRole('button', { name: /^theme:/i }).first();
  // system → dark → obsidian → dyehouse → salon → gilt → light → system
  for (let i = 0; i < 7; i++) {
    await themeButton.click();
    await wait(i < 6 ? 1300 : 700);
  }
});

await scene('closing', async () => {
  await caption('Toile — your wardrobe, on record');
  await wait(2200);
  await p.evaluate(() => {
    const el = document.getElementById('demo-caption');
    if (el) el.style.opacity = '0';
  });
  await wait(900);
});

const video = p.video();
await ctx.close();
const path = await video.path();
await b.close();
renameSync(path, `${out}/demo.webm`);
console.log('film written to', `${out}/demo.webm`);
