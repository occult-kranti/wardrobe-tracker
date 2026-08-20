/**
 * The account session — who is signed into the Supabase account, if anyone.
 *
 * Mirrors the auth slice of src/context/SessionContext.tsx: restored once at
 * boot, then followed; a pull runs once per signed-in user per load; the
 * offline queue flushes on sign-in and on the app returning to the
 * foreground (RN's stand-in for the browser's `online` event). Independent
 * of which wardrobe is open — the account and the wardrobes are separate
 * ideas, and the app works fully without one.
 *
 * What a sign-in sets in motion, in order: anything the offline queue was
 * holding goes up, every row on the account comes down. Known wardrobes
 * reconcile newer-wins (pullAll writes their stores); rows this device has
 * never seen are introduced as new registry rows — that is the entire point
 * of the account, a closet on more than one device. The open wardrobe's
 * provider hears announceAdopted and re-reads.
 *
 * This file also holds the account UI both doors share (AccountPanel, the
 * Choice toggle) — on the web they live in Door.tsx, but here the door and
 * Settings are two route files and the shared pieces need a home that is
 * not a route. The registry helpers (handleFor, monogramFor) live here too,
 * imported by the wardrobe provider — one source, no cycle: this file never
 * imports the wardrobe.
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
import { AppState as RNAppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { todayLocal } from '@almari/shared/dates';
import type { Account } from '@almari/shared/types';

import { Button } from '../components/Button';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';
import { ACCOUNTS_KEY, storage, wardrobeKey } from './storage';
import {
  accountFromRow,
  announceAdopted,
  flushQueue,
  pullAll,
  stampSynced,
} from './sync';
import {
  currentAuthUser,
  onAuthChange,
  signInWithEmail,
  signOutAuth,
  signUpWithEmail,
  type AuthResult,
  type AuthUser,
} from './supabase';

/* ==================== registry vocabulary (ports of web helpers) ==================== */

/** ports src/lib/accounts.ts handleFor — byte-identical slug rule. */
export function handleFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  return `@${slug || 'wardrobe'}`;
}

/** ports src/context/SessionContext.tsx monogramFor. */
export function monogramFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** The tag-avatar tints, kept to the token names the web registry stores. */
export const ACCOUNT_COLORS = [
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-gold)',
  'var(--color-warning)',
];

/**
 * A remote row's local id needs a real uuid shape only on the WIRE (the
 * `wardrobes.id` column is uuid). Hermes ships no crypto.randomUUID and
 * expo-crypto is not among our deps (a new dependency is an owner decision),
 * so this is the RFC 4122 v4 layout over Math.random — the same trade
 * newId() in wardrobe.tsx already makes, with the same honesty: not
 * cryptographic, and it does not need to be; it needs to not collide across
 * the handful of wardrobes one account will ever hold.
 */
export function mintSyncId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * THE PLAIN SENTENCE — docs/35, owner decision 2 and Robin's issue 2: the
 * copy must say who can read a synced record, wherever sync is offered,
 * until end-to-end encryption lands.
 */
export const TRUST_SENTENCE =
  'Said plainly: until end-to-end encryption ships, a synced copy is kept ' +
  'unencrypted on the maker’s Supabase project, and the operator of that ' +
  'project could read it. End-to-end encryption is the committed next step. ' +
  'Sync stays off unless you switch it on, one wardrobe at a time.';

/* ==================== the provider ==================== */

interface SessionValue {
  /** Who is signed into the Supabase account, if anyone. */
  authUser: AuthUser | null;
  /** False until the stored session has been checked once, so no screen has
      to render a signed-out panel and then flinch into a signed-in one. */
  authReady: boolean;
  signInEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpEmail: (email: string, password: string) => Promise<AuthResult>;
  /** Ends the account session. Deletes nothing, here or there. */
  signOutAccount: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** The registry, read raw — the same rows wardrobe.tsx writes. */
interface RegistryRow {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  color: string;
  createdAt: string;
  isSample?: boolean;
  sync?: Account['sync'];
  syncId?: string;
  [key: string]: unknown;
}

async function readRegistry(): Promise<RegistryRow[]> {
  try {
    const parsed = JSON.parse((await storage.getItem(ACCOUNTS_KEY)) ?? '[]') as unknown;
    return Array.isArray(parsed) ? (parsed as RegistryRow[]) : [];
  } catch {
    return [];
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  /**
   * What a sign-in sets in motion — the web's afterSignIn, over the adapter.
   * The registry is read from storage at call time rather than through refs:
   * on this app the registry's owner of record is the shelf itself.
   */
  const afterSignIn = useCallback(async (user: AuthUser) => {
    try {
      await flushQueue(user.id);
      const registry = await readRegistry();
      const { adoptedIds, fresh } = await pullAll(registry as unknown as Account[]);
      if (fresh.length > 0) {
        const existing = new Set(registry.map(a => a.id));
        const base = registry.length;
        const added: RegistryRow[] = [];
        for (let i = 0; i < fresh.length; i++) {
          const row = fresh[i];
          let id = `w-${mintSyncId().slice(0, 8)}`;
          while (existing.has(id)) id = `w-${mintSyncId().slice(0, 8)}`;
          existing.add(id);
          await storage.setItem(wardrobeKey(id), JSON.stringify(row.state));
          await stampSynced(id, row.updated_at);
          added.push(accountFromRow(row, {
            id,
            handle: handleFor(row.name),
            monogram: monogramFor(row.name),
            color: ACCOUNT_COLORS[(base + i) % ACCOUNT_COLORS.length],
            createdAt: todayLocal(),
          }) as RegistryRow);
        }
        await storage.setItem(ACCOUNTS_KEY, JSON.stringify([...registry, ...added]));
      }
      // If an adopted wardrobe is the one open, its provider must re-read.
      for (const id of adoptedIds) announceAdopted(id);
    } catch {
      /* sync must never be the reason the app breaks */
    }
  }, []);

  /**
   * The account session: restored once at boot, then followed. A pull runs
   * once per signed-in user per load — TOKEN_REFRESHED re-runs would only
   * re-ask what was just answered, and SIGNED_IN after SIGNED_OUT must pull
   * again, which the reset below allows.
   */
  const pulledFor = useRef<string | null>(null);
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    void currentAuthUser().then(user => {
      if (!mounted) return;
      setAuthUser(user);
      setAuthReady(true);
      if (user && pulledFor.current !== user.id) {
        pulledFor.current = user.id;
        void afterSignIn(user);
      }
    });
    try {
      unsubscribe = onAuthChange((event, user) => {
        if (!mounted) return;
        setAuthUser(user);
        if (event === 'SIGNED_OUT') pulledFor.current = null;
        if (event === 'SIGNED_IN' && user && pulledFor.current !== user.id) {
          pulledFor.current = user.id;
          void afterSignIn(user);
        }
      });
    } catch {
      /* the account service is unreachable — the app stays a local ledger */
    }
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [afterSignIn]);

  // Back in the foreground: the queue of pushes that could not be sent goes
  // out, oldest dirt first — a phone that returns is a phone that may be back
  // on a network. Without a signed-in account there is nowhere to send to.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', next => {
      if (next !== 'active') return;
      const user = authUserRef.current;
      if (user) void flushQueue(user.id).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const signInEmail = useCallback((email: string, password: string) =>
    signInWithEmail(email, password), []);
  const signUpEmail = useCallback((email: string, password: string) =>
    signUpWithEmail(email, password), []);
  const signOutAccount = useCallback(() => signOutAuth(), []);

  const value = useMemo<SessionValue>(() => ({
    authUser,
    authReady,
    signInEmail,
    signUpEmail,
    signOutAccount,
  }), [authUser, authReady, signInEmail, signUpEmail, signOutAccount]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

/**
 * The wardrobe provider consumes the session where one is mounted and works
 * unchanged where none is (its own tests mount it bare) — a wardrobe that
 * never heard of accounts is the founding case, not an error.
 */
export function useSessionOptional(): SessionValue | null {
  return useContext(SessionContext);
}

/* ==================== the shared account UI ==================== */

/**
 * THE ACCOUNT PANEL — the whole of what an account is for, said to its face.
 * Ports the web's AccountPanel (src/pages/Door.tsx): an account exists for
 * exactly one reason — keeping the record of a wardrobe you choose on more
 * than one device. It is not a membership, it unlocks no feature, and the
 * app works fully without one. Used on the door and in Settings.
 */
export function AccountPanel() {
  const { authUser, authReady, signInEmail, signUpEmail, signOutAccount } = useSession();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const body = {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.text2,
  } as const;
  const label = {
    fontFamily: fonts.ui,
    fontSize: TYPE.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPE.labelSpacing,
    color: tokens.text2,
    marginBottom: 6,
  };
  const input = {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    color: tokens.text,
    backgroundColor: tokens.surface,
  };

  // Until the stored session has been checked once, render nothing rather
  // than a signed-out panel that flinches into a signed-in one.
  if (!authReady) return null;

  if (authUser) {
    return (
      <View>
        <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.body, color: tokens.text }}>
          Signed in as {authUser.email}
        </Text>
        <Text style={[body, { fontSize: 13, marginTop: 8 }]}>
          Synced wardrobes keep a copy on this account. Signing out ends that and deletes
          nothing — every wardrobe on this device stays exactly as it is.
        </Text>
        <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Button onPress={() => { void signOutAccount(); }}>Sign out</Button>
        </View>
      </View>
    );
  }

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const result = mode === 'in'
      ? await signInEmail(email.trim(), password)
      : await signUpEmail(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setNote({ text: result.error, error: true });
      return;
    }
    // A live session announces itself through the session context and this
    // panel becomes the signed-in view on its own. needsConfirm means the
    // account exists but the email must be answered first — say which.
    if (result.needsConfirm) {
      setNote({
        text: 'The account is made. Confirm it from the email that just arrived, then sign in.',
        error: false,
      });
    }
  };

  return (
    <View>
      <Text style={body}>
        Almari works entirely on this device, and that does not change. An account does one
        thing: it lets a wardrobe you choose open on your phone and your laptop both. No
        newsletter, nothing sold, nothing nags. The maker pays for it out of a free tier, so
        it costs you nothing; any change would be announced in advance.
      </Text>
      <View style={{ marginTop: 16, gap: 16 }}>
        <View>
          <Text style={label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@wherever.com"
            placeholderTextColor={tokens.text2}
          />
        </View>
        <View>
          <Text style={label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            secureTextEntry
            style={input}
            value={password}
            onChangeText={setPassword}
            placeholderTextColor={tokens.text2}
          />
          {mode === 'up' ? (
            <Text style={[body, { fontSize: 13, marginTop: 6 }]}>At least 6 characters.</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Button
            disabled={busy || !email.trim() || !password}
            onPress={() => { void submit(); }}
          >
            {busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Make the account'}
          </Button>
          <Button
            tone="tertiary"
            onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setNote(null); }}
          >
            {mode === 'in' ? 'New here? Make an account' : 'Already have one? Sign in'}
          </Button>
        </View>
        {note ? (
          <Text style={{
            fontFamily: fonts.ui,
            fontSize: 13,
            lineHeight: 18,
            color: note.error ? tokens.danger : tokens.text2,
          }}>
            {note.text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A 44px pressed-state choice — ports the web door's Choice: active sinks
 * into the ink fill with the on-ink accent eyelet (brand law 4), resting is
 * a hairline outline. The eyelet is a drawn ring; circles are for eyelets.
 */
export function Choice({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: string;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const eyeletColor = active ? tokens.accentOnInk : tokens.text2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? 'transparent' : tokens.border,
        borderRadius: RADIUS,
        backgroundColor: active ? tokens.inkFill : 'transparent',
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{
        width: 9,
        height: 9,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: eyeletColor,
        backgroundColor: active ? eyeletColor : 'transparent',
      }} />
      <Text style={{
        color: active ? tokens.onInk : tokens.text2,
        fontFamily: fonts.ui,
        fontSize: TYPE.label,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: TYPE.labelSpacing,
      }}>
        {children}
      </Text>
    </Pressable>
  );
}
