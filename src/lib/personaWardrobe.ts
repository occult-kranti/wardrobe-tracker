import {
  SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
  DEFAULT_OCCASIONS,
  EMPTY_CIRCLE,
  type AppState,
  type ClothingItem,
  type LaundryStatus,
  type Outfit,
  type Season,
  type UserCategory,
  type WardrobeEvent,
  type WearLog,
} from '../types';
import { todayLocal, addDays } from './dates';
import { PERSONAS, BRAND_SHOTS, type PersonaSeed } from './personaData';
import { GARMENT_PHOTOS } from './garmentPhotos';

/**
 * Builds a complete wardrobe from a persona seed.
 *
 * The same rule as the sample closet applies: wear counts and lastWorn are
 * DERIVED from the generated log, never asserted beside it, so every number the
 * Ledger prints agrees with the history the Calendar shows.
 *
 * Two sources feed the log:
 *  1. the persona's authored week, laid over the current calendar week — days
 *     already past are wears, days still ahead are plans;
 *  2. eight months of prior rotation, so the Ledger has a curve to draw.
 */

/** Deterministic 0..1. The demo is a fixture; it must not reshuffle per load. */
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

const SEASON_BY_MONTH: Season[] = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'fall', 'fall', 'fall', 'winter',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Bumped whenever the generated wardrobes change shape — photographs, bench
 * states, costs. Samples recording an older number are rebuilt at boot.
 */
export const PERSONA_SEED_VERSION = 5;

/** How far back the generated rotation runs, in days. */
const HISTORY_DAYS = 250;

/** Category labels for the ids the personas introduce beyond the defaults. */
const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  drapes: 'Drapes & sets',
  suits: 'Suiting',
};

function categoriesFor(persona: PersonaSeed): UserCategory[] {
  const used = new Set(persona.items.map(i => i.category));
  const extra = [...used]
    .filter(id => !DEFAULT_CATEGORIES.some(c => c.id === id))
    .sort()
    .map(id => ({ id, label: EXTRA_CATEGORY_LABELS[id] ?? id }));
  return [...DEFAULT_CATEGORIES, ...extra];
}

function occasionsFor(persona: PersonaSeed): string[] {
  const tags = new Set<string>(DEFAULT_OCCASIONS);
  for (const item of persona.items) for (const tag of item.occasion) tags.add(tag);
  return [...tags];
}

/**
 * A photograph of the real garment for each piece in the closet.
 *
 * Matched on what the piece actually is, most specific pattern first — "silk
 * camisole" must not be caught by the generic shirt rule. Each rule offers
 * SEVERAL photographs and its pieces take them in turn, so a closet with three
 * camisoles does not show the same picture three times; with 40 photographs
 * across 174 pieces some repetition is unavoidable, but the rotation spaces
 * repeats as far apart as a pool allows instead of seating them side by side.
 *
 * Some pieces have no honest photograph in the pack at all — earrings, heels,
 * swimwear. Those rules keep an EMPTY pool on purpose: the drawn flat is a
 * first-class state, and a wrong photograph (a necklace on a pair of jhumkas)
 * is a bug the grid repeats six cells wide.
 *
 * Sources: the Indian outfit pack (`in-*`, photorealistic, no real person or
 * brand depicted), openly-licensed Wikimedia photographs, and the brand
 * reference shots that shipped with the source pack. Credits live in
 * src/lib/garmentPhotos.ts.
 */
const PHOTO_RULES: Array<[RegExp, string[]]> = [
  // ---- Indian garments first: the most specific names in these closets
  [/saree(?! blouse)|\bsari\b/i, ['in-banarasi-silk-saree', 'in-mekhela-chador']],
  [/mekhela/i, ['in-mekhela-chador']],
  [/lehenga|ghagra/i, ['in-lehenga-choli', 'in-ghagra-choli']],
  [/sharara/i, ['in-sharara-set']],
  [/churidar/i, ['in-churidar-kurta']],
  [/patiala/i, ['in-patiala-suit']],
  [/salwar|kameez/i, ['in-salwar-kameez']],
  [/anarkali|kaftan/i, ['in-anarkali-gown']],
  [/bandhgala/i, ['in-bandhgala-suit', 'in-sherwani']],
  [/nehru/i, ['in-nehru-jacket-set', 'in-indo-western-jacket-set']],
  [/sherwani/i, ['in-sherwani']],
  [/dhoti|mundu|lungi/i, ['in-dhoti-kurta', 'in-mundu-lungi-outfit']],
  [/pathani/i, ['in-pathani-suit']],
  [/palazzo/i, ['in-kurti-palazzo-set']],
  [/kurta|kurti/i, ['in-kurta-pajama', 'in-churidar-kurta', 'in-pathani-suit', 'in-kurti-palazzo-set']],
  [/dupatta|pashmina|shawl|stole/i, ['pashmina-shawl']],

  // ---- shoes
  // The suede shot is a pair of men's lace-up dress shoes; standing in for
  // kolhapuris and juttis it reads as a filing error, not a photograph.
  [/jutti|mojari|kolhapuri/i, []],
  [/chelsea|\bboots?\b/i, ['boot-chelsea']],
  [/loafer/i, ['loafer-penny', 'slip-on-suede']],
  [/\boxfords\b|cap-toe/i, ['oxford-captoe', 'derby-plain']],
  [/derb(y|ies)|plain-toe/i, ['derby-plain', 'oxford-captoe']],
  [/slip-on|espadrille|suede/i, ['slip-on-suede']],
  // Footwear nouns only: a loose /trail|running/ once put shoe close-ups on
  // the running shorts and the trail pants, which are bottoms.
  [/\brunners?\b|\brunning shoes?\b|\btrainers?\b/i, ['trail-runner']],
  [/sneaker/i, ['sneaker-white', 'trail-runner']],
  // Same verdict for sandals and flats: no open shoe exists in the pack, and
  // laced men's suede on a strappy flat sandal is a wrong photo, not a stand-in.
  [/sandal|flats\b/i, []],
  // No heel photograph exists; three heels sharing one men's shoe is worse
  // than three drawn flats.
  [/pumps?\b|\bmules?\b|\bheels?\b|heeled|stiletto/i, []],

  // ---- jewellery
  [/watch/i, ['watch-dress-steel']],
  [/\bchain\b|necklace|choker/i, ['necklace-chain']],
  // Word-bounded: a bare /ring/ once hung a necklace on the drawstring shorts.
  // The pack has no earring, bangle or cufflink photograph — drawn flat.
  [/jhumka|earring|\bhoops?\b|\bstuds?\b|bangle|anklet|cufflink|\bring\b/i, []],

  // ---- accessories
  [/daypack|backpack|rucksack/i, ['backpack-daypack']],
  [/duffle|duffel|weekender|briefcase|camera bag|sling|shoulder bag|clutch|tote|raffia/i, ['duffle-weekender']],
  // A potli is a drawstring pouch; neither the duffle nor the army daypack
  // resembles one.
  [/potli/i, []],
  [/belt|brace(s)?/i, ['belt-leather']],
  [/scarf|bandana/i, ['pashmina-shawl']],
  [/sunglass|wayfarer|cat-eye/i, ['sunglasses-wayfarer']],
  [/beanie|hat|cap\b/i, ['beanie-rib']],
  [/sock/i, ['socks-crew']],
  // The suit-jacket shot is styled with a tie and a pocket square, so both
  // read honestly there; a scrunchie and an umbrella do not.
  [/\btie\b|bow tie|pocket square/i, ['suit-jacket']],
  [/scrunchie|umbrella/i, []],

  // ---- tailoring and layers
  [/dinner jacket|tuxedo|suit jacket|flannel suit|two-piece|blazer/i, ['suit-jacket']],
  [/waistcoat|bandi/i, ['waistcoat']],
  [/gilet|quilted|liner|field jacket|waxed|rain shell|\bshell\b/i, ['gilet-quilted']],
  [/trench|overcoat|wool coat|longline/i, ['suit-jacket']],
  [/hoodie|sweatshirt|quarter-zip/i, ['hoodie-oversized']],
  [/denim jacket|trucker/i, ['trucker-jacket']],
  [/cable|cricket|merino|crew(neck)?|v-neck|thermal|henley/i, ['sweater', 'hoodie-oversized']],
  [/cape/i, ['pashmina-shawl']],

  // ---- tops and one-pieces
  // No sweater here: a men's crewneck standing in for a ribbed tank or a silk
  // camisole is a register crossing, and the knit rule below owns the sweater.
  [/camisole|tank|turtleneck/i, ['camisole-silk', 'blouse']],
  [/blouse/i, ['blouse', 'camisole-silk']],
  // The tee shots split by cut. The women's-cut pair (named shot by shot) only
  // honestly depicts the training crop tee; the straight-cut tees carry the
  // rest. A polo has a collar none of them show — drawn flat.
  [/crop tee/i, ['adidas-t-shirt', 'gap-t-shirt']],
  [/polo/i, []],
  [/\btees?\b|t-shirt/i, ['levis-t-shirt', 'nike-t-shirt', 'uniqlo-t-shirt']],
  [/dress|gown/i, ['dress', 'in-anarkali-gown']],
  // Shirts only: the ruffle-tie blouse once rotated onto a pinpoint dress
  // shirt, and it belongs to the blouse and camisole rules above.
  [/shirt|button-down/i, ['shirt']],

  // ---- bottoms
  [/selvedge|jeans/i, ['denim-jeans', 'jeans']],
  [/legging/i, ['leggings-yoga', 'leggings']],
  // Swimwear has no photograph; grey joggers on the swim one-piece read as a
  // filing error.
  [/swim/i, []],
  [/cargo|track pants|loopback|lounge|shorts|joggers/i, ['joggers']],
  [/chino/i, ['chinos']],
  [/trouser|pants/i, ['trousers', 'chinos']],

  // ---- fabric and craft words, LAST: these once ran before the garment nouns
  // and put a lehenga on the block-print bandana. Only a piece no other rule
  // names falls through to here.
  [/kantha|organza|handloom|ajrakh|block-print/i, ['in-indo-western-jacket-set']],
];

/**
 * One rotation cursor per rule, reset before each persona builds. A hash pick
 * once seated the same photograph in adjacent grid cells — three matching
 * blouses in a row, one anarkali four times — because thin pools collide
 * constantly. Cycling each rule's pool in build order instead pushes repeats
 * as far apart as the pool allows, and item order is fixed, so a piece still
 * keeps the same photograph across reloads.
 */
const ruleTurns = new Map<number, number>();

function resetPhotoTurns(): void {
  ruleTurns.clear();
}

function photoFor(itemName: string): string {
  for (let index = 0; index < PHOTO_RULES.length; index++) {
    const [pattern, slugs] = PHOTO_RULES[index];
    if (!pattern.test(itemName)) continue;
    // An empty pool is a verdict, not an omission: nothing in the pack
    // honestly depicts this piece, and the drawn flat beats a wrong photo.
    if (slugs.length === 0) return '';
    // Gather every photograph this rule can offer, from both sources.
    const options: string[] = [];
    for (const slug of slugs) {
      const photo = GARMENT_PHOTOS.find(p => p.slug === slug);
      if (photo) options.push(photo.path);
      // The brand pack indexes by garment type; a rule may name the type, or
      // one exact shot by its slug where the type mixes cuts.
      for (const shot of BRAND_SHOTS.filter(s => s.category === slug || s.slug === slug)) {
        options.push(shot.path);
      }
    }
    if (options.length === 0) continue; // rule matched but nothing to show; try the next
    const turn = ruleTurns.get(index) ?? 0;
    ruleTurns.set(index, turn + 1);
    return options[turn % options.length];
  }
  return '';
}

/** Monday-first index of the current week, so an authored week lands on real dates. */
function dateForWeekday(label: string, weekOffset: number): string {
  const today = new Date(`${todayLocal()}T00:00:00`);
  const name = label.split('(')[0].trim();
  const target = WEEKDAYS.indexOf(name);
  if (target < 0) return todayLocal();
  // Monday is the start of the week the app treats as "this week".
  const mondayDelta = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayDelta + weekOffset * 7);
  const targetDelta = (target + 6) % 7; // Monday = 0
  monday.setDate(monday.getDate() + targetDelta);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ---------- events ----------
   Each persona gets three: something coming up soon, something further out, and
   one already past, so the page shows every state it can be in. Reservations are
   drawn from that persona's own outfits by occasion, so the looks held for a
   wedding are the wedding looks. */

interface EventPlan {
  name: string;
  kind: WardrobeEvent['kind'];
  place: string;
  startsIn: number;
  days: number;
  notes: string;
  /** Matched against each outfit's occasion + category text, in order. */
  dayLabels: Array<{ label: string; match: RegExp }>;
}

const EVENT_PLANS: Record<string, EventPlan[]> = {
  aarav: [
    { name: 'Goa, off-season', kind: 'trip', place: 'Goa', startsIn: 12, days: 4, notes: 'Carry-on only. One pair of shoes that can get wet.', dayLabels: [
      { label: 'Flight down', match: /travel|airport|red-eye/i },
      { label: 'Beach shack day', match: /resort|goa|off.?season|weekend/i },
      { label: 'Dinner out', match: /dinner|rooftop|date/i },
      { label: 'Flight back', match: /travel|airport|bridge/i },
    ] },
    { name: 'Design Week Bengaluru', kind: 'work', place: 'Bengaluru', startsIn: 34, days: 3, notes: 'Speaking on day two. Something that photographs on a stage.', dayLabels: [
      { label: 'Opening night', match: /gallery|opening|formal|suit/i },
      { label: 'Talk day', match: /studio|review|business/i },
      { label: 'Closing party', match: /brewery|night|party|drinks/i },
    ] },
    { name: 'Diwali at home', kind: 'festival', place: 'Kochi', startsIn: -26, days: 2, notes: 'Kurta pressed the night before. It always creases in the case.', dayLabels: [
      { label: 'Lakshmi puja', match: /diwali|festive|kurta|home/i },
      { label: 'Cousins over', match: /sangeet|bandhgala|festive/i },
    ] },
  ],
  vikram: [
    { name: 'Udaipur wedding', kind: 'celebration', place: 'Udaipur', startsIn: 19, days: 3, notes: 'Three functions, three registers. The bandhgala travels flat in tissue.', dayLabels: [
      { label: 'Mehndi', match: /festive|diwali|mehndi|kurta/i },
      { label: 'Sangeet', match: /sangeet|bandhgala|evening/i },
      { label: 'Reception', match: /black.?tie|tuxedo|formal|wedding/i },
    ] },
    { name: 'Singapore, client week', kind: 'work', place: 'Singapore', startsIn: 5, days: 4, notes: 'Humidity. Linen or nothing before six.', dayLabels: [
      { label: 'Arrival, dinner', match: /dinner|anniversary|rooftop|bar/i },
      { label: 'Client presentations', match: /board|meeting|navy|suit/i },
      { label: 'Lunch, no tie', match: /lunch|no.?tie|business/i },
      { label: 'Flight home', match: /business run|airport|travel/i },
    ] },
    { name: 'Alibaug, long weekend', kind: 'trip', place: 'Alibaug', startsIn: -41, days: 2, notes: 'The only weekend of the quarter with no calls.', dayLabels: [
      { label: 'Drive down', match: /weekend|resort|leisure|polo/i },
      { label: 'Sunday lunch', match: /lunch|club|linen/i },
    ] },
  ],
  meher: [
    { name: 'Jaipur, block-print sourcing', kind: 'trip', place: 'Jaipur', startsIn: 9, days: 3, notes: 'Workshops are dusty. Nothing white on the first two days.', dayLabels: [
      { label: 'Workshop visits', match: /sourcing|run|craft|studio/i },
      { label: 'Dyers, then dinner', match: /dinner|oxblood|evening/i },
      { label: 'Market, then train', match: /market|errand|travel/i },
    ] },
    { name: 'Wedding season, Delhi', kind: 'celebration', place: 'New Delhi', startsIn: 27, days: 3, notes: 'Client is in two of the three. Nothing that repeats in photographs.', dayLabels: [
      { label: 'Mehndi, morning', match: /festive|craft|marigold|day/i },
      { label: 'Sangeet', match: /sangeet|party|launch|evening/i },
      { label: 'Wedding, black-tie', match: /black.?tie|saree|formal|wedding/i },
    ] },
    { name: 'Lakmé Fashion Week', kind: 'work', place: 'Mumbai', startsIn: -33, days: 2, notes: 'Backstage both days. Flats, and pockets for pins.', dayLabels: [
      { label: 'Backstage, day one', match: /fitting|studio|street/i },
      { label: 'Front row', match: /editorial|pitch|suiting|agency/i },
    ] },
  ],
};

function buildEvents(persona: PersonaSeed, outfits: Outfit[]): WardrobeEvent[] {
  const today = todayLocal();
  const plans = EVENT_PLANS[persona.id] ?? [];
  const seedOutfits = persona.outfits;

  return plans.map((plan, planIndex) => {
    const start = addDays(today, plan.startsIn);
    const used = new Set<string>();
    const reservations = plan.dayLabels.slice(0, plan.days).map((day, i) => {
      // Score every unused look against the day rather than taking the first
      // hit: a first-match fallback once reserved the Sleep System for a
      // closing party, which is the kind of thing that reads as a broken app.
      const candidates = seedOutfits
        .filter(o => !used.has(o.id) && o.itemIds.length > 1)
        // Never hold sleepwear or gym kit for a dated occasion.
        .filter(o => !/sleep|pilates|leg day|gym|run\b/i.test(`${o.name} ${o.category}`))
        .map(o => {
          let score = 0;
          if (day.match.test(o.name)) score += 4;
          if (day.match.test(o.occasion)) score += 3;
          if (day.match.test(o.category)) score += 2;
          if (day.match.test(o.season)) score += 1;
          return { o, score };
        })
        .sort((a, b) => b.score - a.score);
      const match = candidates[0]?.o;
      if (match) used.add(match.id);
      const outfit = match ? outfits.find(o => o.id === match.id) : undefined;
      return {
        id: `${persona.id}-ev${planIndex}-r${i}`,
        date: addDays(start, i),
        label: day.label,
        outfitId: outfit?.id,
        itemIds: outfit ? [...outfit.itemIds] : [],
      };
    });

    return {
      id: `${persona.id}-event-${planIndex}`,
      name: plan.name,
      kind: plan.kind,
      startDate: start,
      endDate: addDays(start, plan.days - 1),
      place: plan.place,
      notes: plan.notes,
      reservations,
    };
  });
}

export function buildPersonaState(persona: PersonaSeed): AppState {
  const today = todayLocal();
  const outfitById = new Map(persona.outfits.map(o => [o.id, o]));

  /* ---------- the authored week, laid over real dates ---------- */
  const logs: WearLog[] = [];
  let n = 0;
  const seenWeekday = new Set<string>();
  let week = 0;
  for (const day of persona.calendar) {
    const name = day.label.split('(')[0].trim();
    // A 14-day calendar repeats its weekday names; the second pass is next week.
    if (seenWeekday.has(name)) { week = 1; seenWeekday.clear(); }
    seenWeekday.add(name);
    const date = dateForWeekday(day.label, week);
    for (const outfitId of day.outfits) {
      const outfit = outfitById.get(outfitId);
      if (!outfit || outfit.itemIds.length === 0) continue;
      logs.push({
        id: `${persona.id}-cal-${n++}`,
        date,
        itemIds: [...outfit.itemIds],
        outfitId,
        notes: day.schedule || undefined,
        // The stored flag, same as logWear writes: days still ahead are plans.
        planned: date > today ? true : undefined,
      });
    }
  }

  /* ---------- prior rotation, so the Ledger has a history ---------- */
  const earliestPlanned = logs.reduce((min, l) => (l.date < min ? l.date : min), today);
  for (let back = HISTORY_DAYS; back > 0; back--) {
    const date = addDays(today, -back);
    if (date >= earliestPlanned) continue; // the authored week owns its own days
    if (rand(persona.id, 'logged', back) > 0.68) continue;
    const season = SEASON_BY_MONTH[Number(date.slice(5, 7)) - 1];
    // Weight by how well the outfit's pieces suit the season, so winter coats
    // stay out of July and the monthly chart has a shape.
    const weighted = persona.outfits
      .filter(o => o.itemIds.length > 1)
      .map(o => {
        const seeds = o.itemIds
          .map(id => persona.items.find(i => i.id === id))
          .filter((i): i is NonNullable<typeof i> => i !== undefined);
        const fit = seeds.length
          ? seeds.filter(i => (i.season as Season[]).includes(season)).length / seeds.length
          : 0;
        return { o, w: 0.08 + fit };
      });
    const total = weighted.reduce((sum, x) => sum + x.w, 0);
    let r = rand(persona.id, 'pick', back) * total;
    let chosen = weighted[weighted.length - 1];
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) { chosen = x; break; }
    }
    if (!chosen) continue;
    logs.push({
      id: `${persona.id}-log-${n++}`,
      date,
      itemIds: [...chosen.o.itemIds],
      outfitId: chosen.o.id,
    });
  }

  logs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  /* ---------- derive, never assert ---------- */
  const wears = new Map<string, number>();
  const lastWorn = new Map<string, string>();
  const outfitWears = new Map<string, number>();
  const outfitLast = new Map<string, string>();
  for (const log of logs) {
    if (log.date > today) continue;
    if (log.outfitId) {
      outfitWears.set(log.outfitId, (outfitWears.get(log.outfitId) ?? 0) + 1);
      const seen = outfitLast.get(log.outfitId);
      if (!seen || log.date > seen) outfitLast.set(log.outfitId, log.date);
    }
    for (const id of log.itemIds) {
      wears.set(id, (wears.get(id) ?? 0) + 1);
      const seen = lastWorn.get(id);
      if (!seen || log.date > seen) lastWorn.set(id, log.date);
    }
  }

  const firstLog = logs.length > 0 ? logs[0].date : today;

  /**
   * Bench states, derived from the same history as everything else.
   *
   * A closet where all sixty pieces read "Ready" and every other state reads 0
   * is a showroom, not a wardrobe. But the states cannot be sprinkled at
   * random either — "needs wash" on a piece that has not been worn in a month
   * is a lie the wear log immediately exposes. So the laundry basket follows
   * the log: pieces worn in the last few days are the candidates for the
   * basket and the machine, heavily-worn pieces are the candidates for repair,
   * and one structured piece is at the tailor. Deterministic (FNV → mulberry),
   * like every other choice in this file.
   */
  const laundryFor = (seed: PersonaSeed['items'][number]): LaundryStatus => {
    const worn = lastWorn.get(seed.id);
    const count = wears.get(seed.id) ?? 0;
    const since = worn
      ? Math.round(
          (new Date(`${today}T00:00:00`).getTime() - new Date(`${worn}T00:00:00`).getTime()) / 86400000
        )
      : Infinity;
    const roll = rand(persona.id, seed.id, 'bench');
    // Jewellery and bags do not queue for the wash.
    const washable = !['jewellery', 'accessories'].includes(seed.category);
    if (washable && since <= 2 && roll < 0.62) return 'worn';
    if (washable && since <= 6 && roll < 0.18) return 'washing';
    if (count >= 8 && roll > 0.955) return 'needs-repair';
    return 'clean';
  };

  // Each closet's photo rotation starts from the top of every pool.
  resetPhotoTurns();
  const items: ClothingItem[] = persona.items.map(seed => ({
    id: seed.id,
    name: seed.name,
    category: seed.category,
    color: seed.color,
    brand: undefined,
    source: seed.tier === 'high' ? 'new' : undefined,
    fitsLike: seed.fit && seed.fit !== '-' ? seed.fit : undefined,
    material: seed.fabric && seed.fabric !== '-' ? seed.fabric : undefined,
    season: seed.season as Season[],
    occasion: seed.occasion,
    imageUrl: photoFor(seed.name),
    dateAdded: addDays(firstLog, -Math.floor(rand(seed.id, 'added') * 400) - 10),
    lastWorn: lastWorn.get(seed.id),
    wearCount: wears.get(seed.id) ?? 0,
    cost: seed.cost,
    favorite: false,
    laundryStatus: laundryFor(seed),
  }));

  // Exactly one structured piece is at the tailor — the most-worn tailored
  // garment that is not already benched. One, because "at the tailor" is an
  // errand, and a wardrobe with four errands open reads as staged.
  const tailorable = items
    .filter(i => i.laundryStatus === 'clean' && i.wearCount >= 4)
    .filter(i => /blazer|jacket|bandhgala|sherwani|suit|coat|trouser|kurta/i.test(i.name))
    .sort((a, b) => b.wearCount - a.wearCount);
  if (tailorable.length > 0) tailorable[0].laundryStatus = 'at-tailor';

  // No state reads 0. The rolls above follow the log honestly, but a filter row
  // where "In the wash" is a dead chip teaches the user those chips do nothing;
  // if a state came up empty, the most-worn clean piece steps into it, which is
  // also who it would really be.
  for (const state of ['worn', 'washing', 'needs-repair'] as const) {
    if (items.some(i => i.laundryStatus === state)) continue;
    const candidate = items
      .filter(i => i.laundryStatus === 'clean')
      .filter(i => !['jewellery', 'accessories'].includes(i.category))
      .sort((a, b) => b.wearCount - a.wearCount)[0];
    if (candidate) candidate.laundryStatus = state;
  }

  const outfits: Outfit[] = persona.outfits.map(o => ({
    id: o.id,
    name: o.name,
    itemIds: [...o.itemIds],
    occasion: o.occasion,
    favorite: false,
    dateCreated: addDays(firstLog, -5),
    wearCount: outfitWears.get(o.id) ?? 0,
    lastWorn: outfitLast.get(o.id),
    imageUrl: o.image,
    notes: o.dna,
    stylingNote: o.note,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    items,
    outfits,
    wearLogs: logs,
    wishlist: [],
    circle: EMPTY_CIRCLE,
    events: buildEvents(persona, outfits),
    furniture: [],
    settings: {
      categories: categoriesFor(persona),
      occasions: occasionsFor(persona),
      theme: 'dark',
    },
  };
}

export function personaById(id: string): PersonaSeed | undefined {
  return PERSONAS.find(p => p.id === id);
}

export { PERSONAS };
