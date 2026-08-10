import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Heart, Trash2, X } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, SEASON_LABELS, OCCASION_LABELS, type Category, type Season, type Occasion } from '../types';
import { showToast } from '../components/Toast';
import type { ClothingItem } from '../types';

function ClosetItemCard({ item, onToggleFavorite, onDelete }: {
  item: ClothingItem;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group bg-cream border border-border rounded-xl overflow-hidden hover:shadow-md transition-all">
      <div className="aspect-[3/4] relative">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 right-2 flex gap-1.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleFavorite}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
              item.favorite ? 'bg-accent text-white' : 'bg-white/90 text-text hover:bg-white'
            }`}
            aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={14} className={item.favorite ? 'fill-current' : ''} />
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-8 h-8 rounded-full bg-white/90 text-error flex items-center justify-center backdrop-blur-md hover:bg-white"
              aria-label="Delete item"
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              className="w-8 h-8 rounded-full bg-error text-white flex items-center justify-center"
              aria-label="Confirm delete"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {item.wearCount > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 text-white text-[10px] rounded-full backdrop-blur-sm">
            {item.wearCount} wears
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-text truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
            {CATEGORY_LABELS[item.category]}
          </span>
          <span
            className="w-3 h-3 rounded-full border border-border"
            style={{ backgroundColor: item.color }}
            title={item.color}
          />
        </div>
      </div>
    </div>
  );
}

export default function Closet() {
  const { items, toggleFavoriteItem, deleteItem } = useWardrobe();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const activeCategory = searchParams.get('category') as Category | null;
  const [filterSeason, setFilterSeason] = useState<Season | ''>('');
  const [filterOccasion, setFilterOccasion] = useState<Occasion | ''>('');
  const [filterColor, setFilterColor] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeCategory && item.category !== activeCategory) return false;
      if (filterSeason && !item.season.includes(filterSeason)) return false;
      if (filterOccasion && !item.occasion.includes(filterOccasion)) return false;
      if (filterColor && item.color !== filterColor) return false;
      if (showFavoritesOnly && !item.favorite) return false;
      return true;
    });
  }, [items, search, activeCategory, filterSeason, filterOccasion, filterColor, showFavoritesOnly]);

  const activeFiltersCount = [
    activeCategory,
    filterSeason,
    filterOccasion,
    filterColor,
    showFavoritesOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchParams({});
    setFilterSeason('');
    setFilterOccasion('');
    setFilterColor('');
    setShowFavoritesOnly(false);
    setSearch('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">My Closet</h1>
        <span className="text-sm text-text-muted">{filteredItems.length} items</span>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-9 py-2.5 bg-cream border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            aria-label="Search clothing items"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            showFilters || activeFiltersCount > 0
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-cream border-border text-text-secondary hover:bg-surface'
          }`}
        >
          <SlidersHorizontal size={16} />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSearchParams({})}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            !activeCategory ? 'bg-accent text-white' : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          All
        </button>
        {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
          <button
            key={cat}
            onClick={() => setSearchParams({ category: cat })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === cat ? 'bg-accent text-white' : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-cream border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">Filters</h3>
            <button onClick={clearFilters} className="text-xs text-accent hover:underline">Clear all</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Season</label>
              <select
                value={filterSeason}
                onChange={e => setFilterSeason(e.target.value as Season)}
                className="w-full px-2.5 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-accent"
              >
                <option value="">All</option>
                {(Object.keys(SEASON_LABELS) as Season[]).map(s => (
                  <option key={s} value={s}>{SEASON_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Occasion</label>
              <select
                value={filterOccasion}
                onChange={e => setFilterOccasion(e.target.value as Occasion)}
                className="w-full px-2.5 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-accent"
              >
                <option value="">All</option>
                {(Object.keys(OCCASION_LABELS) as Occasion[]).map(o => (
                  <option key={o} value={o}>{OCCASION_LABELS[o]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Color</label>
              <input
                type="color"
                value={filterColor || '#000000'}
                onChange={e => setFilterColor(e.target.value === '#000000' ? '' : e.target.value)}
                className="w-full h-[34px] bg-surface border border-border rounded-lg cursor-pointer"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  showFavoritesOnly ? 'bg-accent/15 text-accent' : 'bg-surface text-text-secondary'
                }`}
              >
                <Heart size={12} className={showFavoritesOnly ? 'fill-accent' : ''} />
                Favorites Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map(item => (
            <ClosetItemCard
              key={item.id}
              item={item}
              onToggleFavorite={() => {
                toggleFavoriteItem(item.id);
                showToast(item.favorite ? 'Removed from favorites' : 'Added to favorites', 'success');
              }}
              onDelete={() => {
                deleteItem(item.id);
                showToast('Item deleted', 'info');
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sm text-text-secondary">No items match your filters.</p>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-accent mt-2 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
