/**
 * THE LEDGER'S PLATES — the small cloth the arithmetic is set on.
 *
 * These are the House's own three (`Stat`, `SectionTitle`, the bordered row),
 * mirrored rather than imported: they live as local functions inside
 * `app/src/app/(tabs)/profile.tsx`, which this squad does not own. The
 * geometry is copied to the pixel — 32/34 Fraunces over an 11px mono label,
 * hairline border, radius 2, no shadow — so the Ledger's what-it-cost plate
 * and the House's read as the same object in two rooms, which is the point.
 * When the House's twins are lifted into a shared file, these are the ones to
 * lift; nothing here knows anything about the Ledger.
 *
 * A STAT'S VALUE IS ALWAYS A STRING, and that is deliberate. Every figure this
 * room prints has already been through `@almari/shared/cost`'s formatters or
 * `toLocaleString('en-IN')`; a component that accepted a number could format
 * one itself, and then there would be two opinions about ₹ again.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** A bordered sheet of the room's own paper. Depth is a hairline, never a shadow. */
export function Plate({ children, tone = 'surface' }: { children: ReactNode; tone?: 'surface' | 'sunken' }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.plate,
        { backgroundColor: tone === 'sunken' ? tokens.sunken : tokens.surface, borderColor: tokens.border },
      ]}
    >
      {children}
    </View>
  );
}

/** The hero numeral over its ledger label — the House's Stat, to the pixel. */
export function Stat({ value, label }: { value: string; label: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={styles.stat}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 32,
          lineHeight: 34,
          color: tokens.text,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          textTransform: 'uppercase',
          color: tokens.text2,
          marginTop: 8,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** The two-column grid the House sets its facts in. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.stats}>{children}</View>;
}

/**
 * A section's name, and optionally the one fact that qualifies it — the web's
 * `SectionTitle aside`, which is where "12 priced pieces" belongs: beside the
 * heading, at metadata size, never inside the sentence.
 */
export function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={ledger}>
        {children}
      </Text>
      {aside ? <Text style={ledger}>{aside}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    width: '50%',
    paddingVertical: 12,
    paddingRight: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 28,
    marginBottom: 8,
  },
});
