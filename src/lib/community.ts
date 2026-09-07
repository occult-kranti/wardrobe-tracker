import { COMMUNITY_KEY, loadCommunity } from './accounts';

/**
 * WHAT THE SHARED STORE KEEPS WHEN A WARDROBE LEAVES THE DEVICE.
 *
 * This is the one function that survived src/lib/admin.ts. Everything else in
 * that file was the project-lead portal's own tooling, and the portal is now a
 * separate build on a separate origin (vite.portal.config.ts, src/portal/) —
 * which means it cannot reach this device's storage at all, and never should.
 * The old module is kept for reference in docs/attic/admin.ts.
 *
 * `pruneCommunity` stayed because it is not portal tooling: it is called by
 * SessionContext when a wardrobe is forgotten, and it belongs to the app.
 */

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled or full — the store is left exactly as it was */
  }
}

/**
 * Remove every trace of departed wardrobes from the store the wardrobes share.
 *
 * The community store outlives any one wardrobe: a conversation a tester had
 * with a sample persona survives that persona being removed from the device,
 * and there is no delete-conversation control anywhere to clear it.
 *
 * The rules follow the shapes household.ts already uses for leaving: a departed
 * id leaves every member list, a household with no joined member left folds, a
 * conversation that drops below two present members goes with its messages, and
 * a departed author's messages and posts go too. This is trace removal, not an
 * edit of what anyone said.
 *
 * Unknown fields (removedPostIds, and whatever a later schema adds) are carried
 * through untouched: loadCommunity normalises five arrays and would silently
 * drop the rest on the way back out.
 */
export function pruneCommunity(ids: string[]): void {
  // Never CREATE the key on a device that has never had a shared store.
  if (ids.length === 0 || readRaw(COMMUNITY_KEY) === null) return;
  const gone = new Set(ids);
  const raw = readJson<Record<string, unknown>>(COMMUNITY_KEY, {});
  const before = loadCommunity();

  const households = before.households
    .map(h => ({ ...h, members: h.members.filter(m => !gone.has(m.accountId)) }))
    .filter(h => h.members.some(m => m.joined));
  const standing = new Set(households.map(h => h.id));

  const conversations = before.conversations
    .map(c => ({ ...c, memberIds: c.memberIds.filter(id => !gone.has(id)) }))
    .filter(c => c.memberIds.length >= 2 && (!c.householdId || standing.has(c.householdId)));
  const kept = new Set(conversations.map(c => c.id));

  writeJson(COMMUNITY_KEY, {
    ...raw,
    households,
    conversations,
    messages: before.messages.filter(m => kept.has(m.conversationId) && !gone.has(m.authorId)),
    posts: before.posts.filter(p => !gone.has(p.authorId)),
    passes: before.passes.filter(p => !gone.has(p.fromId) && !gone.has(p.toId)),
  });
}
