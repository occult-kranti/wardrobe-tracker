import {
  SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
  DEFAULT_OCCASIONS,
  EMPTY_CIRCLE,
  type AppState,
  type ClothingItem,
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
 * SEVERAL photographs and the piece picks one by hash, so a closet with three
 * camisoles does not show the same picture three times; with 40 photographs
 * across 174 pieces some repetition is unavoidable, but it should not cluster.
 *
 * Sources: the Indian outfit pack (`in-*`, photorealistic, no real person or
 * brand depicted), openly-licensed Wikimedia photographs, and the brand
 * reference shots that shipped with the source pack. Credits live in
 * src/lib/garmentPhotos.ts.
 */
const PHOTO_RULES: Array<[RegExp, string[]]> = [
  // ---- Indian garments first: the most specific names in these closets
  [/saree|sari/i, ['in-banarasi-silk-saree', 'in-mekhela-chador']],
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
  [/kantha|organza|handloom|ajrakh|block-print/i, ['in-indo-western-jacket-set', 'in-ghagra-choli']],
  [/dupatta|pashmina|shawl|stole/i, ['pashmina-shawl']],

  // ---- shoes
  [/jutti|mojari|kolhapuri/i, ['slip-on-suede', 'sandal-leather']],
  [/chelsea|ankle.*boot|rain boot/i, ['boot-chelsea']],
  [/loafer/i, ['loafer-penny', 'slip-on-suede']],
  [/oxford(?!.*shirt)|cap-toe/i, ['oxford-captoe', 'derby-plain']],
  [/derb(y|ies)|plain-toe/i, ['derby-plain', 'oxford-captoe']],
  [/slip-on|espadrille|suede/i, ['slip-on-suede']],
  [/trail|trek|hiking|running|runner/i, ['trail-runner']],
  [/sneaker|trainer/i, ['sneaker-white', 'trail-runner']],
  [/pump|mule|heel|sandal|flats\b/i, ['boot-chelsea', 'slip-on-suede']],

  // ---- jewellery
  [/watch/i, ['watch-dress-steel']],
  [/jhumka|choker|chain|necklace|hoop|stud|pearl|bangle|anklet|cufflink|ring/i, ['necklace-chain']],

  // ---- accessories
  [/daypack|backpack|rucksack/i, ['backpack-daypack']],
  [/duffle|duffel|weekender|briefcase|camera bag|sling|potli|shoulder bag|clutch|tote|raffia/i, ['duffle-weekender', 'backpack-daypack']],
  [/belt|brace(s)?/i, ['belt-leather']],
  [/scarf|bandana/i, ['pashmina-shawl']],
  [/sunglass|wayfarer|cat-eye/i, ['sunglasses-wayfarer']],
  [/beanie|hat|cap\b/i, ['beanie-rib']],
  [/sock/i, ['socks-crew']],
  [/\btie\b|bow tie|pocket square|scrunchie|umbrella/i, ['suit-jacket']],

  // ---- tailoring and layers
  [/dinner jacket|tuxedo|marcella|suit jacket|flannel suit|two-piece|blazer/i, ['suit-jacket', 'waistcoat']],
  [/waistcoat|bandi|gilet|quilted|liner|field jacket|waxed|rain shell|shell|ripstop/i, ['gilet-quilted', 'waistcoat']],
  [/trench|overcoat|wool coat|longline/i, ['suit-jacket', 'gilet-quilted']],
  [/hoodie|sweatshirt|quarter-zip/i, ['hoodie-oversized']],
  [/denim jacket|trucker/i, ['trucker-jacket']],
  [/cable|cricket|cashmere|merino|crew(neck)?|v-neck|knit|thermal|henley/i, ['sweater', 'hoodie-oversized']],
  [/cape/i, ['pashmina-shawl']],

  // ---- tops and one-pieces
  [/camisole|tank|turtleneck|sleep|pyjama/i, ['camisole-silk', 'blouse', 'sweater']],
  [/blouse/i, ['blouse', 'camisole-silk']],
  [/polo|tee|t-shirt/i, ['t-shirt']],
  [/dress|gown/i, ['dress', 'in-anarkali-gown']],
  [/shirt/i, ['shirt', 'blouse']],

  // ---- bottoms
  [/selvedge|jeans/i, ['denim-jeans', 'jeans']],
  [/legging/i, ['leggings-yoga', 'leggings']],
  [/cargo|track pants|loopback|lounge|shorts|swim|joggers/i, ['joggers']],
  [/chino/i, ['chinos']],
  [/trouser|pants/i, ['trousers', 'chinos']],
];

function photoFor(itemName: string, personaId: string, itemId: string): string {
  for (const [pattern, slugs] of PHOTO_RULES) {
    if (!pattern.test(itemName)) continue;
    // Gather every photograph this rule can offer, from both sources.
    const options: string[] = [];
    for (const slug of slugs) {
      const photo = GARMENT_PHOTOS.find(p => p.slug === slug);
      if (photo) options.push(photo.path);
      // The brand pack indexes by garment type rather than by slug.
      for (const shot of BRAND_SHOTS.filter(s => s.category === slug)) options.push(shot.path);
    }
    if (options.length === 0) continue; // rule matched but nothing to show; try the next
    // Stable pick, so a piece keeps the same photograph across reloads.
    return options[Math.floor(rand(personaId, itemId, 'shot') * options.length)];
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
    imageUrl: photoFor(seed.name, persona.id, seed.id),
    dateAdded: addDays(firstLog, -Math.floor(rand(seed.id, 'added') * 400) - 10),
    lastWorn: lastWorn.get(seed.id),
    wearCount: wears.get(seed.id) ?? 0,
    cost: seed.cost,
    favorite: false,
    laundryStatus: 'clean',
  }));

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
