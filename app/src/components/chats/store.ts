/**
 * The shared shelf, read for conversations.
 *
 * SOURCE OF TRUTH, mirrored by reading and never by importing:
 * src/lib/accounts.ts (loadCommunity/saveCommunity — the COMMUNITY_KEY blob
 * and its five lists), src/lib/communitySeed.ts (normalizeCommunity — the
 * two newer lists default on read), src/context/SessionContext.tsx (the
 * accounts registry, the active id) and src/pages/Chats.tsx (the direct-pair
 * dedupe on starting a thread).
 *
 * SHAPE, NOT A CONTEXT: the web holds community state in SessionContext at
 * the root. The app's root providers are not this squad's files, so each
 * chat screen reads the shelf on focus and every mutation is a
 * read-modify-write against storage — two mounted screens can never clobber
 * each other with a stale copy, and the list is fresh the moment you step
 * back to it. When a SessionProvider lands at the root (AUTH+SYNC wave),
 * these readers collapse into it.
 *
 * Unknown keys in the stored blob ride through every write untouched — the
 * same lossless manners the wardrobe document keeps.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { todayLocal } from '@almari/shared/dates';
import {
  EMPTY_COMMUNITY,
  type ChatMessage,
  type CommunityState,
  type Conversation,
  type SharedLook,
  type SharedPiece,
} from '@almari/shared/types';

import { ACCOUNTS_KEY, COMMUNITY_KEY, SESSION_KEY, storage } from '../../lib/storage';
import { PERSONA_ROWS, seedChatThreads } from './personaThreads';

/**
 * A registry row, shaped as the web's Account — the fields chats read,
 * with everything else preserved as written.
 */
export interface ChatAccount {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  color: string;
  isSample?: boolean;
  [key: string]: unknown;
}

/**
 * Ids are opaque strings — same shape and reason as src/lib/wardrobe.tsx
 * newId (Hermes ships no crypto.randomUUID; a new dependency is an owner
 * decision). Not a formula; no shared source exists for it.
 */
export function newLocalId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}${rand()}`;
}

/* ---------------- the arrival contract ----------------
   The web's feed hands a snapshot to conversations via navigation state
   (src/components/social.tsx PostCard):
     navigate('/chats', { state: { attach: { piece } | { look } } })
     navigate('/chats', { state: { ask: { pieceName, ownerId } } })
   expo-router carries params, not state, so the same shapes travel as JSON
   in the `attach` / `ask` search params of /chats and /chats/[id]. The
   sender screens (feed) are not built yet; this is the contract they meet. */

export interface AttachArrival {
  look?: SharedLook;
  piece?: SharedPiece;
}

export interface AskArrival {
  pieceName: string;
  ownerId: string;
}

/** One param, however the router hands it over. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** A malformed arrival is no arrival — never a crash on a bad deep link. */
export function parseAttach(raw: string | string[] | undefined): AttachArrival | null {
  const text = firstParam(raw);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as AttachArrival;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (parsed.piece && typeof parsed.piece.name === 'string') return { piece: parsed.piece };
    if (parsed.look && typeof parsed.look.name === 'string') return { look: parsed.look };
    return null;
  } catch {
    return null;
  }
}

export function parseAsk(raw: string | string[] | undefined): AskArrival | null {
  const text = firstParam(raw);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as AskArrival;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.pieceName !== 'string' || !parsed.pieceName.trim()) return null;
    if (typeof parsed.ownerId !== 'string' || !parsed.ownerId) return null;
    return { pieceName: parsed.pieceName, ownerId: parsed.ownerId };
  } catch {
    return null;
  }
}

/* ---------------- the shelf ---------------- */

async function readJson(key: string): Promise<unknown> {
  const raw = await storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Every read is shape-checked list by list (web loadCommunity) and the two
 * newer lists default (web normalizeCommunity) — a blob written before
 * tombstones existed still opens. Unknown keys are kept.
 */
export async function readCommunity(): Promise<CommunityState> {
  const raw = ((await readJson(COMMUNITY_KEY)) ?? {}) as Partial<CommunityState> &
    Record<string, unknown>;
  return {
    ...raw,
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    conversations: Array.isArray(raw.conversations) ? raw.conversations : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    households: Array.isArray(raw.households) ? raw.households : [],
    passes: Array.isArray(raw.passes) ? raw.passes : [],
    removedPostIds: Array.isArray(raw.removedPostIds) ? raw.removedPostIds : [],
    savedPostIds: Array.isArray(raw.savedPostIds) ? raw.savedPostIds : [],
  };
}

export async function writeCommunity(state: CommunityState): Promise<void> {
  await storage.setItem(COMMUNITY_KEY, JSON.stringify(state));
}

export async function readAccounts(): Promise<ChatAccount[]> {
  const parsed = await readJson(ACCOUNTS_KEY);
  return Array.isArray(parsed) ? (parsed as ChatAccount[]) : [];
}

export async function readActiveId(): Promise<string | null> {
  const session = (await readJson(SESSION_KEY)) as { activeId?: string } | null;
  return typeof session?.activeId === 'string' ? session.activeId : null;
}

export interface ChatsSnapshot {
  ready: boolean;
  activeId: string | null;
  accounts: ChatAccount[];
  community: CommunityState;
}

const EMPTY_SNAPSHOT: ChatsSnapshot = {
  ready: false,
  activeId: null,
  accounts: [],
  community: EMPTY_COMMUNITY,
};

export interface ChatsStore extends ChatsSnapshot {
  /** Re-read the shelf now — after a write, or whenever staleness would show. */
  refresh: () => Promise<void>;
  /** Append one message; the write lands before the screen re-renders. */
  appendMessage: (message: ChatMessage) => Promise<void>;
  /**
   * Start a thread — or land on the existing one when a pair is already
   * talking (the web's own dedupe; a pair should not end up with two
   * threads). Returns the conversation id to navigate to.
   */
  startConversation: (memberIds: string[], name?: string) => Promise<string>;
  /**
   * Put the sample wardrobes' registry rows and their threads on this
   * device — the chats slice of the web's installSamples. Idempotent.
   */
  installSampleThreads: () => Promise<void>;
}

export function useChatsStore(): ChatsStore {
  const [snap, setSnap] = useState<ChatsSnapshot>(EMPTY_SNAPSHOT);

  const refresh = useCallback(async () => {
    const [activeId, accounts, community] = await Promise.all([
      readActiveId(),
      readAccounts(),
      readCommunity(),
    ]);
    setSnap({ ready: true, activeId, accounts, community });
  }, []);

  // Focus, not mount: stepping back from a thread must show the line just
  // written there. The cancelled flag keeps a slow read from landing on an
  // unfocused screen.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const [activeId, accounts, community] = await Promise.all([
          readActiveId(),
          readAccounts(),
          readCommunity(),
        ]);
        if (live) setSnap({ ready: true, activeId, accounts, community });
      })();
      return () => {
        live = false;
      };
    }, []),
  );

  const appendMessage = useCallback(
    async (message: ChatMessage) => {
      // Read-modify-write: never trust the copy on screen to be the shelf.
      const community = await readCommunity();
      const next = { ...community, messages: [...community.messages, message] };
      await writeCommunity(next);
      await refresh();
    },
    [refresh],
  );

  const startConversation = useCallback(
    async (memberIds: string[], name?: string) => {
      const community = await readCommunity();
      const isGroup = memberIds.length > 2;
      if (!isGroup) {
        const existing = community.conversations.find(
          c =>
            !c.isGroup &&
            c.memberIds.length === memberIds.length &&
            memberIds.every(m => c.memberIds.includes(m)),
        );
        if (existing) return existing.id;
      }
      const conversation: Conversation = {
        id: `c-${newLocalId().slice(-8)}`,
        memberIds,
        isGroup,
        name: isGroup && name?.trim() ? name.trim() : undefined,
      };
      await writeCommunity({
        ...community,
        conversations: [...community.conversations, conversation],
      });
      await refresh();
      return conversation.id;
    },
    [refresh],
  );

  const installSampleThreads = useCallback(async () => {
    const accounts = await readAccounts();
    const existing = new Set(accounts.map(a => a.id));
    // todayLocal, never toISOString — the UTC day-shift is the house's most
    // re-fixed bug and the registry keeps local dates like everything else.
    const added = PERSONA_ROWS.filter(row => !existing.has(row.id)).map(row => ({
      ...row,
      createdAt: todayLocal(),
    }));
    if (added.length > 0) {
      await storage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, ...added]));
    }
    const community = await readCommunity();
    const seeded = seedChatThreads(community);
    if (seeded !== community) await writeCommunity(seeded);
    await refresh();
  }, [refresh]);

  return { ...snap, refresh, appendMessage, startConversation, installSampleThreads };
}
