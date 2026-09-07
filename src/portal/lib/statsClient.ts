/** Operational stats and explicit authenticated probes; no browser storage or wardrobe imports. */
import { runModel, ModelRunError } from './workbenchClient';
import { normalizeUsage, estimateModelCost } from './modelCost';
import type { ModelId } from './modelCatalog';
export interface RelayService { id: string; label: string; model: ModelId; maxTokens: number }
export const RELAY_SERVICES: RelayService[] = [
  { id: 'fable', label: 'Claude Fable 5.1', model: 'claude-fable-5-1', maxTokens: 8000 },
  { id: 'opus', label: 'Claude Opus 5', model: 'claude-opus-5', maxTokens: 8000 },
  { id: 'gemini', label: 'Gemini 3.7 Flash', model: 'gemini-3.7-flash', maxTokens: 8000 },
  { id: 'kimi', label: 'Kimi K3', model: 'k3', maxTokens: 8000 },
];
export type ProbeVerdict = 'healthy' | 'unconfigured' | 'failed' | 'unreachable';
export interface ProbeResult { verdict: ProbeVerdict; status: number | null; latencyMs: number; answer: string; costLabel?: string; costUsd?: number | null }
export async function probeRelay(service: RelayService, token: string): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const run = await runModel({ modelId: service.model, token, system: '', prompt: 'Reply with exactly: relay test ok', maxTokens: service.maxTokens });
    const cost = estimateModelCost(service.model, normalizeUsage(service.model, run.raw), run.requestedAt);
    return { verdict: run.text.trim() ? 'healthy' : 'failed', status: 200, latencyMs: run.latencyMs,
      answer: run.text.trim().split('\n')[0] || 'The answer came back empty.', costLabel: cost.label, costUsd: cost.usd };
  } catch (error) {
    const status = error instanceof ModelRunError ? error.status : null;
    return { verdict: status === 503 ? 'unconfigured' : status ? 'failed' : 'unreachable', status,
      latencyMs: Math.round(performance.now() - started), answer: error instanceof Error ? error.message : 'The relay could not be reached.',
      costLabel: 'Cost unavailable', costUsd: null };
  }
}
export const ADMIN_STATS_ENDPOINT = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-stats';
export interface AlphaWardrobeRow {
  id: string;
  user_id: string;
  updated_at: string;
  bytes: number;
  /** Envelope version; null or absent means the row was stored bare. */
  v?: number | string | null;
}

/**
 * One person who has arrived, as the service's own records describe them.
 *
 * `profile` being null is a real and useful answer — an account with no profile
 * is somebody who signed up and stopped, which is the commonest way an alpha
 * quietly fails. `wardrobes: 0` is the next step of the same story: an account
 * with a profile and nothing synced got further, and still not far.
 */
export interface AlphaPerson {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  confirmed: boolean;
  profile: { display_name: string | null; handle: string | null; created_at: string | null } | null;
  wardrobes: number;
  bytes: number;
  lastSync: string | null;
}

export interface AlphaStats {
  generatedAt: string;
  users: number;
  profiles: number;
  wardrobes: AlphaWardrobeRow[];
  /**
   * Empty from a stats service deployed before the roster existed, which is a
   * state the board must render as "this service is older than this board"
   * rather than as "nobody has signed up". The two look identical in a bare
   * array and mean opposite things.
   */
  roster: AlphaPerson[];
  /** False when the answer carried no roster key at all — see above. */
  hasRoster: boolean;
}

/**
 * ok      — the numbers, as the service counted them.
 * refused — 401: the token was refused.
 * absent  — 404 or no network answer: the service is not deployed, or this
 *           machine cannot reach it. A calm state, never a red one.
 * failed  — the service answered, but not with numbers.
 *
 * All four are kept because all four read differently on the page. Collapsing
 * them into "error" is how a board comes to show a confident zero for a
 * question it never managed to ask.
 */
export type AlphaStatsResult =
  | { kind: 'ok'; stats: AlphaStats }
  | { kind: 'refused' }
  | { kind: 'absent' }
  | { kind: 'failed'; status: number };

type StatsRecord = Record<string, unknown>;
const statsRecord = (value: unknown): value is StatsRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const statsCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const statsId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const statsStamp = (value: unknown): value is string => {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  // Date.parse otherwise rolls February 30 into March instead of rejecting it.
  const day = value.slice(0, 10);
  const midnight = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(midnight) && new Date(midnight).toISOString().slice(0, 10) === day;
};
const nullableStamp = (value: unknown): value is string | null => value === null || statsStamp(value);

/** A 200 response is not evidence of zero people. Validate every required field
 * before rendering counts, and project only the service's operational schema.
 * An absent roster is the one supported older-service omission; a present but
 * malformed roster must never look like an older service or an empty alpha.
 */
function parseAlphaStats(value: unknown): AlphaStats | null {
  if (!statsRecord(value) || !statsStamp(value.generatedAt) || !statsCount(value.users)
    || !statsCount(value.profiles) || !Array.isArray(value.wardrobes)) return null;
  const wardrobes: AlphaWardrobeRow[] = [];
  for (const row of value.wardrobes) {
    if (!statsRecord(row) || !statsId(row.id) || !statsId(row.user_id)
      || !statsStamp(row.updated_at) || !statsCount(row.bytes)
      || !(row.v === undefined || row.v === null || statsCount(row.v) || statsId(row.v))) return null;
    wardrobes.push({ id: row.id, user_id: row.user_id, updated_at: row.updated_at, bytes: row.bytes,
      ...(row.v === undefined ? {} : { v: row.v as number | string | null }) });
  }
  const hasRoster = Object.prototype.hasOwnProperty.call(value, 'roster');
  if (hasRoster && !Array.isArray(value.roster)) return null;
  const roster: AlphaPerson[] = [];
  for (const row of hasRoster ? value.roster as unknown[] : []) {
    if (!statsRecord(row) || !statsId(row.id) || !nullableText(row.email)
      || !nullableStamp(row.created_at) || !nullableStamp(row.last_sign_in_at)
      || typeof row.confirmed !== 'boolean' || !statsCount(row.wardrobes)
      || !statsCount(row.bytes) || !nullableStamp(row.lastSync)) return null;
    let profile: AlphaPerson['profile'] = null;
    if (row.profile !== null) {
      if (!statsRecord(row.profile) || !nullableText(row.profile.display_name)
        || !nullableText(row.profile.handle) || !nullableStamp(row.profile.created_at)) return null;
      profile = { display_name: row.profile.display_name, handle: row.profile.handle,
        created_at: row.profile.created_at };
    }
    roster.push({ id: row.id, email: row.email, created_at: row.created_at,
      last_sign_in_at: row.last_sign_in_at, confirmed: row.confirmed, profile,
      wardrobes: row.wardrobes, bytes: row.bytes, lastSync: row.lastSync });
  }
  return { generatedAt: value.generatedAt, users: value.users, profiles: value.profiles,
    wardrobes, roster, hasRoster };
}

export async function fetchAlphaStats(token: string): Promise<AlphaStatsResult> {
  let res: Response;
  try {
    res = await fetch(ADMIN_STATS_ENDPOINT, { cache: 'no-store', credentials: 'omit', headers: { 'x-admin-token': token } });
  } catch {
    return { kind: 'absent' };
  }
  if (res.status === 401) return { kind: 'refused' };
  if (res.status === 404) return { kind: 'absent' };
  if (!res.ok) return { kind: 'failed', status: res.status };
  try {
    const stats = parseAlphaStats(await res.json());
    return stats ? { kind: 'ok', stats } : { kind: 'failed', status: res.status };
  } catch {
    return { kind: 'failed', status: res.status };
  }
}

/**
 * How far each person got, counted once so the board and its captions agree.
 *
 * Three steps, and the gaps between them are the whole story of an alpha:
 * arrived (an account exists), settled (a profile was made), kept (a wardrobe
 * is synced). Counts, never rates — at this size one person is several
 * percentage points, and a percentage would invite a conclusion the sample
 * cannot support.
 */
export function rosterFunnel(roster: AlphaPerson[]): {
  arrived: number;
  settled: number;
  kept: number;
  returned: number;
  unconfirmed: number;
} {
  return {
    arrived: roster.length,
    settled: roster.filter(p => p.profile !== null).length,
    kept: roster.filter(p => p.wardrobes > 0).length,
    // Came back at least once after the session that made the account. The two
    // stamps are within a second of each other on a signup, so a minute's grace
    // keeps that from counting as a return.
    returned: roster.filter(p => {
      if (!p.created_at || !p.last_sign_in_at) return false;
      return new Date(p.last_sign_in_at).getTime() - new Date(p.created_at).getTime() > 60_000;
    }).length,
    unconfirmed: roster.filter(p => !p.confirmed).length,
  };
}

/** Whole days since an ISO stamp, or null when there is no stamp to count from. */
export function daysSinceStamp(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/* ==================== small shared helpers ==================== */

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** An absolute stamp, never "3 minutes ago" — a board is read at odd hours. */
export function formatStamp(iso: string): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The first eight characters of an id, for telling rows apart in a table. */
export function shortId(id: string): string {
  return typeof id === 'string' && id.length > 8 ? id.slice(0, 8) : id || '—';
}
