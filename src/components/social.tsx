import { Link, useNavigate } from 'react-router-dom';
import {
  DEFAULT_CATEGORIES, SCOPE_LABELS, postVisibleTo,
  type Account, type CommunityState, type FeedPost, type SharedLook, type SharedPiece,
} from '@almari/shared/types';
import { formatLocalDate } from '@almari/shared/dates';
import { Basting, GarmentPlate, TagPortrait } from './art';
import { Button, Card, Chip, IconButton } from './ui';
import { IconBookmark, IconPlus } from './icons';

/**
 * The pieces every social surface shares, so a look shown in the feed, in a
 * chat, on a profile and against an event all read as the same object.
 */

/** A garment tag bearing a monogram, or the wardrobe's portrait. Never a face. */
export function AccountMark({ account, size = 36 }: { account: Account; size?: number }) {
  if (account.portrait) {
    return (
      <span
        className="block shrink-0 bg-mat overflow-hidden rounded-[2px]"
        style={{ width: size, height: size * 1.25 }}
      >
        <img src={account.portrait} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return <TagPortrait monogram={account.monogram} color={account.color} size={size} />;
}

export function AccountLine({ account, meta }: { account: Account; meta?: string }) {
  return (
    // min-w-0 on the link itself: without it a long wardrobe name shoves the
    // row's right-hand controls off a 390px screen instead of truncating.
    <Link to={`/profile/${account.id}`} className="flex items-center gap-2.5 min-h-11 min-w-0 group">
      <AccountMark account={account} size={26} />
      <span className="min-w-0">
        <span className="block text-[14px] text-text group-hover:underline underline-offset-[3px] truncate">
          {account.name}
        </span>
        <span className="type-ledger text-[11px] text-text-2 block tabular">
          {account.handle}
          {meta ? ` · ${meta}` : ''}
        </span>
      </span>
    </Link>
  );
}

/**
 * A shared look. The photograph and piece names are a SNAPSHOT taken when it was
 * shared — the viewer's app cannot reach into someone else's closet, and a look
 * someone already saw should not silently change under them.
 */
export function LookCard({ look, compact }: { look: SharedLook; compact?: boolean }) {
  // A snapshot with no piece list threw on `.length` during render and blanked
  // the ENTIRE app — feed, navigation, no way out. A missing field in someone
  // else's record must never be able to do that.
  const pieces = look.pieces ?? [];
  const name = look.name || 'A look';
  return (
    <div className={`border border-border rounded-[2px] overflow-hidden ${compact ? 'flex gap-3' : ''}`}>
      {/* Capped: uncapped w-full inside the max-w-5xl column rendered each post
          ~950×1267px, and eleven posts made a 16,000px page. The photograph is
          a feed entry, not a hero. */}
      <span
        className={`block bg-mat overflow-hidden shrink-0 ${compact ? 'w-16' : 'w-full max-w-[380px] mx-auto'}`}
        style={{ aspectRatio: '4 / 5' }}
      >
        {look.imageUrl ? (
          <img src={look.imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <GarmentPlate categoryId="dresses" />
        )}
      </span>
      <div className={compact ? 'py-2 pr-3 min-w-0' : 'p-3'}>
        <p className={`text-text leading-snug ${compact ? 'text-[14px] truncate' : 'text-[15px]'}`}>
          {name}
        </p>
        {look.occasion ? (
          <p className="type-ledger text-[11px] text-text-2 mt-1 line-clamp-1">{look.occasion}</p>
        ) : null}
        {!compact && pieces.length > 0 ? (
          <p className="type-ledger text-[11px] text-text-2 mt-2 leading-relaxed">
            {pieces.join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The 4:5 tile the feed and the profile grid share — the photograph of the
 * look, or the drawn flat when there is none. Flat mat behind it either way;
 * nothing decorative goes behind a photo.
 */
export function LookThumb({ look, alt }: { look: SharedLook; alt?: string }) {
  return (
    <span className="block w-full bg-mat overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
      {look.imageUrl ? (
        <img src={look.imageUrl} alt={alt ?? look.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <GarmentPlate categoryId="dresses" />
      )}
    </span>
  );
}

export function PieceCard({ piece }: { piece: SharedPiece }) {
  return (
    <div className="border border-border rounded-[2px] flex gap-3 items-center overflow-hidden">
      <span className="block w-14 bg-mat overflow-hidden shrink-0" style={{ aspectRatio: '4 / 5' }}>
        {piece.imageUrl ? (
          <img src={piece.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <GarmentPlate categoryId={piece.category ?? 'accessories'} color={piece.color} name={piece.name} />
        )}
      </span>
      <span className="py-2 pr-3 min-w-0">
        <span className="block text-[14px] text-text truncate">{piece.name || 'A piece'}</span>
        {piece.category ? (
          <span className="type-ledger text-[11px] text-text-2 block mt-0.5">
            {sharedCategoryLabel(piece.category)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The name of a category on someone else's piece.
 *
 * Read from the house defaults, never from the reader's own settings — the
 * piece belongs to another wardrobe, and a reader who renamed 'dresses' has
 * not renamed it for them. An id we do not know passes through verbatim.
 * This used to print the raw id: 'dresses' where 'One-pieces' was meant.
 */
export function sharedCategoryLabel(id: string): string {
  return DEFAULT_CATEGORIES.find(c => c.id === id)?.label ?? id;
}

/**
 * 'YYYY-MM-DD' → '9 Aug'. Local, never parsed as UTC — and en-IN, the house
 * locale (owner decision 2026-08-19): day before month, the way the date is
 * said here. One function, so the feed, chats, events and profiles agree.
 */
export function shortDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * 'YYYY-MM-DDTHH:MM:SS', local — the sub-day stamp a post's or message's `at`
 * carries. Local like every date in the app: toISOString is UTC, which reads
 * as tomorrow for half the evening west of Greenwich and scrambles same-day
 * order for everyone else.
 */
export function nowLocalStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${formatLocalDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Comparators that tolerate a record with no date.
 *
 * An undated row used to be enough to throw inside the sort and blank the page
 * it was on. Undated sorts last, and the id breaks every tie so the order is
 * stable between renders.
 *
 * `at` (sub-day time, stamped when a row is written) leads `date`: two posts
 * or messages from the same day used to fall through to the id tiebreak, which
 * for user content is a random UUID — same-day order reshuffled by chance.
 * Rows written before `at` existed carry only a date and sort behind the timed
 * rows of their day, which is the honest reading of "sometime that day".
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

/** A post and its author, resolved together. What every social page renders. */
export interface FeedEntry {
  post: FeedPost;
  author: Account;
}

/**
 * Post AND author, resolved together, once — shared by the feed, Explore and
 * the story rail so the three surfaces cannot drift apart on what is visible.
 * Explore is a rearrangement of the feed, never a wider aperture: consent
 * stays structural because this is the only door.
 *
 * Three faults lived in the gap between the list a masthead counted and the
 * list a map rendered (an authorless post, a scopeless post that threw, a
 * post carrying nothing at all); this one list is the fix for all three.
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

/* ============================== the story rail ==============================
   "On show in the last day." Membership is COMPUTED at render from the same
   resolved entries the feed shows — nothing is written, nothing is recorded,
   nothing expires from storage. After 24 hours only the rail forgets; the
   feed remembers. No seen-state exists anywhere: an accent ring that decays
   when you have watched is an unread badge, and those are banned. */

export const RAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** When a post happened, ms — `at` if stamped, else that day's local midnight. */
export function postTime(post: { at?: string; date?: string }): number {
  return Date.parse(post.at ?? `${post.date ?? ''}T00:00:00`);
}

/**
 * Does this post join the rail? Pure, so the boundary is unit-testable:
 * under 24 hours old, by local time — a day-granular post is that day's
 * story until its midnight has been 24 hours gone.
 */
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
 * The rail's decks: one per author with a qualifying post. "Yours" first,
 * then authors by their newest qualifying post, newest first — reverse-chron,
 * the whole algorithm. Within a deck the viewer plays oldest → newest.
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

/**
 * One slot on the rail. The opening is an EYELET — the brand's one sanctioned
 * circle, scaled up — and it holds a monogram, never a cropped photograph:
 * the photograph waits inside the viewer, in its 4:5 frame. Every eyelet
 * wears the same hairline; the rail's whole grammar is presence.
 */
export function StorySlot({
  to,
  name,
  monogram,
  ariaLabel,
  plus,
  onClick,
}: {
  to?: string;
  name: string;
  monogram?: string;
  ariaLabel: string;
  /** The waiting slot: a dashed eyelet holding a plus — a punched hole waiting for its thread. */
  plus?: boolean;
  onClick?: () => void;
}) {
  const eyelet = (
    <span
      className={`w-14 h-14 rounded-full bg-sunken border ${
        plus ? 'border-dashed' : ''
      } border-border outline outline-1 outline-border outline-offset-2 flex items-center justify-center text-text`}
    >
      {plus ? <IconPlus size={18} /> : <span className="type-ledger text-[15px]">{monogram}</span>}
    </span>
  );
  const label = (
    <span className="type-ledger text-[11px] text-text-2 w-16 truncate text-center">{name}</span>
  );
  const cls = 'w-16 flex flex-col items-center gap-1.5 py-1';
  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} className={cls}>
        {eyelet}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cls}>
      {eyelet}
      {label}
    </button>
  );
}

/* ================================ the card ================================
   The feed's card, extracted so the feed and Explore's detail render the one
   object. NO metrics anywhere: no counts, no "seen by", no reader-visible
   marks. The one engagement mechanic is the private set-aside bookmark,
   counted nowhere. */

export function PostCard({
  post,
  author,
  isMine,
  saved,
  onToggleSave,
  onTakeOff,
}: {
  post: FeedPost;
  author: Account;
  isMine: boolean;
  saved: boolean;
  onToggleSave: () => void;
  onTakeOff: () => void;
}) {
  const navigate = useNavigate();
  const look = post.look;
  const pieces = look?.pieces ?? [];

  /* The four verbs, placed where they can be true. On a post you did not
     write: Attach (show it into a conversation — moves nothing) and, on piece
     posts, Ask after it (a request, status `asked`). Share is the card's own
     existence. Lend stays in the conversation where the ask lives — only the
     owner lends, and a lend pressed on a feed card has no borrower to hand
     to. No verb ever grows a count. */
  const attach = () => {
    navigate('/chats', {
      state: { attach: post.piece ? { piece: post.piece } : { look } },
    });
  };
  const askAfter = () => {
    if (!post.piece) return;
    navigate('/chats', {
      state: { ask: { pieceName: post.piece.name, ownerId: post.authorId } },
    });
  };

  return (
    <Card padded={false}>
      {/* The look, first, at 4:5 in its own hairline plate — the flat is a
          first-class stand-in for a look never photographed. */}
      {look ? (
        <div className="p-2.5 pb-0">
          <div className="border border-border rounded-[2px] overflow-hidden">
            <LookThumb look={look} />
          </div>
        </div>
      ) : null}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AccountLine account={author} meta={shortDate(post.date)} />
            {/* A sample wardrobe says so on every post, in the same display
                chip the scope label wears — the fiction stays warm but
                legible (docs/35, owner decision 3). */}
            {author.isSample ? (
              <span className="shrink-0">
                <Chip as="span">sample wardrobe</Chip>
              </span>
            ) : null}
          </div>
          <IconButton
            label={saved ? `Put "${look?.name ?? 'this'}" back` : `Set "${look?.name ?? 'this'}" aside`}
            aria-pressed={saved}
            active={saved}
            onClick={onToggleSave}
            className="-mt-1.5 -mr-2 shrink-0"
          >
            <IconBookmark size={18} />
          </IconButton>
        </div>

        {post.caption ? (
          <p className="type-editorial text-[19px] sm:text-[20px] leading-snug text-balance mt-3">
            {post.caption}
          </p>
        ) : null}

        {post.piece ? (
          <div className="mt-3">
            <PieceCard piece={post.piece} />
          </div>
        ) : null}

        {look ? (
          <p className="type-ledger text-[11px] text-text-2 mt-3 leading-relaxed">
            {look.name}
            {look.occasion ? ` · ${look.occasion}` : ''}
            {pieces.length > 0 ? (
              <span className="block mt-1">{pieces.join(' · ')}</span>
            ) : null}
          </p>
        ) : null}

        {/* The scope chip and the take-down belong to the author alone —
            a reader is told nothing about a shelf they were handed. */}
        {isMine ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            {post.scope.kind !== 'everyone' ? (
              <Chip as="span">{SCOPE_LABELS[post.scope.kind].toLowerCase()}</Chip>
            ) : (
              <span />
            )}
            <Button compact onClick={onTakeOff}>Take it off the feed</Button>
          </div>
        ) : look || post.piece ? (
          <>
            <Basting className="my-3" />
            <div className="mt-3 flex items-center gap-3">
              {post.piece ? (
                <>
                  <Button compact onClick={askAfter}>Ask after it</Button>
                  <Button tone="tertiary" onClick={attach}>Attach</Button>
                </>
              ) : (
                <Button compact onClick={attach}>Attach</Button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
