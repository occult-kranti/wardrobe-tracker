/**
 * ONE OUTFIT, OPEN — /outfits/[id].
 *
 * The list recognises; this screen acts. Everything an outfit can have done to
 * it is here and nowhere else, because here there is exactly one outfit to be
 * the subject of the verb — which is what lets "Wear it today" carry the
 * reserved accent fill (brand law 3: the hero treatment is for log-wear
 * actions, and only where it does not repeat down a page).
 *
 * THE WORD IS "OUTFIT" (R2). The web's own word, and the one the route always
 * used. "Looks" and "Look Book" are the feed's, which is why the share row
 * below — and only the share row — still speaks them: it is the feed's verb
 * reaching into this screen, not this screen's own.
 *
 * THE WEAR IS NOT A GATE ANY MORE (R1). It used to be one confirm; a confirm
 * is for the irreversible, and a wear is the most reversible thing in this
 * app. So the tap logs, and the seal toast carries the Undo — the same offer
 * Today makes on the day's own logs, in the same words. Wearing an outfit
 * credits every piece in it (the provider does that, not this screen:
 * lib/wardrobe.tsx logWear takes the outfit id and unions in its pieces), and
 * the toast states the outfit's new count rather than explaining the rule.
 *
 * FINDING THE LOG TO UNDO. logWear answers nothing — the id is minted inside
 * the provider — so Undo cannot be handed one at the moment of the press.
 * It resolves the log LATER, when it is actually pressed, as "the log this
 * screen's wardrobe now holds that it did not hold a moment ago, against this
 * outfit". That is exact even if something else writes a log in between, and
 * it needs no new provider member.
 *
 * THE WORD IS REMOVE, AND THAT IS DELIBERATE. Brand law 12's "retire, never
 * delete" is about PIECES: a retired piece keeps its name, its photograph and
 * every wear it earned, and `isActive` merely stops offering it. removeOutfit
 * does none of that — the outfit is filtered out and it is gone. Calling that
 * "retire" would promise a recoverable state the record does not hold. The
 * house's word for a container leaving the room is Remove, which is what the
 * dressing room says about a chest, and for the same reason.
 *
 * THE REMOVAL KEEPS ITS GATE, AND THE GATE NOW TELLS THE WHOLE TRUTH (R3).
 * removeOutfit hands back a put-it-back closure, exactly as removeFurniture
 * does, so the toast carries Undo. That does not make the confirm redundant —
 * an outfit is a thing somebody assembled, the Undo stands for a moment and
 * then does not, and a person who taps through without reading deserves to
 * have been told which of those two facts is which. So the gate states the
 * loss truthfully AND says the Undo follows.
 *
 * What is actually lost, if the moment passes: the grouping, the name, and
 * the outfit's own count. The pieces keep every wear they earned and the wear
 * logs keep their outfitId, because a day does not stop having happened
 * because the outfit was tidied away. That is what the sentence lists.
 *
 * AMENDING GOES THROUGH THE SAME SHEET THE OUTFIT WAS BUILT WITH. One picker,
 * one set of words, one floor, one place to fix a bug in — which matters more
 * than it looks: updateOutfit validates NOTHING beyond its whitelist, so
 * without the sheet's own refusal the amend path would happily save the
 * nameless, pieceless outfit the build path refuses.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FEED_ENABLED } from '@almari/shared/flags';
import { displayTag } from '@almari/shared/types';

import { Button } from '../../components/Button';
import { ConfirmSheet } from '../../components/feed/ConfirmSheet';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { BuildSheet, type OutfitDraft } from '../../components/outfits/BuildSheet';
import { OUTFITS } from '../../components/outfits/addresses';
import { useOutfits } from '../../components/outfits/contract';
import { ledgerLine, membersOf, missingCount, piecesPhrase, wearsPhrase } from '../../components/outfits/looks';
import { ShareRow } from '../../components/outfits/ShareRow';
import { Tile } from '../../components/outfits/Tile';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function OutfitScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { outfits, updateOutfit, removeOutfit } = useOutfits();
  const { items, activeItems, settings, wearLogs, logWear, removeWearLog } = useWardrobe();

  const [amending, setAmending] = useState(false);
  const [removing, setRemoving] = useState(false);

  const outfit = outfits.find(o => o.id === id);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const closet = useMemo(
    () => [...activeItems].sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems],
  );

  /**
   * The wear logs as of the last settled render, readable from inside a toast
   * offer that outlives the press that made it. The Undo below reads this at
   * the moment it is pressed, never at the moment it is offered — see the
   * header note.
   */
  const logsRef = useRef(wearLogs);
  useEffect(() => {
    logsRef.current = wearLogs;
  }, [wearLogs]);

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
          else router.replace(OUTFITS);
        }}
      >
        Back to the outfits
      </Button>
    </View>
  );

  if (!outfit) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <ScrollView contentContainerStyle={styles.page}>
          {leave}
          <Masthead title="Outfits" />
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={[editorial, { marginBottom: 8 }]}>No record of this outfit.</Text>
            <Text style={body}>
              It may have been removed. Nothing in it was lost — every piece is still in the closet,
              with every wear it earned.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const members = membersOf(outfit, byId);
  const retired = members.filter(m => m.retired);
  const gone = missingCount(outfit, members);
  const gutter = 20;
  const gap = 12;
  const columns = 3;
  const tileWidth = Math.floor((width - gutter * 2 - gap * (columns - 1)) / columns);

  const amend = ({ name, itemIds, occasion }: OutfitDraft) => {
    updateOutfit(outfit.id, {
      name: name.trim(),
      itemIds,
      // R4: null is the CLEAR SENTINEL, and the reason the sheet can now offer
      // to take an occasion off at all. `undefined` still means "leave it
      // alone", which is what makes a patch a patch, and `''` is never sent —
      // an empty string is a shape the web does not write and no migration
      // case has ever seen.
      occasion: occasion && occasion.trim().length > 0 ? occasion : null,
    });
    showToast(`Amended. “${name.trim()}” — ${piecesPhrase(itemIds.length)}.`, 'success');
    return outfit.id;
  };

  /**
   * R1: THE WEAR LOGS ON THE TAP. No gate — a wear is reversible, and the
   * reversal rides on the notice rather than on a question asked beforehand.
   */
  const wear = () => {
    // Snapshotted BEFORE the write, so the new log can be told from the old
    // ones by id rather than by guessing at the newest.
    const before = new Set(logsRef.current.map(l => l.id));
    const worn = outfit.wearCount + 1;
    // The outfit id is passed, so the provider credits every piece in it
    // whether or not this screen listed them — one source of that rule.
    logWear(outfit.itemIds, outfit.id);
    showToast(`Logged. “${outfit.name}” ${wearsPhrase(worn).toLowerCase()}.`, 'seal', {
      label: 'Undo',
      run: () => {
        const fresh = logsRef.current.find(l => !before.has(l.id) && l.outfitId === outfit.id);
        // Nothing to take off is not an error and is not announced: the offer
        // simply had nothing behind it, which the toast's own timeout would
        // have settled a moment later anyway.
        if (!fresh) return;
        removeWearLog(fresh.id);
        // Today's words for the same act, so one gesture reads one way
        // wherever it is made (app/src/app/(tabs)/index.tsx undoLog).
        showToast('Undone. That wear is off the record.', 'info');
      },
    });
  };

  const remove = () => {
    setRemoving(false);
    // R3: the way to put the whole thing back, exactly as the dressing room
    // takes it from removeFurniture. Null means the provider had nothing to
    // hand back, and then no Undo is offered rather than a dead one.
    const putBack = removeOutfit(outfit.id);
    // REPLACE, NOT BACK, AND BEFORE THE NOTICE. A deep-linked outfit has no
    // history to pop, so back() would leave the reader looking at a record
    // that no longer exists; the toast container is mounted at the root above
    // the stack, so the notice survives the navigation either way.
    router.replace(OUTFITS);
    showToast(
      'Removed. The pieces stay in the closet, with every wear they earned.',
      'info',
      putBack ? { label: 'Undo', run: putBack } : undefined,
    );
  };

  /**
   * What the gate says. The loss first, stated as fact rather than as a
   * warning, then the Undo — in that order, because a person who reads only
   * the first sentence should still have been told the true cost.
   */
  const lostSentence =
    outfit.wearCount === 0
      ? `“${outfit.name}” stops being an outfit. Every piece in it stays in the closet with everything it has earned. What goes is the outfit itself — its name and its set of pieces. It has not been worn, so no count moves. Undo stands for a moment afterwards.`
      : `“${outfit.name}” stops being an outfit. Every piece in it stays in the closet with every wear it earned, and the days you wore it stay in the record. What goes is the outfit itself — its name, its set of pieces, and its own record of being ${wearsPhrase(outfit.wearCount).toLowerCase()}. Undo stands for a moment afterwards.`;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {leave}

        <Masthead title={outfit.name} meta={piecesPhrase(outfit.itemIds.length)} />

        {outfit.occasion ? <Text style={ledger}>{displayTag(outfit.occasion)}</Text> : null}

        <Text style={[ledger, { marginTop: outfit.occasion ? 8 : 0 }]}>{ledgerLine(outfit)}</Text>

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
            The pieces in this outfit are no longer in the closet. Its record stays, and so does
            every day it was worn.
          </Text>
        )}

        {/* A RETIRED PIECE IS STILL IN THE OUTFIT. Members resolve from
            `items`, never `activeItems`, so the tiles and the "N pieces" in
            the masthead can never contradict each other about somebody's own
            record. */}
        {retired.length > 0 ? (
          <Text style={[body, { marginTop: 16, fontSize: 13, lineHeight: 19 }]}>
            {retired.length === 1
              ? `“${retired[0].name}” has been retired. The outfit keeps its record.`
              : `${retired.length} pieces here have been retired. The outfit keeps its record.`}
          </Text>
        ) : null}

        {gone > 0 && members.length > 0 ? (
          <Text style={[body, { marginTop: 16, fontSize: 13, lineHeight: 19 }]}>
            {gone === 1
              ? 'One piece here has left the closet. The outfit keeps its record.'
              : `${gone} pieces here have left the closet. The outfit keeps its record.`}
          </Text>
        ) : null}

        <View style={[styles.rule, { backgroundColor: tokens.border }]} />

        {/* THE ONE HERO FILL IN THIS ROOM — the log-wear action, on the one
            screen where it does not repeat (brand law 3). One tap, no gate. */}
        <View style={styles.act}>
          <Button tone="hero" onPress={wear}>
            Wear it today
          </Button>
        </View>

        {/* Sharing is the Look Book's verb — the feed's word, in the feed's
            room, reaching in here. With the flag off this renders NOTHING —
            no row, no plaque, no explanation of a door that is not in the
            house this season. */}
        {FEED_ENABLED ? <ShareRow look={outfit} members={members} /> : null}

        <View style={[styles.rule, { backgroundColor: tokens.border }]} />

        <View style={styles.amendRow}>
          <Button tone="secondary" onPress={() => setAmending(true)}>
            Amend this outfit
          </Button>
          <Button tone="tertiary" onPress={() => setRemoving(true)}>
            Remove this outfit
          </Button>
        </View>
      </ScrollView>

      <BuildSheet
        open={amending}
        mode="amend"
        initial={{ name: outfit.name, itemIds: outfit.itemIds, occasion: outfit.occasion }}
        items={closet}
        categories={settings.categories}
        occasions={settings.occasions}
        onClose={() => setAmending(false)}
        onCommit={amend}
      />

      <ConfirmSheet
        open={removing}
        title="Remove this outfit"
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
