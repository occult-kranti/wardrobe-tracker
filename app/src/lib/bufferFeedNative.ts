/**
 * THE COMMONS, NATIVE EDITION — a small bundled subset of the web's commons
 * buffer (src/lib/bufferFeed.ts, mirrored by reading; docs/40 §1.5 and the
 * docs/35 owner decisions govern both).
 *
 * Ground rules, unchanged from the web:
 *  · LOCAL FOREVER. The photographs are Metro static assets, bundled at build
 *    time — no runtime request ever leaves the phone.
 *  · EVERY ENTRY IS A SAMPLE AND SAYS SO. The guests are labelled on every
 *    surface a commons byte reaches; they never pretend to be a wardrobe.
 *  · NO METRICS. A guest grows no counts, no ranking, no social proof.
 *  · GUESTS KEEP THE RAIL COMPANY, nothing more: on this app the commons
 *    appears only as the "Guests" story deck — never as a feed card.
 *
 * THE SUBSET: twelve stills, ~153KB total against the 400KB bundle cap the
 * build plan sets — the twelve lightest re-encodes of the web's 45. The two
 * short films stayed behind on purpose: playing them needs expo-video, a new
 * dependency, which is an owner decision (Expo Go path).
 *
 * CREDITS CARried from public/feed-buffer/CREDITS.md — all CC0, attribution
 * shipped anyway; manners. The full ledger with source links stays in that
 * file at the repo root; each entry here names its photographer.
 */
import type { ImageSourcePropType } from 'react-native';

export interface NativeBufferEntry {
  /** 'commons-<slug>' — the web's own ids, never colliding with a post id. */
  id: string;
  /** A Metro static asset — RN's Image renders it offline, always. */
  source: ImageSourcePropType;
  /** The house voice, addressed to the guest — calm, factual, no verdicts. */
  caption: string;
  /** Who made the photograph. Rendered quietly beside the commons label. */
  author: string;
  /** Every commons entry is a sample, and the type says it cannot not be. */
  sample: true;
}

const entry = (
  slug: string,
  source: ImageSourcePropType,
  caption: string,
  author: string
): NativeBufferEntry => ({ id: `commons-${slug}`, source, caption, author, sample: true });

/** The captions and authors are the web's own lines, verbatim. */
export const BUFFER_FEED_NATIVE: NativeBufferEntry[] = [
  entry('kitten-with-lure-toy', require('../assets/commons/kitten-with-lure-toy.webp'), 'A kitten, taking the lure seriously.', 'D Coetzee'),
  entry('red-panda', require('../assets/commons/red-panda.webp'), 'A red panda, folded into the branch.', 'Mathias Appel'),
  entry('hedgehog', require('../assets/commons/hedgehog.webp'), 'A hedgehog, out on its rounds.', 'Thad Zajdowicz'),
  entry('bunny-rabbit-portrait', require('../assets/commons/bunny-rabbit-portrait.webp'), 'A rabbit, sitting for its portrait.', 'Ryan McGuire'),
  entry('king-penguin', require('../assets/commons/king-penguin.webp'), 'A king penguin, dressed for the occasion.', 'Bernard Spragg'),
  entry('penguin', require('../assets/commons/penguin.webp'), 'A penguin, unhurried.', 'code84'),
  entry('tulip', require('../assets/commons/tulip.webp'), 'One tulip, standing straight.', 'Bernard Spragg'),
  entry('yellow-tulips', require('../assets/commons/yellow-tulips.webp'), 'Yellow tulips, all facing the light.', 'Bernard Spragg'),
  entry('sunflower', require('../assets/commons/sunflower.webp'), 'A sunflower, holding the afternoon.', 'ahlea'),
  entry('roses', require('../assets/commons/roses.webp'), 'Roses, gathered close.', 'Josh Felise'),
  entry('kidney-fern', require('../assets/commons/kidney-fern.webp'), 'Kidney ferns, catching what light there is.', 'Bernard Spragg'),
  entry('orchid-and-light', require('../assets/commons/orchid-and-light.webp'), 'An orchid, leaning into the light.', 'romainguy'),
];

/** The two words every commons surface carries. Lowercase; the ledger's style shouts. */
export const COMMONS_LABEL = 'from the commons';

/**
 * Deterministic hash → [0, 1) — the same FNV/mulberry construction the web's
 * bufferFeed.ts states (itself restated from feedEngine for the same reason:
 * this module stays dependency-free).
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
 * The guests' story deck for one day: a deterministic slice, rotated by date —
 * the same day always deals the same hand, tomorrow deals a different one.
 * Pure; nothing is written, nothing expires. Mirrors commonsStoriesFor over
 * the bundled subset.
 */
export function commonsStoriesFor(date: string, count = 5): NativeBufferEntry[] {
  if (BUFFER_FEED_NATIVE.length === 0) return [];
  const n = Math.min(count, BUFFER_FEED_NATIVE.length);
  const start = Math.floor(rand('commons-stories', date) * BUFFER_FEED_NATIVE.length);
  const deck: NativeBufferEntry[] = [];
  for (let i = 0; i < n; i++) {
    deck.push(BUFFER_FEED_NATIVE[(start + i) % BUFFER_FEED_NATIVE.length]);
  }
  return deck;
}
