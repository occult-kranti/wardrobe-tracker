#!/usr/bin/env node
/** Synthetic admin workbench regression. Serve npm run dev:portal first.
 * All off-origin requests are intercepted; no provider or personal data is used.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = (process.argv[2] ?? 'http://localhost:4175').replace(/\/$/, '');
const TOKEN = 'SYNTHETIC_ADMIN_ONLY';
const PRIVATE = 'SYNTHETIC_CONSUMER_MUST_NOT_SEND';
const scratch = mkdtempSync(join(tmpdir(), 'portal-workbench-'));
const shots = fileURLToPath(new URL('../shots/portal-workbench/', import.meta.url));
mkdirSync(shots, { recursive: true });
await build({
  alias: sharedAliases(), entryPoints: {
    cases: fileURLToPath(new URL('../src/portal/lib/workbenchCases.ts', import.meta.url)),
    models: fileURLToPath(new URL('../src/portal/lib/modelCatalog.ts', import.meta.url)),
  }, bundle: true, format: 'esm', outdir: scratch, outExtension: { '.js': '.mjs' }, logLevel: 'error',
});
const { EVENT_EXAMPLE, workbenchPreset, analyseWorkbenchResult } = await import(pathToFileURL(join(scratch, 'cases.mjs')).href);
const { MODEL_CATALOG } = await import(pathToFileURL(join(scratch, 'models.mjs')).href);
const [first, second] = MODEL_CATALOG;
const intake = (box = [0.15, 0.2, 0.5, 0.6]) => JSON.stringify({
  toileIntake: 1, capturedAt: '2026-09-07', photos: [{ n: 1, note: 'Synthetic fixture' }],
  pieces: [{ ref: 'p1', photo: 1, name: 'Blue test shirt', category: 'tops',
    description: 'Blue shirt with a straight hem.', color: '#345678', colorName: 'blue',
    pattern: 'solid', season: ['fall'], occasion: ['casual'], confidence: 0.88,
    uncertain: ['material'], background: 'plain', box }], skipped: [],
});
const eventAnswer = (ids = ['sample-shirt', 'sample-trousers', 'sample-shoes']) => JSON.stringify({
  name: 'Gallery test', itemIds: ids, rationale: 'The supplied pieces form a smart casual outfit.',
  weatherNote: 'The supplied weather is mild at arrival.', eventNote: 'Check the fit before standing for the evening.', missing: [],
});
function response(modelId, text) {
  return MODEL_CATALOG.find(model => model.id === modelId).provider === 'anthropic'
    ? { model: modelId, content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 100 } }
    : { model: modelId, choices: [{ message: { content: text } }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } };
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [];
let activeContext;
async function scenario(name, task) {
  try { await task(); results.push({ name, passed: true }); console.log(`PASS - ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL - ${name}: ${error.message}`); }
  finally { await activeContext?.close(); activeContext = undefined; }
}
async function open(handler, width = 1280) {
  const context = activeContext = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
  await context.addInitScript(({ privateText }) => {
    sessionStorage.setItem('almari-admin-token', 'OLD_SYNTHETIC_TOKEN');
    localStorage.setItem('wardrobe-tracker:synthetic-private', privateText);
  }, { privateText: PRIVATE });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const calls = [], unexpected = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (url.includes('/functions/v1/admin-ai')) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      const call = { body: request.postDataJSON(), token: request.headers()['x-admin-token'] };
      calls.push(call);
      const reply = await handler?.(call, calls.length) ?? { text: eventAnswer() };
      try { await route.fulfill({ status: reply.status ?? 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reply.raw ?? response(call.body.model, reply.text ?? '')) }); }
      catch { /* A deliberately cancelled fetch may have closed its route. */ }
    } else if (new URL(url).origin === new URL(ORIGIN).origin) await route.continue();
    else { unexpected.push(url); await route.abort(); }
  });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'AI workbench', exact: true }).click();
  return { page, calls, unexpected, errors };
}
const runButton = page => page.getByRole('button', { name: 'Run selected models', exact: true });
const modelBox = (page, model) => page.locator('label').filter({ has: page.getByText(model.label, { exact: true }) }).locator('input[type="checkbox"]');
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) { assert(Date.now() < deadline, 'expected request did not arrive'); await new Promise(resolve => setTimeout(resolve, 20)); }
}
async function authorize(page, mode = 'event') {
  await page.getByLabel('Admin token', { exact: true }).fill(TOKEN);
  await page.getByLabel('AI feature', { exact: true }).selectOption(mode);
}
async function finished(page) { await page.getByRole('button', { name: 'Export comparison JSON' }).waitFor(); await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Export comparison JSON' && button.disabled)); }
async function upload(page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1200;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eee8df'; ctx.fillRect(0, 0, 1800, 1200);
    ctx.fillStyle = '#345678'; ctx.fillRect(270, 240, 900, 720);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Test image', { exact: true }).setInputFiles({ name: 'synthetic-garment.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });
  await page.getByRole('img', { name: 'Prepared test image', exact: true }).waitFor();
}
async function exported(page) {
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export comparison JSON' }).click();
  const stream = await (await ready).createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function storage(page) { return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })); }
async function noOverflow(page) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'document must not overflow horizontally'); }

await scenario('event fixtures reject coercion and impossible calendar values; crop validation keeps unsafe boxes out', async () => {
  const original = JSON.parse(EVENT_EXAMPLE);
  for (const mutate of [
    value => { value.event.setting = ['mixed']; }, value => { value.weather.source = ['manual']; },
    value => { value.event.date = '2026-02-30'; }, value => { value.weather.date = '2026-13-01'; },
    value => { value.event.time = '24:00'; }, value => { value.weather.time = '18:99'; },
    value => { value.weather.fetchedAt = '2026-02-30T18:00:00Z'; },
    value => { value.weather.timezone = 'Nowhere/Impossible'; },
  ]) { const changed = structuredClone(original); mutate(changed); assert.throws(() => workbenchPreset('event', JSON.stringify(changed))); }
  const past = structuredClone(original); past.event.date = past.weather.date = '2024-02-29';
  assert.equal(workbenchPreset('event', JSON.stringify(past)).items.length, 3);
  assert.equal(analyseWorkbenchResult('flatlay', intake(), []).pieces[0].box.length, 4);
  for (const box of [[-0.1, 0.2, 0.5, 0.5], [0.8, 0.2, 0.5, 0.5], [0.2, 0.2, 0, 0.5]]) {
    const analysis = analyseWorkbenchResult('flatlay', intake(box), []);
    assert.equal(analysis.pieces[0].box, null); assert.equal(analysis.status, 'review');
  }
  const parsed = workbenchPreset('event');
  assert.equal(analyseWorkbenchResult('event', eventAnswer(['unknown-piece']), parsed.items).status, 'invalid');
});

await scenario('opening and editing are silent, legacy token is removed, missing and refused auth cannot start a batch', async () => {
  const { page, calls, unexpected, errors } = await open(() => ({ status: 401, raw: { error: 'PRIVATE_SERVER_BODY' } }));
  assert.equal(await page.getByLabel('Admin token', { exact: true }).inputValue(), '');
  assert.equal((await storage(page)).session['almari-admin-token'], undefined);
  await page.getByLabel('AI feature', { exact: true }).selectOption('event');
  assert(await runButton(page).isDisabled()); assert.equal(calls.length, 0);
  await page.getByLabel('Admin token', { exact: true }).fill('wrong-token');
  await page.getByLabel('AI feature', { exact: true }).selectOption('event');
  await modelBox(page, second).check(); assert.equal(calls.length, 0);
  await runButton(page).click(); await finished(page);
  assert.equal(calls.length, 1); assert.equal(calls[0].token, 'wrong-token');
  assert.match(await page.getByRole('region', { name: `Result: ${first.label}`, exact: true }).innerText(), /token was refused/);
  assert(!await page.getByText('PRIVATE_SERVER_BODY', { exact: true }).count());
  assert.deepEqual((await storage(page)).session, {}); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
});

await scenario('one prepared image and prompt are sent sequentially; costs, crops and explicit exports remain reviewable', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { page, calls, unexpected, errors } = await open(async (_call, index) => { if (index === 1) await gate; return { text: intake() }; });
  await authorize(page, 'flatlay'); await upload(page); await modelBox(page, second).check();
  await runButton(page).click(); await until(() => calls.length === 1);
  assert.equal(calls.length, 1); assert(await page.getByLabel('AI feature', { exact: true }).isDisabled());
  release(); await finished(page); assert.equal(calls.length, 2);
  assert.equal(calls[0].body.prompt, calls[1].body.prompt); assert.deepEqual(calls[0].body.image, calls[1].body.image);
  assert.equal(calls[0].body.image.mimeType, 'image/jpeg'); assert.equal(calls[0].body.maxTokens, calls[1].body.maxTokens);
  assert(calls.every(call => call.token === TOKEN && !JSON.stringify(call.body).includes(PRIVATE)));
  assert.equal(await page.getByRole('img', { name: 'Local crop: Blue test shirt', exact: true }).count(), 2);
  await page.getByLabel(`Review notes for ${first.label}`, { exact: true }).fill('Inspect the lower hem in this synthetic crop.');
  const data = await exported(page);
  assert.equal(data.input.image.width, 1400); assert.equal(data.input.image.height, 933);
  assert.equal(data.input.image.dataUrl, undefined); assert.equal(data.results[0].analysis.pieces[0].crop, undefined);
  assert.equal(data.results[0].usage.inputTokens, 1000); assert.equal(data.results[0].cost.status, 'estimated');
  assert.equal(data.results[0].note, 'Inspect the lower hem in this synthetic crop.');
  assert(!JSON.stringify(data).includes(TOKEN)); assert(!JSON.stringify(data).includes(PRIVATE));
  await page.getByLabel('Include prepared image and crops in export', { exact: true }).check();
  const withImages = await exported(page); assert.match(withImages.input.image.dataUrl, /^data:image\/jpeg;base64,/);
  assert.match(withImages.results[0].analysis.pieces[0].crop, /^data:image\/jpeg;base64,/);
  await noOverflow(page); await page.screenshot({ path: join(shots, 'comparison-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(page);
  await page.screenshot({ path: join(shots, 'comparison-mobile.png'), fullPage: true });
  const persisted = await storage(page); assert.deepEqual(persisted.local, { 'wardrobe-tracker:synthetic-private': PRIVATE }); assert.deepEqual(persisted.session, {});
  await page.getByRole('button', { name: 'Clear test and results' }).click();
  assert.equal(await page.getByRole('img', { name: 'Prepared test image', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Export comparison JSON' }).count(), 0);
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
});

await scenario('event validation uses applied IDs and a readonly generated prompt; changing inputs preserves the captured run', async () => {
  const { page, calls } = await open(() => ({ text: eventAnswer(['changed-shirt', 'sample-trousers', 'sample-shoes']) }));
  await authorize(page);
  const example = JSON.parse(EVENT_EXAMPLE); example.closet[0].id = 'changed-shirt';
  await page.getByLabel('Event test case JSON', { exact: true }).fill(JSON.stringify(example));
  assert(await runButton(page).isDisabled()); await page.getByRole('button', { name: 'Apply event data', exact: true }).click();
  await page.getByText('Review or edit the exact prompt', { exact: true }).click();
  assert(await page.getByLabel('Prompt sent to each model', { exact: true }).evaluate(element => element.readOnly));
  await runButton(page).click(); await finished(page);
  assert(calls[0].body.prompt.includes('changed-shirt')); assert.equal(calls[0].body.image, undefined);
  const data = await exported(page); assert.equal(data.results[0].analysis.status, 'valid');
  await page.getByLabel('AI feature', { exact: true }).selectOption('custom');
  await page.getByLabel('Prompt sent to each model', { exact: true }).fill('NEXT_UNSENT_PROMPT');
  assert.equal((await exported(page)).input.prompt, data.input.prompt); assert.equal(calls.length, 1);
});

await scenario('custom provider text is escaped and token changes discard results and pending work', async () => {
  const payload = '<img src="https://invalid.example/leak" onerror="window.workbenchInjection=1">';
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { page, calls, unexpected, errors } = await open(async (_call, index) => { if (index === 2) await gate; return { text: payload }; });
  await authorize(page, 'custom'); await runButton(page).click(); await finished(page);
  const region = page.getByRole('region', { name: `Result: ${first.label}`, exact: true });
  await region.getByText('Answer text', { exact: true }).click(); assert.equal(await region.locator('pre').first().textContent(), payload);
  assert.equal(await page.evaluate(() => window.workbenchInjection), undefined); assert.equal(await region.locator('img').count(), 0);
  await runButton(page).click(); await until(() => calls.length === 2);
  await page.getByLabel('Admin token', { exact: true }).fill('NEW_SYNTHETIC_TOKEN'); release();
  assert.equal(await page.getByRole('button', { name: 'Export comparison JSON' }).count(), 0);
  assert.equal(await page.getByRole('region', { name: `Result: ${first.label}`, exact: true }).count(), 0);
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.getByLabel('Admin token', { exact: true }).inputValue(), '');
  assert.equal(calls.length, 2); assert.deepEqual((await storage(page)).session, {}); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
});

await scenario('cancel stops an unsent model and preserves cost uncertainty for the submitted call', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const { page, calls } = await open(async () => { await gate; return { text: eventAnswer() }; });
  await authorize(page); await modelBox(page, second).check(); await runButton(page).click();
  await until(() => calls.length === 1);
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click(); await finished(page); release();
  const data = await exported(page); assert.equal(calls.length, 1);
  assert.equal(data.results[0].status, 'cancelled'); assert.match(data.results[0].error, /may still charge/);
  assert.equal(data.results[0].cost, undefined); assert.equal(data.results[1].status, 'not-run');
});

await scenario('cancel during local cropping retains the completed provider answer and billable usage', async () => {
  const { page, calls } = await open(() => ({ text: intake() }));
  await authorize(page, 'flatlay'); await upload(page); await modelBox(page, second).check();
  await page.evaluate(() => {
    const OriginalImage = window.Image;
    window.Image = class extends OriginalImage {
      set src(value) { window.releaseSyntheticCrop = () => { super.src = value; }; }
      get src() { return super.src; }
    };
  });
  await runButton(page).click(); await page.waitForFunction(() => typeof window.releaseSyntheticCrop === 'function');
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await page.evaluate(() => window.releaseSyntheticCrop()); await finished(page);
  const data = await exported(page); assert.equal(calls.length, 1);
  assert.equal(data.results[0].status, 'ok'); assert.equal(data.results[0].usage.inputTokens, 1000);
  assert.equal(data.results[0].cost.status, 'estimated'); assert.equal(data.results[0].result.text, intake());
  assert.equal(data.results[1].status, 'not-run');
});

await scenario('invalid feature output retains the provider response, usage and cost for review', async () => {
  const { page } = await open(() => ({ text: '{invalid output' }));
  await authorize(page); await runButton(page).click(); await finished(page);
  const data = await exported(page); assert.equal(data.results[0].analysis.status, 'invalid');
  assert.equal(data.results[0].result.text, '{invalid output'); assert.equal(data.results[0].usage.outputTokens, 100);
  assert.equal(data.results[0].cost.status, 'estimated');
});

await browser.close();
writeFileSync(join(shots, 'report.json'), JSON.stringify({ origin: ORIGIN, checkedAt: new Date().toISOString(), synthetic: true, results }, null, 2));
process.exitCode = results.some(result => !result.passed) ? 1 : 0;
