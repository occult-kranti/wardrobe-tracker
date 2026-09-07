import { readIntake } from '@almari/shared/intake';
import { DEFAULT_CATEGORIES, type ClothingItem, type UserCategory } from '@almari/shared/types';
import { todayLocal } from '@almari/shared/dates';
import { INTAKE_PROMPT, OUTFIT_PROMPT } from '../../lib/intakePrompt';
import { buildStylistPrompt, parseStyleSuggestion, type EventBrief, type StyleWeather, type StyleSuggestion } from '../../lib/eventStylist';

export type WorkbenchMode = 'flatlay' | 'worn' | 'event' | 'custom';
export interface BenchImage {
  name: string;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
  base64: string;
  dataUrl: string;
}
export interface BenchPiece {
  ref: string;
  name: string;
  description: string;
  confidence: number;
  uncertain: string[];
  box: [number, number, number, number] | null;
  crop?: string;
}
export interface BenchAnalysis {
  status: 'valid' | 'review' | 'invalid' | 'unstructured';
  summary: string;
  issues: string[];
  pieces: BenchPiece[];
  suggestion?: StyleSuggestion;
}

export const EVENT_EXAMPLE = JSON.stringify({
  event: { event: 'An evening gallery opening', date: todayLocal(), time: '18:00', dressCode: 'Smart casual', setting: 'mixed', preferences: 'Comfortable for walking and standing.' },
  weather: { source: 'manual', summary: '24°C at arrival; cloudy with a light breeze.', date: todayLocal(), time: '18:00' },
  closet: [
    { id: 'sample-shirt', name: 'White Oxford shirt', category: 'tops', color: 'white', seasons: ['spring', 'summer', 'fall'], occasions: ['casual', 'work'] },
    { id: 'sample-trousers', name: 'Navy straight trousers', category: 'bottoms', color: 'navy', seasons: ['spring', 'fall'], occasions: ['casual', 'work'] },
    { id: 'sample-shoes', name: 'Black lace-up shoes', category: 'shoes', color: 'black', seasons: ['spring', 'fall'], occasions: ['work'] },
  ],
  categories: DEFAULT_CATEGORIES,
}, null, 2);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Use a JSON object for the test case.');
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, max = 1000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 24 || value.some(entry => typeof entry !== 'string' || entry.length > 120))
    throw new Error(`${label} must be a list of short text values.`);
  return value as string[];
}
function date(value: unknown, label: string): string {
  const text = string(value, label, 10);
  const parsed = new Date(`${text}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text)
    throw new Error(`${label} must be a real date in YYYY-MM-DD form.`);
  return text;
}
function time(value: unknown, label: string): string {
  const text = string(value, label, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error(`${label} must use HH:mm from 00:00 to 23:59.`);
  return text;
}

/** Only data deliberately entered here is used; there is no wardrobe reader. */
export function workbenchPreset(mode: WorkbenchMode, eventJson = EVENT_EXAMPLE): { system: string; prompt: string; items: ClothingItem[] } {
  if (mode === 'flatlay' || mode === 'worn') return { system: '', prompt: mode === 'flatlay' ? INTAKE_PROMPT : OUTFIT_PROMPT, items: [] };
  if (mode === 'custom') return { system: '', prompt: 'Describe the visible garments. State what cannot be established from the photograph.', items: [] };
  let data: Record<string, unknown>;
  try { data = object(JSON.parse(eventJson)); } catch { throw new Error('The event test case must be valid JSON.'); }
  const event = object(data.event);
  const weather = object(data.weather);
  if (typeof event.setting !== 'string' || !['indoors', 'outdoors', 'mixed'].includes(event.setting)) throw new Error('Setting must be indoors, outdoors or mixed.');
  if (typeof weather.source !== 'string' || !['forecast', 'manual', 'unknown'].includes(weather.source)) throw new Error('Weather source must be forecast, manual or unknown.');
  if (weather.fetchedAt !== undefined) {
    const stamp = string(weather.fetchedAt, 'Forecast timestamp', 40);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) || !Number.isFinite(Date.parse(stamp)))
      throw new Error('Forecast timestamp must be a valid ISO timestamp with a timezone.');
    date(stamp.slice(0, 10), 'Forecast timestamp date');
    time(stamp.slice(11, 16), 'Forecast timestamp time');
  }
  if (weather.timezone !== undefined) {
    const zone = string(weather.timezone, 'Weather timezone', 100);
    try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(new Date()); }
    catch { throw new Error('Weather timezone must name a valid timezone, such as America/New_York.'); }
  }
  const brief: EventBrief = {
    event: string(event.event, 'Event'), date: date(event.date, 'Date'), time: time(event.time, 'Time'),
    dressCode: string(event.dressCode, 'Dress code'), setting: event.setting as EventBrief['setting'], preferences: string(event.preferences, 'Preferences'),
  };
  const suppliedWeather: StyleWeather = {
    source: weather.source as StyleWeather['source'], summary: string(weather.summary, 'Weather summary'), date: date(weather.date, 'Weather date'),
    ...(weather.time !== undefined ? { time: time(weather.time, 'Weather time') } : {}),
    ...(weather.timezone !== undefined ? { timezone: string(weather.timezone, 'Weather timezone', 100) } : {}),
    ...(weather.fetchedAt !== undefined ? { fetchedAt: string(weather.fetchedAt, 'Forecast timestamp', 40) } : {}),
  };
  if (!Array.isArray(data.closet) || data.closet.length > 100) throw new Error('Closet must contain at most 100 deliberately supplied test pieces.');
  const ids = new Set<string>();
  const items: ClothingItem[] = data.closet.map(raw => {
    const piece = object(raw);
    const id = string(piece.id, 'Garment ID', 120);
    if (!id.trim() || ids.has(id)) throw new Error('Each test garment needs a unique nonempty ID.');
    ids.add(id);
    const seasons = strings(piece.seasons ?? [], 'Seasons');
    if (seasons.some(season => !['spring', 'summer', 'fall', 'winter'].includes(season))) throw new Error('Use spring, summer, fall or winter for seasons.');
    return {
      id, name: string(piece.name, 'Garment name', 200), category: string(piece.category, 'Category', 120), color: string(piece.color, 'Colour', 120),
      ...(piece.material !== undefined ? { material: string(piece.material, 'Material', 120) } : {}),
      ...(piece.pattern !== undefined ? { pattern: string(piece.pattern, 'Pattern', 120) } : {}),
      season: seasons as ClothingItem['season'], occasion: strings(piece.occasions ?? [], 'Occasions'),
      imageUrl: '', dateAdded: '', wearCount: 0, favorite: false, laundryStatus: 'clean',
    };
  });
  const categories: UserCategory[] = data.categories === undefined ? DEFAULT_CATEGORIES : Array.isArray(data.categories)
    ? data.categories.slice(0, 100).map(raw => { const category = object(raw); return { id: string(category.id, 'Category ID', 120), label: string(category.label, 'Category label', 120) }; })
    : (() => { throw new Error('Categories must be a list of IDs and labels.'); })();
  return { ...buildStylistPrompt(brief, suppliedWeather, items, categories), items };
}

/** Same 1400px / JPEG 0.88 preparation as photo intake, without its client/settings imports. */
export async function prepareBenchImage(file: File): Promise<BenchImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('That image could not be decoded.')); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) throw new Error('Choose an image with at most 50 million pixels.');
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return { name: file.name, originalBytes: file.size, bytes: Math.floor(base64.length * 3 / 4), width: canvas.width, height: canvas.height, mimeType: 'image/jpeg', base64, dataUrl };
  } finally { URL.revokeObjectURL(url); }
}

function validBox(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || value.some(n => typeof n !== 'number' || !Number.isFinite(n))) return false;
  const [x, y, w, h] = value as number[];
  return x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.000001 && y + h <= 1.000001;
}

/** Parser acceptance is recorded separately from visual or styling quality. */
export function analyseWorkbenchResult(mode: WorkbenchMode, text: string, items: ClothingItem[]): BenchAnalysis {
  if (!text.trim()) return { status: 'invalid', summary: 'No answer text was returned.', issues: ['Usage may still be billable; an empty answer is not a free call.'], pieces: [] };
  if (mode === 'custom') return { status: 'unstructured', summary: 'Custom output: inspect the answer directly.', issues: [], pieces: [] };
  if (mode === 'event') {
    try {
      const suggestion = parseStyleSuggestion(text, items);
      return { status: 'valid', summary: `${suggestion.itemIds.length} known pieces; outfit schema accepted.`, issues: ['Dress-code fit and the explanation still need human review.'], pieces: [], suggestion };
    } catch (error) { return { status: 'invalid', summary: 'Outfit validation failed.', issues: [error instanceof Error ? error.message : 'The outfit could not be checked.'], pieces: [] }; }
  }
  const parsed = readIntake(text);
  if (parsed.error) return { status: 'invalid', summary: 'Intake validation failed.', issues: [parsed.error], pieces: [] };
  const raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { pieces: Array<Record<string, unknown>> };
  const issues = parsed.dropped.map(row => `Row ${row.index + 1} dropped: ${row.reason}`);
  const pieces = parsed.drafts.slice(0, 100).map(draft => {
    const candidates = raw.pieces.filter(piece => piece && typeof piece === 'object' && piece.ref === draft.ref);
    const rawBox = candidates.length === 1 ? candidates[0].box : undefined;
    const box = validBox(rawBox) && (draft.photo === undefined || draft.photo === 1) ? rawBox : null;
    if (!box) issues.push(`${draft.ref}: no valid box for this single image; crop omitted.`);
    for (const repair of draft.repairs) issues.push(`${draft.ref}: ${repair}`);
    return { ref: draft.ref, name: draft.name, description: draft.description, confidence: draft.confidence, uncertain: draft.uncertain, box };
  });
  if (parsed.drafts.length > 100) issues.push('Preview limited to the first 100 pieces; the raw answer is retained.');
  for (const skipped of parsed.skipped) issues.push(`Skipped: ${skipped.reason}${skipped.note ? ` — ${skipped.note}` : ''}`);
  return {
    status: issues.length || pieces.some(piece => piece.uncertain.length || piece.confidence < 0.6) ? 'review' : 'valid',
    summary: `${parsed.drafts.length} pieces accepted; ${parsed.dropped.length} dropped.`, issues, pieces,
  };
}

/** Local rectangular crops only: no image generation or background removal. */
export async function cropBenchPieces(image: BenchImage, pieces: BenchPiece[]): Promise<BenchPiece[]> {
  const decoded = new Image();
  await new Promise<void>((resolve, reject) => { decoded.onload = () => resolve(); decoded.onerror = () => reject(new Error('The prepared image could not be opened for cropping.')); decoded.src = image.dataUrl; });
  return pieces.map(piece => {
    if (!piece.box) return piece;
    const [x, y, w, h] = piece.box;
    const width = w * image.width, height = h * image.height;
    const scale = Math.min(1, 420 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return piece;
    context.drawImage(decoded, x * image.width, y * image.height, width, height, 0, 0, canvas.width, canvas.height);
    return { ...piece, crop: canvas.toDataURL('image/jpeg', 0.9) };
  });
}
