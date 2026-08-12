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

/**
 * The identity mark: a PAIR of tags on one long thread (owner's call,
 * 2026-08-12). Garments arrive wearing two — the maker's tag and the little
 * care tag behind it — so the mark wears two: the second sits back and to the
 * left, tilted the way a tag hangs when it isn't being held, and the thread
 * runs out of its eyelet, disappears behind the front tag, and comes back out
 * of the front grommet to twirl in the air above them.
 *
 * The face is bare on purpose. The hanger that used to hang inside it read as
 * clutter at every size; a tag says what it is by being a tag, so the only
 * thing printed on it is the letter.
 *
 * Order matters here: back tag, then the thread that joins them, then the
 * front tag (filled, so it occludes the joining thread), then the twirl.
 */
export function TagMark({ size = 28 }: { size?: number }) {
  const full = size >= 40;
  const sw = full ? 2 : 2.4;
  return (
    <svg
      width={size * 0.875}
      height={size * 1.3125}
      viewBox="-4 -20 56 84"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* the care tag, behind and tilted */}
      <g transform="translate(-10 2) rotate(-9 24 30) scale(0.8)" transform-origin="24 30">
        <path
          d="M10 12 20 2h8l10 10v46a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2Z"
          fill="var(--color-sunken)"
          stroke="currentColor"
          strokeWidth={sw * 1.1}
          strokeLinejoin="miter"
        />
        <circle cx="24" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="24" cy="9" r="2.8" stroke="var(--color-gold)" strokeWidth="2.1" />
      </g>

      {/* the thread from the care tag's eyelet, running behind the front tag */}
      <path
        d="M11.4 15.4C13.6 9.6 17.4 6.2 24 4.4"
        stroke="var(--color-gold)"
        strokeWidth={full ? 1.5 : 1.8}
        strokeLinecap="butt"
      />

      {/* the maker's tag, in front */}
      <path
        d="M10 12 20 2h8l10 10v46a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2Z"
        fill="var(--color-bg)"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinejoin="miter"
      />
      <circle cx="24" cy="9" r={full ? 4.5 : 4.9} stroke="currentColor" strokeWidth={full ? 1 : 1.25} />
      <circle cx="24" cy="9" r="3" stroke="var(--color-gold)" strokeWidth={full ? 2 : 2.5} />
      <text
        x="24"
        y="44"
        textAnchor="middle"
        fill="currentColor"
        style={{ font: full ? '700 22px var(--font-display)' : '700 24px var(--font-display)' }}
      >
        T
      </text>

      {/* and out of the front grommet, the long twirl */}
      <path
        d="M24 4.4C24 -2.6 20.6 -7 16.4 -10.6 11 -15.2 12 -22.4 18 -23.2c5.2-.7 8.2 4.2 6 8.2"
        stroke="var(--color-gold)"
        strokeWidth={full ? 1.5 : 1.9}
        strokeLinecap="butt"
      />
    </svg>
  );
}

/**
 * The mark worn as a portrait, 4:5 to match photo portraits (size × 1.25).
 * Full hanger cut with the same hanging string as the nav mark, dyed the
 * wardrobe's own colour — identity lives in the rig itself rather than an
 * orphan ring. Never a face.
 *
 * The monogram is set small on purpose: two initials at the old 10.5 crowded
 * the panel wall to wall on the Profile header, where the mark renders at 72.
 * The panel is a label, and a label leaves margins.
 */
export function TagPortrait({
  monogram,
  color,
  size = 40,
}: {
  monogram: string;
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size * 1.325}
      height={size * 1.55}
      viewBox="-11 -14 53 62"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-text"
    >
      {/* the care tag behind, tilted */}
      <g transform="translate(-8 2) rotate(-9 20 25) scale(0.8)" transform-origin="20 25">
        <path
          d="M5 10.5 13.5 2h13L35 10.5v34.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
          fill="var(--color-bg)"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="miter"
        />
        <circle cx="20" cy="7.5" r="3.6" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="20" cy="7.5" r="2.4" stroke="var(--color-gold)" strokeWidth="1.8" />
      </g>

      {/* the thread joining them, running behind the front tag */}
      <path
        d="M8.6 12.6C10.4 7.6 14.2 4.8 20 3.3"
        stroke={color ?? 'var(--color-gold)'}
        strokeWidth="1.3"
        strokeLinecap="butt"
      />

      {/* the wardrobe's own tag, in front */}
      <path
        d="M5 10.5 13.5 2h13L35 10.5v34.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
        fill="var(--color-sunken)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
      {/* the ink rim keeps the gold from sinking into light grounds */}
      <circle cx="20" cy="7.5" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="7.5" r="2.75" stroke="var(--color-gold)" strokeWidth="1.75" />
      <text
        x="20"
        y="32"
        textAnchor="middle"
        fill="currentColor"
        style={{ font: '700 13px var(--font-display)', letterSpacing: '0.02em' }}
      >
        {monogram}
      </text>

      {/* the twirl, in this wardrobe's own thread */}
      <path
        d="M20 3.3C20 -1.2 16.1 -3.2 13.4 -5.5 9.3 -7.9 9.5 -11.9 13 -12.8c3.2-.8 5.4 2 4.6 4.6"
        stroke={color ?? 'var(--color-gold)'}
        strokeWidth="1.3"
        strokeLinecap="butt"
      />
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

import { FRIEZE_PIECES, FRIEZE_RAIL, FRIEZE_RAIL_DROPS } from '../lib/friezeArt';

/**
 * The closets of the house, standing behind the paper — remade after the first
 * hanging read as a lineup: every piece the same size on the same baseline.
 *
 * Now each PAGE hangs its own arrangement: three to five pieces from a set of
 * nine (seven cultures of furniture, a standing coat pole, a chest of drawers),
 * at staggered scales, with Mughal buta flower-sprigs and a Rajput bird
 * perched between them. The metals come in PAIRS — every room declares
 * --color-artline and --color-artline-2 (gold with pewter, silver with gold,
 * bronze with brass...) and the pieces alternate between them. Over the larger
 * furniture, the open wardrobe's name in that culture's language. And the
 * composition's counterweight hangs at the TOP of the page: a clothes rail
 * with three hangers, drawn in the second metal.
 *
 * Live components rather than CSS because the NAME is in the art; aria-hidden,
 * z-0 behind the content column, desktop only.
 */
const FRIEZE_CAPTIONS: Record<string, { native: (n: string) => string; roman: string | null }> = {
  tansu: { native: n => `${n}の箪笥`, roman: 'TANSU' },
  armoire: { native: n => `L'armoire de ${n}`, roman: null },
  sandook: { native: n => `صندوق ${n}`, roman: 'SANDOOK' },
  almirah: { native: n => `${n} की अलमारी`, roman: 'ALMIRAH' },
  wardrobe: { native: n => `${n}'s wardrobe`, roman: null },
  yigui: { native: n => `${n}的衣柜`, roman: 'YIGUI' },
  bandaji: { native: n => `${n}의 반닫이`, roman: 'BANDAJI' },
  coatstand: { native: n => `L'appendiabiti di ${n}`, roman: null },
  dresser: { native: n => `${n}s Kommode`, roman: null },
};

/** Which pieces each page hangs, in order. Small motifs sit between furniture.
    The dressing-room wing (cheval, vanity, dressform, screen, jewelstand,
    beach; jhumka and handmirror as small motifs) fills the hangs out to five
    or six pieces — the house was asked to leave less wall bare. */
const PAGE_SETS: Record<string, string[]> = {
  '/': ['coatstand', 'flower', 'almirah', 'bird', 'wardrobe', 'handmirror'],
  '/closet': ['almirah', 'flower', 'yigui', 'handmirror', 'coatstand'],
  '/outfits': ['dressform', 'bird', 'armoire', 'flower', 'tansu'],
  '/calendar': ['flower', 'sandook', 'bird', 'coatstand', 'jhumka'],
  '/ledger': ['dresser', 'flower', 'yigui', 'jewelstand'],
  '/wishlist': ['sandook', 'jhumka', 'wardrobe', 'flower', 'bird'],
  '/compare': ['cheval', 'flower', 'bandaji', 'armoire'],
  '/events': ['screen', 'bird', 'sandook', 'flower', 'beach'],
  '/feed': ['tansu', 'jhumka', 'bandaji', 'bird', 'flower'],
  '/chats': ['dresser', 'bird', 'armoire', 'handmirror'],
  '/profile': ['vanity', 'flower', 'wardrobe', 'tansu'],
  '/settings': ['yigui', 'bird', 'dresser', 'flower', 'jhumka'],
};
const DEFAULT_SET = ['almirah', 'flower', 'bandaji', 'bird'];

const SMALL = new Set(['flower', 'bird', 'jhumka', 'handmirror']);

/** Deterministic 0..1 per (page, slot) — the hang must not reshuffle per render. */
function jitter(...parts: Array<string | number>): number {
  let h = 2166136261;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Layout's fixed sidebar and content column, which the caption gate below
    must stay clear of. */
const SIDEBAR_W = 220;
const CONTENT_W = 1024; // max-w-5xl

export function GroundFrieze({ name, page = '/' }: { name?: string; page?: string }) {
  const first = escapeXml((name ?? 'Toile').trim().split(/\s+/)[0] || 'Toile');
  const key = '/' + (page.split('/')[1] ?? '');
  const set = PAGE_SETS[key] ?? DEFAULT_SET;
  // Alternate the frieze's side per page, so the house does not hang every
  // picture on the same wall. Decided before the hang: the caption gate needs
  // to know where the composition will stand.
  const side = jitter(key, 'side') < 0.5 ? 'justify-end' : 'justify-start';
  const parts: string[] = [];
  const captions: Array<{ cx: number; metal: string; native: string; roman: string | null }> = [];
  let x = 30 + Math.round(jitter(key, 'start') * 120);
  set.forEach((piece, i) => {
    const small = SMALL.has(piece);
    // Furniture staggers between 0.52 and 0.72; motifs sit small and high.
    const scale = small ? 0.34 + jitter(key, i) * 0.1 : 0.52 + jitter(key, i) * 0.2;
    const w = 460 * scale;
    const ty = 470 - 560 * scale - (small ? 26 + jitter(key, i, 'y') * 40 : 0);
    const metal = i % 2 === 1 ? " style='--color-artline: var(--color-artline-2)'" : '';
    parts.push(`<g transform='translate(${Math.round(x)} ${Math.round(ty)}) scale(${scale.toFixed(2)})'${metal}>${FRIEZE_PIECES[piece]}</g>`);
    const caption = FRIEZE_CAPTIONS[piece];
    if (caption && !small) {
      captions.push({
        cx: Math.round(x + w / 2),
        metal,
        native: caption.native(first),
        roman: caption.roman,
      });
    }
    x += w - 30 - jitter(key, i, 'gap') * 40;
  });
  const width = Math.max(900, Math.round(x + 60));
  // The furniture may clip behind the sidebar or the content column — wall art
  // reads as intentional when cropped. A serif word cut mid-glyph does not: it
  // reads as a rendering fault (both sparse and dense closets showed stray
  // fragments — "s Kommode", "di Sam" — floating in the gutters). So the
  // owner's name is written LOW on the wall, small type near the floor line
  // under the crown fade, and only where the whole line lands in an open
  // margin — it may slide toward the nearest gutter to get there, but never so
  // far it leaves its furniture behind. On mid-width desktops the gutters are
  // too narrow and the name simply stays unwritten; the furniture speaks.
  // Decorative text; a stale innerWidth until the next route change is fine.
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const mainW = Math.max(0, vw - SIDEBAR_W);
  const contentLeft = SIDEBAR_W + Math.max(0, (mainW - CONTENT_W) / 2);
  const contentRight = Math.min(vw, contentLeft + CONTENT_W);
  const x0 = side === 'justify-start' ? SIDEBAR_W : vw - width;
  let captioned = 0;
  for (const c of captions) {
    if (captioned >= 2) break;
    const halfW = Math.max(c.native.length * 10, (c.roman?.length ?? 0) * 10) / 2 + 14;
    const fits = (at: number) =>
      (at - halfW >= SIDEBAR_W + 12 && at + halfW <= contentLeft - 12) ||
      (at - halfW >= contentRight + 12 && at + halfW <= vw - 12);
    const candidates = [x0 + c.cx, (SIDEBAR_W + contentLeft) / 2, (contentRight + vw) / 2];
    const at = candidates.find(a => fits(a) && Math.abs(a - (x0 + c.cx)) < 320);
    if (at === undefined) continue;
    const cx = Math.round(at - x0);
    captioned += 1;
    parts.push(
      `<text x='${cx}' y='446' text-anchor='middle' font-family='serif' font-size='17'` +
        `${c.metal} fill='var(--color-artline)' fill-opacity='0.32'>${c.native}</text>`
    );
    if (c.roman) {
      parts.push(
        `<text x='${cx}' y='465' text-anchor='middle' font-family='Georgia, serif' font-size='12' ` +
          `letter-spacing='3'${c.metal} fill='var(--color-artline)' fill-opacity='0.24'>${c.roman}</text>`
      );
    }
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} 470' width='${width}' height='470' ` +
    `style='display:block'>${parts.join('')}</svg>`;
  // The crown fade: the tall pieces' upper reaches dissolve, so strokes
  // standing behind the content column stop surfacing through the thin gaps
  // between cards as disembodied slivers (worst in the Calendar's grid seams).
  // The floor band, where the composition lives, stays full strength — pieces
  // emerge from the same mist the tansu's cloud band already speaks.
  const mask = 'linear-gradient(to bottom, transparent 0, rgba(0,0,0,0.22) 30%, black 54%)';
  return (
    <div
      aria-hidden="true"
      className={`hidden lg:flex fixed bottom-0 left-[220px] right-0 z-0 pointer-events-none overflow-hidden ${side}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** The rail at the top — the frieze flipped to the other edge of the paper. */
export function HangingRail({ page = '/' }: { page?: string }) {
  const key = '/' + (page.split('/')[1] ?? '');
  // Opposite side from the ground frieze below it.
  const side = jitter(key, 'side') < 0.5 ? 'justify-start' : 'justify-end';
  // Most pages hang a keepsake past the rod's end — the rod grows an arm and a
  // pair of jhumkas or the hand mirror hangs from it. Page-keyed like the
  // frieze; a few pages keep the rod bare.
  const r = jitter(key, 'drop');
  const drop = r < 0.45 ? FRIEZE_RAIL_DROPS.jhumka : r < 0.9 ? FRIEZE_RAIL_DROPS.handmirror : null;
  const inner = drop
    ? `${FRIEZE_RAIL}<path d='M700 40h150' fill='none' stroke='var(--color-artline)' stroke-width='2.5' stroke-opacity='0.30'/><g transform='translate(185 0)'>${drop}</g>`
    : FRIEZE_RAIL;
  const w = drop ? 880 : 720;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} 190' width='${w}' height='190' ` +
    `style='display:block; --color-artline: var(--color-artline-2)'>${inner}</svg>`;
  return (
    <div
      aria-hidden="true"
      className={`hidden lg:flex fixed top-0 left-[220px] right-0 z-0 pointer-events-none overflow-hidden ${side}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Which piece stands mid-wall in each page's open gutter. Furniture only —
    the small motifs vanish at this crop — and always DISJOINT from that
    page's frieze set: the same drawing twice on one wall reads as a wallpaper
    repeat, not a hang (Events stacked two beach still-lifes before this). */
const GUTTER_PIECES: Record<string, string> = {
  '/': 'cheval',
  '/closet': 'screen',
  '/outfits': 'cheval',
  '/calendar': 'jewelstand',
  '/ledger': 'vanity',
  '/wishlist': 'jewelstand',
  '/compare': 'dressform',
  '/events': 'vanity',
  '/feed': 'coatstand',
  '/chats': 'jewelstand',
  '/profile': 'cheval',
  '/settings': 'dressform',
};
const GUTTER_FALLBACKS = ['cheval', 'screen', 'dressform', 'vanity', 'jewelstand', 'coatstand'];

/**
 * One piece standing at mid-height in the gutter the content column leaves
 * open — the side the ground frieze is NOT on, so the two never crowd one
 * wall. The middle of every page was the emptiest stretch of the house: the
 * frieze holds the floor and the rail holds the ceiling, but a tall page
 * scrolled past nothing at eye level. The figure is sized from the ACTUAL
 * gutter — at mid widths it stands small and whole; when the gutter closes it
 * steps out entirely rather than hide behind the column and surface through
 * card gaps as slivers.
 */
export function GutterFigure({ page = '/' }: { page?: string }) {
  const key = '/' + (page.split('/')[1] ?? '');
  const set = new Set(PAGE_SETS[key] ?? DEFAULT_SET);
  const piece =
    [GUTTER_PIECES[key] ?? 'cheval', ...GUTTER_FALLBACKS].find(k => !set.has(k) && FRIEZE_PIECES[k]) ?? 'cheval';
  // GroundFrieze stands justify-end when jitter < 0.5 — take the other wall.
  const left = jitter(key, 'side') < 0.5;
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const gutter = Math.max(0, (vw - SIDEBAR_W - CONTENT_W) / 2);
  if (gutter < 72) return null;
  const w = Math.min(200, Math.round(gutter - 16));
  const h = Math.round((w * 380) / 420);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='20 130 420 380' width='${w}' height='${h}' ` +
    `style='display:block'>${FRIEZE_PIECES[piece]}</svg>`;
  return (
    <div
      aria-hidden="true"
      className={`hidden lg:block fixed top-1/2 -translate-y-1/2 z-0 pointer-events-none ${left ? 'left-[232px]' : 'right-3'}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** The scatter pool: shoes and keepsakes set down in the open margins. */
const SCATTER_POOL = ['heels', 'boot', 'sneaker', 'jutti', 'sandal', 'watch', 'rings', 'bangles', 'pearls'];
/** Slots keep clear of the rail (top band), the frieze (bottom band), and the
    gutter figure's mid-height stand. Jitter nudges each a few percent so no
    two pages shelve their things identically. */
const SCATTER_SLOTS = [
  { side: 'L', top: 26 },
  { side: 'R', top: 32 },
  { side: 'L', top: 71 },
  { side: 'R', top: 65 },
];

/**
 * Small artwork across the background: three or four little drawings — a
 * tipped heel, a coiled watch, a strand of pearls — set down in the gutters
 * the way real things collect on a dresser top. Page-keyed and deterministic,
 * like every hang in the house: random once, then it stays where it was put.
 */
export function ScatterField({ page = '/' }: { page?: string }) {
  const key = '/' + (page.split('/')[1] ?? '');
  const used = new Set<number>();
  const n = 3 + (jitter(key, 'scatter-n') < 0.4 ? 1 : 0);
  const items: Array<{ piece: string; side: string; top: number; size: number; second: boolean }> = [];
  for (let i = 0; i < n; i++) {
    let pick = Math.floor(jitter(key, 'scatter', i) * SCATTER_POOL.length);
    while (used.has(pick)) pick = (pick + 1) % SCATTER_POOL.length;
    used.add(pick);
    if (!FRIEZE_PIECES[SCATTER_POOL[pick]]) continue;
    const slot = SCATTER_SLOTS[i % SCATTER_SLOTS.length];
    items.push({
      piece: SCATTER_POOL[pick],
      side: slot.side,
      top: slot.top + Math.round(jitter(key, 'sl', i) * 8) - 4,
      size: 64 + Math.round(jitter(key, 'sz', i) * 28),
      second: jitter(key, 'metal', i) < 0.5,
    });
  }
  return (
    <div aria-hidden="true" className="hidden lg:block">
      {items.map((it, i) => (
        <div
          key={i}
          className={`fixed z-0 pointer-events-none ${it.side === 'L' ? 'left-[234px]' : 'right-2'}`}
          style={{ top: `${it.top}%` }}
          dangerouslySetInnerHTML={{
            __html:
              `<svg xmlns='http://www.w3.org/2000/svg' viewBox='140 360 190 150' width='${it.size}' ` +
              `height='${Math.round((it.size * 150) / 190)}' style='display:block${
                it.second ? '; --color-artline: var(--color-artline-2)' : ''
              }'>${FRIEZE_PIECES[it.piece]}</svg>`,
          }}
        />
      ))}
    </div>
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
export function GarmentPlate({ categoryId, color, name }: { categoryId: string; color?: string; name?: string }) {
  const flats: Record<string, React.ReactNode> = {
    tops: <path d="M30 18L14 28v16h8v42h36V44h8V28L50 18" />,
    bottoms: <path d="M22 16h36v10H22zM22 26l4 60h12l4-34 4 34h12l4-60" />,
    dresses: <path d="M30 16L16 26v12l8-3v53h32V35l8 3V26L50 16" />,
    layers: <path d="M28 16L18 24v62h44V24l-10-8M28 16l12 12 12-12M40 28v58" />,
    outerwear: <path d="M28 16L12 26l6 20h4v40h36V46h4l6-20-16-10M28 16l12 12 12-12M40 28v58" />,
    shoes: <path d="M10 70h68v12H10zM10 70V48h16l12 10h24c8 0 16 4 16 12" />,
    jewellery: <path d="M18 22c0 26 10 38 22 38s22-12 22-38M40 60v10M40 70l9 9-9 9-9-9z" />,
    accessories: <path d="M16 34h48v52H16zM30 34V22a10 10 0 0120 0v12M16 50h48" />,
    skirt: <path d="M26 20h28v8H26zM24 28L14 82h52L56 28" />,
    scarf: <path d="M18 32h44v20H18zM18 52l4 26M29 52l3 26M40 52l3 26M51 52l3 26M62 52l2 26M18 32l44 20" />,
    sunglasses: (
      <>
        <circle cx="24" cy="54" r="13" />
        <circle cx="56" cy="54" r="13" />
        <path d="M37 52c1-4 5-4 6 0M11 50L4 42M69 50l7-8" />
      </>
    ),
    socks: (
      <>
        <path d="M20 22h14v28c0 10-4 13-9 17-4 4-2 10 4 10s11-5 11-13" />
        <path d="M20 28h14" />
        <path d="M42 28h14v28c0 10-4 13-9 17-4 4-2 10 4 10s11-5 11-13" />
        <path d="M42 34h14" />
      </>
    ),
  };
  // The category flat asserts what a piece IS, so a Wool skirt must not wear
  // the trouser drawing and a scarf must not wear the tote — that broke the
  // "photo-free is first-class" contract four cells in a row. The name gets
  // first say; the category remains the fallback.
  const NAME_FLATS: Array<[RegExp, string]> = [
    [/\bskirts?\b/i, 'skirt'],
    [/scarf|shawl|pashmina|stole|dupatta|bandana/i, 'scarf'],
    [/sunglass|spectacle|glasses|shades/i, 'sunglasses'],
    [/\bsocks?\b/i, 'socks'],
  ];
  const byName = name ? NAME_FLATS.find(([re]) => re.test(name))?.[1] : undefined;
  const flat = (byName && flats[byName]) ?? flats[categoryId] ?? flats.accessories;
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
