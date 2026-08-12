import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tilt } from '../components/Glass';
import { useWardrobe } from '../context/WardrobeContext';
import ItemDetail from '../components/ItemDetail';
import AddItemModal from '../components/AddItemModal';
import { showToast } from '../components/Toast';
import { Button, IconButton, Chip, Masthead, Modal, EmptyState, TagRail } from '../components/ui';
import {
  IconSearch, IconClose, IconCheck, IconPin, IconFilter, IconMenu,
  IconDown, IconUp, IconWash, IconPatch, IconPlus,
  IconEyelet, IconEyeletFilled,
} from '../components/icons';
import {
  Basting, GarmentPlate, PlateEmptyCloset, PlateEmptyMending, PlateRetired,
} from '../components/art';
import {
  BENCHED_STATUSES, LAUNDRY_LABELS, PRESET_COLORS, RETIRE_REASONS, SEASON_LABELS, SOURCE_LABELS,
  categoryLabel, displayTag,
  type AppSettings, type ClothingItem, type LaundryStatus, type Season,
} from '../types';
import { wearContext } from '../lib/similarity';
import { useSession } from '../context/SessionContext';
import { offerPass, passRecipients, settlePass } from '../lib/household';
import { costPerWear } from '../lib/cost';

/**
 * Closet — the browse surface. Clothing photos are the hero; everything else is
 * annotation. Retired pieces and quiet categories stay out of the way until asked
 * for. Brand contract: docs/05-brand-identity.md §7 (garment cards, specimen
 * captions), docs/06-focus-group-requirements.md §1.1/§1.4/§1.6.
 */

const LAUNDRY_ORDER: LaundryStatus[] = ['clean', 'worn', 'washing', 'needs-repair', 'at-tailor'];
const SEASON_ORDER: Season[] = ['spring', 'summer', 'fall', 'winter'];

/** '' = every bench state; 'mending' spans the two benched statuses. */
type BenchFilter = '' | LaundryStatus | 'mending';

function isBenchedStatus(status: LaundryStatus) {
  return BENCHED_STATUSES.includes(status);
}

/** Reads a YYYY-MM-DD local date without the toISOString day-shift. */
function readableDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Brand, or the maker when it's self-made. */
function makerLabel(item: ClothingItem): string | null {
  if (item.source === 'self-made') return SOURCE_LABELS['self-made'];
  const brand = item.brand?.trim();
  return brand ? brand : null;
}

/**
 * The specimen caption: `ZARA · 14 WEARS`, or with cost-per-wear once that number
 * means something — `ZARA · WORN 14× · $3.12/WEAR`.
 */
function specimenCaption(item: ClothingItem): string {
  // The predicate used to be re-derived here and inside wearContext, so the two
  // had to be edited in lockstep or the caption silently changed shape.
  const cpwMeaningful = costPerWear(item).reason === 'ok';
  const wears =
    item.wearCount === 0 || cpwMeaningful
      ? wearContext(item)
      : `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`;
  const maker = makerLabel(item);
  return maker ? `${maker} · ${wears}` : wears;
}

function StatusMark({ status }: { status: LaundryStatus }) {
  if (status === 'clean') return null;
  const Icon = isBenchedStatus(status) ? IconPatch : IconWash;
  return (
    <span className="type-ledger text-[10px] text-text-2 mt-1 inline-flex items-center gap-1">
      <Icon size={12} />
      {LAUNDRY_LABELS[status]}
    </span>
  );
}

/** The photo tile itself — flat mat, 4:5, nothing decorative behind it. */
function GarmentTile({ item, className = '' }: { item: ClothingItem; className?: string }) {
  return (
    <div className={`bg-mat overflow-hidden border border-transparent ${className}`}>
      {/* V2: the tile is OPAQUE, so it is allowed to bend — a gentle lean
          toward the pointer, the one rotation the glass law permits. */}
      <Tilt max={3} className="w-full h-full">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
        )}
      </Tilt>
    </div>
  );
}

function ClosetCard({
  item,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onOpen,
  onWear,
  onToggleFavorite,
  onLaundryChange,
  onRetire,
}: {
  item: ClothingItem;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onOpen: () => void;
  onWear: () => void;
  onToggleFavorite: () => void;
  onLaundryChange: (status: LaundryStatus) => void;
  onRetire: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!pressed) return;
    const t = setTimeout(() => setPressed(false), 220);
    return () => clearTimeout(t);
  }, [pressed]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMenuClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, onMenuClose]);

  return (
    <article className="relative group">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:outline-2"
        aria-label={`Open ${item.name}`}
      >
        <GarmentTile item={item} className="aspect-[4/5] group-hover:border-text" />
        <p className="mt-2 text-[14px] leading-snug text-text truncate">{item.name}</p>
        <p className="type-ledger text-[10px] text-text-2 tabular mt-1 truncate">{specimenCaption(item)}</p>
        <StatusMark status={item.laundryStatus} />
      </button>

      {/* Actions stay visible on touch — never hover-revealed. */}
      <div className="mt-1 -ml-2.5 flex items-center">
        <IconButton
          label={`Log a wear of ${item.name}`}
          onClick={() => {
            setPressed(true);
            onWear();
          }}
          className="hover:text-accent"
        >
          <IconCheck size={18} className={pressed ? 'animate-seal' : undefined} />
        </IconButton>
        <IconButton
          label={item.favorite ? `Unpin ${item.name}` : `Pin ${item.name}`}
          aria-pressed={item.favorite}
          active={item.favorite}
          onClick={onToggleFavorite}
        >
          {item.favorite ? <IconPin size={18} fill="currentColor" fillOpacity={0.18} /> : <IconPin size={18} />}
        </IconButton>
        <IconButton
          label={`More for ${item.name}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          active={menuOpen}
          onClick={onMenuToggle}
        >
          <IconMenu size={18} />
        </IconButton>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" role="presentation" onClick={onMenuClose} />
          <div
            role="menu"
            aria-label={`Actions for ${item.name}`}
            className="absolute z-40 left-0 right-0 bottom-0 min-w-[168px] bg-surface plate-ink rounded-[2px] p-1.5 animate-slip"
          >
            <p className="type-ledger text-[10px] text-text-2 px-2 pt-1 pb-1.5">Bench state</p>
            {LAUNDRY_ORDER.map(status => {
              const selected = item.laundryStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onLaundryChange(status);
                    onMenuClose();
                  }}
                  className={`w-full h-11 px-2 flex items-center gap-2 text-left text-[13px] rounded-[2px] transition-colors ${
                    selected ? 'text-text bg-sunken' : 'text-text-2 hover:text-text hover:bg-sunken'
                  }`}
                >
                  <span className={selected ? 'text-accent' : 'opacity-60'}>
                    {selected ? <IconEyeletFilled size={10} /> : <IconEyelet size={10} />}
                  </span>
                  {LAUNDRY_LABELS[status]}
                </button>
              );
            })}
            <Basting className="my-1.5" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuClose();
                onRetire();
              }}
              className="w-full h-11 px-2 flex items-center gap-2 text-left text-[13px] rounded-[2px] text-text-2 hover:text-text hover:bg-sunken transition-colors"
            >
              <IconPatch size={14} />
              Retire this piece
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function RetiredRow({
  item,
  settings,
  onUnretire,
}: {
  item: ClothingItem;
  settings: AppSettings;
  onUnretire: () => void;
}) {
  const parts = [
    categoryLabel(settings, item.category),
    `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`,
    item.retired ? `retired ${readableDate(item.retired.date)}` : null,
    item.retired?.reason ?? null,
  ].filter(Boolean) as string[];

  return (
    <li className="flex items-center gap-3 py-3">
      <GarmentTile item={item} className="w-10 h-[50px] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-text truncate">{item.name}</p>
        <p className="type-ledger text-[10px] text-text-2 truncate">{parts.join(' · ')}</p>
      </div>
      <Button compact onClick={onUnretire}>Return to closet</Button>
    </li>
  );
}

export default function Closet() {
  const {
    items, activeItems, settings,
    addItem, toggleFavoriteItem, deleteItem, logWear, setLaundryStatus, advanceLaundry, retireItem, unretireItem,
  } = useWardrobe();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category');

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSeason, setFilterSeason] = useState<Season | ''>('');
  const [filterOccasion, setFilterOccasion] = useState<string>('');
  const [filterColor, setFilterColor] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [benchFilter, setBenchFilter] = useState<BenchFilter>('');
  const [showQuiet, setShowQuiet] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [amendId, setAmendId] = useState<string | null>(null);
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [retiring, setRetiring] = useState<ClothingItem | null>(null);
  const [passTo, setPassTo] = useState<string>('');
  const { accounts, activeId, active, community, setCommunity } = useSession();
  // Family under the same roof, if any — what makes "pass it on" appear.
  const familyIds = passRecipients(community, activeId);
  const myOffers = community.passes.filter(p => p.toId === activeId && p.status === 'offered');
  const nameOf = (id: string) => accounts.find(a => a.id === id)?.name ?? 'A wardrobe';
  const [retireReason, setRetireReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retiredOpen, setRetiredOpen] = useState(false);

  const setCategoryParam = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('category', id);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  };

  const quietIds = useMemo(
    () => new Set(settings.categories.filter(c => c.quiet).map(c => c.id)),
    [settings.categories]
  );

  /** Category chips: user order, quiet ones only when asked for (or when one is
      the current selection, so the filter never applies invisibly), plus any
      orphaned ids still carried by items so nothing becomes unreachable. */
  const chipCategories = useMemo(() => {
    const known = settings.categories.filter(c => showQuiet || !c.quiet || c.id === activeCategory);
    const knownIds = new Set(settings.categories.map(c => c.id));
    const orphans = Array.from(new Set(activeItems.map(i => i.category)))
      .filter(id => !knownIds.has(id))
      .map(id => ({ id, label: id, quiet: false }));
    return [...known, ...orphans];
  }, [settings.categories, activeItems, showQuiet, activeCategory]);

  /** Quiet categories sit out of browse unless shown, or explicitly asked for. */
  const browsable = useMemo(
    () => activeItems.filter(i =>
      showQuiet || !quietIds.has(i.category) || i.category === activeCategory
    ),
    [activeItems, showQuiet, quietIds, activeCategory]
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return browsable.filter(item => {
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      if (activeCategory && item.category !== activeCategory) return false;
      if (filterSeason && !item.season.includes(filterSeason)) return false;
      if (filterOccasion && !item.occasion.includes(filterOccasion)) return false;
      if (filterColor && item.color !== filterColor) return false;
      if (showFavoritesOnly && !item.favorite) return false;
      if (benchFilter === 'mending' && !isBenchedStatus(item.laundryStatus)) return false;
      if (benchFilter && benchFilter !== 'mending' && item.laundryStatus !== benchFilter) return false;
      return true;
    });
  }, [browsable, search, activeCategory, filterSeason, filterOccasion, filterColor, showFavoritesOnly, benchFilter]);

  const retiredItems = useMemo(
    () => items.filter(i => i.retired)
      .sort((a, b) => (b.retired?.date ?? '').localeCompare(a.retired?.date ?? '')),
    [items]
  );

  const benchCounts = useMemo(() => {
    const counts: Record<string, number> = { mending: 0 };
    for (const status of LAUNDRY_ORDER) counts[status] = 0;
    for (const item of browsable) {
      counts[item.laundryStatus] = (counts[item.laundryStatus] ?? 0) + 1;
      if (isBenchedStatus(item.laundryStatus)) counts.mending += 1;
    }
    return counts;
  }, [browsable]);

  // A state chip at zero is a dead end — it earns its place with a count, or by
  // being the filter currently held. When every piece is Ready, "All N" already
  // says so, and the rail has nothing to add.
  const stateChipStatuses = LAUNDRY_ORDER.filter(
    status => (benchCounts[status] ?? 0) > 0 || benchFilter === status
  );
  const showMendingChip = benchCounts.mending > 0 || benchFilter === 'mending';
  const showStateRail =
    benchFilter !== '' || showMendingChip || stateChipStatuses.some(s => s !== 'clean');

  /** Colors actually present in the closet — a palette, not a picker. */
  const paletteColors = useMemo(() => {
    const tally = new Map<string, number>();
    for (const item of browsable) {
      if (!item.color) continue;
      tally.set(item.color, (tally.get(item.color) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([hex]) => hex);
  }, [browsable]);

  const activeFiltersCount = [
    activeCategory, filterSeason, filterOccasion, filterColor,
    showFavoritesOnly || null, benchFilter || null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setCategoryParam(null);
    setFilterSeason('');
    setFilterOccasion('');
    setFilterColor('');
    setShowFavoritesOnly(false);
    setBenchFilter('');
    setSearch('');
  };

  const closeRetire = () => {
    setRetiring(null);
    setRetireReason('');
    setConfirmDelete(false);
  };

  const closetEmpty = activeItems.length === 0 && retiredItems.length === 0;
  const countLabel = `${filteredItems.length} ${filteredItems.length === 1 ? 'piece' : 'pieces'}`;

  return (
    <div>
      <Masthead title="Closet" meta={closetEmpty ? undefined : countLabel} />

      {closetEmpty ? (
        <EmptyState
          plate={<PlateEmptyCloset />}
          title="Nothing hangs here yet."
          body="Add one piece — a photo, a name, a color — and the ledger starts counting from its first wear."
          action={
            <Button tone="primary" icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
              Add a piece
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* The tray: hand-me-downs mid-air. Pull-only — no badge, no bubble —
              and nothing lands until the yes is said from in here, because a
              closet something can appear in uninvited is not your closet. */}
          {myOffers.map(offer => (
            <div key={offer.id} className="bg-surface plate rounded-[2px] px-4 py-3">
              <p className="type-ledger text-[11px] text-text-2">A piece has been passed to you</p>
              <p className="text-[15px] text-text mt-1">
                {offer.piece.name}
                <span className="text-text-2"> — a hand-me-down from {offer.provenance.from}
                {offer.provenance.wearsInTheirRecord
                  ? `, ${offer.provenance.wearsInTheirRecord} wears in their record`
                  : ''}.</span>
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Button
                  compact
                  onClick={() => {
                    addItem({
                      name: offer.piece.name,
                      category: offer.piece.category ?? settings.categories[0]?.id ?? 'tops',
                      color: offer.piece.color ?? PRESET_COLORS[0],
                      season: [],
                      occasion: [],
                      imageUrl: offer.piece.imageUrl ?? '',
                      source: 'inherited',
                      favorite: false,
                      provenance: offer.provenance,
                    });
                    setCommunity(prev => settlePass(prev, offer.id, 'accepted'));
                    showToast(`Taken in. It starts at 0 wears — ${offer.provenance.from}'s stay theirs.`, 'success');
                  }}
                >
                  Take it in
                </Button>
                <Button
                  tone="tertiary"
                  onClick={() => {
                    setCommunity(prev => settlePass(prev, offer.id, 'declined'));
                    showToast('Declined. It stays where it is.', 'info');
                  }}
                >
                  Not for me
                </Button>
              </div>
            </div>
          ))}

          {/* Search — the one boxed input, with the filter drawer beside it. */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="closet-search" className="sr-only">Search pieces by name</label>
              <IconSearch
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none"
              />
              <input
                id="closet-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name"
                className="w-full h-11 pl-9 pr-12 bg-surface border border-border rounded-[2px] text-[15px] text-text placeholder:text-text-2 focus:outline-none focus:border-accent transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-text-2 hover:text-text"
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              aria-expanded={showFilters}
              aria-controls="closet-filters"
              className={`h-11 px-4 inline-flex items-center gap-2 rounded-[2px] border type-label transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? 'border-text text-text bg-sunken'
                  : 'border-border text-text-2 bg-surface hover:text-text'
              }`}
            >
              <IconFilter size={16} />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="type-ledger text-[11px] text-accent tabular">{activeFiltersCount}</span>
              )}
            </button>
          </div>

          {/* Two rails, held together as one deck: what a piece IS, then where
              it currently is. Kept 8px apart and 20px clear of the grid so they
              read as two questions rather than one wall of chips. */}
          <div className="space-y-2">
            {/* Category — the user's own taxonomy, quiet ones withheld by default. */}
            <div className="flex items-center gap-2">
              <span className="type-ledger text-[11px] text-text-2 w-10 shrink-0" aria-hidden="true">Kind</span>
              <TagRail label="Filter by category" className="flex-1">
              <Chip selected={!activeCategory} onClick={() => setCategoryParam(null)}>
                Everything
              </Chip>
              {chipCategories.map(cat => (
                <Chip
                  key={cat.id}
                  selected={activeCategory === cat.id}
                  onClick={() => setCategoryParam(activeCategory === cat.id ? null : cat.id)}
                  title={cat.quiet ? 'Quiet category' : undefined}
                >
                  {cat.label}
                </Chip>
              ))}
              </TagRail>
            </div>

            {/* Bench states — ready through the mending pile. The two rails read
                as two questions only if each says which question it is. */}
            {showStateRail ? (
            <div className="flex items-center gap-2">
              <span className="type-ledger text-[11px] text-text-2 w-10 shrink-0" aria-hidden="true">State</span>
              <TagRail label="Filter by state" className="flex-1">
              <Chip selected={benchFilter === ''} onClick={() => setBenchFilter('')}>
                All {browsable.length}
              </Chip>
              {stateChipStatuses.map(status => (
                <Chip
                  key={status}
                  selected={benchFilter === status}
                  onClick={() => setBenchFilter(benchFilter === status ? '' : status)}
                >
                  {LAUNDRY_LABELS[status]} {benchCounts[status] ?? 0}
                </Chip>
              ))}
              {showMendingChip ? (
                <Chip
                  selected={benchFilter === 'mending'}
                  onClick={() => setBenchFilter(benchFilter === 'mending' ? '' : 'mending')}
                  title="Needs repair and at the tailor"
                >
                  Mending pile {benchCounts.mending}
                </Chip>
              ) : null}
              </TagRail>
            </div>
            ) : null}
          </div>

          {/* Wash day used to be sixty taps — the State rail could show
              "Needs a wash 12" but could do nothing about it. With the filter
              active, the filter becomes the verb. */}
          {benchFilter === 'worn' && benchCounts.worn > 0 ? (
            <div className="flex items-center justify-between gap-3 bg-surface plate rounded-[2px] px-4 py-3">
              <p className="text-[13px] text-text-2">
                {benchCounts.worn} {benchCounts.worn === 1 ? 'piece is' : 'pieces are'} waiting on the basket.
              </p>
              <Button
                compact
                onClick={() => {
                  const n = advanceLaundry('worn', 'washing');
                  showToast(`In the wash. ${n} ${n === 1 ? 'piece' : 'pieces'}.`, 'info');
                }}
              >
                Send them all to the wash
              </Button>
            </div>
          ) : null}
          {benchFilter === 'washing' && benchCounts.washing > 0 ? (
            <div className="flex items-center justify-between gap-3 bg-surface plate rounded-[2px] px-4 py-3">
              <p className="text-[13px] text-text-2">
                {benchCounts.washing} {benchCounts.washing === 1 ? 'piece is' : 'pieces are'} in the machine.
              </p>
              <Button
                compact
                onClick={() => {
                  const n = advanceLaundry('washing', 'clean');
                  showToast(`Done and folded. ${n} back on the rail.`, 'info');
                }}
              >
                The wash is done
              </Button>
            </div>
          ) : null}

          {showFilters && (
            <div id="closet-filters" className="bg-surface plate rounded-[2px] p-4 sm:p-5 space-y-4 animate-slip">
              <div className="flex items-center justify-between gap-3">
                <h2 className="type-label text-text">Filters</h2>
                <div className="flex items-center gap-3">
                  <span className="type-ledger text-[11px] text-text-2 tabular">
                    {activeFiltersCount} active
                  </span>
                  <Button tone="tertiary" onClick={clearFilters}>Clear</Button>
                </div>
              </div>

              <Basting />

              <div>
                <p className="type-ledger text-[11px] text-text-2 mb-2">Season</p>
                <div className="flex flex-wrap gap-2">
                  {SEASON_ORDER.map(season => (
                    <Chip
                      key={season}
                      selected={filterSeason === season}
                      onClick={() => setFilterSeason(filterSeason === season ? '' : season)}
                    >
                      {SEASON_LABELS[season]}
                    </Chip>
                  ))}
                </div>
              </div>

              {settings.occasions.length > 0 && (
                <div>
                  <p className="type-ledger text-[11px] text-text-2 mb-2">Occasion</p>
                  <div className="flex flex-wrap gap-2">
                    {settings.occasions.map(occasion => (
                      <Chip
                        key={occasion}
                        selected={filterOccasion === occasion}
                        onClick={() => setFilterOccasion(filterOccasion === occasion ? '' : occasion)}
                      >
                        {displayTag(occasion)}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {paletteColors.length > 0 && (
                <div>
                  <p className="type-ledger text-[11px] text-text-2 mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {paletteColors.map(hex => (
                      <Chip
                        key={hex}
                        selected={filterColor === hex}
                        onClick={() => setFilterColor(filterColor === hex ? '' : hex)}
                        title={hex}
                      >
                        <span
                          className="w-2.5 h-2.5 border border-border inline-block"
                          style={{ backgroundColor: hex }}
                        />
                        {hex.replace('#', '')}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="type-ledger text-[11px] text-text-2 mb-2">View</p>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    selected={showFavoritesOnly}
                    onClick={() => setShowFavoritesOnly(v => !v)}
                  >
                    Pinned only
                  </Chip>
                  {quietIds.size > 0 && (
                    <Chip selected={showQuiet} onClick={() => setShowQuiet(v => !v)}>
                      Show quiet categories
                    </Chip>
                  )}
                </div>
                {quietIds.size > 0 && (
                  <p className="text-[13px] text-text-2 mt-2 leading-snug">
                    Quiet categories stay out of browse and out of the generator until you ask for them.
                  </p>
                )}
              </div>
            </div>
          )}

          {filteredItems.length > 0 ? (
            <div className="bg-surface plate rounded-[2px] p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 v2-rise">
              {filteredItems.map(item => (
                <ClosetCard
                  key={item.id}
                  item={item}
                  menuOpen={menuItemId === item.id}
                  onMenuToggle={() => setMenuItemId(menuItemId === item.id ? null : item.id)}
                  onMenuClose={() => setMenuItemId(null)}
                  onOpen={() => setDetailId(item.id)}
                  onWear={() => {
                    logWear([item.id]);
                    const total = item.wearCount + 1;
                    showToast(`Logged. Worn ${total} ${total === 1 ? 'time' : 'times'}.`, 'seal');
                  }}
                  onToggleFavorite={() => {
                    toggleFavoriteItem(item.id);
                    showToast(item.favorite ? 'Unpinned.' : 'Pinned.', 'info');
                  }}
                  onLaundryChange={status => {
                    setLaundryStatus(item.id, status);
                    showToast(`Marked ${LAUNDRY_LABELS[status].toLowerCase()}.`, 'info');
                  }}
                  onRetire={() => {
                    setRetiring(item);
                    setRetireReason('');
                    setConfirmDelete(false);
                  }}
                />
              ))}
            </div>
          ) : benchFilter === 'mending' ? (
            <EmptyState
              plate={<PlateEmptyMending />}
              title="Your needle rests."
              body="Nothing is waiting for repair or sitting with the tailor."
              action={
                activeFiltersCount > 1
                  ? <Button onClick={clearFilters}>Clear filters</Button>
                  : <Button onClick={() => setBenchFilter('')}>Back to everything</Button>
              }
            />
          ) : (
            <div className="py-12 text-center">
              <p className="type-editorial text-[20px]">Nothing here matches.</p>
              <p className="text-[14px] text-text-2 mt-2">
                {activeFiltersCount > 0 || search
                  ? 'The filters are narrower than the closet.'
                  : 'Every piece is filed elsewhere.'}
              </p>
              {(activeFiltersCount > 0 || search) && (
                <div className="mt-4">
                  <Button onClick={clearFilters}>Clear filters</Button>
                </div>
              )}
            </div>
          )}

          {/* Retired — collapsed, kept, never scolded. */}
          {retiredItems.length > 0 && (
            <section className="pt-4">
              <Basting className="mb-2" />
              <button
                type="button"
                onClick={() => setRetiredOpen(v => !v)}
                aria-expanded={retiredOpen}
                className="w-full h-11 flex items-center justify-between gap-3 text-left text-text-2 hover:text-text transition-colors"
              >
                <span className="type-label">Retired</span>
                <span className="flex items-center gap-2">
                  <span className="type-ledger text-[11px] tabular">
                    {retiredItems.length} {retiredItems.length === 1 ? 'piece' : 'pieces'}
                  </span>
                  {retiredOpen ? <IconUp size={16} /> : <IconDown size={16} />}
                </span>
              </button>

              {retiredOpen && (
                <div className="mt-3 flex flex-col sm:flex-row gap-5 sm:gap-7 items-start animate-slip">
                  <div className="self-center sm:self-start shrink-0 opacity-80">
                    <PlateRetired />
                  </div>
                  <div className="flex-1 w-full min-w-0">
                    <p className="type-editorial text-[20px]">This piece did its work.</p>
                    <p className="text-[14px] text-text-2 mt-2 leading-relaxed">
                      Retired pieces keep every wear they earned. They stay out of browse, the
                      generator, and comparisons — and they come back whenever you want them.
                    </p>
                    <ul className="mt-4 divide-y divide-border border-t border-border">
                      {retiredItems.map(item => (
                        <RetiredRow
                          key={item.id}
                          item={item}
                          settings={settings}
                          onUnretire={() => {
                            unretireItem(item.id);
                            showToast(`${item.name} is back in the closet.`, 'success');
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Retire flow — deleting hides in here, labelled for mistakes only. */}
      <Modal open={retiring !== null} onClose={closeRetire} title="Retire">
        {retiring && (
          <div>
            <p className="text-[15px] text-text leading-relaxed">
              {retiring.name} keeps its {retiring.wearCount}{' '}
              {retiring.wearCount === 1 ? 'wear' : 'wears'} and leaves the rotation.
            </p>
            <p className="type-editorial text-[18px] mt-2">This piece did its work.</p>

            <div className="mt-5">
              <p className="type-ledger text-[11px] text-text-2 mb-2">Where did it go? Optional.</p>
              <div className="flex flex-wrap gap-2">
                {RETIRE_REASONS.map(reason => (
                  <Chip
                    key={reason}
                    selected={retireReason === reason}
                    onClick={() => setRetireReason(retireReason === reason ? '' : reason)}
                  >
                    {reason}
                  </Chip>
                ))}
              </div>
            </div>

            {familyIds.length > 0 ? (
              <div className="mt-5">
                <p className="type-ledger text-[11px] text-text-2 mb-2">Or pass it on</p>
                <div className="flex flex-wrap gap-2">
                  {familyIds.map(id => (
                    <Chip key={id} selected={passTo === id} onClick={() => setPassTo(passTo === id ? '' : id)}>
                      To {nameOf(id)}
                    </Chip>
                  ))}
                </div>
                <p className="text-[13px] text-text-2 mt-2 leading-snug">
                  A hand-me-down: it appears in their tray with its story attached, and it
                  lands only when they accept. Your {retiring.wearCount}{' '}
                  {retiring.wearCount === 1 ? 'wear stays' : 'wears stay'} in your own record.
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex items-center gap-3">
              <Button
                tone="primary"
                onClick={() => {
                  if (passTo) {
                    setCommunity(prev =>
                      offerPass(prev, activeId ?? '', active?.name ?? 'A wardrobe', passTo, {
                        itemId: retiring.id,
                        name: retiring.name,
                        imageUrl: retiring.imageUrl,
                        category: retiring.category,
                        color: retiring.color,
                      }, retiring.wearCount || undefined)
                    );
                    retireItem(retiring.id, 'Passed on');
                    showToast(`Offered. It waits in ${nameOf(passTo)}'s tray.`, 'success');
                  } else {
                    retireItem(retiring.id, retireReason || undefined);
                    showToast('Retired. Its history stays in the ledger.', 'success');
                  }
                  setPassTo('');
                  closeRetire();
                }}
              >
                {passTo ? `Pass it to ${nameOf(passTo)}` : 'Retire it'}
              </Button>
              <Button tone="tertiary" onClick={closeRetire}>Keep it</Button>
            </div>

            <Basting className="my-5" />

            {!confirmDelete ? (
              <Button tone="tertiary" onClick={() => setConfirmDelete(true)}>
                Added by mistake? Delete instead
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-text-2 leading-snug">
                  Deleting removes {retiring.name} and its wear history for good. Retiring is the
                  usual way out.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    tone="destructive"
                    compact
                    onClick={() => {
                      deleteItem(retiring.id);
                      showToast('Deleted.', 'info');
                      closeRetire();
                    }}
                  >
                    Delete for good
                  </Button>
                  <Button tone="tertiary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {detailId && (
        <ItemDetail
          itemId={detailId}
          onClose={() => setDetailId(null)}
          onAmend={() => {
            setAmendId(detailId);
            setDetailId(null);
          }}
        />
      )}
      {amendId && (
        <AddItemModal
          open
          editItem={items.find(i => i.id === amendId)}
          onClose={() => setAmendId(null)}
        />
      )}
      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
