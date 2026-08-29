import { useState, useMemo } from 'react';
import { useWardrobe } from '../context/WardrobeContext';
import { categoryLabel } from '@almari/shared/types';
import { Button, IconButton, Modal, SectionTitle } from './ui';
import { IconCheck, IconClose, IconSearch } from './icons';
import { Basting, GarmentPlate } from './art';
import { photoSrc } from '../lib/photoStore';
import { showToast } from './Toast';

interface PackingListModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PackingListModal({ open, onClose }: PackingListModalProps) {
  const { activeItems, settings } = useWardrobe();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [packedIds, setPackedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [tripDays, setTripDays] = useState(3);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        categoryLabel(settings, item.category).toLowerCase().includes(q)
    );
  }, [activeItems, search, settings]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPackedIds(p => {
          const np = new Set(p);
          np.delete(id);
          return np;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePacked = (id: string) => {
    setPackedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    return activeItems.filter(i => selectedIds.has(i.id));
  }, [activeItems, selectedIds]);

  const copyAsText = () => {
    if (selectedItems.length === 0) return;
    const lines = [
      `PACKING LIST (${tripDays} days · ${selectedItems.length} pieces)`,
      '----------------------------------------',
      ...selectedItems.map(
        i => `[${packedIds.has(i.id) ? 'x' : ' '}] ${i.name} (${categoryLabel(settings, i.category)})`
      ),
      '----------------------------------------',
      'Packed with Almari',
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Packing list copied to clipboard');
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setPackedIds(new Set());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Packing List"
      wide
    >
      <div className="space-y-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="type-ledger text-[12px] text-text-2">Trip length:</span>
            <div className="flex items-center gap-1">
              {[2, 3, 5, 7, 14].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTripDays(days)}
                  className={`px-2 py-1 text-[12px] rounded-[2px] border transition-colors ${
                    tripDays === days
                      ? 'border-accent text-accent bg-accent/5 font-medium'
                      : 'border-border text-text-2 hover:border-text-2'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <>
                <Button tone="secondary" compact onClick={copyAsText}>
                  Copy list
                </Button>
                <Button tone="secondary" compact onClick={clearAll}>
                  Clear
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <IconSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search closet to pack..."
            className="w-full bg-field border border-border rounded-[2px] pl-9 pr-8 py-2 text-[14px] text-text placeholder:text-text-2 focus:outline-none focus:border-accent"
          />
          {search ? (
            <IconButton
              label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-2"
            >
              <IconClose size={14} />
            </IconButton>
          ) : null}
        </div>

        {/* Active Packing Selection vs Closet Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Closet items to pick */}
          <div className="border border-border rounded-[2px] p-3 max-h-[380px] overflow-y-auto">
            <SectionTitle aside={`${filteredItems.length} available`}>Closet pieces</SectionTitle>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                const photo = photoSrc(item.imageUrl);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className={`relative p-1 rounded-[2px] border text-left transition-all group ${
                      isSelected
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-text-2'
                    }`}
                  >
                    <div className="aspect-[4/5] bg-mat overflow-hidden rounded-[2px] mb-1">
                      {photo ? (
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
                      )}
                    </div>
                    <p className="text-[11px] text-text font-medium truncate">{item.name}</p>
                    <p className="type-ledger text-[9px] text-text-2 truncate">
                      {categoryLabel(settings, item.category)}
                    </p>
                    {isSelected ? (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-bg flex items-center justify-center">
                        <IconCheck size={10} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Packed Checklist */}
          <div className="border border-border rounded-[2px] p-3 max-h-[380px] overflow-y-auto flex flex-col justify-between">
            <div>
              <SectionTitle aside={`${packedIds.size} of ${selectedIds.size} packed`}>
                Packing checklist
              </SectionTitle>
              {selectedItems.length === 0 ? (
                <p className="type-editorial text-[14px] text-text-2 mt-4 text-center">
                  Select pieces from the closet to build your capsule.
                </p>
              ) : (
                <ul className="space-y-1.5 mt-2">
                  {selectedItems.map(item => {
                    const isPacked = packedIds.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-[2px] border border-border/60 hover:bg-mat/50"
                      >
                        <button
                          type="button"
                          onClick={() => togglePacked(item.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <span
                            className={`w-4 h-4 rounded-[2px] border flex items-center justify-center transition-colors ${
                              isPacked ? 'bg-text border-text text-bg' : 'border-border'
                            }`}
                          >
                            {isPacked ? <IconCheck size={10} /> : null}
                          </span>
                          <span
                            className={`text-[13px] truncate ${
                              isPacked ? 'line-through text-text-2' : 'text-text'
                            }`}
                          >
                            {item.name}
                          </span>
                        </button>
                        <span className="type-ledger text-[10px] text-text-2 shrink-0">
                          {categoryLabel(settings, item.category)}
                        </span>
                        <IconButton
                          label="Remove"
                          onClick={() => toggleSelect(item.id)}
                          className="text-text-2 hover:text-accent"
                        >
                          <IconClose size={12} />
                        </IconButton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selectedItems.length > 0 ? (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="type-ledger text-[11px] text-text-2">
                  Capsule density: {(selectedItems.length / Math.max(tripDays, 1)).toFixed(1)} pieces / day
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <Basting className="my-2" />

        <div className="flex justify-end gap-3">
          <Button tone="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

