#!/usr/bin/env node
/**
 * Renders every baked garment plate in a real Chromium and asserts it loads.
 *
 * A malformed SVG in a data-URI does not throw anywhere — it renders as the
 * browser's broken-image glyph in the middle of the closet grid, which is how
 * the Raw Denim plate shipped broken while every other suite stayed green.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'art-')), 'a.mjs');
await build({ alias: sharedAliases(),
  entryPoints: [fileURLToPath(new URL('../src/lib/garmentArt.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const { GARMENT_ART } = await import(pathToFileURL(out).href);

const ids = Object.keys(GARMENT_ART);
const browser = await chromium.launch();
const page = await browser.newPage();

let fail = 0;
for (const id of ids) {
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(GARMENT_ART[id])}`;
  const ok = await page.evaluate(
    src =>
      new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
        img.onerror = () => resolve(false);
        img.src = src;
        setTimeout(() => resolve(false), 3000);
      }),
    uri
  );
  console.log(ok ? 'PASS' : 'FAIL', '-', id);
  if (!ok) fail++;
}

await browser.close();
console.log(fail === 0 ? `ALL ${ids.length} PLATES RENDER` : `${fail} PLATES BROKEN`);
process.exit(fail ? 1 : 0);
