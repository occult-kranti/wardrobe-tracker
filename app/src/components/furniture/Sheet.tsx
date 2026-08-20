/**
 * The bottom plate the dressing room's two sheets sit on.
 *
 * The same object the closet's detail and add sheets use (app/src/app/(tabs)/
 * closet.tsx) — hairline edge, radius 2, no shadow, a scrim you can tap to
 * leave. It is restated here rather than imported because the closet's copy is
 * a private helper inside a route file; promoting one of the two to
 * app/src/components/Sheet.tsx is a tidy-up for whoever owns that file next,
 * and is named in this squad's report.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';

export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** What closing this sheet is called, for the screen reader. */
  label?: string;
  children: ReactNode;
}) {
  const { tokens } = useTheme();
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label ?? 'Close'}
          style={{ flex: 1 }}
          onPress={onClose}
        />
        <View style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '88%',
  },
});
