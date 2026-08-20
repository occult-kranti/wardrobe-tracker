/**
 * The room — chosen in Settings, remembered by the device, honoured at boot.
 *
 * What this suite holds the app to:
 *
 *   1. THE ROOM IS ON THE PHONE. Settings offers all six rooms plus the
 *      phone's own answer, drawn in their own paint, one selected at a time.
 *   2. ONE CONVENTION, NOT TWO. The choice is written under the web's key
 *      ('toile-theme') in the web's value shape ({"theme":"gilt"}), so a
 *      person synced between the two apps meets one storage vocabulary.
 *   3. NO FLASH OF THE WRONG ROOM. The boot read starts when the module is
 *      evaluated — while the root layout still holds the splash for fonts —
 *      so the provider's FIRST render is already the stored room. The render
 *      log is the assertion: ['salon'], never ['dyehouse', 'salon'].
 *   4. THE DEVICE'S ANSWERS ARE HONOURED, INCLUDING ITS REFUSALS. 'system'
 *      follows the phone; an unreadable, absent or unknown value opens the
 *      dye house; a write the device refuses is said out loud rather than
 *      silently forgotten.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

interface MockAuthUser { id: string; email: string }

const mockAuth = {
  user: null as MockAuthUser | null,
  listeners: [] as ((event: string, user: MockAuthUser | null) => void)[],
};

/** What the phone says its scheme is, when anything asks. */
const mockDeviceScheme = { value: null as 'light' | 'dark' | null };

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockDeviceScheme.value,
}));

jest.mock('../src/lib/supabase', () => ({
  currentAuthUser: async () => mockAuth.user,
  onAuthChange: (cb: (event: string, user: MockAuthUser | null) => void) => {
    mockAuth.listeners.push(cb);
    return () => {
      mockAuth.listeners = mockAuth.listeners.filter(l => l !== cb);
    };
  },
  signInWithEmail: jest.fn(async () => ({ ok: true })),
  signUpWithEmail: jest.fn(async () => ({ ok: true })),
  signOutAuth: jest.fn(async () => undefined),
  getSupabase: () => ({
    from: () => ({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(onF, onR),
      }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  }),
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => undefined,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => true,
  hideAsync: async () => undefined,
}));

import { ACCOUNTS_KEY, SESSION_KEY, storage, THEME_KEY, wardrobeKey } from '../src/lib/storage';
import { THEMES, type ResolvedThemeName } from '../src/tokens/themes';
import {
  ThemeProvider,
  bootedTheme,
  forgetStoredTheme,
  readStoredTheme,
  useTheme,
} from '../src/tokens/ThemeContext';

async function seedWardrobe() {
  const row = {
    id: 'acct-1',
    name: 'The weekday closet',
    handle: '@weekday',
    monogram: 'W',
    color: 'var(--color-accent)',
    createdAt: '2026-08-01',
  };
  await storage.setItem(SESSION_KEY, JSON.stringify({ activeId: row.id }));
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify([row]));
  await storage.setItem(wardrobeKey(row.id), JSON.stringify({ items: [] }));
}

/** Put the module back to a device that has just been switched on. */
async function bootWith(stored: string | null) {
  if (stored === null) await storage.removeItem(THEME_KEY);
  else await storage.setItem(THEME_KEY, stored);
  forgetStoredTheme();
}

/**
 * Records the room of EVERY render, in order. A provider that opened in the
 * default and swapped afterwards writes two entries; one that opened in the
 * stored room writes one. That difference is the whole no-flash claim.
 */
function Probe({ log }: { log: ResolvedThemeName[] }) {
  const { resolved } = useTheme();
  log.push(resolved);
  return <Text>{resolved}</Text>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockAuth.user = null;
  mockAuth.listeners = [];
  mockDeviceScheme.value = null;
  jest.restoreAllMocks();
});

/* ------------------------------------------------------------------ *
 * This describe runs FIRST and re-arms nothing: it is reading the state
 * the module was in when the suite imported it.
 * ------------------------------------------------------------------ */

describe('the boot read starts with the bundle, not with a mount', () => {
  test('the module has already asked the shelf before any provider mounts', async () => {
    // Nothing above has called readStoredTheme() or mounted a ThemeProvider.
    // If the module did not start its own read at evaluation, this is false —
    // and every cold open would paint the default room for a frame first.
    expect(bootedTheme().settled).toBe(true);
    // The shelf was empty when the bundle loaded, so the answer is the default.
    expect(bootedTheme().theme).toBe('dyehouse');
  });
});

/* ---------------------------- the device remembers ---------------------------- */

describe('the room is read at boot, before the first paint', () => {
  test('a stored room is the provider’s FIRST render — no flash of the default', async () => {
    await bootWith(JSON.stringify({ theme: 'salon' }));
    // The fonts gate holds the splash while this settles; here it is awaited
    // for the same reason and with the same effect.
    await readStoredTheme();

    const log: ResolvedThemeName[] = [];
    render(
      <ThemeProvider>
        <Probe log={log} />
      </ThemeProvider>,
    );

    expect(log).toEqual(['salon']);
    expect(log).not.toContain('dyehouse');
  });

  test('a room stored under the web’s key paints the web’s tokens', async () => {
    await bootWith(JSON.stringify({ theme: 'gilt' }));
    await readStoredTheme();

    const seen: { tokens: string; theme: string }[] = [];
    function Paint() {
      const { tokens, theme } = useTheme();
      seen.push({ tokens: tokens.bg, theme });
      return <Text>{tokens.bg}</Text>;
    }
    render(
      <ThemeProvider>
        <Paint />
      </ThemeProvider>,
    );
    expect(seen[0]).toEqual({ tokens: THEMES.gilt.bg, theme: 'gilt' });
  });

  test('a read still in flight opens the default and lands on the stored room', async () => {
    // The pathological case the file's header names: the read outliving the
    // fonts gate. It must still arrive at the right room, and never blank.
    await bootWith(JSON.stringify({ theme: 'obsidian' }));

    const log: ResolvedThemeName[] = [];
    const screen = render(
      <ThemeProvider>
        <Probe log={log} />
      </ThemeProvider>,
    );

    expect(log[0]).toBe('dyehouse');
    expect(screen.getByText('dyehouse')).toBeTruthy();
    await waitFor(() => expect(log[log.length - 1]).toBe('obsidian'));
  });
});

describe('what the shelf can say, and what each answer means', () => {
  test('no value at all is the dye house', async () => {
    await bootWith(null);
    expect(await readStoredTheme()).toBe('dyehouse');
  });

  test('a value that is not JSON is the dye house, not a crash', async () => {
    await bootWith('half a written sentence');
    expect(await readStoredTheme()).toBe('dyehouse');
  });

  test('a room this build does not have is the dye house', async () => {
    await bootWith(JSON.stringify({ theme: 'scullery' }));
    expect(await readStoredTheme()).toBe('dyehouse');
  });

  test('a shelf that refuses to be read is the dye house', async () => {
    forgetStoredTheme();
    jest.spyOn(storage, 'getItem').mockRejectedValueOnce(new Error('unreadable') as never);
    expect(await readStoredTheme()).toBe('dyehouse');
  });

  test('every one of the six rooms survives the round trip', async () => {
    for (const room of ['dyehouse', 'obsidian', 'dark', 'salon', 'gilt', 'light'] as const) {
      await bootWith(JSON.stringify({ theme: room }));
      expect(await readStoredTheme()).toBe(room);
    }
  });
});

describe('“As the phone is” follows the phone', () => {
  test('system stored, device dark: the atelier at night', async () => {
    mockDeviceScheme.value = 'dark';
    await bootWith(JSON.stringify({ theme: 'system' }));
    await readStoredTheme();

    const log: ResolvedThemeName[] = [];
    render(
      <ThemeProvider>
        <Probe log={log} />
      </ThemeProvider>,
    );
    expect(log[0]).toBe('dark');
  });

  test('system stored, device light: the pattern room', async () => {
    mockDeviceScheme.value = 'light';
    await bootWith(JSON.stringify({ theme: 'system' }));
    await readStoredTheme();

    const log: ResolvedThemeName[] = [];
    render(
      <ThemeProvider>
        <Probe log={log} />
      </ThemeProvider>,
    );
    expect(log[0]).toBe('light');
  });

  test('system stored, device silent: the pattern room, and the CHOICE is still system', async () => {
    mockDeviceScheme.value = null;
    await bootWith(JSON.stringify({ theme: 'system' }));
    await readStoredTheme();

    const seen: { theme: string; resolved: string }[] = [];
    function Both() {
      const { theme, resolved } = useTheme();
      seen.push({ theme, resolved });
      return <Text>{resolved}</Text>;
    }
    render(
      <ThemeProvider>
        <Both />
      </ThemeProvider>,
    );
    // The room on screen is the pattern room; what the device chose is still
    // 'system', so a phone that turns dark later turns this screen with it.
    expect(seen[0]).toEqual({ theme: 'system', resolved: 'light' });
  });
});

/* ---------------------------- the room arrives in Settings ---------------------------- */

describe('Settings offers the room', () => {
  test('seven rows: the six rooms in the house’s own names, and the phone’s', async () => {
    await bootWith(null);
    await readStoredTheme();
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    expect(await shell.findByText('The room')).toBeTruthy();
    expect(shell.getByText('This screen, not this wardrobe')).toBeTruthy();

    for (const label of [
      'The dye house',
      'The obsidian',
      'The atelier at night',
      'The salon',
      'The gilding room',
      'The pattern room',
    ]) {
      expect(shell.getByLabelText(label)).toBeTruthy();
    }
    // The phone has its own word for the device: shared's "Follow the device"
    // is a browser's sentence, and this is not a browser.
    expect(shell.getByLabelText('As the phone is')).toBeTruthy();
    expect(shell.queryByText('Follow the device')).toBeNull();

    // The promise the placeholder made is now half kept, and says only what
    // is still owed.
    expect(shell.getByText('Storage will live here.')).toBeTruthy();
    expect(shell.queryByText('Theme and storage will live here.')).toBeNull();
  });

  test('each row is drawn in its own room’s paint, and the phone’s row in both', async () => {
    await bootWith(null);
    await readStoredTheme();
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    await shell.findByText('The room');
    // One swatch cell per room, painted from that room's own surface token.
    for (const room of ['dyehouse', 'obsidian', 'dark', 'salon', 'gilt', 'light'] as const) {
      expect(shell.getAllByTestId(`room-swatch-${room}`).length).toBeGreaterThan(0);
    }
    // 'system' has no paint of its own, so it draws as the two rooms the
    // device can hand back — the light cell and the dark cell, both present.
    expect(shell.getAllByTestId('room-swatch-light')).toHaveLength(2);
    expect(shell.getAllByTestId('room-swatch-dark')).toHaveLength(2);
    expect(shell.getAllByTestId('room-swatch-gilt')).toHaveLength(1);
  });

  test('exactly one room is marked as the one you are in', async () => {
    await bootWith(JSON.stringify({ theme: 'salon' }));
    await readStoredTheme();
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    await shell.findByText('The room');
    const selected = ['dyehouse', 'obsidian', 'dark', 'salon', 'gilt', 'light', 'system'].filter(
      name => shell.getByTestId(`room-row-${name}`).props.accessibilityState?.selected === true,
    );
    expect(selected).toEqual(['salon']);
  });

  test('pressing a room applies it and writes the web’s key in the web’s shape', async () => {
    await bootWith(null);
    await readStoredTheme();
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    await shell.findByText('The room');
    fireEvent.press(shell.getByLabelText('The gilding room'));

    // The shelf holds exactly what the web's saveTheme would have written.
    await waitFor(async () => {
      expect(await storage.getItem(THEME_KEY)).toBe('{"theme":"gilt"}');
    });
    // And the screen moved with it — the pressed room is the marked one.
    await waitFor(() => {
      expect(shell.getByTestId('room-row-gilt').props.accessibilityState?.selected).toBe(true);
    });
    expect(shell.getByTestId('room-row-dyehouse').props.accessibilityState?.selected).toBe(false);
  });

  test('the phone’s own row is written down as “system”, not as the room it resolved to', async () => {
    mockDeviceScheme.value = 'dark';
    await bootWith(null);
    await readStoredTheme();
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    await shell.findByText('The room');
    fireEvent.press(shell.getByLabelText('As the phone is'));

    await waitFor(async () => {
      expect(await storage.getItem(THEME_KEY)).toBe('{"theme":"system"}');
    });
    // A phone that goes light tomorrow must take the app with it, which it
    // cannot do if the resolved room was frozen into the shelf.
    expect(shell.getByTestId('room-row-system').props.accessibilityState?.selected).toBe(true);
  });

  test('a device that will not write the choice down says so, and still changes the room', async () => {
    await bootWith(null);
    await readStoredTheme();
    await seedWardrobe();

    const write = storage.setItem.bind(storage);
    jest.spyOn(storage, 'setItem').mockImplementation(async (key: string, value: string) => {
      if (key === THEME_KEY) throw new Error('storage full');
      return write(key, value);
    });

    const shell = renderRouter('./src/app', { initialUrl: '/settings' });
    await shell.findByText('The room');
    fireEvent.press(shell.getByLabelText('The obsidian'));

    // Said out loud — the reader would otherwise find out at the next cold open.
    expect(await shell.findByText(/would not write the choice down/)).toBeTruthy();
    // The room still changed: refusing the change as well punishes twice.
    expect(shell.getByTestId('room-row-obsidian').props.accessibilityState?.selected).toBe(true);
    expect(await storage.getItem(THEME_KEY)).toBeNull();
  });

  test('the choice is the screen’s: it is not written into the wardrobe’s document', async () => {
    await bootWith(null);
    await readStoredTheme();
    await seedWardrobe();
    const shell = renderRouter('./src/app', { initialUrl: '/settings' });

    await shell.findByText('The room');
    fireEvent.press(shell.getByLabelText('The pattern room'));
    await waitFor(async () => {
      expect(await storage.getItem(THEME_KEY)).toBe('{"theme":"light"}');
    });

    // Three closets on one device share one room. The wardrobe's own record
    // says nothing about it — the web's rule, kept.
    const document = JSON.parse((await storage.getItem(wardrobeKey('acct-1'))) as string) as {
      settings?: { theme?: string };
    };
    expect(document.settings?.theme).toBeUndefined();
  });
});
