import { getModelDefinition, PRICING_VERIFIED_AT } from './modelCatalog';

export interface NormalizedUsage {
  status: 'complete' | 'partial' | 'missing' | 'invalid';
  inputTokens: number | null;
  uncachedInputTokens: number | null;
  cacheReadInputTokens: number | null;
  cacheWrite5mInputTokens: number | null;
  cacheWrite1hInputTokens: number | null;
  outputTokens: number | null;
  /** Informational subset of outputTokens; never another charge. */
  reasoningTokens: number | null;
  totalTokens: number | null;
  notes: string[];
}

export interface CostEstimate {
  status: 'estimated' | 'unavailable' | 'subscription';
  usd: number | null;
  label: string;
  breakdown?: { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number };
  notes: string[];
  sourceUrl: string;
  verifiedAt: string;
}

type RecordValue = Record<string, unknown>;
const empty = (status: NormalizedUsage['status'], note: string): NormalizedUsage => ({
  status, inputTokens: null, uncachedInputTokens: null, cacheReadInputTokens: null,
  cacheWrite5mInputTokens: null, cacheWrite1hInputTokens: null, outputTokens: null,
  reasoningTokens: null, totalTokens: null, notes: [note],
});
const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function nested(record: RecordValue, key: string): RecordValue {
  if (record[key] === undefined || record[key] === null) return {};
  if (!isRecord(record[key])) throw new Error(`${key} must be an object.`);
  return record[key];
}

function count(record: RecordValue, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (!isCount(value)) throw new Error(`${key} must be a nonnegative safe integer.`);
  return value;
}

function sum(...values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (!isCount(total)) throw new Error('The token total exceeds the safe integer range.');
  return total;
}

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * This comparison sends one request without server tools. Anthropic separates
 * cache tokens from input; Google includes them. Google compatibility responses
 * have used both visible-only and inclusive completion totals, so reconcile the
 * reported total instead of assuming OpenAI billing semantics from the URL.
 */
export function normalizeUsage(modelId: string, rawResponse: unknown): NormalizedUsage {
  const model = getModelDefinition(modelId);
  if (!model) return empty('invalid', 'This model has no verified relay pricing definition.');
  if (!isRecord(rawResponse)) return empty('missing', 'The response did not contain usage.');
  if (typeof rawResponse.model === 'string' && getModelDefinition(rawResponse.model)?.id !== model.id) {
    return empty('invalid', 'The returned model does not match the requested model; its price is unknown.');
  }
  const nativeGoogle = model.provider === 'google' && rawResponse.usageMetadata !== undefined;
  const raw = nativeGoogle ? rawResponse.usageMetadata : rawResponse.usage;
  if (raw === undefined || raw === null) return empty('missing', 'The provider did not report usage.');
  if (!isRecord(raw)) return empty('invalid', 'The provider usage was not an object.');
  try {
    const notes: string[] = [];
    const serviceTier = raw.service_tier ?? raw.serviceTier;
    if (serviceTier !== undefined && serviceTier !== null
      && !['standard', 'default', 'STANDARD'].includes(String(serviceTier))) {
      return empty('partial', 'The response used an inference tier outside the verified standard rates.');
    }
    if (raw.inference_geo !== undefined && raw.inference_geo !== null && raw.inference_geo !== 'global') {
      return empty('partial', 'The response used regional inference outside the verified global rates.');
    }
    if (raw.speed !== undefined && raw.speed !== null && raw.speed !== 'standard') {
      return empty('partial', 'The response used a speed option outside the verified standard rates.');
    }
    const serverTools = nested(raw, 'server_tool_use');
    for (const key of Object.keys(serverTools)) {
      if ((count(serverTools, key) ?? 0) > 0) return empty('partial', 'Server tool charges are outside this token-only estimate.');
    }
    if ((count(raw, 'toolUsePromptTokenCount') ?? 0) > 0) {
      return empty('partial', 'Tool-use prompt accounting is outside this comparison estimate.');
    }
    if (model.provider === 'anthropic') {
      const input = count(raw, 'input_tokens');
      const output = count(raw, 'output_tokens');
      const read = count(raw, 'cache_read_input_tokens') ?? 0;
      const write = count(raw, 'cache_creation_input_tokens');
      const creation = nested(raw, 'cache_creation');
      const five = count(creation, 'ephemeral_5m_input_tokens');
      const hour = count(creation, 'ephemeral_1h_input_tokens');
      const thinking = count(nested(raw, 'output_tokens_details'), 'thinking_tokens');
      const reportedTotal = count(raw, 'total_tokens');
      if (input === null || output === null) return empty('partial', 'Input or output token usage was not reported.');
      ensure(thinking === null || thinking <= output, 'Thinking tokens exceed the billed output total.');
      const ttlReported = five !== null || hour !== null;
      const ttlTotal = sum(five ?? 0, hour ?? 0);
      ensure(write === null || !ttlReported || write === ttlTotal, 'Cache-write totals contradict the reported TTL breakdown.');
      const writes = write ?? ttlTotal;
      const totalInput = sum(input, read, writes);
      const total = sum(totalInput, output);
      ensure(reportedTotal === null || reportedTotal === total, 'The reported total contradicts the token breakdown.');
      const unknownTtl = writes > 0 && !ttlReported;
      if (unknownTtl) notes.push('Cache writes were reported without a duration; their rate cannot be selected.');
      return {
        status: unknownTtl ? 'partial' : 'complete', inputTokens: totalInput,
        uncachedInputTokens: input, cacheReadInputTokens: read,
        cacheWrite5mInputTokens: unknownTtl ? null : five ?? 0,
        cacheWrite1hInputTokens: unknownTtl ? null : hour ?? 0,
        outputTokens: output, reasoningTokens: thinking, totalTokens: total, notes,
      };
    }

    const input = count(raw, nativeGoogle ? 'promptTokenCount' : 'prompt_tokens');
    const completion = count(raw, nativeGoogle ? 'candidatesTokenCount' : 'completion_tokens');
    const total = count(raw, nativeGoogle ? 'totalTokenCount' : 'total_tokens');
    const detailsRead = count(nested(raw, 'prompt_tokens_details'), 'cached_tokens');
    const directRead = count(raw, nativeGoogle ? 'cachedContentTokenCount' : 'cached_tokens');
    ensure(detailsRead === null || directRead === null || detailsRead === directRead, 'The reported cache-read counts disagree.');
    const read = detailsRead ?? directRead ?? 0;
    const detailsThinking = count(nested(raw, 'completion_tokens_details'), 'reasoning_tokens');
    const directThinking = count(raw, nativeGoogle ? 'thoughtsTokenCount' : 'reasoning_tokens');
    ensure(detailsThinking === null || directThinking === null || detailsThinking === directThinking, 'The reported thinking counts disagree.');
    let thinking = detailsThinking ?? directThinking;
    if (input === null || completion === null) return empty('partial', 'Input or output token usage was not reported.');
    ensure(read <= input, 'Cached input exceeds total prompt tokens.');
    if (detailsRead === null && directRead === null) {
      notes.push('Cache reads were not reported; input is estimated without a cache discount.');
    }
    let output = completion;
    if (model.provider === 'google') {
      if (total === null) return empty('partial', 'Google did not report a total that can account for thinking tokens.');
      ensure(total >= sum(input, completion), 'The reported total is smaller than prompt plus completion tokens.');
      output = total - input;
      if (thinking !== null) {
        if (nativeGoogle) {
          ensure(output === sum(completion, thinking), 'Google native thought and candidate counts do not match the total.');
        } else {
          ensure(output === completion ? thinking <= output : output === sum(completion, thinking),
            'The Google completion, thinking, and total counts cannot be reconciled.');
        }
      } else if (output > completion) {
        thinking = output - completion;
        notes.push('Thinking tokens are inferred from total minus prompt and visible completion for this tool-free request.');
      }
      notes.push('Billed output uses total minus prompt; thinking is not added a second time.');
    } else {
      // Kimi Code is a subscription route. Preserve its reported usage without
      // pretending those counters establish a USD charge or a quota conversion.
      ensure(total === null || total === sum(input, completion), 'The Kimi prompt and completion counts do not match the total.');
      ensure(thinking === null || thinking <= output, 'Thinking tokens exceed the completion total.');
    }
    return {
      status: 'complete', inputTokens: input, uncachedInputTokens: input - read,
      cacheReadInputTokens: read, cacheWrite5mInputTokens: 0, cacheWrite1hInputTokens: 0,
      outputTokens: output, reasoningTokens: thinking, totalTokens: total ?? sum(input, output), notes,
    };
  } catch (error) {
    return empty('invalid', error instanceof Error ? error.message : 'The usage could not be interpreted.');
  }
}

function utcDate(value: string): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const day = new Date(time).toISOString().slice(0, 10);
  return day === value.slice(0, 10) ? day : null;
}

export function estimateModelCost(modelId: string, usage: NormalizedUsage, requestedAtISO: string): CostEstimate {
  const model = getModelDefinition(modelId);
  const base: CostEstimate = {
    status: 'unavailable', usd: null, label: 'Cost unavailable',
    notes: [...(Array.isArray(usage?.notes) ? usage.notes : [])],
    sourceUrl: model?.pricing.sourceUrl ?? '', verifiedAt: model?.pricing.verifiedAt ?? PRICING_VERIFIED_AT,
  };
  if (!model) return { ...base, notes: [...base.notes, 'This model has no verified price.'] };
  if (model.pricing.kind === 'subscription') {
    return { ...base, status: 'subscription', label: 'Subscription quota · USD unavailable', notes: [...base.notes, model.pricing.note] };
  }
  const date = utcDate(requestedAtISO);
  if (!date) return { ...base, notes: [...base.notes, 'The request date is missing or invalid.'] };
  const period = model.pricing.periods?.find(rate => rate.startsAt <= date && (!rate.endsBefore || date < rate.endsBefore));
  if (!period) return { ...base, notes: [...base.notes, 'No verified rate covers this request date.'] };
  if (usage?.status !== 'complete') return base;
  const { inputTokens: input, uncachedInputTokens: uncached, cacheReadInputTokens: read,
    cacheWrite5mInputTokens: five, cacheWrite1hInputTokens: hour, outputTokens: output,
    reasoningTokens: thinking, totalTokens: total } = usage;
  // Recheck the public function's input: callers need not have used normalizeUsage.
  if (!isCount(input) || !isCount(uncached) || !isCount(read) || !isCount(five)
    || !isCount(hour) || !isCount(output) || !isCount(total)
    || (thinking !== null && !isCount(thinking))) {
    return { ...base, notes: [...base.notes, 'The normalized usage is incomplete or malformed.'] };
  }
  if (input !== uncached + read + five + hour || total !== input + output
    || (thinking !== null && thinking > output)) {
    return { ...base, notes: [...base.notes, 'The normalized token counts contradict each other.'] };
  }
  if ((five > 0 && period.cacheWrite5mPerMillion === undefined)
    || (hour > 0 && period.cacheWrite1hPerMillion === undefined)) return base;
  const breakdown = {
    input: uncached * period.inputPerMillion / 1_000_000,
    output: output * period.outputPerMillion / 1_000_000,
    cacheRead: read * period.cacheReadPerMillion / 1_000_000,
    cacheWrite5m: five * (period.cacheWrite5mPerMillion ?? 0) / 1_000_000,
    cacheWrite1h: hour * (period.cacheWrite1hPerMillion ?? 0) / 1_000_000,
  };
  const usd = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (!Number.isFinite(usd)) return base;
  const amount = usd > 0 && usd < 0.000001 ? '<$0.000001' : `$${usd.toFixed(6)}`;
  return {
    ...base, status: 'estimated', usd, breakdown, label: `${amount} estimated`,
    notes: [...base.notes, `Rates verified ${model.pricing.verifiedAt}; token estimate, not an invoice.`, model.pricing.note],
  };
}
