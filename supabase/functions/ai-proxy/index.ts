// ============================================================================
// ALMARI — AI relay (Supabase Edge Function)
//
// The app cannot call the model provider directly: the browser's CORS
// preflight is refused, and the key must never ship in client code. This
// function is the one hop in between. It is a PASS-THROUGH:
//
//   - the app POSTs a chat request body, with no key
//   - this function attaches the key (a secret, set with `supabase secrets
//     set`) and forwards the body untouched to the provider the model names:
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

// The app's own origin is not known ahead (dev server, installed PWA), and
// the function carries no secret access of its own — the KIMI_KEY never
// leaves this box — so the CORS answer is open. The key is the lock.
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // The browser's preflight.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'POST only' });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return json(400, { error: 'the request body could not be read' });
  }

  // The model names the provider. A body that will not parse goes to Kimi as
  // it always did — the provider's own error answer is clearer than a guess.
  let provider: 'anthropic' | 'google' | 'kimi' = 'kimi';
  try {
    const model = (JSON.parse(body) as { model?: unknown }).model;
    if (typeof model === 'string') {
      if (model.startsWith('claude')) provider = 'anthropic';
      else if (model.startsWith('gemini')) provider = 'google';
    }
  } catch { /* not JSON — the Kimi passthrough below reports it fine */ }

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
