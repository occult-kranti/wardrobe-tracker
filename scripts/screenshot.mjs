// Screenshot harness: seeds demo wardrobe data, captures every route at
// mobile + desktop sizes. Usage: node screenshot.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const [, , baseUrl = 'http://localhost:4173/', outDir = './shots'] = process.argv;
mkdirSync(outDir, { recursive: true });

import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const bundled = join(mkdtempSync(join(tmpdir(), 'demo-')), 'd.mjs');
await build({ entryPoints: [new URL('../src/lib/demoData.ts', import.meta.url).pathname], bundle: true, format: 'esm', outfile: bundled, logLevel: 'error' });
const { buildDemoState } = await import(bundled);
const state = buildDemoState();

const routes = ['/', '/closet', '/outfits', '/calendar', '/ledger', '/wishlist', '/compare', '/rail', '/rail/c-priya', '/settings'];
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**://fonts.googleapis.com/**', r => r.abort());
  await page.route('**://fonts.gstatic.com/**', r => r.abort());
  await page.route('**://api.fontshare.com/**', r => r.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => localStorage.setItem('wardrobe-tracker', JSON.stringify(s)), state);
  await page.reload({ waitUntil: 'domcontentloaded' });
  for (const route of routes) {
    await page.goto(`${baseUrl}#${route}`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const slug = route === '/' ? 'dashboard' : route.slice(1).replace(/\//g, '-');
    await page.screenshot({ path: `${outDir}/${slug}-${vp.name}.png`, fullPage: true });
  }
  // Empty state pass on dashboard + closet
  await page.evaluate(() => localStorage.removeItem('wardrobe-tracker'));
  for (const route of ['/', '/closet']) {
    await page.goto(`${baseUrl}#${route}`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const slug = route === '/' ? 'dashboard' : route.slice(1);
    await page.screenshot({ path: `${outDir}/${slug}-empty-${vp.name}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log('Screenshots written to', outDir);
