import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Card, EmptyState, Masthead, SectionTitle } from '../components/ui';
import { Basting, PlateEmptyOutfits } from '../components/art';
import { AccountLine, LookCard, PieceCard, shortDate } from '../components/social';
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
  const { accounts, community, activeId } = useSession();
  const { outfits } = useWardrobe();

  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const posts = useMemo(
    () => community.posts
      .filter(p => postVisibleTo(p, activeId, community.conversations, community.households))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    [community.posts, community.conversations, activeId]
  );

  const mine = posts.filter(p => p.authorId === activeId).length;

  if (posts.length === 0) {
    return (
      <>
        <Masthead title="The Feed" />
        <Card>
          <EmptyState
            plate={<PlateEmptyOutfits />}
            title="Nothing is on show yet."
            body="Looks you choose to share appear here, alongside those from the other wardrobes on this device. Sharing is per look, and you can stop at any time."
            action={
              outfits.length > 0 ? (
                <LinkButton to="/outfits" tone="primary">Choose a look to share</LinkButton>
              ) : undefined
            }
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead title="The Feed" meta={`${posts.length} shared`} />

      <p className="type-ledger text-[11px] text-text-2 -mt-2">
        In the order they were shared. Nothing is ranked, counted, or scored.
      </p>

      <ul className="space-y-6">
        {posts.map(post => {
          const author = byId.get(post.authorId);
          if (!author) return null;
          return (
            <li key={post.id}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <AccountLine account={author} meta={shortDate(post.date)} />
                  {post.authorId === activeId && post.scope.kind !== 'everyone' ? (
                    <span className="type-ledger text-[11px] text-text-2 pt-2">
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
              </Card>
            </li>
          );
        })}
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
