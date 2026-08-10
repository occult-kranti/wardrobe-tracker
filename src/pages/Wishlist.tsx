import { useState } from 'react';
import { Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, PRESET_COLORS, type Category } from '../types';
import { showToast } from '../components/Toast';

export default function Wishlist() {
  const { wishlist, addWishlistItem, deleteWishlistItem, moveWishlistToCloset } = useWardrobe();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tops');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addWishlistItem({
      name: name.trim(),
      category,
      color,
      brand: brand.trim() || undefined,
      price: price ? parseFloat(price) : undefined,
      priority,
      notes: notes.trim() || undefined,
      purchased: false,
    });
    showToast('Added to wishlist', 'success');
    setName('');
    setBrand('');
    setPrice('');
    setNotes('');
    setShowAdd(false);
  };

  const priorityColors = {
    low: 'bg-surface text-text-muted',
    medium: 'bg-warning/10 text-warning',
    high: 'bg-error/10 text-error',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">Wishlist</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover flex items-center gap-1.5 transition-all"
        >
          <Plus size={14} />
          Add Item
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-cream border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Add to Wishlist</h2>
            <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Item name *"
                required
                className="px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="Brand (optional)"
                className="px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="Price"
                min="0"
                step="0.01"
                className="px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      color === c ? 'border-accent scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Add to Wishlist
            </button>
          </form>
        </div>
      )}

      {/* Wishlist Items */}
      {wishlist.length > 0 ? (
        <div className="space-y-3">
          {wishlist.map(item => (
            <div key={item.id} className="bg-cream border border-border rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all">
              <div
                className="w-14 h-14 rounded-lg flex-shrink-0 border border-border"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-text truncate">{item.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityColors[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span>{CATEGORY_LABELS[item.category]}</span>
                  {item.brand && <span>· {item.brand}</span>}
                  {item.price && <span>· ${item.price.toFixed(2)}</span>}
                </div>
                {item.notes && <p className="text-xs text-text-secondary mt-1">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => {
                    moveWishlistToCloset(item.id);
                    showToast(`Moved "${item.name}" to closet`, 'success');
                  }}
                  className="px-3 py-1.5 bg-success/10 text-success rounded-lg text-xs font-medium hover:bg-success/20 flex items-center gap-1 transition-all"
                >
                  <ShoppingBag size={12} />
                  Got it
                </button>
                <button
                  onClick={() => {
                    deleteWishlistItem(item.id);
                    showToast('Removed from wishlist', 'info');
                  }}
                  className="w-8 h-8 rounded-full text-text-muted hover:text-error flex items-center justify-center transition-colors"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto flex items-center justify-center mb-4">
            <ShoppingBag size={28} className="text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text">Your wishlist is empty</h2>
          <p className="text-sm text-text-secondary mt-1">Save items you want to buy later.</p>
        </div>
      )}

      {/* Total value */}
      {wishlist.length > 0 && (
        <div className="bg-cream border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Total Wishlist Value</p>
            <p className="text-xl font-semibold text-text">
              ${wishlist.reduce((sum, i) => sum + (i.price || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">Items</p>
            <p className="text-xl font-semibold text-text">{wishlist.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
