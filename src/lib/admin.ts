import {
  ACCOUNTS_KEY,
  COMMUNITY_KEY,
  LEGACY_KEY,
  SESSION_KEY,
  THEME_KEY,
  loadAccounts,
  loadActiveId,
  loadCommunity,
  loadWardrobe,
  saveAccounts,
  saveActiveId,
  saveWardrobe,
  wardrobeKey,
} from './accounts';
import { lastSyncedAt, syncModeOf, type QueuedPush } from './sync';
import { getPhoto, isPhotoRef, photoIds, photoRef, removePhoto } from './photoStore';
import { migrate } from '@almari/shared/migrate';
import { PERSONAS } from './personaWardrobe';
import {
  categoryLabel,
  type Account,
  type AppState,
  type SyncMode,
} from '@almari/shared/types';

/**
 * THE PROJECT LEAD'S LEDGER — storage surgery and alpha monitoring.
 *
 * The surgery half reads and writes this browser's localStorage directly,
 * and nothing else. The session layer's own removal path (SessionContext
 * .removeAccount) also asks the account to delete its remote copy, which is
 * the right behaviour for a person retiring a wardrobe and the wrong one for
 * a project lead tidying a test device — so the surgery functions do their
 * own work and never call anything that can reach a wardrobe's remote copy.
 *
 * The monitoring half — the services board and the alpha board, at the end
 * of this file — does reach the network, deliberately and read-only: it
 * probes the AI relay and asks the stats service what the alpha holds.
 * Neither call carries anything from any closet.
 *
 * After surgery the rest of the app is told through the same `storage` events
 * it already listens to for other tabs. A same-tab write fires no such event
 * on its own, so one is dispatched by hand — the session re-reads the
 * registry, and an open wardrobe re-reads its store, exactly as if a second
 * tab had done the work.
 */

/* Keys that exist but are not exported from their home modules. Re-declared
   here rather than added to those modules' surfaces: the portal is their only
   other reader, and a wider surface invites a wider use. */
const OPENED_KEY = 'toile-opened';
const SYNC_META_KEY = 'toile-sync-meta';
const SYNC_QUEUE_KEY = 'toile-sync-queue';

/** The portal's own record of what it has done, newest first. */
export const ADMIN_LOG_KEY = 'toile-admin-log';

/** The rough purse every browser gives one origin. The bar is honest, not exact. */
export const BUDGET_BYTES = 5 * 1024 * 1024;

/* ---------- small safe IO ---------- */

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled — the portal reports counts from what it could read */
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage disabled */
  }
}

/** Approximate bytes a key costs: UTF-16 storage, two bytes per character. */
function bytesOf(key: string): number {
  const raw = readRaw(key);
  return (key.length + (raw?.length ?? 0)) * 2;
}

/** About how full the purse is, across every key this origin holds. */
export function totalStorageBytes(): number {
  try {
    let total = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) total += bytesOf(key);
    }
    return total;
  } catch {
    return 0;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/* ---------- the ledger ---------- */

export interface AccountLedger {
  account: Account;
  /** False when the registry names a wardrobe whose store is missing. */
  present: boolean;
  pieces: number;
  retiredPieces: number;
  outfits: number;
  /** Every image reference on record — pieces, outfits and the wishlist. */
  images: number;
  dataImages: number;
  refImages: number;
  /** Photographs held in this device's store, named from the record by `idb:`.
   *  These cost the localStorage purse forty characters and cost the DISK the
   *  whole picture, which is why `bytes` below is no longer the whole story. */
  storeImages: number;
  bytes: number;
  syncMode: SyncMode;
  lastSynced: string | null;
  /** A push for this wardrobe is parked in the offline queue. */
  queued: boolean;
  lastOpened: string | null;
}

export interface DeviceLedger {
  accounts: AccountLedger[];
  ownCount: number;
  sampleCount: number;
  totalPieces: number;
  totalOutfits: number;
  totalImages: number;
  totalBytes: number;
  activeId: string | null;
}

function readState(accountId: string): AppState | null {
  const raw = loadWardrobe(accountId);
  if (raw === null) return null;
  return migrate(raw);
}

function imageKind(url: string | undefined): 'data' | 'store' | 'ref' | null {
  if (!url) return null;
  // The order matters: a reference into the photograph store is neither a
  // picture on the record nor an address off the device, and counting it as
  // either is how an audit starts under-reporting what a wardrobe weighs.
  if (isPhotoRef(url)) return 'store';
  return url.startsWith('data:') ? 'data' : 'ref';
}

function countImages(state: AppState): { images: number; dataImages: number; refImages: number; storeImages: number } {
  let dataImages = 0;
  let refImages = 0;
  let storeImages = 0;
  const urls = [
    ...state.items.map(i => i.imageUrl),
    ...state.outfits.map(o => o.imageUrl),
    ...state.wishlist.map(w => w.imageUrl),
  ];
  for (const url of urls) {
    const kind = imageKind(url);
    if (kind === 'data') dataImages += 1;
    if (kind === 'ref') refImages += 1;
    if (kind === 'store') storeImages += 1;
  }
  return { images: dataImages + refImages + storeImages, dataImages, refImages, storeImages };
}

function queuedSyncIds(): Set<string> {
  const queue = readJson<QueuedPush[]>(SYNC_QUEUE_KEY, []);
  return new Set(Array.isArray(queue) ? queue.map(q => q.syncId) : []);
}

/** What is on this device, read fresh from storage on every call. */
export function readLedger(): DeviceLedger {
  const accounts = loadAccounts();
  const opened = readJson<Record<string, string>>(OPENED_KEY, {});
  const queued = queuedSyncIds();
  const ledgers: AccountLedger[] = accounts.map(account => {
    const state = readState(account.id);
    const counts = state
      ? countImages(state)
      : { images: 0, dataImages: 0, refImages: 0, storeImages: 0 };
    return {
      account,
      present: state !== null,
      pieces: state?.items.length ?? 0,
      retiredPieces: state?.items.filter(i => i.retired).length ?? 0,
      outfits: state?.outfits.length ?? 0,
      ...counts,
      bytes: bytesOf(wardrobeKey(account.id)),
      syncMode: syncModeOf(account),
      lastSynced: lastSyncedAt(account.id),
      queued: account.syncId ? queued.has(account.syncId) : false,
      lastOpened: opened[account.id] ?? null,
    };
  });
  return {
    accounts: ledgers,
    ownCount: ledgers.filter(l => !l.account.isSample).length,
    sampleCount: ledgers.filter(l => l.account.isSample).length,
    totalPieces: ledgers.reduce((n, l) => n + l.pieces, 0),
    totalOutfits: ledgers.reduce((n, l) => n + l.outfits, 0),
    totalImages: ledgers.reduce((n, l) => n + l.images, 0),
    totalBytes: totalStorageBytes(),
    activeId: loadActiveId(),
  };
}

/* ---------- telling the rest of the app ---------- */

/**
 * Dispatch the `storage` events the session and wardrobe layers already
 * listen for, after this module has written. `newValue` is read back from
 * storage, so a removed key announces itself as null and its listeners fall
 * back to their defaults.
 */
export function announceStorage(keys: string[]): void {
  for (const key of keys) {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: readRaw(key) }));
  }
}

/* ---------- content surgery ---------- */

export interface PieceRow {
  id: string;
  name: string;
  categoryLabel: string;
  hasImage: boolean;
  retired: boolean;
}

/** One closet's pieces, for the content browser. */
export function listPieces(accountId: string): PieceRow[] {
  const state = readState(accountId);
  if (!state) return [];
  return state.items.map(item => ({
    id: item.id,
    name: item.name,
    categoryLabel: categoryLabel(state.settings, item.category),
    hasImage: item.imageUrl.length > 0,
    retired: !!item.retired,
  }));
}

/** Clear only the photograph. Returns the piece's name, or null when absent. */
export function removePieceImage(accountId: string, itemId: string): string | null {
  const state = readState(accountId);
  const item = state?.items.find(i => i.id === itemId);
  if (!state || !item || !item.imageUrl) return null;
  // Clearing the record is only half of it. When the record held a REFERENCE,
  // the picture itself is in this device's IndexedDB, and a strip tool that
  // left it there would report a photograph removed while the bytes stayed on
  // the disk. Fire-and-forget: this function's callers are synchronous, and
  // removePhoto never throws and never blocks the surgery.
  void removePhoto(item.imageUrl);
  item.imageUrl = '';
  saveWardrobe(accountId, state);
  return item.name;
}

/**
 * Remove one piece and every trace of it — the same contract the app's own
 * deleteItem keeps: out of the outfits, out of the wear logs (a log left
 * naming nothing is dropped), and off the open-to-borrow list.
 */
export function removePiece(accountId: string, itemId: string): string | null {
  const state = readState(accountId);
  const item = state?.items.find(i => i.id === itemId);
  if (!state || !item) return null;
  state.items = state.items.filter(i => i.id !== itemId);
  state.outfits = state.outfits.map(o => ({ ...o, itemIds: o.itemIds.filter(id => id !== itemId) }));
  state.wearLogs = state.wearLogs
    .map(l => ({ ...l, itemIds: l.itemIds.filter(id => id !== itemId) }))
    .filter(l => l.itemIds.length > 0 || l.outfitId);
  state.circle = {
    ...state.circle,
    profiles: state.circle.profiles.map(p =>
      p.isMe ? { ...p, lendable: p.lendable.filter(l => l.itemId !== itemId) } : p
    ),
  };
  saveWardrobe(accountId, state);
  return item.name;
}

/** Every piece out of one closet, under the same trace-removal contract. */
export function clearCloset(accountId: string): number {
  const state = readState(accountId);
  if (!state || state.items.length === 0) return 0;
  const count = state.items.length;
  state.items = [];
  state.outfits = state.outfits.map(o => ({ ...o, itemIds: [] }));
  state.wearLogs = state.wearLogs.filter(l => !!l.outfitId);
  state.circle = {
    ...state.circle,
    profiles: state.circle.profiles.map(p => (p.isMe ? { ...p, lendable: [] } : p)),
  };
  saveWardrobe(accountId, state);
  return count;
}

/* ---------- account surgery ---------- */

/** The bookkeeping kept beside an account, keyed by its id. */
function scrubAccountTraces(account: Account): void {
  const opened = readJson<Record<string, string>>(OPENED_KEY, {});
  if (account.id in opened) {
    delete opened[account.id];
    writeJson(OPENED_KEY, opened);
  }
  const meta = readJson<Record<string, string>>(SYNC_META_KEY, {});
  if (account.id in meta) {
    delete meta[account.id];
    writeJson(SYNC_META_KEY, meta);
  }
  if (account.syncId) {
    const queue = readJson<QueuedPush[]>(SYNC_QUEUE_KEY, []);
    if (Array.isArray(queue) && queue.some(q => q.syncId === account.syncId)) {
      writeJson(SYNC_QUEUE_KEY, queue.filter(q => q.syncId !== account.syncId));
    }
  }
}

/**
 * The shared store outlives the accounts it names, and used to keep naming
 * them. A removed wardrobe stayed in every conversation it had ever been in,
 * so Conversations — one of the four thumb-bar slots — listed a thread titled
 * for a wardrobe that is not on the device, with messages by the same ghost,
 * and there is no delete-conversation control anywhere to clear it. The likely
 * alpha operation is exactly this: a lead clearing the samples off a tester's
 * device after they chatted with them.
 *
 * The rules follow the shapes household.ts already uses for leaving: a departed
 * id leaves every member list, a household with no joined member left folds, a
 * conversation that drops below two present members goes with its messages, and
 * a departed author's messages and posts go too — this is the portal's
 * trace-removal contract, not an edit of what anyone said.
 *
 * Unknown fields (removedPostIds, and whatever a later schema adds) are carried
 * through untouched: loadCommunity normalises five arrays and would silently
 * drop the rest on the way back out.
 */
export function pruneCommunity(ids: string[]): void {
  // Never CREATE the key on a device that has never had a shared store.
  if (ids.length === 0 || readRaw(COMMUNITY_KEY) === null) return;
  const gone = new Set(ids);
  const raw = readJson<Record<string, unknown>>(COMMUNITY_KEY, {});
  const before = loadCommunity();

  const households = before.households
    .map(h => ({ ...h, members: h.members.filter(m => !gone.has(m.accountId)) }))
    .filter(h => h.members.some(m => m.joined));
  const standing = new Set(households.map(h => h.id));

  const conversations = before.conversations
    .map(c => ({ ...c, memberIds: c.memberIds.filter(id => !gone.has(id)) }))
    .filter(c => c.memberIds.length >= 2 && (!c.householdId || standing.has(c.householdId)));
  const kept = new Set(conversations.map(c => c.id));

  writeJson(COMMUNITY_KEY, {
    ...raw,
    households,
    conversations,
    messages: before.messages.filter(m => kept.has(m.conversationId) && !gone.has(m.authorId)),
    posts: before.posts.filter(p => !gone.has(p.authorId)),
    passes: before.passes.filter(p => !gone.has(p.fromId) && !gone.has(p.toId)),
  });
}

/**
 * Remove accounts and every localStorage trace that belongs to them: the
 * registry entry, the wardrobe store, the last-opened stamp, the sync stamp,
 * any parked push, and their rows in the shared store. The device-wide
 * settings — theme, sound — are nobody's account and stay. The account's
 * remote copy, where one exists, is left exactly as it is: this portal
 * administers the device only.
 */
export function deleteAccounts(ids: string[]): { removed: Account[]; activeRemoved: boolean } {
  const wanted = new Set(ids);
  const registry = loadAccounts();
  const removed = registry.filter(a => wanted.has(a.id));
  for (const account of removed) {
    removeKey(wardrobeKey(account.id));
    scrubAccountTraces(account);
  }
  saveAccounts(registry.filter(a => !wanted.has(a.id)));
  pruneCommunity(removed.map(a => a.id));
  const activeRemoved = loadActiveId() !== null && wanted.has(loadActiveId() as string);
  if (activeRemoved) saveActiveId(null);
  return { removed, activeRemoved };
}

/** The nuclear option: every profile, and with it every wardrobe on the device. */
export function deleteAllAccounts(): { removed: Account[]; activeRemoved: boolean } {
  const all = loadAccounts();
  const result = deleteAccounts(all.map(a => a.id));
  // Bookkeeping keys hold nothing but per-account entries; empty them whole.
  writeJson(OPENED_KEY, {});
  writeJson(SYNC_META_KEY, {});
  writeJson(SYNC_QUEUE_KEY, []);
  // "Every trace on this device" has to include the shared store: with every
  // account gone, every conversation, post, household and pass in it names
  // nobody. pruneCommunity has already emptied it row by row; this removes the
  // husk so the device reads as new.
  removeKey(COMMUNITY_KEY);
  return result;
}

/* ---------- the action log ---------- */

export interface AdminLogEntry {
  at: string;
  action: string;
  target: string;
}

const LOG_LIMIT = 200;

export function readLog(): AdminLogEntry[] {
  const entries = readJson<AdminLogEntry[]>(ADMIN_LOG_KEY, []);
  return Array.isArray(entries) ? entries : [];
}

export function appendLog(action: string, target: string): void {
  const entry: AdminLogEntry = { at: new Date().toISOString(), action, target };
  writeJson(ADMIN_LOG_KEY, [entry, ...readLog()].slice(0, LOG_LIMIT));
}

export function clearLog(): void {
  removeKey(ADMIN_LOG_KEY);
}

/* ---------- the smoke checks ---------- */

export interface SmokeCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface ImageRef {
  accountId: string;
  accountName: string;
  kind: 'piece' | 'outfit' | 'wish';
  id: string;
  name: string;
  url: string;
}

export interface OrphanRef extends ImageRef {
  reason: string;
}

export interface OrphanReport {
  total: number;
  orphans: OrphanRef[];
  /** References no verdict could be reached on — off-device or unreachable. */
  unverified: number;
}

/* Keys this app writes that are raw strings rather than JSON. */
const RAW_STRING_KEYS = new Set(['toile-tour', 'toile-room', 'toile-key']);

const KNOWN_KEYS = new Set([
  LEGACY_KEY,
  SESSION_KEY,
  ACCOUNTS_KEY,
  COMMUNITY_KEY,
  THEME_KEY,
  OPENED_KEY,
  SYNC_META_KEY,
  SYNC_QUEUE_KEY,
  'toile-sound',
  'toile-outdoors',
  'toile-ai',
  ADMIN_LOG_KEY,
  ...RAW_STRING_KEYS,
]);

function isKnownKey(key: string): boolean {
  return (
    KNOWN_KEYS.has(key) ||
    key.startsWith(`${LEGACY_KEY}:`) ||
    /^sb-[\w-]+-auth-token$/.test(key)
  );
}

/** Every known key in storage parses as what it claims to be. */
function checkStorageParses(): SmokeCheck {
  let known = 0;
  let unknown = 0;
  const bad: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (!isKnownKey(key)) {
        unknown += 1;
        continue;
      }
      known += 1;
      if (RAW_STRING_KEYS.has(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      try {
        JSON.parse(raw);
      } catch {
        bad.push(key);
      }
    }
  } catch {
    return { id: 'storage', label: 'Storage parses', pass: false, detail: 'This browser refused to be read.' };
  }
  const note = unknown > 0 ? ` (${unknown} not this app's, left alone)` : '';
  return bad.length === 0
    ? { id: 'storage', label: 'Storage parses', pass: true, detail: `${known} keys read clean${note}.` }
    : { id: 'storage', label: 'Storage parses', pass: false, detail: `Does not parse: ${bad.join(', ')}.` };
}

/** Every account record is well-formed, with a wardrobe store behind it. */
function checkAccounts(): SmokeCheck {
  const registry = loadAccounts();
  const problems: string[] = [];
  for (const account of registry) {
    const fields: (keyof Account)[] = ['id', 'name', 'handle', 'monogram', 'color', 'createdAt'];
    const missing = fields.filter(f => typeof account[f] !== 'string' || (account[f] as string).length === 0);
    if (missing.length > 0) problems.push(`${account.name || account.id}: ${missing.join(', ')}`);
    if (loadWardrobe(account.id) === null) problems.push(`${account.name}: no store on this device`);
  }
  return problems.length === 0
    ? { id: 'accounts', label: 'Account records', pass: true, detail: `${registry.length} on this device, each well-formed, each with its store.` }
    : { id: 'accounts', label: 'Account records', pass: false, detail: problems.slice(0, 3).join(' · ') };
}

/** The sample wardrobes: installed, or honestly absent. Never a failure to lack them. */
function checkSeeds(): SmokeCheck {
  const registry = loadAccounts();
  const installed = PERSONAS.filter(p => registry.some(a => a.id === p.id)).length;
  const stray = registry.filter(a => a.isSample && !PERSONAS.some(p => p.id === a.id));
  if (stray.length > 0) {
    return {
      id: 'seeds',
      label: 'Persona seeds',
      pass: false,
      detail: `${stray.map(a => a.name).join(', ')} claims to be a sample but matches no seed.`,
    };
  }
  return {
    id: 'seeds',
    label: 'Persona seeds',
    pass: true,
    detail: installed === 0
      ? `None of the ${PERSONAS.length} sample wardrobes is on this device.`
      : `${installed} of ${PERSONAS.length} sample wardrobes on this device.`,
  };
}

/** The session pointer names a wardrobe that exists, or nobody at all. */
function checkSession(): SmokeCheck {
  const activeId = loadActiveId();
  if (activeId === null) {
    return { id: 'session', label: 'Session pointer', pass: true, detail: 'No wardrobe is open.' };
  }
  const found = loadAccounts().some(a => a.id === activeId);
  return found
    ? { id: 'session', label: 'Session pointer', pass: true, detail: `Open wardrobe: ${activeId}.` }
    : { id: 'session', label: 'Session pointer', pass: false, detail: `Points at ${activeId}, which is not in the registry.` };
}

/** About how full the purse is, against the budget browsers usually give. */
function checkBudget(): SmokeCheck {
  const total = totalStorageBytes();
  const pct = Math.round((total / BUDGET_BYTES) * 100);
  return {
    id: 'budget',
    label: 'Storage budget',
    pass: total <= BUDGET_BYTES,
    detail: `About ${formatBytes(total)} of about ${formatBytes(BUDGET_BYTES)} — ${pct}%.`,
  };
}

/**
 * THE PHOTOGRAPH STORE, WEIGHED.
 *
 * `totalStorageBytes` reads localStorage, and once photographs are filed by
 * reference a wardrobe's purse holds forty characters where it used to hold
 * eighty thousand. That is the point of the wave — and it means the storage
 * ledger, read alone, now under-reports what a photographed closet costs this
 * device by roughly three orders of magnitude. So the room is weighed too, and
 * said out loud beside the purse.
 *
 * `unnamed` is not an alarm: a picture stops being named the moment its piece
 * is deleted, and the sweep collects it a few seconds later. A number here
 * larger than nothing usually means somebody deleted something recently.
 */
export async function readPhotoStore(): Promise<{
  held: number;
  bytes: number;
  named: number;
  unnamed: number;
}> {
  const ids = await photoIds();
  let bytes = 0;
  for (const id of ids) {
    const picture = await getPhoto(id);
    // Two bytes a character: the same UTF-16 arithmetic bytesOf uses, so the
    // two figures on the panel can be added together honestly.
    if (picture !== null) bytes += picture.length * 2;
  }
  const onRecord = new Set(collectImageRefs().map(r => r.url));
  const named = ids.filter(id => onRecord.has(photoRef(id))).length;
  return { held: ids.length, bytes, named, unnamed: ids.length - named };
}

/** What the photographs cost the disk, beside what the records cost the purse. */
async function checkPhotographs(): Promise<SmokeCheck> {
  const room = await readPhotoStore();
  if (room.held === 0) {
    return {
      id: 'photographs',
      label: 'Photograph store',
      pass: true,
      detail: 'Nothing filed by reference on this device — every photograph is on its record.',
    };
  }
  const loose = room.unnamed > 0
    ? ` ${room.unnamed} named by nothing, waiting on the next sweep.`
    : '';
  return {
    id: 'photographs',
    label: 'Photograph store',
    pass: true,
    detail: `${room.held} photographs, about ${formatBytes(room.bytes)} on the disk and off the purse.${loose}`,
  };
}

function imageRefsOf(account: Account, state: AppState): ImageRef[] {
  const refs: ImageRef[] = [];
  const base = { accountId: account.id, accountName: account.name };
  for (const i of state.items) {
    if (i.imageUrl) refs.push({ ...base, kind: 'piece', id: i.id, name: i.name, url: i.imageUrl });
  }
  for (const o of state.outfits) {
    if (o.imageUrl) refs.push({ ...base, kind: 'outfit', id: o.id, name: o.name, url: o.imageUrl });
  }
  for (const w of state.wishlist) {
    if (w.imageUrl) refs.push({ ...base, kind: 'wish', id: w.id, name: w.name, url: w.imageUrl });
  }
  return refs;
}

/** Every image reference on the device, across every wardrobe. */
export function collectImageRefs(): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const account of loadAccounts()) {
    const state = readState(account.id);
    if (state) refs.push(...imageRefsOf(account, state));
  }
  return refs;
}

/**
 * Does a reference point at something? True is exists, false is missing, null
 * is no honest verdict — an off-device address, or a device that could not be
 * asked just now.
 */
async function verifyRef(url: string, cache: Map<string, boolean | null>): Promise<boolean | null> {
  const held = cache.get(url);
  if (held !== undefined) return held;
  let verdict: boolean | null;
  if (isPhotoRef(url)) {
    // A reference into the photograph store has a definite answer on this
    // device: the picture is in the room or it is not. Without this branch it
    // fell to the fetch() below, which throws on a scheme nothing serves, and
    // every filed photograph was reported as "could not be verified".
    verdict = (await getPhoto(url)) !== null;
  } else if (url.startsWith('data:')) {
    verdict = /^data:image\/[a-z0-9.+-]+[;,]/i.test(url);
  } else if (/^https?:\/\//i.test(url)) {
    verdict = null;
  } else {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      verdict = res.ok;
    } catch {
      verdict = null;
    }
  }
  cache.set(url, verdict);
  return verdict;
}

/**
 * The orphan check: no piece, outfit or wish may name an image that is no
 * longer there. Asset references are asked of the server a few at a time;
 * what cannot be asked is counted honestly as unverified, never as missing.
 */
export async function findOrphanImages(): Promise<OrphanReport> {
  const refs = collectImageRefs();
  const cache = new Map<string, boolean | null>();
  const orphans: OrphanRef[] = [];
  let unverified = 0;
  const POOL = 4;
  for (let at = 0; at < refs.length; at += POOL) {
    const slice = refs.slice(at, at + POOL);
    const verdicts = await Promise.all(slice.map(r => verifyRef(r.url, cache)));
    slice.forEach((ref, i) => {
      if (verdicts[i] === false) {
        orphans.push({
          ...ref,
          reason: ref.url.startsWith('data:')
            ? 'the photograph no longer reads as one'
            : isPhotoRef(ref.url)
              ? 'the photograph is no longer in this device\u2019s store'
              : 'the file it names is not there',
        });
      } else if (verdicts[i] === null) {
        unverified += 1;
      }
    });
  }
  return { total: refs.length, orphans, unverified };
}

/** Clear the references the orphan check condemned. Returns how many. */
export function cleanOrphans(orphans: OrphanRef[]): number {
  const byAccount = new Map<string, OrphanRef[]>();
  for (const orphan of orphans) {
    const list = byAccount.get(orphan.accountId) ?? [];
    list.push(orphan);
    byAccount.set(orphan.accountId, list);
  }
  let cleared = 0;
  for (const [accountId, list] of byAccount) {
    const state = readState(accountId);
    if (!state) continue;
    const wanted = new Set(list.map(o => `${o.kind}:${o.id}`));
    const strip = <T extends { id: string; imageUrl?: string }>(kind: string) =>
      (entry: T): T => {
        if (!wanted.has(`${kind}:${entry.id}`) || !entry.imageUrl) return entry;
        // Same rule as the strip tool: the record loses the reference and the
        // room loses the blob. A condemned reference points at nothing by
        // definition, so this is a no-op on the picture and a tidy-up of the
        // cache — but it is the line that keeps the two halves honest.
        void removePhoto(entry.imageUrl);
        cleared += 1;
        return { ...entry, imageUrl: '' } as T;
      };
    state.items = state.items.map(strip('piece'));
    state.outfits = state.outfits.map(strip('outfit'));
    state.wishlist = state.wishlist.map(strip('wish'));
    saveWardrobe(accountId, state);
  }
  return cleared;
}

/* ---------- the services board: relay probes ---------- */

/**
 * The relay's address. The source of truth is the RELAY_ENDPOINT constant in
 * src/lib/anthropic.ts, which keeps it module-private on purpose; it is
 * re-declared here so the portal can knock on the same door the intake walks
 * through. If one moves, move both.
 */
export const RELAY_ENDPOINT = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';

/** The whole probe: one sentence out, one line back. Nothing else is sent. */
const PROBE_PROMPT = 'Reply with exactly: relay test ok';

export interface RelayService {
  id: string;
  label: string;
  model: string;
  /** Which response shape comes back — the request body is the same either way. */
  shape: 'anthropic' | 'openai';
  maxTokens: number;
}

/**
 * The four models the relay can route to. Kimi K3 is a reasoning model that
 * spends its thinking from the same token budget as the answer, so its probe
 * carries the 8000-token ceiling the intake uses — 512 would be eaten whole
 * by the thinking and the answer would arrive empty.
 */
export const RELAY_SERVICES: RelayService[] = [
  { id: 'fable', label: 'Claude Fable 5', model: 'claude-fable-5', shape: 'anthropic', maxTokens: 512 },
  { id: 'opus', label: 'Claude Opus 5', model: 'claude-opus-5', shape: 'anthropic', maxTokens: 512 },
  { id: 'gemini', label: 'Gemini 3.7 Flash', model: 'gemini-3.7-flash', shape: 'openai', maxTokens: 512 },
  { id: 'kimi', label: 'Kimi K3', model: 'k3', shape: 'openai', maxTokens: 8000 },
];

/**
 * healthy      — HTTP 200, an answer came back.
 * unconfigured — the relay answered 503 "not configured": the house has not
 *                set that provider's key. Its own calm state, not a failure.
 * failed       — any other HTTP answer.
 * unreachable  — the network itself refused; there is no HTTP status.
 */
export type ProbeVerdict = 'healthy' | 'unconfigured' | 'failed' | 'unreachable';

export interface ProbeResult {
  verdict: ProbeVerdict;
  /** null when the network never answered. */
  status: number | null;
  latencyMs: number;
  /** The first line of the model's answer, or the trouble in one phrase. */
  answer: string;
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0) ?? ''
  );
}

/** The answer's text, read by the shape the provider speaks. */
function probeAnswer(service: RelayService, json: unknown): string {
  if (service.shape === 'anthropic') {
    const blocks = (json as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
    return firstLine(blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n'));
  }
  const content = (json as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  }).choices?.[0]?.message?.content;
  // OpenAI-compatible content is a string; some providers send typed parts.
  const text =
    typeof content === 'string'
      ? content
      : (content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
  return firstLine(text);
}

/**
 * One knock on the relay for one model. The request body is the tiny probe
 * and nothing else — no photograph, no closet, no key (the relay holds the
 * keys server-side).
 */
export async function probeRelay(service: RelayService): Promise<ProbeResult> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(RELAY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: service.model,
        max_tokens: service.maxTokens,
        messages: [{ role: 'user', content: PROBE_PROMPT }],
      }),
    });
  } catch {
    return {
      verdict: 'unreachable',
      status: null,
      latencyMs: Math.round(performance.now() - started),
      answer: 'The relay could not be reached from here.',
    };
  }
  const latencyMs = Math.round(performance.now() - started);
  const body = await res.text().catch(() => '');
  if (res.status === 200) {
    let answer = '';
    try {
      answer = probeAnswer(service, JSON.parse(body));
    } catch {
      /* a 200 that does not parse is still a 200; the answer line says so */
    }
    return { verdict: 'healthy', status: 200, latencyMs, answer: answer || 'The answer came back empty.' };
  }
  if (res.status === 503 && /not configured/i.test(body)) {
    return { verdict: 'unconfigured', status: 503, latencyMs, answer: 'The house has not set this key yet.' };
  }
  return {
    verdict: 'failed',
    status: res.status,
    latencyMs,
    answer: firstLine(body) || `The relay answered ${res.status}.`,
  };
}

/* ---------- the alpha board: remote truth ---------- */

/**
 * The stats function beside the relay. Another squad is building it to this
 * contract: GET with an x-admin-token header, answering
 * { generatedAt, users, profiles, wardrobes: [{ id, user_id, updated_at,
 * bytes, v }] }. Until it is deployed, every ask lands in the 'absent' state.
 */
export const ADMIN_STATS_ENDPOINT = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-stats';

/** sessionStorage, deliberately: the token leaves when the tab closes. */
export const ADMIN_TOKEN_KEY = 'almari-admin-token';

export function loadAdminToken(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAdminToken(token: string): void {
  try {
    if (token.trim()) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* private mode — the token holds for this render only */
  }
}

export interface AlphaWardrobeRow {
  id: string;
  user_id: string;
  updated_at: string;
  bytes: number;
  /** Envelope version; null or absent means the row was stored bare. */
  v?: number | string | null;
}

export interface AlphaStats {
  generatedAt: string;
  users: number;
  profiles: number;
  wardrobes: AlphaWardrobeRow[];
}

/**
 * ok      — the numbers, as the service counted them.
 * refused — 401: the token was refused.
 * absent  — 404 or no network answer: the service is not deployed yet.
 *           A calm state while the other squad builds it, never a red one.
 * failed  — the service answered, but not with numbers.
 */
export type AlphaStatsResult =
  | { kind: 'ok'; stats: AlphaStats }
  | { kind: 'refused' }
  | { kind: 'absent' }
  | { kind: 'failed'; status: number };

export async function fetchAlphaStats(token: string): Promise<AlphaStatsResult> {
  let res: Response;
  try {
    res = await fetch(ADMIN_STATS_ENDPOINT, { headers: { 'x-admin-token': token } });
  } catch {
    return { kind: 'absent' };
  }
  if (res.status === 401) return { kind: 'refused' };
  if (res.status === 404) return { kind: 'absent' };
  if (!res.ok) return { kind: 'failed', status: res.status };
  try {
    const json = (await res.json()) as Partial<AlphaStats>;
    return {
      kind: 'ok',
      stats: {
        generatedAt: typeof json.generatedAt === 'string' ? json.generatedAt : '',
        users: typeof json.users === 'number' ? json.users : 0,
        profiles: typeof json.profiles === 'number' ? json.profiles : 0,
        wardrobes: Array.isArray(json.wardrobes) ? json.wardrobes : [],
      },
    };
  } catch {
    return { kind: 'failed', status: res.status };
  }
}

/** The whole panel, in order. The orphan check is last because it is the slow one. */
export async function runSmokeChecks(): Promise<{ checks: SmokeCheck[]; orphans: OrphanRef[] }> {
  const checks: SmokeCheck[] = [
    checkStorageParses(),
    checkAccounts(),
    checkSeeds(),
    checkSession(),
    checkBudget(),
    await checkPhotographs(),
  ];
  const report = await findOrphanImages();
  const unverifiedNote = report.unverified > 0 ? ` ${report.unverified} could not be verified from here.` : '';
  checks.push({
    id: 'orphans',
    label: 'Image references',
    pass: report.orphans.length === 0,
    detail: report.orphans.length === 0
      ? `${report.total} references, every one pointing somewhere.${unverifiedNote}`
      : `${report.orphans.length} of ${report.total} references point at nothing.${unverifiedNote}`,
  });
  return { checks, orphans: report.orphans };
}
