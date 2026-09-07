// ============================================================================
// ALMARI — alpha usage ingest (Supabase Edge Function)
//
// The other half of src/lib/usage.ts's four rules, enforced from the outside
// this time. The client is trusted to be honest — it is our own code — but
// this function is the seam where somebody else's request could arrive: a
// browser extension, a stray curl, a future bug that lets a bad payload build.
// So it re-checks everything the client already checked, from scratch, with
// its OWN copy of the vocabulary rather than trusting the client's.
//
//   - the app POSTs a batch of events with an install id, no key (the same
//     shape ai-proxy already uses for a keyless public door)
//   - EVERY clamp below is a REJECTION, never a strip. There is no code path
//     in this file that removes an unwelcome field and keeps the row: a
//     payload that fails any check is refused whole, and nothing from it is
//     written. A "best effort" ingest that saves the parts it likes is a
//     silent way for a leak to survive review, because the test that proves
//     it never happens has nothing left to look at.
//   - a DELETE (or a POST carrying {action:'erase'}) removes every row for
//     one install id — the remote half of revocation, called from
//     eraseUsage() in src/lib/usage.ts.
//
// This function logs nothing beyond what Supabase's platform logs on its own
// (method, status, latency) and stores nothing but the rows themselves — no
// request bodies, no IPs, no user agents are written down anywhere by this
// code.
//
// Deno runtime, per Supabase edge function convention.
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

/* ---------- the clamps ----------
   Six of them, matching the shape of ai-proxy's own four: each one is a
   refusal with a reason, none of them changes what an honest batch from the
   real app looks like. */

/**
 * (1) The body cap. A batch is at most MAX_EVENTS events (below) of small,
 * flat, numbers-and-enums-only property bags — nothing here ever carries a
 * photograph or a paragraph of free text, so 128KB is generous for the real
 * shape and still nowhere near large enough to be a useful place to dump
 * something else.
 */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * (2) The event cap. Matches MAX_EVENTS in src/lib/usage.ts exactly — the
 * client's own ring buffer never holds more than this many, so a batch that
 * claims more than 500 events did not come from an honest buffer flush.
 */
const MAX_EVENTS = 500;

/**
 * (3) THE VOCABULARY ALLOWLIST. This is the server's own copy of EVENT_NAMES
 * from src/lib/usage.ts — not an import of it (this function ships and
 * deploys on its own, and a shared import would make "the server's OWN
 * allowlist" a fiction; a compromised or out-of-date client could then change
 * what the server accepts just by changing what it sends). The two lists are
 * kept in sync BY HAND, and that hand-sync is exactly what
 * scripts/test-usage.mjs checks for drift on: if this array and the union in
 * usage.ts ever disagree, an event either gets silently rejected in
 * production (server list narrower) or the server starts accepting a name it
 * cannot validate the shape of (server list wider, and the code below has no
 * schema for it, so it is rejected anyway by clamp 4 — but the drift is still
 * a bug worth catching before it ships).
 *
 * This is the single most important clamp in the file: an event whose name is
 * not on this list is refused before its properties are even looked at,
 * which is the server-side half of "there is no path for free text" — even a
 * client that somehow constructed `{ name: 'literally anything' }` cannot get
 * a row written, because the name itself is the first gate.
 */
const EVENT_NAMES = [
  'app_opened',
  'wardrobe_created',
  'piece_added',
  'wear_logged',
  'outfit_created',
  'screen_viewed',
  'intake_run',
  'cutout_run',
  'export_taken',
  'tutorial_step',
  'write_refused',
  'error_raised',
  'sync_attempted',
  'session_ended',
] as const;
type EventName = (typeof EVENT_NAMES)[number];

function isEventName(v: unknown): v is EventName {
  return typeof v === 'string' && (EVENT_NAMES as readonly string[]).includes(v);
}

/**
 * The closed enums a property value is allowed to hold, mirrored from
 * usage.ts's SCREENS / AddRoute / CostTier / ErrorSite / ErrorKind /
 * TutorialAction. Same hand-sync discipline as EVENT_NAMES above, and the
 * same reason: this function's safety does not get to depend on the client
 * having sent the truth.
 */
const SCREENS = [
  'today', 'closet', 'outfits', 'dressing-room', 'calendar', 'events',
  'ledger', 'wishlist', 'before-you-buy', 'chats', 'profile', 'rail',
  'intake', 'settings', 'wardrobes', 'door', 'elsewhere',
] as const;
const ADD_ROUTES = ['manual', 'photo', 'intake', 'sample'] as const;
const COST_TIERS = ['unrecorded', 'free', 'budget', 'mid', 'investment'] as const;
const ERROR_SITES = ['intake', 'cutout', 'sync', 'photos', 'storage', 'render', 'export'] as const;
const ERROR_KINDS = ['network', 'refused', 'quota', 'parse', 'timeout', 'unknown'] as const;
const TUTORIAL_ACTIONS = ['shown', 'done', 'skipped'] as const;
// A size BAND, never a byte count. The client bucket is sizeTierOf() in
// src/lib/usage.ts; an exact length is a fingerprint that joins usage_events to
// public.wardrobes, which names an account. Kept in step by scripts/test-usage.mjs.
const SIZE_TIERS = ['under-1mb', '1-3mb', '3-5mb', 'over-5mb'] as const;

type Validator = (v: unknown) => boolean;

const isNum: Validator = v => typeof v === 'number' && Number.isFinite(v);
const isBool: Validator = v => typeof v === 'boolean';
const enumOf = (list: readonly string[]): Validator => v => typeof v === 'string' && list.includes(v);

/**
 * (4) PROPERTY SHAPE. One schema per event name, each schema an exact set of
 * keys with a validator per key — not "these keys if present", but "exactly
 * these keys, each holding exactly this shape". An event that carries an
 * extra key, a missing key, or a value of the wrong type is rejected whole.
 *
 * The rule this exists to make impossible: a future client bug that adds
 * `{ note: item.notes }` to some event's props. That is a string, and if this
 * function only checked "is it a number, a boolean, or a member of SOME
 * enum", a free-text string would slip through as long as it happened not to
 * collide with an enum value. Exact key sets close that door — an unlisted
 * key is refused regardless of what it holds.
 */
const EVENT_SCHEMAS: Record<EventName, Record<string, Validator>> = {
  app_opened: { cold: isBool, standalone: isBool },
  wardrobe_created: { seeded: isBool },
  piece_added: { via: enumOf(ADD_ROUTES), hasPhoto: isBool, tier: enumOf(COST_TIERS) },
  wear_logged: { pieces: isNum, viaOutfit: isBool },
  outfit_created: { pieces: isNum },
  screen_viewed: { screen: enumOf(SCREENS), ms: isNum },
  intake_run: { offered: isNum, accepted: isNum, ms: isNum },
  cutout_run: { ms: isNum, kept: isBool },
  export_taken: { size: enumOf(SIZE_TIERS) },
  tutorial_step: { screen: enumOf(SCREENS), action: enumOf(TUTORIAL_ACTIONS) },
  write_refused: { size: enumOf(SIZE_TIERS) },
  error_raised: { where: enumOf(ERROR_SITES), kind: enumOf(ERROR_KINDS) },
  sync_attempted: { ok: isBool, ms: isNum, size: enumOf(SIZE_TIERS) },
  session_ended: { ms: isNum, screens: isNum },
};

/**
 * (5) ORIGIN CHECK. Mirrors ai-proxy's originAllowed exactly — same allowed
 * origins, same "no Origin header means a server, not a browser, and passes"
 * reasoning. Duplicated rather than shared for the same reason EVENT_NAMES
 * is: each edge function deploys and runs standalone.
 */
const PAGES_ORIGIN = 'https://occult-kranti.github.io';
function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  if (origin === PAGES_ORIGIN) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
}

/**
 * (6) RATE LIMIT, per install id. Held in memory, per running instance — this
 * is a courtesy limit against one misbehaving device flushing in a loop, not
 * a distributed security boundary, and it is written with that honestly in
 * mind: an alpha of fifteen to fifty testers is well inside what one edge
 * instance handles, and the limit exists to catch a bug (a retry loop with no
 * backoff), not an attacker with a botnet. A cold-started instance forgets
 * the map; that is an acceptable cost for not needing a database round trip
 * on every single request just to decide whether to allow it.
 */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 30;
const rateLog = new Map<string, number[]>();

function rateLimited(installId: string): boolean {
  const now = Date.now();
  const hits = (rateLog.get(installId) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateLog.set(installId, hits);
  // A map that only ever grows is a slow leak; sweep stale keys out
  // opportunistically rather than running a separate timer for it.
  if (rateLog.size > 2000) {
    for (const [id, times] of rateLog) {
      if (times.every(t => now - t >= RATE_WINDOW_MS)) rateLog.delete(id);
    }
  }
  return hits.length > RATE_LIMIT_PER_WINDOW;
}

/* ---------- validating a batch ---------- */

interface RawEvent {
  name?: unknown;
  at?: unknown;
  props?: unknown;
}

interface RawPayload {
  installId?: unknown;
  sentAt?: unknown;
  build?: unknown;
  events?: unknown;
}

/* `build` is a free-form string, and that looks at first glance like the
   exact hole this file exists to close — but it is not user-authored: it is
   the app's own version string (UsagePayload.build in src/lib/usage.ts, the
   contract that already shipped it), set by the app's own build tooling, not
   typed by a person. It is capped and stored as its own column rather than
   folded into `props`, so a batch's per-event property shapes stay exactly
   what EVENT_SCHEMAS says they are — no event's validated shape gains an
   extra key it did not ask for. */

interface ValidatedRow {
  install_id: string;
  name: EventName;
  at: string; // ISO, converted from the client's ms-epoch number
  props: Record<string, unknown>;
  build: string;
}

/**
 * THE TWO FREE-TEXT FIELDS, CONSTRAINED TO WHAT THE CLIENT CAN ACTUALLY MINT.
 *
 * This endpoint takes no key and originAllowed(null) passes by design, so curl
 * reaches it. Accepting 'any string up to 128 characters' as an install id and
 * 'any string' as a build meant 328 bytes of caller-chosen free text landed in
 * the one table whose whole promise is that it holds no free text — so an
 * auditor reading usage_events could not conclude from its CONTENTS that the
 * vocabulary was closed. That is a weaker guarantee than this file claims.
 *
 * Both patterns are exactly what src/lib/usage.ts can produce: a v4 uuid from
 * crypto.randomUUID(), or the old-browser fallback mintInstallId() writes when
 * randomUUID is unavailable. A refusal, not a default — every other clamp here
 * refuses, and a build string quietly rewritten to 'unknown' would hide the
 * very drift it should report.
 */
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^i-[a-z0-9]{1,16}-[a-z0-9]{1,16}$/;
function installIdLooksHonest(v: unknown): v is string {
  return typeof v === 'string' && INSTALL_ID.test(v);
}

/** A build name, not a sentence. Lowercase, short, no spaces. */
const BUILD_NAME = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/**
 * The whole of clamps 2–4 in one pass. Returns the rows to insert, or an
 * error naming exactly what was wrong and with which event — the batch is
 * accepted whole or refused whole, so the caller never has to guess which
 * half landed.
 */
function validateBatch(payload: RawPayload): { rows: ValidatedRow[] } | { error: string } {
  if (!installIdLooksHonest(payload.installId)) {
    return { error: 'installId is missing or not a plausible install id' };
  }
  if (typeof payload.build !== 'string' || !BUILD_NAME.test(payload.build)) {
    return { error: 'build is not a plausible build name' };
  }
  const build = payload.build;
  if (!Array.isArray(payload.events)) {
    return { error: 'events is missing or not an array' };
  }
  if (payload.events.length === 0) {
    return { error: 'events is empty — nothing to record' };
  }
  if (payload.events.length > MAX_EVENTS) {
    return { error: `events exceeds the cap of ${MAX_EVENTS}` };
  }

  const rows: ValidatedRow[] = [];
  for (let i = 0; i < payload.events.length; i++) {
    const raw = payload.events[i] as RawEvent;
    if (!isEventName(raw?.name)) {
      const named = typeof raw?.name === 'string' ? `"${raw.name.slice(0, 60)}"` : 'a name that is not a string';
      return { error: `event ${i} names ${named}, which is not in this service's vocabulary` };
    }
    if (typeof raw.at !== 'number' || !Number.isFinite(raw.at)) {
      return { error: `event ${i} (${raw.name}) has no valid "at" timestamp` };
    }
    if (!raw.props || typeof raw.props !== 'object' || Array.isArray(raw.props)) {
      return { error: `event ${i} (${raw.name}) has no valid "props" object` };
    }
    const schema = EVENT_SCHEMAS[raw.name];
    const propsObj = raw.props as Record<string, unknown>;
    const gotKeys = Object.keys(propsObj).sort();
    const wantKeys = Object.keys(schema).sort();
    if (gotKeys.length !== wantKeys.length || gotKeys.some((k, idx) => k !== wantKeys[idx])) {
      return {
        error: `event ${i} (${raw.name}) has props {${gotKeys.join(', ')}} — expected exactly {${wantKeys.join(', ')}}`,
      };
    }
    for (const key of wantKeys) {
      if (!schema[key](propsObj[key])) {
        return { error: `event ${i} (${raw.name}).${key} failed validation — a string here must be one of this service's enum members, never free text` };
      }
    }
    rows.push({
      install_id: payload.installId as string,
      name: raw.name,
      at: new Date(raw.at).toISOString(),
      props: propsObj,
      build,
    });
  }
  return { rows };
}

/* ---------- the handler ---------- */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (!originAllowed(req.headers.get('origin'))) {
    return json(403, { error: 'this service answers the Almari app only' });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json(405, { error: 'POST or DELETE only' });
  }

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: `that batch is too large for this service — the cap is ${MAX_BODY_BYTES} bytes` });
  }
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return json(400, { error: 'the request body could not be read' });
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return json(413, { error: `that batch is too large for this service — the cap is ${MAX_BODY_BYTES} bytes` });
  }

  let parsed: RawPayload;
  try {
    parsed = bodyText ? (JSON.parse(bodyText) as RawPayload) : {};
  } catch {
    return json(400, { error: 'the request body is not valid JSON' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json(503, { error: 'usage service not configured: service credentials missing' });
  }
  const supa = createClient(url, serviceKey, { auth: { persistSession: false } });

  // DELETE — the remote half of revocation. Every row naming this install id,
  // gone, no soft-delete and no retention window: a tester who withdrew
  // consent is not owed an explanation of why a "deleted" row is still
  // sitting in a table with a flag on it.
  const isErase = req.method === 'DELETE' ||
    (req.method === 'POST' && (parsed as { action?: unknown }).action === 'erase');
  if (isErase) {
    if (!installIdLooksHonest(parsed.installId)) {
      return json(400, { error: 'installId is missing or not a plausible install id' });
    }
    if (rateLimited(parsed.installId as string)) {
      return json(429, { error: 'too many requests for this install id — wait a while and try again' });
    }
    const { error, count } = await supa
      .from('usage_events')
      .delete({ count: 'exact' })
      .eq('install_id', parsed.installId as string);
    if (error) return json(502, { error: 'the delete failed' });
    return json(200, { erased: count ?? 0 });
  }

  // POST — the ingest path. Rate-limited on the install id the batch itself
  // claims, checked before validation so a hammering client is turned away
  // cheaply, before this function spends any work parsing what it sent.
  if (installIdLooksHonest(parsed.installId) && rateLimited(parsed.installId as string)) {
    return json(429, { error: 'too many requests for this install id — wait a while and try again' });
  }

  const outcome = validateBatch(parsed);
  if ('error' in outcome) {
    // Named and refused, whole. Nothing from this batch is written — a batch
    // that is mostly honest and one event wrong is still entirely unwritten,
    // because "mostly" is not a property the vocabulary is allowed to have.
    return json(400, { error: outcome.error });
  }

  const { error } = await supa.from('usage_events').insert(outcome.rows);
  if (error) return json(502, { error: 'the batch could not be stored' });

  return json(200, { stored: outcome.rows.length });
});
