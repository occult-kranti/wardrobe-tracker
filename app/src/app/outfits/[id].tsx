/**
 * ONE LOOK, OPEN — /outfits/[id].
 *
 * The list recognises; this screen acts. Everything a look can have done to it
 * is here and nowhere else, because here there is exactly one look to be the
 * subject of the verb — which is what lets "Wear it today" carry the reserved
 * accent fill (brand law 3: the hero treatment is for log-wear actions, and
 * only where it does not repeat down a page).
 *
 * THE WEAR IS ONE CONFIRM, AND THE CONFIRM SAYS WHAT MOVES. Wearing a look
 * credits every piece in it — the provider does that, not this screen
 * (lib/wardrobe.tsx logWear takes the outfit id and unions in its pieces) —
 * so the sentence names the count before the tap rather than the toast
 * explaining it afterwards.
 *
 * THE WORD IS REMOVE, AND THAT IS DELIBERATE. Brand law 12's "retire, never
 * delete" is about PIECES: a retired piece keeps its name, its photograph and
 * every wear it earned, and `isActive` merely stops offering it. removeOutfit
 * does none of that — the look is filtered out and it is gone (lib/wardrobe.tsx).
 * Calling that "retire" would promise a recoverable state the record does not
 * hold. The house's word for a container leaving the room is Remove, which is
 * what the dressing room says about a chest, and for the same reason.
 *
 * The gate states the loss truthfully. The pieces keep every wear they earned
 * and the wear logs keep their outfitId, because a day does not stop having
 * happened because the look was tidied away. What is actually lost is the
 * grouping, the name, and the look's own count — so that is what it lists.
 * There is no Undo, because removeOutfit hands back nothing to undo with
 * (removeFurniture hands back a put-it-back closure; this does not), so no
 * copy here implies one.
 *
 * AMENDING GOES THROUGH THE SAME SHEET THE LOOK WAS BUILT WITH. One picker,
 * one set of words, one floor, one place to fix a bug in — which matters more
 * than it looks: updateOutfit validates NOTHING, so without the sheet's own
 * refusal the amend path would happily save the nameless, pieceless look the
 * build path refuses.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FEED_ENABLED } from '@almari/shared/flags';
import { displayTag } from '@almari/shared/types';

import { Button } from '../../components/Button';
import { ConfirmSheet } from '../../components/feed/ConfirmSheet';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { BuildSheet, type LookDraft } from '../../components/outfits/BuildSheet';
import { LOOKS } from '../../components/outfits/addresses';
import { useOutfits } from '../../components/outfits/contract';
import { ledgerLine, membersOf, missingCount, piecesPhrase, wearsPhrase } from '../../components/outfits/looks';
import { ShareRow } from '../../components/outfits/ShareRow';
import { Tile } from '../../components/outfits/Tile';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function LookScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { outfits, updateOutfit, removeOutfit } = useOutfits();
  const { items, activeItems, settings, logWear } = useWardrobe();

  const [amending, setAmending] = useState(false);
  const [wearing, setWearing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const look = outfits.find(o => o.id === id);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const closet = useMemo(
    () => [...activeItems].sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems],
  );

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

  const leave = (
    <View style={styles.leave}>
      <Button
        tone="tertiary"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(LOOKS);
        }}
      >
        Back to the looks
      </Button>
    </View>
  );

  if (!look) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <ScrollView contentContainerStyle={styles.page}>
          {leave}
          <Masthead title="Looks" />
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={[editorial, { marginBottom: 8 }]}>No record of this look.</Text>
            <Text style={body}>
              It may have been retired. Nothing in it was lost — every piece is still in the closet,
              with every wear it earned.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const members = membersOf(look, byId);
  const retired = members.filter(m => m.retired);
  const gone = missingCount(look, members);
  const gutter = 20;
  const gap = 12;
  const columns = 3;
  const tileWidth = Math.floor((width - gutter * 2 - gap * (columns - 1)) / columns);

  const amend = ({ name, itemIds, occasion }: LookDraft) => {
    updateOutfit(look.id, {
      name: name.trim(),
      itemIds,
      // OMITTED WHEN ABSENT, never an empty string. updateOutfit's whitelist
      // assigns any key whose value is not undefined, so '' would be WRITTEN
      // — a shape the web never produces (addOutfit spreads the field in only
      // when there is one, so that "a look with no occasion is byte-identical
      // to one written by the web") and one no migration case has ever seen.
      // The sheet therefore does not offer to take an occasion off; its
      // occasionClearable prop carries the whole of that seam.
      ...(occasion && occasion.trim().length > 0 ? { occasion } : {}),
    });
    showToast(`Amended. “${name.trim()}” — ${piecesPhrase(itemIds.length)}.`, 'success');
    return look.id;
  };

  const wear = () => {
    setWearing(false);
    // The outfit id is passed, so the provider credits every piece in the look
    // whether or not this screen listed them — one source of that rule.
    logWear(look.itemIds, look.id);
    showToast(`Logged. “${look.name}” ${wearsPhrase(look.wearCount + 1).toLowerCase()}.`, 'seal');
  };

  const remove = () => {
    setRemoving(false);
    removeOutfit(look.id);
    // REPLACE, NOT BACK, AND BEFORE THE NOTICE. A deep-linked look has no
    // history to pop, so back() would leave the reader looking at a record
    // that no longer exists; the toast container is mounted at the root above
    // the stack, so the notice survives the navigation either way.
    router.replace(LOOKS);
    showToast('Removed. The pieces stay in the closet, with every wear they earned.', 'info');
  };

  const lostSentence =
    look.wearCount === 0
      ? `“${look.name}” stops being a look. Every piece in it stays in the closet with everything it has earned. What goes is the look itself — its name and its set of pieces. It has not been worn, so no count moves.`
      : `“${look.name}” stops being a look. Every piece in it stays in the closet with every wear it earned, and the days you wore it stay in the record. What goes is the look itself — its name, its set of pieces, and its own record of being ${wearsPhrase(look.wearCount).toLowerCase()}.`;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {leave}

        <Masthead title={look.name} meta={piecesPhrase(look.itemIds.length)} />

        {look.occasion ? <Text style={ledger}>{displayTag(look.occasion)}</Text> : null}

        <Text style={[ledger, { marginTop: look.occasion ? 8 : 0 }]}>{ledgerLine(look)}</Text>

        {/* THE PIECES, flat and named. Nothing decorative behind a photograph
            (brand law 6), and no piece is identified by its picture alone. */}
        {members.length > 0 ? (
          <View style={[styles.grid, { gap, marginTop: 20 }]}>
            {members.map(item => (
              <View key={item.id} style={{ width: tileWidth }}>
                <Tile item={item} size={tileWidth} />
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: fonts.ui,
                    fontSize: 13,
                    lineHeight: 17,
                    color: tokens.text,
                    marginTop: 6,
                  }}
                >
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[body, { marginTop: 20 }]}>
            The pieces in this look are no longer in the closet. Its record stays, and so does every
            day it was worn.
          </Text>
        )}

        {/* A RETIRED PIECE IS STILL IN THE LOOK. Members resolve from `items`,
            never `activeItems`, so the tiles and the "N pieces" in the masthead
            can never contradict each other about somebody's own record. */}
        {retired.length > 0 ? (
          <Text style={[body, { marginTop: 16, fontSize: 13, lineHeight: 19 }]}>
            {retired.length === 1
              ? `“${retired[0].name}” has been retired. The look keeps its record.`
              : `${retired.length} pieces here have been retired. The look keeps its record.`}
          </Text>
        ) : null}

        {gone > 0 && members.length > 0 ? (
          <Text style={[body, { marginTop: 16, fontSize: 13, lineHeight: 19 }]}>
            {gone === 1
              ? 'One piece here has left the closet. The look keeps its record.'
              : `${gone} pieces here have left the closet. The look keeps its record.`}
          </Text>
        ) : null}

        <View style={[styles.rule, { backgroundColor: tokens.border }]} />

        {/* THE ONE HERO FILL IN THIS ROOM — the log-wear action, on the one
            screen where it does not repeat (brand law 3). */}
        <View style={styles.act}>
          <Button tone="hero" onPress={() => setWearing(true)}>
            Wear it today
          </Button>
        </View>

        {/* Sharing is the Look Book's verb. With the flag off this renders
            NOTHING — no row, no plaque, no explanation of a door that is not
            in the house this season. */}
        {FEED_ENABLED ? <ShareRow look={look} members={members} /> : null}

        <View style={[styles.rule, { backgroundColor: tokens.border }]} />

        <View style={styles.amendRow}>
          <Button tone="secondary" onPress={() => setAmending(true)}>
            Amend this look
          </Button>
          <Button tone="tertiary" onPress={() => setRemoving(true)}>
            Remove this look
          </Button>
        </View>
      </ScrollView>

      <BuildSheet
        open={amending}
        mode="amend"
        initial={{ name: look.name, itemIds: look.itemIds, occasion: look.occasion }}
        items={closet}
        occasions={settings.occasions}
        occasionClearable={!look.occasion}
        onClose={() => setAmending(false)}
        onCommit={amend}
      />

      <ConfirmSheet
        open={wearing}
        title="Wear it today"
        body={`Today goes in the record for “${look.name}”, and for all ${piecesPhrase(look.itemIds.length)} in it — each one's count moves by one.`}
        confirmLabel="Log it"
        onConfirm={wear}
        onClose={() => setWearing(false)}
      />

      <ConfirmSheet
        open={removing}
        title="Remove this look"
        body={lostSentence}
        confirmLabel="Remove it"
        onConfirm={remove}
        onClose={() => setRemoving(false)}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 28,
  },
  act: {
    marginTop: 20,
    alignItems: 'flex-start',
  },
  amendRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
