import type { CommunityState, Household, HouseholdKind, PassOffer, SharedPiece } from '@almari/shared/types';
import { HOUSEHOLD_KIND_LABELS } from '@almari/shared/types';
import { todayLocal } from '@almari/shared/dates';

/**
 * Pure transitions over the shared store. Every rule here came out of the
 * household panel, and the veto list is the law:
 *  - membership never happens without acceptance; leaving asks no one;
 *  - a roommates household IS a thread, so the thread follows the roof;
 *  - nothing here reads or writes any wardrobe's own store — a pass offer is
 *    a snapshot in the shared store, accepted from inside the receiving
 *    wardrobe or never landed at all.
 */

export function createHousehold(
  prev: CommunityState,
  creatorId: string,
  kind: HouseholdKind,
  invitedIds: string[],
  name?: string
): CommunityState {
  const household: Household = {
    id: crypto.randomUUID(),
    name: name?.trim() || undefined,
    kind,
    members: [
      { accountId: creatorId, joined: todayLocal() },
      ...invitedIds.filter(id => id !== creatorId).map(accountId => ({ accountId })),
    ],
  };
  return { ...prev, households: [...prev.households, household] };
}

/** Accepting an invitation. The roommates thread appears with the second yes. */
export function joinHousehold(prev: CommunityState, householdId: string, accountId: string): CommunityState {
  const households = prev.households.map(h =>
    h.id === householdId
      ? {
          ...h,
          members: h.members.map(m =>
            m.accountId === accountId && !m.joined ? { ...m, joined: todayLocal() } : m
          ),
        }
      : h
  );
  return ensureHouseholdThread({ ...prev, households }, householdId);
}

/** Unilateral, instant, asks no one. An emptied household folds quietly. */
export function leaveHousehold(prev: CommunityState, householdId: string, accountId: string): CommunityState {
  const households = prev.households
    .map(h =>
      h.id === householdId
        ? { ...h, members: h.members.filter(m => m.accountId !== accountId) }
        : h
    )
    .filter(h => h.members.some(m => m.joined));
  const conversations = prev.conversations
    .map(c => (c.householdId === householdId ? { ...c, memberIds: c.memberIds.filter(id => id !== accountId) } : c))
    .filter(c => !(c.householdId === householdId && c.memberIds.length < 2));
  return { ...prev, households, conversations };
}

/** A roommates household is a room; its thread exists once two have joined. */
function ensureHouseholdThread(prev: CommunityState, householdId: string): CommunityState {
  const household = prev.households.find(h => h.id === householdId);
  if (!household || household.kind !== 'roommates') return prev;
  const joined = household.members.filter(m => m.joined).map(m => m.accountId);
  if (joined.length < 2) return prev;
  const existing = prev.conversations.find(c => c.householdId === householdId);
  if (existing) {
    return {
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === existing.id ? { ...c, memberIds: joined } : c
      ),
    };
  }
  return {
    ...prev,
    conversations: [
      ...prev.conversations,
      {
        id: crypto.randomUUID(),
        name: household.name ?? HOUSEHOLD_KIND_LABELS[household.kind],
        memberIds: joined,
        isGroup: true,
        about: 'The household thread. What leaves the rail comes back to it.',
        householdId,
      },
    ],
  };
}

/** The joined households two wardrobes share, of one kind. */
export function sharedHouseholds(
  community: CommunityState,
  aId: string | null,
  kind?: HouseholdKind
): Household[] {
  if (!aId) return [];
  return community.households.filter(
    h =>
      (kind === undefined || h.kind === kind) &&
      h.members.some(m => m.accountId === aId && m.joined)
  );
}

/** Family members a giver could pass a piece to. */
export function passRecipients(community: CommunityState, giverId: string | null): string[] {
  const out = new Set<string>();
  for (const h of sharedHouseholds(community, giverId, 'family')) {
    for (const m of h.members) {
      if (m.joined && m.accountId !== giverId) out.add(m.accountId);
    }
  }
  return [...out];
}

/** The offer: a frozen snapshot mid-air. The giver's own record is untouched
    here — retiring the piece is the caller's separate, same-gesture act. */
export function offerPass(
  prev: CommunityState,
  fromId: string,
  fromName: string,
  toId: string,
  piece: SharedPiece,
  wearsInTheirRecord: number | undefined
): CommunityState {
  const offer: PassOffer = {
    id: crypto.randomUUID(),
    fromId,
    toId,
    piece,
    provenance: { from: fromName, wearsInTheirRecord, passedOn: todayLocal() },
    status: 'offered',
  };
  return { ...prev, passes: [...prev.passes, offer] };
}

export function settlePass(prev: CommunityState, offerId: string, status: 'accepted' | 'declined'): CommunityState {
  return {
    ...prev,
    passes: prev.passes.map(p => (p.id === offerId ? { ...p, status } : p)),
  };
}
