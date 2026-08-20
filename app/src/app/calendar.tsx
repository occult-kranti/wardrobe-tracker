/**
 * THE CALENDAR — /calendar, the deep archive behind Today's week strip
 * (docs/42 §6). Ports src/pages/Calendar.tsx: the month walk, the past day
 * that can be written, planned days that never look like wears, and the
 * en-IN date voice.
 *
 * A MONTH, NOT A WEEK. The web page is a week because it is a wide page with
 * room to print each day's outfit inside its cell; a phone cell is a numeral
 * wide. So the phone shows the month — which is what a strip's "month door"
 * has to open onto — and the day's own contents live in the sheet that a tap
 * raises. The week is not lost: it is the strip on Today, which is the
 * surface people actually live on.
 *
 * NO HEATMAP, NO SHAME. Every cell is the same ground and the same hairline.
 * A written day carries a short rule; a planned day carries a basted one; a
 * blank day is blank. Nothing deepens with diligence, nothing fades with
 * neglect, and no total anywhere on this page is a score (brand law 11).
 *
 * A PUSHED ROUTE OWES A DOOR OUT. This route sits on the root stack, outside
 * the tabs and under a header-less Stack, so it draws its own way back and
 * that way is Today — the room the strip that opens it lives in.
 *
 * COLD OPEN WITH NO WARDROBE goes to /open, the same answer the tabs give
 * (this wave's ruling R7). A deep link into a month of a wardrobe that has
 * not been chosen yet is a page with nothing to be about.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDays, todayLocal } from '@almari/shared/dates';

import { Button } from '../components/Button';
import { TODAY } from '../components/calendar/addresses';
import { DayMark } from '../components/calendar/DayMark';
import { DaySheet } from '../components/calendar/DaySheet';
import {
  addMonths,
  dayMark,
  dayNumber,
  firstOfMonth,
  localDate,
  logsByDate,
  longDate,
  monthGrid,
  monthLabel,
  monthOf,
  piecesPhrase,
  piecesWorn,
  thisMonth,
  weekdayInitial,
  type MonthKey,
} from '../components/calendar/month';
import { Masthead } from '../components/Masthead';
import { useWardrobe } from '../lib/wardrobe';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

/** A day parameter is only a day if it is shaped like one. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The month steppers state the tertiary treatment inline rather than using
 * Button: Button takes its accessibility label from its own text, and
 * "Earlier" read out on its own is not a sentence anybody can act on. The
 * label a screen reader hears here names the month it would land in.
 */
function Step({
  label,
  spoken,
  onPress,
}: {
  label: string;
  spoken: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && { opacity: 0.85 }]}
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
        {label}
      </Text>
    </Pressable>
  );
}

export default function CalendarScreen() {
  const { status, items, wearLogs } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { day } = useLocalSearchParams<{ day?: string }>();

  const focused = typeof day === 'string' && DAY.test(day) ? day : null;
  const today = todayLocal();

  const [month, setMonth] = useState<MonthKey>(() => monthOf(focused ?? today));
  /** The day whose page is open, or null. A focused deep link opens it. */
  const [openDay, setOpenDay] = useState<string | null>(() => focused);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDate = useMemo(() => logsByDate(wearLogs), [wearLogs]);

  /** The Sunday the grid starts on, so the column letters come from the locale. */
  const weekdays = useMemo(() => {
    const first = firstOfMonth(month);
    const sunday = addDays(first, -localDate(first).getDay());
    return Array.from({ length: 7 }, (_, i) => weekdayInitial(addDays(sunday, i)));
  }, [month]);

  const isThisMonth = month === thisMonth();

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(TODAY);
  };

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  if (status === 'none') return <Redirect href="/open" />;

  const nothingYet = items.length === 0 && wearLogs.length === 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.leave}>
          <Button tone="tertiary" onPress={leave}>
            Back to today
          </Button>
        </View>

        <Masthead title="Calendar" meta={monthLabel(month)} />

        {nothingYet ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text
              style={{
                fontFamily: fonts.displayItalic,
                fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                fontSize: TYPE.editorial,
                color: tokens.text,
                marginBottom: 8,
              }}
            >
              The month is still blank.
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
              Days fill in as wears go on the record. The first piece in the closet is what starts
              it — a day here can be written long after it has passed.
            </Text>
            <Button tone="primary" onPress={() => router.replace('/closet')}>
              Open the closet
            </Button>
          </View>
        ) : (
          <>
            <View style={styles.walk}>
              <Step
                label="Earlier"
                spoken={`Go to ${monthLabel(addMonths(month, -1))}`}
                onPress={() => setMonth(m => addMonths(m, -1))}
              />
              <View style={styles.walkCentre}>
                <Text
                  style={{
                    fontFamily: fonts.display,
                    fontSize: TYPE.editorial,
                    lineHeight: 24,
                    color: tokens.text,
                    textAlign: 'center',
                  }}
                >
                  {monthLabel(month)}
                </Text>
                {isThisMonth ? (
                  <Text style={[ledger, { marginTop: 6 }]}>This month</Text>
                ) : (
                  <Step
                    label="This month"
                    spoken={`Back to ${monthLabel(thisMonth())}`}
                    onPress={() => setMonth(thisMonth())}
                  />
                )}
              </View>
              <Step
                label="Later"
                spoken={`Go to ${monthLabel(addMonths(month, 1))}`}
                onPress={() => setMonth(m => addMonths(m, 1))}
              />
            </View>

            {/* The column letters are the one genuinely non-interactive type on
                this page, so 11px mono is lawful here and nowhere else in the
                grid (brand law 7). */}
            <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {weekdays.map((w, i) => (
                <View key={i} style={styles.head}>
                  <Text style={ledger}>{w}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.grid, { borderColor: tokens.border }]}>
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.row}>
                  {week.map((date, di) => {
                    if (date === null) return <View key={`b${di}`} style={styles.cell} />;
                    const logs = byDate.get(date);
                    const kind = dayMark(logs);
                    const isToday = date === today;
                    const worn = piecesWorn(logs);
                    const summary =
                      kind === 'worn'
                        ? `${piecesPhrase(worn)} on the record`
                        : kind === 'planned'
                          ? 'planned'
                          : 'not logged';
                    return (
                      <Pressable
                        key={date}
                        accessibilityRole="button"
                        accessibilityLabel={`${isToday ? 'Today, ' : ''}${longDate(date)}, ${summary}`}
                        onPress={() => setOpenDay(date)}
                        style={({ pressed }) => [
                          styles.cell,
                          isToday && {
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: tokens.text,
                            backgroundColor: tokens.surface,
                          },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: isToday ? fonts.monoMedium : fonts.mono,
                            fontSize: 15,
                            lineHeight: 20,
                            color: tokens.text,
                          }}
                        >
                          {dayNumber(date)}
                        </Text>
                        <DayMark kind={kind} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <Text style={[ledger, { marginTop: 16 }]}>
              Tap a day to read it, or to write down a wear that went unrecorded.
            </Text>
          </>
        )}
      </ScrollView>

      <DaySheet date={openDay} onClose={() => setOpenDay(null)} />
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
  walk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  walkCentre: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  step: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  head: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
  },
  grid: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  cell: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: RADIUS,
  },
});
