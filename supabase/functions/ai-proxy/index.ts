// ============================================================================
// ALMARI — AI relay (Supabase Edge Function)
//
// The app cannot call the model provider directly: the browser's CORS
// preflight is refused, and the key must never ship in client code. This
// function is the one hop in between. It is a PASS-THROUGH with four clamps:
//
//   - the app POSTs a chat request body, with no key
//   - the clamps below check who asked, which model, how many tokens and how
//     large the body is — and nothing else. An honest request goes through
//     unchanged.
//   - this function attaches the key (a secret, set with `supabase secrets
//     set`) and forwards the body to the provider the model names:
//       model starts with "claude" → Anthropic Messages API (ANTHROPIC_KEY)
//       model starts with "gemini" → Google's OpenAI-compatible endpoint (GEMINI_KEY)
//       anything else              → Kimi, by Moonshot AI (KIMI_KEY)
//   - the answer streams back untouched
//
// It logs nothing and stores nothing. A photograph passes through it and is
// not kept — the wardrobe record is on the device, and its copy, if any, is
// in the wardrobes table. This function holds no state at all.
//
// Deno runtime, per Supabase edge function convention.
// ============================================================================

const KIMI_UPSTREAM = 'https://api.kimi.com/coding/v1/chat/completions';
const ANTHROPIC_UPSTREAM = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// Google publishes an OpenAI-compatible door — the same body shape the Kimi
// path already speaks, so a gemini request needs no translation here either.
const GEMINI_UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// The CORS answer stays open so that a refusal below arrives at the page as a
// status and a sentence it can read, rather than as an opaque browser error.
// The locks are the key (which never leaves this box) and the four clamps.
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

/* ---------- the clamps ----------
   A pass-through with no floor is an open relay: whoever finds the URL can
   spend the house's keys on any model, at any length, with any payload.
   These four are the whole floor, each stated with its reason. None of them
   changes the shape of a request the app actually makes. */

/**
 * (1) The models this relay carries. The app's intake sends claude-fable-5
 * (RELAY_MODEL, src/lib/anthropic.ts); the portal's service board and
 * scripts/test-relay.mjs also knock with claude-opus-5, gemini-3.7-flash and
 * k3 (RELAY_SERVICES, src/lib/admin.ts). A dated or point-release variant of
 * one of those is the same door, so the match is prefix-tolerant: the name,
 * optionally followed by -latest or a datestamp. Nothing else follows the
 * prefix, or "claude-fable-5-anything" would be a hole in the list. Anything
 * unlisted is refused here, calmly and by name, rather than billed upstream.
 */
const ALLOWED_MODELS = ['claude-fable-5', 'claude-opus-5', 'gemini-3.7-flash', 'k3'];
const POINT_RELEASE = /^-(latest|\d{6,8})$/;
function modelAllowed(model: string): boolean {
  return ALLOWED_MODELS.some(m => model === m || (model.startsWith(m) && POINT_RELEASE.test(model.slice(m.length))));
}

/**
 * (2) The token ceiling. 16000 is what the app asks for (MAX_TOKENS in
 * src/lib/anthropic.ts) and what a reasoning model needs to think and answer
 * out of one budget. A larger ask is written down, never refused: the
 * photograph is still read, at the cost the house agreed to.
 */
const MAX_TOKENS = 16000;

/**
 * (3) The body cap. Measured against prepareImage's own output (1400px long
 * edge, JPEG at 0.88): the bundled intake samples encode to 0.16–0.29 MB of
 * base64, and a pathological per-pixel-noise frame at the full 1400px square
 * — busier than any photograph of clothes can be — reaches 1.94 MB. 8 MB is
 * four times that ceiling, so no honest photograph is ever refused and the
 * relay is still not a free upload pipe.
 */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/**
 * (4) Who may ask from a browser. A browser always sends Origin, so the two
 * places the app is served from are named: the deployed Pages origin, and a
 * local dev or preview server. A request with NO Origin is server-to-server
 * — the native app's fetch, scripts/test-relay.mjs, curl — and is allowed;
 * this clamp is about which pages may spend the keys, not about people.
 */
const PAGES_ORIGIN = 'https://occult-kranti.github.io';
function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  if (origin === PAGES_ORIGIN) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // The browser's preflight. Answered before the Origin clamp on purpose: a
  // refused preflight reaches the page as an opaque CORS failure, where a
  // refused POST reaches it as a 403 with a sentence in it.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (!originAllowed(req.headers.get('origin'))) {
    return json(403, { error: 'this relay answers the Almari app only' });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }

  // Refused on the declared length first, so an oversized body is never
  // buffered here; the check after the read is the belt for a request that
  // declared no length at all.
  const tooLarge = {
    error: 'that request is too large for this relay — a photograph is sent at 1400px on its long edge',
  };
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(413, tooLarge);
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return json(400, { error: 'the request body could not be read' });
  }
  if (body.length > MAX_BODY_BYTES) {
    return json(413, tooLarge);
  }

  // The model names the provider, and has to be one this relay carries. A
  // body that will not parse, or that names no model, cannot be routed at
  // all — it is refused here with the doors named, rather than forwarded to
  // a provider whose refusal would be about something else entirely.
  let parsed: { model?: unknown; max_tokens?: unknown } | null = null;
  try {
    parsed = JSON.parse(body) as { model?: unknown; max_tokens?: unknown };
  } catch { /* refused just below, by the same sentence as an unlisted model */ }
  const model = typeof parsed?.model === 'string' ? parsed.model : '';
  if (!modelAllowed(model)) {
    const named = model ? `"${model.slice(0, 60)}"` : 'a model it could not read';
    return json(400, { error: `this relay does not carry ${named} — it carries: ${ALLOWED_MODELS.join(', ')}` });
  }
  const provider: 'anthropic' | 'google' | 'kimi' =
    model.startsWith('claude') ? 'anthropic'
    : model.startsWith('gemini') ? 'google'
    : 'kimi';

  // The ask is written down to the ceiling and sent on. A body that needed
  // nothing is forwarded exactly as it arrived, as it always was.
  if (typeof parsed?.max_tokens === 'number' && parsed.max_tokens > MAX_TOKENS) {
    parsed.max_tokens = MAX_TOKENS;
    body = JSON.stringify(parsed);
  }

  const keyName =
    provider === 'anthropic' ? 'ANTHROPIC_KEY'
    : provider === 'google' ? 'GEMINI_KEY'
    : 'KIMI_KEY';
  const key = Deno.env.get(keyName);
  if (!key) {
    // The app's copy for this status tells the user the house has not set a
    // key yet — keep the phrase "not configured" in this body so it matches.
    return json(503, { error: `relay not configured: ${keyName} is not set` });
  }

  const upstreamUrl =
    provider === 'anthropic' ? ANTHROPIC_UPSTREAM
    : provider === 'google' ? GEMINI_UPSTREAM
    : KIMI_UPSTREAM;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: provider === 'anthropic'
        ? {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': ANTHROPIC_VERSION,
          }
        : {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
      body,
    });
  } catch {
    return json(502, { error: 'the model provider could not be reached' });
  }

  // Status and body pass through as they came — a refusal from the provider
  // (401, 429, 500) is something the app already knows how to say plainly.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...CORS,
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
});
