/**
 * THE ONE THING IN TOILE THAT LEAVES THE DEVICE.
 *
 * Everything else here is local by construction: no server, no account, no
 * analytics. This file is the exception, and it is an exception the person
 * makes deliberately, with their own key, on their own account, for one
 * photograph at a time. Nothing is sent unless a button is pressed, and the
 * screen that offers it says exactly where the photograph goes.
 *
 * There is no proxy in the middle, because a proxy would be us — a server
 * holding other people's clothes, which is the thing this project exists to
 * not be. The browser talks to Anthropic directly.
 *
 * WHAT COMES BACK IS COORDINATES, NOT PICTURES. A language model cannot hand
 * back a cropped image; it can say precisely where each garment sits in the
 * frame. So the model reads the photograph and names the boxes, and the
 * cutting, the background removal and the writing into the closet all happen
 * on the device, in lib/cutout.ts. The photograph makes exactly one journey.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

/**
 * The best model for the work, chosen rather than asked about.
 *
 * Reading a worn outfit into separate garments with usable coordinates is the
 * hardest thing this app asks of anything, so it goes to the most capable
 * model. If a key has no access to it, the call steps down once rather than
 * failing — a working catalogue beats a correct error message.
 */
const PREFERRED = 'claude-opus-5';
const FALLBACK = 'claude-sonnet-5';

/** Anthropic ignores detail above ~1568px, and a smaller image is a faster answer. */
const SEND_EDGE = 1400;

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

export function hasKey(): boolean {
  return loadKey().length > 0;
}

/** A key that is obviously not a key, caught before a round trip says so. */
export function keyLooksWrong(key: string): boolean {
  const k = key.trim();
  return k.length > 0 && !k.startsWith('sk-ant-');
}

export interface Prepared {
  /** Base64 without the data: prefix, which is what the API wants. */
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

/** What went wrong, said the way a person can act on. */
function explain(status: number, body: string): string {
  if (status === 401) return 'That key was refused. Check it in Settings — keys begin with sk-ant-.';
  if (status === 403) return 'That key is not allowed to use this model.';
  if (status === 429) return 'Anthropic is rate-limiting this key. Wait a minute and try again.';
  if (status === 400 && /credit|billing/i.test(body)) return 'That account has no credit left for the API.';
  if (status === 400) return 'Anthropic refused the request. The photograph may be too large.';
  if (status >= 500) return 'Anthropic is having trouble. Nothing was catalogued; try again shortly.';
  return `The request failed (${status}).`;
}

async function post(model: string, key: string, image: Prepared, prompt: string): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': VERSION,
      // Without this the browser is refused at CORS. It is named "dangerous"
      // because it puts a key in a page; here the page is the person's own
      // device and the key is their own, typed by them, stored nowhere else.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
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
 * Read a photograph with the best model available to this key.
 *
 * Returns the model's raw text. Parsing is lib/intake.ts's job — the same
 * reader that handles a file pasted in by hand, so a hand-written file and an
 * API answer cannot diverge in how strictly they are checked.
 */
export async function readPhotograph(image: Prepared, prompt: string): Promise<{ text: string; model: string }> {
  const key = loadKey();
  if (!key) throw new Error('No key yet. Add one in Settings, or copy the prompt and use it yourself.');

  let model = PREFERRED;
  let res: Response;
  try {
    res = await post(model, key, image, prompt);
  } catch {
    throw new Error('Could not reach Anthropic. Check the connection — everything else in Almari works offline.');
  }

  // One step down if this key cannot see the preferred model, then stop.
  if (res.status === 404 || res.status === 403) {
    model = FALLBACK;
    res = await post(model, key, image, prompt).catch(() => res);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(explain(res.status, body));
  }

  const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n')
    .trim();
  if (!text) throw new Error('The model returned nothing readable. Try the photograph again.');
  return { text, model };
}
