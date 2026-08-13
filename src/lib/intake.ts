/**
 * Photo intake — reading a handoff file written by a vision model.
 *
 * The contract and the prompt that produces this file live in
 * docs/23-photo-intake.md. Nothing here talks to a network: the user runs
 * whatever model they already have, and Toile only reads the JSON.
 *
 * The parser is deliberately forgiving in one direction and strict in the
 * other. Forgiving: unknown keys are ignored, missing optional fields are
 * fine, a category we don't know lands somewhere sane rather than throwing
 * the row away. Strict: nothing is written to the closet without a name, and
 * every guess the model flagged travels with the draft so the review screen
 * can show it. A model is a fast, confident stranger; the record is the
 * owner's, so the last word has to be theirs.
 */

import {
  DEFAULT_CATEGORIES,
  DEFAULT_OCCASIONS,
  PRESET_COLORS,
  SEASON_LABELS,
  type CategoryId,
  type ClothingItem,
  type Occasion,
  type Season,
} from '../types';

/** What the review screen shows for one piece the model found. */
export interface IntakeDraft {
  ref: string;
  name: string;
  category: CategoryId;
  color: string;
  description: string;
  season: Season[];
  occasion: Occasion[];
  brand?: string;
  pattern?: string;
  material?: string;
  confidence: number;
  /** Field names the model said it guessed weakly. */
  uncertain: string[];
  /** Our own notes about what we had to repair while reading the row. */
  repairs: string[];
  photo?: number;
  box?: [number, number, number, number];
  /** Worn photographs only: how much of the piece was visible, 0–1. */
  seen?: number;
  /**
   * What the piece is lying on, judged for one purpose: whether the on-device
   * cutout will work. 'plain' lifts, 'busy' does not, 'none' is already cut.
   */
  background?: 'plain' | 'busy' | 'none';
}

export interface IntakeSkip {
  photo?: number;
  reason: string;
  note?: string;
}

export interface IntakeRead {
  drafts: IntakeDraft[];
  skipped: IntakeSkip[];
  /** Rows we could not use at all, with the reason, so nothing vanishes silently. */
  dropped: Array<{ index: number; reason: string }>;
  photos: Array<{ n: number; note?: string }>;
  capturedAt?: string;
  /** Set when the file came from one outfit worn, rather than a flat lay. */
  worn?: boolean;
  /** The outfit these pieces were worn as, so the day can be saved as one. */
  outfit?: { name: string; occasion: Occasion[] };
  /** Fatal problems with the file itself. When set, drafts is empty. */
  error?: string;
}

const CATEGORY_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id));
const SEASONS = new Set(Object.keys(SEASON_LABELS) as Season[]);
const OCCASIONS = new Set(DEFAULT_OCCASIONS);

/** Words a model reaches for that map onto a category we do have. */
const CATEGORY_SYNONYMS: Record<string, CategoryId> = {
  top: 'tops', shirt: 'tops', shirts: 'tops', tshirt: 'tops', tee: 'tops',
  blouse: 'tops', knitwear: 'tops', sweater: 'tops', jumper: 'tops',
  bottom: 'bottoms', trousers: 'bottoms', pants: 'bottoms', jeans: 'bottoms',
  skirt: 'bottoms', shorts: 'bottoms',
  dress: 'dresses', 'one-piece': 'dresses', onepiece: 'dresses',
  onepieces: 'dresses', jumpsuit: 'dresses', gown: 'dresses', saree: 'dresses',
  layer: 'layers', cardigan: 'layers', hoodie: 'layers', blazer: 'layers',
  jacket: 'outerwear', coat: 'outerwear', outer: 'outerwear',
  shoe: 'shoes', footwear: 'shoes', sneakers: 'shoes', boots: 'shoes',
  jewelry: 'jewellery', jewel: 'jewellery', watch: 'jewellery',
  accessory: 'accessories', bag: 'accessories', bags: 'accessories',
  scarf: 'accessories', hat: 'accessories', belt: 'accessories',
};

const HEX = /^#[0-9a-f]{6}$/i;
const SHORT_HEX = /^#[0-9a-f]{3}$/i;

/** Gendered wording never enters the record; docs/06 §veto. */
const GENDERED = /\b(wom[ae]n'?s|m[ae]n'?s|ladies'?|girls'?|boys'?|unisex|his|hers)\b/gi; // scrubs-gendered

/**
 * Words about a BODY, struck out on the way in.
 *
 * The worn-outfit prompt forbids these at length, and the prompt is the first
 * line of defence — but a prompt is a request and this is a guarantee. A
 * photograph of a person is exactly where a model is most likely to slip into
 * describing the person, and the house rule is absolute: garments, never
 * bodies. So the reader strikes them whatever the model sends, and says it
 * did in "repairs", where the bench shows it.
 */
const ABOUT_A_BODY =
  /\b(flatter(?:ing|s)?|slim(?:ming)?|petite|plus[- ]size|curvy|athletic build|figure|physique|silhouette of (?:her|his|their) \w+|toned|slender|tall|short|young|old|middle[- ]aged|attractive|pretty|handsome|beautiful|elegant[- ]looking|skin tone|complexion|hair)\b/gi; // scrubs-bodies

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(GENDERED, '')
    .replace(ABOUT_A_BODY, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/^[,.;\s]+/, '')
    .trim()
    .slice(0, max);
}

/** Did the reader have to strike something out of this row? */
function saysSomethingAboutABody(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  ABOUT_A_BODY.lastIndex = 0;
  return ABOUT_A_BODY.test(value); // scrubs-bodies
}

function readColor(value: unknown, repairs: string[]): string {
  if (typeof value === 'string') {
    const v = value.trim();
    if (HEX.test(v)) return v.toUpperCase();
    if (SHORT_HEX.test(v)) {
      const [, r, g, b] = v;
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
  }
  repairs.push('colour was not a hex — using the closet default');
  return PRESET_COLORS[0];
}

function readCategory(value: unknown, repairs: string[]): CategoryId {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (CATEGORY_IDS.has(raw as CategoryId)) return raw as CategoryId;
  const mapped = CATEGORY_SYNONYMS[raw.replace(/[\s_]/g, '')];
  if (mapped) {
    repairs.push(`read "${raw}" as ${mapped}`);
    return mapped;
  }
  repairs.push(raw ? `unknown category "${raw}" — filed under accessories` : 'no category given — filed under accessories');
  return 'accessories';
}

function readList<T extends string>(value: unknown, allowed: Set<T>): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const k = v.trim().toLowerCase() as T;
    if (allowed.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

/**
 * Read a handoff file. Never throws: a broken file comes back as an error on
 * the result, because this runs behind a paste box and a crash there tells
 * the user nothing they can act on.
 */
export function readIntake(text: string): IntakeRead {
  const empty: IntakeRead = { drafts: [], skipped: [], dropped: [], photos: [] };

  let data: unknown;
  try {
    // Models like to wrap JSON in a fence even when told not to.
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    data = JSON.parse(stripped);
  } catch {
    return { ...empty, error: 'That is not valid JSON. Paste the whole file, from the first { to the last }.' };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ...empty, error: 'The file should be one JSON object.' };
  }
  const root = data as Record<string, unknown>;

  if (root.toileIntake !== undefined && root.toileIntake !== 1) {
    return { ...empty, error: `This file says it is intake version ${String(root.toileIntake)}; this build reads version 1.` };
  }
  if (!Array.isArray(root.pieces)) {
    return { ...empty, error: 'The file has no "pieces" list.' };
  }

  const drafts: IntakeDraft[] = [];
  const dropped: IntakeRead['dropped'] = [];
  const usedRefs = new Set<string>();

  (root.pieces as unknown[]).forEach((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      dropped.push({ index: i, reason: 'not an object' });
      return;
    }
    const p = raw as Record<string, unknown>;
    const repairs: string[] = [];

    // Struck before anything else, and recorded — a row that described the
    // wearer arrives with that plainly stated rather than quietly cleaned.
    if (saysSomethingAboutABody(p.name) || saysSomethingAboutABody(p.description)) {
      repairs.push('described the person wearing it — struck out; this record is about clothes');
    }

    const name = cleanText(p.name, 60);
    if (!name) {
      dropped.push({ index: i, reason: 'no name — a piece has to be called something' });
      return;
    }

    let ref = typeof p.ref === 'string' && p.ref.trim() ? p.ref.trim() : `p${i + 1}`;
    if (usedRefs.has(ref)) {
      ref = `${ref}-${i + 1}`;
      repairs.push('duplicate ref');
    }
    usedRefs.add(ref);

    const confidenceRaw = typeof p.confidence === 'number' ? p.confidence : NaN;
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : (repairs.push('no confidence given — treated as unsure'), 0.5);

    const season = readList<Season>(p.season, SEASONS);
    const occasion = readList<Occasion>(p.occasion, OCCASIONS);

    const box = Array.isArray(p.box) && p.box.length === 4 && p.box.every(n => typeof n === 'number')
      ? (p.box as number[]).map(n => Math.min(1, Math.max(0, n))) as [number, number, number, number]
      : undefined;

    drafts.push({
      ref,
      name,
      category: readCategory(p.category, repairs),
      color: readColor(p.color, repairs),
      description: cleanText(p.description, 160),
      season,
      occasion,
      brand: cleanText(p.brand, 40) || undefined,
      pattern: cleanText(p.pattern, 30) || undefined,
      material: cleanText(p.material, 30) || undefined,
      confidence,
      uncertain: readList<string>(p.uncertain, new Set(['name', 'category', 'color', 'colour', 'pattern', 'material', 'brand', 'season', 'occasion', 'description'])),
      repairs,
      photo: typeof p.photo === 'number' ? p.photo : undefined,
      box,
      // How much of the garment was actually visible. Only a worn photograph
      // has this; a flat lay shows the whole piece by definition.
      seen: typeof p.seen === 'number' ? Math.min(1, Math.max(0, p.seen)) : undefined,
      background: p.background === 'plain' || p.background === 'busy' || p.background === 'none'
        ? p.background
        : undefined,
    });
  });

  const skipped: IntakeSkip[] = Array.isArray(root.skipped)
    ? (root.skipped as unknown[]).flatMap(s => {
        if (!s || typeof s !== 'object') return [];
        const o = s as Record<string, unknown>;
        const reason = cleanText(o.reason, 80);
        if (!reason) return [];
        return [{
          reason,
          note: cleanText(o.note, 120) || undefined,
          photo: typeof o.photo === 'number' ? o.photo : undefined,
        }];
      })
    : [];

  const photos = Array.isArray(root.photos)
    ? (root.photos as unknown[]).flatMap(x => {
        if (!x || typeof x !== 'object') return [];
        const o = x as Record<string, unknown>;
        return typeof o.n === 'number' ? [{ n: o.n, note: cleanText(o.note, 100) || undefined }] : [];
      })
    : [];

  // The outfit, when the file came from one worn look rather than a flat lay.
  const outfitRaw = root.outfit && typeof root.outfit === 'object'
    ? root.outfit as Record<string, unknown>
    : null;
  const outfitName = outfitRaw ? cleanText(outfitRaw.name, 40) : '';

  return {
    drafts,
    skipped,
    dropped,
    photos,
    capturedAt: typeof root.capturedAt === 'string' ? root.capturedAt : undefined,
    worn: root.worn === true || undefined,
    outfit: outfitName
      ? { name: outfitName, occasion: readList<Occasion>(outfitRaw!.occasion, OCCASIONS) }
      : undefined,
  };
}

/** A draft the review screen has approved, ready for addItem. */
export function draftToItem(
  draft: IntakeDraft
): Omit<ClothingItem, 'id' | 'dateAdded' | 'wearCount' | 'favorite' | 'laundryStatus'> {
  // The description is the one line the model wrote; it becomes the note,
  // because it is an observation about the piece, not a measurement of it.
  const notes = [draft.description, draft.material ? `Material read as ${draft.material}.` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    name: draft.name,
    category: draft.category,
    color: draft.color,
    brand: draft.brand,
    // Catalogued from a photograph of what is already owned: how it arrived
    // is not something a photograph can know, and 'new' is the honest default
    // only the owner can correct.
    source: undefined,
    pattern: draft.pattern,
    material: draft.material,
    // An empty season list means the piece is not restricted to a season.
    season: draft.season,
    occasion: draft.occasion,
    imageUrl: '',
    notes: notes || undefined,
  };
}

/** Names already in the closet, so the review screen can untick repeats. */
export function findDuplicates(drafts: IntakeDraft[], existing: ClothingItem[]): Set<string> {
  const have = new Set(existing.map(i => i.name.trim().toLowerCase()));
  const dupes = new Set<string>();
  for (const d of drafts) if (have.has(d.name.trim().toLowerCase())) dupes.add(d.ref);
  return dupes;
}
