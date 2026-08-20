/**
 * The tab shell — Today, Closet, Look Book, Chats, Settings.
 *
 * Routes mirror src/lib/routes.ts so a deep link is the same sentence on
 * both apps: `/` is today, `/closet` the closet, `/feed` the feed the web
 * ships (the tab wears the Look Book label), `/chats` conversations (the
 * tab wears the web rail's own shortLabel), `/settings` settings. The rest
 * of §2.2's screens arrive as their ports land; the door stub lives outside
 * the tabs at /open, and a thread's own page at /chats/[id].
 *
 * The bar is the web rail restated: surface ground, hairline top rule,
 * washing-blue active ink, text-2 resting ink, and the rail's own measured
 * 11px label (src/index.css .type-label-rail — the one documented exception
 * to the 13px floor, ported with its reason).
 */
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconChats, IconCloset, IconFeed, IconSettings, IconToday } from '../../icons';
import { useWardrobe } from '../../lib/wardrobe';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function TabsLayout() {
  const { tokens } = useTheme();
  const { status } = useWardrobe();

  // The shelf answers before the shell paints — a blank beat, not a flash
  // of somebody else's empty closet.
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  // First open, no wardrobe on this device: the door decides what starts.
  if (status === 'none') return <Redirect href="/open" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: tokens.bg },
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.text2,
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tokens.border,
        },
        tabBarLabelStyle: {
          fontSize: TYPE.rail,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconToday size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: ({ color }) => <IconCloset size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Look Book',
          tabBarIcon: ({ color }) => <IconFeed size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          // The web rail's own shortLabel for a narrow slot (Layout.tsx:
          // label 'Conversations', shortLabel 'Chats'); the masthead inside
          // says the full word. docs/34 §2.2 files /chats under the More
          // sheet the web has and this shell does not yet — until More
          // lands, the tab is the door, and the address stays the web's.
          title: 'Chats',
          tabBarIcon: ({ color }) => <IconChats size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSettings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
