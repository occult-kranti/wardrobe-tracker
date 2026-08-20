/**
 * THE SECOND THING THAT CAN LEAVE THE DEVICE.
 *
 * Mirrors src/lib/supabase.ts at the repo root — SOURCE OF TRUTH for the
 * project URL, the key, the auth helpers, and every error sentence. Read,
 * never imported: the app copies no web logic, but an address is an address
 * and an apology should read the same on both apps.
 *
 * The first thing that can leave the device is a photograph handed to the AI
 * relay, one press at a time. The second is this: an OPTIONAL account on the
 * owner's own Supabase project, existing for exactly one reason — to keep
 * the record of a wardrobe you choose on more than one device. A wardrobe
 * whose sync choice is 'device' (the default, and every wardrobe made before
 * this existed) never touches this file's network at all.
 *
 * The key below is Supabase's PUBLISHABLE anon key: it is written to be
 * shipped in client code, and it grants nothing on its own. Row-level
 * security on the tables is the actual lock — see supabase/setup.sql.
 *
 * WHERE THE SESSION LIVES — and why it is not AsyncStorage. supabase-js on
 * native defaults its auth session to AsyncStorage, which is a plaintext
 * file in the app sandbox; the refresh token in that session IS the account.
 * scripts/check-native-storage.mjs refuses that default by rule, so the
 * session goes to expo-secure-store (the keychain / Android Keystore —
 * https://docs.expo.dev/versions/v57.0.0/sdk/securestore/, read 2026-08-19).
 * SecureStore historically rejects values above ~2048 bytes on iOS, and a
 * Supabase session (JWT + refresh token + user) can exceed that, so the
 * adapter below chunks: a value that fits is stored whole; a longer one is
 * split across `key.0 … key.n-1` behind a head record naming the count.
 * Everything stays in the keychain — Supabase's own Expo guide reaches for
 * aes-js + AsyncStorage instead, but that is two more dependencies to hold
 * a session partly OUTSIDE the keychain, and chunking needs neither.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const SUPABASE_URL = 'https://wvupsqfevlrmhqfjreyx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5EagGW16pZIeSV7TaAyLQw_Phuaaf0k';

/* ==================== the keychain adapter ==================== */

/** What the adapter needs of expo-secure-store — injectable for tests. */
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Stay comfortably under the historical ~2048-byte iOS refusal. Sessions are
 * ASCII (base64url JWTs and JSON), so UTF-16 length is byte length here.
 */
const CHUNK_SIZE = 1800;
/** The head record of a chunked value. Never a plausible session prefix. */
const CHUNK_HEAD = '__almari-chunks__:';

/**
 * SecureStore, made safe for values longer than the platform will take in
 * one write. Keys stay inside SecureStore's charset (alphanumeric, `.`,
 * `-`, `_`) — supabase-js asks for `sb-<ref>-auth-token`, which fits, and
 * the chunk suffix `.N` fits too. Never throws: a keychain refusal must
 * cost the session persistence, never the app — the web makes the same
 * trade when localStorage is disabled.
 */
export function chunkedSecureStorage(store: SecureStoreLike) {
  const chunkKey = (key: string, i: number) => `${key}.${i}`;

  const chunkCount = (head: string | null): number => {
    if (!head || !head.startsWith(CHUNK_HEAD)) return 0;
    const n = Number.parseInt(head.slice(CHUNK_HEAD.length), 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };

  const removeChunks = async (key: string, from: number, upTo: number) => {
    for (let i = from; i < upTo; i++) {
      await store.deleteItemAsync(chunkKey(key, i));
    }
  };

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const head = await store.getItemAsync(key);
        const n = chunkCount(head);
        if (n === 0) return head ?? null;
        const parts: string[] = [];
        for (let i = 0; i < n; i++) {
          const part = await store.getItemAsync(chunkKey(key, i));
          // A missing chunk is a torn value; half a session is no session.
          if (part === null) return null;
          parts.push(part);
        }
        return parts.join('');
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        const before = chunkCount(await store.getItemAsync(key));
        if (value.length <= CHUNK_SIZE) {
          await store.setItemAsync(key, value);
          await removeChunks(key, 0, before);
          return;
        }
        const n = Math.ceil(value.length / CHUNK_SIZE);
        for (let i = 0; i < n; i++) {
          await store.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
        }
        // The head goes LAST, so a read racing this write never sees a count
        // pointing at chunks that are not all there yet.
        await store.setItemAsync(key, `${CHUNK_HEAD}${n}`);
        await removeChunks(key, n, before);
      } catch {
        /* keychain refused — the session lives in memory for this run */
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        const before = chunkCount(await store.getItemAsync(key));
        await store.deleteItemAsync(key);
        await removeChunks(key, 0, before);
      } catch {
        /* already gone, or the keychain is refusing — either way, signed out */
      }
    },
  };
}

/* ==================== the client ==================== */

/**
 * Built lazily, on first use, so that importing this module is free of side
 * effects: no network, no keychain reads beyond what the library needs, and
 * no crash when the device is offline. The library itself is offline-
 * tolerant — calls fail, the import never does.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // The keychain, chunked — see the header. Never AsyncStorage.
        storage: chunkedSecureStorage(SecureStore),
        persistSession: true,
        autoRefreshToken: true,
        // There is no URL to detect a session in — this is a phone, not a
        // redirect landing page (the supabase-js React Native guidance).
        detectSessionInUrl: false,
      },
    });
    // Native has no visibilitychange, so supabase-js cannot start its own
    // refresh ticker — the documented RN pattern hands it AppState: refresh
    // while foregrounded, stop while backgrounded (token refresh on a woken
    // app happens on demand in getSession).
    AppState.addEventListener('change', state => {
      if (!client) return;
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
  }
  return client;
}

/* ==================== the helpers, as the web states them ==================== */

/** The slice of a Supabase user the interface ever shows. */
export interface AuthUser {
  id: string;
  email: string;
}

export function authUserFrom(user: User | null | undefined): AuthUser | null {
  if (!user || typeof user.id !== 'string') return null;
  return { id: user.id, email: user.email ?? '' };
}

/** The currently held session's user, or null. Never throws. */
export async function currentAuthUser(): Promise<AuthUser | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return authUserFrom(data.session?.user);
  } catch {
    return null;
  }
}

/**
 * Subscribe to auth changes. Returns the unsubscribe. The callback fires with
 * the event name and the user (or null) — SIGNED_IN, SIGNED_OUT,
 * TOKEN_REFRESHED and friends, all reduced to who is signed in now.
 */
export function onAuthChange(
  cb: (event: string, user: AuthUser | null) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    cb(event, authUserFrom(session?.user));
  });
  return () => data.subscription.unsubscribe();
}

export type AuthResult =
  | { ok: true; needsConfirm?: boolean }
  | { ok: false; error: string };

/** What an auth failure means, said so a person can act on it. */
function explainAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match anything on record.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'That email already has an account — sign in instead.';
  if (m.includes('password') && (m.includes('at least') || m.includes('should be')))
    return 'The password needs to be at least 6 characters.';
  if (m.includes('email') && m.includes('invalid')) return 'That does not read as an email address.';
  if (m.includes('rate limit')) return 'Too many tries in a row. Give it a minute.';
  return message;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await getSupabase().auth.signUp({ email, password });
    if (error) return { ok: false, error: explainAuthError(error.message) };
    // With email confirmation switched off (the alpha setup), signUp hands back
    // a live session. With it on, the account exists but the door opens only
    // after the email's link is followed — say which happened.
    if (!data.session) return { ok: true, needsConfirm: true };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the account service. Everything else in Almari works offline.' };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: explainAuthError(error.message) };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the account service. Everything else in Almari works offline.' };
  }
}

/**
 * Signing out ends the session and nothing else. Every wardrobe on this
 * device stays exactly where it is — the local record is the original, not a
 * cache of the account's copy.
 */
export async function signOutAuth(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } catch {
    /* offline — the session token simply stops being refreshed */
  }
}
