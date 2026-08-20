/**
 * THE HOUSE BAR, on its own bench.
 *
 * tabs.test.tsx proves the bar inside the shell; this proves the COMPONENT
 * CONTRACT, because docs/42 §3 makes that contract load-bearing: HouseBar is
 * navigator-agnostic so the pre-declared retreat to plain bottom `Tabs`
 * (Option B) costs one import and nothing else. A bar that quietly required
 * the pager's `position` would make the retreat a rewrite, and this suite is
 * where that would show up — every case below renders WITHOUT a `position`,
 * which is exactly the Option-B and reduced-motion shape.
 *
 * The anatomy asserted here is the ruling's, stated as numbers rather than
 * as vibes: the 13px label floor restored (§1 — the 11px rail exception is
 * retired, and §9 says no 11px interactive text remains in either app), a
 * 56dp full-height slot so every target clears 44dp by construction, the
 * hairline top rule, and the 6dp eyelet that is furniture rather than
 * content. The slot count comes from the VISIBLE roster, which is what makes
 * "Today, tab 1 of 4" true in alpha and "of 5" in showcase.
 */
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Animated, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { HouseBar, type HouseBarSlot } from '../src/components/HouseBar';
import { IconChats, IconCloset, IconFeed, IconHouse, IconToday } from '../src/icons';
import { FontsProvider } from '../src/tokens/FontsContext';
import { ThemeProvider } from '../src/tokens/ThemeContext';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ALPHA: HouseBarSlot[] = [
  { key: 'today', label: 'Today', Icon: IconToday },
  { key: 'closet', label: 'Closet', Icon: IconCloset },
  { key: 'chats', label: 'Chats', Icon: IconChats },
  { key: 'house', label: 'House', Icon: IconHouse, hint: 'Hold to switch wardrobes.' },
];

const SHOWCASE: HouseBarSlot[] = [
  ALPHA[0],
  ALPHA[1],
  { key: 'lookbook', label: 'Looks', Icon: IconFeed },
  ALPHA[2],
  ALPHA[3],
];

/**
 * The pager's own offset, in slot units — the shape react-native-tab-view
 * hands a tab bar (`SceneRendererProps.position`). Parked at `at` so the
 * bead's resolved x can be read as a number and compared against the two
 * answers the ruling distinguishes.
 */
const offset = (at: number) =>
  new Animated.Value(at).interpolate({ inputRange: [0, 4], outputRange: [0, 4] });

/**
 * Jest fires no layout of its own, so the bar's measurements are handed to it
 * the way a device would: a 400dp bar and four 100dp slots, which puts the
 * measured centres at 50 · 150 · 250 · 350.
 */
function measure(bar: ReturnType<typeof render>) {
  fireEvent(bar.getByTestId('house-bar', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 62 } },
  });
  bar.getAllByRole('tab').forEach((slot, i) => {
    fireEvent(slot, 'layout', {
      nativeEvent: { layout: { x: i * 100, y: 0, width: 100, height: 56 } },
    });
  });
}

/** The eyelet's resolved x. The bead is 6dp wide, so its box starts 3 left. */
function beadTranslate(bar: ReturnType<typeof render>): number {
  const style = StyleSheet.flatten(
    bar.getByTestId('house-bar-eyelet', { includeHiddenElements: true }).props.style,
  ) as ViewStyle;
  return (style.transform as { translateX: number }[])[0].translateX;
}

function mount(props: Partial<Parameters<typeof HouseBar>[0]> = {}) {
  const onPress = jest.fn();
  const onLongPress = jest.fn();
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <FontsProvider loaded={false}>
          <HouseBar
            slots={ALPHA}
            activeIndex={0}
            reduceMotion={false}
            onPress={onPress}
            onLongPress={onLongPress}
            {...props}
          />
        </FontsProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...view, onPress, onLongPress };
}

describe('the bar reads the visible roster', () => {
  test('four slots announce four, and five announce five', () => {
    const alpha = mount();
    expect(alpha.getAllByRole('tab')).toHaveLength(4);
    expect(alpha.getByLabelText('Today, tab 1 of 4')).toBeTruthy();
    expect(alpha.getByLabelText('House, tab 4 of 4')).toBeTruthy();
    alpha.unmount();

    // The count is the visible roster's, never NAV_SLOTS' — the geometry law.
    const showcase = mount({ slots: SHOWCASE, activeIndex: 2 });
    expect(showcase.getAllByRole('tab')).toHaveLength(5);
    expect(showcase.getByLabelText('Looks, tab 3 of 5')).toBeTruthy();
    expect(showcase.getByLabelText('House, tab 5 of 5')).toBeTruthy();
  });

  test('exactly one slot reads as selected, and it is the active one', () => {
    const bar = mount({ activeIndex: 2 });
    const selected = bar
      .getAllByRole('tab')
      .filter(node => node.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toBe('Chats, tab 3 of 4');
  });

  test('only the House slot says it can be held', () => {
    const bar = mount();
    expect(bar.getByLabelText('House, tab 4 of 4').props.accessibilityHint).toBe(
      'Hold to switch wardrobes.',
    );
    for (const label of ['Today, tab 1 of 4', 'Closet, tab 2 of 4', 'Chats, tab 3 of 4']) {
      expect(bar.getByLabelText(label).props.accessibilityHint).toBeUndefined();
    }
  });

  test('a press and a hold report the slot they landed on', () => {
    const bar = mount();
    fireEvent.press(bar.getByLabelText('Closet, tab 2 of 4'));
    expect(bar.onPress).toHaveBeenCalledWith(1);

    fireEvent(bar.getByLabelText('House, tab 4 of 4'), 'longPress');
    expect(bar.onLongPress).toHaveBeenCalledWith(3);
  });
});

describe('the anatomy the ruling states', () => {
  test('labels sit at the 13px floor — the 11px rail exception is retired', () => {
    const bar = mount();
    for (const word of ['Today', 'Closet', 'Chats', 'House']) {
      const style = StyleSheet.flatten(bar.getByText(word).props.style) as TextStyle;
      expect(style.fontSize).toBe(13);
      expect(style.fontWeight).toBe('600');
      expect(style.textTransform).toBe('uppercase');
      expect(style.letterSpacing).toBe(0.5);
    }
  });

  test('every slot is a 56dp full-height target, well past the 44dp floor', () => {
    const bar = mount();
    for (const slot of bar.getAllByRole('tab')) {
      const style = StyleSheet.flatten(slot.props.style) as ViewStyle;
      expect(style.height).toBe(56);
      expect(style.flex).toBe(1);
    }
  });

  test('the top rule is a hairline, and the bar clears the home indicator', () => {
    const bar = mount();
    const rule = StyleSheet.flatten(bar.getByTestId('house-bar-rule').props.style) as ViewStyle;
    expect(rule.borderTopWidth).toBe(StyleSheet.hairlineWidth);
    // 34 is the metrics' bottom inset: the bar sits above it, never under it.
    expect(rule.paddingBottom).toBe(34);
  });

  test('the eyelet is a 6dp circle and is furniture, not content', () => {
    const bar = mount();
    const eyelet = bar.getByTestId('house-bar-eyelet', { includeHiddenElements: true });
    const style = StyleSheet.flatten(eyelet.props.style) as ViewStyle;
    expect(style.width).toBe(6);
    expect(style.height).toBe(6);
    // Circles are lawful for eyelets, and only for eyelets.
    expect(style.borderRadius).toBe(3);
    // It says nothing a screen reader has not already heard from the tab.
    expect(eyelet.props.importantForAccessibility).toBe('no');
    expect(eyelet.props.accessibilityElementsHidden).toBe(true);
  });

  test('no notification chrome of any kind rides the bar', () => {
    const bar = mount();
    // Four icons, four words, and the eyelet. Nothing counts anything.
    expect(bar.queryByTestId('house-bar-badge')).toBeNull();
    for (const banned of [/\d/, /unread/i, /\bnew\b/i]) {
      expect(bar.queryByText(banned)).toBeNull();
    }
  });
});

describe('the retreat and the reduced-motion answer', () => {
  test('without a pager offset the bar still draws — Option B costs nothing', () => {
    // No `position`: this is exactly the plain-Tabs shape.
    const bar = mount({ activeIndex: 3 });
    expect(bar.getAllByRole('tab')).toHaveLength(4);
    expect(bar.getByTestId('house-bar-eyelet', { includeHiddenElements: true })).toBeTruthy();
    expect(bar.getByLabelText('House, tab 4 of 4').props.accessibilityState.selected).toBe(true);
  });

  test('the bead rides the pager offset over the MEASURED slot centres', () => {
    // The sheet is halfway between Closet and Chats.
    const bar = mount({ activeIndex: 1, position: offset(1.5) });
    measure(bar);
    // Halfway between the measured centres 150 and 250, less half the bead.
    expect(beadTranslate(bar)).toBe(197);
  });

  test('under reduced motion the bead is punched at the active slot, not travelled', () => {
    // The same mid-swipe offset is on hand: the bar must DECLINE it rather
    // than merely lack it, or "punched, not travelled" is an accident.
    const bar = mount({ activeIndex: 1, position: offset(1.5), reduceMotion: true });
    measure(bar);
    // Closet's own centre, 150, less half the bead. The offset is ignored.
    expect(beadTranslate(bar)).toBe(147);
  });
});
