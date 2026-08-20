/**
 * BUILD AN OUTFIT — and, with the same hands, amend one.
 *
 * Ports the web builder (src/pages/Outfits.tsx) to a bottom plate. What
 * travelled: a name, any number of pieces from any category, an optional
 * occasion, the rule that an outfit is not a slot machine (two coats and
 * three necklaces is a valid answer, so nothing here is one-per-category) —
 * and, from R5 this wave, the web's own grouping of the picker by category.
 *
 * R5, AND THE OBJECTION IT ANSWERS. This sheet used to offer one flat
 * alphabetical grid of the whole active closet. That had one real virtue —
 * every active piece is offered, including quiet ones and ones whose category
 * no longer exists — and one real cost, which the advisor named: in a closet
 * of any size, nothing is findable. The grouping keeps the virtue and pays
 * off the cost:
 *
 *   - SECTION ORDER IS settings.categories, the same order the closet lists
 *     them in. Categories are user data; nothing here assumes a
 *     top/bottom/shoe shape.
 *   - QUIET CATEGORIES ARE STILL SHOWN. The web hides them behind a checkbox
 *     because its picker is one of several ways in; this sheet is the only
 *     one, and a piece nobody can reach is a piece that has silently left
 *     every outfit anybody could build.
 *   - PIECES FILED UNDER A CATEGORY SINCE DELETED get their own section at the
 *     end, labelled with the category's own id, exactly as the web's orphan
 *     sweep does. That is the defect the flat grid could not have; it is not
 *     re-introduced here.
 *   - EVERY TILE STILL PRINTS ITS PIECE'S NAME, so nothing is identified by
 *     photograph alone.
 *
 * WHAT STILL DID NOT TRAVEL: THE DEAL. The web can deal a set from
 * getWearablePool(). The native provider exposes no such pool, and inventing
 * a second definition of "ready to wear" on the phone is exactly the
 * duplicated-maths defect docs/34 §5 exists to prevent. The room says nothing
 * about a deal, so nothing here is a promise the app cannot keep.
 *
 * THE OCCASION CAN NOW BE TAKEN OFF (R4). It could not before, and the reason
 * was the record's rather than this sheet's: updateOutfit's whitelist assigned
 * only keys whose value was not `undefined`, so a patch had no way to say
 * "take this off" and the only fake was an empty string — a value the web
 * never writes. R4 gave the patch a clear sentinel (`null`), so the control
 * now does what the record can do, in both modes, with no paragraph of
 * apology under it.
 *
 * THE DISABLED BUTTON IS THE BUG THIS SHEET WAS BUILT AROUND. The provider
 * refuses a nameless or empty outfit by answering null (lib/wardrobe.tsx
 * addOutfit), and a refusal that can explain itself is worth more than a
 * control that has gone grey. "Save the outfit" is ALWAYS pressable, and a
 * press that cannot be honoured answers in a sentence naming the missing
 * half. See looks.ts refusalSentence.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { displayTag, type ClothingItem, type UserCategory } from '@almari/shared/types';

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

export interface OutfitDraft {
  name: string;
  itemIds: string[];
  /** Absent means "for nothing in particular" — never `''`. */
  occasion?: string;
}

/**
 * Commit the draft. Answers the outfit's id, or null when the record refused
 * it — the provider's own protocol, carried through unchanged so the sheet
 * never has to guess whether a save happened.
 */
export type CommitOutfit = (draft: OutfitDraft) => string | null;

/** One section of the picker: a category, and what is filed under it. */
interface PieceGroup {
  id: string;
  label: string;
  items: ClothingItem[];
}

export function BuildSheet({
  open,
  mode,
  initial,
  items,
  categories,
  occasions,
  onClose,
  onCommit,
}: {
  open: boolean;
  /** 'build' writes a new outfit; 'amend' edits the one already open. */
  mode: 'build' | 'amend';
  initial?: OutfitDraft;
  /** The active closet — retired pieces are not offered (they are not gone). */
  items: ClothingItem[];
  /** This wardrobe's own categories, in its own order — the section order (R5). */
  categories: UserCategory[];
  /** This wardrobe's own occasion tags; free text, six by default. */
  occasions: string[];
  onClose: () => void;
  onCommit: CommitOutfit;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const { width } = useWindowDimensions();

  const [name, setName] = useState(initial?.name ?? '');
  const [picked, setPicked] = useState<string[]>(initial?.itemIds ?? []);
  const [occasion, setOccasion] = useState(initial?.occasion ?? '');
  /** Said only after a press: the room never scolds a form nobody submitted. */
  const [refused, setRefused] = useState<string | null>(null);

  // Opening the sheet re-reads the draft. Without this, amending outfit B
  // after amending outfit A would show A's fields — the sheet is mounted once
  // and the state would outlive the outfit it belongs to.
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

  /**
   * The picker's sections (R5). Ports the web's `groups` memo minus its quiet
   * filter — see the header for why quiet categories stay offered here.
   *
   * The orphan sweep at the end is load-bearing: without it a piece filed
   * under a category somebody has since deleted is reachable from no section
   * at all, and drops silently out of every outfit that could be built.
   */
  const groups = useMemo<PieceGroup[]>(() => {
    const known = new Set(categories.map(c => c.id));
    const rows: PieceGroup[] = categories
      .map(c => ({ id: c.id, label: c.label, items: items.filter(i => i.category === c.id) }))
      .filter(g => g.items.length > 0);

    const orphans: string[] = [];
    for (const item of items) {
      if (!known.has(item.category) && !orphans.includes(item.category)) orphans.push(item.category);
    }
    for (const id of orphans) {
      // categoryLabel's own fallback is the raw id (@almari/shared/types), so
      // an orphan section is labelled the one way the record can label it.
      rows.push({ id, label: id, items: items.filter(i => i.category === id) });
    }
    return rows;
  }, [categories, items]);

  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const commit = () => {
    const draft: OutfitDraft = {
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
      setRefused(
        'This outfit was not written down. Nothing was lost — the pieces and the name are still here.',
      );
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

  /** One piece, pressable. Stated once so every section draws the same tile. */
  const pieceTile = (item: ClothingItem) => {
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
            <View style={[styles.mark, { backgroundColor: tokens.inkFill, borderRadius: RADIUS }]}>
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
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={mode === 'build' ? 'Close build an outfit' : 'Close amend this outfit'}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.display, fontSize: TYPE.editorial, color: tokens.text }}
        >
          {mode === 'build' ? 'Build an outfit' : 'Amend this outfit'}
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
          Take as many pieces as the outfit needs, from any category. Two coats and three necklaces
          is a valid answer.
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
                  // R4: tapping the chosen tag again takes it off, in BOTH
                  // modes. The amend path sends null and the record clears.
                  onPress={() => setOccasion(occasion === tag ? '' : tag)}
                >
                  {displayTag(tag)}
                </Chip>
              ))}
            </View>
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
          groups.map(group => {
            const chosen = group.items.filter(i => picked.includes(i.id)).length;
            return (
              <View key={group.id} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={ledger}>{group.label}</Text>
                  {/* A count of what is in, never a target and never a ratio. */}
                  {chosen > 0 ? <Text style={ledger}>{chosen} in</Text> : null}
                </View>
                <View style={[styles.grid, { gap }]}>{group.items.map(pieceTile)}</View>
              </View>
            );
          })
        )}

        {/* THE REFUSAL, IN WORDS. Never a red plate: nothing has gone wrong,
            the outfit is simply not finished being described. */}
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
            {mode === 'build' ? 'Save the outfit' : 'Save the changes'}
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
  group: {
    marginBottom: 20,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
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
