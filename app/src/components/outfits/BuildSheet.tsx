/**
 * BUILD A LOOK — and, with the same hands, amend one.
 *
 * Ports the web builder (src/pages/Outfits.tsx) to a bottom plate. What
 * travelled: a name, any number of pieces from any category, an optional
 * occasion, and the rule that a look is not a slot machine — two coats and
 * three necklaces is a valid answer, so nothing here is one-per-category.
 *
 * WHAT DID NOT TRAVEL, and why each is a deliberate absence rather than an
 * oversight:
 *
 *  - THE DEAL. The web can deal a set from getWearablePool(). The native
 *    provider exposes no such pool, and inventing a second definition of
 *    "ready to wear" on the phone is exactly the duplicated-maths defect
 *    docs/34 §5 exists to prevent. The room says nothing about a deal, so
 *    nothing here is a promise the app cannot keep.
 *  - THE CATEGORY GROUPING. The web groups the picker by settings.categories,
 *    hides quiet categories behind a toggle, and then needs a sweep for
 *    "orphans" — pieces filed under a category since deleted, which otherwise
 *    drop silently out of every outfit anybody could build. One flat grid of
 *    the active closet, in the closet's own alphabetical order, cannot have
 *    that defect: every active piece is offered, including quiet ones and
 *    ones whose category no longer exists. The piece's name is printed under
 *    every tile, so nothing is identified by photograph alone. The trade is
 *    findability in a very large closet, and it is a trade this file is
 *    making knowingly.
 *
 * THE DISABLED BUTTON IS THE BUG THIS SHEET WAS BUILT AROUND. The provider
 * refuses a nameless or empty look by answering null (lib/wardrobe.tsx
 * addOutfit), and a refusal that can explain itself is worth more than a
 * control that has gone grey. "Save the look" is ALWAYS pressable, and a
 * press that cannot be honoured answers in a sentence naming the missing
 * half. See looks.ts refusalSentence.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { displayTag, type ClothingItem } from '@almari/shared/types';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { IconCheck } from '../../icons';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { Sheet } from '../furniture/Sheet';
import { piecesPhrase, refusalSentence } from './looks';
import { Tile } from './Tile';

export interface LookDraft {
  name: string;
  itemIds: string[];
  occasion?: string;
}

/**
 * Commit the draft. Answers the look's id, or null when the record refused it
 * — the provider's own protocol, carried through unchanged so the sheet never
 * has to guess whether a save happened.
 */
export type CommitLook = (draft: LookDraft) => string | null;

export function BuildSheet({
  open,
  mode,
  initial,
  items,
  occasions,
  occasionClearable = true,
  onClose,
  onCommit,
}: {
  open: boolean;
  /** 'build' writes a new look; 'amend' edits the one already open. */
  mode: 'build' | 'amend';
  initial?: LookDraft;
  /** The active closet — retired pieces are not offered (they are not gone). */
  items: ClothingItem[];
  /** This wardrobe's own occasion tags; free text, six by default. */
  occasions: string[];
  /**
   * May the occasion be taken back off?
   *
   * On a new look, yes: nothing is written, so an unchosen tag is simply
   * absent. On a look that ALREADY carries one, no — and the reason is the
   * record's, not this sheet's. updateOutfit's whitelist assigns only keys
   * whose value is not `undefined` (lib/wardrobe.tsx), so a patch cannot say
   * "take this off"; the only way to fake it is to write an empty string,
   * which is a value the web never writes and which the provider's addOutfit
   * goes out of its way to avoid ("a look with no occasion is byte-identical
   * to one written by the web"). Inventing it here would put a shape into
   * somebody's document that no migration case has ever seen.
   *
   * So the control does what the record can do, and the sheet says why. The
   * dressing room made the same call about packing a shelf: read-only is
   * honest, inventing the control is not.
   */
  occasionClearable?: boolean;
  onClose: () => void;
  onCommit: CommitLook;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const { width } = useWindowDimensions();

  const [name, setName] = useState(initial?.name ?? '');
  const [picked, setPicked] = useState<string[]>(initial?.itemIds ?? []);
  const [occasion, setOccasion] = useState(initial?.occasion ?? '');
  /** Said only after a press: the room never scolds a form nobody submitted. */
  const [refused, setRefused] = useState<string | null>(null);

  // Opening the sheet re-reads the draft. Without this, amending look B after
  // amending look A would show A's fields — the sheet is mounted once and the
  // state would outlive the look it belongs to.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setPicked(initial?.itemIds ?? []);
    setOccasion(initial?.occasion ?? '');
    setRefused(null);
    // The draft is read at the moment of opening, deliberately: re-syncing on
    // every keystroke of the underlying record would fight the person typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const commit = () => {
    const draft: LookDraft = {
      name,
      itemIds: picked,
      occasion: occasion.trim().length > 0 ? occasion : undefined,
    };
    // Predicted first, so the sentence names the missing half rather than
    // reporting a bare failure...
    const predicted = refusalSentence(name, picked);
    if (predicted !== null) {
      setRefused(predicted);
      return;
    }
    // ...and the record still has the last word. If it refuses something this
    // room thought was fine, that is said too rather than swallowed.
    const id = onCommit(draft);
    if (id === null) {
      setRefused('This look was not written down. Nothing was lost — the pieces and the name are still here.');
      return;
    }
    onClose();
  };

  const gutter = 20;
  const gap = 12;
  const columns = 3;
  const tileWidth = Math.floor((width - gutter * 2 - gap * (columns - 1)) / columns);

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  return (
    <Sheet open={open} onClose={onClose} label={mode === 'build' ? 'Close build a look' : 'Close amend this look'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.display, fontSize: TYPE.editorial, color: tokens.text }}
        >
          {mode === 'build' ? 'Build a look' : 'Amend this look'}
        </Text>
        <Text
          style={{
            fontFamily: fonts.ui,
            fontSize: TYPE.body,
            lineHeight: Math.round(TYPE.body * 1.5),
            color: tokens.text2,
            marginTop: 8,
          }}
        >
          Take as many pieces as the look needs, from anywhere in the closet. Two coats and three
          necklaces is a valid answer.
        </Text>

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>What to call it</Text>
        <TextInput
          accessibilityLabel="What to call it"
          value={name}
          onChangeText={text => {
            setName(text);
            setRefused(null);
          }}
          placeholder="Tuesday blacks, the good coat, opening night"
          placeholderTextColor={tokens.text2}
          style={{
            fontFamily: fonts.ui,
            fontSize: TYPE.body,
            color: tokens.text,
            minHeight: 44,
            paddingHorizontal: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: tokens.border,
            borderRadius: RADIUS,
            backgroundColor: tokens.surface,
          }}
        />

        {occasions.length > 0 ? (
          <>
            <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>
              What it is for — optional
            </Text>
            <View style={styles.chips}>
              {occasions.map(tag => (
                <Chip
                  key={tag}
                  selected={occasion === tag}
                  onPress={() =>
                    setOccasion(occasion === tag ? (occasionClearable ? '' : tag) : tag)
                  }
                >
                  {displayTag(tag)}
                </Chip>
              ))}
            </View>
            {occasionClearable ? null : (
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 13,
                  lineHeight: 19,
                  color: tokens.text2,
                  marginTop: 10,
                }}
              >
                What a look is for can be changed here, but not taken off again — the record has no
                way yet to say a look is for nothing in particular.
              </Text>
            )}
          </>
        ) : null}

        <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>
          The pieces{picked.length > 0 ? ` — ${piecesPhrase(picked.length)} in` : ''}
        </Text>

        {items.length === 0 ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.body,
              lineHeight: Math.round(TYPE.body * 1.5),
              color: tokens.text2,
            }}
          >
            The closet is empty, so there is nothing to put together yet. Add a piece and this sheet
            has something to work with.
          </Text>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {items.map(item => {
              const on = picked.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={item.name}
                  onPress={() => {
                    toggle(item.id);
                    setRefused(null);
                  }}
                  style={{ width: tileWidth }}
                >
                  <View>
                    <Tile item={item} size={tileWidth} picked={on} />
                    {on ? (
                      <View
                        style={[
                          styles.mark,
                          { backgroundColor: tokens.inkFill, borderRadius: RADIUS },
                        ]}
                      >
                        <IconCheck size={12} color={tokens.onInk} />
                      </View>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontFamily: fonts.ui,
                      fontSize: 13,
                      lineHeight: 17,
                      color: tokens.text,
                      marginTop: 6,
                    }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* THE REFUSAL, IN WORDS. Never a red plate: nothing has gone wrong,
            the look is simply not finished being described. */}
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
            {mode === 'build' ? 'Save the look' : 'Save the changes'}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
});
