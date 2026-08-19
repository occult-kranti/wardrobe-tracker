// Almari AI proxy — keeps the vision-model key server-side.
// The app POSTs OpenAI-compatible chat-completions JSON here; the worker
// forwards it to the upstream provider with the secret attached.
// No logging, no storage: a pass-through with CORS for the alpha.

const UPSTREAM = 'https://api.kimi.com/coding/v1/chat/completions';

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      return new Response('not found', { status: 404, headers: cors() });
    }
    if (!env.KIMI_KEY) {
      return new Response('proxy not configured', { status: 503, headers: cors() });
    }
    const body = await request.text();
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.KIMI_KEY}`,
      },
      body,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(),
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  },
};
