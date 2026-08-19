import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/**
 * THE SECOND THING THAT CAN LEAVE THE DEVICE.
 *
 * The first is a photograph handed to the AI provider, one press at a time.
 * The second is this: an OPTIONAL account on the owner's own Supabase project,
 * existing for exactly one reason — to keep the record of a wardrobe you
 * choose on more than one device. A wardrobe whose sync choice is 'device'
 * (the default, and every wardrobe made before this existed) never touches
 * this file's network at all.
 *
 * The key below is Supabase's PUBLISHABLE anon key: it is written to be
 * shipped in client code, and it grants nothing on its own. Row-level
 * security on the tables is the actual lock — see supabase/setup.sql.
 */

const SUPABASE_URL = 'https://wvupsqfevlrmhqfjreyx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5EagGW16pZIeSV7TaAyLQw_Phuaaf0k';

/**
 * Built lazily, on first use, so that importing this module is free of side
 * effects: no network, no storage reads beyond what the library needs, and no
 * crash when the device is offline. The library itself is offline-tolerant —
 * calls fail, the import never does.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // The default and the point: the session lives in localStorage, so a
        // reopened app is still signed in. Storage is the device's, as always.
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

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
