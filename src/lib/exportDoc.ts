import { SCHEMA_VERSION, type AppState } from '@almari/shared/types';
import { migrate } from '@almari/shared/migrate';

/**
 * THE EXPORT DOCUMENT — what a backup file is, and nothing about how it is
 * downloaded.
 *
 * Pure on purpose. No React, no DOM, no Blob, no localStorage: the native app
 * has none of those and must write byte-identical files, so the document logic
 * lives here and the two apps supply only the plumbing around it. This module
 * is bound for packages/shared.
 *
 * The promise it keeps is the one in CLAUDE.md: lossless export forever. A file
 * written by a newer build must survive being opened by an older one and
 * exported again with nothing thrown away.
 */

/**
 * The fields a backup carries. An ALLOWLIST, and that is the whole point.
 *
 * This used to be a denylist — `DERIVED_KEYS = new Set(['activeItems'])`, in
 * Settings.tsx, filtering the React context. A denylist has to be exhaustive to
 * work, so every value added to the context afterwards leaked into every backup
 * silently until somebody noticed. Something did: the context also carries
 * `packedItemIds`, a ReadonlySet, which is not a function and was not named in
 * the denylist, so it passed the filter — and JSON.stringify writes a Set as
 * `{}`. Every backup this app has ever written carries a spurious
 * `"packedItemIds": {}`.
 *
 * Inverted, the failure mode inverts with it. Forgetting a field here OMITS it,
 * which the pinned list in scripts/test-export.mjs catches on the next run.
 * Leaking one is no longer possible, because a name that is not written down
 * here is not written to the file.
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
 * Adding a field to AppState without naming it above stops the build here
 * rather than quietly dropping that field out of every backup from then on.
 * The check runs one way only — a name may be listed before the field exists,
 * which is how a field lands in the same wave as the export that carries it.
 */
export const EXPORTED_KEYS_COVER_APP_STATE:
  [Exclude<keyof AppState, ExportedKey>] extends [never] ? true : never = true;

/**
 * The one value this build computes that is shaped exactly like a record.
 *
 * `activeItems` is items-minus-retired: an array of plain objects, structurally
 * indistinguishable from a field a future build might actually store. Nothing
 * but its name can rule it out, so its name is here. It is the only entry, and
 * the reason the list can stay this short is that everything else the context
 * adds — the callbacks, the Sets — is refused by shape below, not by name.
 */
const COMPUTED_KEYS = new Set<string>(['activeItems']);

/**
 * Is this value something a FILE could have carried?
 *
 * The gate for keys this build has never heard of. A newer build's field must
 * ride out again untouched, but it can only ever have arrived as parsed JSON:
 * a string, number, boolean, null, array, or plain object. A function, a Set, a
 * Map, a Date, a class instance — those are things a runtime made, and a
 * runtime's private furniture has no business in a backup. This is what makes
 * the packedItemIds leak unrepeatable: it fails here on being a Set, with
 * nobody having had to predict it.
 */
function isFileData(value: unknown): boolean {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (t !== 'object') return false;
  if (Array.isArray(value)) return value.every(isFileData);
  // Object.create(null) and {} are both plain; anything with a constructor of
  // its own (Set, Map, Date, Blob) is not.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isFileData);
}

/** A backup file, parsed. Known fields plus whatever a newer build wrote. */
export type ExportDoc = Record<string, unknown> & { schemaVersion: number; exportedAt: string };

/**
 * Build the document from anything AppState-shaped — including the React
 * context, which spreads the state alongside its callbacks and its two derived
 * values. Absent fields are omitted rather than written as null, so a backup
 * from a build that has no `photoEncoding` simply has no such line.
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
 * THE FIRST DOOR OFF THIS DEVICE, and the rule it must keep.
 *
 * A photograph no longer has to be in the record to be in the wardrobe: the
 * web app can keep it in IndexedDB and leave `idb:<id>` behind (src/lib/
 * photoStore.ts), and the native app keeps it as a file on disk and leaves a
 * path. Both of those are DEVICE-LOCAL names. A backup file is opened on a
 * desktop, by a different build, in a year — nothing on the other side of that
 * file can dereference either one.
 *
 * So an exported document inlines. Every reference is resolved back to the
 * data URL it names before a byte is written, and the file that lands is the
 * file this app has always written: pictures in the document, openable by the
 * web app and the native app unchanged, in both directions.
 *
 * WHY THE RESOLVER IS AN ARGUMENT AND NOT AN IMPORT. This module is pure by
 * contract — no React, no DOM, no Blob, no localStorage — because the native
 * app must write byte-identical files and has none of those. Reaching for
 * IndexedDB from here would end that, and it would also be wrong: native's
 * references are file paths, not `idb:` ids, and its inliner reads them with
 * expo-file-system. Two apps, two ways to dereference, one document rule. The
 * rule is here; the dereferencing is handed in.
 *
 * `inline` is given the BUILT document, so it can never widen the allowlist,
 * reinstate a key the builder refused, or see the callbacks and Sets that the
 * React context carries. Whatever it hands back is what goes on disk.
 */
export type DocInliner = (doc: ExportDoc) => Promise<ExportDoc>;

/** Build the document, then let the caller's inliner dereference it. */
export async function buildExportDocAsync(
  source: object,
  exportedAt: string,
  inline: DocInliner,
): Promise<ExportDoc> {
  const doc = buildExportDoc(source, exportedAt);
  const inlined = await inline(doc);
  // The two stamps are this build's statement about the file and are not the
  // inliner's to change — it is a dereferencer, not an author.
  return { ...inlined, schemaVersion: doc.schemaVersion, exportedAt: doc.exportedAt };
}

/** The inlined document as it goes on disk. The one a browser download uses. */
export async function exportDocTextAsync(
  source: object,
  exportedAt: string,
  inline: DocInliner,
): Promise<string> {
  return JSON.stringify(await buildExportDocAsync(source, exportedAt, inline), null, 2);
}

/**
 * Read a backup. Throws if the text is not JSON — the caller says so in its own
 * words. migrate() carries every older shape forward and keeps unknown fields.
 */
export function readExportDoc(text: string): AppState {
  return migrate(JSON.parse(text));
}

/** 'almari-backup-2026-08-19.json'. `day` is a local YYYY-MM-DD, never UTC. */
export function exportFileName(day: string): string {
  return `almari-backup-${day}.json`;
}
