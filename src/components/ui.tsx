import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconClose, IconEyelet, IconEyeletFilled } from './icons';
import { tick, thock } from '../lib/sound';

/**
 * TOILE primitives. Component law: docs/05-brand-identity.md §7.
 * Radius 2 everywhere, no drop shadows, exactly one primary button per view.
 */

type ButtonTone = 'primary' | 'hero' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  compact?: boolean;
  icon?: ReactNode;
}

const toneClasses: Record<ButtonTone, string> = {
  // Ink fill / cream label; inverts to chalk-on-ink in dark. Hover slides a 2px
  // accent rule in under the label (contract §7) — the shipped version faded the
  // whole button to 90% opacity instead, which is the gesture for *disabled*.
  primary: 'bg-ink text-on-ink btn-underline btn-weave',
  // The reserved accent fill — log-wear actions only. Hover slides the same
  // 2px rule as primary, stated in on-accent; brightness-110 was outside the
  // motion vocabulary and dropped the label from 6.98:1 toward 6.0.
  hero: 'bg-accent-fill text-on-accent btn-underline btn-weave [--btn-underline-color:var(--color-on-accent)] [--btn-weave-color:var(--color-on-accent)]',
  // §7: "hover gains corner crosses" — `.registered` is that exact motif, and it
  // was already in the stylesheet, used on cards but never on the button it was
  // written for.
  secondary: 'border border-text text-text hover:bg-sunken registered',
  tertiary: 'text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 px-1',
  // --color-danger is a TEXT token (light pink in dark mode); filling with it put
  // a chalk label at roughly 2:1 on the one button that wipes everything.
  destructive: 'bg-danger-fill text-chalk hover:opacity-90',
};

/** The button's whole appearance, so an anchor can wear it without being one. */
export function buttonClass(tone: ButtonTone = 'secondary', compact = false, extra = ''): string {
  // 44px is the floor, not 40 — the accessibility directive outranks the
  // original 40px figure in the component law, so "compact" only narrows the
  // padding, never the hit area.
  const height = compact ? 'h-11 px-3 [--btn-underline-inset:8px]' : 'h-11 px-5';
  const base = tone === 'tertiary' ? 'min-h-11 py-1' : height;
  return `type-label whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-[2px] transition-[opacity,filter,background-color] duration-150 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none ${base} ${toneClasses[tone]} ${extra}`;
}

export function Button({ tone = 'secondary', compact, icon, children, className = '', onPointerDown, ...rest }: ButtonProps) {
  return (
    <button
      className={buttonClass(tone, compact, className)}
      // V2: controls carry mass, and mass makes a sound. The tick fires on
      // press, not click, so the ear and the finger agree on the moment.
      onPointerDown={e => {
        tick();
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * A link that looks like a button.
 *
 * Five places wrote `<Link><Button/></Link>`, which nests interactive content
 * inside interactive content: invalid HTML, two tab stops for one action, and
 * assistive technology left to guess which of the two it should announce.
 */
export function LinkButton({
  to,
  tone = 'secondary',
  compact,
  icon,
  children,
  className = '',
}: {
  to: string;
  tone?: ButtonTone;
  compact?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={buttonClass(tone, compact, `${tone === 'tertiary' ? '' : 'no-underline'} ${className}`)}>
      {icon}
      {children}
    </Link>
  );
}

/** Icon-only button — always 44px of hit area, whatever the glyph size. */
export function IconButton({
  label,
  children,
  active,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`w-11 h-11 inline-flex items-center justify-center rounded-[2px] transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none ${
        active ? 'bg-ink text-on-ink' : 'text-text-2 hover:text-text hover:bg-sunken'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Tag chip: the brand's atom — a garment tag with a punched eyelet. */
export function Chip({
  children,
  selected,
  onClick,
  as = 'button',
  title,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  as?: 'button' | 'span';
  title?: string;
}) {
  // Display tags keep the compact 32px tag look; anything tappable is held to
  // the 44px floor, because the accessibility directive governs interactive
  // elements and a filter row is the most-tapped surface in the app.
  const height = as === 'span' ? 'h-8' : 'h-11';
  const cls = `type-ledger inline-flex items-center gap-1.5 ${height} pl-2 pr-3 text-[11px] rounded-[2px] border transition-colors duration-150 whitespace-nowrap ${
    selected
      ? 'bg-ink text-on-ink border-transparent'
      : 'bg-sunken text-text-2 border-border hover:text-text'
  }`;
  // The selected chip fills with ink, so its eyelet must be stated against ink.
  // It was set to `text-accent` — the accent as read on PAPER — which measured
  // 2.66:1 in the pattern room, 2.72:1 in the atelier and 2.11:1 in the salon,
  // all under the 3:1 that WCAG 1.4.11 asks of a graphic. On the atom this app
  // repeats more than any other.
  const inner = (
    <>
      <span className={selected ? 'text-accent-on-ink' : 'opacity-60'}>
        {selected ? <IconEyeletFilled size={10} /> : <IconEyelet size={10} />}
      </span>
      {children}
    </>
  );
  if (as === 'span') return <span className={cls} title={title}>{inner}</span>;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cls} title={title}>
      {inner}
    </button>
  );
}

/**
 * A tag rail: one line of chips that runs off the edge of the page.
 *
 * It replaces `flex gap-2 overflow-x-auto pb-1 -mb-1`, which was wrong twice
 * over. Tailwind v4 emits `space-y-5` as
 * `:where(.space-y-5 > :not(:last-child)) { margin-block-end: 20px }` — a
 * ZERO-specificity selector — so the `-mb-1` utility beside it did not trim
 * that gap, it REPLACED it. Measured in the browser, the closet's second filter
 * row began at y=219 while the first ended at y=223: the rows overlapped by
 * 4px. On any platform whose scrollbars are classic rather than overlay, the
 * 15px OS scrollbar was then drawn inside that overlap, landing on top of the
 * row below — which is exactly what the bug report showed.
 *
 * So a rail owns its own scrollbar (none — a grey OS widget with arrow buttons
 * is a foreign object in a letterpress interface; shift-wheel, drag and Tab all
 * still work) and its own edges, and never negotiates margins with a sibling.
 * A rail with more to show fades at that edge instead of guillotining a chip
 * mid-word, which is the honest signal that the row continues.
 */
function useRailEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<'none' | 'start' | 'end' | 'both'>('none');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const slack = el.scrollWidth - el.clientWidth;
      if (slack <= 1) return setEdge('none');
      const atStart = el.scrollLeft <= 1;
      const atEnd = el.scrollLeft >= slack - 1;
      setEdge(atStart ? 'end' : atEnd ? 'start' : 'both');
    };
    // The chips arrive with the data, the rail sits in a resizable column, and
    // the display face loads after first paint — so neither the content width
    // nor the container width is settled at mount. Watch the rail and each chip
    // for resize, and re-attach when the set of chips changes.
    //
    // Keyed on nothing: `children` is a fresh object on every render, so a
    // dependency on it would tear this whole apparatus down and rebuild it on
    // each keystroke typed into the search field above.
    const ro = new ResizeObserver(read);
    const attach = () => {
      ro.disconnect();
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
      read();
    };
    attach();
    el.addEventListener('scroll', read, { passive: true });
    const mo = new MutationObserver(attach);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return { ref, edge } as const;
}

export function TagRail({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const { ref, edge } = useRailEdges();
  return (
    <div ref={ref} data-edge={edge} role="group" aria-label={label} className={`rail tag-rail ${className}`}>
      {children}
    </div>
  );
}

/**
 * The same rail, around something that is not a row of chips — a ledger table
 * too wide for a phone. Scrollable regions containing focusable content need to
 * be reachable by keyboard, hence `tabIndex={0}` and the region role; a table
 * you can only pan with a finger is a table half the app cannot read.
 */
export function TableRail({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const { ref, edge } = useRailEdges();
  return (
    <div
      ref={ref}
      data-edge={edge}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`rail ${className}`}
    >
      {children}
    </div>
  );
}

/** Card: muslin plate with a letterpress edge. Never a drop shadow. */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  // V2: every plate is glass and carries its sheen natively — the light is
  // positioned by ONE delegated document listener (initGlassLight), so the
  // card needs no wrapper and no listener of its own. Glass doesn't bend
  // (transforming a backdrop-filter re-samples its backdrop every frame);
  // rotation is reserved for opaque tiles.
  return (
    <div className={`bg-surface plate rounded-[2px] ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

/** Page masthead: display title over a double rule, ledger metadata at right. */
export function Masthead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {/* The row wraps and the right block may shrink: on a narrow phone the
          action drops below the title instead of pushing past the viewport
          edge. Wrap only engages when space runs out, so wider layouts are
          untouched. */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2 rule-double">
        <h1 className="type-masthead text-[28px] sm:text-[34px]">{title}</h1>
        <div className="flex items-center gap-3 pb-1 min-w-0">
          {meta ? <span className="type-ledger text-[11px] text-text-2 whitespace-nowrap">{meta}</span> : null}
          {action}
        </div>
      </div>
    </header>
  );
}

/** Section heading inside a card — small caps over a hairline. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <h2 className="type-label text-text">{children}</h2>
      {aside ? <span className="type-ledger text-[11px] text-text-2">{aside}</span> : null}
    </div>
  );
}

/** Ledger-style field: no box, a rule under the input. */
export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="type-ledger text-[11px] text-text-2 block">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] text-text-2 leading-snug">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'w-full min-h-11 bg-transparent border-0 border-b border-border rounded-none px-0 py-2 text-[15px] text-text placeholder:text-text-2 focus:outline-none focus:border-b-2 focus:border-accent transition-[border] duration-150';

export const selectClass = `${inputClass} appearance-none cursor-pointer`;

/** Modal: a paper sheet with a plate edge. Focus is trapped; Escape closes. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    )?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !sheet) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    // The sheet lands with a low thock — E3 glass has weight.
    thock();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto animate-fade"
      style={{ background: 'rgba(32, 29, 24, 0.4)' }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface plate-ink rounded-[2px] w-full my-auto ${wide ? 'max-w-2xl' : 'max-w-[480px]'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-2 mx-5 -mt-0 rule-double">
          <h2 className="type-masthead text-[22px]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-3 inline-flex items-center justify-center text-text-2 hover:text-text"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="p-5 pt-6">{children}</div>
      </div>
    </div>
  );
}

/** A stat set like a ledger entry: display numeral over a mono label. */
export function Stat({
  value,
  label,
  tone = 'ink',
}: {
  value: ReactNode;
  label: string;
  tone?: 'ink' | 'accent' | 'success';
}) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'success' ? 'text-success' : 'text-text';
  return (
    <div>
      <p className={`type-masthead text-[32px] leading-none tabular ${color}`}>{value}</p>
      <p className="type-ledger text-[11px] text-text-2 mt-2">{label}</p>
    </div>
  );
}

/** Empty state: a drawn plate, an editorial caption, and at most one action. */
export function EmptyState({
  plate,
  title,
  body,
  action,
}: {
  plate: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      {plate}
      <p className="type-editorial text-[20px] mt-6">{title}</p>
      {body ? <p className="text-[14px] text-text-2 mt-2 max-w-sm leading-relaxed">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
