// Ad-hoc capture: signs in as a sample wardrobe and photographs a route in every
// theme, with CLASSIC (non-overlay) scrollbars forced on — the configuration in
// which the closet filter rails were reported misaligned. Overlay scrollbars
// hide the defect entirely, which is why it survived the screenshot suite.
//
// Usage: node scripts/shot-closet.mjs <outDir> [route] [themes...]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const [, , outDir = './shots', route = '/closet', ...themeArgs] = process.argv;
const themes = themeArgs.length ? themeArgs : ['light'];
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  // Force the classic scrollbar. Headless Chromium defaults to overlay
  // scrollbars, which is exactly what let a 15px grey OS widget sit unnoticed
  // on top of a filter row for the whole life of the page.
  args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'],
});

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const h of ['**://fonts.googleapis.com/**', '**://fonts.gstatic.com/**', '**://api.fontshare.com/**']) {
    await page.route(h, r => r.abort());
  }
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // Sign-in: install the sample wardrobes, then open the third one (61 pieces).
  const install = page.getByRole('button', { name: /sample/i }).first();
  if (await install.count()) {
    await install.click();
    await page.waitForTimeout(600);
  }
  const open = page.getByRole('button', { name: /meher/i }).first();
  if (await open.count()) {
    await open.click();
    await page.waitForTimeout(600);
  }

  for (const theme of themes) {
    await page.evaluate(t => {
      localStorage.setItem('toile-theme', JSON.stringify(t));
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.goto(`http://localhost:4173/#${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForTimeout(900);
    const slug = route.replace(/\//g, '-').replace(/^-/, '') || 'dashboard';
    await page.screenshot({ path: `${outDir}/${slug}-${theme}-${vp.name}.png`, fullPage: vp.name === 'desktop' });
  }
  await ctx.close();
}
await browser.close();
console.log('written to', outDir);
