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
      namesModel: /Claude Sonnet by Anthropic/i.test(text),
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
  // The portal administers the device: a courtesy gate, then guarded controls.
  // Every destructive step must pass a naming sheet; the nuclear one must be
  // typed out. These checks run while a worked closet (meher) is open.
  await page.goto(`${ORIGIN}/#/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  check('the portal opens on its gate, not the controls',
    await page.locator('#admin-pass').count() === 1, '');

  await page.locator('#admin-pass').fill('not-the-code');
  await page.getByRole('button', { name: /open the portal/i }).click();
  await page.waitForTimeout(400);
  check('a wrong passcode stays outside',
    /not the passcode/i.test(await page.evaluate(() => document.body.innerText)), '');

  await page.locator('#admin-pass').fill('almari-lead');
  await page.getByRole('button', { name: /open the portal/i }).click();
  await page.waitForTimeout(800);
  const opened = await page.evaluate(() => ({
    meher: /meher/i.test(document.body.innerText),
    checks: /run the checks/i.test(document.body.innerText),
  }));
  check('the right passcode opens the ledger of wardrobes', opened.meher && opened.checks, '');

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
