/**
 * One thread on the conversations list.
 *
 * SOURCE OF TRUTH: src/pages/Chats.tsx's thread rows — the other members'
 * tag marks overlapped, the title, the last line as `handle · text`, the
 * date in the ledger. Bordered plate like every native list row.
 *
 * DELIBERATELY NOT PORTED: the web row's trailing `· count` of messages.
 * The social contract for the phone is stricter — no message counts, no
 * unread badges; a thread is a quiet room, not a meter. The date alone
 * says when it was last alive.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TagMark } from './TagMark';
import type { ChatAccount } from './store';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export function ThreadRow({
  title,
  lastLine,
  date,
  others,
  onPress,
}: {
  title: string;
  /** `handle · text` of the last message, or the web's own 'No messages yet'. */
  lastLine: string;
  date: string;
  others: ChatAccount[];
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        pressed && { backgroundColor: tokens.sunken },
      ]}
    >
      <View style={styles.marks}>
        {others.slice(0, 2).map((account, i) => (
          <View key={account.id} style={i > 0 ? { marginLeft: -10 } : null}>
            <TagMark monogram={account.monogram} color={account.color} size={26} />
          </View>
        ))}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.text2, marginTop: 4 }}
        >
          {lastLine}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          color: tokens.text2,
        }}
      >
        {date}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  marks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
});
