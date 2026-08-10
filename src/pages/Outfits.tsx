import { useState } from 'react';
import { Sparkles, Heart, Trash2, Shuffle, Plus, X, Check } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, type ClothingItem } from '../types';

export default function Outfits() {
  const { items, outfits, addOutfit, deleteOutfit, toggleFavoriteOutfit, logWear } = useWardrobe();
  const [building, setBuilding] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [outfitName, setOutfitName] = useState('');

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const saveOutfit = () => {
    if (!outfitName.trim() || selectedItems.length < 2) return;
    addOutfit({
      name: outfitName.trim(),
      itemIds: selectedItems,
      favorite: false,
    });
    setBuilding(false);
    setSelectedItems([]);
    setOutfitName('');
  };

  const randomOutfit = () => {
    const tops = items.filter(i => i.category === 'tops');
    const bottoms = items.filter(i => i.category === 'bottoms');
    const shoes = items.filter(i => i.category === 'shoes');
    const selected: string[] = [];
    if (tops.length) selected.push(tops[Math.floor(Math.random() * tops.length)].id);
    if (bottoms.length) selected.push(bottoms[Math.floor(Math.random() * bottoms.length)].id);
    if (shoes.length) selected.push(shoes[Math.floor(Math.random() * shoes.length)].id);
    if (selected.length >= 2) {
      setBuilding(true);
      setSelectedItems(selected);
      setOutfitName(`Random Outfit ${outfits.length + 1}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">Outfits</h1>
        <div className="flex gap-2">
          <button
            onClick={randomOutfit}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover flex items-center gap-1.5 transition-all"
          >
            <Shuffle size={14} />
            Random
          </button>
          <button
            onClick={() => { setBuilding(true); setSelectedItems([]); setOutfitName(''); }}
            className="px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover flex items-center gap-1.5 transition-all"
          >
            <Plus size={14} />
            Build Outfit
          </button>
        </div>
      </div>

      {/* Outfit Builder */}
      {building && (
        <div className="bg-cream border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Build an Outfit</h2>
            <button onClick={() => setBuilding(false)} className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover">
              <X size={14} />
            </button>
          </div>

          <input
            type="text"
            value={outfitName}
            onChange={e => setOutfitName(e.target.value)}
            placeholder="Outfit name..."
            className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />

          <div className="space-y-3">
            {(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'] as ClothingItem['category'][]).map(cat => {
              const catItems = items.filter(i => i.category === cat);
              if (!catItems.length) return null;
              return (
                <div key={cat}>
                  <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">{CATEGORY_LABELS[cat]}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {catItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex-shrink-0 w-20 p-1.5 rounded-lg border-2 transition-all ${
                          selectedItems.includes(item.id)
                            ? 'border-accent bg-accent/5'
                            : 'border-transparent bg-surface hover:bg-surface-hover'
                        }`}
                      >
                        <div className="aspect-[3/4] rounded-md overflow-hidden">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-text mt-1 truncate">{item.name}</p>
                        {selectedItems.includes(item.id) && (
                          <div className="flex justify-center mt-1">
                            <Check size={10} className="text-accent" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-text-muted">{selectedItems.length} items selected</span>
            <button
              onClick={saveOutfit}
              disabled={!outfitName.trim() || selectedItems.length < 2}
              className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Save Outfit
            </button>
          </div>
        </div>
      )}

      {/* Saved Outfits */}
      {outfits.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {outfits.map(outfit => (
            <div key={outfit.id} className="bg-cream border border-border rounded-xl p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-text">{outfit.name}</h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleFavoriteOutfit(outfit.id)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      outfit.favorite ? 'text-accent' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <Heart size={14} className={outfit.favorite ? 'fill-current' : ''} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this outfit?')) deleteOutfit(outfit.id);
                    }}
                    className="w-7 h-7 rounded-full text-text-muted hover:text-error flex items-center justify-center"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                {outfit.itemIds.map(id => {
                  const item = items.find(i => i.id === id);
                  return item ? (
                    <div key={id} className="w-16 flex-shrink-0">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-surface">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[10px] text-text-muted mt-1 truncate">{item.name}</p>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{outfit.wearCount} wears</span>
                <button
                  onClick={() => logWear(outfit.itemIds, outfit.id)}
                  className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover active:scale-95 transition-all"
                >
                  Wear Today
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text">No outfits yet</h2>
          <p className="text-sm text-text-secondary mt-1">Create outfits from your closet to get suggestions.</p>
        </div>
      )}
    </div>
  );
}
