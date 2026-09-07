/** Published first-party rates for the endpoints this relay actually uses. */
export const MODEL_IDS = [
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-opus-5',
  'gemini-3.7-flash',
  'k3',
] as const;

export type ModelId = (typeof MODEL_IDS)[number];
export type ModelProvider = 'anthropic' | 'google' | 'kimi';
export type ModelProtocol = 'anthropic-messages' | 'google-chat' | 'kimi-chat';

export interface PricePeriod {
  /** Inclusive UTC date. Earlier calls cannot be priced from this snapshot. */
  startsAt: string;
  /** Exclusive UTC date, when the provider has published a scheduled change. */
  endsBefore?: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheWrite5mPerMillion?: number;
  cacheWrite1hPerMillion?: number;
  cacheStoragePerMillionTokenHours?: number;
}

export interface ModelDefinition {
  id: ModelId;
  label: string;
  provider: ModelProvider;
  protocol: ModelProtocol;
  imageInput: boolean;
  imageOutput: false;
  contextTokens: number | null;
  contextNote?: string;
  pricing: {
    kind: 'metered' | 'subscription';
    sourceUrl: string;
    verifiedAt: string;
    periods?: readonly PricePeriod[];
    note: string;
  };
}

export const PRICING_VERIFIED_AT = '2026-09-07';
const CLAUDE_PRICING = 'https://platform.claude.com/docs/en/about-claude/pricing';

function claude(id: ModelId, label: string, input: number, read: number): ModelDefinition {
  return {
    id, label, provider: 'anthropic', protocol: 'anthropic-messages',
    imageInput: true, imageOutput: false, contextTokens: 1_000_000,
    contextNote: 'Standard rates across the full 1M context window.',
    pricing: {
      kind: 'metered', sourceUrl: CLAUDE_PRICING, verifiedAt: PRICING_VERIFIED_AT,
      periods: [{
        startsAt: PRICING_VERIFIED_AT,
        inputPerMillion: input, outputPerMillion: input * 5,
        cacheReadPerMillion: read,
        cacheWrite5mPerMillion: input * 1.25, cacheWrite1hPerMillion: input * 2,
      }],
      note: 'USD per million tokens, standard global Claude API. Output includes thinking. No long-context premium. Excludes tools, tax, discounts, and fast or regional inference.',
    },
  };
}

export const MODEL_CATALOG: readonly ModelDefinition[] = [
  claude('claude-fable-5-1', 'Claude Fable 5.1', 10, 0.25),
  claude('claude-fable-5', 'Claude Fable 5', 10, 1),
  claude('claude-opus-5', 'Claude Opus 5', 5, 0.5),
  {
    id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', provider: 'google',
    protocol: 'google-chat', imageInput: true, imageOutput: false,
    contextTokens: 1_048_576, contextNote: 'No separate long-context tier is listed for this model.',
    pricing: {
      kind: 'metered', sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.7-flash',
      verifiedAt: PRICING_VERIFIED_AT,
      periods: [
        {
          startsAt: PRICING_VERIFIED_AT, endsBefore: '2027-01-01',
          inputPerMillion: 0.75, outputPerMillion: 3.75, cacheReadPerMillion: 0.075,
          cacheStoragePerMillionTokenHours: 0.5,
        },
        {
          startsAt: '2027-01-01', inputPerMillion: 1.5, outputPerMillion: 7.5,
          cacheReadPerMillion: 0.15, cacheStoragePerMillionTokenHours: 1,
        },
      ],
      note: 'Standard paid Gemini Developer API rates. Introductory rates end December 31, 2026. Output includes thinking. Excludes explicit cache storage, tools, tax, free-tier allowances, and other inference tiers.',
    },
  },
  {
    id: 'k3', label: 'Kimi K3 (Code)', provider: 'kimi', protocol: 'kimi-chat',
    imageInput: true, imageOutput: false, contextTokens: 1_048_576,
    contextNote: '256K on Moderato; up to 1M on Allegretto and higher plans. Keep thinking enabled to use K3.',
    pricing: {
      kind: 'subscription',
      sourceUrl: 'https://www.kimi.com/code/docs/en/kimi-code/membership.html',
      verifiedAt: PRICING_VERIFIED_AT,
      note: 'The relay uses Kimi Code membership quota. Optional Extra Usage has account-specific rates; a USD price for this call is unavailable. Separate Kimi Open Platform rates do not price this coding endpoint.',
    },
  },
];

/** Match the relay's explicit IDs and its documented date/latest suffix rule. */
export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  if (typeof modelId !== 'string') return undefined;
  return MODEL_CATALOG.find(model => model.id === modelId)
    ?? MODEL_CATALOG.find(model => modelId.startsWith(`${model.id}-`)
      && /^(?:latest|\d{6,8})$/.test(modelId.slice(model.id.length + 1)));
}
