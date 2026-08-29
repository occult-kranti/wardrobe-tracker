---
name: kimi-research-engine
description: Guidelines for leveraging Kimi (Moonshot AI) alongside Claude in research, competitive intelligence, multimodal vision parsing, and dual-relay AI pipelines.
---

# Kimi & Multimodal Research Engine

This skill governs the dual-provider architecture and multimodal research patterns in Almari.

## Dual-Provider Architecture

The Almari `ai-proxy` relay routes requests dynamically:
- `claude*` models (e.g. `claude-fable-5`) route to Anthropic.
- `moonshot*` / `kimi*` models route to Moonshot Kimi.
- Both API keys reside in the secure Supabase secret store (`ANTHROPIC_KEY`, `KIMI_KEY`) and are never exposed to clients.

## Multimodal Vision & Garment Intake

When processing garment photos, screenshots, or receipts:
1. **Strict JSON Schema**: Always enforce deterministic structured output containing category, subcategory, primary/secondary colors, material, pattern, formal/casual weight, and season tags.
2. **Explainable Features**: Capture *why* an item was classified (e.g., silhouette, notch lapel, fabric weave) to support explainable styling recommendations.
3. **No Erased Attributes**: Never drop maker/tailor details or non-binary category definitions.
4. **Bounding Box Normalization**: Normal coordinates `[ymin, xmin, ymax, xmax]` scaled to the original image dimensions for cropping with Pillow in `.venv`.

## Research & Competitive Intelligence

When ingesting competitive taxonomies:
- Separate marketing claims from verified capabilities (e.g., true behavioural ML vs rule heuristics).
- Focus on user pain points: cold start friction, decision fatigue, guilt/shame mechanisms, and loss of data portability.

