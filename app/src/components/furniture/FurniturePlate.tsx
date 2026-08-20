/**
 * THE DRAWING IS THE CONTROL.
 *
 * You do not read a place off a list; you point at the drawer. "Third drawer
 * down on the left" is a recall task performed against a text field, and
 * tapping the third drawer down is a recognition task performed against a
 * picture of your own furniture (src/pages/Furniture.tsx).
 *
 * The marks come from plate.ts in unit space; this file is the only place that
 * knows a token, a face or a pixel. Two decisions worth stating:
 *
 *   THE HIT TARGETS ARE RN PRESSABLES, NOT SVG onPress. react-native-svg will
 *   take a press on a <Rect>, but a Pressable laid over the drawing gets the
 *   platform's own accessibility (role, label, selected state) and the
 *   platform's own press feedback for free — and the geometry that guarantees
 *   44px is the same geometry either way.
 *
 *   TYPE IS SIZED FROM THE PLATE'S REAL WIDTH. SVG font-size is in user units,
 *   so the size that holds the 13px interactive floor depends on how wide this
 *   plate actually rendered. plate.ts computes it from the scale we hand it;
 *   nothing here hard-codes a number.
 */
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { useFamilies } from '../../tokens/FontsContext';
import { useTheme } from '../../tokens/ThemeContext';
import type { ThemeTokens } from '../../tokens/themes';
import { piecePhrase, slotCountPhrase } from './forms';
import { drawFurniture, VIEW, type Mark, type Register } from './plate';
import type { Furniture } from '@almari/shared/types';

/** A register resolved to paint. Gold is decorative only — never a control. */
function stroke(r: Register, tokens: ThemeTokens): { color: string; width: number; dash?: number[] } {
  switch (r) {
    case 'case':
      return { color: tokens.text2, width: 2.5 };
    case 'part':
      return { color: tokens.text, width: 2 };
    case 'baste':
      return { color: tokens.text2, width: 2, dash: [4, 3] };
    case 'metal':
      return { color: tokens.gold, width: 2 };
    case 'ornament':
      return { color: tokens.text2, width: 2 };
  }
}

export function FurniturePlate({
  piece,
  counts,
  width,
  labels = true,
  openSlot = null,
  onSlot,
  style,
}: {
  piece: Furniture;
  counts: Record<string, number>;
  /** Rendered width in px. The index draws small; the detail page draws big. */
  width: number;
  labels?: boolean;
  openSlot?: string | null;
  onSlot?: (slotId: string) => void;
  style?: ViewStyle;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  const scale = width / VIEW.w;
  const height = VIEW.h * scale;
  const drawing = drawFurniture(piece, counts, scale, { labels });
  const fs = drawing.fontSize;

  const open = openSlot ? drawing.slots.find(s => s.id === openSlot) : undefined;

  const paint = (mark: Mark, i: number) => {
    if (mark.k === 'p') {
      const s = stroke(mark.r, tokens);
      return (
        <Path
          key={`p${i}`}
          d={mark.d}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeDasharray={s.dash}
        />
      );
    }
    return (
      <SvgText
        key={`t${i}`}
        x={mark.x}
        y={mark.y}
        fill={mark.filled ? tokens.text : tokens.text2}
        fontFamily={mark.filled ? fonts.monoMedium : fonts.mono}
        fontSize={fs}
        letterSpacing={fs * 0.06}
        textAnchor={mark.anchor}
        {...(mark.rot ? { rotation: -90, originX: mark.x, originY: mark.y } : null)}
      >
        {mark.s}
      </SvgText>
    );
  };

  return (
    <View style={[{ width, height }, style]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        accessible={!onSlot}
        accessibilityLabel={`${piece.name}, ${slotCountPhrase(piece.form, piece.slots.length)}`}
      >
        {drawing.marks.map(paint)}
        {/* THE PATTERN NOTCH marks the open compartment — the house's own
            fingerprint (brand law 8), put to the contract's named use. No fill,
            no tint, no glow: depth is hairlines. Drawn at 8 units rather than
            the web's 2 because this plate is a third of the width the web's
            is, and a 1.5px tick is not a mark, it is lint. */}
        {open ? (
          <Path
            d={`M${open.x + open.w - 20} ${open.y + 16}l8-8`}
            fill="none"
            stroke={tokens.text}
            strokeWidth={2.5}
            strokeLinecap="butt"
          />
        ) : null}
      </Svg>

      {/* The compartments, as controls. Insertion order — the object's own. */}
      {onSlot ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {drawing.slots.map(s => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.label}, ${piecePhrase(s.count)}`}
              accessibilityState={{ selected: s.id === openSlot }}
              onPress={() => onSlot(s.id)}
              style={{
                position: 'absolute',
                left: s.x * scale,
                top: s.y * scale,
                width: s.w * scale,
                height: s.h * scale,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
