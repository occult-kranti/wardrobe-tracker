/** Explicit live smoke test: synthetic garments only, two billable model calls. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sharedAliases } from '../packages/shared/aliases.mjs';

if (!process.argv.includes('--live')) {
  console.log('Use --live to request a public city forecast and two outfits from the deployed relay. Only synthetic garment records are sent.');
  process.exit(0);
}
const scratch = mkdtempSync(join(tmpdir(), 'almari-stylist-live-'));
try {
  await build({ alias: sharedAliases(), entryPoints: {
    stylist: 'src/lib/eventStylist.ts', client: 'src/lib/anthropic.ts', weather: 'src/lib/eventWeather.ts', dates: 'packages/shared/dates.ts',
  }, bundle: true, format: 'esm', outdir: scratch, outExtension: { '.js': '.mjs' }, logLevel: 'error' });
  const load = file => import(pathToFileURL(join(scratch, `${file}.mjs`)));
  const { buildStylistPrompt, parseStyleSuggestion } = await load('stylist');
  const { askStylistText } = await load('client');
  const { findWeatherCities, fetchEventWeather } = await load('weather');
  const { todayLocal, addDays } = await load('dates');
  globalThis.window = { localStorage: { getItem: () => null } };
  const date = addDays(todayLocal(), 2);
  const brief = { event: 'An evening gallery opening', date, time: '18:00', dressCode: 'Smart casual', setting: 'mixed', preferences: 'Comfortable for a walk to the venue and an hour standing.' };
  const cities = await findWeatherCities('Boston');
  const city = cities.find(c => c.region === 'Massachusetts');
  assert.ok(city, 'Boston, Massachusetts is offered by city search');
  const weather = await fetchEventWeather(city, date, brief.time);
  console.log('PASS - live city search and event-hour forecast');
  const item = (id, name, category, material, color) => ({ id, name, category, material, color, season: [], occasion: [], imageUrl: '', dateAdded: date, wearCount: 0, favorite: false, laundryStatus: 'clean' });
  const items = [
    item('synthetic-shirt', 'White Oxford shirt', 'tops', 'cotton', 'white'),
    item('synthetic-trousers', 'Navy straight trousers', 'bottoms', 'cotton twill', 'navy'),
    item('synthetic-shoes', 'Black lace-up shoes', 'shoes', 'leather', 'black'),
    item('synthetic-shell', 'Navy hooded rain shell', 'outerwear', 'nylon', 'navy'),
    item('synthetic-knit', 'Grey crewneck sweater', 'layers', 'merino wool', 'grey'),
    item('synthetic-tee', 'White plain tee', 'tops', 'cotton', 'white'),
  ];
  const categories = [...new Set(items.map(i => i.category))].map(id => ({ id, label: id }));
  const prompt = buildStylistPrompt(brief, weather, items, categories);
  const first = await askStylistText(prompt.system, prompt.prompt);
  const suggestion = parseStyleSuggestion(first.text, items);
  assert.equal(first.model, 'claude-fable-5-1');
  assert.ok(suggestion.itemIds.includes('synthetic-trousers'), 'Outfit includes trousers');
  assert.ok(suggestion.itemIds.includes('synthetic-shoes'), 'Outfit includes shoes');
  assert.ok(suggestion.itemIds.some(id => ['synthetic-shirt', 'synthetic-tee', 'synthetic-knit'].includes(id)), 'Outfit includes an upper garment');
  console.log('PASS - live Fable 5.1 produced a validated outfit from synthetic closet IDs');
  const refinement = 'Keep the trousers and shoes. Make the outfit more casual by using the plain tee instead of the Oxford shirt.';
  const updatePrompt = buildStylistPrompt(brief, weather, items, categories, suggestion, refinement);
  const second = await askStylistText(updatePrompt.system, updatePrompt.prompt);
  const updated = parseStyleSuggestion(second.text, items);
  for (const id of ['synthetic-trousers', 'synthetic-shoes', 'synthetic-tee']) assert.ok(updated.itemIds.includes(id), `Updated outfit keeps or adds ${id}`);
  assert.ok(!updated.itemIds.includes('synthetic-shirt'), 'Updated outfit replaces the Oxford shirt');
  console.log('PASS - live refinement respects the requested changes and retained pieces');
  mkdirSync('shots', { recursive: true });
  writeFileSync('shots/event-stylist-live.json', JSON.stringify({ checkedAt: new Date().toISOString(), model: first.model, brief, weather, suggestion, refinement, updated }, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
