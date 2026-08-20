/**
 * The story rail — "On show in the last day" (mirrors the web's StoriesRail
 * in src/pages/Feed.tsx and StorySlot in social.tsx).
 *
 * Membership is computed at render from the same entries the feed shows;
 * nothing is written and nothing expires — after 24 hours only the rail
 * forgets, the feed remembers. Every eyelet wears the same hairline: no
 * seen-state, no dots, no "3 new". The rail's whole grammar is presence.
 *
 * The opening is an EYELET — the brand's one sanctioned circle, scaled up —
 * holding a monogram, never a cropped photograph. The web's waiting slot
 * (a dashed eyelet walking you to your outfits) has no destination in this
 * build and is not drawn; a control that goes nowhere is worse than absence.
 */
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFamilies } from '../../tokens/FontsContext';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { COMMONS_LABEL } from '../../lib/bufferFeedNative';
import type { FeedEntry } from './feedResolve';
import { railDecks } from './feedResolve';

/**
 * /story/[accountId] exists as a route file; the cast covers the gap until
 * the running dev server regenerates .expo/types/router.d.ts.
 */
export const storyHref = (deckId: string): Href => `/story/${deckId}` as Href;

function StorySlot({
  deckId,
  name,
  monogram,
  ariaLabel,
}: {
  deckId: string;
  name: string;
  monogram: string;
  ariaLabel: string;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      onPress={() => router.push(storyHref(deckId))}
      style={styles.slot}
    >
      {/* the outer ring, then the eyelet — both the same letterpress hairline */}
      <View style={[styles.ring, { borderColor: tokens.border }]}>
        <View
          style={[styles.eyelet, { borderColor: tokens.border, backgroundColor: tokens.sunken }]}
        >
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 15,
              letterSpacing: 15 * 0.06,
              color: tokens.text,
            }}
          >
            {monogram}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          color: tokens.text2,
          maxWidth: 64,
          textAlign: 'center',
        }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

export function StoriesRail({
  entries,
  activeId,
  hasGuests,
}: {
  entries: FeedEntry[];
  activeId: string | null;
  hasGuests: boolean;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const decks = railDecks(entries, activeId, Date.now());
  // No qualifying post anywhere and no guests: no rail, no empty chrome.
  if (decks.length === 0 && !hasGuests) return null;

  const mineDeck = decks.find(d => d.author.id === activeId);
  const others = decks.filter(d => d.author.id !== activeId);

  return (
    <View style={styles.wrap}>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          textTransform: 'uppercase',
          color: tokens.text2,
          marginBottom: 8,
        }}
      >
        On show in the last day
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {mineDeck ? (
          <StorySlot
            deckId={mineDeck.author.id}
            name="Yours"
            monogram={mineDeck.author.monogram}
            ariaLabel="Yours — on show in the last day"
          />
        ) : null}
        {others.map(deck => (
          <StorySlot
            key={deck.author.id}
            deckId={deck.author.id}
            name={deck.author.name}
            monogram={deck.author.monogram}
            ariaLabel={
              deck.author.isSample
                ? `${deck.author.name} — sample wardrobe, on show in the last day`
                : `${deck.author.name} — on show in the last day`
            }
          />
        ))}
        {hasGuests ? (
          // The commons keeps the rail company while the room is quiet —
          // labelled guests, never a wardrobe (docs/35, owner decision 3).
          <StorySlot
            deckId="commons"
            name="Guests"
            monogram="CC"
            ariaLabel={`Guests ${COMMONS_LABEL} — samples, on show today`}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  rail: {
    gap: 12,
    paddingBottom: 4,
  },
  slot: {
    width: 64,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyelet: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
