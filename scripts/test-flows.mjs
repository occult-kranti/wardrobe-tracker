#!/usr/bin/env node
/**
 * The flow suite: drives a real browser through every route, signed out and
 * signed in, on a phone viewport and a desktop one, clicking what a person
 * would click and asserting the app never breaks under them.
 *
 * It exists because the bugs that hurt most are not the ones a unit test
 * sees. A page that renders the sign-in screen while the URL says /feed is
 * perfectly valid React and a dead end for a human; a body that scrolls
 * sideways is nobody's component's fault. Those are the faults this catches.
 *
 * Usage: node scripts/test-flows.mjs [origin]     (default http://localhost:4174)
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = process.argv[2] ?? 'http://localhost:4174';

/* ---------- the flag, and the roster it seats ----------

   Read from the modules the APP compiles against — packages/shared/flags.ts
   and packages/shared/nav.ts — never restated here. Two consequences, both
   deliberate: the branch feed-showcase flips one line in flags.ts and every
   assertion below turns itself back on with no edit to this file; and the rail
   is checked against the same array that draws it, so a rename that reaches
   only one of them is a red line rather than a shrug.

   Nothing here is ever skipped by deleting it. Where a check cannot apply at
   one flag value, the OTHER truth is asserted in its place, and the one block
   that has nothing to test at all says SKIP out loud and names the flag. */
const flagDir = mkdtempSync(join(tmpdir(), 'flows-flags-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    flags: fileURLToPath(new URL('../packages/shared/flags.ts', import.meta.url)),
    nav: fileURLToPath(new URL('../packages/shared/nav.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: flagDir,
  logLevel: 'error',
});
const { FEED_ENABLED } = await import(pathToFileURL(join(flagDir, 'flags.js')).href);
const { barSlots } = await import(pathToFileURL(join(flagDir, 'nav.js')).href);

/** The Look Book's addresses on the web. Hidden together or shown together. */
const LOOK_BOOK = ['/feed', '/explore'];

const ALL_ROUTES = [
  '/', '/closet', '/outfits', '/calendar', '/ledger', '/wishlist', '/compare',
  '/events', '/feed', '/explore', '/chats', '/profile', '/rail', '/settings', '/intake', '/open',
];
/** The rooms this branch actually has. The hidden four get their own checks. */
const ROUTES = ALL_ROUTES.filter(r => FEED_ENABLED || !LOOK_BOOK.includes(r));

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};
/** A block with nothing to test on this branch says so, loudly, and names why. */
const skip = (what, why) => console.log('SKIP -', what, `(${why})`);

console.log(`FEED_ENABLED=${FEED_ENABLED} (packages/shared/flags.ts) — the Look Book is ${
  FEED_ENABLED ? 'SEATED' : 'HIDDEN'} on this branch.\n`);

const browser = await chromium.launch();

/** A page that collects its own errors, so a fault anywhere fails the run. */
async function open(size) {
  const ctx = await browser.newContext({
    viewport: size,
    hasTouch: size.width < 700,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 140)));
  // A browser probes /favicon.ico on its own, and a static host answers 404.
  // The console message for that carries no URL — "Failed to load resource:
  // the server responded with a status of 404 ()" — so filtering the TEXT
  // cannot tell it apart from a real missing asset. Watch responses instead,
  // where the URL is known, and let the console line through only when a
  // genuine 404 was seen.
  const missing = [];
  page.on('response', r => {
    if (r.status() === 404 && !/favicon\.ico/i.test(r.url())) missing.push(r.url());
  });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon|manifest/i.test(text)) return;
    // A bare 404 line is only an error if a non-favicon 404 actually happened —
    // and when it did, say WHICH file, because "404 ()" is unactionable.
    if (/status of 404/.test(text)) {
      if (missing.length === 0) return;
      errors.push('404: ' + missing[missing.length - 1]);
      return;
    }
    errors.push('console: ' + text.slice(0, 140));
  });
  return { ctx, page, errors };
}

async function installSamples(page) {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // The door leads with the account now: one honest skip takes you past it to
  // the wardrobes. Signed-in runs see "Continue" in the same place.
  const skip = page.getByRole('button', { name: /continue without an account|^continue$/i }).first();
  if (await skip.count()) {
    await skip.click();
    await page.waitForTimeout(500);
  }
  const install = page.getByRole('button', { name: /sample wardrobes/i });
  if (await install.count()) {
    await install.click();
    await page.waitForTimeout(900);
  }
}

async function signIn(page, who = /meher/i) {
  await installSamples(page);
  const open = page.getByRole('button', { name: who }).first();
  if (await open.count()) {
    await open.click();
    await page.waitForTimeout(700);
  }
}

/** What a person can see and do, right now, on this screen. */
const survey = page => page.evaluate(() => {
  const doc = document.documentElement;
  const nav = [...document.querySelectorAll('nav')]
    .map(n => ({ pos: getComputedStyle(n).position, r: n.getBoundingClientRect() }))
    .find(n => n.pos === 'fixed');
  return {
    hash: location.hash,
    text: (document.body.innerText || '').trim().slice(0, 120).replace(/\s+/g, ' '),
    // A screen with nothing on it is a break, however valid the DOM is.
    empty: (document.body.innerText || '').trim().length < 12,
    scrollsSideways: doc.scrollWidth > doc.clientWidth + 1,
    // Owner decision 2026-08-19: the currency is the rupee, app-wide. A
    // dollar amount on any screen is a regression, whatever page it is on.
    dollarAmounts: /\$\s?\d/.test(document.body.innerText || ''),
    overflowBy: doc.scrollWidth - doc.clientWidth,
    railOnScreen: nav ? nav.r.top < window.innerHeight - 8 && nav.r.bottom > 0 : null,
    railHeight: nav ? Math.round(nav.r.height) : null,
    tappableUnder44: [...document.querySelectorAll('button, a[href], select, [role="button"]')]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44;
      }).length,
  };
});

/* ================= signed out ================= */
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const first = await survey(page);
  check('signed out: the door is a real screen', !first.empty, first.text.slice(0, 60));

  // The heart of the "back three times" report: a deep link while signed out
  // must not push history entries that all render the same door.
  //
  // What "stale" means here is that the ADDRESS and the SCREEN disagree — the
  // door showing while the URL still claims /feed. It does not mean the word
  // "feed" may not appear at all: carrying the intended destination through
  // the door as ?next= is how choosing a wardrobe finishes the journey, and
  // an earlier spelling of this check rejected exactly that honest fix. So
  // assert the two things a person actually feels: the path portion is the
  // door's own address, and the redirect REPLACED the entry rather than
  // stacking a second one, so a single back leaves the app.
  const before = await page.evaluate(() => history.length);
  await page.goto(`${ORIGIN}/#/feed`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const deep = await survey(page);
  const deepPath = deep.hash.replace(/^#/, '').split('?')[0];
  check('signed out: a deep link does not strand you at a stale URL',
    deepPath === '' || deepPath === '/' || deepPath === '/open',
    `hash is ${deep.hash || '(none)'}`);
  const after = await page.evaluate(() => history.length);
  check('signed out: the door replaces the entry instead of stacking one',
    after <= before + 1, `history ${before} → ${after}`);

  // WHAT THE DOOR IS ALLOWED TO SAY (docs/42 §2). Flag on, carrying the
  // destination through as ?next= is how choosing a wardrobe finishes the
  // journey. Flag off, safeNext refuses the address, so there is nothing to
  // carry — and the door must not name a room that is not in the house this
  // season. A door with no plaque is the whole rule.
  const doorText = await page.evaluate(() => document.body.innerText);
  if (FEED_ENABLED) {
    check('flag on: the door remembers the feed you were reaching for',
      /next=/.test(deep.hash) && /feed is inside a wardrobe/i.test(doorText),
      `hash ${deep.hash}`);
  } else {
    check('flag off: the door says nothing about a room that is not in the house',
      !/next=/.test(deep.hash) && !/feed/i.test(doorText),
      `hash ${deep.hash}`);
  }
  check('signed out: no errors', errors.length === 0, errors[0] ?? '');
  await ctx.close();
}

/* ================= signed in, phone ================= */
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 });
  await signIn(page);

  for (const route of ROUTES) {
    await page.goto(`${ORIGIN}/#${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    const s = await survey(page);
    check(`phone ${route.padEnd(9)} renders`, !s.empty, s.text.slice(0, 50));
    check(`phone ${route.padEnd(9)} does not scroll sideways`, !s.scrollsSideways, `${s.overflowBy}px`);
    check(`phone ${route.padEnd(9)} keeps its sums in rupees`, !s.dollarAmounts, '');
    if (route !== '/open') {
      check(`phone ${route.padEnd(9)} keeps the rail on screen`, s.railOnScreen !== false, '');
    }
  }
  check('phone: no errors across every route', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ================= the shell, as the flag leaves it =================

   Every line here is asserted at BOTH flag values — one of the two truths
   applies, never neither. Flag off proves the four hidden addresses answer
   with Today and that no door anywhere still points at them; flag on proves
   the same doors are back and open. */
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  /* --- the rail IS the roster (docs/42 §7) --- */
  const slots = barSlots().slice(0, 4);
  const rail = await page.evaluate(() => {
    const bar = [...document.querySelectorAll('nav')]
      .find(n => getComputedStyle(n).position === 'fixed');
    if (!bar) return null;
    return {
      hrefs: [...bar.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
      cells: [...bar.children].map(el => (el.textContent || '').trim()),
    };
  });
  check("the phone rail is the shared roster, in the roster's order",
    !!rail && rail.hrefs.join(' ') === slots.map(x => `#${x.path}`).join(' '),
    rail ? rail.hrefs.join(' ') : 'no fixed rail found');
  check('the rail says the roster words, and More is the fifth cell',
    !!rail && rail.cells.join(' · ') === [...slots.map(x => x.shortLabel ?? x.label), 'More'].join(' · '),
    rail ? rail.cells.join(' · ') : '');

  /* --- what More is holding --- */
  const moreBtn = page.getByRole('button', { name: /more pages/i }).first();
  await moreBtn.click();
  await page.waitForTimeout(400);
  const sheet = await page.evaluate(() =>
    [...document.querySelectorAll('div.pane a[href]')].map(a => a.getAttribute('href')));
  check('More carries Outfits, which left the rail to seat the roster',
    sheet.includes('#/outfits'), sheet.join(' '));
  if (FEED_ENABLED) {
    check('flag on: the House moved to More, displaced by the Look Book',
      sheet.includes('#/profile'), sheet.join(' '));
  } else {
    check('flag off: no door in More opens on the Look Book',
      !sheet.includes('#/feed') && !sheet.includes('#/explore'), sheet.join(' '));
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  /* --- the four addresses, and where they land --- */
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);
  const head = () => page.evaluate(() => ({
    hash: location.hash,
    h1: (document.querySelector('main h1')?.textContent || '').trim(),
  }));
  const today = await head();
  check('Today has a masthead to be recognised by', today.h1.length > 0, today.h1);

  for (const path of ['/feed', '/explore', '/explore/post-1', '/story/w-abc']) {
    await page.goto(`${ORIGIN}/#${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const at = await head();
    if (FEED_ENABLED) {
      // Not "the hash is unchanged": a fabricated id is a real miss, and the
      // Look Book answers its own misses from inside itself — /explore/post-1
      // settles on /explore, /story/w-abc on /feed. What is under test is that
      // the address stays in the Look Book rather than falling out to Today,
      // which is exactly the property the flag-off branch below inverts.
      check(`flag on: ${path} stays inside the Look Book`,
        /^#\/(feed|explore|story)/.test(at.hash), at.hash);
    } else {
      check(`flag off: ${path} answers with Today, silently`,
        (at.hash === '#/' || at.hash === '') && at.h1 === today.h1,
        `${at.hash || '(none)'} — ${at.h1}`);
    }
  }

  /* --- the Share verb, where the look is the subject --- */
  await page.goto(`${ORIGIN}/#/outfits`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const outfits = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      // innerText, not the source: the label is uppercased by .type-label, so a
      // case-sensitive count found nothing on a page holding twenty cards.
      cards: (t.match(/wear today/gi) || []).length,
      share: /Share this look|Take it off the feed|On the feed|Not shared/i.test(t),
    };
  });
  check('Outfits has saved looks to test the Share verb against', outfits.cards > 0, `${outfits.cards} cards`);
  if (FEED_ENABLED) {
    check('flag on: a look can be put on show from the outfit itself', outfits.share, '');
  } else {
    check('flag off: Outfits offers no Share verb and names no feed',
      !outfits.share, '');
  }

  /* --- the profile's on-show grid: absent, never empty --- */
  await page.goto(`${ORIGIN}/#/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const profile = await page.evaluate(() => document.body.innerText);
  if (FEED_ENABLED) {
    check('flag on: the profile leads with what this wardrobe is showing',
      /What you are showing/i.test(profile), '');
  } else {
    check('flag off: the profile carries no on-show grid — absent, not empty',
      !/What you are showing/i.test(profile) && !/on show/i.test(profile), '');
  }

  check('the shell: no errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ================= the feed, exercised ================= */
if (FEED_ENABLED) {
  const { ctx, page, errors } = await open({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`${ORIGIN}/#/feed`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // Click every control the feed offers, one at a time, and make sure the app
  // is still standing after each.
  const controls = await page.locator('main button, main a[href]').all();
  let clicked = 0;
  for (const c of controls.slice(0, 14)) {
    if (!(await c.isVisible().catch(() => false))) continue;
    const label = ((await c.textContent().catch(() => '')) || '').trim().slice(0, 28);
    await c.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(350);
    const s = await survey(page);
    if (s.empty) check(`feed: still standing after "${label}"`, false, `blank at ${s.hash}`);
    clicked++;
    // come back to the feed for the next control
    await page.goto(`${ORIGIN}/#/feed`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
  }
  check(`feed: ${clicked} controls exercised without a blank screen`, true, '');
  check('feed: no errors while being used', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
} else {
  // The only block in this file with nothing at all to assert: there is no feed
  // on this branch to click through. It is not deleted and it is not weakened —
  // it is announced. The flag-off truths it would otherwise cover (the address
  // answers with Today, no door points at it) are asserted above.
  skip('"the feed, exercised"',
    'FEED_ENABLED is false in packages/shared/flags.ts — the branch feed-showcase flips that one line and this block runs again, unchanged');
}

/* ================= back button honesty ================= */
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  // :visible matters. The shell ships both navigations in the DOM and hides
  // one by breakpoint, so at 390px the desktop sidebar's link to the closet is
  // a real element of zero size. A comma selector resolves to the FIRST match,
  // which was that hidden one — the click timed out, the .catch swallowed it,
  // and the assertion then compared "#/" against "#/" and blamed the app for a
  // tap that never happened. Click what a thumb can actually reach.
  const railLink = page.locator('nav a[href="#/closet"]:visible').first();
  check('the closet is one tap away on the rail', await railLink.count() === 1, '');
  await railLink.click().catch(() => {});
  await page.waitForTimeout(500);
  const atCloset = await survey(page);
  await page.goBack();
  await page.waitForTimeout(500);
  const back = await survey(page);
  check('one tap of back returns from the closet to today',
    /closet/.test(atCloset.hash) && (back.hash === '#/' || back.hash === ''),
    `${atCloset.hash} → ${back.hash}`);
  check('back: no errors', errors.length === 0, errors[0] ?? '');
  await ctx.close();
}

/* ================= desktop sanity ================= */
{
  const { ctx, page, errors } = await open({ width: 1280, height: 900 });
  await signIn(page);
  for (const route of ROUTES) {
    await page.goto(`${ORIGIN}/#${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    const s = await survey(page);
    if (s.empty || s.scrollsSideways) {
      check(`desktop ${route} sound`, false, `empty=${s.empty} sideways=${s.overflowBy}px`);
    }
  }
  check('desktop: every route sound', true, '');
  check('desktop: no errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
console.log(failed === 0 ? '\nALL FLOW CHECKS PASSED' : `\n${failed} FLOW CHECKS FAILED`);
process.exit(failed ? 1 : 0);
