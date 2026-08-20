/**
 * The identity mark — a garment tag bearing a monogram. Never a face,
 * never a body (toile-social law 5).
 *
 * SOURCE OF TRUTH: src/components/art.tsx TagPortrait. This is the front
 * tag of that drawing with its eyelet and its thread-twirl, on the same
 * geometry (the tag path, the eyelet at 20,7.5, the monogram baseline at
 * 32). What is deliberately not ported: the second care-tag tilted behind
 * it — one tag reads at 26px in a chat row where two would smudge.
 *
 * The web strokes in CSS variables; native resolves the registry's token
 * names against the room's own tokens — never a raw hex at a call site.
 */
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { useFamilies } from '../../tokens/FontsContext';
import { useTheme } from '../../tokens/ThemeContext';
import type { ThemeTokens } from '../../tokens/themes';

/**
 * The registry stores account colours as the web writes them — token names
 * like 'var(--color-accent)' (SessionContext's ACCOUNT_COLORS) — or a plain
 * hex for a colour somebody picked. Token names resolve to the room; an
 * unknown token falls to gold, the tag-thread's own default on the web.
 */
export function resolveAccountColor(value: string | undefined, tokens: ThemeTokens): string {
  if (!value) return tokens.gold;
  const named = /^var\(--color-([a-z0-9-]+)\)$/.exec(value.trim());
  if (!named) return value;
  switch (named[1]) {
    case 'accent':
      return tokens.accent;
    case 'success':
      return tokens.success;
    case 'warning':
      return tokens.warning;
    case 'gold':
      return tokens.gold;
    case 'seal':
      return tokens.seal;
    default:
      return tokens.gold;
  }
}

export function TagMark({
  monogram,
  color,
  size = 28,
}: {
  monogram: string;
  color?: string;
  size?: number;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const thread = resolveAccountColor(color, tokens);

  return (
    <Svg
      width={size}
      height={size * 1.55}
      viewBox="-11 -14 53 62"
      accessible={false}
    >
      {/* the wardrobe's own tag */}
      <Path
        d="M5 10.5 13.5 2h13L35 10.5v34.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
        fill={tokens.sunken}
        stroke={tokens.text}
        strokeWidth={1.5}
        strokeLinejoin="miter"
      />
      {/* the ink rim keeps the gold from sinking into light grounds */}
      <Circle cx="20" cy="7.5" r="4" stroke={tokens.text} strokeWidth={1} fill="none" />
      <Circle cx="20" cy="7.5" r="2.75" stroke={tokens.gold} strokeWidth={1.75} fill="none" />
      <SvgText
        x="20"
        y="32"
        textAnchor="middle"
        fill={tokens.text}
        fontSize={13}
        fontWeight="700"
        fontFamily={fonts.display}
        letterSpacing={0.26}
      >
        {monogram}
      </SvgText>
      {/* the twirl, in this wardrobe's own thread */}
      <Path
        d="M20 3.3C20 -1.2 16.1 -3.2 13.4 -5.5 9.3 -7.9 9.5 -11.9 13 -12.8c3.2-.8 5.4 2 4.6 4.6"
        stroke={thread}
        strokeWidth={1.3}
        strokeLinecap="butt"
        fill="none"
      />
    </Svg>
  );
}
