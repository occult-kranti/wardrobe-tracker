import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { categoryLabel, type BorrowStatus, type CircleMessage, type CircleProfile } from '../types';
import { Button, Card, Chip, EmptyState, LinkButton, Masthead, SectionTitle, inputClass } from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyWishlist, TagPortrait } from '../components/art';
import { IconChevronLeft } from '../components/icons';
import { oldestFirst, shortDate } from '../components/social';

/**
 * THE SHARED RAIL — borrowing between people who already know each other.
 *
 * Everything on this page is local data: profiles are records this closet keeps,
 * the way a contact book is, and the page says so out loud. There is no server,
 * no account, and nothing syncs — the owner chose to ship the full flow as a
 * working local preview (docs/11-shared-rail.md). No feed, no followers, no
 * unread counts: one group, one thread, chronological.
 *
 * A declined request reads as a neutral fact. A piece staying home is not a
 * verdict on anyone.
 */

/** The brand's tag-portrait as an avatar — monogram on the hanger rig, never a face. */
function TagAvatar({ profile, size = 40 }: { profile: CircleProfile; size?: number }) {
  return <TagPortrait monogram={profile.monogram} color={profile.color} size={size} />;
}

const STATUS_LABELS: Record<BorrowStatus, string> = {
  asked: 'Asked',
  lent: 'Lent',
  declined: 'Staying home',
  returned: 'Home again',
};

function RequestSlip({
  message,
  mine,
  onAdvance,
}: {
  message: CircleMessage;
  mine: boolean;
  onAdvance: (status: BorrowStatus) => void;
}) {
  const request = message.request;
  if (!request) return null;
  return (
    <div className="border border-border rounded-[2px] px-3 py-2.5 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[14px] text-text">{request.pieceName}</span>
      <Chip as="span">{STATUS_LABELS[request.status]}</Chip>
      {/* Only requests aimed at this closet carry actions, and both read as
          plain facts — no alarm styling on a piece staying home. */}
      {!mine && request.status === 'asked' ? (
        <span className="flex items-center gap-2 ml-auto">
          <Button compact onClick={() => onAdvance('lent')}>Lend it</Button>
          <Button compact onClick={() => onAdvance('declined')}>It stays home</Button>
        </span>
      ) : null}
      {!mine && request.status === 'lent' ? (
        <span className="ml-auto">
          <Button compact onClick={() => onAdvance('returned')}>Mark returned</Button>
        </span>
      ) : null}
    </div>
  );
}

export function Rail() {
  const { circle, getItem, sendRailMessage, setRequestStatus, returnLoan } = useWardrobe();
  const [draft, setDraft] = useState('');

  const me = circle.profiles.find(p => p.isMe);
  const group = circle.groups[0];
  const byId = useMemo(
    () => new Map(circle.profiles.map(p => [p.id, p])),
    [circle.profiles]
  );
  const thread = useMemo(
    () =>
      group
        ? circle.messages
            .filter(m => m.groupId === group.id)
            .sort(oldestFirst)
        : [],
    [circle.messages, group]
  );
  const out = circle.loans.filter(l => !l.returned);
  const back = circle.loans.filter(l => l.returned);

  // Loans can arrive without a seeded rail — accepting a borrow request in
  // Conversations writes the ledger and its two profiles into this closet's
  // circle. A wardrobe with loans but no thread is lent-from, not empty.
  if (circle.profiles.length === 0 && circle.loans.length === 0) {
    return (
      <>
        <Masthead title="The Shared Rail" />
        <Card>
          <EmptyState
            plate={<PlateEmptyWishlist />}
            title="The rail is empty."
            body="A rail is the record of what goes out and what comes home — who has your black coat, and since when. It fills as you lend, and lending starts with a conversation."
            action={
              // This used to say "Load the sample" and point at Settings, where
              // that button REPLACES the open wardrobe. Only the legacy demo
              // ever writes `circle`, so EVERY wardrobe — the samples and any
              // real one — landed on a dead page whose single offer was
              // quietly destructive. Borrowing actually happens in Conversations.
              <LinkButton to="/chats" tone="primary">Go to conversations</LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  const send = () => {
    if (!group || !draft.trim()) return;
    sendRailMessage(group.id, draft);
    setDraft('');
  };

  return (
    <div className="space-y-6">
      <Masthead
        title="The Shared Rail"
        meta={circle.profiles.length > 0 ? `${circle.profiles.length} closets` : undefined}
      />

      <p className="type-ledger text-[11px] text-text-2 -mt-2">
        Kept on this device, like a contact book. Nothing syncs anywhere.
      </p>

      {group ? (
        <Card>
          <SectionTitle aside={`${group.memberIds.length} members`}>{group.name}</SectionTitle>
          {group.about ? (
            <p className="type-editorial text-[20px] leading-snug text-balance">{group.about}</p>
          ) : null}
          <div className="flex items-end gap-4 mt-4">
            {group.memberIds.map(id => {
              const profile = byId.get(id);
              if (!profile) return null;
              return (
                <Link
                  key={id}
                  to={`/rail/${profile.id}`}
                  className="flex flex-col items-center gap-1.5 min-h-11 group"
                >
                  <TagAvatar profile={profile} />
                  <span className="type-ledger text-[11px] text-text-2 group-hover:text-text">
                    {profile.handle}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* The thread — one conversation, chronological, no unread anything. */}
      {group ? (
        <Card>
          <SectionTitle aside="oldest first">The thread</SectionTitle>
          <ul className="space-y-5">
            {thread.map(message => {
              const author = byId.get(message.authorId);
              const mine = message.authorId === me?.id;
              return (
                <li key={message.id} className="flex gap-3">
                  {author ? <TagAvatar profile={author} size={28} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="type-ledger text-[11px] text-text-2">
                      {author?.name ?? 'Someone'}
                      <span className="mx-1.5">·</span>
                      {author?.handle}
                      <span className="mx-1.5">·</span>
                      <span className="tabular">{shortDate(message.date)}</span>
                    </p>
                    <p className="text-[15px] text-text mt-1 leading-relaxed">{message.text}</p>
                    <RequestSlip
                      message={message}
                      mine={mine}
                      onAdvance={status => setRequestStatus(message.id, status)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <Basting className="my-4" />
          <form
            className="flex items-end gap-3"
            onSubmit={e => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="rail-draft" className="sr-only">
              Write to the group
            </label>
            <input
              id="rail-draft"
              className={inputClass}
              placeholder="Ask after a piece, or report one home"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <Button tone="primary" type="submit" disabled={!draft.trim()}>
              Send
            </Button>
          </form>
        </Card>
      ) : null}

      {/* Loans — plain records of what is out and what came back. */}
      {circle.loans.length > 0 ? (
        <Card>
          <SectionTitle aside={`${out.length} out`}>Out and back</SectionTitle>
          <ul>
            {[...out, ...back].map(loan => {
              const other = byId.get(loan.withId);
              // getItem, not activeItems: a piece retired while it is still out
              // keeps its photograph in the record of where it went.
              const item = loan.itemId ? getItem(loan.itemId) : undefined;
              return (
                <li key={loan.id} className="flex items-center gap-3 min-h-[56px] py-2">
                  <span className="block w-11 h-14 shrink-0 bg-mat overflow-hidden rounded-[2px]">
                    {item?.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <GarmentPlate categoryId={item?.category ?? 'accessories'} color={item?.color} name={item?.name} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text truncate">{loan.pieceName}</span>
                    <span className="type-ledger text-[11px] text-text-2 block mt-0.5 tabular">
                      {loan.direction === 'to' ? 'with' : 'from'} {other?.name ?? 'someone'} · since{' '}
                      {/* Through shortDate like every other surface. A raw
                          slice printed '07-23'. */}
                      {shortDate(loan.since)}
                      {loan.returned ? ` · home ${shortDate(loan.returned)}` : ''}
                    </span>
                  </span>
                  {!loan.returned ? (
                    <Button compact onClick={() => returnLoan(loan.id)}>
                      It came home
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export function RailProfile() {
  const { id } = useParams<{ id: string }>();
  const { circle, outfits, activeItems, getItem, settings } = useWardrobe();
  const profile = circle.profiles.find(p => p.id === id);

  if (!profile) {
    return (
      <>
        <Masthead title="The Shared Rail" />
        <Card>
          <EmptyState
            plate={<PlateEmptyWishlist />}
            title="No record of this closet."
            body="The profile may have been removed, or never existed here."
            action={
              <LinkButton to="/rail" tone="primary" icon={<IconChevronLeft size={16} />}>
                Back to the rail
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  // Only this closet's own showcase resolves against this closet's outfits. A
  // neighbour's showcase id that happened to match one of mine would have put
  // my outfit, my wear count and my photograph on their profile.
  const showcased = profile.isMe
    ? profile.showcase
        .map(outfitId => outfits.find(o => o.id === outfitId))
        .filter((o): o is NonNullable<typeof o> => o !== undefined)
    : [];

  return (
    <div className="space-y-6">
      <Masthead
        title={profile.name}
        meta={profile.handle}
        action={
          <LinkButton to="/rail" compact icon={<IconChevronLeft size={16} />}>The rail</LinkButton>
        }
      />

      <Card>
        <div className="flex items-start gap-5">
          <TagAvatar profile={profile} size={56} />
          <div className="min-w-0 flex-1">
            {profile.bio ? (
              <p className="type-editorial text-[20px] leading-snug text-balance">{profile.bio}</p>
            ) : null}
            {profile.isMe ? (
              <p className="type-ledger text-[11px] text-text-2 mt-3">
                This closet · {activeItems.length} pieces on record
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {profile.lendable.length > 0 ? (
        <Card>
          <SectionTitle aside={`${profile.lendable.length} pieces`}>Open to borrow</SectionTitle>
          <ul className="grid sm:grid-cols-2 gap-x-6">
            {profile.lendable.map(piece => {
              const item = piece.itemId ? getItem(piece.itemId) : undefined;
              return (
                <li key={piece.itemId ?? piece.name} className="flex items-center gap-3 h-14">
                  <span className="block w-9 h-11 shrink-0 bg-mat overflow-hidden rounded-[2px]">
                    {item?.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <GarmentPlate categoryId={piece.category ?? 'accessories'} color={item?.color} name={piece.name ?? item?.name} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text truncate">{piece.name}</span>
                    <span className="type-ledger text-[11px] text-text-2 block mt-0.5">
                      {piece.category ? categoryLabel(settings, piece.category) : ''}
                      {piece.note ? (piece.category ? ' · ' : '') + piece.note : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {showcased.length > 0 ? (
        <Card>
          <SectionTitle aside="curated">On the rail</SectionTitle>
          <ul className="space-y-5">
            {showcased.map(outfit => (
              <li key={outfit.id}>
                <p className="text-[15px] text-text">{outfit.name}</p>
                <p className="type-ledger text-[11px] text-text-2 tabular mt-0.5">
                  {outfit.wearCount} {outfit.wearCount === 1 ? 'wear' : 'wears'} ·{' '}
                  {outfit.itemIds.length} pieces
                </p>
                <div className="flex gap-2 mt-2">
                  {outfit.itemIds.slice(0, 6).map(itemId => {
                    const item = getItem(itemId);
                    if (!item) return null;
                    return (
                      <span
                        key={itemId}
                        className="block w-12 h-15 aspect-[4/5] bg-mat overflow-hidden rounded-[2px]"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
                        )}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p>
        <Link
          to="/rail"
          className="type-label text-[13px] text-text-2 hover:text-text inline-flex items-center gap-1.5 min-h-11"
        >
          <IconChevronLeft size={16} />
          Back to the rail
        </Link>
      </p>
    </div>
  );
}

export default Rail;
