import { useEffect, useRef, type ReactNode } from 'react';
import { createSpring, SPRINGS } from '../lib/springs';

/**
 * V2's material behaviours. Two primitives:
 *
 * Tilt — the card leans toward the pointer, spring-smoothed, max 4 degrees at
 * perspective 1000px, with a specular sheen (a radial highlight) tracking the
 * cursor across the glass. Desktop fine-pointers only; on touch, glass lies
 * flat. Under reduced motion nothing moves at all.
 *
 * The transform writes to CSS custom properties consumed by v2.css, so the
 * styling stays in the stylesheet and this component stays a physics driver.
 */
export function Tilt({
  children,
  className = '',
  max = 4,
}: {
  children: ReactNode;
  className?: string;
  /** Max lean in degrees. 0 = sheen only — REQUIRED for glass surfaces:
      transforming a backdrop-filtered plate re-samples its backdrop every
      frame, the single most expensive ask on a mid phone. Glass doesn't
      bend; light moves across it instead. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const [setRX, disposeRX] = createSpring(0, SPRINGS.tilt, v =>
      el.style.setProperty('--tilt-x', `${v.toFixed(3)}deg`)
    );
    const [setRY, disposeRY] = createSpring(0, SPRINGS.tilt, v =>
      el.style.setProperty('--tilt-y', `${v.toFixed(3)}deg`)
    );

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      // Lean toward the pointer: top edge back when the cursor is high.
      setRX((0.5 - py) * max * 2);
      setRY((px - 0.5) * max * 2);
      // The sheen is not sprung — light moves at the speed of light.
      el.style.setProperty('--sheen-x', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--sheen-y', `${(py * 100).toFixed(1)}%`);
      el.style.setProperty('--sheen-o', '1');
    };
    const leave = () => {
      setRX(0);
      setRY(0);
      el.style.setProperty('--sheen-o', '0');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      disposeRX();
      disposeRY();
    };
  }, [max]);

  return (
    <div ref={ref} className={`v2-tilt ${className}`}>
      {children}
    </div>
  );
}

/** Depth-staggered entrance for lists: each child rises into place. */
export function Rise({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`v2-rise ${className}`}>{children}</div>;
}
