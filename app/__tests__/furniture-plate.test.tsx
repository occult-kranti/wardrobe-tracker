/**
 * THE DRAWING IS THE CONTROL — so the drawing is tested like a control.
 *
 * This suite exists because of a measurement. The brief asked whether
 * react-native-svg's SvgXml could render src/lib/furnitureArt.ts's markup
 * faithfully; it was tried against the SDK 57 pin (react-native-svg 15.15.4)
 * and it cannot, in three ways that are all SILENT except one warning:
 *
 *   · `stroke="var(--color-text-2)"` — extractBrush warns and drops the paint,
 *     taking the whole carcass outline with it.
 *   · `style="font:500 19px var(--font-mono)"` — react-native-svg's own font
 *     shorthand regex accepts only normal|bold|italic before the size, so a
 *     numeric weight falls through to fontSize 12 and a fontFamily of
 *     "500 19px var(--font-mono)". That silently discards labelSize(scale),
 *     the function whose entire job is holding the 13px interactive floor.
 *   · `letter-spacing:.06em` — RN letterSpacing is a number of px.
 *
 * So plate.ts draws with primitives, and the tests below hold the two things
 * that measurement makes fragile: nothing may reintroduce a CSS custom
 * property into a mark, and rendering every form must not produce a single
 * "not a valid color or brush" warning.
 *
 * The rest is the feature's own law: every compartment is a legal tap target,
 * fullness is DRAWN and caps rather than counting, and an empty compartment is
 * basted rather than scolded.
 */
import { describe, expect, jest, test } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { FURNITURE_FORMS, type Furniture, type FurnitureForm } from '@almari/shared/types';

import { FurniturePlate } from '../src/components/furniture/FurniturePlate';
import { defaultSlotLabels, maxSlotsFor } from '../src/components/furniture/forms';
import { drawFurniture, labelSize, VIEW } from '../src/components/furniture/plate';
import { FontsProvider } from '../src/tokens/FontsContext';
import { ThemeProvider } from '../src/tokens/ThemeContext';

function piece(form: FurnitureForm, n: number): Furniture {
  return {
    id: `f-${form}`,
    name: `The ${form}`,
    form,
    slots: defaultSlotLabels(form, n).map((label, i) => ({ id: `s${i}`, label })),
    dateAdded: '2026-08-01',
  };
}

/** Every slot full, so the filled branch of every generator is exercised. */
const fullCounts = (f: Furniture, each = 3) =>
  Object.fromEntries(f.slots.map(s => [s.id, each]));

function mount(node: React.ReactElement) {
  return render(
    <ThemeProvider>
      <FontsProvider loaded>{node}</FontsProvider>
    </ThemeProvider>,
  );
}

/* ---------- every form draws, and every compartment is a control ---------- */

describe('the drawing renders, per form', () => {
  test.each(FURNITURE_FORMS)('%s draws marks and one hit target per compartment', form => {
    const n = maxSlotsFor(form);
    const f = piece(form, n);
    const d = drawFurniture(f, fullCounts(f));

    expect(d.marks.length).toBeGreaterThan(0);
    expect(d.slots.map(s => s.id)).toEqual(f.slots.map(s => s.id));
    // The count travels with the target, so a screen reader can say it.
    expect(d.slots.every(s => s.count === 3)).toBe(true);
    expect(d.view).toEqual(VIEW);
  });

  test.each(FURNITURE_FORMS)('%s draws at one compartment too', form => {
    const f = piece(form, 1);
    const d = drawFurniture(f, {});
    expect(d.marks.length).toBeGreaterThan(0);
    expect(d.slots).toHaveLength(1);
  });

  /**
   * THE 44px FLOOR. The plate is min(window − 40, 360) wide; on a 390pt phone
   * that is 350px in a 460-unit box, so one tap target needs 58 units. Every
   * form's ceiling was chosen to clear it and this is the check that says so.
   */
  test.each(FURNITURE_FORMS)('%s keeps every compartment over 44px at phone width', form => {
    const scale = 350 / VIEW.w;
    for (const n of [1, maxSlotsFor(form)]) {
      const f = piece(form, n);
      for (const s of drawFurniture(f, {}, scale).slots) {
        expect(Math.min(s.w, s.h) * scale).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

/* ---------- the SvgXml lesson, pinned ---------- */

describe('nothing carries CSS across to native', () => {
  test('no mark holds a custom property or a CSS font shorthand', () => {
    for (const form of FURNITURE_FORMS) {
      const f = piece(form, maxSlotsFor(form));
      for (const mark of drawFurniture(f, fullCounts(f)).marks) {
        const text = mark.k === 'p' ? mark.d : mark.s;
        expect(text).not.toMatch(/var\(--/);
        expect(text).not.toMatch(/font:/);
      }
    }
  });

  test('the ornamented fitted almirah is clean too', () => {
    for (const ornament of ['plain', 'mughal', 'rajput', 'shoji'] as const) {
      const f = { ...piece('almirah-fitted', 7), ornament };
      for (const mark of drawFurniture(f, {}).marks) {
        const text = mark.k === 'p' ? mark.d : mark.s;
        expect(text).not.toMatch(/var\(--/);
      }
    }
  });

  test('rendering every form raises no invalid-colour warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (const form of FURNITURE_FORMS) {
        const f = piece(form, maxSlotsFor(form));
        mount(<FurniturePlate piece={f} counts={fullCounts(f)} width={350} />);
      }
      const complaints = warn.mock.calls
        .map(c => String(c[0]))
        .filter(m => /not a valid color or brush/i.test(m));
      expect(complaints).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

/* ---------- fullness is drawn, never counted ---------- */

describe('fullness is drawn and never measured', () => {
  /** Paths only: the count is written in the label, and that is allowed. */
  const shapes = (f: Furniture, counts: Record<string, number>) =>
    drawFurniture(f, counts)
      .marks.filter(m => m.k === 'p')
      .map(m => `${m.r}:${m.d}`);

  test('a shelf holding nineteen and one holding twenty-three are the same drawing', () => {
    const f = piece('shelves', 3);
    const a = { [f.slots[0].id]: 19, [f.slots[1].id]: 19, [f.slots[2].id]: 19 };
    const b = { [f.slots[0].id]: 23, [f.slots[1].id]: 23, [f.slots[2].id]: 23 };
    expect(shapes(f, a)).toEqual(shapes(f, b));
    // …and it is emphatically NOT the empty drawing.
    expect(shapes(f, a)).not.toEqual(shapes(f, {}));
  });

  test('a bangle stand caps at three rings however many are on it', () => {
    const f = piece('stand', 3);
    const three = Object.fromEntries(f.slots.map(s => [s.id, 3]));
    const thirty = Object.fromEntries(f.slots.map(s => [s.id, 30]));
    expect(shapes(f, three)).toEqual(shapes(f, thirty));
    const metal = drawFurniture(f, thirty).marks.filter(m => m.k === 'p' && m.r === 'metal');
    expect(metal).toHaveLength(9);
  });

  test('an almirah hangs at most three garments on its rod', () => {
    const f = piece('almirah', 4);
    const many = { [f.slots[0].id]: 40 };
    const few = { [f.slots[0].id]: 3 };
    expect(shapes(f, many)).toEqual(shapes(f, few));
  });

  test("a chest's rebate is a share of the fullest drawer, not a capacity", () => {
    const f = piece('chest', 2);
    const [a, b] = f.slots;
    // The rebate is the only basting mark a FILLED drawer draws, and its one
    // variable is how far it runs: `h<width>` at the foot of the drawer face.
    const rebates = (counts: Record<string, number>) =>
      drawFurniture(f, counts)
        .marks.filter(m => m.k === 'p' && m.r === 'baste')
        .map(m => Number(/h(\d+)$/.exec((m as { d: string }).d)?.[1]));

    // Two equally full drawers rebate to exactly the same width.
    const even = rebates({ [a.id]: 6, [b.id]: 6 });
    expect(even).toHaveLength(2);
    expect(even[0]).toBe(even[1]);

    // The emptier of two runs shorter — a share of the fullest, drawn.
    const lopsided = rebates({ [a.id]: 6, [b.id]: 1 });
    expect(lopsided[1]).toBeLessThan(lopsided[0]);

    // And the fullest never runs the whole face: 0.92 is the cap, so the
    // drawing can never read as "this drawer is finished".
    expect(even[0]).toBeLessThanOrEqual(Math.round(254 * 0.92));
    expect(even[0]).toBeGreaterThan(0);
  });

  test('nothing anywhere is a percentage', () => {
    for (const form of FURNITURE_FORMS) {
      const f = piece(form, maxSlotsFor(form));
      for (const mark of drawFurniture(f, fullCounts(f, 7)).marks) {
        if (mark.k !== 't') continue;
        expect(mark.s).not.toMatch(/%/);
      }
    }
  });
});

/* ---------- an empty compartment is basted, not scolded ---------- */

describe('empty reads as available', () => {
  test('an empty drawer is basted and carries no handle', () => {
    const f = piece('chest', 3);
    const empty = drawFurniture(f, {});
    const filled = drawFurniture(f, fullCounts(f));
    const registers = (d: ReturnType<typeof drawFurniture>) =>
      d.marks.filter(m => m.k === 'p').map(m => m.r);
    expect(registers(empty)).toContain('baste');
    expect(registers(empty).filter(r => r === 'part')).toHaveLength(0);
    expect(registers(filled).filter(r => r === 'part').length).toBeGreaterThan(0);
  });
});

/* ---------- type holds the 13px floor, or is not drawn at all ---------- */

describe('labels', () => {
  test('the index draws no labels — they would land under the floor', () => {
    const f = piece('chest', 5);
    const small = drawFurniture(f, fullCounts(f), 160 / VIEW.w, { labels: false });
    expect(small.marks.filter(m => m.k === 't')).toHaveLength(0);
    expect(small.marks.filter(m => m.k === 'p').length).toBeGreaterThan(0);
  });

  test('the detail page draws them, at or above 13px however wide the plate', () => {
    for (const width of [280, 320, 350, 360]) {
      const scale = width / VIEW.w;
      const f = piece('chest', 5);
      const d = drawFurniture(f, fullCounts(f), scale);
      expect(d.marks.filter(m => m.k === 't').length).toBeGreaterThan(0);
      expect(d.fontSize).toBe(labelSize(scale));
      // The rendered size, which is the only one a thumb and an eye meet.
      expect(d.fontSize * scale).toBeGreaterThanOrEqual(13);
    }
  });

  test('a label too long for its column is cut, never run across its neighbour', () => {
    const f: Furniture = {
      ...piece('chest', 2),
      slots: [
        { id: 's0', label: 'The extremely long name of a drawer nobody would type' },
        { id: 's1', label: 'Short' },
      ],
    };
    const labels = drawFurniture(f, {}).marks.filter(m => m.k === 't');
    expect(labels[0].s).toMatch(/…$/);
    expect(labels[0].s.length).toBeLessThan(40);
  });
});

/* ---------- the compartments, as controls a person can reach ---------- */

describe('the plate as a control', () => {
  test('each compartment is a button that names itself and its count', () => {
    const f = piece('chest', 3);
    const counts = { [f.slots[0].id]: 4 };
    const shell = mount(
      <FurniturePlate piece={f} counts={counts} width={350} onSlot={() => undefined} />,
    );
    expect(shell.getByLabelText('Top drawer, 4 pieces')).toBeTruthy();
    expect(shell.getByLabelText('Second drawer, 0 pieces')).toBeTruthy();
    expect(shell.getByLabelText('Bottom drawer, 0 pieces')).toBeTruthy();
  });

  test('with no handler the drawing is one accessible image, not a field of buttons', () => {
    const f = piece('rail', 3);
    const shell = mount(<FurniturePlate piece={f} counts={{}} width={160} labels={false} />);
    expect(shell.getByLabelText('The rail, 3 sections')).toBeTruthy();
    expect(shell.queryByLabelText('Section 1, 0 pieces')).toBeNull();
  });

  test('the open compartment is marked, and only one is', () => {
    const f = piece('chest', 3);
    const shell = mount(
      <FurniturePlate
        piece={f}
        counts={{}}
        width={350}
        openSlot={f.slots[1].id}
        onSlot={() => undefined}
      />,
    );
    expect(shell.getByLabelText('Second drawer, 0 pieces').props.accessibilityState.selected).toBe(
      true,
    );
    expect(shell.getByLabelText('Top drawer, 0 pieces').props.accessibilityState.selected).toBe(
      false,
    );
  });
});
