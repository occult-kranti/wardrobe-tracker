/**
 * The theme is a property of the screen, not of a wardrobe — the same rule
 * the web landed on in src/lib/accounts.ts (opening a different closet must
 * not flip the whole interface from dark to light mid-session).
 *
 * For now the provider holds the theme in memory, opening in the dye house
 * (DEFAULT_THEME — THEME_ORDER[0], web parity) and honoring the device when
 * the theme is 'system' via RN's useColorScheme. Persisting the choice under
 * THEME_KEY through the storage adapter is Settings work, not shell work —
 * the seam is `setTheme`, already exposed.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_THEME,
  THEMES,
  resolveTheme,
  type ResolvedThemeName,
  type ThemeName,
  type ThemeTokens,
} from './themes';

interface ThemeContextValue {
  /** The chosen name, which may be 'system'. */
  theme: ThemeName;
  /** The room actually on screen. */
  resolved: ResolvedThemeName;
  /** The room's tokens — what components paint with. */
  tokens: ThemeTokens;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    // RN may also answer 'unspecified'; anything that is not 'dark' opens light,
    // the same reading the web's prefers-color-scheme block makes.
    const scheme = systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : null;
    const resolved = resolveTheme(theme, scheme);
    return { theme, resolved, tokens: THEMES[resolved], setTheme };
  }, [theme, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must sit under a ThemeProvider');
  return value;
}
