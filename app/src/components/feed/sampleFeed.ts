/**
 * The sample feed — what the Look Book shows before this wardrobe has put
 * anything of its own on show.
 *
 * MIRRORED from the web, never imported: the cast and every caption restate
 * src/lib/communitySeed.ts's SHARED table; each look snapshot restates the
 * named outfit in src/lib/personaData.ts (name, occasion, photograph path,
 * piece names). The account rows restate what SessionContext.installSamples
 * writes for the same three wardrobes — same ids, same handles, same
 * tag-colour tokens, `isSample: true` on every one. If the web seed changes,
 * this file changes in the same wave.
 *
 * TWO NATIVE-ALPHA DEVIATIONS, ON PURPOSE:
 *  - The cast is NOT written into the accounts registry. On the web the
 *    personas are installable wardrobes; here they are only the feed's sample
 *    content, and putting three sample rows in ACCOUNTS_KEY would hang three
 *    wardrobes nobody installed on the door. The resolver is handed these
 *    authors alongside the registry instead.
 *  - The photograph paths stay web-relative ('wardrobe/aarav/AM-01.webp'),
 *    exactly as the snapshots carry them. RN cannot resolve them — that is
 *    the asset seam (docs/34 §2.8) — so every sample card renders the
 *    typographic specimen fallback. ~55MB of persona photographs do not
 *    belong in an app bundle.
 *
 * The post ids are the web's own construction (`post-<personaId>-<outfit>`)
 * so a future merge with a web-written community blob stays idempotent by id.
 * Dates pin at seed time (addDays of the seed day), exactly as the web's
 * D(n) pins them at its seed time: a post is a dated statement, and after
 * the seed nothing rewrites it.
 */
import { addDays } from '@almari/shared/dates';
import type { Account, CommunityState, FeedPost } from '@almari/shared/types';

/** The cast — mirrors installSamples' rows (id/name/handle/city/monogram/colour). */
export const SAMPLE_AUTHORS: Account[] = [
  {
    id: 'aarav',
    name: 'Aarav Menon',
    handle: '@aarav',
    city: 'Bengaluru (Koramangala)',
    monogram: 'AM',
    color: 'var(--color-accent)',
    createdAt: '2026-08-01',
    isSample: true,
  },
  {
    id: 'vikram',
    name: 'Vikram Sethi',
    handle: '@vikram',
    city: 'Mumbai (Malabar Hill)',
    monogram: 'VS',
    color: 'var(--color-success)',
    createdAt: '2026-08-01',
    isSample: true,
  },
  {
    id: 'meher',
    name: 'Meher Kapoor',
    handle: '@meher',
    city: 'New Delhi (Hauz Khas)',
    monogram: 'MK',
    color: 'var(--color-gold)',
    createdAt: '2026-08-01',
    isSample: true,
  },
];

/**
 * The web's SHARED table, restated with each look's snapshot resolved from
 * personaData (piece names in outfit order, occasion, photograph path).
 */
const SHARED: Array<{
  authorId: string;
  outfitId: string;
  day: number;
  caption?: string;
  name: string;
  occasion: string;
  imageUrl: string;
  pieces: string[];
}> = [
  {
    authorId: 'aarav', outfitId: 'AM-01', day: -3,
    caption: 'Wore the black suit with the ecru tee instead of a shirt. Held up all evening.',
    name: 'Gallery Opening Suit', occasion: 'Client dinner, design award night',
    imageUrl: 'wardrobe/aarav/AM-01.webp',
    pieces: ['Oversized oxford shirt', 'Unstructured blazer', 'Tailored wool trousers', 'Plain-toe derbies', 'Field watch', 'Leather belt', 'Silver chain + stud', 'Crew socks (3-pack)'],
  },
  {
    authorId: 'aarav', outfitId: 'AM-12', day: -9,
    caption: 'Monsoon build. Everything on me dries in twenty minutes.',
    name: 'Bengaluru Downpour', occasion: 'Commute in heavy monsoon rain',
    imageUrl: 'wardrobe/aarav/AM-12.webp',
    pieces: ['Heavyweight boxy tee', '3-layer rain shell', 'Ripstop cargo pants', 'Moulded rubber sandals', '20L daypack', 'Phone sling bag'],
  },
  {
    authorId: 'aarav', outfitId: 'AM-07', day: -21,
    caption: 'The bandhgala my father had made in 1994, taken in at the waist.',
    name: 'Sangeet Bandhgala', occasion: "College friend's sangeet, big fat Delhi wedding",
    imageUrl: 'wardrobe/aarav/AM-07.webp',
    pieces: ['Bandhgala jacket', 'Mulmul long kurta', 'Churidar', 'Plain-toe derbies', 'Silver chain + stud', 'Silk pocket square'],
  },
  {
    authorId: 'aarav', outfitId: 'AM-05', day: -31,
    name: 'Sneaker Drop Saturday', occasion: 'Record store + sneaker drop queue',
    imageUrl: 'wardrobe/aarav/AM-05.webp',
    pieces: ['Heavyweight boxy tee', 'Oversized hoodie', 'Relaxed straight jeans', 'Chunky trail runners', 'Bucket hat', 'Crew socks (3-pack)', 'Phone sling bag'],
  },
  {
    authorId: 'vikram', outfitId: 'VS-02', day: -5,
    caption: 'Client lunch, no tie. The knit polo does the collar’s work without the ceremony.',
    name: 'Client Lunch, No Tie', occasion: "Founder lunch at a members' club",
    imageUrl: 'wardrobe/vikram/VS-02.webp',
    pieces: ['Single-breasted blazer', 'Button-down oxford', 'Cavalry twill trousers', 'Penny loafers', 'Steel dress watch', 'Linen pocket square', 'Leather belt'],
  },
  {
    authorId: 'vikram', outfitId: 'VS-16', day: -14,
    caption: 'Navy after six, but the flannel keeps it from reading office.',
    name: 'Rooftop Bar, Soho House', occasion: "Friend's 45th at a members' club rooftop",
    imageUrl: 'wardrobe/vikram/VS-16.webp',
    pieces: ['Two-piece suit jacket', 'Cashmere crewneck', 'Suit trousers (navy)', 'Cap-toe oxfords', 'Steel dress watch', 'Silk pocket square', 'Leather belt'],
  },
  {
    authorId: 'vikram', outfitId: 'VS-01', day: -27,
    name: 'Board Meeting Navy', occasion: 'Quarterly board presentation',
    imageUrl: 'wardrobe/vikram/VS-01.webp',
    pieces: ['Two-piece suit jacket', 'Spread-collar poplin shirt', 'Suit trousers (navy)', 'Cap-toe oxfords', 'Leather briefcase', 'Steel dress watch', 'Grenadine tie', 'Linen pocket square', 'Leather belt'],
  },
  {
    authorId: 'meher', outfitId: 'MK-17', day: -2,
    caption: 'Oxblood, and one hand-block piece. The rule holds even at dinner.',
    name: 'Oxblood at Indian Accent', occasion: 'Anniversary-ish dinner, booked three weeks out',
    imageUrl: 'wardrobe/meher/MK-17.webp',
    pieces: ['Longline wool coat', 'Bias slip dress', 'Metallic strappy heels', 'Leather shoulder bag', 'Gold hoops'],
  },
  {
    authorId: 'meher', outfitId: 'MK-20', day: -8,
    caption: 'Nani’s chettinad saree with sneakers. She would have approved of the walking, not the shoes.',
    name: 'Triund Day Trek', occasion: 'Dharamshala weekend, day trek to Triund',
    imageUrl: 'wardrobe/meher/MK-20.webp',
    pieces: ['Sleeveless turtleneck knit', 'Trek pants', 'Trail runners', 'Printed silk scarf', 'Canvas camera bag', 'Silk scrunchie'],
  },
  {
    authorId: 'meher', outfitId: 'MK-04', day: -16,
    caption: 'Sourcing day in Shahpur Jat. Pockets, flats, nothing white.',
    name: 'Sourcing Run', occasion: 'Fabric market sourcing, Shahpur Jat hop',
    imageUrl: 'wardrobe/meher/MK-04.webp',
    pieces: ['Fitted ribbed tank', 'Straight jeans', 'Leather sneakers', 'Gold hoops', 'Leather belt', 'Canvas camera bag'],
  },
  {
    authorId: 'meher', outfitId: 'MK-16', day: -24,
    name: 'Launch Party', occasion: 'Beauty-brand launch, stand-up crowd',
    imageUrl: 'wardrobe/meher/MK-16.webp',
    pieces: ['Bias slip dress', 'Metallic strappy heels', 'Leather shoulder bag', 'Oxidised choker', 'Printed silk scarf'],
  },
];

/** The posts the seed would write, dated against `today`. Pure. */
export function sampleFeedPosts(today: string): FeedPost[] {
  return SHARED.map(entry => ({
    id: `post-${entry.authorId}-${entry.outfitId}`,
    authorId: entry.authorId,
    date: addDays(today, entry.day),
    caption: entry.caption,
    scope: { kind: 'everyone' as const },
    look: {
      outfitId: entry.outfitId,
      name: entry.name,
      imageUrl: entry.imageUrl,
      occasion: entry.occasion,
      pieces: entry.pieces,
    },
  }));
}

/**
 * Merge the sample posts into the store — idempotent by id, and a tombstoned
 * id stays down (the same manners as the web's seedCommunity: a take-down is
 * a statement, not an absence, and a reseed must not resurrect it).
 * Returns `prev` unchanged when there is nothing to add.
 */
export function seedSampleFeed(prev: CommunityState, today: string): CommunityState {
  const known = new Set(prev.posts.map(p => p.id));
  const tombstoned = new Set(prev.removedPostIds ?? []);
  const additions = sampleFeedPosts(today).filter(
    p => !known.has(p.id) && !tombstoned.has(p.id)
  );
  if (additions.length === 0) return prev;
  return {
    ...prev,
    posts: [...prev.posts, ...additions].sort((a, b) => b.date.localeCompare(a.date)),
  };
}
