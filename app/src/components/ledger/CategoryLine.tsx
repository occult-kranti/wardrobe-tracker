/**
 * ONE CATEGORY'S LINE — a bar off a hairline axis, ink throughout.
 *
 * Ports the web Ledger's `BarRow`, including the correction written into it:
 * THERE IS NO HERO BAR. Colouring the largest category singles one out, and
 * focus-group §2.6 says every category gets identical visual weight — dresses
 * are never rendered softer, rounder or pinker. In the dark rooms the accent
 * resolves to a chalk red, so the singled-out row was rendered literally
 * pinker. Every bar here is `tokens.text`, and no bar is ever a warning
 * colour: this room has no alarm states at all.
 *
 * THE BAR AND THE NUMERAL ARE THE SAME QUANTITY. The web's own bug here was a
 * bar drawn from piece counts under a label that read wears — four categories
 * holding three pieces each drew identical bars against 29, 77, 90 and 135
 * wears. One `value` prop feeds both, so they cannot disagree.
 *
 * A QUIET CATEGORY IS QUIET, NEVER SCOLDED. A category with no wears yet draws
 * no bar and states its count in the same ink as every other line — no dash,
 * no muted row, no prompt to do something about it. It is a balance, not a
 * chore.
 */
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { useFamilies } from '../../tokens/FontsContext';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export function CategoryLine({
  label,
  wears,
  pieces,
  max,
}: {
  label: string;
  wears: number;
  pieces: number;
  max: number;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  // A category that has done something gets a visible bar even at 1 of 400 —
  // a sliver is a fact, a zero-width bar is a rendering failure. A category
  // that has done nothing gets nothing, because there is nothing to draw.
  const share = max > 0 ? (wears / max) * 100 : 0;
  const width: DimensionValue = wears > 0 ? `${Math.max(share, 1.5)}%` : 0;

  const meta = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  return (
    <View
      // One line, one announcement. Without `accessible` a screen reader reads
      // the label, the numeral and the aside as three separate stops, and the
      // bar between them as a fourth — a category line said four times.
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${wears} ${wears === 1 ? 'wear' : 'wears'}, ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`}
      style={styles.row}
    >
      <Text numberOfLines={1} style={[meta, styles.label]}>
        {label}
      </Text>
      <View style={[styles.track, { borderLeftColor: tokens.border }]}>
        <View style={[styles.bar, { backgroundColor: tokens.text, width }]} />
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.text }}>{wears}</Text>
      <Text style={[meta, styles.aside]} numberOfLines={1}>
        {pieces} {pieces === 1 ? 'piece' : 'pieces'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 36,
  },
  label: {
    width: 96,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingVertical: 3,
  },
  bar: {
    height: 8,
  },
  aside: {
    width: 62,
    textAlign: 'right',
    flexShrink: 0,
  },
});
