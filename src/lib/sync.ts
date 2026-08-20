import { getSupabase } from './supabase';
import { loadWardrobe, saveWardrobe } from './accounts';
import type { Account, AppState, SyncMode } from '@almari/shared/types';

/**
 * THE SYNC ADAPTER — how a wardrobe's record travels between devices.
 *
 * Everything below the first section is the browser machinery; everything in
 * the first section is a pure function, because the rules of sync are the part
 * that must be provable (scripts/test-sync.mjs) and the network is the part
 * that cannot be.
 *
 * THE SEMANTICS, STATED PLAINLY: alpha sync is LAST-WRITER-WINS, one whole
 * wardrobe at a time. There is no field-level merge. On a pull, the side with
 * the newer `updated_at` replaces the other, whole. Two devices editing the
 * same wardrobe at the same moment will see one side's work overwritten by
 * the other's — the record is a single document, and the last hand to write
 * it is the hand that is believed. That is honest, understandable, and small;
 * anything cleverer is a promise this alpha does not yet keep.
 *
 * Two rules stand above the mechanics:
 *   1. A sample wardrobe NEVER syncs. Demonstrations belong to the device.
 *   2. Signing out NEVER deletes. The local record is the original.
 */

/* ==================== pure rules (unit-tested) ==================== */

/**
 * WHAT THE `state` COLUMN HOLDS — an envelope, not a bare document.
 *
 * docs/35 records end-to-end encrypted sync as the committed trust target.
 * The column is plaintext jsonb today and this envelope does not change that
 * by one byte: `alg` is 'none' and `payload` IS the wardrobe document, in the
 * clear. What it buys is the day encryption arrives — a new `alg` value, read
 * by the same code path, instead of a migration run across every alpha
 * tester's live row while they are using it.
 *
 * toRow/fromRow are the single choke point every synced byte passes through,
 * which is why the discriminator goes here and nowhere else.
 */
export const ENVELOPE_VERSION = 1;

/** The encodings a payload may be in. 'none' is alpha; more will follow. */
export type StateAlg = 'none';

export interface StateEnvelope {
  v: number;
  alg: StateAlg;
  payload: AppState;
}

/**
 * A row as the app handles it: the envelope already opened, `state` a plain
 * wardrobe document. This is what pullAll hands the session layer, and what
 * every caller outside this file has ever seen.
 */
export interface WardrobeRow {
  id: string;
  user_id: string;
  name: string;
  state: AppState;
  updated_at: string;
}

/** A row as the table holds it — see supabase/setup.sql. */
export interface StoredRow extends Omit<WardrobeRow, 'state'> {
  state: StateEnvelope;
}

/**
 * A row as PostgREST hands it back, which may be either: rows written before
 * the envelope existed carry the wardrobe document bare, and those rows are
 * live alpha data that must keep reading.
 */
export interface IncomingRow extends Omit<WardrobeRow, 'state'> {
  state: StateEnvelope | AppState;
}

/** One push that could not be sent, kept for the next online moment. */
export interface QueuedPush {
  syncId: string;
  name: string;
  state: AppState;
  queuedAt: string;
  /**
   * Which wardrobe on THIS device the push belongs to. The sync meta is keyed
   * by the local account id and the row is keyed by syncId, so a drain that
   * only knows the syncId cannot record that it reached agreement. Optional
   * because entries queued by an earlier build are still sitting in
   * localStorage: those still send, they simply go unstamped — exactly the
   * behaviour they already had.
   */
  accountId?: string;
}

/** The account's choice, with old records defaulting to 'device'. */
export function syncModeOf(account: Pick<Account, 'sync'>): SyncMode {
  return account.sync === 'cloud' ? 'cloud' : 'device';
}

/**
 * The only two things that may sync: a wardrobe whose owner chose 'cloud',
 * that is not a sample. Samples are worked examples — shipping someone else's
 * demonstration closet to your account would be the app lying about what a
 * sample is.
 */
export function shouldSync(account: Pick<Account, 'sync' | 'isSample' | 'syncId'>): boolean {
  return syncModeOf(account) === 'cloud' && account.isSample !== true;
}

/**
 * Wardrobe state → table row. The local id stays out of it: the row's id is
 * the account's syncId (a real uuid, minted when sync was switched on), and
 * the local id means nothing off this device.
 */
export function toRow(
  account: Pick<Account, 'name' | 'syncId'> & { syncId: string },
  state: AppState,
  userId: string,
  now: string,
): StoredRow {
  return {
    id: account.syncId,
    user_id: userId,
    name: account.name,
    state: { v: ENVELOPE_VERSION, alg: 'none', payload: state },
    updated_at: now,
  };
}

/**
 * Is this jsonb an envelope, or a wardrobe document written before envelopes?
 * Told apart by the two keys the envelope has and AppState does not — see
 * src/types.ts, where the wardrobe document is items/outfits/wearLog/wishlist
 * /settings and never `alg` or `payload`.
 */
function isEnvelope(state: StateEnvelope | AppState): state is StateEnvelope {
  const candidate = state as Partial<StateEnvelope>;
  return typeof candidate?.alg === 'string' && candidate.payload !== undefined;
}

/**
 * Open an envelope, or read a legacy bare row as what it is: an alg 'none'
 * payload with the wrapper left off.
 *
 * An `alg` this build does not know returns null, and the callers treat null
 * as "no news". Refusing is the point — when encryption lands, a client that
 * has not been updated must say nothing rather than write ciphertext into
 * someone's wardrobe as though it were pieces.
 */
export function openState(state: StateEnvelope | AppState): AppState | null {
  if (!isEnvelope(state)) return state;
  return state.alg === 'none' ? state.payload : null;
}

/** Table row → the state a wardrobe store can hold. Null when unreadable. */
export function fromRow(row: IncomingRow): { name: string; state: AppState | null; updatedAt: string } {
  return { name: row.name, state: openState(row.state), updatedAt: row.updated_at };
}

/** The whole row, envelope opened, or null when this build cannot read it. */
export function openRow(row: IncomingRow): WardrobeRow | null {
  const state = openState(row.state);
  if (!state) return null;
  return { id: row.id, user_id: row.user_id, name: row.name, state, updated_at: row.updated_at };
}

/**
 * The conflict rule, entire. `lastSyncedAt` is when this device last pushed
 * or adopted the row; a remote row newer than that carries news. Equal is NOT
 * newer — equal is the same write seen twice, and adopting it would echo.
 *
 * Compared as INSTANTS, not as text, because the two writers of this column
 * render time differently. The browser writes toISOString: three fractional
 * digits and a 'Z'. PostgREST renders a timestamptz: up to six fractional
 * digits with the trailing zeros trimmed, and a '+00:00' offset. A `>`
 * between those two strings compares glyphs, and in ASCII 'Z' sorts above
 * every digit and '.' sorts above '+' — so one instant, written by the two
 * sides, can read as two.
 *
 * How bad it actually was, stated honestly rather than dramatically: across
 * 202,500 realistic pairs of those renderings, the string compare never once
 * MISSED news — nothing was ever lost by it. Every disagreement ran the other
 * way: the same instant in two renderings judged "newer", which would adopt
 * an echo of this device's own write. It was a latent correctness defect, not
 * a wardrobe eater. It is fixed anyway, because "equal is not newer" is the
 * entire conflict policy, and a policy that holds only while both writers
 * happen to render time the same way is not a policy.
 */
export function remoteIsNewer(remoteUpdatedAt: string, lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const last = Date.parse(lastSyncedAt);
  // A stamp this device cannot read is no agreement at all — fall back to the
  // no-stamp rule and let the account's copy in.
  if (Number.isNaN(last)) return true;
  const remote = Date.parse(remoteUpdatedAt);
  // The one case where doing nothing is right. The local record is the
  // original; it is not replaced on the strength of a clock we cannot read.
  if (Number.isNaN(remote)) return false;
  return remote > last;
}

/**
 * Add a push to the offline queue. One entry per wardrobe: a second push of
 * the same wardrobe REPLACES the first in place — the queue's job is to carry
 * the newest state, and sending two stale copies in a row would let the older
 * one win for a moment between them. Order of first appearance is kept, so a
 * drain sends wardrobes in the order they were first dirtied.
 */
export function enqueuePush(queue: QueuedPush[], push: QueuedPush): QueuedPush[] {
  const at = queue.findIndex(q => q.syncId === push.syncId);
  if (at < 0) return [...queue, push];
  const next = queue.slice();
  next[at] = push;
  return next;
}

/**
 * Drain the queue, in order, through `send`. A failure stops the drain: the
 * failed push and everything after it stay queued, in order, for next time —
 * when the network is down, every send after the first failure fails the same
 * way, and reordering someone's closets to no end is not a thing this does.
 */
export async function drainQueue(
  queue: QueuedPush[],
  send: (push: QueuedPush) => Promise<void>,
): Promise<{ sent: string[]; remaining: QueuedPush[] }> {
  const sent: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    try {
      await send(queue[i]);
      sent.push(queue[i].syncId);
    } catch {
      return { sent, remaining: queue.slice(i) };
    }
  }
  return { sent, remaining: [] };
}

/**
 * The account record a remote row becomes on a device that has never seen the
 * wardrobe: the row's name, sync switched on, the syncId pointing back at the
 * row. Ids, monograms and colours are the caller's — the session layer owns
 * how a new wardrobe is introduced on this device.
 */
export function accountFromRow(
  row: Pick<WardrobeRow, 'id' | 'name'>,
  identity: Pick<Account, 'id' | 'handle' | 'monogram' | 'color' | 'createdAt'>,
): Account {
  return { ...identity, name: row.name, sync: 'cloud', syncId: row.id };
}

/* ==================== device bookkeeping ==================== */

/**
 * When each wardrobe last reached agreement with the account — the stamp
 * remoteIsNewer compares against. Kept out of the Account record itself so
 * that a push does not rewrite the accounts registry (which every open screen
 * re-reads) on every keystroke's debounce.
 */
const META_KEY = 'toile-sync-meta';
/** Pushes that could not be sent, in order. */
const QUEUE_KEY = 'toile-sync-queue';

function readMeta(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(META_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function lastSyncedAt(accountId: string): string | null {
  return readMeta()[accountId] ?? null;
}

export function stampSynced(accountId: string, at: string): void {
  try {
    const meta = readMeta();
    meta[accountId] = at;
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage disabled — the next pull simply adopts again */
  }
}

export function forgetSyncMeta(accountId: string): void {
  try {
    const meta = readMeta();
    delete meta[accountId];
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage disabled */
  }
}

function readQueue(): QueuedPush[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as QueuedPush[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedPush[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* storage disabled — the push is lost with the session, said nowhere */
  }
}

/* ==================== the wire ==================== */

/**
 * The event the session layer emits after it has written a pulled state into a
 * wardrobe's store. The open wardrobe's provider listens and adopts the new
 * state — a same-tab localStorage write fires no `storage` event, so without
 * this the pulled record would sit on disk behind a stale screen until the
 * next reload.
 */
export const SYNC_ADOPTED_EVENT = 'almari:sync-adopted';

export function announceAdopted(accountId: string): void {
  window.dispatchEvent(new CustomEvent(SYNC_ADOPTED_EVENT, { detail: { accountId } }));
}

/**
 * Park a push for later, without attempting the network. Used when the network
 * has just failed, and when the page is being hidden — a fetch started during
 * pagehide may die silently, while a localStorage write survives.
 */
export function queuePush(account: Account, state: AppState, queuedAt = new Date().toISOString()): void {
  if (!shouldSync(account) || !account.syncId) return;
  writeQueue(enqueuePush(readQueue(), {
    syncId: account.syncId,
    name: account.name,
    state,
    queuedAt,
    accountId: account.id,
  }));
}

/**
 * The stamp the meta map records: the one the DATABASE put on the row, never
 * the one this device merely proposed.
 *
 * supabase/setup.sql keeps a BEFORE UPDATE trigger that overwrites updated_at
 * with now() — deliberately, so that no writer can forget the clock the
 * conflict rule is judged by. The consequence is that a client which files
 * away its own `now` has filed away a time the row does not carry, and every
 * later comparison is between two different clocks. Reading the stamp back
 * off the returned row is what makes the two agree by construction, rather
 * than by both sides being careful.
 *
 * The proposed time is only the fallback for a response that hands back
 * nothing — a stale stamp still errs toward adopting the remote row, which is
 * the safe direction: the account's copy is at worst a redundant echo, while
 * a stamp from the future would hide real news.
 */
function stampFrom(returned: { updated_at?: unknown } | null, proposed: string): string {
  const at = returned?.updated_at;
  return typeof at === 'string' && at !== '' ? at : proposed;
}

/**
 * Push one wardrobe's whole state to its row. `updated_at` is proposed here
 * and confirmed by the row that comes back, so the device's clock and the
 * row's clock are the same statement. Offline or refused: the push joins the
 * queue and the next online moment sends it. Never throws — sync must never
 * be the reason the app breaks.
 */
export async function pushNow(
  account: Account,
  state: AppState,
  userId: string,
): Promise<'sent' | 'queued'> {
  if (!shouldSync(account) || !account.syncId) return 'sent';
  const now = new Date().toISOString();
  const row = toRow({ name: account.name, syncId: account.syncId }, state, userId, now);
  try {
    const { data, error } = await getSupabase()
      .from('wardrobes')
      .upsert(row)
      .select('updated_at')
      .single();
    if (error) throw error;
    stampSynced(account.id, stampFrom(data, now));
    return 'sent';
  } catch {
    queuePush(account, state, now);
    return 'queued';
  }
}

/**
 * Send whatever the offline queue is holding, oldest dirt first. Called on
 * sign-in and on the browser's `online` event.
 */
export async function flushQueue(userId: string): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;
  const { remaining } = await drainQueue(queue, async push => {
    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
      .from('wardrobes')
      .upsert(toRow({ name: push.name, syncId: push.syncId }, push.state, userId, now))
      .select('updated_at')
      .single();
    if (error) throw error;
    // A drained push is a wardrobe reaching agreement with the account, and
    // it must be recorded as one. Left unstamped — as it was — lastSyncedAt
    // stays at whatever the last successful push wrote, stale by the whole
    // offline stretch, and the next pull judges the row it just sent against
    // a time from before it went offline.
    if (push.accountId) stampSynced(push.accountId, stampFrom(data, now));
  });
  writeQueue(remaining);
}

/**
 * Pull one wardrobe's row; if it is newer than what this device last agreed
 * with, write it into the local store. Returns what happened. Never throws.
 *
 * The write is to the STORE, not to any open screen: if this wardrobe is the
 * one open, the caller announces it (announceAdopted) and the provider adopts.
 */
export async function pullAccount(account: Account): Promise<'adopted' | 'current' | 'none'> {
  if (!shouldSync(account) || !account.syncId) return 'none';
  try {
    const { data, error } = await getSupabase()
      .from('wardrobes')
      .select('id,user_id,name,state,updated_at')
      .eq('id', account.syncId)
      .maybeSingle();
    if (error || !data) return 'none';
    // An envelope this build cannot open is not news and not an error: the
    // row belongs to a newer Almari, and saying nothing leaves the local
    // record — the original — exactly where it is.
    const row = openRow(data as IncomingRow);
    if (!row) return 'none';
    if (!remoteIsNewer(row.updated_at, lastSyncedAt(account.id))) return 'current';
    saveWardrobe(account.id, row.state);
    stampSynced(account.id, row.updated_at);
    return 'adopted';
  } catch {
    return 'none';
  }
}

/**
 * Pull EVERY row the account holds — what makes a second device possible.
 * Rows for wardrobes this device knows reconcile newer-wins; rows it has
 * never seen come back in `fresh` for the session layer to introduce as
 * wardrobes. Local wardrobes flipped back to 'device' are left alone: the
 * choice on this device outranks a stale copy on the account.
 */
export async function pullAll(
  accounts: Account[],
): Promise<{ rows: WardrobeRow[]; adoptedIds: string[]; fresh: WardrobeRow[] }> {
  const empty = { rows: [], adoptedIds: [], fresh: [] };
  try {
    const { data, error } = await getSupabase()
      .from('wardrobes')
      .select('id,user_id,name,state,updated_at');
    if (error || !data) return empty;
    // Rows whose envelope this build cannot open drop out here rather than
    // reaching the session layer: an unreadable row must not be introduced as
    // a wardrobe, because an introduced wardrobe is one a person can open.
    const rows = (data as IncomingRow[]).map(openRow).filter((r): r is WardrobeRow => r !== null);
    const adoptedIds: string[] = [];
    const fresh: WardrobeRow[] = [];
    for (const row of rows) {
      const match = accounts.find(a => a.syncId === row.id);
      if (!match) {
        fresh.push(row);
        continue;
      }
      if (syncModeOf(match) !== 'cloud') continue;
      if (!remoteIsNewer(row.updated_at, lastSyncedAt(match.id))) continue;
      saveWardrobe(match.id, row.state);
      stampSynced(match.id, row.updated_at);
      adoptedIds.push(match.id);
    }
    return { rows, adoptedIds, fresh };
  } catch {
    return empty;
  }
}

/**
 * Retiring a synced wardrobe takes its remote copy with it — "gone from this
 * browser" must not leave a duplicate of the closet standing on the account.
 * Best-effort: offline, the row stays and a later sign-in on another device
 * can still see it; the local record is already gone, which is the part that
 * was promised.
 */
export async function deleteRemote(account: Account): Promise<void> {
  if (!account.syncId) return;
  try {
    await getSupabase().from('wardrobes').delete().eq('id', account.syncId);
  } catch {
    /* offline — the remote copy outlives the local one, never the reverse */
  }
  forgetSyncMeta(account.id);
}

/** Re-read what a pull just wrote, for the open wardrobe to adopt. */
export function loadPulled(accountId: string): AppState | null {
  return (loadWardrobe(accountId) as AppState | null) ?? null;
}
