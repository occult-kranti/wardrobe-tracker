import type { SVGProps } from 'react';

/**
 * TOILE icon set — technical fashion flats.
 *
 * Drawing rules (docs/05-brand-identity.md §5), enforced on every glyph:
 *  - 24×24 viewBox, 20×20 live area, coordinates on the 0.5 half-grid
 *  - 1.5px stroke, currentColor, butt caps, miter joins
 *  - outer corners sharp; curves reserved for cloth, structure stays rectilinear
 *  - exactly ONE 2px 45° pattern notch in the NE quadrant per icon
 *  - garments drawn as flats with real construction — never a body, never a
 *    gendered silhouette
 */

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  title?: string;
}

function Icon({ size = 20, title, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** The fingerprint: one 2px 45° tick in the NE quadrant. */
function Notch({ x = 17.5, y = 4.5 }: { x?: number; y?: number }) {
  return <path d={`M${x} ${y}l1.5 -1.5`} />;
}

/* ---------- garment flats (category icons) ---------- */

export const IconTop = (p: IconProps) => (
  <Icon {...p}>
    {/* boxy tee flat: shoulder seams, set-in sleeves, ribbed neck */}
    <path d="M8.5 3.5L4.5 6v4h2.5v10.5h10V10h2.5V6l-4-2.5" />
    <path d="M8.5 3.5c1 1.5 2 2.2 3.5 2.2S14.5 5 15.5 3.5" />
    <Notch x={17.5} y={5} />
  </Icon>
);

export const IconBottom = (p: IconProps) => (
  <Icon {...p}>
    {/* trouser flat: waistband, fly, inseam */}
    <path d="M6.5 3.5h11v3h-11z" />
    <path d="M6.5 6.5L7.5 20.5h3.5l1-9 1 9h3.5l1-14" />
    <path d="M12 6.5v3" />
    <Notch x={17.5} y={4.5} />
  </Icon>
);

export const IconOnePiece = (p: IconProps) => (
  <Icon {...p}>
    {/* column garment with drape — never an A-line gender glyph */}
    <path d="M8.5 3.5L5.5 5.5v3l2-.75V20.5h9V7.75l2 .75v-3l-3-2" />
    <path d="M8.5 3.5c1 1.3 2 1.9 3.5 1.9s2.5-.6 3.5-1.9" />
    <path d="M10 11.5c1.3.8 2.7.8 4 0" />
    <Notch x={17.8} y={5.2} />
  </Icon>
);

export const IconLayer = (p: IconProps) => (
  <Icon {...p}>
    {/* long open vest: front edges, armholes, no sleeves */}
    <path d="M9 3.5L6 5.5v15h12v-15l-3-2" />
    <path d="M9 3.5l3 3 3-3" />
    <path d="M12 6.5v14" />
    <Notch x={17.5} y={4.8} />
  </Icon>
);

export const IconOuterwear = (p: IconProps) => (
  <Icon {...p}>
    {/* coat flat: notched lapel, sleeves, button stand */}
    <path d="M8.5 3.5L4.5 6l1.5 5H7v9.5h10V11h1l1.5-5-4-2.5" />
    <path d="M8.5 3.5l3.5 3.5 3.5-3.5" />
    <path d="M12 7v13.5" />
    <path d="M13.5 11.5h1M13.5 15h1" />
    <Notch x={17.6} y={5} />
  </Icon>
);

export const IconShoe = (p: IconProps) => (
  <Icon {...p}>
    {/* side-profile derby: vamp, laces, sole */}
    <path d="M3.5 17.5h17v3h-17z" />
    <path d="M3.5 17.5V12h4l3 2.5h6c2 0 4 1 4 3" />
    <path d="M8 12.5l2 1.5M10 10.5l2 1.5" />
    <Notch x={17.5} y={7.5} />
  </Icon>
);

export const IconJewellery = (p: IconProps) => (
  <Icon {...p}>
    {/* necklace flat: chain arc, clasp, pendant drop — drawn on the table, no neck */}
    <path d="M5.5 5.5c0 6.5 2.9 9.5 6.5 9.5s6.5-3 6.5-9.5" />
    <path d="M12 15v2.5" />
    <path d="M12 17.5l2.5 2.5L12 22.5 9.5 20z" />
    <Notch x={18} y={4.5} />
  </Icon>
);

export const IconAccessory = (p: IconProps) => (
  <Icon {...p}>
    {/* tote flat: gusset, handles */}
    <path d="M4.5 8.5h15v12h-15z" />
    <path d="M8.5 8.5V6a3.5 3.5 0 017 0v2.5" />
    <path d="M4.5 12.5h15" />
    <Notch x={17.8} y={5.5} />
  </Icon>
);

/* ---------- navigation ---------- */

export const IconToday = (p: IconProps) => (
  <Icon {...p}>
    {/* a day's page with a pressed eyelet */}
    <path d="M4.5 4.5h15v16h-15z" />
    <path d="M4.5 9.5h15" />
    <circle cx="12" cy="15" r="2.5" />
    <Notch x={17.5} y={6.5} />
  </Icon>
);

export const IconCloset = (p: IconProps) => (
  <Icon {...p}>
    {/* garments on a rail, viewed straight on */}
    <path d="M3.5 5.5h17" />
    <path d="M7 5.5v3M12 5.5v3M17 5.5v3" />
    <path d="M5 8.5h4v11h-4zM10 8.5h4v11h-4zM15 8.5h4v11h-4z" />
    <Notch x={18.5} y={3.5} />
  </Icon>
);

export const IconOutfits = (p: IconProps) => (
  <Icon {...p}>
    {/* stacked pattern pieces */}
    <path d="M3.5 8.5l6-4 6 4-6 4z" />
    <path d="M9.5 20.5l-6-4V12" />
    <path d="M14.5 10.5h6v10h-6z" />
    <Notch x={18} y={6} />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6.5h17v14h-17z" />
    <path d="M3.5 11.5h17" />
    <path d="M8 3.5v4M16 3.5v4" />
    <circle cx="8.5" cy="15.5" r="1.5" />
    <Notch x={18.5} y={4.5} />
  </Icon>
);

export const IconLedger = (p: IconProps) => (
  <Icon {...p}>
    {/* an open ledger with a rising column */}
    <path d="M3.5 5.5h17v15h-17z" />
    <path d="M7.5 16.5v-3M12 16.5v-6M16.5 16.5v-9" />
    <Notch x={18.5} y={3.5} />
  </Icon>
);

export const IconWishlist = (p: IconProps) => (
  <Icon {...p}>
    {/* a garment tag with its string */}
    <path d="M6.5 4.5h11v15h-11z" />
    <circle cx="12" cy="8" r="1.5" />
    <path d="M12 4.5V2" />
    <path d="M9 13.5h6M9 16h6" />
    <Notch x={17.8} y={5.5} />
  </Icon>
);

export const IconCompare = (p: IconProps) => (
  <Icon {...p}>
    {/* two swatches held side by side for comparison */}
    <path d="M3.5 6.5h7v13h-7zM13.5 6.5h7v13h-7z" />
    <path d="M10.5 13h3" />
    <Notch x={18.5} y={4.5} />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    {/* spool of thread */}
    <path d="M6.5 4.5h11v15h-11z" />
    <path d="M6.5 8.5h11M6.5 15.5h11" />
    <path d="M9.5 8.5v7M14.5 8.5v7" />
    <Notch x={18} y={3.5} />
  </Icon>
);

/* ---------- actions & states ---------- */

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5v15M4.5 12h15" />
    <Notch x={18.5} y={4.5} />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    <Notch x={19.5} y={3} />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
    <Notch x={18} y={3.5} />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    {/* eyelet as lens */}
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
    <Notch x={17.5} y={4} />
  </Icon>
);

export const IconFilter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6.5h17M6.5 12h11M9.5 17.5h5" />
    <Notch x={19} y={3.5} />
  </Icon>
);

export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    {/* safety pin — the favorite mark */}
    <path d="M6.5 14.5V8a3 3 0 016 0v9a2.5 2.5 0 005 0V9.5" />
    <circle cx="6.5" cy="16.5" r="2" />
    <Notch x={18.5} y={5.5} />
  </Icon>
);

export const IconPatch = (p: IconProps) => (
  <Icon {...p}>
    {/* mending patch with visible stitches */}
    <path d="M4.5 6.5h15v13h-15z" />
    <path d="M4.5 9h2M8 9h2M11.5 9h2M15 9h2M18.5 9h1" />
    <path d="M4.5 17h2M8 17h2M11.5 17h2M15 17h2M18.5 17h1" />
    <Notch x={18} y={4} />
  </Icon>
);

export const IconWash = (p: IconProps) => (
  <Icon {...p}>
    {/* laundry basket with weave */}
    <path d="M4.5 8.5h15l-1.5 12h-12z" />
    <path d="M8 8.5l1 12M16 8.5l-1 12M5.5 14h13" />
    <Notch x={18.5} y={5.5} />
  </Icon>
);

export const IconShears = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 4.5l9 12M18 4.5l-9 12" />
    <circle cx="7" cy="18.5" r="2" />
    <circle cx="17" cy="18.5" r="2" />
    <Notch x={18.5} y={3} />
  </Icon>
);

export const IconTape = (p: IconProps) => (
  <Icon {...p}>
    {/* tape measure with ticks */}
    <path d="M3.5 9.5h17v6h-17z" />
    <path d="M7 9.5v2.5M10.5 9.5v3.5M14 9.5v2.5M17.5 9.5v3.5" />
    <Notch x={19} y={7} />
  </Icon>
);

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 12h15M13 6.5l6 5.5-6 5.5" />
    <Notch x={18.5} y={4} />
  </Icon>
);

export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 4.5L7 12l8 7.5" />
    <Notch x={18} y={4} />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4.5l8 7.5-8 7.5" />
    <Notch x={19} y={3.5} />
  </Icon>
);

export const IconDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v15M6.5 13l5.5 5.5 5.5-5.5" />
    <Notch x={18.5} y={4} />
  </Icon>
);

export const IconUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20.5v-15M6.5 11l5.5-5.5 5.5 5.5" />
    <Notch x={19} y={14} />
  </Icon>
);

export const IconExport = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15.5V3.5M7.5 8l4.5-4.5L16.5 8" />
    <path d="M4.5 14.5v6h15v-6" />
    <Notch x={19} y={11} />
  </Icon>
);

export const IconImport = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v12M7.5 11l4.5 4.5L16.5 11" />
    <path d="M4.5 14.5v6h15v-6" />
    <Notch x={19} y={6} />
  </Icon>
);

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7.5h17v13h-17z" />
    <circle cx="12" cy="14" r="3.5" />
    <path d="M8.5 7.5l1.5-3h4l1.5 3" />
    <Notch x={18.5} y={10} />
  </Icon>
);

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
    <Notch x={19} y={4} />
  </Icon>
);

export const IconTheme = (p: IconProps) => (
  <Icon {...p}>
    {/* half-inked circle: the lamp */}
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 4.5a7.5 7.5 0 000 15z" fill="currentColor" stroke="none" />
    <Notch x={18.5} y={5} />
  </Icon>
);

export const IconEyelet = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" {...rest}>
    <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth={1.5} />
  </svg>
);

export const IconEyeletFilled = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" {...rest}>
    <circle cx="6" cy="6" r="4" fill="currentColor" />
  </svg>
);

export const IconRail = (p: IconProps) => (
  <Icon {...p}>
    {/* a garment rail with two hung tags — the shared rail */}
    <path d="M2.5 5.5h19" />
    <path d="M7 5.5v2M17 5.5v2" />
    <path d="M4.5 7.5h5v10.5l-2.5 2-2.5-2z" />
    <path d="M14.5 7.5h5v10.5l-2.5 2-2.5-2z" />
    <circle cx="7" cy="10" r="1" />
    <circle cx="17" cy="10" r="1" />
    <Notch x={19} y={3.5} />
  </Icon>
);

/** Category id → flat. Unknown (user-made) categories fall back to the tag. */
export const CATEGORY_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  tops: IconTop,
  bottoms: IconBottom,
  dresses: IconOnePiece,
  layers: IconLayer,
  outerwear: IconOuterwear,
  shoes: IconShoe,
  jewellery: IconJewellery,
  accessories: IconAccessory,
};

export function categoryIcon(id: string) {
  return CATEGORY_ICONS[id] ?? IconWishlist;
}
