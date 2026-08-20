/**
 * THE GLYPHS THE BAR HANGS, AND THE ONE THE ARTIST ADDED.
 *
 * The icon law is docs/05-brand-identity.md §5, restated in the native set's
 * own docstring: a 24×24 viewBox, 1.5px stroke, butt caps, miter joins,
 * coordinates on the half-grid, and exactly ONE 2px 45° pattern notch in the
 * NE quadrant. `check-brand.mjs` polices the count on the WEB set only —
 * src/components/icons.tsx — so the native set has, until now, had nothing
 * checking it at all. This bench is that check.
 *
 * The addition under test is `IconBookmark`, the set-aside tag: the feed
 * squad's standing ask, drawn as a swing ticket kept rather than as a ribbon
 * nobody in this house ties. It is NATIVE-FIRST — the only glyph in the file
 * that is not yet a byte-for-byte twin of the web set — and the wave's report
 * names the twin so the two sets cannot quietly diverge.
 *
 * react-native-svg renders to host elements in jest (RNSVGSvgView /
 * RNSVGGroup / RNSVGPath / RNSVGCircle), so every claim below is read off the
 * drawing itself rather than off a snapshot that would go green for any
 * change at all.
 */
import { describe, expect, test } from '@jest/globals';
import { render } from '@testing-library/react-native';

import {
  IconBookmark,
  IconChats,
  IconCloset,
  IconFeed,
  IconHouse,
  IconToday,
  type IconProps,
} from '../src/icons';

type Drawn = { type: string; props: Record<string, unknown>; children: Drawn[] | null };

/** Every element in the drawing, in document order. */
function elements(node: unknown, out: Drawn[] = []): Drawn[] {
  if (!node || typeof node === 'string') return out;
  const el = node as Drawn;
  out.push(el);
  for (const child of el.children ?? []) elements(child, out);
  return out;
}

function draw(Icon: (p: IconProps) => React.JSX.Element, color = '#265F7D') {
  const tree = render(<Icon color={color} />).toJSON();
  const all = elements(tree);
  return {
    root: all[0],
    all,
    ink: all.find(el => el.type === 'RNSVGGroup' && el.props.strokeWidth !== undefined),
    paths: all.filter(el => el.type === 'RNSVGPath').map(el => String(el.props.d)),
    circles: all.filter(el => el.type === 'RNSVGCircle'),
  };
}

/** The fingerprint: a 2px 45° tick, drawn as `l1.5 -1.5` off an absolute M. */
const NOTCH = /^M(-?[\d.]+) (-?[\d.]+)l1\.5 -1\.5$/;

const BAR_SET: [string, (p: IconProps) => React.JSX.Element][] = [
  ['IconToday', IconToday],
  ['IconCloset', IconCloset],
  ['IconFeed', IconFeed],
  ['IconChats', IconChats],
  ['IconHouse', IconHouse],
  ['IconBookmark', IconBookmark],
];

describe('the house hand', () => {
  test.each(BAR_SET)('%s draws on the 24 grid in 1.5px, butt caps, miter joins', (_name, Icon) => {
    const { root, ink } = draw(Icon);
    // The live area is 20×20 inside a 24×24 box, whatever size it is asked to
    // render at — so a 24dp bar icon and a 20dp inline one are the same glyph.
    expect(root.props.vbWidth).toBe(24);
    expect(root.props.vbHeight).toBe(24);
    expect(ink).toBeDefined();
    expect(ink?.props.strokeWidth).toBe(1.5);
    // react-native-svg's enums: 0 is butt, and 0 is miter.
    expect(ink?.props.strokeLinecap).toBe(0);
    expect(ink?.props.strokeLinejoin).toBe(0);
    // Never filled: these are flats, drawn in line.
    expect(ink?.props.fill).toBeNull();
  });

  test('the ink is the colour it was handed — a token at the call site, never a hex here', () => {
    const one = draw(IconBookmark, '#265F7D').ink?.props.stroke;
    const other = draw(IconBookmark, '#8C2F39').ink?.props.stroke;
    expect(one).toBeDefined();
    expect(other).toBeDefined();
    expect(one).not.toEqual(other);
  });

  test('exactly one 2px 45° notch, in the NE quadrant, on every drawn glyph', () => {
    for (const [name, Icon] of BAR_SET) {
      const notches = draw(Icon).paths.filter(d => NOTCH.test(d));
      if (name === 'IconHouse') {
        // The almirah is the documented exception the ruling itself drew: its
        // carcase corner IS the notch, cut into the outline by `h11l2 2`, so
        // a separate tick would be a second one.
        expect(notches).toHaveLength(0);
        expect(draw(Icon).paths[0]).toContain('h11l2 2');
        continue;
      }
      expect(notches).toHaveLength(1);
      const [, x, y] = NOTCH.exec(notches[0]) as RegExpExecArray;
      expect(Number(x)).toBeGreaterThan(12);
      expect(Number(y)).toBeLessThan(12);
    }
  });
});

describe('the set-aside tag', () => {
  test('it is a swing ticket with a cut foot, a punched eyelet and one written line', () => {
    const tag = draw(IconBookmark);

    // The ticket: down the sides, then the foot cut to a V and closed. The V
    // is what reads as "kept" at 20px, and it is the ticket's own tail — not
    // a ribbon, not a star, not a heart. Nothing here scores or rates a piece.
    expect(tag.paths[0]).toBe('M7.5 4.5h9v16l-4.5 -3.5 -4.5 3.5z');

    // The eyelet the thread went through — a circle, which is the one shape
    // an eyelet is allowed to be (brand law 5).
    expect(tag.circles).toHaveLength(1);
    expect(tag.circles[0].props).toMatchObject({ cx: '12', cy: '8', r: '1.5' });

    // One written line, and only one: a tag says what it is, not how it did.
    expect(tag.paths).toContain('M9.5 12.5h5');

    // Body, line, notch — three paths and no more. Nothing decorative rides
    // along, and nothing counts anything.
    expect(tag.paths).toHaveLength(3);
  });

  test('every coordinate sits on the half-grid, so the strokes land crisp', () => {
    const tag = draw(IconBookmark);
    const numbers = [
      ...tag.paths.flatMap(d => d.match(/-?\d+(?:\.\d+)?/g) ?? []),
      ...tag.circles.flatMap(c => [c.props.cx, c.props.cy, c.props.r].map(String)),
    ].map(Number);

    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n * 2).toBe(Math.round(n * 2));
  });
});
