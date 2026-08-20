/**
 * THE COMMONS BUFFER — bundled CC0 photographs (and two short films) of
 * animals and plants, shipped so a young feed is never an empty room.
 *
 * Ground rules, from docs/40 §1.5 and the owner decisions of docs/35:
 *
 *  · LOCAL FOREVER. Files live in public/feed-buffer/ and are referenced by
 *    relative path (the build's base is './'), never hotlinked — a runtime
 *    request to a third-party host is a usage beacon, and the offline-first
 *    assertion must keep holding. Credits ship in
 *    public/feed-buffer/CREDITS.md (CC0 needs none; house manners say so).
 *  · EVERY ENTRY IS A SAMPLE AND SAYS SO. The house addresses the clothes;
 *    these guests are not clothes and never pretend to be a wardrobe. Every
 *    surface a commons byte reaches carries the label.
 *  · INTERLUDES, NEVER FILLER. On the Explore grid the commons is capped at
 *    one card in six, never two non-real cards adjacent while real cards
 *    remain, and it is never paginated to simulate abundance.
 *  · NO METRICS. A guest grows no counts, no ranking, no social proof.
 *
 * This module is framework-free on purpose: the node test suite
 * (scripts/test-feed.mjs) imports it directly, and the native app can read
 * the same record when its screens land.
 */

export interface BufferEntry {
  /** 'commons-<slug>' — never colliding with a post id. */
  id: string;
  /** Relative path under public/, e.g. 'feed-buffer/red-panda.webp'. */
  path: string;
  kind: 'image' | 'video';
  /** The house voice, addressed to the guest — calm, factual, no verdicts. */
  caption: string;
  /** Who made the photograph. Rendered quietly beside the commons label. */
  author: string;
  /** Every commons entry is a sample, and the type says it cannot not be. */
  sample: true;
}

const entry = (
  slug: string,
  kind: 'image' | 'video',
  caption: string,
  author: string
): BufferEntry => ({
  id: `commons-${slug}`,
  path: `feed-buffer/${slug}.${kind === 'video' ? 'webm' : 'webp'}`,
  kind,
  caption,
  author,
  sample: true,
});

/** The whole commons, in the researcher's verified order. All CC0. */
export const BUFFER_FEED: BufferEntry[] = [
  entry('three-innocent-kittens', 'image', 'Three kittens, between naps.', 'iDapinder'),
  entry('mother-cat-and-kitten', 'image', 'A mother cat and her kitten, sitting the afternoon out.', 'D Coetzee'),
  entry('kitten-with-lure-toy', 'image', 'A kitten, taking the lure seriously.', 'D Coetzee'),
  entry('wild-puppy', 'image', 'A puppy, mid-thought.', 'Philippe Vieux-Jeanton'),
  entry('cute-puppies', 'image', 'Two puppies, sharing one patch of sun.', 'Dailypuppies'),
  entry('red-panda', 'image', 'A red panda, folded into the branch.', 'Mathias Appel'),
  entry('small-clawed-otter', 'image', 'An otter, paused mid-errand.', 'Mathias Appel'),
  entry('small-clawed-otters', 'image', 'Otters, holding the meeting standing up.', 'Mathias Appel'),
  entry('european-otter', 'image', 'A European otter, keeping its own counsel.', 'Mathias Appel'),
  entry('ducklings', 'image', 'Ducklings, single file.', 'cecilysdiary'),
  entry('hedgehogs-in-the-ivy', 'image', 'Hedgehogs, at home in the ivy.', 'Other dreams'),
  entry('hedgehog', 'image', 'A hedgehog, out on its rounds.', 'Thad Zajdowicz'),
  entry('bunny-rabbit', 'image', 'A rabbit, ears up.', 'Toby Gray'),
  entry('bunny-rabbit-portrait', 'image', 'A rabbit, sitting for its portrait.', 'Ryan McGuire'),
  entry('squirrel', 'image', 'A squirrel, holding lunch.', 'Bernard Spragg'),
  entry('squirrel-at-sunrise', 'image', 'A squirrel drinking at sunrise, by the river.', 'TonySprezzatura'),
  entry('king-penguin', 'image', 'A king penguin, dressed for the occasion.', 'Bernard Spragg'),
  entry('penguin', 'image', 'A penguin, unhurried.', 'code84'),
  entry('hamster-in-a-chair', 'image', 'A hamster, in a chair its own size.', "Lottie's pets & stuff"),
  entry('wild-hamster', 'image', 'A wild hamster, out among the stems.', "Lottie's pets & stuff"),
  entry('white-tailed-fawn', 'image', 'A fawn, folded into the grass.', 'usdoe'),
  entry('fawn-in-the-grass', 'image', 'A fawn, working the morning out for itself.', 'retewphoto'),
  entry('barred-owl', 'image', 'A barred owl, keeping watch.', 'U.S. Geological Survey'),
  entry('eurasian-eagle-owl', 'image', 'An eagle-owl, unimpressed.', 'Mathias Appel'),
  entry('koala', 'image', 'A koala, settled in.', 'Mathias Appel'),
  entry('koala-family', 'image', 'A koala family, arranged on one branch.', 'Mathias Appel'),
  entry('merino-lamb', 'image', "A merino lamb, wearing next year's coat.", 'Bernard Spragg'),
  entry('sleeping-red-fox', 'image', 'A red fox, asleep with its tail for a scarf.', 'UnseenGhost'),
  entry('monstera-plant', 'image', 'A monstera, unfolding at its own pace.', 'rawpixel'),
  entry('succulent-rosette', 'image', 'A succulent, symmetrical to a fault.', 'D Coetzee'),
  entry('succulents-in-glass', 'image', 'Succulents in a glass bowl, keeping close quarters.', 'Image Catalog'),
  entry('tulip', 'image', 'One tulip, standing straight.', 'Bernard Spragg'),
  entry('yellow-tulips', 'image', 'Yellow tulips, all facing the light.', 'Bernard Spragg'),
  entry('sunflower-dreams', 'image', 'A sunflower, backlit.', 'Don Komarechka'),
  entry('sunflower', 'image', 'A sunflower, holding the afternoon.', 'ahlea'),
  entry('rose-flower', 'image', 'A rose, mid-bloom.', 'leslie emile'),
  entry('roses', 'image', 'Roses, gathered close.', 'Josh Felise'),
  entry('blechnum-fern', 'image', 'A blechnum fern, unrolling.', 'Bernard Spragg'),
  entry('kidney-fern', 'image', 'Kidney ferns, catching what light there is.', 'Bernard Spragg'),
  entry('orchid-and-light', 'image', 'An orchid, leaning into the light.', 'romainguy'),
  entry('lavender-field', 'image', 'A lavender field, holding its colour to the horizon.', 'Ghost Presenter'),
  entry('lavender-field-rows', 'image', 'Lavender, in rows.', 'Andrew Ridley'),
  entry('monstera-leaf', 'image', 'A monstera leaf, cut out like a pattern piece.', 'Tawhid Sadman'),
  entry('cat-on-a-ledge', 'video', 'Sophy the cat, very high on a ledge and fine about it.', 'PseudoSkull'),
  entry('tomcat-calling', 'video', 'A tomcat, saying so.', 'Drummyfish'),
];

/** The two words every commons surface carries. Lowercase; the ledger's CSS shouts. */
export const COMMONS_LABEL = 'from the commons';

/**
 * Deterministic hash → [0, 1). Same FNV/mulberry family as feedEngine's rand;
 * reimplemented rather than imported so this module stays dependency-free for
 * the node suite and the native app.
 */
function rand(...parts: Array<string | number>): number {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The guests' story deck for one day: a deterministic slice of the commons,
 * rotated by date so the same day always deals the same hand and tomorrow
 * deals a different one. Pure — nothing is written, nothing expires.
 */
export function commonsStoriesFor(date: string, count = 5): BufferEntry[] {
  if (BUFFER_FEED.length === 0) return [];
  const n = Math.min(count, BUFFER_FEED.length);
  const start = Math.floor(rand('commons-stories', date) * BUFFER_FEED.length);
  const deck: BufferEntry[] = [];
  for (let i = 0; i < n; i++) {
    deck.push(BUFFER_FEED[(start + i) % BUFFER_FEED.length]);
  }
  return deck;
}

/**
 * Interleave commons interludes into a run of real cards: one guest after
 * every five real cards, and only while real cards remain — the ratio cap
 * (1-in-6) and the never-two-adjacent rule both fall out of the construction.
 * Fewer than five real cards means no interlude at all: the commons buffers a
 * young feed, it does not replace one.
 */
export function interleaveCommons<T>(
  real: T[],
  buffer: BufferEntry[],
  date: string
): Array<{ real: T } | { commons: BufferEntry }> {
  const out: Array<{ real: T } | { commons: BufferEntry }> = [];
  if (buffer.length === 0) return real.map(r => ({ real: r }));
  const start = Math.floor(rand('commons-interludes', date) * buffer.length);
  let dealt = 0;
  real.forEach((r, i) => {
    out.push({ real: r });
    // Between real cards only — never after the last one, so the grid ends
    // where the real record ends.
    if ((i + 1) % 5 === 0 && i + 1 < real.length && dealt < buffer.length) {
      out.push({ commons: buffer[(start + dealt) % buffer.length] });
      dealt++;
    }
  });
  return out;
}
