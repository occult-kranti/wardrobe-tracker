#!/usr/bin/env node
/** Rendered border regression. Serve a build first; synthetic data, no live AI. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = (process.argv[2] ?? 'http://127.0.0.1:4174').replace(/\/$/, '');
const OUTPUT = 'shots/border-ornaments';
const THEMES = ['light', 'dark', 'salon', 'gilt', 'dyehouse', 'obsidian'];
const ACCOUNT = 'border-review-synthetic';
const STORE = `wardrobe-tracker:${ACCOUNT}`;
const scratch = mkdtempSync(join(tmpdir(), 'almari-border-browser-'));
let browser;
let failed = 0;
const report = { checkedAt: new Date().toISOString(), origin: ORIGIN, syntheticOnly: true, scenarios: [], screenshots: [] };

async function geometry(page, label, requireFrames = true) {
  const result = await page.evaluate(() => {
    const bounds = el => {
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    };
    const visible = el => {
      const b = bounds(el);
      const css = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && css.display !== 'none' && css.visibility !== 'hidden';
    };
    const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const problems = [];
    let corners = 0;
    const frames = [...document.querySelectorAll('.card-frame')].filter(visible);
    for (const frame of frames) {
      const ornaments = [...frame.querySelectorAll(':scope > .plate-ornament')];
      if (ornaments.length !== 2) problems.push('A padded card does not carry exactly two corner ornaments');
      const controls = [...frame.querySelectorAll('button, a, input, textarea, select, summary, img, h1, h2, h3, h4, p')].filter(visible);
      for (const ornament of ornaments) {
        const art = bounds(ornament);
        const box = bounds(frame);
        corners++;
        if (art.left < box.left || art.top < box.top || art.right > box.right || art.bottom > box.bottom) {
          problems.push('Corner artwork escaped its card');
        }
        if (getComputedStyle(ornament).pointerEvents !== 'none' || ornament.getAttribute('aria-hidden') !== 'true') {
          problems.push('Decoration intercepts interaction or is exposed to assistive technology');
        }
        for (const control of controls) {
          if (intersects(art, bounds(control))) {
            problems.push(`Corner intersects ${control.tagName}: ${(control.getAttribute('aria-label') || control.textContent || control.getAttribute('alt') || '').trim().slice(0, 90)}`);
          }
        }
      }
      if (getComputedStyle(frame).overflowX !== 'visible' || getComputedStyle(frame).overflowY !== 'visible') {
        problems.push('The frame clips content or its focus ring');
      }
    }
    const legacy = [...document.querySelectorAll('.plate')].filter(el => getComputedStyle(el).backgroundImage.includes('data:image/svg+xml'));
    if (legacy.length) problems.push(`${legacy.length} plates still carry legacy background ornaments`);
    const unsafe = [...document.querySelectorAll('button, a, .garment-tile, .plate:not(.card-frame)')]
      .filter(el => el.querySelector(':scope > .plate-ornament'));
    if (unsafe.length) problems.push(`${unsafe.length} controls, photos or unpadded plates carry artwork`);
    return { frames: frames.length, corners, problems, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  if (requireFrames) assert.ok(result.frames > 0 && result.corners > 0, `${label}: no rendered card artwork was checked`);
  assert.deepEqual(result.problems, [], `${label}: ornament lane overlaps or clips content`);
  assert.ok(result.overflow <= 1, `${label}: page overflows by ${result.overflow}px`);
  return { label, frames: result.frames, corners: result.corners };
}

async function focusProof(page, button) {
  await page.keyboard.press('Tab');
  await button.focus();
  const focus = await button.evaluate(el => {
    const css = getComputedStyle(el);
    const ring = Number.parseFloat(css.outlineWidth) + Number.parseFloat(css.outlineOffset);
    const b = el.getBoundingClientRect();
    const padded = { left: b.left - ring, right: b.right + ring, top: b.top - ring, bottom: b.bottom + ring };
    const frame = el.closest('.card-frame');
    const overlaps = [...frame.querySelectorAll(':scope > .plate-ornament')].some(art => {
      const a = art.getBoundingClientRect();
      return Math.min(a.right, padded.right) - Math.max(a.left, padded.left) > 0.5
        && Math.min(a.bottom, padded.bottom) - Math.max(a.top, padded.top) > 0.5;
    });
    return { visible: el.matches(':focus-visible'), width: Number.parseFloat(css.outlineWidth), style: css.outlineStyle, overlaps };
  });
  assert.equal(focus.visible, true, 'Keyboard focus is visible on the card action');
  assert.ok(focus.width >= 2 && focus.style !== 'none', 'The functional focus outline remains present');
  assert.equal(focus.overlaps, false, 'Corner artwork also clears the outside of the keyboard focus ring');
}

try {
  await build({
    alias: sharedAliases(),
    entryPoints: {
      types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
      guides: fileURLToPath(new URL('../src/lib/pageGuides.ts', import.meta.url)),
    },
    bundle: true, format: 'esm', outdir: scratch, outExtension: { '.js': '.mjs' }, logLevel: 'error',
  });
  const { initialState } = await import(pathToFileURL(join(scratch, 'types.mjs')).href);
  const { guidedPaths } = await import(pathToFileURL(join(scratch, 'guides.mjs')).href);
  const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="#D7D0C5"/><path d="M22 18h36l8 66H14z" fill="#F4EFEA"/></svg>')}`;
  const piece = (id, name, category) => ({
    id, name, category, imageUrl: image, color: '#D7D0C5', season: ['spring'], occasion: ['casual'],
    dateAdded: '2026-01-01', favorite: false, wearCount: 0, laundryStatus: 'clean',
  });
  const names = ['White Oxford and navy trousers for an evening at the gallery', 'Day off layers', 'The saved weekend set'];
  const record = {
    ...structuredClone(initialState),
    items: [piece('shirt', 'White Oxford shirt', 'tops'), piece('trousers', 'Navy straight trousers', 'bottoms')],
    outfits: names.map((name, index) => ({
      id: `set-${index}`, name, itemIds: ['shirt', 'trousers'], favorite: false, wearCount: 0,
      dateCreated: `2026-01-0${3 - index}`, occasion: 'A gallery opening with a long occasion label',
    })),
    wishlist: [{
      id: 'considered-shirt', name: 'A considered linen shirt', category: 'tops', color: '#D7D0C5',
      imageUrl: image, priority: 'medium', status: 'kept', dateAdded: '2026-01-01',
    }],
  };
  mkdirSync(OUTPUT, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const theme of THEMES) {
    for (const width of [320, 390, 1440]) {
      const label = `${theme} at ${width}px: saved cards, controls, builder and focus`;
      const context = await browser.newContext({
        viewport: { width, height: width >= 1024 ? 1000 : 844 }, serviceWorkers: 'block',
        hasTouch: width < 1024, reducedMotion: 'reduce', colorScheme: 'dark',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      const external = [];
      page.on('pageerror', error => errors.push(String(error)));
      const stages = [];
      try {
        await context.addInitScript(({ data, room, paths, account, store }) => {
          if (!localStorage.getItem('border-review-seeded')) {
            localStorage.setItem('toile-accounts', JSON.stringify([{
              id: account, name: 'Border review wardrobe', handle: '@synthetic_border', monogram: 'BR',
              color: 'var(--color-accent)', createdAt: '2026-01-01',
            }]));
            localStorage.setItem('toile-session', JSON.stringify({ activeId: account }));
            localStorage.setItem(store, JSON.stringify(data));
            localStorage.setItem('toile-theme', JSON.stringify({ theme: room }));
            localStorage.setItem('border-review-seeded', 'yes');
          }
          localStorage.setItem('toile-tour', 'done');
          localStorage.setItem('toile-guides', JSON.stringify(paths));
          localStorage.setItem('almari-usage-consent', JSON.stringify({ state: 'declined', installId: null, decidedAt: new Date().toISOString(), version: 1 }));
        }, { data: record, room: theme, paths: guidedPaths(), account: ACCOUNT, store: STORE });
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin === new URL(ORIGIN).origin || url.protocol === 'data:' || url.protocol === 'blob:') await route.continue();
          else { external.push(url.toString()); await route.abort(); }
        });
        await page.goto(`${ORIGIN}/#/outfits`, { waitUntil: 'domcontentloaded' });
        const saved = page.getByRole('region', { name: 'Saved outfits', exact: true });
        await saved.waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await saved.evaluate(el => el.classList.contains('plate')), false, 'The saved collection has no nested outer frame');
        assert.equal(await saved.locator(':scope > .card-frame').count(), names.length, 'Every saved outfit still has a card');
        assert.ok(await saved.locator('img').count() > 0, 'The geometry check includes photographic tiles');
        stages.push(await geometry(page, 'saved cards'));

        const pin = saved.getByRole('button', { name: `Pin "${names[0]}"`, exact: true });
        await focusProof(page, pin);
        await pin.click();
        await saved.getByRole('button', { name: `Unpin "${names[0]}"`, exact: true }).waitFor();
        await saved.getByRole('button', { name: `Delete outfit "${names[1]}"`, exact: true }).click();
        stages.push(await geometry(page, 'delete confirmation'));
        await saved.getByRole('button', { name: 'Keep', exact: true }).click();

        await page.locator('.outfits-intro').getByRole('button', { name: 'Build an outfit', exact: true }).click();
        await page.getByLabel('Outfit name', { exact: true }).waitFor();
        stages.push(await geometry(page, 'manual builder'));
        assert.deepEqual(await page.locator('button.registered').evaluateAll(buttons => buttons.filter(button =>
          getComputedStyle(button).backgroundImage !== 'none' || button.querySelector('.plate-ornament')
        ).map(button => button.textContent)), [], 'Small selection tiles carry no corner artwork');
        await page.getByRole('button', { name: 'Close the builder', exact: true }).click();

        await page.evaluate(() => { document.documentElement.dataset.glass = 'off'; });
        stages.push(await geometry(page, 'solid material fallback'));
        if (width === 390 || (theme === 'gilt' && width !== 390)) {
          // Capture the resting page after the real confirmation expires.
          // The phone toast otherwise obscures the card we are reviewing.
          await page.getByText('Pinned. It sits at the top now.', { exact: true }).waitFor({ state: 'hidden' });
          await page.evaluate(() => window.scrollTo(0, 0));
          const path = `${OUTPUT}/${theme}-${width}.png`;
          await page.screenshot({ path, fullPage: true, animations: 'disabled' });
          report.screenshots.push({ name: `${theme} ${width}px`, path, viewport: page.viewportSize() });
        }
        if (width === 390) {
          for (const route of ['/wishlist', '/settings', '/closet']) {
            await page.goto(`${ORIGIN}/#${route}`, { waitUntil: 'domcontentloaded' });
            await page.locator('main h1').waitFor();
            await page.evaluate(() => document.fonts.ready);
            stages.push(await geometry(page, route, route !== '/closet'));
            if (route === '/wishlist') {
              await focusProof(page, page.getByRole('button', { name: 'Take A considered linen shirt off the list', exact: true }));
            }
          }
        }
        assert.deepEqual(errors, [], 'No unhandled browser error');
        assert.deepEqual(external, [], 'No unsolicited external request');
        report.scenarios.push({ label, status: 'PASS', stages });
        console.log('PASS -', label);
      } catch (error) {
        failed++;
        report.scenarios.push({ label, status: 'FAIL', error: error.message, stages });
        console.error('FAIL -', label, `(${error.message})`);
      } finally {
        await context.close();
      }
    }
  }
} catch (error) {
  failed++;
  report.scenarios.push({ label: 'Browser harness setup', status: 'FAIL', error: error.message });
  console.error('FAIL - browser harness setup', error.message);
} finally {
  await browser?.close();
  mkdirSync(OUTPUT, { recursive: true });
  report.failed = failed;
  writeFileSync(`${OUTPUT}/report.json`, JSON.stringify(report, null, 2));
  const checkedScratch = resolve(scratch);
  if (dirname(checkedScratch) === resolve(tmpdir()) && basename(checkedScratch).startsWith('almari-border-browser-')) {
    rmSync(checkedScratch, { recursive: true, force: true });
  }
}
console.log(`\n${failed ? `${failed} failed` : 'All border geometry checks passed'}. Report: ${OUTPUT}/report.json`);
process.exitCode = failed ? 1 : 0;
