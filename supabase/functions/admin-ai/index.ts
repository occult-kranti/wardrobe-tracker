/** Explicit operator tests only. Auth precedes body reads and all provider I/O.
 * No logs, storage, tools, remote image URLs, arbitrary upstreams, or retries.
 * The existing relay owns provider secrets and its model/token clamps.
 */
const MODELS = new Set(['claude-fable-5-1', 'claude-fable-5', 'claude-opus-5', 'gemini-3.7-flash', 'k3']);
const MAX_BYTES = 8 * 1024 * 1024;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-admin-token',
  'cache-control': 'no-store',
};
function answer(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}
function allowedOrigin(origin: string | null): boolean {
  return !origin || origin === 'https://occult-kranti.github.io' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
}
/** Streaming bound counts actual UTF-8 bytes, even without Content-Length. */
async function readBounded(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length')) > MAX_BYTES) return null;
  const reader = req.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder().decode(bytes);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const token = Deno.env.get('ADMIN_TOKEN');
  if (!token) return answer(503, 'admin service not configured');
  if (req.headers.get('x-admin-token') !== token) return answer(401, 'admin token required');
  if (!allowedOrigin(req.headers.get('origin'))) return answer(403, 'origin refused');
  if (req.method !== 'POST') return answer(405, 'POST only');
  let input: Record<string, unknown>;
  try {
    const body = await readBounded(req);
    if (body === null) return answer(413, 'request too large');
    input = JSON.parse(body);
  } catch { return answer(400, 'invalid JSON'); }
  if (!input || Array.isArray(input) || typeof input !== 'object') return answer(400, 'invalid request');
  if (typeof input.model !== 'string' || !MODELS.has(input.model)) return answer(400, 'model not allowed');
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 120000 ||
      typeof input.system !== 'string' || input.system.length > 60000) return answer(400, 'invalid prompt');
  if (input.maxTokens !== undefined && (typeof input.maxTokens !== 'number' || !Number.isInteger(input.maxTokens) || input.maxTokens < 256)) return answer(400, 'invalid token budget');
  const maxTokens = Math.min((input.maxTokens as number | undefined) ?? 8000, 16000);
  let photo: { mimeType: string; base64: string } | undefined;
  if (input.image !== undefined) {
    const i = input.image as Record<string, unknown> | null;
    if (!i || !['image/jpeg', 'image/png', 'image/webp'].includes(i.mimeType as string) ||
        typeof i.base64 !== 'string' || !i.base64.length || i.base64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(i.base64)) return answer(400, 'invalid image');
    photo = { mimeType: i.mimeType as string, base64: i.base64 };
  }
  const anthropic = input.model.startsWith('claude');
  const content = anthropic
    ? [...(photo ? [{ type: 'image', source: { type: 'base64', media_type: photo.mimeType, data: photo.base64 } }] : []), { type: 'text', text: input.prompt }]
    : [...(photo ? [{ type: 'image_url', image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` } }] : []), { type: 'text', text: input.prompt }];
  const relayBody = anthropic
    ? { model: input.model, max_tokens: maxTokens, system: input.system, messages: [{ role: 'user', content }] }
    : { model: input.model, max_tokens: maxTokens, messages: [...(input.system.trim() ? [{ role: 'system', content: input.system }] : []), { role: 'user', content }] };
  const project = Deno.env.get('SUPABASE_URL');
  if (!project) return answer(503, 'admin service not configured');
  let upstream: Response;
  try {
    upstream = await fetch(`${project.replace(/\/$/, '')}/functions/v1/ai-proxy`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(relayBody), signal: AbortSignal.timeout(180000),
    });
  } catch { return answer(504, 'test did not complete; billing unknown'); }
  return new Response(upstream.body, { status: upstream.status, headers: { ...CORS,
    'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
});
