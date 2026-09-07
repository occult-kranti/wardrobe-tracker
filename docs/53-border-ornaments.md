# Card borders with space for their artwork

Owner amendment, 7 September 2026. The Outfits screenshot showed gold corners
crossing the pin and scissors controls, with a second frame surrounding the
collection. The owner also asked to use Obsidian's border design in Rose atelier.

The cause was a 40px background ornament placed 5px inside every `.plate`.
Card content started only 20px inside the border, and some controls extended
another 8px into that padding. The same selector decorated thumbnails,
interactive tiles and the collection's outer frame without checking whether
their corners were empty.

`PlateOrnament` now draws Obsidian's existing quarter-arch paths as two explicit,
decorative SVG elements on padded `Card` components. The top-right corner uses
`--color-artline`; the bottom-left uses `--color-artline-2`. Rose atelier uses
its rose-gold and silver tokens and keeps its opaque ivory surface. All six
themes use the same safe geometry. No generated raster artwork is needed.

Each corner is 20px square, placed 4px from the edge. Card content has a 36px
top and bottom padding lane. This clears even existing controls shifted upward
by 8px, including the 4px extent of their focus ring. Horizontal content width
is unchanged. The artwork cannot take pointer input and is hidden from
assistive technology. There is no overflow clipping to conceal a collision.

Unpadded photo cards, arbitrary plates and small selection controls have no
corner artwork. Card callers can also pass `ornament={false}`. Decorative outer
outlines belong only to padded card frames and step aside for focus. Photo
mats and functional borders keep their existing tokens.

The saved-outfit collection now supplies only the grid and spacing; each outfit
has one frame. Its pin, scissors and builder-close controls no longer use
negative margins. Saved outfits, their historical limitations, Calendar access,
the builder and the explicit AI entry retain their behavior.

## Verification contract

`node scripts/test-border-ornaments.mjs http://127.0.0.1:4174` runs against a
served production build, with synthetic garments and no live provider calls.
It covers all six themes at 320px, 390px and 1440px; saved outfits with a long
name and photographic tiles; pin and delete controls; the manual builder;
the solid-material fallback; and additional Wishlist, Settings and Closet
geometry at 390px. It checks rendered artwork/control/photo/text bounds for
intersection, absence of legacy background ornaments and the collection's
outer frame, keyboard focus-ring clearance, and horizontal overflow.

The script writes its actual outcomes and eight representative captures to
`shots/border-ornaments/`. It was authored in the implementation wave; the root
agent owns execution and the final build, contrast and full-screen gates.
