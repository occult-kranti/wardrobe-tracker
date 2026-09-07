#!/usr/bin/env node
/** Focused rose-theme / Outfits regression. Serve a build first; no live calls. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = (process.argv[2] ?? 'http://localhost:4174').replace(/\/$/, '');
const OUTPUT = 'shots/rose-atelier';
const ACCOUNT = 'rose-outfits-synthetic';
const STORE = `wardrobe-tracker:${ACCOUNT}`;
const scratch = mkdtempSync(join(tmpdir(), 'rose-outfits-browser-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
    nav: fileURLToPath(new URL('../packages/shared/nav.ts', import.meta.url)),
    guides: fileURLToPath(new URL('../src/lib/pageGuides.ts', import.meta.url)),
  },
  bundle: true, format: 'esm', outdir: scratch, outExtension: { '.js': '.mjs' }, logLevel: 'error',
});
const { initialState } = await import(pathToFileURL(join(scratch, 'types.mjs')).href);
const { webBarSlots } = await import(pathToFileURL(join(scratch, 'nav.mjs')).href);
const { guidedPaths } = await import(pathToFileURL(join(scratch, 'guides.mjs')).href);
const garment = (id, name, category, extra = {}) => ({
  id, name, category, color: '#79818B', season: ['spring', 'fall'], occasion: ['casual'],
  dateAdded: '2026-01-01', imageUrl: '', favorite: false, wearCount: 0, laundryStatus: 'clean', ...extra,
});
const pieces = [garment('shirt', 'White Oxford shirt', 'tops'), garment('trousers', 'Navy straight trousers', 'bottoms')];
const outfit = (id, name, itemIds) => ({ id, name, itemIds, dateCreated: '2026-01-01', favorite: false, wearCount: 0, occasion: 'casual' });
const fixture = (items = pieces, outfits = [outfit('ready', 'Oxford and navy', ['shirt', 'trousers'])]) => ({
  ...structuredClone(initialState), items: structuredClone(items), outfits: structuredClone(outfits),
});

mkdirSync(OUTPUT, { recursive: true });
const report = { checkedAt: new Date().toISOString(), origin: ORIGIN, syntheticOnly: true, scenarios: [], screenshots: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let failed = 0;

async function open({ width = 390, record = fixture(), colorScheme = 'dark' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width >= 1024 ? 1000 : 844 },
    hasTouch: width < 1024, colorScheme, serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const state = { errors: [], external: [] };
  page.on('pageerror', error => state.errors.push(String(error)));
  await context.addInitScript(({ record: data, paths, account, store }) => {
    if (!localStorage.getItem('rose-outfits-seeded')) {
      localStorage.setItem('toile-accounts', JSON.stringify([{
        id: account, name: 'Rose review wardrobe', handle: '@synthetic_rose', monogram: 'RR',
        color: 'var(--color-accent)', createdAt: '2026-01-01',
      }]));
      localStorage.setItem('toile-session', JSON.stringify({ activeId: account }));
      localStorage.setItem(store, JSON.stringify(data));
      localStorage.removeItem('toile-theme');
      localStorage.setItem('rose-outfits-seeded', 'yes');
    }
    localStorage.setItem('toile-tour', 'done');
    localStorage.setItem('toile-guides', JSON.stringify(paths));
    localStorage.setItem('almari-usage-consent', JSON.stringify({ state: 'declined', installId: null, decidedAt: new Date().toISOString(), version: 1 }));
  }, { record, paths: guidedPaths(), account: ACCOUNT, store: STORE });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(ORIGIN).origin || url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
    } else {
      state.external.push(url.toString());
      await route.abort();
    }
  });
  await page.goto(`${ORIGIN}/#/outfits`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Outfits', exact: true }).waitFor();
  return { context, page, state };
}

async function screenshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const path = `${OUTPUT}/${name}.png`;
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  report.screenshots.push({ name, path, url: page.url(), viewport: page.viewportSize() });
}
async function noOverflow(page, label) {
  const excess = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(excess <= 1, `${label} overflows by ${excess}px`);
}
async function goOutfits(page) {
  await page.goto(`${ORIGIN}/#/outfits`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Outfits', exact: true }).waitFor();
}
const savedRegion = page => page.getByRole('region', { name: 'Saved outfits', exact: true });
const savedCard = (page, name) => savedRegion(page).locator(':scope > div').filter({ has: page.getByRole('heading', { name, exact: true }) });
const readRecord = page => page.evaluate(store => JSON.parse(localStorage.getItem(store)), STORE);
async function themeState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    return {
      theme: root.getAttribute('data-theme'), scheme: css.colorScheme,
      bg: css.getPropertyValue('--color-bg').trim().toLowerCase(),
      renderedBg: css.backgroundColor,
      chrome: document.querySelector('meta[name="theme-color"]')?.getAttribute('content')?.toLowerCase(),
      saved: JSON.parse(localStorage.getItem('toile-theme') ?? 'null'),
    };
  });
}
async function assertTheme(page, theme, scheme) {
  await page.waitForFunction(({ theme: expected, scheme: expectedScheme }) => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    return root.getAttribute('data-theme') === expected && css.colorScheme === expectedScheme
      && document.querySelector('meta[name="theme-color"]')?.getAttribute('content')?.toLowerCase() === css.getPropertyValue('--color-bg').trim().toLowerCase();
  }, { theme, scheme });
  const state = await themeState(page);
  assert.equal(state.theme, theme);
  assert.equal(state.scheme, scheme);
  assert.equal(state.chrome, state.bg, 'Browser chrome follows the actual page background');
  return state;
}
async function scenario(label, options, run) {
  let session;
  const started = Date.now();
  try {
    session = await open(options);
    await run(session);
    assert.deepEqual(session.state.errors, [], 'No unhandled browser exception');
    assert.deepEqual(session.state.external, [], 'No unsolicited external request (all external URLs were blocked)');
    console.log('PASS -', label);
    report.scenarios.push({ label, status: 'PASS', ms: Date.now() - started });
  } catch (error) {
    failed++;
    console.error('FAIL -', label, `(${error.message})`);
    report.scenarios.push({ label, status: 'FAIL', error: error.message, ms: Date.now() - started });
  } finally {
    await session?.context.close();
  }
}

try {
  await scenario('Fresh default stays warm and light under a dark OS; explicit and System choices survive reload', {}, async ({ page }) => {
    const fresh = await assertTheme(page, 'gilt', 'light');
    assert.equal(fresh.bg, '#f8e8e4');
    assert.equal(fresh.renderedBg, 'rgb(248, 232, 228)');
    assert.equal(fresh.saved, null, 'Fresh context has no stored theme preference');
    await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Atelier', exact: true }).click();
    await assertTheme(page, 'dark', 'dark');
    await page.reload({ waitUntil: 'domcontentloaded' });
    const explicit = await assertTheme(page, 'dark', 'dark');
    assert.equal(explicit.saved.theme, 'dark');
    await page.getByRole('button', { name: 'System', exact: true }).click();
    const systemDark = await assertTheme(page, null, 'dark');
    assert.equal(systemDark.saved.theme, 'system');
    await page.emulateMedia({ colorScheme: 'light' });
    const systemLight = await assertTheme(page, null, 'light');
    assert.notEqual(systemLight.bg, systemDark.bg);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal((await assertTheme(page, null, 'light')).saved.theme, 'system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await assertTheme(page, null, 'dark');
  });

  for (const width of [320, 390, 1440]) {
    await scenario(`Outfits intro, builder, Calendar and AI remain usable at ${width}px`, { width }, async ({ page }) => {
      const intro = page.locator('.outfits-intro');
      const art = intro.locator('svg[viewBox="0 0 220 100"]');
      assert.equal(await art.isVisible(), true, 'The new drawing is visible');
      assert.equal(await art.getAttribute('aria-hidden'), 'true', 'Decorative art is silent for assistive technology');
      assert.equal(await art.getAttribute('focusable'), 'false');
      const artBox = await art.boundingBox();
      assert.ok(artBox?.width > 0 && artBox.width <= width);
      await noOverflow(page, `Outfits ${width}`);
      if (width !== 320) await screenshot(page, width === 390 ? 'outfits-mobile' : 'outfits-desktop');

      if (width < 1024) {
        const rail = page.getByRole('navigation', { name: 'Main', exact: true });
        assert.equal(await rail.isVisible(), true);
        assert.deepEqual((await rail.getByRole('link').allTextContents()).map(text => text.trim()), webBarSlots().map(slot => slot.shortLabel ?? slot.label));
        assert.deepEqual(await rail.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href'))), webBarSlots().map(slot => `#${slot.path}`));
        assert.equal((await rail.getByRole('button', { name: 'More pages', exact: true }).textContent()).trim(), 'More');
        assert.equal(await rail.getByRole('link', { name: 'Outfits', exact: true }).getAttribute('aria-current'), 'page');
      }

      await intro.getByRole('button', { name: 'Build an outfit', exact: true }).click();
      await page.getByLabel('Outfit name', { exact: true }).waitFor();
      await noOverflow(page, `Builder ${width}`);
      await page.getByRole('button', { name: 'Close the builder', exact: true }).click();
      await intro.getByRole('link', { name: 'Calendar', exact: true }).click();
      await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, '#/calendar');
      await noOverflow(page, `Calendar ${width}`);
      await goOutfits(page);
      await page.locator('.outfits-intro').getByRole('link', { name: 'What should I wear? Ask AI', exact: true }).click();
      await page.getByRole('heading', { name: 'What should I wear?', exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, '#/events/style');
      await noOverflow(page, `AI brief ${width}`);
    });
  }

  await scenario('More offers Profile without duplicate main pages and closes after navigation', {}, async ({ page }) => {
    const rail = page.getByRole('navigation', { name: 'Main', exact: true });
    await rail.getByRole('button', { name: 'More pages', exact: true }).click();
    const sheet = page.locator('div.above-rail');
    await sheet.waitFor({ state: 'visible' });
    const profile = sheet.getByRole('link', { name: 'Profile', exact: true });
    assert.equal(await profile.count(), 1);
    assert.equal(await sheet.getByRole('link', { name: 'House', exact: true }).count(), 0);
    for (const slot of webBarSlots()) assert.equal(await sheet.locator(`a[href="#${slot.path}"]`).count(), 0, `${slot.label} stays in the main rail only`);
    const chatsInMain = webBarSlots().some(slot => slot.path === '/chats');
    assert.equal(await sheet.locator('a[href="#/chats"]').count(), chatsInMain ? 0 : 1, 'Chats remains reachable at either flag value');
    await profile.scrollIntoViewIfNeeded();
    await noOverflow(page, 'More sheet');
    await screenshot(page, 'more-mobile');
    await profile.click();
    await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
    await sheet.waitFor({ state: 'detached' });
    assert.equal(await rail.getByRole('button', { name: 'More pages', exact: true }).getAttribute('aria-expanded'), 'false');
    await noOverflow(page, 'Profile');
    await screenshot(page, 'profile-mobile');
  });

  await scenario('A genuinely empty wardrobe retains the Outfits Calendar entry', { record: fixture([], []) }, async ({ page }) => {
    await page.getByText('Nothing to put together yet.', { exact: true }).waitFor();
    assert.equal(await savedRegion(page).count(), 0);
    await noOverflow(page, 'Empty Outfits');
    await screenshot(page, 'outfits-empty');
    await page.locator('.outfits-intro').getByRole('link', { name: 'Calendar', exact: true }).click();
    await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
    await noOverflow(page, 'Empty Calendar');
  });

  const histories = [
    {
      label: 'Retired and partially missing outfits remain in the record', name: 'outfits-retired',
      record: fixture(pieces.map(piece => ({ ...piece, retired: { date: '2026-08-01' } })), [
        outfit('retired', 'Retired evening', ['shirt', 'trousers']),
        outfit('partial', 'Partly missing evening', ['shirt', 'gone']),
      ]),
    },
    {
      label: 'Saved outfits stay visible when every garment is missing', name: 'outfits-missing',
      record: fixture([], [outfit('missing', 'Missing evening', ['gone']), outfit('empty', 'Empty reference outfit', [])]),
    },
  ];
  for (const history of histories) {
    await scenario(history.label, { record: history.record }, async ({ page }) => {
      const saved = savedRegion(page);
      await saved.waitFor();
      for (const entry of history.record.outfits) {
        await saved.getByRole('heading', { name: entry.name, exact: true }).waitFor();
        assert.equal(await savedCard(page, entry.name).getByRole('button', { name: 'Wear today', exact: true }).isDisabled(), true);
      }
      assert.equal(await page.getByRole('heading', { name: 'Nothing to put together yet.', exact: true }).count(), 0, 'No empty-wardrobe screen over saved history');
      assert.equal(await saved.getByRole('button', { name: 'Wear today', exact: true }).count(), history.record.outfits.length);
      await saved.getByRole('button', { name: 'Wear today', exact: true }).evaluateAll(buttons => buttons.forEach(button => button.click()));
      assert.equal((await readRecord(page)).wearLogs.length, 0, 'Disabled wear controls cannot write history');
      await noOverflow(page, history.label);
      await screenshot(page, history.name);
      await page.locator('.outfits-intro').getByRole('link', { name: 'Calendar', exact: true }).click();
      await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
    });
  }

  await scenario('Wear today still records a valid saved outfit and credits each garment once', {}, async ({ page }) => {
    const wear = savedCard(page, 'Oxford and navy').getByRole('button', { name: 'Wear today', exact: true });
    assert.equal(await wear.isEnabled(), true);
    await wear.click();
    await page.waitForFunction(store => JSON.parse(localStorage.getItem(store)).wearLogs.length === 1, STORE);
    const record = await readRecord(page);
    assert.equal(record.outfits[0].wearCount, 1);
    assert.deepEqual(record.wearLogs[0].itemIds, ['shirt', 'trousers']);
    assert.equal(record.wearLogs[0].outfitId, 'ready');
    assert.ok(record.items.every(piece => piece.wearCount === 1 && piece.laundryStatus === 'worn'));
    assert.equal(record.wearLogs[0].planned, undefined);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await savedRegion(page).waitFor();
    assert.equal((await readRecord(page)).wearLogs.length, 1, 'Reload does not add another wear');
  });
} finally {
  await browser.close();
  report.failed = failed;
  writeFileSync(`${OUTPUT}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`\n${failed ? `${failed} failed` : 'All rose / Outfits browser checks passed'}. Report: ${OUTPUT}/report.json`);
process.exitCode = failed ? 1 : 0;
