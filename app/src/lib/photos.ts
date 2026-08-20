/**
 * PHOTOGRAPHS ON DISK — the native half of AppState.photoEncoding.
 *
 * The web app has exactly one place to put a photograph: a base64 data URI
 * inside `item.imageUrl`, inside the wardrobe document, inside localStorage.
 * A phone must not do that. A forty-piece closet of phone photographs is
 * tens of megabytes, and AsyncStorage is one JSON blob rewritten in full on
 * every settled edit — inlining would turn "log a wear" into a thirty-
 * megabyte serialise. So on native the bytes live in the app's document
 * directory and `item.imageUrl` holds the PATH.
 *
 * Both are strings, so nothing downstream could tell them apart, which is
 * exactly why `AppState.photoEncoding` exists (packages/shared/types.ts,
 * schema v8, built by Wave 1 for this): the document declares which kind it
 * holds. This module is the 'file' side of that declaration.
 *
 * THE PATHS ARE RELATIVE, and that is load-bearing. iOS reissues the app's
 * container UUID on reinstall and on some OS updates, so an absolute
 * file:///var/mobile/Containers/Data/Application/<uuid>/Documents/... stored
 * inside a document is a path that stops resolving one day, silently, for
 * every photograph at once. We store `photos/p-xxxx.jpg` and resolve it
 * against Paths.document at read time, so the document survives the move.
 *
 * EXPORT IS ALWAYS INLINE. shared/types states it: "An export is always
 * 'inline' (the native app inlines its files on the way out), so a backup
 * opens on any device and round-trips between the two apps in both
 * directions." readPhotoAsDataUrl below is that inlining, one file at a time
 * — the owner's decision on record.
 *
 * API READ THIS SESSION against https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 * — in SDK 57 the object API is the DEFAULT export (`File`, `Directory`,
 * `Paths`); the pre-54 `documentDirectory` / `writeAsStringAsync` functions
 * now live behind 'expo-file-system/legacy' and are deliberately not used
 * here. Confirmed on that page: `new File(directory, name)`, `file.create({
 * intermediates, overwrite })`, `file.write(content, { encoding: 'base64' })`,
 * `await file.base64()`, `file.delete()`, `await file.copy(destination)`,
 * `file.exists`, `file.uri`, `new Directory(Paths.document, name)` and
 * `directory.create({ intermediates: true, idempotent: true })`.
 *
 * expo-file-system is an Expo SDK module and works in Expo Go — no new
 * native dependency, no prebuild.
 */
import { Directory, File, Paths } from 'expo-file-system';

/** Everything this module writes lives under one folder of the document dir. */
export const PHOTO_DIR = 'photos';

/**
 * What a phone's storage refusing a write sounds like in the house voice.
 *
 * The wardrobe provider already says a sentence like this when the DOCUMENT
 * will not write (docs/34 §2.4 law 2, "a failed write is said out loud"). A
 * photograph failing is the same trouble one layer down and gets the same
 * plain instruction, so a person meets one remedy, not two.
 */
export const STORAGE_REFUSED =
  'This device would not take the photograph — its storage may be full. Export a backup from Settings, then remove a few photographs.';

/** A photograph that would not save, read, or was never one of ours. */
export class PhotoError extends Error {}

/* ---------- naming ---------- */

/**
 * Ids are opaque strings, minted the way the rest of the app mints them (see
 * lib/wardrobe.tsx newId): Hermes ships no crypto.randomUUID and expo-crypto
 * is not among our dependencies — a new dependency is an owner decision.
 * Not a formula; no shared source exists for it.
 */
function mintName(ext: string): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `p-${Date.now().toString(36)}-${rand()}.${ext}`;
}

/** Only the encodings a camera or a picker actually hands us. */
const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFromMime(mime: string): string {
  return EXT_FOR_MIME[mime.toLowerCase()] ?? 'jpg';
}

function extFromUri(uri: string): string {
  // Strip a query or fragment before looking for the dot: a picker uri can
  // carry `?ext=JPG`, and a naive lastIndexOf would name the file
  // ".jpg?ext=JPG" — a file whose own extension is a sentence.
  const clean = uri.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  if (dot <= slash) return 'jpg';
  const ext = clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'jpg';
}

/* ---------- what a stored path is, and what it is not ---------- */

/** A string that IS a photograph rather than a pointer to one. */
export function isInlinePhoto(value: string): boolean {
  return /^data:/i.test(value ?? '');
}

/** The document directory as a uri with exactly one trailing slash. */
function documentUri(): string {
  const uri = Paths.document.uri;
  return uri.endsWith('/') ? uri : `${uri}/`;
}

/**
 * Read an `imageUrl` as a path under the document directory, or null if it
 * is not one of ours.
 *
 * Three shapes arrive here and all three are legitimate:
 *   - `photos/p-xxx.jpg` — what this module writes, and the answer.
 *   - a data: URI — a document written by the WEB app and pulled down by
 *     sync. Not a file; the caller renders it directly.
 *   - an absolute file:// uri — tolerated on the way in (an unsaved picker
 *     result, or a document written by an older build) and normalised back
 *     to a relative path when it genuinely sits under our document
 *     directory. Anywhere else on the disk is refused.
 *
 * `..` is refused outright, spelled with either slash. readPhotoAsDataUrl is
 * reachable from the export path, and an export must never become a way to
 * read the rest of the app sandbox out of the phone.
 */
export function storedPath(value: string): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (/^(data|https?|content|blob):/i.test(raw)) return null;

  let path = raw;
  const docUri = documentUri();
  if (path.startsWith(docUri)) path = path.slice(docUri.length);
  else if (/^(file|[a-z]+):\/\//i.test(path)) return null; // somewhere else entirely

  path = path.replace(/^\/+/, '');
  if (!path) return null;
  const segments = path.split(/[\\/]+/).filter(s => s.length > 0);
  if (segments.length === 0) return null;
  if (segments.some(s => s === '..' || s === '.')) return null;
  return segments.join('/');
}

/**
 * The absolute uri a stored value resolves to — what `<Image source={{ uri }}>`
 * needs. A data: URI comes back untouched, so ONE call site renders a
 * photograph whichever app wrote it. An unreadable value answers null and the
 * caller draws the flat instead of a broken frame.
 */
export function photoUri(value: string): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (isInlinePhoto(raw)) return raw;
  const path = storedPath(raw);
  if (path === null) return null;
  return `${documentUri()}${path}`;
}

/* ---------- the folder ---------- */

function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  // idempotent: safe to call every time, so there is no exists-check race and
  // no "have we set up yet" flag that can drift out of step with the disk.
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/* ---------- writing ---------- */

const DATA_URL = /^data:([^;,]*)(;[^,]*)?,/i;

/**
 * Put a photograph on the disk and answer with the path to store in
 * `item.imageUrl`.
 *
 * Two kinds of source, because two things hand this app photographs:
 *   - a picker or camera result's `uri` — COPIED, because expo-image-picker
 *     writes into the CACHE directory, which the OS empties whenever it
 *     likes. A wardrobe whose photographs vanish on a low-storage warning is
 *     precisely the bug this copy exists to prevent.
 *   - a `data:` URI — written out, so a photograph that arrived inline (a
 *     web document opened here, an intake handoff) becomes a file like any
 *     other and the document can honestly say 'file'.
 *
 * Throws PhotoError carrying the house's storage sentence when the disk
 * refuses. Deliberately NOT swallowed: a photograph silently not saved is
 * the one failure a person cannot see until the day they go looking for it.
 */
export async function savePhoto(dataUrlOrUri: string): Promise<string> {
  const source = (dataUrlOrUri ?? '').trim();
  if (!source) throw new PhotoError('There was no photograph to save.');

  const inline = DATA_URL.exec(source);
  if (inline) {
    const mime = (inline[1] || 'image/jpeg').toLowerCase();
    if (!/;base64/i.test(inline[2] ?? '')) {
      throw new PhotoError('That photograph is not in a form this app can save.');
    }
    const base64 = source.slice(inline[0].length);
    if (!base64) throw new PhotoError('That photograph arrived empty.');
    const name = mintName(extFromMime(mime));
    try {
      const file = new File(photosDirectory(), name);
      file.create({ intermediates: true, overwrite: true });
      file.write(base64, { encoding: 'base64' });
    } catch {
      throw new PhotoError(STORAGE_REFUSED);
    }
    return `${PHOTO_DIR}/${name}`;
  }

  const name = mintName(extFromUri(source));
  try {
    const destination = new File(photosDirectory(), name);
    await new File(source).copy(destination);
  } catch {
    throw new PhotoError(STORAGE_REFUSED);
  }
  return `${PHOTO_DIR}/${name}`;
}

const MIME_FOR_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** The media type a stored file's own extension claims. */
export function mimeFor(path: string): string {
  return MIME_FOR_EXT[extFromUri(path)] ?? 'image/jpeg';
}

/* ---------- reading ---------- */

/**
 * A stored photograph as a data URI — the export path, and the shape the AI
 * relay wants.
 *
 * A value that is ALREADY inline comes straight back: a document pulled down
 * from a wardrobe the web app writes holds data URIs, and an export of it
 * must carry them through untouched rather than fail for not being a file.
 *
 * A path whose file is GONE answers with the empty string, which is what "no
 * photograph" has meant in every `imageUrl` in this app since the first
 * commit. The alternative — throwing — lets one swept file take the whole
 * backup down with it, and a backup missing one photograph is enormously
 * better than no backup at all. The ledger is the irreplaceable part.
 */
export async function readPhotoAsDataUrl(value: string): Promise<string> {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (isInlinePhoto(raw)) return raw;

  const path = storedPath(raw);
  if (path === null) return '';

  try {
    const file = new File(Paths.document, path);
    if (!file.exists) return '';
    const base64 = await file.base64();
    if (!base64) return '';
    return `data:${mimeFor(path)};base64,${base64}`;
  } catch {
    return '';
  }
}

/* ---------- removing ---------- */

/**
 * Take a photograph off the disk.
 *
 * Idempotent by design and quiet about absence: this is called when a piece
 * loses its photograph, when a photograph is replaced, and when a piece
 * leaves the closet — three paths that can reach the same file, and a second
 * delete must not be an error somebody has to read. A data URI has no file
 * behind it and is a no-op.
 */
export async function removePhoto(value: string): Promise<void> {
  const path = storedPath(value ?? '');
  if (path === null) return;
  try {
    const file = new File(Paths.document, path);
    if (file.exists) file.delete();
  } catch {
    // A file that will not delete is a few wasted hundred kilobytes, not a
    // thing to interrupt somebody over. The record above it is already right.
  }
}
