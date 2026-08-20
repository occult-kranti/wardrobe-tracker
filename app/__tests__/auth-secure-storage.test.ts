/**
 * The keychain adapter — chunkedSecureStorage in src/lib/supabase.ts.
 *
 * The rule it exists for (scripts/check-native-storage.mjs): the Supabase
 * session never lands in AsyncStorage's plaintext file; it goes to the
 * keychain. The complication it exists for: SecureStore has historically
 * refused values above ~2048 bytes on iOS, and a session (JWT + refresh
 * token + user) can exceed that. So the adapter chunks — and this suite
 * proves the chunking is invisible from above: what goes in comes out,
 * at every size, and nothing stale is left behind.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { chunkedSecureStorage, type SecureStoreLike } from '../src/lib/supabase';

/** An in-memory keychain with SecureStore's own honesty about key charset. */
function fakeKeychain(shelf = new Map<string, string>()): SecureStoreLike & { shelf: Map<string, string> } {
  return {
    shelf,
    async getItemAsync(key) {
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/); // SecureStore's charset, held
      return shelf.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
      shelf.set(key, value);
    },
    async deleteItemAsync(key) {
      shelf.delete(key);
    },
  };
}

const KEY = 'sb-wvupsqfevlrmhqfjreyx-auth-token';

describe('values that fit go in whole', () => {
  test('a short value round-trips as itself, one keychain entry', async () => {
    const keychain = fakeKeychain();
    const store = chunkedSecureStorage(keychain);
    await store.setItem(KEY, 'short-session');
    await expect(store.getItem(KEY)).resolves.toBe('short-session');
    expect([...keychain.shelf.keys()]).toEqual([KEY]);
  });

  test('a missing key answers null, never a throw', async () => {
    const store = chunkedSecureStorage(fakeKeychain());
    await expect(store.getItem('never-written')).resolves.toBeNull();
  });
});

describe('values past the platform ceiling are chunked, invisibly', () => {
  // A realistic session is JSON around JWTs — ASCII, well past 2048 bytes.
  const longSession = JSON.stringify({
    access_token: 'header.payload.signature-'.repeat(120),
    refresh_token: 'r-'.repeat(400),
    user: { id: 'user-1', email: 'tester@example.com' },
  });

  test('what goes in comes out, and every stored piece is under the ceiling', async () => {
    const keychain = fakeKeychain();
    const store = chunkedSecureStorage(keychain);
    expect(longSession.length).toBeGreaterThan(2048);
    await store.setItem(KEY, longSession);
    await expect(store.getItem(KEY)).resolves.toBe(longSession);
    for (const [, value] of keychain.shelf) {
      expect(value.length).toBeLessThanOrEqual(2000);
    }
    // The head record plus its chunks, nothing else.
    const head = keychain.shelf.get(KEY);
    expect(head).toMatch(/^__almari-chunks__:\d+$/);
  });

  test('overwriting long with short clears every stale chunk', async () => {
    const keychain = fakeKeychain();
    const store = chunkedSecureStorage(keychain);
    await store.setItem(KEY, longSession);
    const chunkedCount = keychain.shelf.size;
    expect(chunkedCount).toBeGreaterThan(1);
    await store.setItem(KEY, 'short-now');
    await expect(store.getItem(KEY)).resolves.toBe('short-now');
    expect([...keychain.shelf.keys()]).toEqual([KEY]);
  });

  test('overwriting long with longer, then shorter-but-still-chunked, leaves no orphans', async () => {
    const keychain = fakeKeychain();
    const store = chunkedSecureStorage(keychain);
    await store.setItem(KEY, longSession);
    await store.setItem(KEY, longSession + longSession);
    await expect(store.getItem(KEY)).resolves.toBe(longSession + longSession);
    await store.setItem(KEY, longSession);
    await expect(store.getItem(KEY)).resolves.toBe(longSession);
    // head + exactly ceil(n / 1800) chunks — no orphan from the longer write.
    expect(keychain.shelf.size).toBe(1 + Math.ceil(longSession.length / 1800));
  });

  test('removeItem takes the head and every chunk off the keychain', async () => {
    const keychain = fakeKeychain();
    const store = chunkedSecureStorage(keychain);
    await store.setItem(KEY, longSession);
    await store.removeItem(KEY);
    expect(keychain.shelf.size).toBe(0);
    await expect(store.getItem(KEY)).resolves.toBeNull();
  });

  test('a torn value — a chunk gone missing — reads as no session, not half a session', async () => {
    const keychain = fakeKeychain();
    const store = chunkedSecureStorage(keychain);
    await store.setItem(KEY, longSession);
    keychain.shelf.delete(`${KEY}.1`);
    await expect(store.getItem(KEY)).resolves.toBeNull();
  });
});

describe('the keychain refusing is never a crash', () => {
  test('set, get and remove swallow a throwing keychain', async () => {
    const store = chunkedSecureStorage({
      async getItemAsync() { throw new Error('keychain locked'); },
      async setItemAsync() { throw new Error('keychain locked'); },
      async deleteItemAsync() { throw new Error('keychain locked'); },
    });
    await expect(store.setItem(KEY, 'v')).resolves.toBeUndefined();
    await expect(store.getItem(KEY)).resolves.toBeNull();
    await expect(store.removeItem(KEY)).resolves.toBeUndefined();
  });
});
