/**
 * PUT THINGS IN — filing by the armful.
 *
 * "One at a time is how a closet of three hundred becomes eight hundred taps"
 * (src/pages/Furniture.tsx). Everything not already in this compartment is
 * offered; tap what lives here, then file the lot in one gesture.
 *
 * The tiles are FLAT (brand law 6): a photograph sits on the room's mat with
 * nothing behind it, and a piece with no photograph shows its own colour on
 * the same mat. No pattern paper, no seam arcs, nothing decorative behind
 * clothing.
 */
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ClothingItem } from '@almari/shared/types';

import { Button } from '../Button';
import { photoUri } from '../../lib/photos';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';
import { Sheet } from './Sheet';

/** One piece, as a flat tile. Nothing decorative behind the photograph. */
export function PieceTile({
  item,
  size,
  picked,
}: {
  item: ClothingItem;
  size: number;
  picked?: boolean;
}) {
  const { tokens } = useTheme();
  // `imageUrl` holds a path under the document directory on native and a data:
  // URI in a document the web app wrote (photos.ts). One call site resolves
  // both, and answers null for anything it cannot read — in which case the
  // piece shows its own colour rather than a broken frame.
  const uri = item.imageUrl ? photoUri(item.imageUrl) : null;
  return (
    <View
      style={{
        width: size,
        height: Math.round(size * 1.25),
        borderRadius: RADIUS,
        backgroundColor: tokens.mat,
        overflow: 'hidden',
        borderWidth: picked ? 2 : StyleSheet.hairlineWidth,
        borderColor: picked ? tokens.text : tokens.border,
      }}
    >
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: item.color }} />
      )}
    </View>
  );
}

export function FileSheet({
  open,
  slotLabel,
  candidates,
  onClose,
  onFile,
}: {
  open: boolean;
  slotLabel: string;
  /** Everything that is not already in this compartment. */
  candidates: ClothingItem[];
  onClose: () => void;
  onFile: (itemIds: string[]) => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  return (
    <Sheet
      open={open}
      onClose={() => {
        setPicked([]);
        onClose();
      }}
      label="Close put things in"
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: TYPE.editorial,
          color: tokens.text,
          marginBottom: 8,
        }}
      >
        Put things in {slotLabel}
      </Text>
      <Text
        style={{
          fontFamily: fonts.ui,
          fontSize: 13,
          lineHeight: 19,
          color: tokens.text2,
          marginBottom: 16,
        }}
      >
        Tap everything that lives here. Filing by the armful is the point — one at a time is how a
        closet of three hundred becomes eight hundred taps.
      </Text>

      {candidates.length === 0 ? (
        <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.body, color: tokens.text2 }}>
          Every piece in this wardrobe is already in here.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 320 }}>
          <View style={styles.grid}>
            {candidates.map(item => {
              const on = picked.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ selected: on }}
                  onPress={() => toggle(item.id)}
                  style={{ width: 92, opacity: on ? 1 : 0.75 }}
                >
                  <PieceTile item={item} size={92} picked={on} />
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.ui,
                      fontSize: 13,
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
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Button
          tone="tertiary"
          onPress={() => {
            setPicked([]);
            onClose();
          }}
        >
          Never mind
        </Button>
        <Button
          tone="primary"
          disabled={picked.length === 0}
          onPress={() => {
            onFile(picked);
            setPicked([]);
          }}
        >
          {picked.length === 1 ? 'File 1 piece here' : `File ${picked.length} pieces here`}
        </Button>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
});
