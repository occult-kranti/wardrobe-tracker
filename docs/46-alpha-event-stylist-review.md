# 46 - Alpha event stylist and screen review

Reviewed 2026-09-07. Scope: the current web alpha with `FEED_ENABLED = false`, its route table, primary modals and tester guidance. The native scaffold and separate operator portal are outside this product pass.

This combines an independent source review, implementation brief and the visual review recorded below. The visual pass covers every initially captured mobile screen type and sampled desktop screens; its exact coverage and limitations are stated in that section. Recommendations describe the inspected baseline, with implemented corrections recorded in the final review status; they do not imply that every follow-up shipped. Browser results and release verification also belong in the implementation handoff.

## The task and the user journey

A tester should be able to ask, "What should I wear to an outdoor wedding on Saturday?", receive an outfit drawn from the wardrobe that is open, understand how it fits the event and weather, request a change, and keep the accepted selection.

Use a dedicated event styling screen at `/events/style`, reached from Today, Events and Outfits. Keep Today's fast wear logging as its main action. Conversations continues to mean the threads between wardrobes on this device; an AI tool should not quietly change what that existing room means.

1. **Describe the event.** Ask what it is, its day, the local event time if known, indoor/outdoor setting and optional dress code. A saved event can prefill its name, place and reservation day. Let ordinary language carry requirements such as walking, a covered venue or wanting another layer.
2. **Choose weather context.** Provide a city search behind a clearly named button, with the weather service named beside it. Let the tester choose among ambiguous city matches. Display the selected place, forecast date, temperature, rain and wind where available, timezone and time retrieved. Keep a manual weather choice and an unknown-weather state usable without a forecast request.
3. **Ask the model.** Before the button, name the active provider/model and the wardrobe fields being sent. The request contains bounded, eligible clothing metadata plus the event and supplied weather. Nothing is requested or transmitted on page entry or field edits.
4. **Review an outfit.** Show local garment pictures or the existing garment plates, names, an event explanation and a weather explanation. Label assumptions and wardrobe gaps. A missing rain layer is a factual gap, never an instruction to shop.
5. **Update it.** Accept a short refinement such as "more formal", "warmer", or "different shoes". Carry forward the prior selection and the changed request so the next result is a revision, while still validating against currently available clothing. Keep the previous valid result available if the next request fails.
6. **Keep the accepted version.** Save an outfit and, when entered through an event reservation, explicitly hold its IDs for that day. Saving or reserving is not wearing. Existing outfits, event reservations, exports and sync remain the persistence mechanism.

The form is one column on a phone. A result belongs below the form or beside it on a wide screen, not inside a second nested modal. Use the existing Card, Field, Button and garment-photo primitives; one primary action at the current step; visible input labels; 44px targets; text of at least 13px on interactive controls. Put short explanations beside the choice they explain.

## Functional contract

- **Availability:** choose only from the open wardrobe. Exclude retired pieces, laundry, repair/tailor states, packed-away pieces, quiet categories and pieces currently lent out. An absent material, season or occasion is unknown information, not a reason to reject all clothes. Recheck availability before accepting a response or saving it.
- **No invented wardrobe:** model output is bounded JSON containing IDs from the supplied set. Reject unknown or duplicate IDs and malformed output; never manufacture a garment record from model prose. Respect custom categories and non-Western ensembles rather than requiring a universal top/bottom/shoes template.
- **Prompt separation:** event descriptions, refinements, category labels and garment names are data, not instructions. The system prompt states the task, allowed evidence, output schema, inclusivity and no-commerce rules. It asks for concise garment-based reasons and uncertainty, never appearance or body verdicts.
- **Data minimization:** send only fields needed to select clothing. Photographs, cost, account names, handles, emails, private chats and unrelated notes do not belong in this text request. User-entered requirements are explicit input to this feature, not an extension of the alpha usage record.
- **Forecast integrity:** weather is for the event location and day. An event beyond the service's forecast range stays unknown until the tester provides conditions or returns later. Never substitute today's forecast. A city/date/time change invalidates the old weather. Manual weather remains visibly manual.
- **Request integrity:** no background polling. Guard against duplicate sends, support cancellation or safe abandonment, and reject late responses from an obsolete request or wardrobe. A changed event or closet makes a previous result visibly stale before it can be saved.
- **Persistence:** a draft is local, accepted IDs are saved through existing wardrobe APIs, and no wear count changes. Do not claim a successful durable save over a refused local write. Keep saved outfit semantics distinct from event reservations and Calendar plans.
- **Failure recovery:** forecast unavailable, no city match, empty closet, all pieces unavailable, model unavailable, rate limiting and invalid output each need an actionable message with the existing draft preserved.
- **Model rollout:** the requested Fable 5.1 identifier must agree across the client default, hosted relay allowlist and any maintained fallback relay. Name a custom endpoint's actual configured model. Verify the identifier against authoritative provider information before claiming live availability. A local configuration change is not a deployed relay update or a live provider test.

## Priorities for this change

| Priority | Problem seen in the baseline | Concrete change / acceptance |
|---|---|---|
| P0 | Events holds outfits but cannot answer an event question; Outfits has a local generator. | Add the explicit event/style request, a validated outfit result, revision and accepted save/reservation. |
| P0 | Existing AI disclosure is photograph-only; Intake embeds a generic Claude Fable name. | Update send-time model labels, Settings and privacy documentation together with the new request. State city lookup separately from model input. |
| P0 | A late answer could outlive changed conditions or a changed wardrobe. | Invalidate obsolete requests/results and validate IDs/availability on response and save. |
| P1 | A forecast can easily be confused with an observation or weather on another day. | Show source, location/day and freshness. Make manual and unknown states explicit; test out-of-range dates. |
| P1 | Planning is spread among Events, Calendar, Outfits and Packing. | Give the new screen clear return links and name exactly what Save/Hold changes. Calendar currently renders `wearLogs`, not event reservations; avoid implying otherwise. |
| P1 | Packing copy confirms before the clipboard promise succeeds. | Await the write, show success only after completion, and preserve the list with a usable failure message. |
| P1 | Packing trip-day buttons are small, and the search field has no visible/programmatic label. | Use 44px controls, at least 13px labels, selected-state semantics and a search label. |
| P1 | The neighbor rail's lendable rows resolve `piece.itemId` through the active wardrobe without the `profile.isMe` guard used by the showcase. | Guard that lookup too, and test an ID collision so a neighbor row cannot pick up the active wardrobe's photo or colour. This finding is from source inspection, not a browser reproduction. |
| P2 | Some product copy exposes implementation rather than purpose. | Replace House's "ids and a kind" wording with what joining a household does. Clarify which use of a saved city can contact a weather service. |

## Complete alpha screen inventory

The addresses below come from `src/lib/routes.ts` and `src/App.tsx`. The source review considered empty, populated and unavailable-object branches where they exist; visual and interaction confirmation remains a separate browser task.

| Screen / address | What works in the existing design | Improvement to carry into alpha testing |
|---|---|---|
| Door, signed out (`/open`, `/open/new`, guarded deep links) | Local wardrobe use is the prominent action; optional account and sample path are stated. | Check that a cold tester reaches a first piece without interpreting the account card as mandatory; retain the requested deep-link destination. |
| Today (`/`) | Wear logging has a short path, plans stay separate from counted wears, manual weather is local. | Place the event question near planning without displacing logging; make the AI request's weather distinct from Today's daily chips. |
| Closet (`/closet`) | Search, filters, laundry/retirement states and an optional room view make the catalog usable. | The populated masthead offers several photo paths plus packing at once. Group photo methods under one clear entry; increase the empty-state photo links from 11px to interactive text size. |
| Add/amend a piece (modal) | Name-only creation works; photo reading is explicit; other facts are optional. | Verify the Save action stays easy to reach with the phone keyboard open, and that failed AI reading leaves manual entry usable. |
| Item detail (modal) | Wear history, storage location, cost facts and retirement have context. | Review action density on a phone, focus when confirmations open/close, and current lending/repair state before suggesting the piece. |
| Photo intake (`/intake`, worn/gallery/screenshot variants) | Drafts are checked before writing; photo handling and local cuts are explained. | Use the configured model label everywhere; make method choice easier to scan and preserve per-file retry context in batches. |
| Outfits (`/outfits`) | Unlimited/custom-category composition and local generation coexist with saved sets. | Clearly label the event AI entry and the existing local draw. Keep saved outfit editing/refinement distinct from logging a wear. |
| Dressing room (`/furniture`) | Real wardrobe places are optional and have a clear Closet return. | Keep the picture as a usable alternate view of the closet; test lengthy place names and a wardrobe with no assigned locations. |
| One place (`/furniture/:id`) | Slot naming, filing and packing are actions on existing garments. | Make the current slot and what packing changes clear; preserve a reliable path back to the room and closet. |
| Packing list (Closet modal) | Search, manual selection, packed checks and a text export are present. | Fix clipboard success and control sizing/labeling. Later, prefill from event reservations and state whether an unfinished list survives closing/reloading. |
| Calendar (`/calendar`) | Planned days are separated from actual wears, with confirmation when a plan is worn. | Event reservations are not displayed here. Later add a dated event reference without converting it into a wear log. Test week edges and future versus past actions. |
| Events (`/events`) | Multi-day reservations, saved outfits, loose pieces and removal are supported. | Add the AI question beside a day. Later allow editing event name/place/date without removing and rebuilding the event. |
| Event stylist (`/events/style`, new) | Planned in this change. | Test the full request/revise/save flow, no automatic network, forecast failure, unavailable pieces, stale responses and zero wear-count movement. |
| Ledger (`/ledger`) | Neutral counts and cost facts replace scores; short/empty histories have sensible branches. | On phones, group the many charts into easier-to-scan sections; clarify cumulative cost-per-wear versus monthly activity and add per-category cost if prioritized. |
| Wishlist (`/wishlist`) | Waiting, kept, released and bought remain factual and have no shopping destination. | Make the distinction between "Kept" on a list and an owned piece obvious in user testing; preserve draft context while comparing with owned garments. |
| Before you buy (`/compare`) | Local matching explains alternatives across categories. | Label preset colours in words as well as hex values; show a compact live results announcement so keyboard/screen-reader users know matches changed. |
| Conversations (`/chats`) | The single-wardrobe empty state explains why another wardrobe is needed; samples are labelled. | A first-time user can still mistake this primary tab for remote messaging. Keep "on this device" visible in populated states and keep AI elsewhere. |
| Conversation (`/chats/:id`) | Attach/show, ask and lend are separate; removal has a consequence description and undo. | Replace the 60-piece attachment cap with search or pagination later; confirm the composer stays usable above the keyboard with long messages. |
| House (`/profile`) | Current wardrobe, samples and household invitations are distinguished. | The nav says House while the masthead is the wardrobe's name; add straightforward context and make wardrobe details/settings easy to find. Replace implementation jargon. |
| Another profile (`/profile/:id`) | Sample context and intentionally shared snapshots are preserved. | Keep current-wardrobe statistics out of another profile; ensure long names and missing profile states are readable. |
| Shared rail (`/rail`) | Loans and returns have a factual record; privacy copy reflects this wardrobe's sync state. | Clarify its relationship to Conversations so two thread surfaces do not imply two messaging networks. Preserve the empty-state route to actual lending. |
| Neighbor rail (`/rail/:id`) | Missing profiles have an exit and neighbor showcases are guarded. | Fix the lendable-ID lookup noted above; show only the neighbor's stored snapshot or an empty garment plate. |
| Settings (`/settings`) | Export/import consequences, optional sync, endpoint override and inspectable usage consent are explicit. | Put Data, AI/weather and Appearance behind readable section navigation as the page grows; replace photograph-only network claims. Do not hide export or the usage off control. |
| Wardrobes, signed in (`/open`) | Switching and starting another wardrobe preserve separate stores; sample labeling and sync intent are supported. | Explain saved-city reuse without promising automatic forecasts. Verify an in-flight stylist answer cannot cross a switch. |
| New wardrobe, signed in (`/open/new`) | Name-first onboarding avoids unnecessary fields. | Preserve local-first defaults and route back to the intended destination if started from a deep link. |
| Tutorial / page guides | Walkthroughs are replayable and dismissible. | Add a short event-stylist guide only if tests show the disclosure and form leave uncertainty; avoid stacking an automatic tour over forecast or AI decisions. |
| Alpha usage consent (modal and Settings) | The exact payload and revocation are part of the UI. | Keep event descriptions, cities, forecast contents, refinements and outfit names outside the closed usage vocabulary. No extra collection is needed for this feature. |
| Missing page / lazy-load failure | Clear recovery explains that the wardrobe remains stored. | Verify the new route has the same guard, lazy-load recovery and offline behavior. |

`/feed`, `/explore`, `/explore/:postId` and `/story/:accountId` are deliberately hidden by the current alpha flag and redirect to Today. Their source surfaces were checked for scope; they are not tester-visible screens in this alpha and should not be enabled as part of styling. The separate operator portal is likewise not an alpha product route.

## Test script for a moderator

Use a wardrobe with clean pieces from custom categories, at least one retired piece, one in the wash and one lent out. Include both photographed and unphotographed pieces. Run once on a narrow phone and once on desktop.

1. Open Today, find the event question and describe a weekend event. Observe whether the tester can explain what leaves the device before pressing anything.
2. Search an ambiguous city, choose the intended place and verify the event day shown. Change the date beyond the forecast range; the old forecast must disappear and manual/unknown weather must remain usable.
3. Generate from the clean closet. Confirm every card refers to an owned eligible piece and its explanation cites the supplied event/weather without invented capabilities.
4. Ask for a warmer or more formal version. Confirm the change is understandable, then simulate a failed retry and verify the prior useful result and entered requirements remain.
5. Change the event or make a selected piece unavailable while a response is pending. Confirm the old response cannot be accepted as current.
6. Save and hold a result against an event day. Reopen Events and Outfits; verify the actual selected IDs and zero increase in wear counts. Separately confirm wearing still requires the existing log action.
7. Switch wardrobes during a request, then return. No answer or piece from one wardrobe may appear in the other.
8. Repeat with no network, no eligible pieces and invalid model JSON. Each state must explain a usable next action without saving a fake outfit.
9. Inspect keyboard navigation, input labels, focus after error/success, 200% zoom and long text. In every supported theme, compare the form, buttons and garment tiles at a 390px viewport.
10. Leave usage recording off throughout. Network inspection must show neither usage recording nor a forecast/model request before the relevant explicit action.

Automated coverage should assert request payload boundaries, structured-result validation, forecast dates/units/timezones, stale request rejection, provider errors, existing BYOK behavior, wardrobe isolation and reservation-versus-wear semantics. The owner of verification runs `npm run verify` after the implementation wave, followed by the existing all-route browser suite and the new focused browser scenarios. Mocked browser tests demonstrate behavior; a live provider call and deployment status must be reported separately.

## Visual review of the first implementation capture

The artifact is `shots/alpha-review/index.html`, with `report.json`, viewport captures and selected full-page captures alongside it. The first report was generated at 2026-09-07 16:39 UTC from the local preview. It captured **54 screens across 21 enabled routes**, at **390 x 844** and **1440 x 1000**. The result was produced with mocked AI, so it demonstrates rendering and controls, not live model styling quality.

Independent visual review opened every one of the **27 mobile screen captures**: the 21 routes in the inventory, garment detail, new event, AI result and three signed-out arrival variants. Desktop review sampled Today, Closet, Outfits, Calendar, Events, event result, Settings, Intake, arrival, garment detail and event creation. Full-page review additionally examined the stylist, Settings, Ledger, Wishlist and Intake. Every captured screen type was inspected on mobile; this does not imply that every theme, empty state, keyboard state or uncaptured modal was visually tested.

The layout reads consistently in the captured dye-house theme. Existing Calendar/category/item rails use intentional clipped edge previews inside their own scroll regions; they are not document overflow. Garment pictures remain on plain mats, action text stays readable, and the new stylist fits the existing form/card language on desktop.

The initial artifact records six failures: **57px document overflow on both mobile stylist states**, plus four event-picker captures blocked by a previously opened modal in the audit sequence. The long stylist masthead metadata visibly clips the Events return button. The root implementation has shortened the metadata; the capture must be refreshed to verify the fix. The four modal errors are a harness sequencing issue, not evidence that users cannot open the individual dialogs. Event day-detail and saved-outfit-picker screenshots are still pending that correction.

### Findings to retain from the screenshots

| Priority | Visual evidence | Improvement / status |
|---|---|---|
| P1 | `events-style-mobile.png`: Events return button beyond the right edge. | Shorten masthead metadata; root fix is on disk, refreshed evidence pending. |
| P1 | `events-style-result-mobile.png`: automatic focus leaves only the result heading at the bottom while the consent card occupies most of the viewport. | Scroll the accepted result into a useful reading position below the fixed header, keeping accessible focus. |
| P1 | `closet-mobile.png`: the room's text link is only 110 x 16px in the report. | Increase the actual linked hit area to 44px. The new consent checkbox's 13px native box is not the same defect: its enclosing 44px label is clickable. Hidden file/colour inputs likewise are not the visible targets. |
| P1 | `intake-mobile-full.png`: the first sample exposes `PUBLIC/INTAKE-SAMPLES/BED-FLATLAY.JPG` as an instruction to a tester. | Replace the developer file-path placeholder with a plain description of an example without a photograph, or omit that unavailable image example. Lower blank lazy image tiles in the full-page capture were not treated as confirmed broken images. |
| P2 | `closet-mobile.png`: five vertically stacked intake/packing actions and the room consume the first screen before any garment is visible. | Consolidate photo methods into a chooser. Keep the owner's room view, with its existing hide control, but move tool density out of the garment browsing path. |
| P2 | `outfits-mobile.png`: the local Deal a set controls consume the screen before the first saved outfit. | Make the local generator collapsible or place it behind a compact action; keep saved sets immediately discoverable. |
| P2 | `settings-mobile-full.png` and `ledger-mobile-full.png`: several thousand pixels separate top-level facts from later controls/tables. | Add section jump links or collapsible secondary sections. Keep export/usage control easy to reach; keep chart definitions beside their figures. |
| P2 | `wishlist-mobile-full.png`: a single comparison match occupies a narrow tile while the rest of the card is empty. | Let one match use a horizontal image/text row; retain the grid when several matches exist. |
| P2 | `intake-mobile-full.png`: three photo methods repeat long network explanations before sample examples. | Use an explicit method selector with the appropriate disclosure beside the active action. Preserve the pre-send explanation. |

Full-page screenshots taken after focus/scroll can paint fixed navigation in the middle of the stitched document. This is a capture artifact; viewport screenshots are the evidence for what blocks the visible screen.

The source review also found retained-result save flags being reset before a failed retry, editable refinement text during a request, missing durable-write acknowledgement, saved styling notes not being shown after leaving the result, and one remaining absolute privacy sentence. These were sent to the implementation owner and are being corrected. A refreshed passing browser report plus the final required verification gate are needed before the review recommends publishing the feature or updating the relay.


## Final source review status

The implementation owner reported that the 11 focused event-stylist browser scenarios passed, including refusal of durable writes, failed refinement retries, stale weather and wardrobe switching; the existing phone/desktop flows also passed. The full verification gate had passed twice at this point. The final feature-suite disclosure assertions and refreshed screenshot audit were still being completed, so those final outcomes are not inferred from the earlier runs. The independent reviewer did not run concurrent builds or tests.

The following corrections were independently confirmed on disk after that report:

- Successful generation resets the save/reservation flags only when a new validated result arrives; a failed or cancelled update retains both the previous result and its saved state.
- Refinement input is disabled during generation. Event query changes remount the form, and unmount cancels outstanding weather/model requests.
- Save and reserve use `confirmWrite`. Controls distinguish an in-session addition from a confirmed durable record; a refused write says so. Reservation notes preserve the event and weather explanation, and no wear is logged.
- Outfits and Events expose accepted styling notes as plain, wrapping text in an expandable section. The provider/model and weather explanation remain accessible after leaving the stylist.
- Generated results receive accessible focus and scroll below the fixed header. Masthead metadata is now `From your closet`, resolving the source of the initial narrow-screen overflow.
- Both shared room links have 44px hit areas. Packing clipboard success follows the fulfilled write, and packing controls carry suitable labels, size and selection state.
- A neighbor rail's lendable row reads a local item only for the current profile, preventing a neighbor ID collision from resolving the current wardrobe's image.
- Intake's missing-photo sample has tester-facing text instead of a repository file path. Model disclosure states the selected endpoint/provider and separates the default relay's server-held key from a personal key stored in the browser.
- The remaining absolute Settings privacy claim has been replaced with the actual per-request behavior. Weather parsing rejects malformed top-level data, malformed geocoder entries, invalid coordinates/timezones and impossible calendar dates, with a manual fallback.
- The deployed relay source accepts `claude-fable-5-1` while retaining `claude-fable-5` for cached clients. The addition does not require a new AppState schema or alter existing wear records.

**Source recommendation:** no blocking concern remains in the reviewed implementation. Proceed with the compatible relay update after the final required verification/browser gates complete. That recommendation is independent review of the code and reported tests, not a claim that the relay has already been deployed or that a live Fable request has succeeded. The planned live checks should use synthetic event and garment data. The larger P2 navigation and page-density improvements remain an explicit follow-up backlog.

## Final consultation and refreshed capture

The refreshed audit at **2026-09-07 16:57:50 UTC** captured **58 screen states across all 21 enabled routes**, at phone and desktop sizes. Its report has **zero failures, zero document-overflow findings and zero page errors**. No external URL was blocked during capture. These results supersede the pending status of the first capture above.

The independent reviewer reopened the refreshed mobile stylist form, result, event day-detail sheet and held-outfit picker, plus Closet and Intake. The Events return button now fits within the viewport; the generated result lands with its title and garment cards immediately visible; both event sheets open and read clearly. The room link has the enlarged hit area, confirmed in source and no longer flagged by the audit. The revised Intake disclosure names Fable 5.1 and explains where the default service key is held. The first capture's actual layout defect and its modal-capture sequencing failures are resolved.

Final verification reported by the implementation owner:

- `npm run verify`: passed after the final copy changes.
- Focused event-stylist browser suite: **11 scenarios passed**, including refused writes, retained results after retry failure, stale weather and wardrobe isolation.
- Existing `test-flows`: passed on phone and desktop.
- Existing `test-features`: passed with the model disclosure expectations updated.
- Complete alpha screenshot audit: **58 captures, zero failures**.

The screenshot fixture deliberately selects the first three available garment IDs. **All stylist screenshots are mocked UI evidence**, not evidence that Fable chose a coherent outfit or that its live API was reached. A generated screen containing several tops must therefore not be presented as a real styling result. The remaining automated small-control flags refer chiefly to hidden native inputs or the native checkbox inside a larger clickable label; they do not represent the resolved room-link defect.

**Final independent recommendation: proceed with the compatible `ai-proxy` deployment.** The reviewed implementation has no blocking source or visual concern, and the required local gates have completed. Keep the old Fable 5 allowlist entry for cached clients. At this consultation, deployment, a live forecast lookup and the two planned synthetic AI requests have not yet occurred; record their actual outcomes separately. Frontend publication, commits and branch changes are outside this recommendation. The P2 navigation and page-density ideas remain documented follow-ups, not unresolved release blockers.
