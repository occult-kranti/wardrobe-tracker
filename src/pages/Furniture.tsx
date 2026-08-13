import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, Chip, EmptyState, Field, LinkButton, Masthead, Modal, SectionTitle, inputClass } from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyCloset } from '../components/art';
import { IconChevronLeft, IconPlus } from '../components/icons';
import { showToast } from '../components/Toast';
import { drawFurniture, defaultSlotLabels, FORM_LABELS, SLOT_NOUN, MAX_SLOTS } from '../lib/furnitureArt';
import type { ClothingItem, Furniture as FurniturePiece, FurnitureForm } from '../types';

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
}: {
  piece: FurniturePiece;
  counts: Record<string, number>;
  openSlot?: string | null;
  onSlot?: (slotId: string) => void;
}) {
  const drawing = useMemo(() => drawFurniture(piece, counts), [piece, counts]);
  return (
    <div className="relative w-full max-w-[326px] mx-auto text-text">
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
  const { addFurniture } = useWardrobe();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [form, setForm] = useState<FurnitureForm>('chest');
  const [count, setCount] = useState(3);

  // The preview redraws as you press +. The flow IS the artistry: you are
  // building the object, not filling in a form about it.
  const preview = useMemo<FurniturePiece>(() => ({
    id: 'preview',
    name: name || 'A place',
    form,
    slots: defaultSlotLabels(form, count).map((label, i) => ({ id: `p${i}`, label })),
    dateAdded: '',
  }), [name, form, count]);

  const draw = () => {
    const id = addFurniture(name, form, count);
    onClose();
    setName(''); setForm('chest'); setCount(3);
    navigate(`/furniture/${id}`);
  };

  const noun = SLOT_NOUN[form];
  return (
    <Modal open={open} onClose={onClose} title="Draw a place">
      <div className="space-y-5">
        <div className="bg-mat rounded-[2px] py-4">
          <FurniturePlate piece={preview} counts={{}} />
        </div>

        <Field label="What to call it" htmlFor="fp-name">
          <input
            id="fp-name"
            className={inputClass}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Bedroom chest, the hall rail, the loft"
            autoFocus
          />
        </Field>

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">What kind</legend>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {(['rail', 'chest', 'shelves'] as FurnitureForm[]).map(f => (
              <Chip key={f} selected={form === f} onClick={() => setForm(f)}>
                {FORM_LABELS[f]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-0 p-0 m-0 space-y-1.5">
          <legend className="type-ledger text-[11px] text-text-2">
            How many {noun[1]}
          </legend>
          <div className="flex items-center gap-3 pt-0.5">
            <Button compact onClick={() => setCount(c => Math.max(1, c - 1))} aria-label={`One fewer ${noun[0]}`}>
              &minus;
            </Button>
            <span className="type-masthead text-[22px] tabular w-8 text-center">{count}</span>
            <Button
              compact
              disabled={count >= MAX_SLOTS}
              onClick={() => setCount(c => Math.min(MAX_SLOTS, c + 1))}
              aria-label={`One more ${noun[0]}`}
            >
              +
            </Button>
          </div>
          {count >= MAX_SLOTS ? (
            <p className="type-ledger text-[10px] text-text-2 pt-1">
              Seven is the tallest that fits the page. An eighth {noun[0]} is a second place.
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button tone="primary" onClick={draw}>Draw it</Button>
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
        <Masthead title="Furniture" />
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
        title="Furniture"
        meta={`${furniture.length} ${furniture.length === 1 ? 'place' : 'places'}`}
        action={
          <Button tone="primary" compact icon={<IconPlus size={16} />} onClick={() => setDrawing(true)}>
            Draw a place
          </Button>
        }
      />

      <ul className="grid sm:grid-cols-2 gap-5 v2-rise">
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
      <Card>
        <FurniturePlate piece={piece} counts={counts} />
        <Basting className="my-4" />
        <p className="type-masthead text-[22px] leading-none group-hover:underline underline-offset-[3px]">
          {piece.name}
        </p>
        <p className="type-ledger text-[11px] text-text-2 mt-2 tabular">
          {piece.slots.length} {piece.slots.length === 1 ? noun[0] : noun[1]} · {total}{' '}
          {total === 1 ? 'piece' : 'pieces'}
        </p>
      </Card>
    </Link>
  );
}

/* ---------------- one piece of furniture, open ---------------- */

export function FurniturePiece() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    furniture, activeItems, renameFurniture, renameSlot, removeFurniture, filePieces,
  } = useWardrobe();

  const piece = furniture.find(f => f.id === id);
  const counts = useCounts(activeItems, id ?? '');
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [putting, setPutting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  if (!piece) {
    return (
      <div className="space-y-6">
        <Masthead title="Furniture" />
        <Card>
          <EmptyState
            plate={<PlateEmptyCloset />}
            title="No record of this place."
            body="It may have been removed. Nothing filed in it was lost — those pieces simply stopped having an address."
            action={<LinkButton to="/furniture" tone="primary" icon={<IconChevronLeft size={16} />}>Back to furniture</LinkButton>}
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
        action={<LinkButton to="/furniture" compact icon={<IconChevronLeft size={16} />}>Furniture</LinkButton>}
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
              onChange={e => renameSlot(piece.id, slot.id, e.target.value)}
            />
          </Field>

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
