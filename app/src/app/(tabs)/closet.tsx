/**
 * Closet — ports src/pages/Closet.tsx (docs/34 §2.2), the alpha slice:
 * the pieces as branded tiles, a detail sheet with the facts and the
 * "Worn today" action, and the add-piece sheet with the minimal fields
 * (name, category, colour, price — "Name is the only required field;
 * everything else can arrive later", the web's own rule).
 *
 * Every number comes from @almari/shared: the specimen caption's
 * cost-per-wear via shared/cost, its phrasing via shared/similarity's
 * wearContext ("worn 14× · ₹3.12/wear"). Nothing is re-derived here.
 *
 * Web-only for now (named, not forgotten): photos and the drawn garment
 * plates (the tile shows the piece's colour on the flat mat), filters and
 * search, laundry, retire/delete, favourites, the pass-it-on flow. Each
 * returns with its own wave.
 */
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { costPerWear, formatPerWear, formatPrice, isRecordedAmount } from '@almari/shared/cost';
import { wearContext } from '@almari/shared/similarity';
import {
  categoryLabel,
  isQuietCategory,
  LAUNDRY_LABELS,
  PRESET_COLORS,
  SOURCE_LABELS,
  type AppSettings,
  type ClothingItem,
} from '@almari/shared/types';

import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { IconPlus } from '../../icons';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** Reads a YYYY-MM-DD local date without the toISOString day-shift. */
function readableDate(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Brand, or the maker when it's self-made — ports Closet.tsx makerLabel. */
function makerLabel(item: ClothingItem): string | null {
  if (item.source === 'self-made') return SOURCE_LABELS['self-made'];
  const brand = item.brand?.trim();
  return brand ? brand : null;
}

/**
 * The specimen caption — ports Closet.tsx specimenCaption: wears, and
 * cost-per-wear only once that number means something.
 */
function specimenCaption(item: ClothingItem): string {
  const cpwMeaningful = costPerWear(item).reason === 'ok';
  const wears =
    item.wearCount === 0 || cpwMeaningful
      ? wearContext(item)
      : `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`;
  const maker = makerLabel(item);
  return maker ? `${maker} · ${wears}` : wears;
}

/** The colour as a swatch — flat, radius 2, a hairline edge. Data, not a token. */
function Swatch({ color, size = 40 }: { color: string; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: Math.round(size * 1.25),
        borderRadius: RADIUS,
        backgroundColor: color,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tokens.border,
      }}
    />
  );
}

function ClosetRow({
  item,
  settings,
  onOpen,
}: {
  item: ClothingItem;
  settings: AppSettings;
  onOpen: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        pressed && { backgroundColor: tokens.sunken },
      ]}
    >
      <Swatch color={item.color} />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}>
          {item.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            textTransform: 'uppercase',
            color: tokens.text2,
            marginTop: 4,
          }}
        >
          {categoryLabel(settings, item.category)} · {specimenCaption(item)}
        </Text>
      </View>
    </Pressable>
  );
}

/** One ledger line in the detail sheet: a mono label, a plain value. */
function Fact({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={styles.fact}>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          textTransform: 'uppercase',
          color: tokens.text2,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}>{value}</Text>
    </View>
  );
}

/** The bottom plate both sheets sit on: hairline edge, radius 2, no shadow. */
function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

function DetailSheet({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const { getItem, settings, logWear } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const item = itemId ? getItem(itemId) : undefined;
  if (!item) return null;

  const cpw = costPerWear(item);
  const facts: Array<[string, string]> = [
    ['Category', categoryLabel(settings, item.category)],
    ['Wears', String(item.wearCount)],
  ];
  if (isRecordedAmount(item.cost)) facts.push(['Cost', formatPrice(item.cost)]);
  // Per-wear only once it means something — the caption rule, held here too.
  if (cpw.reason === 'ok') facts.push(['Per wear', `${formatPerWear(cpw.value)}/wear`]);
  if (item.lastWorn) facts.push(['Last worn', readableDate(item.lastWorn)]);
  if (item.laundryStatus !== 'clean') facts.push(['Standing', LAUNDRY_LABELS[item.laundryStatus]]);
  facts.push(['Added', readableDate(item.dateAdded)]);

  return (
    <Sheet open onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
        <Swatch color={item.color} size={56} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.displayItalic,
              fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
              fontSize: TYPE.editorial,
              color: tokens.text,
            }}
          >
            {item.name}
          </Text>
          {item.notes ? (
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.text2, marginTop: 4 }}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.factList, { borderColor: tokens.border }]}>
        {facts.map(([label, value]) => (
          <Fact key={label} label={label} value={value} />
        ))}
      </View>
      <View style={styles.sheetFooter}>
        <Button tone="tertiary" onPress={onClose}>
          Close
        </Button>
        {/* The one sanctioned hero fill: a log-wear action (brand law 3). */}
        <Button
          tone="hero"
          onPress={() => {
            logWear([item.id]);
            const total = item.wearCount + 1;
            showToast(`Logged. Worn ${total} ${total === 1 ? 'time' : 'times'}.`, 'seal');
            onClose();
          }}
        >
          Worn today
        </Button>
      </View>
    </Sheet>
  );
}

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, addItem } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(settings.categories[0]?.id ?? 'tops');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [price, setPrice] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const categories = settings.categories.filter(c => !isQuietCategory(settings, c.id));

  const fieldLabel = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
    marginBottom: 8,
  };

  const submit = () => {
    const trimmed = name.trim();
    // Name is the only required field — and a refusal says what is missing
    // rather than sitting disabled (the web door's own rule).
    if (!trimmed) {
      setHint('A name is all it needs to start.');
      return;
    }
    const parsedPrice = price.trim() === '' ? undefined : Number(price.trim());
    addItem({
      name: trimmed,
      category,
      color,
      season: [],
      occasion: [],
      imageUrl: '',
      favorite: false,
      ...(isRecordedAmount(parsedPrice) ? { cost: parsedPrice } : {}),
    });
    showToast('Added. It starts at 0 wears.', 'success');
    setName('');
    setPrice('');
    setHint(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: TYPE.editorial,
            color: tokens.text,
            marginBottom: 16,
          }}
        >
          Add a piece
        </Text>

        <Text style={fieldLabel}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          placeholder="What the piece is called"
          placeholderTextColor={tokens.text2}
          style={[
            styles.input,
            { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
          ]}
        />
        {hint ? (
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.warning, marginTop: 6 }}>
            {hint}
          </Text>
        ) : null}

        <Text style={[fieldLabel, { marginTop: 16 }]}>Category</Text>
        <View style={styles.chipRow}>
          {categories.map(c => (
            <Chip key={c.id} selected={category === c.id} onPress={() => setCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </View>

        <Text style={[fieldLabel, { marginTop: 16 }]}>Colour</Text>
        <View style={styles.chipRow}>
          {PRESET_COLORS.map(c => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: color === c }}
              onPress={() => setColor(c)}
              style={{
                width: 44,
                height: 44,
                borderRadius: RADIUS,
                backgroundColor: c,
                borderWidth: color === c ? 2 : StyleSheet.hairlineWidth,
                borderColor: color === c ? tokens.text : tokens.border,
              }}
            />
          ))}
        </View>

        <Text style={[fieldLabel, { marginTop: 16 }]}>Price</Text>
        <TextInput
          accessibilityLabel="Price"
          value={price}
          onChangeText={setPrice}
          placeholder="Optional. A recorded 0 is a real answer."
          placeholderTextColor={tokens.text2}
          keyboardType="numeric"
          style={[
            styles.input,
            { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
          ]}
        />

        <View style={styles.sheetFooter}>
          <Button tone="tertiary" onPress={onClose}>
            Not now
          </Button>
          <Button tone="primary" onPress={submit}>
            Add it
          </Button>
        </View>
      </ScrollView>
    </Sheet>
  );
}

export default function ClosetScreen() {
  const { activeItems, settings } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const sorted = useMemo(
    () => [...activeItems].sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.page}>
        <Masthead title="Closet" meta="Every piece, once" />
        {sorted.length === 0 ? (
          <View
            style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <Text
              style={{
                fontFamily: fonts.displayItalic,
                fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                fontSize: TYPE.editorial,
                color: tokens.text,
                marginBottom: 8,
              }}
            >
              Nothing hangs here yet.
            </Text>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: TYPE.body,
                lineHeight: Math.round(TYPE.body * 1.5),
                color: tokens.text2,
                marginBottom: 16,
              }}
            >
              One piece is enough to start: a name, and a photo if you have one. The ledger counts
              from its first wear.
            </Text>
            <Button
              tone="primary"
              icon={<IconPlus size={16} color={tokens.onInk} />}
              onPress={() => setAddOpen(true)}
            >
              Add a piece
            </Button>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ClosetRow item={item} settings={settings} onOpen={() => setDetailId(item.id)} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListFooterComponent={
              <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
                <Button
                  tone="primary"
                  icon={<IconPlus size={16} color={tokens.onInk} />}
                  onPress={() => setAddOpen(true)}
                >
                  Add a piece
                </Button>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
      <DetailSheet itemId={detailId} onClose={() => setDetailId(null)} />
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    minHeight: 44,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  factList: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
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
});
