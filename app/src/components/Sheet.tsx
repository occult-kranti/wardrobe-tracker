/**
 * THE SHEET — the bottom plate every sheet in the house sits on.
 *
 * THE CANONICAL EXPORT (lead ruling R8). The object itself still lives in
 * components/furniture/Sheet.tsx, where the dressing room wrote it; this file
 * is where the rest of the house is meant to reach for it, and it is a
 * re-export rather than a move ON PURPOSE. Moving the source this wave would
 * rewrite import lines in files three other squads have open right now, and a
 * merge conflict in somebody else's screen is a poor price for tidiness that
 * changes no pixel. The lift is a one-line follow-up in a quiet wave: move the
 * body here, and turn the furniture file into the shim instead.
 *
 * What it is, so nobody rebuilds a fourth one: hairline edge, radius 2, no
 * shadow (brand law 5), a scrim you can tap to leave, and the sheet capped at
 * 88% so the room it rose from is still visible behind it.
 */
export { Sheet } from './furniture/Sheet';
