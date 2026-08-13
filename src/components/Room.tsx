import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { drawRoom } from '../lib/roomArt';

/**
 * The room, and the things in it you can walk to.
 *
 * Two layers. The drawing is one memoised string of SVG that React never diffs
 * and a screen reader never sees. Over it, ordinary HTML links positioned in
 * percentages of the plate — links rather than <rect onClick>, because a rect
 * is not focusable, carries no href, and cannot be opened in a new tab; and
 * percentages rather than pixels, because a one-pixel drift between measuring
 * and painting must not desynchronise the targets from the picture.
 */
export function Room({ active }: { active?: string | null }) {
  const { furniture, activeItems } = useWardrobe();
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(356);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0;
      // Quantised to eight, so a scrollbar appearing does not rebuild the room
      // on every frame of a resize — and quantised DOWN, never to nearest.
      // Rounding up makes the viewBox wider than the element it is stretched
      // into, which scales every unit below one; the door is exactly 44 units
      // wide, so a single rounded pixel took the only fixed target in the
      // drawing under the 44px floor.
      if (next > 0) setWidth(Math.max(240, Math.floor(next / 8) * 8));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

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

  const room = useMemo(
    () => drawRoom(furniture, counts, width, loose),
    [furniture, counts, width, loose],
  );

  return (
    <div ref={hostRef} className="relative w-full text-text select-none">
      <svg
        viewBox={`0 0 ${room.w} ${room.h}`}
        className="w-full h-auto block"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: room.svg }}
      />

      {room.bays.map(bay => {
        const to = bay.id ? `/furniture/${bay.id}` : '#everything';
        const inside = bay.count === 1 ? '1 piece' : `${bay.count} pieces`;
        return (
          <Link
            key={bay.id || 'rail'}
            to={to}
            data-selected={active && bay.id === active ? 'true' : undefined}
            className="absolute registered rounded-[2px] focus-visible:outline-2"
            style={{
              left: `${bay.left}%`, width: `${bay.width}%`,
              top: `${bay.top}%`, height: `${bay.height}%`,
            }}
          >
            <span className="sr-only">
              {bay.name} — {inside}
              {bay.packed ? ', packed away' : ''}
            </span>
          </Link>
        );
      })}

      {/* The door. Always there, because you walked in through it. */}
      <Link
        to="/furniture"
        className="absolute registered rounded-[2px] focus-visible:outline-2"
        style={{
          left: `${room.door.left}%`, width: `${room.door.width}%`,
          top: `${room.door.top}%`, height: `${room.door.height}%`,
        }}
      >
        <span className="sr-only">
          {room.beyond > 0
            ? `Every place — ${room.beyond} more than the wall shows`
            : 'Every place'}
        </span>
      </Link>
    </div>
  );
}
