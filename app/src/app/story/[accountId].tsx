/**
 * THE STORY VIEWER — /story/[accountId], ported from the web's Story
 * (src/pages/Feed.tsx, mirrored by reading).
 *
 * A full-screen route over the tabs. The PAGE is full-bleed; the photograph
 * never is — a look keeps its 4:5 frame on a flat token ground. Nothing is
 * recorded: no seen state, no receipts, no counts. Leaving mid-deck loses
 * nothing because nothing was owed.
 *
 * Progress hairlines: 1px is the letterpress hairline — never thicker. One
 * segment per story of the current teller; no seen-state outlives this
 * screen. Under reduced motion nothing autoplays and nothing animates:
 * segments render discrete and advancing is tap only.
 *
 * THE COMMONS IS AN ISLAND (docs/40 D7): a walk through real wardrobes ends
 * at the feed and never slides into the guest deck uninvited — its slot on
 * the rail is the only door in, and the island holds both ways.
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatLocalDate } from '@almari/shared/dates';
import { FEED_ENABLED } from '@almari/shared/flags';
import type { Account, FeedPost, SharedLook, SharedPiece } from '@almari/shared/types';

import { useCommunity } from '../../components/feed/communityStore';
import { AccountLine, DisplayChip } from '../../components/feed/bits';
import {
  railDecks,
  resolveFeedEntries,
  shortDate,
  type StoryDeck,
} from '../../components/feed/feedResolve';
import { isRenderableImageUri } from '../../components/feed/feedResolve';
import { SpecimenCard } from '../../components/feed/SpecimenCard';
import { IconClose } from '../../icons';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { COMMONS_LABEL, commonsStoriesFor, type NativeBufferEntry } from '../../lib/bufferFeedNative';

const FRAME_MS = 5000;

interface StoryFrame {
  key: string;
  date?: string;
  /** A photograph RN can fetch (a data-URI snapshot, say). */
  uri?: string;
  /** A bundled commons still. */
  source?: ImageSourcePropType;
  /** The typographic specimen, when a snapshot's photograph is out of reach. */
  specimenLook?: SharedLook;
  specimenPiece?: SharedPiece;
  caption?: string;
  ledger: string;
  /** A caption-only post: the words are the look. */
  editorialOnly?: boolean;
}

interface ViewerDeck {
  id: string;
  author: Account | null;
  frames: StoryFrame[];
}

function frameOfPost(post: FeedPost): StoryFrame {
  const when = shortDate(post.date);
  if (post.look) {
    const occasion = post.look.occasion ? ` · ${post.look.occasion}` : '';
    return {
      key: post.id,
      date: post.date,
      uri: isRenderableImageUri(post.look.imageUrl) ? post.look.imageUrl : undefined,
      specimenLook: isRenderableImageUri(post.look.imageUrl) ? undefined : post.look,
      caption: post.caption,
      ledger: `${post.look.name}${occasion} · ${when}`,
    };
  }
  if (post.piece) {
    return {
      key: post.id,
      date: post.date,
      uri: isRenderableImageUri(post.piece.imageUrl) ? post.piece.imageUrl : undefined,
      specimenPiece: isRenderableImageUri(post.piece.imageUrl) ? undefined : post.piece,
      caption: post.caption,
      ledger: `${post.piece.name} · ${when}`,
    };
  }
  return { key: post.id, date: post.date, caption: post.caption, ledger: when, editorialOnly: true };
}

function frameOfCommons(b: NativeBufferEntry): StoryFrame {
  return {
    key: b.id,
    source: b.source,
    caption: b.caption,
    ledger: `${COMMONS_LABEL} · ${b.author} · sample`,
  };
}

export default function Story() {
  // THE FLAG, FIRST LINE (docs/42 §2, native gate 2). The story deck reads
  // the store the feed writes, so it is seated by the same flag; with the
  // Look Book out of the house this season a `/story/…` link handed over by
  // another app lands on Today, silently and without a plaque.
  //
  // Before every hook on purpose: FEED_ENABLED is a module constant, so the
  // branch is fixed for the life of the process.
  if (!FEED_ENABLED) return <Redirect href="/" />;

  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const { community, accounts, activeId } = useCommunity();

  // The clock is read once: a deck must not dissolve under the reader at the
  // stroke of a post's 24th hour.
  const [now] = useState(() => Date.now());
  const today = useMemo(() => formatLocalDate(new Date()), []);

  // Under reduced motion nothing autoplays: segments render discrete, and
  // advancing is tap only (AccessibilityInfo is RN's prefers-reduced-motion).
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const decks = useMemo<ViewerDeck[]>(() => {
    if (community === null) return [];
    const entries = resolveFeedEntries(accounts, community, activeId);
    const wardrobe: ViewerDeck[] = railDecks(entries, activeId, now).map((d: StoryDeck) => ({
      id: d.author.id,
      author: d.author,
      frames: d.posts.map(frameOfPost),
    }));
    const commons = commonsStoriesFor(today).map(frameOfCommons);
    if (commons.length > 0) wardrobe.push({ id: 'commons', author: null, frames: commons });
    return wardrobe;
  }, [accounts, community, activeId, now, today]);

  const startDeck = decks.findIndex(d => d.id === accountId);
  const [pos, setPos] = useState({ deck: -3, frame: 0 });
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);

  // The decks resolve async (the shelf answers first); the start position
  // lands once they exist. -3 is "not placed yet", -2 is "walked past the end".
  useEffect(() => {
    if (pos.deck === -3 && decks.length > 0) {
      setPos({ deck: decks.findIndex(d => d.id === accountId), frame: 0 });
    }
  }, [decks, accountId, pos.deck]);

  const deck = pos.deck >= 0 ? decks[pos.deck] : undefined;
  const frame = deck?.frames[pos.frame];

  const step = (dir: 1 | -1) => {
    setPos(p => {
      const cur = decks[p.deck];
      if (!cur) return p;
      if (dir === 1) {
        if (p.frame + 1 < cur.frames.length) return { deck: p.deck, frame: p.frame + 1 };
        // The commons is an island: a walk through wardrobes ends at the feed
        // and never slides into the guest deck uninvited. Its slot on the rail
        // is the only door in.
        const next = decks[p.deck + 1];
        if (next && next.id !== 'commons') return { deck: p.deck + 1, frame: 0 };
        return { deck: -2, frame: 0 }; // past the final story: close to the feed
      }
      if (p.frame > 0) return { deck: p.deck, frame: p.frame - 1 };
      if (p.deck > 0 && cur.id !== 'commons') return { deck: p.deck - 1, frame: 0 };
      return p; // back past the first story stays put; the island holds both ways
    });
  };

  // Each new frame starts its clock from nothing.
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [pos]);

  // The 5-second hand. Pausing holds the elapsed time; resuming carries on.
  useEffect(() => {
    if (reduced || paused || !frame) return;
    const t0 = Date.now() - elapsedRef.current * FRAME_MS;
    const iv = setInterval(() => {
      const p = (Date.now() - t0) / FRAME_MS;
      elapsedRef.current = p;
      if (p >= 1) step(1);
      else setProgress(p);
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, paused, reduced, frame !== undefined]);

  // Still waiting on the shelf: a blank beat on the deep ground.
  if (community === null || (pos.deck === -3 && decks.length === 0 && startDeck === -1)) {
    return <View style={{ flex: 1, backgroundColor: tokens.bgDeep }} />;
  }
  // A deck that never existed, or the walk reaching past the final story.
  if (startDeck === -1 || decks.length === 0) return <Redirect href="/feed" />;
  if (pos.deck === -2) return <Redirect href="/feed" />;
  if (pos.deck === -3 || !deck || !frame) {
    return <View style={{ flex: 1, backgroundColor: tokens.bgDeep }} />;
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: tokens.bgDeep }]}>
      {/* Progress hairlines. */}
      <View style={styles.progressRow} accessibilityElementsHidden>
        {deck.frames.map((f, i) => (
          <View key={f.key} style={[styles.segment, { backgroundColor: tokens.border }]}>
            <View
              style={[
                styles.segmentFill,
                { backgroundColor: tokens.accent },
                {
                  width:
                    i < pos.frame
                      ? '100%'
                      : i > pos.frame
                        ? '0%'
                        : reduced
                          ? '50%'
                          : `${Math.min(100, progress * 100)}%`,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.headRow}>
        {deck.author ? (
          <View style={styles.headLeft}>
            <AccountLine account={deck.author} meta={shortDate(frame.date)} />
            {deck.author.isSample ? <DisplayChip>sample wardrobe</DisplayChip> : null}
          </View>
        ) : (
          <View style={styles.headLeft}>
            <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text }}>Guests</Text>
            <DisplayChip>{COMMONS_LABEL}</DisplayChip>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <IconClose size={18} color={tokens.text} />
        </Pressable>
      </View>

      {/* The photo band. Holding a finger on it pauses the hand; letting go
          resumes. The two invisible zones walk the deck. */}
      <View style={styles.band}>
        {frame.editorialOnly ? (
          // The words are the look.
          <Text
            style={{
              fontFamily: fonts.displayItalic,
              fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
              fontSize: 22,
              lineHeight: 29,
              color: tokens.text,
              textAlign: 'center',
              maxWidth: 380,
            }}
          >
            {frame.caption}
          </Text>
        ) : (
          <>
            <View style={[styles.plate, { borderColor: tokens.border }]}>
              <View style={[styles.photoFrame, { backgroundColor: tokens.mat }]}>
                {frame.source ? (
                  <Image
                    source={frame.source}
                    style={styles.fill}
                    resizeMode="cover"
                    accessibilityLabel={frame.caption ?? ''}
                  />
                ) : frame.uri ? (
                  <Image
                    source={{ uri: frame.uri }}
                    style={styles.fill}
                    resizeMode="cover"
                    accessibilityLabel={frame.caption ?? ''}
                  />
                ) : (
                  <SpecimenCard
                    look={frame.specimenLook}
                    piece={frame.specimenPiece}
                    author={deck.author ?? undefined}
                  />
                )}
              </View>
            </View>
            {frame.caption ? (
              <Text
                style={{
                  fontFamily: fonts.displayItalic,
                  fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                  fontSize: 20,
                  lineHeight: 26,
                  color: tokens.text,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                }}
              >
                {frame.caption}
              </Text>
            ) : null}
          </>
        )}
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            color: tokens.text2,
            textAlign: 'center',
          }}
        >
          {frame.ledger}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="The look before"
          onPress={() => step(-1)}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          style={styles.zoneLeft}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="The next look"
          onPress={() => step(1)}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          style={styles.zoneRight}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  segment: {
    flex: 1,
    height: 1,
    overflow: 'hidden',
  },
  segmentFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  headRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 44,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  band: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  plate: {
    width: '100%',
    maxWidth: 380,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  zoneLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '33%',
  },
  zoneRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '67%',
  },
});
