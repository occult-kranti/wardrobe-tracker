import type { PersonaSeed, PersonaItemSeed, PersonaOutfitSeed, PersonaCalendarDay } from './personaData';
import type { ItemSource, WishStatus } from '../types';

/**
 * FIVE MORE SAMPLE WARDROBES, authored here rather than generated.
 *
 * The first three personas live in personaData.ts, which is emitted by
 * scripts/build-persona-data.mjs from a source pack of CSVs and Markdown. That
 * pack is not in this repository and running the generator without it would
 * delete the three wardrobes it built. So these five are a second file, joined
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
 * here adds an image, and nothing here depicts a costume.
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
      time: o.time, weather: o.weather, image: '', itemIds,
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

/** Filled in by the briefs below. */
export const CAST_BRIEFS: CastBrief[] = [];

/* ============================================================================
   THE FIVE.

   Each is briefed the way a costume department is briefed: the idea, the arc,
   and the garments. No character name, no actor, no film title, no screen-grab.
   The `philosophy` lines carry the lineage in a designer's terms so the thought
   is not lost, and every wardrobe below is generic clothing that thousands of
   real people own — 18th-century tailoring, a hanbok, an iro and buba, a
   rebozo, a white T-shirt.
   ========================================================================== */

CAST_BRIEFS.push({
  id: 'fergus',
  name: 'Fergus Devane',
  handle: '@fergus',
  age: '41',
  city: 'Kilkenny, then the Continent, then Wiltshire',
  job: 'Gambler, soldier, and briefly the master of an English estate',
  palette: { name: 'Candlelight', colours: ['bottle green', 'plum', 'French blue', 'drab', 'silver'] },
  philosophy: [
    'The idea: an Irish tenant farmer\'s son who gambles and marries his way into an English estate between 1760 and 1789, and whose every coat is a receipt for a rung of the ladder.',
    'The wardrobe is a social ladder worn outward. He ascends into the clothes and the manners together, and when the money goes the clothes go first.',
    'Briefed from 18th-century tailoring and museum costume, never from a film.',
  ],
  rules: [
    'A coat is a claim. Never make one you cannot hold for an evening.',
    'Silver galloon at candlelight passes for silver thread. Buy the light, not the metal.',
    'Nothing is sold until the tailor is unpaid twice.',
  ],
  neverWears: ['his own county\'s cut', 'a coat he has been seen in twice at the same table'],
  fragrance: 'orange flower and civet, laid on too heavily and worn out by midnight.',
  icons: ['a dead officer whose coat fitted', 'the plate in a Reynolds portrait', 'his uncle at the card table'],
  lead: { image: 'wardrobe/garment/suit-jacket.webp', caption: 'The bottle-green frock coat' },
  pieces: [
    ['Home-cut wool coat', 'outerwear', 'drab brown', '#6B5B45', 'fulled Irish frieze', 'boxy, short in the arm', ['fall', 'winter'], ['everyday'], 900, 'low'],
    ['Undyed linen shirt', 'tops', 'oatmeal', '#E8E0CE', 'hand-spun linen', 'full through the body', ['spring', 'summer'], ['everyday'], 300, 'low'],
    ['Leather breeches', 'bottoms', 'tan', '#B08D57', 'buckskin', 'close at the knee', ['fall', 'winter'], ['everyday'], 700, 'low'],
    ['Buckled shoes', 'shoes', 'black', '#241F1B', 'waxed calf', 'square toe', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 600, 'low'],
    ['Infantry coat, issued', 'outerwear', 'madder red', '#9E2B25', 'coarse broadcloth, worsted lace', 'issued, cut for nobody', ['spring', 'summer', 'fall', 'winter'], ['work'], 0, 'low'],
    ['Linen stock', 'accessories', 'white', '#F4F1EA', 'starched linen', 'high at the throat', ['spring', 'summer', 'fall', 'winter'], ['work', 'formal'], 120, 'low'],
    ['Dead officer\'s frock coat', 'outerwear', 'bottle green', '#1F3B2C', 'fine broadcloth, silk-lined', 'cut for a taller man, taken in', ['fall', 'winter'], ['formal', 'travel'], 4200, 'high'],
    ['Prussian service coat', 'outerwear', 'dark blue', '#22314F', 'broadcloth', 'severe', ['fall', 'winter'], ['work'], 1800, 'mid'],
    ['Gambler\'s laced coat', 'outerwear', 'plum', '#5A2740', 'silk velvet, silver galloon', 'nipped, skirts flared', ['fall', 'winter'], ['party'], 7600, 'high'],
    ['Embroidered waistcoat', 'layers', 'cream', '#EDE3CE', 'silk faille, floss-silk embroidery', 'long to the thigh', ['spring', 'fall'], ['formal', 'party'], 3400, 'high'],
    ['Sprigged waistcoat', 'layers', 'pale green', '#BFCBB0', 'silk taffeta', 'long to the thigh', ['spring', 'summer'], ['formal'], 2200, 'mid'],
    ['Buff breeches', 'bottoms', 'buff', '#D6C29A', 'kerseymere', 'close at the knee', ['spring', 'fall'], ['formal'], 900, 'mid'],
    ['Paste shoe buckles', 'jewellery', 'silver-white', '#C9CBC8', 'pinchbeck and glass paste', 'oversized', ['spring', 'summer', 'fall', 'winter'], ['party'], 800, 'mid'],
    ['Beaver tricorne hat', 'accessories', 'black', '#2A2621', 'felted beaver', 'three-cornered', ['fall', 'winter'], ['formal', 'travel'], 1500, 'mid'],
    ['Travelling cloak', 'outerwear', 'slate', '#5A5F63', 'boiled wool', 'to the calf', ['fall', 'winter'], ['travel'], 2100, 'mid'],
    ['Court suit jacket', 'layers', 'French blue', '#2F4E7E', 'silk velvet, silver spangles', 'cut close, skirts stiffened', ['spring'], ['formal'], 18000, 'high'],
    ['Sable-lined overcoat', 'outerwear', 'black-brown', '#3B322A', 'wool melton and fur', 'heavy, to the ankle', ['winter'], ['formal', 'travel'], 22000, 'high'],
    ['Banyan robe', 'layers', 'crimson', '#7C2230', 'Indian chintz cotton', 'loose, worn at home', ['spring', 'summer', 'fall', 'winter'], ['home'], 2600, 'mid'],
    ['Riding frock coat', 'outerwear', 'pearl grey', '#B4B2AB', 'twilled wool', 'plain, no lace', ['spring', 'fall'], ['travel'], 3100, 'mid'],
    ['Silk stockings', 'accessories', 'white', '#F0EDE4', 'knit silk', 'to the knee', ['spring', 'summer'], ['formal', 'party'], 400, 'mid'],
    ['Lace ruffles', 'accessories', 'ivory', '#EFE7D6', 'Mechlin lace', 'at the wrist', ['spring', 'summer'], ['formal', 'party'], 1900, 'high'],
    ['Red-heeled shoes', 'shoes', 'black and red', '#2B2320', 'morocco leather', 'high tongue', ['spring', 'summer'], ['formal'], 1400, 'high'],
    ['Riding boots', 'shoes', 'oxblood', '#5A2A22', 'waxed calf', 'above the knee', ['fall', 'winter'], ['travel'], 1700, 'mid'],
    ['Signet ring', 'jewellery', 'gold', '#B8912F', 'gold, carnelian intaglio', 'heavy', ['spring', 'summer', 'fall', 'winter'], ['formal'], 5200, 'high'],
    ['Seal and fob chain', 'jewellery', 'gold', '#C09A34', 'pinchbeck', 'at the waist', ['spring', 'summer', 'fall', 'winter'], ['party'], 900, 'mid'],
    ['Dress sword', 'accessories', 'steel and gilt', '#8A8D8F', 'steel, gilt brass', 'small sword', ['spring', 'summer'], ['formal'], 6400, 'high'],
    ['Kid gloves', 'accessories', 'butter', '#E4D6B4', 'kid leather', 'wrist length', ['spring', 'fall'], ['formal', 'party'], 500, 'mid'],
    ['Malacca cane', 'accessories', 'honey', '#C79A54', 'malacca and gold', 'shoulder height', ['spring', 'summer', 'fall'], ['party'], 2300, 'high'],
    ['Powdered wig', 'accessories', 'white', '#EDEBE4', 'human hair, pomatum and powder', 'tied at the nape', ['spring', 'summer', 'fall', 'winter'], ['formal'], 3000, 'high'],
    ['Mourning coat', 'outerwear', 'plain black', '#1E1C1A', 'worsted', 'unlaced, unlined', ['fall', 'winter'], ['formal'], 1100, 'mid'],
  ],
  outfits: [
    { name: 'The Redcoat\'s Kit', occasion: 'work', season: 'summer', time: 'morning', weather: 'close',
      pieces: ['Infantry coat, issued', 'Undyed linen shirt', 'Buff breeches', 'Buckled shoes', 'Linen stock'],
      note: 'Issued, not owned. It cost nothing and he wore it more than anything he ever bought.' },
    { name: 'The Borrowed Captain', occasion: 'travel', season: 'fall', time: 'afternoon', weather: 'grey',
      pieces: ['Dead officer\'s frock coat', 'Embroidered waistcoat', 'Buff breeches', 'Beaver tricorne hat', 'Paste shoe buckles', 'Travelling cloak'],
      dna: 'A coat cut for a taller man, taken in at the side seams and never quite his.' },
    { name: 'Presented at Court', occasion: 'formal', season: 'spring', time: 'evening', weather: 'fine',
      pieces: ['Court suit jacket', 'Silk stockings', 'Dress sword', 'Lace ruffles', 'Red-heeled shoes', 'Powdered wig'],
      note: 'Worn once. The most expensive thing he ever owned and the worst value in the ledger.' },
  ],
  week: [
    { label: 'Monday', outfits: ['The Borrowed Captain'], weather: 'grey and close', schedule: 'The road to Bath' },
    { label: 'Tuesday', outfits: ['The Borrowed Captain'], weather: 'rain', schedule: 'Cards at the Assembly' },
    { label: 'Wednesday', outfits: [], weather: 'clear', schedule: 'The tailor, unpaid' },
    { label: 'Thursday', outfits: ['Presented at Court'], weather: 'fine', schedule: 'St James\'s' },
    { label: 'Friday', outfits: ['The Borrowed Captain'], weather: 'cold', schedule: 'Supper, and the bailiffs' },
    { label: 'Saturday', outfits: ['Presented at Court'], weather: 'cold', schedule: 'The sale' },
    { label: 'Sunday', outfits: ['The Redcoat\'s Kit'], weather: 'clear', schedule: 'Leaving' },
  ],
});



CAST_BRIEFS.push({
  id: 'amparo',
  name: 'Amparo Silva',
  handle: '@amparo',
  age: '24',
  city: 'Mexico City',
  job: 'Live-in housekeeper',
  palette: { name: 'From pale to grey and back', colours: ['pale blue', 'mint', 'grey', 'black', 'coral'] },
  philosophy: [
    'The idea: a Mixtec-speaking live-in housekeeper in a Mexico City colonia in 1970, whose entire wardrobe hangs on four nails behind a door.',
    'The palette is the plot. It starts light, goes through grey into black as the year turns against her, and comes back to light — but not the same light.',
    'Fourteen garments, all of them worn to the thread. This closet exists to prove the app is decent to somebody who owns almost nothing.',
  ],
  rules: [
    'The household\'s washing first. Hers last, and on a Sunday.',
    'Nothing is thrown away while it can still be mended.',
  ],
  neverWears: ['anything the family gave her in front of the family'],
  fragrance: 'blue soap and wet stone, from the roof where the washing is done.',
  icons: ['her mother\'s hands', 'the women on the roof', 'the rebozo in the trunk'],
  lead: { image: 'wardrobe/garment/pashmina-shawl.webp', caption: 'The rebozo, back out of the trunk' },
  pieces: [
    ['Work smock dress, house-issued', 'dresses', 'pale blue', '#AFC6D8', 'poly-cotton poplin', 'loose, buttoned to the throat', ['spring', 'summer', 'fall', 'winter'], ['work'], 90, 'low'],
    ['Second smock dress', 'dresses', 'mint green', '#B7D2BE', 'poly-cotton poplin', 'loose, buttoned to the throat', ['spring', 'summer', 'fall', 'winter'], ['work'], 90, 'low'],
    ['Sunday blouse', 'tops', 'white', '#F3F1EA', 'cotton, embroidered yoke', 'gathered at the shoulder', ['spring', 'summer'], ['formal'], 220, 'mid'],
    ['Everyday blouse', 'tops', 'pale yellow', '#EDE0B4', 'cotton lawn', 'plain, short sleeve', ['spring', 'summer'], ['everyday'], 110, 'low'],
    ['A-line skirt', 'bottoms', 'navy', '#2C3550', 'gabardine', 'to the knee', ['spring', 'fall'], ['formal', 'everyday'], 160, 'low'],
    ['Cardigan', 'layers', 'cream', '#E5DDC9', 'acrylic knit', 'buttoned, a size too big', ['fall', 'winter'], ['everyday'], 0, 'low'],
    ['Stud earrings', 'jewellery', 'gold-tone', '#C7A85A', 'plated brass', 'small', ['spring', 'summer', 'fall', 'winter'], ['formal'], 40, 'low'],
    ['Rebozo shawl', 'accessories', 'indigo and white', '#2F4058', 'handwoven cotton ikat, knotted fringe', 'long, over one shoulder', ['fall', 'winter'], ['formal', 'everyday'], 380, 'high'],
    ['Grey skirt, let out', 'bottoms', 'grey', '#8E8B86', 'wool blend', 'waistband opened and re-sewn', ['fall', 'winter'], ['everyday'], 140, 'low'],
    ['Maternity smock dress', 'dresses', 'grey-blue', '#8494A2', 'cotton drill', 'bought large on purpose', ['summer', 'fall'], ['everyday'], 120, 'low'],
    ['Black cardigan', 'layers', 'black', '#20201F', 'acrylic knit', 'buttoned to the neck', ['fall', 'winter'], ['everyday'], 130, 'low'],
    ['Rain shell', 'outerwear', 'olive', '#5E6449', 'coated nylon', 'hooded', ['summer', 'fall'], ['everyday'], 210, 'low'],
    ['House sandals', 'shoes', 'brown', '#6E5A44', 'moulded plastic', 'flat', ['spring', 'summer', 'fall', 'winter'], ['home', 'work'], 35, 'low'],
    ['Street shoes', 'shoes', 'black', '#232120', 'leather, low heel', 'closed toe', ['spring', 'summer', 'fall', 'winter'], ['formal'], 280, 'mid'],
    ['Hair combs', 'accessories', 'tortoiseshell', '#6B4A2A', 'plastic', 'a pair', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 20, 'low'],
    ['New blouse', 'tops', 'coral', '#D97C6A', 'cotton', 'the first thing she chose herself', ['spring', 'summer'], ['formal'], 240, 'mid'],
  ],
  outfits: [
    { name: 'The Roof, Monday', occasion: 'work', season: 'spring', time: 'morning', weather: 'bright',
      pieces: ['Work smock dress, house-issued', 'House sandals', 'Hair combs'],
      note: 'The household\'s washing goes up first. Hers waits for Sunday.' },
    { name: 'The Cinema, August', occasion: 'formal', season: 'summer', time: 'evening', weather: 'warm',
      pieces: ['Sunday blouse', 'A-line skirt', 'Cardigan', 'Street shoes', 'Stud earrings'] },
    { name: 'The Beach, October', occasion: 'travel', season: 'fall', time: 'afternoon', weather: 'wind off the sea',
      pieces: ['Maternity smock dress', 'Grey skirt, let out', 'Rebozo shawl', 'House sandals'],
      dna: 'The rebozo came out of the trunk for one day and went back in.' },
  ],
  week: [
    { label: 'Monday', outfits: ['The Roof, Monday'], weather: 'bright', schedule: 'Washing' },
    { label: 'Tuesday', outfits: ['The Roof, Monday'], weather: 'bright', schedule: 'The market' },
    { label: 'Wednesday', outfits: ['The Roof, Monday'], weather: 'rain', schedule: 'Ironing' },
    { label: 'Thursday', outfits: ['The Roof, Monday'], weather: 'grey', schedule: 'The children' },
    { label: 'Friday', outfits: ['The Roof, Monday'], weather: 'grey', schedule: 'Washing' },
    { label: 'Saturday', outfits: ['The Cinema, August'], weather: 'warm', schedule: 'The cinema' },
    { label: 'Sunday', outfits: ['The Beach, October'], weather: 'warm', schedule: 'Her own washing, last' },
  ],
});

CAST_BRIEFS.push({
  id: 'boksoon',
  name: 'Jung Bok-soon',
  handle: '@boksoon',
  age: '31',
  city: 'An island near Busan, then Ikaino, Osaka',
  job: 'Boarding-house cook, then a market stall',
  palette: { name: 'Salt and indigo', colours: ['undyed', 'indigo', 'persimmon', 'charcoal', 'olive drab'] },
  philosophy: [
    'The idea: a boarding-house cook\'s daughter from a fishing island near Busan who marries north to Osaka in 1933, and whose hanbok turns into a Japanese housedress one piece at a time.',
    'The chima goes first, replaced by a dark wool skirt for the street; the jeogori is kept for indoors. The hanbok is not abandoned. It is retreated from, garment by garment.',
    'Cotton, hemp and ramie, deliberately humble — they move differently from silk and the difference is the point.',
  ],
  rules: [
    'What is mended is not poor. What is unmended is.',
    'The good jeogori is not for wearing. It is for keeping.',
  ],
  neverWears: ['the good silk, after 1936'],
  fragrance: 'sea salt in a hem that has been washed out of it.',
  icons: ['her mother at the loom', 'the women on the ferry', 'a bojagi that holds everything'],
  lead: { image: 'wardrobe/garment/in-salwar-kameez.webp', caption: 'The lilac jeogori, wrapped' },
  pieces: [
    ['Everyday jeogori', 'tops', 'undyed', '#E6DFCD', 'hand-woven ramie', 'short, tied with goreum', ['spring', 'summer'], ['everyday'], 300, 'low'],
    ['Working chima', 'bottoms', 'indigo', '#2E3F57', 'crushed cotton', 'wrapped, high-waisted', ['spring', 'summer', 'fall'], ['everyday', 'work'], 320, 'low'],
    ['Good jeogori, her mother\'s', 'tops', 'pale lilac', '#C3B4CB', 'silk, rose goreum ribbon', 'short, narrow sleeve', ['spring'], ['formal'], 1900, 'high'],
    ['Winter chima, padded', 'bottoms', 'persimmon', '#C4643C', 'cotton with cotton wadding', 'wrapped, heavy', ['winter'], ['everyday'], 480, 'mid'],
    ['Beoseon socks', 'accessories', 'white', '#F2EFE6', 'quilted cotton', 'pointed at the toe', ['fall', 'winter'], ['everyday'], 60, 'low'],
    ['Gomusin rubber shoes', 'shoes', 'black', '#22201E', 'moulded rubber', 'curved at the toe', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 90, 'low'],
    ['Silver binyeo hairpin', 'jewellery', 'silver', '#B9BDBE', 'silver', 'through the coil', ['spring', 'summer', 'fall', 'winter'], ['formal'], 700, 'mid'],
    ['Durumagi overcoat', 'outerwear', 'charcoal', '#3C3B39', 'lined hemp', 'to the calf, tied', ['fall', 'winter'], ['travel', 'formal'], 900, 'mid'],
    ['Street skirt', 'bottoms', 'dark navy', '#26304A', 'wool serge', 'straight, below the knee', ['fall', 'winter'], ['everyday', 'work'], 420, 'mid'],
    ['Cotton blouse', 'tops', 'oatmeal', '#DED5C0', 'cotton poplin', 'collared, buttoned', ['spring', 'summer', 'fall'], ['everyday', 'work'], 260, 'low'],
    ['Secondhand wool coat', 'outerwear', 'mole brown', '#6B5C4E', 'carded wool, re-cuffed', 'boxy, cuffs turned', ['winter'], ['everyday'], 340, 'low'],
    ['Apron, tied', 'layers', 'grey check', '#9A9B94', 'cotton', 'over everything', ['spring', 'summer', 'fall', 'winter'], ['work'], 70, 'low'],
    ['Geta clogs', 'shoes', 'pale wood', '#C4A882', 'paulownia, cotton thongs', 'raised', ['spring', 'summer'], ['everyday'], 150, 'low'],
    ['Bojagi wrapping cloth', 'accessories', 'patchwork', '#8E7B6B', 'scrap silk and ramie', 'knotted', ['spring', 'summer', 'fall', 'winter'], ['home'], 0, 'low'],
    ['Monpe work trousers', 'bottoms', 'olive drab', '#6A6B4C', 'cotton, gathered at the ankle', 'wide, tied at the waist', ['spring', 'summer', 'fall', 'winter'], ['work'], 180, 'low'],
    ['Padded vest', 'layers', 'dull green', '#5D6650', 'cotton wadding', 'sleeveless, tied', ['winter'], ['everyday'], 220, 'low'],
    ['Mourning hanbok, over-dyed', 'dresses', 'black over white', '#2B2A28', 'cotton', 'dyed a second time', ['fall', 'winter'], ['formal'], 260, 'low'],
    ['Work boots', 'shoes', 'oxblood', '#5B2E26', 'split leather', 'laced to the ankle', ['fall', 'winter'], ['work'], 300, 'low'],
    ['Headscarf', 'accessories', 'faded indigo', '#4A5A6E', 'cotton', 'tied behind', ['spring', 'summer', 'fall', 'winter'], ['work'], 40, 'low'],
    ['Winter shawl', 'accessories', 'dust grey', '#9C978D', 'wool, felted at the edge', 'square, folded', ['winter'], ['everyday'], 190, 'low'],
  ],
  outfits: [
    { name: 'The Boarding House Kitchen', occasion: 'work', season: 'summer', time: 'morning', weather: 'humid',
      pieces: ['Everyday jeogori', 'Working chima', 'Beoseon socks', 'Gomusin rubber shoes', 'Apron, tied'] },
    { name: 'Crossing to Osaka', occasion: 'travel', season: 'spring', time: 'morning', weather: 'cold off the water',
      pieces: ['Good jeogori, her mother\'s', 'Winter chima, padded', 'Durumagi overcoat', 'Gomusin rubber shoes', 'Silver binyeo hairpin'],
      dna: 'The last day the whole hanbok was worn as one thing.' },
    { name: 'Ikaino Market', occasion: 'work', season: 'fall', time: 'morning', weather: 'grey',
      pieces: ['Cotton blouse', 'Monpe work trousers', 'Apron, tied', 'Secondhand wool coat', 'Work boots'],
      note: 'Nine years later. Nothing on her is from home except the headscarf.' },
  ],
  week: [
    { label: 'Monday', outfits: ['Ikaino Market'], weather: 'grey', schedule: 'The stall' },
    { label: 'Tuesday', outfits: ['Ikaino Market'], weather: 'rain', schedule: 'The stall' },
    { label: 'Wednesday', outfits: ['Ikaino Market'], weather: 'cold', schedule: 'Mending' },
    { label: 'Thursday', outfits: ['Ikaino Market'], weather: 'cold', schedule: 'The stall' },
    { label: 'Friday', outfits: ['Ikaino Market'], weather: 'clear', schedule: 'The stall' },
    { label: 'Saturday', outfits: ['The Boarding House Kitchen'], weather: 'clear', schedule: 'Cooking for the house' },
    { label: 'Sunday', outfits: ['Crossing to Osaka'], weather: 'clear', schedule: 'Washing, and the trunk stays shut' },
  ],
});

CAST_BRIEFS.push({
  id: 'ngozi',
  name: 'Ngozi Achara',
  handle: '@ngozi',
  age: '33',
  city: 'Lagos, then Nsukka, then Umuahia',
  job: 'Lecturer in sociology',
  palette: { name: 'Bright, then earth', colours: ['cobalt', 'coral', 'lemon', 'indigo', 'brown'] },
  philosophy: [
    'The idea: a London-educated sociology lecturer in an eastern Nigerian university town in 1966, whose forty-eight-piece wardrobe becomes twelve in eighteen months.',
    'Two palettes running side by side: the traditional pieces in earth — greens, beiges, browns — and the western ones bright. The war does not only take her clothes away; it moves her whole wardrobe into the earth column.',
    'Sheath, shift and fit-and-flare, at or below the knee. She refuses the mini the decade is wearing.',
  ],
  rules: [
    'The gele is tied by her own hands or not at all.',
    'What is given away is given away whole, never cut up first.',
  ],
  neverWears: ['a hem above the knee', 'another woman\'s coral'],
  fragrance: 'bergamot and dust on a hot verandah.',
  icons: ['her mother\'s coral', 'the women in the faculty common room', 'a photograph taken in 1963'],
  lead: { image: 'wardrobe/garment/in-banarasi-silk-saree.webp', caption: 'The george wrapper, before' },
  pieces: [
    ['Wax-print sheath dress', 'dresses', 'cobalt and white', '#2B4C9B', 'wax-print cotton', 'sheath, at the knee', ['spring', 'summer'], ['work', 'party'], 3200, 'mid'],
    ['Lace buba blouse', 'tops', 'powder blue', '#B9CBDE', 'cotton guipure lace', 'wide sleeve, gathered', ['spring', 'summer'], ['formal'], 4100, 'high'],
    ['George wrapper', 'bottoms', 'bottle green and gold', '#1E4436', 'george brocade', 'wrapped twice', ['spring', 'summer', 'fall', 'winter'], ['formal'], 8600, 'high'],
    ['Aso-oke gele', 'accessories', 'rust orange', '#B4552C', 'hand-woven aso-oke', 'tied high', ['spring', 'summer', 'fall', 'winter'], ['formal'], 2400, 'high'],
    ['Coral necklace, four strands', 'jewellery', 'deep coral', '#C2543F', 'coral with brass spacers', 'at the collarbone', ['spring', 'summer', 'fall', 'winter'], ['formal'], 0, 'high'],
    ['Court shoes', 'shoes', 'oxblood', '#5E2A24', 'patent leather', 'low heel, pointed', ['spring', 'summer', 'fall'], ['work', 'formal'], 2900, 'mid'],
    ['Fit-and-flare day dress', 'dresses', 'lemon', '#E4CE6B', 'cotton poplin', 'fitted, flared at the knee', ['spring', 'summer'], ['work'], 2100, 'mid'],
    ['Lace wedding dress', 'dresses', 'ivory', '#EFE7D8', 'chantilly lace over satin', 'long sleeve, to the floor', ['spring'], ['formal'], 14000, 'high'],
    ['Capri trousers', 'bottoms', 'black', '#232221', 'cotton sateen', 'narrow, cropped', ['spring', 'summer'], ['everyday'], 1200, 'mid'],
    ['Brass bangles', 'jewellery', 'brass', '#B5893E', 'cast brass', 'a stack of six', ['spring', 'summer', 'fall', 'winter'], ['formal', 'party'], 800, 'mid'],
    ['Drop earrings', 'jewellery', 'gold', '#C4A24A', 'gold', 'long', ['spring', 'summer'], ['party'], 3600, 'high'],
    ['Everyday wrapper', 'bottoms', 'indigo and brown', '#3B3A4E', 'batik-dyed cotton', 'wrapped once', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 900, 'low'],
    ['Plain blouse', 'tops', 'bone', '#E3DDCF', 'cotton voile', 'short sleeve', ['spring', 'summer'], ['everyday'], 600, 'low'],
    ['Rubber slippers', 'shoes', 'blue', '#3E5C86', 'moulded rubber', 'flat', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 60, 'low'],
    ['Headscarf', 'accessories', 'faded ochre', '#B08B4C', 'plain cotton', 'tied behind', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 90, 'low'],
    ['Raincoat', 'outerwear', 'olive', '#5B6349', 'rubberised cotton', 'belted', ['summer', 'fall'], ['travel'], 1800, 'mid'],
    ['Cardigan, re-knit', 'layers', 'grey-brown', '#7C7166', 'hand-spun wool', 'unravelled once and knitted again', ['fall', 'winter'], ['everyday'], 0, 'low'],
    ['Skirt cut from a wrapper', 'bottoms', 'brown, washed pale', '#93826D', 'cotton', 'straight, hemmed by hand', ['spring', 'summer', 'fall'], ['everyday'], 0, 'low'],
    ['Canvas shoes', 'shoes', 'dust', '#B6AC98', 'canvas and rubber', 'lace-up', ['spring', 'summer', 'fall'], ['everyday'], 300, 'low'],
    ['One strand of coral', 'jewellery', 'coral', '#C2543F', 'coral', 'the last one', ['spring', 'summer', 'fall', 'winter'], ['formal'], 0, 'high'],
    ['Silk headtie', 'accessories', 'emerald', '#2A6B4F', 'silk', 'tied low', ['spring', 'summer'], ['formal'], 1600, 'mid'],
    ['Wool coat', 'outerwear', 'camel', '#B08E5E', 'wool melton', 'from London, never warm enough there', ['winter'], ['travel'], 5200, 'high'],
    ['Gold wristwatch', 'jewellery', 'gold', '#C0A24A', 'gold-plated steel', 'small face', ['spring', 'summer', 'fall', 'winter'], ['work'], 4400, 'high'],
    ['Leather sandals', 'shoes', 'tan', '#A87F4E', 'leather', 'flat, two straps', ['spring', 'summer'], ['everyday'], 700, 'low'],
    ['Cotton nightdress', 'dresses', 'white', '#EFEDE5', 'cotton lawn', 'long', ['spring', 'summer', 'fall', 'winter'], ['home'], 400, 'low'],
    ['Beaded clutch', 'accessories', 'jet', '#26241F', 'glass beads on canvas', 'small, framed', ['spring', 'summer'], ['party'], 2200, 'mid'],
  ],
  outfits: [
    { name: 'Faculty Party, Nsukka', occasion: 'party', season: 'summer', time: 'evening', weather: 'hot and still',
      pieces: ['Wax-print sheath dress', 'Court shoes', 'Coral necklace, four strands', 'Beaded clutch', 'Drop earrings'] },
    { name: 'The Road East', occasion: 'travel', season: 'summer', time: 'morning', weather: 'heat',
      pieces: ['Everyday wrapper', 'Plain blouse', 'Headscarf', 'Rubber slippers'],
      dna: 'The coral is knotted into the wrapper, not worn.' },
    { name: 'Rations Day, Umuahia', occasion: 'everyday', season: 'fall', time: 'afternoon', weather: 'dry',
      pieces: ['Skirt cut from a wrapper', 'Cardigan, re-knit', 'Canvas shoes', 'One strand of coral'],
      note: 'Twelve pieces left. Three of them used to be one wrapper.' },
  ],
  week: [
    { label: 'Monday', outfits: ['Rations Day, Umuahia'], weather: 'dry', schedule: 'The queue' },
    { label: 'Tuesday', outfits: ['Rations Day, Umuahia'], weather: 'dry', schedule: 'Teaching, unpaid' },
    { label: 'Wednesday', outfits: ['The Road East'], weather: 'heat', schedule: 'Moving again' },
    { label: 'Thursday', outfits: ['Rations Day, Umuahia'], weather: 'rain', schedule: 'Mending' },
    { label: 'Friday', outfits: ['Rations Day, Umuahia'], weather: 'rain', schedule: 'The queue' },
    { label: 'Saturday', outfits: ['The Road East'], weather: 'clear', schedule: 'Washing' },
    { label: 'Sunday', outfits: ['Faculty Party, Nsukka'], weather: 'clear', schedule: 'A wedding, somehow' },
  ],
});

CAST_BRIEFS.push({
  id: 'nico',
  name: 'Nico Faretta',
  handle: '@nico',
  age: '34',
  city: 'Chicago (Near West Side)',
  job: 'Chef, running the family sandwich shop',
  palette: { name: 'Whites and blacks', colours: ['chalk white', 'black', 'workwear blue', 'indigo', 'charcoal'] },
  philosophy: [
    'The idea: a fine-dining chef who comes home to run the family sandwich shop, and owns nine identical white T-shirts and one apron he will not replace.',
    'A creature of habit who pays close attention to what he puts on his body, where he got it and what the quality is like — and then buys the same thing nine times.',
    'The hardest closet a wear tracker can be given: nine pieces that share a name, a photograph and a laundry cycle.',
  ],
  rules: [
    'One shirt, bought nine times. Decide once.',
    'The apron is not replaced. It is patched.',
  ],
  neverWears: ['a logo', 'anything that cannot go in the wash at sixty'],
  fragrance: 'smoke, onion, and the soap that does not quite take it off.',
  icons: ['his brother', 'the line at four in the afternoon', 'a Copenhagen stage that nearly broke him'],
  lead: { image: 'wardrobe/garment/hoodie-oversized.webp', caption: 'The nine tees' },
  pieces: [
    ['Heavyweight tee, one of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, two of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, three of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, four of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, five of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, six of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, seven of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, eight of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Heavyweight tee, nine of nine', 'tops', 'chalk white', '#F2F1EC', '240gsm loopwheeled cotton', 'boxy, short sleeve', ['spring', 'summer', 'fall', 'winter'], ['work'], 8500, 'high'],
    ['Chef\'s jacket', 'layers', 'bone white', '#EDEAE0', 'double-breasted cotton drill', 'pressed, cuffs turned', ['spring', 'summer', 'fall', 'winter'], ['work'], 12000, 'high'],
    ['Long bistro apron', 'layers', 'natural', '#D8CDB4', 'waxed cotton canvas', 'to the ankle', ['spring', 'summer', 'fall', 'winter'], ['work'], 6800, 'mid'],
    ['Shop apron', 'layers', 'workwear blue', '#3F5A78', 'cotton duck, patched at the hip', 'to the knee, ties doubled', ['spring', 'summer', 'fall', 'winter'], ['work'], 0, 'low'],
    ['Work trousers', 'bottoms', 'black', '#232322', '11oz cotton twill, triple-stitched', 'straight, cropped at the ankle', ['spring', 'summer', 'fall', 'winter'], ['work'], 9500, 'mid'],
    ['Second work trousers', 'bottoms', 'charcoal', '#3A3A38', 'cotton twill', 'straight', ['spring', 'summer', 'fall', 'winter'], ['work'], 9500, 'mid'],
    ['Kitchen clogs', 'shoes', 'matte black', '#1E1E1D', 'moulded rubber', 'closed, non-slip', ['spring', 'summer', 'fall', 'winter'], ['work'], 7200, 'mid'],
    ['Work sneakers', 'shoes', 'off-white', '#E6E2D8', 'leather, non-slip sole', 'low', ['spring', 'summer', 'fall', 'winter'], ['work', 'everyday'], 11000, 'mid'],
    ['Denim jacket', 'layers', 'mid indigo', '#3E5470', '12.5oz selvedge denim', 'boxy', ['spring', 'fall'], ['everyday'], 14000, 'high'],
    ['Flannel overshirt', 'layers', 'red and black check', '#8C3A32', 'brushed cotton', 'worn open', ['fall', 'winter'], ['everyday'], 5400, 'mid'],
    ['Grey marl tee', 'tops', 'heather grey', '#A5A49E', 'cotton jersey', 'boxy', ['spring', 'summer'], ['everyday'], 3200, 'low'],
    ['Ribbed beanie', 'accessories', 'navy', '#28324A', 'ribbed merino', 'cuffed', ['fall', 'winter'], ['everyday'], 3800, 'mid'],
    ['Rolled bandana', 'accessories', 'indigo', '#31456B', 'cotton', 'rolled and tied', ['spring', 'summer', 'fall', 'winter'], ['work'], 1200, 'low'],
    ['Steel dive watch', 'jewellery', 'steel', '#9BA0A3', 'steel', 'on a bracelet', ['spring', 'summer', 'fall', 'winter'], ['everyday'], 42000, 'high'],
    ['Brother\'s oxford shirt', 'tops', 'pale blue', '#BDCBDC', 'oxford cotton, frayed collar', 'a size too big', ['spring', 'fall'], ['formal'], 0, 'mid'],
    ['Wool overcoat', 'outerwear', 'charcoal', '#3B3C3E', 'wool melton', 'single-breasted, to the knee', ['winter'], ['formal'], 38000, 'high'],
  ],
  outfits: [
    { name: 'Service, the Shop', occasion: 'work', season: 'summer', time: 'afternoon', weather: 'hot in the kitchen',
      pieces: ['Heavyweight tee, one of nine', 'Work trousers', 'Shop apron', 'Kitchen clogs', 'Rolled bandana'],
      note: 'Worn, washed, worn again. The same outfit two hundred times with a different tee in it.' },
    { name: 'Stage, Copenhagen', occasion: 'work', season: 'winter', time: 'morning', weather: 'dark at eight',
      pieces: ['Chef\'s jacket', 'Long bistro apron', 'Work trousers', 'Kitchen clogs'],
      dna: 'The whites. Pressed by him, at five in the morning, for two years.' },
    { name: 'The Review', occasion: 'formal', season: 'winter', time: 'evening', weather: 'cold',
      pieces: ['Brother\'s oxford shirt', 'Second work trousers', 'Wool overcoat', 'Work sneakers', 'Steel dive watch'],
      note: 'The coat sat on the wishlist through two winters and was bought the week the review came out.' },
  ],
  week: [
    { label: 'Monday', outfits: ['Stage, Copenhagen'], weather: 'cold', schedule: 'Closed. Ordering.' },
    { label: 'Tuesday', outfits: ['Service, the Shop'], weather: 'cold', schedule: 'Service' },
    { label: 'Wednesday', outfits: ['Service, the Shop'], weather: 'snow', schedule: 'Service' },
    { label: 'Thursday', outfits: ['Service, the Shop'], weather: 'snow', schedule: 'Service' },
    { label: 'Friday', outfits: ['Service, the Shop'], weather: 'clear', schedule: 'Service, and the wash' },
    { label: 'Saturday', outfits: ['Service, the Shop'], weather: 'clear', schedule: 'Service' },
    { label: 'Sunday', outfits: ['The Review'], weather: 'cold', schedule: 'Dinner, somewhere else' },
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

   Between the five of them the arcs light every feature the numbers alone
   leave dark: sources and provenance, favorites, retire-with-history, and all
   four endings of the wishlist's cooling-off (waiting, the expired ask, kept,
   let go into "stayed yours", bought).

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
  /* The ledger's cautionary tale: the sale, the worn-once court suit, and a
     wishlist the bailiffs got to first. */
  fergus: {
    sources: [
      [/Dead officer's frock coat/, 'secondhand'],
      [/Infantry coat, issued/, 'gifted'],
    ],
    favorites: [/Court suit jacket/],
    retired: [
      [/Sable-lined overcoat/, { daysAgo: 20, reason: 'Sold at the sale' }],
      [/Gambler's laced coat/, { daysAgo: 20, reason: 'Sold at the sale' }],
      [/Malacca cane/, { daysAgo: 19, reason: 'Sold at the sale' }],
    ],
    wishlist: [
      { name: 'Marten-lined travelling cloak', category: 'outerwear', color: '#4A3B2E',
        price: 26000, priority: 'high', addedDaysAgo: 34, status: 'waiting',
        endsInDays: -8, asked: false,
        notes: 'The furrier will hold it a month. The bailiffs may not.' },
      { name: 'A second dress sword', category: 'accessories', color: '#8A8D8F',
        price: 7200, priority: 'low', addedDaysAgo: 90, status: 'let-go',
        endsInDays: -76, asked: true, releasedDaysAgo: 75,
        notes: 'One is enough to be seen wearing.' },
      { name: 'Court suit jacket', category: 'layers', color: '#2F4E7E',
        price: 18000, priority: 'high', addedDaysAgo: 260, status: 'bought',
        notes: 'Worn once. The ledger keeps the score.' },
    ],
  },

  /* Sixteen pieces, and a blouse being saved for. The smallest closet carries
     the live cooling-off. */
  amparo: {
    sources: [
      [/house-issued|Second smock/, 'gifted'],
      [/^Cardigan$/, 'gifted'],
      [/Rebozo/, 'inherited'],
    ],
    provenance: [
      [/Rebozo/, { from: 'her mother', passedOnDaysAgo: 2200 }],
    ],
    favorites: [/Rebozo/, /New blouse/],
    wishlist: [
      { name: 'Blouse for the wedding', category: 'tops', color: '#E8D8C8',
        price: 260, priority: 'high', addedDaysAgo: 9, status: 'waiting',
        endsInDays: 6, asked: false,
        notes: 'Her sister marries in October. Saving from this month\'s wages.' },
      { name: 'Patent shoes in the arcade window', category: 'shoes', color: '#1E1B19',
        price: 320, priority: 'low', addedDaysAgo: 40, status: 'let-go',
        endsInDays: -33, asked: true, releasedDaysAgo: 33,
        notes: 'The street shoes still shine up.' },
      { name: 'New blouse', category: 'tops', color: '#D97C6A',
        price: 240, priority: 'medium', addedDaysAgo: 120, status: 'bought',
        notes: 'The coral one. The first thing she chose herself.' },
    ],
  },

  /* Nothing retires here, and that is the point: what is mended is not poor.
     The wishlist keeps one hope and lets one duplicate go. */
  boksoon: {
    sources: [
      [/Bojagi/, 'self-made'],
      [/Mourning hanbok/, 'self-made'],
      [/Apron/, 'self-made'],
      [/Good jeogori/, 'inherited'],
      [/Secondhand wool coat/, 'secondhand'],
    ],
    provenance: [
      [/Good jeogori/, { from: 'her mother', passedOnDaysAgo: 4400 }],
    ],
    favorites: [/Good jeogori/, /Silver binyeo/],
    wishlist: [
      { name: 'Silk for a new goreum ribbon', category: 'accessories', color: '#C48CA0',
        price: 120, priority: 'medium', addedDaysAgo: 30, status: 'kept',
        endsInDays: -23, asked: true,
        notes: 'The good jeogori is not for wearing. The ribbon can still be new.' },
      { name: 'A second padded vest', category: 'layers', color: '#5D6650',
        price: 240, priority: 'low', addedDaysAgo: 55, status: 'let-go',
        endsInDays: -48, asked: true, releasedDaysAgo: 47,
        notes: 'The first one can be re-wadded.' },
    ],
  },

  /* Forty-eight pieces becoming twelve. Retirement is the story, and what is
     given away is given away whole. */
  ngozi: {
    sources: [
      [/coral/i, 'inherited'],
      [/Skirt cut from a wrapper/, 'self-made'],
      [/Cardigan, re-knit/, 'self-made'],
    ],
    provenance: [
      [/Coral necklace/, { from: 'her mother', passedOnDaysAgo: 3300 }],
    ],
    favorites: [/One strand of coral/],
    retired: [
      [/Lace wedding dress/, { daysAgo: 88, reason: 'Given away whole' }],
      [/Wool coat/, { daysAgo: 74, reason: 'Given away whole' }],
      [/Capri trousers/, { daysAgo: 61, reason: 'Given away whole' }],
    ],
    wishlist: [
      { name: 'A bolt of george, for after', category: 'bottoms', color: '#1E4436',
        priority: 'high', addedDaysAgo: 70, status: 'kept',
        endsInDays: -63, asked: true,
        notes: 'For after.' },
      { name: 'Gele, the good kind', category: 'accessories', color: '#B4552C',
        price: 2400, priority: 'low', addedDaysAgo: 100, status: 'let-go',
        endsInDays: -93, asked: true, releasedDaysAgo: 92,
        notes: 'The rust one still ties.' },
    ],
  },

  /* Decide once, buy it nine times. The overcoat that waited two winters is
     the wishlist's proof that the cooling-off is a wait, not a wall. */
  nico: {
    sources: [
      [/Brother's oxford/, 'gifted'],
      [/Shop apron/, 'inherited'],
    ],
    provenance: [
      [/Brother's oxford/, { from: 'his brother', wearsInTheirRecord: 61, passedOnDaysAgo: 700 }],
    ],
    brands: [
      [/Heavyweight tee/, 'Camber'],
      [/Work trousers|Second work trousers/, 'Stan Ray'],
      [/Kitchen clogs/, 'Birkenstock'],
      [/Steel dive watch/, 'Seiko'],
    ],
    favorites: [/Shop apron/, /Steel dive watch/],
    wishlist: [
      { name: 'Wool overcoat', category: 'outerwear', color: '#3B3C3E',
        price: 38000, priority: 'high', addedDaysAgo: 750, status: 'bought',
        notes: 'Two winters on the list. Bought the week the review ran.' },
      { name: 'A tenth tee', category: 'tops', color: '#F2F1EC', brand: 'Camber',
        price: 8500, priority: 'low', addedDaysAgo: 21, status: 'let-go',
        endsInDays: -14, asked: true, releasedDaysAgo: 14,
        notes: 'Nine is exactly enough.' },
      { name: 'White canvas high-tops', category: 'shoes', color: '#E9E6DC',
        price: 9800, priority: 'medium', addedDaysAgo: 3, status: 'waiting',
        endsInDays: 4, asked: false,
        notes: 'For days off, if those start happening.' },
    ],
  },
};
