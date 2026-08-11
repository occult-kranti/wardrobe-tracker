import { useMemo, useState } from 'react';
import { useWardrobe } from '../context/WardrobeContext';
import { categoryLabel, displayTag, PRESET_COLORS, type ClothingItem } from '../types';
import { todayLocal, addDays } from '../lib/dates';
import { findSimilarItems, matchSummary, wearContext, type SimilarMatch } from '../lib/similarity';
import { Button, Card, Chip, EmptyState, Masthead, SectionTitle, inputClass } from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyCloset } from '../components/art';
import { IconCheck } from '../components/icons';
import { showToast } from '../components/Toast';

/**
 * BEFORE YOU BUY — the anti-impulse surface.
 *
 * Built for ninety seconds on a phone in a shop, so the page IS the form: pick a
 * colour, optionally say what it is, tap an occasion or two. Matches appear live
 * while typing — no submit, no loading state, no score.
 *
 * The design contract (docs/06-focus-group-requirements.md §1 row 5 and §3):
 * matching runs across categories and is retire-aware; the user's own photos
 * dominate; exactly one aggregate line of facts, and then the page stops talking;
 * two equally weighted exits, neither styled as the correct answer. No verdict, no
 * warning colours, no advice — and never a shop link, price comparison, or "buy"
 * button of any kind.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

/** Photo tile, or the drawn flat when there's no photo. The no-photo state is first-class. */
function Thumb({ item, className = '' }: { item: ClothingItem; className?: string }) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} />
      )}
    </span>
  );
}

/** One owned piece, held up against the thing in the shop. */
function MatchRow({ match }: { match: SimilarMatch }) {
  const { item, reasons } = match;
  return (
    <li className="flex gap-4 sm:gap-5">
      <Thumb item={item} className="w-[38%] max-w-[168px] aspect-[4/5] shrink-0" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[16px] text-text leading-tight">{item.name}</p>
        <p className="type-ledger text-[11px] text-text-2 tabular mt-1">{wearContext(item)}</p>
        {reasons.length > 0 ? (
          <ul className="mt-2.5 space-y-1">
            {reasons.map(reason => (
              <li key={reason} className="type-ledger text-[11px] text-text-2 leading-relaxed">
                {reason}
              </li>
            ))}
          </ul>
        ) : null}
        {/* Where "but this one will fit better" goes to die. */}
        {item.fitsLike ? (
          <p className="type-editorial text-[20px] text-text mt-3 leading-snug text-balance">
            “{item.fitsLike}”
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function BeforeYouBuy() {
  const { activeItems, settings, addWishlistItem } = useWardrobe();

  const [color, setColor] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [occasions, setOccasions] = useState<string[]>([]);
  const [category, setCategory] = useState('');

  const touched =
    color !== '' || name.trim() !== '' || brand.trim() !== '' || occasions.length > 0 || category !== '';

  const customColor =
    color !== '' && !PRESET_COLORS.some(hex => hex.toLowerCase() === color.toLowerCase());

  const matches = useMemo(() => {
    if (!touched) return [];
    return findSimilarItems(
      activeItems,
      {
        color,
        name: name.trim() || undefined,
        brand: brand.trim() || undefined,
        occasions,
        category: category || undefined,
      },
      5
    );
  }, [touched, activeItems, color, name, brand, occasions, category]);

  const summary = matchSummary(matches);

  const browseCategories = useMemo(
    () => settings.categories.filter(c => !c.quiet),
    [settings.categories]
  );

  const clear = () => {
    setColor('');
    setName('');
    setBrand('');
    setOccasions([]);
    setCategory('');
  };

  const toggleOccasion = (tag: string) =>
    setOccasions(prev => (prev.includes(tag) ? prev.filter(o => o !== tag) : [...prev, tag]));

  /* ---------- the two exits, weighted the same ---------- */

  const addToWishlist = () => {
    addWishlistItem({
      name: name.trim() || 'Unnamed piece',
      category,
      color,
      brand: brand.trim() || undefined,
      priority: 'medium',
      status: 'waiting',
      // The silence is the intervention: seven days, no reminders, one question at
      // the end. See docs/06-focus-group-requirements.md §1 row 7.
      coolingOff: { endsAt: addDays(todayLocal(), 7), asked: false },
    });
    showToast('On the wishlist. It waits seven days.', 'info');
    clear();
  };

  const ownEnough = () => {
    clear();
    showToast('Noted. The closet stays as it is.', 'info');
  };

  // `flex-1` in a COLUMN sets flex-basis on the block axis, and basis beats the
  // button's own h-11: on mobile both of these exits measured 22.8px tall — half
  // the 44px floor, on the two most consequential buttons in the app. Full width
  // when stacked, equal share only once the row is horizontal.
  const exits = (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button onClick={addToWishlist} className="w-full sm:flex-1">
        Add it to the wishlist
      </Button>
      <Button onClick={ownEnough} className="w-full sm:flex-1">
        I already own enough
      </Button>
    </div>
  );

  /* ---------- nothing to compare against ---------- */

  if (activeItems.length === 0) {
    return (
      <>
        <Masthead title="Before you buy" />
        <Card>
          <EmptyState
            plate={<PlateEmptyCloset />}
            title="Nothing on the rail to compare against."
            body="This page holds a piece you're looking at up against the ones you already own. Once the closet has a few pieces in it, it starts answering."
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead title="Before you buy" meta={`${activeItems.length} pieces on record`} />

      {/* THE FORM IS THE PAGE. No submit — matches arrive while you type. */}
      <Card>
        <SectionTitle aside="the piece in your hands">What are you looking at</SectionTitle>

        <fieldset className="border-0 p-0 m-0">
          <legend className="type-ledger text-[11px] text-text-2 mb-2">Colour</legend>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map(hex => {
              const selected = color.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(selected ? '' : hex)}
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
            {/* Anything the preset row doesn't hold — the shop rarely stocks the swatch. */}
            <label
              htmlFor="byb-color"
              className={`w-11 h-11 rounded-[2px] inline-flex items-center justify-center cursor-pointer type-ledger text-[10px] ${
                customColor
                  ? 'plate-ink text-transparent'
                  : 'border border-border hover:border-text text-text-2'
              }`}
              style={customColor ? { backgroundColor: color } : undefined}
              title="Pick any colour"
            >
              {customColor ? (
                <span className="w-5 h-5 bg-surface text-text inline-flex items-center justify-center rounded-[2px]">
                  <IconCheck size={12} />
                </span>
              ) : (
                'Any'
              )}
              <input
                id="byb-color"
                type="color"
                // Native colour inputs need a concrete value; borrow a mid grey
                // from the sanctioned swatch palette rather than inventing one.
                value={color || PRESET_COLORS[2]}
                onChange={e => setColor(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        </fieldset>

        <Basting className="my-5" />

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="byb-name" className="type-ledger text-[11px] text-text-2 block">
              What is it
            </label>
            <input
              id="byb-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Black wool coat"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="byb-brand" className="type-ledger text-[11px] text-text-2 block">
              Brand
            </label>
            <input
              id="byb-brand"
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="Brand, or made by you"
              autoComplete="off"
              className={inputClass}
            />
          </div>
        </div>

        <Basting className="my-5" />

        <fieldset className="border-0 p-0 m-0">
          <legend className="type-ledger text-[11px] text-text-2 mb-2">What for</legend>
          <div className="flex flex-wrap gap-1.5">
            {settings.occasions.map(tag => (
              <Chip
                key={tag}
                selected={occasions.includes(tag)}
                onClick={() => toggleOccasion(tag)}
              >
                {displayTag(tag)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-0 p-0 m-0 mt-5">
          <legend className="type-ledger text-[11px] text-text-2 mb-2">Kind of piece</legend>
          <div className="flex flex-wrap gap-1.5">
            {browseCategories.map(cat => (
              <Chip
                key={cat.id}
                selected={category === cat.id}
                onClick={() => setCategory(category === cat.id ? '' : cat.id)}
              >
                {cat.label}
              </Chip>
            ))}
          </div>
          <p className="text-[13px] text-text-2 mt-3 leading-snug">
            Matching runs across every category — a jumpsuit is compared with the shirt and
            trousers you already own.
          </p>
        </fieldset>
      </Card>

      {/* RESULTS — your own photos, one line of facts, then silence. */}
      {touched ? (
        matches.length > 0 ? (
          <Card>
            <SectionTitle
              aside={category ? categoryLabel(settings, category) : undefined}
            >
              Already in the closet
            </SectionTitle>

            {/* Exactly one aggregate line. Then stop talking. */}
            {summary ? (
              <p className="type-editorial text-[21px] sm:text-[23px] leading-snug text-balance">
                {summary}
              </p>
            ) : null}

            <Basting className="my-5" />

            <ul className="space-y-5">
              {matches.map(match => (
                <MatchRow key={match.item.id} match={match} />
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <p className="type-editorial text-[21px] sm:text-[23px] leading-snug text-balance">
              Nothing in your closet is close to this.
            </p>
          </Card>
        )
      ) : null}

      {/* TWO EXITS. Same weight, same styling, neither one the right answer. */}
      <Card>
        {exits}
      </Card>
    </div>
  );
}
