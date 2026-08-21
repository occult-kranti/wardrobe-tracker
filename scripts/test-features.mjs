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
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = process.argv[2] ?? 'http://localhost:4174';

/* The flag, read from the module the app compiles against — never restated
   here, so the branch feed-showcase flips one line in packages/shared/flags.ts
   and the assertions below change sides on their own. */
const flagDir = mkdtempSync(join(tmpdir(), 'features-flags-'));
await build({
  alias: sharedAliases(),
  entryPoints: [fileURLToPath(new URL('../packages/shared/flags.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  outfile: join(flagDir, 'flags.mjs'),
  logLevel: 'error',
});
const { FEED_ENABLED } = await import(pathToFileURL(join(flagDir, 'flags.mjs')).href);
console.log(`FEED_ENABLED=${FEED_ENABLED} (packages/shared/flags.ts)\n`);

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

/**
 * The ACTIVE wardrobe's storage key.
 *
 * `Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'))` was
 * wrong the moment this suite started opening more than one wardrobe: it
 * returns whichever key the browser happens to enumerate first, which for a run
 * that starts a blank wardrobe and then opens a sample is sometimes the blank
 * one. Read the session, the way the app does.
 */
const activeKey = () => page.evaluate(() => {
  const id = JSON.parse(localStorage.getItem('toile-session') || '{}').activeId;
  return id ? `wardrobe-tracker:${id}` : null;
});

/* ============ the door, and the deep link that used to strand you ============ */
await page.goto(`${ORIGIN}/#/feed`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const stranded = await page.evaluate(() => ({
  hash: location.hash,
  // 1200, not 600, not 200: the door's lede has grown twice, and each time it
  // pushed a sentence past the window and failed a check about copy that was
  // still on the screen. The window is the probe, not the contract — keep it
  // wider than the whole door (658 characters as this was written), because
  // the flag-off check below asserts an ABSENCE, and an absence measured
  // through too small a window is a check that passes by not looking.
  text: document.body.innerText.slice(0, 1200),
  theme: document.documentElement.getAttribute('data-theme'),
}));
check('a signed-out deep link redirects instead of stranding the URL',
  stranded.hash.startsWith('#/open'), `hash ${stranded.hash}`);
// THE DOOR'S OWN WORDS, BRANCHED ON THE FLAG (docs/42 §2). This used to be one
// check with an "or" in it, which passed whichever sentence the door showed —
// so it could not have caught the door naming a room that is not in the house.
// Each branch now asserts one sentence and refuses the other.
if (FEED_ENABLED) {
  check('the door says what it is holding for you',
    /feed is inside a wardrobe/i.test(stranded.text), '');
} else {
  // The positive half is the door's own offer — the honest skip past the
  // account, which is the first thing a deep-linked stranger can act on. The
  // negative half is the ruling: no plaque. Both halves matter; asserting only
  // the absence would pass on a blank screen.
  check('the door offers itself and names no hidden room',
    /continue without an account|open a wardrobe|start a wardrobe/i.test(stranded.text)
      && !/feed/i.test(stranded.text),
    '');
}
check('the door is already in the house theme, not the light room',
  stranded.theme === 'dyehouse', `data-theme=${stranded.theme}`);

/* THE FIRST VIEWPORT OF THE FIRST SCREEN.

   RE-PINNED to the amended door (finding rev:arrival, "the account skip sits
   below the fold; the door reads as a sign-up wall"). Measured at 390x844
   before the fix: "Continue without an account" had its top at y=812.6 and its
   bottom at 856 — sliced by the fold on this probe and gone entirely under a
   real phone's browser chrome, because the account panel's paragraph and both
   credential fields rendered above it. What a stranger arriving from a
   WhatsApp link actually saw was EMAIL, PASSWORD, SIGN IN: structurally a
   sign-up wall on the one screen whose whole job is to say an account is
   optional.

   Two halves, both required. The skip must be WHOLLY inside the first
   viewport — bottom, not top, because a button you can see the top of is a
   button you cannot press. And no credential field may exist before somebody
   asks for one, which is what stops the wall from growing back a sentence at
   a time. The third check is the other side of the same contract: asking for
   an account must still bring the fields, or the fix has made a gate of the
   opposite kind. */
{
  const firstView = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => /continue without an account/i.test(b.textContent || ''));
    const r = btn?.getBoundingClientRect();
    return {
      found: !!btn,
      bottom: r ? Math.round(r.bottom) : null,
      vh: Math.round(window.visualViewport?.height ?? window.innerHeight),
      credentials: document.querySelectorAll('input[type="email"], input[type="password"]').length,
      wayIn: [...document.querySelectorAll('button')]
        .some(b => /sign in, or make an account/i.test(b.textContent || '')),
    };
  });
  check('the skip is inside the first viewport, whole',
    firstView.found && firstView.bottom !== null && firstView.bottom <= firstView.vh,
    `bottom ${firstView.bottom} of ${firstView.vh}`);
  check('and no credential field stands between a stranger and their wardrobe',
    firstView.credentials === 0 && firstView.wayIn, `${firstView.credentials} fields on screen`);

  await page.getByRole('button', { name: /sign in, or make an account/i }).first().click();
  await page.waitForTimeout(400);
  const revealed = await page.evaluate(() => ({
    email: !!document.querySelector('input[type="email"]'),
    password: !!document.querySelector('input[type="password"]'),
    skipStands: [...document.querySelectorAll('button')]
      .some(b => /continue without an account/i.test(b.textContent || '')),
  }));
  check('and asking for an account brings the fields, with the skip still standing',
    revealed.email && revealed.password && revealed.skipStands, '');
}

/* ============ starting a wardrobe with nothing typed ============ */
await page.goto(`${ORIGIN}/#/open/new`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
// The door leads with the account now; the honest skip brings the wardrobes.
{
  const skip = page.getByRole('button', { name: /continue without an account|^continue$/i }).first();
  if (await skip.count()) {
    await skip.click();
    await page.waitForTimeout(500);
  }
}
const start = page.getByRole('button', { name: /start it/i }).first();
check('the primary is never disabled on the door', await start.isEnabled(), '');
await start.click();
await page.waitForTimeout(900);
const landed = await page.evaluate(() => ({ hash: location.hash, text: document.body.innerText.slice(0, 90) }));
check('a blank name still opens a wardrobe', landed.hash === '#/' || landed.hash === '',
  `hash ${landed.hash} — ${landed.text.replace(/\s+/g, ' ').slice(0, 50)}`);

// The places feature, in a wardrobe that has none — which is this one, freshly
// started. The sample wardrobes now arrive furnished, so this is the only point
// in the run where the empty state is the true state.
{
  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1, h2').first().waitFor({ state: 'attached', timeout: 15000 });
  const empty = await page.evaluate(() => document.body.innerText);
  check('the empty state names a rail, not a dresser',
    /A rail is a place/i.test(empty) && !/you should own/i.test(empty), '');

  // And no standing invitation in the navigation: arranging is a question you
  // ask of the closet, not a sibling of it.
  const nav = await page.evaluate(() =>
    [...document.querySelectorAll('nav a')].map(a => a.getAttribute('href')));
  check('furniture is not a tab of its own', !nav.includes('#/furniture'),
    nav.filter(Boolean).join(' ').slice(0, 60));
}

/* ============ the first mile: a week-one closet with no outfits ============

   THE WALK THIS BLOCK IS: start a wardrobe, catalogue two pieces, log one, and
   come back tomorrow — which is every alpha tester's first week, and which no
   suite walked. It is run against the blank wardrobe started above, before the
   samples arrive, because a sample wardrobe has saved outfits and a year of
   wear and therefore cannot show either of the two defects below.

   ONE — the sheet used to open on 'choices' unconditionally, so a closet with
   no saved outfits met a paragraph about outfits and a row to press to get
   past it: hero -> "Pick pieces instead" -> piece -> "Log this" is four taps,
   every day, under a hero that promised two (finding rev:arrival, "first-week
   logging is four taps through an empty outfits interstitial").

   TWO — logWear stamps every logged piece 'worn' and the wearable pool
   admitted only 'clean', so each day's clothes silently left the next day's
   picker; nothing but a manual laundry chip ever put them back (finding
   rev:arrival, "logged pieces silently vanish from the next day's picker
   pool"). Two pieces and one log is the smallest closet in which that
   disappearance is visible at all. */
{
  const addPiece = async (name) => {
    await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /add a piece/i }).first().click();
    await page.waitForTimeout(500);
    await page.fill('#add-item-name', name);
    await page.getByRole('button', { name: /add to the closet/i }).first().click();
    await page.waitForTimeout(700);
  };
  await addPiece('Probe kurta');
  await addPiece('Probe trousers');

  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  // A wardrobe started today and still empty gets the tour; it opened before
  // the second piece was catalogued and is closed here rather than fought.
  if (await page.locator('[role="dialog"]').count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  const hero = page.getByRole('button', { name: /log today's wear|log another/i }).first();
  check('a week-one wardrobe can answer the day from Today', await hero.count() === 1, '');
  await hero.click();
  await page.waitForTimeout(700);

  const landing = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const text = dialog?.textContent ?? '';
    return {
      title: (dialog?.querySelector('h2')?.textContent ?? '').trim(),
      interstitial: /pick pieces instead|no saved outfits yet/i.test(text),
      tiles: dialog?.querySelectorAll('ul button[aria-pressed]').length ?? 0,
    };
  });
  check('with no outfits saved, the sheet opens on the pieces themselves',
    /pick the pieces/i.test(landing.title) && !landing.interstitial,
    `titled "${landing.title}"`);
  check('and the pieces are there to press', landing.tiles === 2, `${landing.tiles} tiles`);

  // THE SHEET MUST MEET THE BOTTOM OF THE WINDOW (finding rev:arrival, "route
  // entry animation permanently captures every fixed modal sheet"). `.v2-route`
  // retained its keyframes' final translateY under animation-fill-mode: both,
  // and an element carrying any transform becomes the containing block for
  // every position:fixed descendant — so the bottom sheet was fixed to the
  // PAGE COLUMN, not the window. Measured at 390x844 on a worked closet:
  // top=362, bottom=1015, the list and both buttons under the fold with window
  // scrolling locked by the overlay's body overflow:hidden.
  //
  // This measures the CONSEQUENCE rather than the stylesheet, so any future
  // ancestor transform fails here too; the second check is the structural
  // half — the overlay hangs off <body> through a portal, where no ancestor of
  // the routed page can reach it.
  const box = await page.evaluate(() => {
    const sheet = document.querySelector('.modal-sheet');
    const overlay = document.querySelector('.modal-overlay');
    if (!sheet || !overlay) return null;
    const r = sheet.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      vh: Math.round(window.visualViewport?.height ?? window.innerHeight),
      overlayTop: Math.round(o.top),
      parent: overlay.parentElement?.tagName ?? '',
    };
  });
  check('the log sheet meets the bottom of the window',
    !!box && Math.abs(box.bottom - box.vh) <= 1 && box.top >= 0,
    box ? `top ${box.top}, bottom ${box.bottom} of ${box.vh}` : 'no sheet found');
  check('and it hangs off the document, out of reach of any page transform',
    box?.parent === 'BODY' && box?.overlayTop === 0,
    box ? `parent ${box.parent}, overlay top ${box.overlayTop}` : '');

  // The last tap. Three in total from Today with no outfit saved, which is what
  // the hero now says out loud.
  await page.evaluate(() => {
    document.querySelector('[role="dialog"] ul button[aria-pressed]')?.click();
  });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^log this$/i }).first().click();
  await page.waitForTimeout(900);
  const logged = await page.evaluate(key => {
    const st = JSON.parse(localStorage.getItem(key));
    return { logs: st.wearLogs.length, worn: st.items.filter(i => i.laundryStatus === 'worn').length };
  }, await activeKey());
  check('and the day goes on the record', logged.logs === 1 && logged.worn === 1,
    `${logged.logs} logs, ${logged.worn} worn`);

  // TOMORROW. The piece worn today is still in today's rotation — it is on a
  // body, not in the wash, and nobody said otherwise.
  await page.getByRole('button', { name: /log another/i }).first().click();
  await page.waitForTimeout(700);
  const again = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const text = dialog?.textContent ?? '';
    return {
      kurta: /Probe kurta/.test(text),
      trousers: /Probe trousers/.test(text),
      widen: /show everything in the closet/i.test(text),
    };
  });
  check('a piece logged today is still in the picker afterwards',
    again.kurta && again.trousers,
    `kurta ${again.kurta}, trousers ${again.trousers}`);
  check('and nothing is held back, so nothing asks to be widened',
    !again.widen, '');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

/* ============ what it is like out ============ */
// Against a worked closet, not the empty one just started: an empty wardrobe
// has no picker to narrow, which is a different screen and a different test.
await page.goto(`${ORIGIN}/#/open`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
{
  const skip = page.getByRole('button', { name: /continue without an account|^continue$/i }).first();
  if (await skip.count()) {
    await skip.click();
    await page.waitForTimeout(500);
  }
}
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
const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));
await dayButton.click();
await page.waitForTimeout(900);

/* THE SAME SHEET, ON THE WARDROBE THE DEFECT WAS MEASURED ON (finding
   rev:arrival, "route entry animation permanently captures every fixed modal
   sheet"). A worked closet is the hard case: the page behind is long, so a
   sheet fixed to the PAGE rather than the window lands wherever the column
   happens to be. Measured here at 390x844 before the fix: top=362,
   bottom=1015 — the outfit list and "Pick pieces instead" under the fold,
   window scrolling locked by the overlay's body overflow:hidden, and the
   sheet's own focus() call teleporting the page to scrollY=644 on the way in.
   Both halves are asserted: the sheet meets the window, and opening it moves
   nothing behind it. */
const worked = await page.evaluate(() => {
  const sheet = document.querySelector('.modal-sheet');
  if (!sheet) return null;
  const r = sheet.getBoundingClientRect();
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    vh: Math.round(window.visualViewport?.height ?? window.innerHeight),
    scrollY: Math.round(window.scrollY),
    reachable: [...sheet.querySelectorAll('button')]
      .filter(b => {
        const q = b.getBoundingClientRect();
        return q.height > 0 && (q.bottom > window.innerHeight || q.top < 0);
      }).length,
  };
});
check('on a worked closet the sheet still meets the bottom of the window',
  !!worked && Math.abs(worked.bottom - worked.vh) <= 1 && worked.top >= 0,
  worked ? `top ${worked.top}, bottom ${worked.bottom} of ${worked.vh}` : 'no sheet found');
check('no control in the sheet lands off the screen',
  worked?.reachable === 0, `${worked?.reachable} off-screen controls`);
check('and opening it does not teleport the page behind it',
  worked?.scrollY === scrollBefore, `scrollY ${scrollBefore} → ${worked?.scrollY}`);

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

/* ============ the ledger speaks in rupees ============ */
// Owner decision 2026-08-19: currency and numerals are Indian, app-wide —
// display only, the stored numbers stay bare. Against a worked sample closet
// the totals pass one lakh, so the grouping is truly exercised: ₹1,34,000
// must pass and a western-grouped ₹134,000 must fail.
{
  await page.goto(`${ORIGIN}/#/ledger`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const ledgerText = await page.evaluate(() => document.body.innerText);
  const amounts = ledgerText.match(/₹[\d,]+(?:\.\d\d)?/g) ?? [];
  check('the ledger states its sums in rupees', amounts.length > 0, amounts.slice(0, 3).join(' '));
  // Canonical en-IN: the last group carries three digits, every group before it two.
  const inGrouping = /^₹\d{1,3}(?:\.\d\d)?$|^₹\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d\d)?$/;
  const offGrid = amounts.filter(a => !inGrouping.test(a));
  check('and groups the digits the Indian way',
    amounts.length > 0 && offGrid.length === 0, offGrid.join(' ') || amounts[0]);
  check('no dollar amount survives on the ledger', !/\$\s?\d/.test(ledgerText), '');
}

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

  const bench = await page.evaluate(() => {
    const text = document.body.innerText;
    const warn = [...document.querySelectorAll('p')]
      .find(p => /This one step uses the network/i.test(p.textContent || ''));
    const send = [...document.querySelectorAll('button')]
      .find(b => /Read what I am wearing|Read a photograph/i.test(b.textContent || ''));
    const feedNote = [...document.querySelectorAll('p')]
      .find(p => /One journey per screenshot/i.test(p.textContent || ''));
    const feedBtn = [...document.querySelectorAll('button')]
      .find(b => /Read a feed screenshot/i.test(b.textContent || ''));
    return {
      hash: location.hash,
      worn: /Photograph what you are wearing/i.test(text),
      // The honest sentence must be on screen BEFORE the button that sends
      // anything, in document order — not in a tooltip and not after the fact.
      warns: !!warn,
      declaredFirst: !!warn && !!send
        && !!(warn.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING),
      namesRelay: /Almari.s relay/i.test(text),
      namesModel: /Claude Fable by Anthropic/i.test(text),
      serverKey: /holds the key on the server/i.test(text),
      saysLocal: /cutting, the background removal and the writing all happen on this/i.test(text),
      stillOffersPrompt: /Copy the prompt/i.test(text),
      keyField: !!document.querySelector('#intake-key'),
      pointsToSettings: /your own endpoint can be set in Settings/i.test(text),
      // The feed import: same bench, same honesty — its own declaration before
      // its own button, and the solo rule said out loud on the card.
      feedSection: /From a feed screenshot/i.test(text),
      feedHonest: /group photos are left alone/i.test(text),
      feedInput: !!document.querySelector('#intake-feed'),
      feedDeclaredFirst: !!feedNote && !!feedBtn
        && !!(feedNote.compareDocumentPosition(feedBtn) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });

  check("today's outfit opens the bench in worn mode", bench.hash.includes('worn=1') && bench.worn, bench.hash);
  check('the network step is declared before the button that takes it',
    bench.warns && bench.declaredFirst, '');
  check('the declaration names the relay and where the key is held',
    bench.namesRelay && bench.serverKey, '');
  check('the declaration names the model and its house', bench.namesModel, '');
  check('and it says what stays on the device', bench.saysLocal, '');
  check('the do-it-yourself prompt is still offered', bench.stillOffersPrompt, '');
  check('the feed import declares its own journey, and the solo rule, before its button',
    bench.feedSection && bench.feedHonest && bench.feedInput && bench.feedDeclaredFirst, '');

  // NOT GATED, BY EXPLICIT RULING (docs/42 §2). "From a feed screenshot" is the
  // PHOTO bench — a picture somebody took of a feed in some other app, read for
  // garments — and has nothing to do with this app's own feed. It stays in both
  // branches, and this line asserts it at whatever FEED_ENABLED currently is,
  // so nobody helpfully gates it along with the Look Book.
  check(`the photo bench keeps its feed-screenshot import with FEED_ENABLED=${FEED_ENABLED}`,
    bench.feedSection && bench.feedInput, '');

  // The key field left the bench when the relay arrived: the send needs none,
  // and a key of your own is a Settings override, not a toll at the door.
  check('no key is asked for on the bench, which points to Settings',
    !bench.keyField && bench.pointsToSettings, '');

  // With no key anywhere on the device the send still goes — to the relay,
  // which holds the key server-side. Nothing may go to Anthropic, and no
  // screen may demand a key.
  const sent = [];
  page.on('request', r => sent.push(r.url()));
  const relayed = page.waitForRequest(
    r => r.url().includes('/functions/v1/ai-proxy'), { timeout: 20000 }).catch(() => null);
  await page.setInputFiles('#intake-photo', 'public/intake-samples/kerbside.jpg');
  await relayed;
  // Let the journey finish: an answer on the bench, or an honest failure line.
  await page.waitForFunction(() => {
    if (document.querySelector('.text-danger')) return true;
    return ![...document.querySelectorAll('button')]
      .some(b => /Reading the photograph|Cutting \d+ of/i.test(b.textContent || ''));
  }, { timeout: 60000 }).catch(() => {});
  const afterSend = await page.evaluate(() => document.body.innerText);
  check('with no key the send goes to the relay, which holds the key server-side',
    sent.some(u => u.includes('/functions/v1/ai-proxy')),
    sent.find(u => u.includes('/functions/')) ?? 'no relay call seen');
  check('and nothing goes to Anthropic, and no key is demanded',
    !sent.some(u => /anthropic\.com/i.test(u)) && !/add a key|enter your key/i.test(afterSend), '');

  // The override the bench points at is real, and lives where it says it does.
  await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const byok = await page.evaluate(() => ({
    endpoint: !!document.querySelector('#set-endpoint'),
    key: !!document.querySelector('#set-byok-key'),
    namesRelay: /relay/i.test(document.body.innerText),
  }));
  check('a key of your own can still be given — in Settings',
    byok.endpoint && byok.key && byok.namesRelay, '');
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

/* ============ furniture — where a garment physically lives ============ */
{
  // THE WAY IN. Furniture has no tab, so the Closet page carries the only
  // standing entry to it — one row, above the grid, under the rails.
  const wayIn = page.locator('a[href="#/furniture"]').first();
  check('the closet carries the way in to the room', await wayIn.count() === 1, '');
  await wayIn.click();
  await page.waitForTimeout(900);
  const arrivedAtRoom = await page.evaluate(() => location.hash);
  check('and it opens the room', arrivedAtRoom === '#/furniture', arrivedAtRoom);

  // A sample wardrobe arrives furnished, so the feature is visible to somebody
  // who has never drawn a place.
  const furnished = await page.evaluate((key) => {
    const st = JSON.parse(localStorage.getItem(key));
    return { places: st.furniture.length, filed: st.items.filter(i => i.place).length, total: st.items.length };
  }, await activeKey());
  check('the sample wardrobe comes furnished', furnished.places >= 3, `${furnished.places} places`);
  check('and about half of it is filed, never all',
    furnished.filed / furnished.total > 0.25 && furnished.filed / furnished.total < 0.7,
    `${Math.round(furnished.filed / furnished.total * 100)}%`);

  await page.getByRole('button', { name: /draw a place/i }).first().click();
  await page.waitForTimeout(600);

  // The nine forms, and the two that are the point of this pass.
  const forms = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => b.textContent.trim()));
  check('a steel almirah and a carved one are both offered',
    forms.includes('A steel almirah') && forms.includes('A wooden almirah'),
    forms.filter(f => /almirah/i.test(f)).join(', '));
  check('and the things a closet has nowhere to put',
    ['A jewellery box', 'A row of pegs', 'A bangle stand', 'A shoe rack'].every(f => forms.includes(f)), '');

  // An almirah is not N of the same thing: its compartments are the parts of the
  // object, named after themselves, in the order the parts are in.
  const almirahLabels = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') ?? document.body;
    const svg = [...modal.querySelectorAll('svg[aria-label]')]
      .find(s => /compartment/i.test(s.getAttribute('aria-label') || ''));
    return [...(svg?.querySelectorAll('text') ?? [])].map(t => t.textContent);
  });
  check('the almirah draws its own segregation, not numbered drawers',
    almirahLabels.some(t => /HANGING/i.test(t)) && almirahLabels.some(t => /LOCKER/i.test(t)),
    almirahLabels.filter(Boolean).join(' / '));

  // Each form stops where its own drawing stops giving a 44px target.
  const ceiling = async (formLabel, nounRe) => {
    await page.getByRole('button', { name: new RegExp(`^${formLabel}$`) }).first().click();
    await page.waitForTimeout(300);
    const plus = page.getByRole('button', { name: nounRe }).first();
    for (let i = 0; i < 12; i++) {
      if (!(await plus.isEnabled())) break;
      await plus.click();
      await page.waitForTimeout(90);
    }
    return page.evaluate(() => {
      const el = [...document.querySelectorAll('span')]
        .find(x => x.className.includes('tabular') && /^\d+$/.test(x.textContent.trim()));
      return Number(el?.textContent.trim() ?? 0);
    });
  };
  const pegs = await ceiling('A row of pegs', /one more peg/i);
  check('a form stops at its own ceiling, and says why', pegs === 5, `pegs capped at ${pegs}`);
  const trays = await ceiling('A jewellery box', /one more tray/i);
  check('and a different form has a different ceiling', trays === 4, `trays capped at ${trays}`);

  await page.getByRole('button', { name: /^A chest$/ }).first().click();
  await page.waitForTimeout(300);
  await page.fill('#fp-name', 'Bedroom chest');
  // Three drawers by default; add one and confirm the drawing itself changed.
  // The preview specifically — `svg` alone would match a nav icon. The drawing
  // carries an aria-label naming the piece and its drawers.
  // Scoped to the OPEN MODAL. Unscoped, this found the first drawing on the
  // page whose label mentioned drawers — and once the sample wardrobes arrived
  // furnished, that was a chest CARD sitting behind the modal, which of course
  // never changed when the modal's + was pressed.
  const previewSize = () => page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') ?? document.body;
    return [...modal.querySelectorAll('svg[aria-label]')]
      .find(s => /drawer/i.test(s.getAttribute('aria-label') || ''))?.innerHTML.length ?? 0;
  });
  const beforeDraw = await previewSize();
  await page.getByRole('button', { name: /one more drawer/i }).first().click();
  await page.waitForTimeout(400);
  const afterDraw = await previewSize();
  // The chest was reset to a lower count by the ceiling walk above, so this is
  // a real "one more drawer redraws the case" check either way.
  check('the drawing is generated from the drawer count', afterDraw > beforeDraw && beforeDraw > 0,
    `${beforeDraw} → ${afterDraw} chars of path`);

  await page.getByRole('button', { name: /^draw it$/i }).first().click();
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => ({ hash: location.hash, text: document.body.innerText.slice(0, 120) }));
  check('drawing a place opens it', /#\/furniture\//.test(opened.hash), opened.hash);

  // Put four pieces away in one gesture — the whole reason bulk exists.
  await page.getByRole('button', { name: /put things in/i }).first().click();
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('ul button[aria-pressed]')].slice(0, 4);
    tiles.forEach(t => t.click());
  });
  await page.waitForTimeout(400);
  const fileBtn = page.getByRole('button', { name: /file 4 pieces here/i }).first();
  check('a shelf-full is filed in one gesture, not four', await fileBtn.count() === 1, '');
  await fileBtn.click();
  await page.waitForTimeout(900);

  const filled = await page.evaluate(() => document.body.innerText);
  check('the drawer now holds them', /4 pieces/i.test(filled), '');

  // THE CHECK THIS FEATURE EXISTS TO SURVIVE.
  const countPieces = async () => page.evaluate(
    key => JSON.parse(localStorage.getItem(key)).items.length, await activeKey());
  const beforeRemove = await countPieces();
  await page.getByRole('button', { name: /remove this place/i }).first().click();
  await page.waitForTimeout(600);
  // The gate stands before the act (owner's order, 2026-08-19): a warning
  // that names the place and says what happens to the clothes filed in it.
  const gate = page.getByRole('button', { name: /^remove it$/i }).first();
  check('a warning stands before the removal', await gate.count() === 1, '');
  if (await gate.count()) await gate.click();
  await page.waitForTimeout(1200);
  const afterRemove = await countPieces();
  check('removing furniture never removes clothes', beforeRemove === afterRemove,
    `${beforeRemove} → ${afterRemove} pieces`);

  const undo = page.getByRole('button', { name: /^undo$/i }).first();
  check('and the removal offers Undo', await undo.count() === 1, '');
  if (await undo.count()) {
    await undo.click();
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => document.body.innerText);
    check('Undo puts the place back with its contents', /Bedroom chest/i.test(back), '');
  }
}

/* ============ the room, and packing away ============ */
{
  // THE INDEX IS AN ELEVATION. Every form is drawn into the same box on the
  // same floor, so at equal widths the tall object is visibly the tall one.
  // That replaced a drawn perspective room which was 91% empty at every width
  // and which was a SECOND generator for objects this app already draws — it
  // drifted within one commit of a form being added, rendering that form as
  // nothing at all.
  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.locator('svg[aria-label]').first().waitFor({ state: 'attached', timeout: 15000 });
  const strip = await page.evaluate(() => {
    const draw = [...document.querySelectorAll('a[href^="#/furniture/"] svg[aria-label]')];
    const boxes = draw.map(s => {
      // getBBox is the bounding box of what is DRAWN, in user units — the
      // element's own rect is the shared 460×560 frame and is the same for
      // every form by construction.
      const ink = s.getBBox();
      return { label: s.getAttribute('aria-label'), w: s.getBoundingClientRect().width, ink };
    });
    return {
      count: boxes.length,
      widths: [...new Set(boxes.map(b => Math.round(b.w)))],
      tallest: boxes.slice().sort((a, b) => b.ink.height - a.ink.height)[0]?.label ?? '',
      shortest: boxes.slice().sort((a, b) => a.ink.height - b.ink.height)[0]?.label ?? '',
      floors: [...new Set(boxes.map(b => Math.round(b.ink.y + b.ink.height)))],
      labelled: draw.some(s => s.querySelector('text')),
    };
  });
  check('the index draws every place', strip.count >= 3, `${strip.count} drawings`);
  check('all at one width, so height means size',
    strip.widths.length === 1, strip.widths.join('/') || 'none');
  check('and the almirah is the tall one', /almirah/i.test(strip.tallest),
    `tallest ${strip.tallest} · shortest ${strip.shortest}`);
  // Everything stands on one floor, which is what makes the heights comparable
  // rather than merely different.
  check('every piece stands on the same floor',
    Math.max(...strip.floors) - Math.min(...strip.floors) <= 20, strip.floors.join('/'));
  // At index scale an in-drawing label lands near 9px, under the contract's
  // 13px floor. The card prints the name in real typography instead.
  check('no label is set below the legible floor', !strip.labelled, '');

  // Arranging still works, which is the point of keeping the feature at all.
  await page.locator('a[href^="#/furniture/"]').first().click();
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => ({
    hash: location.hash,
    labelled: !!document.querySelector('svg[aria-label] text'),
  }));
  check('a place still opens to its own drawing', /#\/furniture\/./.test(opened.hash), opened.hash);
  check('and there the drawing carries its labels', opened.labelled, '');

  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByRole('link', { name: /bedroom chest/i }).first().click().catch(() => {});
  await page.waitForTimeout(700);

  // PACKED AWAY — the seasonal case, which is the whole reason a place is worth
  // having. Nothing leaves the closet; it stops being suggested.
  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: /bedroom chest/i }).first().click();
  await page.waitForTimeout(800);

  const poolBefore = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    return s.items.filter(i => !i.retired && i.laundryStatus === 'clean').length;
  }, await activeKey());

  await page.getByRole('button', { name: /pack this away/i }).first().click();
  // Wait for the CONSEQUENCE, not for a number of milliseconds. The write path
  // coalesces before it reaches storage, and a fixed sleep here made this check
  // fail on a cold first run and pass on every warm one — which is a defect in
  // the test, not weather.
  await page.waitForFunction((key) => {
    if (!key) return false;
    try {
      return JSON.parse(localStorage.getItem(key)).furniture
        .some(f => f.slots.some(x => x.packed === true));
    } catch { return false; }
  }, await activeKey(), { timeout: 15000 }).catch(() => {});

  const packed = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    const slot = s.furniture.flatMap(f => f.slots).find(x => x.packed);
    return {
      flagged: !!slot,
      items: s.items.length,
      stillClean: s.items.filter(i => !i.retired && i.laundryStatus === 'clean').length,
    };
  }, await activeKey());
  check('a compartment can be packed away for the season', packed.flagged, '');
  check('and packing takes nothing out of the closet',
    packed.stillClean === poolBefore, `${poolBefore} → ${packed.stillClean} clean pieces`);

  // The one thing it does change, checked where it changes it.
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const day = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    const packedSlots = new Set(
      s.furniture.flatMap(f => f.slots.filter(x => x.packed).map(x => `${f.id}/${x.id}`))
    );
    const packedNames = s.items
      .filter(i => i.place && packedSlots.has(`${i.place.furnitureId}/${i.place.slotId}`))
      .map(i => i.name);
    const shown = document.body.innerText;
    return { packedNames, offered: packedNames.filter(n => n && shown.includes(n)) };
  }, await activeKey());
  check('what is packed away is not offered for today',
    day.packedNames.length > 0 && day.offered.length === 0,
    `${day.packedNames.length} packed, ${day.offered.length} still offered`);

  // And in the draw itself, not just on the page: a look that reaches into a
  // packed compartment is not offered, and the pieces are not in the picker.
  await page.getByRole('button', { name: /log another|what are you wearing|log a wear/i }).first().click();
  await page.waitForTimeout(700);
  const draw = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    const packedSlots = new Set(
      s.furniture.flatMap(f => f.slots.filter(x => x.packed).map(x => `${f.id}/${x.id}`))
    );
    const packedIds = new Set(s.items
      .filter(i => i.place && packedSlots.has(`${i.place.furnitureId}/${i.place.slotId}`))
      .map(i => i.id));
    const blocked = s.outfits.filter(o => o.itemIds.some(id => packedIds.has(id))).map(o => o.name);
    const sheet = document.querySelector('[role="dialog"]')?.textContent ?? '';
    return { blocked, offered: blocked.filter(n => n && sheet.includes(n)) };
  }, await activeKey());
  check('the draw offers no look that reaches into a packed compartment',
    draw.blocked.length > 0 && draw.offered.length === 0,
    `${draw.blocked.length} blocked, ${draw.offered.length} still offered`);

  await page.getByRole('button', { name: /pick pieces instead/i }).first().click();
  await page.waitForTimeout(700);
  const picker = await page.evaluate((names) => {
    const sheet = document.querySelector('[role="dialog"]')?.textContent ?? '';
    return names.filter(n => n && sheet.includes(n));
  }, day.packedNames);
  check('and the picker skips what is packed away', picker.length === 0,
    picker.join(', ') || 'none listed');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

/* ============ the chair, and the room's own switch ============ */
{
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.locator('#closet-search').waitFor({ state: 'attached', timeout: 15000 });

  // THE ROOM opens the page, and can be put away by anyone who would rather it
  // were not there. The preference outlives a reload.
  const roomFirst = await page.evaluate(() => {
    const search = document.getElementById('closet-search');
    const svg = document.querySelector('svg[viewBox]');
    return !!svg && !!search && svg.compareDocumentPosition(search) === Node.DOCUMENT_POSITION_FOLLOWING;
  });
  check('the closet opens on the room', roomFirst, '');
  // The CLOSET is the clothes; the DRESSING ROOM is the furniture. Two words
  // for two things, and neither borrows the other's.
  const closetText = await page.evaluate(() => document.body.innerText);
  check('the closet is still called the closet',
    /Closet/.test(closetText) && !/^Dressing room/m.test(closetText), '');

  const hide = page.getByRole('button', { name: /hide the room/i }).first();
  check('the room can be put away', await hide.count() === 1, '');
  await hide.click();
  await page.waitForTimeout(500);
  const hidden = await page.evaluate(() => ({
    stored: localStorage.getItem('toile-room'),
    gone: document.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded') === 'false',
  }));
  check('and it goes', hidden.gone && hidden.stored === 'off', `stored=${hidden.stored}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const stillHidden = await page.evaluate(() =>
    document.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded') === 'false');
  check('and stays away across a reload', stillHidden, '');
  await page.getByRole('button', { name: /show the room/i }).first().click();
  await page.waitForTimeout(600);
  check('and comes back when asked', await page.evaluate(() =>
    document.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded') === 'true'), '');

  // THE CHAIR STANDS IN THE ROOM, with the furniture — the owner's decision,
  // and truer to a bedroom than a strip of its own under it. What keeps it kind
  // is unchanged: it is absent at zero, it is ink rather than alarm, it says
  // nothing about the person, and it is a VERB — tapping it sends the pile to
  // the wash rather than reporting on it.
  const chair = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="on the chair"]');
    // Its OWN container, not the first svg on the page — the decorative band
    // above the room is also an svg with a viewBox, and it comes first.
    const host = btn?.parentElement;
    const roomSvg = host?.querySelector('svg[viewBox]');
    return {
      shown: !!btn,
      label: btn?.getAttribute('aria-label') ?? '',
      inTheRoom: !!btn && !!roomSvg && getComputedStyle(btn).position === 'absolute',
      numerals: !!roomSvg?.querySelector('text'),
      // It stands among the furniture: the room's other targets are links.
      besideFurniture: (host?.querySelectorAll('a[href^="#/furniture/"]').length ?? 0) > 0,
    };
  });
  check('the chair stands in the room, among the furniture',
    chair.shown && chair.inTheRoom && chair.besideFurniture, chair.label);
  check('and the room draws no numbers', !chair.numerals, '');

  const before = await page.evaluate(key =>
    JSON.parse(localStorage.getItem(key)).items.filter(i => i.laundryStatus === 'worn').length,
    await activeKey());
  await page.locator('button[aria-label*="on the chair"]').first().click();
  await page.waitForTimeout(1000);
  const after = await page.evaluate(key =>
    JSON.parse(localStorage.getItem(key)).items.filter(i => i.laundryStatus === 'worn').length,
    await activeKey());
  check('tapping the chair sends the pile to the wash', before > 0 && after === 0, `${before} → ${after} worn`);

  // And at zero it is simply not there. A chair that is always drawn is a
  // scoreboard in both directions — a gold star when clear, a standing
  // reproach when full.
  await page.waitForTimeout(600);
  const gone = await page.evaluate(() => !document.querySelector('button[aria-label*="on the chair"]'));
  check('with nothing on it the chair is not drawn', gone, '');
}

/* ============ nothing is a dead end ============ */
{
  // THE DEFECT THIS CHECKS FOR: the dressing room has no tab of its own — it
  // is reached from inside the closet — and it shipped with no way back out.
  // On a home-screen install there is no browser chrome to escape with, so a
  // page with no exit is a page you close the app from.
  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1, h2').first().waitFor({ state: 'attached', timeout: 15000 });
  const room = await page.evaluate(() => ({
    titled: /Dressing room/i.test(document.body.innerText),
    // Scoped to MAIN. Unscoped this matched the navigation rail, which every
    // page carries — so it passed with the back button deleted, which is
    // exactly the defect it was written to catch.
    back: [...document.querySelectorAll('main a')].some(a => a.getAttribute('href') === '#/closet'),
  }));
  check('the furniture feature is called the dressing room', room.titled, '');
  check('and it can be left again', room.back, '');

  // Every route that is NOT in the navigation must offer an in-page way back.
  // The ones in the rail have the rail; these have nothing but the browser's
  // own back button, which a home-screen install does not show.
  const stranded = [];
  for (const route of ['#/furniture', '#/intake', '#/open']) {
    await page.goto(`${ORIGIN}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const ways = await page.evaluate(() => {
      const here = location.hash;
      // MAIN only, for the same reason: every route sits inside Layout and
      // inherits its rail, so an unscoped count can never reach zero and the
      // check could never fail.
      return [...document.querySelectorAll('main a[href^="#/"]')]
        .filter(a => a.getAttribute('href') !== here).length;
    });
    if (ways === 0) stranded.push(route);
  }
  check('no route is a dead end', stranded.length === 0, stranded.join(', ') || 'all have a way onward');
}

/* ============ the rooms, in one order ============ */
{
  // The picker used to carry its own order and disagree with the button: it
  // opened on the pattern room while the button cycled to the dye house first.
  // Two orders for one set of rooms cannot be fixed by sorting one of them, so
  // the order has a single declaration now — this asserts the person sees it.
  await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const rooms = await page.evaluate(() => {
    const names = ['Dye house', 'Obsidian', 'Atelier', 'Salon', 'Gilding room', 'Pattern room', 'System'];
    const shown = [...document.querySelectorAll('button')]
      .map(b => (b.textContent || '').trim())
      .filter(t => names.includes(t));
    return shown;
  });
  check('the picker lists the rooms in the order the button walks them',
    rooms.join(' · ') === 'Dye house · Obsidian · Atelier · Salon · Gilding room · Pattern room · System',
    rooms.join(' · ') || 'no rooms found');

  // And the cycle's first step must be the same room the picker leads with.
  const cycled = await page.evaluate(async () => {
    localStorage.removeItem('toile-theme');
    const before = document.documentElement.getAttribute('data-theme');
    const btn = [...document.querySelectorAll('button')]
      .find(b => /theme|room/i.test(b.getAttribute('aria-label') || ''));
    btn?.click();
    await new Promise(r => setTimeout(r, 300));
    return { before, after: document.documentElement.getAttribute('data-theme') };
  });
  check('and the house opens in the dye house', cycled.before === 'dyehouse', `data-theme=${cycled.before}`);
}

/* ============ the obsidian room ============ */
{
  await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
  // Wait for the element being measured, not for a number. A 600ms sleep was
  // enough against a local preview and not enough against the deployed site, so
  // `.plate` was sometimes null and the ornament check read a false off an empty
  // string — a test that reports the network rather than the stylesheet.
  await page.locator('.plate').first().waitFor({ state: 'attached', timeout: 15000 });
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

/* ============ the project lead portal ============ */
{
  // The portal administers the device. The passcode gate was retired by owner
  // order (2026-08-19): the portal opens directly, and the locks are the
  // naming sheets — every destructive step must pass one; the nuclear one must
  // be typed out. These checks run while a worked closet (meher) is open.
  await page.goto(`${ORIGIN}/#/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  check('the portal opens directly onto the controls, no gate',
    await page.locator('#admin-pass').count() === 0, '');

  const opened = await page.evaluate(() => ({
    meher: /meher/i.test(document.body.innerText),
    checks: /run the checks/i.test(document.body.innerText),
  }));
  check('the ledger of wardrobes is standing open', opened.meher && opened.checks, '');

  // The smoke panel first, against the real wardrobes alone — a stunt account
  // injected later must not be what the checks are measured on.
  await page.getByRole('button', { name: /run the checks/i }).click();
  await page.waitForTimeout(5000);
  const smoke = await page.evaluate(() => ({
    aside: /of \d+ passing/i.test(document.body.innerText),
    fails: [...document.querySelectorAll('main *')]
      .filter(el => el.children.length === 0 && /^\s*Fail\s*$/.test(el.textContent || '')).length,
  }));
  check('the portal checks run and every one passes', smoke.aside && smoke.fails === 0,
    `${smoke.fails} failing`);

  // A stunt wardrobe, deleted through the guarded path — the e2e proof that
  // selection + sheet + confirm removes a profile and every key it owned.
  await page.evaluate(() => {
    const accounts = JSON.parse(localStorage.getItem('toile-accounts') ?? '[]');
    accounts.push({
      id: 'portal-stunt', name: 'Portal Stunt', handle: '@stunt', monogram: 'PS',
      color: '#777777', createdAt: new Date().toISOString(),
    });
    localStorage.setItem('toile-accounts', JSON.stringify(accounts));
    localStorage.setItem('wardrobe-tracker:portal-stunt',
      JSON.stringify({ items: [], outfits: [], wishlist: [], wearLogs: [], events: [] }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900); // the gate remembers this tab

  check('a stunt wardrobe joins the ledger',
    await page.getByLabel(/mark portal stunt/i).count() === 1, '');
  await page.getByLabel(/mark portal stunt/i).click();
  await page.getByRole('button', { name: /delete selected/i }).click();
  await page.waitForTimeout(400);
  const sheet = page.locator('.modal-overlay');
  check('deleting profiles passes a naming sheet first',
    /portal stunt/i.test(await sheet.innerText()), '');
  await sheet.getByRole('button', { name: /delete/i }).click();
  await page.waitForTimeout(600);
  // The row's checkbox is the scoped proof — a body-text match would find the
  // action log's own line about the deletion, which is meant to be there.
  const rowGone = await page.getByLabel(/mark portal stunt/i).count() === 0;
  const afterDelete = await page.evaluate(() => ({
    store: localStorage.getItem('wardrobe-tracker:portal-stunt'),
    registry: localStorage.getItem('toile-accounts') ?? '',
  }));
  check('and the confirm removes the profile, its store and its registry line',
    rowGone && afterDelete.store === null && !afterDelete.registry.includes('portal-stunt'), '');

  // The nuclear option stays shut until the phrase is typed — and even then
  // can be walked back, which this run does: the fixtures must survive it.
  await page.getByRole('button', { name: /delete all profiles/i }).click();
  await page.waitForTimeout(400);
  const nuke = page.locator('.modal-overlay');
  const confirm = nuke.getByRole('button', { name: /delete everything/i });
  const shutAtFirst = await confirm.isDisabled();
  await page.locator('#admin-confirm-phrase').fill('DELETE EVERYTHIN');
  const shutOnTypo = await confirm.isDisabled();
  await page.locator('#admin-confirm-phrase').fill('DELETE EVERYTHING');
  const armed = await confirm.isEnabled();
  check('the nuclear sheet wants the exact phrase', shutAtFirst && shutOnTypo && armed, '');
  await nuke.getByRole('button', { name: /keep everything/i }).click();
  await page.waitForTimeout(400);
  check('and cancelling leaves every wardrobe standing',
    /meher/i.test(await page.evaluate(() => document.body.innerText)), '');
}

/* ============ the debts the fix squads asked to have written down ============

   Each of these is a permanent check standing under a defect that reached the
   alpha, asked for by the squad that fixed it and left here so it cannot come
   back quietly. They run against a wardrobe this block starts for itself: the
   samples carry a year of history and a hundred photographs, and half of what
   is measured below — a first photograph, a single wear log, an empty event,
   one thread — cannot be seen in one. */
{
  await page.goto(`${ORIGIN}/#/open/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.fill('#su-name', 'Polish Probe');
  await page.getByRole('button', { name: /^start it$/i }).click();
  await page.waitForTimeout(1000);
  // A wardrobe started today with nothing in it is offered the tour; it is
  // closed here rather than fought with for the rest of the block.
  if (await page.locator('[role="dialog"]').count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  const probeKey = await activeKey();
  const probeId = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('toile-session') || '{}').activeId ?? '');
  check('a wardrobe of this block’s own opens, so the checks below read state it built',
    Boolean(probeKey) && probeKey === `wardrobe-tracker:${probeId}`, probeKey ?? 'none');

  /* ---------- ONE: the photograph the add flow writes down ----------

     THE DEFECT (finding rev:closet, "a camera photo is stored at full
     resolution and can exceed the entire localStorage quota on the first
     add"): readPhoto wrote FileReader's data URL straight into the record. A
     5.6MB phone JPEG measured 7.47M characters against ~4.94M of quota — one
     photographed piece and every subsequent write failed, with "Added. It
     starts at 0 wears." standing directly above "this device would not take
     the write".

     The fixture is drawn here rather than committed: noise does not compress,
     so a few megapixels of it weighs what a phone's own photograph weighs, and
     nothing in the repo has to carry a five-megabyte binary to prove the cap.
     The first check is the fixture's own guarantee — a probe quietly feeding a
     thumbnail through the guard would pass the second check while testing
     nothing at all. */
  const dataUrl = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    const frame = ctx.createImageData(canvas.width, canvas.height);
    const bytes = frame.data;
    const chunk = 65536; // the most crypto will fill in one call
    for (let i = 0; i < bytes.length; i += chunk) {
      crypto.getRandomValues(bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    for (let i = 3; i < bytes.length; i += 4) bytes[i] = 255; // opaque, as a photo is
    ctx.putImageData(frame, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  });
  const fixture = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  check('the photograph this walks in with is the size a phone actually takes',
    fixture.length > 1_000_000, `${Math.round(fixture.length / 1024)}KB`);

  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /add a piece/i }).first().click();
  await page.waitForTimeout(600);
  await page.setInputFiles('#add-item-photo', {
    name: 'phone-photo.jpg', mimeType: 'image/jpeg', buffer: fixture,
  });
  await page.waitForTimeout(2500);
  await page.fill('#add-item-name', 'Probe photograph');
  await page.getByRole('button', { name: /add to the closet/i }).first().click();
  await page.waitForTimeout(1200);

  const written = await page.evaluate(async key => {
    const raw = localStorage.getItem(key) ?? '';
    const st = JSON.parse(raw || '{}');
    const piece = (st.items ?? []).find(i => i.name === 'Probe photograph');
    const onRecord = piece?.imageUrl ?? '';
    /* WHERE THE PICTURE IS, which is no longer always the record.
       src/lib/photoStore.ts files a photograph in IndexedDB and leaves
       `idb:<id>` behind, so the size that matters is read from the room the
       picture is in. Read with the raw database API rather than the app's own
       module, so this stays a measurement of what is on the device and not a
       re-run of the store's own code. */
    const held = onRecord.startsWith('idb:')
      ? await new Promise(resolve => {
          let request;
          try {
            request = indexedDB.open('almari-photos', 1);
          } catch {
            return resolve(null);
          }
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
          request.onsuccess = () => {
            try {
              const get = request.result
                .transaction('photos', 'readonly')
                .objectStore('photos')
                .get(onRecord.slice('idb:'.length));
              get.onsuccess = () => resolve(typeof get.result === 'string' ? get.result : null);
              get.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          };
        })
      : onRecord;
    return {
      persisted: Boolean(piece),
      onRecord: onRecord.length,
      byReference: onRecord.startsWith('idb:'),
      bytes: (held ?? '').length,
      refused: /would not take the write|no room left/i.test(document.body.innerText),
    };
  }, probeKey);
  // PERSISTED, not merely rendered: the failure this stands under kept the
  // piece on screen from memory and lost it on the next refresh.
  check('a photograph added through the add flow is on the record after the write',
    written.persisted && !written.refused,
    written.refused ? 'the device refused the write' : '');
  check('and the stored photograph is a tile, not the print the phone took',
    written.bytes > 1000 && written.bytes < 300_000,
    `${Math.round(written.bytes / 1024)}KB stored from ${Math.round(fixture.length / 1024)}KB`);
  // And the point of the photograph store: the RECORD is what localStorage
  // re-serialises on every keystroke, so what it holds is what the purse pays.
  check('and the record carries a reference rather than the picture — the purse keeps its room',
    written.byReference && written.onRecord < 60,
    `${written.onRecord} bytes on the record, ${Math.round(written.bytes / 1024)}KB in the store`);

  /* ---------- TWO: who can read a synced wardrobe ----------

     THE DEFECT (finding rev:ledger, "sync opt-in omits the who-can-read-it
     sentence the alpha panel demanded"), which docs/35 records as Robin's
     issue #2 with the owner's 2026-08-19 decision behind it. The offer and the
     sentence are checked TOGETHER: asserting the sentence alone would pass on
     a screen where sync is no longer offered at all, and asserting the offer
     alone is what shipped. */
  await page.goto(`${ORIGIN}/#/open`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const opt = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      offered: [...document.querySelectorAll('button')]
        .some(b => /synced to my account/i.test(b.textContent || '')),
      encryption: /end-to-end encryption/i.test(text),
      readable: /(stored readable|could open it)/i.test(text),
    };
  });
  check('where sync is offered, the screen says who can read the copy',
    opt.offered && opt.encryption && opt.readable,
    `offered ${opt.offered}, e2e ${opt.encryption}, readable ${opt.readable}`);

  /* ---------- THREE: what Reset does to the copy on the account ----------

     THE DEFECT (finding rev:ledger, "Reset/Import/Load-sample dialogs say
     'this device' but sync pushes the wipe to the account"): the dialog denied
     that any copy existed while sync was keeping one, and said nothing about
     destroying it. Sync is switched on here through the account record alone —
     there is no session, so this suite pushes nothing anywhere — because what
     the dialog must branch on is where this wardrobe keeps its record. */
  await page.evaluate(id => {
    const accounts = JSON.parse(localStorage.getItem('toile-accounts') ?? '[]');
    localStorage.setItem('toile-accounts', JSON.stringify(
      accounts.map(a => (a.id === id ? { ...a, sync: 'cloud', syncId: 'probe-sync-id' } : a))
    ));
  }, probeId);
  // Reloaded, not merely navigated: the session reads the account registry
  // once at mount, and a hash change is not a mount.
  await page.goto(`${ORIGIN}/#/settings`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^reset$/i }).first().click();
  await page.waitForTimeout(500);
  const dialog = await page.evaluate(() => {
    const sheet = document.querySelector('.modal-overlay');
    return sheet ? sheet.innerText : '';
  });
  check('a synced wardrobe’s Reset names what becomes of the copy on the account',
    /copy on your account/i.test(dialog)
      && /(any other device|pull)/i.test(dialog)
      && !/no copy anywhere/i.test(dialog),
    dialog ? '' : 'no dialog opened');
  await page.getByRole('button', { name: /keep it/i }).first().click();
  await page.waitForTimeout(400);
  // Put the wardrobe back on the device: nothing downstream should meet a
  // cloud wardrobe this suite invented.
  await page.evaluate(id => {
    const accounts = JSON.parse(localStorage.getItem('toile-accounts') ?? '[]');
    localStorage.setItem('toile-accounts', JSON.stringify(
      accounts.map(a => (a.id === id ? { ...a, sync: 'device' } : a))
    ));
  }, probeId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  /* ---------- FOUR: a plan whose day has come ----------

     THE DEFECT (finding rev:rooms, "a matured plan on the calendar offers only
     'Remove' — the natural next tap creates a duplicate that later
     double-counts"): the only "yes, I wore it" lived on Today, so the nearest
     control in the cell was "+ Log", which wrote a SECOND entry and left the
     plan standing. One physical wear, counted twice, in the ledger whose
     honesty is the whole product.

     The plan for today is seeded directly: the scheduling sheet writes future
     days only, so a matured plan cannot be made through the interface inside
     one run. */
  await page.evaluate(key => {
    const st = JSON.parse(localStorage.getItem(key) ?? '{}');
    const item = st.items[0];
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    st.wearLogs = [{ id: 'probe-plan', date: stamp, itemIds: [item.id], planned: true }];
    localStorage.setItem(key, JSON.stringify(st));
  }, probeKey);
  // The wardrobe reads its store at mount, so the seeded plan needs a reload
  // to exist as far as the page is concerned.
  await page.goto(`${ORIGIN}/#/calendar`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const woreIt = page.locator('main button', { hasText: /^Wore it$/ }).first();
  check('a plan whose day has arrived can be answered where the plan is',
    await woreIt.count() === 1, '');
  if (await woreIt.count()) {
    await woreIt.click();
    await page.waitForTimeout(900);
  }
  const sealed = await page.evaluate(key => {
    const st = JSON.parse(localStorage.getItem(key) ?? '{}');
    return {
      logs: (st.wearLogs ?? []).length,
      planned: (st.wearLogs ?? []).filter(l => l.planned === true).length,
      wears: (st.items ?? []).reduce((n, i) => n + (i.wearCount ?? 0), 0),
    };
  }, probeKey);
  check('and confirming it leaves exactly one log, counted once',
    sealed.logs === 1 && sealed.planned === 0 && sealed.wears === 1,
    `${sealed.logs} logs, ${sealed.planned} still planned, ${sealed.wears} wears`);

  /* ---------- FIVE: an event nobody can remove ----------

     THE DEFECT (finding rev:rooms, "an event can never be removed or edited —
     removeEvent exists but no UI calls it"): a mistyped name or a
     fat-fingered year was permanent junk in somebody's own private ledger. The
     gate is checked as well as the control — a whole event with its held days
     goes behind a sheet that names it, and cancelling that sheet leaves the
     event standing. */
  await page.goto(`${ORIGIN}/#/events`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^add( an event)?$/i }).first().click();
  await page.waitForTimeout(500);
  await page.fill('#event-name', 'Probe dinner');
  await page.getByRole('button', { name: /hold these days/i }).first().click();
  await page.waitForTimeout(900);

  const removeEvent = page.getByRole('button', { name: /remove probe dinner/i }).first();
  check('an event card offers a way to take the event off the page',
    await removeEvent.count() === 1, '');
  await removeEvent.click();
  await page.waitForTimeout(500);
  const gate = await page.evaluate(() => {
    const sheet = document.querySelector('.modal-overlay');
    return sheet ? sheet.innerText : '';
  });
  check('and it stands behind a sheet that names the event',
    /probe dinner/i.test(gate), gate ? '' : 'no sheet opened');
  await page.getByRole('button', { name: /keep it/i }).first().click();
  await page.waitForTimeout(600);
  const kept = await page.evaluate(key =>
    (JSON.parse(localStorage.getItem(key) ?? '{}').events ?? []).length, probeKey);
  check('keeping it keeps it', kept === 1, `${kept} events`);

  await removeEvent.click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^remove it$/i }).first().click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(key =>
    (JSON.parse(localStorage.getItem(key) ?? '{}').events ?? []).length, probeKey);
  check('and confirming takes it off the record', after === 0, `${after} events`);

  /* ---------- SIX: a conversation that cannot be cleared ----------

     THE DEFECT (finding rev:social-admin, "deleting accounts leaves ghost
     'Someone' threads and household members forever"): there was no
     delete-conversation UI anywhere, so a thread with a wardrobe that had been
     removed — or one started by a mis-tap — sat in a primary thumb-bar tab for
     good. What is removed is rows on this device; the gate says so, and the
     thread list has to agree afterwards. */
  await page.goto(`${ORIGIN}/#/chats`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /^start one$|^new$/i }).first().click();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelector('[role="dialog"] ul button[aria-pressed]')?.click();
  });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^start it$/i }).first().click();
  await page.waitForTimeout(900);

  const clearing = page.getByRole('button', { name: /remove the conversation with/i }).first();
  check('a thread offers to be cleared off the device, at its head',
    await clearing.count() === 1, '');
  await clearing.click();
  await page.waitForTimeout(500);
  const chatGate = await page.evaluate(() => {
    const sheet = document.querySelector('.modal-overlay');
    return sheet ? sheet.innerText : '';
  });
  // The sheet has to be honest about the one thing a person fears here: that
  // removing a conversation writes to somebody else.
  check('and the sheet says what it touches and what it does not',
    /kept on this device/i.test(chatGate) && /nothing is sent/i.test(chatGate),
    chatGate ? '' : 'no sheet opened');
  await page.getByRole('button', { name: /^remove it$/i }).first().click();
  await page.waitForTimeout(900);
  // Scoped to THIS wardrobe: the samples seed threads of their own, and a
  // count of every conversation on the device would never reach zero.
  const cleared = await page.evaluate(who => {
    const community = JSON.parse(localStorage.getItem('toile-community') ?? '{}');
    return {
      hash: location.hash,
      threads: (community.conversations ?? []).filter(c => c.memberIds.includes(who)).length,
      messages: (community.messages ?? []).length,
      listed: /no conversations yet/i.test(document.body.innerText),
    };
  }, probeId);
  check('and the thread is gone from the store and from the list',
    cleared.threads === 0 && cleared.listed && cleared.hash.startsWith('#/chats'),
    `${cleared.threads} threads, hash ${cleared.hash}`);
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

/* ============ the walkthroughs, and the drift net under them ============

   docs/43. A walkthrough is a stepped card reached from a control INSIDE a
   page's guide sheet — two doors deep, both pulled by the reader. Everything
   below is §7 of that spec, in its order, plus a negative control at the end
   that keeps the net honest.

   WHY THE NET IS THE POINT. A step anchors on an accessible name, and the
   runtime is forgiving by design: a name that no longer resolves loses its ring
   and keeps its text, so a renamed button breaks a walkthrough in total silence
   in somebody's hands. This sweep is the only thing that turns that silence
   into a red line naming the page, the step and the name that went missing. */
{
  const walkDir = mkdtempSync(join(tmpdir(), 'features-walkthroughs-'));
  for (const mod of ['tutorials', 'pageGuides']) {
    await build({
      alias: sharedAliases(),
      entryPoints: [fileURLToPath(new URL(`../src/lib/${mod}.ts`, import.meta.url))],
      bundle: true,
      format: 'esm',
      outfile: join(walkDir, `${mod}.mjs`),
      logLevel: 'error',
    });
  }
  const { tutorialFor, tutorialPaths } =
    await import(pathToFileURL(join(walkDir, 'tutorials.mjs')).href);
  const { guideFor, guidedPaths } =
    await import(pathToFileURL(join(walkDir, 'pageGuides.mjs')).href);

  const scripted = tutorialPaths();
  const guided = guidedPaths();

  /* The seating, as data. A tutorial keyed through guideKeyFor can only exist
     where a guide already stands, which is what stops one being written for a
     Look Book room that answers with Today while the flag is off. */
  const unseated = scripted.filter(p => !guided.includes(p));
  check('no walkthrough stands where no guide does', unseated.length === 0, unseated.join(' '));

  /* THE LENGTH LAW, inherited from pageGuides.ts. A screen that needs six steps
     is asking too much of a first-timer and the fix belongs in the screen. */
  const overspent = scripted.filter(p => {
    const n = tutorialFor(p).steps.length;
    return n < 1 || n > 5;
  });
  check('the length law holds — one to five steps, never six',
    overspent.length === 0, overspent.join(' '));

  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const touches = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  /* The two scopes of docs/43 §1.3. 'chrome' is the shell's persistent
     controls — the phone masthead and the desktop sidebar, one visible at a
     time — and the Masthead primitive's own <header> is excluded because it
     sits inside <main>: a page title is the page's, not the shell's. */
  const CHROME = ':is(header, aside, nav):not(main *)';
  const scopeOf = t => (t.scope === 'chrome' ? page.locator(CHROME) : page.locator('main'));

  /* Every VISIBLE control the step's target names, within its scope. The
     alternatives are summed rather than short-circuited: a control that shows
     both of its labels at once is a real defect and should fail the ambiguity
     half below rather than be quietly resolved. */
  const boxesFor = async t => {
    const root = scopeOf(t);
    const names = Array.isArray(t.name) ? t.name : [t.name];
    const boxes = [];
    for (const name of names) {
      const loc = root.getByRole(t.role, { name, exact: true });
      const n = await loc.count();
      for (let k = 0; k < n; k++) {
        const one = loc.nth(k);
        if (await one.isVisible()) {
          const box = await one.boundingBox();
          if (box) boxes.push(box);
        }
      }
    }
    return boxes;
  };

  const openSample = async () => {
    await page.goto(`${ORIGIN}/#/open`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const skip = page.getByRole('button', { name: /continue without an account|^continue$/i }).first();
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(400); }
    const samples = page.getByRole('button', { name: /sample wardrobes/i }).first();
    if (await samples.count()) { await samples.click(); await page.waitForTimeout(800); }
    const meher = page.getByRole('button', { name: /meher/i }).first();
    if (await meher.count()) { await meher.click(); await page.waitForTimeout(800); }
  };

  const startBlank = async () => {
    await page.goto(`${ORIGIN}/#/open/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const skip = page.getByRole('button', { name: /continue without an account|^continue$/i }).first();
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(400); }
    const go = page.getByRole('button', { name: /start it/i }).first();
    if (await go.count()) { await go.click(); await page.waitForTimeout(900); }
  };

  const land = async path => {
    await page.goto(`${ORIGIN}/#${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(520);
    return (await page.evaluate(() => location.hash)).replace(/^#/, '').split('?')[0];
  };

  const openGuide = async () => {
    const opener = page.getByRole('button', { name: /what is this page/i }).first();
    if (!(await opener.count())) return false;
    await opener.click();
    await page.waitForTimeout(240);
    return true;
  };

  await openSample();

  /* ---- 1 · THE LAW. It never announces itself. ---- */
  {
    await land('/closet');
    const cold = await page.evaluate(() => ({
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      card: document.querySelectorAll('[data-walkthrough="card"]').length,
      ring: document.querySelectorAll('[data-walkthrough="ring"]').length,
    }));
    check('a walkthrough never announces itself — the closet opens with nothing up',
      cold.dialogs === 0 && cold.card === 0 && cold.ring === 0,
      `${cold.dialogs} dialogs, ${cold.card} cards, ${cold.ring} rings`);

    const chromeRoots = await page.locator(CHROME).count();
    check('the chrome scope finds the shell it is meant to scope to',
      chromeRoots > 0, `${chromeRoots} roots`);
  }

  /* ---- 2 · THE DOOR. One tertiary control, in the foot of the sheet. ---- */
  {
    check('the guide sheet opens on the closet', await openGuide(), '');
    const foot = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"]');
      return {
        walk: [...(sheet?.querySelectorAll('button') ?? [])]
          .some(b => b.textContent.trim() === 'Walk me through it'),
        close: [...(sheet?.querySelectorAll('button') ?? [])]
          .some(b => b.textContent.trim() === 'Close'),
        // Brand rule 3: the sheet already spends its one primary on Close, so
        // the new control must be tertiary. bg-ink is primary, bg-accent-fill
        // is the hero — neither may be worn by "Walk me through it".
        loud: [...(sheet?.querySelectorAll('button') ?? [])]
          .filter(b => b.textContent.trim() === 'Walk me through it')
          .some(b => /bg-ink|bg-accent-fill/.test(b.className)),
      };
    });
    check('"Walk me through it" stands in the sheet foot, beside the shipped Close',
      foot.walk && foot.close && !foot.loud, '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // The other half of the seating: a screen with no guide gets no control of
    // either kind. /admin is an alpha portal, not a room in the product.
    await land('/admin');
    const portal = await page.evaluate(() => ({
      guide: [...document.querySelectorAll('button')]
        .some(b => /what is this page/i.test(b.textContent)),
      walk: [...document.querySelectorAll('button')]
        .some(b => b.textContent.trim() === 'Walk me through it'),
    }));
    check('a screen with no guide offers no walkthrough either',
      !portal.guide && !portal.walk, '');
  }

  /* ---- 3 · STEPPING, AND THE PAGE STAYS ALIVE. ---- */
  {
    await land('/closet');
    await openGuide();
    await page.getByRole('button', { name: 'Walk me through it', exact: true }).click();
    await page.waitForTimeout(400);

    const up = await page.evaluate(() => {
      const card = document.querySelector('[data-walkthrough="card"]');
      return {
        scrim: document.querySelectorAll('.modal-overlay').length,
        count: (card?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        locked: document.body.style.overflow,
        modal: card?.getAttribute('aria-modal'),
        role: card?.getAttribute('role'),
        // Never a primary or a hero inside the card (brand rule 3, docs/43 §1.6).
        loud: [...(card?.querySelectorAll('button') ?? [])]
          .filter(b => /bg-ink|bg-accent-fill/.test(b.className)).length,
      };
    });
    check('starting it closes the sheet and leaves no scrim behind', up.scrim === 0, '');
    check('the card reads its position in a short list, and nothing else',
      // Case-folded: .type-ledger sets text-transform:uppercase, so innerText
      // reads "1 OF 4". The shouting is the stylesheet's business; the position
      // in a short list is this check's.
      /(^|\s)1 of 4(\s|$)/i.test(up.count), up.count.slice(0, 40));
    check('the page is not held — no lock, no aria-modal, still a dialog by role',
      up.locked !== 'hidden' && up.modal === null && up.role === 'dialog',
      `overflow "${up.locked}", aria-modal ${up.modal}`);
    check('no primary and no hero button inside the card', up.loud === 0, `${up.loud} found`);

    /* A STEP WHOSE TARGET IS ALREADY ON SCREEN MOVES NOTHING.

       Step 2 of the Closet points at the masthead's "Add a piece", which is
       position:fixed and so can never be centred by scrolling. Before the guard
       in Tutorial.tsx, scrollIntoView answered that by throwing the page to
       y=10256 of an 11307px document, and step 3 then opened with a ten-
       thousand-pixel smooth scroll to unwind. Every chrome-scoped step in the
       house has that shape, so this is asserted rather than eyeballed — and
       under NORMAL motion, because the sweep below runs reduced and an instant
       scroll hides the whole defect. */
    const restingAt = await page.evaluate(() => Math.round(window.scrollY));
    await page.locator('[data-walkthrough="card"]')
      .getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(600);
    const stepped = await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      ring: (() => {
        const r = document.querySelector('[data-walkthrough="ring"]')?.getBoundingClientRect();
        return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null;
      })(),
      vh: window.innerHeight,
    }));
    check('a step whose target is already on screen scrolls the page nowhere',
      stepped.y === restingAt
        && !!stepped.ring && stepped.ring.top >= 0 && stepped.ring.bottom <= stepped.vh,
      `scrollY ${restingAt} -> ${stepped.y}, ring ${JSON.stringify(stepped.ring)}`);

    // A page control outside the card still takes a real tap — the whole reason
    // there is no scrim and no focus trap.
    const filters = page.locator('main').getByRole('button', { name: 'Filters', exact: true }).first();
    await filters.click();
    await page.waitForTimeout(300);
    const alive = await page.evaluate(() => ({
      expanded: document.querySelector('main [aria-label="Filters"]')?.getAttribute('aria-expanded'),
      card: document.querySelectorAll('[data-walkthrough="card"]').length,
    }));
    check('the page underneath still takes a real tap, and the card stays up',
      alive.expanded === 'true' && alive.card === 1, `aria-expanded ${alive.expanded}`);

    // Two more: the scroll check above already stepped 1 -> 2, and the Closet's
    // script is four steps long.
    const card = page.locator('[data-walkthrough="card"]');
    for (let i = 0; i < 2; i++) {
      await card.getByRole('button', { name: 'Next', exact: true }).click();
      await page.waitForTimeout(400);
    }
    const end = await page.evaluate(() => {
      const c = document.querySelector('[data-walkthrough="card"]');
      return {
        text: (c?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        done: [...(c?.querySelectorAll('button') ?? [])].some(b => b.textContent.trim() === 'Done'),
      };
    });
    check('the last step says Done, not Next', end.done && /4 of 4/i.test(end.text), end.text.slice(0, 40));

    /* THE FLIP RULE, MADE TO FIRE (docs/43 §1.6, §4.2).

       Check 8 below asserts the card and its target never intersect, but every
       step it sweeps has its target centred, so it never once exercises the
       thing that keeps that true. Here the reader scrolls the ringed Filters
       control down into the docked card's band by hand; the card must get out
       of its own way and re-dock at the top. Without the rule this reads as a
       card sitting squarely on the button it is telling you to press. */
    const docked = await page.evaluate(() => {
      const c = document.querySelector('[data-walkthrough="card"]')?.getBoundingClientRect();
      return c ? Math.round(c.y) : null;
    });
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.waitForTimeout(500);
    const flipped = await page.evaluate(() => {
      const box = sel => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const { x, y, width, height } = e.getBoundingClientRect();
        return { x, y, w: width, h: height };
      };
      const c = box('[data-walkthrough="card"]');
      const r = box('[data-walkthrough="ring"]');
      return {
        y: c ? Math.round(c.y) : null,
        hit: !!(c && r && c.x < r.x + r.w && c.x + c.w > r.x && c.y < r.y + r.h && c.y + c.h > r.y),
      };
    });
    check('the card gets out of its own way — it docks to the top rather than cover its target',
      docked !== null && flipped.y !== null && docked > 400 && flipped.y < 200 && !flipped.hit,
      `docked at ${docked}, flipped to ${flipped.y}, overlapping ${flipped.hit}`);
    await card.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForTimeout(260);
    const shut = await page.evaluate(() => document.querySelectorAll('[data-walkthrough]').length);
    check('Done closes it and leaves nothing behind', shut === 0, `${shut} left`);
  }

  /* ---- 5 · PERSISTENCE, AND THE LAW RE-ASSERTED OVER IT. ---- */
  {
    const marks = await page.evaluate(() => {
      try {
        return JSON.parse(window.localStorage.getItem('toile-walkthroughs') || '[]');
      } catch { return null; }
    });
    check('the walkthrough is marked on start, under its own key',
      Array.isArray(marks) && marks.includes('/closet'), JSON.stringify(marks));

    // And the mark is a fact about this browser's reader, never about the
    // wardrobe: it must not have leaked into the exported record.
    const key = await activeKey();
    const inState = await page.evaluate(k => {
      const raw = k ? window.localStorage.getItem(k) : null;
      return raw ? /walkthrough/i.test(raw) : false;
    }, key);
    check('and no walkthrough mark rides in AppState', inState === false, '');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => document.querySelectorAll('[data-walkthrough]').length);
    check('a marked screen still opens with nothing up — dismissed is dismissed',
      after === 0, `${after} left`);
  }

  /* ---- 7 · EXITS. Escape, and walking away. ---- */
  {
    await land('/closet');
    await openGuide();
    await page.getByRole('button', { name: 'Walk me through it', exact: true }).click();
    await page.waitForTimeout(360);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(240);
    const escaped = await page.evaluate(() => document.querySelectorAll('[data-walkthrough]').length);
    check('Escape ends it', escaped === 0, `${escaped} left`);

    await openGuide();
    await page.getByRole('button', { name: 'Walk me through it', exact: true }).click();
    await page.waitForTimeout(360);
    const running = await page.evaluate(() => document.querySelectorAll('[data-walkthrough="card"]').length);
    // A client-side hash change, not a reload: a reload would end the
    // walkthrough by wiping the document, which proves nothing about the keyed
    // unmount this check is actually about.
    await page.evaluate(() => { window.location.hash = '#/outfits'; });
    await page.waitForTimeout(700);
    const walked = await page.evaluate(() => ({
      here: location.hash,
      left: document.querySelectorAll('[data-walkthrough]').length,
    }));
    check('walking to another screen ends it, card and ring both',
      running === 1 && walked.left === 0 && walked.here.startsWith('#/outfits'),
      `${walked.left} left at ${walked.here}`);
  }

  /* ---- 6 · REDUCED MOTION. The ring is present; nothing animates. ---- */
  {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await land('/closet');
    await openGuide();
    await page.getByRole('button', { name: 'Walk me through it', exact: true }).click();
    await page.waitForTimeout(320);
    await page.locator('[data-walkthrough="card"]')
      .getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(320);
    const still = await page.evaluate(() => {
      const card = document.querySelector('[data-walkthrough="card"]');
      const ring = document.querySelector('[data-walkthrough="ring"]');
      const ms = el => {
        const cs = el ? getComputedStyle(el) : null;
        if (!cs) return null;
        if (cs.animationName === 'none') return 0;
        return Math.max(...cs.animationDuration.split(',').map(d => parseFloat(d) * (/ms/.test(d) ? 1 : 1000)));
      };
      return { ring: !!ring, ringMotion: ms(ring), cardMotion: ms(card) };
    });
    check('under reduced motion the ring is still drawn, and neither it nor the card animates',
      still.ring && still.cardMotion !== null && still.cardMotion <= 1 && still.ringMotion === 0,
      `card ${still.cardMotion}ms, ring ${still.ringMotion}ms`);

    // Stepping still brings the target into view — instantly, but it arrives.
    await page.locator('[data-walkthrough="card"]')
      .getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(320);
    const inView = await page.evaluate(() => {
      const r = document.querySelector('[data-walkthrough="ring"]')?.getBoundingClientRect();
      return r ? r.top >= 0 && r.bottom <= window.innerHeight : false;
    });
    check('and stepping still brings the target into view', inView, '');
    await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
  }

  /* ---- 4 + 8 · THE DRIFT NET, TWO FIXTURES.

     A page's controls differ between a blank wardrobe and a stocked one, and a
     net that only sees one of those states is half a net. In EITHER fixture at
     most one visible match — ambiguity is a spec bug in any state. ACROSS the
     two, at least one — a name that resolves in neither is dead copy.

     Swept under reduced motion on purpose: scrollIntoView drops to 'auto', so
     every rectangle below is measured at rest rather than mid-animation. The
     geometry is the same either way; only the flakiness differs. ---- */
  const resolutions = new Map();
  const drift = [];
  {
    const sweep = async fixture => {
      for (const path of scripted) {
        const landed = await land(path);
        if (landed !== path) {
          drift.push(`${path}: does not open in the ${fixture} wardrobe (landed ${landed})`);
          continue;
        }
        if (!(await openGuide())) {
          drift.push(`${path}: no guide control (${fixture})`);
          continue;
        }

        /* THE ADDITIVE PROOF, on every screen and in both fixtures: the shipped
           guide sheet still says every word it said before — the lede, all of
           the doings, and its Close. Nothing about the walkthrough is allowed
           to cost the seventeen guides a syllable. */
        const guide = guideFor(path);
        const sheet = flat(await page.evaluate(
          () => document.querySelector('[role="dialog"]')?.innerText ?? ''));
        // Case-folded for the same reason as above — the sheet's Close renders
        // as CLOSE. This check is about the words still being there, not about
        // which utility shouts them.
        const said = sheet.toLowerCase();
        const intact = said.includes(flat(guide.lede).toLowerCase())
          && guide.doing.every(d => said.includes(flat(d).toLowerCase()))
          && (!guide.term || said.includes(flat(guide.term.meaning).toLowerCase()))
          && said.includes('close');
        if (!intact) drift.push(`${path}: the shipped guide sheet lost a line (${fixture})`);

        const opener = page.getByRole('button', { name: 'Walk me through it', exact: true }).first();
        if (!(await opener.count())) {
          drift.push(`${path}: offers no walkthrough (${fixture})`);
          continue;
        }
        await opener.click();
        await page.waitForTimeout(340);

        const steps = tutorialFor(path).steps;
        const card = page.locator('[data-walkthrough="card"]');
        for (let i = 0; i < steps.length; i++) {
          const t = steps[i].target;
          if (t) {
            const id = `${path} step ${i + 1}`;
            const named = Array.isArray(t.name) ? t.name.join(' / ') : t.name;
            const seen = resolutions.get(id)
              ?? { blank: 0, sample: 0, what: `${t.role} "${named}" in ${t.scope ?? 'main'}` };
            const boxes = await boxesFor(t);
            seen[fixture] = boxes.length;
            resolutions.set(id, seen);

            if (boxes.length === 1) {
              const ring = await page.locator('[data-walkthrough="ring"]').boundingBox();
              if (!ring || !touches(ring, boxes[0])) {
                drift.push(`${id}: the ring is not on ${named} (${fixture})`);
              }
              // §7 check 8 — it never covers its own target.
              const box = await card.boundingBox();
              if (box && touches(box, boxes[0])) {
                drift.push(`${id}: the card covers ${named} (${fixture})`);
              }
            }
          }
          if (i < steps.length - 1) {
            await card.getByRole('button', { name: 'Next', exact: true }).click();
            await page.waitForTimeout(300);
          }
        }
        // Walking to the next address ends this one — the keyed unmount.
      }
    };

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startBlank();
    await sweep('blank');
    await openSample();
    await sweep('sample');
    await page.emulateMedia({ reducedMotion: null });

    const anchored = [...resolutions.entries()];
    check('every walkthrough step was reached and measured in both wardrobes',
      anchored.length > 0 && scripted.length > 0, `${anchored.length} anchors over ${scripted.length} screens`);

    const ambiguous = anchored.filter(([, r]) => r.blank > 1 || r.sample > 1);
    check('no step points at two controls at once, in either wardrobe',
      ambiguous.length === 0,
      ambiguous.map(([id, r]) => `${id} — ${r.what} (blank ${r.blank}, sample ${r.sample})`).join(' | '));

    const dead = anchored.filter(([, r]) => r.blank + r.sample === 0);
    check('every step anchor resolves in at least one wardrobe — no dead copy',
      dead.length === 0,
      dead.map(([id, r]) => `${id} — ${r.what}`).join(' | '));

    check('the ring sits on its target, and the card never covers it',
      drift.length === 0, drift.slice(0, 4).join(' | '));
  }

  /* ---- THE NET, PROVEN TO BITE.

     Everything above passes on a tree where the anchors are right, which is
     also what a net with a broken selector engine does. So: rename the Closet's
     filter control in the live DOM — exactly what a refactor that drops an
     aria-label looks like — and the count must fall to nothing. Then hang a
     second control with the same name on the page and it must rise to two.
     Both halves of check 4, demonstrated rather than assumed. ---- */
  {
    await land('/closet');
    const anchor = { role: 'button', name: 'Filters' };
    const before = (await boxesFor(anchor)).length;

    await page.evaluate(() => {
      document.querySelector('main [aria-label="Filters"]')
        ?.setAttribute('aria-label', 'Narrow the grid');
    });
    const renamed = (await boxesFor(anchor)).length;

    await page.evaluate(() => {
      document.querySelector('main [aria-label="Narrow the grid"]')
        ?.setAttribute('aria-label', 'Filters');
      const one = document.querySelector('main [aria-label="Filters"]');
      if (one) one.parentElement.appendChild(one.cloneNode(true));
    });
    const twinned = (await boxesFor(anchor)).length;

    check('the drift net bites — a renamed anchor falls to nothing, a twinned one reads two',
      before === 1 && renamed === 0 && twinned === 2,
      `${before} -> ${renamed} -> ${twinned}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
  }
}

check('no errors anywhere in this run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(failed === 0 ? '\nALL FEATURE CHECKS PASSED' : `\n${failed} FEATURE CHECKS FAILED`);
process.exit(failed ? 1 : 0);
