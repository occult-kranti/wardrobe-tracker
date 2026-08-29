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

  /* ------------------------------------------------------------------
     THE ROSTER — one row per person who has actually arrived.
     ------------------------------------------------------------------

     The counts above answer "how many"; they cannot answer the question the
     alpha is actually run to answer, which is "did anybody who was handed the
     link get as far as an account, and then as far as using it?". That needs
     the rows, not the total: an alpha of fifteen where twelve signed up and one
     ever synced is a completely different situation from one where three signed
     up and all three did, and the two are the same number on a dashboard that
     only counts.

     WHAT THIS CARRIES, AND WHY EACH FIELD IS DEFENSIBLE. Every one of these is
     the service's OWN operational record of an account it was asked to keep —
     the same category as a subscriber list, not telemetry:

       email          the address the owner sent the invitation to. They already
                      have it; without it a row is an opaque uuid and the roster
                      cannot do its job, which is telling one tester from another.
       created_at     when the account was made. This is the signup curve.
       last_sign_in   whether they came back. This is retention, and it is the
                      one number the category's own research says nobody
                      publishes.
       confirmed      whether the address was verified, so a stuck invitation
                      looks different from a person who never opened it.
       profile        display name and handle IF they made one. Null is a real
                      and interesting answer: an account with no profile is
                      somebody who signed up and stopped.
       wardrobes      how many of their wardrobes are synced, their total size,
                      and when one last changed.

     WHAT IT NEVER CARRIES: the wardrobe document. Not one garment, not one
     name, not one photograph. The state column is measured (bytes, envelope
     version) and discarded, exactly as it is for the table above. A wardrobe's
     contents stay between its owner and the row it is stored in, and this
     function is not a way around that.
  */

  // Re-listed rather than counted, because the loop above kept only a total.
  // The alpha is 15–50 people; the page guard is for a mistake, not for scale.
  const people: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return json(502, { error: 'the roster listing failed' });
    for (const u of data.users) {
      people.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: !!(u.email_confirmed_at ?? u.confirmed_at),
      });
    }
    if (data.users.length < 200) break;
  }

  // Their profiles, if they made one. A LEFT JOIN done here rather than in SQL
  // because the two live in different schemas (auth and public) and the client
  // cannot join across them.
  const { data: profileRows, error: profListErr } = await supa
    .from('profiles')
    .select('id,display_name,handle,created_at');
  if (profListErr) return json(502, { error: 'the profile listing failed' });
  const profileById = new Map(
    (profileRows ?? []).map((p) => [
      p.id as string,
      { display_name: p.display_name ?? null, handle: p.handle ?? null, created_at: p.created_at ?? null },
    ]),
  );

  // And what each of them has actually synced, folded from the rows already read.
  const byOwner = new Map<string, { count: number; bytes: number; lastSync: string | null }>();
  for (const w of wardrobes) {
    const held = byOwner.get(w.user_id) ?? { count: 0, bytes: 0, lastSync: null };
    held.count += 1;
    held.bytes += w.bytes;
    if (!held.lastSync || (w.updated_at && w.updated_at > held.lastSync)) held.lastSync = w.updated_at;
    byOwner.set(w.user_id, held);
  }

  const roster = people
    .map((p) => {
      const held = byOwner.get(p.id as string) ?? { count: 0, bytes: 0, lastSync: null };
      return {
        ...p,
        profile: profileById.get(p.id as string) ?? null,
        wardrobes: held.count,
        bytes: held.bytes,
        lastSync: held.lastSync,
      };
    })
    // Newest arrival first: the question is usually "did anyone turn up today?".
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

  return json(200, {
    generatedAt: new Date().toISOString(),
    users,
    profiles: profiles ?? 0,
    wardrobes,
    roster,
  });
});
