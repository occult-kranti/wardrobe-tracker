import type { CommunityState, FeedPost, ChatMessage, SharedLook } from '../types';
import type { PersonaSeed } from './personaData';
import { todayLocal, addDays } from './dates';

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

function lookOf(persona: PersonaSeed, outfitId: string): SharedLook | undefined {
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

  const posts: FeedPost[] = [];
  for (const [personaId, entries] of Object.entries(SHARED)) {
    const persona = byId.get(personaId);
    if (!persona) continue;
    for (const entry of entries) {
      const id = `post-${personaId}-${entry.outfit}`;
      if (known.has(id)) continue;
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

  return {
    posts: [...prev.posts, ...posts].sort((a, b) => b.date.localeCompare(a.date)),
    conversations,
    messages: [...prev.messages, ...messages].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
