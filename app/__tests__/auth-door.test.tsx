/**
 * The door, grown — the account asked first, honestly optional.
 *
 * The laws under test (src/pages/Door.tsx read as spec; docs/35):
 *   - "Continue without an account" is FIRST-CLASS: present on the fresh
 *     door, works in one press, and the wardrobe starts stay reachable —
 *     a signed-out wardrobe loses nothing;
 *   - sign in / create an account stands second, email and password, with
 *     the mode toggle the web door carries;
 *   - a signed-in door says who is signed in and offers the way out.
 *
 * The account service is mocked whole — the door's job is the flow, not
 * the wire.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

interface MockAuthUser { id: string; email: string }

const mockAuth = {
  user: null as MockAuthUser | null,
  listeners: [] as ((event: string, user: MockAuthUser | null) => void)[],
  signIn: jest.fn(async (_email: string, _password: string) => ({ ok: true as const })),
  signUp: jest.fn(async (_email: string, _password: string) => ({ ok: true as const })),
  signOutCalls: 0,
};

jest.mock('../src/lib/supabase', () => ({
  currentAuthUser: async () => mockAuth.user,
  onAuthChange: (cb: (event: string, user: MockAuthUser | null) => void) => {
    mockAuth.listeners.push(cb);
    return () => {
      mockAuth.listeners = mockAuth.listeners.filter(l => l !== cb);
    };
  },
  signInWithEmail: (email: string, password: string) => mockAuth.signIn(email, password),
  signUpWithEmail: (email: string, password: string) => mockAuth.signUp(email, password),
  signOutAuth: async () => {
    mockAuth.signOutCalls += 1;
    mockAuth.user = null;
    for (const l of [...mockAuth.listeners]) l('SIGNED_OUT', null);
  },
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

beforeEach(async () => {
  await AsyncStorage.clear();
  mockAuth.user = null;
  mockAuth.listeners = [];
  mockAuth.signIn.mockClear();
  mockAuth.signUp.mockClear();
  mockAuth.signOutCalls = 0;
});

describe('the fresh door — the account first, the skip first-class', () => {
  test('offers the skip, the sign-in, and both wardrobe starts on one screen', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    expect(await shell.findByText('An account, if you want one')).toBeTruthy();
    expect(await shell.findByText('Continue without an account')).toBeTruthy();
    expect(shell.getByText('Sign in or create an account')).toBeTruthy();
    // The wardrobe starts stay on the same screen — the account is a
    // question, never a gate.
    expect(shell.getByText('Start empty')).toBeTruthy();
    expect(shell.getByText('Walk through a sample')).toBeTruthy();
  });

  test('the skip is one press, says where everything stays, and walks back up', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Continue without an account'));
    expect(await shell.findByText('No account — everything stays on this device.')).toBeTruthy();
    // A flow you cannot walk back up is a gate by another name.
    fireEvent.press(shell.getByText('Back to the account'));
    expect(await shell.findByText('Continue without an account')).toBeTruthy();
  });

  test('a skipped account changes nothing about starting a wardrobe', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Continue without an account'));
    fireEvent.press(shell.getByText('Start empty'));
    await waitFor(() => expect(shell.getPathname()).toBe('/'));
    expect(await shell.findByText('Nothing in the closet yet.')).toBeTruthy();
  });
});

describe('signing in from the door', () => {
  test('the form takes email and password and hands them to the account service', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Sign in or create an account'));
    fireEvent.changeText(await shell.findByLabelText('Email'), '  tester@example.com  ');
    fireEvent.changeText(shell.getByLabelText('Password'), 'hunter22');
    fireEvent.press(shell.getByText('Sign in'));

    await waitFor(() => expect(mockAuth.signIn).toHaveBeenCalledTimes(1));
    // Trimmed, exactly as the web door submits it.
    expect(mockAuth.signIn).toHaveBeenCalledWith('tester@example.com', 'hunter22');

    // The session announces itself and the door becomes the signed-in view.
    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    for (const l of [...mockAuth.listeners]) l('SIGNED_IN', mockAuth.user);
    expect(await shell.findByText('Signed in as tester@example.com')).toBeTruthy();
    expect(shell.getByText('Sign out')).toBeTruthy();
  });

  test('the mode toggle turns the form into making an account', async () => {
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Sign in or create an account'));
    fireEvent.press(await shell.findByText('New here? Make an account'));
    expect(await shell.findByText('At least 6 characters.')).toBeTruthy();
    fireEvent.changeText(shell.getByLabelText('Email'), 'new@example.com');
    fireEvent.changeText(shell.getByLabelText('Password'), 'sixchars');
    fireEvent.press(shell.getByText('Make the account'));
    await waitFor(() => expect(mockAuth.signUp).toHaveBeenCalledWith('new@example.com', 'sixchars'));
  });

  test('a failed sign-in says why, in the house voice', async () => {
    mockAuth.signIn.mockResolvedValueOnce({
      ok: false,
      error: 'That email and password do not match anything on record.',
    } as never);
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    fireEvent.press(await shell.findByText('Sign in or create an account'));
    fireEvent.changeText(await shell.findByLabelText('Email'), 'tester@example.com');
    fireEvent.changeText(shell.getByLabelText('Password'), 'wrong');
    fireEvent.press(shell.getByText('Sign in'));

    expect(
      await shell.findByText('That email and password do not match anything on record.'),
    ).toBeTruthy();
  });
});

describe('the door already signed in', () => {
  test('names the account and offers the way out; a wardrobe can still start', async () => {
    mockAuth.user = { id: 'user-1', email: 'tester@example.com' };
    const shell = renderRouter('./src/app', { initialUrl: '/open' });

    expect(await shell.findByText('Signed in as tester@example.com')).toBeTruthy();
    expect(shell.getByText('Sign out')).toBeTruthy();
    expect(shell.getByText('Start empty')).toBeTruthy();
  });
});
