import type { PersonaSeed, PersonaItemSeed, PersonaOutfitSeed, PersonaCalendarDay } from './personaData';
import type { ItemSource, WishStatus } from '@almari/shared/types';

/**
 * ONE MORE SAMPLE WARDROBE, authored here rather than generated.
 *
 * The first three personas live in personaData.ts, which is emitted by
 * scripts/build-persona-data.mjs from a source pack of CSVs and Markdown. That
 * pack is not in this repository and running the generator without it would
 * delete the three wardrobes it built. So the fourth is a second file, joined
 * to the first at the point of use, and the generated file is left alone.
 *
 * ── ON NAMES, WHICH IS NOT A DESIGN QUESTION ─────────────────────────────────
 * These wardrobes are drawn from characters in film and television whose
 * costume design is the reason anyone remembers them. None of them is NAMED
 * after a character or an actor, and that is deliberate: shipping a public app
 * with a persona called after a real performer is a publicity-rights question,
 * and one called after a trademarked character is a trademark question. Neither
 * is answered by it being a nice idea.
 *
 * What a costume designer would do instead is what is done here — brief the
 * wardrobe rather than name the film. "A Kolkata newspaper sub-editor in 1974
 * who owns four shirts and irons them himself" carries everything the reference
 * carries and belongs to nobody. Each persona below records the idea it came
 * from in its own `philosophy`, in those terms.
 *
 * Every photograph is the same openly-licensed pool the rest of the app uses:
 * photoFor() in personaWardrobe.ts matches on a garment's NAME, so a piece
 * called "Chikankari kurta" finds the kurta shot that already ships. Nothing
 * here depicts a costume. The one exception is the cofounder's own closet
 * below: his tiles are real crops of his real garments, cut from his own
 * photographs by intake — the exception is signed, literally, in his name.
 */

/** The compact form these are authored in. Expanded below. */
export interface CastBrief {
  id: string;
  name: string;
  handle: string;
  age: string;
  city: string;
  job: string;
  palette: { name: string; colours: string[] };
  /** Where the wardrobe idea came from, in a costume designer's terms. */
  philosophy: string[];
  rules: string[];
  neverWears: string[];
  fragrance: string;
  icons: string[];
  lead: { image: string; caption: string };
  /**
   * name · category · colour word · hex · fabric · fit · seasons · occasions ·
   * cost · tier. Names are chosen to match photoFor()'s patterns.
   */
  pieces: Array<[
    string, string, string, string, string, string, string[], string[], number, string,
  ]>;
  outfits: Array<{
    name: string; occasion: string; season: string; time: string; weather: string;
    pieces: string[]; note?: string; dna?: string;
    /** A real crop of the outfit's hero piece, where one exists. */
    image?: string;
  }>;
  week: PersonaCalendarDay[];
}

const initials = (name: string) =>
  name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Expand a brief into the shape the wardrobe builder already reads. */
export function expand(brief: CastBrief): PersonaSeed {
  const tag = initials(brief.name);
  const byName = new Map<string, string>();

  const items: PersonaItemSeed[] = brief.pieces.map((p, i) => {
    const [name, category, colour, color, fabric, fit, season, occasion, cost, tier] = p;
    const id = `${tag}-${String(i + 1).padStart(2, '0')}`;
    byName.set(name, id);
    return {
      id, name, category, color, colour, fabric, fit,
      season, occasion, cost, tier,
      outfits: [],
    };
  });

  const outfits: PersonaOutfitSeed[] = brief.outfits.map((o, i) => {
    const itemIds = o.pieces
      .map(n => byName.get(n))
      .filter((id): id is string => {
        // A brief that names a piece it does not own is an authoring mistake,
        // and a silent one — the outfit would simply come out short. Louder
        // here than in a wardrobe somebody is looking at.
        if (!id) console.warn(`[personaCast] ${brief.id}: outfit "${o.name}" names a piece that is not in the closet`);
        return !!id;
      });
    const id = `${brief.id}-o${i + 1}`;
    for (const itemId of itemIds) {
      const item = items.find(x => x.id === itemId);
      if (item) item.outfits.push(id);
    }
    return {
      id, name: o.name, category: 'day', occasion: o.occasion, season: o.season,
      time: o.time, weather: o.weather, image: o.image ?? '', itemIds,
      note: o.note, dna: o.dna,
    };
  });

  // THE CALENDAR CARRIES OUTFIT IDS, not names — buildWearLogs looks each day's
  // entries up in outfitById to lay a week of wears over the current one, and a
  // name it cannot resolve is silently skipped, which is a week that quietly
  // produces no history at all. Briefs are authored in names because that is
  // what a person writing a week actually knows; the translation is here.
  const outfitByName = new Map(brief.outfits.map((o, i) => [o.name, outfits[i].id]));
  const calendar: PersonaCalendarDay[] = brief.week.map(day => ({
    ...day,
    outfits: day.outfits.flatMap(name => {
      const id = outfitByName.get(name);
      if (!id) console.warn(`[personaCast] ${brief.id}: the week names an outfit that does not exist: ${name}`);
      return id ? [id] : [];
    }),
  }));

  return {
    id: brief.id,
    slug: brief.id,
    name: brief.name,
    handle: brief.handle,
    age: brief.age,
    city: brief.city,
    job: brief.job,
    palette: brief.palette,
    philosophy: brief.philosophy,
    rules: brief.rules,
    neverWears: brief.neverWears,
    fragrance: brief.fragrance,
    icons: brief.icons,
    leadImage: brief.lead.image,
    leadCaption: brief.lead.caption,
    items,
    outfits,
    calendar,
  };
}

/** Filled in by the brief below. */
export const CAST_BRIEFS: CastBrief[] = [];

/* THE ONE AUTHORED WARDROBE IS THE EXCEPTION TO THE NAMING RULE ABOVE. It is
   the real closet of the person building the app, shipped at his own ask, from
   his own photographs — a real name here is not a publicity question, it is
   the owner signing his work. The garments are plain garments, and since the
   feed-import crops landed, every tile is the real piece: cut from his camera
   roll by scripts/build-cofounder-closet.mjs, never a pool photograph. */

CAST_BRIEFS.push({
  id: 'cofounder',
  name: 'Hruday',
  handle: '@hruday_mehta',
  age: '27',
  city: 'New Delhi, when not on the road',
  job: 'Artist, and the person building this app',
  palette: { name: 'Ink, ivory, and one loud day', colours: ['ink black', 'ivory', 'cream', 'navy', 'maroon', 'mustard', 'lavender', 'signal red'] },
  philosophy: [
    'The idea: the person building this app. An artist with one foot in the wedding season and one in the studio, who dresses for a chalkboard with the same ceremony as a sangeet.',
    'The bio reads: if not now, when; wannabe philosopher; those who forget history are condemned to relive it. The wardrobe is those three sentences hung on a rail — the bandhgalas keep the history, the hoodies do the thinking, and nothing waits for a better occasion.',
    'Ladakh, Lake Placid, the long American roads, Rajasthan in wedding season. The clothes that survive a night bus stay; the rest were never really kept to begin with.',
  ],
  rules: [
    'If not now, when. The good jacket does not wait for a grander occasion.',
    'Dress for the wedding as seriously as for the chalkboard.',
    'One loud piece per outfit. The rest of the rail keeps quiet.',
  ],
  neverWears: ['a logo you can read from across the road', 'anything that cannot survive a night bus'],
  fragrance: 'old paper, ittar from somebody else\'s wedding, and bus-window dust.',
  icons: ['the tailor\'s chalk line', 'the hills above Leh', 'a paperback with a broken spine'],
  lead: { image: 'wardrobe/cofounder/black-embroidered-jacket.jpg', caption: 'The embroidered jacket, pressed for the season' },
  /* Every piece below is a real garment of his, and every tile is the real
     crop intake cut of it — scripts/build-cofounder-closet.mjs, from his own
     photographs. The names the model gave the reads are kept where they were
     right and corrected where the crop says otherwise (the "grey blazer" is
     navy; the "pink graphic sweatshirt" is the lavender alien). Small things
     the camera never gave an honest crop of — the watches, the frames, the
     earrings — are simply not here, rather than here as somebody else's
     photograph. */
  pieces: [
    ['Black embroidered jacket', 'layers', 'black and gold', '#1A1410', 'silk-blend, floral thread embroidery', 'bandhgala collar, cut close', ['fall', 'winter'], ['wedding', 'festive'], 26000, 'high'],
    ['Black embellished kurta', 'layers', 'black', '#0D0D0D', 'silk-blend, all-over sequin work', 'long, bandhgala collar', ['fall', 'winter'], ['wedding'], 32000, 'high'],
    ['Black kurta', 'tops', 'black', '#1A1A1A', 'cotton-silk, self pattern', 'straight, knee length', ['spring', 'summer', 'fall', 'winter'], ['wedding', 'festive'], 3500, 'mid'],
    ['White kurta', 'tops', 'white', '#F5F5F5', 'cotton', 'straight, knee length', ['spring', 'summer', 'fall', 'winter'], ['festive', 'casual'], 2800, 'mid'],
    ['Yellow kurta', 'tops', 'mustard yellow', '#D4A928', 'cotton', 'straight, knee length', ['spring', 'summer', 'fall'], ['festive', 'wedding'], 2200, 'low'],
    ['Navy blazer', 'layers', 'navy', '#232838', 'wool hopsack', 'soft shoulder, unlined', ['spring', 'summer', 'fall', 'winter'], ['formal', 'work'], 12000, 'high'],
    ['Blue-striped dress shirt', 'tops', 'blue and white', '#DCE6EE', 'cotton poplin, striped', 'tailored', ['spring', 'summer', 'fall', 'winter'], ['work', 'formal'], 2400, 'mid'],
    ['Cream tee', 'tops', 'cream', '#F5F0E8', 'cotton jersey', 'relaxed', ['spring', 'summer'], ['casual', 'travel', 'everyday'], 1400, 'mid'],
    ['Colour-block stripe tee', 'tops', 'white, red and navy', '#F2EFE8', 'cotton jersey, colour-blocked chest', 'straight', ['spring', 'summer', 'fall'], ['casual', 'everyday'], 1100, 'low'],
    ['Black graphic tee', 'tops', 'black', '#1A1A1A', 'cotton jersey, white text print', 'straight', ['spring', 'summer', 'fall', 'winter'], ['casual', 'everyday'], 1200, 'low'],
    ['Lavender graphic sweatshirt', 'layers', 'lavender', '#C9B8E8', 'cotton fleece, alien line-drawing print', 'relaxed', ['fall', 'winter', 'spring'], ['casual', 'everyday'], 2100, 'low'],
    ['Grey long-sleeve henley', 'tops', 'grey', '#B8B8BA', 'cotton waffle', 'slim', ['fall', 'winter', 'spring'], ['everyday', 'casual'], 1300, 'low'],
    ['Navy striped hoodie', 'layers', 'navy', '#2B3E5C', 'fleece-back cotton, rainbow drawcords', 'relaxed', ['fall', 'winter', 'spring'], ['everyday', 'casual'], 2600, 'mid'],
    ['Red plaid overshirt', 'layers', 'red and black', '#8B3830', 'brushed flannel, sherpa collar', 'worn open', ['fall', 'winter'], ['casual', 'travel'], 2800, 'mid'],
    ['Grey buffalo-check flannel shirt', 'layers', 'grey and white', '#4A4A4A', 'brushed cotton flannel', 'boxy', ['fall', 'winter'], ['casual', 'everyday'], 1900, 'low'],
    ['Black-and-white gingham shirt', 'tops', 'black and white', '#1A1A1A', 'cotton, gingham check', 'tailored', ['spring', 'summer', 'fall', 'winter'], ['casual', 'work'], 1800, 'low'],
    ['Light-blue chambray shirt', 'tops', 'light blue', '#6BA8C7', 'chambray, snap buttons', 'western yoke', ['spring', 'summer', 'fall'], ['casual', 'everyday'], 2200, 'mid'],
    ['Sky-blue denim shirt', 'tops', 'sky blue', '#7CB8D4', 'denim, short sleeve', 'straight', ['spring', 'summer'], ['casual', 'everyday'], 2400, 'mid'],
    ['Blue jeans', 'bottoms', 'mid blue', '#5B7A9E', '12oz denim, ripped knee', 'slim', ['spring', 'summer', 'fall', 'winter'], ['everyday', 'casual'], 3200, 'mid'],
    ['Dark navy jeans', 'bottoms', 'dark navy', '#2C3E50', '12oz denim', 'slim straight', ['spring', 'summer', 'fall', 'winter'], ['everyday', 'casual'], 3600, 'mid'],
    ['Brown hooded jacket', 'outerwear', 'dark brown', '#5A3A28', 'padded shell, fleece-lined hood', 'hip length', ['winter'], ['travel', 'everyday'], 6500, 'mid'],
    ['Brown character hat', 'accessories', 'brown', '#8B5A3C', 'plush, animal face and ear flaps', 'ties under the chin', ['winter'], ['travel', 'casual'], 1100, 'low'],
  ],
  outfits: [
    { name: 'Wedding, the Embroidered Jacket', occasion: 'wedding', season: 'winter', time: 'evening', weather: 'cold and clear',
      pieces: ['Black embroidered jacket', 'Black kurta', 'Dark navy jeans'],
      image: 'wardrobe/cofounder/black-embroidered-jacket.jpg',
      note: 'The invitation said festive. The jacket was pressed before it was finished reading.' },
    { name: 'Sangeet in Black', occasion: 'wedding', season: 'winter', time: 'night', weather: 'cold',
      pieces: ['Black embellished kurta', 'Black kurta', 'Dark navy jeans'],
      image: 'wardrobe/cofounder/black-embellished-kurta.jpg',
      dna: 'All black, so the embellishment does the talking.' },
    { name: 'The Haldi Morning', occasion: 'festive', season: 'spring', time: 'morning', weather: 'warm',
      pieces: ['Yellow kurta', 'Blue jeans'],
      image: 'wardrobe/cofounder/yellow-kurta.jpg',
      note: 'Turmeric finds every cuff anyway. The jeans are the surrender.' },
    { name: 'The Hill Evening', occasion: 'travel', season: 'winter', time: 'evening', weather: 'near freezing',
      pieces: ['Brown hooded jacket', 'Grey long-sleeve henley', 'Blue jeans', 'Brown character hat'],
      image: 'wardrobe/cofounder/brown-hooded-jacket.jpg',
      note: 'Chai at the one shop still open. The hat was a joke that outlived the joke.' },
    { name: 'Studio Day', occasion: 'everyday', season: 'spring', time: 'morning', weather: 'mild',
      pieces: ['Cream tee', 'Navy striped hoodie', 'Blue jeans'],
      image: 'wardrobe/cofounder/navy-striped-hoodie.jpg' },
    { name: 'The Lecture Hall', occasion: 'work', season: 'fall', time: 'morning', weather: 'grey',
      pieces: ['Black graphic tee', 'Grey buffalo-check flannel shirt', 'Blue jeans'],
      image: 'wardrobe/cofounder/grey-and-white-buffalo-check-shirt.jpg',
      note: 'The tee gets a laugh in the third row. The flannel keeps the air-conditioning honest.' },
    { name: 'The Reading', occasion: 'formal', season: 'fall', time: 'evening', weather: 'cool',
      pieces: ['Navy blazer', 'Blue-striped dress shirt', 'Dark navy jeans'],
      image: 'wardrobe/cofounder/grey-blazer.jpg',
      dna: 'Dressed for questions from the floor.' },
    { name: 'Sunset', occasion: 'everyday', season: 'summer', time: 'evening', weather: 'warm',
      pieces: ['Lavender graphic sweatshirt', 'Blue jeans'],
      image: 'wardrobe/cofounder/pink-graphic-sweatshirt.jpg' },
    { name: 'Fair Night', occasion: 'casual', season: 'fall', time: 'night', weather: 'cool',
      pieces: ['Colour-block stripe tee', 'Red plaid overshirt', 'Blue jeans', 'Brown character hat'],
      image: 'wardrobe/cofounder/red-plaid-shirt.jpg',
      note: 'Rides first, then the food stalls. The hat keeps the dust off.' },
    { name: 'The Winter Walk', occasion: 'everyday', season: 'winter', time: 'afternoon', weather: 'bright and cold',
      pieces: ['Brown hooded jacket', 'Navy striped hoodie', 'Blue jeans', 'Brown character hat'],
      image: 'wardrobe/cofounder/brown-hooded-jacket.jpg' },
    { name: 'The Gallery Opening', occasion: 'casual', season: 'fall', time: 'evening', weather: 'cool',
      pieces: ['Light-blue chambray shirt', 'Cream tee', 'Dark navy jeans'],
      image: 'wardrobe/cofounder/light-blue-chambray-shirt.jpg',
      note: 'None of his own work is up, but he dresses like it could be.' },
    { name: 'Diwali, at Home', occasion: 'festive', season: 'fall', time: 'evening', weather: 'cool',
      pieces: ['White kurta', 'Blue jeans'],
      image: 'wardrobe/cofounder/white-kurta.jpg' },
    { name: 'Double Denim, Deliberately', occasion: 'everyday', season: 'summer', time: 'afternoon', weather: 'hot',
      pieces: ['Sky-blue denim shirt', 'Cream tee', 'Dark navy jeans'],
      image: 'wardrobe/cofounder/sky-blue-denim-shirt.jpg' },
  ],
  week: [
    { label: 'Monday', outfits: ['Studio Day'], weather: 'mild', schedule: 'The build, all day' },
    { label: 'Tuesday', outfits: ['The Lecture Hall'], weather: 'grey', schedule: 'Two sections, back to back' },
    { label: 'Wednesday', outfits: ['Sunset'], weather: 'warm', schedule: 'Errands, then the roof' },
    { label: 'Thursday', outfits: ['The Reading'], weather: 'cool', schedule: 'A reading, then questions' },
    { label: 'Friday', outfits: ['Fair Night'], weather: 'cool', schedule: 'The fair, with cousins' },
    { label: 'Saturday', outfits: ['Wedding, the Embroidered Jacket'], weather: 'cold and clear', schedule: 'A wedding in the family' },
    { label: 'Sunday', outfits: ['The Hill Evening'], weather: 'near freezing', schedule: 'Chai at the one shop open' },
  ],
});

export const CAST: PersonaSeed[] = CAST_BRIEFS.map(expand);

/* ============================================================================
   CHARACTER ARCS.

   The wear log can derive counts, bench states and a year of history, but it
   cannot derive the facts of a life: where a coat came from, what was given
   away whole, what sat on the wishlist through two winters. Those are authored
   here, keyed by persona, and applied by buildPersonaState AFTER the derived
   state so nothing below contradicts the history.

   The arc lights what the numbers alone leave dark: sources and provenance,
   favorites, retire-with-history, and the wishlist's cooling-off still
   mid-wait.

   Colours here are the colours of cloth, like every hex in this file.
   ========================================================================== */

/** A wishlist entry authored in day-offsets; the builder turns them into dates. */
export interface ArcWish {
  name: string;
  category: string;
  color: string;
  brand?: string;
  price?: number;
  priority: 'low' | 'medium' | 'high';
  addedDaysAgo: number;
  status: WishStatus;
  /** Days until the silent wait ends. Negative: it already has. Omitted: no wait (bought). */
  endsInDays?: number;
  asked?: boolean;
  releasedDaysAgo?: number;
  notes?: string;
}

export interface PersonaArc {
  /** Matched against item names. Last match wins, so order general → specific. */
  sources?: Array<[RegExp, ItemSource]>;
  provenance?: Array<[RegExp, { from: string; wearsInTheirRecord?: number; passedOnDaysAgo: number }]>;
  brands?: Array<[RegExp, string]>;
  favorites?: RegExp[];
  /** Pieces that have left the closet. History kept, like the feature promises. */
  retired?: Array<[RegExp, { daysAgo: number; reason: string }]>;
  wishlist?: ArcWish[];
}

export const CAST_ARCS: Record<string, PersonaArc> = {
  /* The owner's own closet. The tailor does not appear in the source enum, so
     the embroidered jacket stays "new" — commissioned, first owner — and the
     tailor lives in the prose. The character hat was a gift; the hooded
     jacket and the graphic tee are road finds. One check shirt has already
     left, and one achkan is cooling off. */
  cofounder: {
    sources: [
      [/character hat/i, 'gifted'],
      [/hooded jacket/i, 'secondhand'],
      [/graphic tee/i, 'secondhand'],
    ],
    favorites: [/embroidered jacket/i, /^Brown character hat$/],
    retired: [
      [/gingham/i, { daysAgo: 38, reason: 'Worn thin at the elbows' }],
    ],
    wishlist: [
      { name: 'Ivory achkan, next wedding season', category: 'layers', color: '#EFE7D3',
        price: 32000, priority: 'high', addedDaysAgo: 16, status: 'waiting',
        endsInDays: 5, asked: false,
        notes: 'The tailor has the cloth already. The wait is doing its work.' },
    ],
  },
};
