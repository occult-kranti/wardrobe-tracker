/**
 * One message in a thread — the web's row anatomy, not a phone bubble:
 * the author's tag mark, a ledger line (name · date), the words at body
 * size, and whatever rides along under them.
 *
 * SOURCE OF TRUTH: src/pages/Chats.tsx ChatThread's message list. A borrow
 * request renders as its own hairline plate with the piece and its status
 * in the ledger — "Staying home" is a neutral fact, never alarm-styled
 * (toile-social law 8).
 *
 * THE SEAM IS CLOSED: the provider carries loans now (recordLoan/closeLoan),
 * so a request the open wardrobe may answer carries its actions. The plate
 * and its entitlement rule live in RequestPlate; this row only says who is
 * reading and how to advance, because a message knows neither.
 *
 * `activeId` and `onAdvance` are optional on purpose — a row rendered
 * without them is the read-only plate, which is what a list preview wants.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { BorrowStatus, ChatMessage } from '@almari/shared/types';

import { LookLine, PieceLine } from './AttachmentLines';
import { shortDate } from './format';
import { RequestPlate } from './RequestPlate';
import { TagMark } from './TagMark';
import type { ChatAccount } from './store';
import { useFamilies } from '../../tokens/FontsContext';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export function MessageRow({
  message,
  author,
  activeId,
  onAdvance,
}: {
  message: ChatMessage;
  author?: ChatAccount;
  /** The open wardrobe — who is reading this row. */
  activeId?: string | null;
  onAdvance?: (message: ChatMessage, status: BorrowStatus) => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <View style={styles.row}>
      {author ? <TagMark monogram={author.monogram} color={author.color} size={24} /> : null}
      <View style={styles.body}>
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            color: tokens.text2,
          }}
        >
          {author?.name ?? 'Someone'} · {shortDate(message.date)}
        </Text>
        {message.text ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.body,
              lineHeight: Math.round(TYPE.body * 1.45),
              color: tokens.text,
              marginTop: 4,
            }}
          >
            {message.text}
          </Text>
        ) : null}

        {message.look ? (
          <View style={{ marginTop: 8 }}>
            <LookLine look={message.look} />
          </View>
        ) : null}
        {message.piece ? (
          <View style={{ marginTop: 8 }}>
            <PieceLine piece={message.piece} />
          </View>
        ) : null}

        {message.request ? (
          <RequestPlate
            request={message.request}
            askerId={message.authorId}
            activeId={activeId}
            onAdvance={onAdvance ? status => onAdvance(message, status) : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
});
