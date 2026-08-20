// ============================================================================
// ALMARI — the relay, clamped and then asked directly.
//
// Two sections, in this order:
//
//   1. THE CLAMPS, OFFLINE. The four clamps in supabase/functions/ai-proxy
//      (the model allowlist, the token ceiling, the body cap, the Origin
//      check) are exercised with no network and no key: the function is built
//      with esbuild and run under a Deno shim, its upstream fetch stubbed and
//      recorded. This runs on every invocation, flag or no flag — it costs
//      nothing, and it is the only proof of the clamps that does not wait on
//      a deploy.
//
//   2. THE DEPLOYED RELAY. One tiny request per provider, plus three knocks
//      that ask whether the clamps are actually live out there. No key is
//      needed — the relay holds the keys; that is the point of it. Because
//      this talks to the live function, it runs only under an explicit flag:
//
//        node scripts/test-relay.mjs --live
//
//      A 503 whose body says "not configured" prints SKIP, not FAIL — the
//      house simply has not set that key (or the deploy predates it). If NONE
//      of the three clamp knocks answers as a clamped relay would, all three
//      print SKIP: the deployed function predates the clamps and the owner
//      has not pushed it yet. If SOME of them do, the rest are real failures.
//
//      Also knocks on admin-stats WITHOUT a token: 401 (or 503 before its
//      secret is set) is the PASS — the locked door is the healthy state.
//
// The exit code is 1 only for unexpected failures.
// ============================================================================

import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELAY = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';
const STATS = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-stats';

/** The real fetch, kept before the offline section stubs the global one. */
const NET = globalThis.fetch;

const ASK = 'Reply with exactly: relay test ok';

let failures = 0;

/* ======================= 1. the clamps, offline ========================== */

const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) failures += 1;
};

async function clampsOffline() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'relay-clamps-')), 'ai-proxy.mjs');
  await build({
    // bundle:false — a transform, not a bundle. esbuild refuses `alias` here
    // and nothing resolves anyway; the parity audit exempts exactly this case.
    entryPoints: [fileURLToPath(new URL('../supabase/functions/ai-proxy/index.ts', import.meta.url))],
    bundle: false,
    format: 'esm',
    target: 'es2022',
    outfile,
    logLevel: 'error',
  });

  // The shim: a Deno whose serve() hands us the handler and whose env holds
  // three obvious non-keys, and a fetch that records the upstream call it was
  // asked to make instead of making it. Nothing here leaves the machine.
  const ENV = { ANTHROPIC_KEY: 'sk-not-a-key', GEMINI_KEY: 'g-not-a-key', KIMI_KEY: 'k-not-a-key' };
  let absent = new Set();
  let handler = null;
  globalThis.Deno = {
    serve: h => { handler = h; },
    env: { get: name => (absent.has(name) ? undefined : ENV[name]) },
  };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init?.body });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    await import(pathToFileURL(outfile).href);
    if (typeof handler !== 'function') {
      check('the function registers a handler', false, 'Deno.serve was never called');
      return;
    }

    const ask = async ({ model = 'claude-fable-5', max_tokens = 512, origin, method = 'POST', raw, headers = {} } = {}) => {
      calls.length = 0;
      const h = { 'content-type': 'application/json', ...headers };
      if (origin) h.origin = origin;
      const body = raw !== undefined
        ? raw
        : JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content: ASK }] });
      const res = await handler(new Request(RELAY, {
        method,
        headers: h,
        ...(method === 'POST' ? { body } : {}),
      }));
      return { status: res.status, text: await res.text(), sent: calls[0] ?? null };
    };

    console.log('the clamps, offline (supabase/functions/ai-proxy)\n');

    // (1) the model allowlist
    let r = await ask({ model: 'claude-fable-5' });
    check('claude-fable-5 goes to Anthropic', r.status === 200 && !!r.sent?.url.includes('api.anthropic.com'), r.status);
    r = await ask({ model: 'claude-opus-5' });
    check('claude-opus-5 goes to Anthropic', r.status === 200 && !!r.sent?.url.includes('api.anthropic.com'), r.status);
    r = await ask({ model: 'gemini-3.7-flash' });
    check('gemini-3.7-flash goes to Google', r.status === 200 && !!r.sent?.url.includes('generativelanguage'), r.status);
    r = await ask({ model: 'k3', max_tokens: 8000 });
    check('k3 goes to Kimi', r.status === 200 && !!r.sent?.url.includes('api.kimi.com'), r.status);
    r = await ask({ model: 'claude-opus-5-20260401' });
    check('a datestamped variant passes', r.status === 200, r.status);
    r = await ask({ model: 'claude-opus-5-latest' });
    check('a -latest variant passes', r.status === 200, r.status);
    r = await ask({ model: 'gpt-4o-mini' });
    check('an unlisted model is refused, nothing forwarded', r.status === 400 && r.sent === null, r.status);
    check('the refusal names the doors', /claude-fable-5, claude-opus-5, gemini-3\.7-flash, k3/.test(r.text), r.text.slice(0, 70));
    r = await ask({ model: 'claude-fable-5-evil.example.com' });
    check('an arbitrary suffix is not a variant', r.status === 400, r.status);
    r = await ask({ model: 'claude-fable-5x' });
    check('a glued lookalike is refused', r.status === 400, r.status);
    r = await ask({ raw: 'not json at all' });
    check('a body that will not parse is refused', r.status === 400 && r.sent === null, r.status);
    r = await ask({ raw: JSON.stringify({ max_tokens: 10 }) });
    check('a body naming no model is refused', r.status === 400 && /could not read/.test(r.text), r.status);

    // (2) the token ceiling — written down, never refused
    r = await ask({ max_tokens: 999999 });
    check('999999 tokens is written down to 16000', r.status === 200 && JSON.parse(r.sent.body).max_tokens === 16000, r.sent && JSON.parse(r.sent.body).max_tokens);
    r = await ask({ max_tokens: 16000 });
    check('16000 exactly is left alone', r.status === 200 && JSON.parse(r.sent.body).max_tokens === 16000, r.status);
    {
      const original = JSON.stringify({ model: 'k3', max_tokens: 8000, messages: [{ role: 'user', content: ASK }] });
      r = await ask({ raw: original });
      check('a body needing nothing is forwarded byte for byte', r.sent?.body === original);
    }

    // (3) the body cap — measured against prepareImage's own output, whose
    // pathological ceiling at 1400px is 1.94MB of base64 (src/lib/anthropic.ts).
    r = await ask({ raw: JSON.stringify({ model: 'claude-fable-5', image: 'A'.repeat(Math.round(1.94 * 1024 * 1024)) }) });
    check('the worst prepared photograph measured still passes', r.status === 200, r.status);
    r = await ask({ raw: JSON.stringify({ model: 'claude-fable-5', image: 'x'.repeat(9 * 1024 * 1024) }) });
    check('a 9MB body is refused 413, nothing forwarded', r.status === 413 && r.sent === null, r.status);
    check('the 413 says a plain sentence', /too large for this relay/.test(r.text), r.text.slice(0, 60));
    r = await ask({ headers: { 'content-length': String(20 * 1024 * 1024) } });
    check('a declared 20MB is refused before the read', r.status === 413, r.status);

    // (4) the Origin check
    for (const [origin, label] of [
      ['https://occult-kranti.github.io', 'the Pages origin'],
      ['http://localhost:5173', 'the dev server'],
      ['http://localhost:4174', 'the preview server'],
      ['http://127.0.0.1:8081', '127.0.0.1 (expo web)'],
    ]) {
      r = await ask({ origin });
      check(`${label} is allowed`, r.status === 200, r.status);
    }
    r = await ask({});
    check('no Origin at all is allowed (server-to-server)', r.status === 200, r.status);
    for (const [origin, label] of [
      ['https://evil.example', 'a foreign origin'],
      ['https://occult-kranti.github.io.evil.example', 'a lookalike Pages origin'],
      ['http://localhost.evil.example', 'a lookalike localhost'],
      ['null', 'an opaque origin'],
    ]) {
      r = await ask({ origin });
      check(`${label} is refused 403, nothing forwarded`, r.status === 403 && r.sent === null, r.status);
    }
    r = await ask({ origin: 'https://evil.example', method: 'OPTIONS' });
    check('the preflight is still answered, so the 403 is readable', r.status === 204, r.status);

    // the floor that was already there
    r = await ask({ method: 'GET' });
    check('GET is still 405', r.status === 405, r.status);
    absent = new Set(['ANTHROPIC_KEY']);
    r = await ask({});
    check('a missing key still says "not configured"', r.status === 503 && /not configured/.test(r.text), r.status);
    absent = new Set();
  } finally {
    globalThis.fetch = NET;
  }
}

await clampsOffline();

if (!process.argv.includes('--live')) {
  console.log('\nthe live probe runs only when asked:');
  console.log('  node scripts/test-relay.mjs --live');
  process.exit(failures === 0 ? 0 : 1);
}

/* ====================== 2. the deployed relay ============================= */

/** Anthropic Messages shape for claude*, OpenAI chat shape for the rest. */
function bodyFor(model) {
  if (model.startsWith('claude')) {
    return { model, max_tokens: 512, messages: [{ role: 'user', content: ASK }] };
  }
  // Kimi K3 reasons out of the same budget — 8000 is the working floor.
  const maxTokens = model === 'k3' ? 8000 : 512;
  return { model, max_tokens: maxTokens, messages: [{ role: 'user', content: ASK }] };
}

/** First line of the answer, whichever shape it came in. */
function textOf(model, parsed) {
  if (model.startsWith('claude')) {
    const block = (parsed.content ?? []).find((b) => b.type === 'text');
    return block?.text ?? '';
  }
  return parsed?.choices?.[0]?.message?.content ?? '';
}

const MODELS = ['claude-fable-5', 'claude-opus-5', 'gemini-3.7-flash', 'k3'];
const rows = [];

console.log('\nthe deployed relay\n');

for (const model of MODELS) {
  const t0 = Date.now();
  let verdict = 'FAIL';
  let status = 0;
  let note = '';
  try {
    const res = await NET(RELAY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bodyFor(model)),
    });
    status = res.status;
    const raw = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* note carries the raw text */ }
    if (status === 200) {
      verdict = 'PASS';
      note = String(textOf(model, parsed) || '(200, empty text)').trim();
    } else if (status === 503 && raw.includes('not configured')) {
      verdict = 'SKIP';
      note = parsed?.error ?? raw;
    } else {
      note = (parsed?.error?.message ?? parsed?.error ?? raw ?? '').toString();
    }
  } catch (err) {
    note = String(err?.message ?? err);
  }
  if (verdict === 'FAIL') failures += 1;
  rows.push({ model, verdict, status, ms: Date.now() - t0, note: note.slice(0, 60) });
}

/**
 * The three clamp knocks. `clamped` is what a relay carrying the clamps
 * answers; anything else is either a relay that predates them (all three
 * miss, and all three SKIP) or a clamp that has stopped working (some hit,
 * the rest FAIL). The Origin header goes out from node's own fetch, exactly
 * as `curl -H 'Origin: https://evil.example'` would send it.
 */
const KNOCKS = [
  {
    label: 'unlisted model (400)',
    send: () => NET(RELAY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'not-a-model-this-relay-carries', max_tokens: 512, messages: [{ role: 'user', content: ASK }] }),
    }),
    clamped: (status, raw) => status === 400 && raw.includes('claude-fable-5'),
    hit: 'refused, with the doors named',
  },
  {
    label: 'max_tokens 999999 (clamped)',
    send: () => NET(RELAY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-5', max_tokens: 999999, messages: [{ role: 'user', content: ASK }] }),
    }),
    // An unclamped relay hands 999999 to Anthropic, which refuses it; a
    // clamped one writes it down to 16000 and an answer comes back.
    clamped: (status) => status === 200,
    skip: (status, raw) => status === 503 && raw.includes('not configured'),
    hit: 'written down to 16000 — an answer came back',
  },
  {
    label: 'Origin: evil.example (403)',
    send: () => NET(RELAY, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ model: 'claude-fable-5', max_tokens: 512, messages: [{ role: 'user', content: ASK }] }),
    }),
    clamped: (status) => status === 403,
    hit: 'refused — the relay answers the app only',
  },
];

const knocked = [];
for (const knock of KNOCKS) {
  const t0 = Date.now();
  let status = 0;
  let raw = '';
  let reached = true;
  try {
    const res = await knock.send();
    status = res.status;
    raw = await res.text();
  } catch (err) {
    reached = false;
    raw = String(err?.message ?? err);
  }
  knocked.push({ knock, status, raw, reached, ms: Date.now() - t0 });
}

const anyClamped = knocked.some(k => k.reached && k.knock.clamped(k.status, k.raw));
for (const k of knocked) {
  const { knock } = k;
  let verdict;
  let note;
  if (!k.reached) {
    verdict = 'FAIL';
    note = k.raw;
  } else if (knock.clamped(k.status, k.raw)) {
    verdict = 'PASS';
    note = knock.hit;
  } else if (knock.skip?.(k.status, k.raw)) {
    verdict = 'SKIP';
    note = 'that provider has no key here';
  } else if (!anyClamped) {
    verdict = 'SKIP';
    note = 'the deployed relay predates the clamps — deploy, then run again';
  } else {
    verdict = 'FAIL';
    note = `answered ${k.status}: ${k.raw}`;
  }
  if (verdict === 'FAIL') failures += 1;
  rows.push({ model: knock.label, verdict, status: k.status, ms: k.ms, note: note.slice(0, 60) });
}

// The locked door: admin-stats must refuse a tokenless knock.
{
  const t0 = Date.now();
  let verdict = 'FAIL';
  let status = 0;
  let note = '';
  try {
    const res = await NET(STATS, { method: 'GET' });
    status = res.status;
    const raw = await res.text();
    if (status === 401 || (status === 503 && raw.includes('not configured'))) {
      verdict = 'PASS';
      note = status === 401 ? 'refused without a token — the lock holds' : 'not deployed/configured yet';
    } else if (status === 404) {
      verdict = 'SKIP';
      note = 'not deployed yet';
    } else {
      note = `answered ${status} to a tokenless knock`;
    }
  } catch (err) {
    note = String(err?.message ?? err);
  }
  if (verdict === 'FAIL') failures += 1;
  rows.push({ model: 'admin-stats (no token)', verdict, status, ms: Date.now() - t0, note: note.slice(0, 60) });
}

const w = Math.max(...rows.map((r) => r.model.length));
for (const r of rows) {
  console.log(
    `${r.model.padEnd(w)}  ${r.verdict.padEnd(4)}  HTTP ${String(r.status).padStart(3)}  ${String(r.ms).padStart(6)}ms  ${r.note}`,
  );
}
console.log(failures === 0 ? '\ntest-relay: no unexpected failures' : `\ntest-relay: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
