/**
 * THE ONE THING IN ALMARI THAT LEAVES THE DEVICE, ONE PHOTOGRAPH AT A TIME.
 *
 * Everything else here is local by construction: no analytics, no tracking,
 * and a wardrobe only syncs if its owner chose that. This file is the other
 * exception, and it is an exception the person makes deliberately, one
 * photograph at a time. Nothing is sent unless a button is pressed, and the
 * screen that offers it says exactly where the photograph goes.
 *
 * THE PROVIDERS, in the order they are asked:
 *
 *   1. A relay of our own — a Supabase edge function on the owner's project
 *      (supabase/functions/ai-proxy) that holds the provider keys server-side
 *      and routes by the model's name: a `claude*` model goes to Anthropic,
 *      anything else to Kimi by Moonshot AI. The app POSTs the provider's own
 *      request shape and sends no key, because it does not have one; the
 *      relay adds the key. The default is Claude Sonnet 4.5 — cataloguing a
 *      photograph works out of the box.
 *   2. Your own endpoint, set in Settings. Two shapes are spoken:
 *      an endpoint whose URL points at Anthropic (or any `/v1/messages`
 *      address) gets an Anthropic Messages request with `x-api-key`;
 *      anything else is treated as an OpenAI-compatible chat-completions
 *      service and gets `Authorization: Bearer …`. The photograph then goes
 *      there and nowhere else.
 *   3. A legacy Anthropic key, saved before the relay existed. Still honoured,
 *      talking to Anthropic directly exactly as it always did.
 *
 * WHAT COMES BACK IS COORDINATES, NOT PICTURES. A language model cannot hand
 * back a cropped image; it can say precisely where each garment sits in the
 * frame. So the model reads the photograph and names the boxes, and the
 * cutting, the background removal and the writing into the closet all happen
 * on the device, in lib/cutout.ts. The photograph makes exactly one journey.
 */

/* ---------- the relay (default) ---------- */

const RELAY_ENDPOINT = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy';
/**
 * Claude Sonnet 4.5 by Anthropic — the model the relay asks by default, and
 * the name the copy gives. The relay routes by the model's name: a `claude*`
 * model is forwarded to Anthropic, anything else to Kimi by Moonshot AI. The
 * default moved from Kimi K3 after a timed shootout on a real wardrobe
 * photograph: 3.9s against 14.2s for the same picture and prompt.
 */
const RELAY_MODEL = 'claude-sonnet-4-5';
/** Who the relay is talking to, for honest error copy. Derived, not written down twice. */
const RELAY_PROVIDER = RELAY_MODEL.startsWith('claude') ? 'Claude (by Anthropic)' : 'Kimi (by Moonshot AI)';
/** The relay speaks the provider's own shape — Anthropic Messages for a claude* model. */
const RELAY_SPEAKS_ANTHROPIC = RELAY_MODEL.startsWith('claude');

/* ---------- your own endpoint (BYOK override) ---------- */

export interface AiOverride {
  /** A full endpoint URL — Anthropic Messages or OpenAI-compatible. */
  endpoint: string;
  /** Sent as `x-api-key` (Anthropic shape) or `Authorization: Bearer …` (OpenAI shape). May be empty for a keyless relay. */
  key: string;
  model: string;
}

const OVERRIDE_STORE = 'toile-ai';

export function loadOverride(): AiOverride | null {
  try {
    const raw = window.localStorage.getItem(OVERRIDE_STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiOverride>;
    if (typeof parsed.endpoint !== 'string' || !parsed.endpoint.trim()) return null;
    return {
      endpoint: parsed.endpoint.trim(),
      key: typeof parsed.key === 'string' ? parsed.key.trim() : '',
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : RELAY_MODEL,
    };
  } catch {
    return null;
  }
}

export function saveOverride(override: AiOverride | null): void {
  try {
    if (override && override.endpoint.trim()) {
      window.localStorage.setItem(OVERRIDE_STORE, JSON.stringify({
        endpoint: override.endpoint.trim(),
        key: override.key.trim(),
        model: override.model.trim() || RELAY_MODEL,
      }));
    } else {
      window.localStorage.removeItem(OVERRIDE_STORE);
    }
  } catch {
    /* storage disabled — the override holds for this session only */
  }
}

/** A form-check before a round trip says it: what, if anything, is wrong. */
export function overrideLooksWrong(draft: AiOverride): string | null {
  if (!draft.endpoint.trim()) return 'The endpoint is empty.';
  if (!/^https:\/\/.+/.test(draft.endpoint.trim())) return 'The endpoint must be an https:// address.';
  if (!draft.model.trim()) return 'The model is empty.';
  return null;
}

/**
 * Which request shape an endpoint speaks, told from its address. Anthropic's
 * own API and any relay exposing the Messages API end in `/v1/messages`;
 * everything else is assumed to be an OpenAI-compatible chat-completions
 * service. That is the whole detection, deliberately: one rule, stated where
 * both call sites can read it.
 */
function speaksAnthropic(endpoint: string): boolean {
  return /anthropic\.com/i.test(endpoint) || /\/v1\/messages\/?$/i.test(endpoint);
}

/* ---------- the legacy Anthropic key ---------- */

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * The Claude models for the work, for keys saved before the relay existed.
 * Both are verified against a live key. If a key has no access to the
 * preferred one, the call steps down once rather than failing — a working
 * catalogue beats a correct error.
 */
const ANTHROPIC_PREFERRED = 'claude-sonnet-4-5';
const ANTHROPIC_FALLBACK = 'claude-haiku-4-5';

const KEY_STORE = 'toile-key';

export function loadKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}

export function saveKey(key: string): void {
  try {
    if (key.trim()) window.localStorage.setItem(KEY_STORE, key.trim());
    else window.localStorage.removeItem(KEY_STORE);
  } catch {
    /* storage disabled — the key holds for this session only */
  }
}

/**
 * "Can a photograph be read right now?" — the question the call sites ask.
 * Since the relay needs nothing from the device, the answer is yes unless the
 * network itself is down, and a down network is said out loud at send time.
 */
export function hasKey(): boolean {
  return true;
}

/** A legacy Anthropic key that is obviously not one, caught before a round trip. */
export function keyLooksWrong(key: string): boolean {
  const k = key.trim();
  return k.length > 0 && !k.startsWith('sk-ant-');
}

/* ---------- the photograph ---------- */

/** Any provider ignores detail above ~1568px, and a smaller image is a faster answer. */
const SEND_EDGE = 1400;

/**
 * Generous on purpose: a reasoning model (the Kimi path) spends thinking from
 * the same budget as the answer, and a full-closet detection list is long.
 * Under ~4096 tokens a reasoning model's thinking can eat the whole allowance
 * and the answer arrives empty.
 */
const MAX_TOKENS = 8000;

export interface Prepared {
  /** Base64 without the data: prefix, which the Anthropic shape wants. */
  base64: string;
  mediaType: 'image/jpeg';
  /** The image actually sent, as a data URL — this is what we crop from later,
      so the boxes the model returns line up with the pixels we cut. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Shrink and re-encode before sending.
 *
 * The crop step reads from THIS image, not the original file: a box is
 * expressed in fractions, so the two agree either way, but re-using one
 * decoded copy keeps a ten-megapixel phone photograph out of memory twice.
 */
export function prepareImage(src: string): Promise<Prepared> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('That photograph would not open.'));
    img.onload = () => {
      const scale = Math.min(1, SEND_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('This browser will not open a drawing surface.'));
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      resolve({
        base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
        mediaType: 'image/jpeg',
        dataUrl,
        width: w,
        height: h,
      });
    };
    img.src = src;
  });
}

/* ---------- what went wrong, said the way a person can act on ---------- */

function explainProvider(status: number, body: string, own: boolean): string {
  // The default relay talks to whoever RELAY_MODEL names; a user's own
  // endpoint is theirs to name. The copy says so, because an honest error
  // names who is actually having the trouble.
  const provider = own ? 'The AI provider' : RELAY_PROVIDER;
  if (status === 401 || status === 403) {
    return own
      ? 'That key was refused. Check it in Settings.'
      : "The relay's key was refused — that is the house's to fix, not yours.";
  }
  if (status === 429) return `${provider} is rate-limiting. Wait a minute and try again.`;
  if (status === 400 && /credit|billing/i.test(body)) return 'That account has no credit left for the API.';
  if (status === 400) return 'The provider refused the request. The photograph may be too large.';
  if (status === 503 && /not configured/i.test(body))
    return 'The relay has no key yet — whoever runs this house has not set one. See supabase/README-SETUP.md.';
  if (status >= 500) return `${provider} is having trouble. Nothing was catalogued; try again shortly.`;
  return `The request failed (${status}).`;
}

function explainAnthropic(status: number, body: string): string {
  if (status === 401) return 'That key was refused. Check it in Settings — keys begin with sk-ant-.';
  if (status === 403) return 'That key is not allowed to use this model.';
  if (status === 429) return 'Anthropic is rate-limiting this key. Wait a minute and try again.';
  if (status === 400 && /credit|billing/i.test(body)) return 'That account has no credit left for the API.';
  if (status === 400) return 'Anthropic refused the request. The photograph may be too large.';
  if (status >= 500) return 'Anthropic is having trouble. Nothing was catalogued; try again shortly.';
  return `The request failed (${status}).`;
}

/* ---------- the Anthropic Messages shape (relay, legacy keys, Anthropic endpoints) ---------- */

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

/** The text of a Messages response — reasoning parts, if any, are left on the floor. */
function anthropicText(json: { content?: AnthropicTextBlock[] }): string {
  return (json.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n')
    .trim();
}

/**
 * One Anthropic Messages POST. `key` is empty for the relay, which holds the
 * key server-side and adds it there; the browser-direct header goes on only
 * when the call is genuinely direct to Anthropic, where CORS refuses without
 * it — a self-hosted Messages-shaped relay is not asked to allow it.
 */
async function postAnthropic(
  endpoint: string,
  key: string,
  model: string,
  image: Prepared,
  prompt: string,
  direct: boolean,
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  }
  if (direct) {
    // Without this the browser is refused at CORS. It is named "dangerous"
    // because it puts a key in a page; here the page is the person's own
    // device and the key is their own, typed by them, stored nowhere else.
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
}

/**
 * The default path: a POST to the relay with no key at all — the relay holds
 * the provider key server-side and adds it there, routing by the model's
 * name. A `claude*` model gets the Anthropic Messages shape; anything else
 * the OpenAI-compatible chat-completions shape. Kimi K3 is a reasoning model:
 * its reasoning spends from the same token budget and arrives in a separate
 * field, which is ignored — the answer is the content and nothing else.
 */
async function readViaRelay(image: Prepared, prompt: string): Promise<{ text: string; model: string }> {
  if (RELAY_SPEAKS_ANTHROPIC) {
    let res: Response;
    try {
      res = await postAnthropic(RELAY_ENDPOINT, '', RELAY_MODEL, image, prompt, false);
    } catch {
      throw new Error('Could not reach the AI provider. Check the connection — everything else in Almari works offline.');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(explainProvider(res.status, body, false));
    }
    const text = anthropicText(await res.json() as { content?: AnthropicTextBlock[] });
    if (!text) throw new Error('The model returned nothing readable. Try the photograph again.');
    return { text, model: RELAY_MODEL };
  }
  return readViaOpenAI(RELAY_ENDPOINT, '', RELAY_MODEL, image, prompt);
}

/** An Anthropic-shaped endpoint of the user's own, with the user's own key. */
async function readViaAnthropicEndpoint(
  endpoint: string,
  key: string,
  model: string,
  image: Prepared,
  prompt: string,
): Promise<{ text: string; model: string }> {
  const direct = /anthropic\.com/i.test(endpoint);
  let res: Response;
  try {
    res = await postAnthropic(endpoint, key, model, image, prompt, direct);
  } catch {
    throw new Error('Could not reach the AI provider. Check the connection — everything else in Almari works offline.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(direct ? explainAnthropic(res.status, body) : explainProvider(res.status, body, true));
  }
  const text = anthropicText(await res.json() as { content?: AnthropicTextBlock[] });
  if (!text) throw new Error('The model returned nothing readable. Try the photograph again.');
  return { text, model };
}

/* ---------- the OpenAI-compatible shape (your own endpoint) ---------- */

async function postOpenAI(
  endpoint: string,
  key: string,
  model: string,
  image: Prepared,
  prompt: string,
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image.dataUrl } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
}

async function readViaOpenAI(
  endpoint: string,
  key: string,
  model: string,
  image: Prepared,
  prompt: string,
): Promise<{ text: string; model: string }> {
  let res: Response;
  try {
    res = await postOpenAI(endpoint, key, model, image, prompt);
  } catch {
    throw new Error('Could not reach the AI provider. Check the connection — everything else in Almari works offline.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(explainProvider(res.status, body, key.length > 0));
  }
  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type: string; text?: string }> } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  // OpenAI-compatible content is a string; some providers send typed parts.
  // Both read the same here — the reasoning part, when there is one, is left
  // on the floor deliberately.
  const text = (typeof content === 'string'
    ? content
    : (content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n')
  ).trim();
  if (!text) throw new Error('The model returned nothing readable. Try the photograph again.');
  return { text, model };
}

/* ---------- the legacy key, direct to Anthropic ---------- */

async function readViaAnthropic(key: string, image: Prepared, prompt: string): Promise<{ text: string; model: string }> {
  let model = ANTHROPIC_PREFERRED;
  let res: Response;
  try {
    res = await postAnthropic(ANTHROPIC_ENDPOINT, key, model, image, prompt, true);
  } catch {
    throw new Error('Could not reach Anthropic. Check the connection — everything else in Almari works offline.');
  }

  // One step down if this key cannot see the preferred model, then stop.
  if (res.status === 404 || res.status === 403) {
    model = ANTHROPIC_FALLBACK;
    res = await postAnthropic(ANTHROPIC_ENDPOINT, key, model, image, prompt, true).catch(() => res);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(explainAnthropic(res.status, body));
  }

  const text = anthropicText(await res.json() as { content?: AnthropicTextBlock[] });
  if (!text) throw new Error('The model returned nothing readable. Try the photograph again.');
  return { text, model };
}

/**
 * Read a photograph with whichever provider is configured.
 *
 * Returns the model's raw text. Parsing is lib/intake.ts's job — the same
 * reader that handles a file pasted in by hand, so a hand-written file and an
 * API answer cannot diverge in how strictly they are checked.
 */
export async function readPhotograph(image: Prepared, prompt: string): Promise<{ text: string; model: string }> {
  const override = loadOverride();
  if (override) {
    return speaksAnthropic(override.endpoint)
      ? readViaAnthropicEndpoint(override.endpoint, override.key, override.model, image, prompt)
      : readViaOpenAI(override.endpoint, override.key, override.model, image, prompt);
  }
  const legacy = loadKey();
  if (legacy) return readViaAnthropic(legacy, image, prompt);
  return readViaRelay(image, prompt);
}
