/**
 * What rides along with a message — a look, or a piece, as a SNAPSHOT.
 *
 * SOURCE OF TRUTH: src/components/social.tsx LookCard (compact) and
 * PieceCard. Same anatomy: a 4:5 thumb on the flat mat (nothing decorative
 * behind a photograph — brand law 6), the name at 14, the ledger line under
 * it. Hairline border, radius 2, no shadow.
 *
 * THE ASSET SEAM, handled rather than hidden: seeded snapshots carry the
 * web's relative photo paths ('wardrobe/...'), which native cannot resolve
 * (docs/34 §2.8 — the web serves them by URL, native must bundle). A path
 * that is not a real URI renders as the flat mat, exactly what the web
 * shows for a look never photographed.
 */
import { Image, StyleSheet, Text, View } from 'react-native';

import type { SharedLook, SharedPiece } from '@almari/shared/types';

import { sharedCategoryLabel } from './format';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** Only a scheme the phone can actually fetch earns an <Image>. */
export function isRenderableUri(url: string | undefined): url is string {
  return !!url && /^(https?|data|file|content|asset):/.test(url);
}

function Thumb({ imageUrl, width }: { imageUrl?: string; width: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width,
        aspectRatio: 4 / 5,
        backgroundColor: tokens.mat,
        overflow: 'hidden',
      }}
    >
      {isRenderableUri(imageUrl) ? (
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : null}
    </View>
  );
}

export function LookLine({ look }: { look: SharedLook }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  // A snapshot with no piece list must never throw — the web learned this
  // the hard way (social.tsx LookCard).
  const name = look.name || 'A look';
  return (
    <View style={[styles.card, { borderColor: tokens.border }]}>
      <Thumb imageUrl={look.imageUrl} width={64} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text }}>
          {name}
        </Text>
        {look.occasion ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              color: tokens.text2,
              marginTop: 4,
            }}
          >
            {look.occasion}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function PieceLine({ piece }: { piece: SharedPiece }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={[styles.card, { borderColor: tokens.border }]}>
      <Thumb imageUrl={piece.imageUrl} width={56} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text }}>
          {piece.name || 'A piece'}
        </Text>
        {piece.category ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              color: tokens.text2,
              marginTop: 4,
            }}
          >
            {sharedCategoryLabel(piece.category)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    overflow: 'hidden',
    maxWidth: 280,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingRight: 12,
  },
});
