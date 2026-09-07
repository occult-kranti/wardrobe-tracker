# Admin AI workbench

The alpha portal now has an **AI workbench** beside its operational monitor. An operator can supply a photograph or a synthetic event case, choose up to four models, inspect the exact input, and explicitly run a sequential comparison. Each returned answer retains its provider model, elapsed request time, usage, estimated USD cost or an honest unavailable/subscription label, validation findings, and review notes.

The public portal shell is published at `/portal/` on the consumer site's origin. The server authenticates every operational read, relay probe and model test; the public interface is not an authorization boundary. The workbench does not import account context or read consumer wardrobe stores. Its test fixtures and uploads are supplied deliberately by the operator.

## Running a comparison

1. Enter the admin token. It lives in React memory. Changing or forgetting the token clears displayed operational records and remounts the workbench, aborting pending requests and discarding its test material. The entry point removes the former `almari-admin-token` session-storage key without reading it.
2. Choose **Flat-lay catalogue**, **Worn outfit catalogue**, **Event styling**, or **Custom prompt**. Photo presets import the app's actual intake prompts. Event styling uses the app's actual prompt builder and garment-ID parser with explicitly supplied JSON. No weather lookup runs in this portal.
3. For photo modes, upload a JPEG, PNG or WebP of at most 12 MB and 50 million pixels. Preparation happens locally: JPEG quality 0.88, longest edge at most 1400 pixels. The preview and dimensions show the prepared image actually sent. Event mode sends no image; Custom accepts an optional image.
4. Inspect the system and user prompts, choose models and set a token ceiling between 512 and 16000. At most four models run, one at a time. Opening a panel, changing a model or editing an input sends no request.
5. Press **Run selected models**. Input controls freeze during the run. Every selected model receives the same captured prompt, image and token ceiling. Authentication refusal stops the remaining queue; other provider failures remain visible and allow the next selected model to run. There are no automatic retries.

Event JSON must be applied before running. Settings and weather sources require actual string enum values; dates must exist in the calendar and times use 24-hour `HH:mm`. Supplied forecast timestamps and timezones are validated. Historical dates are accepted for reproducible test cases. The generated event user prompt is read-only so the sent closet IDs and validation items cannot drift; edit the JSON and apply it, or use Custom for unrestricted prompt experiments.

## Reading results honestly

The comparison table separates transport status, feature validation, elapsed request time, input/output tokens and cost. Missing provider usage is not rendered as zero. Reasoning and cached-token details appear with each answer when returned. Published rates, verification date and pricing notes come from the shared model catalog and cost module. Rates are selected using the request date. Kimi Code membership usage has no defensible universal USD price per call and is labelled as subscription usage. Estimates exclude account-specific adjustments and are not invoices.

Photo answers pass through the app's intake parser. Repairs, dropped rows, uncertain fields and low model confidence are visible. Crop previews additionally require an unambiguous, finite, positive rectangle within the single prepared image. Out-of-bounds coordinates are not silently clamped into plausible previews. Overlays and thumbnails are local rectangular crops, not generated images, segmentation or background removal. Schema acceptance and model confidence do not establish visual accuracy.

Event answers must use known garment IDs and the real suggestion schema. An accepted schema does not establish dress-code suitability, weather reasoning or comfort. Review notes allow an operator to record those qualitative judgments without pretending to produce an automatic quality score. Custom answers are labelled unstructured. All answer text and raw JSON render as escaped text.

A completed provider response is retained with its usage and cost **before** local validation or image cropping. Local analysis failures cannot turn a known completed call into a missing billing record. Cancel stops waiting and prevents unsent models from starting; a submitted call may still be charged. Cancel during local cropping preserves the completed response. Clear, token changes and Forget intentionally discard the old comparison, and late requests cannot repopulate it.

## Memory, exports and deployment

Tokens, uploaded images, edited prompts, event cases, provider answers and notes are not written to localStorage or sessionStorage. An explicit model call sends the prepared input through the authenticated admin endpoint to the selected provider. Provider processing and retention apply to that submission. No workbench data is sent to the alpha usage collector.

**Export comparison JSON** downloads the captured prompts, model responses, usage, price sources, validation and review notes. It excludes the admin token. Prepared input-image and local crop bytes are excluded by default and require the adjacent export checkbox. Raw provider text remains part of the export. A new run replaces the comparison; Clear removes its test data; reload removes page-memory credentials and results.

The portal does not register a service worker. Current consumer-worker rules bypass the portal, but this is a same-origin deployment and an older installed worker may still have cached an older public shell until it updates. Authentication is enforced by the server independently of the shell.

## Focused verification

Run against a served portal with `node scripts/test-portal-workbench.mjs http://localhost:4175` (or its preview origin). The suite uses a generated synthetic image, in-memory fixtures and intercepted admin responses; all other off-origin requests are blocked. It covers quiet mount/editing, missing/refused auth, legacy token cleanup, sequential captured inputs, actual image preparation and crops, exports with and without images, unsafe output escaping, event-ID alignment, strict date/enum validation, token-change cancellation, pending-request cancellation, completed-call preservation during cropping, invalid answer billing, and 390px/1280px overflow checks. Screenshots and its JSON report are written under `shots/portal-workbench/`.

The implementation agent did not run builds or tests. The coordinating root runs the serialized build, browser and live endpoint gates and records their actual outcomes separately. Synthetic browser responses verify application behavior; they do not measure live model quality or prove production admin credentials are configured.
