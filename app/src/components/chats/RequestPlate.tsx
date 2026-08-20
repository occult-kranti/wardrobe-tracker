/**
 * A borrow request, as its own hairline plate — the piece, its status, and
 * whatever the OPEN wardrobe is actually entitled to do about it.
 *
 * SOURCE OF TRUTH: src/pages/Chats.tsx (the request block and `advance`).
 * The status words are the web's, byte for byte, through format.ts
 * STATUS_LABELS: Asked / Lent / Staying home / Home again. "Staying home"
 * is a neutral fact and is never alarm-styled — a piece not going out is
 * not a verdict on whoever asked (toile-social law 8). Nothing here counts
 * anything: a request has no tally, no badge, no elapsed-days nag.
 *
 * THE PLATE IS NOT THE LEDGER. Pressing an action moves the status on the
 * shared shelf AND asks the wardrobe provider to write the loan; both halves
 * live in the screen (chats/[id].tsx), which is the only place that knows
 * which wardrobe is open. This file decides only what may be offered.
 *
 * WHY A ROW OF ITS OWN, not the web's `ml-auto` tail: the web records that
 * the "Lend it / It stays home" pair needs 232px and has 229px at 390px
 * wide, and wraps to survive it. A phone is narrower still and the buttons
 * carry a 44px floor, so the actions get their own line under the fact
 * rather than fighting the piece name for the same one.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { BorrowStatus, ChatMessage } from '@almari/shared/types';

import { STATUS_LABELS } from './format';
import { Button } from '../Button';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export interface RequestAction {
  label: string;
  status: BorrowStatus;
}

/**
 * What the open wardrobe may do to this request. A pure function so the
 * entitlement rule can be read — and tested — without a renderer.
 *
 * ASKED → the OWNER alone answers. Only the owner may lend (toile-social,
 * the four verbs), so a borrower looking at their own ask sees the status
 * and nothing else; there is no button that lets someone lend to themselves.
 * The pair is quiet and unweighted: "It stays home" is the same size and the
 * same tone as "Lend it", because declining is not the lesser answer.
 *
 * LENT → EITHER PARTY marks it home. A return is a thing both people watch
 * happen, not a permission one of them grants, so the borrower handing the
 * coat back may say so. The screen aims closeLoan at the counterparty on the
 * far side of the request, which closes the owner's lent-out row from the
 * owner's side and the borrower's borrowed row from theirs. A borrower whose
 * rail never recorded the borrowing gets nothing invented for them — the web
 * never writes the borrower's half of a loan and neither does this.
 *
 * A BYSTANDER IN A GROUP sees no buttons at all: a request is between two
 * wardrobes even when it is written in a room of five.
 *
 * DECLINED and RETURNED are terminal here, exactly as on the web. Re-asking
 * is a new ask, which keeps the record of what was answered when.
 *
 * An `ownerId` that is missing (a request written before the field existed)
 * yields no actions rather than a guess about whose piece it is.
 */
export function requestActions(
  request: NonNullable<ChatMessage['request']>,
  askerId: string,
  activeId: string | null | undefined,
): RequestAction[] {
  if (!activeId || !request.ownerId) return [];
  const isOwner = request.ownerId === activeId;
  if (request.status === 'asked') {
    return isOwner
      ? [
          { label: 'Lend it', status: 'lent' },
          { label: 'It stays home', status: 'declined' },
        ]
      : [];
  }
  if (request.status === 'lent') {
    return isOwner || askerId === activeId ? [{ label: 'Mark it home', status: 'returned' }] : [];
  }
  return [];
}

export function RequestPlate({
  request,
  askerId,
  activeId,
  onAdvance,
}: {
  request: NonNullable<ChatMessage['request']>;
  /** Who wrote the ask — the borrowing side of this request. */
  askerId: string;
  activeId?: string | null;
  onAdvance?: (status: BorrowStatus) => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  // No handler, no offer: a plate rendered read-only cannot grow a button.
  const actions = onAdvance ? requestActions(request, askerId, activeId) : [];

  return (
    <View style={[styles.plate, { borderColor: tokens.border }]}>
      <View style={styles.fact}>
        <Text
          style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text, flexShrink: 1 }}
        >
          {request.pieceName}
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
          {STATUS_LABELS[request.status] ?? request.status}
        </Text>
      </View>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(action => (
            <Button key={action.status} compact onPress={() => onAdvance?.(action.status)}>
              {action.label}
            </Button>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    gap: 10,
  },
  fact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
});
