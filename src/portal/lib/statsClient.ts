/**
 * THE BOARD'S ONLY NETWORK CODE — two live services, and nothing local.
 *
 * This is a deliberate COPY of the server-facing half of src/lib/admin.ts
 * rather than an import of it. admin.ts pulls ./accounts, ./sync, ./photoStore,
 * ./exportDoc, ./personaWardrobe and @almari/shared/migrate — the entire
 * consumer wardrobe layer, generated sample closets included, plus
 * module-scope localStorage reads — into a bundle that has no wardrobe and is
 * served from a different origin. A later wave lifts the shared half out of
 * admin.ts so both sides import one copy; until then the duplication is
 * bounded, named here, and cheaper than the alternative.
 *
 * WHAT THIS FILE MAY NEVER GAIN: a reader of this device's localStorage. The
 * board reports the ALPHA, and the operator's own browser is not the alpha.
 * The previous portal reported the operator's own wardrobes — sample personas
 * and all — under the heading "Product analytics", and that is the specific
 * failure this separation exists to correct.
 */

/* ==================== the relay ==================== */

/**
 * The relay's address. The source of truth is RELAY_ENDPOINT in
 * src/lib/anthropic.ts, which keeps it module-private on purpose; it is
 * re-declared here so the board can knock on the same door the intake walks
 * through. If one moves, move both.
 */
export const RELAY_ENDPOINT =
  'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';

/** The whole probe: one sentence out, one line back. Nothing else is sent. */
const PROBE_PROMPT = 'Reply with exactly: relay test ok';

export interface RelayService {
  id: string;
  label: string;
  model: string;
  /** Which response shape comes back — the request body is the same either way. */
  shape: 'anthropic' | 'openai';
  maxTokens: number;
}

/**
 * The four models the relay can route to. Kimi K3 is a reasoning model that
 * spends its thinking from the same token budget as the answer, so its probe
 * carries the 8000-token ceiling the intake uses — 512 would be eaten whole by
 * the thinking and the answer would arrive empty.
 */
export const RELAY_SERVICES: RelayService[] = [
  { id: 'fable', label: 'Claude Fable 5', model: 'claude-fable-5', shape: 'anthropic', maxTokens: 512 },
  { id: 'opus', label: 'Claude Opus 5', model: 'claude-opus-5', shape: 'anthropic', maxTokens: 512 },
  { id: 'gemini', label: 'Gemini 3.7 Flash', model: 'gemini-3.7-flash', shape: 'openai', maxTokens: 512 },
  { id: 'kimi', label: 'Kimi K3', model: 'k3', shape: 'openai', maxTokens: 8000 },
];

/**
 * healthy      — HTTP 200, an answer came back.
 * unconfigured — the relay answered 503 "not configured": the house has not
 *                set that provider's key. Its own calm state, not a failure.
 * failed       — any other HTTP answer.
 * unreachable  — the network itself refused; there is no HTTP status.
 */
export type ProbeVerdict = 'healthy' | 'unconfigured' | 'failed' | 'unreachable';

export interface ProbeResult {
  verdict: ProbeVerdict;
  /** null when the network never answered. */
  status: number | null;
  latencyMs: number;
  /** The first line of the model's answer, or the trouble in one phrase. */
  answer: string;
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0) ?? ''
  );
}

/** The answer's text, read by the shape the provider speaks. */
function probeAnswer(service: RelayService, json: unknown): string {
  if (service.shape === 'anthropic') {
    const blocks = (json as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
    return firstLine(blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n'));
  }
  const content = (json as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  }).choices?.[0]?.message?.content;
  // OpenAI-compatible content is a string; some providers send typed parts.
  const text =
    typeof content === 'string'
      ? content
      : (content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
  return firstLine(text);
}

/**
 * One knock on the relay for one model. The request body is the tiny probe and
 * nothing else — no photograph, no closet, no key, because the relay holds the
 * keys server-side.
 *
 * A probe spends the house's own tokens, which is why nothing in this board
 * ever fires one on mount or on a timer. It is asked for, or it does not happen.
 */
export async function probeRelay(service: RelayService): Promise<ProbeResult> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(RELAY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: service.model,
        max_tokens: service.maxTokens,
        messages: [{ role: 'user', content: PROBE_PROMPT }],
      }),
    });
  } catch {
    return {
      verdict: 'unreachable',
      status: null,
      latencyMs: Math.round(performance.now() - started),
      answer: 'The relay could not be reached from here.',
    };
  }
  const latencyMs = Math.round(performance.now() - started);
  const body = await res.text().catch(() => '');
  if (res.status === 200) {
    let answer = '';
    try {
      answer = probeAnswer(service, JSON.parse(body));
    } catch {
      /* a 200 that does not parse is still a 200; the answer line says so */
    }
    return { verdict: 'healthy', status: 200, latencyMs, answer: answer || 'The answer came back empty.' };
  }
  if (res.status === 503 && /not configured/i.test(body)) {
    return { verdict: 'unconfigured', status: 503, latencyMs, answer: 'The house has not set this key yet.' };
  }
  return {
    verdict: 'failed',
    status: res.status,
    latencyMs,
    answer: firstLine(body) || `The relay answered ${res.status}.`,
  };
}

/* ==================== the stats service ==================== */

export const ADMIN_STATS_ENDPOINT =
  'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-stats';

/**
 * sessionStorage, deliberately: the token leaves when the tab closes.
 *
 * Note that the board runs on its own origin, so a token typed into the app's
 * old #/admin page is NOT visible here, and never was. That is correct, and the
 * copy on the page says so rather than implying a shared key.
 */
export const ADMIN_TOKEN_KEY = 'almari-admin-token';

export function loadAdminToken(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAdminToken(token: string): void {
  try {
    if (token.trim()) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* private mode — the token holds for this render only */
  }
}

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

export async function fetchAlphaStats(token: string): Promise<AlphaStatsResult> {
  let res: Response;
  try {
    res = await fetch(ADMIN_STATS_ENDPOINT, { headers: { 'x-admin-token': token } });
  } catch {
    return { kind: 'absent' };
  }
  if (res.status === 401) return { kind: 'refused' };
  if (res.status === 404) return { kind: 'absent' };
  if (!res.ok) return { kind: 'failed', status: res.status };
  try {
    const json = (await res.json()) as Partial<AlphaStats>;
    return {
      kind: 'ok',
      stats: {
        generatedAt: typeof json.generatedAt === 'string' ? json.generatedAt : '',
        users: typeof json.users === 'number' ? json.users : 0,
        profiles: typeof json.profiles === 'number' ? json.profiles : 0,
        wardrobes: Array.isArray(json.wardrobes) ? json.wardrobes : [],
        roster: Array.isArray(json.roster) ? json.roster : [],
        // The KEY's presence, not the array's length. A service that predates
        // the roster sends no key at all, and rendering that as an empty alpha
        // would be the board's worst possible lie: "nobody signed up" when the
        // truth is "this board asked a question the service does not answer".
        hasRoster: Object.prototype.hasOwnProperty.call(json, 'roster'),
      },
    };
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
