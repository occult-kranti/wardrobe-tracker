/**
 * The small cloth the feed is sewn from — display chip, basting rule,
 * colour swatch, account tag and account line. Native twins of pieces in
 * src/components/ui.tsx, src/components/art.tsx and src/components/social.tsx
 * (mirrored by reading; web files never cross into app/).
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { Account } from '@almari/shared/types';

import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { accountColor, shortDate } from './feedResolve';

/**
 * A non-interactive tag chip — the web's `<Chip as="span">`, which the sample
 * label and the scope label wear. Display only, so it may sit under 44px;
 * the text itself holds the 13px floor.
 */
export function DisplayChip({ children }: { children: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={[styles.displayChip, { borderColor: tokens.border }]}>
      <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.label, color: tokens.text2 }}>
        {children}
      </Text>
    </View>
  );
}

/** Basting-stitch divider — replaces every generic rule (web .basting). */
export function Basting({ marginVertical = 12 }: { marginVertical?: number }) {
  const { tokens } = useTheme();
  return (
    <View style={{ marginVertical, height: 1 }} accessibilityElementsHidden>
      <Svg width="100%" height="1">
        <Line
          x1="0"
          y1="0.5"
          x2="100%"
          y2="0.5"
          stroke={tokens.border}
          strokeWidth="1"
          strokeDasharray="6 4"
        />
      </Svg>
    </View>
  );
}

/** A colour as a fact about cloth: a small swatch plate, hairline-bordered. */
export function Swatch({ color, size = 12 }: { color: string; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS,
        backgroundColor: color,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tokens.border,
      }}
    />
  );
}

/**
 * A garment tag bearing a monogram — never a face, never a body. Restates the
 * front tag of the web's TagPortrait (src/components/art.tsx): the tag shape
 * with its punched eyelet, the wardrobe's own thread colour on the eyelet
 * ring, the monogram in the display face. Portrait paths in a snapshot are
 * web-relative and unreachable here, so the tag is the one mark.
 */
export function AccountMark({ account, size = 26 }: { account: Account; size?: number }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const thread = accountColor(account.color, tokens);
  const h = size * 1.25;
  return (
    <View style={{ width: size, height: h }} accessibilityElementsHidden>
      <Svg width={size} height={h} viewBox="0 0 40 50">
        <Path
          d="M5 10.5 13.5 2h13L35 10.5v34.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
          fill={tokens.sunken}
          stroke={tokens.text}
          strokeWidth={1.5}
          strokeLinejoin="miter"
        />
        <Circle cx="20" cy="7.5" r="4" stroke={tokens.text} strokeWidth={1} fill="none" />
        <Circle cx="20" cy="7.5" r="2.75" stroke={thread} strokeWidth={1.75} fill="none" />
      </Svg>
      {/* RN text over the Svg: custom faces render reliably here, not in Svg text. */}
      <View style={styles.monogramWrap} pointerEvents="none">
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: size * 0.42,
            color: tokens.text,
            textAlign: 'center',
          }}
        >
          {account.monogram}
        </Text>
      </View>
    </View>
  );
}

/**
 * Who and when — the tag, the name, the handle with the day in ledger mono.
 * The web's AccountLine links to a profile; there is no profile room in this
 * build, so the line is a statement, not a door.
 */
export function AccountLine({ account, meta }: { account: Account; meta?: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={styles.accountLine}>
      <AccountMark account={account} size={26} />
      <View style={styles.accountText}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text }}
        >
          {account.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            color: tokens.text2,
          }}
        >
          {account.handle}
          {meta ? ` · ${meta}` : ''}
        </Text>
      </View>
    </View>
  );
}

/** The line most callers want: the account against a post's day. */
export function accountMeta(date: string | undefined): string | undefined {
  const d = shortDate(date);
  return d === '' ? undefined : d;
}

const styles = StyleSheet.create({
  displayChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  accountLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    flexShrink: 1,
    minWidth: 0,
  },
  accountText: {
    flexShrink: 1,
    minWidth: 0,
  },
  monogramWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
});
