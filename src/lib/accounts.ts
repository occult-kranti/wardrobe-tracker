import {
  EMPTY_COMMUNITY,
  type Account,
  type AppState,
  type CommunityState,
  type Theme,
} from '../types';

/**
 * Where each wardrobe lives.
 *
 * One localStorage key per wardrobe, a small registry listing them, a session
 * key naming the open one, and one shared key for the things every wardrobe can
 * see. Nothing here reaches a network — switching accounts is opening a
 * different file on the same device, and the sign-in copy says so.
 *
 * Chosen over nesting every wardrobe inside one AppState because the app writes
 * the whole blob on every keystroke: with three closets of ~60 pieces, ~180 wear
 * logs and 20 outfits each, a single blob would rewrite ~600KB per character
 * typed into a note, and every page's selectors would need a filter that, if
 * ever missed, would silently pool three people's clothes into one Ledger total.
 */

export const LEGACY_KEY = 'wardrobe-tracker';
export const SESSION_KEY = 'toile-session';
export const ACCOUNTS_KEY = 'toile-accounts';
export const COMMUNITY_KEY = 'toile-community';
export const THEME_KEY = 'toile-theme';

export const wardrobeKey = (accountId: string) => `${LEGACY_KEY}:${accountId}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — the in-memory state stays usable.
  }
}

export function loadAccounts(): Account[] {
  const list = read<Account[]>(ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list.filter(a => a && typeof a.id === 'string') : [];
}

export function saveAccounts(accounts: Account[]): void {
  write(ACCOUNTS_KEY, accounts);
}

export function loadActiveId(): string | null {
  return read<{ activeId?: string }>(SESSION_KEY, {}).activeId ?? null;
}

export function saveActiveId(activeId: string | null): void {
  write(SESSION_KEY, { activeId });
}

/**
 * The theme is a property of the screen, not of a wardrobe. Keeping it in
 * AppSettings meant opening a different closet could flip the whole interface
 * from dark to light mid-session.
 */
export function loadTheme(): Theme {
  const stored = read<{ theme?: Theme }>(THEME_KEY, {}).theme;
  return stored === 'light' || stored === 'dark' || stored === 'salon' || stored === 'gilt' || stored === 'dyehouse' || stored === 'obsidian' || stored === 'system'
    ? stored
    // V2 wakes up in the obsidian — the room the glass was cut for.
    : 'obsidian';
}

export function saveTheme(theme: Theme): void {
  write(THEME_KEY, { theme });
}

export function loadCommunity(): CommunityState {
  const raw = read<Partial<CommunityState>>(COMMUNITY_KEY, {});
  return {
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    conversations: Array.isArray(raw.conversations) ? raw.conversations : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    households: Array.isArray(raw.households) ? raw.households : [],
    passes: Array.isArray(raw.passes) ? raw.passes : [],
  };
}

export function saveCommunity(state: CommunityState): void {
  write(COMMUNITY_KEY, state);
}

export function loadWardrobe(accountId: string): unknown {
  return read<unknown>(wardrobeKey(accountId), null);
}

export function saveWardrobe(accountId: string, state: AppState): void {
  write(wardrobeKey(accountId), state);
}

export function forgetWardrobe(accountId: string): void {
  try {
    window.localStorage.removeItem(wardrobeKey(accountId));
  } catch {
    /* storage disabled */
  }
}

/**
 * Anyone who used this app before it had accounts has a closet at the bare
 * 'wardrobe-tracker' key. It is adopted into an account rather than orphaned —
 * losing someone's catalogued closet to a refactor would break the one promise
 * this project keeps above all others.
 */
export function adoptLegacyWardrobe(): Account | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const account: Account = {
    id: 'you',
    name: 'Your wardrobe',
    handle: '@you',
    monogram: 'Y',
    color: 'var(--color-accent)',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  try {
    window.localStorage.setItem(wardrobeKey(account.id), raw);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    return null;
  }
  return account;
}

export { EMPTY_COMMUNITY };
