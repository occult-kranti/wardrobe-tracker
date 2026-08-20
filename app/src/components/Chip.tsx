/**
 * The tag chip — ports src/components/ui.tsx's Chip: a hairline-bordered
 * tag at radius 2 whose selected state sinks into the ground (bg-sunken),
 * never a filled accent (one accent per region — brand law 3). Labels hold
 * the 13px interactive floor.
 */
import { Pressable, StyleSheet, Text } from 'react-native';

import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export function Chip({
  selected,
  onPress,
  children,
}: {
  selected?: boolean;
  onPress: () => void;
  children: string;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ selected: selected === true }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? tokens.text : tokens.border,
          backgroundColor: selected ? tokens.sunken : 'transparent',
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.ui,
          fontSize: TYPE.label,
          color: tokens.text,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
});
