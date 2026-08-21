import {
  Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState,
} from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, Chip, EmptyState, LinkButton, Masthead, TagRail } from '../components/ui';
import { showToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { GarmentPlate, PlateEmptyOutfits, TagPortrait } from '../components/art';
import {
  LookThumb, PostCard, resolveFeedEntries, sharedCategoryLabel, shortDate,
  type FeedEntry,
} from '../components/social';
import { BUFFER_FEED, COMMONS_LABEL, interleaveCommons, type BufferEntry } from '../lib/bufferFeed';
import {
  HEM_LINE, HEM_LINE_FILTERED, LAY_THRESHOLD, backwardSwap, hueWords, monthKey,
  monthWords, seamsFor, variantFor, type Columns, type Variant,
} from '../lib/showing';
import { formatLocalDate } from '@almari/shared/dates';
import { IconClose, IconSearch } from '../components/icons';
import { photoSrc } from '../lib/photoStore';
import type { FeedPost } from '@almari/shared/types';

/**
 * EXPLORE — THE SHOWING (docs/41). The feed's entries dealt as a mosaic:
 * bands of uniform 4:5 racks, one double-width plate per band that takes the
 * turn, the turn's side mirroring as the scroll deepens, month seams as
 * basting hairlines, and a hem at the bottom — a show that never ends is not
 * a show.
 *
 * Not a wider aperture: this wall styles the exact same resolved entries the
 * feed shows (resolveFeedEntries, the one door), so consent stays structural.
 * Size comes from arithmetic over position (src/lib/showing.ts), never from
 * behavior; there is no behavior data to read and this page keeps it that
 * way. No metrics, no counts, no ranking, no seen-state. DOM order is
 * chronological order is reading order is tab order, turns included.
 */
export default function Explore() {
  const { postId } = useParams<{ postId: string }>();
  if (postId) return <OnShow postId={postId} />;
  return <ExploreGrid />;
}

type Tile = { real: FeedEntry } | { commons: BufferEntry };

/** Column count from the one matchMedia pair (docs/41 §2.1). Crossing a
 *  breakpoint re-deals the wall without animating tile positions. */
function useColumns(): Columns {
  const read = (): Columns =>
    typeof window === 'undefined' || !window.matchMedia
      ? 2
      : window.matchMedia('(min-width: 1024px)').matches
        ? 4
        : window.matchMedia('(min-width: 768px)').matches
          ? 3
          : 2;
  const [cols, setCols] = useState<Columns>(read);
  useEffect(() => {
    const pair = [
      window.matchMedia('(min-width: 768px)'),
      window.matchMedia('(min-width: 1024px)'),
    ];
    const redeal = () => setCols(read());
    pair.forEach(mq => mq.addEventListener('change', redeal));
    return () => pair.forEach(mq => mq.removeEventListener('change', redeal));
  }, []);
  return cols;
}

/**
 * The one entrance (docs/41 §5): a single shared IntersectionObserver deals
 * each tile one opacity fade the first time it enters the viewport, then
 * forgets it — never re-fired on re-scroll. Under prefers-reduced-motion the
 * fade class is never added, so the page is the full static mosaic, layout
 * identical in every pixel. This is the only scroll-adjacent JS on the wall.
 */
function useEntranceFade() {
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return useCallback((el: HTMLElement | null) => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.classList.contains('showing-fade')) return;
    observer.current ??= new IntersectionObserver(hits => {
      for (const hit of hits) {
        if (hit.isIntersecting) {
          hit.target.classList.add('is-shown');
          observer.current?.unobserve(hit.target);
        }
      }
    });
    el.classList.add('showing-fade');
    observer.current.observe(el);
  }, []);
}

function ExploreGrid() {
  const { accounts, community, activeId } = useSession();
  const { outfits } = useWardrobe();
  const [query, setQuery] = useState('');
  // 'all' | 'looks' | 'pieces' | 'cat:<id>' | 'occ:<occasion>' | 'commons'
  const [kind, setKind] = useState('all');
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const cols = useColumns();
  const observe = useEntranceFade();

  const entries = useMemo(
    () => resolveFeedEntries(accounts, community, activeId),
    [accounts, community, activeId]
  );

  // The chips offer only questions with answers: the Looks/Pieces pair only
  // when both kinds are on the wall, one chip per house category present
  // among visible piece posts, one per occasion among look posts.
  const categories = useMemo(
    () => [...new Set(entries.map(e => e.post.piece?.category).filter((c): c is string => !!c))],
    [entries]
  );
  const occasions = useMemo(
    () => [...new Set(entries.map(e => e.post.look?.occasion).filter((o): o is string => !!o))],
    [entries]
  );
  const bothKinds =
    entries.some(e => e.post.look) && entries.some(e => e.post.piece);

  const deferredQuery = useDeferredValue(query);
  const q = deferredQuery.trim().toLowerCase();
  const matchesPost = (e: FeedEntry) => {
    if (!q) return true;
    // The hay grows colour words (pieces only — looks match colour through
    // their piece names, a stated consent limit) and month words (docs/41 §4).
    const hay = [
      e.post.look?.name,
      e.post.caption,
      ...(e.post.look?.pieces ?? []),
      e.post.piece?.name,
      e.post.look?.occasion,
      e.author.name,
      ...(e.post.piece ? hueWords(e.post.piece.color) : []),
      ...monthWords(e.post.date),
    ];
    return hay.some(h => h && h.toLowerCase().includes(q));
  };
  const matchesGuest = (b: BufferEntry) =>
    !q || b.caption.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);

  const real = useMemo(() => {
    let base = entries;
    if (kind === 'commons') base = [];
    else if (kind === 'looks') base = entries.filter(e => !!e.post.look);
    else if (kind === 'pieces') base = entries.filter(e => !!e.post.piece);
    else if (kind.startsWith('cat:')) base = entries.filter(e => e.post.piece?.category === kind.slice(4));
    else if (kind.startsWith('occ:')) base = entries.filter(e => e.post.look?.occasion === kind.slice(4));
    return base.filter(matchesPost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, kind, q]);

  // Guests ride along only where they belong: the whole commons under its own
  // chip (an all-rack room), capped interludes under Everything, and never
  // inside a question about clothes.
  const guests = kind === 'all' || kind === 'commons' ? BUFFER_FEED.filter(matchesGuest) : [];

  // The pipeline of the deal: interleave → the backward swap. The swap slides
  // a guest one seat back wherever the interleave arithmetic would hand it a
  // turn, so samples never take the turn — not even by accident of the date.
  const tiles: Tile[] = useMemo(() => {
    if (kind === 'commons') return guests.map(b => ({ commons: b }));
    const laid = interleaveCommons(real, guests, today);
    return backwardSwap(laid, t => 'commons' in t, cols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, real, q, today, cols]);

  // Seams are computed after the swap, from real posts' months only —
  // guests are month-transparent and can never create or move one.
  const seamAt = useMemo(() => {
    if (tiles.length < LAY_THRESHOLD) return new Map<number, string>();
    const months = tiles.map(t => ('real' in t ? monthKey(t.real.post.date) : null));
    return new Map(seamsFor(months, cols).map(s => [s.index, s.label]));
  }, [tiles, cols]);

  // The monogram tag appears only when the visible wall holds more than one
  // author — on a single-author wall it is noise (docs/41 §3).
  const showTag = useMemo(
    () => new Set(real.map(e => e.author.id)).size > 1,
    [real]
  );

  // Guests are company, not exhibits — the masthead never counts a sample
  // as a look "on show" (advisor finding A3).
  const shownCount = tiles.filter(t => 'real' in t).length;
  const guestCount = tiles.length - shownCount;
  const mastheadMeta =
    shownCount > 0 && guestCount > 0
      ? `${shownCount} on show · ${guestCount} guests`
      : shownCount > 0
        ? `${shownCount} on show`
        : `${guestCount} guests`;

  if (entries.length === 0) {
    return (
      <>
        <Masthead title="Explore" />
        <Card>
          <EmptyState
            plate={<PlateEmptyOutfits />}
            title="Nothing is on show yet."
            body="Looks the wardrobes on this device choose to share appear here. Sharing is per look, and stopping is always allowed."
            action={
              <LinkButton to="/outfits" tone="primary">
                {outfits.length > 0 ? 'Choose a look to share' : 'Build a look to share'}
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  const filtered = kind !== 'all' || q !== '';
  // Below the threshold the wall is not dealt: a centred column of full
  // plates — never pad a young wall with samples (docs/41 §8). The commons
  // room keeps its rack grid at any count: a sample is not a young wardrobe,
  // and a guest tile is never full-width.
  const sparse = kind !== 'commons' && tiles.length > 0 && tiles.length < LAY_THRESHOLD;
  const colClass = cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="space-y-6">
      <Masthead title="Explore" meta={mastheadMeta} />

      {/* The one boxed input, exactly as the closet wears it. */}
      <div className="relative">
        <label htmlFor="explore-search" className="sr-only">Search what is on show</label>
        <IconSearch
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none"
        />
        <input
          id="explore-search"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search what is on show"
          className="w-full h-11 pl-9 pr-12 bg-surface border border-border rounded-[2px] text-base lg:text-[15px] text-text placeholder:text-text-2 focus:outline-none focus:border-accent transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-text-2 hover:text-text"
          >
            <IconClose size={14} />
          </button>
        )}
      </div>

      <TagRail label="Kinds of thing on show" className="pb-1">
        <Chip selected={kind === 'all'} onClick={() => setKind('all')}>Everything</Chip>
        {bothKinds ? (
          <>
            <Chip selected={kind === 'looks'} onClick={() => setKind('looks')}>Looks</Chip>
            <Chip selected={kind === 'pieces'} onClick={() => setKind('pieces')}>Pieces</Chip>
          </>
        ) : null}
        {categories.map(c => (
          <Chip key={c} selected={kind === `cat:${c}`} onClick={() => setKind(`cat:${c}`)}>
            {sharedCategoryLabel(c)}
          </Chip>
        ))}
        {occasions.map(o => (
          <Chip key={o} selected={kind === `occ:${o}`} onClick={() => setKind(`occ:${o}`)} title={o}>
            {o}
          </Chip>
        ))}
        {BUFFER_FEED.length > 0 ? (
          <Chip selected={kind === 'commons'} onClick={() => setKind('commons')}>
            From the commons
          </Chip>
        ) : null}
      </TagRail>

      {tiles.length === 0 ? null : sparse ? (
        // 1–4 entries: full plates on a gallery wall, room to speak. The
        // width is min(100%, 400px), not the spec's literal "100% − 32px" —
        // the page column already carries the house gutter, and the second
        // inset shrank the plate 32px below the spec's own predicted ≈288px
        // at 320px (docs/41 erratum E3).
        <ul className="flex flex-col items-center gap-3">
          {tiles.map(t =>
            'real' in t ? (
              <li
                key={t.real.post.id}
                ref={observe}
                data-variant="turn"
                style={{ width: 'min(100%, 400px)' }}
              >
                <PostTileLink entry={t.real} variant="turn" cols={2} showTag={showTag} />
              </li>
            ) : null
          )}
        </ul>
      ) : (
        // The dealt wall: one list, grid-auto-flow row — never dense, never
        // order:. Racks legislate row height; the turn obeys. Variants come
        // from the array index alone; the seam takes no index at all.
        <ul className={`grid gap-3 ${colClass}`}>
          {tiles.map((t, i) => {
            const key = 'real' in t ? t.real.post.id : t.commons.id;
            const seam = seamAt.get(i);
            return (
              <Fragment key={key}>
                {seam ? (
                  <li
                    role="separator"
                    aria-label={seam}
                    className="col-span-full h-9 flex items-center gap-2"
                  >
                    <span className="type-ledger text-[11px] text-text-2 shrink-0">{seam}</span>
                    <span className="basting flex-1" aria-hidden="true" />
                  </li>
                ) : null}
                {'real' in t ? (
                  <PostTile
                    entry={t.real}
                    variant={variantFor(i, tiles.length, cols)}
                    cols={cols}
                    showTag={showTag}
                    observe={observe}
                  />
                ) : (
                  <GuestTile guest={t.commons} observe={observe} />
                )}
              </Fragment>
            );
          })}
        </ul>
      )}

      {/* The hem: the last band renders whole, then a basting rule and one
          calm sentence with exactly one quiet action — never the accent fill,
          the hero belongs to log-wear. No load-more, no spinner: new posts
          take the top of the spine on the next visit, unannounced. */}
      <div>
        <div className="basting" aria-hidden="true" />
        <div className="pt-5 pb-2 flex flex-col items-center gap-4 text-center">
          <p className="text-[14px] text-text-2 leading-snug">
            {filtered ? HEM_LINE_FILTERED : HEM_LINE}
          </p>
          {filtered ? (
            <Button
              compact
              onClick={() => {
                setQuery('');
                setKind('all');
              }}
            >
              Show everything
            </Button>
          ) : (
            <LinkButton compact to="/outfits">Build a look to share</LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== tile anatomy ==============================
   docs/41 §3. Fixed-pixel captions are the zero-shift contract: the rack
   caption is 52px declared (6 rest · 20 name · 2 · 18 ledger · 6 rest), the
   turn's is 88px (8 · two 26px lines · 2 · 18 · 8) — on the 2×2 turn it
   flexes to the row-legislated remainder instead, min 88. The ledger row is
   one line, never a third: the date never truncates, `· sample` never
   truncates, the occasion yields first and then the author's name. */

function LedgerRow({
  tag,
  author,
  lead,
  date,
  sample,
}: {
  /** The author monogram — a garment tag, never a face. Multi-author walls only. */
  tag?: { monogram: string; color?: string } | null;
  /** The turn spells the author's name in full beside the tag. */
  author?: string;
  /** Occasion or category — the first thing to yield when space runs out. */
  lead?: string;
  date?: string;
  sample?: boolean;
}) {
  const tail = [date, sample ? 'sample' : ''].filter(Boolean).join(' · ');
  return (
    <span className="flex items-center gap-1 h-[18px] type-ledger text-[11px] text-text-2 min-w-0">
      {tag ? (
        <span className="shrink-0 w-[21px] inline-flex items-center justify-center" aria-hidden="true">
          <TagPortrait monogram={tag.monogram} color={tag.color} size={16} />
        </span>
      ) : null}
      {author ? <span className="truncate min-w-0">{author}</span> : null}
      {lead ? (
        <span className="truncate min-w-0 shrink-[24]">{author ? `· ${lead}` : lead}</span>
      ) : null}
      {tail ? (
        <span className="shrink-0 whitespace-nowrap">
          {author || lead ? `· ${tail}` : tail}
        </span>
      ) : null}
    </span>
  );
}

/** The tile's face and caption inside the one link. `variant` is the dress;
 *  the grid seat (spans, pinning) belongs to the <li> around it. */
function PostTileLink({
  entry,
  variant,
  cols,
  showTag,
}: {
  entry: FeedEntry;
  variant: Variant;
  cols: Columns;
  showTag: boolean;
}) {
  const { post, author } = entry;
  const isTurn = variant !== 'rack';
  const name = post.look?.name ?? post.piece?.name ?? '';
  const lead =
    post.look?.occasion ??
    (post.piece?.category ? sharedCategoryLabel(post.piece.category) : undefined);
  const wordsOnly = !post.look && !post.piece;
  // The tag yields at two columns on a rack: the stress suite measured the
  // 320px ledger row and the monogram's 25px is exactly what forces "· sample"
  // to clip mid-word — and samples saying they are samples is an owner law
  // (docs/35), which outranks a tag whose identity is one tap away. The turn,
  // and every wall at three columns and up, keeps it (docs/41 erratum E2).
  const tagFits = !(cols === 2 && variant === 'rack');
  const tag = showTag && tagFits ? { monogram: author.monogram, color: author.color } : null;

  // The 2×2 turn stretches to the rows the racks define: face fixed at 4:5
  // (no cell ever crops it), caption absorbs the arithmetic remainder. The
  // phone turn and the racks are natural height, so they take
  // content-visibility with a declared fallback; the 2×2 turn takes none.
  const spans2x2 = isTurn && cols !== 2;
  const cv = !isTurn ? 'cv-rack' : spans2x2 ? '' : 'cv-turn-phone';

  const face = wordsOnly ? (
    // A pinned note: the words are the look; no photograph is faked. The
    // Fraunces floor is law — 20px on the rack, 24px in the turn, never less.
    <span
      className="flex w-full bg-mat items-center justify-center p-3 shrink-0"
      style={{ aspectRatio: '4 / 5' }}
    >
      <span
        className={`type-editorial text-text text-center text-balance ${
          isTurn ? 'text-[24px] leading-8 line-clamp-6' : 'text-[20px] leading-[26px] line-clamp-4'
        }`}
      >
        {post.caption}
      </span>
    </span>
  ) : post.look ? (
    <span className="block shrink-0">
      <LookThumb look={post.look} alt={name || post.caption || 'A look'} />
    </span>
  ) : (
    <span className="block w-full bg-mat overflow-hidden shrink-0" style={{ aspectRatio: '4 / 5' }}>
      {photoSrc(post.piece?.imageUrl) ? (
        <img
          src={photoSrc(post.piece?.imageUrl)}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <GarmentPlate
          categoryId={post.piece?.category ?? 'accessories'}
          color={post.piece?.color}
          name={post.piece?.name}
        />
      )}
    </span>
  );

  return (
    <Link
      to={`/explore/${post.id}`}
      className={`flex flex-col bg-surface plate rounded-[2px] overflow-hidden ${
        spans2x2 ? 'h-full' : ''
      } ${cv}`}
    >
      {face}
      {isTurn ? (
        <span
          className={`block px-2.5 pt-2 pb-2 overflow-hidden ${
            spans2x2 ? 'flex-1 min-h-[88px]' : 'h-[88px]'
          }`}
        >
          <span className="block type-editorial text-[20px] leading-[26px] text-text line-clamp-2">
            {name}
          </span>
          <span className="block mt-0.5">
            <LedgerRow
              tag={tag}
              author={author.name}
              lead={lead}
              date={shortDate(post.date)}
              sample={author.isSample}
            />
          </span>
        </span>
      ) : (
        <span className="block h-[52px] px-2.5 pt-1.5 pb-1.5 overflow-hidden">
          {/* A pinned note's name line stays empty paper — the brand, not a defect. */}
          <span className="block h-5 text-[14px] leading-5 text-text truncate">
            {wordsOnly ? '' : name}
          </span>
          <span className="block mt-0.5">
            <LedgerRow
              tag={tag}
              lead={lead}
              date={shortDate(post.date)}
              sample={author.isSample}
            />
          </span>
        </span>
      )}
    </Link>
  );
}

function PostTile({
  entry,
  variant,
  cols,
  showTag,
  observe,
}: {
  entry: FeedEntry;
  variant: Variant;
  cols: Columns;
  showTag: boolean;
  observe: (el: HTMLElement | null) => void;
}) {
  // Only the mirrored turn is pinned; the auto cursor never back-fills, so
  // reading order stays monotone and tab order matches eyes.
  const seat =
    variant === 'rack'
      ? {}
      : cols === 2
        ? { className: 'col-span-full' }
        : variant === 'turn'
          ? { className: 'col-span-2 row-span-2' }
          : {
              className: 'row-span-2',
              style: { gridColumn: cols === 3 ? '2 / 4' : '3 / 5' },
            };
  return (
    <li ref={observe} data-variant={variant} {...seat}>
      <PostTileLink entry={entry} variant={variant} cols={cols} showTag={showTag} />
    </li>
  );
}

/** A guest from the commons: rack cells only, never the turn. Dashed hairline
 *  where residents wear solid, a selvage strip carrying its provenance, no
 *  monogram tag — a tag would dress a sample as a person. */
function GuestTile({
  guest,
  observe,
}: {
  guest: BufferEntry;
  observe: (el: HTMLElement | null) => void;
}) {
  return (
    <li ref={observe} data-variant="rack">
      <Link
        to={`/explore/${guest.id}`}
        aria-label={`${guest.caption} — ${COMMONS_LABEL}, a sample`}
        className="flex flex-col bg-surface border border-dashed border-border rounded-[2px] overflow-hidden cv-rack"
      >
        <span
          className="relative block w-full bg-mat overflow-hidden shrink-0"
          style={{ aspectRatio: '4 / 5' }}
        >
          {guest.kind === 'video' ? (
            // Poster frame only — playback lives on the detail route.
            <video
              src={guest.path}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={guest.path}
              alt={guest.caption}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          {/* The selvage: the sample's own edge, woven with where it came from. */}
          <span className="absolute left-0 inset-y-0 w-[18px] bg-surface border-r border-dashed border-border flex items-center justify-center overflow-hidden">
            <span className="type-ledger text-[11px] text-text-2 whitespace-nowrap [writing-mode:vertical-rl]">
              {COMMONS_LABEL}
            </span>
          </span>
        </span>
        <span className="block h-[52px] px-2.5 pt-1.5 pb-1.5 overflow-hidden">
          <span className="block h-5 text-[14px] leading-5 text-text truncate">{guest.caption}</span>
          <span className="mt-0.5 flex items-center gap-1 h-[18px] type-ledger text-[11px] text-text-2 min-w-0">
            <span className="truncate min-w-0 shrink-[24]">{COMMONS_LABEL}</span>
            <span className="shrink-0 whitespace-nowrap">· sample</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * One thing on show, in full — the same card the feed deals, with the same
 * verbs, or a guest from the commons with its credit. A dead or no-longer
 * visible id walks silently back to the grid.
 */
function OnShow({ postId }: { postId: string }) {
  const { accounts, community, activeId, setCommunity } = useSession();
  const [pendingOff, setPendingOff] = useState<FeedPost | null>(null);

  const entries = useMemo(
    () => resolveFeedEntries(accounts, community, activeId),
    [accounts, community, activeId]
  );
  const entry = entries.find(e => e.post.id === postId);
  const guest = BUFFER_FEED.find(b => b.id === postId);
  const savedIds = useMemo(() => new Set(community.savedPostIds ?? []), [community.savedPostIds]);

  if (!entry && !guest) return <Navigate to="/explore" replace />;

  const toggleSave = (id: string) => {
    const on = savedIds.has(id);
    setCommunity(prev => {
      const saved = prev.savedPostIds ?? [];
      return { ...prev, savedPostIds: on ? saved.filter(x => x !== id) : [...saved, id] };
    });
    showToast(on ? 'Put back with the rest.' : 'Set aside. Only this device keeps the mark.', 'info');
  };

  const takeOff = (id: string) => {
    setCommunity(prev => ({
      ...prev,
      posts: prev.posts.filter(p => p.id !== id),
      removedPostIds: [...(prev.removedPostIds ?? []), id],
      savedPostIds: (prev.savedPostIds ?? []).filter(x => x !== id),
    }));
    showToast('Taken off the feed. The look stays in your outfits.', 'info');
  };

  const offName = pendingOff?.look?.name ?? pendingOff?.piece?.name ?? 'this';

  return (
    <div className="space-y-6">
      <Masthead
        title="On show"
        action={<LinkButton compact to="/explore">Back</LinkButton>}
      />
      <div className="max-w-[460px] mx-auto">
        {entry ? (
          <PostCard
            post={entry.post}
            author={entry.author}
            isMine={entry.post.authorId === activeId}
            saved={savedIds.has(entry.post.id)}
            onToggleSave={() => toggleSave(entry.post.id)}
            onTakeOff={() => setPendingOff(entry.post)}
          />
        ) : guest ? (
          <Card padded={false}>
            <div className="p-2.5 pb-0">
              <div className="border border-border rounded-[2px] overflow-hidden bg-mat">
                {guest.kind === 'video' ? (
                  <video src={guest.path} className="w-full h-auto" muted playsInline controls />
                ) : (
                  <img src={guest.path} alt={guest.caption} className="w-full h-auto" />
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2.5 min-h-11">
                <span className="text-[14px] text-text">Guests</span>
                <Chip as="span">{COMMONS_LABEL}</Chip>
                <Chip as="span">sample</Chip>
              </div>
              <p className="type-editorial text-[19px] sm:text-[20px] leading-snug text-balance mt-3">
                {guest.caption}
              </p>
              <p className="type-ledger text-[11px] text-text-2 mt-3">
                {guest.author} · cc0 · bundled with the app
              </p>
            </div>
          </Card>
        ) : null}
      </div>

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
