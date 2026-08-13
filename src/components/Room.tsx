import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { drawRoom } from '../lib/roomArt';
import { IconDown, IconUp } from './icons';
import { showToast } from './Toast';

/**
 * The dressing room, and the things in it you can walk to.
 *
 * Two layers. The drawing is one memoised string that React never diffs and a
 * screen reader never sees; over it, ordinary HTML links positioned in
 * percentages — links rather than <rect onClick> because a rect is not
 * focusable and carries no href, and percentages because a pixel of drift
 * between measuring and painting must not desynchronise the targets from the
 * picture. X against the width and Y against the HEIGHT: one divisor for two
 * axes was a real bug in the first version of this file, and it floated every
 * target up into the ceiling with three pixels of furniture inside it.
 */

const SHOW_KEY = 'toile-room';

function readShown(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function Room() {
  const { furniture, activeItems, advanceLaundry } = useWardrobe();
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(326);
  // Shown by default. Somebody who does not want it hides it once and it stays
  // hidden — a preference of this screen, so it lives beside the theme rather
  // than inside a wardrobe.
  const [shown, setShown] = useState(readShown);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shown || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0;
      // Quantised DOWN, never to nearest: rounding up makes the viewBox wider
      // than the element it is stretched into, which scales every unit below
      // one and takes fixed-size targets under the 44px floor.
      if (next > 0) setWidth(Math.max(260, Math.floor(next / 8) * 8));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [shown]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const item of activeItems) {
      if (!item.place) continue;
      tally[item.place.slotId] = (tally[item.place.slotId] ?? 0) + 1;
    }
    return tally;
  }, [activeItems]);

  const loose = useMemo(() => {
    const known = new Set(furniture.map(f => f.id));
    return activeItems.filter(i => !i.place || !known.has(i.place.furnitureId)).length;
  }, [furniture, activeItems]);

  /** Derived at render, never stored, and never a place. */
  const worn = useMemo(
    () => activeItems.filter(i => i.laundryStatus === 'worn').length,
    [activeItems],
  );

  const room = useMemo(
    () => drawRoom(furniture, counts, width, loose, worn),
    [furniture, counts, width, loose, worn],
  );

  const sendToWash = () => {
    const n = advanceLaundry('worn', 'washing');
    showToast(`In the wash. ${n} ${n === 1 ? 'piece' : 'pieces'}.`, 'info');
  };

  const toggle = () => {
    setShown(next => {
      const now = !next;
      try { localStorage.setItem(SHOW_KEY, now ? 'on' : 'off'); } catch { /* private mode */ }
      return now;
    });
  };

  return (
    <div className="bg-surface plate rounded-[2px] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="type-ledger text-[11px] text-text-2">
          {furniture.length === 0
            ? 'The room'
            : `${furniture.length} ${furniture.length === 1 ? 'place' : 'places'}`}
        </p>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={shown}
          className="type-ledger text-[10px] text-text-2 hover:text-text transition-colors min-h-11 inline-flex items-center gap-1.5 px-1"
        >
          {shown ? 'Hide the room' : 'Show the room'}
          {shown ? <IconUp size={14} /> : <IconDown size={14} />}
        </button>
      </div>

      {shown ? (
        <>
          <div ref={hostRef} className="relative w-full text-text select-none mt-2">
            <svg
              viewBox={`0 0 ${room.w} ${room.h}`}
              className="w-full h-auto block"
              aria-hidden="true"
              focusable="false"
              dangerouslySetInnerHTML={{ __html: room.svg }}
            />
            {room.chair ? (
              <button
                type="button"
                onClick={sendToWash}
                aria-label={`Send the ${room.chair.count} pieces on the chair to the wash`}
                className="absolute registered rounded-[2px] focus-visible:outline-2"
                style={{
                  left: `${room.chair.left}%`, width: `${room.chair.width}%`,
                  top: `${room.chair.top}%`, height: `${room.chair.height}%`,
                }}
              />
            ) : null}

            {room.bays.map(bay => (
              <Link
                key={bay.id || 'rail'}
                to={bay.id ? `/furniture/${bay.id}` : '/closet'}
                onClick={bay.id ? undefined : e => {
                  // The bare room's rail stands in for clothes with no address,
                  // and they are in the grid below. Nothing in this app scrolls
                  // to a hash, so it is done here rather than promised in an
                  // href that does nothing.
                  e.preventDefault();
                  document.getElementById('everything')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="absolute registered rounded-[2px] focus-visible:outline-2"
                style={{
                  left: `${bay.left}%`, width: `${bay.width}%`,
                  top: `${bay.top}%`, height: `${bay.height}%`,
                }}
              >
                <span className="sr-only">
                  {bay.name} — {bay.count === 1 ? '1 piece' : `${bay.count} pieces`}
                  {bay.packed ? ', packed away' : ''}
                </span>
              </Link>
            ))}
          </div>

          <p className="text-[13px] text-text-2 mt-3 leading-snug">
            {room.bare
              ? 'Everything hangs on the rail for now. '
              : `${room.bays.map(b => b.name).join(', ')}${room.beyond > 0 ? `, and ${room.beyond} more through the door` : ''}. `}
            <Link to="/furniture" className="text-accent underline underline-offset-[3px]">
              {room.bare ? 'Draw a place' : 'The dressing room'}
            </Link>
            {room.chair ? (
              <>
                {' · '}
                {room.chair.count} {room.chair.count === 1 ? 'piece is' : 'pieces are'} on the chair.{' '}
                <button
                  type="button"
                  onClick={sendToWash}
                  className="text-accent underline underline-offset-[3px]"
                >
                  Send them to the wash
                </button>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-text-2 mt-2 leading-snug">
          {furniture.length === 0
            ? 'Nothing has an address yet. '
            : `${furniture.length} ${furniture.length === 1 ? 'place' : 'places'}, and what is in them. `}
          <Link to="/furniture" className="text-accent underline underline-offset-[3px]">
            {furniture.length === 0 ? 'Draw a place' : 'The dressing room'}
          </Link>
          {/* Putting the wash away behind the drawing would mean hiding the
              room hides a function. The sentence carries it either way. */}
          {worn > 0 ? (
            <>
              {' · '}
              {worn} on the chair.{' '}
              <button
                type="button"
                onClick={sendToWash}
                className="text-accent underline underline-offset-[3px]"
              >
                Send to the wash
              </button>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
