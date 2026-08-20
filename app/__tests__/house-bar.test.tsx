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
 * the way a device would: a 400dp bar divided equally by the VISIBLE roster,
 * which puts four slots' centres at 50 · 150 · 250 · 350 and five slots' at
 * 40 · 120 · 200 · 280 · 360. The division is the geometry law's own — the
 * bar over the visible count — so the bench cannot flatter a bar that has
 * quietly started measuring against the full roster.
 */
function measure(bar: ReturnType<typeof render>, barWidth = 400) {
  fireEvent(bar.getByTestId('house-bar', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: barWidth, height: 62 } },
  });
  const tabs = bar.getAllByRole('tab');
  const slotWidth = barWidth / tabs.length;
  tabs.forEach((slot, i) => {
    fireEvent(slot, 'layout', {
      nativeEvent: { layout: { x: i * slotWidth, y: 0, width: slotWidth, height: 56 } },
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

/**
 * THE ARTIST PASS (docs/42 §3 "the feel", §8 the motif budget, §10 QA 3).
 *
 * Three claims, and each one is a number rather than a vibe: the rule bisects
 * the bead; the bead is a LINEAR map of the finger's own offset; and the
 * animated node that carries it survives the render the pager fires in the
 * middle of its own settle.
 */
describe('the bead, tuned', () => {
  test('the rule bisects the bead — punched through the hairline, not hung under it', () => {
    const bar = mount();
    const wrap = StyleSheet.flatten(
      bar.getByTestId('house-bar', { includeHiddenElements: true }).props.style,
    ) as ViewStyle | undefined;
    const rule = StyleSheet.flatten(bar.getByTestId('house-bar-rule').props.style) as ViewStyle;
    const eyelet = StyleSheet.flatten(
      bar.getByTestId('house-bar-eyelet', { includeHiddenElements: true }).props.style,
    ) as ViewStyle;

    // The air above the bar is the BAR'S MARGIN, never the wrapper's padding.
    // An absolutely positioned child's `top` is resolved against its parent's
    // padding edge, so air held as padding here would drop the whole bead
    // below the rule and the mark would hang from the rail instead of being
    // punched through it.
    expect(wrap?.paddingTop).toBeUndefined();

    const ruleY = rule.marginTop as number;
    const beadCentreY = (eyelet.top as number) + (eyelet.height as number) / 2;
    expect(ruleY).toBe(3);
    expect(beadCentreY).toBe(ruleY);
  });

  test('the bead waits for the rail to be measured rather than flashing at its end', () => {
    const bar = mount({ activeIndex: 2 });
    const before = StyleSheet.flatten(
      bar.getByTestId('house-bar-eyelet', { includeHiddenElements: true }).props.style,
    ) as ViewStyle;
    // No layout has been fired yet, so every stop resolves to zero and the
    // bead's honest x is half off the rail's left end. It is not drawn there.
    expect(before.opacity).toBe(0);

    measure(bar);
    const after = StyleSheet.flatten(
      bar.getByTestId('house-bar-eyelet', { includeHiddenElements: true }).props.style,
    ) as ViewStyle;
    expect(after.opacity).toBe(1);
    expect(beadTranslate(bar)).toBe(247);
  });

  test('the bead is 1:1 under the finger — a linear map with no easing of its own', () => {
    const at = (o: number) => {
      const bar = mount({ activeIndex: 1, position: offset(o) });
      measure(bar);
      const x = beadTranslate(bar);
      bar.unmount();
      return x;
    };

    // Measured centres 50 · 150 · 250 · 350; the bead's box starts 3 left.
    expect(at(1)).toBe(147);
    expect(at(1.25)).toBe(172);
    expect(at(1.5)).toBe(197);
    expect(at(1.75)).toBe(222);
    expect(at(2)).toBe(247);

    // Equal quarters of the finger's travel are equal quarters of the bead's.
    // That IS 1:1, and it is what keeps the bead pinned to the sheet it marks:
    // any easing injected between the stops would make it lead or trail.
    expect([at(1.25) - at(1), at(1.5) - at(1.25), at(1.75) - at(1.5), at(2) - at(1.75)]).toEqual([
      25, 25, 25, 25,
    ]);
  });

  test('the rail has two ends — an over-scroll cannot walk the bead off it', () => {
    const low = mount({ activeIndex: 0, position: offset(-0.6) });
    measure(low);
    expect(beadTranslate(low)).toBe(47);
    low.unmount();

    const high = mount({ activeIndex: 3, position: offset(3.8) });
    measure(high);
    expect(beadTranslate(high)).toBe(347);
  });

  test('the showcase roster moves the stops, because the geometry reads the visible bar', () => {
    // Five slots in 400dp: centres 40 · 120 · 200 · 280 · 360.
    const bar = mount({ slots: SHOWCASE, activeIndex: 2, position: offset(2.5) });
    measure(bar);
    // Halfway between LOOKS (200) and CHATS (280), less half the bead.
    expect(beadTranslate(bar)).toBe(237);
    bar.unmount();

    // And the fifth slot has a stop of its own to be punched at — a bar that
    // measured a fixed four would strand the bead at the rail's left end.
    const last = mount({ slots: SHOWCASE, activeIndex: 4, reduceMotion: true });
    measure(last);
    expect(beadTranslate(last)).toBe(357);
  });

  test('one settle, no drift — the pager’s mid-settle render rebuilds nothing', () => {
    const position = offset(0);
    const built = jest.spyOn(position, 'interpolate');

    // The shell rebuilds the roster array on every render (state.routes.map),
    // so the bench does too: geometry that keyed on the array's identity would
    // throw its animated node away on each of those renders.
    const tree = (activeIndex: number) => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <FontsProvider loaded={false}>
            <HouseBar
              slots={ALPHA.slice()}
              activeIndex={activeIndex}
              position={position}
              reduceMotion={false}
              onPress={() => {}}
              onLongPress={() => {}}
            />
          </FontsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );

    const bar = render(tree(0));
    measure(bar);
    const afterLayout = built.mock.calls.length;
    // The measurements moved the stops, so a node had to be built for them.
    expect(afterLayout).toBeGreaterThan(0);

    // Now the pager selects its page — which happens in the MIDDLE of its own
    // settle and re-renders this bar with a new index and a new roster array.
    // A node rebuilt here is detached and re-attached mid-flight, and a
    // natively driven node re-attached mid-flight resumes from its stale JS
    // value: that is QA 3's bead "stranded between stops".
    bar.rerender(tree(1));
    bar.rerender(tree(2));
    expect(built.mock.calls.length).toBe(afterLayout);

    built.mockRestore();
  });
});
