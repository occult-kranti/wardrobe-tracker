# Alpha event stylist: implementation and validation

Completed 2026-09-07. The UI plan, full screen inventory and prioritized follow-ups are in [the alpha review](46-alpha-event-stylist-review.md).

## Delivered behavior

Today, Events and Outfits open `/events/style`. An event-day link prefills its occasion, date and city. The form accepts event time, dress code, indoor/outdoor setting and comfort preferences. City search and forecast are separate explicit actions, with an ambiguous-city chooser, event-local timezone, source and fetch time. Manual and unknown weather remain available.

After the payload disclosure and consent checkbox, the stylist sends the event, weather and a closed selection of eligible garment metadata. It excludes unavailable and lent pieces, photos, costs, garment brands/notes, wear history and account data. Nothing is sent while typing. A strict parser checks every returned ID against the submitted closet. Refinement uses the prior suggestion and a new change request. Late responses cannot cross a changed brief, city, date or wardrobe.

Save and Reserve are explicit. Both preserve wear counts, report storage refusal honestly, prevent duplicate acceptance, and retain the explanation in visible styling notes on Outfits or Events. A failed or cancelled refinement preserves the previous accepted result. Switching event links or wardrobes starts a fresh draft.

The wider screen pass also corrected packing clipboard success/error handling and small controls, the Room link's touch target, a neighbor-rail lookup that could show a local garment on an ID collision, technical household copy, a photo-example developer placeholder, and model/privacy disclosures. Broader page-density improvements remain in the review backlog.

## Verification

| Check | Outcome |
|---|---|
| `npm run verify` | Passed after the event/photo prompt review: production build, lint, privacy checks and all registered suites, including new AI/weather tests; final schema wording alignment also passed a fresh build and focused AI/weather suites |
| `scripts/test-event-stylist-browser.mjs` | 11 passing browser scenarios, including consent, payload exclusions, retry/cancel, refused writes, stale weather and wardrobe isolation |
| `scripts/test-flows.mjs` | 81 passing checks, phone and desktop; feature-flag exclusions reported explicitly |
| `scripts/test-features.mjs` | 177 passing checks; default provider disclosure assertion updated to Fable 5.1 |
| `scripts/audit-alpha-screens.mjs` | 58 captured states across all 21 enabled routes, with zero failures, document overflow or page errors |
| Independent review | Source and refreshed screenshots reviewed; no blocking concerns remained |
| Live city lookup and forecast | Passed with Boston, Massachusetts and the event hour in America/New_York |
| Live Fable 5.1 suggestion and refinement | Passed through the deployed relay, using only synthetic garments |
| Local results viewer | HTTP 200 at phone and desktop sizes, six garment drawings, no horizontal overflow or page errors; gallery exposes all 58 captures; workspace-file requests return 404 |

The latest app changes after the browser suites were confined to the event and photo-intake prompts. The full verification gate passed after that review; a final alignment of the prompt's two-item gap limit passed a fresh build, focused AI/weather tests and live suggestion/refinement. The screen layout and interaction code did not change. The new local results viewer was separately checked with Playwright at 390×844 and 1440×1000.

The reproducible browser gallery is `shots/alpha-review/index.html`; its full report is `shots/alpha-review/report.json`. These ignored local artifacts can be regenerated with `npm run audit:alpha`. Its model responses are mocked UI fixtures, so the gallery is layout evidence rather than a model-quality evaluation.

## Live result and prompt revision

The real test used a synthetic gallery-opening brief for 2026-09-09 at 18:00. The retrieved forecast was 24°C, feels like 23°C, cloudy, 1% precipitation probability and 21 km/h wind. In the final run Fable 5.1 selected the Oxford shirt, navy trousers and black lace-up shoes. On request it replaced the shirt with the plain tee while retaining the trousers and shoes.

Earlier live responses made an unsupported comfort claim, extrapolated evening cooling, and called absent backup shoes a closet gap. The prompt now treats fit and comfort as unknown, anchors weather to its supplied hour, prioritizes explicit requirements and keeps explanations short. The final pair acknowledged unknown comfort, offered a conditional try-on check, omitted unnecessary layers, returned no hypothetical gaps, and warned that the requested tee moved the outfit to the casual end of smart casual. Both responses stayed within the synthetic closet IDs and the refinement kept the requested pieces.

The final rationale/weather/event notes were 33/36/46 words for the first outfit and 37/36/57 for the update. The update's event note slightly exceeded its 55-word instruction; word targets are not parser guarantees. The specific assertion about wind affecting an untucked hem also remains a model inference, not a verified garment property. These two short scenarios establish connectivity, schema compliance and observed improvement; they are not a comprehensive evaluation of styling quality. The broader evaluation matrix and photo-prompt findings are in [the prompt review](48-alpha-prompt-review.md). Photo prompts passed their existing importer/documentation suites; no new live photo evaluation was performed.

Final live evidence was written at 2026-09-07 17:21 UTC to `shots/event-stylist-live.json`. Rerun with `node scripts/test-event-stylist-live.mjs --live`; the flag makes two billable model calls and a public-city weather lookup, with no real wardrobe data.

Run `npm run review:alpha` to open the recorded comparison at `http://127.0.0.1:4176/` and the screen gallery at `/screens/`. It reads the saved artifacts without calling AI. The app preview runs separately on port 4174. Both use the same loopback hostname in links so the app's local wardrobe storage remains on one origin. Restart commands and verified public links are in [the link directory](49-alpha-links.md).

## Release state

The updated `ai-proxy` was deployed successfully to the existing Almari Supabase project. It accepts `claude-fable-5-1` and retains `claude-fable-5` for cached clients. The final live tests reached Fable 5.1 through that relay.

The frontend production build and source changes are ready locally. No frontend publication, commits or branch changes were made. Open the preview at `http://127.0.0.1:4174/#/events/style`, with a wardrobe open, to review the feature.

API references: [Claude Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview), [Open-Meteo forecast](https://open-meteo.com/en/docs), and [city lookup](https://open-meteo.com/en/docs/geocoding-api).
