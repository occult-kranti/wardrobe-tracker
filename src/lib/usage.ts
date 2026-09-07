/**
 * THE ALPHA USAGE RECORD — the third thing that can leave this device, and the
 * first one that leaves on a schedule rather than on a press.
 *
 * PLAN.md non-negotiable #1 said "no telemetry" and meant it. It was amended by
 * owner direction on 2026-08-28 to admit this, for the alpha and only for the
 * alpha. That amendment is the whole licence for this file, and everything
 * below is written so the amendment stays true to the letter.
 *
 * THE FOUR RULES. Each one is enforced by construction and proved by
 * scripts/test-usage.mjs, which carries a red-proof: it builds a wardrobe of
 * real garment names, brands, notes and photographs, drives every path that
 * records, and asserts that not one of those strings survives into a payload.
 *
 *   1. THE VOCABULARY IS CLOSED. An event name comes from the union below,
 *      never from a variable. A property value is a number, a boolean, or a
 *      member of an enum. There is no sanitiser in this file, and there must
 *      never be one: a sanitiser is what you build when user text can reach the
 *      payload, and the point here is that it cannot. If you find yourself
 *      wanting to strip something, delete the path instead.
 *
 *   2. NOTHING IS BUFFERED BEFORE CONSENT. Not "held back from sending" —
 *      not written down at all. The difference is the whole trust argument: a
 *      tester who opens the panel and finds it already full of their morning
 *      has caught the app recording them before it asked. `record()` checks the
 *      gate on its first line and returns.
 *
 *   3. REVOCATION IS DESTRUCTION. Switching the record off empties the buffer
 *      here and asks the service to drop the rows there. A revoke that merely
 *      stops future sends would make the Settings copy false.
 *
 *   4. THE BUFFER YIELDS TO THE WARDROBE. This app already loses writes to a
 *      full device — src/hooks/useLocalStorage.ts counts refusals because quota
 *      is a real and frequent failure here. A bounded ring, dropped oldest
 *      first, and any write that throws is abandoned silently. A tester losing
 *      a wear log because the app was busy recording that they logged a wear
 *      would be the worst bug this feature could have.
 *
 * WHAT IS NEVER COLLECTED, by any route: garment names, brands, notes,
 * `fitsLike`, captions, chat text, category and occasion labels (user-authored
 * by law), colours, photographs or anything derived from one, cost VALUES (only
 * a tier bucket), wardrobe names, account names, handles, email addresses.
 */

/* ==================== the closed vocabulary ==================== */

/**
 * Every event this app may record. Adding a name here is a deliberate act and
 * must be matched in the service's own allowlist
 * (supabase/functions/usage/index.ts) — scripts/test-usage.mjs compares the two
 * lists and fails when they drift, because a name the service does not know is
 * an event silently discarded in production.
 */
export const EVENT_NAMES = [
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

export type UsageEventName = (typeof EVENT_NAMES)[number];

/**
 * The only value shapes a property may hold. `string` is absent on purpose and
 * its absence is load-bearing: TypeScript refuses `props: { name: item.name }`
 * at the call site, which is where a leak would otherwise be introduced by
 * somebody being helpful. Enumerated strings travel as their own literal types
 * through the per-event maps below.
 */
type Num = number;
type Bool = boolean;

/** The screens, as an enum. Never a pathname — a pathname carries ids. */
export const SCREENS = [
  'today', 'closet', 'outfits', 'dressing-room', 'calendar', 'events',
  'ledger', 'wishlist', 'before-you-buy', 'chats', 'profile', 'rail',
  'intake', 'settings', 'wardrobes', 'door', 'elsewhere',
] as const;
export type Screen = (typeof SCREENS)[number];

/* Each enum is declared ONCE, as a const array, and its type derived from it.
   The runtime shape check below needs the values at runtime; the compiler needs
   the union. Writing them twice is how the two drift. */

/** How a piece came to be written down. */
export const ADD_ROUTES = ['manual', 'photo', 'intake', 'sample'] as const;
export type AddRoute = (typeof ADD_ROUTES)[number];

/** A cost bucket, never an amount. */
export const COST_TIERS = ['unrecorded', 'free', 'budget', 'mid', 'investment'] as const;
export type CostTier = (typeof COST_TIERS)[number];

/**
 * A SIZE BUCKET, NEVER A BYTE COUNT — and the reason is not squeamishness.
 *
 * The exact serialised length of somebody's wardrobe document is a fingerprint.
 * It is high-entropy, it drifts as they use the app, and across a fifty-person
 * cohort it distinguishes one install from another on its own. Worse, for
 * anyone with sync switched on it JOINS: the same number is `length(state)` in
 * public.wardrobes, whose row names an account, and the owner holds the service
 * role over both tables. An install id minted specifically so it would not name
 * a person is worth nothing beside a column that does.
 *
 * Four buckets keep every question the byte count was recorded to answer — the
 * diagnosis is "a purse full of photographs, or a genuinely full disk", and
 * that is a four-way answer — while carrying no join key at all.
 */
export const SIZE_TIERS = ['under-1mb', '1-3mb', '3-5mb', 'over-5mb'] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

/** Bytes to a bucket. The one place the exact figure is allowed to be seen. */
export function sizeTierOf(bytes: number): SizeTier {
  if (!Number.isFinite(bytes) || bytes < 1_000_000) return 'under-1mb';
  if (bytes < 3_000_000) return '1-3mb';
  if (bytes < 5_000_000) return '3-5mb';
  return 'over-5mb';
}

/** Which module noticed the trouble. No stack, no message, no file path. */
export const ERROR_SITES = ['intake', 'cutout', 'sync', 'photos', 'storage', 'render', 'export'] as const;
export type ErrorSite = (typeof ERROR_SITES)[number];

/** The kind of trouble, not its text. */
export const ERROR_KINDS = ['network', 'refused', 'quota', 'parse', 'timeout', 'unknown'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const TUTORIAL_ACTIONS = ['shown', 'done', 'skipped'] as const;
export type TutorialAction = (typeof TUTORIAL_ACTIONS)[number];

/**
 * The per-event property shapes. This map is the contract: `record()` is typed
 * against it, so an event carrying a property the map does not name, or a value
 * of a type the map does not allow, does not compile.
 */
export interface EventProps {
  app_opened: { cold: Bool; standalone: Bool };
  wardrobe_created: { seeded: Bool };
  piece_added: { via: AddRoute; hasPhoto: Bool; tier: CostTier };
  wear_logged: { pieces: Num; viaOutfit: Bool };
  outfit_created: { pieces: Num };
  screen_viewed: { screen: Screen; ms: Num };
  intake_run: { offered: Num; accepted: Num; ms: Num };
  cutout_run: { ms: Num; kept: Bool };
  export_taken: { size: SizeTier };
  tutorial_step: { screen: Screen; action: TutorialAction };
  write_refused: { size: SizeTier };
  error_raised: { where: ErrorSite; kind: ErrorKind };
  /**
   * A push's outcome, its duration and its SIZE BAND.
   *
   * The band replaced an exact byte count, and this event is also the reason
   * `recordCoarse` exists: a sync writes public.wardrobes at the same instant,
   * and that row is stamped by the database and names an account. An event
   * carrying the exact millisecond of the same write is joinable to a person by
   * timing alone, whatever its own payload says. So this one is recorded with
   * its timestamp rounded to the hour.
   */
  sync_attempted: { ok: Bool; ms: Num; size: SizeTier };
  session_ended: { ms: Num; screens: Num };
}

export interface UsageEvent<N extends UsageEventName = UsageEventName> {
  name: N;
  /** ms since epoch, this device's clock. */
  at: Num;
  props: EventProps[N];
}

/* ==================== consent ==================== */

export const CONSENT_KEY = 'almari-usage-consent';
export const BUFFER_KEY = 'almari-usage';

/** The version of the ASK. Bumping it asks again, which is the honest move when
    the payload changes materially. Never bump it to nag. */
export const CONSENT_VERSION = 1;

export type ConsentState = 'unset' | 'granted' | 'declined';

export interface Consent {
  state: ConsentState;
  /** Minted at the moment consent is granted; a fresh one after a revoke, so
      the two spans cannot be stitched together. Never the account id. */
  installId: string | null;
  decidedAt: string | null;
  version: number;
}

const NO_CONSENT: Consent = { state: 'unset', installId: null, decidedAt: null, version: CONSENT_VERSION };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Every write here is allowed to fail and be forgotten. The wardrobe comes first. */
function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadConsent(): Consent {
  const held = readJson<Consent>(CONSENT_KEY, NO_CONSENT);
  if (held.state !== 'granted' && held.state !== 'declined') return NO_CONSENT;
  // A stored answer to an older ask is not an answer to this one.
  if (held.version !== CONSENT_VERSION) return NO_CONSENT;
  return held;
}

export function isRecording(): boolean {
  return loadConsent().state === 'granted';
}

/** True when nobody has been asked yet — the one condition that opens the panel. */
export function shouldAsk(): boolean {
  return loadConsent().state === 'unset';
}

function mintInstallId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Old browsers and insecure origins. Good enough for a cohort of fifty; it
    // only has to tell one device from another, never to be unguessable.
    return `i-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

/**
 * Record the answer. Granting mints a fresh install id; declining and revoking
 * both erase everything held, here and — for a revoke — there.
 */
export function setConsent(granted: boolean): Consent {
  /* THE BUFFER IS EMPTIED ON BOTH ANSWERS, AND THE PLACEMENT OF THIS ONE LINE
     IS THE WHOLE OF A PROVEN BUG.

     It used to read `if (!granted) clearBuffer()`, on the reasoning that a
     grant has nothing to clear — nothing is buffered before consent, so the
     buffer must already be empty. That reasoning holds for exactly as long as
     CONSENT_VERSION never changes.

     Bump the version and it collapses. loadConsent() refuses a stored answer
     from an older ask and reports 'unset', which is right; but the BUFFER is
     not versioned, so events written under the previous grant are still
     sitting there. The panel then opens and prints "Nothing has been written
     down, because nothing is written down before you allow it" over a full
     buffer — a plain lie on the one screen whose entire job is to be honest —
     and the next grant mints a FRESH install id and sends the old events under
     it, stitching two spans that were deliberately kept apart.

     Measured, before this line moved: seven events recorded under install id A
     survived the version boundary and left under install id B. */
  clearBuffer();

  const next: Consent = granted
    ? { state: 'granted', installId: mintInstallId(), decidedAt: new Date().toISOString(), version: CONSENT_VERSION }
    : { state: 'declined', installId: null, decidedAt: new Date().toISOString(), version: CONSENT_VERSION };
  writeJson(CONSENT_KEY, next);
  return next;
}

/* ==================== the ring buffer ==================== */

/**
 * The caps. Small on purpose: this is a fifty-person alpha, the batch goes up
 * when the page is hidden, and anything larger is the app hoarding on a phone
 * whose storage it has already been told is tight.
 */
export const MAX_EVENTS = 500;
export const MAX_BYTES = 96 * 1024;

export function readBuffer(): UsageEvent[] {
  const held = readJson<unknown>(BUFFER_KEY, []);
  if (!Array.isArray(held)) return [];
  // A buffer that has been hand-edited, half-written or written by a newer
  // build is discarded rather than repaired. It is not the record; losing it
  // costs nobody anything.
  return held.filter(isWellFormed);
}

function isWellFormed(e: unknown): e is UsageEvent {
  if (!e || typeof e !== 'object') return false;
  const ev = e as Partial<UsageEvent>;
  return (
    typeof ev.name === 'string' &&
    (EVENT_NAMES as readonly string[]).includes(ev.name) &&
    typeof ev.at === 'number' &&
    !!ev.props &&
    typeof ev.props === 'object'
  );
}

export function clearBuffer(): void {
  try {
    window.localStorage.removeItem(BUFFER_KEY);
  } catch {
    /* nothing to do and nothing worth saying */
  }
}

/** Drop from the front until both caps are satisfied. */
function trim(events: UsageEvent[]): UsageEvent[] {
  let kept = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
  while (kept.length > 1 && JSON.stringify(kept).length > MAX_BYTES) {
    kept = kept.slice(1);
  }
  return kept;
}

/* ==================== recording ==================== */

/**
 * Write one event down, if and only if this device is recording.
 *
 * The `props` argument is typed by the event name through EventProps, so the
 * compiler is the thing that stops a garment name reaching a payload. That is
 * deliberate: a rule enforced by review is a rule that survives until the first
 * hurried afternoon.
 */
/**
 * THE PROPERTY SHAPES, AT RUNTIME.
 *
 * The type signature below is the first guard and the better one, but it is not
 * sufficient on its own — see the long note on `Exact` — so the shapes are
 * stated again here in a form the running code can check.
 *
 * THIS IS A REFUSAL, NOT A SANITISER. The file header forbids a sanitiser and
 * is right to: a sanitiser is a thing you build when user text can reach the
 * payload and you intend to cope with it. This does the opposite — an event
 * whose keys are not EXACTLY the schema's keys, or whose values are not of the
 * declared kind, is DROPPED WHOLE. Nothing is stripped and kept. That is the
 * same discipline the service already keeps on its side, and the reason both
 * sides do it is that a stripped-and-kept row means a leak arrived, was quietly
 * edited, and nobody ever learned the client was wrong.
 *
 * Do not delete this on rule 1's authority. Rule 1 forbids repairing an event;
 * this refuses one.
 */
const EVENT_SHAPES: { [N in UsageEventName]: Record<string, 'number' | 'boolean' | readonly string[]> } = {
  app_opened: { cold: 'boolean', standalone: 'boolean' },
  wardrobe_created: { seeded: 'boolean' },
  piece_added: { via: ADD_ROUTES, hasPhoto: 'boolean', tier: COST_TIERS },
  wear_logged: { pieces: 'number', viaOutfit: 'boolean' },
  outfit_created: { pieces: 'number' },
  screen_viewed: { screen: SCREENS, ms: 'number' },
  intake_run: { offered: 'number', accepted: 'number', ms: 'number' },
  cutout_run: { ms: 'number', kept: 'boolean' },
  export_taken: { size: SIZE_TIERS },
  tutorial_step: { screen: SCREENS, action: TUTORIAL_ACTIONS },
  write_refused: { size: SIZE_TIERS },
  error_raised: { where: ERROR_SITES, kind: ERROR_KINDS },
  sync_attempted: { ok: 'boolean', ms: 'number', size: SIZE_TIERS },
  session_ended: { ms: 'number', screens: 'number' },
};

/** Exactly the schema's keys, each of the declared kind. Nothing else passes. */
function shapeHolds(name: UsageEventName, props: unknown): boolean {
  const schema = EVENT_SHAPES[name];
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false;
  const given = Object.keys(props as Record<string, unknown>);
  const wanted = Object.keys(schema);
  if (given.length !== wanted.length) return false;
  for (const key of wanted) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) return false;
    const value = (props as Record<string, unknown>)[key];
    const kind = schema[key];
    if (kind === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    } else if (kind === 'boolean') {
      if (typeof value !== 'boolean') return false;
    } else if (!(typeof value === 'string' && (kind as readonly string[]).includes(value))) {
      return false;
    }
  }
  return true;
}

/**
 * Exactly the declared shape — no extra properties, even through a variable.
 *
 * TypeScript's excess-property check fires only on a FRESH OBJECT LITERAL.
 * `record('screen_viewed', { screen, ms, note: item.notes })` is refused, which
 * is what the header claimed the type system guaranteed; but hoist that object
 * into a const first, or build it with a spread, and the identical leak
 * compiles clean under --strict. That is not an exotic cast — it is the
 * ordinary refactor of extracting props to reuse across two branches, and it
 * was reachable with no `as`, no `any` and nothing that would catch a reviewer's
 * eye. Mapping the excess keys to `never` closes it for every form.
 */
type Exact<P, S> = P & { [K in Exclude<keyof P, keyof S>]: never };

export function record<N extends UsageEventName, P extends EventProps[N]>(
  name: N,
  props: Exact<P, EventProps[N]>,
): void {
  if (!isRecording()) return;
  // The runtime half. A call site that defeated the types — or a future one
  // compiled against an older copy of this contract — is dropped here rather
  // than written down, and dropped WHOLE.
  if (!shapeHolds(name, props)) return;
  const event: UsageEvent<N> = { name, at: stampFor(name), props: props as EventProps[N] };
  const next = trim([...readBuffer(), event as UsageEvent]);
  // A refused write is dropped without complaint. The alternative — surfacing
  // it — would spend the person's attention on our bookkeeping.
  writeJson(BUFFER_KEY, next);
}

/**
 * Events whose exact moment is itself an identifier, and so is coarsened.
 *
 * A sync writes public.wardrobes in the same instant, and that row carries a
 * database-stamped `updated_at` beside a `user_id` that names an account. Two
 * tables, both readable by the owner's service role, joinable on a sub-second
 * timestamp — which defeats the whole purpose of minting an install id rather
 * than reusing the account id, without the event's own payload containing
 * anything at all.
 *
 * Rounding to the hour breaks the join while leaving every question this event
 * is asked — did pushes succeed, how long did they take, how big were they —
 * completely intact, because none of those is answered at second resolution.
 *
 * The asymmetry is deliberate and is stated here rather than discovered: most
 * events keep their real millisecond, and these do not.
 */
const COARSE_EVENTS: ReadonlySet<string> = new Set<UsageEventName>(['sync_attempted']);
const HOUR = 3_600_000;

function stampFor(name: UsageEventName): number {
  const now = Date.now();
  return COARSE_EVENTS.has(name) ? Math.floor(now / HOUR) * HOUR : now;
}

/* ==================== what would be sent ==================== */

export interface UsagePayload {
  installId: string;
  sentAt: string;
  /** The build this came from, so a report can be tied to a version. */
  build: string;
  events: UsageEvent[];
}

/**
 * Exactly what a send would carry, right now, from this device.
 *
 * The consent panel and the Settings viewer both render THIS — not a sample,
 * not a description of it. Showing the real thing is the only version of this
 * screen that is worth anything, and it costs one function.
 */
export function pendingPayload(build: string): UsagePayload | null {
  const consent = loadConsent();
  if (consent.state !== 'granted' || !consent.installId) return null;
  return {
    installId: consent.installId,
    sentAt: new Date().toISOString(),
    build,
    events: readBuffer(),
  };
}

/* ==================== sending ====================
 *
 * Everything below this line is the one place this file is allowed to touch
 * the network. `record()` and the ring buffer above never do — a person who
 * declines, or who has not yet been asked, cannot cause a byte to leave the
 * device, because nothing below runs unless `isRecording()` says granted.
 */

/**
 * The usage service — same Supabase project as the AI relay (ai-proxy) and
 * the alpha stats function (admin-stats): see RELAY_ENDPOINT in
 * src/lib/anthropic.ts and ADMIN_STATS_ENDPOINT in src/lib/admin.ts for the
 * sibling addresses. supabase/functions/usage/index.ts is what answers here.
 */
export const USAGE_ENDPOINT = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/usage';

/**
 * Deep-equal an event by its serialised shape. Events carry no id — adding
 * one would be a field with no purpose except bookkeeping we can do without —
 * so "the same event" is decided the same way `readBuffer`'s well-formed
 * check already treats a stored event: by what it actually says.
 */
function eventKey(e: UsageEvent): string {
  return JSON.stringify(e);
}

/**
 * Remove exactly the events a successful send carried, and nothing else.
 *
 * The buffer keeps moving while a request is in flight: `record()` can append
 * new events during the round trip, and `trim()` can drop old ones off the
 * front if a cap is hit in the meantime. Both of those only ever touch this
 * ring from ONE end each — record() appends at the back, trim() drops from
 * the front — so whatever is left of `sent` in the current buffer can only be
 * a contiguous run at the very front of it, with anything newer sitting after
 * that run untouched. Naively clearing the whole buffer after a send would
 * throw away events recorded during the request; naively slicing off the
 * first `sent.length` entries would be wrong the moment even one of them was
 * trimmed away while we waited. So: find the longest run at the front of the
 * current buffer that reads as a suffix of `sent` (allowing for the front of
 * `sent` having been dropped already) and drop only that.
 */
function subtractSent(current: UsageEvent[], sent: UsageEvent[]): UsageEvent[] {
  if (sent.length === 0 || current.length === 0) return current;
  const currentKeys = current.map(eventKey);
  const sentKeys = sent.map(eventKey);
  const cap = Math.min(currentKeys.length, sentKeys.length);
  for (let k = cap; k > 0; k--) {
    const head = currentKeys.slice(0, k);
    const tail = sentKeys.slice(sentKeys.length - k);
    if (head.every((v, i) => v === tail[i])) return current.slice(k);
  }
  return current;
}

/**
 * Send whatever is waiting, and — only on a confirmed success — clear exactly
 * that much of the buffer.
 *
 * Returns 'nothing' when this device is not recording or the buffer is empty
 * (there is nothing to say, and asking would be a request for its own sake);
 * 'failed' for any network trouble or a non-2xx answer, with the buffer left
 * untouched so the next attempt — the next hidden tab, the next slow-interval
 * tick — tries again; 'sent' once the service has accepted the batch. This
 * function never throws: a flush is a background chore, never a user-facing
 * action, and a thrown error here would have nowhere honest to land.
 */
export async function flushUsage(build: string): Promise<'sent' | 'nothing' | 'failed'> {
  const consent = loadConsent();
  if (consent.state !== 'granted' || !consent.installId) return 'nothing';
  const sent = readBuffer();
  if (sent.length === 0) return 'nothing';

  const payload: UsagePayload = {
    installId: consent.installId,
    sentAt: new Date().toISOString(),
    build,
    events: sent,
  };

  let res: Response;
  try {
    res = await fetch(USAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return 'failed';
  }
  if (!res.ok) return 'failed';

  /* THE CONSENT IS RE-READ AFTER THE AWAIT, AND A REVOKE THAT RACED US WINS.
     ------------------------------------------------------------------------
     A flush is not instant, and the one thing a person is most likely to do
     during it is exactly the thing that must not lose: switch the record off.
     The sequence, measured:

       t0  flushUsage POSTs 5 events for install id A
       t1  the tester presses the switch; eraseUsage DELETEs id A — and the
           service has nothing yet, so it removes 0 rows
       t2  our POST lands and inserts those 5 rows
       t3  setConsent(false) nulls the install id

     Every step reports success. Settings says "Off. What was gathered is
     deleted, here and there." Five rows remain, named by an id no screen can
     ever produce again, so nothing in the product can find them to remove.

     So: after the await, look again. If consent is no longer granted, or the
     id has been re-minted under us, the write-back is skipped (there is no
     buffer of ours to preserve — the revoke already emptied it, and restoring
     a subtraction of it would resurrect events the tester just erased) and the
     DELETE is re-issued for the id WE captured, which is the id our rows
     actually landed under. */
  const after = loadConsent();
  if (after.state !== 'granted' || after.installId !== consent.installId) {
    void fetch(USAGE_ENDPOINT, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installId: consent.installId }),
    }).catch(() => { /* the tester is already told the remote half may fail */ });
    return 'sent';
  }

  writeJson(BUFFER_KEY, subtractSent(readBuffer(), sent));
  return 'sent';
}

/**
 * Revocation's remote half. The local half — emptying the buffer — happens
 * unconditionally here, even when the network call below fails, because a
 * refused DELETE must never leave a full buffer sitting on the device with
 * consent already withdrawn (that would be exactly the "held back from
 * sending, not erased" failure Rule 3 forbids). The return value tells
 * Settings the truth about the OTHER half — whether the service was actually
 * asked to drop this install's rows — so the copy there can say so honestly
 * rather than promising a deletion that may not have landed.
 *
 * CALL ORDER MATTERS: this reads the install id off the CURRENT consent, so
 * it must run before `setConsent(false)` mints a fresh one away — that
 * function already nulls the id as part of answering "declined". A revoke
 * flow in Settings should call `eraseUsage()` first and `setConsent(false)`
 * second; calling it after finds no id left to erase and — correctly, since
 * there is then nothing outstanding under this device's old name — reports
 * 'erased' having done only the local half.
 */
export async function eraseUsage(): Promise<'erased' | 'failed'> {
  const installId = loadConsent().installId;
  clearBuffer();
  if (!installId) return 'erased';
  try {
    const res = await fetch(USAGE_ENDPOINT, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installId }),
    });
    return res.ok ? 'erased' : 'failed';
  } catch {
    return 'failed';
  }
}

/** How often the fallback timer tries a flush. Slow on purpose — the real
    trigger is the page going hidden; this is only the safety net for a tab
    that is never hidden and never closed, which does happen (a pinned tab
    left open across a session). */
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Flush when the page is hidden, plus a slow interval as a fallback.
 *
 * Modelled on src/hooks/useLocalStorage.ts's own flush-on-hide handling,
 * which exists because it solved this exact problem for the wardrobe's own
 * writes: `visibilitychange` fires reliably (including on iOS Safari, where
 * `beforeunload` does not) at the moment a person switches apps or closes the
 * tab, which is the only reliable "last chance" a page gets. Sending on every
 * single `record()` instead would mean a network request racing every wear
 * log — precisely the kind of competition with the wardrobe Rule 4 exists to
 * rule out — so this batches instead, on the app's own time.
 *
 * Returns the detach function so a caller (Settings, or a top-level effect)
 * can stop the schedule cleanly, symmetrical with how the hook it is modelled
 * on returns its own cleanup from a `useEffect`.
 */
export function scheduleFlush(build: string): () => void {
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flushUsage(build);
  };
  document.addEventListener('visibilitychange', onHide);
  const interval = window.setInterval(() => void flushUsage(build), FLUSH_INTERVAL_MS);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.clearInterval(interval);
  };
}
