/**
 * THE LOOKS ROOM — /outfits. Ports src/pages/Outfits.tsx's saved looks.
 *
 * A look is pieces from this closet that already work together, named once and
 * logged as one gesture afterwards. That is the whole idea, and it is why this
 * room exists as a room: the Closet is the pieces, and a look is a sentence
 * made of them.
 *
 * NO SLOT ON THE HOUSE BAR. The bar holds four rooms this season (docs/42 §1)
 * and looks are reached from inside the Closet, whose Looks rail links here by
 * address only. A pushed route under a header-less stack owes the reader a
 * door out that is not a system gesture, so this screen carries its own — the
 * dressing room's precedent, and the same words.
 *
 * WHAT THIS LIST IS FOR: recognising a look and opening it. The verbs — wear
 * it, amend it, retire it, show it — all live on the look's own screen, where
 * there is exactly one look to be the subject of them. A browse list of
 * repeating cards, each carrying its own row of controls, is how a page ends
 * up with twenty accent fills and no hierarchy at all — brand law 3 is a rule
 * of scarcity, and the reserved fill is `accentFill`, the washing blue. (The
 * web's own note here calls those fills carmine; it is loose with its own law
 * 2 and the word must not travel — carmine is the seal, and the seal paints
 * four things.)
 *
 * WHAT IT WILL NEVER SHOW: which look is worn most, a ratio of looks worn to
 * looks kept, or anything ordered by either. Pinned first and newest next is
 * the whole sort — a league table of somebody's own wardrobe is the surface
 * every review panel vetoed by name.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayTag } from '@almari/shared/types';

import { Button } from '../../components/Button';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { BuildSheet, type LookDraft } from '../../components/outfits/BuildSheet';
import { CLOSET, lookHref } from '../../components/outfits/addresses';
import { useOutfits } from '../../components/outfits/contract';
import { ledgerLine, membersOf, missingCount, piecesPhrase, sortedLooks } from '../../components/outfits/looks';
import { Tile } from '../../components/outfits/Tile';
import { IconPlus } from '../../icons';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function LooksScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  // The looks and the three mutators come through the room's own contract
  // mirror (components/outfits/contract.ts), which is where any drift between
  // this room and the provider is caught by the compiler rather than by a
  // tester. Everything else is read straight off the provider.
  const { outfits, addOutfit } = useOutfits();
  const { items, activeItems, settings } = useWardrobe();
  const [building, setBuilding] = useState(false);

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const looks = useMemo(() => sortedLooks(outfits), [outfits]);
  const closet = useMemo(
    () => [...activeItems].sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems],
  );

  const commit = ({ name, itemIds, occasion }: LookDraft) => {
    const id = addOutfit(name, itemIds, occasion);
    if (id !== null) {
      showToast(`Saved. “${name.trim()}” — ${piecesPhrase(itemIds.length)}.`, 'success');
    }
    return id;
  };

  const editorial = {
    fontFamily: fonts.displayItalic,
    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? ('normal' as const) : ('italic' as const),
    fontSize: TYPE.editorial,
    color: tokens.text,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    lineHeight: Math.round(TYPE.body * 1.5),
    color: tokens.text2,
  };
  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  const railTile = 56;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* THE WAY BACK. Without it the only exit from a room off the bar is a
            system gesture, which a tester on a borrowed phone will not find. */}
        <View style={styles.leave}>
          <Button
            tone="tertiary"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace(CLOSET);
            }}
          >
            Back to the closet
          </Button>
        </View>

        <Masthead
          title="Looks"
          meta={looks.length > 0 ? `${looks.length} ${looks.length === 1 ? 'look' : 'looks'}` : undefined}
        />

        {looks.length === 0 ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={[editorial, { marginBottom: 8 }]}>Nothing put together yet.</Text>
            <Text style={[body, { marginBottom: 16 }]}>
              {closet.length === 0
                ? 'A look is pieces from the closet, kept as one thing. Add a piece or two and this room has something to work with.'
                : 'A look is pieces from the closet, kept as one thing — named once, then worn in a single gesture. Build one and it stays here.'}
            </Text>
            {/* The one primary on this view (brand law 3) — and WHICH door it
                is depends on what the closet holds. Opening a builder onto an
                empty grid, with a Save that could never succeed, is the worst
                of the three ways this state can go. */}
            {closet.length === 0 ? (
              <Button tone="primary" onPress={() => router.push(CLOSET)}>
                Open the closet
              </Button>
            ) : (
              <Button
                tone="primary"
                icon={<IconPlus size={16} color={tokens.onInk} />}
                onPress={() => setBuilding(true)}
              >
                Build a look
              </Button>
            )}
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {looks.map(look => {
                const members = membersOf(look, byId);
                const gone = missingCount(look, members);
                const line = ledgerLine(look);
                return (
                  <Pressable
                    key={look.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${look.name}, ${line}`}
                    onPress={() => router.push(lookHref(look.id))}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: tokens.surface,
                        borderColor: tokens.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text numberOfLines={2} style={editorial}>
                      {look.name}
                    </Text>

                    {look.occasion ? (
                      <Text numberOfLines={1} style={[ledger, { marginTop: 6 }]}>
                        {displayTag(look.occasion)}
                      </Text>
                    ) : null}

                    {members.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.rail}
                        style={{ marginTop: 12, marginHorizontal: -2 }}
                      >
                        {members.map(item => (
                          <Tile key={item.id} item={item} size={railTile} />
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={[body, { marginTop: 12, fontSize: 13, lineHeight: 19 }]}>
                        The pieces in this look are no longer in the closet. Its record stays.
                      </Text>
                    )}

                    {gone > 0 && members.length > 0 ? (
                      <Text style={[body, { marginTop: 10, fontSize: 13, lineHeight: 19 }]}>
                        {gone === 1
                          ? 'One piece here has left the closet. The look keeps its record.'
                          : `${gone} pieces here have left the closet. The look keeps its record.`}
                      </Text>
                    ) : null}

                    <Text style={[ledger, { marginTop: 12 }]}>{line}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.build}>
              <Button
                tone="secondary"
                icon={<IconPlus size={16} color={tokens.text} />}
                onPress={() => setBuilding(true)}
              >
                Build a look
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      <BuildSheet
        open={building}
        mode="build"
        items={closet}
        occasions={settings.occasions}
        onClose={() => setBuilding(false)}
        onCommit={commit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  leave: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'flex-start',
  },
  list: {
    gap: 16,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 16,
  },
  rail: {
    gap: 8,
    paddingHorizontal: 2,
  },
  build: {
    marginTop: 24,
    alignItems: 'flex-start',
  },
});
