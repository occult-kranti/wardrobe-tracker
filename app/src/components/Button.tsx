/**
 * The house button — ports the tone map of src/components/ui.tsx
 * (`toneClasses` + `buttonClass`) into RN. The law travels intact:
 *
 *  - 44px is the floor, not 40 — compact narrows padding, never hit area.
 *  - radius 2; depth is a hairline border, never a shadow.
 *  - the label is type-label: 13px, 600, uppercase — the interactive floor.
 *  - `hero` is the reserved accent fill: LOG-WEAR ACTIONS ONLY (brand
 *    laws 3 and 11). `primary` is the ink fill; `secondary` the outline;
 *    `tertiary` quiet underlined text.
 *
 * What did not travel: the press tick (src/lib/sound.ts is WebAudio) and
 * the hover underline-weave — hover is not a phone gesture; press states
 * collapse to opacity, which is the reduced-motion story the web already
 * accepts.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export type ButtonTone = 'primary' | 'hero' | 'secondary' | 'tertiary';

export function Button({
  tone = 'secondary',
  compact,
  disabled,
  icon,
  onPress,
  children,
}: {
  tone?: ButtonTone;
  compact?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onPress: () => void;
  children: string;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  const ground =
    tone === 'primary'
      ? { backgroundColor: tokens.inkFill }
      : tone === 'hero'
        ? { backgroundColor: tokens.accentFill }
        : tone === 'secondary'
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.text }
          : null;
  const ink =
    tone === 'primary'
      ? tokens.onInk
      : tone === 'hero'
        ? tokens.onAccent
        : tone === 'secondary'
          ? tokens.text
          : tokens.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone !== 'tertiary' && (compact ? styles.compact : styles.roomy),
        ground,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.85 },
      ]}
    >
      {icon}
      <Text
        style={{
          fontFamily: fonts.ui,
          fontSize: TYPE.label,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: TYPE.labelSpacing,
          color: ink,
          textDecorationLine: tone === 'tertiary' ? 'underline' : 'none',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS,
    paddingHorizontal: 4,
  },
  roomy: {
    paddingHorizontal: 20,
  },
  compact: {
    paddingHorizontal: 12,
  },
});
