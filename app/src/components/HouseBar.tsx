/**
 * THE HOUSE BAR — the shell's own bottom rail (docs/42 §1, §3, §9).
 *
 * Anatomy, stated by the ruling and drawn here without invention: ground
 * `--color-surface`; a hairline top rule in `--color-border` that IS the rail
 * rather than decoration; content 56dp plus the bottom safe-area inset; slots
 * equal-flex and full-height, so every target is ≥44dp by construction. Icons
 * 24×24 at 1.5px in the theme's ink — `--color-text-2` resting, `--color-text`
 * active. Labels at the 13px floor (TYPE.label), 600, uppercase, 0.5 tracking,
 * 4dp under the icon. The 11px rail exception is retired: the word shrinks
 * (LOOK BOOK becomes LOOKS), never the type.
 *
 * THE ACTIVE MARK IS AN EYELET — a 6dp filled circle in `--color-accent`,
 * punched through the top hairline over the active slot: the rail holds the
 * sheets, and here hangs the current one. Circles are lawful for eyelets
 * (brand law 5). `--color-accent` is per-room, so the bead is room-aware by
 * construction and no room needs a special case.
 *
 * The bead rides the PAGER OFFSET, interpolated over MEASURED slot centres —
 * measured, not computed, because the geometry law says the bar derives from
 * the visible roster and a measured centre cannot drift from what was drawn.
 * Until the first layout lands, the centres fall back to equal-flex maths so
 * the bead is never stranded at zero.
 *
 * NAVIGATOR-AGNOSTIC BY CONTRACT (docs/42 §3, the pre-declared retreat).
 * `position` is optional: under Option B — plain bottom `Tabs`, no pager —
 * and under reduced motion it is simply absent, the eyelet becomes a punched
 * mark at the active slot, and nothing else about the bar changes. That is
 * the whole cost of the retreat, priced before the wave rather than after.
 *
 * REDUCED MOTION (docs/42 §3): the bead does not travel, it is punched at the
 * new slot. The drag itself still tracks the finger — the user's own hand is
 * not motion the system asked for — and that is the navigator's business, not
 * this file's.
 *
 * NO NOTIFICATION CHROME OF ANY KIND. No dot, no numeral, nothing at whisper
 * weight; the record refuses it three times (toile-social #3, docs/11,
 * docs/19). A waiting message is discovered by walking into Chats.
 */
import { useCallback, useMemo, useState, type ComponentType } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconProps } from '../icons';
import { useFamilies } from '../tokens/FontsContext';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

/** The pressed circle's diameter. Six, and the ruling says six. */
const EYELET = 6;
/** Content height above the safe-area inset. */
const BAR_HEIGHT = 56;

export interface HouseBarSlot {
  /** The roster's key — 'today', 'closet', 'lookbook', 'chats', 'house'. */
  key: string;
  /** The word as a person reads it aloud; the bar sets it uppercase. */
  label: string;
  Icon: ComponentType<IconProps>;
  /** Spoken after the label. The House slot's is "Hold to switch wardrobes." */
  hint?: string;
}

export interface HouseBarProps {
  /** The VISIBLE roster, in order. Four slots in alpha, five in showcase. */
  slots: HouseBarSlot[];
  activeIndex: number;
  /**
   * The pager's own offset in slot units (0…n-1). Absent under Option B and
   * under reduced motion, where the eyelet is punched rather than travelled.
   */
  position?: Animated.AnimatedInterpolation<number>;
  reduceMotion: boolean;
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
}

export function HouseBar({
  slots,
  activeIndex,
  position,
  reduceMotion,
  onPress,
  onLongPress,
}: HouseBarProps) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const insets = useSafeAreaInsets();

  // Measured slot centres, in bar coordinates. The array is keyed by index and
  // starts empty; `centres` below fills the gaps with equal-flex maths so the
  // first frame is right even before onLayout has spoken.
  const [measured, setMeasured] = useState<number[]>([]);
  const [barWidth, setBarWidth] = useState(0);

  const onSlotLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const centre = x + width / 2;
    setMeasured(prev => {
      if (prev[index] === centre) return prev;
      const next = prev.slice();
      next[index] = centre;
      return next;
    });
  }, []);

  const centres = useMemo(
    () =>
      slots.map((_, i) =>
        typeof measured[i] === 'number'
          ? measured[i]
          : // Equal flex: the bar divided by the VISIBLE roster (geometry law).
            (barWidth / slots.length) * (i + 0.5),
      ),
    [slots, measured, barWidth],
  );

  const active = Math.min(Math.max(activeIndex, 0), Math.max(slots.length - 1, 0));

  /**
   * The bead's x. Travelled when the pager offers an offset and the system has
   * not asked for stillness; punched otherwise. `interpolate` needs at least
   * two stops, so a one-slot bar (a state no roster produces, but a component
   * contract should survive) falls through to the punched mark.
   */
  const beadX =
    position && !reduceMotion && slots.length > 1
      ? position.interpolate({
          inputRange: slots.map((_, i) => i),
          outputRange: centres.map(c => c - EYELET / 2),
          extrapolate: 'clamp',
        })
      : (centres[active] ?? 0) - EYELET / 2;

  const label = {
    fontFamily: fonts.ui,
    fontSize: TYPE.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 4,
  };

  return (
    // The 3dp gutter is transparent on purpose: it is the half of the eyelet
    // that sits ABOVE the rule, over the page's own ground, which is what
    // makes the mark read as punched through the hairline rather than resting
    // on top of it. Nothing else lives in it, and it clips nothing.
    <View
      testID="house-bar"
      style={styles.wrap}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
    >
      <View
        testID="house-bar-rule"
        style={[
          styles.bar,
          {
            backgroundColor: tokens.surface,
            borderTopColor: tokens.border,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.row}>
          {slots.map((slot, i) => {
            const selected = i === active;
            const { Icon } = slot;
            return (
              <Pressable
                key={slot.key}
                testID={`house-bar-slot-${slot.key}`}
                onLayout={e => onSlotLayout(i, e)}
                onPress={() => onPress(i)}
                // Pressable's own long press — 350ms by default, and no
                // gesture library anywhere near the bar (docs/42 §1).
                onLongPress={() => onLongPress(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                // The count is the VISIBLE roster's, never the full one.
                accessibilityLabel={`${slot.label}, tab ${i + 1} of ${slots.length}`}
                accessibilityHint={slot.hint}
                style={({ pressed }) => [styles.slot, pressed && { opacity: 0.7 }]}
              >
                <Icon size={24} color={selected ? tokens.text : tokens.text2} />
                <Text style={[label, { color: selected ? tokens.text : tokens.text2 }]}>
                  {slot.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Furniture, not content: the eyelet says nothing a screen reader has
          not already heard from the selected tab. */}
      <Animated.View
        testID="house-bar-eyelet"
        accessibilityElementsHidden
        importantForAccessibility="no"
        pointerEvents="none"
        style={[
          styles.eyelet,
          { backgroundColor: tokens.accent, transform: [{ translateX: beadX }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Room for the top half of the eyelet, and nothing else.
    paddingTop: EYELET / 2,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  slot: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyelet: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: EYELET,
    height: EYELET,
    // A circle, which is what an eyelet is allowed to be (brand law 5).
    borderRadius: EYELET / 2,
  },
});
