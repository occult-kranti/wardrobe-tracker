import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import {
  EVENT_LABELS,
  categoryLabel,
  type ClothingItem,
  type EventKind,
  type EventReservation,
  type Outfit,
  type WardrobeEvent,
} from '@almari/shared/types';
import { addDays, daysSince, todayLocal } from '@almari/shared/dates';
import {
  Button, Card, Chip, EmptyState, Field, Masthead, Modal, SectionTitle, inputClass,
} from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
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
 *
 * Three things this page owes the person keeping it, added late and named here
 * so they are not quietly lost again:
 *
 *  · An event can be REMOVED. A mistyped name or a fat-fingered year used to be
 *    permanent — junk nobody could clean out of their own private ledger.
 *  · A day can hold a SAVED OUTFIT, not only loose pieces. The sample wardrobes
 *    always showed one; until now nothing in the app could write it, so the
 *    room demonstrated a feature a real wardrobe could not reach.
 *  · The dressing sheet STAYS OPEN across picks and reads live state, so three
 *    pieces cost three taps rather than six, a mis-pick can be taken out, and a
 *    fourth piece — a layer, jewellery — is not forbidden by a three-slot list.
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
        <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <GarmentPlate categoryId={item?.category ?? 'accessories'} color={item?.color} name={item?.name} />
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

function piecesPhrase(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}

/**
 * The date line. Its last branch used to read "· done" for anything that had
 * started, which called a three-day wedding finished on its second morning —
 * the wrong fact at the highest-stakes moment this page serves, and on an event
 * the page itself still keeps under "coming up". A span is done only once its
 * LAST day is behind us.
 */
function whenLine(event: WardrobeEvent): string {
  const today = todayLocal();
  const away = daysUntil(event.startDate);
  const last = event.endDate ?? event.startDate;
  const span = event.endDate && event.endDate !== event.startDate
    ? `${shortDate(event.startDate)} – ${shortDate(event.endDate)}`
    : shortDate(event.startDate);
  if (away > 1) return `${span} · in ${away} days`;
  if (away === 1) return `${span} · tomorrow`;
  if (away === 0) return `${span} · today`;
  if (last > today) return `${span} · on now`;
  if (last === today) return `${span} · last day`;
  return `${span} · done`;
}

export default function Events() {
  const {
    events, outfits, activeItems, getItem, getOutfit, settings,
    updateEvent, addEvent, removeEvent,
  } = useWardrobe();
  /**
   * The open sheets hold IDS, not a snapshot of the reservation. The snapshot
   * is what forced the sheet shut after every single pick: the captured object
   * went stale the moment a piece was written, so the gaps it drew were a lie
   * one tap old. Reading the live event back out of state lets the sheet stay
   * open and simply redraw.
   */
  const [completing, setCompleting] = useState<{ eventId: string; reservationId: string } | null>(null);
  const [holding, setHolding] = useState<{ eventId: string; reservationId: string } | null>(null);
  const [removing, setRemoving] = useState<WardrobeEvent | null>(null);
  const [adding, setAdding] = useState(false);

  const today = todayLocal();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return {
      upcoming: sorted.filter(e => (e.endDate ?? e.startDate) >= today),
      past: sorted.filter(e => (e.endDate ?? e.startDate) < today).reverse(),
    };
  }, [events, today]);

  /** Favourites first, then whatever has waited longest — the order the
      Calendar's scheduling sheet uses, so the two lists read alike. */
  const outfitOrder = useMemo(
    () =>
      [...outfits].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return (a.lastWorn ?? '').localeCompare(b.lastWorn ?? '');
      }),
    [outfits]
  );

  /** Most-worn first: what you actually reach for is the best suggestion this
      app can make, and it is one you already own. */
  const optionsFor = (category: string, reservation: EventReservation) =>
    activeItems
      .filter(i => i.category === category && !reservation.itemIds.includes(i.id))
      .sort((a, b) => b.wearCount - a.wearCount)
      .slice(0, 8);

  /** What a reservation is missing, and what in the closet could fill it. */
  const gapsFor = (reservation: EventReservation) => {
    const pieces = reservation.itemIds.map(id => getItem(id)).filter((i): i is ClothingItem => !!i);
    const held = new Set(pieces.map(p => p.category));
    return EXPECTED
      .filter(slot => !held.has(slot.category))
      .filter(slot => !slot.unless?.some(c => held.has(c)))
      .map(slot => ({ ...slot, options: optionsFor(slot.category, reservation) }));
  };

  /**
   * Everything the sheet offers: the gaps first, then every other category with
   * something in it. A look is not only a top, a bottom and shoes — the old
   * sheet said it was, and a day holding all three had no way to take a jacket
   * or a pair of earrings.
   */
  const slotsFor = (reservation: EventReservation) => {
    const gaps = gapsFor(reservation);
    const covered = new Set(gaps.map(g => g.category));
    return [
      ...gaps.map(g => ({
        category: g.category,
        title: categoryLabel(settings, g.category),
        options: g.options,
      })),
      ...settings.categories
        .filter(c => !covered.has(c.id))
        .map(c => ({ category: c.id, title: c.label, options: optionsFor(c.id, reservation) }))
        .filter(slot => slot.options.length > 0),
    ];
  };

  const create = (event: Omit<WardrobeEvent, 'id'>) => {
    addEvent(event);
    showToast(`Held. ${event.name} is on the page.`, 'info');
  };

  /** A whole event off the page, with the offer to put it straight back — the
      pattern the dressing room already uses for removing a place. */
  const remove = (event: WardrobeEvent) => {
    removeEvent(event.id);
    showToast(`Removed. ${event.name} is off the page.`, 'info', {
      label: 'Undo',
      run: () =>
        addEvent({
          name: event.name,
          kind: event.kind,
          startDate: event.startDate,
          endDate: event.endDate,
          place: event.place,
          notes: event.notes,
          reservations: event.reservations,
        }),
    });
  };

  const setReservation = (
    event: WardrobeEvent,
    reservation: EventReservation,
    updates: Partial<EventReservation>,
  ) => {
    updateEvent(event.id, {
      reservations: event.reservations.map(r =>
        r.id === reservation.id ? { ...r, ...updates } : r
      ),
    });
  };

  const addPiece = (event: WardrobeEvent, reservation: EventReservation, itemId: string) => {
    setReservation(event, reservation, { itemIds: [...reservation.itemIds, itemId] });
  };

  const takeOut = (event: WardrobeEvent, reservation: EventReservation, itemId: string) => {
    setReservation(event, reservation, { itemIds: reservation.itemIds.filter(id => id !== itemId) });
  };

  /**
   * Hold a saved outfit against a day. The look's pieces come with it, and a
   * previously held look's pieces go — swapping outfits should not leave last
   * night's shoes standing on the day. Loose pieces held alongside stay put.
   *
   * Reserving still moves no wear count (toile-social rule 10).
   */
  const holdOutfit = (event: WardrobeEvent, reservation: EventReservation, outfit: Outfit) => {
    const previous = reservation.outfitId ? getOutfit(reservation.outfitId) : undefined;
    const kept = reservation.itemIds.filter(id => !(previous?.itemIds ?? []).includes(id));
    setReservation(event, reservation, {
      outfitId: outfit.id,
      itemIds: Array.from(new Set([...kept, ...outfit.itemIds])),
    });
    setHolding(null);
    showToast(`Held. "${outfit.name}" is down for ${shortDate(reservation.date)}.`, 'info');
  };

  const dropOutfit = (event: WardrobeEvent, reservation: EventReservation) => {
    const previous = reservation.outfitId ? getOutfit(reservation.outfitId) : undefined;
    setReservation(event, reservation, {
      outfitId: undefined,
      itemIds: reservation.itemIds.filter(id => !(previous?.itemIds ?? []).includes(id)),
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
    // Never opacity on the plate: it multiplies every child against the page
    // ground, and in the gilding room it pushed text-2 to ~3.9:1. The date line
    // already says '· done'.
    <Card key={event.id}>
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
                    <img src={outfit.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </span>
                ) : null}
                {pieces.slice(0, 8).map(piece => (
                  <Thumb key={piece.id} item={piece} className="w-12 h-15" />
                ))}
              </div>

              {!done ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {gaps.length > 0 ? (
                    <p className="text-[14px] text-text-2 leading-snug">
                      Missing {gaps.map(g => g.label).join(' and ')}.
                    </p>
                  ) : null}
                  <Button
                    compact
                    onClick={() => setCompleting({ eventId: event.id, reservationId: reservation.id })}
                  >
                    {gaps.length > 0 ? 'Complete the look' : 'Change the pieces'}
                  </Button>
                  {outfits.length > 0 ? (
                    <Button
                      compact
                      tone="tertiary"
                      onClick={() => setHolding({ eventId: event.id, reservationId: reservation.id })}
                    >
                      {reservation.outfitId ? 'Change the outfit' : 'Hold an outfit'}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Quiet, at the foot of the card, and gated. An event nobody can remove
          is junk sitting in somebody's private ledger for good. */}
      <div className="mt-5 pt-4 border-t border-border flex justify-end">
        <Button compact aria-label={`Remove ${event.name}`} onClick={() => setRemoving(event)}>
          Remove this event
        </Button>
      </div>
    </Card>
  );

  /* The sheets read the live event out of state on every render — see the note
     on `completing`. If an event is removed while one is open, the handle
     resolves to nothing and the sheet simply has no contents. */
  const resolve = (handle: { eventId: string; reservationId: string } | null) => {
    if (!handle) return null;
    const event = events.find(e => e.id === handle.eventId);
    const reservation = event?.reservations.find(r => r.id === handle.reservationId);
    return event && reservation ? { event, reservation } : null;
  };

  const dressing = resolve(completing);
  const dressingHeld = dressing
    ? dressing.reservation.itemIds.map(id => getItem(id)).filter((i): i is ClothingItem => !!i)
    : [];
  const dressingOutfit = dressing?.reservation.outfitId
    ? getOutfit(dressing.reservation.outfitId)
    : undefined;
  const dressingSlots = dressing ? slotsFor(dressing.reservation) : [];
  const outfitting = resolve(holding);

  return (
    <div className="space-y-6">
      <Masthead
        title="Events"
        meta={`${upcoming.length} coming up`}
        action={
          <Button tone="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
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

      {/* ---------- dressing a day ---------- */}
      <Modal
        open={dressing !== null}
        onClose={() => setCompleting(null)}
        title={
          dressing
            ? `${dressing.reservation.label ?? 'Held'} — ${shortDate(dressing.reservation.date)}`
            : ''
        }
        wide
      >
        {dressing ? (
          <div>
            <p className="text-[14px] text-text-2 leading-relaxed">
              From what is already in the closet, most-worn first. Tap as many as the day needs — the
              sheet stays open. Nothing here is for sale, and nothing is a recommendation to buy — if
              the gap is real, the wishlist is where it waits.
            </p>

            <div className="mt-5">
              <SectionTitle aside={piecesPhrase(dressingHeld.length)}>Held for this day</SectionTitle>
              {dressingOutfit ? (
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <p className="text-[14px] text-text">
                    The outfit <span className="text-text-2">{dressingOutfit.name}</span> is down for
                    this day.
                  </p>
                  <Button
                    compact
                    tone="tertiary"
                    onClick={() => dropOutfit(dressing.event, dressing.reservation)}
                  >
                    Take the outfit out
                  </Button>
                </div>
              ) : null}
              {dressingHeld.length === 0 ? (
                <p className="text-[14px] text-text-2">Nothing held yet. Pick below.</p>
              ) : (
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {dressingHeld.map(piece => (
                    <li key={piece.id}>
                      <Thumb item={piece} className="w-full aspect-[4/5]" />
                      <p className="text-[13px] text-text mt-1.5 leading-tight line-clamp-2">
                        {piece.name}
                      </p>
                      <button
                        type="button"
                        aria-label={`Take ${piece.name} off this day`}
                        onClick={() => takeOut(dressing.event, dressing.reservation, piece.id)}
                        className="type-label text-[13px] text-text-2 hover:text-text transition-colors duration-150 h-11 px-1 -ml-1 text-left"
                      >
                        Take out
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {dressingSlots.map(slot => (
              <div key={slot.category} className="mt-5">
                <SectionTitle aside={`${slot.options.length} to choose from`}>
                  {slot.title}
                </SectionTitle>
                {slot.options.length === 0 ? (
                  <p className="text-[14px] text-text-2">
                    Nothing in this category yet.{' '}
                    <Link to="/wishlist" className="text-accent underline underline-offset-[3px]">
                      Put it on the wishlist
                    </Link>{' '}
                    and let the wait do its work.
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {slot.options.map(option => (
                      <li key={option.id}>
                        <button
                          type="button"
                          className="block w-full text-left group"
                          onClick={() => addPiece(dressing.event, dressing.reservation, option.id)}
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
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setCompleting(null)}>Done</Button>
              <p className="type-ledger text-[11px] text-text-2">
                Outfits saved: {outfits.length} · pieces in the closet: {activeItems.length}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ---------- holding a saved outfit ---------- */}
      <Modal
        open={outfitting !== null}
        onClose={() => setHolding(null)}
        title={outfitting ? `Hold an outfit — ${shortDate(outfitting.reservation.date)}` : ''}
      >
        {outfitting ? (
          <div>
            <p className="text-[14px] text-text-2 leading-snug">
              Holding is not wearing. Nothing is counted until the day comes and gets logged.
            </p>

            <Basting className="my-5" />

            <ul className="space-y-1 -mx-2 max-h-[46vh] pane">
              {outfitOrder.map(outfit => {
                const members = outfit.itemIds
                  .map(id => getItem(id))
                  .filter((i): i is ClothingItem => !!i);
                return (
                  <li key={outfit.id}>
                    <button
                      type="button"
                      onClick={() => holdOutfit(outfitting.event, outfitting.reservation, outfit)}
                      className="w-full min-h-[56px] flex items-center gap-3 px-2 py-2 text-left rounded-[2px] hover:bg-sunken transition-colors duration-150"
                    >
                      <span className="flex gap-1 shrink-0">
                        {members.slice(0, 3).map(item => (
                          <Thumb key={item.id} item={item} className="w-8 h-10" />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-text truncate">{outfit.name}</span>
                        <span className="type-ledger text-[10px] text-text-2 block mt-0.5 tabular">
                          {piecesPhrase(outfit.itemIds.length)}
                          {' · '}
                          {outfit.lastWorn ? `Last worn ${shortDate(outfit.lastWorn)}` : 'Not worn yet'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Modal>

      {/* The gate. What is lost is stated from the code's own truth: removeEvent
          touches nothing but the event, and a held day never moved a count. */}
      <ConfirmDialog
        open={removing !== null}
        title="Remove this event"
        danger
        body={
          removing
            ? `This takes "${removing.name}" off the page, with the ${removing.reservations.length} ${
                removing.reservations.length === 1 ? 'day' : 'days'
              } held against it. No clothes are touched and no count moves — a held day was never a wear. Undo is offered for a moment after; once the notice fades, the event is gone for good.`
            : ''
        }
        confirmLabel="Remove it"
        cancelLabel="Keep it"
        onConfirm={() => {
          if (removing) remove(removing);
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
