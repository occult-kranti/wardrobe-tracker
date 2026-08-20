/**
 * The masthead — ports the web's Masthead in src/components/ui.tsx.
 *
 * Fraunces at 28px (the phone size the web states), over the double rule:
 * 2px in the room's ink, a 3px gap, then a 1px line at 55% — real geometry,
 * not a shadow, exactly as src/index.css draws .rule-double. The meta line
 * is ledger mono at 11px: non-interactive metadata only (brand law 7).
 */
import { StyleSheet, Text, View } from 'react-native';

import { useFamilies } from '../tokens/FontsContext';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export function Masthead({ title, meta }: { title: string; meta?: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { borderBottomColor: tokens.text }]}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: TYPE.masthead,
            lineHeight: Math.round(TYPE.masthead * 1.1),
            letterSpacing: -0.01 * TYPE.masthead,
            color: tokens.text,
          }}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              textTransform: 'uppercase',
              color: tokens.text2,
              paddingBottom: 4,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {/* the thin second rule, floated 3px below the 2px one */}
      <View style={[styles.thinRule, { backgroundColor: tokens.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
  thinRule: {
    marginTop: 3,
    height: 1,
    opacity: 0.55,
  },
});
