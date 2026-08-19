import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, Chip, EmptyState, IconButton, Masthead, SectionTitle } from '../components/ui';
import { showToast } from '../components/Toast';
import { Basting, PlateEmptyOutfits } from '../components/art';
import { AccountLine, LookThumb, PieceCard, shortDate, newestFirst } from '../components/social';
import { SCOPE_LABELS, postVisibleTo, type FeedPost, type Account } from '../types';
import { LinkButton } from '../components/ui';
import { IconBookmark } from '../components/icons';

/**
 * THE FEED — what the wardrobes on this device have put on show.
 *
 * Deliberately not a performance surface. There are no likes, no counts, no
 * followers, no "seen by", no unread marks, and no ranking: posts are in the
 * order they were shared, newest first, and that is the whole algorithm. The
 * panel rejected the social graph because it turns a wardrobe into a stage; a
 * shared rail between people who already know each other is the thing that
 * survives that objection, and every absent feature above is what keeps it one.
 *
 * The one engagement mechanic is the set-aside mark — private to this device,
 * counted nowhere. Setting a look aside is keeping its place, not applauding
 * it, and no one else ever learns that you did.
 */
export default function Feed() {
  const { accounts, community, activeId, setCommunity } = useSession();
  const { outfits } = useWardrobe();
  const [savedOnly, setSavedOnly] = useState(false);

  const savedIds = useMemo(() => new Set(community.savedPostIds ?? []), [community.savedPostIds]);

  const takeOff = (postId: string) => {
    // The tombstone is what makes the removal stick: a reseed re-appends any
    // known-id post it finds missing, so "taken down" has to be recorded as
    // more than an absence.
    setCommunity(prev => ({
      ...prev,
      posts: prev.posts.filter(p => p.id !== postId),
      removedPostIds: [...(prev.removedPostIds ?? []), postId],
      savedPostIds: (prev.savedPostIds ?? []).filter(id => id !== postId),
    }));
    showToast('Taken off the feed. The look stays in your outfits.', 'info');
  };

  const toggleSave = (postId: string) => {
    const on = savedIds.has(postId);
    setCommunity(prev => {
      const saved = prev.savedPostIds ?? [];
      return {
        ...prev,
        savedPostIds: on ? saved.filter(x => x !== postId) : [...saved, postId],
      };
    });
    showToast(on ? 'Put back with the rest.' : 'Set aside. Only this device keeps the mark.', 'info');
  };

  /**
   * Post AND author, resolved together, once.
   *
   * Three faults lived in the gap between the list the masthead counted and the
   * list the map actually rendered:
   *   · a post whose author is no longer on the device returned null inside the
   *     map while the masthead went on counting it — removing one wardrobe made
   *     the feed read "11 shared" over 7 cards;
   *   · a post with no `scope` threw inside postVisibleTo on `scope.kind` and
   *     blanked the whole app;
   *   · a post carrying neither look nor piece rendered an empty box.
   * The count, the empty branch and the cards now all read this one list.
   */
  const entries = useMemo(() => {
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
  }, [accounts, community.posts, community.conversations, community.households, activeId]);

  const mine = entries.filter(e => e.post.authorId === activeId).length;
  const anySaved = entries.some(e => savedIds.has(e.post.id));
  const shown = savedOnly ? entries.filter(e => savedIds.has(e.post.id)) : entries;

  if (entries.length === 0) {
    return (
      <>
        <Masthead title="The Feed" />
        <Card>
          <EmptyState
            plate={<PlateEmptyOutfits />}
            title="Nothing is on show yet."
            body="Looks you choose to share appear here, alongside those from the other wardrobes on this device. Sharing is per look, and you can stop at any time."
            action={
              // With no looks saved, the first step is making one, not choosing one.
              <LinkButton to="/outfits" tone="primary">
                {outfits.length > 0 ? 'Choose a look to share' : 'Build a look to share'}
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead title="The Feed" meta={`${entries.length} shared`} />

      <p className="type-ledger text-[11px] text-text-2 -mt-2">
        In the order they were shared. Nothing is ranked, counted, or scored.
      </p>

      {/* The one filter the feed has, and it only exists once there is
          something set aside to filter to. */}
      {anySaved || savedOnly ? (
        <div className="flex gap-2 max-w-[460px] mx-auto">
          <Chip selected={!savedOnly} onClick={() => setSavedOnly(false)}>Everything</Chip>
          <Chip selected={savedOnly} onClick={() => setSavedOnly(true)}>Set aside</Chip>
        </div>
      ) : null}

      {/* One look per card, in a single reading-width rail: the image leads,
          then who and when, then the caption. Nothing repeats but the rhythm. */}
      <ul className="space-y-6 max-w-[460px] mx-auto">
        {shown.map(({ post, author }) => (
          <FeedCard
            key={post.id}
            post={post}
            author={author}
            isMine={post.authorId === activeId}
            saved={savedIds.has(post.id)}
            onToggleSave={() => toggleSave(post.id)}
            onTakeOff={() => takeOff(post.id)}
          />
        ))}
      </ul>

      {savedOnly && shown.length === 0 ? (
        <Card className="max-w-[460px] mx-auto">
          <p className="text-[14px] text-text-2 leading-snug">
            Nothing set aside right now. The mark is on every card that can take one.
          </p>
        </Card>
      ) : null}

      <div className="max-w-[460px] mx-auto">
        <Card>
          <SectionTitle aside={`${mine} of yours`}>What you are showing</SectionTitle>
          <p className="text-[14px] text-text-2 leading-snug">
            {mine === 0
              ? 'None of your looks are on show. Sharing happens one look at a time, from the outfit itself.'
              : `${mine} of your looks ${mine === 1 ? 'is' : 'are'} on show. Each can be taken down from the outfit it belongs to.`}
          </p>
          <Basting className="my-4" />
          <Link to="/outfits" className="type-label text-[13px] text-accent underline underline-offset-[3px] min-h-11 inline-flex items-center">
            Your outfits
          </Link>
        </Card>
      </div>
    </div>
  );
}

function FeedCard({
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
  const look = post.look;
  const pieces = look?.pieces ?? [];
  return (
    <li>
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
              {/* Taking your own look down, here, where you are looking at it.
                  The copy used to send you to /outfits to hunt for it by name —
                  and a look shared to yourself alone appears nowhere else. */}
              <Button compact onClick={onTakeOff}>Take it off the feed</Button>
            </div>
          ) : null}
        </div>
      </Card>
    </li>
  );
}
