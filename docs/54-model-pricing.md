# Model comparison pricing

Verified **2026-09-07** against the first-party endpoints selected in
`supabase/functions/ai-proxy/index.ts`. These are public list-price estimates,
not account invoices. No provider calls were made for this research.

## Catalog

USD per million tokens, standard synchronous inference:

| Relay model | Input | Output | Cache read | Cache write 5m | Cache write 1h |
| --- | ---: | ---: | ---: | ---: | ---: |
| `claude-fable-5-1` | 10 | 50 | 0.25 | 12.50 | 20 |
| `claude-fable-5` | 10 | 50 | 1 | 12.50 | 20 |
| `claude-opus-5` | 5 | 25 | 0.50 | 6.25 | 10 |
| `gemini-3.7-flash`, through 2026-12-31 | 0.75 | 3.75 | 0.075 | — | — |
| `gemini-3.7-flash`, from 2027-01-01 | 1.50 | 7.50 | 0.15 | — | — |
| `k3`, Kimi Code endpoint | Subscription | Subscription | — | — | — |

Claude uses global `api.anthropic.com/v1/messages`. Its full 1M context has
standard rates. Cache TTLs change write prices. Batch, fast mode, US-only
inference, and server tools have separate adjustments; this comparison sends
standard requests without tools. [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)

Google uses `generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
The table uses its paid standard tier; a project's free allowances or discounts
are not known. Explicit cache storage is separate: $0.50 per million token-hours
through December 2026, then $1.00. This workbench does not create explicit caches.
No separate long-context tier is listed for this Flash model.
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.7-flash)

Kimi uses **`api.kimi.com/coding/v1/chat/completions`**, which draws on membership
quota. Optional Extra Usage draws on a separate account balance with rates shown
by the platform. Its documentation does not publish an exact USD token schedule
for this endpoint. A token count cannot establish this call's USD cost or
subscription-quota consumption. The portal displays “Subscription quota · USD
unavailable”; it does not show $0 or apply the separate Kimi Open Platform rates.
[Kimi Code membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html),
[endpoint distinction](https://www.kimi.com/code/docs/en/kimi-code/faq.html)

## Image and context capability

All five accept image inputs and return text. This is image analysis, with no
image-generation output supported by the catalog. Claude has a 1M context and
128K maximum output. Gemini has 1,048,576 input and 65,536 output tokens. Kimi `k3`
has 256K on Moderato and up to 1M on higher membership tiers; disabling thinking
routes to a different Kimi model, so comparisons keep it enabled. The relay's
own output cap remains 16,000 tokens.
[Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview),
[Fable 5](https://platform.claude.com/docs/en/models/fable-5/overview),
[Opus 5](https://platform.claude.com/docs/en/models/opus-5/overview),
[Gemini 3.7 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash),
[Kimi Code models](https://www.kimi.com/code/docs/en/kimi-code/models.html)

## Usage accounting

`normalizeUsage(modelId, rawResponse)` accepts the full provider payload.
Its counters are nonnegative safe integers or `null` when unavailable. Its status
distinguishes complete, partial, missing, and invalid usage. Reasoning is an
informational output subset; an absent breakdown stays unknown.

For Claude:

```text
input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
cache_creation_input_tokens = ephemeral_5m_input_tokens + ephemeral_1h_input_tokens
output = output_tokens
```

The cache categories are disjoint charges. Positive cache creation without a
known TTL leaves cost unavailable. `output_tokens_details.thinking_tokens` is
already included in output and is never added again. Top-level totals are used
once; any per-iteration breakdown is not summed over them.
[Claude cache accounting](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
[thinking usage](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)

For Google, cached tokens are a subset of prompt tokens. Native usage separates
`candidatesTokenCount` and `thoughtsTokenCount`; total includes prompt, candidates,
and thoughts. Google's compatibility examples also show completion counts that
exclude thinking. The implementation therefore reconciles **output = total −
prompt** for these requests without server tools, supporting both additive and
inclusive completion conventions. Explicit thinking must agree with that total;
otherwise the price is unavailable. When a separate thinking count is inferred
from the remaining tokens, the result says so. Missing total means unavailable
cost. This reconciliation is our implementation inference from the documented
accounting, not a claim that Google's beta compatibility layer mirrors another
provider's schema.
[Google usage schema](https://ai.google.dev/api/generate-content#UsageMetadata),
[Google compatibility example](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/migrate/openai/examples),
[Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai)

Google/Kimi cache counts can be returned in `prompt_tokens_details.cached_tokens`
or a direct cached-token field. Conflicting counts are rejected. When no cache
read count is reported, the estimate assumes full input pricing and explicitly
states that no cache discount was applied. Kimi counters are displayed without
turning them into a charge.
[Kimi response example](https://platform.kimi.com/docs/api/chat)

## Cost contract and limits

`modelCatalog.ts` exports `MODEL_IDS`, `MODEL_CATALOG`, `ModelId`,
`ModelDefinition`, `PricePeriod`, `PRICING_VERIFIED_AT`, and
`getModelDefinition(modelId)`. Exact relay IDs plus its allowed latest/date
suffixes resolve to the same catalog entry.

`modelCost.ts` exports `NormalizedUsage`, `CostEstimate`,
`normalizeUsage(modelId, rawResponse)`, and
`estimateModelCost(modelId, usage, requestedAtISO)`.

The estimator selects the published period using the request's UTC date, never
the current render date. Calls before this 2026-09-07 pricing snapshot are not
retroactively priced. Gemini's published 2027 change is represented explicitly.
There is no claim that an undated provider price remains guaranteed forever;
the source and verification date accompany every estimate.

The result is `estimated`, `unavailable`, or `subscription`, with nullable `usd`,
a display `label`, source/date, notes, and an optional USD category breakdown.
Each charged category is multiplied by its rate and divided by one million.
Rounding occurs only for display. Missing rates, unknown model returns,
contradictory totals, invalid numbers, unsupported inference tiers, and server
tool charges cannot silently become zero. Explicitly reported zero usage can
produce a zero token estimate. Small positive amounts retain a nonzero label.

The estimates omit taxes, account discounts, free allowances, explicit cache
storage, tool fees, and subscription allocations. The workbench's in-memory
result can retain usage and timestamps without storing prompts or photographs.

## Verification

`scripts/test-model-cost.mjs` uses synthetic offline fixtures. It covers all
five model definitions, Claude mixed-TTL caching and thinking, both Google
completion conventions and native counters, unknown reasoning, the exact
Gemini year boundary, missing usage, conflicting model/usage records, invalid
dates, malformed/nonfinite/negative/fractional/unsafe counters, subscription
handling, unsupported pricing modifiers, and tiny nonzero amounts. Root runs
this suite with the serial verification gate.
