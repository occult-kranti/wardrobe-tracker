/**
 * The typographic specimen — the dignified stand-in for a photograph the
 * phone cannot reach (docs/34 §2.8, the asset seam).
 *
 * Community snapshots carry web-relative photograph paths; RN's Image,
 * handed one, renders nothing, silently. A broken image never ships, so the
 * look is set instead as the house would set it in type: the occasion as a
 * ledger overline, the name in the editorial italic, the pieces as a cutting
 * list, the wearer's line at the foot. Same 4:5 frame, same flat mat ground
 * (nothing decorative behind clothing — brand law 6 — and nothing decorative
 * where a photograph was promised either; type is not decoration here, it is
 * the record).
 */
import { StyleSheet, Text, View } from 'react-native';

import type { Account, SharedLook, SharedPiece } from '@almari/shared/types';

import { useFamilies } from '../../tokens/FontsContext';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { Basting, DisplayChip, Swatch } from './bits';
import { sharedCategoryLabel } from './feedResolve';

const MAX_PIECES = 6;

export function SpecimenCard({
  look,
  piece,
  author,
}: {
  look?: SharedLook;
  piece?: SharedPiece;
  author?: Account;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  const name = look?.name || piece?.name || 'A look';
  const overline = look?.occasion ?? (piece?.category ? sharedCategoryLabel(piece.category) : undefined);
  const pieces = look?.pieces ?? [];
  const shown = pieces.slice(0, MAX_PIECES);
  const rest = pieces.length - shown.length;

  return (
    <View
      testID="specimen-card"
      style={[styles.frame, { backgroundColor: tokens.mat }]}
    >
      {overline ? (
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            textTransform: 'uppercase',
            color: tokens.text2,
            textAlign: 'center',
          }}
        >
          {overline}
        </Text>
      ) : null}

      <View style={styles.center}>
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fonts.displayItalic,
            fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
            fontSize: 24,
            lineHeight: 30,
            color: tokens.text,
            textAlign: 'center',
          }}
        >
          {name}
        </Text>

        {shown.length > 0 ? (
          <>
            <Basting marginVertical={14} />
            {shown.map(p => (
              <Text
                key={p}
                numberOfLines={1}
                style={{
                  fontFamily: fonts.mono,
                  fontSize: TYPE.ledgerMeta,
                  letterSpacing: TYPE.ledgerSpacing,
                  color: tokens.text2,
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                {p}
              </Text>
            ))}
            {rest > 0 ? (
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: TYPE.ledgerMeta,
                  letterSpacing: TYPE.ledgerSpacing,
                  color: tokens.text2,
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                and {rest} more
              </Text>
            ) : null}
          </>
        ) : null}

        {piece ? (
          <View style={styles.pieceRow}>
            {piece.color ? <Swatch color={piece.color} /> : null}
            {piece.category ? <DisplayChip>{sharedCategoryLabel(piece.category)}</DisplayChip> : null}
          </View>
        ) : null}
      </View>

      {author ? (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            textTransform: 'uppercase',
            color: tokens.text2,
            textAlign: 'center',
          }}
        >
          worn by {author.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    paddingVertical: 20,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  center: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  pieceRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
