import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'almari-event-weather-'));
const originalFetch = globalThis.fetch;
let failures = 0;
try {
  await build({ alias: sharedAliases(), entryPoints: ['src/lib/eventWeather.ts'], bundle: true, format: 'esm', outfile: join(scratch, 'weather.mjs'), logLevel: 'error' });
  const { findWeatherCities, fetchEventWeather, forecastDateAvailable } = await import(pathToFileURL(join(scratch, 'weather.mjs')));
  const check = async (name, fn) => {
    try { await fn(); console.log(`PASS - ${name}`); }
    catch (e) { failures++; console.error(`FAIL - ${name}`, e.message); }
  };
  const city = { id: 1, name: 'Boston', region: 'Massachusetts', country: 'United States', latitude: 42.36, longitude: -71.06, timezone: 'America/New_York' };
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: city.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await check('forecast horizon includes day 16 and rejects past and day 17', () => {
    assert.equal(forecastDateAvailable('2026-09-22', '2026-09-07'), true);
    assert.equal(forecastDateAvailable('2026-09-23', '2026-09-07'), false);
    assert.equal(forecastDateAvailable('2026-09-06', '2026-09-07'), false);
    assert.equal(forecastDateAvailable('not a date', '2026-09-07'), false);
    assert.equal(forecastDateAvailable('2026-09-31', '2026-09-20'), false);
  });
  await check('city lookup sends only city query and omits credentials/referrer', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
      assert.equal(url.searchParams.get('name'), 'Boston');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      return Response.json({ results: [{ ...city, admin1: city.region }, { id: 2, name: 'Incomplete' }, null, { ...city, timezone: 'Invalid/Zone' }] });
    };
    assert.deepEqual(await findWeatherCities(' Boston '), [city]);
  });
  await check('event hour uses the selected city timezone and preserves real zero values', async () => {
    globalThis.fetch = async url => {
      assert.equal(url.searchParams.get('timezone'), city.timezone);
      assert.equal(url.searchParams.get('start_date'), date);
      assert.equal(url.searchParams.get('end_date'), date);
      return Response.json({ hourly: { time: [`${date}T17:00`, `${date}T18:00`], temperature_2m: [30, 0], apparent_temperature: [31, -2], precipitation_probability: [90, 0], weather_code: [61, 0], wind_speed_10m: [12, 0] } });
    };
    const result = await fetchEventWeather(city, date, '18:30');
    assert.equal(result.source, 'forecast');
    assert.equal(result.timezone, city.timezone);
    assert.equal(result.time, '18:30');
    assert.match(result.summary, /0°C, feels like -2°C; clear; 0%/);
    assert.ok(result.fetchedAt);
  });
  await check('null hourly data stays unknown instead of becoming zero degrees', async () => {
    globalThis.fetch = async () => Response.json({ hourly: { time: [`${date}T18:00`], temperature_2m: [null] } });
    await assert.rejects(fetchEventWeather(city, date, '18:00'), /incomplete/);
  });
  await check('out-of-range dates and invalid time make no request', async () => {
    globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
    await assert.rejects(fetchEventWeather(city, '2099-01-01', '18:00'), /16 days/);
    await assert.rejects(fetchEventWeather(city, date, '29:00'), /event time/);
    await assert.rejects(findWeatherCities('x'), /two letters/);
  });
  await check('provider failure offers manual fallback', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(fetchEventWeather(city, date, '18:00'), /Enter the weather yourself/);
  });
  await check('cancellation reaches the weather request', async () => {
    const controller = new AbortController();
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
    const pending = findWeatherCities('Boston', controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
  });
} finally {
  globalThis.fetch = originalFetch;
  rmSync(scratch, { recursive: true, force: true });
}
process.exitCode = failures ? 1 : 0;
