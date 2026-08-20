/**
 * The root layout — expo-router's _layout at src/app (the SDK 57 convention;
 * src/app takes precedence over a root app directory, per
 * https://docs.expo.dev/router/reference/src-directory/).
 *
 * Order of dress: fonts first (splash stays up until they load or refuse —
 * the SDK 57 expo-font/expo-splash-screen pattern), then the theme, then the
 * stack. If the loader errors, the app opens in the fallback faces rather
 * than not opening — the first-boot edge case docs/34 Phase 0 names.
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastContainer } from '../components/Toast';
import { SessionProvider } from '../lib/session';
import { WardrobeProvider } from '../lib/wardrobe';
import { FontsProvider } from '../tokens/FontsContext';
import { ThemeProvider, useTheme } from '../tokens/ThemeContext';
import { FONT_SOURCES } from '../tokens/typography';

// Global scope, not awaited — called inside a component it can land after
// the splash has already gone (SDK 57 splash-screen docs).
SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { tokens } = useTheme();
  return (
    <>
      {/* The room tells the OS chrome which way its ink runs. */}
      <StatusBar style={tokens.colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="open" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts(FONT_SOURCES);

  useEffect(() => {
    if (fontsLoaded || fontsError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontsError]);

  // Splash still covers the window; painting now would flash unstyled type.
  if (!fontsLoaded && !fontsError) return null;

  return (
    <ThemeProvider>
      <FontsProvider loaded={fontsLoaded}>
        {/* The session sits ABOVE the wardrobe, exactly as on the web: the
            account and the wardrobes are separate ideas, and the provider
            that owns the state consumes the session for its sync choices. */}
        <SessionProvider>
          <WardrobeProvider>
            <RootStack />
            {/* The house toast floats over every room; its copy is the app's voice. */}
            <ToastContainer />
          </WardrobeProvider>
        </SessionProvider>
      </FontsProvider>
    </ThemeProvider>
  );
}
