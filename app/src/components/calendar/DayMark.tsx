/**
 * THE DAY MARK — the whole visual vocabulary of the calendar, and it is two
 * short rules.
 *
 *   worn     a solid hairline rule in the room's ink — this day is written
 *   planned  the same rule, basted — an intention, not yet sewn down
 *   none     a rule's worth of air, so the numerals never jump between cells
 *
 * WHAT THIS MARK REFUSES TO BE, on purpose:
 *
 *  · NOT CARMINE. docs/42 §6 sketches a "carmine day-mark under logged days";
 *    this draws it in ink instead, and the disagreement is filed in the wave
 *    report rather than smuggled. Brand law 2 gives --color-seal exactly four
 *    surfaces (the wax seal, the wordmark underline, the favicon, the recap
 *    card) and a grid of thirty-one days is not one of them; brand law 3
 *    allows one accent per region, and Today's region already spends its one
 *    on the log-wear fill. The web's own Calendar reached the same place the
 *    hard way and wrote it down (src/pages/Calendar.tsx: "A DAY THAT IS DONE
 *    RECEDES; it is not marked" — the filled accent eyelet it used to carry
 *    was "the brightest thing on the week and said nothing the day's own
 *    contents did not already say").
 *
 *  · NOT A HEATMAP. The mark does not deepen with the number of wears and
 *    does not lighten with age. A month grid whose cells vary by how much was
 *    logged is a chart of how diligent somebody has been, which is the shame
 *    mechanic this app is built against (brand law 11: zero gamification
 *    chrome, only cumulative factual totals). Written or not written; that is
 *    the whole scale.
 *
 * The basted form is drawn as three short Views rather than a dashed border:
 * RN's dashed borders differ between platforms, and this keeps the rhythm of
 * `.basting` in src/index.css (4 on, 3 off) without an SVG that would need to
 * be measured first.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../tokens/ThemeContext';

import type { DayMarkKind } from './month';

const WIDTH = 16;
const HEIGHT = 1.5;

export function DayMark({ kind }: { kind: DayMarkKind }) {
  const { tokens } = useTheme();

  if (kind === 'none') {
    // Air, not nothing: the cell keeps its height so the numerals sit on one
    // line across the week whether or not the days under them were written.
    return <View style={styles.slot} importantForAccessibility="no" />;
  }

  if (kind === 'planned') {
    return (
      <View style={[styles.slot, styles.basted]} importantForAccessibility="no">
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={{ width: 4, height: HEIGHT, backgroundColor: tokens.text2 }}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.slot} importantForAccessibility="no">
      <View style={{ width: WIDTH, height: HEIGHT, backgroundColor: tokens.text }} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: HEIGHT,
    width: WIDTH,
    marginTop: 5,
  },
  basted: {
    flexDirection: 'row',
    // 4 on, 3 off — the rhythm .basting draws on the web.
    gap: 3,
  },
});
