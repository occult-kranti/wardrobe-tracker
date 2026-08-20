/**
 * The storage adapter — raw JSON strings in and out of AsyncStorage under
 * the web's own key names.
 *
 * Mirrors the key/registry contracts of src/lib/accounts.ts as the node
 * suites exercise them (scripts/test-sync.mjs reads the same registry and
 * session shapes; scripts/test-migrate.mjs is the round-trip corpus this
 * adapter must never corrupt — a document written here and read back must
 * be the same bytes, unknown keys included).
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ACCOUNTS_KEY,
  COMMUNITY_KEY,
  LEGACY_KEY,
  OPENED_KEY,
  SESSION_KEY,
  THEME_KEY,
  storage,
  wardrobeKey,
} from '../src/lib/storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('the shelf labels mirror src/lib/accounts.ts byte for byte', () => {
  test('every key constant is the web string', () => {
    // These are addresses of wardrobes that already exist on devices —
    // accounts.ts documents why the old name stays. A drift here orphans
    // a future device-migration story.
    expect(LEGACY_KEY).toBe('wardrobe-tracker');
    expect(SESSION_KEY).toBe('toile-session');
    expect(ACCOUNTS_KEY).toBe('toile-accounts');
    expect(COMMUNITY_KEY).toBe('toile-community');
    expect(THEME_KEY).toBe('toile-theme');
    expect(OPENED_KEY).toBe('toile-opened');
  });

  test('wardrobeKey composes exactly as the web does', () => {
    expect(wardrobeKey('acct-1')).toBe('wardrobe-tracker:acct-1');
    expect(wardrobeKey('')).toBe('wardrobe-tracker:');
  });
});

describe('raw strings round-trip losslessly', () => {
  test('a wardrobe document survives set → get unchanged, unknown keys included', async () => {
    // Unknown-keys-preserved is the lossless-forever law (scripts/test-migrate.mjs);
    // the adapter must not parse, normalise, or re-encode on the way through.
    const doc = JSON.stringify({
      schemaVersion: 12,
      items: [{ id: 'i1', name: 'the linen shirt', cost: '420' }],
      aKeyNoVersionKnows: { kept: true },
    });
    await storage.setItem(wardrobeKey('acct-1'), doc);
    await expect(storage.getItem(wardrobeKey('acct-1'))).resolves.toBe(doc);
  });

  test('the session document round-trips under its web name', async () => {
    const session = JSON.stringify({ activeId: 'acct-2' });
    await storage.setItem(SESSION_KEY, session);
    const back = await storage.getItem(SESSION_KEY);
    expect(back).toBe(session);
    expect(JSON.parse(back as string)).toEqual({ activeId: 'acct-2' });
  });

  test('a missing key answers null, never a throw and never ""', async () => {
    await expect(storage.getItem(wardrobeKey('nobody'))).resolves.toBeNull();
  });

  test('removeItem takes the document off the shelf', async () => {
    await storage.setItem(ACCOUNTS_KEY, '[]');
    await storage.removeItem(ACCOUNTS_KEY);
    await expect(storage.getItem(ACCOUNTS_KEY)).resolves.toBeNull();
  });

  test('getAllKeys lists what was written', async () => {
    await storage.setItem(SESSION_KEY, '{}');
    await storage.setItem(wardrobeKey('a'), '{}');
    const keys = await storage.getAllKeys();
    expect(keys).toEqual(expect.arrayContaining([SESSION_KEY, 'wardrobe-tracker:a']));
  });

  test('two wardrobes are two shelves — one write never touches the other', async () => {
    await storage.setItem(wardrobeKey('a'), '{"items":[1]}');
    await storage.setItem(wardrobeKey('b'), '{"items":[2]}');
    await expect(storage.getItem(wardrobeKey('a'))).resolves.toBe('{"items":[1]}');
    await expect(storage.getItem(wardrobeKey('b'))).resolves.toBe('{"items":[2]}');
  });
});
