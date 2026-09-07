#!/usr/bin/env node
/** Validate the operational board against synthetic responses, without a server. */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const built = await build({
  alias: sharedAliases(), entryPoints: [fileURLToPath(new URL('../src/portal/lib/statsClient.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'error',
});
const { fetchAlphaStats, ADMIN_STATS_ENDPOINT } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const originalFetch = globalThis.fetch;
let failures = 0;
async function test(label, work) {
  try { await work(); console.log(`PASS - ${label}`); }
  catch (error) { failures++; console.error(`FAIL - ${label}: ${error.message}`); }
}
const STAMP = '2026-09-07T18:00:00.000Z';
const person = () => ({ id: 'synthetic-person', email: 'tester@example.invalid', created_at: STAMP,
  last_sign_in_at: null, confirmed: true, profile: null, wardrobes: 1, bytes: 200, lastSync: STAMP });
const wardrobe = () => ({ id: 'synthetic-wardrobe', user_id: 'synthetic-person', updated_at: STAMP, bytes: 200, v: 1 });
const fixture = () => ({ generatedAt: STAMP, users: 1, profiles: 0, wardrobes: [wardrobe()], roster: [person()] });
function respond(body, status = 200) {
  globalThis.fetch = async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}
async function reject(body) {
  respond(body);
  assert.deepEqual(await fetchAlphaStats('synthetic-admin-token'), { kind: 'failed', status: 200 });
}

try {
  await test('valid counts and operational rows retain their exact meaning', async () => {
    respond(fixture());
    const result = await fetchAlphaStats('synthetic-admin-token');
    assert.equal(result.kind, 'ok');
    assert.equal(result.stats.users, 1);
    assert.equal(result.stats.hasRoster, true);
    assert.equal(result.stats.roster[0].profile, null);
    assert.equal(result.stats.wardrobes[0].bytes, 200);
  });
  await test('explicit zeros and empty arrays are valid, never inferred', async () => {
    respond({ generatedAt: STAMP, users: 0, profiles: 0, wardrobes: [], roster: [] });
    const result = await fetchAlphaStats('synthetic-admin-token');
    assert.equal(result.kind, 'ok');
    assert.equal(result.stats.users, 0);
    assert.equal(result.stats.hasRoster, true);
    assert.deepEqual(result.stats.roster, []);
  });
  await test('older service without a roster remains explicitly distinguishable', async () => {
    const old = fixture();
    delete old.roster;
    respond(old);
    const result = await fetchAlphaStats('synthetic-admin-token');
    assert.equal(result.kind, 'ok');
    assert.equal(result.stats.hasRoster, false);
    assert.deepEqual(result.stats.roster, []);
  });
  await test('200 bodies with absent required fields never become zero counts', async () => {
    for (const invalid of [{}, null, [], '', 0, true]) await reject(invalid);
    for (const key of ['generatedAt', 'users', 'profiles', 'wardrobes']) {
      const body = fixture(); delete body[key]; await reject(body);
    }
  });
  await test('noninteger, negative, nonfinite and coerced top-level counts fail', async () => {
    for (const field of ['users', 'profiles']) {
      for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, false, {}]) {
        await reject({ ...fixture(), [field]: value });
      }
    }
  });
  await test('malformed required arrays and present roster fail explicitly', async () => {
    for (const field of ['wardrobes', 'roster']) {
      for (const value of [undefined, null, '', {}, 0, [null], [[]]]) await reject({ ...fixture(), [field]: value });
    }
  });
  await test('wardrobe identifiers, timestamps, bytes and envelope shapes are checked', async () => {
    for (const field of ['id', 'user_id', 'updated_at', 'bytes']) {
      const row = wardrobe(); delete row[field]; await reject({ ...fixture(), wardrobes: [row] });
    }
    for (const fields of [{ id: '' }, { user_id: 4 }, { updated_at: 'not a date' },
      { updated_at: '2026-02-30T00:00:00Z' }, { updated_at: null },
      ...[-1, 0.5, NaN, Infinity, '200', null].map(bytes => ({ bytes })), { v: {} }, { v: -1 }]) {
      await reject({ ...fixture(), wardrobes: [{ ...wardrobe(), ...fields }] });
    }
    for (const v of [undefined, null, 0, 'legacy-1']) {
      respond({ ...fixture(), wardrobes: [{ ...wardrobe(), v }] });
      assert.equal((await fetchAlphaStats('synthetic-admin-token')).kind, 'ok');
    }
  });
  await test('roster scalar, counter, and nullable fields must match the schema', async () => {
    for (const field of Object.keys(person())) {
      const row = person(); delete row[field]; await reject({ ...fixture(), roster: [row] });
    }
    for (const fields of [{ id: '' }, { email: {} }, { confirmed: 1 }, { created_at: 'invalid' },
      { last_sign_in_at: 42 }, { lastSync: false },
      ...[-1, 0.5, NaN, Infinity, '1', null].flatMap(value => [{ wardrobes: value }, { bytes: value }])]) {
      await reject({ ...fixture(), roster: [{ ...person(), ...fields }] });
    }
  });
  await test('profile null is valid and malformed present profiles are rejected', async () => {
    const profile = { display_name: 'Synthetic tester', handle: null, created_at: STAMP };
    respond({ ...fixture(), roster: [{ ...person(), profile }] });
    assert.equal((await fetchAlphaStats('synthetic-admin-token')).kind, 'ok');
    for (const invalid of [{}, [], true, 'profile', { ...profile, display_name: 7 },
      { ...profile, handle: [] }, { ...profile, created_at: 'invalid' }]) {
      await reject({ ...fixture(), roster: [{ ...person(), profile: invalid }] });
    }
  });
  await test('validated operational projection does not retain unexpected payload fields', async () => {
    respond({ ...fixture(), state: 'not operational', wardrobes: [{ ...wardrobe(), state: 'not operational' }],
      roster: [{ ...person(), extra: 'not operational', profile: { display_name: null, handle: null, created_at: null, extra: 'not operational' } }] });
    const result = await fetchAlphaStats('synthetic-admin-token');
    assert.equal(result.kind, 'ok');
    assert.equal('state' in result.stats, false);
    assert.equal('state' in result.stats.wardrobes[0], false);
    assert.equal('extra' in result.stats.roster[0], false);
    assert.equal('extra' in result.stats.roster[0].profile, false);
  });
  await test('auth refusal, absence, server failure and malformed JSON stay distinct', async () => {
    for (const [status, kind] of [[401, 'refused'], [404, 'absent'], [500, 'failed']]) {
      respond({}, status); assert.equal((await fetchAlphaStats('synthetic-admin-token')).kind, kind);
    }
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await fetchAlphaStats('synthetic-admin-token')).kind, 'absent');
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad JSON'); } });
    assert.deepEqual(await fetchAlphaStats('synthetic-admin-token'), { kind: 'failed', status: 200 });
  });
  await test('the admin token is sent only as a header with browser cache and cookies disabled', async () => {
    let request;
    globalThis.fetch = async (url, init) => { request = { url, init }; return { ok: true, status: 200, json: async () => fixture() }; };
    await fetchAlphaStats('synthetic-admin-token');
    assert.equal(request.url, ADMIN_STATS_ENDPOINT);
    assert.equal(String(request.url).includes('synthetic-admin-token'), false);
    assert.equal(request.init.headers['x-admin-token'], 'synthetic-admin-token');
    assert.equal(request.init.cache, 'no-store');
    assert.equal(request.init.credentials, 'omit');
  });
} finally { globalThis.fetch = originalFetch; }
if (failures) process.exitCode = 1;
