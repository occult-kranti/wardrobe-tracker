/**
 * THE WEEK STRIP — the calendar, standing behind Today (docs/42 §6).
 *
 * Seven quiet columns under the masthead: a weekday letter, the date numeral,
 * and a mark if the day was written. Today is the last column and the only
 * emphasised one — it carries the plate's ink edge, the way the web's Calendar
 * gives today `plate-ink` and every other day the plain hairline.
 *
 * THE TAP ARITHMETIC, which is the whole reason this exists (docs/42 §6):
 * the metaphor never adds a tap and twice it returns one. Logging TODAY is
 * unchanged at two taps — the hero button below is untouched and the strip
 * never stands in front of it. Logging a day THIS WEEK was four taps through
 * the month door and is three from here: tap the day, tap the piece, tap Log.
 * That is why a strip day opens its own page with the picker already on it
 * rather than a menu offering to open one.
 *
 * WHAT THE STRIP DOES NOT DO. It states no streak, no run, no "5 of 7 days"
 * and no colour that deepens with diligence (brand law 11, and DayMark says
 * the rest). A blank day is blank: a fact, not a failure, and never red.
 *
 * DEFERRED, NAMED: docs/42's event eyelet ("an eyelet over days holding
 * events"). The native app has no events surface yet — the document carries
 * `events: []` and nothing reads it — so the strip would be drawing a mark
 * for a thing that cannot exist. It returns with the events port.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WearLog } from '@almari/shared/types';

import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

import { DayMark } from './DayMark';
import {
  dayMark,
  dayNumber,
  logsByDate,
  longDate,
  piecesPhrase,
  piecesWorn,
  spanLabel,
  trailingWeek,
  weekdayInitial,
} from './month';

export function WeekStrip({
  today,
  wearLogs,
  onOpenDay,
  onOpenMonth,
}: {
  /** The local day, passed in so the strip and its page never disagree. */
  today: string;
  wearLogs: WearLog[];
  onOpenDay: (date: string) => void;
  onOpenMonth: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  const days = trailingWeek(today);
  const byDate = logsByDate(wearLogs);

  const label = {
    fontFamily: fonts.ui,
    fontSize: TYPE.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPE.labelSpacing,
  };

  return (
    <View style={[styles.wrap, { borderBottomColor: tokens.border }]}>
      {/* THE MONTH DOOR. docs/42 seats it at the strip's end; the lead's
          ruling this wave seats it as the strip's header, which is also where
          a reader looks to find out which month they are reading. One tap to
          the whole month — the deep archive is never more than that. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open the month, ${spanLabel(days[0], days[6])}`}
        onPress={onOpenMonth}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.85 }]}
      >
        <Text style={[label, { color: tokens.text2 }]}>{spanLabel(days[0], days[6])}</Text>
        <Text style={[label, { color: tokens.accent, textDecorationLine: 'underline' }]}>
          Open the month
        </Text>
      </Pressable>

      <View style={styles.row}>
        {days.map(date => {
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
              onPress={() => onOpenDay(date)}
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
                  fontFamily: fonts.mono,
                  // 13px is the interactive floor and a day cell is a control:
                  // the letter sits at the floor, not at the 11px metadata size.
                  fontSize: TYPE.label,
                  color: tokens.text2,
                }}
              >
                {weekdayInitial(date)}
              </Text>
              <Text
                style={{
                  fontFamily: isToday ? fonts.monoMedium : fonts.mono,
                  fontSize: 15,
                  lineHeight: 20,
                  color: tokens.text,
                  marginTop: 2,
                }}
              >
                {dayNumber(date)}
              </Text>
              <DayMark kind={kind} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    // docs/42 §9: week-strip day cells are 44dp targets. The column is taller
    // than it is wide, so the height is the one that has to be stated.
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS,
  },
});
