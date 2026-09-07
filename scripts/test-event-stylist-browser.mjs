#!/usr/bin/env node
/**
 * Event styling through the browser, with synthetic clothes and intercepted
 * weather / AI responses. No provider call, account, or personal record is used.
 * Serve a build first: node scripts/test-event-stylist-browser.mjs [origin]
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = (process.argv[2] ?? 'http://localhost:4174').replace(/\/$/, '');
const ACCOUNT = 'event-stylist-test';
const OTHER_ACCOUNT = 'event-stylist-other';
const STORE = `wardrobe-tracker:${ACCOUNT}`;
const scratch = mkdtempSync(join(tmpdir(), 'event-stylist-browser-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    types: fileURLToPath(new URL('../packages/shared/types.ts', import.meta.url)),
    guides: fileURLToPath(new URL('../src/lib/pageGuides.ts', import.meta.url)),
    dates: fileURLToPath(new URL('../packages/shared/dates.ts', import.meta.url)),
  },
  bundle: true, format: 'esm', outdir: scratch, outExtension: { '.js': '.mjs' }, logLevel: 'error',
});
const { initialState } = await import(pathToFileURL(join(scratch, 'types.mjs')).href);
const { guidedPaths } = await import(pathToFileURL(join(scratch, 'guides.mjs')).href);
const { todayLocal, addDays } = await import(pathToFileURL(join(scratch, 'dates.mjs')).href);
const date = addDays(todayLocal(), 1);
const nextDate = addDays(date, 1);
const item = (id, name, category, extra = {}) => ({
  id, name, category, color: 'navy', season: ['fall', 'winter'], occasion: ['formal'],
  dateAdded: '2026-01-01', favorite: false, wearCount: 0, laundryStatus: 'clean',
  imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" data-secret="PRIVATE_PHOTO_SENTINEL"/>',
  notes: 'PRIVATE_NOTES_SENTINEL', brand: 'PRIVATE_BRAND_SENTINEL', fitsLike: 'PRIVATE_FIT_SENTINEL', cost: 987654.25, ...extra,
});
const fixture = {
  ...structuredClone(initialState),
  items: [
    item('test-shirt', 'Test Oxford shirt', 'tops'),
    item('test-trousers', 'Test wool trousers', 'bottoms'),
    item('test-shoes', 'Test leather shoes', 'shoes'),
    item('test-coat', 'Test wool coat', 'outerwear'),
    item('test-washing', 'PRIVATE_WASHING_SENTINEL', 'tops', { laundryStatus: 'washing' }),
    item('test-retired', 'PRIVATE_RETIRED_SENTINEL', 'tops', { retired: { date: '2026-02-01' } }),
  ],
  events: [{
    id: 'test-event', name: 'Gallery opening', kind: 'celebration', startDate: date, place: 'Boston',
    reservations: [{ id: 'test-reservation', date, itemIds: [] }],
  }],
};
const answer = (name = 'Gallery evening', itemIds = ['test-shirt', 'test-trousers', 'test-shoes']) => ({
  name, itemIds, rationale: 'The Oxford and wool trousers fit the stated dress code.',
  eventNote: 'A considered outfit for the gallery opening.',
  weatherNote: 'Bring the wool coat for the cool outdoor arrival.', missing: [],
});
const messages = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const sentDetails = request => JSON.parse(request.messages.find(message => message.role === 'user').content);
const geocoding = { results: [{
  id: 4930956, name: 'Boston', latitude: 42.3584, longitude: -71.0598,
  country: 'United States', country_code: 'US', admin1: 'Massachusetts', timezone: 'America/New_York',
}] };
const forecast = requestedDate => ({
  latitude: 42.3584, longitude: -71.0598, timezone: 'America/New_York', utc_offset_seconds: -14400,
  hourly_units: { temperature_2m: '°C', apparent_temperature: '°C', wind_speed_10m: 'km/h', precipitation_probability: '%' },
  hourly: {
    time: Array.from({ length: 24 }, (_, hour) => `${requestedDate}T${String(hour).padStart(2, '0')}:00`),
    temperature_2m: Array(24).fill(12), apparent_temperature: Array(24).fill(10),
    precipitation_probability: Array(24).fill(65), weather_code: Array(24).fill(61),
    wind_speed_10m: Array(24).fill(15),
  },
  daily: {
    time: [requestedDate], temperature_2m_max: [14], temperature_2m_min: [8],
    apparent_temperature_max: [12], apparent_temperature_min: [6],
    precipitation_probability_max: [65], weather_code: [61], wind_speed_10m_max: [15],
  },
});

let failed = 0;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const state = {
    ai: [], cities: [], forecasts: [], external: [], errors: [], reply: answer(), status: 200,
    hold: false, pending: [], forecastStatus: 200,
    holdCities: false, pendingCities: [], holdForecast: false, pendingForecast: [],
  };
  page.on('pageerror', error => state.errors.push(String(error)));
  await context.addInitScript(({ fixture: record, paths, account, store, otherAccount, otherItem }) => {
    if (!localStorage.getItem('event-stylist-seeded')) {
      localStorage.setItem('toile-accounts', JSON.stringify([{
        id: account, name: 'PRIVATE_ACCOUNT_SENTINEL', handle: '@private_account_sentinel',
        monogram: 'QA', color: 'var(--color-accent)', createdAt: '2026-01-01',
      }, {
        id: otherAccount, name: 'Other synthetic wardrobe', handle: '@other_synthetic',
        monogram: 'OT', color: 'var(--color-accent)', createdAt: '2026-01-01',
      }]));
      localStorage.setItem('toile-session', JSON.stringify({ activeId: account }));
      localStorage.setItem(store, JSON.stringify(record));
      localStorage.setItem(`wardrobe-tracker:${otherAccount}`, JSON.stringify({ ...record, items: [otherItem], events: [] }));
      localStorage.setItem('event-stylist-seeded', 'yes');
    }
    localStorage.setItem('toile-tour', 'done');
    localStorage.setItem('toile-guides', JSON.stringify(paths));
    localStorage.setItem('almari-usage-consent', JSON.stringify({ state: 'declined', installId: null, decidedAt: new Date().toISOString(), version: 1 }));
  }, { fixture, paths: guidedPaths(), account: ACCOUNT, store: STORE, otherAccount: OTHER_ACCOUNT, otherItem: item('other-shirt', 'Other wardrobe shirt', 'tops') });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/functions/v1/ai-proxy')) {
      state.ai.push(request.postDataJSON());
      const response = { status: state.status, contentType: 'application/json', body: JSON.stringify(state.status === 200 ? messages(state.reply) : { error: { message: 'Temporary synthetic failure' } }) };
      if (state.hold) {
        await new Promise(resolve => state.pending.push(resolve));
      }
      await route.fulfill(response).catch(() => {});
    } else if (url.hostname === 'geocoding-api.open-meteo.com') {
      state.cities.push(url.toString());
      if (state.holdCities) await new Promise(resolve => state.pendingCities.push(resolve));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(geocoding) }).catch(() => {});
    } else if (url.hostname === 'api.open-meteo.com') {
      state.forecasts.push(url.toString());
      const response = { status: state.forecastStatus, contentType: 'application/json', body: JSON.stringify(state.forecastStatus === 200 ? forecast(url.searchParams.get('start_date') ?? date) : { error: true, reason: 'Synthetic forecast unavailable' }) };
      if (state.holdForecast) await new Promise(resolve => state.pendingForecast.push(resolve));
      await route.fulfill(response).catch(() => {});
    } else if (url.origin === new URL(ORIGIN).origin || url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
    } else {
      state.external.push(url.toString());
      await route.abort();
    }
  });
  await page.goto(`${ORIGIN}/#/events/style`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'What should I wear?', exact: true }).waitFor();
  return { context, page, state };
}

async function fillEvent(page) {
  await page.getByLabel('Event', { exact: true }).fill('Gallery opening');
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Time', { exact: true }).fill('18:00');
  await page.getByLabel('Dress code', { exact: true }).fill('Smart casual');
  await page.getByLabel('Setting', { exact: true }).selectOption('mixed');
  await page.getByLabel('Preferences', { exact: true }).fill('Comfortable shoes for standing');
  await page.getByLabel('Manual weather', { exact: true }).fill('Cool, 12 degrees C, light rain');
}
const consent = page => page.getByRole('checkbox', { name: /Send these details to AI/i });
const suggest = page => page.getByRole('button', { name: 'Suggest an outfit', exact: true });
const readRecord = page => page.evaluate(store => JSON.parse(localStorage.getItem(store)), STORE);
async function waitForRecord(page, predicate) {
  for (let tries = 0; tries < 30; tries++) {
    const current = await readRecord(page);
    if (predicate(current)) return current;
    await page.waitForTimeout(100);
  }
  assert.fail('The expected wardrobe change was not persisted');
}
async function see(page, name) {
  await page.getByRole('heading', { name, exact: true }).waitFor();
}
async function requestCount(page, state, kind, expected) {
  for (let tries = 0; tries < 40 && state[kind].length < expected; tries++) await page.waitForTimeout(50);
  assert.equal(state[kind].length, expected, `Expected ${expected} ${kind} request(s)`);
}
function release(state, kind = 'ai') {
  const [held, pending] = kind === 'cities' ? ['holdCities', 'pendingCities'] : kind === 'forecasts' ? ['holdForecast', 'pendingForecast'] : ['hold', 'pending'];
  state[held] = false;
  state[pending].splice(0).forEach(resolve => resolve());
}
async function scenario(label, run) {
  let session;
  try {
    session = await open();
    await run(session);
    assert.deepEqual(session.state.errors, [], 'No unhandled browser exceptions');
    assert.deepEqual(session.state.external, [], 'No unmocked external request');
    const overflow = await session.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `Mobile overflow: ${overflow}px`);
    console.log('PASS -', label);
  } catch (error) {
    failed++;
    console.log('FAIL -', label, `(${error.message})`);
  } finally {
    if (session) {
      for (const kind of ['ai', 'cities', 'forecasts']) release(session.state, kind);
      await session.context.close();
    }
  }
}

try {
  await scenario('Today and Events open the stylist; consent gates the request and saving never records a wear', async ({ page, state }) => {
    for (const route of ['/', '/events']) {
      await page.goto(`${ORIGIN}/#${route}`, { waitUntil: 'domcontentloaded' });
      await page.locator('a[href="#/events/style"]').first().click();
      await see(page, 'What should I wear?');
    }
    assert.equal(state.ai.length + state.cities.length + state.forecasts.length, 0, 'Opening the feature sends nothing');
    await fillEvent(page);
    await page.waitForTimeout(250);
    assert.equal(state.ai.length + state.cities.length + state.forecasts.length, 0, 'Typing sends nothing');
    assert.equal(await suggest(page).isDisabled(), true, 'Consent is required');
    await consent(page).check();
    assert.match(await page.locator('body').innerText(), /Fable 5\.1/i);
    await suggest(page).click();
    await see(page, 'Gallery evening');
    assert.equal(state.ai.length, 1);
    assert.equal(state.ai[0].model, 'claude-fable-5-1');
    const payload = JSON.stringify(state.ai[0]);
    for (const value of ['Gallery opening', 'Smart casual', 'Comfortable shoes for standing', 'light rain', 'test-shirt']) assert.ok(payload.includes(value), `Request includes ${value}`);
    for (const secret of ['PRIVATE_PHOTO_SENTINEL', 'PRIVATE_NOTES_SENTINEL', 'PRIVATE_BRAND_SENTINEL', 'PRIVATE_FIT_SENTINEL', 'PRIVATE_ACCOUNT_SENTINEL', '@private_account_sentinel', '987654.25', 'PRIVATE_WASHING_SENTINEL', 'PRIVATE_RETIRED_SENTINEL']) assert.ok(!payload.includes(secret), `Request excludes ${secret}`);
    assert.ok(!/"type"\s*:\s*"image"/.test(payload), 'Styling sends text only');
    for (const name of ['Test Oxford shirt', 'Test wool trousers', 'Test leather shoes']) await page.getByText(name, { exact: true }).first().waitFor();
    assert.equal((await readRecord(page)).outfits.length, 0, 'A suggestion is a draft');
    const save = page.getByRole('button', { name: 'Save outfit', exact: true });
    await save.click();
    const stored = await waitForRecord(page, record => record.outfits.length === 1);
    assert.deepEqual(stored.outfits[0].itemIds, state.reply.itemIds);
    assert.equal(stored.outfits[0].wearCount, 0);
    assert.equal(stored.wearLogs.length, 0);
    assert.ok(stored.items.every(piece => piece.wearCount === 0));
    await page.getByRole('button', { name: 'Added to outfits', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Added to outfits', exact: true }).isDisabled(), true, 'Duplicate save is disabled');
    assert.equal(await page.getByRole('button', { name: 'Reserve for event', exact: true }).count(), 0);
  });

  await scenario('Refinement makes another explicit request and event edits invalidate its result', async ({ page, state }) => {
    await fillEvent(page);
    await consent(page).check();
    await suggest(page).click();
    await see(page, 'Gallery evening');
    await page.getByLabel('Change the outfit', { exact: true }).fill('Add a warmer layer');
    assert.equal(state.ai.length, 1);
    state.reply = answer('Gallery with a coat', ['test-shirt', 'test-trousers', 'test-shoes', 'test-coat']);
    await page.getByRole('button', { name: 'Update outfit', exact: true }).click();
    await see(page, 'Gallery with a coat');
    assert.equal(state.ai.length, 2);
    assert.match(JSON.stringify(state.ai[1]), /Add a warmer layer/);
    await page.getByLabel('Event', { exact: true }).fill('Afternoon picnic');
    assert.equal(await page.getByRole('heading', { name: 'Gallery with a coat', exact: true }).count(), 0, 'An answer for the old event cannot be saved');
    assert.equal(state.ai.length, 2, 'Editing does not silently regenerate');
  });

  await scenario('A failed or cancelled refinement preserves the saved state; a new answer can be saved once', async ({ page, state }) => {
    await fillEvent(page);
    await consent(page).check();
    await suggest(page).click();
    await see(page, 'Gallery evening');
    await page.getByRole('button', { name: 'Save outfit', exact: true }).click();
    await page.getByRole('button', { name: 'Added to outfits', exact: true }).waitFor();
    await waitForRecord(page, record => record.outfits.length === 1);
    await page.getByLabel('Change the outfit', { exact: true }).fill('Add a warmer layer');
    state.status = 503;
    await page.getByRole('button', { name: 'Update outfit', exact: true }).click();
    await page.getByRole('alert').waitFor();
    await see(page, 'Gallery evening');
    assert.equal(await page.getByRole('button', { name: 'Added to outfits', exact: true }).isDisabled(), true, 'Failure cannot enable another save of the old result');
    assert.equal((await readRecord(page)).outfits.length, 1);

    state.status = 200;
    state.hold = true;
    state.reply = answer('Cancelled refinement');
    await page.getByRole('button', { name: 'Update outfit', exact: true }).click();
    await requestCount(page, state, 'ai', 3);
    await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
    release(state);
    await page.waitForTimeout(250);
    await see(page, 'Gallery evening');
    assert.equal(await page.getByRole('heading', { name: 'Cancelled refinement', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Added to outfits', exact: true }).isDisabled(), true, 'Cancellation cannot enable another save of the old result');
    assert.equal((await readRecord(page)).outfits.length, 1);

    state.reply = answer('Warmer gallery outfit', ['test-shirt', 'test-trousers', 'test-shoes', 'test-coat']);
    await page.getByRole('button', { name: 'Update outfit', exact: true }).click();
    await see(page, 'Warmer gallery outfit');
    assert.equal(await page.getByRole('button', { name: 'Save outfit', exact: true }).isEnabled(), true, 'A new answer can be accepted');
    await page.getByRole('button', { name: 'Save outfit', exact: true }).click();
    const stored = await waitForRecord(page, record => record.outfits.length === 2);
    await page.getByRole('button', { name: 'Added to outfits', exact: true }).waitFor();
    assert.equal(stored.wearLogs.length, 0);
    assert.deepEqual(stored.outfits.map(outfit => outfit.name), ['Gallery evening', 'Warmer gallery outfit']);
  });

  await scenario('Storage refusal says the outfit and reservation exist only in this session', async ({ page }) => {
    await page.goto(`${ORIGIN}/#/events`, { waitUntil: 'domcontentloaded' });
    await page.locator(`a[href="#/events/style?event=test-event&date=${date}"]`).click();
    await see(page, 'What should I wear?');
    await consent(page).check();
    await suggest(page).click();
    await see(page, 'Gallery evening');
    await page.evaluate(store => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === store) throw new DOMException('Synthetic quota refusal', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    }, STORE);
    await page.getByRole('button', { name: 'Save outfit', exact: true }).click();
    await page.getByText(/storage is full|device could not keep this outfit/i).first().waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('button', { name: 'Added in this session', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Added to outfits', exact: true }).count(), 0, 'No saved confirmation over a refused write');
    assert.equal((await readRecord(page)).outfits.length, 0);
    await page.getByRole('button', { name: 'Reserve for event', exact: true }).click();
    await page.getByRole('button', { name: 'Held in this session', exact: true }).waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('button', { name: 'Reserved for event', exact: true }).count(), 0, 'No reservation confirmation over a refused write');
    assert.equal((await readRecord(page)).events[0].reservations[0].itemIds.length, 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await see(page, 'What should I wear?');
    const stored = await readRecord(page);
    assert.equal(stored.outfits.length, 0);
    assert.equal(stored.events[0].reservations[0].itemIds.length, 0);
  });

  await scenario('A returned unknown garment is refused and a later request can recover', async ({ page, state }) => {
    await fillEvent(page);
    await consent(page).check();
    state.reply = answer('Invented outfit', ['not-in-this-closet']);
    await suggest(page).click();
    await page.waitForFunction(() => /closet|available|valid|checked|recognis|recogniz/i.test(document.querySelector('[role="alert"]')?.textContent ?? ''));
    assert.equal(await page.getByRole('heading', { name: 'Invented outfit', exact: true }).count(), 0);
    assert.equal((await readRecord(page)).outfits.length, 0);
    state.reply = answer('Recovered suggestion');
    await suggest(page).click();
    await see(page, 'Recovered suggestion');
  });

  await scenario('Cancelling a delayed request discards the late response', async ({ page, state }) => {
    await fillEvent(page);
    await consent(page).check();
    state.hold = true;
    state.reply = answer('Cancelled suggestion');
    await suggest(page).click();
    await page.getByRole('button', { name: 'Cancel request', exact: true }).waitFor();
    await requestCount(page, state, 'ai', 1);
    await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
    release(state);
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole('heading', { name: 'Cancelled suggestion', exact: true }).count(), 0);
    assert.equal((await readRecord(page)).outfits.length, 0);
    state.reply = answer('After cancellation');
    await suggest(page).click();
    await see(page, 'After cancellation');
  });

  await scenario('A temporary AI failure leaves the wardrobe unchanged and an explicit retry recovers', async ({ page, state }) => {
    await fillEvent(page);
    await consent(page).check();
    state.status = 503;
    await suggest(page).click();
    await page.getByRole('alert').waitFor();
    assert.equal((await readRecord(page)).outfits.length, 0);
    assert.equal(state.ai.length, 1, 'No automatic provider retry');
    state.status = 200;
    state.reply = answer('After a temporary failure');
    await suggest(page).click();
    await see(page, 'After a temporary failure');
    assert.equal(state.ai.length, 2);
  });

  await scenario('City and forecast requests are explicit; changed date clears old weather; failure allows manual weather', async ({ page, state }) => {
    await fillEvent(page);
    await page.getByLabel('Manual weather', { exact: true }).fill('');
    await page.getByLabel('City', { exact: true }).fill('Boston');
    assert.equal(state.cities.length + state.forecasts.length, 0);
    await page.getByRole('button', { name: 'Find city', exact: true }).click();
    await page.getByLabel('Choose a city', { exact: true }).selectOption('4930956');
    assert.equal(state.cities.length, 1);
    assert.equal(state.forecasts.length, 0);
    await page.getByRole('button', { name: 'Check forecast', exact: true }).click();
    await page.waitForFunction(() => /12\s*°|10\s*°|65\s*%/.test(document.body.innerText));
    assert.equal(state.forecasts.length, 1);
    assert.ok(state.forecasts[0].includes(date));
    await consent(page).check();
    await suggest(page).click();
    await see(page, 'Gallery evening');
    assert.equal(sentDetails(state.ai[0]).weather.source, 'forecast');
    assert.match(sentDetails(state.ai[0]).weather.summary, /12.*65%/);
    assert.equal(sentDetails(state.ai[0]).weather.time, '18:00');
    await page.getByLabel('Date', { exact: true }).fill(nextDate);
    assert.equal(await page.getByRole('heading', { name: 'Gallery evening', exact: true }).count(), 0);
    state.forecastStatus = 503;
    await page.getByRole('button', { name: 'Check forecast', exact: true }).click();
    await page.getByRole('status').filter({ hasText: /weather service could not answer/i }).first().waitFor();
    await page.getByLabel('Manual weather', { exact: true }).fill('Warm and dry, 24 degrees C');
    state.reply = answer('Manual weather outfit');
    await suggest(page).click();
    await see(page, 'Manual weather outfit');
    const request = sentDetails(state.ai.at(-1));
    assert.equal(request.weather.source, 'manual', 'The old forecast does not survive the changed date');
    assert.match(request.weather.summary, /Warm and dry/);
    assert.equal(request.weather.date, nextDate);
  });

  await scenario('Late city and forecast responses cannot restore weather after the city or date changes', async ({ page, state }) => {
    await fillEvent(page);
    await page.getByLabel('Manual weather', { exact: true }).fill('');
    await page.getByLabel('City', { exact: true }).fill('Boston');
    state.holdCities = true;
    await page.getByRole('button', { name: 'Find city', exact: true }).click();
    await requestCount(page, state, 'cities', 1);
    await page.getByLabel('City', { exact: true }).fill('Cambridge');
    release(state, 'cities');
    await page.waitForTimeout(250);
    assert.equal(await page.getByLabel('Choose a city', { exact: true }).count(), 0, 'Old city choices do not return');

    await page.getByLabel('City', { exact: true }).fill('Boston');
    await page.getByRole('button', { name: 'Find city', exact: true }).click();
    await page.getByLabel('Choose a city', { exact: true }).selectOption('4930956');
    state.holdForecast = true;
    await page.getByRole('button', { name: 'Check forecast', exact: true }).click();
    await requestCount(page, state, 'forecasts', 1);
    await page.getByLabel('Date', { exact: true }).fill(nextDate);
    release(state, 'forecasts');
    await page.waitForTimeout(250);
    assert.equal(await page.getByRole('button', { name: 'Refresh forecast', exact: true }).count(), 0, 'Old-date forecast is not shown');
    await consent(page).check();
    state.reply = answer('Without the old date forecast');
    await suggest(page).click();
    await see(page, 'Without the old date forecast');
    assert.equal(sentDetails(state.ai[0]).weather.source, 'unknown');
    assert.equal(sentDetails(state.ai[0]).weather.date, nextDate);

    state.holdForecast = true;
    await page.getByRole('button', { name: 'Check forecast', exact: true }).click();
    await requestCount(page, state, 'forecasts', 2);
    await page.getByLabel('City', { exact: true }).fill('Cambridge');
    release(state, 'forecasts');
    await page.waitForTimeout(250);
    assert.equal(await page.getByRole('button', { name: 'Refresh forecast', exact: true }).count(), 0, 'Old-city forecast is not shown');
    assert.equal(await page.getByLabel('Choose a city', { exact: true }).count(), 0);
    state.reply = answer('Without the old city forecast');
    await suggest(page).click();
    await see(page, 'Without the old city forecast');
    assert.equal(sentDetails(state.ai[1]).weather.source, 'unknown');
  });

  await scenario('Switching wardrobes during a request discards its result and requires fresh consent', async ({ page, state }) => {
    await fillEvent(page);
    await consent(page).check();
    state.hold = true;
    state.reply = answer('Previous wardrobe response');
    await suggest(page).click();
    await requestCount(page, state, 'ai', 1);
    await page.goto(`${ORIGIN}/#/open`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button').filter({ has: page.getByText('Other synthetic wardrobe', { exact: true }) }).click();
    await page.locator('a[href="#/events/style"]').first().click();
    await see(page, 'What should I wear?');
    release(state);
    await page.waitForTimeout(250);
    assert.equal(await consent(page).isChecked(), false, 'Consent belongs to the mounted wardrobe');
    assert.equal(await page.getByLabel('Event', { exact: true }).inputValue(), '');
    assert.equal(await page.getByRole('heading', { name: 'Previous wardrobe response', exact: true }).count(), 0);
    assert.equal((await readRecord(page)).outfits.length, 0);
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem('toile-session')).activeId);
    assert.equal(current, OTHER_ACCOUNT);
    await fillEvent(page);
    await consent(page).check();
    state.reply = answer('Other wardrobe response', ['other-shirt']);
    await suggest(page).click();
    await see(page, 'Other wardrobe response');
    assert.deepEqual(sentDetails(state.ai[1]).closet.map(piece => piece.id), ['other-shirt']);
    const otherRecord = await page.evaluate(account => JSON.parse(localStorage.getItem(`wardrobe-tracker:${account}`)), OTHER_ACCOUNT);
    assert.equal(otherRecord.outfits.length, 0);
    assert.equal(otherRecord.wearLogs.length, 0);
  });

  await scenario('An event-linked suggestion reserves the selected day without recording a wear', async ({ page, state }) => {
    await page.goto(`${ORIGIN}/#/events`, { waitUntil: 'domcontentloaded' });
    await page.locator(`a[href="#/events/style?event=test-event&date=${date}"]`).click();
    await see(page, 'What should I wear?');
    assert.match(await page.getByLabel('Event', { exact: true }).inputValue(), /Gallery opening/);
    assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), date);
    await consent(page).check();
    await suggest(page).click();
    await see(page, 'Gallery evening');
    await page.getByRole('button', { name: 'Reserve for event', exact: true }).click();
    const stored = await waitForRecord(page, record => record.events[0].reservations[0].itemIds.length > 0 || !!record.events[0].reservations[0].outfitId);
    const reservation = stored.events[0].reservations[0];
    const reserved = reservation.outfitId ? stored.outfits.find(outfit => outfit.id === reservation.outfitId)?.itemIds : reservation.itemIds;
    assert.deepEqual(reserved, state.reply.itemIds);
    assert.equal(reservation.date, date);
    assert.equal(stored.wearLogs.length, 0);
    assert.ok(stored.items.every(piece => piece.wearCount === 0));
    assert.ok(stored.outfits.every(outfit => outfit.wearCount === 0));
  });
} finally {
  await browser.close();
}
console.log(`\n${failed ? `${failed} failed` : 'All event stylist browser checks passed'}.`);
process.exitCode = failed ? 1 : 0;
