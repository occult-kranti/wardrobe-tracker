/**
 * The feed's resolution grammar — MIRRORED from the web, never imported.
 *
 * SOURCES OF TRUTH (read 2026-08-19, restated by hand per the mirroring law —
 * web files never cross into app/):
 *   - src/components/social.tsx  → newestFirst / oldestFirst / postTime /
 *     qualifiesForRail / railDecks / resolveFeedEntries / shortDate /
 *     sharedCategoryLabel
 *   - src/lib/communitySeed.ts   → normalizeCommunity
 *
 * The TYPES and postVisibleTo come from @almari/shared — those are the one
 * source, not a mirror. If a semantic here drifts from the web file it names,
 * the web file wins and this one gets fixed.
 */
import {
  DEFAULT_CATEGORIES,
  postVisibleTo,
  type Account,
  type CommunityState,
  type FeedPost,
} from '@almari/shared/types';

import type { ThemeTokens } from '../../tokens/themes';

/** A post and its author, resolved together. What every social surface renders. */
export interface FeedEntry {
  post: FeedPost;
  author: Account;
}

/**
 * Comparators that tolerate a record with no date — mirrors social.tsx.
 * `at` (sub-day) leads `date`; the id breaks every tie so order is stable.
 */
export function newestFirst<T extends { date?: string; at?: string; id: string }>(a: T, b: T): number {
  const t = (b.at ?? '').localeCompare(a.at ?? '');
  if (t !== 0) return t;
  const d = (b.date ?? '').localeCompare(a.date ?? '');
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

export function oldestFirst<T extends { date?: string; at?: string; id: string }>(a: T, b: T): number {
  const t = (a.at ?? '').localeCompare(b.at ?? '');
  if (t !== 0) return t;
  const d = (a.date ?? '').localeCompare(b.date ?? '');
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

/**
 * 'YYYY-MM-DD' → '9 Aug' — the en-IN shape the web states (day before month,
 * owner decision 2026-08-19). Stated as a table rather than Intl so Hermes,
 * jest and the web cannot disagree about a locale's spelling.
 */
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/**
 * The name of a category on someone else's piece — house defaults, never the
 * reader's own renames (mirrors social.tsx sharedCategoryLabel).
 */
export function sharedCategoryLabel(id: string): string {
  return DEFAULT_CATEGORIES.find(c => c.id === id)?.label ?? id;
}

/**
 * A stored blob written before tombstones and save marks existed carries
 * neither key — every read funnels through here so a take-down cannot
 * resurrect (mirrors communitySeed.ts normalizeCommunity).
 */
export function normalizeCommunity(state: CommunityState): CommunityState {
  return {
    ...state,
    removedPostIds: Array.isArray(state.removedPostIds) ? state.removedPostIds : [],
    savedPostIds: Array.isArray(state.savedPostIds) ? state.savedPostIds : [],
  };
}

/**
 * Post AND author, resolved together, once — the one list the masthead, the
 * rail, the cards and the story viewer all read, so no surface can drift on
 * what is visible (mirrors social.tsx resolveFeedEntries exactly).
 */
export function resolveFeedEntries(
  accounts: Account[],
  community: CommunityState,
  activeId: string | null
): FeedEntry[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  return community.posts
    .filter(p => {
      if (!p || !p.scope) return false;
      if (!p.look && !p.piece && !p.caption) return false;
      if (!byId.has(p.authorId)) return false;
      try {
        return postVisibleTo(p, activeId, community.conversations, community.households);
      } catch {
        return false;
      }
    })
    .map(post => ({ post, author: byId.get(post.authorId)! }))
    .sort((a, b) => newestFirst(a.post, b.post));
}

/* ------------------------------ the story rail ------------------------------
   "On show in the last day." Membership is COMPUTED at render — nothing is
   written, nothing expires from storage, no seen-state exists anywhere.
   Mirrors social.tsx RAIL_WINDOW_MS / postTime / qualifiesForRail / railDecks. */

export const RAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** When a post happened, ms — `at` if stamped, else that day's local midnight. */
export function postTime(post: { at?: string; date?: string }): number {
  return Date.parse(post.at ?? `${post.date ?? ''}T00:00:00`);
}

/** Under 24 hours old, by local time — a day-granular post is that day's story. */
export function qualifiesForRail(post: { at?: string; date?: string }, now: number): boolean {
  const t = postTime(post);
  return Number.isFinite(t) && now - t < RAIL_WINDOW_MS;
}

export interface StoryDeck {
  author: Account;
  /** Oldest → newest: the honest telling of a day. */
  posts: FeedPost[];
}

/**
 * One deck per author with a qualifying post. "Yours" first, then authors by
 * their newest qualifying post — reverse-chron, the whole algorithm.
 */
export function railDecks(entries: FeedEntry[], activeId: string | null, now: number): StoryDeck[] {
  const byAuthor = new Map<string, StoryDeck>();
  for (const { post, author } of entries) {
    if (!qualifiesForRail(post, now)) continue;
    const deck = byAuthor.get(author.id) ?? { author, posts: [] };
    deck.posts.push(post);
    byAuthor.set(author.id, deck);
  }
  const decks = [...byAuthor.values()];
  for (const deck of decks) deck.posts.sort(oldestFirst);
  decks.sort((a, b) => {
    if (a.author.id === activeId) return -1;
    if (b.author.id === activeId) return 1;
    return newestFirst(a.posts[a.posts.length - 1], b.posts[b.posts.length - 1]);
  });
  return decks;
}

/* ------------------------------ the asset seam ------------------------------
   docs/34 §2.8: community/persona photographs are web-relative paths
   ('wardrobe/meher/MK-17.webp') that resolve against the built site's origin.
   RN's Image has no origin — handed such a path it renders NOTHING, silently.
   A native card must never show a broken image, so anything without a scheme
   RN can fetch falls back to the typographic specimen card. */

const RENDERABLE_SCHEME = /^(https?|data|file|content|asset):/i;

/** Can RN's Image actually render this string? Empty and web-relative cannot. */
export function isRenderableImageUri(uri: string | undefined): uri is string {
  return typeof uri === 'string' && RENDERABLE_SCHEME.test(uri);
}

/**
 * Registry rows (and the web's sample accounts) carry token NAMES for their
 * tag colour — 'var(--color-accent)' — because the row is data shared with
 * the web, not a resolved pixel. Native resolves the name in the room it is
 * drawn in; an unknown name falls back to the room's gold thread.
 */
export function accountColor(color: string | undefined, tokens: ThemeTokens): string {
  switch (color) {
    case 'var(--color-accent)':
      return tokens.accent;
    case 'var(--color-success)':
      return tokens.success;
    case 'var(--color-gold)':
      return tokens.gold;
    case 'var(--color-warning)':
      return tokens.warning;
    default:
      return typeof color === 'string' && color.startsWith('#') ? color : tokens.gold;
  }
}
