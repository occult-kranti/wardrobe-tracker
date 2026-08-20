/**
 * The room, and the device that remembers which one.
 *
 * The theme is a property of the screen, not of a wardrobe — the same rule
 * the web landed on in src/lib/accounts.ts (opening a different closet must
 * not flip the whole interface from dark to light mid-session). So the room
 * is written device-level, under the web's own shelf label:
 *
 *   KEY    'toile-theme' (storage.THEME_KEY — byte-identical to the web's)
 *   VALUE  {"theme":"gilt"} — the exact JSON the web's saveTheme writes,
 *          because accounts.ts stores it as `write(THEME_KEY, { theme })`.
 *
 * One convention, not two: a person whose brain is synced between the web app
 * and this one meets the same key holding the same shape. An unreadable value,
 * a value naming a room that does not exist, or no value at all all read as
 * DEFAULT_THEME — the web's loadTheme makes exactly those three answers.
 *
 * WHY THE BOOT READ STARTS AT IMPORT, NOT AT MOUNT.
 *
 * Storage is asynchronous and the first paint is not. If the provider began
 * reading when it mounted, the tree would paint the dye house for a frame or
 * two and then swap — a flash of the wrong room, on every cold open, for
 * everyone who chose a different one.
 *
 * So the read starts when this module is evaluated, which is while the bundle
 * loads, and it rides the gate the root layout already holds: nothing paints
 * until `useFonts` resolves (src/app/_layout.tsx keeps the splash up and
 * returns null until then), and a font load is orders of magnitude longer
 * than one AsyncStorage key. By the time ThemeProvider first renders, the
 * answer is in hand and `useState` takes it synchronously. The first painted
 * frame is the room this device chose.
 *
 * A SECOND GATE HERE WOULD BE WORSE, and that is a deliberate call. Holding
 * `children` back until the read settles would blank the window in the one
 * case it is meant to help — the splash is hidden by the layout's own effect
 * the moment fonts land, so a provider still waiting would show the reader
 * nothing rather than something. The swap-if-late path below covers that
 * pathological case instead: correct, and never a blank screen.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { storage, THEME_KEY } from '../lib/storage';

import {
  DEFAULT_THEME,
  THEMES,
  THEME_ORDER,
  resolveTheme,
  type ResolvedThemeName,
  type ThemeName,
  type ThemeTokens,
} from './themes';

/** What became of a choice: written down, or applied but not remembered. */
export type ThemeWrite = 'kept' | 'unwritten';

/**
 * Read the shelf's answer. Ports the three refusals of the web's loadTheme:
 * no value, unparseable value, and a value naming a room this build does not
 * have all become the default rather than an undefined paint.
 */
function parseStoredTheme(raw: string | null): ThemeName {
  if (raw === null || raw === '') return DEFAULT_THEME;
  try {
    const stored = (JSON.parse(raw) as { theme?: unknown }).theme;
    return (THEME_ORDER as readonly string[]).includes(stored as string)
      ? (stored as ThemeName)
      : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** What the boot read has to say so far. `settled` is "the shelf has answered". */
let booted: { settled: boolean; theme: ThemeName } = { settled: false, theme: DEFAULT_THEME };
let bootRead: Promise<ThemeName> | null = null;

/**
 * The boot read, started once and shared. A refused read is not an error worth
 * a sentence — a device that cannot say which room it was in opens in the
 * default one, which is what a device with no answer yet does anyway.
 */
export function readStoredTheme(): Promise<ThemeName> {
  if (booted.settled) return Promise.resolve(booted.theme);
  if (bootRead === null) {
    bootRead = storage
      .getItem(THEME_KEY)
      .then(parseStoredTheme, () => DEFAULT_THEME)
      .then(theme => {
        booted = { settled: true, theme };
        bootRead = null;
        return theme;
      });
  }
  return bootRead;
}

/** The boot read's answer without awaiting it — what a first paint may use. */
export function bootedTheme(): { settled: boolean; theme: ThemeName } {
  return booted;
}

/**
 * Un-boot this module: the next provider mounts as a device that has just been
 * switched on. Nothing in the app calls this — a phone boots once. The suites
 * call it, because a module-level answer is a device that has already booted
 * and a boot-restore test needs one that has not.
 */
export function forgetStoredTheme(): void {
  booted = { settled: false, theme: DEFAULT_THEME };
  bootRead = null;
}

/** Write the choice down in the web's own value shape. */
async function persistTheme(theme: ThemeName): Promise<ThemeWrite> {
  try {
    await storage.setItem(THEME_KEY, JSON.stringify({ theme }));
    return 'kept';
  } catch {
    // The adapter does not swallow a failed write (src/lib/storage.ts), so the
    // caller is told and can say it out loud. The room still changes on screen:
    // refusing the change as well would punish twice for one full disk.
    return 'unwritten';
  }
}

interface ThemeContextValue {
  /** The chosen name, which may be 'system'. */
  theme: ThemeName;
  /** The room actually on screen. */
  resolved: ResolvedThemeName;
  /** The room's tokens — what components paint with. */
  tokens: ThemeTokens;
  /**
   * Apply a room now and write it down. Resolves 'unwritten' when the device
   * refused the write, so the screen that offered the choice can say so.
   */
  setTheme: (theme: ThemeName) => Promise<ThemeWrite>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => bootedTheme().theme);
  /**
   * True once the room on screen is this device's own — read off the shelf, or
   * pressed by hand. After that the boot read has nothing left to say, and in
   * particular it must never overwrite a choice made while it was in flight.
   */
  const owned = useRef(bootedTheme().settled);
  const systemScheme = useColorScheme();

  useEffect(() => {
    if (owned.current) return;
    let alive = true;
    void readStoredTheme().then(stored => {
      if (!alive || owned.current) return;
      owned.current = true;
      setThemeState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    owned.current = true;
    // Keep the module's answer current too: a provider remounted before the
    // write lands (a fast-refresh, a re-render of the root) opens in the room
    // that was just pressed, not the one the shelf still holds.
    booted = { settled: true, theme: next };
    setThemeState(next);
    return persistTheme(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    // RN may also answer 'unspecified'; anything that is not 'dark' opens light,
    // the same reading the web's prefers-color-scheme block makes.
    const scheme = systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : null;
    const resolved = resolveTheme(theme, scheme);
    return { theme, resolved, tokens: THEMES[resolved], setTheme };
  }, [theme, systemScheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must sit under a ThemeProvider');
  return value;
}

// The read starts here, at bundle evaluation — see the note at the top of the
// file. Nothing awaits it; the fonts gate does the waiting.
void readStoredTheme();
