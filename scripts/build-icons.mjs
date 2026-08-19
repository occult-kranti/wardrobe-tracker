// Rasterize the launcher icons.
//
// The manifest shipped SVG-only, and two platforms never read it there:
// Android's maskable pipeline wants bitmaps at the sizes it composites, and
// iOS ignores SVG apple-touch-icons outright — Add to Home Screen was falling
// back to a screenshot of the page. The vector stays the source of truth; the
// PNGs are built, not edited. Usage: node scripts/build-icons.mjs
//
// Both sources paint a FULL-BLEED seal ground (public/icon.svg,
// public/icon-maskable.svg — the rect is the first element), so every raster
// is opaque by construction: no transparency halo on any home screen, and the
// apple-touch-icon needs no flattening pass.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const read = rel => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
const out = rel => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const shots = [
  { svg: 'public/icon.svg', size: 192, path: 'public/icon-192.png' },
  { svg: 'public/icon.svg', size: 512, path: 'public/icon-512.png' },
  { svg: 'public/icon-maskable.svg', size: 512, path: 'public/icon-maskable-512.png' },
  // iOS home screen: 180×180 is the one size every iPhone asks for.
  { svg: 'public/icon.svg', size: 180, path: 'public/apple-touch-icon.png' },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { svg, size, path } of shots) {
  await page.setViewportSize({ width: size, height: size });
  // The SVGs carry width/height for their 192 artboard; CSS restates the
  // target size so the viewBox scales — vector scaling, no resampling.
  await page.setContent(`<!DOCTYPE html>
<html><head><style>
  html, body { margin: 0; padding: 0; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style></head><body>${read(svg)}</body></html>`);
  await page.locator('svg').screenshot({ path: out(path) });
  console.log(`${path} — ${size}x${size}`);
}
await browser.close();
