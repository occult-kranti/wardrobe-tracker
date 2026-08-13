import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useWardrobe } from '../context/WardrobeContext';
import {
  PRESET_COLORS,
  SEASON_LABELS,
  SOURCE_LABELS,
  categoryLabel,
  displayTag,
  type CategoryId,
  type ClothingItem,
  type ItemSource,
  type Season,
} from '../types';
import { Button, Chip, Field, Modal, inputClass, selectClass } from './ui';
import { Basting, GarmentPlate } from './art';
import { IconCamera, IconCheck, IconClose, IconPlus } from './icons';
import { showToast } from './Toast';
import { CutoutBench } from './Cutout';

/**
 * ADD A PIECE — the intake form.
 *
 * Contract notes (docs/06-focus-group-requirements.md §1 rows 2–3, §3):
 *  - The photo is OPTIONAL and has to look like a choice, not a gap. With no file
 *    chosen the form shows the drawn flat that will stand in for the piece
 *    everywhere else, labelled as the stand-in. We never mint a remote
 *    placeholder URL: the app is offline-first and a placehold.co link would break
 *    that the first time the network went away.
 *  - `source` renders every origin at the same weight. Secondhand, swapped and
 *    self-made are not lesser entries, and the euphemism the panel struck from the
 *    vocabulary stays out of these labels — the plain words are the proud ones.
 *  - `fitsLike` is one free line. No size schema, no measurements — a measurement
 *    taxonomy invites body-surveillance and erases people.
 *  - Name is the only required field; everything else can arrive later.
 */

const SEASON_ORDER: Season[] = ['spring', 'summer', 'fall', 'winter'];
const SOURCE_ORDER: ItemSource[] = [
  'new', 'secondhand', 'swapped', 'gifted', 'inherited', 'self-made',
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the form opens PREFILLED and saves through updateItem: the
      record is amended, not re-entered. The add form has promised "everything
      except the name can be filled in later" since it shipped — this is the
      later. */
  editItem?: ClothingItem;
}

export default function AddItemModal({ open, onClose, editItem }: Props) {
  const { addItem, updateItem, addOccasion, settings } = useWardrobe();
  const amending = Boolean(editItem);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryId>(
    () => settings.categories[0]?.id ?? ''
  );
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [brand, setBrand] = useState('');
  const [source, setSource] = useState<ItemSource | ''>('');
  const [fitsLike, setFitsLike] = useState('');
  const [season, setSeason] = useState<Season[]>([...SEASON_ORDER]);
  const [occasion, setOccasion] = useState<string[]>(
    () => (settings.occasions.includes('casual') ? ['casual'] : [])
  );
  const [newTag, setNewTag] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cutting, setCutting] = useState(false);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill on open. Keyed on open+id so reopening the same piece rereads it,
  // and switching pieces never leaks state across records.
  useEffect(() => {
    if (!open || !editItem) return;
    setName(editItem.name);
    setCategory(editItem.category);
    setColor(editItem.color);
    setBrand(editItem.brand ?? '');
    setSource(editItem.source ?? '');
    setFitsLike(editItem.fitsLike ?? '');
    setSeason([...editItem.season]);
    setOccasion([...editItem.occasion]);
    setImageUrl(editItem.imageUrl ?? '');
    setCost(editItem.cost !== undefined ? String(editItem.cost) : '');
    setNotes(editItem.notes ?? '');
  }, [open, editItem]);

  /* ---------- photo ---------- */

  const readPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('That file is not an image. A JPG or PNG works.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setImageUrl((e.target?.result as string) ?? '');
      setCutting(false);
    };
    reader.onerror = () => showToast('That photo would not open. Try another.', 'error');
    reader.readAsDataURL(file);
  };

  /* ---------- tags ---------- */

  const toggleSeason = (s: Season) =>
    setSeason(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));

  const toggleOccasion = (tag: string) =>
    setOccasion(prev => (prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]));

  // addOccasion normalises to trimmed lowercase; mirror that so the chip we
  // select is the same string the vocabulary just gained.
  const commitTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag) return;
    addOccasion(tag);
    setOccasion(prev => (prev.includes(tag) ? prev : [...prev, tag]));
    setNewTag('');
  };

  /* ---------- submit ---------- */

  const reset = () => {
    setName('');
    setBrand('');
    setSource('');
    setFitsLike('');
    setImageUrl('');
    setCost('');
    setNotes('');
    setSeason([...SEASON_ORDER]);
    setOccasion(settings.occasions.includes('casual') ? ['casual'] : []);
    setNewTag('');
    setColor(PRESET_COLORS[0]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedCost = cost.trim() === '' ? undefined : Number.parseFloat(cost);

    const record = {
      name: trimmed,
      category,
      color,
      brand: brand.trim() || undefined,
      source: source || undefined,
      fitsLike: fitsLike.trim() || undefined,
      season,
      occasion,
      // Empty means "no photo", and the drawn flat takes over. Never a remote URL.
      imageUrl: imageUrl || '',
      cost: parsedCost !== undefined && Number.isFinite(parsedCost) ? parsedCost : undefined,
      notes: notes.trim() || undefined,
    };

    if (editItem) {
      // The wear history, pin and bench state belong to the piece, not the form.
      updateItem(editItem.id, record);
      showToast('Amended.', 'success');
    } else {
      addItem({ ...record, favorite: false });
      // Graceful on the way out. Never a lecture.
      showToast('Added. It starts at 0 wears.', 'success');
    }
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={amending ? 'Amend the record' : 'Add a piece'} wide>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ---------- photo, optional on purpose ---------- */}
        <Field
          label="Photo"
          htmlFor="add-item-photo"
          hint="Optional. Plenty of pieces never get one."
        >
          <div
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) readPhoto(file);
            }}
            className={`rounded-[2px] p-3 transition-colors duration-150 ${
              dragOver ? 'bg-sunken plate-ink' : 'bg-sunken plate'
            }`}
          >
            {imageUrl ? (
              <div className="flex items-start gap-4">
                <div className="w-[104px] aspect-[4/5] bg-mat rounded-[2px] overflow-hidden shrink-0">
                  <img
                    src={imageUrl}
                    alt="The photo you chose for this piece"
                   
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-ledger text-[11px] text-text-2">Photo attached</p>
                  <p className="text-[13px] text-text-2 mt-1 leading-snug">
                    It is stored on this device with the rest of the closet.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {/* The category's headline feature, done on the device.
                        Offered rather than performed: an automatic cut that
                        eats a sleeve and cannot be refused is worse than no
                        cut at all. */}
                    <Button
                      type="button"
                      compact
                      onClick={() => setCutting(c => !c)}
                    >
                      {cutting ? 'Close the bench' : 'Lift off the background'}
                    </Button>
                    <Button
                      type="button"
                      compact
                      icon={<IconCamera size={16} />}
                      onClick={() => fileRef.current?.click()}
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      compact
                      tone="tertiary"
                      icon={<IconClose size={14} />}
                      onClick={() => {
                        setImageUrl('');
                        setCutting(false);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                    >
                      Remove photo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                {/* The stand-in, live: exactly what the closet will show. */}
                <div className="w-[104px] aspect-[4/5] bg-mat rounded-[2px] overflow-hidden shrink-0">
                  <GarmentPlate categoryId={category} color={color} name={name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-ledger text-[11px] text-text-2">Drawn stand-in</p>
                  <p className="text-[13px] text-text-2 mt-1 leading-snug">
                    Without a photo the closet shows this flat, drawn in the colour and
                    kind of piece you pick. That is a finished state, not a gap.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <Button
                      type="button"
                      compact
                      icon={<IconCamera size={16} />}
                      onClick={() => fileRef.current?.click()}
                    >
                      Choose a photo
                    </Button>
                    <span className="type-ledger text-[11px] text-text-2">
                      or drop one here
                    </span>
                  </div>
                </div>
              </div>
            )}
            {imageUrl && cutting ? (
              <CutoutBench
                source={imageUrl}
                onUse={url => { setImageUrl(url); setCutting(false); }}
                onClose={() => setCutting(false)}
              />
            ) : null}
            <input
              ref={fileRef}
              id="add-item-photo"
              type="file"
              accept="image/*"
              className="sr-only" tabIndex={-1}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) readPhoto(file);
              }}
            />
          </div>
        </Field>

        <Basting />

        {/* ---------- what it is ---------- */}
        <Field label="Name" htmlFor="add-item-name" hint="The only thing this form needs.">
          <input
            id="add-item-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Navy wool blazer"
            autoComplete="off"
            required
            className={inputClass}
          />
        </Field>

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">Kind of piece</legend>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {settings.categories.map(cat => (
              <Chip
                key={cat.id}
                selected={category === cat.id}
                onClick={() => setCategory(cat.id)}
              >
                {categoryLabel(settings, cat.id)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">Colour</legend>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {PRESET_COLORS.map(hex => {
              const selected = color.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  aria-pressed={selected}
                  aria-label={`Colour ${hex}`}
                  title={hex}
                  className={`w-11 h-11 rounded-[2px] inline-flex items-center justify-center transition-[box-shadow] duration-150 ${
                    selected ? 'plate-ink' : 'border border-border hover:border-text'
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {selected ? (
                    <span className="w-5 h-5 bg-surface text-text inline-flex items-center justify-center rounded-[2px]">
                      <IconCheck size={12} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Basting />

        {/* ---------- how it came to you ---------- */}
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Brand" htmlFor="add-item-brand">
            <input
              id="add-item-brand"
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="Brand, or made by you"
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="How it came to you" htmlFor="add-item-source">
            <select
              id="add-item-source"
              value={source}
              onChange={e => setSource(e.target.value as ItemSource | '')}
              className={selectClass}
            >
              <option value="">Not saying</option>
              {SOURCE_ORDER.map(key => (
                <option key={key} value={key}>
                  {SOURCE_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* One line, in your own words. Deliberately not a size schema. */}
        <Field
          label="Fits like"
          htmlFor="add-item-fits"
          hint="One line, however you'd describe it to a friend. No sizes, no measurements."
        >
          <input
            id="add-item-fits"
            type="text"
            value={fitsLike}
            onChange={e => setFitsLike(e.target.value)}
            placeholder="fits like a slim medium, hits at hip"
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Basting />

        {/* ---------- when and what for ---------- */}
        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">Seasons</legend>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {SEASON_ORDER.map(s => (
              <Chip key={s} selected={season.includes(s)} onClick={() => toggleSeason(s)}>
                {SEASON_LABELS[s]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">Occasions</legend>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {settings.occasions.map(tag => (
              <Chip
                key={tag}
                selected={occasion.includes(tag)}
                onClick={() => toggleOccasion(tag)}
              >
                {displayTag(tag)}
              </Chip>
            ))}
          </div>
          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1 min-w-0">
              <label htmlFor="add-item-new-tag" className="sr-only">
                Add an occasion tag
              </label>
              <input
                id="add-item-new-tag"
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  // Enter here adds a tag; it must never submit the whole form.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTag();
                  }
                }}
                placeholder="add a tag"
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <Button
              type="button"
              compact
              icon={<IconPlus size={14} />}
              onClick={commitTag}
              disabled={newTag.trim() === ''}
            >
              Add
            </Button>
          </div>
        </fieldset>

        <Basting />

        {/* ---------- the ledger side ---------- */}
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Cost" htmlFor="add-item-cost" hint="Optional. It feeds cost per wear.">
            <input
              id="add-item-cost"
              type="number"
              inputMode="decimal"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`${inputClass} tabular`}
            />
          </Field>

          <Field label="Notes" htmlFor="add-item-notes">
            <textarea
              id="add-item-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Mended at the cuff, second-hand from the market"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>

        <div className="pt-1">
          <Button type="submit" tone="primary" className="w-full">
            {amending ? 'Amend the record' : 'Add to the closet'}
          </Button>
          <p className="text-[13px] text-text-2 mt-3 text-center leading-snug">
            {amending
              ? 'The wear history stays exactly as it is.'
              : 'Everything except the name can be filled in later, or never.'}
          </p>
        </div>
      </form>
    </Modal>
  );
}
