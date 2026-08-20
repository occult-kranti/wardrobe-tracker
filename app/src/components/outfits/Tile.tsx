/**
 * ONE PIECE, AS A FLAT TILE — the only drawing the Looks room does.
 *
 * Brand law 6: nothing decorative behind clothing photographs. The tile is the
 * room's mat, a hairline edge, radius 2, no shadow, and a piece with no
 * photograph shows its own colour on that same mat. The colourless state is
 * not an error, is never labelled a gap, and never carries a camera glyph
 * asking to be filled in — a piece without a photograph is an ordinary piece.
 *
 * `imageUrl` holds a path under the document directory on native and a data:
 * URI in a document synced down from the web (lib/photos.ts states the seam),
 * so one call to photoUri answers for both and answers null for anything it
 * cannot read.
 *
 * The tile is a VIEW, never a button. Where it needs to be pressable — the
 * builder's grid — the press lives on a Pressable wrapping it, so the label,
 * the role and the selected state are stated once, on the control.
 */
import { Image, StyleSheet, View } from 'react-native';

import type { ClothingItem } from '@almari/shared/types';

import { photoUri } from '../../lib/photos';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';

export function Tile({
  item,
  size,
  picked,
}: {
  item: ClothingItem;
  size: number;
  /** Chosen for the look being built — a heavier edge in the room's ink. */
  picked?: boolean;
}) {
  const { tokens } = useTheme();
  const uri = item.imageUrl ? photoUri(item.imageUrl) : null;

  return (
    <View
      // The photograph's own aspect is the web's 4:5 tile.
      style={{
        width: size,
        height: Math.round(size * 1.25),
        borderRadius: RADIUS,
        backgroundColor: tokens.mat,
        overflow: 'hidden',
        borderWidth: picked ? 2 : StyleSheet.hairlineWidth,
        borderColor: picked ? tokens.text : tokens.border,
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
        // The colour is data, not a token — it is what the piece is.
        <View style={{ flex: 1, backgroundColor: item.color }} />
      )}
    </View>
  );
}
