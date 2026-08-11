#!/usr/bin/env node
/**
 * Turns the persona source pack (closet CSVs, lookbooks, calendars, notes) into
 * src/lib/personaData.ts — the seed for the three demo wardrobes.
 *
 * The source is authored by hand as Markdown + CSV; this is the one place that
 * knows those formats. Everything downstream reads the generated TS.
 *
 * Usage: node scripts/build-persona-data.mjs <personas-dir>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/build-persona-data.mjs <personas-dir>');
  process.exit(2);
}

const OUT = new URL('../src/lib/personaData.ts', import.meta.url).pathname;

/* ---------- tiny CSV reader (quoted fields, embedded commas) ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/* ---------- taxonomy mapping ----------
   The source's `category` is a garment class and its `season` column is really a
   context tag. Both are remapped onto the app's model, where categories are
   user-owned data and occasions are free-form. */

const JEWELLERY = /\b(ring|earring|stud|hoop|necklace|chain|pendant|bracelet|bangle|cufflink|jhumka|choker|brooch|watch|kada)\b/i;

const CATEGORY_MAP = {
  top: 'tops', shirt: 'tops', knit: 'layers', layer: 'layers',
  bottom: 'bottoms', footwear: 'shoes', accessory: 'accessories',
  dress: 'dresses', saree: 'drapes', suit: 'suits',
};

const REAL_SEASONS = {
  all: ['spring', 'summer', 'fall', 'winter'],
  summer: ['summer'], winter: ['winter'],
  'spring-summer': ['spring', 'summer'],
  'autumn-winter': ['fall', 'winter'],
  monsoon: ['summer', 'fall'],
  resort: ['spring', 'summer'],
};

/** Context tags that are occasions, not seasons. */
const OCCASION_FROM_SEASON = {
  festive: 'festival', wedding: 'wedding', 'black-tie': 'formal', formal: 'formal',
  work: 'work', gym: 'sport', evening: 'party', travel: 'travel', home: 'home',
  outdoor: 'outdoor', weekend: 'casual',
};

function mapCategory(row) {
  if (row.category === 'accessory' && JEWELLERY.test(row.garment)) return 'jewellery';
  return CATEGORY_MAP[row.category] ?? 'accessories';
}

function mapSeasons(tag) {
  return REAL_SEASONS[tag] ?? ['spring', 'summer', 'fall', 'winter'];
}

/**
 * Cost tiers become figures the Ledger can divide. Kept in the same currency the
 * app formats in — the first pass used rupee magnitudes and the closet rendered
 * "$729.67/WEAR", which is not a number, it is a units bug wearing a dollar sign.
 */
const TIER_COST = { low: [14, 45], mid: [55, 160], high: [210, 640] };
function costFor(tier, seed) {
  const [lo, hi] = TIER_COST[tier] ?? TIER_COST.mid;
  // Deterministic: the same item always carries the same price.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return lo + ((h >>> 0) % (hi - lo + 1));
}

/* ---------- persona notes ---------- */
function parsePersona(md) {
  const line = re => (md.match(re)?.[1] ?? '').trim();
  const bullets = header => {
    const block = md.split(`**${header}:**`)[1];
    if (!block) return [];
    return block.split(/\n\s*\n/)[0].split('\n')
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(l => l && !l.startsWith('**'));
  };
  const numbered = header => {
    const block = md.split(`**${header}:**`)[1];
    if (!block) return [];
    return block.split(/\n\s*\n/)[0].split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  };
  /**
   * The source's colour-season line mixes a palette fact about cloth with a
   * verdict about a person's appearance — "optic white and neon wash him out",
   * "beige drains him". The first half is useful; the second half is a judgement
   * on a body, written with a gendered pronoun, and this app does not make
   * either. Only the palette survives the import.
   *
   * `body` — height, weight, chest/waist/hip — is dropped entirely. A
   * measurement taxonomy is exactly what the panel refused (§1.3), and data that
   * never enters the build cannot leak onto a screen later.
   */
  const seasonLine = line(/\*\*Colour season:\*\* ([^\n]+)/);
  const firstClause = seasonLine.split(/(?<=\.)\s/)[0].replace(/\([^)]*\)/g, '');
  const paletteName = firstClause.split(/\s+[-–]\s+/)[0].trim();
  const afterName = firstClause.split(/\s+[-–]\s+/).slice(1).join(' - ');
  const colours = (afterName.includes(';') ? afterName.split(';').pop() : afterName)
    .replace(/\.$/, '')
    .split(',')
    .map(c => c.trim())
    .filter(c => c && c.split(/\s+/).length <= 3);

  return {
    name: line(/^# PERSONA: (.+)$/m),
    age: line(/\*\*Age:\*\* (\d+)/),
    city: line(/\*\*City:\*\* ([^·\n]+)/),
    job: line(/\*\*Job:\*\* ([^·\n]+)/),
    palette: { name: paletteName, colours },
    philosophy: numbered('Style philosophy \\(3 lines\\)'),
    rules: bullets('Wardrobe rules'),
    neverWears: line(/\*\*Never wears:\*\* ([^\n]+)/).split(/,\s*/).filter(Boolean),
    fragrance: line(/\*\*Fragrance:\*\* ([^\n]+)/),
    icons: line(/\*\*5 style icons:\*\* ([^\n]+)/).split(/,\s*/).filter(Boolean),
  };
}

/* ---------- lookbook: the styling note and the mistake per outfit ---------- */
function parseLookbook(md) {
  const out = {};
  for (const chunk of md.split(/^## /m).slice(1)) {
    const id = chunk.match(/^([A-Z]{2}-\d{2})/)?.[1];
    if (!id) continue;
    const grab = re => (chunk.match(re)?.[1] ?? '').trim();
    out[id] = {
      dna: grab(/\*\*Brand-inspired DNA:\*\*\s*([^\n]+)/),
      note: grab(/\*\*Styling note:\*\*\s*([^\n]+)/),
      mistake: grab(/\*\*Common mistake:\*\*\s*([^\n]+)/),
      colourway: (chunk.match(/\*\*Colourway:\*\*\s*([^\n]+)/)?.[1] ?? '')
        .split('·').map(s => s.replace(/`/g, '').trim()).filter(Boolean),
    };
  }
  return out;
}

/* ---------- calendar: day -> outfit ids ---------- */
function parseCalendar(md) {
  const days = [];
  for (const chunk of md.split(/^## /m).slice(1)) {
    const heading = chunk.split('\n')[0].trim();
    // Week headers in the 14-day calendar carry no outfit of their own.
    const dayBlocks = chunk.split(/^### /m);
    const handle = (label, text) => {
      const day = { label, outfits: [], weather: '', schedule: '' };
      day.weather = (text.match(/\*\*Weather:\*\*\s*([^·\n]+)/)?.[1] ?? '').trim();
      day.schedule = (text.match(/\*\*Schedule:\*\*\s*([^·\n]+)/)?.[1] ?? '').trim();
      // Any labelled look counts — the source uses Outfit / Morning / Day /
      // Evening / Midday second look interchangeably. Outfit ids are exactly
      // two letters, a dash and two digits, so swap lines naming item ids
      // (MK-T11, MK-J04, F09) cannot match by construction.
      for (const m of text.matchAll(/\*\*[^*\n]+:\*\*\s*([A-Z]{2}-\d{2})\b/g)) {
        if (!day.outfits.includes(m[1])) day.outfits.push(m[1]);
      }
      if (day.outfits.length) days.push(day);
    };
    if (dayBlocks.length > 1) {
      for (const b of dayBlocks.slice(1)) handle(b.split('\n')[0].trim(), b);
    } else {
      handle(heading, chunk);
    }
  }
  return days;
}

/* ---------- assemble ---------- */
const master = parseCsv(readFileSync(join(dir, 'MASTER_INDEX.csv'), 'utf8'));
const SLUGS = { 'Aarav Menon': 'aarav', 'Vikram Sethi': 'vikram', 'Meher Kapoor': 'meher' };

const personas = [];
for (const [fullName, slug] of Object.entries(SLUGS)) {
  const notes = parsePersona(readFileSync(join(dir, 'notes', `PERSONA_${slug.toUpperCase()}.md`), 'utf8'));
  const look = parseLookbook(readFileSync(join(dir, 'lookbook', `${slug}_lookbook.md`), 'utf8'));
  const calendar = parseCalendar(readFileSync(join(dir, 'calendar', `${slug}_week.md`), 'utf8'));
  const closet = parseCsv(readFileSync(join(dir, 'closet', `${slug}_closet.csv`), 'utf8'));

  const items = closet.map(r => {
    const seasonTag = r.season;
    const occasion = [];
    if (OCCASION_FROM_SEASON[seasonTag]) occasion.push(OCCASION_FROM_SEASON[seasonTag]);
    return {
      id: r.item_id,
      name: r.garment,
      category: mapCategory(r),
      color: r.hex,
      colour: r.colour,
      fabric: r.fabric,
      fit: r.fit,
      season: mapSeasons(seasonTag),
      occasion,
      cost: costFor(r.cost_tier, r.item_id),
      tier: r.cost_tier,
      outfits: r.outfits_used_in.split(';').map(s => s.trim()).filter(Boolean),
    };
  });

  const outfits = master
    .filter(m => m.persona === fullName)
    .map(m => ({
      id: m.outfit_id,
      name: m.title,
      category: m.category,
      occasion: m.occasion,
      season: m.season,
      time: m.time_of_day,
      weather: m.weather,
      image: `wardrobe/${slug}/${m.outfit_id}.webp`,
      itemIds: items.filter(i => i.outfits.includes(m.outfit_id)).map(i => i.id),
      ...look[m.outfit_id],
    }));

  personas.push({
    id: slug,
    slug,
    name: notes.name || fullName,
    handle: `@${slug}`,
    ...notes,
    // NOT an avatar. This is the persona's own first outfit photograph, shown
    // on the profile as what it is — a look, in its 4:5 frame, with a caption.
    // The identity mark everywhere else stays a garment tag with a monogram,
    // because the contract's line is that this app never puts a face or a body
    // in the place where a person is named.
    leadImage: outfits[0]?.image ?? '',
    leadCaption: outfits[0]?.name ?? '',
    items,
    outfits,
    calendar,
  });
}

const brandManifest = JSON.parse(
  readFileSync(new URL('../public/wardrobe/manifest.json', import.meta.url).pathname, 'utf8')
);

const header = `// GENERATED by scripts/build-persona-data.mjs — do not edit by hand.
//
// Three demo wardrobes, each a complete closet with its own taxonomy, twenty
// specified outfits, and a real week in the calendar. Photographs live under
// public/wardrobe/ and are referenced by relative path: they are far too large
// to inline, and the paths resolve against the built site's own origin, so the
// offline-first promise holds.
//
// ${personas.map(p => `${p.name}: ${p.items.length} pieces, ${p.outfits.length} outfits`).join(' · ')}
`;

writeFileSync(
  OUT,
  `${header}
export interface PersonaItemSeed {
  id: string; name: string; category: string; color: string; colour: string;
  fabric: string; fit: string; season: string[]; occasion: string[];
  cost: number; tier: string; outfits: string[];
}

export interface PersonaOutfitSeed {
  id: string; name: string; category: string; occasion: string; season: string;
  time: string; weather: string; image: string; itemIds: string[];
  dna?: string; note?: string; mistake?: string; colourway?: string[];
}

export interface PersonaCalendarDay {
  label: string; outfits: string[]; weather: string; schedule: string;
}

export interface PersonaSeed {
  id: string; slug: string; name: string; handle: string;
  age: string; city: string; job: string;
  /** A palette of cloth colours. Never a verdict about anyone's appearance. */
  palette: { name: string; colours: string[] };
  philosophy: string[]; rules: string[]; neverWears: string[];
  fragrance: string; icons: string[];
  leadImage: string; leadCaption: string;
  items: PersonaItemSeed[]; outfits: PersonaOutfitSeed[]; calendar: PersonaCalendarDay[];
}

export const PERSONAS: PersonaSeed[] = ${JSON.stringify(personas, null, 1)};

/** Brand reference shots, used as the photo for matching closet pieces. */
export const BRAND_SHOTS: Array<{ slug: string; brand: string; category: string; path: string }> =
  ${JSON.stringify(brandManifest.products, null, 1)};
`
);

console.log(
  personas.map(p => `${p.name}: ${p.items.length} pieces, ${p.outfits.length} outfits, ${p.calendar.length} calendar days`).join('\n')
);
