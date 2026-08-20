import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { useSession } from '../context/SessionContext';
import { todayLocal } from '@almari/shared/dates';
import { nowLocalStamp } from '../components/social';
import { ShareSheet } from '../components/ShareSheet';
import { FEED_ENABLED } from '@almari/shared/flags';
import { categoryLabel, displayTag, type ClothingItem, type Outfit, type ShareScope } from '@almari/shared/types';
import {
  Button, Card, Chip, EmptyState, Field, IconButton, Masthead, SectionTitle, TagRail, inputClass,
} from '../components/ui';
import {
  IconCheck, IconClose, IconEyeletFilled, IconPin, IconPlus, IconShears,
} from '../components/icons';
import { Basting, GarmentPlate, PlateEmptyOutfits, PlateWashline } from '../components/art';
import { showToast } from '../components/Toast';

/**
 * OUTFITS — sets of pieces that already work together.
 *
 * Three surfaces, in order of how often they get used:
 *   1. The draw — deals only from getWearablePool() (clean, unbenched, unretired,
 *      non-quiet), optionally narrowed to one occasion. An empty pool is a state
 *      with a plate, not an error.
 *   2. The builder — groups by settings.categories and takes any number of pieces
 *      from any category. No one-slot-per-category assumption: two coats and three
 *      necklaces is a valid outfit.
 *   3. The saved outfits — photos first, one ledger line, one carmine "wear today".
 *
 * Contract: docs/05-brand-identity.md §7, docs/06-focus-group-requirements.md §1.6.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

/** 'YYYY-MM-DD' → a Date at local midnight. Never parse these as UTC. */
function localDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function shortDate(dateStr: string): string {
  const d = localDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function wearsPhrase(n: number): string {
  return n === 1 ? 'worn once' : `worn ${n} times`;
}

function piecesPhrase(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}

function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Photo tile, or the drawn flat when there's no photo. The no-photo state is first-class. */
function Thumb({ item, className = '', alt = '' }: { item: ClothingItem; className?: string; alt?: string }) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
      )}
    </span>
  );
}

/* ---------- saved outfit ---------- */

function OutfitCard({
  outfit,
  members,
  onToggleFavorite,
  onDelete,
  onWear,
  shared,
  onShare,
}: {
  outfit: Outfit;
  members: ClothingItem[];
  onToggleFavorite: () => void;
  onDelete: () => void;
  onWear: () => void;
  shared: boolean;
  onShare: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const retired = members.filter(m => m.retired);

  const ledger = [
    outfit.wearCount === 0 ? 'Not worn yet' : `Worn ${outfit.wearCount}×`,
    outfit.lastWorn ? `Last worn ${shortDate(outfit.lastWorn)}` : null,
    piecesPhrase(outfit.itemIds.length),
  ]
    .filter(Boolean)
    .join(' · ');

  const names = members.map(m => m.name);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="type-editorial text-[19px] leading-tight break-words min-w-0">{outfit.name}</h3>
        <div className="flex items-center shrink-0 -mt-2 -mr-2">
          <IconButton
            label={outfit.favorite ? `Unpin "${outfit.name}"` : `Pin "${outfit.name}"`}
            aria-pressed={outfit.favorite}
            active={outfit.favorite}
            onClick={onToggleFavorite}
          >
            <IconPin size={18} />
          </IconButton>
          <IconButton label={`Delete outfit "${outfit.name}"`} onClick={() => setConfirming(true)}>
            <IconShears size={18} />
          </IconButton>
        </div>
      </div>

      {/* The occasion gets its own row, under the title rather than beside the
          buttons, and the row is a block-level flex container so the chip has a
          DEFINITE width to be clamped against.

          Both halves matter. An occasion is free text and the sample wardrobes
          keep whole sentences in it; a tag is nowrap by design, so the chip's
          min-content width was the whole sentence — 475px inside the 179px
          column it used to share with the pin and the shears, which is where
          /outfits' 139px of sideways scroll came from. Sharing that column also
          meant that even once clamped, a tag had barely a third of the card to
          say anything in. Given the full width it keeps about twice as many
          words before the ellipsis, and hovering still shows the rest. */}
      {outfit.occasion ? (
        <div className="flex mt-2">
          <Chip as="span" title={displayTag(outfit.occasion)}>{displayTag(outfit.occasion)}</Chip>
        </div>
      ) : null}

      {members.length > 0 ? (
        <>
          <TagRail label={`Pieces in ${outfit.name}`} className="gap-1.5 mt-4">
            {members.map(item => (
              <Thumb key={item.id} item={item} alt={item.name} className="w-14 h-[70px] shrink-0" />
            ))}
          </TagRail>
          <p className="text-[13px] text-text-2 mt-2 leading-snug line-clamp-2">
            {names.slice(0, 3).join(' · ')}
            {names.length > 3 ? ` · +${names.length - 3}` : ''}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-text-2 mt-4">
          The pieces in this outfit are no longer in the closet.
        </p>
      )}

      {retired.length > 0 ? (
        <p className="text-[13px] text-text-2 mt-3 leading-snug">
          {retired.length === 1
            ? `"${retired[0].name}" has been retired. The outfit keeps its record.`
            : `${retired.length} pieces here have been retired. The outfit keeps its record.`}
        </p>
      ) : null}

      <Basting className="mt-4" />

      {confirming ? (
        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-[13px] text-text-2 leading-snug">
            Delete this outfit? The pieces stay in the closet.
          </p>
          {/* Destructive on the left, escape on the right — the order Settings,
              Closet and ItemDetail all use. This dialog was the only one in the
              app reversed, so muscle memory trained on the other three landed
              on Delete. */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              tone="destructive"
              compact
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete
            </Button>
            <Button tone="tertiary" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="type-ledger text-[11px] text-text-2 tabular leading-snug">{ledger}</p>
            {/* Not the hero fill. §3 is a rule of scarcity — "one carmine
                element per view region", and this button is inside a card that
                repeats, so a browse page of twenty outfits was rendering twenty
                carmine fills and the accent stopped meaning anything. The hero
                treatment belongs to the single thumb-zone log action on Today. */}
            <Button tone="secondary" onClick={onWear} icon={<IconEyeletFilled size={10} />} className="shrink-0">
              Wear today
            </Button>
          </div>
          {/* Sharing is a deliberate act, so it lives where the look is the
              subject — not as a glyph on a browse tile competing with the photo.

              THE SHARE VERB IS THE LOOK BOOK'S (docs/42 §2). This row writes to
              the shared store the feed reads, so while the Look Book is hidden
              the row goes with it: a Share whose destination is not in the house
              this season is a promise the app cannot keep, and "On the feed"
              would name a room nobody can walk to. Show, Ask and Lend stay
              whole — those are conversation verbs and Chats is on the bar. */}
          {FEED_ENABLED ? (
            <div className="flex items-center justify-between gap-3">
              <p className="type-ledger text-[11px] text-text-2">
                {shared ? 'On the feed' : 'Not shared'}
              </p>
              {/* Tertiary, not a second bordered box: twenty cards each carried
                  two identical secondary buttons, and "Share this look" rendered
                  wider than "Wear today", making the social action the dominant
                  one on the whole browse page. One bordered control per card —
                  the log action. */}
              <Button tone="tertiary" onClick={onShare}>
                {shared ? 'Take it off the feed' : 'Share this look'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* ---------- the page ---------- */

export default function Outfits() {
  const { activeId, accounts, community, setCommunity } = useSession();
  const {
    items, activeItems, outfits, settings,
    addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear, getWearablePool, getItem,
  } = useWardrobe();
  const navigate = useNavigate();

  /* ---------- what this wardrobe has put on the feed ----------
     Answered from the shared store rather than a flag on the outfit: a
     duplicated index is one desync away from telling someone something false
     about what of theirs is visible. */
  const sharedIds = useMemo(
    () => new Set(
      community.posts
        .filter(p => p.authorId === activeId && p.look)
        .map(p => p.look?.outfitId as string)
    ),
    [community.posts, activeId]
  );

  /** The look being shared, while the sheet is open. */
  const [sharing, setSharing] = useState<Outfit | null>(null);

  const lookOf = useCallback((outfit: Outfit) => ({
    outfitId: outfit.id,
    name: outfit.name,
    imageUrl: outfit.imageUrl,
    occasion: outfit.occasion,
    pieces: outfit.itemIds.map(id => getItem(id)?.name).filter((n): n is string => Boolean(n)),
  }), [getItem]);

  const openShare = useCallback((outfit: Outfit) => {
    if (!activeId) return;
    const existing = community.posts.find(p => p.authorId === activeId && p.look?.outfitId === outfit.id);
    if (existing) {
      // Already out: taking it off destroys nothing, so it needs no
      // confirmation. The tombstone is what makes "off" survive a reseed —
      // the seed re-appends any known-id post it finds merely missing.
      setCommunity(prev => ({
        ...prev,
        posts: prev.posts.filter(p => p.id !== existing.id),
        removedPostIds: [...(prev.removedPostIds ?? []), existing.id],
        savedPostIds: (prev.savedPostIds ?? []).filter(id => id !== existing.id),
      }));
      showToast('Taken off the feed. The look stays in your outfits.', 'info');
      return;
    }
    setSharing(outfit);
  }, [activeId, community.posts, setCommunity]);

  const share = useCallback((scope: ShareScope, caption: string) => {
    if (!activeId || !sharing) return;
    setCommunity(prev => ({
      ...prev,
      posts: [
        ...prev.posts,
        {
          id: crypto.randomUUID(),
          authorId: activeId,
          date: todayLocal(),
          // The sub-day stamp is the same-day tiebreak — without it two looks
          // shared one afternoon sorted by a random UUID.
          at: nowLocalStamp(),
          caption: caption || undefined,
          scope,
          look: lookOf(sharing),
        },
      ],
    }));
    const who =
      scope.kind === 'everyone' ? 'Every wardrobe here can see it.'
      : scope.kind === 'self' ? 'It stays on your own profile.'
      : scope.kind === 'person' ? `Only ${accounts.find(a => a.id === scope.accountId)?.name ?? 'they'} can see it.`
      : 'The people in that thread can see it.';
    showToast(`On the feed. ${who}`, 'seal');
    setSharing(null);
  }, [activeId, sharing, setCommunity, lookOf, accounts]);

  const [building, setBuilding] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [includeQuiet, setIncludeQuiet] = useState(false);
  /** '' = draw from everything ready. */
  const [occasion, setOccasion] = useState('');
  /** Carried onto the saved outfit only when the set came out of a filtered draw. */
  const [draftOccasion, setDraftOccasion] = useState('');

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const sortedOutfits = useMemo(
    () =>
      [...outfits].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return b.dateCreated.localeCompare(a.dateCreated);
      }),
    [outfits]
  );

  /* ---------- the draw ---------- */

  const pool = useMemo(() => getWearablePool(), [getWearablePool]);
  const drawPool = useMemo(
    () => (occasion ? pool.filter(i => i.occasion.includes(occasion)) : pool),
    [pool, occasion]
  );

  const draw = () => {
    // Group what's ready, then take one piece from a random handful of categories.
    // Categories are user data, so nothing here assumes a top/bottom/shoe shape.
    const byCategory = new Map<string, ClothingItem[]>();
    for (const item of drawPool) {
      const list = byCategory.get(item.category);
      if (list) list.push(item);
      else byCategory.set(item.category, [item]);
    }

    const order = settings.categories.map(c => c.id).filter(id => byCategory.has(id));
    for (const id of byCategory.keys()) if (!order.includes(id)) order.push(id);
    const rank = new Map(order.map((id, i) => [id, i]));

    let drawn: ClothingItem[] = [];
    if (order.length >= 2) {
      const want = Math.min(order.length, 2 + Math.floor(Math.random() * 3));
      drawn = shuffled(order)
        .slice(0, want)
        .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
        .map(id => pickOne(byCategory.get(id) as ClothingItem[]));
    } else if (drawPool.length >= 2) {
      // One category with several pieces still makes a set — layering is allowed.
      drawn = shuffled(drawPool).slice(0, 2);
    }

    if (drawn.length < 2) return;

    const n = outfits.length + 1;
    setDraftOccasion(occasion);
    setSelected(drawn.map(i => i.id));
    setName(occasion ? `${displayTag(occasion)} set ${n}` : `Set ${n}`);
    setBuilding(true);
    showToast(`Dealt. ${piecesPhrase(drawn.length)}, all ready to wear.`, 'info');
  };

  /* ---------- the builder ---------- */

  const openBuilder = () => {
    setSelected([]);
    setName('');
    setDraftOccasion('');
    setBuilding(true);
  };

  const closeBuilder = () => {
    setBuilding(false);
    setSelected([]);
    setName('');
    setDraftOccasion('');
  };

  const hasQuietCategories = settings.categories.some(c => c.quiet);

  const groups = useMemo(() => {
    const known = new Set(settings.categories.map(c => c.id));
    const rows = settings.categories
      .filter(c => includeQuiet || !c.quiet)
      .map(c => ({
        id: c.id,
        label: categoryLabel(settings, c.id),
        items: activeItems.filter(i => i.category === c.id),
      }))
      .filter(g => g.items.length > 0);

    // Pieces filed under a category that is no longer in settings still have to be
    // reachable — otherwise they quietly drop out of every outfit.
    const orphanIds: string[] = [];
    for (const item of activeItems) {
      if (!known.has(item.category) && !orphanIds.includes(item.category)) orphanIds.push(item.category);
    }
    for (const id of orphanIds) {
      rows.push({
        id,
        label: categoryLabel(settings, id),
        items: activeItems.filter(i => i.category === id),
      });
    }
    return rows;
  }, [settings, activeItems, includeQuiet]);

  const toggleItem = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || selected.length < 2) return;
    addOutfit({
      name: trimmed,
      itemIds: selected,
      favorite: false,
      occasion: draftOccasion || undefined,
    });
    showToast(`Saved. "${trimmed}" — ${piecesPhrase(selected.length)}.`, 'success');
    closeBuilder();
  };

  /* ---------- nothing in the closet yet ---------- */

  if (activeItems.length === 0) {
    return (
      <>
        <Masthead title="Outfits" />
        <Card>
          <EmptyState
            plate={<PlateEmptyOutfits />}
            title="Nothing to put together yet."
            body="An outfit is pieces from the closet, saved as a set. Add a piece or two and this page has something to work with."
            action={
              <Button tone="primary" onClick={() => navigate('/closet')}>
                Open the closet
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  /* ---------- page ---------- */

  return (
    <div className="space-y-6">
      <Masthead
        title="Outfits"
        meta={`${outfits.length} ${outfits.length === 1 ? 'outfit' : 'outfits'}`}
        action={
          !building && outfits.length > 0 ? (
            <Button tone="primary" onClick={openBuilder} icon={<IconPlus size={16} />}>
              Build an outfit
            </Button>
          ) : null
        }
      />

      {/* ---------- builder ---------- */}
      {building ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="type-masthead text-[22px]">Build an outfit</h2>
              <p className="text-[13px] text-text-2 mt-1 leading-snug">
                Take as many pieces as the outfit needs, from any category. Two coats and three
                necklaces is a valid answer.
              </p>
            </div>
            <IconButton label="Close the builder" onClick={closeBuilder} className="shrink-0 -mt-2 -mr-2">
              <IconClose size={18} />
            </IconButton>
          </div>

          <Basting className="my-5" />

          <Field label="Outfit name" htmlFor="outfit-name">
            <input
              id="outfit-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tuesday blacks, the good coat, opening night"
              className={inputClass}
            />
          </Field>

          {hasQuietCategories ? (
            <label htmlFor="include-quiet" className="inline-flex items-center gap-2.5 h-11 mt-2 cursor-pointer">
              <input
                id="include-quiet"
                type="checkbox"
                checked={includeQuiet}
                onChange={e => setIncludeQuiet(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span className="type-ledger text-[11px] text-text-2">Include quiet categories</span>
            </label>
          ) : null}

          <div className="space-y-5 mt-4">
            {groups.map(group => {
              const chosen = group.items.filter(i => selected.includes(i.id)).length;
              return (
                <div key={group.id}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <p className="type-ledger text-[11px] text-text-2">{group.label}</p>
                    {chosen > 0 ? (
                      <span className="type-ledger text-[10px] text-text-2 tabular">{chosen} in</span>
                    ) : null}
                  </div>
                  <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {group.items.map(item => {
                      const isSelected = selected.includes(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            aria-pressed={isSelected}
                            data-selected={isSelected}
                            className={`w-full text-left registered rounded-[2px] p-1 transition-colors duration-150 ${
                              isSelected ? 'bg-sunken' : 'hover:bg-sunken/60'
                            }`}
                          >
                            <span className="block relative">
                              <Thumb item={item} className="aspect-[4/5] w-full" />
                              {isSelected ? (
                                <span className="absolute top-1 right-1 w-5 h-5 bg-ink text-on-ink inline-flex items-center justify-center rounded-[2px] animate-seal">
                                  <IconCheck size={12} />
                                </span>
                              ) : null}
                            </span>
                            <span className="block text-[12px] text-text mt-1.5 leading-tight line-clamp-2">
                              {item.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border">
            <span className="type-ledger text-[11px] text-text-2 tabular">
              {selected.length} selected{selected.length === 1 ? ' — a set takes two' : ''}
            </span>
            <Button tone="primary" onClick={save} disabled={!name.trim() || selected.length < 2}>
              Save outfit
            </Button>
          </div>
        </Card>
      ) : null}

      {/* ---------- the draw ---------- */}
      <Card>
        <SectionTitle aside={`${pool.length} ready`}>Deal a set</SectionTitle>

        {pool.length === 0 ? (
          <EmptyState
            plate={<PlateWashline />}
            title="Everything's on the line. Laundry first."
            body="Only pieces that are clean, mended, and in rotation are dealt. There will be something the moment a wash finishes."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Chip selected={occasion === ''} onClick={() => setOccasion('')}>
                Anything
              </Chip>
              {settings.occasions.map(tag => (
                <Chip
                  key={tag}
                  selected={occasion === tag}
                  onClick={() => setOccasion(occasion === tag ? '' : tag)}
                >
                  {displayTag(tag)}
                </Chip>
              ))}
            </div>

            <Basting className="my-5" />

            {drawPool.length < 2 ? (
              <EmptyState
                plate={<PlateWashline />}
                title={
                  occasion
                    ? `Nothing ready for ${displayTag(occasion).toLowerCase()} right now.`
                    : 'One piece is ready. A set takes two.'
                }
                body={
                  occasion
                    ? 'Clear the tag to deal from everything that is clean and in rotation.'
                    : 'The rest are in the wash, waiting on a repair, or in a category you have taken out of suggestions.'
                }
              />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-[14px] text-text-2 leading-snug">
                  {drawPool.length} pieces are clean and in rotation
                  {occasion ? ` for ${displayTag(occasion).toLowerCase()}` : ''}. A deal takes a few
                  of them at random and hands them to the builder.
                </p>
                <Button onClick={draw} className="shrink-0 w-full sm:w-auto">
                  Deal a set
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ---------- saved outfits ---------- */}
      {sortedOutfits.length > 0 ? (
        <div className="bg-surface plate rounded-[2px] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 v2-rise">
          {sortedOutfits.map(outfit => {
            const members = outfit.itemIds
              .map(id => byId.get(id))
              .filter((i): i is ClothingItem => Boolean(i));
            return (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                members={members}
                onToggleFavorite={() => {
                  toggleFavoriteOutfit(outfit.id);
                  showToast(
                    outfit.favorite ? 'Unpinned.' : 'Pinned. It sits at the top now.',
                    'info'
                  );
                }}
                onDelete={() => {
                  deleteOutfit(outfit.id);
                  showToast('Deleted. The pieces stay in the closet.', 'info');
                }}
                shared={sharedIds.has(outfit.id)}
                onShare={() => openShare(outfit)}
                onWear={() => {
                  logWear(outfit.itemIds, outfit.id);
                  showToast(`Logged. "${outfit.name}" ${wearsPhrase(outfit.wearCount + 1)}.`, 'seal');
                }}
              />
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            plate={<PlateEmptyOutfits />}
            title="No outfits put together yet."
            body="An outfit is a set you already know works — saved once, logged in a tap after that. Build one by hand, or deal one from what is clean."
            action={
              !building ? (
                <Button tone="primary" onClick={openBuilder} icon={<IconPlus size={14} />}>
                  Build an outfit
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {/* Nothing can open it with the row above gone, but a sheet for a verb
          the branch does not offer should not be in the tree either. */}
      {FEED_ENABLED ? (
        <ShareSheet
          open={sharing !== null}
          look={sharing ? lookOf(sharing) : null}
          onClose={() => setSharing(null)}
          onShare={share}
        />
      ) : null}
    </div>
  );
}
