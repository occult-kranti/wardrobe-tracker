/**
 * Today — ports src/pages/Dashboard.tsx (docs/34 §2.2), the alpha slice:
 * the day's date (shared dates — local YYYY-MM-DD, never toISOString),
 * what is on the record today, and the two-tap log: pick pieces, one
 * confirm tap, the seal toast. Copy is the web's own, byte for byte.
 *
 * The week strip under the masthead is the calendar, standing behind Today
 * (docs/42 §6): seven quiet columns ending on today, a month door at its
 * head, and a tap that opens the day's own page. It never stands in front of
 * the hero button — logging TODAY is two taps here and stays two taps.
 *
 * Web-only for now (named, not forgotten): outfit choices and suggestions,
 * "Same as yesterday", matured-plan questions, the weather ask, the tour,
 * the recent-ledger band. Each returns with its own wave.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { todayLocal } from '@almari/shared/dates';
import { isPlannedLog, type ClothingItem, type WearLog } from '@almari/shared/types';

import { Button } from '../../components/Button';
import { calendarHref } from '../../components/calendar/addresses';
import { WeekStrip } from '../../components/calendar/WeekStrip';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { IconCheck, IconEyeletFilled } from '../../icons';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/* ---------- ported helpers (Dashboard.tsx, byte-faithful) ---------- */

function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late, then';
}

/** 'YYYY-MM-DD' → a Date at local midnight. Never parse these as UTC. */
function localDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function shortDate(dateStr: string): string {
  return localDate(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function wearsPhrase(n: number): string {
  return n === 1 ? 'worn once' : `worn ${n} times`;
}

export default function TodayScreen() {
  const { activeItems, wearLogs, outfits, logWear, removeWearLog, isSample, wardrobeName } =
    useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const today = todayLocal();
  const byId = useMemo(
    () => new Map(activeItems.map(i => [i.id, i] as const)),
    [activeItems],
  );

  // A plan whose day has arrived is a QUESTION, not a fact. Only confirmed
  // wears count as "logged today".
  const todayLogs = useMemo(
    () => wearLogs.filter(l => l.date === today && !isPlannedLog(l)),
    [wearLogs, today],
  );
  const loggedToday = todayLogs.length > 0;
  const itemWears = useMemo(
    () => activeItems.reduce((sum, i) => sum + i.wearCount, 0),
    [activeItems],
  );

  const namesFor = (log: WearLog): string[] =>
    log.itemIds.map(id => byId.get(id)?.name).filter((n): n is string => Boolean(n));

  const describeLog = (log: WearLog): string => {
    const outfit = log.outfitId ? outfits.find(o => o.id === log.outfitId) : undefined;
    if (outfit) return outfit.name;
    const names = namesFor(log);
    if (names.length === 0) return `${log.itemIds.length} pieces`;
    if (names.length <= 2) return names.join(' + ');
    return `${names[0]} + ${names.length - 1} more`;
  };

  /**
   * The first-wear line has to be computed BEFORE logWear — a moment later
   * every count has moved and the piece looks like any other.
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

  const openSheet = () => {
    setPicked([]);
    setSheetOpen(true);
  };

  const togglePick = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));

  const logPieces = () => {
    if (picked.length === 0) return;
    const first = firstWearLine(picked);
    const only = picked.length === 1 ? byId.get(picked[0]) : undefined;
    logWear(picked);
    showToast(
      only
        ? `Logged. "${only.name}" ${wearsPhrase(only.wearCount + 1)}.`
        : `Logged. ${picked.length} pieces — ${itemWears + picked.length} wears recorded.`,
      'seal',
    );
    if (first) showToast(first, 'info');
    setSheetOpen(false);
    setPicked([]);
  };

  const undoLog = (log: WearLog) => {
    removeWearLog(log.id);
    showToast('Undone. That wear is off the record.', 'info');
  };

  const ledgerLabel = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 24 }}>
        <Masthead title={greetingFor(new Date().getHours())} meta={shortDate(today)} />

        {/* A sample says so, always — nothing here is anybody's record. */}
        {isSample ? (
          <Text style={[ledgerLabel, { marginBottom: 12 }]}>
            {wardrobeName ?? 'A sample'} · a sample, not your record
          </Text>
        ) : null}

        {/* THE WEEK STRIP — the calendar behind Today (docs/42 §6). It waits
            for the closet to hold something: over an empty wardrobe it would
            be seven numerals with nothing to open, and the first thing on the
            page should be the sentence that says where to start. */}
        {activeItems.length > 0 ? (
          <WeekStrip
            today={today}
            wearLogs={wearLogs}
            onOpenDay={date => router.push(calendarHref(date))}
            onOpenMonth={() => router.push(calendarHref())}
          />
        ) : null}

        {activeItems.length === 0 ? (
          <View
            style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <Text
              style={{
                fontFamily: fonts.displayItalic,
                fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                fontSize: TYPE.editorial,
                color: tokens.text,
                marginBottom: 8,
              }}
            >
              Nothing in the closet yet.
            </Text>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: TYPE.body,
                lineHeight: Math.round(TYPE.body * 1.5),
                color: tokens.text2,
                marginBottom: 16,
              }}
            >
              The first piece starts the record. All it needs is a name; the photo is optional,
              and every wear it earns after that is counted.
            </Text>
            <Button tone="primary" onPress={() => router.push('/closet')}>
              Open the closet
            </Button>
          </View>
        ) : (
          <View
            style={[
              styles.plate,
              // The hero card sits on the ink-edged plate, as the web's
              // plate-ink does — a hairline in the room's ink, no shadow.
              { backgroundColor: tokens.surface, borderColor: tokens.text },
            ]}
          >
            {loggedToday ? (
              <View style={{ alignSelf: 'stretch' }}>
                <Text style={ledgerLabel}>On the record today</Text>
                {todayLogs.map(log => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontFamily: fonts.displayItalic,
                          fontStyle:
                            fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                          fontSize: 21,
                          lineHeight: 26,
                          color: tokens.text,
                        }}
                      >
                        {describeLog(log)}
                      </Text>
                    </View>
                    <Button tone="tertiary" onPress={() => undoLog(log)}>
                      Undo
                    </Button>
                  </View>
                ))}
                <View style={[styles.logFooter, { borderTopColor: tokens.border }]}>
                  <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.text2 }}>
                    Wore something else as well?
                  </Text>
                  <Button
                    tone="hero"
                    compact
                    icon={<IconEyeletFilled size={10} color={tokens.onAccent} />}
                    onPress={openSheet}
                  >
                    Log another
                  </Button>
                </View>
              </View>
            ) : (
              <View style={{ alignSelf: 'stretch' }}>
                <Text style={ledgerLabel}>Today</Text>
                <Text
                  style={{
                    fontFamily: fonts.displayItalic,
                    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                    fontSize: 22,
                    lineHeight: 27,
                    color: tokens.text,
                    marginTop: 8,
                  }}
                >
                  Today's page is still blank.
                </Text>
                <Text
                  style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text2, marginTop: 4 }}
                >
                  Two taps and it's on the record for good.
                </Text>
                <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
                  {/* The one sanctioned hero fill on this view: log wear. */}
                  <Button
                    tone="hero"
                    icon={<IconEyeletFilled size={10} color={tokens.onAccent} />}
                    onPress={openSheet}
                  >
                    Log today's wear
                  </Button>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* The picker: tap the pieces, then one tap to log. */}
      {sheetOpen ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
          <View style={styles.backdrop}>
            <Pressable
              accessibilityLabel="Close"
              style={{ flex: 1 }}
              onPress={() => setSheetOpen(false)}
            />
            <View
              style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            >
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: TYPE.editorial,
                  color: tokens.text,
                  marginBottom: 12,
                }}
              >
                What was worn
              </Text>
              <ScrollView style={{ maxHeight: 380 }}>
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
                        <View
                          style={{
                            width: 32,
                            height: 40,
                            borderRadius: RADIUS,
                            backgroundColor: item.color,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: tokens.border,
                          }}
                        />
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
              </ScrollView>
              <View style={[styles.logFooter, { borderTopColor: tokens.border }]}>
                <Text style={ledgerLabel}>{picked.length} selected</Text>
                <Button tone="primary" disabled={picked.length === 0} onPress={logPieces}>
                  {picked.length > 1 ? `Log ${picked.length} pieces` : 'Log this'}
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'flex-start',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  pickGrid: {
    gap: 8,
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
});
