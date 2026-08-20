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
 * SEAM, recorded: the web shows the owner "Lend it / It stays home / Mark
 * returned" on a request they own, and those write LOANS through the
 * wardrobe provider (recordLoan/closeLoan). The app's provider does not
 * carry loans yet, so the status is read-only here; the buttons arrive with
 * the provider's loan wave rather than half-writing a ledger.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@almari/shared/types';

import { LookLine, PieceLine } from './AttachmentLines';
import { shortDate, STATUS_LABELS } from './format';
import { TagMark } from './TagMark';
import type { ChatAccount } from './store';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export function MessageRow({
  message,
  author,
}: {
  message: ChatMessage;
  author?: ChatAccount;
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
          <View style={[styles.request, { borderColor: tokens.border }]}>
            <Text
              style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text, flexShrink: 1 }}
            >
              {message.request.pieceName}
            </Text>
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: TYPE.ledgerMeta,
                letterSpacing: TYPE.ledgerSpacing,
                textTransform: 'uppercase',
                color: tokens.text2,
              }}
            >
              {/* A status without a label is written as it stands. */}
              {STATUS_LABELS[message.request.status] ?? message.request.status}
            </Text>
          </View>
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
  request: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
});
