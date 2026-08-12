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

/**
 * Delegated specular lighting — the consultant's spec: ONE document listener
 * moves the light across every plate, instead of a listener per card. Plate
 * rects are cached and rebuilt when the page settles after scroll, resize,
 * route change, or DOM mutation; between rebuilds the sheen is positioned
 * from the cached box. Fine pointers only; reduced motion leaves the glass
 * unlit. Also drives the wall parallax: --drift-x/y on the root, consumed by
 * .v2-drift around the artwork.
 */
export function initGlassLight() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let plates: Array<{ el: HTMLElement; r: DOMRect }> = [];
  let lit = new Set<HTMLElement>();
  let rebuildTimer = 0;

  const rebuild = () => {
    plates = [...document.querySelectorAll<HTMLElement>('.plate, .plate-ink')].map(el => ({
      el,
      r: el.getBoundingClientRect(),
    }));
  };
  const queueRebuild = () => {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(rebuild, 160);
  };

  let raf = 0;
  const onMove = (e: PointerEvent) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const next = new Set<HTMLElement>();
      for (const { el, r } of plates) {
        if (
          e.clientX >= r.left - 40 &&
          e.clientX <= r.right + 40 &&
          e.clientY >= r.top - 40 &&
          e.clientY <= r.bottom + 40
        ) {
          el.style.setProperty('--sheen-x', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
          el.style.setProperty('--sheen-y', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
          el.style.setProperty('--sheen-o', '1');
          next.add(el);
        }
      }
      for (const el of lit) if (!next.has(el)) el.style.setProperty('--sheen-o', '0');
      lit = next;
      // The wall breathes against the pointer — a few pixels, opposite hand.
      const root = document.documentElement.style;
      root.setProperty('--drift-x', `${((e.clientX / window.innerWidth - 0.5) * -10).toFixed(2)}px`);
      root.setProperty('--drift-y', `${((e.clientY / window.innerHeight - 0.5) * -6).toFixed(2)}px`);
    });
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', queueRebuild, { passive: true, capture: true });
  window.addEventListener('resize', queueRebuild);
  window.addEventListener('hashchange', queueRebuild);
  new MutationObserver(queueRebuild).observe(document.body, { childList: true, subtree: true });
  rebuild();
}

/**
 * The capability gate: weak or data-saving devices get the solid house, not a
 * degraded glass one. deviceMemory and Save-Data decide immediately; otherwise
 * a twenty-frame probe measures whether this device can afford backdrop blur,
 * and data-glass="off" collapses the material in CSS if it cannot.
 */
export function gateGlass() {
  type NetNav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const nav = navigator as NetNav;
  if ((nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || nav.connection?.saveData) {
    document.documentElement.dataset.glass = 'off';
    return;
  }
  let last = performance.now();
  let frames = 0;
  let total = 0;
  const probe = (t: number) => {
    total += t - last;
    last = t;
    if (++frames < 20) requestAnimationFrame(probe);
    else if (total / frames > 26) document.documentElement.dataset.glass = 'off';
  };
  requestAnimationFrame(probe);
}
