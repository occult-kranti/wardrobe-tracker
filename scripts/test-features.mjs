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

/* ============ furniture — where a garment physically lives ============ */
{
  // Invisible until built. A wardrobe that never wants this must never see it.
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const quiet = await page.evaluate(() => !/Where it lives/i.test(document.body.innerText));
  check('the feature is invisible until a place is drawn', quiet, '');

  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const empty = await page.evaluate(() => document.body.innerText);
  check('the empty state names a rail, not a dresser',
    /A rail is a place/i.test(empty) && !/you should own/i.test(empty), '');

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
    const svg = [...document.querySelectorAll('svg[aria-label]')]
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
  const previewSize = () => page.evaluate(() =>
    [...document.querySelectorAll('svg[aria-label]')]
      .find(s => /drawer/i.test(s.getAttribute('aria-label') || ''))?.innerHTML.length ?? 0);
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
  const countPieces = () => page.evaluate(async () => {
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    return JSON.parse(localStorage.getItem(key)).items.length;
  });
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
  // THE CLOSET OPENS AS A ROOM. One piece of furniture was drawn just above, so
  // the wall has something on it.
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const room = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')]
      .filter(a => /\/furniture/.test(a.getAttribute('href') || ''));
    const walkable = links.filter(a => a.className.includes('registered'));
    const boxes = walkable.map(a => a.getBoundingClientRect());
    return {
      walkable: walkable.length,
      smallest: boxes.length ? Math.min(...boxes.map(b => Math.min(b.width, b.height))) : 0,
      named: walkable.map(a => a.textContent.trim()).filter(Boolean),
      text: document.body.innerText.slice(0, 600),
    };
  });
  check('the closet opens on a room you can walk into', room.walkable >= 2, `${room.walkable} ways in`);
  check('every way in is a legal tap target', room.smallest >= 44, `smallest ${Math.round(room.smallest)}px`);

  // THE CHECK THAT CATCHES A HIT LAYER IN THE WRONG PLACE.
  // Measuring a link's box only proves it is big. It has to be OVER the thing
  // it opens — the first version of this divided both axes by the plate's WIDTH,
  // so every target floated up into the ceiling band with three pixels of the
  // furniture inside it, and passed every check but this one.
  const overlap = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a.registered')]
      .find(a => /\/furniture\//.test(a.getAttribute('href') || ''));
    if (!link) return null;
    const svg = link.closest('div')?.querySelector('svg');
    const paths = [...(svg?.querySelectorAll('path') ?? [])].map(p => p.getBoundingClientRect());
    const box = link.getBoundingClientRect();
    // How much of the drawing's ink falls inside this link's box, vertically.
    const inside = paths.filter(p =>
      p.width > 0 && p.right > box.left && p.left < box.right
      && p.bottom > box.top + 2 && p.top < box.bottom - 2).length;
    return { inside, drawn: paths.length };
  });
  check('and it sits over the furniture it opens, not above it',
    !!overlap && overlap.inside >= 4, overlap ? `${overlap.inside} strokes inside the target` : 'no bay link');

  // Tapping one has to arrive at that piece, not at the index.
  const walkedTo = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a.registered')]
      .find(a => /\/furniture\//.test(a.getAttribute('href') || ''));
    return link?.getAttribute('href') ?? '';
  });
  await page.locator('a.registered').filter({ hasText: /piece/ }).first().click();
  await page.waitForTimeout(900);
  const arrived = await page.evaluate(() => ({ hash: location.hash, text: document.body.innerText.slice(0, 80) }));
  check('walking to a piece opens that piece',
    walkedTo.includes(arrived.hash.replace('#', '')) && /#\/furniture\/./.test(arrived.hash),
    arrived.hash);
  check('and each one says what it is, for a screen reader',
    room.named.some(t => /piece/i.test(t)), room.named[0] ?? '');
  // A room is not a scoreboard. No percentage, no "x of y", no meter.
  check('the room never scores you', !/\d+%|\d+ of \d+/.test(room.text), '');

  // PACKED AWAY — the seasonal case, which is the whole reason a place is worth
  // having. Nothing leaves the closet; it stops being suggested.
  await page.goto(`${ORIGIN}/#/furniture`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: /bedroom chest/i }).first().click();
  await page.waitForTimeout(800);

  const poolBefore = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    const s = JSON.parse(localStorage.getItem(key));
    return s.items.filter(i => !i.retired && i.laundryStatus === 'clean').length;
  });

  await page.getByRole('button', { name: /pack this away/i }).first().click();
  await page.waitForTimeout(900);

  const packed = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    const s = JSON.parse(localStorage.getItem(key));
    const slot = s.furniture.flatMap(f => f.slots).find(x => x.packed);
    return {
      flagged: !!slot,
      items: s.items.length,
      stillClean: s.items.filter(i => !i.retired && i.laundryStatus === 'clean').length,
    };
  });
  check('a compartment can be packed away for the season', packed.flagged, '');
  check('and packing takes nothing out of the closet',
    packed.stillClean === poolBefore, `${poolBefore} → ${packed.stillClean} clean pieces`);

  // The one thing it does change, checked where it changes it.
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const day = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    const s = JSON.parse(localStorage.getItem(key));
    const packedSlots = new Set(
      s.furniture.flatMap(f => f.slots.filter(x => x.packed).map(x => `${f.id}/${x.id}`))
    );
    const packedNames = s.items
      .filter(i => i.place && packedSlots.has(`${i.place.furnitureId}/${i.place.slotId}`))
      .map(i => i.name);
    const shown = document.body.innerText;
    return { packedNames, offered: packedNames.filter(n => n && shown.includes(n)) };
  });
  check('what is packed away is not offered for today',
    day.packedNames.length > 0 && day.offered.length === 0,
    `${day.packedNames.length} packed, ${day.offered.length} still offered`);
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
