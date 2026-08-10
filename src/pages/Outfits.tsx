import { useState } from 'react';
import { Heart, Trash2, Shuffle, Plus, X, Check } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, type ClothingItem } from '../types';
import { showToast } from '../components/Toast';
import { EmptyOutfitArt, DecorativeDivider } from '../components/art';
import type { Outfit } from '../types';

function OutfitCard({ outfit, items, onToggleFavorite, onDelete, onWear }: {
  outfit: Outfit;
  items: ClothingItem[];
  onToggleFavorite: () => void;
  onDelete: () => void;
  onWear: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-border-light card-lift">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-text truncate">{outfit.name}</h3>
          <div className="flex items-center gap-1">
            <button onClick={onToggleFavorite} className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${outfit.favorite ? 'text-rose' : 'text-text-muted hover:text-rose'}`} aria-label={outfit.favorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Heart size={14} className={outfit.favorite ? 'fill-rose' : ''} />
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="w-7 h-7 rounded-full text-text-muted flex items-center justify-center hover:text-error transition-colors" aria-label="Delete outfit">
                <Trash2 size={14} />
              </button>
            ) : (
              <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="w-7 h-7 rounded-full bg-error text-white flex items-center justify-center" aria-label="Confirm delete">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {outfit.itemIds.map(id => {
            const item = items.find(i => i.id === id);
            if (!item) return null;
            return (
              <div key={id} className="flex-shrink-0 w-16">
                <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <p className="text-[10px] text-text-muted mt-1 truncate">{item.name}</p>
              </div>
            );
          })}
        </div>
        <button onClick={onWear} className="mt-3 w-full py-2 bg-accent/10 text-accent border border-accent/30 rounded-lg text-xs font-medium hover:bg-accent/20 transition-all btn-shine">
          I wore this today
        </button>
      </div>
    </div>
  );
}

export default function Outfits() {
  const { items, outfits, addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear } = useWardrobe();
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [outfitName, setOutfitName] = useState('');

  const handleCreate = () => {
    if (selectedItems.length < 2 || !outfitName.trim()) return;
    addOutfit({ name: outfitName.trim(), itemIds: selectedItems, favorite: false });
    showToast(`Outfit "${outfitName.trim()}" saved`, 'success');
    setSelectedItems([]);
    setOutfitName('');
    setShowBuilder(false);
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generateRandom = () => {
    const tops = items.filter(i => i.category === 'tops');
    const bottoms = items.filter(i => i.category === 'bottoms');
    const shoes = items.filter(i => i.category === 'shoes');
    if (tops.length && bottoms.length) {
      const random = [tops[Math.floor(Math.random() * tops.length)].id, bottoms[Math.floor(Math.random() * bottoms.length)].id];
      if (shoes.length) random.push(shoes[Math.floor(Math.random() * shoes.length)].id);
      addOutfit({ name: `Random #${outfits.length + 1}`, itemIds: random, favorite: false });
      showToast('Random outfit generated', 'success');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-editorial text-2xl sm:text-3xl text-text">Outfits</h1>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">{outfits.length} curated looks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateRandom} className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm font-medium text-text-secondary hover:border-border-light hover:text-text transition-all flex items-center gap-1.5">
            <Shuffle size={14} /> Random
          </button>
          <button onClick={() => setShowBuilder(!showBuilder)} className="px-3 py-2 bg-accent/10 text-accent border border-accent/30 rounded-lg text-sm font-medium hover:bg-accent/20 transition-all flex items-center gap-1.5">
            <Plus size={14} /> {showBuilder ? 'Cancel' : 'Create'}
          </button>
        </div>
      </div>
      <DecorativeDivider />

      {/* Outfit Builder */}
      {showBuilder && (
        <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Build Outfit</h2>
            <button onClick={() => setShowBuilder(false)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors">
              <X size={14} />
            </button>
          </div>
          <input type="text" value={outfitName} onChange={e => setOutfitName(e.target.value)} placeholder="Name your look..."
            className="w-full px-3.5 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
          <p className="text-xs text-text-muted">Select items ({selectedItems.length} selected)</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {items.map(item => {
              const selected = selectedItems.includes(item.id);
              return (
                <button key={item.id} onClick={() => toggleItem(item.id)} className={`relative aspect-[3/4] rounded-lg overflow-hidden border transition-all ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-border-light'}`}>
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  {selected && <div className="absolute inset-0 bg-accent/20 flex items-center justify-center"><Check size={20} className="text-accent" /></div>}
                  <span className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/60 text-white text-[9px] truncate">{CATEGORY_LABELS[item.category]}</span>
                </button>
              );
            })}
          </div>
          <button onClick={handleCreate} disabled={selectedItems.length < 2 || !outfitName.trim()}
            className="w-full py-2.5 bg-accent/10 text-accent border border-accent/30 rounded-lg text-sm font-semibold hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-shine">
            Save Outfit
          </button>
        </div>
      )}

      {/* Outfits Grid */}
      {outfits.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {outfits.map(outfit => (
            <OutfitCard key={outfit.id} outfit={outfit} items={items}
              onToggleFavorite={() => { toggleFavoriteOutfit(outfit.id); showToast(outfit.favorite ? 'Removed from favorites' : 'Added to favorites', 'success'); }}
              onDelete={() => { deleteOutfit(outfit.id); showToast('Outfit deleted', 'info'); }}
              onWear={() => { logWear(outfit.itemIds); showToast(`Logged wear for "${outfit.name}"`, 'success'); }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <EmptyOutfitArt className="w-40 h-40 mx-auto mb-4 opacity-60" />
          <h2 className="text-lg font-medium text-text">No outfits yet</h2>
          <p className="text-sm text-text-muted mt-1">Create your first curated look.</p>
        </div>
      )}
    </div>
  );
}
