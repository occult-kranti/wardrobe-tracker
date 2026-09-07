# 51 — Rose atelier artwork

The owner requested a lighter warm pink default with rose-gold and silver
details, alongside direct access to Outfits and its calendar. This direction
is about the room and its fittings; the copy makes no assumptions about who
uses it. The owner's palette direction supersedes the older restriction on
pink grounds and the former requirement for a blue functional accent.

`src/components/RoseAtelier.tsx` exports `RoseAtelierMark({ className })`:
one compact SVG drawing for the Outfits introduction. A rose-gold wire hanger
sits beside a silver garment tag, connected by a fine tie and anchored by a
short measuring rule. The tag has a punched eyelet and a few engraved lines.
There is no monogram, award or invented wardrobe count.

The composition uses a 220 × 100 viewBox and the established 1.5-unit strokes,
butt caps and miter joins. The tag's lower corners retain the 2-unit radius.
It is an illustration, not a new navigation icon; interactive icons continue
to come from the existing icon set. It uses only `--color-artline`,
`--color-artline-2` and `--color-surface`, so every saved theme renders its own
pair of metals. The pale pink theme assigns rose-gold and silver to those
existing tokens; the artwork introduces no global CSS or additional palette.

Place the mark once in `.outfits-intro`, beside the heading or the available
introductory space. A useful starting width is 100px on narrow screens and
150px from the small breakpoint, with automatic height and `shrink-0`. Keep
heading text and actions free to wrap. The SVG is decorative, has
`aria-hidden="true"`, cannot take focus and ignores pointer input. It carries
no essential information if layout space calls for omitting it.

The page's metallic edging and this small engraving supply the requested
designed detail. Clothing mats remain flat, and the mark does not repeat on
saved outfit cards or calendar cells. There are no raster assets, network
requests, shadows, filters or animation. Existing focus and interaction
indicators remain the responsibility of the page and theme styles.

The artist supplied the component and this rationale without changing page,
navigation or theme files. Integration and light/dark responsive screenshot
review belong to the coordinating implementation and verification pass.
