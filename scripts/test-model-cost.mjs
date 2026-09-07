#!/usr/bin/env node
/** Pure fixtures: no provider requests, credentials, images, or wardrobe records. */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const bundle = await build({
  alias: sharedAliases(),
  stdin: {
    contents: "export * from './src/portal/lib/modelCatalog.ts'; export * from './src/portal/lib/modelCost.ts';",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'error',
});
const { MODEL_CATALOG, MODEL_IDS, getModelDefinition, normalizeUsage, estimateModelCost } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

let failures = 0;
function test(label, fn) {
  try { fn(); console.log(`PASS - ${label}`); }
  catch (error) { failures++; console.error(`FAIL - ${label}: ${error.message}`); }
}
const NOW = '2026-09-07T18:00:00.000Z';
const FABLE = 'claude-fable-5-1';
const GEMINI = 'gemini-3.7-flash';
const claude = (usage, model = FABLE) => normalizeUsage(model, { model, usage });
const google = usage => normalizeUsage(GEMINI, { model: GEMINI, usage });
const price = (usage, model = FABLE, date = NOW) => estimateModelCost(model, usage, date);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const basic = { input_tokens: 1000, output_tokens: 200 };

test('catalog contains exactly the five relay models and only image input', () => {
  assert.deepEqual(MODEL_CATALOG.map(model => model.id), [...MODEL_IDS]);
  assert.equal(new Set(MODEL_IDS).size, 5);
  assert.ok(MODEL_CATALOG.every(model => model.imageInput && model.imageOutput === false));
  assert.equal(getModelDefinition('claude-fable-5-1-latest')?.id, FABLE);
  assert.equal(getModelDefinition('claude-fable-5-20260901')?.id, 'claude-fable-5');
  assert.equal(getModelDefinition('claude-fable-5-1-wrong'), undefined);
  assert.equal(getModelDefinition('not-a-model'), undefined);
});

test('Claude charges uncached input and output exactly once', () => {
  const usage = claude(basic);
  assert.equal(usage.status, 'complete');
  assert.equal(usage.reasoningTokens, null);
  assert.equal(usage.totalTokens, 1200);
  near(price(usage).usd, 0.02);
  assert.equal(price(usage).status, 'estimated');
});

test('all Claude cache categories are additive inputs with their own rates', () => {
  const usage = claude({
    input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 4000,
    cache_creation_input_tokens: 3000,
    cache_creation: { ephemeral_5m_input_tokens: 2000, ephemeral_1h_input_tokens: 1000 },
    output_tokens_details: { thinking_tokens: 150 },
  });
  assert.equal(usage.inputTokens, 8000);
  assert.equal(usage.totalTokens, 8200);
  assert.equal(usage.reasoningTokens, 150);
  near(price(usage).usd, 0.066);
  assert.deepEqual(price(usage).breakdown, { input: 0.01, output: 0.01, cacheRead: 0.001, cacheWrite5m: 0.025, cacheWrite1h: 0.02 });
  near(price(usage, 'claude-fable-5').usd, 0.069);
  near(price(usage, 'claude-opus-5').usd, 0.0345);
});

test('Claude long context retains the same rates', () => {
  near(price(claude({ input_tokens: 900000, output_tokens: 1000 })).usd, 9.05);
});

test('positive Claude cache writes without a TTL cannot be priced', () => {
  const usage = claude({ ...basic, cache_creation_input_tokens: 100 });
  assert.equal(usage.status, 'partial');
  assert.equal(usage.inputTokens, 1100);
  assert.equal(price(usage).usd, null);
  assert.equal(price(usage).status, 'unavailable');
});

test('Claude rejects contradictory cache, thinking, and total counters', () => {
  for (const fields of [
    { cache_creation_input_tokens: 5, cache_creation: { ephemeral_5m_input_tokens: 4 } },
    { output_tokens_details: { thinking_tokens: 201 } },
    { total_tokens: 1300 },
  ]) assert.equal(claude({ ...basic, ...fields }).status, 'invalid');
});

test('Google compatibility includes separate thinking via the total', () => {
  const usage = google({ prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1500,
    completion_tokens_details: { reasoning_tokens: 400 }, prompt_tokens_details: { cached_tokens: 600 } });
  assert.equal(usage.outputTokens, 500);
  assert.equal(usage.reasoningTokens, 400);
  assert.equal(usage.uncachedInputTokens, 400);
  near(price(usage, GEMINI).usd, 0.00222);
});

test('Google inclusive completion convention never adds thinking again', () => {
  const usage = google({ prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500,
    completion_tokens_details: { reasoning_tokens: 400 }, prompt_tokens_details: { cached_tokens: 600 } });
  assert.equal(usage.outputTokens, 500);
  near(price(usage, GEMINI).usd, 0.00222);
});

test('Google can infer separate reasoning without inventing an unreported zero', () => {
  const separate = google({ prompt_tokens: 27, completion_tokens: 45, total_tokens: 576 });
  assert.equal(separate.reasoningTokens, 504);
  assert.equal(separate.outputTokens, 549);
  assert.ok(separate.notes.some(note => note.includes('inferred')));
  const sameTotal = google({ prompt_tokens: 27, completion_tokens: 45, total_tokens: 72 });
  assert.equal(sameTotal.reasoningTokens, null);
  assert.ok(sameTotal.notes.some(note => note.includes('without a cache discount')));
});

test('Google native accounting matches equivalent chat accounting', () => {
  const usage = normalizeUsage(GEMINI, { usageMetadata: {
    promptTokenCount: 1000, cachedContentTokenCount: 600, candidatesTokenCount: 100,
    thoughtsTokenCount: 400, totalTokenCount: 1500,
  } });
  assert.equal(usage.status, 'complete');
  assert.equal(usage.outputTokens, 500);
  assert.equal(usage.totalTokens, 1500);
  near(price(usage, GEMINI).usd, 0.00222);
});

test('Google missing total cannot hide unknown reasoning charges', () => {
  const usage = google({ prompt_tokens: 1000, completion_tokens: 100 });
  assert.equal(usage.status, 'partial');
  assert.equal(price(usage, GEMINI).usd, null);
});

test('Google contradictory total, cache and reasoning counters are refused', () => {
  const fixture = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 150 };
  for (const fields of [
    { total_tokens: 119 },
    { prompt_tokens_details: { cached_tokens: 101 } },
    { cached_tokens: 5, prompt_tokens_details: { cached_tokens: 6 } },
    { completion_tokens_details: { reasoning_tokens: 31 } },
    { reasoning_tokens: 30, completion_tokens_details: { reasoning_tokens: 29 } },
  ]) assert.equal(google({ ...fixture, ...fields }).status, 'invalid');
  assert.equal(normalizeUsage(GEMINI, { usageMetadata: {
    promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 29, totalTokenCount: 150,
  } }).status, 'invalid');
});

test('Gemini rate switches at the exact published UTC date', () => {
  const usage = google({ prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500,
    prompt_tokens_details: { cached_tokens: 600 } });
  near(price(usage, GEMINI, '2026-12-31T23:59:59.999Z').usd, 0.00222);
  near(price(usage, GEMINI, '2027-01-01T00:00:00.000Z').usd, 0.00444);
});

test('missing, invalid and historical dates are never assigned current rates', () => {
  for (const date of ['', 'yesterday', '2026-02-30', '2026-09-07T24:30:00Z', '2026-09-06T23:59:59Z']) {
    assert.equal(price(claude(basic), FABLE, date).status, 'unavailable');
  }
});

test('Kimi coding usage is a subscription, never an invented per-call USD price', () => {
  const usage = normalizeUsage('k3', { model: 'k3', usage: {
    prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200, cached_tokens: 700,
    completion_tokens_details: { reasoning_tokens: 150 },
  } });
  assert.equal(usage.status, 'complete');
  assert.equal(usage.uncachedInputTokens, 300);
  const cost = price(usage, 'k3');
  assert.equal(cost.status, 'subscription');
  assert.equal(cost.usd, null);
  assert.equal(cost.breakdown, undefined);
  assert.equal(price(normalizeUsage('k3', {}), 'k3').usd, null);
  assert.equal(normalizeUsage('k3', { usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 6 } }).status, 'invalid');
});

test('missing and invalid usage remain distinct from a reported zero', () => {
  for (const raw of [undefined, null, {}, { usage: null }]) {
    assert.equal(normalizeUsage(FABLE, raw).status, 'missing');
    assert.equal(price(normalizeUsage(FABLE, raw)).usd, null);
  }
  for (const raw of [[], 'bad', 7]) assert.equal(normalizeUsage(FABLE, { usage: raw }).status, 'invalid');
  const zero = claude({ input_tokens: 0, output_tokens: 0 });
  assert.equal(price(zero).usd, 0);
  assert.equal(price(zero).status, 'estimated');
  assert.equal(claude({ input_tokens: 0 }).status, 'partial');
});

test('every supported token field rejects nonfinite, negative, fractional and coerced values', () => {
  const badValues = [-1, NaN, Infinity, -Infinity, 0.5, '100', true, {}, [], Number.MAX_SAFE_INTEGER + 1];
  const setters = [
    value => claude({ ...basic, input_tokens: value }),
    value => claude({ ...basic, output_tokens: value }),
    value => claude({ ...basic, cache_read_input_tokens: value }),
    value => claude({ ...basic, cache_creation_input_tokens: value }),
    value => claude({ ...basic, cache_creation: { ephemeral_5m_input_tokens: value } }),
    value => claude({ ...basic, cache_creation: { ephemeral_1h_input_tokens: value } }),
    value => claude({ ...basic, output_tokens_details: { thinking_tokens: value } }),
    value => google({ prompt_tokens: value, completion_tokens: 2, total_tokens: 3 }),
    value => google({ prompt_tokens: 1, completion_tokens: value, total_tokens: 3 }),
    value => google({ prompt_tokens: 1, completion_tokens: 2, total_tokens: value }),
    value => google({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cached_tokens: value }),
    value => google({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, completion_tokens_details: { reasoning_tokens: value } }),
  ];
  for (const set of setters) for (const value of badValues) assert.equal(set(value).status, 'invalid');
  assert.equal(claude({ input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 1 }).status, 'invalid');
});

test('malformed nested fields and mismatched model responses are refused', () => {
  assert.equal(claude({ ...basic, cache_creation: [] }).status, 'invalid');
  assert.equal(google({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, prompt_tokens_details: 'bad' }).status, 'invalid');
  assert.equal(normalizeUsage(FABLE, { model: 'claude-opus-5', usage: basic }).status, 'invalid');
  assert.equal(normalizeUsage(FABLE, { model: 'unverified', usage: basic }).status, 'invalid');
  assert.equal(normalizeUsage('unverified', { usage: basic }).status, 'invalid');
  assert.equal(price(claude(basic), 'unverified').usd, null);
});

test('unsupported inference modifiers and tool accounting do not use standard prices', () => {
  for (const fields of [
    { service_tier: 'priority' }, { inference_geo: 'us' }, { speed: 'fast' },
    { server_tool_use: { web_search_requests: 1 } }, { toolUsePromptTokenCount: 100 },
  ]) assert.equal(price(claude({ ...basic, ...fields })).usd, null);
});

test('public estimator rechecks normalized data instead of trusting caller assertions', () => {
  const usage = claude(basic);
  for (const change of [
    { inputTokens: NaN }, { outputTokens: -1 }, { totalTokens: 0 },
    { cacheReadInputTokens: 1 }, { reasoningTokens: 201 },
    { uncachedInputTokens: '1000' }, { cacheWrite1hInputTokens: null },
  ]) assert.equal(price({ ...usage, ...change }).usd, null);
  assert.equal(price(undefined).usd, null);
});

test('very small positive estimates retain a nonzero amount label', () => {
  const usage = google({ prompt_tokens: 1, completion_tokens: 0, total_tokens: 1, cached_tokens: 1 });
  assert.ok(price(usage, GEMINI).usd > 0);
  assert.match(price(usage, GEMINI).label, /<\$0\.000001/);
});

if (failures) process.exitCode = 1;
