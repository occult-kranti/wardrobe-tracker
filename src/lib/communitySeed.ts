import type { CommunityState, FeedPost, ChatMessage, Household, SharedLook } from '@almari/shared/types';
import type { PersonaSeed } from './personaData';
import { todayLocal, addDays } from '@almari/shared/dates';

/**
 * Seeds the shared layer: what each sample wardrobe has chosen to show, one
 * group thread, and a direct thread between each pair.
 *
 * A post carries a SNAPSHOT of the look — its name, its photograph, its piece
 * names — taken at the moment it was shared. That is deliberate: the feed must
 * render a look belonging to a wardrobe that is not currently open, and reaching
 * into someone else's store to do it would mean every page could read every
 * closet. A snapshot also means editing a piece later never silently rewrites
 * what someone already saw.
 */

const D = (n: number) => addDays(todayLocal(), n);

export function lookOf(persona: PersonaSeed, outfitId: string): SharedLook | undefined {
  const outfit = persona.outfits.find(o => o.id === outfitId);
  if (!outfit) return undefined;
  return {
    outfitId: outfit.id,
    name: outfit.name,
    imageUrl: outfit.image,
    occasion: outfit.occasion,
    pieces: outfit.itemIds
      .map(id => persona.items.find(i => i.id === id)?.name)
      .filter((n): n is string => Boolean(n)),
  };
}

/** Which looks each sample wardrobe puts on show, and what they say about them. */
const SHARED: Record<string, Array<{ outfit: string; day: number; caption?: string }>> = {
  aarav: [
    { outfit: 'AM-01', day: -3, caption: 'Wore the black suit with the ecru tee instead of a shirt. Held up all evening.' },
    { outfit: 'AM-12', day: -9, caption: 'Monsoon build. Everything on me dries in twenty minutes.' },
    { outfit: 'AM-07', day: -21, caption: 'The bandhgala my father had made in 1994, taken in at the waist.' },
    { outfit: 'AM-05', day: -31 },
  ],
  vikram: [
    { outfit: 'VS-02', day: -5, caption: 'Client lunch, no tie. The knit polo does the collar’s work without the ceremony.' },
    { outfit: 'VS-16', day: -14, caption: 'Navy after six, but the flannel keeps it from reading office.' },
    { outfit: 'VS-01', day: -27 },
  ],
  meher: [
    { outfit: 'MK-17', day: -2, caption: 'Oxblood, and one hand-block piece. The rule holds even at dinner.' },
    { outfit: 'MK-20', day: -8, caption: 'Nani’s chettinad saree with sneakers. She would have approved of the walking, not the shoes.' },
    { outfit: 'MK-04', day: -16, caption: 'Sourcing day in Shahpur Jat. Pockets, flats, nothing white.' },
    { outfit: 'MK-16', day: -24 },
  ],
};

/** The group thread. Written to cover talk, a shared look, and a borrow. */
const GROUP_THREAD: Array<{
  by: string; day: number; text: string; look?: string;
  request?: NonNullable<ChatMessage['request']>;
}> = [
  { by: 'meher', day: -12, text: 'Three weddings in Delhi next month and I am short one evening look. Opening the floor.' },
  // The asker writes the request; the owner is who can answer it.
  { by: 'meher', day: -12, text: 'Vikram — could I ask after the ivory bandhgala for the second one?', request: { pieceName: 'Bandhgala, ivory raw silk', status: 'lent', ownerId: 'vikram' } },
  { by: 'vikram', day: -12, text: 'Yours if the shoulders work. It has done four weddings and wants a fifth.' },
  { by: 'aarav', day: -11, text: 'Take the pocket square with it. They were made from the same bolt.' },
  { by: 'meher', day: -10, text: 'Wearing it to the sangeet. Photographs going straight to this thread.', look: 'MK-19' },
  { by: 'aarav', day: -6, text: 'Goa in a fortnight — Vikram, is one of the linen shirts free?', request: { pieceName: 'Linen shirt, sand', status: 'asked', ownerId: 'vikram' } },
  { by: 'aarav', day: -5, text: 'Meher, and the marigold kurta for the Sunday, if it is not out?', request: { pieceName: 'Marigold kurta', status: 'declined', ownerId: 'meher' } },
  { by: 'meher', day: -4, text: 'That one is in three shoots this month. Everything else is open.' },
  { by: 'meher', day: -2, text: 'The bandhgala is home, pressed, with the pocket square folded inside it.', request: { pieceName: 'Bandhgala, ivory raw silk', status: 'returned', ownerId: 'vikram' } },
];

/** One direct thread per pair, so the conversation list has real weight. */
const DIRECT_THREADS: Array<{ pair: [string, string]; lines: Array<{ by: string; day: number; text: string; look?: string }> }> = [
  {
    pair: ['meher', 'vikram'],
    lines: [
      { by: 'meher', day: -13, text: 'Measurements for the bandhgala before I promise it to anyone else?' },
      { by: 'vikram', day: -13, text: 'Shoulder 46, chest 104, sleeve 63. It runs generous through the body.' },
      { by: 'meher', day: -12, text: 'That works belted. Sending the look I have in mind.', look: 'MK-19' },
    ],
  },
  {
    pair: ['aarav', 'meher'],
    lines: [
      { by: 'aarav', day: -7, text: 'Who did the block-print on the kurta from the Diwali post? I want a length of it.' },
      { by: 'meher', day: -7, text: 'Bagru, near Jaipur. I am there in a fortnight — I can carry back a metre.' },
      { by: 'aarav', day: -6, text: 'Yes. Anything with indigo in it.' },
    ],
  },
  {
    pair: ['aarav', 'vikram'],
    lines: [
      { by: 'aarav', day: -4, text: 'Is a bandhgala over trousers acceptable at a Bengaluru work thing, or is that a wedding-only object?' },
      { by: 'vikram', day: -4, text: 'Acceptable if the trousers are wool and the shoes are closed. It stops reading festive the moment nothing else is festive.' },
    ],
  },
];

export function seedCommunity(prev: CommunityState, personas: PersonaSeed[]): CommunityState {
  const byId = new Map(personas.map(p => [p.id, p]));
  const known = new Set(prev.posts.map(p => p.id));
  // A take-down is a statement, not an absence: without this check the seed
  // would re-append any known-id post it found missing, and a look someone
  // deliberately removed would resurrect on the next boot.
  const tombstoned = new Set(prev.removedPostIds ?? []);

  const posts: FeedPost[] = [];
  for (const [personaId, entries] of Object.entries(SHARED)) {
    const persona = byId.get(personaId);
    if (!persona) continue;
    for (const entry of entries) {
      const id = `post-${personaId}-${entry.outfit}`;
      if (known.has(id) || tombstoned.has(id)) continue;
      const look = lookOf(persona, entry.outfit);
      if (!look) continue;
      posts.push({
        id,
        authorId: personaId,
        date: D(entry.day),
        caption: entry.caption,
        scope: { kind: 'everyone' },
        look,
      });
    }
  }

  const conversations = [...prev.conversations];
  const messages: ChatMessage[] = [];
  const haveConversation = new Set(conversations.map(c => c.id));

  if (!haveConversation.has('c-group')) {
    conversations.push({
      id: 'c-group',
      name: 'The Rail',
      memberIds: personas.map(p => p.id),
      isGroup: true,
      about: 'Three wardrobes that lend to each other. What leaves comes back mended.',
    });
    GROUP_THREAD.forEach((line, i) => {
      const persona = byId.get(line.by);
      messages.push({
        id: `m-group-${i}`,
        conversationId: 'c-group',
        authorId: line.by,
        date: D(line.day),
        text: line.text,
        look: line.look && persona ? lookOf(persona, line.look) : undefined,
        request: line.request,
      });
    });
  }

  for (const thread of DIRECT_THREADS) {
    const id = `c-${[...thread.pair].sort().join('-')}`;
    if (haveConversation.has(id)) continue;
    conversations.push({ id, memberIds: [...thread.pair], isGroup: false });
    thread.lines.forEach((line, i) => {
      const persona = byId.get(line.by);
      messages.push({
        id: `m-${id}-${i}`,
        conversationId: id,
        authorId: line.by,
        date: D(line.day),
        text: line.text,
        look: line.look && persona ? lookOf(persona, line.look) : undefined,
      });
    });
  }

  /* ---------- the households ----------
     The three sample wardrobes live in overlapping rooms, which is the point:
     Vikram is in all three — partners with Meher, housemates with Aarav from
     the Indiranagar flat years, and Aarav's cousin. Meher carries one
     invitation still waiting for her yes, so the Join flow has something real
     to show, and one hand-me-down sits mid-air in her tray. */
  const households = [...prev.households];
  const haveHousehold = new Set(households.map(h => h.id));
  const seedHouseholds: Household[] = [
    {
      id: 'h-partners',
      kind: 'partners',
      members: [
        { accountId: 'vikram', joined: D(-200) },
        { accountId: 'meher', joined: D(-200) },
      ],
    },
    {
      id: 'h-flat',
      name: 'The Indiranagar flat',
      kind: 'roommates',
      members: [
        { accountId: 'aarav', joined: D(-400) },
        { accountId: 'vikram', joined: D(-400) },
      ],
    },
    {
      id: 'h-cousins',
      name: 'Menon-Sethi',
      kind: 'family',
      members: [
        { accountId: 'vikram', joined: D(-300) },
        { accountId: 'aarav', joined: D(-300) },
        { accountId: 'meher' }, // invited, not yet joined
      ],
    },
  ];
  for (const h of seedHouseholds) if (!haveHousehold.has(h.id)) households.push(h);

  const passes = [...prev.passes];
  if (!passes.some(p => p.id === 'pass-kantha')) {
    const aarav = byId.get('aarav');
    const piece = aarav?.items.find(i => /kantha|kurta|jacket/i.test(i.name)) ?? aarav?.items[0];
    if (piece) {
      passes.push({
        id: 'pass-kantha',
        fromId: 'aarav',
        toId: 'meher',
        piece: {
          itemId: piece.id,
          name: piece.name,
          imageUrl: '',
          category: piece.category,
          color: piece.color,
        },
        provenance: { from: 'Aarav', wearsInTheirRecord: 12, passedOn: D(-2) },
        status: 'offered',
      });
    }
  }

  return {
    // Spread first: the take-down tombstones and the private save marks ride
    // the same blob, and a reseed must not drop what it does not write.
    ...prev,
    posts: [...prev.posts, ...posts].sort((a, b) => b.date.localeCompare(a.date)),
    conversations,
    messages: [...prev.messages, ...messages].sort((a, b) => a.date.localeCompare(b.date)),
    households,
    passes,
  };
}


/* ---------- merging two copies of the store ----------
   Two tabs share one localStorage key, and the storage event used to REPLACE
   this tab's state with the other tab's blob — so two tabs that each wrote
   something quietly erased each other's posts and messages.

   The merge is a union by id, per entity: a row only one side has survives;
   a row both sides have is won by the newer activity stamp (`at`, then
   `date`), and a true tie goes to the incoming copy, which is the more recent
   write to storage. Tombstones and save marks union, and a tombstone beats
   the post it names — a take-down in either tab is a take-down.

   Deliberately a client store, not a CRDT: conversations, households and
   passes carry no clock, so a same-id conflict there goes to the latest
   write, and an entity REMOVED on one side can resurface from a stale tab
   (only posts have tombstones). Both are accepted costs of keeping this
   readable; the high-frequency rows — posts and messages — merge exactly. */

type Clocked = { id: string; at?: string; date?: string };

function pickEntity<T extends Clocked>(local: T, incoming: T): T {
  const a = local.at ?? local.date ?? '';
  const b = incoming.at ?? incoming.date ?? '';
  if (b !== a) return b > a ? incoming : local;
  // Identical rows keep the local reference, so a no-op merge returns the
  // same object — the storage listener depends on that to not ping-pong.
  return JSON.stringify(local) === JSON.stringify(incoming) ? local : incoming;
}

/** Union by id: local order kept, incoming-only rows appended in their order. */
function mergeById<T extends Clocked>(local: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return local;
  const index = new Map(local.map((x, i) => [x.id, i]));
  const list = [...local];
  let changed = false;
  for (const inc of incoming) {
    const i = index.get(inc.id);
    if (i === undefined) {
      list.push(inc);
      changed = true;
    } else {
      const chosen = pickEntity(list[i], inc);
      if (chosen !== list[i]) {
        list[i] = chosen;
        changed = true;
      }
    }
  }
  return changed ? list : local;
}

/**
 * A stored blob written before tombstones and save marks existed carries
 * neither key, and `loadCommunity` (accounts.ts) rebuilds only the five
 * original lists — so every read is funnelled through here to default the
 * two newer ones. Without it a take-down would resurrect on the next reload.
 */
export function normalizeCommunity(state: CommunityState): CommunityState {
  return {
    ...state,
    removedPostIds: Array.isArray(state.removedPostIds) ? state.removedPostIds : [],
    savedPostIds: Array.isArray(state.savedPostIds) ? state.savedPostIds : [],
  };
}

export function mergeCommunity(local: CommunityState, incoming: CommunityState): CommunityState {
  const removedPostIds = [...new Set([...(local.removedPostIds ?? []), ...(incoming.removedPostIds ?? [])])];
  const savedPostIds = [...new Set([...(local.savedPostIds ?? []), ...(incoming.savedPostIds ?? [])])];
  const gone = new Set(removedPostIds);
  const mergedPosts = mergeById(local.posts, incoming.posts);
  const posts = mergedPosts.filter(p => !gone.has(p.id));
  const messages = mergeById(local.messages, incoming.messages);
  const conversations = mergeById(local.conversations, incoming.conversations);
  const households = mergeById(local.households, incoming.households);
  const passes = mergeById(local.passes, incoming.passes);
  const unchanged =
    mergedPosts === local.posts &&
    posts.length === mergedPosts.length &&
    messages === local.messages &&
    conversations === local.conversations &&
    households === local.households &&
    passes === local.passes &&
    removedPostIds.length === (local.removedPostIds ?? []).length &&
    savedPostIds.length === (local.savedPostIds ?? []).length;
  if (unchanged) return local;
  return { posts, conversations, messages, households, passes, removedPostIds, savedPostIds };
}
