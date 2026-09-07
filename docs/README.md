# Repository guide

Almari's current release records are [links](49-alpha-links.md), [event stylist](46-alpha-event-stylist-review.md), [prompt review](48-alpha-prompt-review.md), [Rose atelier](50-rose-atelier.md), [border repairs](53-border-ornaments.md), [model pricing](54-model-pricing.md), and [admin AI workbench](55-admin-ai-workbench.md). Earlier numbered documents record earlier decisions; newer owner directions take precedence.

| Area | Source | Purpose |
|---|---|---|
| Web alpha | `src/pages`, `src/components`, `src/lib` | Local wardrobe, outfits, event styling and themes |
| Shared logic | `packages/shared` | Storage schema, migration, dates, cost, intake and navigation |
| Operator portal | `src/portal` | Explicit stats and AI tests; no consumer account/store imports |
| Model tests | `src/portal/lib` | Cases, network client, provider catalog and usage-based estimates |
| Server functions | `supabase/functions` | Consumer relay, authenticated admin endpoints, optional usage collector |
| Native scaffold | `app` | Separate mobile track; web navigation changes do not redefine native slots |
| Verification | `scripts/test-*.mjs`, `scripts/check-*.mjs` | Repeatable regression and isolation checks |
| Public assets | `public` | App icons, fonts, sample material and public alpha introduction |
| Company boards | `company` | Workflow copies only named public board files; `company/index.html` remains excluded |

`dist/` and `dist-portal/` are generated builds. `shots/` holds local screenshots, synthetic model results and review artifacts; it is ignored by Git. Provider keys, admin tokens and user test images do not belong in source control. The portal keeps its submitted material in memory unless the operator explicitly exports a report.

Use `npm run verify` for the serialized build and offline gate. Then build the separate portal with `npm run build:portal`. Browser checks use the app at `http://127.0.0.1:4174/` and portal at `http://127.0.0.1:4177/`; run `test:borders`, `test:portal`, and `test:portal:workbench` with the relevant origin argument. `npm run stage:portal` explicitly adds the built public portal shell to `dist/` after consumer isolation has passed.

Privacy remains defined by [what Almari records](45-what-almari-records.md). The operator's supplied prompts and photographs are test material sent only on Run; they are not alpha usage records.
