import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, EmptyState, Masthead, SectionTitle } from '../components/ui';
import { showToast } from '../components/Toast';
import { Basting, PlateEmptyOutfits } from '../components/art';
import { AccountLine, LookCard, PieceCard, shortDate, newestFirst } from '../components/social';
import { SCOPE_LABELS, postVisibleTo } from '../types';
import { LinkButton } from '../components/ui';

/**
 * THE FEED — what the wardrobes on this device have put on show.
 *
 * Deliberately not a performance surface. There are no likes, no counts, no
 * followers, no "seen by", no unread marks, and no ranking: posts are in the
 * order they were shared, newest first, and that is the whole algorithm. The
 * panel rejected the social graph because it turns a wardrobe into a stage; a
 * shared rail between people who already know each other is the thing that
 * survives that objection, and every absent feature above is what keeps it one.
 */
export default function Feed() {
  const { accounts, community, activeId, setCommunity } = useSession();
  const { outfits } = useWardrobe();

  const takeOff = (postId: string) => {
    setCommunity(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== postId) }));
    showToast('Taken off the feed. The look stays in your outfits.', 'info');
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

      <ul className="space-y-6">
        {entries.map(({ post, author }) => (
          <li key={post.id}>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <AccountLine account={author} meta={shortDate(post.date)} />
                {post.authorId === activeId && post.scope.kind !== 'everyone' ? (
                  <span className="type-ledger text-[11px] text-text-2 pt-2 shrink-0">
                    {SCOPE_LABELS[post.scope.kind].toLowerCase()}
                  </span>
                ) : null}
              </div>

              {post.caption ? (
                <p className="type-editorial text-[19px] sm:text-[20px] leading-snug text-balance mt-4">
                  {post.caption}
                </p>
              ) : null}

              <div className="mt-4">
                {post.look ? <LookCard look={post.look} /> : null}
                {post.piece ? <PieceCard piece={post.piece} /> : null}
              </div>

              {/* Taking your own look down, here, where you are looking at it.
                  The copy used to send you to /outfits to hunt for it by name —
                  and a look shared to yourself alone appears nowhere else. */}
              {post.authorId === activeId ? (
                <div className="mt-3 flex justify-end">
                  <Button compact onClick={() => takeOff(post.id)}>Take it off the feed</Button>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

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
  );
}
