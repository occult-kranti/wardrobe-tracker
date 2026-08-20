/**
 * A branded placeholder — the Phase 1 skeleton's screen body.
 *
 * Masthead over the double rule, then a plate (hairline border, radius 2 —
 * depth is borders here, never shadows: brand law 5) carrying the empty-state
 * line in the editorial italic at 20px, the web's own empty-state anatomy.
 * Each real screen replaces its placeholder by porting the web page named in
 * docs/34 §2.2; nothing on these screens is re-designed from memory.
 */
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Masthead } from './Masthead';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export function PlaceholderScreen({
  title,
  meta,
  line,
  body,
}: {
  title: string;
  meta?: string;
  /** The editorial line — dry, exact, addressed to the clothes. */
  line: string;
  body: string;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.page}>
        <Masthead title={title} meta={meta} />
        <View
          style={[
            styles.plate,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text
            style={{
              fontFamily: fonts.displayItalic,
              fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
              fontSize: TYPE.editorial,
              color: tokens.text,
              marginBottom: 8,
            }}
          >
            {line}
          </Text>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.body,
              lineHeight: Math.round(TYPE.body * 1.5),
              color: tokens.text2,
            }}
          >
            {body}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
  },
});
