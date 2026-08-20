/**
 * The shared shelf, read the way the web reads it.
 *
 * One key for the things every wardrobe on this device can see —
 * COMMUNITY_KEY ('toile-community'), byte-identical to src/lib/accounts.ts —
 * holding a CommunityState blob. This hook is the Look Book's doorway to it:
 *
 *  - LOAD: parse, then normalizeCommunity (a blob written before tombstones
 *    existed carries neither key), exactly as the web funnels every read.
 *  - SEED ONCE: the sample posts merge in idempotently by id, tombstones
 *    respected (sampleFeed.ts mirrors seedCommunity's manners). Dates pin at
 *    the first seed and never rewrite.
 *  - WRITE-THROUGH: community changes are tap-frequency (a take-down, a
 *    set-aside), not keystroke-frequency, so each committed change writes
 *    immediately — no settle window to lose on backgrounding. A failed write
 *    is said out loud once per run of trouble (docs/34 §2.4 law 2).
 *
 * WHO ELSE READS THIS KEY: nobody yet, natively. When a session/chats squad
 * builds the full SessionContext port it inherits a store already in the
 * web's own shape, seeded with the web's own post ids.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { todayLocal } from '@almari/shared/dates';
import { EMPTY_COMMUNITY, type Account, type CommunityState } from '@almari/shared/types';

import { showToast } from '../Toast';
import { ACCOUNTS_KEY, COMMUNITY_KEY, SESSION_KEY, storage } from '../../lib/storage';
import { normalizeCommunity } from './feedResolve';
import { SAMPLE_AUTHORS, seedSampleFeed } from './sampleFeed';

async function readJson(key: string): Promise<unknown> {
  const raw = await storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isCommunityShaped(v: unknown): v is CommunityState {
  return typeof v === 'object' && v !== null && Array.isArray((v as CommunityState).posts);
}

export interface CommunityStore {
  /** Null until the shelf has answered — a blank beat, not a flash of nothing. */
  community: CommunityState | null;
  /**
   * Registry wardrobes plus the bundled sample cast, registry winning on an
   * id collision — the author list resolveFeedEntries reads.
   */
  accounts: Account[];
  /** The wardrobe open on this device, from the same session key the web writes. */
  activeId: string | null;
  /** Commit a change: state moves now, the shelf is written through. */
  setCommunity: (update: (prev: CommunityState) => CommunityState) => void;
}

export function useCommunity(): CommunityStore {
  const [community, setCommunityState] = useState<CommunityState | null>(null);
  const [accounts, setAccounts] = useState<Account[]>(SAMPLE_AUTHORS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const errored = useRef(false);

  const write = useCallback((next: CommunityState) => {
    storage
      .setItem(COMMUNITY_KEY, JSON.stringify(next))
      .then(() => {
        errored.current = false;
      })
      .catch(() => {
        if (!errored.current) {
          errored.current = true;
          showToast(
            'This device would not take the write — its storage is full. Export a backup from Settings now, then remove a few photographs.',
            'error',
          );
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sessionRaw, accountsRaw, communityRaw] = await Promise.all([
        readJson(SESSION_KEY),
        readJson(ACCOUNTS_KEY),
        readJson(COMMUNITY_KEY),
      ]);
      if (cancelled) return;

      const session = sessionRaw as { activeId?: string } | null;
      setActiveId(typeof session?.activeId === 'string' ? session.activeId : null);

      const registry = Array.isArray(accountsRaw) ? (accountsRaw as Account[]) : [];
      const registryIds = new Set(registry.map(a => a.id));
      setAccounts([...registry, ...SAMPLE_AUTHORS.filter(a => !registryIds.has(a.id))]);

      const stored = isCommunityShaped(communityRaw)
        ? normalizeCommunity(communityRaw)
        : { ...EMPTY_COMMUNITY };
      const seeded = seedSampleFeed(stored, todayLocal());
      // The seed writes only when it added something — an untouched shelf is
      // not news, and first boot pins the sample posts' dates for good.
      if (seeded !== stored || !isCommunityShaped(communityRaw)) write(seeded);
      setCommunityState(seeded);
    })();
    return () => {
      cancelled = true;
    };
  }, [write]);

  const setCommunity = useCallback(
    (update: (prev: CommunityState) => CommunityState) => {
      setCommunityState(prev => {
        if (prev === null) return prev;
        const next = update(prev);
        if (next !== prev) write(next);
        return next;
      });
    },
    [write],
  );

  return { community, accounts, activeId, setCommunity };
}
