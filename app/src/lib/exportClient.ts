/**
 * THE RECORD LEAVES, AND COMES BACK, WHOLE.
 *
 * Two halves live here, and the seam between them is the point:
 *
 *  1. THE DOCUMENT — what a backup IS. Mirrored line-for-line from the web's
 *     src/lib/exportDoc.ts (read 2026-08-20), because a file written here has
 *     to open on the web app unchanged and a file written there has to open
 *     here. Mirrored by READING, never imported: the app imports no web file.
 *     It is a copy under protest — exportDoc.ts is already pure by contract
 *     (no React, no DOM, no Blob) and is marked "bound for packages/shared";
 *     the moment it makes that move, everything above the "mirror ends" line
 *     below deletes and this module imports it instead.
 *
 *  2. THE PLUMBING — the phone's half. expo-file-system writes the text,
 *     expo-sharing hands it to the OS share sheet, expo-document-picker
 *     brings one back. Checked against the SDK 57 versioned docs this
 *     session (app/AGENTS.md):
 *       https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 *       https://docs.expo.dev/versions/v57.0.0/sdk/sharing/
 *       https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/
 *     The SDK 57 file API is the CLASS api — new File(Paths.cache, name),
 *     file.create({ overwrite }), file.write(text), await file.text(),
 *     await file.base64() — not the legacy FileSystem.writeAsStringAsync of
 *     older SDKs. Sharing.shareAsync takes a local file URL only.
 *
 * PHOTOGRAPHS INLINE ON THE WAY OUT (owner decision, and the reason
 * AppState.photoEncoding exists at all — see its comment in shared/types).
 * At rest this app keeps photographs as files on disk and writes their paths
 * into imageUrl; a document that says photoEncoding 'file' is a document full
 * of paths, and a path means nothing on another device. So every photograph is
 * read back to a base64 data URI on the way into the file and the document is
 * stamped 'inline'. The result is a backup the web app opens with the
 * pictures in it.
 *
 * A photograph whose file is GONE exports as an empty imageUrl, and the count
 * is said out loud. Keeping the dead path would be keeping a dangling pointer,
 * not keeping data — the file it named is already gone — and it would make the
 * document lie about its own encoding. Nothing else about the piece moves: the
 * name, the cost, every wear and its address all travel.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { migrate } from '@almari/shared/migrate';
import { SCHEMA_VERSION, type Account, type AppState } from '@almari/shared/types';

import { readPhotoAsDataUrl, storedPath } from './photos';
import { SESSION_KEY, storage, wardrobeKey } from './storage';
import { announceAdopted, pushNow } from './sync';

/* ==================== the mirror: src/lib/exportDoc.ts ==================== */

/**
 * The fields a backup carries. An ALLOWLIST, and that is the whole point.
 *
 * A denylist has to be exhaustive to work, so every value added to the web's
 * React context afterwards leaked into every backup silently — including
 * packedItemIds, a ReadonlySet, which JSON.stringify writes as {}. Inverted,
 * the failure mode inverts with it: forgetting a name here OMITS a field,
 * which the pinned list in __tests__/export-document.test.ts catches on the
 * next run, and leaking one is no longer possible.
 */
export const EXPORTED_KEYS = [
  'schemaVersion',
  'items',
  'outfits',
  'wearLogs',
  'wishlist',
  'circle',
  'events',
  'furniture',
  'settings',
  'photoEncoding',
] as const;

export type ExportedKey = (typeof EXPORTED_KEYS)[number];

/**
 * Compile-time proof that the allowlist covers AppState.
 *
 * Adding a field to AppState without naming it above stops tsc --noEmit here
 * rather than quietly dropping that field out of every backup from then on.
 * The check runs one way only — a name may be listed before the field exists,
 * which is how a field lands in the same wave as the export that carries it.
 */
export const EXPORTED_KEYS_COVER_APP_STATE:
  [Exclude<keyof AppState, ExportedKey>] extends [never] ? true : never = true;

/**
 * The one value this build computes that is shaped exactly like a record.
 * activeItems is items-minus-retired: an array of plain objects, which nothing
 * but its name can rule out. Everything else the provider adds — the
 * callbacks, the Sets — is refused by SHAPE below, not by name.
 */
const COMPUTED_KEYS = new Set<string>(['activeItems']);

/**
 * Is this value something a FILE could have carried?
 *
 * The gate for keys this build has never heard of. A newer build's field must
 * ride out again untouched, but it can only ever have arrived as parsed JSON.
 * A function, a Set, a Map, a Date, a class instance — those are things a
 * runtime made, and a runtime's private furniture has no business in a backup.
 */
function isFileData(value: unknown): boolean {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (t !== 'object') return false;
  if (Array.isArray(value)) return value.every(isFileData);
  const proto = Object.getPrototypeOf(value) as object | null;
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isFileData);
}

/** A backup file, parsed. Known fields plus whatever a newer build wrote. */
export type ExportDoc = Record<string, unknown> & { schemaVersion: number; exportedAt: string };

/**
 * Build the document from anything AppState-shaped — including a provider
 * value, which spreads the state alongside its callbacks and its derived
 * values. Absent fields are omitted rather than written as null, so a backup
 * from a build that has no photoEncoding simply has no such line.
 */
export function buildExportDoc(source: object, exportedAt: string): ExportDoc {
  const doc: Record<string, unknown> = {};
  const known = new Set<string>(EXPORTED_KEYS);
  for (const [key, value] of Object.entries(source)) {
    if (known.has(key)) {
      if (value !== undefined) doc[key] = value;
      continue;
    }
    // Unknown to this build. Carried only if it looks like it came from a file.
    if (key === 'exportedAt' || COMPUTED_KEYS.has(key)) continue;
    if (isFileData(value)) doc[key] = value;
  }
  // Stamped last so neither can be shadowed by whatever the source held.
  doc.schemaVersion = SCHEMA_VERSION;
  doc.exportedAt = exportedAt;
  return doc as ExportDoc;
}

/** The document as it goes on disk. Indented — a backup is readable by hand. */
export function exportDocText(source: object, exportedAt: string): string {
  return JSON.stringify(buildExportDoc(source, exportedAt), null, 2);
}

/**
 * Read a backup. Throws if the text is not JSON — the caller says so in its
 * own words. migrate() carries every older shape forward and keeps unknown
 * fields.
 */
export function readExportDoc(text: string): AppState {
  return migrate(JSON.parse(text) as unknown);
}

/* ----- mirror ends. Everything below is the phone's own half. ----- */

/* ==================== the name on the file ==================== */

/**
 * A share sheet shows a filename and nothing else, and a person exporting two
 * wardrobes on the same day gets two files into one folder. So the wardrobe's
 * own name is in the name: almari-the-weekday-closet-2026-08-20.json.
 *
 * WITH NO NAME TO USE the result is almari-backup-<day>.json, byte-identical
 * to the web exportFileName — the founding case, unchanged, so the two apps
 * still agree about the anonymous file.
 */
function slugOf(name: string | null | undefined): string {
  const slug = (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // Anything that is not a letter or a digit becomes one dash. The marks NFKD
    // leaves behind go with it, so a name with accents reads as plain letters.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug === '' ? 'backup' : slug;
}

/** almari-backup-2026-08-20.json. `day` is a local YYYY-MM-DD, never UTC. */
export function exportFileName(day: string, wardrobeName?: string | null): string {
  return `almari-${slugOf(wardrobeName)}-${day}.json`;
}

/* ==================== photographs ==================== */

/**
 * Reads one stored photograph back as a base64 data URI.
 *
 * THE READER IS lib/photos.ts AND NOT THIS MODULE'S BUSINESS. Where a
 * photograph lives, what a stored path may say, and which of them are refused
 * belongs to the module that wrote them. That matters here more than it looks:
 * photos.storedPath refuses `..` in either slash precisely BECAUSE the export
 * path reaches it, and an export must never become a way to read the rest of
 * the app sandbox out of the phone.
 *
 * Its convention is EMPTY STRING, NEVER A THROW, for a file that is gone — one
 * swept photograph must not take a whole backup down with it. So an empty
 * answer is counted as a miss below, exactly as a throw is.
 */
export type PhotoReader = (storedPath: string) => Promise<string>;

export interface InlineReport {
  /** The same document with every photograph it could read carried inside it. */
  state: AppState;
  inlined: number;
  /** Photographs whose file was gone. Exported as an empty imageUrl, said aloud. */
  missing: number;
}

/** Already a picture, not an address — nothing to read from disk. */
function isInlinePhoto(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

/** Does this record actually hold an address to a file on this device? */
function hasStoredPhotos(state: AppState): boolean {
  const stored = (value: unknown): boolean =>
    typeof value === 'string' && value !== '' && storedPath(value) !== null;
  return (
    state.items.some(i => stored(i.imageUrl)) ||
    state.outfits.some(o => stored(o.imageUrl)) ||
    state.wishlist.some(w => stored(w.imageUrl))
  );
}

/**
 * Turn a 'file' document into an 'inline' one.
 *
 * THE DECLARATION IS TRUSTED, AND SO IS THE RECORD, because they can disagree
 * for a quarter of a second and that is long enough to write a broken backup.
 * photoEncoding is stamped on the state by the provider, which persists on a
 * 250ms settle; an export reads the whole document off the shelf, so a
 * photograph saved a heartbeat before pressing Export lives in a record whose
 * shelf copy still says 'inline'. Gating on the declaration alone would ship
 * that photograph as a bare path — a picture nothing anywhere could open.
 *
 * So the record is asked as well, and it is ASKED rather than guessed at:
 * lib/photos.storedPath is the only thing that decides whether a string is an
 * address to a file of ours, and it answers null for a data URI, a remote URL,
 * and anything reaching outside the photograph directory. A document with
 * nothing to read is still handed straight back, untouched.
 */
export async function inlinePhotos(
  state: AppState,
  read: PhotoReader = readPhotoAsDataUrl,
): Promise<InlineReport> {
  if (state.photoEncoding !== 'file' && !hasStoredPhotos(state)) {
    return { state, inlined: 0, missing: 0 };
  }

  let inlined = 0;
  let missing = 0;

  const carry = async (stored: unknown): Promise<string> => {
    if (typeof stored !== 'string' || stored === '' || isInlinePhoto(stored)) {
      return typeof stored === 'string' ? stored : '';
    }
    try {
      const dataUrl = await read(stored);
      // An empty answer is the reader saying the file is gone (photos.ts), and
      // a throw is any reader failing louder. Both are one missing photograph.
      if (dataUrl === '') {
        missing++;
        return '';
      }
      inlined++;
      return dataUrl;
    } catch {
      // The file is gone. Nothing is kept by keeping the address to it.
      missing++;
      return '';
    }
  };

  const items: AppState['items'] = [];
  for (const item of state.items) items.push({ ...item, imageUrl: await carry(item.imageUrl) });

  const outfits: AppState['outfits'] = [];
  for (const outfit of state.outfits) {
    if (outfit.imageUrl === undefined) {
      outfits.push(outfit);
      continue;
    }
    const carried = await carry(outfit.imageUrl);
    outfits.push(carried === '' ? { ...outfit, imageUrl: undefined } : { ...outfit, imageUrl: carried });
  }

  const wishlist: AppState['wishlist'] = [];
  for (const wish of state.wishlist) {
    if (wish.imageUrl === undefined) {
      wishlist.push(wish);
      continue;
    }
    const carried = await carry(wish.imageUrl);
    wishlist.push(carried === '' ? { ...wish, imageUrl: undefined } : { ...wish, imageUrl: carried });
  }

  return { state: { ...state, items, outfits, wishlist }, inlined, missing };
}

/* ==================== the whole document ==================== */

/** Which wardrobe is open, read the way the provider reads it. */
export async function readActiveId(): Promise<string | null> {
  try {
    const raw = await storage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const session = JSON.parse(raw) as { activeId?: unknown } | null;
    return typeof session?.activeId === 'string' ? session.activeId : null;
  } catch {
    return null;
  }
}

/**
 * The whole document on the shelf, migrated on read.
 *
 * The provider hands screens the fields screens need — items, outfits, wear
 * logs, settings. A BACKUP needs the fields nothing on this phone has a screen
 * for yet: the wishlist, the circle, the events, and every key a newer build
 * wrote that this one has never heard of. Those live only in the document, so
 * the document is what an export reads. Missing or unreadable, migrate(null)
 * answers with a fresh state exactly as the provider own read does.
 */
export async function readWholeDocument(accountId: string | null): Promise<AppState> {
  if (accountId === null) return migrate(null);
  try {
    const raw = await storage.getItem(wardrobeKey(accountId));
    return migrate(raw === null ? null : (JSON.parse(raw) as unknown));
  } catch {
    return migrate(null);
  }
}

/**
 * The document, brought up to the minute.
 *
 * The shelf is the whole record but it can be up to one settle window (250ms)
 * behind what is on the screen, because the provider coalesces its writes. So
 * the shelf is the BASE — it carries the fields the provider does not hold —
 * and the live values the provider does hold are laid over the top. A wear
 * logged a heartbeat before pressing Export is in the file.
 */
export function withLiveRecord(shelf: AppState, live: Partial<AppState>): AppState {
  const merged = { ...shelf } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(live)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as unknown as AppState;
}

/** items + outfits + wear logs + wishlist — the web own count, same order. */
export function countRecords(state: AppState): number {
  return state.items.length + state.outfits.length + state.wearLogs.length + state.wishlist.length;
}

/* ==================== export: write, then hand it over ==================== */

export type ExportFailure = 'no-share-sheet' | 'write-failed' | 'share-failed';

export interface ExportResult {
  ok: boolean;
  fileName: string;
  uri: string | null;
  records: number;
  inlined: number;
  missing: number;
  reason?: ExportFailure;
}

export interface ExportRequest {
  /** Anything AppState-shaped. The allowlist decides what of it travels. */
  source: AppState;
  wardrobeName?: string | null;
  /** Local YYYY-MM-DD — the day the file is named for. */
  day: string;
  /** ISO instant stamped into the document. */
  exportedAt: string;
  readPhoto?: PhotoReader;
}

/**
 * Write the backup into the cache directory and hand it to the OS share sheet.
 *
 * The CACHE directory, deliberately: the file is a courier, not a record. The
 * record is wherever the share sheet takes it — Files, Drive, a mail draft —
 * and a courier the system may reclaim when the disk gets tight is exactly the
 * right kind of temporary.
 */
export async function exportBackup(request: ExportRequest): Promise<ExportResult> {
  const { state, inlined, missing } = await inlinePhotos(request.source, request.readPhoto);
  // The document always declares itself inline: every photograph in the text
  // below is a data URI, and that is what makes it open on the web unchanged.
  const text = exportDocText({ ...state, photoEncoding: 'inline' }, request.exportedAt);
  const fileName = exportFileName(request.day, request.wardrobeName);
  const records = countRecords(state);

  let file: File;
  try {
    file = new File(Paths.cache, fileName);
    // Exporting twice in one day is an ordinary thing to do.
    file.create({ overwrite: true, intermediates: true });
    file.write(text);
  } catch {
    return { ok: false, fileName, uri: null, records, inlined, missing, reason: 'write-failed' };
  }

  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, fileName, uri: file.uri, records, inlined, missing, reason: 'no-share-sheet' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: fileName,
      // The iOS type identifier for JSON. Android reads mimeType instead.
      UTI: 'public.json',
    });
  } catch {
    return { ok: false, fileName, uri: file.uri, records, inlined, missing, reason: 'share-failed' };
  }

  return { ok: true, fileName, uri: file.uri, records, inlined, missing };
}

/* ==================== import: choose, read, then ask ==================== */

/**
 * Is this parsed JSON a wardrobe at all?
 *
 * migrate() is generous by design — it answers ANY object with a valid state,
 * which for a shopping list or a tsconfig means a state with nothing in it.
 * Handing that to the confirm would offer to replace a whole wardrobe with
 * emptiness, and a person reading "0 pieces" quickly is one tap from losing
 * everything. So the shape is gated BEFORE migrate: a backup declares a
 * schemaVersion, or it carries at least one of the record arrays. Anything
 * else is not refused as damaged — it is refused as not a backup.
 */
export function isBackupShaped(parsed: unknown): parsed is Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const doc = parsed as Record<string, unknown>;
  if (typeof doc.schemaVersion === 'number') return true;
  return ['items', 'outfits', 'wearLogs', 'wishlist'].some(key => Array.isArray(doc[key]));
}

/** Parse and migrate a backup text. Throws if it is not JSON, or not a backup. */
export function readBackupText(text: string): AppState {
  const parsed: unknown = JSON.parse(text);
  if (!isBackupShaped(parsed)) throw new Error('not a backup');
  return migrate(parsed);
}

export type PickedBackup =
  | { ok: true; state: AppState; fileName: string }
  | { ok: false; reason: 'cancelled' | 'unreadable' };

/**
 * Open the system picker, read what comes back, migrate it.
 *
 * NO MIME FILTER. A backup that has been round-tripped through Drive, a chat
 * app or a mail attachment comes back declared as application/octet-stream
 * more often than as application/json, and a filter that hides the very file
 * a person is looking for is worse than no filter: the parse below is the real
 * gate, and it refuses in a sentence rather than by making the file invisible.
 */
export async function pickBackup(): Promise<PickedBackup> {
  let picked: DocumentPicker.DocumentPickerResult;
  try {
    picked = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      // Read access, immediately, from a URI this app owns.
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (picked.canceled) return { ok: false, reason: 'cancelled' };
  const asset = picked.assets?.[0];
  if (!asset) return { ok: false, reason: 'cancelled' };
  try {
    const text = await new File(asset.uri).text();
    return { ok: true, state: readBackupText(text), fileName: asset.name };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

export type ImportOutcome = 'replaced' | 'storage-full' | 'nowhere';

export interface ImportTarget {
  /** Which wardrobe is being replaced. Null means there is nowhere to put it. */
  accountId: string | null;
  /**
   * The provider own replace, WHEN IT HAS ONE.
   *
   * MISMATCH WITH THIS WAVE PROVIDER CONTRACT, reported rather than patched
   * around silently: the web WardrobeContext exposes replaceState, and
   * app/src/lib/wardrobe.tsx does not. Until it does, the second path below is
   * used — the same door a sync pull already comes through, which the open
   * provider is already listening at. When squad A adds replaceState, pass it
   * here and the announcement stops being needed.
   */
  replaceState?: (next: AppState) => void;
  /** The account copy, when this wardrobe keeps one. */
  syncAccount?: Account | null;
  authUserId?: string | null;
}

/**
 * Put the imported record where the wardrobe lives, then tell the screen.
 *
 * THE SHELF IS WRITTEN FIRST, on purpose. A phone that will not take the write
 * is the case this ordering exists for: nothing has been replaced yet, the
 * screen still shows the record that is still there, and the caller can say so
 * plainly. Announcing first and writing second would leave a wardrobe that
 * reads as replaced and is not.
 *
 * The account copy is pushed last, and only if this wardrobe keeps one:
 * without it the account still holds yesterday blob, and the next pull —
 * last-writer-wins, whole wardrobe at a time — would quietly undo the import.
 * pushNow never throws and refuses a wardrobe that does not sync, so it is
 * safe to call unconditionally.
 */
export async function commitImport(target: ImportTarget, next: AppState): Promise<ImportOutcome> {
  if (target.accountId === null) return 'nowhere';
  try {
    await storage.setItem(wardrobeKey(target.accountId), JSON.stringify(next));
  } catch {
    return 'storage-full';
  }
  if (target.replaceState) target.replaceState(next);
  else announceAdopted(target.accountId);
  if (target.syncAccount && target.authUserId) {
    await pushNow(target.syncAccount, next, target.authUserId);
  }
  return 'replaced';
}
