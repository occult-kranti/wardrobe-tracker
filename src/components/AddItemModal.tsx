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
} from '@almari/shared/types';
import { Button, Chip, Field, Modal, inputClass, selectClass } from './ui';
import { confirmWrite } from '../hooks/useLocalStorage';
import { photoSrc, storePhoto } from '../lib/photoStore';
import { prepareImage, readPhotograph } from '../lib/anthropic';
import { readIntake } from '@almari/shared/intake';
import { INTAKE_PROMPT } from '../lib/intakePrompt';
import { Basting, GarmentPlate } from './art';
import { IconCamera, IconCheck, IconClose, IconPlus, IconUp, IconDown } from './icons';
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

/**
 * THE LONG EDGE A STORED PHOTOGRAPH IS KEPT AT.
 *
 * A phone hands over 4032x3024 and five megabytes of it, and that used to go
 * into the record verbatim: one photographed piece measured 7.5M characters as
 * a data URL against a device holding about 4.9M for the entire closet, so the
 * first add filled the wardrobe and every write after it was refused. Every
 * other image path in the house already shrank — the frame sent to be read
 * caps at 1400, an intake crop at 520, a cut-out at 512 — and this, the
 * ordinary way a piece is added, was the only one that did not.
 *
 * 640 is chosen for what the stored picture is FOR: a tile in the closet grid
 * and the picture on a detail sheet, on a phone. It is not a print. At this
 * edge a photographed piece costs on the order of a hundred kilobytes rather
 * than seven megabytes, which is the difference between a sixty-piece walk
 * fitting on the device and not fitting at all.
 *
 * The photograph as it arrived is still held in memory for the one journey out
 * to the model, which wants every pixel it can get. It is only the RECORD that
 * is a tile.
 */
const STORE_EDGE = 640;
const STORE_QUALITY = 0.85;

/**
 * A picture already small enough to keep exactly as it came.
 *
 * The re-encode is a JPEG, which has no alpha, so a small PNG — a cut-out, a
 * flat lay sold on a transparent ground — is left alone rather than having its
 * transparency filled in with black. Anything above this is re-encoded whatever
 * it is: the point of the cap is that no single piece can cost the closet.
 */
const KEEP_AS_IS = 300_000;

/** Draw a chosen photograph down to the size the record keeps. Never grows one. */
function toStoredSize(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('That photo would not open.'));
    img.onload = () => {
      const scale = Math.min(1, STORE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale === 1 && src.length <= KEEP_AS_IS) return resolve(src);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('This browser will not open a drawing surface.'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', STORE_QUALITY));
    };
    img.src = src;
  });
}

/**
 * Said when the device refused the write and nothing else has said so.
 *
 * It names the remedy, because "full" on its own is news a person cannot act
 * on, and the backup is the part that has to happen first.
 */
const sayRefused = () =>
  showToast(
    'Not written — this device has no room left. Export a backup from Settings, then keep fewer photographs.',
    'error',
  );

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
  /** The eleven optional fields, folded away until asked for. */
  const [more, setMore] = useState(false);
  /** Reading the attached photograph into the form. */
  const [reading, setReading] = useState(false);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);

  /**
   * Let the photograph fill the form.
   *
   * The same one journey out as the intake bench, and the same rule: what
   * comes back is words, and it lands in the fields as a DRAFT — every value
   * is still sitting in an input the person can change before anything is
   * written. Nothing is saved by this button.
   */
  const readThisPhoto = async () => {
    setReadFailed(null);
    setReadNote(null);
    if (!photo) return;
    try {
      setReading(true);
      // Read from the photograph as it arrived where we still have it: the
      // stored tile is sized for a closet grid, and the model wants the print.
      const image = await prepareImage(fullPhoto.current || photo);
      const { text } = await readPhotograph(image, INTAKE_PROMPT);
      const read = readIntake(text);
      if (read.error || read.drafts.length === 0) {
        setReadFailed(read.error ?? 'Nothing wearable was found in that photograph.');
        return;
      }
      // One photograph of one piece should give one row; if it found several,
      // take the most confident and say so rather than picking silently.
      const best = [...read.drafts].sort((a, b) => b.confidence - a.confidence)[0];
      if (read.drafts.length > 1) {
        setReadNote(`Found ${read.drafts.length} pieces — filled in the clearest one, "${best.name}". The bench handles a whole layout at once.`);
      }
      setName(best.name);
      setCategory(best.category);
      setColor(best.color);
      if (best.brand) setBrand(best.brand);
      if (best.season.length) setSeason(best.season);
      if (best.occasion.length) setOccasion(best.occasion);
      if (best.description) setNotes(best.description);
      // Anything it guessed weakly is worth a human eye, so open the drawer.
      if (best.uncertain.length > 0 || best.brand) setMore(true);
    } catch (e) {
      setReadFailed(e instanceof Error ? e.message : 'That did not work. Nothing was changed.');
    } finally {
      setReading(false);
    }
  };
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * The photograph exactly as it arrived — held for the one journey out to the
   * model, and never written down. `imageUrl` is the tile that goes in the
   * record; this is the print it was drawn from, and it lives as long as the
   * form is open and not a moment longer.
   */
  const fullPhoto = useRef('');

  /**
   * THE PICTURE AS THIS DEVICE CAN DRAW IT.
   *
   * `imageUrl` holds whatever the record held — a data URL when the file was
   * just chosen, and a reference into the photograph store when this form was
   * opened to AMEND a piece that was filed by reference. Everything that needs
   * PIXELS rather than a string — the preview, the cut-out bench, the journey
   * out to the model — takes this. The record still gets `imageUrl`, so
   * amending a piece without touching its photograph re-files nothing.
   */
  const photo = photoSrc(imageUrl);

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
    // What is on the record IS the tile; there is no print behind it.
    fullPhoto.current = '';
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
    reader.onload = async e => {
      const arrived = (e.target?.result as string) ?? '';
      if (!arrived) {
        showToast('That photo would not open. Try another.', 'error');
        return;
      }
      try {
        const stored = await toStoredSize(arrived);
        // The record gets the tile; the model, if it is ever asked, gets the
        // photograph as it came. Only the first of the two is written down.
        fullPhoto.current = arrived;
        setImageUrl(stored);
        setCutting(false);
      } catch {
        showToast('That photo would not open. Try another.', 'error');
      }
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
    fullPhoto.current = '';
    setCost('');
    setNotes('');
    setSeason([...SEASON_ORDER]);
    setOccasion(settings.occasions.includes('casual') ? ['casual'] : []);
    setNewTag('');
    setColor(PRESET_COLORS[0]);
  };

  /**
   * One submission at a time.
   *
   * This handler used to be synchronous end to end, so there was no moment
   * between the press and the record in which a second press could land.
   * Filing the photograph opens one — small, but real on a slow device — and a
   * second press inside it would add the same piece twice. A ref rather than
   * state: this guards a write, and it must not cost a render to do it.
   */
  const saving = useRef(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (saving.current) return;
    saving.current = true;
    try {
      await writeRecord(trimmed);
    } finally {
      saving.current = false;
    }
  };

  const writeRecord = async (trimmed: string) => {
    const parsedCost = cost.trim() === '' ? undefined : Number.parseFloat(cost);

    /*
     * WHERE THE PHOTOGRAPH GOES, decided here and nowhere earlier.
     *
     * The tile has been sitting in `imageUrl` since the file was chosen, and it
     * has to: everything above this line draws it — the preview, the cut-out
     * bench, the "read this photograph" button. It is only on the way to the
     * RECORD that it becomes a question of storage, so that is where it is
     * asked.
     *
     * storePhoto files the picture in IndexedDB and returns `idb:<id>`, or —
     * when references are switched off, when the browser refuses the database,
     * or when the write is refused — hands the data URL straight back and the
     * record keeps it inline exactly as it always has. A photograph that
     * cannot be filed is never a reason for a piece not to be added.
     */
    const filed = await storePhoto(imageUrl || '');

    const record = {
      name: trimmed,
      category,
      color,
      brand: brand.trim() || undefined,
      source: source || undefined,
      fitsLike: fitsLike.trim() || undefined,
      season,
      occasion,
      // Empty means "no photo", and the drawn flat takes over. Never a remote
      // URL — a data URL as it always was, or a reference into this device's
      // own photograph store, and never anything that leaves the machine.
      imageUrl: filed,
      cost: parsedCost !== undefined && Number.isFinite(parsedCost) ? parsedCost : undefined,
      notes: notes.trim() || undefined,
    };

    /*
     * The news waits for the device.
     *
     * The store coalesces its write, so the confirmation used to be printed
     * before the disk had ever been asked: "Added. It starts at 0 wears."
     * stood directly above "This device would not take the write — its storage
     * is full", with the piece rendering happily from memory and a refresh
     * about to throw it away. A ledger that says a thing is on the record when
     * it is not has spent the only thing it has. So the confirmation is held
     * for the length of one settle window, and if the write was refused the
     * truthful line is the only one said.
     */
    if (editItem) {
      // The wear history, pin and bench state belong to the piece, not the form.
      updateItem(editItem.id, record);
      confirmWrite(() => showToast('Amended.', 'success'), sayRefused);
    } else {
      addItem({ ...record, favorite: false });
      // Graceful on the way out. Never a lecture.
      confirmWrite(() => showToast('Added. It starts at 0 wears.', 'success'), sayRefused);
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
            {photo ? (
              <div className="flex items-start gap-4">
                <div className="w-[104px] aspect-[4/5] bg-mat rounded-[2px] overflow-hidden shrink-0">
                  <img
                    src={photo}
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
                        fullPhoto.current = '';
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
                    kind of piece you pick.
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
            {/* Let the photograph do the typing. One journey out, through the
                relay or the endpoint set in Settings; what comes back lands in
                the fields as a draft you can still change. Nothing is saved by
                this. */}
            {photo ? (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    compact
                    tone="primary"
                    disabled={reading}
                    onClick={() => { void readThisPhoto(); }}
                  >
                    {reading ? 'Reading the photograph…' : 'Fill this in from the photo'}
                  </Button>
                  {/* The other half of the same photograph, and the one that
                      needs no key at all. Sitting beside the AI button because
                      they are the two things you can do with a photo here, and
                      because trying the cut is how you find out whether it
                      works on YOUR bedspread. */}
                  <Button
                    type="button"
                    compact
                    onClick={() => setCutting(c => !c)}
                  >
                    {cutting ? 'Close the bench' : 'Try lifting the background'}
                  </Button>
                  <span className="type-ledger text-[10px] text-text-2">
                    Reading the photo is the one step here that uses the network. It makes a
                    single trip to Claude Fable by Anthropic and comes back as words. No key is
                    kept on this device, nothing else leaves it, and Settings can point this at
                    a service of your own.
                  </span>
                </div>

                {readNote ? <p className="text-[13px] text-text-2 mt-2 leading-snug">{readNote}</p> : null}
                {readFailed ? <p className="text-[13px] text-danger mt-2 leading-snug">{readFailed}</p> : null}
              </div>
            ) : null}

            {photo && cutting ? (
              <CutoutBench
                source={photo}
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

        {/* ---------- everything else, folded away ----------
             A name, a kind and a colour are what a piece needs to exist.
             The other eleven fields are all optional and were all on screen
             at once, which made a two-second task look like a form. They are
             still one tap away, and the tap says how many are behind it. */}
        <Basting />
        <button
          type="button"
          onClick={() => setMore(v => !v)}
          aria-expanded={more}
          className="w-full flex items-center justify-between gap-3 min-h-11 text-left"
        >
          <span className="type-ledger text-[11px] text-text-2">
            {more ? 'Fewer details' : 'More details — cost, brand, season, notes'}
          </span>
          {more ? <IconUp size={16} className="text-text-2" /> : <IconDown size={16} className="text-text-2" />}
        </button>

        {!more ? null : (
        <>
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
          <Field label="Cost" htmlFor="add-item-cost" hint="Optional, and the one thing cost per wear needs.">
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
        </>
        )}

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
