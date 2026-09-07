# 48 — Alpha prompt review

Reviewed 2026-09-07 for the request, “what should I wear for this event?”
Sources are the actual prompts, importer and saved live model responses in
this checkout. The current verification record is
[47 — Alpha event stylist validation](47-alpha-event-stylist-validation.md).

The event stylist now prioritises explicit clothing requirements and dress
code over aesthetic coordination, uses only the supplied event weather, and
asks for shorter explanations suited to a phone. The photo prompts were
also tightened because inferred material can otherwise become an apparently
confirmed wardrobe fact before the stylist sees it.

## Findings and changes

| Observed issue | Change in the prompt | Review criterion |
| --- | --- | --- |
| Live gallery answers extrapolated “cooling later” from an 18:00 forecast. | Weather applies only to its supplied date and hour; no later conditions, colder room or guaranteed rain/dryness may be inferred. | Every weather claim is supported by the supplied data or clearly stated as unknown. |
| The corrected gallery answer still repeated the full forecast and long fit caveats. | Rationale targets at most 55 words, weather note 40, event note 55; each field has a distinct purpose and at most one relevant practical fit check. | The answer fits a short mobile read without dropping a real conflict or need. These are model instructions; existing parser character limits stay unchanged. |
| Both live gallery answers called the absence of backup shoes a missing wardrobe item. | At most two actual unmet needs in `missing`; unknown fit, untested comfort and absent backup choices are not gaps. | A complete recorded outfit can return `missing: []` even when comfort needs a try-fit check. |
| A request for comfort previously became “unrestrictive” clothing in the answer. | Fit, ease, stretch, cushioning and broken-in status remain unknown for all garments. Names and materials do not prove comfort or movement. | A practical check is conditional; the answer does not guarantee garment properties. |
| Broad “read the event together” guidance did not settle dress-code and aesthetic conflicts. | Explicit requirements, exclusions and dress code precede coordination; a partial match must name the unmet requirement. | No forbidden piece is selected solely because it improves the colours, and casual clothes are not presented as satisfying a strict formal code. |
| Refinement instructions did not specify conflicts or unavailable prior pieces. | Follow keep/remove/replace requests using current IDs; explicit later changes override only the same earlier choice, and unresolved conflicts are explained. | Kept available pieces stay; removed pieces leave; unchanged constraints still apply. |
| A generic outfit structure can add unnecessary garments to cultural sets. | Treat user-owned categories and recorded sets normally, without imposing a top/bottom/shoe template or inferring ceremonial rules from a label. | Requested cultural clothing is handled using the actual closet, with no added identity assumptions. |
| Flat-lay and worn-outfit examples embedded guessed cotton/linen in `material`, descriptions and names, despite marking material uncertain. | Material requires a readable composition/material label or an explicit supplied fact; otherwise omit it and record uncertainty. Examples use visible construction without guessed fibres. | No precise material or blend is inferred solely from appearance. |
| Intake season/occasion hints could be read downstream as verified suitability. | Photo prompts identify these as tentative filing hints and mark inferred tags uncertain; the stylist treats them as hints rather than evidence of climate performance or dress-code compliance. | Tags assist retrieval without becoming a claim that the garment meets this event's requirements. |
| Worn-outfit naming examples invented destinations such as an office or wedding. | Names describe visible colours and combinations; outfit occasions remain empty unless supplied by the person. | The answer identifies what is visible without inventing where the outfit was worn. |
| The documented worn-outfit vocabulary warning was truncated at an escaped apostrophe. | The copyable documentation now contains the full resolved warning from the runtime prompt. | The existing parity check must compare the actual escaped string, not a prematurely terminated match. |

The prompt changes preserve `EventBrief`, `StyleWeather`, `StyleSuggestion`,
the response schema, parser limits, intake JSON fields, garment segmentation,
bounding boxes and the review-before-save flow. No material-provenance fields
or wardrobe migration were introduced. Older closet records may still contain
previously inferred material: these changes cannot reconstruct lost provenance.

## Evaluation cases

Use synthetic clothing records for live evaluation. First rerun the existing
gallery request and keep-trousers/keep-shoes/replace-shirt refinement; then
choose focused cases below to cover an unresolved concern. This is a review
matrix, not a claim that every case has been run against the live model.

| Case | Inputs | Required behaviour |
| --- | --- | --- |
| Gallery opening and update | Smart casual; 24°C at 18:00 with low precipitation probability; shirt, tee, trousers, shoes and knit; replace shirt with tee while keeping trousers/shoes. | Keep exact requested IDs, replace the shirt, explain the more casual end of the code, avoid invented later cooling, and do not create a backup-footwear gap. |
| Wedding with rain | Outdoor wedding; explicitly no white and no heels; supplied 16°C/80% precipitation at the event hour; suitable non-white one-piece, flat shoes, wrap and an item named rain shell without verified performance. | Respect exclusions, consider recorded rain cover without promising waterproofing, and explain an actual uncovered weather or dress-code need only if one remains. |
| Warm office visit | Indoor office, explicit business casual and no jacket; 30°C at arrival; shirt, trousers, shoes and jacket. | Respect no-jacket instruction, do not invent office air-conditioning, and do not infer breathability or comfort from cotton alone. |
| Strict dress code with a closet gap | Explicit tuxedo-required black-tie event; only tee, jeans and trainers recorded. | Do not claim a compliant outfit exists. Explain the unmet code or return the permitted no-match response, which the app handles without saving an empty outfit. |
| Cultural event with explicit clothing choice | Family celebration; person asks for a saree already recorded as one complete set, with their own jewellery category; weather unknown. | Use the recorded set without adding an unnecessary separate top, follow the stated preference, infer no religion or ceremony-specific colour rules, and state weather uncertainty. |
| Conflicting or stale refinement | Keep a selected jacket but also remove it; or keep trousers that have since entered the wash; dress code unchanged. | Explain conflicting instructions; never select an unavailable ID or silently waive the remaining dress code. The local parser rejects any stale ID against the refreshed available set. |
| Photo identification without composition evidence | Visible shirt and sandals with no readable composition labels; no event information. | Use colour and construction for names, omit guessed fibre/leather composition, and avoid invented event names. |

For each model answer, review known/unique garment IDs, explicit requirements,
weather evidence, unsupported garment claims, concise explanations and whether
each missing item is an actual unmet need. Keep semantic review separate from
schema validation: a parser can establish ID membership and required fields,
but it cannot prove that prose is truthful or that an outfit meets a dress code.

Two additional offline cases exercise boundaries instead of testing prompt
phrases: instruction-like free text remains inside exact JSON data fields,
and a previously valid answer is rejected when a selected garment is removed
or becomes unavailable. The existing intake suite checks its parser and the
copyable prompt mirror. Test and live-evaluation outcomes belong in document 47;
the presence of a case here is not a passing result.

Feed-grid and gallery screenshot prompts in `src/lib/feedIntake.ts` were read
for context. Their material-guessing wording remains a follow-up for those
specialised import flows; it was not changed as part of the two photo prompts
used by the current intake bench.
