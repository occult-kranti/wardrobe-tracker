import { addDays, formatLocalDate } from '@almari/shared/dates';
import { lookOf } from './communitySeed';
import type { CommunityState, FeedPost } from '@almari/shared/types';
import type { PersonaOutfitSeed, PersonaSeed } from './personaData';

/**
 * THE LIVING FEED — the personas' half of the shared store.
 *
 * A wardrobe that never posts is a storefront, not a neighbour. This derives
 * what each INSTALLED sample wardrobe has put on show, day by day, from the
 * persona's own data: the outfits it owns (their images, occasions, seasons),
 * the week it actually wore them, and nothing else. Every choice is seeded by
 * the same FNV/mulberry hash personaWardrobe uses, so the same persona on the
 * same day produces the same schedule — a post is a dated statement, and a
 * reload must not rewrite history.
 *
 * Ids are `feed-<personaId>-<date>`: deterministic, so the boot merge is
 * idempotent by id, and a take-down tombstone names exactly one post.
 *
 * Nothing here is generic over a hardcoded cast — every rule reads the persona
 * it is given, so an eleventh wardrobe starts posting the day it exists.
 */

/** Deterministic 0..1. Same construction as personaWardrobe's `rand`. */
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

/** How far back a wardrobe's schedule runs. */
export const SCHEDULE_DAYS = 21;
/** Schedule posts older than this are pruned at boot, so the store does not grow forever. */
export const PRUNE_DAYS = 30;

const SEASON_BY_MONTH = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'fall', 'fall', 'fall', 'winter',
] as const;

/**
 * The seed's season words are free text — 'festive autumn', 'monsoon', 'all'.
 * An outfit suits the month when its season text contains the season word
 * ('autumn' is fall here) or declares itself year-round.
 */
function seasonFits(outfitSeason: string, season: string): boolean {
  const s = outfitSeason.toLowerCase();
  if (s === 'all') return true;
  if (season === 'fall') return /\bfall\b|\bautumn\b/.test(s);
  return new RegExp(`\\b${season}\\b`).test(s);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * This week's dates by weekday name, Monday-first — the same laying rule
 * buildPersonaState uses for the authored week, so "wore it Tuesday" names
 * the same date here that the wear log does.
 */
function thisWeekByWeekday(today: string): Map<string, string> {
  const now = new Date(`${today}T00:00:00`);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const map = new Map<string, string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    map.set(WEEKDAYS[(i + 1) % 7], formatLocalDate(d));
  }
  return map;
}

/**
 * The outfits the persona's own week has them wearing on `date`. Only this
 * week can answer — a 14-day calendar's second pass is next week, and older
 * days fall back to the seasonal pick. Note the honest consequence: at a week
 * boundary the signal for an older day goes quiet, so the same date can score
 * a different outfit than it did last Sunday. The store's idempotent merge
 * pins whatever was computed first; a dated statement does not rewrite.
 */
function wornThatDay(persona: PersonaSeed, date: string, week: Map<string, string>): PersonaOutfitSeed[] {
  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const day of persona.calendar) {
    const name = day.label.split('(')[0].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    if (week.get(name) === date) for (const id of day.outfits) ids.add(id);
  }
  return persona.outfits.filter(o => ids.has(o.id));
}

/** Sleepwear and gym kit are never shown, for the same reason events never
    reserve them — some looks stay home even from a rail of friends. */
const STAYS_HOME = /sleep|pilates|leg day|gym|run\b/i;

function pickOutfit(
  persona: PersonaSeed,
  date: string,
  week: Map<string, string>,
): PersonaOutfitSeed | undefined {
  const viable = persona.outfits.filter(o => o.itemIds.length > 1 && !STAYS_HOME.test(`${o.name} ${o.category}`));
  if (viable.length === 0) return undefined;
  const worn = wornThatDay(persona, date, week).filter(o => viable.includes(o));
  const pool = worn.length > 0 ? worn : viable;
  const season = SEASON_BY_MONTH[Number(date.slice(5, 7)) - 1];
  // Worn that day outweighs suits the season outweighs has a photograph —
  // the recent-rotation signal is the truest thing the seed knows.
  const weighted = pool.map(o => ({
    o,
    w: 1 + (seasonFits(o.season, season) ? 1 : 0) + (o.image ? 1 : 0) + (worn.includes(o) ? 2 : 0),
  }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let r = rand(persona.id, 'pick', date) * total;
  let chosen = weighted[weighted.length - 1];
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) { chosen = x; break; }
  }
  return chosen?.o;
}

/* ---------- the captions ----------
   Pattern-room diction: short, cloth-first, dry. The caption addresses the
   clothes and what they did — never the wearer, never a body, and the whole
   bank holds the house's exclamation budget at zero by containing none. */

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface CaptionCtx {
  name: string;
  occasion?: string;
  season: string;
  piece?: string;
  piece2?: string;
  worn: boolean;
}

const CAPTIONS: Array<{ when: (c: CaptionCtx) => boolean; line: (c: CaptionCtx) => string }> = [
  { when: c => !!c.occasion && !!c.piece,
    line: c => `${capFirst(c.occasion!)}. The ${c.piece} carried it.` },
  { when: c => !!c.piece && !!c.piece2,
    line: c => `${capFirst(c.piece!)} with the ${c.piece2}. Nothing else asked to come.` },
  { when: c => !!c.occasion && c.worn,
    line: c => `Worn to ${c.occasion}, and none the worse for it.` },
  { when: c => !!c.occasion,
    line: c => `${capFirst(c.occasion!)}. ${c.name}, pressed the night before.` },
  { when: c => !!c.piece,
    line: c => `The ${c.piece} again. Some weeks it is the answer.` },
  { when: c => !!c.piece,
    line: c => `${capFirst(c.piece!)}, earning its hanger this ${c.season.toLowerCase()}.` },
  { when: c => !!c.occasion,
    line: c => `${c.name} for ${c.occasion}. It held up all evening.` },
  { when: c => !!c.piece && !!c.piece2,
    line: c => `The ${c.piece} does the talking. The ${c.piece2} keeps quiet.` },
  { when: () => true,
    line: c => `${c.name}. Out all day, and right for it.` },
];

function captionFor(persona: PersonaSeed, outfit: PersonaOutfitSeed, date: string, pieces: string[]): string {
  // Long occasion phrases take their first clause; a caption quotes the day,
  // not the whole invitation.
  const raw = (outfit.occasion ?? '').split(',')[0].trim();
  const occasion = raw.length > 0 && raw.length <= 40 ? lcFirst(raw) : undefined;
  const pick = (salt: string) =>
    pieces.length > 0 ? pieces[Math.floor(rand(persona.id, salt, date) * pieces.length)] : undefined;
  const first = pick('p1');
  const rest = pieces.filter(p => p !== first);
  const second = rest.length > 0
    ? rest[Math.floor(rand(persona.id, 'p2', date) * rest.length)]
    : undefined;
  const ctx: CaptionCtx = {
    name: outfit.name,
    occasion,
    season: SEASON_BY_MONTH[Number(date.slice(5, 7)) - 1],
    piece: first ? lcFirst(first) : undefined,
    piece2: second ? lcFirst(second) : undefined,
    worn: wornThatDay(persona, date, thisWeekByWeekday(date)).includes(outfit),
  };
  const eligible = CAPTIONS.filter(t => t.when(ctx));
  return eligible[Math.floor(rand(persona.id, 'cap', date) * eligible.length)].line(ctx);
}

/**
 * The posts one persona would have made over the last SCHEDULE_DAYS, ending
 * today. Pure and deterministic: same persona, same today, same schedule.
 */
export function personaSchedule(persona: PersonaSeed, today: string): FeedPost[] {
  const posts: FeedPost[] = [];
  const week = thisWeekByWeekday(today);
  // Each wardrobe keeps its own cadence — roughly every second to fourth day.
  const pace = 0.28 + rand(persona.id, 'pace') * 0.27;
  for (let back = SCHEDULE_DAYS - 1; back >= 0; back--) {
    const date = addDays(today, -back);
    if (rand(persona.id, 'feed', date) >= pace) continue;
    const outfit = pickOutfit(persona, date, week);
    if (!outfit) continue;
    const look = lookOf(persona, outfit.id);
    if (!look) continue;
    // A deterministic evening hour, so same-day posts interleave by the clock
    // rather than by id. Display never shows it — dates stay day-granular.
    const hour = 17 + Math.floor(rand(persona.id, 'hour', date) * 6);
    posts.push({
      id: scheduleId(persona.id, date),
      authorId: persona.id,
      date,
      at: `${date}T${String(hour).padStart(2, '0')}:00:00`,
      caption: captionFor(persona, outfit, date, look.pieces ?? []),
      scope: { kind: 'everyone' },
      look,
    });
  }
  return posts;
}

export const scheduleId = (personaId: string, date: string) => `feed-${personaId}-${date}`;
export const isScheduleId = (id: string) => id.startsWith('feed-');

/** The date a schedule id names, when it names one — the id's last ten chars. */
function scheduleIdDate(id: string): string | null {
  const tail = id.slice(-10);
  return /^\d{4}-\d{2}-\d{2}$/.test(tail) ? tail : null;
}

/**
 * Merge the installed personas' schedules into the shared store, at boot and
 * on sample install. Idempotent by id; a tombstoned id stays down; schedule
 * posts past the prune horizon fall out, and their tombstones go with them —
 * the id carries its date, so nobody has to keep a ledger of the fallen.
 *
 * User-authored posts are never touched: not added, not pruned, not rewritten.
 */
export function mergeSchedule(
  prev: CommunityState,
  personas: PersonaSeed[],
  today: string,
): CommunityState {
  const known = new Set(prev.posts.map(p => p.id));
  const tombstoned = new Set(prev.removedPostIds ?? []);
  const additions: FeedPost[] = [];
  for (const persona of personas) {
    for (const post of personaSchedule(persona, today)) {
      if (known.has(post.id) || tombstoned.has(post.id)) continue;
      additions.push(post);
    }
  }

  const horizon = addDays(today, -PRUNE_DAYS);
  const posts = prev.posts.filter(p => !(isScheduleId(p.id) && p.date < horizon));
  const removedPostIds = (prev.removedPostIds ?? []).filter(id => {
    if (!isScheduleId(id)) return true;
    const date = scheduleIdDate(id);
    return date === null || date >= horizon;
  });

  const changed =
    additions.length > 0 ||
    posts.length !== prev.posts.length ||
    removedPostIds.length !== (prev.removedPostIds ?? []).length;
  if (!changed) return prev;
  return { ...prev, posts: [...posts, ...additions], removedPostIds };
}
