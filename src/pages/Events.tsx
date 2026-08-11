import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import {
  EVENT_LABELS,
  categoryLabel,
  type ClothingItem,
  type EventKind,
  type EventReservation,
  type WardrobeEvent,
} from '../types';
import { addDays, daysSince, todayLocal } from '../lib/dates';
import {
  Button, Card, Chip, EmptyState, Field, Masthead, Modal, SectionTitle, inputClass,
} from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyOutfits } from '../components/art';
import { IconPlus } from '../components/icons';
import { showToast } from '../components/Toast';
import { shortDate } from '../components/social';

/**
 * EVENTS — outfits held against dated occasions.
 *
 * A reservation is not a wear. Nothing here moves a wear count; the day still
 * has to be logged when it arrives, exactly like a planned calendar day. That
 * separation is what keeps the Ledger honest about what was actually worn.
 *
 * "Complete the look" fills gaps from the closet you already have. It does not
 * suggest anything to buy — hard rule 2, and the reason the whole product
 * exists: a feature that talks you out of buying cannot profit from buying.
 * A genuine gap goes to the wishlist, where the cooling-off wait is.
 */

/** The pieces a dressed look usually needs. Missing ones are what to fill. */
const EXPECTED: Array<{ category: string; label: string; unless?: string[] }> = [
  { category: 'tops', label: 'a top', unless: ['dresses', 'drapes', 'suits'] },
  { category: 'bottoms', label: 'something on the bottom', unless: ['dresses', 'drapes', 'suits'] },
  { category: 'shoes', label: 'shoes' },
];

/**
 * The composer. One task per screen (§8.7): what it is, when it is, where.
 *
 * A single day is the common case, so the end date is optional and an event
 * with no end date is a one-day event — not an error to correct. The days
 * inside the span become reservations up front, so the page opens on something
 * to dress rather than on another empty state.
 */
function EventComposer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (event: Omit<WardrobeEvent, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<EventKind>('trip');
  const [startDate, setStartDate] = useState(todayLocal());
  const [endDate, setEndDate] = useState('');
  const [place, setPlace] = useState('');

  const reset = () => {
    setName('');
    setKind('trip');
    setStartDate(todayLocal());
    setEndDate('');
    setPlace('');
  };

  // An end date before the start is a typo, not an event. Held rather than
  // shouted about: the button simply will not fire until the dates agree.
  const endsBeforeItStarts = Boolean(endDate) && endDate < startDate;
  const ready = name.trim().length > 0 && Boolean(startDate) && !endsBeforeItStarts;

  const submit = () => {
    if (!ready) return;
    const last = endDate && endDate > startDate ? endDate : startDate;
    const reservations: EventReservation[] = [];
    for (let day = startDate; day <= last; day = addDays(day, 1)) {
      reservations.push({ id: `res-${day}-${reservations.length}`, date: day, itemIds: [] });
      if (reservations.length >= 30) break; // a wardrobe event, not a sabbatical
    }
    onCreate({
      name: name.trim(),
      kind,
      startDate,
      endDate: endDate && endDate > startDate ? endDate : undefined,
      place: place.trim() || undefined,
      reservations,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add an event">
      <div className="space-y-5">
        <Field label="What is it" htmlFor="event-name">
          <input
            id="event-name"
            className={inputClass}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Rohit and Anjali's wedding"
          />
        </Field>

        <Field label="Kind">
          <div className="flex flex-wrap gap-2 pt-1">
            {(Object.keys(EVENT_LABELS) as EventKind[]).map(k => (
              <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
                {EVENT_LABELS[k]}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First day" htmlFor="event-start">
            <input
              id="event-start"
              type="date"
              className={inputClass}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </Field>
          <Field
            label="Last day"
            htmlFor="event-end"
            hint={endsBeforeItStarts ? 'That is before the first day.' : 'Leave blank for one day.'}
          >
            <input
              id="event-end"
              type="date"
              className={inputClass}
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Where" htmlFor="event-place" hint="Optional.">
          <input
            id="event-place"
            className={inputClass}
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder="Udaipur"
          />
        </Field>

        <Basting />

        <div className="flex items-center gap-3">
          <Button tone="primary" onClick={submit} disabled={!ready}>
            Hold these days
          </Button>
          <Button tone="tertiary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function Thumb({ item, className = '' }: { item?: ClothingItem; className?: string }) {
  return (
    <span className={`block bg-mat overflow-hidden rounded-[2px] ${className}`}>
      {item?.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item?.category ?? 'accessories'} color={item?.color} />
      )}
    </span>
  );
}

function daysUntil(date: string): number {
  const today = todayLocal();
  if (date <= today) return -daysSince(date);
  const a = new Date(`${today}T00:00:00`).getTime();
  const b = new Date(`${date}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function whenLine(event: WardrobeEvent): string {
  const away = daysUntil(event.startDate);
  const span = event.endDate && event.endDate !== event.startDate
    ? `${shortDate(event.startDate)} – ${shortDate(event.endDate)}`
    : shortDate(event.startDate);
  if (away > 1) return `${span} · in ${away} days`;
  if (away === 1) return `${span} · tomorrow`;
  if (away === 0) return `${span} · today`;
  return `${span} · done`;
}

export default function Events() {
  const { events, outfits, activeItems, getItem, getOutfit, settings, updateEvent, addEvent } = useWardrobe();
  const [completing, setCompleting] = useState<{ event: WardrobeEvent; reservation: EventReservation } | null>(null);
  const [adding, setAdding] = useState(false);

  const today = todayLocal();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return {
      upcoming: sorted.filter(e => (e.endDate ?? e.startDate) >= today),
      past: sorted.filter(e => (e.endDate ?? e.startDate) < today).reverse(),
    };
  }, [events, today]);

  /** What a reservation is missing, and what in the closet could fill it. */
  const gapsFor = (reservation: EventReservation) => {
    const pieces = reservation.itemIds.map(id => getItem(id)).filter((i): i is ClothingItem => !!i);
    const held = new Set(pieces.map(p => p.category));
    return EXPECTED
      .filter(slot => !held.has(slot.category))
      .filter(slot => !slot.unless?.some(c => held.has(c)))
      .map(slot => ({
        ...slot,
        options: activeItems
          .filter(i => i.category === slot.category && !reservation.itemIds.includes(i.id))
          // Most-worn first: what you actually reach for is the best suggestion
          // this app can make, and it is one you already own.
          .sort((a, b) => b.wearCount - a.wearCount)
          .slice(0, 8),
      }));
  };

  const create = (event: Omit<WardrobeEvent, 'id'>) => {
    addEvent(event);
    showToast(`Held. ${event.name} is on the page.`, 'info');
  };

  const addPiece = (event: WardrobeEvent, reservation: EventReservation, itemId: string) => {
    updateEvent(event.id, {
      reservations: event.reservations.map(r =>
        r.id === reservation.id ? { ...r, itemIds: [...r.itemIds, itemId] } : r
      ),
    });
  };

  if (events.length === 0) {
    return (
      <>
        <Masthead title="Events" />
        <Card>
          {/* §8.4: exactly one CTA on an empty screen — and it must exist.
              This state used to offer none, and nothing anywhere in the app
              called addEvent, so a wardrobe that had never been seeded with
              sample events could not reach this feature at all. */}
          <EmptyState
            plate={<PlateEmptyOutfits />}
            title="Nothing on the calendar to dress for yet."
            body="A trip, a wedding week, an offsite: hold a look against each day so the packing is decided before the morning it matters. Reserving is not wearing — the day still gets logged when it comes."
            action={
              <Button tone="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
                Add an event
              </Button>
            }
          />
        </Card>
        <EventComposer open={adding} onClose={() => setAdding(false)} onCreate={create} />
      </>
    );
  }

  const renderEvent = (event: WardrobeEvent, done: boolean) => (
    <Card key={event.id} className={done ? 'opacity-75' : ''}>
      <SectionTitle aside={whenLine(event)}>{event.name}</SectionTitle>
      <p className="type-ledger text-[11px] text-text-2 -mt-2 mb-4">
        {EVENT_LABELS[event.kind]}
        {event.place ? ` · ${event.place}` : ''}
        {` · ${event.reservations.length} ${event.reservations.length === 1 ? 'day' : 'days'} held`}
      </p>
      {event.notes ? (
        <p className="type-editorial text-[19px] leading-snug text-balance mb-4">{event.notes}</p>
      ) : null}

      <ul className="space-y-4">
        {event.reservations.map(reservation => {
          const outfit = reservation.outfitId ? getOutfit(reservation.outfitId) : undefined;
          const pieces = reservation.itemIds.map(id => getItem(id)).filter((i): i is ClothingItem => !!i);
          const gaps = gapsFor(reservation);
          return (
            <li key={reservation.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] text-text">{reservation.label ?? 'Held'}</p>
                <p className="type-ledger text-[11px] text-text-2 tabular shrink-0">
                  {shortDate(reservation.date)}
                </p>
              </div>
              {outfit ? (
                <p className="type-ledger text-[11px] text-text-2 mt-1">{outfit.name}</p>
              ) : null}

              <div className="flex flex-wrap gap-2 mt-2.5">
                {outfit?.imageUrl ? (
                  <span className="block w-20 rounded-[2px] overflow-hidden bg-mat" style={{ aspectRatio: '3 / 4' }}>
                    <img src={outfit.imageUrl} alt="" className="w-full h-full object-cover" />
                  </span>
                ) : null}
                {pieces.slice(0, 8).map(piece => (
                  <Thumb key={piece.id} item={piece} className="w-12 h-15" />
                ))}
              </div>

              {gaps.length > 0 && !done ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-[14px] text-text-2 leading-snug">
                    Missing {gaps.map(g => g.label).join(' and ')}.
                  </p>
                  <Button compact onClick={() => setCompleting({ event, reservation })}>
                    Complete the look
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const gaps = completing ? gapsFor(completing.reservation) : [];

  return (
    <div className="space-y-6">
      <Masthead
        title="Events"
        meta={`${upcoming.length} coming up`}
        action={
          <Button tone="primary" compact icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
            Add
          </Button>
        }
      />
      <EventComposer open={adding} onClose={() => setAdding(false)} onCreate={create} />

      {upcoming.length > 0 ? upcoming.map(e => renderEvent(e, false)) : (
        <Card>
          <p className="type-editorial text-[20px] leading-snug text-balance">
            Nothing coming up. The past ones are below, with what was worn.
          </p>
        </Card>
      )}

      {past.length > 0 ? (
        <>
          <p className="type-ledger text-[11px] text-text-2">Already happened</p>
          {past.map(e => renderEvent(e, true))}
        </>
      ) : null}

      <Modal
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title={`Complete ${completing?.reservation.label ?? 'the look'}`}
        wide
      >
        <p className="text-[14px] text-text-2 leading-relaxed">
          From what is already in the closet, most-worn first. Nothing here is for sale, and nothing
          is a recommendation to buy — if the gap is real, the wishlist is where it waits.
        </p>
        {gaps.map(gap => (
          <div key={gap.category} className="mt-5">
            <SectionTitle aside={`${gap.options.length} to choose from`}>
              {categoryLabel(settings, gap.category)}
            </SectionTitle>
            {gap.options.length === 0 ? (
              <p className="text-[14px] text-text-2">
                Nothing in this category yet.{' '}
                <Link to="/wishlist" className="text-accent underline underline-offset-[3px]">
                  Put it on the wishlist
                </Link>{' '}
                and let the wait do its work.
              </p>
            ) : (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {gap.options.map(option => (
                  <li key={option.id}>
                    <button
                      type="button"
                      className="block w-full text-left group"
                      onClick={() => {
                        if (!completing) return;
                        addPiece(completing.event, completing.reservation, option.id);
                        setCompleting(null);
                      }}
                    >
                      <Thumb item={option} className="w-full aspect-[4/5]" />
                      <p className="text-[13px] text-text mt-1.5 leading-tight line-clamp-2 group-hover:underline underline-offset-[3px]">
                        {option.name}
                      </p>
                      <p className="type-ledger text-[11px] text-text-2 tabular mt-0.5">
                        {option.wearCount} wears
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <Basting className="my-4" />
        <p className="type-ledger text-[11px] text-text-2">
          Outfits saved: {outfits.length} · pieces in the closet: {activeItems.length}
        </p>
      </Modal>
    </div>
  );
}
