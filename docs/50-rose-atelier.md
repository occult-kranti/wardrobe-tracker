# Rose atelier

**Decision: 7 September 2026.** The owner requested a lighter, warmer pink theme with rose-gold and silver borders and details, and asked for it to become the default. Rose atelier updates the existing `gilt` theme key; the stored identifier is retained so saved theme selections continue to resolve.

This instruction supersedes the older blue-only interface rule and the previous dark default for this theme. The historical decisions in [the brand contract](05-brand-identity.md), [the colour ruling](14-the-brand-colour.md) and [the gilding-room record](15-the-gilding-room.md) remain records of the previous design. Accessibility, neutral clothing copy, token-based colour, 2px corners and undecorated photograph backgrounds still apply.

The visual proposal uses pale blush paper, warm white cards, plum ink and a muted dark-rose interaction colour. Rose gold adds a warm detail; silver interrupts that warmth at the edges. This is a design and product-marketing judgment about a cohesive visual identity, not a claim that pink changes mood, retention, trust or conversion. The room name describes the setting and carries no demographic label.

| Token, prefixed `--color-` | Value | Role |
|---|---|---|
| `bg` | `#F8E8E4` | Warm blush page ground |
| `surface` | `#FFF8F5` | Opaque warm white cards and sheets |
| `mat` | `#F4EFEC` | Neutral garment-photo mount |
| `sunken` | `#EFDBD6` | Wells and secondary surfaces |
| `bg-deep` | `#EBD2CC` | Lower page ground |
| `text` | `#34262C` | Plum ink |
| `text-2` | `#674E55` | Readable secondary text |
| `border` | `#916A74` | Functional control boundaries |
| `accent`, `accent-fill` | `#7E485F` | Dark rose links, states, focus and accent fills |
| `accent-hover` | `#65364C` | Darker rose on hover |
| `on-accent` | `#FFFAF7` | Labels on rose fills |
| `accent-on-ink` | `#E3ACBD` | Pale rose details on ink fills |
| `seal` | `#BE1231` | Existing wax mark |
| `artline`, `gold` | `#B88378` | Decorative rose gold |
| `artline-2` | `#A5ADB5` | Decorative silver |
| `success` | `#2D604A` | Confirmation text |
| `warning` | `#705015` | Amber utility text |
| `danger`, `danger-fill` | `#822B3A` | Destructive text and fills |
| `charcoal` | `#47383E` | Secondary dark ink |
| `chalk` | `#FFFAF7` | Light labels on dark fills |
| `ink-fill` | `#34262C` | Primary ink fill |
| `on-ink` | `#FFF8F5` | Labels on the primary ink fill |

`--pattern-ink` is `128, 86, 94`; `--pattern-alpha` is `0.035`. The theme declares `color-scheme: light`. Silver reuses `artline-2`; no new theme or silver token is introduced.

The approximate visual distribution, excluding garment photography, is 55% blush ground, 35% warm white and neutral surfaces, 7% ink, 2% rose interaction accents and 1% metallic detail. These are composition guidelines, not measured screen-area quotas. Rose gold is the more frequent metal, with silver as the smaller counterpoint.

The CSS in [src/index.css](../src/index.css) applies the material as follows:

- Cards, panes and modal sheets have opaque warm white surfaces. Explicit sunken wells and photo mats retain their own opaque background tokens, and inline garment swatch colours retain priority. In this theme, the older glass treatment, moving sheen and offset plate shadow are removed so text contrast does not depend on the content behind a sheet.
- Passive `.plate` frames use a light rose-gold edge and a silver bottom edge. Plates that are links, buttons, button roles or keyboard targets retain the darker functional border. `.plate-ink` retains its stronger `text` border, preserving the selection cue used by colour swatches and furniture picks as well as the modal-sheet edge.
- Repeated gold corner ornaments and the external double outline are removed. The focus-outline slot remains available for the existing dark-rose keyboard ring.
- `.rule-double` uses a 1px functional rule with a separate rose-gold/silver decorative line. The previous 2px dark rule is reduced.
- `.app-masthead`, `.app-sidebar` and `.nav-rail` use warm white grounds and silver edges. Navigation labels and selected-state markers retain functional text and accent tokens.
- `.outfits-intro` gives the title, action row and small [Rose atelier drawing](51-rose-atelier-art.md) a tissue mount. The page owns wrapping; the wrapper adds 16–24px of padding and no fixed width.
- The page's cutting marks become sparser: a 32px repeat at 3.5% ink opacity replaces the previous 24px gold repeat at 10%. Photo mats remain flat.

The material overrides sit outside the CSS component layer and use the scoped room selector because the existing `v2.css` rules are unlayered and load later. They do not alter the other rooms.

Contrast was calculated directly from the final hex values with WCAG relative luminance. Normal text requires 4.5:1, while the visual information necessary to identify controls or states requires 3:1 against adjacent colours. Decorative metal rules are not used as the sole indication of an interactive boundary or state. [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

| Foreground | Page `bg` | Card `surface` | Photo `mat` | `sunken` | `bg-deep` |
|---|---:|---:|---:|---:|---:|
| Primary text | 12.10 | 13.70 | 12.61 | 10.81 | 10.02 |
| Secondary text | 6.31 | 7.15 | 6.58 | 5.64 | 5.23 |
| Rose accent | 5.93 | 6.71 | 6.18 | 5.29 | 4.91 |
| Functional border | 3.91 | 4.43 | 4.07 | 3.49 | 3.24 |
| Success | 6.12 | 6.93 | 6.38 | 5.47 | 5.07 |
| Warning | 6.20 | 7.02 | 6.46 | 5.54 | 5.14 |
| Danger | 7.49 | 8.49 | 7.81 | 6.70 | 6.21 |

Values above are ratios to 1, displayed rounded; thresholds were evaluated without rounding. Labels on the rose fill measure 6.80:1; labels on the primary ink fill 13.70:1; the pale rose accent on ink 7.47:1; chalk on the destructive fill 8.60:1.

Rose gold falls to 2.23:1 and silver to 1.58:1 across these grounds, so both remain decorative. They must not be used for small text, input underlines, focus rings or selected-state markers. The rose action colour and red danger colour also require their existing explicit action labels; hue alone does not carry their meaning.

The palette calculation is not a browser accessibility certification. The integration owner runs the required build, contrast, navigation and viewport checks after the parallel implementation wave. No build or test suite was run by the colour implementation squad.
