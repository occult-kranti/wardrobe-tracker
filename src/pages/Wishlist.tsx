import { useState } from 'react';
import { Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, PRESET_COLORS, type Category } from '../types';
import { showToast } from '../components/Toast';
import { EmptyWishlistArt, DecorativeDivider } from '../components/art';

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
      name: name.trim(), category, color,
      brand: brand.trim() || undefined,
      price: price ? parseFloat(price) : undefined,
      priority, notes: notes.trim() || undefined, purchased: false,
    });
    showToast('Added to wishlist', 'success');
    setName(''); setBrand(''); setPrice(''); setNotes(''); setShowAdd(false);
  };

  const priorityColors = {
    low: 'bg-bg-elevated text-text-muted border border-border',
    medium: 'bg-amber/10 text-amber border border-amber/30',
    high: 'bg-rose/10 text-rose border border-rose/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-editorial text-2xl sm:text-3xl text-text">Wishlist</h1>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Pieces you're eyeing</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-2 bg-accent/10 text-accent border border-accent/30 rounded-lg text-sm font-medium hover:bg-accent/20 transition-all flex items-center gap-1.5">
          <Plus size={14} /> Add Item
        </button>
      </div>
      <DecorativeDivider />

      {/* Add Form */}
      {showAdd && (
        <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Add to Wishlist</h2>
            <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Item name *" required
                className="px-3.5 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
              <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand"
                className="px-3.5 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select value={category} onChange={e => setCategory(e.target.value as Category)}
                className="px-3 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent">
                {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
              </select>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" min="0" step="0.01"
                className="px-3 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" />
              <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="px-3 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }} aria-label={`Select color ${c}`} />
                ))}
              </div>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows={2}
              className="w-full px-3.5 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none" />
            <button type="submit" disabled={!name.trim()}
              className="w-full py-2.5 bg-accent/10 text-accent border border-accent/30 rounded-lg text-sm font-medium hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-shine">
              Add to Wishlist
            </button>
          </form>
        </div>
      )}

      {/* Wishlist Items */}
      {wishlist.length > 0 ? (
        <div className="space-y-3">
          {wishlist.map(item => (
            <div key={item.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-border-light card-lift">
              <div className="w-14 h-14 rounded-lg flex-shrink-0 border border-border" style={{ backgroundColor: item.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-text truncate">{item.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${priorityColors[item.priority]}`}>{item.priority}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span>{CATEGORY_LABELS[item.category]}</span>
                  {item.brand && <span>· {item.brand}</span>}
                  {item.price && <span>· ${item.price.toFixed(2)}</span>}
                </div>
                {item.notes && <p className="text-xs text-text-secondary mt-1">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => { moveWishlistToCloset(item.id); showToast(`Moved "${item.name}" to closet`, 'success'); }}
                  className="px-3 py-1.5 bg-sage/10 text-sage border border-sage/30 rounded-lg text-xs font-medium hover:bg-sage/20 flex items-center gap-1 transition-all">
                  <ShoppingBag size={12} /> Got it
                </button>
                <button onClick={() => { deleteWishlistItem(item.id); showToast('Removed from wishlist', 'info'); }}
                  className="w-8 h-8 rounded-full text-text-muted hover:text-error flex items-center justify-center transition-colors" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <EmptyWishlistArt className="w-40 h-40 mx-auto mb-4 opacity-60" />
          <h2 className="text-lg font-medium text-text">Your wishlist is empty</h2>
          <p className="text-sm text-text-muted mt-1">Save items you want to buy later.</p>
        </div>
      )}

      {/* Total value */}
      {wishlist.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Wishlist Value</p>
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">${wishlist.reduce((sum, i) => sum + (i.price || 0), 0).toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Items</p>
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{wishlist.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
