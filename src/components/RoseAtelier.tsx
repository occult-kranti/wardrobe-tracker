/**
 * A small engraved fitting for the Outfits introduction. The two metals
 * belong to the room's existing art tokens, so this stays a single drawing
 * when the person changes rooms. It carries no status or product action.
 */
export function RoseAtelierMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 100"
      width="220"
      height="100"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={`block h-auto max-w-full pointer-events-none ${className}`}
    >
      {/* The open hook and folded wire, with its second engraved edge. */}
      <g stroke="var(--color-artline)">
        <path d="M69.5 20.5a9 9 0 0 1 18 0c0 4-2.5 6-6 8.5l-4 3v4" />
        <path d="m77.5 36.5-59 26v3h118v-3z" />
        <path d="M29.5 61.5h96" opacity="0.55" />
        <path d="M73.5 34.5h8" />
      </g>

      {/* The fine tie meets a punched eyelet, rather than a floating badge. */}
      <path
        d="M127.5 58.5c16 2 22-8 25-17 2-6 7-9 11-7"
        stroke="var(--color-artline-2)"
      />
      <path
        d="M153.5 26.5h29l14 14v33a2 2 0 0 1-2 2h-39a2 2 0 0 1-2-2z"
        fill="var(--color-surface)"
        stroke="var(--color-artline-2)"
      />
      <circle cx="163.5" cy="36.5" r="3.5" stroke="var(--color-artline)" />
      <path d="M161.5 36.5c-4-1-6-4-7-7" stroke="var(--color-artline-2)" />
      <path d="M182.5 30.5v10h10" stroke="var(--color-artline-2)" opacity="0.6" />
      <path d="M161.5 52.5h27m-27 7h21m-21 7h15" stroke="var(--color-artline)" opacity="0.75" />

      {/* An unnumbered measuring rule keeps the mark free of implied data. */}
      <g stroke="var(--color-artline-2)" opacity="0.8">
        <path d="M17.5 86.5h179" />
        <path d="M17.5 80.5v6m10-3v3m10-3v3m10-3v3m10-3v3m10-6v6m10-3v3m10-3v3m10-3v3m10-3v3m10-6v6m10-3v3m10-3v3m10-3v3m10-3v3m10-6v6m10-3v3m10-3v3m9-6v6" />
      </g>
      <path d="M17.5 90.5h49m115 0h15" stroke="var(--color-artline)" opacity="0.6" />
    </svg>
  );
}
