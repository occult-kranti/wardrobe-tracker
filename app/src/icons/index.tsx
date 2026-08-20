/**
 * Almari icon set, native edition — technical fashion flats.
 *
 * SOURCE OF TRUTH: src/components/icons.tsx at the repo root. Every path here
 * is a byte-for-byte twin of the web glyph; only the JSX host changes
 * (react-native-svg, bundled in Expo Go — checked against
 * https://docs.expo.dev/versions/v57.0.0/sdk/svg/).
 *
 * Drawing rules (docs/05-brand-identity.md §5), enforced on every glyph:
 *  - 24×24 viewBox, 20×20 live area, coordinates on the 0.5 half-grid
 *  - 1.5px stroke, butt caps, miter joins
 *  - outer corners sharp; curves reserved for cloth, structure stays rectilinear
 *  - exactly ONE 2px 45° pattern notch in the NE quadrant per icon
 *  - garments drawn as flats with real construction — never a body, never a
 *    gendered silhouette
 *
 * The web strokes in `currentColor`; native has no cascade, so the colour
 * arrives as a prop — always a theme token, never a raw hex at a call site.
 */
import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

export interface IconProps {
  size?: number;
  /** A theme token — tokens.text, tokens.accent, tokens.text2. */
  color: ColorValue;
}

function Icon({ size = 20, color, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <G fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="butt" strokeLinejoin="miter">
        {children}
      </G>
    </Svg>
  );
}

/** The fingerprint: one 2px 45° tick in the NE quadrant. */
function Notch({ x = 17.5, y = 4.5 }: { x?: number; y?: number }) {
  return <Path d={`M${x} ${y}l1.5 -1.5`} />;
}

export const IconToday = (p: IconProps) => (
  <Icon {...p}>
    {/* a day's page with a pressed eyelet */}
    <Path d="M4.5 4.5h15v16h-15z" />
    <Path d="M4.5 9.5h15" />
    <Circle cx="12" cy="15" r="2.5" />
    <Notch x={17.5} y={6.5} />
  </Icon>
);

export const IconCloset = (p: IconProps) => (
  <Icon {...p}>
    {/* garments on a rail, viewed straight on */}
    <Path d="M3.5 5.5h17" />
    <Path d="M7 5.5v3M12 5.5v3M17 5.5v3" />
    <Path d="M5 8.5h4v11h-4zM10 8.5h4v11h-4zM15 8.5h4v11h-4z" />
    <Notch x={18.5} y={3.5} />
  </Icon>
);

export const IconFeed = (p: IconProps) => (
  <Icon {...p}>
    {/* Three plates staggered as if laid out on the table for viewing, the
        two behind drawn only where the front one does not cover them — the
        way a draughtsman shows a stack. The front plate carries its specimen
        caption rule, which is the anatomy of every card in the feed and what
        keeps this from being a generic layers glyph. Deliberately not the
        outfit mark: those are pattern pieces being cut, these are finished
        prints being shown. */}
    <Path d="M8.5 6V3.5h10v12h-2.5" />
    <Path d="M6 8.5V6h10v12h-2.5" />
    <Path d="M3.5 8.5h10v12h-10z" />
    <Path d="M5.5 17.5h6" />
    <Notch x={17.5} y={8} />
  </Icon>
);

export const IconChats = (p: IconProps) => (
  <Icon {...p}>
    {/* Two paper slips overlapping on the table, each with its one written
        line — a note sent and a note back. No bubble: this house writes
        things down. The slip underneath is interrupted where the reply
        covers it, so the overlap reads as sequence rather than a grid, and
        the two ruled lines sit at opposite offsets the way a transcript
        alternates. */}
    <Path d="M8.5 12.5h-5v-8h12v6" />
    <Path d="M6 8.5h7" />
    <Path d="M8.5 10.5h12v8h-12z" />
    <Path d="M11 14.5h7" />
    <Notch x={14.5} y={8} />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    {/* spool of thread */}
    <Path d="M6.5 4.5h11v15h-11z" />
    <Path d="M6.5 8.5h11M6.5 15.5h11" />
    <Path d="M9.5 8.5v7M14.5 8.5v7" />
    <Notch x={18} y={3.5} />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4.5 12.5l5 5 10-11" />
    <Notch x={18} y={3.5} />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 4.5v15M4.5 12h15" />
    <Notch x={18.5} y={4.5} />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    <Notch x={19.5} y={3} />
  </Icon>
);

/**
 * The filled eyelet — the web's own exception to the stroke grammar
 * (src/components/icons.tsx draws it as a filled 12×12 circle with no
 * notch): it is a pressed mark, not a drawn glyph. Reserved for the seal
 * moment and log-wear buttons, exactly as on the web.
 */
export const IconEyeletFilled = ({ size = 12, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 12 12" accessible={false}>
    <Circle cx="6" cy="6" r="4" fill={color} />
  </Svg>
);
