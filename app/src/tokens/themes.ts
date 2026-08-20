/**
 * The six rooms, transcribed from the web's CSS custom properties.
 *
 * SOURCE OF TRUTH: src/index.css at the repo root — every value here is a
 * byte-for-byte twin of a `--color-*` declaration there, camelCased. If a
 * value changes on the web, it changes here in the same commit; the themes
 * shape test asserts every room declares every token, the same rule
 * `scripts/check-brand.mjs` holds the web to (an omitted token silently
 * inherits the light room's value, which is how a room goes wrong quietly).
 *
 * Web token → native twin, mechanically:
 *   --color-bg → bg · --color-text-2 → text2 · --color-accent-on-ink →
 *   accentOnInk · --color-ink-fill → inkFill · --pattern-ink → patternInk
 *   (an "r, g, b" triplet string, exactly as the CSS states it) ·
 *   --pattern-alpha → patternAlpha (a number) · color-scheme → colorScheme.
 *
 * `silver` exists only in the obsidian, exactly as on the web — the one room
 * where both metals read at once. It is optional in the type on purpose;
 * inventing silver values for the other five rooms would be design work this
 * file has no licence to do.
 */

export interface ThemeTokens {
  bg: string;
  surface: string;
  /** The tile behind clothing photos — flat, nothing decorative (brand law 6). */
  mat: string;
  sunken: string;
  /** The ground below the ground — the page-bottom band. */
  bgDeep: string;
  text: string;
  text2: string;
  border: string;
  /** Washing blue — carries the whole interface. Never the seal's job. */
  accent: string;
  accentHover: string;
  accentFill: string;
  onAccent: string;
  /** The accent as stated on an ink fill — brand law 4. */
  accentOnInk: string;
  /** Sealing wax — the mark, never the interface. Four surfaces only. */
  seal: string;
  artline: string;
  artline2: string;
  success: string;
  warning: string;
  /** Danger TEXT only in the dark rooms — the fill has its own token. */
  danger: string;
  dangerFill: string;
  /** Decorative only — never text, never labeled fills. */
  gold: string;
  /** The obsidian's second metal. Only that room declares it. */
  silver?: string;
  charcoal: string;
  chalk: string;
  inkFill: string;
  onInk: string;
  /** "r, g, b" triplet for the pattern-paper crosses, as the CSS states it. */
  patternInk: string;
  patternAlpha: number;
  /** What the room tells the OS chrome (status bar, keyboard). */
  colorScheme: 'light' | 'dark';
}

/**
 * The rooms, in the order the theme control walks them — mirrors THEME_ORDER
 * in src/lib/accounts.ts exactly. The default is the first entry rather than
 * a second constant, so the default and the cycle order cannot drift apart.
 */
export const THEME_ORDER = ['dyehouse', 'obsidian', 'dark', 'salon', 'gilt', 'light', 'system'] as const;

export type ThemeName = (typeof THEME_ORDER)[number];
/** A room that actually holds tokens — 'system' resolves to one of these. */
export type ResolvedThemeName = Exclude<ThemeName, 'system'>;

export const DEFAULT_THEME: ThemeName = THEME_ORDER[0];

/* Shared constants — the same physics in every room. */

/** Print-cornered: radius 2 globally. Circles only for eyelets and seals. */
export const RADIUS = 2;

/** Interactive labels never drop below 13px (the web's .type-label size). */
export const LABEL_FLOOR = 13;

export const THEMES: Record<ResolvedThemeName, ThemeTokens> = {
  /* the pattern room (light) — src/index.css :root */
  light: {
    bg: '#F4EFE2',
    surface: '#FBF8F0',
    mat: '#FBF8F0',
    sunken: '#EAE1CC',
    bgDeep: '#E3D6BA',
    text: '#201D18',
    text2: '#5C554A',
    border: '#D8CFBA',
    accent: '#105F7D',
    accentHover: '#0D4F68',
    accentFill: '#105F7D',
    onAccent: '#FFFDF6',
    accentOnInk: '#7CBEDC',
    seal: '#BE1231',
    artline: '#C9A227',
    artline2: '#98A0A6',
    success: '#2E6B4F',
    warning: '#7D5813',
    danger: '#771324',
    dangerFill: '#771324',
    gold: '#C9A227',
    charcoal: '#3A362E',
    chalk: '#FFFDF6',
    inkFill: '#201D18',
    onInk: '#FBF8F0',
    patternInk: '0, 0, 0',
    patternAlpha: 0.06,
    colorScheme: 'light',
  },

  /* the atelier at night (dark) — src/index.css [data-theme="dark"] */
  dark: {
    bg: '#17140F',
    surface: '#201C15',
    mat: '#2B2A22',
    sunken: '#2A251C',
    bgDeep: '#100E0A',
    text: '#EFE9D9',
    text2: '#A89F8D',
    border: '#383226',
    accent: '#6FB6D6',
    accentHover: '#8CC6E0',
    accentFill: '#105F7D',
    onAccent: '#FFFDF6',
    accentOnInk: '#105F7D',
    seal: '#CE1837',
    artline: '#B4BEC3',
    artline2: '#D9B44A',
    success: '#58A97F',
    warning: '#D9A93F',
    danger: '#F297A4',
    dangerFill: '#8C1B32',
    gold: '#D9B44A',
    charcoal: '#2A251C',
    chalk: '#EFE9D9',
    inkFill: '#EFE9D9',
    onInk: '#201D18',
    patternInk: '255, 255, 255',
    patternAlpha: 0.05,
    colorScheme: 'dark',
  },

  /* the salon — src/index.css [data-theme="salon"] */
  salon: {
    bg: '#E9DBD3',
    surface: '#F6EEE9',
    mat: '#EFE6DF',
    sunken: '#DBCCC3',
    bgDeep: '#D3BFB4',
    text: '#241A19',
    text2: '#5C4C48',
    border: '#C9B8AE',
    accent: '#0F5570',
    accentHover: '#0B4257',
    accentFill: '#0F5570',
    onAccent: '#FFF7F4',
    accentOnInk: '#7CBEDC',
    seal: '#BE1231',
    artline: '#A9762F',
    artline2: '#9FA8AE',
    success: '#2C6250',
    warning: '#6A4913',
    danger: '#6E1C22',
    dangerFill: '#6E1C22',
    gold: '#A9762F',
    charcoal: '#3E322E',
    chalk: '#FFFAF5',
    inkFill: '#241A19',
    onInk: '#F6EEE9',
    patternInk: '74, 48, 42',
    patternAlpha: 0.07,
    colorScheme: 'light',
  },

  /* the gilding room — src/index.css [data-theme="gilt"] */
  gilt: {
    bg: '#F3DCD4',
    surface: '#FAEEE7',
    mat: '#F6E9E1',
    sunken: '#E9C8BC',
    bgDeep: '#E4BAAB',
    text: '#33201C',
    text2: '#6E453C',
    border: '#D3A47F',
    accent: '#0E566E',
    accentHover: '#0A4356',
    accentFill: '#0E566E',
    onAccent: '#FFF8F2',
    accentOnInk: '#7CBEDC',
    seal: '#BE1231',
    artline: '#A2751F',
    artline2: '#8F979D',
    success: '#2E6247',
    warning: '#6F4C15',
    danger: '#701A1E',
    dangerFill: '#701A1E',
    gold: '#A2751F',
    charcoal: '#453029',
    chalk: '#FFF8F2',
    inkFill: '#33201C',
    onInk: '#FAEEE7',
    patternInk: '162, 117, 31',
    patternAlpha: 0.1,
    colorScheme: 'light',
  },

  /* the dye house — the default room — src/index.css [data-theme="dyehouse"] */
  dyehouse: {
    bg: '#2C0F19',
    surface: '#3A1521',
    mat: '#48202E',
    sunken: '#441C2A',
    bgDeep: '#1E0710',
    text: '#FBE6DF',
    text2: '#DCA89E',
    border: '#8A4A44',
    accent: '#93CBE4',
    accentHover: '#AFD8EA',
    accentFill: '#0F6485',
    onAccent: '#FFFDF6',
    accentOnInk: '#0E566E',
    seal: '#D6183B',
    artline: '#D69652',
    artline2: '#E8AE5C',
    success: '#66B18C',
    warning: '#DCA94B',
    danger: '#F5A9B2',
    dangerFill: '#9C1430',
    gold: '#E8AE5C',
    charcoal: '#441C2A',
    chalk: '#FFF2EC',
    inkFill: '#FBE6DF',
    onInk: '#2C0F19',
    patternInk: '228, 166, 86',
    patternAlpha: 0.07,
    colorScheme: 'dark',
  },

  /* the obsidian — src/index.css [data-theme="obsidian"] */
  obsidian: {
    bg: '#0A0B0F',
    surface: '#12141A',
    mat: '#1B1E26',
    sunken: '#161921',
    bgDeep: '#050609',
    text: '#EDEEF3',
    text2: '#A9ADBC',
    border: '#4A4234',
    accent: '#85C0E2',
    accentHover: '#9FCCE8',
    accentFill: '#0F5F7D',
    onAccent: '#FFFDF6',
    accentOnInk: '#0F5F7D',
    seal: '#CE2545',
    artline: '#E7C46A',
    artline2: '#CFD6E0',
    success: '#63B08F',
    warning: '#D9A93F',
    danger: '#F2A9B4',
    dangerFill: '#8C1B32',
    gold: '#E7C46A',
    silver: '#CFD6E0',
    charcoal: '#161921',
    chalk: '#F4F5F8',
    inkFill: '#EDEEF3',
    onInk: '#0A0B0F',
    patternInk: '226, 205, 158',
    patternAlpha: 0.04,
    colorScheme: 'dark',
  },
};

/**
 * Resolve a theme name to a room. 'system' follows the device — the pattern
 * room by day, the atelier by night — exactly as the web's
 * prefers-color-scheme block does when no data-theme is stamped.
 */
export function resolveTheme(
  name: ThemeName,
  systemScheme: 'light' | 'dark' | null | undefined
): ResolvedThemeName {
  if (name === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return name;
}
