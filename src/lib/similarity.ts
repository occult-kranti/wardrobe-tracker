import type { ClothingItem, Category, Occasion } from '../types';

// "Do I already own something like this?" — the engine behind Before You Buy.
// Similarity is deliberately explainable: same category is a hard gate, then
// color closeness, occasion overlap, brand match, and name-word overlap each
// contribute a visible reason. No black boxes — the point is reflection, not
// judgement.

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// "Redmean" perceptual color distance — good accuracy for zero dependencies.
// Range roughly 0 (identical) to ~765 (black vs white).
export function colorDistance(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return Infinity;
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db
  );
}

/** 0..1 where 1 = same color. Distances beyond ~250 count as unrelated. */
export function colorCloseness(hexA: string, hexB: string): number {
  const d = colorDistance(hexA, hexB);
  if (!isFinite(d)) return 0;
  return Math.max(0, 1 - d / 250);
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'my', 'new', 'with', 'and', 'of', 'in']);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t))
  );
}

export interface SimilarityQuery {
  category: Category;
  color: string;
  name?: string;
  brand?: string;
  occasions?: Occasion[];
  /** Exclude an item id (when comparing an owned item against the rest). */
  excludeId?: string;
}

export interface SimilarMatch {
  item: ClothingItem;
  /** 0..1 overall similarity */
  score: number;
  /** Human-readable, honest reasons this matched. */
  reasons: string[];
}

export function findSimilarItems(items: ClothingItem[], query: SimilarityQuery, limit = 4): SimilarMatch[] {
  const qTokens = query.name ? nameTokens(query.name) : new Set<string>();
  const qOccasions = new Set(query.occasions ?? []);

  const matches: SimilarMatch[] = [];
  for (const item of items) {
    if (item.id === query.excludeId) continue;
    if (item.category !== query.category) continue;

    const reasons: string[] = [];
    const closeness = colorCloseness(item.color, query.color);
    if (closeness > 0.75) reasons.push('nearly the same color');
    else if (closeness > 0.5) reasons.push('a similar color');

    let occasionOverlap = 0;
    if (qOccasions.size > 0 && item.occasion.length > 0) {
      const shared = item.occasion.filter(o => qOccasions.has(o));
      occasionOverlap = shared.length / Math.max(qOccasions.size, 1);
      if (shared.length > 0) reasons.push(`worn for the same occasions (${shared.join(', ')})`);
    }

    let brandMatch = 0;
    if (query.brand && item.brand && query.brand.trim().toLowerCase() === item.brand.trim().toLowerCase()) {
      brandMatch = 1;
      reasons.push(`same brand (${item.brand})`);
    }

    let nameOverlap = 0;
    if (qTokens.size > 0) {
      const iTokens = nameTokens(item.name);
      const shared = [...qTokens].filter(t => iTokens.has(t));
      nameOverlap = shared.length / qTokens.size;
      if (shared.length > 0) reasons.push(`described alike ("${shared.join('", "')}")`);
    }

    // Same category alone isn't a match — require at least one real signal.
    const score = 0.5 * closeness + 0.2 * occasionOverlap + 0.15 * brandMatch + 0.15 * nameOverlap;
    if (score >= 0.3 && reasons.length > 0) {
      matches.push({ item, score, reasons });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Supportive framing stats for a matched owned item. */
export function wearContext(item: ClothingItem): string {
  if (item.wearCount === 0) return 'never worn yet';
  const cpw = item.cost && item.wearCount > 0 ? item.cost / item.wearCount : null;
  const wears = `worn ${item.wearCount}×`;
  return cpw !== null ? `${wears} · $${cpw.toFixed(2)}/wear` : wears;
}
