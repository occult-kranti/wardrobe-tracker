#!/usr/bin/env node
/**
 * THE ALPHA MONITOR, DRIVEN IN A REAL BROWSER.
 *
 * The board is a separate build on a separate address (vite.portal.config.ts),
 * and the whole point of it is that it is NOT the closet app. That separation
 * is easy to state and easy to lose: one stray import of a page, one helpful
 * addition of a manifest, one useEffect that fetches on mount, and the board
 * becomes either a second copy of the app or a thing that spends the house's
 * tokens every time a tab is left open. So the separation is asserted here
 * rather than trusted.
 *
 * Four properties, and the last two are the ones that would rot quietly:
 *
 *   1. The board renders, in the house's faces, on the house's ground.
 *   2. The closet app is not reachable on this server at all.
 *   3. NOTHING is fetched on mount. A relay probe spends the owner's own key,
 *      and a board that asks before it is asked will also show a stale answer
 *      as though it were current. Asserted by recording every request the page
 *      makes and requiring that none of them reach a service.
 *   4. Every empty state says WHICH kind of empty it is. "Not asked yet" and
 *      "the service answered and the answer is none" are different facts, and
 *      a board that renders a confident zero for a question it never asked is
 *      worse than a blank one.
 *
 * Usage: node scripts/test-portal.mjs [origin]   (default http://localhost:4175)
 *
 * Serve the board first:  npm run dev:portal
 * or against a build:     npm run build:portal && npm run preview:portal
 *                         node scripts/test-portal.mjs http://localhost:4176
 */
import { chromium } from 'playwright';

const ORIGIN = process.argv[2] ?? 'http://localhost:4175';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
const requests = [];
page.on('console', m => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', e => consoleErrors.push(String(e)));
page.on('request', r => requests.push(r.url()));

try {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
} catch (err) {
  console.log('FAIL - the board did not answer at', ORIGIN);
  console.log('       ', String(err).split('\n')[0]);
  console.log('        Serve it first: npm run dev:portal');
  await browser.close();
  process.exit(1);
}

/* ---------- 1. it renders, as this house ---------- */

check('the title names the board', (await page.title()) === 'Almari — alpha monitor', await page.title());

const h1 = ((await page.locator('h1').first().textContent()) ?? '').trim();
check('the masthead renders', h1 === 'Alpha monitor', h1);

const font = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily);
check('the masthead is set in Fraunces', /Fraunces/i.test(font), font);

// The ground is painted on `html`, not on `body` — src/index.css's @layer base
// sets it there so the colour survives a body that is shorter than the viewport.
// Reading body here returns transparent and proves nothing.
const ground = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
check('the paper ground is painted', ground !== 'rgba(0, 0, 0, 0)' && ground !== '', ground);

// An unstyled board is the silent failure mode when Tailwind's scanning root
// moves (see the comment in vite.portal.config.ts). A card with no padding is
// the cheapest proof the utility sheet actually arrived.
const carded = await page.evaluate(() => {
  const el = document.querySelector('.plate');
  return el ? getComputedStyle(el).paddingTop : '';
});
check('the utility sheet arrived (a plate has its padding)', carded !== '' && carded !== '0px', carded);

/* ---------- 2. the closet app is not here ---------- */

const body = await page.locator('body').innerText();
check('no wardrobe surface leaked into the board', !/Log wear|Before you buy|The dressing room/i.test(body));

const manifest = await page.locator('link[rel="manifest"]').count();
check('the board carries no manifest', manifest === 0);

const sw = await page.evaluate(() =>
  'serviceWorker' in navigator ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0,
);
check('the board registered no service worker', sw === 0, String(sw));

const indexResponse = await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'domcontentloaded' });
const indexTitle = await page.title();
check(
  'index.html on this server is the board, not the closet',
  indexTitle === 'Almari — alpha monitor',
  `${indexResponse.status()} ${indexTitle}`,
);

/* ---------- 3. nothing is asked until it is asked ---------- */

requests.length = 0;
consoleErrors.length = 0;
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
// Give any stray effect a chance to fire before we call the page quiet.
await page.waitForTimeout(1200);

const reachedOut = requests.filter(u => /supabase\.co|functions\/v1/.test(u));
check(
  'no service was called on mount',
  reachedOut.length === 0,
  reachedOut.length ? reachedOut.slice(0, 2).join(' ') : 'none',
);

const readButton = page.locator('button', { hasText: 'Read the board' }).first();
check('the read button is disabled while no token is given', await readButton.isDisabled());

/* ---------- 4. every empty state says which empty it is ---------- */

// Section headings carry .type-label, which is text-transform:uppercase, so the
// rendered text is in caps. Fold the case rather than asserting the transform.
const fresh = await page.locator('body').innerText();
const said = (phrase) => fresh.toLowerCase().includes(phrase.toLowerCase());
check('the count says it has not been asked', said('Not asked yet'));
check('the relay says it has not been probed', said('Not probed yet'));
check('the board states what it cannot see', said('What this board cannot see'));
check('the board states who can read it', said('Who can read this page'));
check('the board names who has arrived', said('Who has arrived'));
/* The board must keep saying what it CANNOT see, and that sentence has already
   moved once: it used to read "the app keeps no usage record", which stopped
   being true the day the opt-in record shipped. So the assertion is on the
   standing property — that the board names the limits of the source it reads —
   and separately that the stale claim has not crept back. */
check(
  'the board still names what its source cannot tell it',
  said('is not on this board yet'),
);
check(
  'and it no longer claims a usage record that now exists',
  !said('the app keeps no usage record'),
);

// The specific lie this board exists to avoid: a zero standing in for a
// question that was never asked.
const zeroed = await page.locator('.tabular').allTextContents();
check(
  'no figure is rendered before anything was asked',
  zeroed.every(t => t.trim() === ''),
  zeroed.filter(t => t.trim()).slice(0, 3).join(' '),
);

/* ---------- the console ---------- */

check(
  'the console is clean',
  consoleErrors.length === 0,
  consoleErrors.slice(0, 2).join(' | '),
);

await browser.close();

console.log(`\n${failed === 0 ? 'the board holds' : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);
