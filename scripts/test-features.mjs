#!/usr/bin/env node
/**
 * The features borrowed from the field, exercised for real.
 *
 * Each of these answers a specific complaint or a specific gap found in the
 * competitive benchmark (docs/24), so each is tested against the thing it was
 * built to do rather than against its own implementation.
 *
 * Usage: node scripts/test-features.mjs [origin]
 */
import { chromium } from 'playwright';

const ORIGIN = process.argv[2] ?? 'http://localhost:4174';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 140)));

/* ============ the door, and the deep link that used to strand you ============ */
await page.goto(`${ORIGIN}/#/feed`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const stranded = await page.evaluate(() => ({
  hash: location.hash,
  text: document.body.innerText.slice(0, 200),
  theme: document.documentElement.getAttribute('data-theme'),
}));
check('a signed-out deep link redirects instead of stranding the URL',
  stranded.hash.startsWith('#/open'), `hash ${stranded.hash}`);
check('the door says what it is holding for you',
  /feed is inside a wardrobe/i.test(stranded.text) || /open a wardrobe|start a wardrobe/i.test(stranded.text),
  '');
check('the door is already in the house theme, not the light room',
  stranded.theme === 'dyehouse', `data-theme=${stranded.theme}`);

/* ============ starting a wardrobe with nothing typed ============ */
await page.goto(`${ORIGIN}/#/open/new`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const start = page.getByRole('button', { name: /start it/i }).first();
check('the primary is never disabled on the door', await start.isEnabled(), '');
await start.click();
await page.waitForTimeout(900);
const landed = await page.evaluate(() => ({ hash: location.hash, text: document.body.innerText.slice(0, 90) }));
check('a blank name still opens a wardrobe', landed.hash === '#/' || landed.hash === '',
  `hash ${landed.hash} — ${landed.text.replace(/\s+/g, ' ').slice(0, 50)}`);

/* ============ what it is like out ============ */
// Against a worked closet, not the empty one just started: an empty wardrobe
// has no picker to narrow, which is a different screen and a different test.
await page.goto(`${ORIGIN}/#/open`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const samples = page.getByRole('button', { name: /sample wardrobes/i }).first();
if (await samples.count()) {
  await samples.click();
  await page.waitForTimeout(900);
}
const meher = page.getByRole('button', { name: /meher/i }).first();
if (await meher.count()) {
  await meher.click();
  await page.waitForTimeout(900);
}
await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);

// Watch for a location request before anything is tapped: the whole point of
// asking is that the app never has to ask the operating system.
await page.evaluate(() => {
  window.__askedForLocation = false;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition = () => { window.__askedForLocation = true; };
    navigator.geolocation.watchPosition = () => { window.__askedForLocation = true; return 0; };
  }
});

// The chips live in the picker, behind the day's question. The picker is a
// modal — portaled out of <main> — so everything here counts against the
// document, not against the page's own column.
const dayButton = page.getByRole('button', { name: /log another|what are you wearing|log a wear/i }).first();
check('the day is answerable from Today', await dayButton.count() === 1, '');
await dayButton.click();
await page.waitForTimeout(900);
const pickPieces = page.getByRole('button', { name: /pick pieces instead/i }).first();
await pickPieces.click();
await page.waitForTimeout(900);

const chips = await page.evaluate(() =>
  ['Cold', 'Mild', 'Warm', 'Wet'].filter(label =>
    [...document.querySelectorAll('button')].some(b => (b.textContent || '').trim() === label)));
check('the weather is asked, not tracked — four chips, no permission prompt',
  chips.length === 4, chips.join(' ') || 'no chips found');

const before = await page.evaluate(() => document.querySelectorAll('li').length);
await page.getByRole('button', { name: 'Cold', exact: true }).first().click();
await page.waitForTimeout(700);
const after = await page.evaluate(() => ({
  count: document.querySelectorAll('li').length,
  blank: document.body.innerText.trim().length < 40,
  asked: window.__askedForLocation === true,
}));
check('answering the weather narrows the picker without emptying it',
  !after.blank && after.count > 0 && after.count <= before, `${before} → ${after.count}`);
check('the weather never asks for your location', !after.asked, '');

/* ============ cutting a background out, on the device ============ */
// Driven through the interface with a real photograph, because the claim being
// tested is "a person can lift a garment off its background here", not "a
// function returns a data URL".
{
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const add = page.getByRole('button', { name: /add a piece/i }).first();
  await add.click();
  await page.waitForTimeout(600);

  await page.setInputFiles('#add-item-photo', 'public/intake-samples/kerbside.jpg');
  await page.waitForTimeout(700);

  // Nothing may leave the device. Any request out during the cut is a failure
  // of the entire premise, so watch for one.
  const sent = [];
  page.on('request', r => {
    if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) {
      sent.push(r.url().slice(0, 80));
    }
  });

  const lift = page.getByRole('button', { name: /lift(ing)? the background|lift off the background/i }).first();
  check('the cutout is offered once a photograph is attached', await lift.count() === 1, '');
  await lift.click();
  // The bench debounces, then runs a full pass over ~1MP.
  await page.waitForTimeout(4000);

  const bench = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    const lifted = imgs.find(i => /lifted off its background/i.test(i.alt));
    return {
      shown: !!lifted,
      isPng: (lifted?.src ?? '').startsWith('data:image/png'),
      bytes: (lifted?.src ?? '').length,
      working: /Working/.test(document.body.innerText),
      hasUse: [...document.querySelectorAll('button')].some(b => /use the lifted one/i.test(b.textContent || '')),
      hasKeep: [...document.querySelectorAll('button')].some(b => /keep the original/i.test(b.textContent || '')),
    };
  });

  check('the lifted photograph is produced in the browser', bench.shown && !bench.working,
    `${Math.round(bench.bytes / 1024)}KB`);
  // A PNG does not compress a photograph, and localStorage is about five
  // megabytes for the whole wardrobe. A cut-out that cannot be stored is not
  // a feature.
  check('the lifted photograph is small enough to keep',
    bench.bytes > 0 && bench.bytes < 500 * 1024, `${Math.round(bench.bytes / 1024)}KB`);
  check('it is a PNG, so it carries a real alpha channel', bench.isPng, '');
  check('both answers are offered — take it, or keep the original',
    bench.hasUse && bench.hasKeep, '');
  check('nothing left the device while cutting', sent.length === 0, sent.slice(0, 2).join(' '));

  // Close the sheet, or it stays over the closet and eats the next click.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/* ============ today's outfit, and the one step that uses the network ============ */
{
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const todays = page.getByRole('link', { name: /today.s outfit/i }).first();
  check('the closet offers to read what you are wearing', await todays.count() === 1, '');
  await todays.click();
  await page.waitForTimeout(900);

  const bench = await page.evaluate(() => ({
    hash: location.hash,
    worn: /Photograph what you are wearing/i.test(document.body.innerText),
    // The honest sentence must be on screen BEFORE the button that sends
    // anything, not in a tooltip and not after the fact.
    warns: /This one step uses the network/i.test(document.body.innerText),
    saysWhere: /goes to Anthropic, with your key/i.test(document.body.innerText),
    saysLocal: /cutting, the background removal and the writing all happen on this/i.test(document.body.innerText),
    keyField: !!document.querySelector('#intake-key'),
    stillOffersPrompt: /Copy the prompt/i.test(document.body.innerText),
  }));

  check("today's outfit opens the bench in worn mode", bench.hash.includes('worn=1') && bench.worn, bench.hash);
  check('the network step is declared before the button that takes it', bench.warns && bench.saysWhere, '');
  check('and it says what stays on the device', bench.saysLocal, '');
  check('a key can be given right there', bench.keyField, '');
  check('the do-it-yourself prompt is still offered', bench.stillOffersPrompt, '');

  // With no key stored, pressing the button must not touch the network.
  const calls = [];
  page.on('request', r => { if (/anthropic/i.test(r.url())) calls.push(r.url()); });
  await page.getByRole('button', { name: /read what I am wearing/i }).first().click();
  await page.waitForTimeout(900);
  const refused = await page.evaluate(() => /Add a key below first/i.test(document.body.innerText));
  check('with no key it asks for one instead of failing at the network', refused, '');
  check('and nothing was sent', calls.length === 0, calls.join(' '));
}

/* ============ lifting the background on a piece already catalogued ============ */
{
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // Open the first piece that has a real photograph.
  const opened = await page.evaluate(() => {
    const withPhoto = [...document.querySelectorAll('article')]
      .find(a => a.querySelector('img'));
    const open = withPhoto?.querySelector('button[aria-label^="Open"]');
    if (!open) return false;
    open.click();
    return true;
  });
  await page.waitForTimeout(900);
  const lift = page.getByRole('button', { name: /^lift the background$/i }).first();
  check('a piece already in the closet can have its background lifted',
    opened && await lift.count() === 1, '');
  if (opened && await lift.count()) {
    await lift.click();
    await page.waitForTimeout(3500);
    const bench = await page.evaluate(() => ({
      shown: [...document.querySelectorAll('img')].some(i => /lifted off its background/i.test(i.alt)),
      keep: [...document.querySelectorAll('button')].some(b => /keep the original/i.test(b.textContent || '')),
    }));
    check('the bench opens on the saved photograph', bench.shown && bench.keep, '');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

/* ============ the obsidian room ============ */
{
  await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const room = await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'obsidian');
    const s = getComputedStyle(document.documentElement);
    const plate = document.querySelector('.plate');
    const ps = plate ? getComputedStyle(plate) : null;
    return {
      artline: s.getPropertyValue('--color-artline').trim(),
      artline2: s.getPropertyValue('--color-artline-2').trim(),
      silver: s.getPropertyValue('--color-silver').trim(),
      outline: ps?.outlineWidth ?? '',
      ornament: (ps?.backgroundImage ?? '').includes('svg'),
      sheen: getComputedStyle(document.documentElement).getPropertyValue('--sheen-strength').trim(),
    };
  });
  check('obsidian hangs its frieze in gold', room.artline.toLowerCase() === '#e7c46a', room.artline);
  check('and answers it in silver', room.artline2.toLowerCase() === '#cfd6e0' && room.silver !== '', room.artline2);
  check('obsidian takes the double mounting', room.outline === '1px', room.outline);
  check('obsidian carries the corner ornament', room.ornament, '');
  check('the pointer light is softened', Number(room.sheen) <= 0.12, room.sheen);
}

/* ============ installable, and offline ============ */
await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const install = await page.evaluate(() => ({
  offered: /home screen/i.test(document.body.innerText),
  worker: 'serviceWorker' in navigator,
  manifest: !!document.querySelector('link[rel="manifest"]'),
}));
check('the app offers itself to the home screen', install.offered, '');
check('a manifest is declared', install.manifest, '');

const swReady = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? 'registered' : 'none';
});
check('a service worker is registered, so the app survives no signal',
  swReady === 'registered', swReady);

check('no errors anywhere in this run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(failed === 0 ? '\nALL FEATURE CHECKS PASSED' : `\n${failed} FEATURE CHECKS FAILED`);
process.exit(failed ? 1 : 0);
