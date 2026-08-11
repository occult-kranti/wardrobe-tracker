/**
 * TOILE artwork — all hand-coded SVG, no rasters, no external assets.
 * Art direction: docs/05-brand-identity.md §6 and docs/06-focus-group-requirements.md §2.
 * Never draw a body. Garments are technical flats.
 *
 * This file contains no hex at all — it paints in tokens, which is why the
 * 2026-08-11 brand split had to be made explicitly here. The seal and the
 * wordmark underline were drawn in `--color-accent`, so moving the interface to
 * washing blue would have turned the wax seal blue SILENTLY, with nothing in the
 * build to say so. They now name `--color-seal`, which is what they always meant.
 */

/* ---------------- logo & seal ---------------- */

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span
        className="type-masthead leading-none"
        style={{ fontWeight: 700, letterSpacing: '0.18em', fontSize: '1.05em' }}
      >
        TOILE
      </span>
      {/* hand-wavered chalk underline */}
      <svg viewBox="0 0 64 5" className="w-full mt-[3px]" style={{ height: 4 }} aria-hidden="true">
        <path
          d="M1 3.2C10 1.6 20 3.8 32 2.6s22 1.4 31-.4"
          fill="none"
          stroke="var(--color-seal)"
          strokeWidth="1.6"
          strokeLinecap="butt"
        />
      </svg>
    </span>
  );
}

/** The monogram: a garment tag with an eyelet, string, and a display "T". */
export function TagMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size * 0.75} height={size} viewBox="0 0 48 64" fill="none" aria-hidden="true">
      <path
        d="M12 2h24a2 2 0 012 2v56a2 2 0 01-2 2H12a2 2 0 01-2-2V12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      <path d="M10 12L20 2" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M24 15C24 9 20 7 16 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <text
        x="24"
        y="46"
        textAnchor="middle"
        fill="currentColor"
        style={{ font: '700 22px var(--font-display)' }}
      >
        T
      </text>
    </svg>
  );
}

/** Wax seal, pressed slightly crooked on purpose. Wax, therefore `--color-seal`. */
export function WaxSeal({ size = 44, label = 'T' }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      style={{ transform: 'rotate(-3deg)' }}
    >
      <circle cx="22" cy="22" r="20" fill="var(--color-seal)" />
      <circle cx="22" cy="22" r="16.5" stroke="var(--color-chalk)" strokeWidth="0.75" opacity="0.6" />
      <text
        x="22"
        y="30"
        textAnchor="middle"
        fill="var(--color-chalk)"
        style={{ font: '700 20px var(--font-display)', letterSpacing: '0.05em' }}
      >
        {label}
      </text>
    </svg>
  );
}


/* ---------------- the ground frieze ---------------- */

import { FRIEZE_PIECES } from '../lib/friezeArt';

/**
 * Seven cultures of keeping clothes, standing in a row behind the page — and
 * over each piece, the open wardrobe's own name written in that culture's
 * language: Meher's wardrobe, L'armoire de Meher, Meher की अलमारी, Meherの箪笥,
 * صندوق Meher, Meher的衣柜, Meher의 반닫이.
 *
 * A live component rather than CSS background, because the NAME is in the art.
 * Stroked entirely in var(--color-artline), so each room recolours the whole
 * frieze through one token: gold ochre in the pattern room, antique brass in
 * the salon, the leaf in the gilding room, SILVER in the atelier at night,
 * bronze in the dye house. Fixed to the viewport bottom, aria-hidden, behind
 * the content (which sits at z-10); desktop only — at phone widths the frieze
 * would be all overlap and no room.
 */
const FRIEZE_ORDER: Array<{ piece: string; native: (n: string) => string; roman: string | null }> = [
  { piece: 'tansu', native: n => `${n}の箪笥`, roman: 'TANSU' },
  { piece: 'armoire', native: n => `L'armoire de ${n}`, roman: null },
  { piece: 'sandook', native: n => `صندوق ${n}`, roman: 'SANDOOK' },
  { piece: 'almirah', native: n => `${n} की अलमारी`, roman: 'ALMIRAH' },
  { piece: 'wardrobe', native: n => `${n}'s wardrobe`, roman: null },
  { piece: 'yigui', native: n => `${n}的衣柜`, roman: 'YIGUI' },
  { piece: 'bandaji', native: n => `${n}의 반닫이`, roman: 'BANDAJI' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function GroundFrieze({ name }: { name?: string }) {
  const first = escapeXml((name ?? 'Toile').trim().split(/\s+/)[0] || 'Toile');
  const parts: string[] = [];
  FRIEZE_ORDER.forEach((entry, i) => {
    const x = i * 208;
    const cx = x + 143;
    parts.push(`<g transform='translate(${x} 122) scale(0.62)'>${FRIEZE_PIECES[entry.piece]}</g>`);
    parts.push(
      `<text x='${cx}' y='158' text-anchor='middle' font-family='serif' font-size='24' ` +
        `fill='var(--color-artline)' fill-opacity='0.30'>${entry.native(first)}</text>`
    );
    if (entry.roman) {
      parts.push(
        `<text x='${cx}' y='186' text-anchor='middle' font-family='Georgia, serif' font-size='17' ` +
          `letter-spacing='4' fill='var(--color-artline)' fill-opacity='0.22'>${entry.roman}</text>`
      );
    }
  });
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1534 470' width='1534' height='470' ` +
    `style='display:block'>${parts.join('')}</svg>`;
  return (
    <div
      aria-hidden="true"
      className="hidden lg:flex fixed bottom-0 inset-x-0 z-0 pointer-events-none overflow-hidden justify-end"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}


/* ---------------- empty-state plates ---------------- */

const plateStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'butt' as const,
  strokeLinejoin: 'miter' as const,
};

function Plate({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={`w-[200px] h-[160px] text-text-2 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** No items yet: a rail with hangers and a tape measure draped over it. */
export function PlateEmptyCloset() {
  return (
    <Plate>
      <path d="M20 34h160" {...plateStroke} />
      <path d="M60 34v8M100 34v8M140 34v8" {...plateStroke} />
      {/* three hangers */}
      <path d="M60 42l-18 12h36zM100 42l-18 12h36zM140 42l-18 12h36z" {...plateStroke} />
      {/* a single flat hanging from the middle hanger */}
      <path d="M84 54l-8 5v9h5v33h22V68h5v-9l-8-5" {...plateStroke} />
      {/* tape measure draped, ticks in carmine */}
      <path
        d="M30 40c14 26 30 34 52 30s34-12 52-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.35"
      />
      <path
        d="M44 52v5M60 60v5M78 64v5M96 66v5M114 62v5M130 62v5"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
      />
    </Plate>
  );
}

/** No outfits: pattern pieces laid out with chalk marks. */
export function PlateEmptyOutfits() {
  return (
    <Plate>
      <path d="M28 30h60v50H28zM108 30h60v34h-60zM108 78h60v52h-60z" {...plateStroke} />
      <path d="M28 96h60v34H28z" {...plateStroke} />
      {/* chalk crosses */}
      <g stroke="var(--color-accent)" strokeWidth="1.5">
        <path d="M52 50h10M57 45v10" />
        <path d="M133 44h10M138 39v10" />
        <path d="M133 100h10M138 95v10" />
      </g>
      <path d="M88 55h20M88 113h20" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
    </Plate>
  );
}

/** No wear log: an open ledger with a garment tag laid across it. */
export function PlateEmptyLedger() {
  return (
    <Plate>
      <path d="M22 34h156v96H22z" {...plateStroke} />
      <path d="M100 34v96" {...plateStroke} />
      <path
        d="M34 52h52M34 66h52M34 80h52M114 52h52M114 66h52M114 80h52M114 94h52"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      {/* tag laid across, string in carmine */}
      <g transform="rotate(-8 100 100)">
        <path d="M78 92h44v34H78z" {...plateStroke} />
        <circle cx="100" cy="102" r="3.5" {...plateStroke} />
        <path d="M100 98c0-8-6-11-12-14" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      </g>
    </Plate>
  );
}

/** Empty wishlist: a suitcase with two string tags. */
export function PlateEmptyWishlist() {
  return (
    <Plate>
      <path d="M34 52h132v78H34z" {...plateStroke} />
      <path d="M76 52V38h48v14" {...plateStroke} />
      <path d="M34 78h132M34 104h132" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <g>
        <path d="M118 60h24v26h-24z" {...plateStroke} />
        <circle cx="130" cy="68" r="3" {...plateStroke} />
        <path d="M130 65c0-6 4-9 8-11" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      </g>
    </Plate>
  );
}

/** Empty mending pile: a pincushion at rest. */
export function PlateEmptyMending() {
  return (
    <Plate>
      <path d="M62 118h76l-6-22H68z" {...plateStroke} />
      <path d="M70 96c0-20 14-32 30-32s30 12 30 32" {...plateStroke} />
      <path d="M86 78l-14-16M114 74l16-14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="71" cy="61" r="3" fill="var(--color-accent)" />
      <circle cx="131" cy="59" r="3" fill="var(--color-accent)" />
      <path d="M100 70v-22" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="100" cy="46" r="3" fill="var(--color-gold)" />
    </Plate>
  );
}

/** Retired pieces: one folded garment, drawn tenderly. */
export function PlateRetired() {
  return (
    <Plate>
      <path d="M46 62h108v56H46z" {...plateStroke} />
      <path d="M46 80h108M46 98h108" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <path d="M78 62V44h44v18" {...plateStroke} />
      <path d="M100 44v18" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
    </Plate>
  );
}

/** Everything's in the wash: a line of pinned garments. */
export function PlateWashline() {
  return (
    <Plate>
      <path d="M16 40c40 14 128 14 168 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M54 48l-8 5v8h4v34h20V61h4v-8l-8-5" {...plateStroke} />
      <path d="M118 50h28v14h-28zM122 64l2 34h6l3-22 3 22h6l2-34" {...plateStroke} />
      <g stroke="var(--color-accent)" strokeWidth="2">
        <path d="M54 44v8M132 46v6" />
      </g>
    </Plate>
  );
}

/* ---------------- no-photo garment plate ---------------- */

/**
 * First-class no-photo state: a drawn flat on a muslin tile. Photo-free use is a
 * privacy choice, so it must look intentional rather than broken.
 */
export function GarmentPlate({ categoryId, color }: { categoryId: string; color?: string }) {
  const flats: Record<string, React.ReactNode> = {
    tops: <path d="M30 18L14 28v16h8v42h36V44h8V28L50 18" />,
    bottoms: <path d="M22 16h36v10H22zM22 26l4 60h12l4-34 4 34h12l4-60" />,
    dresses: <path d="M30 16L16 26v12l8-3v53h32V35l8 3V26L50 16" />,
    layers: <path d="M28 16L18 24v62h44V24l-10-8M28 16l12 12 12-12M40 28v58" />,
    outerwear: <path d="M28 16L12 26l6 20h4v40h36V46h4l6-20-16-10M28 16l12 12 12-12M40 28v58" />,
    shoes: <path d="M10 70h68v12H10zM10 70V48h16l12 10h24c8 0 16 4 16 12" />,
    jewellery: <path d="M18 22c0 26 10 38 22 38s22-12 22-38M40 60v10M40 70l9 9-9 9-9-9z" />,
    accessories: <path d="M16 34h48v52H16zM30 34V22a10 10 0 0120 0v12M16 50h48" />,
  };
  const flat = flats[categoryId] ?? flats.accessories;
  return (
    <div className="w-full h-full flex items-center justify-center bg-sunken text-text-2">
      <svg viewBox="0 0 80 100" className="w-3/5 h-3/5" aria-hidden="true">
        {/* The line is ALWAYS currentColor. Stroking it in the garment's own
            colour drew a near-black piece in near-black on a dark ground, so
            every dark item rendered as an empty tile — the no-photo state is
            meant to be first-class, not invisible. The colour still gets said,
            as a small chip below, where it cannot swallow the drawing. */}
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="miter"
          strokeLinecap="butt"
          opacity={0.75}
        >
          {flat}
        </g>
        {color ? (
          <rect x="34" y="92" width="12" height="4" rx="1" fill={color} stroke="currentColor" strokeWidth="0.5" opacity="0.9" />
        ) : null}
      </svg>
    </div>
  );
}

/* ---------------- structural marks ---------------- */

/** Basting-stitch divider with bar-tacks — replaces every generic <hr>. */
export function Basting({ className = '' }: { className?: string }) {
  return <div className={`basting ${className}`} role="presentation" />;
}

/** Dotted leader line for coach marks and chart callouts. */
export function LeaderLine({ width = 80 }: { width?: number }) {
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} aria-hidden="true" className="text-text-2">
      <path
        d={`M0 4h${width - 8}`}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="0.1 4"
        strokeLinecap="round"
      />
      <circle cx={width - 4} cy="4" r="2.5" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}
