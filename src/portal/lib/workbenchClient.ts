import { MODEL_CATALOG, type ModelId } from './modelCatalog';

export const ADMIN_AI_ENDPOINT = 'https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/admin-ai';
export interface ModelRunRequest {
  modelId: ModelId;
  token: string;
  system: string;
  prompt: string;
  image?: { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string };
  maxTokens?: number;
  signal?: AbortSignal;
}
export interface ModelRunResult {
  requestedModel: ModelId;
  returnedModel: string;
  requestedAt: string;
  latencyMs: number;
  text: string;
  raw: unknown;
}
export class ModelRunError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ModelRunError';
    this.status = status;
  }
}

/** One explicit, bounded request. No retries, persistence, or consumer account imports. */
export async function runModel(request: ModelRunRequest): Promise<ModelRunResult> {
  if (!request.token.trim()) throw new ModelRunError('Enter the admin token before running a test.', 401);
  const requestedAt = new Date().toISOString();
  const started = performance.now();
  const model = MODEL_CATALOG.find(m => m.id === request.modelId);
  if (!model) throw new ModelRunError('Choose a model from the catalog.', 400);
  let response: Response;
  try {
    response = await fetch(ADMIN_AI_ENDPOINT, {
      method: 'POST', cache: 'no-store', credentials: 'omit', signal: request.signal,
      headers: { 'content-type': 'application/json', 'x-admin-token': request.token.trim() },
      body: JSON.stringify({ model: request.modelId, system: request.system, prompt: request.prompt,
        image: request.image, maxTokens: request.maxTokens ?? 8000 }),
    });
  } catch (error) {
    if (request.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new ModelRunError('The test service could not be reached. The provider may still have processed the call.');
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'The test request was refused. Check the prompt, image and model.',
      401: 'The admin token was refused.', 403: 'This origin cannot run tests.',
      413: 'The prepared test exceeds the 8 MB request limit.',
      429: 'The provider rate limit was reached. Run again when ready.',
      503: 'This provider or admin service is not configured.',
      504: 'The test timed out. The provider may still charge for the call.',
    };
    // Provider error bodies can echo submitted material. Do not render them as status copy.
    throw new ModelRunError(messages[response.status] ?? `The test service answered HTTP ${response.status}. Cost is unavailable.`, response.status);
  }
  let raw: Record<string, unknown>;
  try { raw = await response.json() as Record<string, unknown>; }
  catch { throw new ModelRunError('The provider returned an unreadable response. Cost is unavailable.', response.status); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ModelRunError('The provider returned an invalid response. Cost is unavailable.', response.status);
  let text = '';
  if (model.provider === 'anthropic') {
    const content = raw.content as Array<{type?: string; text?: string}> | undefined;
    if (Array.isArray(content)) text = content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n');
  } else {
    const choices = raw.choices as Array<{message?: {content?: unknown}}> | undefined;
    const content = choices?.[0]?.message?.content;
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content)) text = content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n');
  }
  return { requestedModel: request.modelId, returnedModel: typeof raw.model === 'string' ? raw.model : 'Not returned',
    requestedAt, latencyMs: Math.round(performance.now() - started), text, raw };
}
