import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Card, Chip, EmptyState, IconButton, LinkButton, Masthead, SectionTitle, TagRail } from '../components/ui';
import { showToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Basting, GarmentPlate, PlateEmptyOutfits } from '../components/art';
import {
  AccountLine, PostCard, StorySlot, railDecks, resolveFeedEntries, shortDate,
  type FeedEntry, type StoryDeck,
} from '../components/social';
import { BUFFER_FEED, COMMONS_LABEL, commonsStoriesFor, type BufferEntry } from '../lib/bufferFeed';
import { formatLocalDate } from '@almari/shared/dates';
import { IconClose } from '../components/icons';
import type { Account, FeedPost } from '@almari/shared/types';

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
  const [pendingOff, setPendingOff] = useState<FeedPost | null>(null);

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

  // Post AND author, resolved together, once — the shared helper, so the
  // masthead's count, the rail, the cards and Explore all read one list.
  const entries = useMemo(
    () => resolveFeedEntries(accounts, community, activeId),
    [accounts, community, activeId]
  );

  const mine = entries.filter(e => e.post.authorId === activeId).length;
  const anySaved = entries.some(e => savedIds.has(e.post.id));
  const shown = savedOnly ? entries.filter(e => savedIds.has(e.post.id)) : entries;

  const offName = pendingOff?.look?.name ?? pendingOff?.piece?.name ?? 'this';

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
      <Masthead
        title="The Feed"
        meta={`${entries.length} shared`}
        action={<LinkButton compact to="/explore">Explore</LinkButton>}
      />

      <StoriesRail entries={entries} activeId={activeId} />

      <p className="type-ledger text-[11px] text-text-2 -mt-2">
        Newest first. That is the whole order.
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
          <li key={post.id}>
            <PostCard
              post={post}
              author={author}
              isMine={post.authorId === activeId}
              saved={savedIds.has(post.id)}
              onToggleSave={() => toggleSave(post.id)}
              onTakeOff={() => setPendingOff(post)}
            />
          </li>
        ))}
      </ul>

      {savedOnly && shown.length === 0 ? (
        <Card className="max-w-[460px] mx-auto">
          <p className="text-[14px] text-text-2 leading-snug">
            Nothing set aside yet. The bookmark at the top right of a look sets it aside.
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

      {/* THE GATE. Taking a look down is reversible only by sharing again, so
          it is stated plainly and confirmed — never done under a stray tap. */}
      <ConfirmDialog
        open={pendingOff !== null}
        title="Take it off the feed"
        body={
          <p>
            This takes &ldquo;{offName}&rdquo; off the feed for every wardrobe here, and it
            will not come back on its own. The look itself stays in your outfits.
          </p>
        }
        confirmLabel="Take it off"
        onConfirm={() => {
          if (pendingOff) takeOff(pendingOff.id);
          setPendingOff(null);
        }}
        onClose={() => setPendingOff(null)}
      />
    </div>
  );
}

/* ============================== the rail ==============================
   "On show in the last day." Membership is computed at render from the same
   entries the feed shows; nothing is written and nothing expires — after 24
   hours only the rail forgets, the feed remembers. Every eyelet wears the
   same hairline: no seen-state, no dots, no "3 new". The rail's whole
   grammar is presence. */

function StoriesRail({ entries, activeId }: { entries: FeedEntry[]; activeId: string | null }) {
  const decks = railDecks(entries, activeId, Date.now());
  const hasGuests = BUFFER_FEED.length > 0;
  // No qualifying post anywhere and no guests: no rail, no empty chrome.
  if (decks.length === 0 && !hasGuests) return null;

  const mineDeck = decks.find(d => d.author.id === activeId);
  const others = decks.filter(d => d.author.id !== activeId);

  return (
    <TagRail label="On show in the last day" className="pb-1">
      {mineDeck ? (
        <StorySlot
          to={`/story/${mineDeck.author.id}`}
          name="Yours"
          monogram={mineDeck.author.monogram}
          ariaLabel="Yours — on show in the last day"
        />
      ) : (
        // The waiting slot: a punched hole waiting for its thread. Sharing
        // happens from the outfit itself, so the slot walks you there.
        <StorySlot to="/outfits" plus name="Yours" ariaLabel="Put a look on show" />
      )}
      {others.map(deck => (
        <StorySlot
          key={deck.author.id}
          to={`/story/${deck.author.id}`}
          name={deck.author.name}
          monogram={deck.author.monogram}
          ariaLabel={
            deck.author.isSample
              ? `${deck.author.name} — sample wardrobe, on show in the last day`
              : `${deck.author.name} — on show in the last day`
          }
        />
      ))}
      {hasGuests ? (
        // The commons keeps the rail company while the room is quiet —
        // labelled guests, never a wardrobe (docs/35, owner decision 3).
        <StorySlot
          to="/story/commons"
          name="Guests"
          monogram="CC"
          ariaLabel="Guests from the commons — samples, on show today"
        />
      ) : null}
    </TagRail>
  );
}

/* ============================ the story viewer ============================
   A full-screen route, not a modal: /story/:accountId, the Feed tab held lit
   underneath. The PAGE is full-bleed; the photograph never is — a look keeps
   its 4:5 frame on a flat token ground (nothing decorative behind clothing
   photos). Nothing is recorded: no seen state, no receipts, no counts.
   Leaving mid-deck loses nothing because nothing was owed. */

const FRAME_MS = 5000;

interface StoryFrame {
  key: string;
  date?: string;
  image?: string;
  video?: string;
  /** GarmentPlate fallback when a look was never photographed. */
  plate?: string;
  caption?: string;
  ledger: string;
  /** A caption-only post: the words are the look. */
  editorialOnly?: boolean;
}

interface ViewerDeck {
  id: string;
  author: Account | null;
  frames: StoryFrame[];
}

function frameOfPost(post: FeedPost): StoryFrame {
  const when = shortDate(post.date);
  if (post.look) {
    const occasion = post.look.occasion ? ` · ${post.look.occasion}` : '';
    return {
      key: post.id,
      date: post.date,
      image: post.look.imageUrl,
      plate: 'dresses',
      caption: post.caption,
      ledger: `${post.look.name}${occasion} · ${when}`,
    };
  }
  if (post.piece) {
    return {
      key: post.id,
      date: post.date,
      image: post.piece.imageUrl,
      plate: post.piece.category ?? 'accessories',
      caption: post.caption,
      ledger: `${post.piece.name} · ${when}`,
    };
  }
  return { key: post.id, date: post.date, caption: post.caption, ledger: when, editorialOnly: true };
}

function frameOfCommons(b: BufferEntry): StoryFrame {
  return {
    key: b.id,
    image: b.kind === 'image' ? b.path : undefined,
    video: b.kind === 'video' ? b.path : undefined,
    caption: b.caption,
    ledger: `${COMMONS_LABEL} · ${b.author} · sample`,
  };
}

export function Story() {
  const { accountId } = useParams<{ accountId: string }>();
  const { accounts, community, activeId } = useSession();
  const navigate = useNavigate();

  // The clock is read once: a deck must not dissolve under the reader at the
  // stroke of a post's 24th hour.
  const [now] = useState(() => Date.now());
  const today = useMemo(() => formatLocalDate(new Date()), []);

  const decks = useMemo<ViewerDeck[]>(() => {
    const entries = resolveFeedEntries(accounts, community, activeId);
    const wardrobe: ViewerDeck[] = railDecks(entries, activeId, now).map((d: StoryDeck) => ({
      id: d.author.id,
      author: d.author,
      frames: d.posts.map(frameOfPost),
    }));
    const commons = commonsStoriesFor(today).map(frameOfCommons);
    if (commons.length > 0) wardrobe.push({ id: 'commons', author: null, frames: commons });
    return wardrobe;
  }, [accounts, community, activeId, now, today]);

  const startDeck = decks.findIndex(d => d.id === accountId);
  const [pos, setPos] = useState({ deck: startDeck, frame: 0 });
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);

  // Under reduced motion nothing autoplays and nothing animates: segments
  // render discrete, and advancing is tap or key only.
  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const deck = pos.deck >= 0 ? decks[pos.deck] : undefined;
  const frame = deck?.frames[pos.frame];

  const step = (dir: 1 | -1) => {
    setPos(p => {
      const cur = decks[p.deck];
      if (!cur) return p;
      if (dir === 1) {
        if (p.frame + 1 < cur.frames.length) return { deck: p.deck, frame: p.frame + 1 };
        // The commons is an island: a walk through wardrobes ends at the
        // feed and never slides into the guest deck uninvited (docs/40 D7,
        // advisor finding A1). Its slot on the rail is the only door in.
        const next = decks[p.deck + 1];
        if (next && next.id !== 'commons') return { deck: p.deck + 1, frame: 0 };
        return { deck: -2, frame: 0 }; // past the final story: close to the feed
      }
      if (p.frame > 0) return { deck: p.deck, frame: p.frame - 1 };
      if (p.deck > 0 && cur.id !== 'commons') return { deck: p.deck - 1, frame: 0 };
      return p; // back past the first story stays put; the island holds both ways
    });
  };

  // Each new frame starts its clock from nothing.
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [pos]);

  // The 5-second hand. Pausing holds the elapsed time; resuming carries on.
  useEffect(() => {
    if (reduced || paused || !frame) return;
    const t0 = Date.now() - elapsedRef.current * FRAME_MS;
    const iv = setInterval(() => {
      const p = (Date.now() - t0) / FRAME_MS;
      elapsedRef.current = p;
      if (p >= 1) step(1);
      else setProgress(p);
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, paused, reduced, frame !== undefined]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/feed');
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks]);

  // A deck that never existed, or the walk reaching past the final story.
  if (startDeck === -1 || decks.length === 0) return <Navigate to="/feed" replace />;
  if (pos.deck === -2 || !deck || !frame) return <Navigate to="/feed" replace />;

  return (
    <div className="fixed inset-0 z-[100] bg-bg-deep min-h-dvh flex flex-col animate-fade">
      {/* Progress hairlines: 1px is the letterpress hairline — never thicker.
          One segment per story of the current teller; no seen-state outlives
          this screen. */}
      <div className="flex gap-1 px-4 pt-3 safe-t" aria-hidden="true">
        {deck.frames.map((f, i) => (
          <span key={f.key} className="flex-1 h-px bg-border relative">
            <span
              className="absolute inset-y-0 left-0 bg-accent"
              style={{
                width:
                  i < pos.frame ? '100%'
                  : i > pos.frame ? '0%'
                  : reduced ? '50%'
                  : `${Math.min(100, progress * 100)}%`,
              }}
            />
          </span>
        ))}
      </div>

      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        {deck.author ? (
          <div className="flex items-center gap-2 min-w-0">
            <AccountLine account={deck.author} meta={shortDate(frame.date)} />
            {deck.author.isSample ? (
              <span className="shrink-0">
                <Chip as="span">sample wardrobe</Chip>
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 min-h-11">
            <span className="text-[14px] text-text">Guests</span>
            <Chip as="span">{COMMONS_LABEL}</Chip>
          </div>
        )}
        <IconButton label="Close" onClick={() => navigate('/feed')} className="shrink-0">
          <IconClose size={18} />
        </IconButton>
      </div>

      {/* The photo band. Holding a finger (or mouse) on it pauses the hand;
          letting go resumes. The two invisible zones walk the deck. */}
      <div
        className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 gap-4"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {frame.editorialOnly ? (
          // The words are the look.
          <p className="type-editorial text-[22px] text-center text-balance max-w-[380px] text-text">
            {frame.caption}
          </p>
        ) : (
          <>
            <div className="w-full max-w-[380px] border border-border rounded-[2px] overflow-hidden">
              <span className="block w-full bg-mat overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
                {frame.video ? (
                  <video
                    src={frame.video}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    loop
                    autoPlay={!reduced}
                    controls={reduced}
                  />
                ) : frame.image ? (
                  <img src={frame.image} alt={frame.caption ?? ''} className="w-full h-full object-cover" />
                ) : (
                  <GarmentPlate categoryId={frame.plate ?? 'dresses'} />
                )}
              </span>
            </div>
            {frame.caption ? (
              <p className="type-editorial text-[20px] text-center text-balance px-6 text-text">
                {frame.caption}
              </p>
            ) : null}
          </>
        )}
        <p className="type-ledger text-[11px] text-text-2 text-center">{frame.ledger}</p>

        <button
          type="button"
          aria-label="The look before"
          onClick={() => step(-1)}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          aria-label="The next look"
          onClick={() => step(1)}
          className="absolute inset-y-0 right-0 w-2/3"
        />
      </div>
    </div>
  );
}
