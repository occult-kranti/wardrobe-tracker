/**
 * THE DRESSING ROOM — /furniture. Ports src/pages/Furniture.tsx's index.
 *
 * The closet is the clothes; the dressing room is the furniture. Two words, two
 * rooms, and the second has no slot on the house bar — furniture is
 * ORIENTATION, NEVER NAVIGATION COST (design-android/README.md). If the
 * metaphor ever adds a tap, the metaphor loses; so it is reached from inside
 * the Closet, and carries its own way back because a pushed route under a
 * header-less stack owes the reader a door out that is not a system gesture.
 *
 * AN ELEVATION, NOT A GALLERY. Every form is drawn into the same 460×560 box
 * standing on the same floor, so rendering them at equal widths gives true
 * relative heights for nothing — the almirah is visibly the tall one and the
 * jewellery box the small one. Insertion order, always: sorting somebody's
 * furniture by how full it is would be a league table of their bedroom.
 *
 * THE THREE THINGS THIS PAGE WILL NEVER DO, each vetoed by all three review
 * panels: no capacity or fullness percentage (fullness is DRAWN, from the
 * count); no completeness meter ("47 pieces not filed" is a bank balance and is
 * allowed, "39% filed" is progress-as-achievement and is not); nothing
 * decorative behind the photographs.
 *
 * THE ROUTE-PARAM CONTRACT, for whoever wires the closet's detail sheet:
 *
 *   /furniture?file=<itemId>          the room opens asking WHICH PLACE. Every
 *                                     place is a door; tapping one carries the
 *                                     piece through to
 *   /furniture/<placeId>?file=<itemId> the place opens asking WHICH COMPARTMENT.
 *                                     Tapping one files the piece and goes back.
 *
 * Nothing is written until a compartment is tapped, and either screen can be
 * left at any point with the piece exactly where it was.
 */
import { Link, Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAX_FURNITURE, type Furniture, type FurnitureForm, type Ornament } from '@almari/shared/types';

import { Button } from '../../components/Button';
import { CLOSET, placeHref } from '../../components/furniture/addresses';
import { Basting } from '../../components/furniture/Basting';
import { FurniturePlate } from '../../components/furniture/FurniturePlate';
import { DrawPlaceSheet } from '../../components/furniture/DrawPlaceSheet';
import { piecePhrase, slotCountPhrase } from '../../components/furniture/forms';
import { countsFor, unfiledCount, useDressingRoom } from '../../components/furniture/room';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { IconPlus } from '../../icons';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** One place, drawn small, with its name printed underneath in real type. */
function PlaceCard({
  piece,
  counts,
  width,
  href,
}: {
  piece: Furniture;
  counts: Record<string, number>;
  width: number;
  href: Href;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${piece.name}, ${slotCountPhrase(piece.form, piece.slots.length)}, ${piecePhrase(total)}`}
        style={{ width }}
      >
        {/* The drawing carries no labels here: SVG type is sized in user units,
            so labels built for a full-width plate would land at 6px on a card.
            The name is printed below in the page's own typography instead,
            which is better typography anyway. */}
        <FurniturePlate piece={piece} counts={counts} width={width} labels={false} />
        {/* The floor stops where the piece stops. A rule running on past the
            last object would be a shelf with room left on it. */}
        <Basting width={width} style={{ marginTop: 12, marginBottom: 8 }} />
        <Text numberOfLines={2} style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}>
          {piece.name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            textTransform: 'uppercase',
            color: tokens.text2,
            marginTop: 4,
          }}
        >
          {slotCountPhrase(piece.form, piece.slots.length)} · {piecePhrase(total)}
        </Text>
      </Pressable>
    </Link>
  );
}

/**
 * THE DOOR, FIRST LINE (lead ruling R7). A cold deep link into the dressing
 * room of a device that has no wardrobe on it yet lands on the door, exactly as
 * the four rooms on the bar already do — silently, with no plaque explaining
 * what it missed. Without this, `/furniture` opened cold drew an empty room over
 * a wardrobe that does not exist, with a "Back to the closet" button pointing at
 * a closet that does not either.
 *
 * `loading` is not `none`: the shelf is asked before the door is, so a wardrobe
 * that exists gets a blank beat on its own paper rather than a flash of somebody
 * else's empty closet, and nobody is sent to the door on the strength of an
 * answer that had not arrived.
 *
 * The gate is its own component, holding two hooks and no early return between
 * them, so the screen below keeps an unconditional hook order — the Wave-5
 * pattern from the feed and story gates, and the rules-of-hooks lint is right
 * that an early return above a screen's hooks is the defect class.
 */
export default function DressingRoomRoute() {
  const { status } = useWardrobe();
  const { tokens } = useTheme();
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  if (status === 'none') return <Redirect href="/open" />;
  return <DressingRoomScreen />;
}

function DressingRoomScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { file } = useLocalSearchParams<{ file?: string }>();
  const { furniture, activeItems, wired, full, addFurniture } = useDressingRoom();
  const [drawing, setDrawing] = useState(false);

  const filing = typeof file === 'string' && file.length > 0 ? file : null;
  const filingPiece = filing ? activeItems.find(i => i.id === filing) : undefined;

  const gutter = 20;
  const gap = 16;
  const cardWidth = Math.floor((windowWidth - gutter * 2 - gap) / 2);
  const unfiled = unfiledCount(activeItems, furniture);

  const editorial = {
    fontFamily: fonts.displayItalic,
    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? ('normal' as const) : ('italic' as const),
    fontSize: TYPE.editorial,
    color: tokens.text,
    marginBottom: 8,
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

  const draw = (name: string, form: FurnitureForm, slotCount: number, ornament: Ornament) => {
    const id = addFurniture(name, form, slotCount, ornament);
    setDrawing(false);
    // Drawn: the new place opens, because a place you cannot see is not a place.
    if (id) {
      router.push(placeHref(id, filing));
      return;
    }
    // No id came back. There are two reasons and they are not the same event:
    // the room is genuinely full, which is worth a sentence — or the provider
    // could not name what it had already made, in which case the place IS in
    // the grid below and claiming a failure would be a lie about the record.
    // (The provider's addFurniture reads its `made` flag before React has run
    // the state updater; reported to squad A. This screen refuses to turn that
    // into a false error either way.)
    if (full) {
      showToast(
        `This wardrobe already holds ${MAX_FURNITURE} places, which is as many as the room will draw. Remove one to draw another — the clothes in it stay either way.`,
        'info',
      );
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* THE WAY BACK. This room has no slot on the house bar — it is reached
            from inside the Closet — so without this the only exit is a system
            gesture, which a tester on a borrowed phone will not find. */}
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
          title="Dressing room"
          meta={furniture.length === 0 ? undefined : `${furniture.length} ${furniture.length === 1 ? 'place' : 'places'}`}
        />

        {/* Arrived carrying a piece: the room is asking which place, and says
            so rather than looking like an ordinary visit. */}
        {filing ? (
          <View style={[styles.plate, { backgroundColor: tokens.sunken, borderColor: tokens.border }]}>
            <Text style={ledger}>Finding a place for</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.body, color: tokens.text, marginTop: 6 }}>
              {filingPiece ? filingPiece.name : 'a piece'}
            </Text>
            <Text style={[body, { marginTop: 8, fontSize: 13, lineHeight: 19 }]}>
              Open the place it lives in, then tap the compartment. Nothing is written until you do.
            </Text>
          </View>
        ) : null}

        {furniture.length === 0 ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={editorial}>Nothing has an address yet.</Text>
            <Text style={[body, { marginBottom: 16 }]}>
              A rail is a place. So is a chest of six drawers, or the shelf by the door. Draw one,
              and pieces can be filed to it — nothing here is required, and every piece stays exactly
              where it is until you say otherwise.
            </Text>
            <Button
              tone="primary"
              icon={<IconPlus size={16} color={tokens.onInk} />}
              onPress={() => setDrawing(true)}
            >
              Draw a place
            </Button>
          </View>
        ) : (
          <>
            <View style={[styles.grid, { gap }]}>
              {furniture.map(piece => (
                <PlaceCard
                  key={piece.id}
                  piece={piece}
                  counts={countsFor(activeItems, piece.id)}
                  width={cardWidth}
                  href={placeHref(piece.id, filing)}
                />
              ))}
            </View>

            <View style={{ marginTop: 28, alignItems: 'flex-start' }}>
              <Button
                tone="secondary"
                icon={<IconPlus size={16} color={tokens.text} />}
                onPress={() => setDrawing(true)}
              >
                Draw a place
              </Button>
            </View>

            {/* A FLAT COUNT, NEVER A RATIO. */}
            {unfiled > 0 ? (
              <>
                <Basting width={windowWidth - gutter * 2} style={{ marginTop: 24 }} />
                <Text style={[ledger, { marginTop: 12 }]}>
                  {unfiled} {unfiled === 1 ? 'piece has' : 'pieces have'} no address. Nothing needs
                  one — a place is a convenience, not a requirement.
                </Text>
              </>
            ) : null}
          </>
        )}

        {/* Squad A's furniture surface has not landed in this build. The room
            still stands and still deep-links; it simply has nothing to hold. */}
        {!wired ? (
          <Text style={[ledger, { marginTop: 24 }]}>
            The dressing room is not connected to this wardrobe yet.
          </Text>
        ) : null}
      </ScrollView>

      <DrawPlaceSheet open={drawing} full={full} onClose={() => setDrawing(false)} onDraw={draw} />
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
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
