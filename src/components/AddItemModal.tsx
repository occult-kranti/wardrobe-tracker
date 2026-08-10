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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg-elevated rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text font-[family-name:var(--font-heading)]">Add to Collection</h2>
            <p className="text-xs text-text-muted mt-0.5">Document your wardrobe</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Image upload */}
          <div
            className={`border border-dashed rounded-xl p-6 text-center transition-all ${
              dragOver ? 'border-accent bg-accent/5' : 'border-border-light bg-bg-card'
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
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-text flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="space-y-3 w-full">
                <div className="w-14 h-14 rounded-full bg-bg-elevated border border-border-light mx-auto flex items-center justify-center">
                  <Camera size={22} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary font-medium">Drop an image or click to browse</p>
                  <p className="text-xs text-text-muted mt-1">JPG, PNG — up to 5MB</p>
                </div>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Item Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Midnight Velvet Blazer"
              className="w-full px-3.5 py-2.5 bg-bg-card border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
                <button
                  key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    category === cat
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'bg-bg-card border-border text-text-secondary hover:border-border-light hover:text-text'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Color</label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-accent scale-110 shadow-lg shadow-accent/20' : 'border-border hover:border-border-light'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Season */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Seasons</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SEASON_LABELS) as Season[]).map(s => (
                <button
                  key={s} type="button" onClick={() => toggleSeason(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    season.includes(s)
                      ? 'bg-sage/10 border-sage/30 text-sage'
                      : 'bg-bg-card border-border text-text-muted hover:border-border-light'
                  }`}
                >
                  {SEASON_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Occasion */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Occasions</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OCCASION_LABELS) as Occasion[]).map(o => (
                <button
                  key={o} type="button" onClick={() => toggleOccasion(o)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    occasion.includes(o)
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-bg-card border-border text-text-muted hover:border-border-light'
                  }`}
                >
                  {OCCASION_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Cost <span className="normal-case text-text-muted/60">(optional)</span></label>
            <input
              type="number" value={cost} onChange={e => setCost(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              className="w-full px-3.5 py-2.5 bg-bg-card border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Notes <span className="normal-case text-text-muted/60">(optional)</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Fabric details, care instructions, where you bought it..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-bg-card border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-accent/10 text-accent border border-accent/30 rounded-lg text-sm font-semibold hover:bg-accent/20 active:scale-[0.98] transition-all btn-shine"
          >
            Add to Collection
          </button>
        </form>
      </div>
    </div>
  );
}
