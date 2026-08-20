/**
 * The type scale, transcribed from src/index.css.
 *
 * The web states three stacks:
 *   --font-display: 'Fraunces', Georgia, 'Times New Roman', serif
 *   --font-ui:      'Switzer', ui-sans-serif, system-ui, sans-serif
 *   --font-mono:    'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace
 *
 * Native has no font stacks — one fontFamily name per Text — so each stack
 * becomes a pair: the bundled face and the platform fallback used until
 * expo-font finishes (or if the loader errors). Fraunces and IBM Plex Mono
 * are bundled in src/assets/fonts/ as static TTF instances cut from the
 * web's own woff2 files (docs/34 §2.7: TTF over woff2 on-device; Metro's
 * default assetExts has no woff2). Fraunces is pinned at wght 600 — the
 * masthead weight — and its italic at 400, the editorial weight, because a
 * variable TTF renders at its default instance on native and Fraunces's
 * default is 900.
 *
 * SWITZER IS NOT HERE. The web loads it from the Fontshare CDN and native
 * has no CDN: until the files are downloaded and their licence travels with
 * them (docs/34 §2.7 — an owner/asset step), the UI face is the system sans,
 * which is the web's own fallback. The scale below is preserved regardless
 * of which face renders it.
 */
import { Platform } from 'react-native';

/** Keys for useFonts — the name given here IS the fontFamily name. */
export const FONT_SOURCES = {
  Fraunces: require('../assets/fonts/Fraunces.ttf'),
  'Fraunces-Italic': require('../assets/fonts/Fraunces-Italic.ttf'),
  IBMPlexMono: require('../assets/fonts/IBMPlexMono.ttf'),
  'IBMPlexMono-Medium': require('../assets/fonts/IBMPlexMono-Medium.ttf'),
} as const;

const serifFallback = Platform.select({ ios: 'Georgia', default: 'serif' });
const monoFallback = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Resolve the three token families for the current load state.
 * `undefined` for the UI family means the platform's system face —
 * exactly what the web's stack falls back to.
 */
export function families(fontsLoaded: boolean) {
  return {
    display: fontsLoaded ? 'Fraunces' : serifFallback,
    displayItalic: fontsLoaded ? 'Fraunces-Italic' : serifFallback,
    ui: undefined as string | undefined,
    mono: fontsLoaded ? 'IBMPlexMono' : monoFallback,
    monoMedium: fontsLoaded ? 'IBMPlexMono-Medium' : monoFallback,
  };
}

/**
 * The sizes the web states, kept as one object so a screen cannot invent
 * its own scale. Sources named per line.
 */
export const TYPE = {
  /** body — src/index.css `body { font-size: 15px }` */
  body: 15,
  /** .type-masthead on a phone — text-[28px] in ui.tsx's Masthead */
  masthead: 28,
  /** .type-label — 13px, 600, uppercase, 0.08em. The interactive floor. */
  label: 13,
  /** 0.08em at 13px, stated in px as RN requires */
  labelSpacing: 13 * 0.08,
  /** .type-ledger meta as the Masthead states it — text-[11px] mono.
      11px mono is NON-INTERACTIVE metadata only (brand law 7). */
  ledgerMeta: 11,
  /** 0.06em at 11px */
  ledgerSpacing: 11 * 0.06,
  /* THE 11px RAIL EXCEPTION IS NOT HERE, and its absence is the point.
     `rail: 11` was ported as the one documented exception to the 13px
     interactive floor, for OUTFITS rendering edge-to-edge in a 360px rail
     slot. That word has since left the rail (src/app/(tabs)/_layout.tsx),
     the bar's labels sit at TYPE.label like every other control, and the
     token had no consumers left. A standing exception to the floor with
     nothing standing on it is an invitation, so it is gone rather than
     kept warm. If a label ever genuinely cannot make 13px again, the fix
     is the label, not a second size. */
  /** .type-editorial runs at 20px where the web shows an empty state */
  editorial: 20,
} as const;
