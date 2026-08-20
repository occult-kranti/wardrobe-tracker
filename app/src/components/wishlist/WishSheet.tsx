/**
 * SOMETHING YOU ARE CONSIDERING — the add sheet, and the same hands amending.
 *
 * Ports the web's add form (src/pages/Wishlist.tsx) to a bottom plate. What
 * travelled: what it is, the brand, the kind of piece, a colour, a price, a
 * priority, notes, and — the point of the whole room — a wait.
 *
 * NOTHING IS BOUGHT HERE. The web says it in the section aside and it is worth
 * saying twice: there is no link field, no shop, no affiliate anything, and
 * there never will be (brand law 11). A wish is a note to yourself.
 *
 * THE WAIT IS SET ONCE AND IS NEVER SET AGAIN. On a new wish the four options
 * are offered; on an amend the wait is a READ-ONLY line. That is not a missing
 * feature. A control that re-arms a cooling-off is a control that turns the
 * silence into a thing you keep re-negotiating with yourself, which is the
 * exact shape of a nag — and re-dating a wait from a form would also mean a
 * card that has already asked could be made to ask again, which the record
 * says once and means once (`coolingOff.asked`). The sheet says so in a
 * sentence rather than hiding the absence: the dressing room made the same
 * call about packing a shelf, and the look builder about clearing an occasion.
 *
 * THE SAVE BUTTON IS ALWAYS PRESSABLE. A refusal that can explain itself is
 * worth more than a control that has gone grey — squad C's finding in
 * components/outfits/BuildSheet.tsx, adopted here. A press that cannot be
 * honoured answers in a sentence naming what is missing, and never on a red
 * plate: nothing has gone wrong, the wish is simply not described yet.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  PRESET_COLORS,
  PRIORITY_LABELS,
  type CategoryId,
  type UserCategory,
  type WishlistItem,
} from '@almari/shared/types';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { IconCheck } from '../../icons';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { Sheet } from '../Sheet';
import { DEFAULT_WAIT_DAYS, parsePrice, WAIT_OPTIONS, waitLine } from './list';

/** Every field this sheet owns. The record's own words, in the record's shapes. */
export interface WishForm {
  name: string;
  brand?: string;
  category: CategoryId;
  color: string;
  price?: number;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

const PRIORITIES: ReadonlyArray<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

/**
 * What the sheet says when it cannot honour a press. Exported so a test can
 * pin the sentence rather than a substring of the screen.
 */
export function refusalSentence(name: string): string | null {
  if (name.trim().length > 0) return null;
  return 'This one needs something to call it. Say what the piece is and it goes on the list.';
}

export function WishSheet({
  open,
  mode,
  initial,
  existing,
  categories,
  onClose,
  onCommit,
}: {
  open: boolean;
  /** 'add' writes a new wish; 'amend' edits the one already on the list. */
  mode: 'add' | 'amend';
  initial?: WishForm;
  /** The wish being amended, for the read-only wait line. Absent on an add. */
  existing?: WishlistItem;
  /** This wardrobe's own categories — the closet's, not a second list. */
  categories: UserCategory[];
  onClose: () => void;
  /** `waitDays` is meaningful on an add and ignored on an amend. */
  onCommit: (form: WishForm, waitDays: number) => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  const fallbackCategory: CategoryId = categories[0]?.id ?? 'tops';

  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? fallbackCategory);
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [price, setPrice] = useState(initial?.price !== undefined ? String(initial.price) : '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(initial?.priority ?? 'medium');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [wait, setWait] = useState(DEFAULT_WAIT_DAYS);
  /** Said only after a press: the room never scolds a form nobody submitted. */
  const [refused, setRefused] = useState<string | null>(null);

  // Opening the sheet re-reads the draft. Without this, amending wish B after
  // amending wish A would show A's fields — the sheet is mounted once and the
  // state would outlive the wish it belongs to.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setBrand(initial?.brand ?? '');
    setCategory(initial?.category ?? fallbackCategory);
    setColor(initial?.color ?? PRESET_COLORS[0]);
    setPrice(initial?.price !== undefined ? String(initial.price) : '');
    setPriority(initial?.priority ?? 'medium');
    setNotes(initial?.notes ?? '');
    setWait(DEFAULT_WAIT_DAYS);
    setRefused(null);
    // The draft is read at the moment of opening, deliberately: re-syncing on
    // every keystroke of the underlying record would fight the person typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = () => {
    const predicted = refusalSentence(name);
    if (predicted !== null) {
      setRefused(predicted);
      return;
    }
    onCommit(
      {
        name: name.trim(),
        // Absent is the absence of the field, never an empty string in it — so
        // a wish written on the phone is byte-identical to one written by the
        // browser (the provider's own rule for occasions and ornaments).
        brand: brand.trim() || undefined,
        category,
        color,
        price: parsePrice(price),
        priority,
        notes: notes.trim() || undefined,
      },
      wait,
    );
    onClose();
  };

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text2,
  };
  const input = {
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    color: tokens.text,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border,
    borderRadius: RADIUS,
    backgroundColor: tokens.surface,
  };

  const standingWait = existing ? waitLine(existing) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={mode === 'add' ? 'Close add to the wishlist' : 'Close amend this wish'}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.display, fontSize: TYPE.editorial, color: tokens.text }}
        >
          {mode === 'add' ? 'Something you are considering' : 'Amend this wish'}
        </Text>
        <Text style={[body, { marginTop: 8 }]}>
          Nothing is bought here. This is a note to yourself about a piece that is not in the closet.
        </Text>

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>What is it</Text>
        <TextInput
          accessibilityLabel="What is it"
          value={name}
          onChangeText={text => {
            setName(text);
            setRefused(null);
          }}
          placeholder="Black wool coat"
          placeholderTextColor={tokens.text2}
          autoComplete="off"
          style={input}
        />

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Brand — optional</Text>
        <TextInput
          accessibilityLabel="Brand"
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand, or made by you"
          placeholderTextColor={tokens.text2}
          autoComplete="off"
          style={input}
        />

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Price — optional</Text>
        <TextInput
          accessibilityLabel="Price"
          value={price}
          onChangeText={setPrice}
          placeholder="What it would cost"
          placeholderTextColor={tokens.text2}
          inputMode="decimal"
          keyboardType="decimal-pad"
          style={[input, { fontFamily: fonts.mono, fontSize: 15 }]}
        />

        {categories.length > 0 ? (
          <>
            <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Kind of piece</Text>
            <View style={styles.chips}>
              {categories.map(cat => (
                <Chip key={cat.id} selected={category === cat.id} onPress={() => setCategory(cat.id)}>
                  {cat.label}
                </Chip>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Priority</Text>
        <View style={styles.chips}>
          {PRIORITIES.map(level => (
            <Chip key={level} selected={priority === level} onPress={() => setPriority(level)}>
              {PRIORITY_LABELS[level]}
            </Chip>
          ))}
        </View>

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Colour</Text>
        <View style={styles.swatches}>
          {PRESET_COLORS.map(hex => {
            const on = color.toLowerCase() === hex.toLowerCase();
            return (
              <Pressable
                key={hex}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${hex}`}
                accessibilityState={{ selected: on }}
                onPress={() => setColor(hex)}
                style={[
                  styles.swatch,
                  {
                    // The colour is data, not a token — it is what the piece is.
                    backgroundColor: hex,
                    borderWidth: on ? 2 : StyleSheet.hairlineWidth,
                    borderColor: on ? tokens.text : tokens.border,
                  },
                ]}
              >
                {on ? (
                  <View style={[styles.tick, { backgroundColor: tokens.surface }]}>
                    <IconCheck size={12} color={tokens.text} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {mode === 'add' ? (
          <>
            <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Let it wait</Text>
            <View style={styles.chips}>
              {WAIT_OPTIONS.map(opt => (
                <Chip key={opt.days} selected={wait === opt.days} onPress={() => setWait(opt.days)}>
                  {opt.label}
                </Chip>
              ))}
            </View>
            <Text style={[body, { marginTop: 10 }]}>
              Nothing is said while it waits. No reminder, no count. When the wait is up, the card
              asks once.
            </Text>
          </>
        ) : (
          <>
            <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>The wait</Text>
            <Text style={[body, { color: tokens.text }]}>
              {standingWait ?? 'This one is not waiting on anything.'}
            </Text>
            <Text style={[body, { marginTop: 10 }]}>
              A wait is set once. Everything else here can be changed as often as you like, but the
              silence you agreed to is not something to re-negotiate with yourself.
            </Text>
          </>
        )}

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Notes — optional</Text>
        <TextInput
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="What it would go with, where you saw it"
          placeholderTextColor={tokens.text2}
          multiline
          numberOfLines={2}
          style={[input, { minHeight: 66, textAlignVertical: 'top' }]}
        />

        {/* THE REFUSAL, IN WORDS. Never a red plate: nothing has gone wrong. */}
        {refused ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.body,
              lineHeight: Math.round(TYPE.body * 1.5),
              color: tokens.text,
              marginTop: 20,
            }}
          >
            {refused}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Button tone="tertiary" onPress={onClose}>
            Not now
          </Button>
          <Button tone="primary" onPress={commit}>
            {mode === 'add' ? 'Put it on the list' : 'Amend it'}
          </Button>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  swatch: {
    // 44 is the floor, not 40 — brand law 11's touch target, on a control that
    // looks small enough to be excused from it and is not.
    width: 44,
    height: 44,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
});
