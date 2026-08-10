import { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { CATEGORY_LABELS, SEASON_LABELS, OCCASION_LABELS, PRESET_COLORS, type Category, type Season, type Occasion } from '../types';
import { showToast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddItemModal({ open, onClose }: Props) {
  const { addItem } = useWardrobe();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tops');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [season, setSeason] = useState<Season[]>(['spring', 'summer', 'fall', 'winter']);
  const [occasion, setOccasion] = useState<Occasion[]>(['casual']);
  const [imageUrl, setImageUrl] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addItem({
      name: name.trim(),
      category,
      color,
      season,
      occasion,
      imageUrl: imageUrl || `https://placehold.co/300x400/${color.replace('#', '')}/ffffff?text=${encodeURIComponent(name)}`,
      cost: cost ? parseFloat(cost) : undefined,
      favorite: false,
      notes: notes.trim() || undefined,
    });
    showToast(`"${name.trim()}" added to your closet`, 'success');
    setName('');
    setImageUrl('');
    setCost('');
    setNotes('');
    setSeason(['spring', 'summer', 'fall', 'winter']);
    setOccasion(['casual']);
    onClose();
  };

  const toggleSeason = (s: Season) => {
    setSeason(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const toggleOccasion = (o: Occasion) => {
    setOccasion(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-cream rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text font-[family-name:var(--font-heading)]">Add Clothing Item</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Image upload */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragOver ? 'border-accent bg-accent/5' : 'border-border bg-surface'
            } ${imageUrl ? 'p-2' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleImageUpload(file);
            }}
          >
            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="Preview" className="w-full h-48 object-contain rounded-lg" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-surface-hover mx-auto flex items-center justify-center">
                  <Camera size={20} className="text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary">Click or drag to upload photo</p>
                <p className="text-xs text-text-muted">JPG, PNG up to 5MB</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Item Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Navy Blazer"
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    category === cat
                      ? 'bg-accent text-white'
                      : 'bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-text scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Season */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Seasons</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SEASON_LABELS) as Season[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSeason(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    season.includes(s)
                      ? 'bg-success/15 text-success'
                      : 'bg-surface text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  {SEASON_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Occasion */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Occasions</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OCCASION_LABELS) as Occasion[]).map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleOccasion(o)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    occasion.includes(o)
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  {OCCASION_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Cost (optional)</label>
            <input
              type="number"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any details about this item..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all"
          >
            Add to Closet
          </button>
        </form>
      </div>
    </div>
  );
}
