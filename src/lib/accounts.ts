import {
  EMPTY_COMMUNITY,
  type Account,
  type AppState,
  type CommunityState,
  type Theme,
} from '@almari/shared/types';
import { todayLocal } from '@almari/shared/dates';
import { noteWriteRefused } from '../hooks/useLocalStorage';

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
/**
 * THE KEYS KEEP THE OLD NAME, ON PURPOSE.
 *
 * This app was called Toile until it was called Almari. These strings were not
 * renamed with it, because they are the addresses of wardrobes that already
 * exist on people's devices: change the prefix and every one of them is orphaned
 * on the next load, and migrating them would be rewriting somebody's whole
 * closet in order to tidy a string nobody ever sees. The name is on the outside
 * of the box. This is the label on the shelf it has always sat on.
 */
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
    // Quota exceeded or storage disabled — the in-memory state stays usable,
    // and this used to be the end of it. The refusal now goes on the write
    // ledger instead of being swallowed, so an action still waiting to
    // confirm itself can never say "saved" over a device that said no.
    noteWriteRefused();
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
 * The rooms, in the order the theme control walks them. The house opens in the
 * dye house and steps into the obsidian next; the rest follow.
 *
 * The default is the first entry rather than a second constant, so the default
 * and the cycle order cannot drift apart — they used to, and an unknown stored
 * theme hit indexOf === -1 and wrapped the cycler to 'system'.
 */
export const THEME_ORDER = ['dyehouse', 'obsidian', 'dark', 'salon', 'gilt', 'light', 'system'] as const;

export const DEFAULT_THEME: Theme = THEME_ORDER[0];

/**
 * The theme is a property of the screen, not of a wardrobe. Keeping it in
 * AppSettings meant opening a different closet could flip the whole interface
 * from dark to light mid-session.
 */
export function loadTheme(): Theme {
  const stored = read<{ theme?: Theme }>(THEME_KEY, {}).theme;
  return (THEME_ORDER as readonly string[]).includes(stored as string)
    ? (stored as Theme)
    : DEFAULT_THEME;
}

export function saveTheme(theme: Theme): void {
  write(THEME_KEY, { theme });
}

/**
 * Stamped on the root element. Called once before React mounts as well as from
 * the session, so no load starts in the light room and flips a beat later.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** The next room along, from wherever we are. */
export function nextTheme(theme: Theme): Theme {
  const at = (THEME_ORDER as readonly string[]).indexOf(theme);
  return THEME_ORDER[(at + 1) % THEME_ORDER.length];
}

/** When a wardrobe was last opened. Stored beside the registry, not inside it. */
const OPENED_KEY = 'toile-opened';

export function lastOpenedAt(accountId: string): string | null {
  return read<Record<string, string>>(OPENED_KEY, {})[accountId] ?? null;
}

export function stampOpened(accountId: string): void {
  const all = read<Record<string, string>>(OPENED_KEY, {});
  all[accountId] = new Date().toISOString();
  write(OPENED_KEY, all);
}

/** Most recently opened first; never opened sorts last, by name. */
export function byLastOpened(a: Account, b: Account): number {
  const at = lastOpenedAt(a.id);
  const bt = lastOpenedAt(b.id);
  if (at && bt) return bt.localeCompare(at);
  if (at) return -1;
  if (bt) return 1;
  return a.name.localeCompare(b.name);
}

/** "Wardrobe", then "Wardrobe 2" — so a blank name is never a dead end. */
export function uniqueWardrobeName(base: string, accounts: Account[]): string {
  const taken = new Set(accounts.map(a => a.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 500; n++) {
    const tried = `${base} ${n}`;
    if (!taken.has(tried.toLowerCase())) return tried;
  }
  return `${base} ${Date.now()}`;
}

/** A handle derived from whatever name was finally used. */
export function handleFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return `@${slug || 'wardrobe'}`;
}

/** Is there a pre-accounts closet still waiting to be adopted? */
export function hasLegacyWardrobe(): boolean {
  try {
    return window.localStorage.getItem(LEGACY_KEY) !== null;
  } catch {
    return false;
  }
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
    createdAt: todayLocal(),
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
