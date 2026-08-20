/**
 * ONE PLACE, OPEN — /furniture/[id]. Ports src/pages/Furniture.tsx's detail.
 *
 * THE DRAWING IS THE CONTROL. The compartments are the tap targets; there is no
 * list of them anywhere on this screen, because "third drawer down on the left"
 * is a recall task performed against a text field and tapping the third drawer
 * down is a recognition task performed against a picture of your own furniture.
 *
 * THE PIECES ARE FLAT TILES BELOW THE DRAWING, NEVER INSIDE IT. Nothing
 * decorative goes behind a photograph (brand law 6), and a garment rendered
 * inside the line art would be exactly that.
 *
 * WHAT THIS SCREEN REFUSES TO SHOW: how full the compartment is as a number,
 * a bar, or a share. The count is stated; the fullness is drawn.
 *
 * FILING FROM ELSEWHERE — the route-param contract this screen honours:
 *   /furniture/<placeId>?file=<itemId>
 * The place opens asking which compartment; tapping one files that piece and
 * goes back where it came from. Nothing is written until the tap.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { roomHref } from '../../components/furniture/addresses';
import { ConfirmSheet } from '../../components/feed/ConfirmSheet';
import { FileSheet, PieceTile } from '../../components/furniture/FileSheet';
import { FurniturePlate } from '../../components/furniture/FurniturePlate';
import { piecePhrase, slotCountPhrase, SLOT_NOUN } from '../../components/furniture/forms';
import { countsFor, inSlot, useDressingRoom } from '../../components/furniture/room';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/**
 * THE DOOR, FIRST LINE (lead ruling R7). A cold deep link into one place of a
 * device that has no wardrobe on it yet lands on the door, exactly as the four
 * rooms on the bar already do — silently, with no plaque explaining what it
 * missed. Without this, `/furniture/<id>` opened cold drew "That place is not in
 * this wardrobe" about a wardrobe nobody has opened yet — an answer to a
 * question that was never asked.
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
export default function PlaceRoute() {
  const { status } = useWardrobe();
  const { tokens } = useTheme();
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  if (status === 'none') return <Redirect href="/open" />;
  return <PlaceScreen />;
}

function PlaceScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { id, file } = useLocalSearchParams<{ id: string; file?: string }>();
  const { furniture, activeItems, filePiece, removeFurniture } = useDressingRoom();

  const piece = furniture.find(f => f.id === id);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [putting, setPutting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const filing = typeof file === 'string' && file.length > 0 ? file : null;
  const filingPiece = filing ? activeItems.find(i => i.id === filing) : undefined;

  const counts = useMemo(
    () => (piece ? countsFor(activeItems, piece.id) : {}),
    [activeItems, piece],
  );

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

  const leave = (
    <View style={styles.leave}>
      <Button
        tone="tertiary"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(roomHref());
        }}
      >
        Back to the dressing room
      </Button>
    </View>
  );

  if (!piece) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <ScrollView contentContainerStyle={styles.page}>
          {leave}
          <Masthead title="Dressing room" />
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={editorial}>No record of this place.</Text>
            <Text style={body}>
              It may have been removed. Nothing filed in it was lost — those pieces simply stopped
              having an address.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const slot = piece.slots.find(s => s.id === openSlot) ?? piece.slots[0];
  const inside = inSlot(activeItems, piece.id, slot.id);
  const elsewhere = activeItems.filter(
    i => !i.place || i.place.furnitureId !== piece.id || i.place.slotId !== slot.id,
  );
  const noun = SLOT_NOUN[piece.form];
  const plateWidth = Math.min(windowWidth - 40, 360);
  const tileWidth = Math.floor((windowWidth - 40 - 24) / 3);

  // How many pieces would lose their address — read once, so the gate and the
  // notice afterwards state the same truth from the same count.
  const held = activeItems.filter(i => i.place?.furnitureId === piece.id).length;

  /** Tapping a compartment: it opens, or — when carrying a piece — it takes it. */
  const tapSlot = (slotId: string) => {
    if (!filing) {
      setOpenSlot(slotId);
      return;
    }
    const label = piece.slots.find(s => s.id === slotId)?.label ?? 'it';
    filePiece(filing, piece.id, slotId);
    showToast(`Put away. ${filingPiece ? filingPiece.name : 'The piece'} is in ${label}.`, 'success');
    if (router.canGoBack()) router.back();
    else router.replace(roomHref());
  };

  const remove = () => {
    setConfirmRemove(false);
    const putBack = removeFurniture(piece.id);
    router.replace(roomHref());
    showToast(
      held > 0
        ? `Removed. The ${held === 1 ? 'piece stays' : `${held} pieces stay`} in the closet; they simply stop having an address.`
        : 'Removed. Nothing was filed in it.',
      'info',
      // The provider hands back a put-it-back closure — the whole previous
      // state, never a field-by-field inverse, which is how half-restores
      // happen. Offered only if one arrives; the gate never promised it.
      typeof putBack === 'function' ? { label: 'Undo', run: putBack } : undefined,
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {leave}
        <Masthead title={piece.name} meta={slotCountPhrase(piece.form, piece.slots.length)} />

        {filing ? (
          <View style={[styles.plate, { backgroundColor: tokens.sunken, borderColor: tokens.border }]}>
            <Text style={ledger}>Finding a place for</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.body, color: tokens.text, marginTop: 6 }}>
              {filingPiece ? filingPiece.name : 'a piece'}
            </Text>
            <Text style={[body, { marginTop: 8, fontSize: 13, lineHeight: 19 }]}>
              Tap the {noun[0]} it lives in.
            </Text>
          </View>
        ) : null}

        {/* THE DRAWING. Big, labelled, and every compartment a control. */}
        <View style={{ alignItems: 'center' }}>
          <FurniturePlate
            piece={piece}
            counts={counts}
            width={plateWidth}
            openSlot={filing ? null : slot.id}
            onSlot={tapSlot}
          />
        </View>

        {filing ? null : (
          <>
            <View style={styles.slotHead}>
              <Text
                accessibilityRole="header"
                style={{ fontFamily: fonts.display, fontSize: TYPE.editorial, color: tokens.text }}
              >
                {slot.label}
              </Text>
              <Text style={ledger}>{piecePhrase(inside.length)}</Text>
            </View>

            {/* PACKED AWAY is stated where it is true, and only stated: the
                toggle needs packSlot, which this wave's provider contract does
                not carry. Read-only is honest; inventing the control is not. */}
            {slot.packed ? (
              <Text style={[body, { fontSize: 13, lineHeight: 19, marginTop: 8 }]}>
                Packed away. Everything in here keeps its wears and stays in the closet, searchable
                and wearable — it just stops being offered on a Tuesday.
              </Text>
            ) : null}

            <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
              <Button tone="primary" onPress={() => setPutting(true)}>
                Put things in
              </Button>
            </View>

            {/* The pieces filed here — flat tiles, below the drawing, never
                inside it. */}
            {inside.length === 0 ? (
              <Text style={[body, { marginTop: 16 }]}>Nothing in here yet.</Text>
            ) : (
              <View style={styles.grid}>
                {inside.map(item => (
                  <View key={item.id} style={{ width: tileWidth }}>
                    <PieceTile item={item} size={tileWidth} />
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.text, marginTop: 6 }}
                    >
                      {item.name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Take out ${item.name}`}
                      onPress={() => {
                        filePiece(item.id, null, null);
                        showToast(`Taken out. ${item.name} has no address again.`, 'info');
                      }}
                      style={styles.takeOut}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.ui,
                          fontSize: TYPE.label,
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: TYPE.labelSpacing,
                          color: tokens.accent,
                          textDecorationLine: 'underline',
                        }}
                      >
                        Take out
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* The gate stands before the act. */}
            <View style={styles.removeBlock}>
              <Button tone="secondary" onPress={() => setConfirmRemove(true)}>
                Remove this place
              </Button>
              <Text style={[ledger, { marginTop: 10 }]}>
                The clothes stay. Only the line saying where they sleep goes.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <FileSheet
        open={putting}
        slotLabel={slot.label}
        candidates={elsewhere}
        onClose={() => setPutting(false)}
        onFile={ids => {
          // One call per piece: this wave's contract files one piece at a time.
          // A batch verb would be one commit instead of N — reported.
          for (const itemId of ids) filePiece(itemId, piece.id, slot.id);
          setPutting(false);
          showToast(
            `Put away. ${piecePhrase(ids.length)} ${ids.length === 1 ? 'is' : 'are'} in ${slot.label}.`,
            'success',
          );
        }}
      />

      <ConfirmSheet
        open={confirmRemove}
        title="Remove this place"
        body={
          held > 0
            ? `This removes “${piece.name}” from the dressing room. The ${
                held === 1 ? 'piece filed in it stays' : `${held} pieces filed in it stay`
              } in the closet with every wear ${held === 1 ? 'it' : 'they'} earned — ${
                held === 1 ? 'it only stops' : 'they only stop'
              } having an address.`
            : `This removes “${piece.name}” from the dressing room. Nothing is filed in it, so no clothes are touched.`
        }
        confirmLabel="Remove it"
        onConfirm={remove}
        onClose={() => setConfirmRemove(false)}
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
    marginBottom: 20,
  },
  slotHead: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  grid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  takeOut: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  removeBlock: {
    marginTop: 32,
    alignItems: 'flex-start',
  },
});
