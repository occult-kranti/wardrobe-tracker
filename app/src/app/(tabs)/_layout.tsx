/**
 * THE SHELL — the house bar and the sheets it holds (docs/42 §1, §3, §7).
 *
 * Alpha (flag off): TODAY · CLOSET · CHATS · HOUSE, four equal slots.
 * Showcase (flag on): TODAY · CLOSET · LOOKS · CHATS · HOUSE, the Look Book
 * seated centre. Home never moves, because home is Today and the two-tap wear
 * log is the load-bearing wall (§5).
 *
 * ADDRESSES NEVER MOVE. `/` is today, `/closet` the closet, `/feed` the feed
 * the web ships, `/chats` conversations, `/profile` the House — the fifth
 * slot's file is `profile.tsx` so a deep link is the same sentence on both
 * apps; only the slot's word and the masthead say House. Settings has left
 * the bar for a pushed route at `/settings` (§6), verbatim.
 *
 * ONE ROSTER, READ ONCE. The screens below are declared by iterating
 * `NAV_SLOTS` from @almari/shared/nav — the same array the web's phone rail
 * reads, and the same array HouseBar measures its slots and eyelet stops
 * from. Order cannot diverge between the two apps, or between the bar and the
 * pager, because there is only one array to disagree with.
 *
 * THE GEOMETRY LAW. Four slots are four generous drawers of a complete chest:
 * no spacer, no ghost cell, no disabled slot where the Look Book will sit.
 * `TopTabs.Protected` is what makes that true rather than merely intended —
 * under a pager it removes the slot from the bar AND the page from the pager,
 * where a merely-hidden slot would still be swipeable-into.
 *
 * THE SWIPE. `TopTabs` from expo-router/js-top-tabs (SDK 57 vendors it at
 * that subpath and exports `Protected` alongside `Screen`), tab bar seated at
 * the bottom, the bar itself replaced wholesale by HouseBar. The navigator
 * that owns the URL owns the gesture, so there is no second source of truth
 * to fall out of step. `lazy` with a preload distance of one keeps the
 * neighbouring sheet warm without rendering the whole house at boot.
 *
 * THE 11px RAIL EXCEPTION IS RETIRED. Its cause — OUTFITS on the rail — has
 * left the rail, so the bar's labels sit at the 13px floor (TYPE.label) like
 * every other interactive word in the house. The word shrinks (LOOK BOOK
 * becomes LOOKS), never the type.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RETREAT, PRE-DECLARED (docs/42 §3, Option B). If the QA stress list
 * fails on bar/pager sync, on a full traverse, or on Android edge-back, the
 * shell falls back to the current bottom `Tabs` with no swipe. HouseBar is
 * navigator-agnostic by contract, so the flip is this and nothing else:
 *
 *   import { Tabs } from 'expo-router';
 *
 *   <Tabs
 *     screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: tokens.bg } }}
 *     tabBar={({ state, navigation }) => (
 *       <HouseBar
 *         slots={barSlots().map(s => ({ key: s.key, label: s.shortLabel ?? s.label, Icon: ICONS[s.key], hint: s.key === 'house' ? HOUSE_HINT : undefined }))}
 *         activeIndex={state.index}
 *         // no `position`: there is no pager under Option B, so the eyelet
 *         // is punched rather than travelled — the only visual difference.
 *         reduceMotion={reduceMotion}
 *         onPress={...}
 *         onLongPress={...}
 *       />
 *     )}
 *   >
 *     … the same Screen declarations, Tabs.Protected in place of TopTabs.Protected …
 *   </Tabs>
 *
 * The bar does not change. That is the whole price, and it was written before
 * the wave rather than after.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { Redirect } from 'expo-router';
import TopTabs from 'expo-router/js-top-tabs';
import { useEffect, useState, type ComponentType } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';

import { FEED_ENABLED } from '@almari/shared/flags';
import { NAV_SLOTS } from '@almari/shared/nav';

import { HouseBar, type HouseBarSlot } from '../../components/HouseBar';
import {
  IconChats,
  IconCloset,
  IconFeed,
  IconHouse,
  IconToday,
  type IconProps,
} from '../../icons';
import { useWardrobe } from '../../lib/wardrobe';
import { useTheme } from '../../tokens/ThemeContext';

/**
 * Each app binds its own icon by the roster's KEY — the words and the
 * addresses live in the shared array, the drawing does not.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  today: IconToday,
  closet: IconCloset,
  lookbook: IconFeed,
  chats: IconChats,
  house: IconHouse,
};

/** The roster's addresses, as this app's route files are named. */
const SCREEN_FOR: Record<string, string> = {
  '/': 'index',
  '/closet': 'closet',
  '/feed': 'feed',
  '/chats': 'chats',
  '/profile': 'profile',
};

/** Instagram's account-switch gesture, translated (docs/42 §1). */
const HOUSE_HINT = 'Hold to switch wardrobes.';

/**
 * The tab bar's own props, as MaterialTopTabView hands them over: react-
 * navigation's `state`/`navigation`/`descriptors` plus react-native-tab-view's
 * `position`, the pager offset in slot units. The vendored type is `any`, so
 * the shape this file actually relies on is stated here rather than trusted.
 */
interface HouseBarHostProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit(event: {
      type: string;
      target?: string;
      canPreventDefault?: boolean;
    }): { defaultPrevented: boolean };
    navigate(name: string, params?: object): void;
  };
  position?: Animated.AnimatedInterpolation<number>;
}

export default function TabsLayout() {
  const { tokens } = useTheme();
  const { status } = useWardrobe();

  /**
   * One reduced-motion read for the whole shell, passed down (docs/42 §3).
   * The drag still tracks the finger either way — a user's own hand is not
   * motion the system asked for — but a tap must not slide, and the eyelet
   * must be punched at the new slot rather than travelled to it.
   */
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(on => {
      if (live) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  // The shelf answers before the shell paints — a blank beat, not a flash
  // of somebody else's empty closet.
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  // First open, no wardrobe on this device: the door decides what starts.
  if (status === 'none') return <Redirect href="/open" />;

  return (
    <TopTabs
      // The sheets sit under the bar, not over a top rail.
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        // A neighbour kept warm; the rest of the house rendered on arrival.
        lazy: true,
        lazyPreloadDistance: 1,
        // A tap must not slide when the system asked for stillness. A swipe
        // still tracks: react-native-tab-view animates a gesture regardless.
        animationEnabled: !reduceMotion,
        sceneStyle: { backgroundColor: tokens.bg },
      }}
      tabBar={({ state, navigation, position }: HouseBarHostProps) => {
        const slots: HouseBarSlot[] = state.routes.map(route => {
          const entry = NAV_SLOTS.find(s => SCREEN_FOR[s.path] === route.name);
          return {
            key: entry?.key ?? route.name,
            // The rail's own short word where the roster supplies one:
            // Conversations becomes CHATS, Look Book becomes LOOKS.
            label: entry ? (entry.shortLabel ?? entry.label) : route.name,
            Icon: ICONS[entry?.key ?? ''] ?? IconToday,
            hint: entry?.key === 'house' ? HOUSE_HINT : undefined,
          };
        });

        const press = (index: number) => {
          const route = state.routes[index];
          if (!route) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (state.index !== index && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const longPress = (index: number) => {
          const route = state.routes[index];
          if (!route) return;
          navigation.emit({ type: 'tabLongPress', target: route.key });
          // Exactly one slot carries a gesture, and it is the House's: hold
          // it and the wardrobe switcher rises on the House's own floor.
          if (route.name !== SCREEN_FOR['/profile']) return;
          navigation.navigate(route.name, { switcher: 'open' });
        };

        return (
          <HouseBar
            slots={slots}
            activeIndex={state.index}
            position={position}
            reduceMotion={reduceMotion}
            onPress={press}
            onLongPress={longPress}
          />
        );
      }}
    >
      {/* THE ROSTER, DECLARED. The order of these children is the order of
          the pager's pages, of the bar's slots and of the eyelet's stops —
          one array, so they cannot fall out of agreement. */}
      {NAV_SLOTS.map(slot => {
        const screen = (
          <TopTabs.Screen
            key={slot.key}
            name={SCREEN_FOR[slot.path]}
            options={{ title: slot.shortLabel ?? slot.label }}
          />
        );
        // The centre slot belongs to the flag. Under TopTabs `Protected`
        // matters doubly: it takes the slot off the bar AND the page out of
        // the pager, so a hidden room cannot be swiped into.
        return slot.flagged ? (
          <TopTabs.Protected key={slot.key} guard={FEED_ENABLED}>
            {screen}
          </TopTabs.Protected>
        ) : (
          screen
        );
      })}
    </TopTabs>
  );
}
