import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, Chip, EmptyState, Field, LinkButton, Masthead, Modal, SectionTitle, inputClass } from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyCloset } from '../components/art';
import { IconCamera, IconChevronLeft, IconPlus } from '../components/icons';
import { showToast } from '../components/Toast';
import {
  drawFurniture, defaultSlotLabels, FORM_LABELS, FORM_NOTES, SLOT_NOUN, maxSlotsFor,
  ORNAMENT_LABELS, ORNAMENT_NOTES,
} from '../lib/furnitureArt';
import { FURNITURE_PROMPT, readFurniture, type FurnitureRead } from '../lib/furniturePrompt';
import { hasKey, keyLooksWrong, prepareImage, readPhotograph, saveKey } from '../lib/anthropic';
import {
  FURNITURE_FORMS, MAX_FURNITURE, MAX_FURNITURE_NAME, MAX_SLOT_LABEL, ORNAMENTS,
  type ClothingItem, type Furniture as FurniturePiece, type FurnitureForm, type Ornament,
} from '../types';

/**
 * FURNITURE — where a garment physically lives.
 *
 * The design decision this page exists to serve: **the drawing is the control.**
 * You do not read a place off a list; you point at the drawer. "Third drawer
 * down on the left" is a recall task performed against a text field, and
 * tapping the third drawer down is a recognition task performed against a
 * picture of your own furniture.
 *
 * Three things this page will never do, each vetoed by all three review panels:
 *   · no capacity, size or fullness percentage — a drawer that knows when it is
 *     full is inventory software. Fullness is DRAWN, from the count.
 *   · no completeness meter. "47 pieces not filed" is a bank balance and is
 *     allowed; "39% filed" is progress-as-achievement and is not.
 *   · nothing behind the photographs. The garments in an open drawer render as
 *     ordinary flat tiles below the drawing, never inside it.
 */

/** The drawing, and its tappable slots. */
function FurniturePlate({
  piece,
  counts,
  openSlot,
  onSlot,
  max = 326,
  labels = true,
}: {
  piece: FurniturePiece;
  counts: Record<string, number>;
  openSlot?: string | null;
  onSlot?: (slotId: string) => void;
  /** Rendered width cap, px. The index draws small; the detail page draws big. */
  max?: number;
  labels?: boolean;
}) {
  const drawing = useMemo(
    () => drawFurniture(piece, counts, 0.709, { labels }),
    [piece, counts, labels],
  );
  return (
    <div className="relative w-full mx-auto text-text" style={{ maxWidth: max }}>
      <svg
        viewBox={drawing.viewBox}
        className="w-full h-auto block"
        aria-label={`${piece.name}, ${piece.slots.length} ${SLOT_NOUN[piece.form][piece.slots.length === 1 ? 0 : 1]}`}
        // The line art is drawn as one memoised string; React never diffs it.
        dangerouslySetInnerHTML={{ __html: drawing.svg }}
      />
      {onSlot ? (
        <svg viewBox={drawing.viewBox} className="absolute inset-0 w-full h-full">
          {drawing.slots.map(s => (
            <rect
              key={s.id}
              x={s.x} y={s.y} width={s.w} height={s.h}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSlot(s.id)}
            >
              <title>{piece.slots.find(x => x.id === s.id)?.label}</title>
            </rect>
          ))}
          {/* The pattern notch marks the open slot — the contract's own named
              use for it. No fill, no tint, no glow: depth is hairlines. */}
          {openSlot ? (() => {
            const s = drawing.slots.find(x => x.id === openSlot);
            if (!s) return null;
            return (
              <path
                d={`M${s.x + s.w - 14} ${s.y + 12}l2-2`}
                stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="butt"
              />
            );
          })() : null}
        </svg>
      ) : null}
    </div>
  );
}

/** How many pieces sit in each slot of this piece of furniture. */
function useCounts(items: ClothingItem[], furnitureId: string) {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.place?.furnitureId !== furnitureId) continue;
      counts[item.place.slotId] = (counts[item.place.slotId] ?? 0) + 1;
    }
    return counts;
  }, [items, furnitureId]);
}

/* ---------------- drawing a new piece ---------------- */

function DrawPiece({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addFurniture, furniture } = useWardrobe();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [form, setForm] = useState<FurnitureForm>('almirah');
  const [count, setCount] = useState(4);
  const [ornament, setOrnament] = useState<Ornament>('plain');
  const [labels, setLabels] = useState<string[] | null>(null);
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<FurnitureRead | null>(null);
  const [askKey, setAskKey] = useState(false);
  const [key, setKey] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  const ceiling = maxSlotsFor(form);
  const full = furniture.length >= MAX_FURNITURE;

  // The preview redraws as you press +. The flow IS the artistry: you are
  // building the object, not filling in a form about it.
  const preview = useMemo<FurniturePiece>(() => {
    const generated = defaultSlotLabels(form, Math.min(count, ceiling));
    return {
      id: 'preview',
      name: name || 'A place',
      form,
      ornament,
      slots: generated.map((label, i) => ({ id: `p${i}`, label: labels?.[i] ?? label })),
      dateAdded: '',
    };
  }, [name, form, count, ceiling, labels, ornament]);

  const pick = (next: FurnitureForm) => {
    setForm(next);
    // Each form has its own ceiling, so the number has to come with it.
    setCount(c => Math.min(c, maxSlotsFor(next)));
    setLabels(null);
  };

  const draw = () => {
    const id = addFurniture(name, form, Math.min(count, ceiling), ornament);
    if (!id) {
      showToast(`This wardrobe already holds ${MAX_FURNITURE} places, which is as many as the room will draw.`, 'error');
      return;
    }
    onClose();
    setName(''); setForm('almirah'); setCount(4); setLabels(null); setRead(null); setOrnament('plain');
    navigate(`/furniture/${id}`);
  };

  /** Photograph the thing itself, and let the model read its inside. */
  const readPhoto = async (file: File) => {
    setReading(true);
    setRead(null);
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('That photograph would not open.'));
        reader.readAsDataURL(file);
      });
      const prepared = await prepareImage(src);
      const { text } = await readPhotograph(prepared, FURNITURE_PROMPT);
      const answer = readFurniture(text);
      setRead(answer);
      // NOTHING IS WRITTEN HERE. The read moves the controls, the drawing
      // redraws, and the person still has to press Draw it — a model's answer
      // is a suggestion about someone's own bedroom, not a fact about it.
      if (answer.isFurniture) {
        setForm(answer.form);
        setCount(Math.min(answer.slots, maxSlotsFor(answer.form)));
        setLabels(answer.labels.length ? answer.labels : null);
        if (answer.name) setName(answer.name);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setReading(false);
    }
  };

  const noun = SLOT_NOUN[form];
  return (
    <Modal open={open} onClose={onClose} title="Draw a place">
      <div className="space-y-5">
        <div className="bg-mat rounded-[2px] py-4">
          <FurniturePlate piece={preview} counts={{}} />
        </div>

        {/* Reading it off a photograph. Second, quieter, and never the only
            road in — drawing one by hand is four taps and needs no key, no
            network and no account. */}
        <div className="rounded-[2px] bg-sunken plate-ink p-3">
          <p className="type-ledger text-[11px] text-text-2">Or photograph the thing itself</p>
          <p className="text-[13px] text-text-2 mt-1.5 leading-snug">
            Open its doors and take one picture. It reads what kind it is and how the
            inside divides, then moves the controls above — nothing is saved until you
            draw it.
          </p>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void readPhoto(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button
              compact
              disabled={reading}
              icon={<IconCamera size={16} />}
              onClick={() => {
                if (!hasKey()) { setAskKey(true); return; }
                photoRef.current?.click();
              }}
            >
              {reading ? 'Reading' : 'Read a photograph'}
            </Button>
            {hasKey() ? (
              <button
                type="button"
                onClick={() => setAskKey(v => !v)}
                className="type-ledger text-[10px] text-text-2 underline underline-offset-[3px] min-h-11 px-1"
              >
                Change the key
              </button>
            ) : null}
          </div>

          {askKey ? (
            <div className="mt-3 space-y-2">
              <Field label="Your Anthropic key" htmlFor="fp-key">
                <input
                  id="fp-key"
                  className={inputClass}
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                />
              </Field>
              <p className="text-[13px] text-text-2 leading-snug">
                It stays on this device and is sent to Anthropic only, with the one
                photograph. About a third of a cent a read.
              </p>
              <Button
                compact
                tone="primary"
                onClick={() => {
                  if (keyLooksWrong(key)) {
                    showToast('That does not look like an Anthropic key — they begin sk-ant-.', 'error');
                    return;
                  }
                  saveKey(key);
                  setKey('');
                  setAskKey(false);
                  photoRef.current?.click();
                }}
              >
                Keep it
              </Button>
            </div>
          ) : null}

          {read && !read.isFurniture ? (
            <p className="text-[13px] text-text-2 mt-3 leading-snug">
              That does not look like a piece of furniture it can draw.
              {read.note ? ` ${read.note}` : ''} Set it by hand above — it is four taps.
            </p>
          ) : null}
          {read?.isFurniture ? (
            <div className="mt-3 space-y-1">
              <p className="text-[13px] text-text leading-snug">
                Read as {FORM_LABELS[read.form].toLowerCase()} with {read.slots}{' '}
                {read.slots === 1 ? SLOT_NOUN[read.form][0] : SLOT_NOUN[read.form][1]}
                {read.confidence !== 'high' ? `, ${read.confidence} confidence` : ''}. Correct
                anything below, then draw it.
              </p>
              {read.repairs.map(line => (
                <p key={line} className="type-ledger text-[10px] text-text-2 leading-relaxed">{line}</p>
              ))}
              {read.note ? (
                <p className="type-ledger text-[10px] text-text-2 leading-relaxed">{read.note}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <Field label="What to call it" htmlFor="fp-name">
          <input
            id="fp-name"
            className={inputClass}
            value={name}
            maxLength={MAX_FURNITURE_NAME}
            onChange={e => setName(e.target.value)}
            placeholder="Bedroom almirah, the hall rail, the loft"
          />
        </Field>

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">What kind</legend>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {FURNITURE_FORMS.map(f => (
              <Chip key={f} selected={form === f} onClick={() => pick(f)}>
                {FORM_LABELS[f]}
              </Chip>
            ))}
          </div>
          <p className="text-[13px] text-text-2 leading-snug pt-1">{FORM_NOTES[form]}</p>
        </fieldset>

        {/* A CARVED TREATMENT, offered only on the one form with room for one.
            An almirah's doors and its crest are the surfaces a joiner actually
            decorates; every other form here is a working object with no spare
            face. The interior is never touched — a tray with a pattern on it is
            a tray you cannot see into. */}
        {form === 'almirah-fitted' ? (
          <fieldset className="border-0 p-0 m-0 space-y-1.5">
            <legend className="type-ledger text-[11px] text-text-2">How it is finished</legend>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {ORNAMENTS.map(o => (
                <Chip key={o} selected={ornament === o} onClick={() => setOrnament(o)}>
                  {ORNAMENT_LABELS[o]}
                </Chip>
              ))}
            </div>
            <p className="text-[13px] text-text-2 leading-snug pt-1">{ORNAMENT_NOTES[ornament]}</p>
          </fieldset>
        ) : null}

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">
            How many {noun[1]}
          </legend>
          <div className="flex items-center gap-3 pt-0.5">
            <Button compact onClick={() => { setLabels(null); setCount(c => Math.max(1, c - 1)); }} aria-label={`One fewer ${noun[0]}`}>
              &minus;
            </Button>
            <span className="type-masthead text-[22px] tabular w-8 text-center">{Math.min(count, ceiling)}</span>
            <Button
              compact
              disabled={count >= ceiling}
              onClick={() => { setLabels(null); setCount(c => Math.min(ceiling, c + 1)); }}
              aria-label={`One more ${noun[0]}`}
            >
              +
            </Button>
          </div>
          {count >= ceiling ? (
            <p className="type-ledger text-[10px] text-text-2 pt-1">
              {ceiling} is as many as this drawing holds at a size a thumb can hit.
              {' '}A {ceiling + 1}th {noun[0]} is a second place.
            </p>
          ) : null}
        </fieldset>

        {full ? (
          <p className="text-[13px] text-text-2 leading-snug">
            This wardrobe already holds {MAX_FURNITURE} places, which is as many as the
            room will draw. Remove one to draw another — the clothes in it stay either way.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button tone="primary" disabled={full} onClick={draw}>Draw it</Button>
          <Button tone="tertiary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- the index ---------------- */

export default function Furniture() {
  const { furniture, activeItems } = useWardrobe();
  const [drawing, setDrawing] = useState(false);

  const filed = useMemo(() => {
    const known = new Set(furniture.map(f => f.id));
    let unfiled = 0;
    for (const item of activeItems) {
      if (!item.place || !known.has(item.place.furnitureId)) unfiled++;
    }
    return { unfiled };
  }, [furniture, activeItems]);

  if (furniture.length === 0) {
    return (
      <>
        <Masthead
          title="Dressing room"
          action={<LinkButton to="/closet" compact icon={<IconChevronLeft size={16} />}>Closet</LinkButton>}
        />
        <Card>
          <EmptyState
            plate={<PlateEmptyCloset />}
            title="Nothing has an address yet."
            body="A rail is a place. So is a chest of six drawers, or the shelf by the door. Draw one, and pieces can be filed to it — nothing here is required, and every piece stays exactly where it is until you say otherwise."
            action={
              <Button tone="primary" icon={<IconPlus size={16} />} onClick={() => setDrawing(true)}>
                Draw a place
              </Button>
            }
          />
        </Card>
        <DrawPiece open={drawing} onClose={() => setDrawing(false)} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead
        title="Dressing room"
        meta={`${furniture.length} ${furniture.length === 1 ? 'place' : 'places'}`}
        action={
          <span className="flex flex-wrap items-center gap-2">
            {/* THE WAY BACK. This page has no tab of its own — it is reached
                from inside the Closet — so without this the only exit was the
                browser's own back button, which a person on a home-screen
                install does not have. Every other page reached from within
                another page in this app carries exactly this control. */}
            <LinkButton to="/closet" compact icon={<IconChevronLeft size={16} />}>Closet</LinkButton>
            <Button compact icon={<IconPlus size={16} />} onClick={() => setDrawing(true)}>
              Draw a place
            </Button>
          </span>
        }
      />

      {/* AN ELEVATION, NOT A GALLERY.
          Every form is drawn into the same 460×560 box standing on the same
          floor, so rendering them at equal widths gives true relative heights
          for nothing: the almirah is visibly the tall one and the jewellery box
          the small one, which is the whole payload the drawn room was reaching
          for with its perspective. Insertion order, always — sorting somebody's
          furniture by how full it is would be a league table of their bedroom. */}
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7 v2-rise">
        {furniture.map(piece => (
          <li key={piece.id}>
            <FurnitureCard piece={piece} />
          </li>
        ))}
      </ul>

      {/* A flat count, never a ratio. "Not filed" is a bank balance; a
          percentage would be a completion meter, which the house bans. */}
      {filed.unfiled > 0 ? (
        <>
          <Basting />
          <p className="type-ledger text-[11px] text-text-2">
            {filed.unfiled} {filed.unfiled === 1 ? 'piece has' : 'pieces have'} no address.
            Nothing needs one — a place is a convenience, not a requirement.
          </p>
        </>
      ) : null}

      <DrawPiece open={drawing} onClose={() => setDrawing(false)} />
    </div>
  );
}

function FurnitureCard({ piece }: { piece: FurniturePiece }) {
  const { activeItems } = useWardrobe();
  const counts = useCounts(activeItems, piece.id);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const noun = SLOT_NOUN[piece.form];
  return (
    <Link to={`/furniture/${piece.id}`} className="block group">
      <FurniturePlate piece={piece} counts={counts} max={240} labels={false} />
      {/* The floor stops where the piece stops. A rule that ran on past the
          last object would be a shelf with room left on it, which is a
          capacity nobody asked to see. */}
      <Basting className="mt-3 mb-2" />
      <p className="text-[15px] leading-snug text-text group-hover:underline underline-offset-[3px]">
        {piece.name}
      </p>
      <p className="type-ledger text-[10px] text-text-2 mt-1 tabular">
        {piece.slots.length} {piece.slots.length === 1 ? noun[0] : noun[1]} · {total}{' '}
        {total === 1 ? 'piece' : 'pieces'}
      </p>
    </Link>
  );
}

/* ---------------- one piece of furniture, open ---------------- */

export function FurniturePiece() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    furniture, activeItems, renameFurniture, renameSlot, removeFurniture, filePieces,
    packSlot, packPiece,
  } = useWardrobe();

  const piece = furniture.find(f => f.id === id);
  const counts = useCounts(activeItems, id ?? '');
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [putting, setPutting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  if (!piece) {
    return (
      <div className="space-y-6">
        <Masthead title="Dressing room" />
        <Card>
          <EmptyState
            plate={<PlateEmptyCloset />}
            title="No record of this place."
            body="It may have been removed. Nothing filed in it was lost — those pieces simply stopped having an address."
            action={<LinkButton to="/furniture" tone="primary" icon={<IconChevronLeft size={16} />}>Back to the dressing room</LinkButton>}
          />
        </Card>
      </div>
    );
  }

  const slot = piece.slots.find(s => s.id === openSlot) ?? piece.slots[0];
  const inside = activeItems.filter(
    i => i.place?.furnitureId === piece.id && i.place.slotId === slot.id
  );
  const elsewhere = activeItems.filter(
    i => !i.place || i.place.furnitureId !== piece.id || i.place.slotId !== slot.id
  );
  const noun = SLOT_NOUN[piece.form];

  const putAway = () => {
    const moved = filePieces(picked, { furnitureId: piece.id, slotId: slot.id });
    setPutting(false);
    setPicked([]);
    showToast(`Put away. ${moved} ${moved === 1 ? 'piece is' : 'pieces are'} in ${slot.label}.`, 'success');
  };

  const remove = () => {
    const held = activeItems.filter(i => i.place?.furnitureId === piece.id).length;
    const putBack = removeFurniture(piece.id);
    navigate('/furniture', { replace: true });
    showToast(
      held > 0
        ? `Removed. The ${held} ${held === 1 ? 'piece stays' : 'pieces stay'} in the closet; they simply stop having an address.`
        : 'Removed. Nothing was filed in it.',
      'info',
      { label: 'Undo', run: putBack },
    );
  };

  return (
    <div className="space-y-6">
      <Masthead
        title={piece.name}
        meta={`${piece.slots.length} ${piece.slots.length === 1 ? noun[0] : noun[1]}`}
        action={<LinkButton to="/furniture" compact icon={<IconChevronLeft size={16} />}>Dressing room</LinkButton>}
      />

      <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start">
        <Card>
          <FurniturePlate
            piece={piece}
            counts={counts}
            openSlot={slot.id}
            onSlot={setOpenSlot}
          />
          <Basting className="my-4" />
          <Field label="Name" htmlFor="fp-rename">
            <input
              id="fp-rename"
              className={inputClass}
              value={piece.name}
              maxLength={MAX_FURNITURE_NAME}
              onChange={e => renameFurniture(piece.id, e.target.value)}
            />
          </Field>
          <div className="mt-4">
            <Button tone="destructive" compact onClick={remove}>Remove this place</Button>
            <p className="type-ledger text-[10px] text-text-2 mt-2 leading-relaxed">
              The clothes stay. Only the line saying where they sleep goes.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <SectionTitle aside={`${inside.length} ${inside.length === 1 ? 'piece' : 'pieces'}`}>
            {slot.label}
          </SectionTitle>
          <Field label={`What this ${noun[0]} is called`} htmlFor="fp-slot">
            <input
              id="fp-slot"
              className={inputClass}
              value={slot.label}
              maxLength={MAX_SLOT_LABEL}
              onChange={e => renameSlot(piece.id, slot.id, e.target.value)}
            />
          </Field>

          {/* PACKED AWAY — the one thing a compartment can say about itself that
              changes anything anywhere else, and the case the focus group named
              as the whole point of having places at all. It is not retirement
              and not a bench state: nothing leaves the closet, nothing loses a
              wear, nothing becomes unsearchable. The day's suggestions simply
              stop reaching into the trunk under the bed in July. */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              selected={!!slot.packed}
              onClick={() => {
                packSlot(piece.id, slot.id, !slot.packed);
                showToast(
                  slot.packed
                    ? `${slot.label} is back in the rotation.`
                    : `${slot.label} is packed away. Its ${inside.length} ${inside.length === 1 ? 'piece stays' : 'pieces stay'} in the closet and stop being suggested.`,
                  'info',
                );
              }}
            >
              {slot.packed ? 'Packed away' : 'Pack this away'}
            </Chip>
            {piece.slots.length > 1 ? (
              <Chip
                onClick={() => {
                  const allPacked = piece.slots.every(s => s.packed);
                  packPiece(piece.id, !allPacked);
                  showToast(
                    allPacked ? `${piece.name} is back in the rotation.` : `${piece.name} is packed away.`,
                    'info',
                  );
                }}
              >
                {piece.slots.every(s => s.packed) ? 'Unpack the whole thing' : 'Pack the whole thing'}
              </Chip>
            ) : null}
          </div>
          {slot.packed ? (
            <p className="text-[13px] text-text-2 leading-snug">
              Out of season. Everything in here keeps its wears and stays in the closet,
              searchable and wearable — it just stops being offered on a Tuesday.
            </p>
          ) : null}

          <Button tone="primary" onClick={() => { setPicked([]); setPutting(true); }}>
            Put things in
          </Button>

          {inside.length === 0 ? (
            <p className="text-[14px] text-text-2 leading-snug">
              Nothing in here yet.
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
              {inside.map(item => (
                <li key={item.id}>
                  <div className="aspect-[4/5] bg-mat rounded-[2px] overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
                    )}
                  </div>
                  <p className="text-[14px] text-text mt-2 truncate">{item.name}</p>
                  <Button
                    compact
                    tone="tertiary"
                    onClick={() => filePieces([item.id], null)}
                  >
                    Take out
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={putting} onClose={() => setPutting(false)} title={`Put things in ${slot.label}`} wide>
        <p className="text-[13px] text-text-2 leading-relaxed">
          Tap everything that lives here. Filing by the armful is the point — one at a
          time is how a closet of three hundred becomes eight hundred taps.
        </p>
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-5 mt-4 max-h-[52vh] pane -mx-1 px-1">
          {elsewhere.map(item => {
            const on = picked.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(p => on ? p.filter(x => x !== item.id) : [...p, item.id])}
                  className={`block w-full text-left ${on ? '' : 'opacity-70'}`}
                >
                  <span className={`block aspect-[4/5] bg-mat rounded-[2px] overflow-hidden ${on ? 'plate-ink' : 'border border-border'}`}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
                    )}
                  </span>
                  <span className="block text-[13px] text-text mt-1.5 truncate">{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Button tone="primary" disabled={picked.length === 0} onClick={putAway}>
            {picked.length === 1 ? 'File 1 piece here' : `File ${picked.length} pieces here`}
          </Button>
          <Button tone="tertiary" onClick={() => setPutting(false)}>Never mind</Button>
        </div>
      </Modal>
    </div>
  );
}
