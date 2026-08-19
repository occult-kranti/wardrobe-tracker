// ============================================================================
// ALMARI — AI relay (Supabase Edge Function)
//
// The app cannot call the model provider directly: the browser's CORS
// preflight is refused, and the key must never ship in client code. This
// function is the one hop in between. It is a PASS-THROUGH:
//
//   - the app POSTs an OpenAI-compatible chat-completions request body, with
//     no key
//   - this function attaches the key (a secret, set with `supabase secrets
//     set KIMI_KEY=...`) and forwards the body untouched to Kimi, by
//     Moonshot AI
//   - the answer streams back untouched
//
// It logs nothing and stores nothing. A photograph passes through it and is
// not kept — the wardrobe record is on the device, and its copy, if any, is
// in the wardrobes table. This function holds no state at all.
//
// Deno runtime, per Supabase edge function convention.
// ============================================================================

const UPSTREAM = 'https://api.kimi.com/coding/v1/chat/completions';

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

  const key = Deno.env.get('KIMI_KEY');
  if (!key) {
    // The app's copy for this status tells the user the house has not set a
    // key yet — keep the phrase "not configured" in this body so it matches.
    return json(503, { error: 'relay not configured: KIMI_KEY is not set' });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return json(400, { error: 'the request body could not be read' });
  }

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
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
