import { getSupabase } from './supabase';
import { loadWardrobe, saveWardrobe } from './accounts';
import type { Account, AppState, SyncMode } from '../types';

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

/** The shape of one row in public.wardrobes — see supabase/setup.sql. */
export interface WardrobeRow {
  id: string;
  user_id: string;
  name: string;
  state: AppState;
  updated_at: string;
}

/** One push that could not be sent, kept for the next online moment. */
export interface QueuedPush {
  syncId: string;
  name: string;
  state: AppState;
  queuedAt: string;
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
): WardrobeRow {
  return { id: account.syncId, user_id: userId, name: account.name, state, updated_at: now };
}

/** Table row → the state a wardrobe store can hold. */
export function fromRow(row: WardrobeRow): { name: string; state: AppState; updatedAt: string } {
  return { name: row.name, state: row.state, updatedAt: row.updated_at };
}

/**
 * The conflict rule, entire. `lastSyncedAt` is when this device last pushed
 * or adopted the row; a remote row newer than that carries news. Equal is NOT
 * newer — equal is the same write seen twice, and adopting it would echo.
 */
export function remoteIsNewer(remoteUpdatedAt: string, lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  return remoteUpdatedAt > lastSyncedAt;
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
  row: WardrobeRow,
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
  }));
}

/**
 * Push one wardrobe's whole state to its row. `updated_at` is stamped now,
 * here, so the device's clock and the row's clock are the same statement.
 * Offline or refused: the push joins the queue and the next online moment
 * sends it. Never throws — sync must never be the reason the app breaks.
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
    const { error } = await getSupabase().from('wardrobes').upsert(row);
    if (error) throw error;
    stampSynced(account.id, now);
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
    const { error } = await getSupabase()
      .from('wardrobes')
      .upsert({ id: push.syncId, user_id: userId, name: push.name, state: push.state, updated_at: now });
    if (error) throw error;
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
    const row = data as WardrobeRow;
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
    const rows = data as WardrobeRow[];
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
