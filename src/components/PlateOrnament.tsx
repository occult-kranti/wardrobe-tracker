/**
 * Obsidian's quarter-arch geometry, kept inside a padded card's empty border
 * lane. Unlike the old background images these two pieces have measurable
 * bounds, never sit on a photo or control, and use each room's own metals.
 */
export function PlateOrnament({ corner }: { corner: 'top-right' | 'bottom-left' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`plate-ornament plate-ornament-${corner}`}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="butt"
        transform={`rotate(${corner === 'top-right' ? 90 : 270} 24 24)`}
      >
        <path d="M3 45V16Q3 3 16 3h29" vectorEffect="non-scaling-stroke" />
        <path d="M10 42V26a6 6 0 0 1 6-6 6 6 0 0 1 6-6 6 6 0 0 1 6-6h14" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
