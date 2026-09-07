# Rose atelier and the Outfits tab

Implemented for the web alpha on 7 September 2026, following the owner's request.

The main mobile navigation now reads **Today · Closet · Chats · Outfits · More**.
Profile is in More and its own page is titled Profile, with the wardrobe name and
handle retained in the profile card. Existing addresses still resolve. Outfits
stays in the fourth mobile position when the Look Book flag is enabled; Looks
takes the third position and Conversations remains available in More. The native
scaffold retains its existing roster, icon bindings and routes.

Outfits opens on the saved collection before the random set builder. Its header
offers Calendar, the manual builder and the event AI stylist, with wrapping
actions on narrow phones. Calendar remains available in an empty wardrobe. Saved
outfits remain visible when their pieces are retired or missing, with explicit
limitations and disabled new-wear actions for those incomplete sets. Historical
wear records are retained; complete available sets still log normally.

Rose atelier is the new default: pale warm pink, opaque ivory surfaces, muted
dark-rose controls, and fine rose-gold and silver details. The new engraved SVG
hanger and garment tag appear once in the Outfits header. The color/product
review is in [document 50](50-rose-atelier.md), and the artist's direction is in
[document 51](51-rose-atelier-art.md). Both agents reviewed the rendered phone and
desktop results and found no blocking visual concern.

The existing `gilt` storage ID is retained. A fresh device, invalid stored theme,
or refused preference read opens Rose atelier from the inline HTML bootstrap
through React mounting. Valid saved choices, including System, are honored.
Changing the system color scheme updates both the page and browser theme color
when System is selected. No wardrobe schema, storage key or cloud behavior was
changed.

## Verification

| Check | Result |
|---|---|
| `npm run verify` | Passed: production build, lint/brand, privacy gates and every registered node suite |
| Theme initialization | Actual inline bootstrap and runtime checked with fresh, malformed, null, unknown, explicit and System preferences, plus refused storage |
| `test-rose-outfits-browser.mjs` | All 9 scenarios passed; 320px, 390px and 1440px layouts, navigation, empty/historical outfits, valid wear persistence and theme changes |
| `test-contrast.mjs` | All six themes passed their text and graphical contrast thresholds in the browser |
| `test-flows.mjs` | 81 passing checks across phone and desktop routes |
| `test-features.mjs` | 177 passing checks, including the revised default and theme picker order |
| `audit-alpha-screens.mjs` | 58 states across 21 routes at phone and desktop sizes; zero failures, page errors or horizontal overflow; generated at 18:02 UTC |
| Local theme gallery | Seven captures served at HTTP 200; no page errors or horizontal overflow at phone and desktop sizes |

The initial new browser suite used two incorrect selectors: uppercase-rendered
`innerText` for More, and a heading role for the existing paragraph-based empty
state. Those were corrected to the actual markup; all scenarios then passed.
The splash brand guard now admits only Rose atelier's exact background and
lettering tokens for `index.html`, while the icon palette remains restricted.

The independent visual reviews noted a non-blocking polish opportunity: a single
saved outfit leaves an unused second grid column inside the desktop collection
frame. The current layout keeps the same two-column structure for larger
collections; this review did not expand into another card-layout redesign.

## Review locally

- [Interactive Outfits page](http://127.0.0.1:4174/#/outfits)
- [Rose atelier and navigation gallery](http://127.0.0.1:4176/rose/)
- [Full alpha screen gallery](http://127.0.0.1:4176/screens/)

Restart the app with `npm run preview -- --port 4174 --host 127.0.0.1 --strictPort`
after a production build, and the review server with `npm run review:alpha` in
another terminal. Regenerate the focused captures with `npm run test:rose:browser
-- http://127.0.0.1:4174`, and the full gallery with `npm run audit:alpha --
http://127.0.0.1:4174`. These review fixtures contain synthetic or sample records;
they make no live styling request. Existing explicit theme selections can be
changed to **Rose atelier** in Settings → Appearance.

The updated frontend is local. No frontend publication, commits or branch changes
were made for this task. The previously deployed Fable 5.1 AI relay is unchanged.
See [the link directory](49-alpha-links.md) for the published versions and backend
addresses.
