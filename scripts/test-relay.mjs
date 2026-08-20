// ============================================================================
// ALMARI — the relay, asked directly.
//
// Probes the DEPLOYED ai-proxy with one tiny request per provider and prints
// what came back. No key is needed here — the relay holds the keys; that is
// the point of it. Because this talks to the live function, it runs only
// under an explicit flag:
//
//   node scripts/test-relay.mjs --live
//
// A 503 whose body says "not configured" prints SKIP, not FAIL — the house
// simply has not set that key (or the deploy predates it). The exit code is
// 1 only for unexpected failures.
//
// Also knocks on admin-stats WITHOUT a token: 401 (or 503 before its secret
// is set) is the PASS — the locked door is the healthy state.
// ============================================================================

const RELAY = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';
const STATS = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-stats';

if (!process.argv.includes('--live')) {
  console.log('test-relay probes the LIVE relay and runs only when asked:');
  console.log('  node scripts/test-relay.mjs --live');
  process.exit(0);
}

const ASK = 'Reply with exactly: relay test ok';

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
let failures = 0;
const rows = [];

for (const model of MODELS) {
  const t0 = Date.now();
  let verdict = 'FAIL';
  let status = 0;
  let note = '';
  try {
    const res = await fetch(RELAY, {
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

// The locked door: admin-stats must refuse a tokenless knock.
{
  const t0 = Date.now();
  let verdict = 'FAIL';
  let status = 0;
  let note = '';
  try {
    const res = await fetch(STATS, { method: 'GET' });
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
