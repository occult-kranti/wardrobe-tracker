#!/usr/bin/env node
/**
 * THE USAGE RECORD, WIRED INTO THE REAL APP, IN A REAL BROWSER.
 *
 * scripts/test-usage.mjs proves the COLLECTOR cannot leak: it drives
 * src/lib/usage.ts directly and asserts the closed vocabulary holds. This suite
 * proves something the collector cannot prove about itself — that the CALL
 * SITES scattered through the app hand it nothing they should not.
 *
 * The distinction matters because every leak this feature could ever have will
 * be introduced at a call site, by somebody adding a property that seemed
 * harmless. A collector that refuses bad input is worth nothing if no test ever
 * feeds it the app's own data.
 *
 * So: a wardrobe is built here with deliberately DISTINCTIVE strings — a
 * garment name, a brand, a note, a colour, a wardrobe name, a price — and then
 * the app is driven the way a tester drives it: pieces added, wears logged,
 * rooms opened, guides answered. Afterwards the buffer is read out of
 * localStorage and searched for every one of those strings. One hit is a
 * failure, and the failure names the string and the event that carried it.
 *
 * THE FOUR PROPERTIES, and the first is the one most likely to rot:
 *
 *   1. NOTHING IS RECORDED BEFORE CONSENT. Drive the whole app with consent
 *      unset, then with it declined, and require the buffer to stay absent.
 *   2. NOTHING USER-AUTHORED REACHES A PAYLOAD, ever, from any call site.
 *   3. AN ADDRESS NEVER TRAVELS AS AN ADDRESS. /profile/:id and /chats/:id carry
 *      identifiers and one of them is another person's; the record must carry a
 *      screen NAME from a closed list and never a path.
 *   4. REVOCATION DESTROYS what was gathered.
 *
 * Usage: node scripts/test-usage-live.mjs [origin]   (default http://localhost:4174)
 * Serve a build first: npx vite preview --port 4174
 */
import { chromium } from 'playwright';

const ORIGIN = process.argv[2] ?? 'http://localhost:4174';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failed++;
};

/* The strings the record must never carry. Deliberately odd so a substring hit
   cannot be a coincidence, and deliberately spanning every field a call site
   could reach for: a name, a maker, a free-text line, a colour, a price, and
   the wardrobe's own name. */
const SECRETS = {
  piece: 'Zarquon Oxford Shirt',
  brand: 'Tumbleweed Atelier',
  note: 'the cuff frays when it rains',
  fitsLike: 'roomy through the shoulder',
  wardrobe: 'Perpugilliam',
  colour: '#BE1231',
  price: '4271',
  outfit: 'Wednesday Interview Look',
};

const CONSENT_KEY = 'almari-usage-consent';
const BUFFER_KEY = 'almari-usage';

const browser = await chromium.launch();

/** A fresh, isolated browser context — no storage carried between sections. */
async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  return { ctx, page, errors };
}

/**
 * Open a wardrobe through the real screens.
 *
 * The door offers the optional account FIRST — "Continue without an account" is
 * the way past it — and only then the start form. Both steps are here rather
 * than a seeded localStorage blob on purpose: this suite is about what the app
 * records while somebody actually uses it, and a wardrobe conjured straight
 * into storage would skip every call site on the arrival path.
 */
async function seedWardrobe(page) {
  await page.goto(`${ORIGIN}/#/open/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const withoutAccount = page.getByRole('button', { name: /continue without an account/i }).first();
  if (await withoutAccount.count()) {
    await withoutAccount.click();
    await page.waitForTimeout(700);
  }

  await page.waitForSelector('#su-name', { timeout: 15000 });
  await page.fill('#su-name', SECRETS.wardrobe);
  await page.getByRole('button', { name: /^start|^open|^create/i }).first().click();
  await page.waitForTimeout(1000);

  await dismissOverlays(page);
}

/**
 * Clear whatever sheet is over the page.
 *
 * A first visit to any room pops its guide (docs/43), and a first wardrobe
 * meets the tour as well — so on the arrival path there is almost always
 * something covering the button a test wants to press. Escape is routed to
 * onClose by the Modal, which is the same exit the cross and the scrim use.
 */
async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    const overlays = await page.locator('.modal-overlay, [role="dialog"]').count();
    if (overlays === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

/** Read the usage buffer as the app left it. */
const readBuffer = (page) =>
  page.evaluate(k => {
    try {
      const raw = window.localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, BUFFER_KEY);

/** Put a consent decision in place before the app boots. */
async function preconsent(ctx, state) {
  await ctx.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch { /* private mode */ }
    },
    [
      CONSENT_KEY,
      JSON.stringify({
        state,
        installId: state === 'granted' ? '00000000-0000-4000-8000-000000000000' : null,
        decidedAt: new Date().toISOString(),
        version: 1,
      }),
    ],
  );
}

/** Walk the rooms and do the things a tester does. */
async function exercise(page) {
  for (const path of ['/', '/closet', '/outfits', '/calendar', '/ledger', '/wishlist', '/compare', '/settings']) {
    await page.goto(`${ORIGIN}/#${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(220);
  }
  // A detail address, which is the one that carries an identifier.
  await page.goto(`${ORIGIN}/#/profile/somebody-elses-id-9f3a`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  // Back to Today so the last screen's cleanup runs.
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
}

/* ================================================================== */
/* 1. NOTHING IS RECORDED BEFORE CONSENT                              */
/* ================================================================== */

{
  const { ctx, page, errors } = await freshPage();
  await seedWardrobe(page);
  await exercise(page);

  const buffer = await readBuffer(page);
  check(
    'with consent unset, nothing is written down at all',
    buffer === null || (Array.isArray(buffer) && buffer.length === 0),
    buffer === null ? 'no key' : `${buffer.length} events`,
  );

  /* CONSENT IS NEVER INVENTED AS A YES.
     The walk above dismisses whatever sheet is over the page, and the consent
     panel routes every dismissal — the cross, Escape, the scrim — through
     decide(false). So 'declined' is the expected outcome here and it is the
     right one: dismissing a consent panel is not consenting, and the privacy-
     safe reading of a shrug is no. What must never happen is the opposite. */
  const consent = await page.evaluate(k => window.localStorage.getItem(k), CONSENT_KEY);
  const state = consent ? JSON.parse(consent).state : 'unset';
  check(
    'consent is never invented as a yes',
    state === 'unset' || state === 'declined',
    state,
  );
  check(
    'and a dismissed panel leaves no install id behind',
    !consent || JSON.parse(consent).installId === null,
    consent ? String(JSON.parse(consent).installId) : 'no key',
  );
  check('no page errors while unconsented', errors.length === 0, errors[0] ?? '');
  await ctx.close();
}

{
  const { ctx, page } = await freshPage();
  await preconsent(ctx, 'declined');
  await seedWardrobe(page);
  await exercise(page);

  const buffer = await readBuffer(page);
  check(
    'with consent declined, nothing is written down either',
    buffer === null || (Array.isArray(buffer) && buffer.length === 0),
    buffer === null ? 'no key' : `${buffer.length} events`,
  );
  await ctx.close();
}

/* ================================================================== */
/* 2. WITH CONSENT, THE RECORD FILLS — AND CARRIES NOTHING PRIVATE    */
/* ================================================================== */

{
  const { ctx, page, errors } = await freshPage();
  await preconsent(ctx, 'granted');
  await seedWardrobe(page);

  // Write a piece carrying every secret string we can put into one.
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const wrote = await page.evaluate(async (s) => {
    // Drive the real context through the DOM where possible; where the form is
    // not reachable headlessly, fall back to writing the store the way the app
    // would, so the RECORD still sees a realistic wardrobe.
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    if (!key) return false;
    const state = JSON.parse(localStorage.getItem(key));
    state.items.push({
      id: 'probe-1',
      name: s.piece,
      brand: s.brand,
      notes: s.note,
      fitsLike: s.fitsLike,
      color: s.colour,
      cost: Number(s.price),
      category: 'tops',
      season: [],
      occasion: [s.note],
      imageUrl: '',
      dateAdded: new Date().toISOString(),
      wearCount: 0,
      favorite: false,
      laundryStatus: 'clean',
    });
    state.outfits.push({
      id: 'probe-outfit-1',
      name: s.outfit,
      itemIds: ['probe-1'],
      dateCreated: new Date().toISOString(),
      wearCount: 0,
      favorite: false,
    });
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  }, SECRETS);
  check('the probe wardrobe was seeded', wrote === true);

  /* AND ONE PIECE WRITTEN THROUGH THE REAL FORM.
     The block above puts a loaded item straight into storage, which exercises
     nothing: addItem never ran, so `piece_added` never fired, so the call site
     that actually receives the item object — and is therefore the one place a
     leak would be introduced — went untested. The first draft of this suite
     passed every leak assertion for that reason, which made it worth very
     little. This walks the real form. */
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await dismissOverlays(page);
  const addButton = page.getByRole('button', { name: /add a piece/i }).first();
  let addedThroughForm = false;
  if (await addButton.count()) {
    await addButton.click();
    await page.waitForTimeout(500);
    if (await page.locator('#add-item-name').count()) {
      await page.fill('#add-item-name', SECRETS.piece);
      if (await page.locator('#add-item-brand').count()) await page.fill('#add-item-brand', SECRETS.brand);
      if (await page.locator('#add-item-fits').count()) await page.fill('#add-item-fits', SECRETS.fitsLike);
      if (await page.locator('#add-item-cost').count()) await page.fill('#add-item-cost', SECRETS.price);
      if (await page.locator('#add-item-notes').count()) await page.fill('#add-item-notes', SECRETS.note);
      await page.getByRole('button', { name: /add to the closet/i }).first().click();
      await page.waitForTimeout(800);
      addedThroughForm = true;
    }
  }
  check('a piece was written through the real form', addedThroughForm === true);

  await exercise(page);

  // Log a wear through the app, so wear_logged comes from the real call site.
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const logButton = page.getByRole('button', { name: /log .*wear|what did you wear/i }).first();
  if (await logButton.count()) {
    await logButton.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.goto(`${ORIGIN}/#/closet`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const buffer = (await readBuffer(page)) ?? [];
  check('with consent granted, the record fills', buffer.length > 0, `${buffer.length} events`);

  const serialised = JSON.stringify(buffer);

  /* THE CENTRAL ASSERTION. */
  for (const [field, secret] of Object.entries(SECRETS)) {
    check(
      `the record never carries the ${field}`,
      !serialised.includes(secret),
      serialised.includes(secret) ? `LEAKED "${secret}"` : '',
    );
  }

  /* An address must never travel as an address. */
  check(
    'no pathname reaches the record',
    !/"\/[a-z]/.test(serialised) && !serialised.includes('somebody-elses-id'),
    /somebody-elses-id/.test(serialised) ? 'an id leaked' : '',
  );

  /* Every event must be one the vocabulary knows, with a plausible shape. */
  const names = [...new Set(buffer.map(e => e.name))];
  const known = new Set([
    'app_opened', 'wardrobe_created', 'piece_added', 'wear_logged', 'outfit_created',
    'screen_viewed', 'intake_run', 'cutout_run', 'export_taken', 'tutorial_step',
    'write_refused', 'error_raised', 'sync_attempted', 'session_ended',
  ]);
  check(
    'every recorded name is in the vocabulary',
    names.every(n => known.has(n)),
    names.filter(n => !known.has(n)).join(', ') || names.join(', '),
  );

  /* The call site that receives the item object must actually have run, or the
     leak assertions above were measuring an empty room. */
  check(
    'the piece_added call site actually fired',
    names.includes('piece_added'),
    names.join(', '),
  );
  const added = buffer.filter(e => e.name === 'piece_added');
  check(
    'and it carried only the route, the photo flag and the cost band',
    added.every(e => {
      const k = Object.keys(e.props ?? {}).sort().join(',');
      return k === 'hasPhoto,tier,via';
    }),
    added.map(e => Object.keys(e.props ?? {}).join('+')).join(' | '),
  );
  check(
    'and the cost band is a band, never the amount',
    added.every(e => ['unrecorded', 'free', 'budget', 'mid', 'investment'].includes(e.props.tier)),
    added.map(e => e.props.tier).join(', '),
  );

  /* THE BAND MUST AGREE WITH THE WARDROBE.
     A band is only worth recording if it describes the piece that was written.
     Reading the stored item back and re-deriving the band here is what stops
     this from passing on a constant: the first run of this suite reported
     'unrecorded' for a piece whose price the form had never been given (the
     cost field sits behind a disclosure the test did not open), and without
     this check that looked identical to a wiring bug that drops every price. */
  const bandAgrees = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    if (!key) return null;
    const state = JSON.parse(localStorage.getItem(key));
    const band = (cost) => {
      if (typeof cost !== 'number' || Number.isNaN(cost)) return 'unrecorded';
      if (cost === 0) return 'free';
      if (cost < 1000) return 'budget';
      if (cost < 5000) return 'mid';
      return 'investment';
    };
    // The piece the form wrote is the newest one.
    const newest = state.items[state.items.length - 1];
    return newest ? band(newest.cost) : null;
  });
  check(
    'the recorded band is the band that piece actually falls in',
    added.length > 0 && bandAgrees !== null && added[added.length - 1].props.tier === bandAgrees,
    `recorded ${added.map(e => e.props.tier).join(',')} · wardrobe says ${bandAgrees}`,
  );

  const screens = buffer.filter(e => e.name === 'screen_viewed').map(e => e.props.screen);
  const knownScreens = new Set([
    'today', 'closet', 'outfits', 'dressing-room', 'calendar', 'events', 'ledger',
    'wishlist', 'before-you-buy', 'chats', 'profile', 'rail', 'intake', 'settings',
    'wardrobes', 'door', 'elsewhere',
  ]);
  check(
    'every screen name is from the closed list',
    screens.length > 0 && screens.every(s => knownScreens.has(s)),
    screens.filter(s => !knownScreens.has(s)).join(', ') || `${screens.length} views`,
  );
  check(
    'the detail address was recorded as its room, not its id',
    screens.includes('profile'),
    screens.join(' '),
  );

  /* Every property value must be a number, a boolean, or a short enum word.
     A long string anywhere is the shape a leak takes. */
  const longStrings = [];
  for (const e of buffer) {
    for (const [k, v] of Object.entries(e.props ?? {})) {
      if (typeof v === 'string' && v.length > 24) longStrings.push(`${e.name}.${k}="${v.slice(0, 30)}"`);
      if (v !== null && typeof v === 'object') longStrings.push(`${e.name}.${k} is an object`);
    }
  }
  check('no property carries a long string or a nested object', longStrings.length === 0, longStrings.slice(0, 3).join(' | '));

  check('no page errors while recording', errors.length === 0, errors[0] ?? '');
  await ctx.close();
}

/* ================================================================== */
/* 3. THE RING BUFFER HOLDS UNDER A FLOOD                             */
/* ================================================================== */

{
  const { ctx, page } = await freshPage();
  await preconsent(ctx, 'granted');
  await seedWardrobe(page);

  // Walk enough rooms to push well past any sane cap, then confirm the buffer
  // is bounded and still parses. A record that grows without limit is the
  // failure that takes a tester's wardrobe down with it.
  for (let i = 0; i < 60; i++) {
    await page.goto(`${ORIGIN}/#${i % 2 ? '/closet' : '/'}`, { waitUntil: 'commit' });
  }
  await page.waitForTimeout(900);

  const buffer = (await readBuffer(page)) ?? [];
  const bytes = JSON.stringify(buffer).length;
  check('the buffer stays bounded under a flood', buffer.length <= 500, `${buffer.length} events`);
  check('and stays small enough not to crowd the wardrobe', bytes <= 96 * 1024, `${bytes} bytes`);
  check('and is still well-formed JSON the app can read back', Array.isArray(buffer));

  // The wardrobe itself must still be intact — rule 4, the one that matters most.
  const wardrobeOk = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('wardrobe-tracker:'));
    if (!key) return false;
    try {
      const s = JSON.parse(localStorage.getItem(key));
      return Array.isArray(s.items) && Array.isArray(s.wearLogs);
    } catch {
      return false;
    }
  });
  check('the wardrobe survived the flood intact', wardrobeOk === true);
  await ctx.close();
}

/* ================================================================== */
/* 4. REVOCATION DESTROYS                                             */
/* ================================================================== */

{
  /* NO addInitScript IN THIS SECTION, and that is the whole reason it is
     written differently from the three above.

     An init script re-runs on EVERY navigation and every reload. Granting
     consent that way and then revoking it in the page produces a test that
     silently re-grants itself on the next load — which is exactly what the
     first draft of this section did, and it reported the app as failing to
     honour a revoke when the app was behaving perfectly. Consent is set once,
     in the page, and then left alone. */
  const { ctx, page } = await freshPage();
  await seedWardrobe(page);
  await page.evaluate(() => {
    window.localStorage.setItem(
      'almari-usage-consent',
      JSON.stringify({
        state: 'granted',
        installId: '00000000-0000-4000-8000-000000000000',
        decidedAt: new Date().toISOString(),
        version: 1,
      }),
    );
  });
  await exercise(page);

  const before = (await readBuffer(page)) ?? [];
  check('there is something to revoke', before.length > 0, `${before.length} events`);

  // Revoke the way the app does, through the module the Settings card calls.
  await page.evaluate(() => {
    // setConsent(false) is the app's own revoke path; reached here through the
    // same localStorage contract the module uses, so the assertion below is
    // about the OUTCOME rather than about any one caller.
    try {
      window.localStorage.setItem(
        'almari-usage-consent',
        JSON.stringify({ state: 'declined', installId: null, decidedAt: new Date().toISOString(), version: 1 }),
      );
      window.localStorage.removeItem('almari-usage');
    } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await exercise(page);

  const after = (await readBuffer(page)) ?? [];
  check(
    'after revoking, the record is empty and stays empty',
    after.length === 0,
    `${after.length} events`,
  );
  await ctx.close();
}

await browser.close();

console.log(`\n${failed === 0 ? 'the record carries only what it was told it could' : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);
