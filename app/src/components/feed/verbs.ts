/**
 * The four verbs, as the feed can speak them (toile-social):
 *
 *   Show ("Attach")   — a snapshot into one message; moves nothing.
 *   Share             — the card's own existence; there is no Share button.
 *   Ask ("Ask after it") — a request on a message, status `asked`; piece posts only.
 *   Lend              — lives in the conversation where the ask lives; only the
 *                       owner lends, so a feed card never carries it. Both
 *                       absences mirror the web PostCard exactly.
 *
 * THE PARAMS CONTRACT — mirrored from src/pages/Feed.tsx + social.tsx: the web
 * hands chats `location.state.attach = { piece } | { look }` and
 * `location.state.ask = { pieceName, ownerId }`. Router params on native are
 * strings, so the same objects ride JSON-encoded under the same keys. The
 * chats squad decodes with `JSON.parse(params.attach)` / `params.ask` and
 * meets the web's own shapes.
 *
 * `/chats` HAS NO ROUTE IN THIS BUILD: the tab shell is Today / Closet /
 * Look Book / Settings. The builders below are the finished contract; the
 * buttons say plainly that the room is not built rather than walking a tester
 * into an unmatched-route screen.
 */
import type { FeedPost, SharedLook, SharedPiece } from '@almari/shared/types';

export const CHATS_PATH = '/chats';

export interface ChatsHref {
  pathname: typeof CHATS_PATH;
  params: Record<string, string>;
}

/** Show it into a conversation — the web's `attach` state, JSON-encoded. */
export function attachHref(post: FeedPost): ChatsHref {
  const attach: { piece?: SharedPiece; look?: SharedLook } = post.piece
    ? { piece: post.piece }
    : { look: post.look };
  return { pathname: CHATS_PATH, params: { attach: JSON.stringify(attach) } };
}

/** Ask after a piece — the web's `ask` state, JSON-encoded. Piece posts only. */
export function askHref(post: FeedPost): ChatsHref | null {
  if (!post.piece) return null;
  return {
    pathname: CHATS_PATH,
    params: { ask: JSON.stringify({ pieceName: post.piece.name, ownerId: post.authorId }) },
  };
}
