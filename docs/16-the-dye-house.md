# The dye house — the fifth room: the dark rose

*Added 2026-08-11, at the owner's direction: "add dark themed rose or pink."*

## The idea

The honest house version of a dark rose is not the atelier tinted pink — it is
the room where rose is *made*. The dye house: walls stained plum by years of
madder steam, brass fittings, rose-chalk lettering on the vat boards. Madder is
the dyestuff that gave the world its rose and turkey-red cloth; a wardrobe app's
dark rose room is named after it by right.

The ground carries real chroma — **0.032 at hue 3°** — where the atelier's ink
cloth is near-neutral. The room reads rose the moment it opens, which is what
was asked for.

## Same physics as every room

- The accent is **washing blue chalked for a plum ground** (`#85C3DD`), because
  a brand colour that changes per theme is not a brand colour (docs/14).
- The wax keeps its dark-stated token (`#CE1837`).
- The **mat lifts above the ground** (`#3D262C`) so black and navy garments keep
  their edges — the same graft the atelier carries.
- Gold is bright brass (`#DCA75F`), decorative only, and the pattern-paper grid
  is drawn in it.
- The ink fill inverts, as in the atelier: rose-chalk fill, plum label.

## The measured palette

Verified in a browser against computed tokens by `test:contrast` — twenty gated
pairs, all passing:

| pair | ratio | floor |
|---|---|---|
| text `#F5E4DE` / bg `#261318` | 14.33 | 4.5 |
| text-2 `#CBA49D` / bg | 7.85 | 4.5 |
| text-2 / sunken `#3A2129` | 6.53 | 4.5 |
| text / mat `#3D262C` | 11.27 | 4.5 |
| text / bg-deep `#1B0C10` | 15.39 | 4.5 |
| accent `#85C3DD` / bg | 9.13 | 4.5 |
| accent / mat | 7.17 | 4.5 |
| on-accent / accent-fill `#105F7D` | 6.98 | 4.5 |
| chalk / danger-fill `#8C1B32` | 8.50 | 4.5 |
| on-ink / ink-fill | 14.33 | 4.5 |
| chalk / seal `#CE1837` | 5.17 | 4.5 |
| accent-on-ink `#0E566E` / ink | 6.62 | 3 (1.4.11) |
| seal / bg | **3.21** | 3 (1.4.11) |

Tightest gate in the room: the wax on the vat wall at 3.21:1 against WCAG
1.4.11's 3:1.

Five rooms now: pattern room (cut) · salon (shown) · gilding room (finished) ·
dye house (coloured) · atelier at night (closed). One hundred gated contrast
pairs across the house.

## Intensified 2026-08-12, and the obsidian joins

The owner asked the dye house's shades to go deeper — all of them. The vat wall
now sits at chroma 0.050 (was 0.032), the wells at 0.064, the wax at full heat
(`#D6183B`), the bronze hotter, the rose chalk brighter. Every pair remeasured;
tightest is the chalk T on the wax at 4.73:1.

And a sixth room: **the obsidian** — volcanic glass, not black paint. Blue-black
ground at hue 265, metals gone COLD (silver first, pale cold gold second), blued
chalk, the wax cooled one step so it reads as a lacquer drop on dark glass.
Tightest pair 4.85:1; 120 gated pairs across the six rooms, all passing.
