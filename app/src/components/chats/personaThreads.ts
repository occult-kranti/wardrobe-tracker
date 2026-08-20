/**
 * The sample threads, mirrored for the phone.
 *
 * SOURCE OF TRUTH, mirrored by reading and never by importing:
 * src/lib/communitySeed.ts (GROUP_THREAD, DIRECT_THREADS, seedCommunity's
 * conversation/message assembly — same ids, same words, same day offsets)
 * and src/context/SessionContext.tsx installSamples (the persona registry
 * rows: same ids, names, handles, monograms, colours, isSample flag).
 *
 * WHY A MIRROR AND NOT AN IMPORT: the web seed reaches into
 * src/lib/personaData.ts (6,000 generated lines) to snapshot the one look a
 * message carries. The snapshot IS the law here — a look rides a message as
 * a copy taken at share time — so the copy is written down once, verbatim,
 * with its source named. Because every id below is byte-identical to the
 * web's, a future sync or a fuller seed unions cleanly: the web's own
 * known-id checks (and mergeCommunity's union-by-id) treat these rows as
 * the same rows.
 *
 * THIS FILE SEEDS ONLY THE CHATS SLICE — conversations and messages. Posts,
 * households and passes belong to the feed's own wave; seeding them here
 * would put words in another squad's mouth.
 *
 * MEMBERSHIP IS THE WEB'S: these threads are between the sample wardrobes.
 * A wardrobe that is not in a thread does not see it — on the web too, your
 * own wardrobe reads these only if it IS one of the samples. What the
 * samples give this device is somebody to start a thread with.
 */
import { addDays, todayLocal } from '@almari/shared/dates';
import type { ChatMessage, CommunityState, Conversation, SharedLook } from '@almari/shared/types';

/** Days relative to today — the web seed's own D(). */
const D = (n: number) => addDays(todayLocal(), n);

/**
 * PERSONA_SEED_VERSION, transcribed from src/lib/personaWardrobe.ts. Only
 * the registry rows carry it; the phone never rebuilds persona wardrobes,
 * so a drift here is inert — but the number travels so the rows say which
 * build wrote them.
 */
export const PERSONA_SEED_VERSION = 10;

/** A registry row, shaped as the web's Account. */
export interface PersonaRow {
  id: string;
  name: string;
  handle: string;
  city?: string;
  tagline?: string;
  monogram: string;
  color: string;
  isSample: true;
  seedVersion: number;
}

/**
 * The four sample wardrobes, as installSamples writes them: monograms via
 * monogramFor(name), colours walked in ACCOUNT_COLORS order (token names,
 * resolved to theme values at render — never a raw hex at a call site).
 * Taglines are philosophy[0]; the three generated personas ship an empty
 * philosophy, so only the authored wardrobe carries one.
 */
export const PERSONA_ROWS: PersonaRow[] = [
  {
    id: 'aarav',
    name: 'Aarav Menon',
    handle: '@aarav',
    city: 'Bengaluru (Koramangala)',
    monogram: 'AM',
    color: 'var(--color-accent)',
    isSample: true,
    seedVersion: PERSONA_SEED_VERSION,
  },
  {
    id: 'vikram',
    name: 'Vikram Sethi',
    handle: '@vikram',
    city: 'Mumbai (Malabar Hill)',
    monogram: 'VS',
    color: 'var(--color-success)',
    isSample: true,
    seedVersion: PERSONA_SEED_VERSION,
  },
  {
    id: 'meher',
    name: 'Meher Kapoor',
    handle: '@meher',
    city: 'New Delhi (Hauz Khas)',
    monogram: 'MK',
    color: 'var(--color-gold)',
    isSample: true,
    seedVersion: PERSONA_SEED_VERSION,
  },
  {
    id: 'cofounder',
    name: 'Hruday',
    handle: '@hruday_mehta',
    city: 'New Delhi, when not on the road',
    tagline:
      'The idea: the person building this app. An artist with one foot in the wedding season and one in the studio, who dresses for a chalkboard with the same ceremony as a sangeet.',
    monogram: 'H',
    color: 'var(--color-warning)',
    isSample: true,
    seedVersion: PERSONA_SEED_VERSION,
  },
];

/**
 * lookOf(meher, 'MK-19'), written out — the snapshot the two seeded messages
 * carry, resolved from src/lib/personaData.ts (outfit MK-19 and its pieces
 * MK-T08/B02/F05/A07/A10). The imageUrl is the web's relative path; the
 * phone renders the flat mat when a path is not a real URI (the asset seam
 * docs/34 §2.8 names — native must bundle assets, and does not yet).
 */
const LOOK_MK19: SharedLook = {
  outfitId: 'MK-19',
  name: 'Condolence Call',
  imageUrl: 'wardrobe/meher/MK-19.webp',
  occasion: "Family friend's prayer meeting",
  pieces: [
    'Chikankari kurta',
    'Pleated trousers',
    'Kolhapuri flats',
    'Pearl studs',
    'Pashmina shawl',
  ],
};

/** The group thread — communitySeed.ts GROUP_THREAD, verbatim. */
const GROUP_THREAD: Array<{
  by: string;
  day: number;
  text: string;
  look?: SharedLook;
  request?: NonNullable<ChatMessage['request']>;
}> = [
  { by: 'meher', day: -12, text: 'Three weddings in Delhi next month and I am short one evening look. Opening the floor.' },
  { by: 'meher', day: -12, text: 'Vikram — could I ask after the ivory bandhgala for the second one?', request: { pieceName: 'Bandhgala, ivory raw silk', status: 'lent', ownerId: 'vikram' } },
  { by: 'vikram', day: -12, text: 'Yours if the shoulders work. It has done four weddings and wants a fifth.' },
  { by: 'aarav', day: -11, text: 'Take the pocket square with it. They were made from the same bolt.' },
  { by: 'meher', day: -10, text: 'Wearing it to the sangeet. Photographs going straight to this thread.', look: LOOK_MK19 },
  { by: 'aarav', day: -6, text: 'Goa in a fortnight — Vikram, is one of the linen shirts free?', request: { pieceName: 'Linen shirt, sand', status: 'asked', ownerId: 'vikram' } },
  { by: 'aarav', day: -5, text: 'Meher, and the marigold kurta for the Sunday, if it is not out?', request: { pieceName: 'Marigold kurta', status: 'declined', ownerId: 'meher' } },
  { by: 'meher', day: -4, text: 'That one is in three shoots this month. Everything else is open.' },
  { by: 'meher', day: -2, text: 'The bandhgala is home, pressed, with the pocket square folded inside it.', request: { pieceName: 'Bandhgala, ivory raw silk', status: 'returned', ownerId: 'vikram' } },
];

/** One direct thread per pair — communitySeed.ts DIRECT_THREADS, verbatim. */
const DIRECT_THREADS: Array<{
  pair: [string, string];
  lines: Array<{ by: string; day: number; text: string; look?: SharedLook }>;
}> = [
  {
    pair: ['meher', 'vikram'],
    lines: [
      { by: 'meher', day: -13, text: 'Measurements for the bandhgala before I promise it to anyone else?' },
      { by: 'vikram', day: -13, text: 'Shoulder 46, chest 104, sleeve 63. It runs generous through the body.' },
      { by: 'meher', day: -12, text: 'That works belted. Sending the look I have in mind.', look: LOOK_MK19 },
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

/**
 * Seed the chats slice — idempotent, exactly as the web's seedCommunity:
 * a conversation id already present is left alone with all its messages,
 * so a reseed never duplicates and a thread somebody has written into is
 * never overwritten. Everything else in the blob rides through untouched.
 */
export function seedChatThreads(prev: CommunityState): CommunityState {
  const conversations: Conversation[] = [...prev.conversations];
  const messages: ChatMessage[] = [];
  const haveConversation = new Set(conversations.map(c => c.id));

  if (!haveConversation.has('c-group')) {
    conversations.push({
      id: 'c-group',
      name: 'The Rail',
      memberIds: PERSONA_ROWS.map(p => p.id),
      isGroup: true,
      about: 'Three wardrobes that lend to each other. What leaves comes back mended.',
    });
    GROUP_THREAD.forEach((line, i) => {
      messages.push({
        id: `m-group-${i}`,
        conversationId: 'c-group',
        authorId: line.by,
        date: D(line.day),
        text: line.text,
        look: line.look,
        request: line.request,
      });
    });
  }

  for (const thread of DIRECT_THREADS) {
    const id = `c-${[...thread.pair].sort().join('-')}`;
    if (haveConversation.has(id)) continue;
    conversations.push({ id, memberIds: [...thread.pair], isGroup: false });
    thread.lines.forEach((line, i) => {
      messages.push({
        id: `m-${id}-${i}`,
        conversationId: id,
        authorId: line.by,
        date: D(line.day),
        text: line.text,
        look: line.look,
      });
    });
  }

  if (messages.length === 0 && conversations.length === prev.conversations.length) return prev;

  return {
    ...prev,
    conversations,
    // The web seed's own sort: by day, oldest first.
    messages: [...prev.messages, ...messages].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
