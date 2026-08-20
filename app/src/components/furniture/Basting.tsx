/**
 * The basting rule — the house's own "not yet sewn down" mark, as a divider.
 *
 * src/index.css draws `.basting` as a dashed 1px rule in the border token.
 * RN's dashed borders are inconsistent across platforms, so it is drawn: one
 * line, the same dash the plates use.
 */
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useTheme } from '../../tokens/ThemeContext';

export function Basting({ width, style }: { width: number; style?: object }) {
  const { tokens } = useTheme();
  return (
    <View style={[{ height: 2, width }, style]}>
      <Svg width={width} height={2} accessible={false}>
        <Line
          x1={0}
          y1={1}
          x2={width}
          y2={1}
          stroke={tokens.border}
          strokeWidth={1}
          strokeDasharray={[4, 3]}
        />
      </Svg>
    </View>
  );
}
