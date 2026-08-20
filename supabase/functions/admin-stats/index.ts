// ============================================================================
// ALMARI — alpha stats (Supabase Edge Function)
//
// The project-lead portal (route #/admin) needs remote truth the anon key
// cannot see: how many accounts exist, how many profiles, how heavy each
// synced wardrobe is. This function answers exactly that and nothing more.
//
//   - the caller sends header `x-admin-token`; it must equal the ADMIN_TOKEN
//     secret exactly, or the answer is 401. No token set → 503 "not
//     configured", the same phrase the relay uses.
//   - the answer carries counts, byte-sizes, and per-row identifiers
//     (wardrobe id, user id, updated_at) — pseudonymous plumbing the portal
//     needs to tell rows apart. A wardrobe's state itself is measured
//     (bytes, envelope version) and NEVER returned — the blob stays between
//     its owner and the wardrobes table.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime;
// the service role never leaves this box.
//
// Deno runtime, per Supabase edge function convention.
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-admin-token',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { error: 'GET or POST only' });
  }

  const expected = Deno.env.get('ADMIN_TOKEN');
  if (!expected) {
    return json(503, { error: 'stats not configured: ADMIN_TOKEN is not set' });
  }
  const given = req.headers.get('x-admin-token');
  if (!given || given !== expected) {
    return json(401, { error: 'the token was refused' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json(503, { error: 'stats not configured: service credentials missing' });
  }
  const supa = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Accounts, paged — the alpha is 15-50 people; the guard is for a mistake,
  // not for scale.
  let users = 0;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return json(502, { error: 'the account listing failed' });
    users += data.users.length;
    if (data.users.length < 200) break;
  }

  const { count: profiles, error: profErr } = await supa
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (profErr) return json(502, { error: 'the profile count failed' });

  const { data: rows, error: wardErr } = await supa
    .from('wardrobes')
    .select('id,user_id,updated_at,state');
  if (wardErr) return json(502, { error: 'the wardrobe listing failed' });

  const wardrobes = (rows ?? []).map((r) => {
    const state = r.state as { v?: unknown } | null;
    return {
      id: r.id as string,
      user_id: r.user_id as string,
      updated_at: r.updated_at as string,
      bytes: JSON.stringify(r.state ?? null).length,
      // Envelope rows carry {v, alg, payload}; a legacy bare row has no v.
      v: state && typeof state === 'object' && typeof state.v === 'number' ? state.v : null,
    };
  });

  return json(200, {
    generatedAt: new Date().toISOString(),
    users,
    profiles: profiles ?? 0,
    wardrobes,
  });
});
