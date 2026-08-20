/**
 * THE LEDGER'S ADDRESSES, in one place.
 *
 *   /ledger   the room — the closet's accounts
 *
 * It is a HOUSE DOOR, not a bar slot: the bar holds four rooms this season
 * (docs/42 §1) and the arithmetic is something you go and read, never
 * something the house asks you about. So the way back is the House, and the
 * empty room's one way on is the Closet, where a piece and its price are
 * actually entered.
 *
 * THE ONE CAST IN THIS FEATURE, and why it is confined here — the same reason
 * the dressing room and the outfits room each state. expo-router's typed
 * routes build their union in app/.expo/types/router.d.ts, which is GENERATED
 * by a running dev server; a route added while no server is watching is not in
 * that union yet, so `router.push('/ledger')` is a type error about a file the
 * compiler is right about and the app is not. Keeping the cast in one module
 * means that when the union regenerates, deleting three `as` keywords is the
 * whole clean-up and no screen moves.
 */
import type { Href } from 'expo-router';

const href = (path: string): Href => path as unknown as Href;

/** The room. */
export const LEDGER: Href = href('/ledger');

/** The House — where this room is entered from, and where "back" means. */
export const HOUSE: Href = href('/profile');

/** The Closet — where a piece, and the price on it, are actually entered. */
export const CLOSET: Href = href('/closet');
