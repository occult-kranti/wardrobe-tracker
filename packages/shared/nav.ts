/**
 * THE ROSTERS — native bindings and the web alpha's four main addresses.
 *
 * docs/42 §7 and its 2026-09-07 web amendment. NAV_SLOTS keeps the native
 * screen and icon bindings stable; the native bar's pager pages,
 * its swipe adjacency and the eyelet's stops are the same array again, which is
 * what makes "the bar and the page you land on agree" a property of the data
 * rather than of somebody's care.
 *
 * Each app binds its own icon component by `key` — the words and the addresses
 * live here, the drawing does not. Native maps path to screen name
 * ('/' -> index, '/closet' -> closet, '/feed' -> feed, '/chats' -> chats,
 * '/profile' -> profile).
 *
 * ADDRESSES NEVER MOVE. The fifth slot says House and lives at /profile,
 * because a deep link should be the same sentence on every surface and in
 * every message anyone ever sent. Only the slot label and the masthead were
 * rehung.
 *
 * GEOMETRY LAW: native measures barSlots(), web measures webBarSlots().
 * Four slots are four generous drawers of a complete chest — no
 * spacer, no ghost cell, no disabled slot where the Look Book will sit.
 */
import { FEED_ENABLED } from './flags';

export interface NavSlot {
  key: string;
  path: string;
  label: string;
  /** For rails too narrow for the full label. */
  shortLabel?: string;
  /** Seated by FEED_ENABLED — absent from the bar while the flag is off. */
  flagged?: boolean;
}

/** The bar in order; the centre slot belongs to the flag. */
export const NAV_SLOTS: NavSlot[] = [
  { key: 'today',    path: '/',        label: 'Today' },
  { key: 'closet',   path: '/closet',  label: 'Closet' },
  { key: 'lookbook', path: '/feed',    label: 'Look Book', shortLabel: 'Looks', flagged: true },
  { key: 'chats',    path: '/chats',   label: 'Conversations', shortLabel: 'Chats' },
  { key: 'house',    path: '/profile', label: 'House' },
];

export const barSlots = () => NAV_SLOTS.filter(s => !s.flagged || FEED_ENABLED);

/**
 * The web alpha puts saved outfits within one tap. Its fifth cell is More,
 * where Profile always lives and Chats lives when the Look Book is enabled.
 * Keep the native roster above intact: it has no Outfits tab screen yet.
 */
export function webBarSlots(): NavSlot[] {
  return [
    NAV_SLOTS[0],
    NAV_SLOTS[1],
    NAV_SLOTS[FEED_ENABLED ? 2 : 3],
    { key: 'outfits', path: '/outfits', label: 'Outfits' },
  ];
}

/** The roster's words for an address, or undefined where it seats no slot. */
export function slotFor(path: string): NavSlot | undefined {
  return NAV_SLOTS.find(s => s.path === path);
}
