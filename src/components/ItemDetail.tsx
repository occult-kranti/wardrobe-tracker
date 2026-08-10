import { useState } from 'react';
import { X, Heart, Trash2, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, SEASON_LABELS, OCCASION_LABELS } from '../types';
import { showToast } from './Toast';

interface Props {
  itemId: string;
  onClose: () => void;
}

export default function ItemDetail({ itemId, onClose }: Props) {
  const { getItem, toggleFavoriteItem, deleteItem, wearLogs } = useWardrobe();
  const item = getItem(itemId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) return null;

  const itemWears = wearLogs.filter(l => l.itemIds.includes(itemId));
  const costPerWear = item.cost && item.wearCount > 0 ? item.cost / item.wearCount : 0;
  const lastWornDate = item.lastWorn ? new Date(item.lastWorn) : null;
  const daysSinceWorn = lastWornDate ? Math.floor((Date.now() - lastWornDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const wearHistory = itemWears.slice(-10).reverse();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg-elevated border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header Image */}
        <div className="relative aspect-[3/4] max-h-[320px]">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-t-xl" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-text flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-colors">
            <X size={16} />
          </button>
          <button onClick={() => { toggleFavoriteItem(item.id); showToast(item.favorite ? 'Removed from favorites' : 'Added to favorites', 'success'); }}
            className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${item.favorite ? 'bg-rose/90 text-white' : 'bg-black/50 text-text hover:bg-black/70'}`}>
            <Heart size={14} className={item.favorite ? 'fill-current' : ''} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name & Category */}
          <div>
            <h2 className="text-xl font-semibold text-text font-[family-name:var(--font-heading)]">{item.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-text-muted uppercase tracking-wider bg-bg-card border border-border px-2.5 py-1 rounded">{CATEGORY_LABELS[item.category]}</span>
              <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: item.color }} title={item.color} />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
              <TrendingUp size={16} className="text-accent mx-auto mb-1" />
              <p className="text-lg font-semibold text-text font-[family-name:var(--font-heading)]">{item.wearCount}</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Wears</p>
            </div>
            {daysSinceWorn !== null && (
              <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
                <Calendar size={16} className="text-amber mx-auto mb-1" />
                <p className="text-lg font-semibold text-text font-[family-name:var(--font-heading)]">{daysSinceWorn}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Days Ago</p>
              </div>
            )}
            {costPerWear > 0 && (
              <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
                <DollarSign size={16} className="text-sage mx-auto mb-1" />
                <p className="text-lg font-semibold text-text font-[family-name:var(--font-heading)]">${costPerWear.toFixed(2)}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Per Wear</p>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">Seasons</p>
              <div className="flex flex-wrap gap-1.5">
                {item.season.map(s => <span key={s} className="text-xs bg-sage/10 text-sage border border-sage/30 px-2.5 py-1 rounded-full">{SEASON_LABELS[s]}</span>)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">Occasions</p>
              <div className="flex flex-wrap gap-1.5">
                {item.occasion.map(o => <span key={o} className="text-xs bg-accent/10 text-accent border border-accent/30 px-2.5 py-1 rounded-full">{OCCASION_LABELS[o]}</span>)}
              </div>
            </div>
          </div>

          {/* Wear History */}
          {wearHistory.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">Recent Wears</p>
              <div className="space-y-1.5">
                {wearHistory.map(log => (
                  <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm text-text">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    {log.outfitId && <span className="text-xs text-text-muted">via outfit</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">Notes</p>
              <p className="text-sm text-text-secondary bg-bg-card border border-border rounded-lg p-3">{item.notes}</p>
            </div>
          )}

          {/* Delete */}
          <div className="pt-2">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 border border-error/30 text-error rounded-lg text-sm font-medium hover:bg-error/10 transition-all flex items-center justify-center gap-2">
                <Trash2 size={14} /> Delete Item
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-error text-center">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => { deleteItem(item.id); onClose(); showToast('Item deleted', 'info'); }}
                    className="flex-1 py-2.5 bg-error text-white rounded-lg text-sm font-medium hover:bg-error/80 transition-all">Yes, Delete</button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 bg-bg-card border border-border text-text-secondary rounded-lg text-sm font-medium hover:border-border-light transition-all">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
