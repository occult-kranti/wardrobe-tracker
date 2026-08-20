/**
 * The feed's card — native twin of the web PostCard (src/components/social.tsx,
 * mirrored by reading). One look per card: the photograph or its typographic
 * specimen first at 4:5 in a hairline plate, then who and when, then the
 * caption, then the ledger line. NO metrics anywhere: no counts, no "seen by",
 * no reader-visible marks. The one engagement mechanic is the private
 * set-aside mark, counted nowhere.
 *
 * The image seam (docs/34 §2.8): a snapshot's photograph is rendered only
 * when RN can actually fetch it (isRenderableImageUri); a web-relative path
 * gets the SpecimenCard, never a blank.
 */
import { router, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SCOPE_LABELS, type Account, type FeedPost, type SharedPiece } from '@almari/shared/types';

import { Button } from '../Button';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { AccountLine, Basting, DisplayChip, Swatch, accountMeta } from './bits';
import { isRenderableImageUri, sharedCategoryLabel } from './feedResolve';
import { SpecimenCard } from './SpecimenCard';
import { askHref, attachHref } from './verbs';

/**
 * Toward chats, carrying the web's own params contract (verbs.ts). The cast
 * covers the beat between a route file landing and the dev server
 * regenerating .expo/types/router.d.ts.
 */
function towardChats(kind: 'attach' | 'ask', post: FeedPost) {
  const href = kind === 'ask' ? askHref(post) : attachHref(post);
  if (href) router.push(href as Href);
}

/** A piece on someone else's post — the web's PieceCard, restated small. */
function PieceRow({ piece }: { piece: SharedPiece }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={[styles.pieceRow, { borderColor: tokens.border }]}>
      <View style={[styles.pieceThumb, { backgroundColor: tokens.mat }]}>
        {isRenderableImageUri(piece.imageUrl) ? (
          <Image source={{ uri: piece.imageUrl }} style={styles.fill} resizeMode="cover" />
        ) : piece.color ? (
          <Swatch color={piece.color} size={18} />
        ) : null}
      </View>
      <View style={styles.pieceText}>
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
            }}
          >
            {sharedCategoryLabel(piece.category)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function PostCard({
  post,
  author,
  isMine,
  saved,
  onToggleSave,
  onTakeOff,
}: {
  post: FeedPost;
  author: Account;
  isMine: boolean;
  saved: boolean;
  onToggleSave: () => void;
  onTakeOff: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const look = post.look;
  const pieces = look?.pieces ?? [];
  const subject = look?.name ?? post.piece?.name ?? 'this';

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      {/* The look, first, at 4:5 in its own hairline plate — the specimen is a
          first-class stand-in for a photograph the phone cannot reach. */}
      {look ? (
        <View style={styles.plateWrap}>
          <View style={[styles.plate, { borderColor: tokens.border }]}>
            {isRenderableImageUri(look.imageUrl) ? (
              <Image
                source={{ uri: look.imageUrl }}
                style={styles.lookImage}
                resizeMode="cover"
                accessibilityLabel={look.name}
              />
            ) : (
              <SpecimenCard look={look} author={author} />
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.headLeft}>
            <AccountLine account={author} meta={accountMeta(post.date)} />
            {/* A sample wardrobe says so on every post (docs/35, owner decision 3). */}
            {author.isSample ? <DisplayChip>sample wardrobe</DisplayChip> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? `Put "${subject}" back` : `Set "${subject}" aside`}
            accessibilityState={{ selected: saved }}
            onPress={onToggleSave}
            hitSlop={8}
            style={styles.saveButton}
          >
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: TYPE.label,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: TYPE.labelSpacing,
                color: saved ? tokens.accent : tokens.text2,
                textDecorationLine: 'underline',
              }}
            >
              {saved ? 'Put back' : 'Set aside'}
            </Text>
          </Pressable>
        </View>

        {post.caption ? (
          <Text
            style={{
              fontFamily: fonts.displayItalic,
              fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
              fontSize: 19,
              lineHeight: 25,
              color: tokens.text,
              marginTop: 12,
            }}
          >
            {post.caption}
          </Text>
        ) : null}

        {post.piece ? (
          <View style={{ marginTop: 12 }}>
            <PieceRow piece={post.piece} />
          </View>
        ) : null}

        {look ? (
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              color: tokens.text2,
              marginTop: 12,
              lineHeight: 17,
            }}
          >
            {look.name}
            {look.occasion ? ` · ${look.occasion}` : ''}
            {pieces.length > 0 ? `\n${pieces.join(' · ')}` : ''}
          </Text>
        ) : null}

        {/* The scope chip and the take-down belong to the author alone. */}
        {isMine ? (
          <View style={styles.mineRow}>
            {post.scope.kind !== 'everyone' ? (
              <DisplayChip>{SCOPE_LABELS[post.scope.kind].toLowerCase()}</DisplayChip>
            ) : (
              <View />
            )}
            <Button compact onPress={onTakeOff}>
              Take it off the feed
            </Button>
          </View>
        ) : look || post.piece ? (
          <>
            <Basting marginVertical={12} />
            <View style={styles.verbsRow}>
              {post.piece ? (
                <>
                  <Button compact onPress={() => towardChats('ask', post)}>
                    Ask after it
                  </Button>
                  <Button tone="tertiary" onPress={() => towardChats('attach', post)}>
                    Attach
                  </Button>
                </>
              ) : (
                <Button compact onPress={() => towardChats('attach', post)}>
                  Attach
                </Button>
              )}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  plateWrap: {
    padding: 10,
    paddingBottom: 0,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  lookImage: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  body: {
    padding: 16,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  saveButton: {
    minHeight: 44,
    justifyContent: 'center',
    flexShrink: 0,
  },
  pieceRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  pieceThumb: {
    width: 56,
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceText: {
    flexShrink: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingRight: 12,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  mineRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  verbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
