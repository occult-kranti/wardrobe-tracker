/**
 * Where a wardrobe lives on the phone.
 *
 * The same shelf labels the web uses — SOURCE OF TRUTH: src/lib/accounts.ts
 * at the repo root. One key per wardrobe, a small registry listing them, a
 * session key naming the open one, and one shared key for the things every
 * wardrobe can see. The names are mirrored, never imported: the web never
 * imports the app and the app copies no web logic — key strings are
 * addresses, not logic.
 *
 * THE KEYS KEEP THE OLD NAME, ON PURPOSE. This app was called Toile until it
 * was called Almari. The strings were not renamed with it (accounts.ts says
 * why: they are the addresses of wardrobes that already exist on devices),
 * and the native app keeps them identical so a future device-migration story
 * has one vocabulary, not two.
 *
 * WHAT THIS FILE IS: raw JSON strings in and out of AsyncStorage
 * (@react-native-async-storage/async-storage — included in Expo Go, checked
 * against https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/), behind
 * an interface the sync client can later ride (the sync push/pull moves the
 * same raw string this adapter moves).
 *
 * WHAT THIS FILE IS NOT: it is not the useLocalStorage semantics contract
 * (docs/34 §2.4's four laws — coalesced writes, errors said out loud, flush
 * on backgrounding, migrate-on-read). Those laws live in the hook that will
 * sit ABOVE this adapter. In particular:
 *
 *   SEAM — migrate() arrives from @almari/shared once Wave 3's lift lands
 *   (docs/34 §2.8). Every wardrobe-document READ must pass through it before
 *   parsing is trusted. It is not imported here yet, deliberately: until the
 *   lift there is exactly one source of the maths, and it is the web's.
 *
 * Errors are NOT swallowed here. The web's accounts.ts swallows quota errors
 * at this layer; the adapter lets them propagate instead, because law #2
 * ("a failed write is said out loud") is impossible to honour above an
 * adapter that already ate the failure.
 *
 * SECRETS NEVER LAND HERE. AsyncStorage is a plaintext file in the app
 * sandbox (scripts/check-native-storage.mjs polices this). SESSION_KEY is
 * not an auth session — it holds `{ activeId }`, which wardrobe is open on
 * this device, exactly as on the web. Tokens, keys and the Supabase session
 * belong in expo-secure-store, never in this file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/* The shelf labels — byte-identical to src/lib/accounts.ts. */
export const LEGACY_KEY = 'wardrobe-tracker';
export const SESSION_KEY = 'toile-session';
export const ACCOUNTS_KEY = 'toile-accounts';
export const COMMUNITY_KEY = 'toile-community';
export const THEME_KEY = 'toile-theme';
export const OPENED_KEY = 'toile-opened';

/** One key per wardrobe, exactly as the web addresses them. */
export const wardrobeKey = (accountId: string) => `${LEGACY_KEY}:${accountId}`;

/**
 * Raw strings in, raw strings out. The value is always the JSON text of a
 * document — this interface never parses, so the migrate-on-read seam above
 * it stays the only place parsing happens.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export const storage: StorageAdapter = {
  async getItem(key) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  },
  async getAllKeys() {
    return AsyncStorage.getAllKeys();
  },
};
