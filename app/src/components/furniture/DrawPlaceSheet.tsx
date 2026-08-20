/**
 * DRAW A PLACE.
 *
 * The flow IS the artistry: the preview redraws as you press +, so you are
 * building the object rather than filling in a form about it. Four taps and a
 * name, and no network, no key and no account anywhere in it.
 *
 * WEB-ONLY FOR NOW, named rather than forgotten: "photograph the thing itself"
 * (src/pages/Furniture.tsx reads a picture of the open cupboard through the
 * relay and MOVES THE CONTROLS, saving nothing). It needs the intake path this
 * wave's other squads are laying, and it was never the only road in — drawing
 * one by hand is the road, and it is four taps.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  MAX_FURNITURE,
  MAX_FURNITURE_NAME,
  ORNAMENTS,
  type FurnitureForm,
  type Ornament,
} from '@almari/shared/types';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { FurniturePlate } from './FurniturePlate';
import {
  defaultSlotLabels,
  FORM_LABELS,
  FORM_NOTES,
  maxSlotsFor,
  ORNAMENT_LABELS,
  ORNAMENT_NOTES,
  SLOT_NOUN,
} from './forms';
import { previewPiece } from './plate';
import { Sheet } from './Sheet';

/** The forms, cheapest object first — nobody is short of furniture. */
const FORM_ORDER: FurnitureForm[] = [
  'rail',
  'chest',
  'shelves',
  'almirah',
  'almirah-carved',
  'almirah-fitted',
  'box',
  'hooks',
  'stand',
  'rack',
];

/**
 * One fewer, one more. Not the house Button: this control's label is a glyph
 * and its NAME is a sentence ("One more drawer"), and Button reads its label
 * off its own text. Everything else about it is the house's — 44px floor,
 * radius 2, a hairline, no shadow.
 */
function Stepper({
  glyph,
  name,
  disabled,
  onPress,
}: {
  glyph: string;
  name: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepper,
        { borderColor: tokens.text },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.85 },
      ]}
    >
      <Text style={{ fontFamily: fonts.ui, fontSize: 17, color: tokens.text }}>{glyph}</Text>
    </Pressable>
  );
}

export function DrawPlaceSheet({
  open,
  full,
  onClose,
  onDraw,
}: {
  open: boolean;
  /** The wardrobe already holds as many places as the room will draw. */
  full: boolean;
  onClose: () => void;
  /** Returns the new place's id, or null if the room refused it. */
  onDraw: (name: string, form: FurnitureForm, slotCount: number, ornament: Ornament) => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [name, setName] = useState('');
  const [form, setForm] = useState<FurnitureForm>('almirah');
  const [count, setCount] = useState(4);
  const [ornament, setOrnament] = useState<Ornament>('plain');

  const ceiling = maxSlotsFor(form);
  const slots = Math.min(count, ceiling);
  const noun = SLOT_NOUN[form];

  const preview = useMemo(
    () => previewPiece(name, form, defaultSlotLabels(form, slots), ornament),
    [name, form, slots, ornament],
  );

  const pick = (next: FurnitureForm) => {
    setForm(next);
    // Each form has its own ceiling, so the number has to come with it.
    setCount(c => Math.min(c, maxSlotsFor(next)));
  };

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const note = {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text2,
  };

  return (
    <Sheet open={open} onClose={onClose} label="Close draw a place">
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: TYPE.editorial,
            color: tokens.text,
            marginBottom: 16,
          }}
        >
          Draw a place
        </Text>

        {/* The drawing redraws as the controls move. Nothing decorative sits
            behind it; the mat is the flat ground the house uses for artwork. */}
        <View style={[styles.previewMat, { backgroundColor: tokens.mat }]}>
          <FurniturePlate piece={preview} counts={{}} width={200} labels={false} />
        </View>

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>What to call it</Text>
        <TextInput
          accessibilityLabel="What to call it"
          value={name}
          onChangeText={setName}
          maxLength={MAX_FURNITURE_NAME}
          placeholder="Bedroom almirah, the hall rail, the loft"
          placeholderTextColor={tokens.text2}
          style={[styles.input, { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui }]}
        />

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>What kind</Text>
        <View style={styles.chipRow}>
          {FORM_ORDER.map(f => (
            <Chip key={f} selected={form === f} onPress={() => pick(f)}>
              {FORM_LABELS[f]}
            </Chip>
          ))}
        </View>
        <Text style={[note, { marginTop: 8 }]}>{FORM_NOTES[form]}</Text>

        {/* A CARVED TREATMENT, offered only on the one form with room for one.
            The interior is never touched — a tray with a pattern on it is a
            tray you cannot see into. */}
        {form === 'almirah-fitted' ? (
          <>
            <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>How it is finished</Text>
            <View style={styles.chipRow}>
              {ORNAMENTS.map(o => (
                <Chip key={o} selected={ornament === o} onPress={() => setOrnament(o)}>
                  {ORNAMENT_LABELS[o]}
                </Chip>
              ))}
            </View>
            <Text style={[note, { marginTop: 8 }]}>{ORNAMENT_NOTES[ornament]}</Text>
          </>
        ) : null}

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>How many {noun[1]}</Text>
        <View style={styles.counter}>
          <Stepper
            glyph="−"
            name={`One fewer ${noun[0]}`}
            disabled={slots <= 1}
            onPress={() => setCount(c => Math.max(1, Math.min(c, ceiling) - 1))}
          />
          <Text
            accessibilityLabel={`${slots} ${slots === 1 ? noun[0] : noun[1]}`}
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              color: tokens.text,
              minWidth: 32,
              textAlign: 'center',
            }}
          >
            {slots}
          </Text>
          <Stepper
            glyph="+"
            name={`One more ${noun[0]}`}
            disabled={slots >= ceiling}
            onPress={() => setCount(c => Math.min(ceiling, c + 1))}
          />
        </View>
        {slots >= ceiling ? (
          <Text style={[ledger, { marginTop: 8 }]}>
            {ceiling} is as many as this drawing holds at a size a thumb can hit. A {ceiling + 1}th{' '}
            {noun[0]} is a second place.
          </Text>
        ) : null}

        {full ? (
          <Text style={[note, { marginTop: 16 }]}>
            This wardrobe already holds {MAX_FURNITURE} places, which is as many as the room will
            draw. Remove one to draw another — the clothes in it stay either way.
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Button tone="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            disabled={full}
            onPress={() => {
              onDraw(name.trim(), form, slots, ornament);
              setName('');
              setForm('almirah');
              setCount(4);
              setOrnament('plain');
            }}
          >
            Draw it
          </Button>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  previewMat: {
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepper: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
});
