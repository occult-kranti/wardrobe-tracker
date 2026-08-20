/**
 * THE SWITCHER SHEET — grab handle, tag rows, "Open another" (docs/42 §4).
 *
 * LIFTED UNCHANGED out of app/src/app/(tabs)/profile.tsx, which is where it was
 * written and where its own note asked for exactly this move. Not one pixel or
 * word of it has changed in the lift: same sheet, same rows, same copy, same
 * ordering. The House still owns when it opens (the bar's long press, the tag
 * portrait); this file owns only what it looks like when it does.
 *
 * It rises like every other sheet in the house: no ceremony, no motif.
 *
 * The rows are FACTS rather than doors, and honestly so: opening a different
 * wardrobe is the door's own work (`/open`), and this build has no native port
 * that switches the open record in place. The moment it lands, each row becomes
 * pressable and nothing else here changes.
 *
 * TWO THINGS TRAVELLED WITH THE SHEET, and neither is a switcher idea:
 * `DoorRow` (the sheet's own last row IS one) and `hallRow`, the row box both
 * the sheet and the hall are drawn on. They are exported so the House imports
 * the one definition back rather than keeping a second copy — a duplicated
 * brand primitive is how the accent ink and the 44dp floor drift apart. When a
 * house-primitives file exists, all three move into it together; that is a
 * one-line follow-up and is named in this squad's report.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Account } from '@almari/shared/types';

import { AccountMark } from './feed/bits';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

/** A registry row, as the shelf keeps it. Account-shaped by contract. */
export interface WardrobeRow {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  color: string;
  createdAt: string;
  isSample?: boolean;
}

/**
 * The hall's row box — hairline edge, radius 2, and a height that clears the
 * 44dp touch floor before any label is set in it. One definition, so the sheet
 * and the hall cannot drift apart.
 */
export const hallRow = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 12,
    marginBottom: 8,
  },
}).row;

/**
 * A door. The label carries the house's link treatment — accent ink, quietly
 * underlined — and the whole row is the target, well past the 44dp floor.
 */
export function DoorRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        hallRow,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        pressed && { backgroundColor: tokens.sunken },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.ui,
          fontSize: TYPE.body,
          color: tokens.accent,
          textDecorationLine: 'underline',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function WardrobeSwitcher({
  open,
  rows,
  activeId,
  onClose,
  onOpenAnother,
}: {
  open: boolean;
  rows: WardrobeRow[];
  activeId: string | null;
  onClose: () => void;
  onOpenAnother: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: `${tokens.bgDeep}CC` }]}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {/* the grab handle */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.grab, { backgroundColor: tokens.border }]}
          />
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              textTransform: 'uppercase',
              color: tokens.text2,
              marginBottom: 12,
            }}
          >
            Wardrobes on this device
          </Text>
          <ScrollView>
            {rows.map(row => (
              <View key={row.id} style={styles.switcherRow}>
                <AccountMark account={row as Account} size={26} />
                <View style={{ flexShrink: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fonts.ui, fontSize: TYPE.body, color: tokens.text }}
                  >
                    {row.name}
                  </Text>
                  {row.id === activeId ? (
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: TYPE.ledgerMeta,
                        letterSpacing: TYPE.ledgerSpacing,
                        textTransform: 'uppercase',
                        color: tokens.text2,
                        marginTop: 2,
                      }}
                    >
                      Open now
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
          <DoorRow label="Open another" onPress={onOpenAnother} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  grab: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderRadius: RADIUS,
    marginBottom: 16,
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 8,
  },
});
