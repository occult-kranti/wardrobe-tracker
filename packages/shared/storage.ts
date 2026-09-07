/** Canonical storage keys shared across web and native clients. */

/** Legacy single-wardrobe key (v1 migration source). */
export const LEGACY_KEY = 'wardrobe-tracker';

/** Account registry key. */
export const ACCOUNTS_KEY = 'toile-accounts';

/** Active session pointer key. */
export const SESSION_KEY = 'toile-session';

/** Community state key. */
export const COMMUNITY_KEY = 'toile-community';

/** Device theme key. */
export const THEME_KEY = 'toile-theme';

/** Tour/guide opened-screens key. */
export const OPENED_KEY = 'toile-opened';

/** Build a per-wardrobe storage key from an account ID. */
export function wardrobeKey(accountId: string): string {
  return `${LEGACY_KEY}:${accountId}`;
}

/** Generate a display handle from an account name. */
export function handleFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return `@${slug || 'wardrobe'}`;
}
