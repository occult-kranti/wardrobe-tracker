/**
 * THE GATE — the house confirm, restating the web's ConfirmDialog for the one
 * decision the feed cannot take under a stray tap: taking a look off the feed
 * is reversible only by sharing again, so it is stated plainly and confirmed.
 * A plate on a scrim; depth is the hairline, never a shadow.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../Button';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        // The scrim is the room's deepest ground, thinned — a token, never a raw hex.
        style={[styles.scrim, { backgroundColor: `${tokens.bgDeep}CC` }]}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          // A tap on the plate is not a tap on the scrim.
          onPress={() => undefined}
          style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.text }]}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.label,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: TYPE.labelSpacing,
              color: tokens.text,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.body,
              lineHeight: Math.round(TYPE.body * 1.5),
              color: tokens.text,
              marginTop: 12,
            }}
          >
            {body}
          </Text>
          <View style={styles.row}>
            <Button tone="tertiary" onPress={onClose}>
              Cancel
            </Button>
            <Button tone="primary" onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  plate: {
    width: '100%',
    maxWidth: 420,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
  },
  row: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
});
