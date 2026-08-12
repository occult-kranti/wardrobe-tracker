import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import {
  categoryLabel,
  PRESET_COLORS,
  PRIORITY_LABELS,
  type AppSettings,
  type ClothingItem,
  type WishlistItem,
} from '../types';
import { todayLocal, addDays } from '../lib/dates';
import { findSimilarItems, wearContext } from '../lib/similarity';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Masthead,
  SectionTitle,
  Stat,
  inputClass,
  selectClass,
} from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyWishlist } from '../components/art';
import { IconCheck, IconClose, IconPlus } from '../components/icons';
import { showToast } from '../components/Toast';

/**
 * WISHLIST — the list that cools.
 *
 * Contract: docs/06-focus-group-requirements.md §1 row 7. A piece can be put down
 * for a while (seven days by default) and during that wait the app says NOTHING:
 * no badge, no nav count, no notification, no reminder. The silence *is* the
 * intervention. The only mark is a quiet mono line on the card itself.
 *
 * When the wait is up, that one card asks once — Keep / Let it go / Bought, three
 * choices of identical weight, none styled as the right answer — and then never
 * asks again. Released pieces go to a plain ledger headed by one number framed as
 * money that stayed yours. Not money saved from a mistake. Not a score. A total.
 *
 * While a piece waits, the closet answers back: up to three owned pieces that are
 * already close to it, with their wear facts and nothing else. No verdict, no
 * warning colour, and — by contract — never a shop link of any kind.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

/** Whole days from today to a local YYYY-MM-DD. Negative once the date is past. */
function daysUntil(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - now.getTime()) / 86400000);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function price(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

/** 'YYYY-MM-DD' → '12 Mar'. Never parse a stored day as UTC. */
function shortDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/** The card is asking exactly when the wait has run out and it hasn't asked yet. */
function isAsking(item: WishlistItem): boolean {
  if (item.status !== 'waiting' || !item.coolingOff || item.coolingOff.asked) return false;
  return todayLocal() >= item.coolingOff.endsAt;
}

/** The quiet line — the only thing a wait is allowed to say. */
function waitLine(item: WishlistItem): string | null {
  if (item.status !== 'waiting' || !item.coolingOff || item.coolingOff.asked) return null;
  const left = daysUntil(item.coolingOff.endsAt);
  if (left <= 0) return null;
  return `WAITING · ${left} ${left === 1 ? 'DAY' : 'DAYS'} LEFT`;
}

/**
 * Photo tile, or the drawn flat when there's no photo — for owned pieces and
 * wished-for ones alike. The no-photo state is first-class, never broken.
 */
function Thumb({
  item,
  className = '',
}: {
  item: Pick<ClothingItem, 'category' | 'color'> & { imageUrl?: string; name?: string };
  className?: string;
}) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />
      )}
    </span>
  );
}

/** Tertiary link — the Button primitive's tertiary tone, on an <a>. */
const tertiaryLink =
  'type-label inline-flex items-center gap-2 text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 min-h-11 py-2';

/* ---------- what the closet already holds ---------- */

function AlreadyOwned({ item, pool }: { item: WishlistItem; pool: ClothingItem[] }) {
  const matches = useMemo(
    () =>
      findSimilarItems(
        pool,
        {
          color: item.color,
          category: item.category,
          name: item.name,
          brand: item.brand,
          occasions: [],
        },
        3
      ),
    [pool, item.color, item.category, item.name, item.brand]
  );

  if (matches.length === 0) return null;

  return (
    <>
      <Basting className="my-4" />
      <p className="type-ledger text-[11px] text-text-2">Already in the closet</p>
      <ul className="mt-3 grid grid-cols-3 gap-3">
        {matches.map(match => (
          <li key={match.item.id}>
            <Thumb item={match.item} className="w-full aspect-[4/5]" />
            <p className="text-[13px] text-text mt-1.5 leading-tight">{match.item.name}</p>
            <p className="type-ledger text-[10px] text-text-2 tabular mt-0.5">
              {wearContext(match.item)}
            </p>
            {/* The engine's own reasons, so every match explains itself. */}
            <p className="text-[11px] text-text-2 mt-0.5 leading-snug">
              {match.reasons.join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      <Link to="/compare" className={tertiaryLink}>
        Hold it up against the closet
      </Link>
    </>
  );
}

/* ---------- one piece on the list ---------- */

interface CardActions {
  onKeep: () => void;
  onRelease: () => void;
  onBought: () => void;
  onRemove: () => void;
}

function WishCard({
  item,
  settings,
  pool,
  showSimilar,
  actions,
}: {
  item: WishlistItem;
  settings: AppSettings;
  pool: ClothingItem[];
  showSimilar: boolean;
  actions: CardActions;
}) {
  const asking = isAsking(item);
  const line = waitLine(item);

  const meta = [
    categoryLabel(settings, item.category),
    item.brand,
    item.price !== undefined ? price(item.price) : undefined,
  ].filter(Boolean) as string[];

  return (
    <li>
      <Card>
        <div className="flex gap-4">
          <Thumb item={item} className="w-[68px] sm:w-[84px] shrink-0 aspect-[4/5]" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[16px] text-text leading-tight">{item.name}</p>
                <p className="type-ledger text-[11px] text-text-2 tabular mt-1">
                  {meta.join(' · ')}
                </p>
              </div>
              <IconButton
                label={`Take ${item.name} off the list`}
                onClick={actions.onRemove}
                className="-mr-2 -mt-2 shrink-0"
              >
                <IconClose size={16} />
              </IconButton>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip as="span" title="Priority">
                {PRIORITY_LABELS[item.priority]}
              </Chip>
              {item.status === 'bought' ? (
                <span className="type-ledger text-[11px] text-text-2">In the closet</span>
              ) : null}
            </div>

            {item.notes ? (
              <p className="text-[14px] text-text-2 leading-snug mt-2">{item.notes}</p>
            ) : null}

            {/* The whole of what a wait is allowed to say. */}
            {line ? <p className="type-ledger text-[11px] text-text-2 tabular mt-3">{line}</p> : null}
          </div>
        </div>

        {asking ? (
          <>
            <Basting className="my-4" />
            <p className="type-editorial text-[20px] leading-snug">Still want this?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
              <Button onClick={actions.onKeep}>Keep</Button>
              <Button onClick={actions.onRelease}>Let it go</Button>
              <Button onClick={actions.onBought}>Bought</Button>
            </div>
          </>
        ) : item.status !== 'bought' ? (
          <>
            <Basting className="my-4" />
            <div className="flex flex-wrap items-center gap-2">
              <Button compact icon={<IconCheck size={14} />} onClick={actions.onBought}>
                Got it
              </Button>
              {/* A piece mid-wait keeps its quiet: it will be asked when the wait
                  is up, and until then the card offers nothing to answer. */}
              {item.status === 'waiting' && item.coolingOff ? null : (
                <Button compact onClick={actions.onRelease}>
                  Let it go
                </Button>
              )}
            </div>
          </>
        ) : null}

        {showSimilar ? <AlreadyOwned item={item} pool={pool} /> : null}
      </Card>
    </li>
  );
}

/* ---------- the page ---------- */

const WAIT_OPTIONS = [
  { value: '0', label: 'No wait' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

export default function Wishlist() {
  const {
    wishlist,
    settings,
    activeItems,
    addWishlistItem,
    deleteWishlistItem,
    moveWishlistToCloset,
    releaseWishlistItem,
    keepWishlistItem,
  } = useWardrobe();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState(settings.categories[0]?.id ?? 'tops');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [priceInput, setPriceInput] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [wait, setWait] = useState('7');
  const [notes, setNotes] = useState('');

  const waiting = wishlist.filter(w => w.status === 'waiting');
  const kept = wishlist.filter(w => w.status === 'kept');
  const released = wishlist.filter(w => w.status === 'let-go');
  const bought = wishlist.filter(w => w.status === 'bought');

  // Still-on-the-list value: the pieces that haven't been answered either way.
  const openItems = [...waiting, ...kept];
  const openTotal = openItems.reduce((sum, w) => sum + (w.price ?? 0), 0);
  const stayedYours = released.reduce((sum, w) => sum + (w.price ?? 0), 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const days = Number(wait);
    addWishlistItem({
      name: name.trim(),
      category,
      color,
      brand: brand.trim() || undefined,
      price: priceInput ? parseFloat(priceInput) : undefined,
      priority,
      notes: notes.trim() || undefined,
      status: 'waiting',
      // Silence for the whole wait, then one question. Nothing in between.
      coolingOff: days > 0 ? { endsAt: addDays(todayLocal(), days), asked: false } : undefined,
    });
    showToast(
      days > 0 ? `On the list. It waits ${days} days.` : 'On the list.',
      'success'
    );
    setName('');
    setBrand('');
    setPriceInput('');
    setNotes('');
    setShowAdd(false);
  };

  const cardActions = (item: WishlistItem): CardActions => ({
    onKeep: () => {
      keepWishlistItem(item.id);
      showToast('Kept. It stays on the list.', 'info');
    },
    onRelease: () => {
      releaseWishlistItem(item.id);
      showToast('Let go. It goes to the ledger.', 'info');
    },
    onBought: () => {
      moveWishlistToCloset(item.id);
      showToast('Added to the closet. It starts at 0 wears.', 'success');
    },
    onRemove: () => {
      deleteWishlistItem(item.id);
      showToast('Off the list.', 'info');
    },
  });

  const renderList = (list: WishlistItem[], showSimilar: boolean) => (
    <ul className="space-y-3">
      {list.map(item => (
        <WishCard
          key={item.id}
          item={item}
          settings={settings}
          pool={activeItems}
          showSimilar={showSimilar}
          actions={cardActions(item)}
        />
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <Masthead
        title="Wishlist"
        meta={openItems.length > 0 ? `${openItems.length} on the list` : undefined}
        action={
          <Button
            compact
            icon={showAdd ? <IconClose size={14} /> : <IconPlus size={14} />}
            onClick={() => setShowAdd(v => !v)}
            aria-expanded={showAdd}
          >
            {showAdd ? 'Close' : 'Add'}
          </Button>
        }
      />

      {/* ---------- the add form ---------- */}
      {showAdd ? (
        <Card>
          <SectionTitle aside="nothing is bought here">Something you're considering</SectionTitle>
          <form onSubmit={handleAdd} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="What is it" htmlFor="wish-name">
                <input
                  id="wish-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Black wool coat"
                  autoComplete="off"
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Brand" htmlFor="wish-brand">
                <input
                  id="wish-brand"
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Brand, or made by you"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              <Field label="Kind of piece" htmlFor="wish-category">
                <select
                  id="wish-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={selectClass}
                >
                  {settings.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Price" htmlFor="wish-price">
                <input
                  id="wish-price"
                  type="number"
                  value={priceInput}
                  onChange={e => setPriceInput(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={`${inputClass} tabular`}
                />
              </Field>
              <Field label="Priority" htmlFor="wish-priority">
                <select
                  id="wish-priority"
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className={selectClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
            </div>

            <fieldset className="border-0 p-0 m-0">
              <legend className="type-ledger text-[11px] text-text-2 mb-2">Colour</legend>
              <div className="flex flex-wrap gap-1.5">
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

            <Field
              label="Let it wait"
              htmlFor="wish-wait"
              hint="Nothing is said while it waits — no reminder, no count, no badge. When the wait is up, the card asks once."
            >
              <select
                id="wish-wait"
                value={wait}
                onChange={e => setWait(e.target.value)}
                className={selectClass}
              >
                {WAIT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notes" htmlFor="wish-notes">
              <textarea
                id="wish-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What it would go with, where you saw it"
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <Button type="submit" tone="primary" disabled={!name.trim()} className="w-full">
              Put it on the list
            </Button>
          </form>
        </Card>
      ) : null}

      {/* ---------- nothing on the list ---------- */}
      {wishlist.length === 0 ? (
        <Card>
          <EmptyState
            plate={<PlateEmptyWishlist />}
            title="Nothing on the list."
            body="Pieces you're thinking about wait here. Give one a few days of silence and see whether it's still on your mind at the end."
            action={
              showAdd ? undefined : (
                <Button onClick={() => setShowAdd(true)}>Add something you're considering</Button>
              )
            }
          />
        </Card>
      ) : null}

      {/* ---------- waiting ---------- */}
      {waiting.length > 0 ? (
        <section aria-labelledby="wish-waiting">
          <h2 id="wish-waiting" className="type-label text-text mb-3">
            Waiting
          </h2>
          {renderList(waiting, true)}
        </section>
      ) : null}

      {/* ---------- kept ---------- */}
      {kept.length > 0 ? (
        <section aria-labelledby="wish-kept">
          <h2 id="wish-kept" className="type-label text-text mb-3">
            Kept
          </h2>
          {renderList(kept, false)}
        </section>
      ) : null}

      {/* ---------- stayed yours ---------- */}
      {released.length > 0 ? (
        <section aria-labelledby="wish-released">
          <h2 id="wish-released" className="type-label text-text mb-3">
            Stayed yours
          </h2>
          <Card>
            {stayedYours > 0 ? (
              <p className="type-editorial text-[21px] sm:text-[23px] leading-snug text-balance">
                {money(stayedYours)} stayed yours.
              </p>
            ) : (
              <p className="type-editorial text-[21px] sm:text-[23px] leading-snug text-balance">
                {released.length} {released.length === 1 ? 'piece' : 'pieces'} stayed on the shelf.
              </p>
            )}
            <Basting className="my-4" />
            <ul>
              {released.map(item => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-text leading-tight truncate">{item.name}</p>
                    <p className="type-ledger text-[10px] text-text-2 mt-0.5">
                      {[
                        item.brand,
                        item.releasedAt ? `let go ${shortDay(item.releasedAt)}` : undefined,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className="type-ledger text-[12px] text-text-2 tabular shrink-0">
                    {item.price !== undefined ? price(item.price) : '—'}
                  </span>
                  <IconButton
                    label={`Remove ${item.name} from the ledger`}
                    onClick={() => {
                      deleteWishlistItem(item.id);
                      showToast('Off the list.', 'info');
                    }}
                    className="shrink-0 -mr-2"
                  >
                    <IconClose size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/* ---------- bought ---------- */}
      {bought.length > 0 ? (
        <section aria-labelledby="wish-bought">
          <h2 id="wish-bought" className="type-label text-text mb-3">
            Bought
          </h2>
          {renderList(bought, false)}
        </section>
      ) : null}

      {/* ---------- the total, stated once ---------- */}
      {openItems.length > 0 ? (
        <Card>
          <div className="flex items-end justify-between gap-6">
            {/* No prices on file means no sum to state — "$0" would assert one. */}
            {openTotal > 0 ? (
              <Stat value={money(openTotal)} label="Still on the list" />
            ) : (
              <p className="type-ledger text-[11px] text-text-2">No prices noted</p>
            )}
            <Stat value={openItems.length} label={openItems.length === 1 ? 'Piece' : 'Pieces'} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
