/**
 * ONE PIECE ON THE LIST.
 *
 * Ports the web's WishCard (src/pages/Wishlist.tsx). The card carries the
 * facts — what it is, what kind, whose, what it costs, when it was noted — and
 * exactly as many verbs as its state has earned.
 *
 * THE ASK, ONCE. When the wait has run out and the card has not asked yet, it
 * asks: three choices of IDENTICAL WEIGHT, none styled as the right answer.
 * That equality is the whole design (docs/06 §1 row 7) and it is why all three
 * are the outline tone and none is a fill — a primary among them would be the
 * app having an opinion about somebody's money.
 *
 * A CARD MID-WAIT OFFERS NOTHING TO ANSWER. It will be asked when the wait is
 * up, and until then the only thing it says is one quiet mono line. No badge,
 * no count on any door, no notification. The silence IS the intervention, and
 * a card that offered "let it go" during the wait would be the app leaning.
 *
 * NO FILLS REPEAT HERE. A browse list of repeating cards each carrying an
 * accent fill is how a page ends up with twenty of them and no hierarchy at
 * all (squad C's note in the Looks room). Brand law 3 is a rule of scarcity:
 * the one primary on this view belongs to the empty state's invitation, and
 * every control on a card is outline or quiet text.
 *
 * NOTHING DECORATIVE BEHIND THE THUMBNAIL (brand law 6): the room's mat, a
 * hairline, radius 2, and the colour the piece would be. A wish carries a
 * photograph only when one arrived from the browser, and the colourless state
 * is first-class — never a camera glyph asking to be filled in.
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIORITY_LABELS, type WishlistItem } from '@almari/shared/types';

import { Button } from '../Button';
import { IconClose } from '../../icons';
import { photoUri } from '../../lib/photos';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
// Basting has no canonical home yet the way Sheet now does (R8) — it is
// still the dressing room's drawing, and reaching across for it beats a fourth
// copy of one dashed line. A promotion to components/Basting.tsx is the same
// one-line follow-up components/Sheet.tsx names, and is in this squad's report.
import { Basting } from '../furniture/Basting';
import { isAsking, isMidWait, metaLine, notedLine, waitLine } from './list';

/** The wish's own colour, or its photograph if one travelled with it. */
function Thumb({ item, size }: { item: WishlistItem; size: number }) {
  const { tokens } = useTheme();
  // `imageUrl` holds a path under the document directory on native and a data:
  // URI in a document the web app wrote (lib/photos.ts states the seam), so one
  // call answers for both and answers null for anything it cannot read.
  const uri = item.imageUrl ? photoUri(item.imageUrl) : null;
  return (
    <View
      style={{
        width: size,
        height: Math.round(size * 1.25),
        borderRadius: RADIUS,
        backgroundColor: tokens.mat,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tokens.border,
      }}
    >
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: item.color }} />
      )}
    </View>
  );
}

/**
 * A tag, not a button. The web writes this as `<Chip as="span">`; the native
 * Chip is always a Pressable, and labelling a fact as a control is how a
 * screen reader ends up promising a tap that does nothing.
 */
function Tag({ children }: { children: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={[styles.tag, { borderColor: tokens.border }]}>
      <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.label, color: tokens.text }}>
        {children}
      </Text>
    </View>
  );
}

export interface WishActions {
  onKeep: () => void;
  onRelease: () => void;
  /** It came home — the wish becomes a piece in the closet. */
  onPromote: () => void;
  onAmend: () => void;
  onRemove: () => void;
}

export function WishCard({
  item,
  categoryName,
  width,
  actions,
}: {
  item: WishlistItem;
  categoryName: string;
  /** The card's own width, for the basting rule that has to be drawn. */
  width: number;
  actions: WishActions;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  const asking = isAsking(item);
  const midWait = isMidWait(item);
  const line = waitLine(item);
  const meta = metaLine(item, categoryName);
  const noted = notedLine(item);
  const answered = item.status === 'let-go' || item.status === 'bought';

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: tokens.text2,
  };

  // The rule is drawn, so it needs a number. The card's own padding, both
  // sides, taken off the width it was given.
  const ruleWidth = Math.max(0, width - 32);

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={styles.head}>
        <Thumb item={item} size={68} />

        <View style={styles.facts}>
          <View style={styles.titleRow}>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 16,
                lineHeight: 21,
                color: tokens.text,
                flex: 1,
              }}
            >
              {item.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Take ${item.name} off the list`}
              hitSlop={12}
              onPress={actions.onRemove}
              style={styles.close}
            >
              <IconClose size={16} color={tokens.text2} />
            </Pressable>
          </View>

          {meta ? (
            <Text style={[ledger, { marginTop: 6 }]} numberOfLines={2}>
              {meta}
            </Text>
          ) : null}

          {noted ? <Text style={[ledger, { marginTop: 4 }]}>{noted}</Text> : null}

          <View style={styles.tags}>
            <Tag>{PRIORITY_LABELS[item.priority]}</Tag>
            {item.status === 'bought' ? (
              <Text style={[ledger, { alignSelf: 'center' }]}>In the closet</Text>
            ) : null}
          </View>

          {item.notes ? <Text style={[body, { marginTop: 8 }]}>{item.notes}</Text> : null}

          {/* THE WHOLE OF WHAT A WAIT IS ALLOWED TO SAY. */}
          {line ? <Text style={[ledger, { marginTop: 12 }]}>{line}</Text> : null}
        </View>
      </View>

      {asking ? (
        <>
          <Basting width={ruleWidth} style={{ marginVertical: 16 }} />
          <Text
            style={{
              fontFamily: fonts.displayItalic,
              fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
              fontSize: TYPE.editorial,
              lineHeight: Math.round(TYPE.editorial * 1.3),
              color: tokens.text,
            }}
          >
            Still want this?
          </Text>
          {/* Three choices of identical weight. None of them is the app's. */}
          <View style={styles.ask}>
            <Button tone="secondary" onPress={actions.onKeep}>
              Keep
            </Button>
            <Button tone="secondary" onPress={actions.onRelease}>
              Let it go
            </Button>
            <Button tone="secondary" onPress={actions.onPromote}>
              It came home
            </Button>
          </View>
        </>
      ) : answered ? null : (
        <>
          <Basting width={ruleWidth} style={{ marginVertical: 16 }} />
          <View style={styles.verbs}>
            <Button tone="secondary" compact onPress={actions.onPromote}>
              It came home
            </Button>
            {/* A piece mid-wait keeps its quiet: it will be asked when the wait
                is up, and until then the card offers nothing to answer. */}
            {midWait ? null : (
              <Button tone="secondary" compact onPress={actions.onRelease}>
                Let it go
              </Button>
            )}
            <Button tone="tertiary" onPress={actions.onAmend}>
              Amend
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 16,
  },
  head: {
    flexDirection: 'row',
    gap: 14,
  },
  facts: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  close: {
    // 44 is the floor. The glyph is 16; the target is not.
    width: 44,
    height: 44,
    marginTop: -12,
    marginRight: -12,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  tag: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  ask: {
    marginTop: 14,
    gap: 8,
  },
  verbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
});
