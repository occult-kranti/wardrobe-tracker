/**
 * The six rooms — typed twins of src/index.css.
 *
 * Mirrors the rule scripts/check-brand.mjs holds the web to: EVERY room
 * declares EVERY token (an omitted one silently inherits the light room's
 * value on the web; here it would be an undefined paint). The spot-checked
 * hexes are read from src/index.css — if a value changes there, this test
 * is the tripwire that says the twin drifted.
 */
import { describe, expect, test } from '@jest/globals';

import {
  DEFAULT_THEME,
  LABEL_FLOOR,
  RADIUS,
  THEMES,
  THEME_ORDER,
  resolveTheme,
  type ResolvedThemeName,
  type ThemeTokens,
} from '../src/tokens/themes';
import { TYPE } from '../src/tokens/typography';

const ROOMS: ResolvedThemeName[] = ['light', 'dark', 'salon', 'gilt', 'dyehouse', 'obsidian'];

/** Every color token a room must state — the web's --color-* list, camelCased. */
const COLOR_KEYS: (keyof ThemeTokens)[] = [
  'bg', 'surface', 'mat', 'sunken', 'bgDeep', 'text', 'text2', 'border',
  'accent', 'accentHover', 'accentFill', 'onAccent', 'accentOnInk', 'seal',
  'artline', 'artline2', 'success', 'warning', 'danger', 'dangerFill',
  'gold', 'charcoal', 'chalk', 'inkFill', 'onInk',
];

describe('every room declares every token', () => {
  test('there are exactly six rooms', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...ROOMS].sort());
  });

  test.each(ROOMS)('%s states all color tokens as hex', room => {
    const theme = THEMES[room];
    for (const key of COLOR_KEYS) {
      expect(theme[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  test.each(ROOMS)('%s states the pattern-paper pair and a color scheme', room => {
    const theme = THEMES[room];
    expect(theme.patternInk).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/);
    expect(theme.patternAlpha).toBeGreaterThan(0);
    expect(theme.patternAlpha).toBeLessThan(1);
    expect(['light', 'dark']).toContain(theme.colorScheme);
  });

  test('silver is the obsidian’s alone — the other rooms never invent it', () => {
    expect(THEMES.obsidian.silver).toBe('#CFD6E0');
    for (const room of ROOMS.filter(r => r !== 'obsidian')) {
      expect(THEMES[room].silver).toBeUndefined();
    }
  });
});

describe('the twins match src/index.css', () => {
  test('one spot value per room', () => {
    expect(THEMES.light.bg).toBe('#F4EFE2');
    expect(THEMES.dark.accent).toBe('#6FB6D6');
    expect(THEMES.salon.seal).toBe('#BE1231');
    expect(THEMES.gilt.border).toBe('#D3A47F'); // the gold hairlines, the room's signature
    expect(THEMES.dyehouse.bg).toBe('#2C0F19');
    expect(THEMES.obsidian.text).toBe('#EDEEF3');
  });

  test('the seal and the accent are never the same ink (two reds and a blue)', () => {
    for (const room of ROOMS) {
      expect(THEMES[room].seal).not.toBe(THEMES[room].accent);
      expect(THEMES[room].seal).not.toBe(THEMES[room].accentFill);
    }
  });

  test('dark rooms tell the OS they are dark', () => {
    expect(THEMES.light.colorScheme).toBe('light');
    expect(THEMES.salon.colorScheme).toBe('light');
    expect(THEMES.gilt.colorScheme).toBe('light');
    expect(THEMES.dark.colorScheme).toBe('dark');
    expect(THEMES.dyehouse.colorScheme).toBe('dark');
    expect(THEMES.obsidian.colorScheme).toBe('dark');
  });
});

describe('the walk order and the shared physics mirror the web', () => {
  test('THEME_ORDER is byte-identical to src/lib/accounts.ts', () => {
    expect([...THEME_ORDER]).toEqual([
      'dyehouse', 'obsidian', 'dark', 'salon', 'gilt', 'light', 'system',
    ]);
  });

  test('the house opens in the dye house, and the default IS the first entry', () => {
    expect(DEFAULT_THEME).toBe('dyehouse');
    expect(DEFAULT_THEME).toBe(THEME_ORDER[0]);
  });

  test('radius 2, and the 13px interactive floor', () => {
    expect(RADIUS).toBe(2);
    expect(LABEL_FLOOR).toBe(13);
  });

  test('system resolves by the device, every named room resolves to itself', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme('gilt', 'dark')).toBe('gilt');
    expect(resolveTheme('dyehouse', 'light')).toBe('dyehouse');
  });
});

/**
 * THE 13px FLOOR HAS NO EXCEPTION LEFT.
 *
 * `TYPE.rail: 11` was ported as the one documented exception to the interactive
 * floor, for OUTFITS on the phone rail. That word left the rail, the bar's
 * labels moved to TYPE.label, and the token was left with no consumers — a
 * standing licence to go below 13px that nothing was standing on. tsc catches a
 * consumer of a deleted key; this catches the token being quietly put back.
 */
describe('the type scale states one interactive size', () => {
  test('TYPE has no rail — the 11px exception is gone, not commented out', () => {
    expect(Object.keys(TYPE)).not.toContain('rail');
    expect((TYPE as Record<string, unknown>).rail).toBeUndefined();
  });

  test('the interactive label size IS the floor the themes declare', () => {
    expect(TYPE.label).toBe(LABEL_FLOOR);
  });

  test('11px survives only as non-interactive ledger metadata (brand law 7)', () => {
    const belowFloor = Object.entries(TYPE).filter(
      ([key, value]) => typeof value === 'number' && value < LABEL_FLOOR && !key.endsWith('Spacing'),
    );
    expect(belowFloor.map(([key]) => key)).toEqual(['ledgerMeta']);
  });
});
