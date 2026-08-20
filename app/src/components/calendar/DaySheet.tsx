/**
 * A DAY'S PAGE — what was worn on one date, and the way to write it down.
 *
 * Ported from the web Calendar's day cell and its scheduling modal
 * (src/pages/Calendar.tsx), with the one change the phone earns: the web
 * schedules OUTFITS, this picks PIECES, because Today's two-tap log picks
 * pieces and a person should not have to build a look to remember that they
 * wore the blue coat on Tuesday.
 *
 * THE PICKER IS ALREADY ON THE PAGE, not behind a button, and that is the
 * whole tap budget (docs/42 §6: log a day this week, three taps — the day,
 * the piece, Log). An "Add a wear" button that opened a second sheet would
 * spend the tap the metaphor is supposed to return.
 *
 * TWO KINDS OF ENTRY LIVE HERE AND THEY NEVER LOOK ALIKE — the web's law,
 * kept: a recorded wear is written, a plan is basted and says "Planned".
 * Plans move no wear counts (the provider's logWear stores the flag), so
 * removing one is "Removed. That plan is off the page." and removing a wear
 * is "Undone. That wear is off the record." Neither is ever called a delete.
 *
 * A PAST DAY CAN BE WRITTEN. A remembered wear is still a wear (docs/21 §4):
 * the date goes to logWear, which stores it without the planned flag, moves
 * the count and the last-worn date, and — deliberately — leaves the laundry
 * bench alone, because a wear backfilled from last week cannot know what the
 * washing has done since.
 *
 * A FUTURE DAY IS NOT WRITTEN HERE. It shows the plans the record holds and
 * says what a plan is. Making one is the Outfits room's job on the web and
 * has no native surface yet; offering a picker that quietly minted plans
 * would be this screen inventing a feature in the wrong room.
 */
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isFutureDate } from '@almari/shared/dates';
import { isPlannedLog, type ClothingItem, type WearLog } from '@almari/shared/types';

import { photoUri } from '../../lib/photos';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { Button } from '../Button';
import { Sheet } from '../Sheet';
import { showToast } from '../Toast';
import { IconCheck } from '../../icons';

import { longDate, piecesPhrase, shortDate, wearsPhrase } from './month';

/**
 * One piece, flat. Brand law 6: a photograph sits on the room's mat with
 * nothing behind it, and a piece with no photograph shows its own colour on
 * the same mat — an ordinary piece, never a gap to be filled in.
 */
function Thumb({ item, width = 28 }: { item: ClothingItem; width?: number }) {
  const { tokens } = useTheme();
  const uri = item.imageUrl ? photoUri(item.imageUrl) : null;
  return (
    <View
      style={{
        width,
        height: Math.round(width * 1.25),
        borderRadius: RADIUS,
        backgroundColor: tokens.mat,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tokens.border,
      }}
    >
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: item.color }} />
      )}
    </View>
  );
}

export function DaySheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { activeItems, items, outfits, wearLogs, logWear, removeWearLog } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [picked, setPicked] = useState<string[]>([]);

  // A different day is a different page; nothing carries over between them.
  useEffect(() => {
    setPicked([]);
  }, [date]);

  if (date === null) return null;

  // The entries read from `items`, not activeItems: a retired piece that was
  // worn last March was still worn last March, and its history does not
  // disappear from the record because it left the rail.
  const byId = new Map(items.map(i => [i.id, i] as const));
  const logs = wearLogs.filter(l => l.date === date);
  const future = isFutureDate(date);
  const itemWears = activeItems.reduce((sum, i) => sum + i.wearCount, 0);

  const membersOf = (log: WearLog): ClothingItem[] =>
    log.itemIds.map(id => byId.get(id)).filter((i): i is ClothingItem => i !== undefined);

  const describe = (log: WearLog): string => {
    const outfit = log.outfitId ? outfits.find(o => o.id === log.outfitId) : undefined;
    if (outfit) return outfit.name;
    const names = membersOf(log).map(i => i.name);
    if (names.length === 0) return piecesPhrase(log.itemIds.length);
    if (names.length <= 2) return names.join(' + ');
    return `${names[0]} + ${names.length - 1} more`;
  };

  /**
   * Computed BEFORE logWear — a moment later every count has moved and the
   * piece looks like any other. Today's screen states the same reason.
   */
  const firstWearLine = (creditedIds: string[]): string | null => {
    const firsts = creditedIds
      .map(id => byId.get(id))
      .filter((i): i is ClothingItem => i !== undefined && i.wearCount === 0);
    if (firsts.length === 0) return null;
    return firsts.length === 1
      ? `Noted. "${firsts[0].name}" had its first wear.`
      : `Noted. "${firsts[0].name}" and ${firsts.length - 1} more had their first wear.`;
  };

  const togglePick = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));

  const logPieces = () => {
    if (picked.length === 0) return;
    const first = firstWearLine(picked);
    const only = picked.length === 1 ? byId.get(picked[0]) : undefined;
    // The date is the whole point: it goes to logWear, and a set remembered
    // for last Tuesday lands on last Tuesday.
    logWear(picked, undefined, date);
    // The web's own two sentences: today is "Logged.", any other day says
    // which day it went on, because a wear you cannot place is a wear you
    // will log twice.
    const stamp = `Logged for ${shortDate(date)}.`;
    showToast(
      only
        ? `${stamp} "${only.name}" ${wearsPhrase(only.wearCount + 1)}.`
        : `${stamp} ${picked.length} pieces — ${itemWears + picked.length} wears recorded.`,
      'seal',
    );
    if (first) showToast(first, 'info');
    setPicked([]);
  };

  const remove = (log: WearLog) => {
    const planned = isPlannedLog(log);
    removeWearLog(log.id);
    showToast(
      planned ? 'Removed. That plan is off the page.' : 'Undone. That wear is off the record.',
      'info',
    );
  };

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text2,
  };

  return (
    <Sheet open onClose={onClose} label="Close the day">
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.display,
          fontSize: TYPE.editorial,
          color: tokens.text,
          marginBottom: 12,
        }}
      >
        {longDate(date)}
      </Text>

      <ScrollView style={{ maxHeight: 420 }}>
        {logs.length > 0 ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={ledger}>{future ? 'Down for this day' : 'On the record'}</Text>
            {logs.map(log => {
              const planned = isPlannedLog(log);
              const members = membersOf(log);
              return (
                <View key={log.id} style={styles.entry}>
                  <View style={styles.entryRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontFamily: fonts.ui,
                          fontSize: TYPE.body,
                          lineHeight: 21,
                          color: tokens.text,
                        }}
                      >
                        {describe(log)}
                      </Text>
                      <Text style={[ledger, { marginTop: 4 }]}>
                        {planned ? 'Planned' : piecesPhrase(log.itemIds.length)}
                      </Text>
                      {members.length > 0 ? (
                        <View style={styles.thumbs}>
                          {members.slice(0, 3).map(item => (
                            <Thumb key={item.id} item={item} />
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <Button tone="tertiary" onPress={() => remove(log)}>
                      {planned ? 'Remove' : 'Undo'}
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* A past day nobody wrote down. A fact, not a failure, and never red. */}
        {logs.length === 0 && !future ? (
          <Text style={[ledger, { marginBottom: 20 }]}>Not logged</Text>
        ) : null}

        {future ? (
          <View>
            {logs.length === 0 ? (
              <Text
                style={{
                  fontFamily: fonts.displayItalic,
                  fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                  fontSize: TYPE.editorial,
                  color: tokens.text,
                  marginBottom: 8,
                }}
              >
                Nothing is down for this day.
              </Text>
            ) : null}
            <Text style={body}>
              A day that has not happened yet holds plans, not wears, and nothing is counted until
              it arrives. This phone reads a plan but does not yet put one down.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={ledger}>Log a wear for this day</Text>
            {activeItems.length === 0 ? (
              <Text style={[body, { marginTop: 10 }]}>
                The closet is empty, so there is nothing to put on this day yet.
              </Text>
            ) : (
              <View style={styles.pickGrid}>
                {activeItems.map(item => {
                  const selected = picked.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      accessibilityState={{ selected }}
                      onPress={() => togglePick(item.id)}
                      style={[
                        styles.pickTile,
                        { borderColor: selected ? tokens.text : tokens.border },
                        selected && { backgroundColor: tokens.sunken },
                      ]}
                    >
                      <Thumb item={item} />
                      <Text
                        numberOfLines={2}
                        style={{
                          flex: 1,
                          fontFamily: fonts.ui,
                          fontSize: 13,
                          color: tokens.text,
                        }}
                      >
                        {item.name}
                      </Text>
                      {selected ? <IconCheck size={14} color={tokens.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: tokens.border }]}>
        {future || activeItems.length === 0 ? (
          <>
            <View />
            <Button tone="secondary" onPress={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Text style={ledger}>{picked.length} selected</Text>
            {/* One primary button on this page, and it is the log. */}
            <Button tone="primary" disabled={picked.length === 0} onPress={logPieces}>
              {picked.length > 1 ? `Log ${picked.length} pieces` : 'Log this'}
            </Button>
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  entry: {
    marginTop: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  thumbs: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  pickGrid: {
    gap: 8,
    marginTop: 10,
  },
  pickTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
